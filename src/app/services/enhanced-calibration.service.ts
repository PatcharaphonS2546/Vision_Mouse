import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CalibrationService, CalibrationDataPoint } from './calibration.service';
import { GazeEstimationService, PointOfGaze } from './gaze-estimation.service';
import { ErrorHandlerService } from './error-handler.service';
import { PerformanceService } from './performance.service';

export interface CalibrationMatrix {
  transform: number[][];
  transformMatrix?: number[][];
  offsetVector?: number[];
  scalingFactors?: { x: number; y: number };
  confidence?: number;
  accuracy: number;
  pointCount: number;
}

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
  frameQuality?: number; // 0-1, from frame quality assessment
  gazeStability?: number; // 0-1, from temporal smoothing
  environmentalConditions?: 'excellent' | 'good' | 'fair' | 'poor';
}

// Enhanced calibration workflow interfaces
export interface AdaptiveCalibrationConfig {
  enableQualityBasedSampling: boolean;
  enableAdaptivePointCount: boolean;
  enableRealTimeFeedback: boolean;
  enableMultiStageCalibration: boolean;
  minQualityThreshold: number;
  maxRetryAttempts: number;
  adaptivePointSelection: boolean;
  intelligentSampleCollection: boolean;
}

export interface CalibrationFeedback {
  currentPoint: number;
  totalPoints: number;
  currentQuality: CalibrationQuality;
  suggestions: string[];
  warnings: string[];
  estimatedAccuracy: number;
  shouldRetry: boolean;
  nextRecommendation: 'continue' | 'retry' | 'adjust_environment' | 'complete';
}

export interface MultiStageCalibrationPlan {
  stages: CalibrationStage[];
  currentStage: number;
  overallProgress: number;
  estimatedTotalTime: number;
  canSkipStages: boolean;
}

export interface CalibrationStage {
  id: string;
  name: string;
  description: string;
  pointCount: number;
  pointPattern: 'corners' | 'edges' | 'center' | 'detailed' | 'custom';
  requiredQuality: number;
  purpose: string;
}

export interface IntelligentSampleCollection {
  enableOutlierDetection: boolean;
  enableQualityFiltering: boolean;
  enableAdaptiveSampling: boolean;
  minSamplesPerPoint: number;
  maxSamplesPerPoint: number;
  qualityThreshold: number;
  stabilityRequirement: number;
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
  pointCount?: number; // Total points used
  validPoints?: number; // Points that met quality threshold
  timestamp?: number; // When accuracy was calculated
}

// Step 1: Data Quality Enhancement Interfaces
export interface DataQualityMetrics {
  frameConfidence: number; // 0-1
  landmarkQuality: number; // 0-1
  outlierScore: number; // 0-1 (higher = more outlier-like)
  temporalStability: number; // 0-1
  environmentalScore: number; // 0-1
  overallQuality: number; // 0-1
}

export interface QualityFilterConfig {
  minFrameConfidence: number;
  minLandmarkQuality: number;
  maxOutlierScore: number;
  minTemporalStability: number;
  enableOutlierRemoval: boolean;
  enableQualityWeighting: boolean;
  outlierRemovalMethod: 'zscore' | 'iqr' | 'isolation';
}

export interface SampleBalancingConfig {
  enableGridBalancing: boolean;
  minSamplesPerRegion: number;
  maxDistanceFromTarget: number; // pixels
  balancingStrategy: 'uniform' | 'adaptive' | 'weighted';
}

// Step 2: Feature Engineering Enhancement Interfaces
export interface FeatureNormalizationConfig {
  enableFeatureNormalization: boolean;
  enableScreenSizeNormalization: boolean;
  enableZScoreNormalization: boolean;
  enableMinMaxNormalization: boolean;
  normalizationMethod: 'zscore' | 'minmax' | 'robust';
  preserveOriginalFeatures: boolean;
}

export interface FeatureAugmentationConfig {
  enableHeadPoseFeatures: boolean;
  enableEyeDistanceFeatures: boolean;
  enablePupilSizeFeatures: boolean;
  enableBlinkRateFeatures: boolean;
  enableFacialSymmetryFeatures: boolean;
  enableTemporalFeatures: boolean;
  featureWindowSize: number; // for temporal features
}

export interface EnhancedFeatures {
  originalFeatures: number[];
  normalizedFeatures: number[];
  augmentedFeatures: number[];
  temporalFeatures: number[];
  combinedFeatures: number[];
  featureWeights: number[];
  featureImportance: number[];
}

export interface TemporalFeatureConfig {
  windowSize: number; // number of previous samples
  enableMovingAverage: boolean;
  enableMedianFiltering: boolean;
  enableTrendAnalysis: boolean;
  enableVelocityFeatures: boolean;
  enableAccelerationFeatures: boolean;
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
  
  // Enhanced workflow observables
  private calibrationFeedback$ = new BehaviorSubject<CalibrationFeedback | null>(null);
  private multiStageProgress$ = new BehaviorSubject<MultiStageCalibrationPlan | null>(null);
  
  // Configuration for enhanced features
  private adaptiveConfig: AdaptiveCalibrationConfig = {
    enableQualityBasedSampling: true,
    enableAdaptivePointCount: true,
    enableRealTimeFeedback: true,
    enableMultiStageCalibration: true,
    minQualityThreshold: 0.6,
    maxRetryAttempts: 3,
    adaptivePointSelection: true,
    intelligentSampleCollection: true
  };

  // Step 1: Data Quality Enhancement Configuration
  private qualityFilterConfig: QualityFilterConfig = {
    minFrameConfidence: 0.7,    // Lowered from 0.85 to 0.7
    minLandmarkQuality: 0.7,    // Lowered from 0.8 to 0.7
    maxOutlierScore: 0.5,       // Raised from 0.3 to 0.5 (more lenient)
    minTemporalStability: 0.55,  // Lowered from 0.75 to 0.55
    enableOutlierRemoval: true,
    enableQualityWeighting: true,
    outlierRemovalMethod: 'zscore'
  };

  private sampleBalancingConfig: SampleBalancingConfig = {
    enableGridBalancing: true,
    minSamplesPerRegion: 2,
    maxDistanceFromTarget: 50, // pixels
    balancingStrategy: 'adaptive'
  };

  // Step 2: Feature Engineering Enhancement Configuration
  private featureNormalizationConfig: FeatureNormalizationConfig = {
    enableFeatureNormalization: true,
    enableScreenSizeNormalization: true,
    enableZScoreNormalization: true,
    enableMinMaxNormalization: false,
    normalizationMethod: 'zscore',
    preserveOriginalFeatures: true
  };

  private featureAugmentationConfig: FeatureAugmentationConfig = {
    enableHeadPoseFeatures: true,
    enableEyeDistanceFeatures: true,
    enablePupilSizeFeatures: true,
    enableBlinkRateFeatures: false, // Keep false for now
    enableFacialSymmetryFeatures: true,
    enableTemporalFeatures: true,
    featureWindowSize: 5
  };

  private temporalFeatureConfig: TemporalFeatureConfig = {
    windowSize: 5,
    enableMovingAverage: true,
    enableMedianFiltering: true,
    enableTrendAnalysis: false, // Keep simple for now
    enableVelocityFeatures: false,
    enableAccelerationFeatures: false
  };

  private intelligentSampling: IntelligentSampleCollection = {
    enableOutlierDetection: true,
    enableQualityFiltering: true,
    enableAdaptiveSampling: true,
    minSamplesPerPoint: 3,
    maxSamplesPerPoint: 8,
    qualityThreshold: 0.7,
    stabilityRequirement: 0.8
  };

  // Multi-stage calibration plan
  private multiStageCalibrationPlan: MultiStageCalibrationPlan = {
    stages: [
      {
        id: 'basic',
        name: 'การปรับตั้งเบื้องต้น',
        description: 'จุดมุมหน้าจอสำหรับการปรับตั้งพื้นฐาน',
        pointCount: 4,
        pointPattern: 'corners',
        requiredQuality: 0.5,
        purpose: 'ประเมินพื้นที่การมองและความเสถียร'
      },
      {
        id: 'intermediate',
        name: 'การปรับตั้งระดับกลาง',
        description: 'จุดขอบและกลางหน้าจอ',
        pointCount: 9,
        pointPattern: 'edges',
        requiredQuality: 0.7,
        purpose: 'ปรับความแม่นยำในพื้นที่การใช้งานหลัก'
      },
      {
        id: 'advanced',
        name: 'การปรับตั้งขั้นสูง',
        description: 'จุดละเอียดทั่วหน้าจอ',
        pointCount: 16,
        pointPattern: 'detailed',
        requiredQuality: 0.8,
        purpose: 'เพิ่มความแม่นยำสูงสุดสำหรับงานที่ต้องการความแม่นยำ'
      }
    ],
    currentStage: 0,
    overallProgress: 0,
    estimatedTotalTime: 180, // 3 minutes
    canSkipStages: true
  };

  // Sample quality tracking
  private sampleQualityHistory: { pointId: string, quality: number, timestamp: number }[] = [];
  private retryAttempts: Map<string, number> = new Map();
  
  // Step 2: Feature Engineering temporal tracking
  private featureHistory: { features: number[], timestamp: number, pointId?: string }[] = [];
  private normalizedFeatureStats: { mean: number[], std: number[], min: number[], max: number[] } | null = null;
  
  // Default settings
  private defaultSettings: CalibrationSettings = {
    pointPattern: 'grid',
    pointCount: 9,
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

  // Enhanced observables
  getCalibrationFeedback(): Observable<CalibrationFeedback | null> {
    return this.calibrationFeedback$.asObservable();
  }

  getMultiStageProgress(): Observable<MultiStageCalibrationPlan | null> {
    return this.multiStageProgress$.asObservable();
  }

  /**
   * Start enhanced multi-stage calibration
   */
  async startEnhancedCalibration(
    screenWidth: number,
    screenHeight: number,
    useMultiStage: boolean = true
  ): Promise<boolean> {
    try {
      if (this.calibrationStatus$.value !== CalibrationStatus.IDLE) {
        throw new Error('Calibration already in progress');
      }

      console.log('🚀 Starting Enhanced Multi-Stage Calibration');

      // Reset state
      this.sampleQualityHistory = [];
      this.retryAttempts.clear();

      if (useMultiStage && this.adaptiveConfig.enableMultiStageCalibration) {
        return this.startMultiStageCalibration(screenWidth, screenHeight);
      } else {
        return this.startCalibration(screenWidth, screenHeight);
      }

    } catch (error) {
      this.errorHandler.logError('calibration', `Failed to start enhanced calibration: ${error}`, 'error', error);
      this.calibrationStatus$.next(CalibrationStatus.FAILED);
      return false;
    }
  }

  /**
   * Start multi-stage calibration process
   */
  private async startMultiStageCalibration(screenWidth: number, screenHeight: number): Promise<boolean> {
    this.multiStageCalibrationPlan.currentStage = 0;
    this.multiStageCalibrationPlan.overallProgress = 0;
    
    this.multiStageProgress$.next({ ...this.multiStageCalibrationPlan });
    
    console.log('📋 Multi-stage calibration plan loaded:');
    this.multiStageCalibrationPlan.stages.forEach((stage, index) => {
      console.log(`  Stage ${index + 1}: ${stage.name} (${stage.pointCount} points)`);
    });

    return this.startCurrentStage(screenWidth, screenHeight);
  }

  /**
   * Start current stage of multi-stage calibration
   */
  private async startCurrentStage(screenWidth: number, screenHeight: number): Promise<boolean> {
    const currentStage = this.multiStageCalibrationPlan.stages[this.multiStageCalibrationPlan.currentStage];
    
    if (!currentStage) {
      console.log('✅ All calibration stages completed');
      return this.completeMultiStageCalibration();
    }

    console.log(`🎯 Starting stage: ${currentStage.name}`);
    console.log(`📍 Description: ${currentStage.description}`);
    console.log(`🎲 Pattern: ${currentStage.pointPattern}, Points: ${currentStage.pointCount}`);

    // Generate points for current stage
    const points = this.generateStagePoints(currentStage, screenWidth, screenHeight);
    
    // Create calibration session for this stage
    this.currentSession = {
      id: `stage_${currentStage.id}_${Date.now()}`,
      startTime: Date.now(),
      points: [],
      status: CalibrationStatus.COLLECTING,
      accuracy: this.createEmptyAccuracy(),
      settings: this.createStageSettings(currentStage)
    };

    this.calibrationStatus$.next(CalibrationStatus.COLLECTING);
    this.updateProgress(0, points.length, 0, this.intelligentSampling.minSamplesPerPoint, 0);

    return true;
  }

  /**
   * Generate calibration points for specific stage
   */
  private generateStagePoints(stage: CalibrationStage, screenWidth: number, screenHeight: number): { x: number, y: number }[] {
    switch (stage.pointPattern) {
      case 'corners':
        return [
          { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 },
          { x: 0.1, y: 0.9 }, { x: 0.9, y: 0.9 }
        ];

      case 'edges':
        return [
          { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
          { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
          { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 }
        ];

      case 'center':
        return [{ x: 0.5, y: 0.5 }];

      case 'detailed':
        return this.gridPoints16;

      default:
        return this.gridPoints9;
    }
  }

  /**
   * Create settings for specific stage
   */
  private createStageSettings(stage: CalibrationStage): CalibrationSettings {
    return {
      pointPattern: stage.pointPattern as any,
      pointCount: stage.pointCount,
      samplesPerPoint: this.intelligentSampling.minSamplesPerPoint,
      pointDisplayTime: 2500, // Slightly longer for careful calibration
      pointRadius: 25,
      validationEnabled: true,
      adaptiveThreshold: stage.requiredQuality
    };
  }

  /**
   * Complete multi-stage calibration
   */
  private async completeMultiStageCalibration(): Promise<boolean> {
    console.log('🎉 Multi-stage calibration completed');
    
    // Calculate overall accuracy from all stages
    const overallAccuracy = this.calculateOverallAccuracy();
    
    this.calibrationStatus$.next(CalibrationStatus.COMPLETED);
    this.calibrationAccuracy$.next(overallAccuracy);
    
    // Provide final feedback
    this.provideFinalFeedback(overallAccuracy);
    
    return true;
  }

  /**
   * Calculate overall accuracy from all calibration stages
   */
  private calculateOverallAccuracy(): CalibrationAccuracy {
    if (this.sampleQualityHistory.length === 0) {
      return this.createEmptyAccuracy();
    }

    const qualities = this.sampleQualityHistory.map(sample => sample.quality);
    const averageQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    
    // Convert quality to accuracy metrics (simplified)
    const averageError = (1 - averageQuality) * 100; // pixels
    const standardDeviation = this.calculateStandardDeviation(qualities) * 50;
    const maxError = Math.max(...qualities.map(q => (1 - q) * 150));
    const minError = Math.min(...qualities.map(q => (1 - q) * 150));

    return {
      averageError,
      standardDeviation,
      maxError,
      minError,
      accuracy: averageQuality,
      pointCount: this.sampleQualityHistory.length,
      validPoints: qualities.filter(q => q > 0.5).length,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Provide final feedback to user
   */
  private provideFinalFeedback(accuracy: CalibrationAccuracy): void {
    const feedback: CalibrationFeedback = {
      currentPoint: 0,
      totalPoints: 0,
      currentQuality: this.createEmptyCalibrationQuality(),
      suggestions: this.generateFinalSuggestions(accuracy),
      warnings: this.generateFinalWarnings(accuracy),
      estimatedAccuracy: accuracy.accuracy,
      shouldRetry: accuracy.accuracy < 0.6,
      nextRecommendation: accuracy.accuracy > 0.8 ? 'complete' : 
                         accuracy.accuracy > 0.6 ? 'continue' : 'retry'
    };

    this.calibrationFeedback$.next(feedback);
  }

  /**
   * Create empty calibration quality
   */
  private createEmptyCalibrationQuality(): CalibrationQuality {
    return {
      faceDetected: false,
      eyeTracking: 0,
      headStability: 0,
      overallConfidence: 0,
      sampleCount: 0,
      frameQuality: 0,
      gazeStability: 0,
      environmentalConditions: 'poor'
    };
  }

  /**
   * Generate final suggestions based on calibration results
   */
  private generateFinalSuggestions(accuracy: CalibrationAccuracy): string[] {
    const suggestions: string[] = [];

    if (accuracy.accuracy >= 0.9) {
      suggestions.push('🎉 การปรับตั้งเยี่ยมมาก! ระบบพร้อมใช้งาน');
      suggestions.push('✨ ความแม่นยำสูงเหมาะสำหรับงานที่ต้องการความแม่นยำ');
    } else if (accuracy.accuracy >= 0.8) {
      suggestions.push('👍 การปรับตั้งดีมาก เหมาะสำหรับการใช้งานทั่วไป');
      suggestions.push('🎯 ลองใช้งานดูแล้วปรับตั้งใหม่หากต้องการความแม่นยำมากขึ้น');
    } else if (accuracy.accuracy >= 0.6) {
      suggestions.push('⚡ การปรับตั้งพอใช้ได้ แนะนำให้ปรับปรุงสภาพแวดล้อม');
      suggestions.push('💡 ลองเพิ่มแสงหรือปรับตำแหน่งกล้องดีกว่า');
    } else {
      suggestions.push('⚠️ การปรับตั้งต้องปรับปรุง แนะนำให้ทำใหม่');
      suggestions.push('🔧 ตรวจสอบแสง ตำแหน่งกล้อง และความเสถียรของศีรษะ');
    }

    return suggestions;
  }

  /**
   * Generate final warnings based on calibration results
   */
  private generateFinalWarnings(accuracy: CalibrationAccuracy): string[] {
    const warnings: string[] = [];

    if (accuracy.averageError > 80) {
      warnings.push('⚠️ ความผิดพลาดเฉลี่ยสูง อาจส่งผลต่อการใช้งาน');
    }

    if (accuracy.standardDeviation > 40) {
      warnings.push('📊 ความแปรปรวนสูง อาจเกิดจากการเคลื่อนไหวของศีรษะ');
    }

    if ((accuracy.validPoints || 0) < (accuracy.pointCount || 1) * 0.7) {
      warnings.push('📉 จุดที่ถูกต้องน้อย ควรปรับปรุงสภาพแวดล้อม');
    }

    return warnings;
  }

  /**
   * Move to next stage of calibration
   */
  async moveToNextStage(screenWidth: number, screenHeight: number): Promise<boolean> {
    if (!this.adaptiveConfig.enableMultiStageCalibration) {
      return false;
    }

    this.multiStageCalibrationPlan.currentStage++;
    
    // Update overall progress
    const totalStages = this.multiStageCalibrationPlan.stages.length;
    this.multiStageCalibrationPlan.overallProgress = 
      (this.multiStageCalibrationPlan.currentStage / totalStages) * 100;
    
    this.multiStageProgress$.next({ ...this.multiStageCalibrationPlan });
    
    return this.startCurrentStage(screenWidth, screenHeight);
  }

  /**
   * Skip current stage (if allowed)
   */
  async skipCurrentStage(screenWidth: number, screenHeight: number): Promise<boolean> {
    if (!this.multiStageCalibrationPlan.canSkipStages) {
      return false;
    }

    const currentStage = this.multiStageCalibrationPlan.stages[this.multiStageCalibrationPlan.currentStage];
    console.log(`⏭️ Skipping stage: ${currentStage.name}`);
    
    return this.moveToNextStage(screenWidth, screenHeight);
  }

  /**
   * Enhanced addCalibrationPoint with intelligent sample collection
   */
  async addEnhancedCalibrationPoint(
    pointId: string,
    screenX: number,
    screenY: number,
    features: number[],
    frameQuality?: number,
    gazeStability?: number
  ): Promise<{ success: boolean; feedback: CalibrationFeedback; shouldContinue: boolean }> {
    
    if (!this.currentSession) {
      throw new Error('No active calibration session');
    }

    // Assess sample quality
    const sampleQuality = this.assessSampleQuality(features, frameQuality, gazeStability);
    
    // Check if sample meets quality threshold
    const meetsQuality = sampleQuality.overallConfidence >= this.intelligentSampling.qualityThreshold;
    
    // Track retry attempts
    const currentRetries = this.retryAttempts.get(pointId) || 0;
    
    if (!meetsQuality && currentRetries < this.adaptiveConfig.maxRetryAttempts) {
      this.retryAttempts.set(pointId, currentRetries + 1);
      
      const feedback = this.generateRetryFeedback(pointId, sampleQuality, currentRetries + 1);
      
      return {
        success: false,
        feedback,
        shouldContinue: false
      };
    }

    // Add the calibration point
    const calibrationPoint: CalibrationPoint = {
      id: pointId,
      screenX,
      screenY,
      normalizedX: screenX / window.innerWidth,
      normalizedY: screenY / window.innerHeight,
      features,
      timestamp: Date.now(),
      quality: sampleQuality
    };

    this.currentSession.points.push(calibrationPoint);
    
    // Record sample quality
    this.sampleQualityHistory.push({
      pointId,
      quality: sampleQuality.overallConfidence,
      timestamp: Date.now()
    });

    // Reset retry counter for this point
    this.retryAttempts.delete(pointId);

    // Generate progress feedback
    const feedback = this.generateProgressFeedback(calibrationPoint);
    
    // Check if we need more samples for this point
    const pointSamples = this.currentSession.points.filter(p => p.id === pointId);
    const shouldContinue = this.shouldCollectMoreSamples(pointSamples, sampleQuality);

    return {
      success: true,
      feedback,
      shouldContinue
    };
  }

  /**
   * Assess quality of calibration sample
   */
  private assessSampleQuality(
    features: number[], 
    frameQuality: number = 0.5, 
    gazeStability: number = 0.5
  ): CalibrationQuality {
    
    // Check feature validity
    const featureQuality = this.assessFeatureQuality(features);
    
    // Simulate face detection (in real implementation, get from MediaPipe service)
    const faceDetected = features.length >= 10 && featureQuality > 0.3;
    
    // Calculate eye tracking quality based on features
    const eyeTracking = Math.min(featureQuality * 1.2, 1.0);
    
    // Head stability (simplified - based on feature consistency)
    const headStability = gazeStability;
    
    // Overall confidence calculation
    const overallConfidence = (
      (faceDetected ? 1 : 0) * 0.2 +
      eyeTracking * 0.3 +
      headStability * 0.2 +
      frameQuality * 0.15 +
      gazeStability * 0.15
    );

    // Environmental conditions assessment
    let environmentalConditions: 'excellent' | 'good' | 'fair' | 'poor';
    if (frameQuality > 0.8 && gazeStability > 0.8) {
      environmentalConditions = 'excellent';
    } else if (frameQuality > 0.6 && gazeStability > 0.6) {
      environmentalConditions = 'good';
    } else if (frameQuality > 0.4 && gazeStability > 0.4) {
      environmentalConditions = 'fair';
    } else {
      environmentalConditions = 'poor';
    }

    return {
      faceDetected,
      eyeTracking,
      headStability,
      overallConfidence,
      sampleCount: 1,
      frameQuality,
      gazeStability,
      environmentalConditions
    };
  }

  /**
   * Assess quality of extracted features
   */
  private assessFeatureQuality(features: number[]): number {
    if (features.length === 0) return 0;
    
    // Check for NaN or invalid values
    const validFeatures = features.filter(f => !isNaN(f) && isFinite(f));
    if (validFeatures.length < features.length * 0.8) {
      return 0.2; // Too many invalid features
    }
    
    // Check feature range (should be normalized between 0-1 or -1 to 1)
    const outOfRangeFeatures = validFeatures.filter(f => Math.abs(f) > 2);
    if (outOfRangeFeatures.length > validFeatures.length * 0.1) {
      return 0.4; // Too many out-of-range features
    }
    
    // Calculate feature stability (low variance = more stable)
    const mean = validFeatures.reduce((sum, f) => sum + f, 0) / validFeatures.length;
    const variance = validFeatures.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / validFeatures.length;
    const stability = Math.max(0, 1 - variance);
    
    return Math.min(stability * 1.2, 1.0);
  }

  /**
   * Generate retry feedback for poor quality samples
   */
  private generateRetryFeedback(pointId: string, quality: CalibrationQuality, retryCount: number): CalibrationFeedback {
    const suggestions: string[] = [];
    const warnings: string[] = [];

    if (!quality.faceDetected) {
      suggestions.push('👤 ตรวจสอบให้แน่ใจว่าใบหน้าอยู่ในกรอบกล้อง');
      warnings.push('⚠️ ไม่พบใบหน้าในกรอบ');
    }

    if (quality.eyeTracking < 0.5) {
      suggestions.push('👁️ มองตรงไปที่จุดสีแดงและกะพริบตาเบาๆ');
      warnings.push('👁️ การติดตามสายตายังไม่ชัดเจน');
    }

    if (quality.frameQuality && quality.frameQuality < 0.5) {
      suggestions.push('💡 ปรับแสงให้สว่างขึ้นหรือเข้าใกล้กล้องมากขึ้น');
    }

    if (quality.headStability < 0.5) {
      suggestions.push('🎯 นั่งให้เสถียรและไม่เคลื่อนไหวศีรษะมาก');
    }

    suggestions.push(`🔄 ความพยายามครั้งที่ ${retryCount}/${this.adaptiveConfig.maxRetryAttempts}`);

    return {
      currentPoint: 1,
      totalPoints: 1,
      currentQuality: quality,
      suggestions,
      warnings,
      estimatedAccuracy: quality.overallConfidence,
      shouldRetry: true,
      nextRecommendation: retryCount >= this.adaptiveConfig.maxRetryAttempts ? 'continue' : 'retry'
    };
  }

  /**
   * Generate progress feedback during calibration
   */
  private generateProgressFeedback(point: CalibrationPoint): CalibrationFeedback {
    const currentStage = this.multiStageCalibrationPlan.stages[this.multiStageCalibrationPlan.currentStage];
    const totalPoints = currentStage ? currentStage.pointCount : this.currentSession!.points.length;
    const currentPoint = this.currentSession!.points.length;

    const suggestions: string[] = [];
    const warnings: string[] = [];

    // Quality-based suggestions
    if (point.quality.overallConfidence > 0.8) {
      suggestions.push('✅ คุณภาพดีเยี่ยม! ไปจุดถัดไป');
    } else if (point.quality.overallConfidence > 0.6) {
      suggestions.push('👍 คุณภาพดี ไปจุดถัดไป');
    } else {
      suggestions.push('⚡ คุณภาพพอใช้ ลองปรับปรุงในจุดถัดไป');
    }

    // Progress suggestions
    const progress = (currentPoint / totalPoints) * 100;
    if (progress >= 75) {
      suggestions.push('🎉 ใกล้เสร็จแล้ว! เหลืออีกไม่กี่จุด');
    } else if (progress >= 50) {
      suggestions.push('⚡ ผ่านครึ่งทางแล้ว ทำได้ดีมาก!');
    } else if (progress >= 25) {
      suggestions.push('🚀 กำลังดำเนินการอย่างราบรื่น');
    }

    return {
      currentPoint,
      totalPoints,
      currentQuality: point.quality,
      suggestions,
      warnings,
      estimatedAccuracy: point.quality.overallConfidence,
      shouldRetry: false,
      nextRecommendation: currentPoint >= totalPoints ? 'complete' : 'continue'
    };
  }

  /**
   * Determine if more samples are needed for current point
   */
  private shouldCollectMoreSamples(pointSamples: CalibrationPoint[], latestQuality: CalibrationQuality): boolean {
    if (!this.intelligentSampling.enableAdaptiveSampling) {
      return pointSamples.length < this.intelligentSampling.minSamplesPerPoint;
    }

    // If we have minimum samples and quality is good, we can stop
    if (pointSamples.length >= this.intelligentSampling.minSamplesPerPoint && 
        latestQuality.overallConfidence >= this.intelligentSampling.qualityThreshold) {
      return false;
    }

    // Continue collecting if we haven't reached max samples
    return pointSamples.length < this.intelligentSampling.maxSamplesPerPoint;
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

  // Reset calibration - alias for cancelCalibration
  async reset(): Promise<void> {
    this.cancelCalibration();
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
    const requiredSamples = this.currentSession.settings.samplesPerPoint; // Per point, not total
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

    // STEP 1: Apply Data Quality Enhancement
    console.log('🔍 STEP 1: Applying Data Quality Enhancement...');
    
    // Filter samples by quality metrics
    const originalPoints = [...this.currentSession.points];
    const filteredPoints = this.filterSamplesByQuality(originalPoints);
    
    // Balance samples across screen regions
    const balancedPoints = this.balanceCalibrationSamples(filteredPoints);
    
    // STEP 2: Apply Feature Engineering Enhancement
    console.log('� STEP 2: Applying Feature Engineering Enhancement...');
    const enhancedPoints = this.applyFeatureEngineering(balancedPoints);
    
    console.log(`📊 Combined Enhancement Results:
      • Original samples: ${originalPoints.length}
      • After quality filtering: ${filteredPoints.length}
      • After balancing: ${balancedPoints.length}
      • After feature engineering: ${enhancedPoints.length}
      • Quality improvement: ${((enhancedPoints.length / originalPoints.length) * 100).toFixed(1)}% samples retained
      • Feature enhancement: ${originalPoints[0]?.features.length || 0} → ${enhancedPoints[0]?.features.length || 0} features`);

    const errors: number[] = [];
    let realPredictions = 0;
    let mockPredictions = 0;
    
    console.log('🧮 Starting real accuracy calculation with', enhancedPoints.length, 'enhanced high-quality calibration points');
    
    // Test each calibration point against the trained model
    for (const point of enhancedPoints) {
      try {
        const predictedGaze = this.gazeEstimationService.predictGaze(point.features);
        if (predictedGaze && typeof predictedGaze.x === 'number' && typeof predictedGaze.y === 'number') {
          // REAL prediction from trained model
          const normalizedError = Math.sqrt(
            Math.pow(predictedGaze.x - point.normalizedX, 2) +
            Math.pow(predictedGaze.y - point.normalizedY, 2)
          );
          errors.push(normalizedError);
          realPredictions++;
          
          console.log(`📍 Point ${errors.length}: Target(${point.normalizedX.toFixed(3)}, ${point.normalizedY.toFixed(3)}) → Predicted(${predictedGaze.x.toFixed(3)}, ${predictedGaze.y.toFixed(3)}) → Error: ${(normalizedError * 1000).toFixed(1)}px`);
        } else {
          // Model failed to predict - this indicates real problem with eye tracking or calibration data
          console.warn('⚠️ Model failed to predict for calibration point:', point);
          const highError = 0.15 + (Math.random() * 0.10); // 15-25% error for failed predictions
          errors.push(highError);
          mockPredictions++;
        }
      } catch (error) {
        console.warn('❌ Error calculating accuracy for point:', error);
        // High error for prediction failures
        const highError = 0.20 + (Math.random() * 0.10); // 20-30% error for exceptions
        errors.push(highError);
        mockPredictions++;
      }
    }

    const averageError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    const standardDeviation = Math.sqrt(
      errors.reduce((sum, err) => sum + Math.pow(err - averageError, 2), 0) / errors.length
    );
    const maxError = Math.max(...errors);
    const minError = Math.min(...errors);
    
    // More realistic accuracy calculation
    const accuracy = Math.max(0, Math.min(1, 1 - (averageError * 2))); // Penalize errors more heavily
    
    console.log('📊 Real Accuracy Calculation Results (with Quality & Feature Enhancement):');
    console.log(`  • Real predictions: ${realPredictions}/${enhancedPoints.length}`);
    console.log(`  • Mock predictions: ${mockPredictions}/${enhancedPoints.length}`);
    console.log(`  • Average error: ${(averageError * 1000).toFixed(1)}px (${(averageError * 100).toFixed(1)}% of screen)`);
    console.log(`  • Real accuracy: ${(accuracy * 100).toFixed(1)}%`);
    console.log(`  • Enhanced samples used: ${enhancedPoints.length}/${originalPoints.length}`);
    
    if (mockPredictions > realPredictions) {
      console.warn('⚠️ Warning: More mock predictions than real predictions suggests calibration data quality issues!');
    }

    return {
      averageError: averageError * 1000, // Convert to pixels (assuming 1000px screen)
      standardDeviation: standardDeviation * 1000,
      maxError: maxError * 1000,
      minError: minError * 1000,
      accuracy,
      pointCount: originalPoints.length,
      validPoints: enhancedPoints.length,
      timestamp: Date.now()
    };
  }

  // Train gaze model with collected data
  private async trainGazeModel(): Promise<boolean> {
    try {
      if (!this.currentSession) {
        return false;
      }

      console.log('Training gaze model with', this.currentSession.points.length, 'calibration points');

      // APPLY SAME ENHANCEMENT PIPELINE AS ACCURACY CALCULATION
      // Step 1: Quality filtering and balancing
      const originalPoints = [...this.currentSession.points];
      const filteredPoints = this.filterSamplesByQuality(originalPoints);
      const balancedPoints = this.balanceCalibrationSamples(filteredPoints);
      
      // Step 2: Feature engineering
      const enhancedPoints = this.applyFeatureEngineering(balancedPoints);
      
      console.log(`🔧 Training with enhanced features:
        • Original samples: ${originalPoints.length}
        • Enhanced samples: ${enhancedPoints.length}
        • Feature dimensions: ${originalPoints[0]?.features.length || 0} → ${enhancedPoints[0]?.features.length || 0}`);

      // Prepare training data for GazeEstimationService using ENHANCED features
      const features: number[][] = [];
      const targetsX: number[] = [];
      const targetsY: number[] = [];
      
      enhancedPoints.forEach(point => {
        features.push(point.features); // These are now enhanced features
        // Convert screen coordinates to normalized coordinates (0-1)
        targetsX.push(point.screenX / window.innerWidth);
        targetsY.push(point.screenY / window.innerHeight);
      });

      // Train the gaze estimation model directly with enhanced features
      this.gazeEstimationService.trainModel(features, targetsX, targetsY);
      
      // Check if training was successful
      const isModelTrained = this.gazeEstimationService.isModelTrained();
      
      if (isModelTrained) {
        console.log('✅ Gaze estimation model trained successfully with ENHANCED calibration data!');
        console.log('📊 Enhanced Training Summary:');
        console.log('  • Enhanced features:', features.length, 'samples');
        console.log('  • Enhanced feature dimensions:', features[0]?.length);
        console.log('  • Screen targets X range:', Math.min(...targetsX).toFixed(3), '-', Math.max(...targetsX).toFixed(3));
        console.log('  • Screen targets Y range:', Math.min(...targetsY).toFixed(3), '-', Math.max(...targetsY).toFixed(3));
        
        // Calculate real accuracy immediately after training
        const realAccuracy = await this.calculateCalibrationAccuracy();
        console.log('🎯 REAL Calibration Accuracy Results:');
        console.log(`  • Accuracy: ${(realAccuracy.accuracy * 100).toFixed(1)}%`);
        console.log(`  • Average Error: ${realAccuracy.averageError.toFixed(1)}px`);
        console.log(`  • Error Range: ${realAccuracy.minError.toFixed(1)}px - ${realAccuracy.maxError.toFixed(1)}px`);
        
        // Also try advanced calibration matrix as backup
        const calibrationMatrix = this.calculateAdvancedCalibrationMatrix();
        if (calibrationMatrix) {
          console.log('📐 Advanced calibration matrix also calculated');
        }
        
        return true;
      } else {
        console.warn('❌ Failed to train gaze estimation model');
        
        // Fallback to legacy calibration service
        const trainingData = this.currentSession.points.map(point => ({
          screenX: point.screenX,
          screenY: point.screenY,
          features: point.features
        }));

        const success = await this.legacyCalibrationService.calibrateWithPoints(trainingData);
        
        if (success) {
          console.log('Legacy gaze model trained as fallback');
        }
        
        return success;
      }

    } catch (error) {
      this.errorHandler.logError('calibration', `Failed to train gaze model: ${error}`, 'error', error);
      return false;
    }
  }

  // Calculate advanced calibration matrix
  private calculateAdvancedCalibrationMatrix(): CalibrationMatrix | null {
    if (!this.currentSession || this.currentSession.points.length < 4) {
      return null;
    }

    try {
      // Prepare data for matrix calculation
      const features: number[][] = [];
      const targetsX: number[] = [];
      const targetsY: number[] = [];
      
      this.currentSession.points.forEach(point => {
        // Use existing features from calibration points
        features.push(point.features);
        targetsX.push(point.normalizedX);
        targetsY.push(point.normalizedY);
      });
      
      // Calculate transformation matrix using least squares method
      const matrixX = this.calculateLeastSquaresMatrix(features, targetsX);
      const matrixY = this.calculateLeastSquaresMatrix(features, targetsY);
      
      // Calculate confidence based on calibration point quality
      const avgConfidence = this.currentSession.points.reduce((sum, point) => 
        sum + point.quality.overallConfidence, 0) / this.currentSession.points.length;
      
      const calibrationMatrix: CalibrationMatrix = {
        transform: [matrixX, matrixY],
        transformMatrix: [matrixX, matrixY],
        offsetVector: [0, 0],
        scalingFactors: { x: 1, y: 1 },
        confidence: avgConfidence,
        accuracy: avgConfidence,
        pointCount: this.currentSession.points.length
      };
      
      return calibrationMatrix;
      
    } catch (error) {
      console.error('Error calculating advanced calibration matrix:', error);
      return null;
    }
  }

  // Calculate least squares matrix for linear regression
  private calculateLeastSquaresMatrix(features: number[][], targets: number[]): number[] {
    const n = features.length;
    const m = features[0].length;
    
    // Create augmented matrix [X^T * X | X^T * y]
    const XTX = Array(m).fill(0).map(() => Array(m).fill(0));
    const XTy = Array(m).fill(0);
    
    // Calculate X^T * X and X^T * y
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        XTy[j] += features[i][j] * targets[i];
        for (let k = 0; k < m; k++) {
          XTX[j][k] += features[i][j] * features[i][k];
        }
      }
    }
    
    // Solve linear system using Gaussian elimination
    return this.solveLinearSystem(XTX, XTy);
  }

  // Solve linear system using Gaussian elimination
  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;
    const x = Array(n).fill(0);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k;
        }
      }
      
      // Swap rows
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [b[i], b[maxRow]] = [b[maxRow], b[i]];
      
      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const factor = A[k][i] / A[i][i];
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
        b[k] -= factor * b[i];
      }
    }
    
    // Back substitution
    for (let i = n - 1; i >= 0; i--) {
      x[i] = b[i];
      for (let j = i + 1; j < n; j++) {
        x[i] -= A[i][j] * x[j];
      }
      x[i] /= A[i][i];
    }
    
    return x;
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

  // ===== STEP 1: DATA QUALITY ENHANCEMENT METHODS =====

  /**
   * Assess data quality metrics for a calibration sample
   */
  private assessDataQuality(
    features: number[], 
    faceQuality: any,
    gazeResult?: any
  ): DataQualityMetrics {
    // Use more realistic default values based on actual calibration data
    const frameConfidence = gazeResult?.confidence || faceQuality?.overallConfidence || 0.7;
    const landmarkQuality = faceQuality?.eyeTracking || 0.7;
    
    // Calculate outlier score based on feature distribution
    const outlierScore = this.calculateOutlierScore(features);
    
    // Temporal stability from gaze smoothness
    const temporalStability = gazeResult?.stability || faceQuality?.headStability || 0.6;
    
    // Environmental score based on lighting and face detection
    const environmentalScore = this.assessEnvironmentalConditions(faceQuality);
    
    // Overall quality weighted average
    const overallQuality = (
      frameConfidence * 0.25 +
      landmarkQuality * 0.3 +
      (1 - outlierScore) * 0.2 +
      temporalStability * 0.15 +
      environmentalScore * 0.1
    );

    return {
      frameConfidence,
      landmarkQuality,
      outlierScore,
      temporalStability,
      environmentalScore,
      overallQuality
    };
  }

  /**
   * Calculate outlier score using z-score method
   */
  private calculateOutlierScore(features: number[]): number {
    if (!features || features.length === 0) return 1.0;
    
    // Calculate mean and standard deviation
    const mean = features.reduce((sum, val) => sum + val, 0) / features.length;
    const variance = features.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / features.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    // Calculate max z-score across all features
    const maxZScore = Math.max(...features.map(val => Math.abs(val - mean) / stdDev));
    
    // Convert z-score to outlier probability (0-1)
    return Math.min(maxZScore / 3.0, 1.0); // z-score > 3 = high outlier probability
  }

  /**
   * Assess environmental conditions for calibration
   */
  private assessEnvironmentalConditions(faceQuality: any): number {
    let score = 0.8; // baseline
    
    // Adjust based on face detection quality
    if (faceQuality?.faceDetected) {
      score += 0.1;
    }
    
    // Adjust based on lighting conditions
    if (faceQuality?.lighting === 'good') {
      score += 0.05;
    } else if (faceQuality?.lighting === 'poor') {
      score -= 0.1;
    }
    
    // Adjust based on glasses/glare
    if (faceQuality?.glareDetected) {
      score -= 0.05;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Filter calibration samples based on quality metrics
   */
  private filterSamplesByQuality(
    calibrationPoints: CalibrationPoint[]
  ): CalibrationPoint[] {
    console.log(`🔍 Step 1: Filtering ${calibrationPoints.length} samples by quality...`);
    
    if (!this.qualityFilterConfig.enableOutlierRemoval) {
      console.log('📊 Quality filtering disabled - returning all samples');
      return calibrationPoints;
    }

    const originalCount = calibrationPoints.length;
    let filteredPoints = [...calibrationPoints]; // Start with all points

    // Filter by frame confidence
    const confidentFrames = calibrationPoints.filter((point, index) => {
      const qualityMetrics = this.assessDataQuality(point.features, point.quality);
      
      // Debug logging for first few samples
      if (index < 3) {
        console.log(`🔬 Sample ${index + 1} quality:`, qualityMetrics);
      }
      
      return qualityMetrics.frameConfidence >= this.qualityFilterConfig.minFrameConfidence;
    });
    
    console.log(`📈 After frame confidence filter (≥${this.qualityFilterConfig.minFrameConfidence}): ${confidentFrames.length}/${originalCount}`);

    // Filter by landmark quality
    const qualityLandmarks = confidentFrames.filter(point => {
      const qualityMetrics = this.assessDataQuality(point.features, point.quality);
      return qualityMetrics.landmarkQuality >= this.qualityFilterConfig.minLandmarkQuality;
    });
    
    console.log(`👁️ After landmark quality filter (≥${this.qualityFilterConfig.minLandmarkQuality}): ${qualityLandmarks.length}/${originalCount}`);

    // Apply quality filtering only if we have enough samples remaining
    if (qualityLandmarks.length >= Math.min(15, originalCount * 0.3)) {
      filteredPoints = qualityLandmarks;
    } else {
      console.log(`⚠️ Quality filtering too aggressive - keeping all ${originalCount} samples`);
      filteredPoints = calibrationPoints;
    }

    // Remove outliers (but ensure we keep at least 30% of original samples)
    if (this.qualityFilterConfig.outlierRemovalMethod === 'zscore' && filteredPoints.length > 10) {
      const withoutOutliers = this.removeOutliersZScore(filteredPoints);
      if (withoutOutliers.length >= Math.min(10, originalCount * 0.3)) {
        filteredPoints = withoutOutliers;
      } else {
        console.log(`⚠️ Outlier removal too aggressive - keeping filtered samples without outlier removal`);
      }
    }
    
    console.log(`🎯 After outlier removal: ${filteredPoints.length}/${originalCount}`);
    console.log(`✅ Quality filtering complete - kept ${((filteredPoints.length / originalCount) * 100).toFixed(1)}% of samples`);
    
    return filteredPoints;
  }

  /**
   * Remove outliers using z-score method
   */
  private removeOutliersZScore(points: CalibrationPoint[]): CalibrationPoint[] {
    if (points.length < 3) return points; // Need minimum samples for statistical analysis
    
    // Calculate quality metrics for all points
    const qualityScores = points.map(point => 
      this.assessDataQuality(point.features, point.quality).overallQuality
    );
    
    // Calculate mean and standard deviation
    const mean = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    const variance = qualityScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / qualityScores.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return points; // All points have same quality
    
    // Filter points with z-score < 2 (within 2 standard deviations)
    return points.filter((point, index) => {
      const zScore = Math.abs(qualityScores[index] - mean) / stdDev;
      return zScore < 2.0; // Keep points within 2 standard deviations
    });
  }

  /**
   * Balance calibration samples across screen regions
   */
  private balanceCalibrationSamples(points: CalibrationPoint[]): CalibrationPoint[] {
    if (!this.sampleBalancingConfig.enableGridBalancing) {
      return points;
    }
    
    console.log(`🎯 Step 1: Balancing ${points.length} samples across screen regions...`);
    
    // Define screen regions (3x3 grid)
    const regions = this.createScreenRegions();
    const balancedPoints: CalibrationPoint[] = [];
    
    // Group points by region
    const pointsByRegion = this.groupPointsByRegion(points, regions);
    
    // Ensure minimum samples per region
    for (let regionId = 0; regionId < regions.length; regionId++) {
      const regionPoints = pointsByRegion[regionId] || [];
      
      if (regionPoints.length >= this.sampleBalancingConfig.minSamplesPerRegion) {
        // Take best quality samples from this region
        const sortedByQuality = regionPoints.sort((a, b) => 
          b.quality.overallConfidence - a.quality.overallConfidence
        );
        balancedPoints.push(...sortedByQuality.slice(0, Math.max(
          this.sampleBalancingConfig.minSamplesPerRegion,
          Math.min(regionPoints.length, 8) // Cap at 8 samples per region
        )));
      } else if (regionPoints.length > 0) {
        // Include all samples from regions with few samples
        balancedPoints.push(...regionPoints);
      }
    }
    
    console.log(`⚖️ Sample balancing complete: ${balancedPoints.length} samples selected`);
    return balancedPoints;
  }

  /**
   * Create 3x3 screen regions for sample balancing
   */
  private createScreenRegions(): { minX: number; maxX: number; minY: number; maxY: number }[] {
    const regions = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        regions.push({
          minX: col / 3,
          maxX: (col + 1) / 3,
          minY: row / 3,
          maxY: (row + 1) / 3
        });
      }
    }
    return regions;
  }

  /**
   * Group calibration points by screen region
   */
  private groupPointsByRegion(
    points: CalibrationPoint[], 
    regions: { minX: number; maxX: number; minY: number; maxY: number }[]
  ): CalibrationPoint[][] {
    const pointsByRegion: CalibrationPoint[][] = Array(regions.length).fill(null).map(() => []);
    
    points.forEach(point => {
      const regionIndex = regions.findIndex(region => 
        point.normalizedX >= region.minX && point.normalizedX < region.maxX &&
        point.normalizedY >= region.minY && point.normalizedY < region.maxY
      );
      
      if (regionIndex !== -1) {
        pointsByRegion[regionIndex].push(point);
      }
    });
    
    return pointsByRegion;
  }

  // ===== STEP 2: FEATURE ENGINEERING ENHANCEMENT METHODS =====

  /**
   * Apply comprehensive feature engineering to calibration points
   */
  private applyFeatureEngineering(calibrationPoints: CalibrationPoint[]): CalibrationPoint[] {
    console.log(`🔧 Step 2: Applying Feature Engineering to ${calibrationPoints.length} samples...`);
    
    // Initialize normalization stats if not already done
    if (!this.normalizedFeatureStats) {
      this.calculateNormalizationStats(calibrationPoints);
    }
    
    const enhancedPoints = calibrationPoints.map((point, index) => {
      // 1. Normalize features
      const normalizedFeatures = this.normalizeFeatures(point.features);
      
      // 2. Augment with additional features
      const augmentedFeatures = this.augmentFeatures(point.features, point.quality);
      
      // 3. Add temporal features
      const temporalFeatures = this.extractTemporalFeatures(point.features, index);
      
      // 4. Combine all features
      const combinedFeatures = this.combineFeatures(
        point.features,
        normalizedFeatures,
        augmentedFeatures,
        temporalFeatures
      );
      
      // Update point with enhanced features
      const enhancedPoint: CalibrationPoint = {
        ...point,
        features: combinedFeatures
      };
      
      // Add to feature history for temporal processing
      this.featureHistory.push({
        features: point.features,
        timestamp: point.timestamp,
        pointId: point.id
      });
      
      return enhancedPoint;
    });
    
    console.log(`✨ Feature Engineering Results:
      • Original feature dimension: ${calibrationPoints[0]?.features.length || 0}
      • Enhanced feature dimension: ${enhancedPoints[0]?.features.length || 0}
      • Feature expansion ratio: ${((enhancedPoints[0]?.features.length || 0) / (calibrationPoints[0]?.features.length || 1)).toFixed(1)}x`);
    
    return enhancedPoints;
  }

  /**
   * Calculate normalization statistics from all calibration points
   */
  private calculateNormalizationStats(points: CalibrationPoint[]): void {
    if (points.length === 0) return;
    
    const featureDim = points[0].features.length;
    const mean = new Array(featureDim).fill(0);
    const std = new Array(featureDim).fill(0);
    const min = new Array(featureDim).fill(Infinity);
    const max = new Array(featureDim).fill(-Infinity);
    
    // Calculate mean, min, max
    points.forEach(point => {
      point.features.forEach((feature, i) => {
        mean[i] += feature;
        min[i] = Math.min(min[i], feature);
        max[i] = Math.max(max[i], feature);
      });
    });
    
    // Finalize mean
    mean.forEach((_, i) => {
      mean[i] /= points.length;
    });
    
    // Calculate standard deviation
    points.forEach(point => {
      point.features.forEach((feature, i) => {
        std[i] += Math.pow(feature - mean[i], 2);
      });
    });
    
    std.forEach((_, i) => {
      std[i] = Math.sqrt(std[i] / points.length);
    });
    
    this.normalizedFeatureStats = { mean, std, min, max };
    console.log(`📊 Normalization stats calculated for ${featureDim} features`);
  }

  /**
   * Normalize features using configured method
   */
  private normalizeFeatures(features: number[]): number[] {
    if (!this.featureNormalizationConfig.enableFeatureNormalization || !this.normalizedFeatureStats) {
      return [...features];
    }
    
    const { mean, std, min, max } = this.normalizedFeatureStats;
    
    return features.map((feature, i) => {
      if (this.featureNormalizationConfig.normalizationMethod === 'zscore') {
        return std[i] > 0 ? (feature - mean[i]) / std[i] : 0;
      } else if (this.featureNormalizationConfig.normalizationMethod === 'minmax') {
        const range = max[i] - min[i];
        return range > 0 ? (feature - min[i]) / range : 0;
      } else {
        return feature;
      }
    });
  }

  /**
   * Augment features with additional computed features
   */
  private augmentFeatures(originalFeatures: number[], quality: CalibrationQuality): number[] {
    const augmented: number[] = [];
    
    if (this.featureAugmentationConfig.enableHeadPoseFeatures) {
      // Estimate head pose from eye positions (simplified)
      const headPoseYaw = this.estimateHeadPoseYaw(originalFeatures);
      const headPosePitch = this.estimateHeadPosePitch(originalFeatures);
      augmented.push(headPoseYaw, headPosePitch);
    }
    
    if (this.featureAugmentationConfig.enableEyeDistanceFeatures) {
      // Calculate inter-eye distance and eye-to-screen distance
      const interEyeDistance = this.calculateInterEyeDistance(originalFeatures);
      const eyeToScreenDistance = this.estimateEyeToScreenDistance(originalFeatures);
      augmented.push(interEyeDistance, eyeToScreenDistance);
    }
    
    if (this.featureAugmentationConfig.enablePupilSizeFeatures) {
      // Estimate pupil size variations
      const pupilSize = this.estimatePupilSize(originalFeatures);
      const pupilAsymmetry = this.calculatePupilAsymmetry(originalFeatures);
      augmented.push(pupilSize, pupilAsymmetry);
    }
    
    if (this.featureAugmentationConfig.enableFacialSymmetryFeatures) {
      // Calculate facial symmetry metrics
      const facialSymmetry = this.calculateFacialSymmetry(originalFeatures);
      const eyeSymmetry = this.calculateEyeSymmetry(originalFeatures);
      augmented.push(facialSymmetry, eyeSymmetry);
    }
    
    // Add quality metrics as features
    augmented.push(
      quality.overallConfidence,
      quality.eyeTracking,
      quality.headStability
    );
    
    return augmented;
  }

  /**
   * Extract temporal features from feature history
   */
  private extractTemporalFeatures(currentFeatures: number[], currentIndex: number): number[] {
    if (!this.featureAugmentationConfig.enableTemporalFeatures) {
      return [];
    }
    
    const temporal: number[] = [];
    const windowSize = Math.min(this.temporalFeatureConfig.windowSize, this.featureHistory.length);
    
    if (windowSize < 2) {
      // Not enough history, return zeros
      return new Array(currentFeatures.length * 2).fill(0); // Moving average + median
    }
    
    // Get recent feature history
    const recentFeatures = this.featureHistory.slice(-windowSize).map(h => h.features);
    
    if (this.temporalFeatureConfig.enableMovingAverage) {
      // Calculate moving average
      const movingAvg = this.calculateMovingAverage(recentFeatures);
      temporal.push(...movingAvg);
    }
    
    if (this.temporalFeatureConfig.enableMedianFiltering) {
      // Calculate median filter
      const medianFiltered = this.calculateMedianFilter(recentFeatures);
      temporal.push(...medianFiltered);
    }
    
    return temporal;
  }

  /**
   * Combine all feature types into final feature vector
   */
  private combineFeatures(
    original: number[],
    normalized: number[],
    augmented: number[],
    temporal: number[]
  ): number[] {
    const combined: number[] = [];
    
    // Always include original features
    combined.push(...original);
    
    if (this.featureNormalizationConfig.enableFeatureNormalization) {
      combined.push(...normalized);
    }
    
    if (augmented.length > 0) {
      combined.push(...augmented);
    }
    
    if (temporal.length > 0) {
      combined.push(...temporal);
    }
    
    return combined;
  }

  // ===== FEATURE COMPUTATION HELPER METHODS =====

  private estimateHeadPoseYaw(features: number[]): number {
    // Simplified head pose estimation from eye landmarks
    if (features.length < 4) return 0;
    const leftEyeX = features[0] || 0;
    const rightEyeX = features[2] || 0;
    return (rightEyeX - leftEyeX) * 0.1; // Normalized yaw estimate
  }

  private estimateHeadPosePitch(features: number[]): number {
    if (features.length < 4) return 0;
    const leftEyeY = features[1] || 0;
    const rightEyeY = features[3] || 0;
    return ((leftEyeY + rightEyeY) / 2 - 0.5) * 0.2; // Normalized pitch estimate
  }

  private calculateInterEyeDistance(features: number[]): number {
    if (features.length < 4) return 0.1; // Default distance
    const leftEyeX = features[0] || 0;
    const leftEyeY = features[1] || 0;
    const rightEyeX = features[2] || 0;
    const rightEyeY = features[3] || 0;
    return Math.sqrt(Math.pow(rightEyeX - leftEyeX, 2) + Math.pow(rightEyeY - leftEyeY, 2));
  }

  private estimateEyeToScreenDistance(features: number[]): number {
    // Estimate based on eye size in the image
    const interEyeDist = this.calculateInterEyeDistance(features);
    return Math.max(0.1, Math.min(2.0, 0.15 / Math.max(interEyeDist, 0.01))); // Inverse relationship
  }

  private estimatePupilSize(features: number[]): number {
    // Simplified pupil size estimation
    return features.length > 8 ? (features[8] || 0.5) : 0.5;
  }

  private calculatePupilAsymmetry(features: number[]): number {
    // Calculate difference between left and right pupil sizes
    if (features.length < 10) return 0;
    const leftPupil = features[8] || 0.5;
    const rightPupil = features[9] || 0.5;
    return Math.abs(leftPupil - rightPupil);
  }

  private calculateFacialSymmetry(features: number[]): number {
    if (features.length < 4) return 1.0;
    const leftEyeX = features[0] || 0;
    const rightEyeX = features[2] || 0;
    const centerX = (leftEyeX + rightEyeX) / 2;
    const asymmetry = Math.abs(0.5 - centerX);
    return Math.max(0, 1 - asymmetry * 4); // Higher score = more symmetric
  }

  private calculateEyeSymmetry(features: number[]): number {
    if (features.length < 4) return 1.0;
    const leftEyeY = features[1] || 0;
    const rightEyeY = features[3] || 0;
    const yDifference = Math.abs(leftEyeY - rightEyeY);
    return Math.max(0, 1 - yDifference * 10); // Higher score = more symmetric
  }

  private calculateMovingAverage(featureMatrix: number[][]): number[] {
    if (featureMatrix.length === 0) return [];
    
    const featureDim = featureMatrix[0].length;
    const average = new Array(featureDim).fill(0);
    
    featureMatrix.forEach(features => {
      features.forEach((feature, i) => {
        average[i] += feature;
      });
    });
    
    return average.map(sum => sum / featureMatrix.length);
  }

  private calculateMedianFilter(featureMatrix: number[][]): number[] {
    if (featureMatrix.length === 0) return [];
    
    const featureDim = featureMatrix[0].length;
    const median = new Array(featureDim).fill(0);
    
    for (let i = 0; i < featureDim; i++) {
      const values = featureMatrix.map(features => features[i]).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      median[i] = values.length % 2 === 0 
        ? (values[mid - 1] + values[mid]) / 2 
        : values[mid];
    }
    
    return median;
  }

  // ===== PUBLIC METHODS FOR REAL-TIME FEATURE ENHANCEMENT =====

  /**
   * Public method to enhance features for real-time prediction
   * Used by gaze-estimation.service.ts when making predictions
   */
  public enhanceFeaturesForPrediction(originalFeatures: number[], quality?: any): number[] {
    if (!this.featureNormalizationConfig.enableFeatureNormalization && 
        !this.featureAugmentationConfig.enableHeadPoseFeatures) {
      // Feature engineering disabled, return original features
      return originalFeatures;
    }

    console.log(`🔧 Real-time feature enhancement: ${originalFeatures.length} → enhanced features`);
    
    // Use default quality if not provided
    const defaultQuality = {
      overallConfidence: 0.7,
      eyeTracking: 0.7,
      headStability: 0.7,
      faceDetected: true
    };
    const safeQuality = quality || defaultQuality;

    // 1. Normalize features (if stats available)
    const normalizedFeatures = this.normalizeFeatures(originalFeatures);
    
    // 2. Augment with additional features
    const augmentedFeatures = this.augmentFeatures(originalFeatures, safeQuality);
    
    // 3. Add temporal features (simplified for real-time)
    const temporalFeatures = this.extractSimplifiedTemporalFeatures(originalFeatures);
    
    // 4. Combine all features
    const enhancedFeatures = this.combineFeatures(
      originalFeatures,
      normalizedFeatures,
      augmentedFeatures,
      temporalFeatures
    );

    console.log(`✨ Real-time enhancement: ${originalFeatures.length} → ${enhancedFeatures.length} features`);
    return enhancedFeatures;
  }

  /**
   * Check if feature engineering is enabled for real-time prediction
   */
  public isFeatureEngineeringEnabled(): boolean {
    return this.featureNormalizationConfig.enableFeatureNormalization || 
           this.featureAugmentationConfig.enableHeadPoseFeatures ||
           this.featureAugmentationConfig.enableTemporalFeatures;
  }

  /**
   * Get expected feature dimension after enhancement
   */
  public getEnhancedFeatureDimension(): number {
    if (!this.isFeatureEngineeringEnabled()) {
      return 10; // Original feature dimension
    }
    
    // Calculate expected dimension based on enabled features
    let dimension = 10; // Original features
    
    if (this.featureNormalizationConfig.enableFeatureNormalization) {
      dimension += 10; // Normalized features
    }
    
    // Augmented features count
    let augmentedCount = 0;
    if (this.featureAugmentationConfig.enableHeadPoseFeatures) augmentedCount += 2;
    if (this.featureAugmentationConfig.enableEyeDistanceFeatures) augmentedCount += 2;
    if (this.featureAugmentationConfig.enablePupilSizeFeatures) augmentedCount += 2;
    if (this.featureAugmentationConfig.enableFacialSymmetryFeatures) augmentedCount += 2;
    augmentedCount += 3; // Quality features always added
    dimension += augmentedCount;
    
    if (this.featureAugmentationConfig.enableTemporalFeatures) {
      dimension += 20; // Temporal features (moving average + median)
    }
    
    return dimension;
  }

  /**
   * Simplified temporal features for real-time use
   */
  private extractSimplifiedTemporalFeatures(currentFeatures: number[]): number[] {
    if (!this.featureAugmentationConfig.enableTemporalFeatures) {
      return [];
    }
    
    const windowSize = Math.min(3, this.featureHistory.length); // Smaller window for real-time
    if (windowSize < 1) {
      // No history, return zeros
      return new Array(currentFeatures.length * 2).fill(0);
    }
    
    // Get recent feature history (limited)
    const recentFeatures = this.featureHistory.slice(-windowSize).map(h => h.features);
    
    const temporal: number[] = [];
    
    // Simple moving average
    const movingAvg = this.calculateMovingAverage(recentFeatures);
    temporal.push(...movingAvg);
    
    // Simple median (or use last value if only 1 sample)
    if (recentFeatures.length === 1) {
      temporal.push(...recentFeatures[0]);
    } else {
      const medianFiltered = this.calculateMedianFilter(recentFeatures);
      temporal.push(...medianFiltered);
    }
    
    return temporal;
  }
}
