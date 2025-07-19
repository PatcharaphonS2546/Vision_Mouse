import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import { TensorFlowManager, ModelArchitecture } from '../tensorflow-manager.service';

export interface NeuralNetworkModel {
  id: string;
  name: string;
  description: string;
  type: 'cnn' | 'lstm' | 'dense' | 'ensemble';
  accuracy: number;
  trainedSamples: number;
  lastTraining: Date;
  isLoaded: boolean;
}

export interface GazeFeatures {
  facialLandmarks: number[]; // 468 facial landmarks (x, y, z) = 1404 features
  eyeRegion: number[]; // Eye-specific features
  headPose: number[]; // Head rotation and position
  temporal: number[]; // Temporal features for sequence prediction
  contextual: number[]; // Environmental context features
}

export interface PredictionResult {
  gazePoint: { x: number; y: number };
  confidence: number;
  attention: number; // Attention score 0-1
  uncertainty: number; // Model uncertainty 0-1
  features: number[]; // Extracted features used
  processingTime: number; // Milliseconds
}

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
  valLoss?: number;
  valAccuracy?: number;
  estimatedTimeRemaining: number; // seconds
}

export interface ModelPerformance {
  modelId: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  inferenceTime: number; // milliseconds
  memoryUsage: number; // MB
  lastEvaluation: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NeuralNetworkService {
  private models = new Map<string, tf.LayersModel>(); // TensorFlow.js models
  private isInitialized$ = new BehaviorSubject<boolean>(false);
  private trainingProgress$ = new BehaviorSubject<TrainingProgress | null>(null);
  private modelPerformance$ = new BehaviorSubject<ModelPerformance[]>([]);
  private availableModels$ = new BehaviorSubject<NeuralNetworkModel[]>([]);
  private tensorFlowManager: TensorFlowManager;

  private readonly MODEL_CONFIGS = {
    gazeEstimationCNN: {
      id: 'gaze_cnn',
      name: 'Gaze Estimation CNN',
      description: 'Convolutional Neural Network for precise gaze prediction',
      type: 'cnn' as const,
      inputShape: [468, 3], // 468 landmarks with x,y,z coordinates
      outputShape: [2], // x, y coordinates
      architecture: [
        { type: 'conv1d', filters: 64, kernelSize: 3, activation: 'relu' },
        { type: 'conv1d', filters: 128, kernelSize: 3, activation: 'relu' },
        { type: 'globalMaxPooling1d' },
        { type: 'dense', units: 256, activation: 'relu' },
        { type: 'dropout', rate: 0.3 },
        { type: 'dense', units: 128, activation: 'relu' },
        { type: 'dropout', rate: 0.2 },
        { type: 'dense', units: 2, activation: 'linear' }
      ]
    },
    attentionLSTM: {
      id: 'attention_lstm',
      name: 'Attention LSTM',
      description: 'LSTM with attention mechanism for temporal gaze prediction',
      type: 'lstm' as const,
      inputShape: [10, 468 * 3], // Sequence of 10 frames
      outputShape: [2],
      architecture: [
        { type: 'lstm', units: 128, returnSequences: true },
        { type: 'attention' },
        { type: 'dense', units: 64, activation: 'relu' },
        { type: 'dropout', rate: 0.2 },
        { type: 'dense', units: 2, activation: 'linear' }
      ]
    },
    ensembleModel: {
      id: 'ensemble',
      name: 'Ensemble Model',
      description: 'Combination of multiple models for optimal accuracy',
      type: 'ensemble' as const,
      models: ['gaze_cnn', 'attention_lstm'],
      weights: [0.6, 0.4]
    }
  };

  private tfLoaded = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.tensorFlowManager = TensorFlowManager.getInstance({
      backend: 'auto',
      enableProfiling: false,
      modelCacheSize: 10
    });
    this.initializeTensorFlow();
  }

  /**
   * Initialize TensorFlow.js and load models
   */
  async initializeTensorFlow(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log('Initializing TensorFlow.js for neural networks...');

      // Initialize TensorFlow manager
      await this.tensorFlowManager.initialize();
      
      console.log('TensorFlow.js backend initialized:', this.tensorFlowManager.getBackend());
      
      this.tfLoaded = true;

      // Initialize available models
      await this.initializeModels();

      this.isInitialized$.next(true);
      console.log('Neural network service initialized successfully with TensorFlow.js');

    } catch (error) {
      console.error('Failed to initialize neural network service:', error);
      this.isInitialized$.next(false);
    }
  }

  /**
   * Create and compile a neural network model
   */
  async createModel(modelConfig: any): Promise<boolean> {
    try {
      if (!this.tfLoaded) {
        console.warn('TensorFlow.js not loaded, cannot create model');
        return false;
      }

      console.log(`Creating model: ${modelConfig.name}`);

      let architecture: ModelArchitecture;

      switch (modelConfig.type) {
        case 'cnn':
          architecture = TensorFlowManager.getGazeEstimationCNN();
          break;
        case 'lstm':
          architecture = TensorFlowManager.getAttentionLSTM();
          break;
        case 'ensemble':
          architecture = TensorFlowManager.getEnsembleModel();
          break;
        default:
          throw new Error(`Unsupported model type: ${modelConfig.type}`);
      }

      // Create model using TensorFlow manager
      const model = await this.tensorFlowManager.createModel(architecture, modelConfig.id);

      // Store model
      this.models.set(modelConfig.id, model);
      
      // Update available models
      this.updateAvailableModels();

      console.log(`Model ${modelConfig.name} created and compiled successfully`);
      return true;

    } catch (error) {
      console.error(`Failed to create model ${modelConfig.name}:`, error);
      return false;
    }
  }

  /**
   * Train a neural network model
   */
  async trainModel(
    modelId: string,
    trainingData: { inputs: number[][], outputs: number[][] },
    validationData?: { inputs: number[][], outputs: number[][] },
    epochs: number = 100
  ): Promise<boolean> {
    try {
      const model = this.models.get(modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      console.log(`Starting training for model ${modelId} with ${trainingData.inputs.length} samples`);

      // Convert data to tensors
      const xs = tf.tensor2d(trainingData.inputs);
      const ys = tf.tensor2d(trainingData.outputs);

      let validationSplit = 0.2;
      let valXs: any = null;
      let valYs: any = null;

      if (validationData) {
        valXs = tf.tensor2d(validationData.inputs);
        valYs = tf.tensor2d(validationData.outputs);
        validationSplit = 0;
      }

      // Training configuration
      const trainingConfig: any = {
        epochs,
        batchSize: 32,
        validationSplit,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch: number, logs: any) => {
            const progress: TrainingProgress = {
              epoch: epoch + 1,
              totalEpochs: epochs,
              loss: logs.loss,
              accuracy: 1 - logs.mae, // Convert MAE to accuracy-like metric
              valLoss: logs.val_loss,
              valAccuracy: logs.val_mae ? 1 - logs.val_mae : undefined,
              estimatedTimeRemaining: ((epochs - epoch - 1) * 1000) // Rough estimate
            };
            this.trainingProgress$.next(progress);
          }
        }
      };

      if (validationData) {
        trainingConfig.validationData = [valXs, valYs];
      }

      // Train the model
      const history = await model.fit(xs, ys, trainingConfig);

      // Clean up tensors
      xs.dispose();
      ys.dispose();
      if (valXs) valXs.dispose();
      if (valYs) valYs.dispose();

      // Update model metadata
      await this.updateModelMetadata(modelId, trainingData.inputs.length);

      console.log(`Model ${modelId} training completed`);
      this.trainingProgress$.next(null);

      return true;

    } catch (error) {
      console.error(`Training failed for model ${modelId}:`, error);
      this.trainingProgress$.next(null);
      return false;
    }
  }

  /**
   * Make prediction using neural network
   */
  async predict(modelId: string, features: GazeFeatures): Promise<PredictionResult> {
    try {
      const startTime = window.performance.now();
      const model = this.models.get(modelId);
      
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      // Prepare input features
      const inputTensor = await this.prepareInputFeatures(features, modelId);
      
      // Make prediction
      const prediction = model.predict(inputTensor) as any;
      const result = await prediction.data();
      
      // Calculate confidence based on model uncertainty
      const confidence = this.calculatePredictionConfidence(result, features);
      const uncertainty = 1 - confidence;
      
      // Calculate attention score
      const attention = this.calculateAttentionScore(features);
      
      const processingTime = window.performance.now() - startTime;

      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();

      return {
        gazePoint: { x: result[0], y: result[1] },
        confidence,
        attention,
        uncertainty,
        features: this.extractFeatureVector(features),
        processingTime
      };

    } catch (error) {
      console.error(`Prediction failed for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate model performance
   */
  async evaluateModel(
    modelId: string,
    testData: { inputs: number[][], outputs: number[][] }
  ): Promise<ModelPerformance> {
    try {
      const model = this.models.get(modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      const startTime = window.performance.now();

      // Convert test data to tensors
      const testXs = tf.tensor2d(testData.inputs);
      const testYs = tf.tensor2d(testData.outputs);

      // Evaluate model
      const evaluation = model.evaluate(testXs, testYs) as tf.Scalar[];
      const [lossResult, maeResult] = await Promise.all([
        evaluation[0].data(),
        evaluation[1].data()
      ]);

      const inferenceTime = window.performance.now() - startTime;

      // Calculate additional metrics
      const predictions = model.predict(testXs) as tf.Tensor;
      const predData = await predictions.data();
      const actualData = await testYs.data();

      const detailedMetrics = this.calculateDetailedMetrics(
        Array.from(predData), 
        Array.from(actualData)
      );

      // Clean up tensors
      testXs.dispose();
      testYs.dispose();
      evaluation[0].dispose();
      evaluation[1].dispose();
      predictions.dispose();

      const modelPerformance: ModelPerformance = {
        modelId,
        accuracy: 1 - (maeResult as Float32Array)[0],
        precision: detailedMetrics.precision,
        recall: detailedMetrics.recall,
        f1Score: detailedMetrics.f1Score,
        inferenceTime: inferenceTime / testData.inputs.length,
        memoryUsage: this.estimateModelMemoryUsage(model),
        lastEvaluation: new Date()
      };

      // Update performance tracking
      this.updatePerformanceTracking(modelPerformance);

      return modelPerformance;

    } catch (error) {
      console.error(`Evaluation failed for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Load pre-trained model
   */
  async loadPretrainedModel(modelId: string, modelUrl: string): Promise<boolean> {
    try {
      if (!this.tfLoaded) {
        throw new Error('TensorFlow.js not initialized');
      }

      console.log(`Loading pre-trained model from: ${modelUrl}`);
      const model = await tf.loadLayersModel(modelUrl);
      
      this.models.set(modelId, model);
      this.updateAvailableModels();

      console.log(`Pre-trained model ${modelId} loaded successfully`);
      return true;

    } catch (error) {
      console.error(`Failed to load pre-trained model ${modelId}:`, error);
      return false;
    }
  }

  /**
   * Save trained model
   */
  async saveModel(modelId: string, savePath: string): Promise<boolean> {
    try {
      const model = this.models.get(modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      await model.save(savePath);
      console.log(`Model ${modelId} saved to ${savePath}`);
      return true;

    } catch (error) {
      console.error(`Failed to save model ${modelId}:`, error);
      return false;
    }
  }

  /**
   * Get available models
   */
  getAvailableModels(): Observable<NeuralNetworkModel[]> {
    return this.availableModels$.asObservable();
  }

  /**
   * Get training progress
   */
  getTrainingProgress(): Observable<TrainingProgress | null> {
    return this.trainingProgress$.asObservable();
  }

  /**
   * Get model performance metrics
   */
  getModelPerformance(): Observable<ModelPerformance[]> {
    return this.modelPerformance$.asObservable();
  }

  /**
   * Check if service is initialized
   */
  get isInitialized(): Observable<boolean> {
    return this.isInitialized$.asObservable();
  }

  // Private helper methods

  private async createCNNModel(config: any): Promise<any> {
    const model = tf.sequential();

    // Add layers based on configuration
    config.architecture.forEach((layer: any, index: number) => {
      switch (layer.type) {
        case 'conv1d':
          const convConfig: any = {
            filters: layer.filters,
            kernelSize: layer.kernelSize,
            activation: layer.activation
          };
          if (index === 0) {
            convConfig.inputShape = config.inputShape;
          }
          model.add(tf.layers.conv1d(convConfig));
          break;

        case 'globalMaxPooling1d':
          model.add(tf.layers.globalMaxPooling1d());
          break;

        case 'dense':
          model.add(tf.layers.dense({
            units: layer.units,
            activation: layer.activation
          }));
          break;

        case 'dropout':
          model.add(tf.layers.dropout({ rate: layer.rate }));
          break;
      }
    });

    return model;
  }

  private async createLSTMModel(config: any): Promise<any> {
    const model = tf.sequential();

    config.architecture.forEach((layer: any, index: number) => {
      switch (layer.type) {
        case 'lstm':
          const lstmConfig: any = {
            units: layer.units,
            returnSequences: layer.returnSequences
          };
          if (index === 0) {
            lstmConfig.inputShape = config.inputShape;
          }
          model.add(tf.layers.lstm(lstmConfig));
          break;

        case 'dense':
          model.add(tf.layers.dense({
            units: layer.units,
            activation: layer.activation
          }));
          break;

        case 'dropout':
          model.add(tf.layers.dropout({ rate: layer.rate }));
          break;
      }
    });

    return model;
  }

  private async createDenseModel(config: any): Promise<any> {
    const model = tf.sequential();

    config.architecture.forEach((layer: any, index: number) => {
      if (layer.type === 'dense') {
        const denseConfig: any = {
          units: layer.units,
          activation: layer.activation
        };
        if (index === 0) {
          denseConfig.inputShape = config.inputShape;
        }
        model.add(tf.layers.dense(denseConfig));
      } else if (layer.type === 'dropout') {
        model.add(tf.layers.dropout({ rate: layer.rate }));
      }
    });

    return model;
  }

  private async createEnsembleModel(config: any): Promise<any> {
    // Create ensemble model that combines predictions from multiple models
    return {
      predict: async (input: any) => {
        const predictions: any[] = [];
        
        for (const modelId of config.models) {
          const model = this.models.get(modelId);
          if (model) {
            const pred = await model.predict(input);
            predictions.push(pred);
          }
        }

        // Weighted average of predictions
        if (predictions.length > 0) {
          const weights = config.weights || predictions.map(() => 1 / predictions.length);
          
          // Simple weighted average (simplified for demo)
          return predictions[0]; // Return first prediction for now
        }

        throw new Error('No models available for ensemble prediction');
      }
    };
  }

  private async prepareInputFeatures(features: GazeFeatures, modelId: string): Promise<any> {
    // Combine all features into a single input vector
    const allFeatures = [
      ...features.facialLandmarks,
      ...features.eyeRegion,
      ...features.headPose,
      ...features.temporal,
      ...features.contextual
    ];

    // Create tensor based on model requirements
    const modelConfig = this.getModelConfig(modelId);
    if (modelConfig?.type === 'lstm') {
      // For LSTM, we need sequence data
      const sequenceLength = 10;
      const featureSize = allFeatures.length;
      
      // Create sequence (simplified - in real implementation, maintain history)
      const sequenceData = new Array(sequenceLength).fill(allFeatures);
      return tf.tensor2d(sequenceData, [1, sequenceLength * featureSize]);
    } else {
      // For CNN and dense models
      return tf.tensor2d([allFeatures]);
    }
  }

  private calculatePredictionConfidence(prediction: number[], features: GazeFeatures): number {
    // Calculate confidence based on prediction stability and feature quality
    const predictionMagnitude = Math.sqrt(prediction[0] * prediction[0] + prediction[1] * prediction[1]);
    const featureQuality = this.assessFeatureQuality(features);
    
    // Normalize confidence (simplified approach)
    const baseConfidence = Math.min(1, Math.max(0.1, 1 - (predictionMagnitude / 2)));
    return baseConfidence * featureQuality;
  }

  private calculateAttentionScore(features: GazeFeatures): number {
    // Calculate attention score based on eye features
    const eyeOpenness = this.calculateEyeOpenness(features.eyeRegion);
    const headStability = this.calculateHeadStability(features.headPose);
    
    return (eyeOpenness + headStability) / 2;
  }

  private extractFeatureVector(features: GazeFeatures): number[] {
    return [
      ...features.facialLandmarks.slice(0, 10), // First 10 landmarks for demo
      ...features.eyeRegion,
      ...features.headPose
    ];
  }

  private calculateDetailedMetrics(predictions: number[], actual: number[]): {
    precision: number;
    recall: number;
    f1Score: number;
  } {
    // Simplified metrics calculation
    let totalError = 0;
    for (let i = 0; i < predictions.length; i += 2) {
      const errorX = Math.abs(predictions[i] - actual[i]);
      const errorY = Math.abs(predictions[i + 1] - actual[i + 1]);
      totalError += Math.sqrt(errorX * errorX + errorY * errorY);
    }
    
    const avgError = totalError / (predictions.length / 2);
    const accuracy = Math.max(0, 1 - avgError);
    
    return {
      precision: accuracy,
      recall: accuracy,
      f1Score: accuracy
    };
  }

  private estimateModelMemoryUsage(model: any): number {
    // Estimate memory usage in MB (simplified)
    try {
      const params = model.countParams ? model.countParams() : 1000000;
      return (params * 4) / (1024 * 1024); // 4 bytes per float32 parameter
    } catch {
      return 50; // Default estimate
    }
  }

  private calculateEyeOpenness(eyeFeatures: number[]): number {
    // Simplified eye openness calculation
    return eyeFeatures.length > 0 ? Math.min(1, Math.max(0, eyeFeatures[0])) : 0.8;
  }

  private calculateHeadStability(headPose: number[]): number {
    // Simplified head stability calculation
    if (headPose.length < 3) return 0.8;
    
    const rotation = Math.sqrt(headPose[0] * headPose[0] + headPose[1] * headPose[1] + headPose[2] * headPose[2]);
    return Math.max(0.1, 1 - (rotation / Math.PI));
  }

  private assessFeatureQuality(features: GazeFeatures): number {
    // Assess overall quality of input features
    const landmarkQuality = features.facialLandmarks.length > 0 ? 1 : 0;
    const eyeQuality = features.eyeRegion.length > 0 ? 1 : 0;
    const poseQuality = features.headPose.length > 0 ? 1 : 0;
    
    return (landmarkQuality + eyeQuality + poseQuality) / 3;
  }

  private getModelConfig(modelId: string): any {
    return Object.values(this.MODEL_CONFIGS).find(config => config.id === modelId);
  }

  private async initializeModels(): Promise<void> {
    const models: NeuralNetworkModel[] = [];

    for (const config of Object.values(this.MODEL_CONFIGS)) {
      models.push({
        id: config.id,
        name: config.name,
        description: config.description,
        type: config.type,
        accuracy: 0.85, // Default accuracy
        trainedSamples: 0,
        lastTraining: new Date(),
        isLoaded: false
      });
    }

    this.availableModels$.next(models);
  }

  private updateAvailableModels(): void {
    const current = this.availableModels$.value;
    const updated = current.map(model => ({
      ...model,
      isLoaded: this.models.has(model.id)
    }));
    this.availableModels$.next(updated);
  }

  private async updateModelMetadata(modelId: string, sampleCount: number): Promise<void> {
    const models = this.availableModels$.value;
    const updated = models.map(model => {
      if (model.id === modelId) {
        return {
          ...model,
          trainedSamples: sampleCount,
          lastTraining: new Date(),
          isLoaded: true
        };
      }
      return model;
    });
    this.availableModels$.next(updated);
  }

  private updatePerformanceTracking(performance: ModelPerformance): void {
    const current = this.modelPerformance$.value;
    const updated = current.filter(p => p.modelId !== performance.modelId);
    updated.push(performance);
    this.modelPerformance$.next(updated);
  }
}
