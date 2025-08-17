/**
 * Enhanced Calibration Service - Refactored
 * Advanced calibration system with quality assessment and real-time feedback
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { ICalibrationService } from '../interfaces/service.interface';
import {
  CalibrationStatus,
  CalibrationProgress,
  CalibrationResult,
  CalibrationPoint,
  CalibrationSample,
  CalibrationMatrix,
  Point2D,
  EyeTrackingData,
  QualityLevel
} from '../interfaces/core.interface';
import { StateService } from '../state/state.service';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class EnhancedCalibrationService implements ICalibrationService {
  
  private readonly status$ = new BehaviorSubject<CalibrationStatus>('not-started');
  private readonly progress$ = new BehaviorSubject<CalibrationProgress | null>(null);
  
  private calibrationPoints: CalibrationPoint[] = [];
  private currentPointIndex = 0;
  private samplesPerPoint = 10;
  private sampleDelay = 100; // ms
  private qualityThreshold = 0.7;
  private calibrationMatrix: CalibrationMatrix | null = null;
  private lastResult: CalibrationResult | null = null;

  constructor(
    private stateService: StateService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService
  ) {
    // Sync with global state
    this.status$.subscribe(status => {
      this.stateService.updateCalibrationStatus(status);
    });
    
    this.progress$.subscribe(progress => {
      if (progress) {
        this.stateService.updateCalibrationProgress(progress);
      }
    });
  }

  // State management
  getStatus(): Observable<CalibrationStatus> {
    return this.status$.asObservable();
  }

  getProgress(): Observable<CalibrationProgress | null> {
    return this.progress$.asObservable();
  }

  // Calibration operations
  async startCalibration(pointCount: number = 9): Promise<void> {
    try {
      this.updateStatus('initializing');
      this.notifications.showInfo('เริ่มต้นการปรับเทียบ...');

      // Reset calibration state
      this.resetCalibrationState();
      
      // Create calibration points
      this.calibrationPoints = this.generateCalibrationPoints(pointCount);
      this.currentPointIndex = 0;

      // Update progress
      this.updateProgress({
        currentPoint: 1,
        totalPoints: pointCount,
        collectedSamples: 0,
        requiredSamples: this.samplesPerPoint,
        quality: 0,
        status: 'collecting',
        estimatedTimeRemaining: this.estimateTimeRemaining()
      });

      this.updateStatus('collecting');
      this.notifications.showSuccess('เริ่มการปรับเทียบแล้ว - กรุณามองที่จุดสีแดง');

    } catch (error) {
      this.updateStatus('failed');
      this.errorHandler.handleError(error as Error, 'Calibration start failed');
      throw error;
    }
  }

  async addCalibrationPoint(screenPoint: Point2D, eyeData: EyeTrackingData): Promise<void> {
    try {
      if (this.status$.value !== 'collecting') {
        return;
      }

      const currentPoint = this.calibrationPoints[this.currentPointIndex];
      if (!currentPoint) {
        return;
      }

      // Assess sample quality
      const quality = this.assessQuality(eyeData);
      
      // Only accept high-quality samples
      if (quality >= this.qualityThreshold) {
        const sample: CalibrationSample = {
          eyeData,
          gazeData: {
            gazePoint: screenPoint,
            gazeVector: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 0 }, confidence: quality },
            confidence: quality,
            quality: this.getQualityLevel(quality),
            headPose: eyeData.headPose,
            pupilData: {
              leftPupil: eyeData.leftEye.pupil,
              rightPupil: eyeData.rightEye.pupil
            },
            timestamp: Date.now(),
            processingTime: 0
          },
          timestamp: Date.now(),
          quality
        };

        currentPoint.samples.push(sample);

        // Update progress
        const progress = this.getCurrentProgress();
        if (progress) {
          progress.collectedSamples = currentPoint.samples.length;
          progress.quality = this.calculateAverageQuality(currentPoint.samples);
          progress.estimatedTimeRemaining = this.estimateTimeRemaining();
          this.updateProgress(progress);
        }

        // Check if point is completed
        if (currentPoint.samples.length >= this.samplesPerPoint) {
          currentPoint.isCompleted = true;
          currentPoint.quality = this.getQualityLevel(this.calculateAverageQuality(currentPoint.samples));
          
          await this.moveToNextPoint();
        }
      }

    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to add calibration point');
    }
  }

  async completeCalibration(): Promise<CalibrationResult> {
    try {
      this.updateStatus('processing');
      this.notifications.showInfo('กำลังประมวลผลการปรับเทียบ...');

      const startTime = Date.now();

      // Calculate calibration matrix
      this.calibrationMatrix = await this.calculateCalibrationMatrix();
      
      // Assess overall quality
      const overallQuality = this.assessOverallQuality();
      const accuracy = this.calculateAccuracy();

      const result: CalibrationResult = {
        success: true,
        matrix: this.calibrationMatrix,
        accuracy,
        quality: overallQuality,
        duration: Date.now() - startTime,
        pointsData: [...this.calibrationPoints]
      };

      this.lastResult = result;
      this.stateService.updateCalibrationResult(result);
      
      this.updateStatus('completed');
      this.notifications.showSuccess(`การปรับเทียบสำเร็จ! ความแม่นยำ: ${(accuracy * 100).toFixed(1)}%`);

      return result;

    } catch (error) {
      const result: CalibrationResult = {
        success: false,
        matrix: { matrix: [], accuracy: 0, quality: 'poor', pointCount: 0, timestamp: Date.now() },
        accuracy: 0,
        quality: 'poor',
        error: (error as Error).message,
        duration: 0,
        pointsData: []
      };

      this.updateStatus('failed');
      this.errorHandler.handleError(error as Error, 'Calibration completion failed');
      throw error;
    }
  }

  async resetCalibration(): Promise<void> {
    this.resetCalibrationState();
    this.updateStatus('not-started');
    this.updateProgress(null);
    this.notifications.showInfo('การปรับเทียบถูกรีเซ็ตแล้ว');
  }

  // Quality assessment
  assessQuality(eyeData: EyeTrackingData): number {
    if (!eyeData.faceDetected) {
      return 0;
    }

    let qualityScore = 0.5; // Base score

    // Face detection confidence
    if (eyeData.faceLandmarks) {
      qualityScore += eyeData.faceLandmarks.confidence * 0.2;
    }

    // Eye openness
    const leftEyeOpen = eyeData.leftEye.isOpen ? eyeData.leftEye.openness : 0;
    const rightEyeOpen = eyeData.rightEye.isOpen ? eyeData.rightEye.openness : 0;
    const avgEyeOpenness = (leftEyeOpen + rightEyeOpen) / 2;
    qualityScore += Math.min(avgEyeOpenness, 0.5) * 0.2;

    // Head pose stability
    const headPoseStability = 1 - (Math.abs(eyeData.headPose.yaw) + Math.abs(eyeData.headPose.pitch)) / 90;
    qualityScore += Math.max(0, headPoseStability) * 0.2;

    // Pupil detection confidence
    const avgPupilConfidence = (eyeData.leftEye.pupil.confidence + eyeData.rightEye.pupil.confidence) / 2;
    qualityScore += avgPupilConfidence * 0.1;

    return Math.min(1, Math.max(0, qualityScore));
  }

  // Status checks
  isCalibrated(): boolean {
    return this.status$.value === 'completed' && this.calibrationMatrix !== null;
  }

  getCurrentProgress(): CalibrationProgress | null {
    return this.progress$.value;
  }

  getCurrentCalibrationPoint(): CalibrationPoint | null {
    if (this.calibrationPoints && this.currentPointIndex < this.calibrationPoints.length) {
      return this.calibrationPoints[this.currentPointIndex];
    }
    return null;
  }

  getLastResult(): CalibrationResult | null {
    return this.lastResult;
  }

  // Private helper methods
  private resetCalibrationState(): void {
    this.calibrationPoints = [];
    this.currentPointIndex = 0;
    this.calibrationMatrix = null;
    this.lastResult = null;
  }

  private generateCalibrationPoints(pointCount: number): CalibrationPoint[] {
    const points: CalibrationPoint[] = [];
    const margin = 0.1; // 10% margin from edges
    
    if (pointCount === 9) {
      // 3x3 grid
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const x = margin + (col * (1 - 2 * margin) / 2);
          const y = margin + (row * (1 - 2 * margin) / 2);
          
          points.push({
            id: `point_${row}_${col}`,
            screenPosition: {
              x: x * window.innerWidth,
              y: y * window.innerHeight
            },
            samples: [],
            quality: 'poor',
            isCompleted: false
          });
        }
      }
    }

    return points;
  }

  private async moveToNextPoint(): Promise<void> {
    this.currentPointIndex++;
    
    if (this.currentPointIndex >= this.calibrationPoints.length) {
      // All points completed
      await this.completeCalibration();
    } else {
      // Move to next point
      const progress = this.getCurrentProgress();
      if (progress) {
        progress.currentPoint = this.currentPointIndex + 1;
        progress.collectedSamples = 0;
        progress.estimatedTimeRemaining = this.estimateTimeRemaining();
        this.updateProgress(progress);
      }
    }
  }

  private async calculateCalibrationMatrix(): Promise<CalibrationMatrix> {
    // Simple polynomial regression for demonstration
    // In a real implementation, use more sophisticated methods
    
    const allSamples: { screen: Point2D; eye: Point2D }[] = [];
    
    this.calibrationPoints.forEach(point => {
      point.samples.forEach(sample => {
        allSamples.push({
          screen: point.screenPosition,
          eye: {
            x: (sample.eyeData.leftEye.center.x + sample.eyeData.rightEye.center.x) / 2,
            y: (sample.eyeData.leftEye.center.y + sample.eyeData.rightEye.center.y) / 2
          }
        });
      });
    });

    // Calculate transformation matrix (simplified)
    const matrix = this.calculateTransformationMatrix(allSamples);
    
    return {
      matrix,
      accuracy: this.calculateAccuracy(),
      quality: this.assessOverallQuality(),
      pointCount: this.calibrationPoints.length,
      timestamp: Date.now()
    };
  }

  private calculateTransformationMatrix(samples: { screen: Point2D; eye: Point2D }[]): number[][] {
    // Simplified matrix calculation
    // In a real implementation, use proper mathematical methods
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
  }

  private calculateAverageQuality(samples: CalibrationSample[]): number {
    if (samples.length === 0) return 0;
    return samples.reduce((sum, sample) => sum + sample.quality, 0) / samples.length;
  }

  private assessOverallQuality(): QualityLevel {
    const completedPoints = this.calibrationPoints.filter(p => p.isCompleted);
    if (completedPoints.length === 0) return 'poor';
    
    const avgQuality = completedPoints.reduce((sum, point) => {
      return sum + this.calculateAverageQuality(point.samples);
    }, 0) / completedPoints.length;

    return this.getQualityLevel(avgQuality);
  }

  private calculateAccuracy(): number {
    // Simplified accuracy calculation
    const avgQuality = this.calibrationPoints.reduce((sum, point) => {
      return sum + this.calculateAverageQuality(point.samples);
    }, 0) / this.calibrationPoints.length;

    return Math.min(0.95, Math.max(0.5, avgQuality));
  }

  private getQualityLevel(score: number): QualityLevel {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    return 'poor';
  }

  private estimateTimeRemaining(): number {
    const remainingPoints = this.calibrationPoints.length - this.currentPointIndex;
    const currentPoint = this.calibrationPoints[this.currentPointIndex];
    const remainingSamples = currentPoint ? 
      this.samplesPerPoint - currentPoint.samples.length : 0;
    
    return (remainingPoints * this.samplesPerPoint + remainingSamples) * this.sampleDelay;
  }

  private updateStatus(status: CalibrationStatus): void {
    this.status$.next(status);
  }

  private updateProgress(progress: CalibrationProgress | null): void {
    this.progress$.next(progress);
  }

  // Public getters for configuration
  getConfiguration() {
    return {
      samplesPerPoint: this.samplesPerPoint,
      sampleDelay: this.sampleDelay,
      qualityThreshold: this.qualityThreshold
    };
  }

  updateConfiguration(config: Partial<{
    samplesPerPoint: number;
    sampleDelay: number;
    qualityThreshold: number;
  }>) {
    if (config.samplesPerPoint !== undefined) {
      this.samplesPerPoint = config.samplesPerPoint;
    }
    if (config.sampleDelay !== undefined) {
      this.sampleDelay = config.sampleDelay;
    }
    if (config.qualityThreshold !== undefined) {
      this.qualityThreshold = config.qualityThreshold;
    }
  }
}
