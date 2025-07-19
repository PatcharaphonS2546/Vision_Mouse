import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CalibrationService, CalibrationDataPoint } from './calibration.service';
import { GazeEstimationService, PointOfGaze } from './gaze-estimation.service';
import { ErrorHandlerService } from './error-handler.service';
import { PerformanceService } from './performance.service';

export interface CalibrationPoint {
  id: string;
  screenX: number;
  screenY: number;
  normalizedX: number; // 0-1
  normalizedY: number; // 0-1
  features: number[];
  timestamp: number;
  quality: CalibrationQuality;
}

export interface CalibrationQuality {
  faceDetected: boolean;
  eyeTracking: number; // 0-1
  headStability: number; // 0-1
  overallConfidence: number; // 0-1
  sampleCount: number;
}

export interface CalibrationSession {
  id: string;
  startTime: number;
  endTime?: number;
  points: CalibrationPoint[];
  status: CalibrationStatus;
  accuracy: CalibrationAccuracy;
  settings: CalibrationSettings;
}

export interface CalibrationAccuracy {
  averageError: number; // pixels
  standardDeviation: number;
  maxError: number;
  minError: number;
  accuracy: number; // 0-1 (1 = perfect)
}

export interface CalibrationSettings {
  pointPattern: 'grid' | 'random' | 'adaptive';
  pointCount: number;
  samplesPerPoint: number;
  pointDisplayTime: number; // ms
  pointRadius: number; // pixels
  validationEnabled: boolean;
  adaptiveThreshold: number; // for adaptive mode
}

export enum CalibrationStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  COLLECTING = 'collecting',
  VALIDATING = 'validating',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface CalibrationProgress {
  currentPoint: number;
  totalPoints: number;
  collectedSamples: number;
  requiredSamples: number;
  qualityScore: number;
  estimatedTimeRemaining: number; // seconds
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedCalibrationService {
  private currentSession: CalibrationSession | null = null;
  private calibrationStatus$ = new BehaviorSubject<CalibrationStatus>(CalibrationStatus.IDLE);
  private calibrationProgress$ = new BehaviorSubject<CalibrationProgress | null>(null);
  private calibrationAccuracy$ = new BehaviorSubject<CalibrationAccuracy | null>(null);
  
  // Default settings
  private defaultSettings: CalibrationSettings = {
    pointPattern: 'grid',
    pointCount: 16,
    samplesPerPoint: 5,
    pointDisplayTime: 2000,
    pointRadius: 20,
    validationEnabled: true,
    adaptiveThreshold: 0.8
  };

  // Calibration points patterns
  private gridPoints16 = [
    { x: 0.1, y: 0.1 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.1 }, { x: 0.9, y: 0.1 },
    { x: 0.1, y: 0.3 }, { x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.9, y: 0.3 },
    { x: 0.1, y: 0.7 }, { x: 0.3, y: 0.7 }, { x: 0.7, y: 0.7 }, { x: 0.9, y: 0.7 },
    { x: 0.1, y: 0.9 }, { x: 0.3, y: 0.9 }, { x: 0.7, y: 0.9 }, { x: 0.9, y: 0.9 }
  ];

  private gridPoints9 = [
    { x: 0.2, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.8, y: 0.2 },
    { x: 0.2, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 },
    { x: 0.2, y: 0.8 }, { x: 0.5, y: 0.8 }, { x: 0.8, y: 0.8 }
  ];

  constructor(
    private legacyCalibrationService: CalibrationService,
    private gazeEstimationService: GazeEstimationService,
    private errorHandler: ErrorHandlerService,
    private performanceService: PerformanceService
  ) {}

  // Observables
  getCalibrationStatus(): Observable<CalibrationStatus> {
    return this.calibrationStatus$.asObservable();
  }

  getCalibrationProgress(): Observable<CalibrationProgress | null> {
    return this.calibrationProgress$.asObservable();
  }

  getCalibrationAccuracy(): Observable<CalibrationAccuracy | null> {
    return this.calibrationAccuracy$.asObservable();
  }

  // Start calibration session
  async startCalibration(
    screenWidth: number, 
    screenHeight: number, 
    settings?: Partial<CalibrationSettings>
  ): Promise<boolean> {
    try {
      if (this.calibrationStatus$.value !== CalibrationStatus.IDLE) {
        throw new Error('Calibration already in progress');
      }

      const calibrationSettings = { ...this.defaultSettings, ...settings };
      
      this.currentSession = {
        id: `cal_${Date.now()}`,
        startTime: Date.now(),
        points: [],
        status: CalibrationStatus.INITIALIZING,
        accuracy: this.createEmptyAccuracy(),
        settings: calibrationSettings
      };

      this.calibrationStatus$.next(CalibrationStatus.INITIALIZING);
      
      // Generate calibration points based on pattern
      const points = this.generateCalibrationPoints(screenWidth, screenHeight, calibrationSettings);
      
      // Initialize progress
      this.updateProgress(0, points.length, 0, calibrationSettings.samplesPerPoint, 0);
      
      this.calibrationStatus$.next(CalibrationStatus.COLLECTING);
      
      console.log(`Enhanced calibration started with ${points.length} points`);
      return true;

    } catch (error) {
      this.errorHandler.logError('calibration', `Failed to start calibration: ${error}`, 'error', error);
      this.calibrationStatus$.next(CalibrationStatus.FAILED);
      return false;
    }
  }

  // Add calibration point with enhanced quality assessment
  async addCalibrationPoint(
    screenX: number,
    screenY: number,
    features: number[],
    screenWidth: number,
    screenHeight: number,
    faceQuality?: any
  ): Promise<boolean> {
    try {
      if (!this.currentSession || this.calibrationStatus$.value !== CalibrationStatus.COLLECTING) {
        throw new Error('No active calibration session');
      }

      // Calculate normalized coordinates
      const normalizedX = screenX / screenWidth;
      const normalizedY = screenY / screenHeight;

      // Assess quality
      const quality = this.assessCalibrationQuality(features, faceQuality);
      
      if (quality.overallConfidence < 0.5) {
        console.warn('Low quality calibration point rejected');
        return false;
      }

      // Create calibration point
      const calibrationPoint: CalibrationPoint = {
        id: `point_${this.currentSession.points.length}`,
        screenX,
        screenY,
        normalizedX,
        normalizedY,
        features: [...features],
        timestamp: Date.now(),
        quality
      };

      this.currentSession.points.push(calibrationPoint);

      // Add to legacy service for compatibility
      const legacyPoint: CalibrationDataPoint = {
        screenX,
        screenY,
        features: [...features]
      };
      this.legacyCalibrationService.addCalibrationPoint(legacyPoint);

      // Update progress
      const progress = this.calculateProgress();
      this.updateProgressFromCalculated(progress);

      console.log(`Calibration point added: ${calibrationPoint.id} (quality: ${quality.overallConfidence.toFixed(2)})`);
      return true;

    } catch (error) {
      this.errorHandler.logError('calibration', `Failed to add calibration point: ${error}`, 'warning', error);
      return false;
    }
  }

  // Complete calibration and train model
  async completeCalibration(): Promise<boolean> {
    try {
      if (!this.currentSession) {
        throw new Error('No active calibration session');
      }

      this.calibrationStatus$.next(CalibrationStatus.VALIDATING);

      // Check if we have enough points
      if (this.currentSession.points.length < 5) {
        throw new Error('Insufficient calibration points (minimum 5 required)');
      }

      // Calculate accuracy metrics
      const accuracy = await this.calculateCalibrationAccuracy();
      this.currentSession.accuracy = accuracy;
      this.calibrationAccuracy$.next(accuracy);

      // Train the gaze estimation model
      const trainResult = await this.trainGazeModel();
      
      if (!trainResult) {
        throw new Error('Failed to train gaze model');
      }

      // Mark legacy service as calibrated
      this.legacyCalibrationService.setCalibratedAndTrainedStatus(true);

      // Complete session
      this.currentSession.endTime = Date.now();
      this.currentSession.status = CalibrationStatus.COMPLETED;
      this.calibrationStatus$.next(CalibrationStatus.COMPLETED);

      console.log('Enhanced calibration completed successfully');
      console.log(`Accuracy: ${accuracy.accuracy.toFixed(3)}, Average Error: ${accuracy.averageError.toFixed(2)}px`);
      
      return true;

    } catch (error) {
      this.errorHandler.logError('calibration', `Failed to complete calibration: ${error}`, 'error', error);
      this.calibrationStatus$.next(CalibrationStatus.FAILED);
      return false;
    }
  }

  // Cancel calibration
  cancelCalibration(): void {
    if (this.currentSession) {
      this.currentSession.status = CalibrationStatus.FAILED;
    }
    this.calibrationStatus$.next(CalibrationStatus.IDLE);
    this.calibrationProgress$.next(null);
    this.calibrationAccuracy$.next(null);
    this.currentSession = null;
    
    console.log('Calibration cancelled');
  }

  // Clear all calibration data
  clearCalibration(): void {
    this.legacyCalibrationService.clearCalibration();
    this.currentSession = null;
    this.calibrationStatus$.next(CalibrationStatus.IDLE);
    this.calibrationProgress$.next(null);
    this.calibrationAccuracy$.next(null);
    
    console.log('Calibration data cleared');
  }

  // Check if calibrated
  isCalibrated(): boolean {
    return this.legacyCalibrationService.isCalibratedAndTrained();
  }

  // Get current session
  getCurrentSession(): CalibrationSession | null {
    return this.currentSession;
  }

  // Generate calibration points based on pattern
  private generateCalibrationPoints(
    screenWidth: number, 
    screenHeight: number, 
    settings: CalibrationSettings
  ): { x: number, y: number }[] {
    switch (settings.pointPattern) {
      case 'grid':
        const gridPoints = settings.pointCount <= 9 ? this.gridPoints9 : this.gridPoints16;
        return gridPoints.slice(0, settings.pointCount).map(p => ({
          x: p.x * screenWidth,
          y: p.y * screenHeight
        }));
      
      case 'random':
        return this.generateRandomPoints(screenWidth, screenHeight, settings.pointCount);
      
      case 'adaptive':
        return this.generateAdaptivePoints(screenWidth, screenHeight, settings);
      
      default:
        return this.gridPoints9.map(p => ({
          x: p.x * screenWidth,
          y: p.y * screenHeight
        }));
    }
  }

  // Generate random calibration points
  private generateRandomPoints(screenWidth: number, screenHeight: number, count: number): { x: number, y: number }[] {
    const points: { x: number, y: number }[] = [];
    const margin = 0.1; // 10% margin from edges
    
    for (let i = 0; i < count; i++) {
      points.push({
        x: (margin + Math.random() * (1 - 2 * margin)) * screenWidth,
        y: (margin + Math.random() * (1 - 2 * margin)) * screenHeight
      });
    }
    
    return points;
  }

  // Generate adaptive calibration points (more points in areas with higher error)
  private generateAdaptivePoints(
    screenWidth: number, 
    screenHeight: number, 
    settings: CalibrationSettings
  ): { x: number, y: number }[] {
    // Start with grid points
    const basePoints = this.gridPoints9.map(p => ({
      x: p.x * screenWidth,
      y: p.y * screenHeight
    }));

    // Add more points in high-error areas (this would be enhanced based on previous calibration data)
    return basePoints;
  }

  // Assess calibration quality
  private assessCalibrationQuality(features: number[], faceQuality?: any): CalibrationQuality {
    const faceDetected = features && features.length > 0;
    const eyeTracking = faceDetected ? 0.8 : 0; // Default based on feature availability
    const headStability = faceQuality ? (faceQuality.stability || 0.7) : 0.7;
    const overallConfidence = faceDetected ? (eyeTracking + headStability) / 2 : 0;

    return {
      faceDetected,
      eyeTracking,
      headStability,
      overallConfidence,
      sampleCount: 1
    };
  }

  // Calculate calibration progress
  private calculateProgress(): CalibrationProgress {
    if (!this.currentSession) {
      return {
        currentPoint: 0,
        totalPoints: 0,
        collectedSamples: 0,
        requiredSamples: 0,
        qualityScore: 0,
        estimatedTimeRemaining: 0
      };
    }

    const totalPoints = this.currentSession.settings.pointCount;
    const currentPoint = this.currentSession.points.length;
    const collectedSamples = this.currentSession.points.length;
    const requiredSamples = totalPoints * this.currentSession.settings.samplesPerPoint;
    const qualityScore = this.currentSession.points.reduce((avg, p) => avg + p.quality.overallConfidence, 0) / Math.max(1, this.currentSession.points.length);
    const estimatedTimeRemaining = (totalPoints - currentPoint) * (this.currentSession.settings.pointDisplayTime / 1000);

    return {
      currentPoint,
      totalPoints,
      collectedSamples,
      requiredSamples,
      qualityScore,
      estimatedTimeRemaining
    };
  }

  // Update progress
  private updateProgress(
    currentPoint: number,
    totalPoints: number,
    collectedSamples: number,
    requiredSamples: number,
    qualityScore: number
  ): void {
    const estimatedTimeRemaining = (totalPoints - currentPoint) * 2; // 2 seconds per point estimate
    
    this.calibrationProgress$.next({
      currentPoint,
      totalPoints,
      collectedSamples,
      requiredSamples,
      qualityScore,
      estimatedTimeRemaining
    });
  }

  private updateProgressFromCalculated(progress: CalibrationProgress): void {
    this.calibrationProgress$.next(progress);
  }

  // Calculate calibration accuracy
  private async calculateCalibrationAccuracy(): Promise<CalibrationAccuracy> {
    if (!this.currentSession || this.currentSession.points.length === 0) {
      return this.createEmptyAccuracy();
    }

    const errors: number[] = [];
    
    // Test each calibration point against the trained model
    for (const point of this.currentSession.points) {
      try {
        const predictedGaze = this.gazeEstimationService.predictGaze(point.features);
        if (predictedGaze) {
          const error = Math.sqrt(
            Math.pow(predictedGaze.x - point.normalizedX, 2) +
            Math.pow(predictedGaze.y - point.normalizedY, 2)
          );
          errors.push(error);
        }
      } catch (error) {
        console.warn('Error calculating accuracy for point:', error);
      }
    }

    if (errors.length === 0) {
      return this.createEmptyAccuracy();
    }

    const averageError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    const standardDeviation = Math.sqrt(
      errors.reduce((sum, err) => sum + Math.pow(err - averageError, 2), 0) / errors.length
    );
    const maxError = Math.max(...errors);
    const minError = Math.min(...errors);
    const accuracy = Math.max(0, 1 - averageError); // Simple accuracy calculation

    return {
      averageError: averageError * 1000, // Convert to pixels (assuming 1000px screen)
      standardDeviation: standardDeviation * 1000,
      maxError: maxError * 1000,
      minError: minError * 1000,
      accuracy
    };
  }

  // Train gaze model with collected data
  private async trainGazeModel(): Promise<boolean> {
    try {
      if (!this.currentSession) {
        return false;
      }

      // Prepare training data for the gaze estimation service
      const trainingData = this.currentSession.points.map(point => ({
        screenX: point.screenX,
        screenY: point.screenY,
        features: point.features
      }));

      // Train the model using the legacy calibration service
      const success = await this.legacyCalibrationService.calibrateWithPoints(trainingData);
      
      if (success) {
        console.log('Gaze model trained successfully');
      }
      
      return success;

    } catch (error) {
      this.errorHandler.logError('calibration', `Failed to train gaze model: ${error}`, 'error', error);
      return false;
    }
  }

  private createEmptyAccuracy(): CalibrationAccuracy {
    return {
      averageError: 0,
      standardDeviation: 0,
      maxError: 0,
      minError: 0,
      accuracy: 0
    };
  }
}
