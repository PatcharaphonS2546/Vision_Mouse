import { Injectable } from '@angular/core';
import * as regression from 'regression'; // Import library for Linear Regression
import { MIN_CALIBRATION_POINTS_FOR_TRAINING } from './calibration.service';
// @ts-ignore
import MLR from 'ml-regression-multivariate-linear';

export interface PointOfGaze {
  x: number;
  y: number;
  timestamp?: number;
  confidence?: number;
}

// Enhanced smoothing configuration
export interface SmoothingConfig {
  enableKalmanFilter: boolean;
  enableExponentialSmoothing: boolean;
  enableOutlierDetection: boolean;
  kalmanProcessNoise: number;
  kalmanMeasurementNoise: number;
  exponentialAlpha: number;
  outlierThreshold: number;
  smoothingWindowSize: number;
  minConfidenceThreshold: number;
}

// Kalman filter state for 2D tracking
interface KalmanState2D {
  x: number;    // Position X
  y: number;    // Position Y
  vx: number;   // Velocity X
  vy: number;   // Velocity Y
  px: number;   // Covariance X
  py: number;   // Covariance Y
  pvx: number;  // Velocity covariance X
  pvy: number;  // Velocity covariance Y
}

// Outlier detection result
interface OutlierDetectionResult {
  isOutlier: boolean;
  confidence: number;
  reason: string;
}

// Interface for storing the trained regression model results
interface GazeModel {
  model: any | null; // Multivariate regression model (use any to avoid type error)
}

// Define constants for configuration
export const MIN_CALIBRATION_POINTS = 5; // Minimum calibration points required for training
const SMOOTHING_WINDOW = 4;       // Number of frames for smoothing  (higher value -> smoother but slower response)
const REGRESSION_PRECISION = 5;   // Number of decimal places for regression results

// Enhanced Kalman filter parameters
const KALMAN_R = 10; // Measurement noise covariance
const KALMAN_Q = 0.1; // Process noise covariance

// Default smoothing configuration
const DEFAULT_SMOOTHING_CONFIG: SmoothingConfig = {
  enableKalmanFilter: true,
  enableExponentialSmoothing: true,
  enableOutlierDetection: true,
  kalmanProcessNoise: 0.1,
  kalmanMeasurementNoise: 10,
  exponentialAlpha: 0.3,
  outlierThreshold: 150, // pixels
  smoothingWindowSize: 5,
  minConfidenceThreshold: 0.5
};

@Injectable({
  providedIn: 'root'
})
export class GazeEstimationService {

  private gazeModel: GazeModel = { model: null };
  private isTrained: boolean = false;
  private gazeHistory: PointOfGaze[] = [];

  // Enhanced Kalman filter state (2D with velocity)
  private kalmanState: KalmanState2D = {
    x: 0, y: 0, vx: 0, vy: 0,
    px: 1, py: 1, pvx: 1, pvy: 1
  };
  private kalmanInitialized = false;

  // Exponential smoothing state
  private exponentialState: PointOfGaze = { x: 0, y: 0 };
  private exponentialInitialized = false;

  // Outlier detection history
  private outlierHistory: PointOfGaze[] = [];
  private rejectedOutliers: number = 0;

  // Smoothing configuration
  private smoothingConfig: SmoothingConfig = { ...DEFAULT_SMOOTHING_CONFIG };

  // Legacy variables (keeping for backward compatibility)
  private kalmanStateX = { x: 0, p: 1 };
  private kalmanStateY = { x: 0, p: 1 };

  private eyeballBuffer: {x: number, y: number, z: number}[] = [];
  private static readonly EYE_SMOOTH_WINDOW = 2;

  // Expected feature dimensions tracking
  private expectedFeatureDimension = 10; // Default to original

  constructor() { }

  // Fixed issues with data preparation, error handling, and smoothing logic.
  trainModel(features: number[][], targetsX: number[], targetsY: number[]): void {
    console.log('Attempting to train gaze model with', features.length, 'feature sets.');
    this.resetModel();

    if (features.length < MIN_CALIBRATION_POINTS || features.length !== targetsX.length || features.length !== targetsY.length) {
      console.warn(`Insufficient or mismatched data for training. Features: ${features.length}, TargetsX: ${targetsX.length}, TargetsY: ${targetsY.length}. Need at least ${MIN_CALIBRATION_POINTS}.`);
      return;
    }

    // Update expected feature dimension based on training data
    this.expectedFeatureDimension = features[0]?.length || 10;
    console.log(`📏 Updated expected feature dimension to: ${this.expectedFeatureDimension}`);

    // Validate and clean data
    const cleanFeatures: number[][] = [];
    const cleanTargetsX: number[] = [];
    const cleanTargetsY: number[] = [];

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const targetX = targetsX[i];
      const targetY = targetsY[i];

      // Validate feature array with dynamic dimension
      if (!Array.isArray(feature) || feature.length !== this.expectedFeatureDimension) {
        console.warn(`Skipping invalid feature at index ${i}: expected array of length ${this.expectedFeatureDimension}, got:`, feature?.length);
        continue;
      }

      // Validate all numbers in feature
      const cleanFeature = feature.map(val => {
        const num = Number(val);
        return isNaN(num) || !isFinite(num) ? 0 : num;
      });

      // Validate targets
      const cleanX = isNaN(Number(targetX)) || !isFinite(Number(targetX)) ? 0 : Number(targetX);
      const cleanY = isNaN(Number(targetY)) || !isFinite(Number(targetY)) ? 0 : Number(targetY);

      cleanFeatures.push(cleanFeature);
      cleanTargetsX.push(cleanX);
      cleanTargetsY.push(cleanY);
    }

    console.log('Cleaned training data:', { 
      features: cleanFeatures.length, 
      sampleFeature: cleanFeatures[0],
      sampleTargets: [cleanTargetsX[0], cleanTargetsY[0]]
    });

    if (cleanFeatures.length < MIN_CALIBRATION_POINTS) {
      console.warn(`Insufficient clean data for training. Need at least ${MIN_CALIBRATION_POINTS}, got ${cleanFeatures.length}.`);
      return;
    }

    // Use enhanced features directly (no polynomial expansion needed)
    const X = cleanFeatures; // Features are already enhanced by calibration service
    const Y = cleanFeatures.map((_, i) => [cleanTargetsX[i], cleanTargetsY[i]]);

    console.log('📊 Enhanced feature usage:');
    console.log('  • Enhanced features per sample:', cleanFeatures[0].length);
    console.log('  • Features already enhanced by calibration service');
    console.log('  • Training with', cleanFeatures.length, 'enhanced samples');

    try {
      const mlr = new MLR(X, Y);
      this.gazeModel.model = mlr;
      this.isTrained = true;
      console.log('✅ Enhanced multivariate regression model trained successfully with', cleanFeatures.length, 'samples.');
      console.log('📈 Using enhanced features from calibration service');
    } catch (e) {
      console.error('❌ Failed to train enhanced regression model:', e);
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

    // Check feature dimension (now dynamic based on training)
    if (currentFeatures.length !== this.expectedFeatureDimension) {
      console.warn(`[Gaze Prediction] Skipped: Feature length mismatch (expected ${this.expectedFeatureDimension}, got ${currentFeatures.length})`);
      return null;
    }

    try {
      // Use features directly (no polynomial enhancement since they're already enhanced by calibration service)
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

  // Add isCalibrated method for tracking workspace compatibility
  isCalibrated(): boolean {
    return this.isTrained && this.gazeModel.model !== null;
  }

  /**
   * Configure smoothing parameters
   */
  configureSmoothingParameters(config: Partial<SmoothingConfig>): void {
    this.smoothingConfig = { ...this.smoothingConfig, ...config };
    console.log('🔧 Smoothing configuration updated:', this.smoothingConfig);
    
    // Reset smoothing state when configuration changes
    this.resetSmoothingState();
  }

  /**
   * Get current smoothing configuration
   */
  getSmoothingConfiguration(): SmoothingConfig {
    return { ...this.smoothingConfig };
  }

  /**
   * Reset all smoothing states
   */
  private resetSmoothingState(): void {
    this.kalmanInitialized = false;
    this.exponentialInitialized = false;
    this.kalmanState = {
      x: 0, y: 0, vx: 0, vy: 0,
      px: 1, py: 1, pvx: 1, pvy: 1
    };
    this.exponentialState = { x: 0, y: 0 };
    this.outlierHistory = [];
    this.gazeHistory = [];
    this.rejectedOutliers = 0;
    console.log('🔄 Smoothing state reset');
  }

  /**
   * Get smoothing statistics
   */
  getSmoothingStats(): {
    totalFrames: number;
    rejectedOutliers: number;
    outlierRate: number;
    averageConfidence: number;
  } {
    const totalFrames = this.gazeHistory.length;
    const outlierRate = totalFrames > 0 ? this.rejectedOutliers / totalFrames : 0;
    const averageConfidence = this.gazeHistory.length > 0 
      ? this.gazeHistory.reduce((sum, gaze) => sum + (gaze.confidence || 0), 0) / this.gazeHistory.length
      : 0;

    return {
      totalFrames,
      rejectedOutliers: this.rejectedOutliers,
      outlierRate,
      averageConfidence
    };
  }

  // --- Enhanced Smoothing Logic ---
  private _applySmoothing(newGaze: PointOfGaze): PointOfGaze {
    // Add timestamp if not present
    if (!newGaze.timestamp) {
      newGaze.timestamp = performance.now();
    }

    // Outlier detection first
    if (this.smoothingConfig.enableOutlierDetection) {
      const outlierCheck = this.detectOutlier(newGaze);
      if (outlierCheck.isOutlier) {
        console.log(`🚫 Outlier detected and rejected: ${outlierCheck.reason}`);
        this.rejectedOutliers++;
        
        // Return last known good position if available
        if (this.gazeHistory.length > 0) {
          const lastGood = this.gazeHistory[this.gazeHistory.length - 1];
          return { x: lastGood.x, y: lastGood.y, confidence: 0.1 };
        }
      }
    }

    let smoothedGaze = { ...newGaze };

    // Apply Kalman filter
    if (this.smoothingConfig.enableKalmanFilter) {
      smoothedGaze = this.applyEnhancedKalmanFilter(smoothedGaze);
    }

    // Apply exponential smoothing
    if (this.smoothingConfig.enableExponentialSmoothing) {
      smoothedGaze = this.applyExponentialSmoothing(smoothedGaze);
    }

    // Update history
    this.updateGazeHistory(smoothedGaze);

    return smoothedGaze;
  }

  /**
   * Enhanced Kalman filter with velocity tracking
   */
  private applyEnhancedKalmanFilter(newGaze: PointOfGaze): PointOfGaze {
    if (!this.kalmanInitialized) {
      this.kalmanState = {
        x: newGaze.x, y: newGaze.y, vx: 0, vy: 0,
        px: 1, py: 1, pvx: 1, pvy: 1
      };
      this.kalmanInitialized = true;
      return { ...newGaze };
    }

    const dt = 1; // Time step (normalized)
    const Q = this.smoothingConfig.kalmanProcessNoise;
    const R = this.smoothingConfig.kalmanMeasurementNoise;

    // Prediction step
    const predictedX = this.kalmanState.x + this.kalmanState.vx * dt;
    const predictedY = this.kalmanState.y + this.kalmanState.vy * dt;
    
    const predictedPx = this.kalmanState.px + this.kalmanState.pvx * dt * dt + Q;
    const predictedPy = this.kalmanState.py + this.kalmanState.pvy * dt * dt + Q;
    const predictedPvx = this.kalmanState.pvx + Q;
    const predictedPvy = this.kalmanState.pvy + Q;

    // Update step
    const Kx = predictedPx / (predictedPx + R);
    const Ky = predictedPy / (predictedPy + R);

    this.kalmanState.x = predictedX + Kx * (newGaze.x - predictedX);
    this.kalmanState.y = predictedY + Ky * (newGaze.y - predictedY);
    
    // Update velocity estimate
    if (this.gazeHistory.length > 0) {
      const lastGaze = this.gazeHistory[this.gazeHistory.length - 1];
      this.kalmanState.vx = (newGaze.x - lastGaze.x) * 0.3 + this.kalmanState.vx * 0.7;
      this.kalmanState.vy = (newGaze.y - lastGaze.y) * 0.3 + this.kalmanState.vy * 0.7;
    }

    this.kalmanState.px = (1 - Kx) * predictedPx;
    this.kalmanState.py = (1 - Ky) * predictedPy;
    this.kalmanState.pvx = predictedPvx;
    this.kalmanState.pvy = predictedPvy;

    return {
      x: this.kalmanState.x,
      y: this.kalmanState.y,
      timestamp: newGaze.timestamp,
      confidence: newGaze.confidence
    };
  }

  /**
   * Exponential smoothing for additional noise reduction
   */
  private applyExponentialSmoothing(newGaze: PointOfGaze): PointOfGaze {
    if (!this.exponentialInitialized) {
      this.exponentialState = { x: newGaze.x, y: newGaze.y };
      this.exponentialInitialized = true;
      return { ...newGaze };
    }

    const alpha = this.smoothingConfig.exponentialAlpha;
    
    this.exponentialState.x = alpha * newGaze.x + (1 - alpha) * this.exponentialState.x;
    this.exponentialState.y = alpha * newGaze.y + (1 - alpha) * this.exponentialState.y;

    return {
      x: this.exponentialState.x,
      y: this.exponentialState.y,
      timestamp: newGaze.timestamp,
      confidence: newGaze.confidence
    };
  }

  /**
   * Detect outliers using statistical methods
   */
  private detectOutlier(newGaze: PointOfGaze): OutlierDetectionResult {
    if (this.gazeHistory.length < 3) {
      return { isOutlier: false, confidence: 1.0, reason: 'insufficient history' };
    }

    const recent = this.gazeHistory.slice(-3);
    const avgX = recent.reduce((sum, gaze) => sum + gaze.x, 0) / recent.length;
    const avgY = recent.reduce((sum, gaze) => sum + gaze.y, 0) / recent.length;

    const distance = Math.sqrt(
      Math.pow(newGaze.x - avgX, 2) + Math.pow(newGaze.y - avgY, 2)
    );

    if (distance > this.smoothingConfig.outlierThreshold) {
      return {
        isOutlier: true,
        confidence: Math.min(distance / this.smoothingConfig.outlierThreshold, 5.0),
        reason: `distance ${distance.toFixed(1)}px exceeds threshold ${this.smoothingConfig.outlierThreshold}px`
      };
    }

    // Check for sudden velocity changes
    if (this.gazeHistory.length >= 2) {
      const last = this.gazeHistory[this.gazeHistory.length - 1];
      const beforeLast = this.gazeHistory[this.gazeHistory.length - 2];
      
      const currentVelocity = Math.sqrt(
        Math.pow(newGaze.x - last.x, 2) + Math.pow(newGaze.y - last.y, 2)
      );
      const lastVelocity = Math.sqrt(
        Math.pow(last.x - beforeLast.x, 2) + Math.pow(last.y - beforeLast.y, 2)
      );

      if (currentVelocity > lastVelocity * 3 && currentVelocity > 50) {
        return {
          isOutlier: true,
          confidence: currentVelocity / (lastVelocity || 1),
          reason: `sudden velocity change: ${currentVelocity.toFixed(1)}px/frame`
        };
      }
    }

    return { isOutlier: false, confidence: 1.0, reason: 'normal movement' };
  }

  /**
   * Update gaze history with size limit
   */
  private updateGazeHistory(gaze: PointOfGaze): void {
    this.gazeHistory.push(gaze);
    
    if (this.gazeHistory.length > this.smoothingConfig.smoothingWindowSize * 2) {
      this.gazeHistory.shift();
    }
  }

  resetSmoothing(): void {
    this.gazeHistory = [];
    this.kalmanInitialized = false;
    
    // Also reset enhanced smoothing state
    this.resetSmoothingState();
  }

  /**
   * Generate polynomial features to capture non-linear gaze patterns
   * Input: [leftIrisX, leftIrisY, leftIrisZ, rightIrisX, rightIrisY, rightIrisZ, leftPupilX, leftPupilY, rightPupilX, rightPupilY]
   * Output: Enhanced feature vector with polynomial combinations
   */
  private generatePolynomialFeatures(features: number[]): number[] {
    const [leftIrisX, leftIrisY, leftIrisZ, rightIrisX, rightIrisY, rightIrisZ, leftPupilX, leftPupilY, rightPupilX, rightPupilY] = features;
    
    // Start with original features
    const enhanced = [...features];
    
    // Add polynomial terms for better edge prediction
    // Quadratic terms for iris positions
    enhanced.push(leftIrisX * leftIrisX);    // leftIrisX^2
    enhanced.push(leftIrisY * leftIrisY);    // leftIrisY^2
    enhanced.push(rightIrisX * rightIrisX);  // rightIrisX^2
    enhanced.push(rightIrisY * rightIrisY);  // rightIrisY^2
    
    // Interaction terms between left and right eyes
    enhanced.push(leftIrisX * rightIrisX);   // left-right X interaction
    enhanced.push(leftIrisY * rightIrisY);   // left-right Y interaction
    
    // Average eye position (important for center bias correction)
    const avgX = (leftIrisX + rightIrisX) / 2;
    const avgY = (leftIrisY + rightIrisY) / 2;
    enhanced.push(avgX);
    enhanced.push(avgY);
    enhanced.push(avgX * avgX);              // avgX^2
    enhanced.push(avgY * avgY);              // avgY^2
    
    // Distance from center (for edge detection)
    const centerX = 0.5;
    const centerY = 0.5;
    const distFromCenterX = avgX - centerX;
    const distFromCenterY = avgY - centerY;
    enhanced.push(distFromCenterX);
    enhanced.push(distFromCenterY);
    enhanced.push(distFromCenterX * distFromCenterX); // distance^2 for edge penalty
    enhanced.push(distFromCenterY * distFromCenterY);
    
    // Pupil-iris relationships (gaze direction indicators)
    enhanced.push(leftPupilX - leftIrisX);   // left gaze direction X
    enhanced.push(leftPupilY - leftIrisY);   // left gaze direction Y
    enhanced.push(rightPupilX - rightIrisX); // right gaze direction X
    enhanced.push(rightPupilY - rightIrisY); // right gaze direction Y
    
    return enhanced;
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
