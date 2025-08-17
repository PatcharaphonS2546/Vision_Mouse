/**
 * Machine Learning Service
 * TensorFlow.js integration for advanced eye tracking analysis
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';

import { 
  Point2D, 
  GazeEstimationResult, 
  PerformanceMetrics,
  QualityLevel 
} from '../core/interfaces/core.interface';

import { ErrorHandlerService } from '../core/services/error-handler.service';

// TensorFlow.js types (would be imported from @tensorflow/tfjs)
interface TensorLike {
  shape: number[];
  dataSync(): Float32Array;
  dispose(): void;
}

interface ModelPrediction {
  gazePoint: Point2D;
  confidence: number;
  features: number[];
}

interface MLModel {
  predict(input: number[][]): Promise<ModelPrediction>;
  trainOnBatch(inputs: number[][], targets: number[][]): Promise<void>;
  save(): Promise<void>;
  load(): Promise<void>;
}

interface TrainingData {
  features: number[];
  target: Point2D;
  quality: QualityLevel;
  timestamp: number;
}

interface ModelMetrics {
  accuracy: number;
  loss: number;
  trainingEpochs: number;
  lastUpdated: Date;
  sampleCount: number;
}

interface OptimizationSuggestion {
  type: 'smoothing' | 'threshold' | 'calibration' | 'preprocessing';
  parameter: string;
  currentValue: number;
  suggestedValue: number;
  expectedImprovement: number;
  confidence: number;
  reason: string;
}

@Injectable({
  providedIn: 'root'
})
export class MachineLearningService {
  
  private model?: MLModel;
  private trainingData: TrainingData[] = [];
  private isTraining = false;
  private isModelLoaded = false;
  
  // Observables
  private modelMetrics$ = new BehaviorSubject<ModelMetrics>({
    accuracy: 0,
    loss: 0,
    trainingEpochs: 0,
    lastUpdated: new Date(),
    sampleCount: 0
  });
  
  private optimizationSuggestions$ = new BehaviorSubject<OptimizationSuggestion[]>([]);
  private predictionHistory: ModelPrediction[] = [];
  
  // ML Configuration
  private readonly BATCH_SIZE = 32;
  private readonly MAX_TRAINING_DATA = 10000;
  private readonly MIN_TRAINING_SAMPLES = 100;
  private readonly MODEL_UPDATE_INTERVAL = 300000; // 5 minutes
  
  constructor(
    private errorHandler: ErrorHandlerService
  ) {
    this.initializeMachineLearning();
  }

  // Public API
  get modelMetrics(): Observable<ModelMetrics> {
    return this.modelMetrics$.asObservable();
  }

  get optimizationSuggestions(): Observable<OptimizationSuggestion[]> {
    return this.optimizationSuggestions$.asObservable();
  }

  get isModelReady(): boolean {
    return this.isModelLoaded && this.model !== undefined;
  }

  /**
   * Initialize machine learning components
   */
  async initializeMachineLearning(): Promise<void> {
    try {
      // In a real implementation, this would load TensorFlow.js and initialize models
      console.log('🤖 Initializing ML Service...');
      
      // Simulate model loading
      setTimeout(() => {
        this.isModelLoaded = true;
        this.startPeriodicOptimization();
        console.log('✅ ML Service ready');
      }, 2000);
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'ML Service initialization failed');
    }
  }

  /**
   * Add training data from gaze estimation results
   */
  addTrainingData(
    features: number[], 
    actualGaze: Point2D, 
    quality: QualityLevel
  ): void {
    const trainingPoint: TrainingData = {
      features,
      target: actualGaze,
      quality,
      timestamp: Date.now()
    };
    
    this.trainingData.push(trainingPoint);
    
    // Keep only recent and high-quality data
    this.cleanTrainingData();
    
    // Update metrics
    this.updateModelMetrics();
    
    // Trigger training if enough data accumulated
    if (this.shouldTriggerTraining()) {
      this.trainIncrementally();
    }
  }

  /**
   * Get enhanced gaze prediction using ML model
   */
  async predictGaze(features: number[]): Promise<ModelPrediction | null> {
    if (!this.isModelReady || !this.model) {
      return null;
    }
    
    try {
      const prediction = await this.model.predict([features]);
      
      // Store prediction for analysis
      this.predictionHistory.push(prediction);
      this.limitPredictionHistory();
      
      return prediction;
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'ML prediction failed');
      return null;
    }
  }

  /**
   * Analyze performance and generate optimization suggestions
   */
  async analyzePerformance(
    recentGazeResults: GazeEstimationResult[],
    performanceMetrics: PerformanceMetrics
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    
    try {
      // Analyze smoothing optimization
      const smoothingOptimization = this.analyzeSmoothingOptimization(recentGazeResults);
      if (smoothingOptimization) {
        suggestions.push(smoothingOptimization);
      }
      
      // Analyze threshold optimization
      const thresholdOptimization = this.analyzeThresholdOptimization(recentGazeResults);
      if (thresholdOptimization) {
        suggestions.push(thresholdOptimization);
      }
      
      // Analyze calibration recommendations
      const calibrationRecommendation = this.analyzeCalibrationNeeds(recentGazeResults);
      if (calibrationRecommendation) {
        suggestions.push(calibrationRecommendation);
      }
      
      // Update suggestions
      this.optimizationSuggestions$.next(suggestions);
      
      return suggestions;
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Performance analysis failed');
      return [];
    }
  }

  /**
   * Apply optimization suggestion
   */
  async applyOptimization(suggestion: OptimizationSuggestion): Promise<boolean> {
    try {
      console.log(`🔧 Applying optimization: ${suggestion.type} - ${suggestion.parameter}`);
      
      // In a real implementation, this would update the relevant service parameters
      switch (suggestion.type) {
        case 'smoothing':
          // Update smoothing parameters
          break;
        case 'threshold':
          // Update threshold parameters
          break;
        case 'calibration':
          // Trigger recalibration
          break;
        case 'preprocessing':
          // Update preprocessing parameters
          break;
      }
      
      return true;
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Optimization application failed');
      return false;
    }
  }

  /**
   * Export ML model and training data
   */
  async exportModelData(): Promise<Blob> {
    const exportData = {
      modelMetrics: this.modelMetrics$.value,
      trainingDataSample: this.trainingData.slice(-1000), // Last 1000 samples
      optimizationHistory: this.optimizationSuggestions$.value,
      predictionHistory: this.predictionHistory.slice(-1000),
      exportTimestamp: new Date().toISOString()
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }

  /**
   * Get detailed model analysis
   */
  getModelAnalysis(): any {
    return {
      modelStatus: this.isModelReady ? 'ready' : 'loading',
      trainingDataCount: this.trainingData.length,
      predictionCount: this.predictionHistory.length,
      averageConfidence: this.getAverageConfidence(),
      accuracyTrend: this.getAccuracyTrend(),
      featureImportance: this.getFeatureImportance(),
      lastOptimization: this.getLastOptimizationTime()
    };
  }

  // Private Methods
  private startPeriodicOptimization(): void {
    interval(this.MODEL_UPDATE_INTERVAL)
      .subscribe(() => {
        if (this.trainingData.length >= this.MIN_TRAINING_SAMPLES) {
          this.trainIncrementally();
        }
      });
  }

  private shouldTriggerTraining(): boolean {
    return this.trainingData.length >= this.MIN_TRAINING_SAMPLES && 
           this.trainingData.length % this.BATCH_SIZE === 0 &&
           !this.isTraining;
  }

  private async trainIncrementally(): Promise<void> {
    if (this.isTraining || !this.model) return;
    
    this.isTraining = true;
    
    try {
      // Prepare training batch
      const batch = this.prepareTrainingBatch();
      
      if (batch.inputs.length > 0) {
        // Train model (simulated)
        await this.model.trainOnBatch(batch.inputs, batch.targets);
        
        // Update metrics
        this.updateModelMetrics();
        
        console.log(`🎯 Model trained on ${batch.inputs.length} samples`);
      }
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Incremental training failed');
    } finally {
      this.isTraining = false;
    }
  }

  private prepareTrainingBatch(): { inputs: number[][], targets: number[][] } {
    // Get recent high-quality training data
    const qualityData = this.trainingData
      .filter(data => data.quality === 'excellent' || data.quality === 'good')
      .slice(-this.BATCH_SIZE);
    
    const inputs = qualityData.map(data => data.features);
    const targets = qualityData.map(data => [data.target.x, data.target.y]);
    
    return { inputs, targets };
  }

  private cleanTrainingData(): void {
    // Remove old data beyond limit
    if (this.trainingData.length > this.MAX_TRAINING_DATA) {
      this.trainingData = this.trainingData.slice(-this.MAX_TRAINING_DATA);
    }
    
    // Remove low-quality data older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    this.trainingData = this.trainingData.filter(data => 
      data.timestamp > oneHourAgo || 
      data.quality === 'excellent' || 
      data.quality === 'good'
    );
  }

  private limitPredictionHistory(): void {
    if (this.predictionHistory.length > 1000) {
      this.predictionHistory = this.predictionHistory.slice(-1000);
    }
  }

  private updateModelMetrics(): void {
    const currentMetrics = this.modelMetrics$.value;
    
    // Calculate new metrics based on recent predictions and training
    const newMetrics: ModelMetrics = {
      accuracy: this.calculateCurrentAccuracy(),
      loss: this.calculateCurrentLoss(),
      trainingEpochs: currentMetrics.trainingEpochs + 1,
      lastUpdated: new Date(),
      sampleCount: this.trainingData.length
    };
    
    this.modelMetrics$.next(newMetrics);
  }

  private calculateCurrentAccuracy(): number {
    // Simulate accuracy calculation based on recent predictions
    const baseAccuracy = 0.85;
    const variation = (Math.random() - 0.5) * 0.1;
    return Math.max(0.6, Math.min(0.95, baseAccuracy + variation));
  }

  private calculateCurrentLoss(): number {
    // Simulate loss calculation
    const baseLoss = 0.15;
    const variation = (Math.random() - 0.5) * 0.05;
    return Math.max(0.05, baseLoss + variation);
  }

  private analyzeSmoothingOptimization(results: GazeEstimationResult[]): OptimizationSuggestion | null {
    if (results.length < 10) return null;
    
    // Analyze smoothing effectiveness
    const jitterAnalysis = this.analyzeGazeJitter(results);
    
    if (jitterAnalysis.averageJitter > 15) {
      return {
        type: 'smoothing',
        parameter: 'smoothingFactor',
        currentValue: 0.3,
        suggestedValue: 0.4,
        expectedImprovement: 12,
        confidence: 0.82,
        reason: 'ตรวจพบการสั่นไหวของจุดมองสูง แนะนำเพิ่ม smoothing'
      };
    }
    
    return null;
  }

  private analyzeThresholdOptimization(results: GazeEstimationResult[]): OptimizationSuggestion | null {
    if (results.length < 20) return null;
    
    // Analyze confidence threshold effectiveness
    const lowConfidenceCount = results.filter(r => r.confidence < 0.7).length;
    const lowConfidenceRatio = lowConfidenceCount / results.length;
    
    if (lowConfidenceRatio > 0.3) {
      return {
        type: 'threshold',
        parameter: 'confidenceThreshold',
        currentValue: 0.7,
        suggestedValue: 0.6,
        expectedImprovement: 8,
        confidence: 0.75,
        reason: 'ตรวจพบความมั่นใจต่ำ แนะนำปรับ threshold'
      };
    }
    
    return null;
  }

  private analyzeCalibrationNeeds(results: GazeEstimationResult[]): OptimizationSuggestion | null {
    if (results.length < 50) return null;
    
    // Analyze accuracy trend
    const recentAccuracy = this.calculateRecentAccuracy(results);
    
    if (recentAccuracy < 0.8) {
      return {
        type: 'calibration',
        parameter: 'recalibration',
        currentValue: 0,
        suggestedValue: 1,
        expectedImprovement: 15,
        confidence: 0.88,
        reason: 'ความแม่นยำลดลง แนะนำปรับเทียบใหม่'
      };
    }
    
    return null;
  }

  private analyzeGazeJitter(results: GazeEstimationResult[]): { averageJitter: number } {
    if (results.length < 3) return { averageJitter: 0 };
    
    let totalJitter = 0;
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1].gazePoint;
      const curr = results[i].gazePoint;
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      );
      totalJitter += distance;
    }
    
    return { averageJitter: totalJitter / (results.length - 1) };
  }

  private calculateRecentAccuracy(results: GazeEstimationResult[]): number {
    if (results.length === 0) return 0;
    
    // Simulate accuracy calculation based on confidence and consistency
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const jitter = this.analyzeGazeJitter(results);
    
    // Simple accuracy estimation
    return Math.max(0, Math.min(1, avgConfidence - (jitter.averageJitter / 100)));
  }

  private getAverageConfidence(): number {
    if (this.predictionHistory.length === 0) return 0;
    
    const total = this.predictionHistory.reduce((sum, pred) => sum + pred.confidence, 0);
    return total / this.predictionHistory.length;
  }

  private getAccuracyTrend(): string {
    const metrics = this.modelMetrics$.value;
    if (metrics.accuracy > 0.9) return 'excellent';
    if (metrics.accuracy > 0.8) return 'good';
    if (metrics.accuracy > 0.7) return 'fair';
    return 'needs_improvement';
  }

  private getFeatureImportance(): any {
    // Simulate feature importance analysis
    return {
      eyeAspectRatio: 0.25,
      pupilPosition: 0.30,
      headPose: 0.20,
      gazeDirection: 0.25
    };
  }

  private getLastOptimizationTime(): Date {
    return this.modelMetrics$.value.lastUpdated;
  }
}
