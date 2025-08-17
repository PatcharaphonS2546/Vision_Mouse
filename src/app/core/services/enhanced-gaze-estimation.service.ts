/**
 * Enhanced Gaze Estimation Service - Refactored
 * Advanced gaze tracking with machine learning optimization and real-time processing
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { IGazeEstimationService } from '../interfaces/service.interface';
import {
  GazeEstimationResult,
  Point2D,
  Point3D,
  EyeTrackingData,
  CalibrationMatrix,
  QualityLevel,
  Vector3D,
  PupilData
} from '../interfaces/core.interface';
import { StateService } from '../state/state.service';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class EnhancedGazeEstimationService implements IGazeEstimationService {

  private readonly gazeData$ = new BehaviorSubject<GazeEstimationResult | null>(null);
  
  private calibrationMatrix: CalibrationMatrix | null = null;
  private isProcessing = false;
  private smoothingBuffer: Point2D[] = [];
  private bufferSize = 5;
  private smoothingFactor = 0.3;
  
  // Performance tracking
  private processingTimes: number[] = [];
  private readonly maxProcessingTimes = 100;

  constructor(
    private stateService: StateService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService
  ) {
    // Subscribe to calibration updates
    this.stateService.getApplicationState().subscribe((state: any) => {
      if (state.calibration.result && state.calibration.result.success) {
        this.calibrationMatrix = state.calibration.result.matrix;
      }
    });
  }

  // State management
  getGazeData(): Observable<GazeEstimationResult | null> {
    return this.gazeData$.asObservable();
  }

  getCurrentGaze(): GazeEstimationResult | null {
    return this.gazeData$.value;
  }

  // Gaze estimation
  async estimateGaze(eyeData: EyeTrackingData): Promise<GazeEstimationResult | null> {
    if (this.isProcessing || !eyeData.faceDetected) {
      return null;
    }

    try {
      this.isProcessing = true;
      const startTime = performance.now();

      // Basic validation
      if (!this.validateEyeData(eyeData)) {
        return null;
      }

      // Calculate raw gaze point
      const rawGazePoint = await this.calculateRawGazePoint(eyeData);
      
      // Apply calibration if available
      const calibratedPoint = this.calibrationMatrix ? 
        this.applyCalibration(rawGazePoint, this.calibrationMatrix) : 
        rawGazePoint;

      // Apply smoothing
      const smoothedPoint = this.applySmoothingFilter(calibratedPoint);

      // Calculate gaze vector
      const gazeVector = this.calculateGazeVector(eyeData);

      // Calculate confidence
      const confidence = this.calculateConfidence(eyeData);

      // Assess quality
      const quality = this.assessGazeQuality(eyeData, confidence);

      const processingTime = performance.now() - startTime;
      this.updateProcessingMetrics(processingTime);

      const result: GazeEstimationResult = {
        gazePoint: smoothedPoint,
        gazeVector,
        confidence,
        quality,
        headPose: eyeData.headPose,
        pupilData: {
          leftPupil: eyeData.leftEye.pupil,
          rightPupil: eyeData.rightEye.pupil
        },
        timestamp: Date.now(),
        processingTime
      };

      this.gazeData$.next(result);
      this.stateService.updateGazeResult(result);

      return result;

    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Gaze estimation failed');
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  // Batch processing for ML training
  async estimateGazeBatch(eyeDataArray: EyeTrackingData[]): Promise<GazeEstimationResult[]> {
    const results: GazeEstimationResult[] = [];

    for (const eyeData of eyeDataArray) {
      const result = await this.estimateGaze(eyeData);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // Configuration management
  updateCalibration(matrix: CalibrationMatrix): void {
    this.calibrationMatrix = matrix;
    this.clearSmoothingBuffer();
    this.notifications.showInfo('Calibration matrix updated');
  }

  clearCalibration(): void {
    this.calibrationMatrix = null;
    this.clearSmoothingBuffer();
    this.notifications.showInfo('Calibration cleared');
  }

  // Performance monitoring
  getPerformanceMetrics() {
    if (this.processingTimes.length === 0) {
      return {
        averageProcessingTime: 0,
        minProcessingTime: 0,
        maxProcessingTime: 0,
        fps: 0
      };
    }

    const avgTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    const minTime = Math.min(...this.processingTimes);
    const maxTime = Math.max(...this.processingTimes);
    const fps = avgTime > 0 ? 1000 / avgTime : 0;

    return {
      averageProcessingTime: avgTime,
      minProcessingTime: minTime,
      maxProcessingTime: maxTime,
      fps
    };
  }

  // Status checks
  isCalibrated(): boolean {
    return this.calibrationMatrix !== null;
  }

  isReady(): boolean {
    return !this.isProcessing;
  }

  // Private helper methods
  private validateEyeData(eyeData: EyeTrackingData): boolean {
    return eyeData.faceDetected &&
           eyeData.leftEye.isOpen &&
           eyeData.rightEye.isOpen &&
           eyeData.leftEye.pupil.confidence > 0.5 &&
           eyeData.rightEye.pupil.confidence > 0.5;
  }

  private async calculateRawGazePoint(eyeData: EyeTrackingData): Promise<Point2D> {
    // Simplified gaze calculation - in real implementation use proper geometric models
    
    // Average pupil positions
    const avgPupilX = (eyeData.leftEye.pupil.center.x + eyeData.rightEye.pupil.center.x) / 2;
    const avgPupilY = (eyeData.leftEye.pupil.center.y + eyeData.rightEye.pupil.center.y) / 2;

    // Convert to screen coordinates (simplified)
    const screenX = avgPupilX * window.innerWidth;
    const screenY = avgPupilY * window.innerHeight;

    // Apply head pose compensation
    const compensatedX = screenX - (eyeData.headPose.yaw * 10);
    const compensatedY = screenY - (eyeData.headPose.pitch * 10);

    return {
      x: Math.max(0, Math.min(window.innerWidth, compensatedX)),
      y: Math.max(0, Math.min(window.innerHeight, compensatedY))
    };
  }

  private applyCalibration(point: Point2D, matrix: CalibrationMatrix): Point2D {
    // Apply calibration transformation
    // This is a simplified implementation - in reality use proper matrix multiplication
    
    const calibrationFactor = matrix.accuracy;
    
    return {
      x: point.x * calibrationFactor,
      y: point.y * calibrationFactor
    };
  }

  private applySmoothingFilter(point: Point2D): Point2D {
    // Add to smoothing buffer
    this.smoothingBuffer.push(point);
    
    if (this.smoothingBuffer.length > this.bufferSize) {
      this.smoothingBuffer.shift();
    }

    // Apply exponential moving average
    if (this.smoothingBuffer.length === 1) {
      return point;
    }

    const previousSmoothed = this.smoothingBuffer[this.smoothingBuffer.length - 2];
    
    return {
      x: previousSmoothed.x * (1 - this.smoothingFactor) + point.x * this.smoothingFactor,
      y: previousSmoothed.y * (1 - this.smoothingFactor) + point.y * this.smoothingFactor
    };
  }

  private calculateGazeVector(eyeData: EyeTrackingData): Vector3D {
    // Calculate 3D gaze vector
    const leftEyeCenter = eyeData.leftEye.center;
    const rightEyeCenter = eyeData.rightEye.center;
    
    // Average eye position
    const eyeCenter: Point3D = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
      z: 0 // Default z value since leftEyeCenter and rightEyeCenter are Point2D
    };

    // Simple gaze direction calculation
    const direction: Point3D = {
      x: eyeData.headPose.yaw / 45, // Normalize to -1 to 1
      y: eyeData.headPose.pitch / 45,
      z: 1.0 // Forward direction
    };

    return {
      origin: eyeCenter,
      direction,
      confidence: (eyeData.leftEye.pupil.confidence + eyeData.rightEye.pupil.confidence) / 2
    };
  }

  private calculateConfidence(eyeData: EyeTrackingData): number {
    let confidence = 0.5; // Base confidence

    // Face detection confidence
    if (eyeData.faceLandmarks) {
      confidence += eyeData.faceLandmarks.confidence * 0.2;
    }

    // Pupil detection confidence
    const avgPupilConfidence = (eyeData.leftEye.pupil.confidence + eyeData.rightEye.pupil.confidence) / 2;
    confidence += avgPupilConfidence * 0.2;

    // Eye openness
    const avgEyeOpenness = (eyeData.leftEye.openness + eyeData.rightEye.openness) / 2;
    confidence += Math.min(avgEyeOpenness, 0.5) * 0.1;

    // Head pose stability
    const poseStability = 1 - (Math.abs(eyeData.headPose.yaw) + Math.abs(eyeData.headPose.pitch)) / 90;
    confidence += Math.max(0, poseStability) * 0.1;

    // Calibration bonus
    if (this.calibrationMatrix) {
      confidence += this.calibrationMatrix.accuracy * 0.1;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  private assessGazeQuality(eyeData: EyeTrackingData, confidence: number): QualityLevel {
    // Multiple quality factors
    const factors = {
      confidence,
      eyeOpenness: (eyeData.leftEye.openness + eyeData.rightEye.openness) / 2,
      headStability: 1 - (Math.abs(eyeData.headPose.yaw) + Math.abs(eyeData.headPose.pitch)) / 90,
      pupilQuality: (eyeData.leftEye.pupil.confidence + eyeData.rightEye.pupil.confidence) / 2,
      calibrated: this.calibrationMatrix ? 1 : 0.5
    };

    const overallScore = (
      factors.confidence * 0.3 +
      factors.eyeOpenness * 0.2 +
      factors.headStability * 0.2 +
      factors.pupilQuality * 0.2 +
      factors.calibrated * 0.1
    );

    if (overallScore >= 0.8) return 'excellent';
    if (overallScore >= 0.6) return 'good';
    if (overallScore >= 0.4) return 'fair';
    return 'poor';
  }

  private updateProcessingMetrics(processingTime: number): void {
    this.processingTimes.push(processingTime);
    
    if (this.processingTimes.length > this.maxProcessingTimes) {
      this.processingTimes.shift();
    }

    // Update state service with performance metrics
    const metrics = this.getPerformanceMetrics();
    this.stateService.updatePerformanceMetrics({
      fps: metrics.fps,
      latency: 0,
      memoryUsage: 0, // Would need to be calculated separately
      cpuUsage: 0,    // Would need to be calculated separately
      frameDrops: 0,
      processingTime: {
        detection: 0,
        tracking: 0,
        calibration: 0,
        estimation: metrics.averageProcessingTime,
        total: metrics.averageProcessingTime
      },
      timestamp: Date.now()
    });
  }

  private clearSmoothingBuffer(): void {
    this.smoothingBuffer = [];
  }

  // Advanced features for ML optimization
  exportTrainingData(samples: number = 1000): Promise<any[]> {
    // Export gaze estimation data for ML training
    // Implementation would collect and format training data
    return Promise.resolve([]);
  }

  loadMLModel(modelData: any): Promise<void> {
    // Load pre-trained ML model for improved accuracy
    // Implementation would integrate with TensorFlow.js or similar
    this.notifications.showInfo('ML model loading feature not yet implemented');
    return Promise.resolve();
  }

  // Debugging and development tools
  getDebugInfo() {
    return {
      isProcessing: this.isProcessing,
      isCalibrated: this.isCalibrated(),
      bufferSize: this.smoothingBuffer.length,
      smoothingFactor: this.smoothingFactor,
      performanceMetrics: this.getPerformanceMetrics(),
      calibrationMatrix: this.calibrationMatrix
    };
  }

  // Configuration
  updateConfiguration(config: {
    smoothingFactor?: number;
    bufferSize?: number;
  }) {
    if (config.smoothingFactor !== undefined) {
      this.smoothingFactor = Math.max(0, Math.min(1, config.smoothingFactor));
    }
    
    if (config.bufferSize !== undefined) {
      this.bufferSize = Math.max(1, Math.min(20, config.bufferSize));
      // Resize buffer if necessary
      while (this.smoothingBuffer.length > this.bufferSize) {
        this.smoothingBuffer.shift();
      }
    }
  }
}
