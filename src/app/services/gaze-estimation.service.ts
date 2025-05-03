import { Injectable } from '@angular/core';
import * as regression from 'regression'; // Import library for Linear Regression
import { MIN_CALIBRATION_POINTS_FOR_TRAINING } from './calibration.service';

export interface PointOfGaze {
  x: number;
  y: number;
}

// Interface for storing the trained regression model results
interface GazeModel {
  // Note: regression.Result includes 'predict' method, coefficients ('equation'), r2, etc.
  modelX: regression.Result | null; // Stores the result from regression.js for the X-axis
  modelY: regression.Result | null; // Stores the result from regression.js for the Y-axis
}

// Define constants for configuration
export const MIN_CALIBRATION_POINTS = 5; // Minimum calibration points required for training
const SMOOTHING_WINDOW = 4;       // Number of frames for smoothing  (higher value -> smoother but slower response)
const REGRESSION_PRECISION = 5;   // Number of decimal places for regression results

@Injectable({
  providedIn: 'root'
})
export class GazeEstimationService {

  private gazeModel: GazeModel = { modelX: null, modelY: null };
  private isTrained: boolean = false;
  private gazeHistory: PointOfGaze[] = [];

  constructor() { }

  // Fixed issues with data preparation, error handling, and smoothing logic.
  trainModel(features: number[][], targetsX: number[], targetsY: number[]): void {
    console.log('Attempting to train gaze model with', features.length, 'feature sets.');
    this.resetModel();

    // Validate input data
    if (features.length < MIN_CALIBRATION_POINTS || features.length !== targetsX.length || features.length !== targetsY.length) {
      console.warn(`Insufficient or mismatched data for training. Features: ${features.length}, TargetsX: ${targetsX.length}, TargetsY: ${targetsY.length}. Need at least ${MIN_CALIBRATION_POINTS}.`);
      return;
    }

    // Prepare data for regression
    const dataForX: [number, number][] = features.map((f, index) => [f[0], targetsX[index]]);
    const dataForY: [number, number][] = features.map((f, index) => [f[0], targetsY[index]]);

    try {
      console.log(`Training with ${dataForX.length} valid data points using Polynomial Regression (Order 2).`);

      // Train models using Polynomial Regression
      this.gazeModel.modelX = regression.polynomial(dataForX, { order: 2, precision: REGRESSION_PRECISION });
      this.gazeModel.modelY = regression.polynomial(dataForY, { order: 2, precision: REGRESSION_PRECISION });

      console.log('Model X Equation:', this.gazeModel.modelX.string);
      console.log('Model Y Equation:', this.gazeModel.modelY.string);
      console.log('Model X R2:', this.gazeModel.modelX.r2);
      console.log('Model Y R2:', this.gazeModel.modelY.r2);

      this.isTrained = !!(this.gazeModel.modelX && this.gazeModel.modelY);

      if (this.isTrained) {
        console.log('Gaze estimation model trained successfully.');
      } else {
        console.error('Polynomial regression failed to produce models.');
        this.resetModel();
      }

    } catch (error) {
      console.error('Error training polynomial regression model:', error);
      this.resetModel();
    }
  }

  predictGaze(currentFeatures: number[]): PointOfGaze | null {
    if (!this.isTrained || !this.gazeModel.modelX || !this.gazeModel.modelY) {
      console.warn('Prediction skipped: Model is not trained.');
      return null;
    }

    if (!Array.isArray(currentFeatures) || currentFeatures.length === 0) {
      console.warn('Prediction skipped: Invalid current features array.');
      return null;
    }

    try {
      const featureValue = currentFeatures[0]; // Use the first feature for prediction
      const predictedX = this.gazeModel.modelX.predict(featureValue)[1];
      const predictedY = this.gazeModel.modelY.predict(featureValue)[1];

      if (isNaN(predictedX) || isNaN(predictedY)) {
        console.warn('Prediction resulted in NaN. Features:', currentFeatures);
        return null;
      }

      const rawGaze: PointOfGaze = { x: predictedX, y: predictedY };
      return this._applySmoothing(rawGaze);

    } catch (error) {
      console.error('Error predicting gaze:', error);
      return null;
    }
  }

  resetModel(): void {
    this.gazeModel = { modelX: null, modelY: null };
    this.isTrained = false;
    this.resetSmoothing(); // Also reset smoothing history when model is reset
    console.log("Gaze estimation model reset.");
  }

  isModelTrained(): boolean {
      return this.isTrained;
  }

  // --- Smoothing Logic ---
  private _applySmoothing(newGaze: PointOfGaze): PointOfGaze {
      this.gazeHistory.push(newGaze);
      if (this.gazeHistory.length > SMOOTHING_WINDOW) {
        this.gazeHistory.shift();
      }
      if (this.gazeHistory.length === 0) return newGaze;
      let sumX = 0, sumY = 0;
      for (const gaze of this.gazeHistory) {
        sumX += gaze.x;
        sumY += gaze.y;
      }
      return { x: sumX / this.gazeHistory.length, y: sumY / this.gazeHistory.length };
  }

  resetSmoothing(): void {
    this.gazeHistory = [];
  }

  // --- Feature Extraction Logic ---
}
