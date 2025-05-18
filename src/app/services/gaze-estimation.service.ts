import { Injectable } from '@angular/core';
import * as regression from 'regression'; // Import library for Linear Regression
import { MIN_CALIBRATION_POINTS_FOR_TRAINING } from './calibration.service';
// @ts-ignore
import MLR from 'ml-regression-multivariate-linear';

export interface PointOfGaze {
  x: number;
  y: number;
}

// Interface for storing the trained regression model results
interface GazeModel {
  model: any | null; // Multivariate regression model (use any to avoid type error)
}

// Define constants for configuration
export const MIN_CALIBRATION_POINTS = 5; // Minimum calibration points required for training
const SMOOTHING_WINDOW = 4;       // Number of frames for smoothing  (higher value -> smoother but slower response)
const REGRESSION_PRECISION = 5;   // Number of decimal places for regression results

// Kalman filter parameters
const KALMAN_R = 10; // Measurement noise covariance
const KALMAN_Q = 0.1; // Process noise covariance

@Injectable({
  providedIn: 'root'
})
export class GazeEstimationService {

  private gazeModel: GazeModel = { model: null };
  private isTrained: boolean = false;
  private gazeHistory: PointOfGaze[] = [];

  private kalmanStateX = { x: 0, p: 1 };
  private kalmanStateY = { x: 0, p: 1 };
  private kalmanInitialized = false;

  private eyeballBuffer: {x: number, y: number, z: number}[] = [];
  private static readonly EYE_SMOOTH_WINDOW = 2;

  constructor() { }

  // Fixed issues with data preparation, error handling, and smoothing logic.
  trainModel(features: number[][], targetsX: number[], targetsY: number[]): void {
    console.log('Attempting to train gaze model with', features.length, 'feature sets.');
    this.resetModel();

    if (features.length < MIN_CALIBRATION_POINTS || features.length !== targetsX.length || features.length !== targetsY.length) {
      console.warn(`Insufficient or mismatched data for training. Features: ${features.length}, TargetsX: ${targetsX.length}, TargetsY: ${targetsY.length}. Need at least ${MIN_CALIBRATION_POINTS}.`);
      return;
    }

    // Prepare data for multivariate regression
    // X: NxM (N samples, M features), Y: Nx2 ([x, y] targets)
    // ตรวจสอบว่า features ทุกแถวมีขนาดเท่ากัน
    const featureLength = features[0]?.length || 0;
    if (!features.every(f => f.length === featureLength)) {
      console.error('Training aborted: Not all feature vectors have the same length.', features.map(f => f.length));
      return;
    }
    // Expect 10 features for training
    if (featureLength !== 10) {
      console.warn(`Training aborted: Feature vector length mismatch. Expected 10, got ${featureLength}`);
      return;
    }
    const X = features;
    const Y = features.map((_, i) => [targetsX[i], targetsY[i]]);

    try {
      const mlr = new MLR(X, Y);
      this.gazeModel.model = mlr;
      this.isTrained = true;
      console.log('Multivariate regression model trained.');
    } catch (e) {
      console.error('Failed to train multivariate regression model:', e);
      this.resetModel();
    }
  }

  predictGaze(currentFeatures: number[]): PointOfGaze | null {
    if (!this.isTrained || !this.gazeModel.model) {
      console.warn('[Gaze Prediction] Skipped: Model is not trained.');
      return null;
    }

    if (!Array.isArray(currentFeatures) || currentFeatures.length === 0) {
      console.warn('[Gaze Prediction] Skipped: Invalid features input.');
      return null;
    }

    // Expect 10 features
    const expectedLength = 10;
    if (currentFeatures.length !== expectedLength) {
      console.warn(`[Gaze Prediction] Skipped: Feature length mismatch (expected ${expectedLength}, got ${currentFeatures.length})`);
      return null;
    }

    try {
      // Make prediction
      const prediction = this.gazeModel.model.predict(currentFeatures);

      if (!Array.isArray(prediction) || prediction.length < 2) {
        console.warn('[Gaze Prediction] Failed: Unexpected prediction format.', prediction);
        return null;
      }

      const [predictedX, predictedY] = prediction;

      if (isNaN(predictedX) || isNaN(predictedY)) {
        console.warn('[Gaze Prediction] Failed: NaN detected in prediction.', { predictedX, predictedY });
        return null;
      }

      const rawGaze: PointOfGaze = { x: predictedX, y: predictedY };

      // Apply Kalman filter for smoothing
      const smoothedGaze = this._applySmoothing(rawGaze);

      // Optional: log prediction
      // console.debug('[Gaze Prediction] Raw:', rawGaze, 'Smoothed:', smoothedGaze);

      return smoothedGaze;

    } catch (error) {
      console.error('[Gaze Prediction] Error during prediction:', error);
      return null;
    }
  }


  resetModel(): void {
    this.gazeModel = { model: null };
    this.isTrained = false;
    this.resetSmoothing(); // Also reset smoothing history when model is reset
    console.log("Gaze estimation model reset.");
  }

  isModelTrained(): boolean {
      return this.isTrained;
  }

  // --- Smoothing Logic ---
  private _applySmoothing(newGaze: PointOfGaze): PointOfGaze {
    // Kalman filter for each axis
    if (!this.kalmanInitialized) {
      this.kalmanStateX = { x: newGaze.x, p: 1 };
      this.kalmanStateY = { x: newGaze.y, p: 1 };
      this.kalmanInitialized = true;
      return { x: newGaze.x, y: newGaze.y };
    }
    // Predict
    this.kalmanStateX.p += KALMAN_Q;
    this.kalmanStateY.p += KALMAN_Q;
    // Update X
    const kx = this.kalmanStateX.p / (this.kalmanStateX.p + KALMAN_R);
    this.kalmanStateX.x = this.kalmanStateX.x + kx * (newGaze.x - this.kalmanStateX.x);
    this.kalmanStateX.p = (1 - kx) * this.kalmanStateX.p;
    // Update Y
    const ky = this.kalmanStateY.p / (this.kalmanStateY.p + KALMAN_R);
    this.kalmanStateY.x = this.kalmanStateY.x + ky * (newGaze.y - this.kalmanStateY.x);
    this.kalmanStateY.p = (1 - ky) * this.kalmanStateY.p;
    return { x: this.kalmanStateX.x, y: this.kalmanStateY.x };
  }

  resetSmoothing(): void {
    this.gazeHistory = [];
    this.kalmanInitialized = false;
  }

  // --- Feature Extraction Logic ---

  // --- Affine Transformation & Temporal Smoothing for Eyeball Center ---

  // Helper: Apply 4x4 affine transformation matrix to a 3D landmark
  public static applyAffineToLandmark(lm: {x: number, y: number, z: number}, matrix: number[]): {x: number, y: number, z: number} {
    const x = lm.x, y = lm.y, z = lm.z;
    const m = matrix;
    const tx = m[0]*x + m[1]*y + m[2]*z + m[3];
    const ty = m[4]*x + m[5]*y + m[6]*z + m[7];
    const tz = m[8]*x + m[9]*y + m[10]*z + m[11];
    return { x: tx, y: ty, z: tz };
  }

  // Call this with the new (normalized) eyeball center every frame
  public smoothEyeballCenter(newCenter: {x: number, y: number, z: number}): {x: number, y: number, z: number} {
    this.eyeballBuffer.push(newCenter);
    if (this.eyeballBuffer.length > GazeEstimationService.EYE_SMOOTH_WINDOW) this.eyeballBuffer.shift();
    const avg = this.eyeballBuffer.reduce((acc, v) => ({
      x: acc.x + v.x,
      y: acc.y + v.y,
      z: acc.z + v.z
    }), {x:0, y:0, z:0});
    const n = this.eyeballBuffer.length;
    return { x: avg.x/n, y: avg.y/n, z: avg.z/n };
  }

  public resetEyeballSmoothing(): void {
    this.eyeballBuffer = [];
  }
}
