import { Injectable } from '@angular/core';
import { Matrix } from 'ml-matrix';
import { FeatureSet } from './advanced-feature-extraction.service';

export interface GazePoint {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
  metadata: GazeMetadata;
}

export interface GazeMetadata {
  modelVersion: string;
  processingTime: number;
  featureQuality: number;
  calibrationStatus: 'none' | 'partial' | 'full';
  headPoseCompensation: boolean;
  uncertaintyEstimate: number;
}

export interface ModelConfig {
  architecture: 'linear' | 'polynomial' | 'neural' | 'ensemble';
  adaptiveLearning: boolean;
  temporalSmoothing: boolean;
  outlierRejection: boolean;
  confidenceThreshold: number;
  maxTrainingPoints: number;
  learningRate: number;
  regularization: number;
}

export interface TrainingData {
  features: number[][];
  gazePoints: GazePoint[];
  metadata: TrainingMetadata;
}

export interface TrainingMetadata {
  collectionTime: number;
  subjectId: string;
  calibrationAccuracy: number;
  environmentalConditions: string;
  dataQuality: number;
}

export interface ModelPerformance {
  averageError: number;
  stdDeviation: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  temporalConsistency: number;
  spatialConsistency: number;
}

@Injectable({
  providedIn: 'root'
})
export class MachineLearningModelService {
  private config: ModelConfig = {
    architecture: 'ensemble',
    adaptiveLearning: true,
    temporalSmoothing: true,
    outlierRejection: true,
    confidenceThreshold: 0.7,
    maxTrainingPoints: 1000,
    learningRate: 0.01,
    regularization: 0.1
  };

  // Model storage
  private models: Map<string, any> = new Map();
  private trainingHistory: TrainingData[] = [];
  private predictionHistory: GazePoint[] = [];

  // Model weights and biases (for different architectures)
  private linearWeights: {
    xWeights: number[];
    yWeights: number[];
    xBias: number;
    yBias: number;
  } | null = null;

  private polynomialCoefficients: {
    xCoefficients: number[];
    yCoefficients: number[];
  } | null = null;

  // Neural network weights (simplified implementation)
  private neuralNetwork: {
    hiddenWeights: Matrix;
    outputWeights: Matrix;
    hiddenBiases: number[];
    outputBiases: number[];
  } | null = null;

  // Ensemble model
  private ensembleModels: {
    linear: any;
    polynomial: any;
    neural: any;
    weights: number[];
  } | null = null;

  // Performance tracking
  private performanceMetrics: ModelPerformance = {
    averageError: 0,
    stdDeviation: 0,
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    temporalConsistency: 0,
    spatialConsistency: 0
  };

  // Temporal smoothing filter
  private temporalFilter: {
    enabled: boolean;
    windowSize: number;
    weights: number[];
    history: GazePoint[];
  } = {
    enabled: true,
    windowSize: 5,
    weights: [0.1, 0.15, 0.2, 0.25, 0.3], // Recent points weighted more
    history: []
  };

  constructor() {
    this.initializeModels();
  }

  // Main prediction method
  estimateGaze(featureSet: FeatureSet): GazePoint | null {
    const startTime = performance.now();

    try {
      if (!featureSet || featureSet.combined.length === 0) {
        return null;
      }

      // Check feature quality
      if (featureSet.metadata.confidence < this.config.confidenceThreshold) {
        console.warn('Low confidence features, prediction may be unreliable');
      }

      let gazePoint: GazePoint;

      // Predict using selected architecture
      switch (this.config.architecture) {
        case 'linear':
          gazePoint = this.predictLinear(featureSet);
          break;
        case 'polynomial':
          gazePoint = this.predictPolynomial(featureSet);
          break;
        case 'neural':
          gazePoint = this.predictNeural(featureSet);
          break;
        case 'ensemble':
          gazePoint = this.predictEnsemble(featureSet);
          break;
        default:
          gazePoint = this.predictLinear(featureSet);
      }

      // Apply temporal smoothing
      if (this.config.temporalSmoothing) {
        gazePoint = this.applyTemporalSmoothing(gazePoint);
      }

      // Update prediction history
      this.addToPredictionHistory(gazePoint);

      // Calculate processing time
      const processingTime = performance.now() - startTime;
      gazePoint.metadata.processingTime = processingTime;

      return gazePoint;

    } catch (error) {
      console.error('Gaze estimation error:', error);
      return null;
    }
  }

  // Linear regression prediction
  private predictLinear(featureSet: FeatureSet): GazePoint {
    if (!this.linearWeights) {
      // Initialize with basic mapping if no training data
      this.initializeLinearModel(featureSet.combined.length);
    }

    const features = featureSet.combined;
    const weights = this.linearWeights!;

    // Calculate weighted sum for X coordinate
    let gazeX = weights.xBias;
    for (let i = 0; i < Math.min(features.length, weights.xWeights.length); i++) {
      gazeX += features[i] * weights.xWeights[i];
    }

    // Calculate weighted sum for Y coordinate
    let gazeY = weights.yBias;
    for (let i = 0; i < Math.min(features.length, weights.yWeights.length); i++) {
      gazeY += features[i] * weights.yWeights[i];
    }

    // Normalize to screen coordinates [0, 1]
    gazeX = Math.max(0, Math.min(1, gazeX));
    gazeY = Math.max(0, Math.min(1, gazeY));

    // Calculate confidence based on feature quality and model certainty
    const confidence = this.calculatePredictionConfidence(featureSet, 'linear');

    return {
      x: gazeX,
      y: gazeY,
      confidence,
      timestamp: Date.now(),
      metadata: {
        modelVersion: 'linear-v1.0',
        processingTime: 0, // Will be updated
        featureQuality: featureSet.metadata.quality,
        calibrationStatus: 'none',
        headPoseCompensation: false,
        uncertaintyEstimate: 1 - confidence
      }
    };
  }

  // Polynomial regression prediction
  private predictPolynomial(featureSet: FeatureSet): GazePoint {
    if (!this.polynomialCoefficients) {
      this.initializePolynomialModel(featureSet.combined.length);
    }

    const features = featureSet.combined;
    const polyFeatures = this.generatePolynomialFeatures(features, 2); // Degree 2

    const coeffs = this.polynomialCoefficients!;

    // Calculate polynomial prediction for X
    let gazeX = 0;
    for (let i = 0; i < Math.min(polyFeatures.length, coeffs.xCoefficients.length); i++) {
      gazeX += polyFeatures[i] * coeffs.xCoefficients[i];
    }

    // Calculate polynomial prediction for Y
    let gazeY = 0;
    for (let i = 0; i < Math.min(polyFeatures.length, coeffs.yCoefficients.length); i++) {
      gazeY += polyFeatures[i] * coeffs.yCoefficients[i];
    }

    // Normalize to screen coordinates
    gazeX = Math.max(0, Math.min(1, gazeX));
    gazeY = Math.max(0, Math.min(1, gazeY));

    const confidence = this.calculatePredictionConfidence(featureSet, 'polynomial');

    return {
      x: gazeX,
      y: gazeY,
      confidence,
      timestamp: Date.now(),
      metadata: {
        modelVersion: 'polynomial-v1.0',
        processingTime: 0,
        featureQuality: featureSet.metadata.quality,
        calibrationStatus: 'none',
        headPoseCompensation: false,
        uncertaintyEstimate: 1 - confidence
      }
    };
  }

  // Neural network prediction
  private predictNeural(featureSet: FeatureSet): GazePoint {
    if (!this.neuralNetwork) {
      this.initializeNeuralNetwork(featureSet.combined.length);
    }

    const features = featureSet.combined;
    const network = this.neuralNetwork!;

    // Forward pass through network
    const hiddenLayer = this.forwardPassHidden(features, network);
    const output = this.forwardPassOutput(hiddenLayer, network);

    const gazeX = Math.max(0, Math.min(1, output[0]));
    const gazeY = Math.max(0, Math.min(1, output[1]));

    const confidence = this.calculatePredictionConfidence(featureSet, 'neural');

    return {
      x: gazeX,
      y: gazeY,
      confidence,
      timestamp: Date.now(),
      metadata: {
        modelVersion: 'neural-v1.0',
        processingTime: 0,
        featureQuality: featureSet.metadata.quality,
        calibrationStatus: 'none',
        headPoseCompensation: false,
        uncertaintyEstimate: 1 - confidence
      }
    };
  }

  // Ensemble prediction combining multiple models
  private predictEnsemble(featureSet: FeatureSet): GazePoint {
    if (!this.ensembleModels) {
      this.initializeEnsembleModel(featureSet.combined.length);
    }

    // Get predictions from all models
    const linearPred = this.predictLinear(featureSet);
    const polyPred = this.predictPolynomial(featureSet);
    const neuralPred = this.predictNeural(featureSet);

    const weights = this.ensembleModels!.weights;

    // Weighted combination
    const gazeX = (
      linearPred.x * weights[0] +
      polyPred.x * weights[1] +
      neuralPred.x * weights[2]
    ) / (weights[0] + weights[1] + weights[2]);

    const gazeY = (
      linearPred.y * weights[0] +
      polyPred.y * weights[1] +
      neuralPred.y * weights[2]
    ) / (weights[0] + weights[1] + weights[2]);

    // Ensemble confidence
    const confidence = (
      linearPred.confidence * weights[0] +
      polyPred.confidence * weights[1] +
      neuralPred.confidence * weights[2]
    ) / (weights[0] + weights[1] + weights[2]);

    return {
      x: gazeX,
      y: gazeY,
      confidence,
      timestamp: Date.now(),
      metadata: {
        modelVersion: 'ensemble-v1.0',
        processingTime: 0,
        featureQuality: featureSet.metadata.quality,
        calibrationStatus: 'none',
        headPoseCompensation: false,
        uncertaintyEstimate: 1 - confidence
      }
    };
  }

  // Train model with calibration data
  trainModel(trainingData: TrainingData): boolean {
    try {
      if (trainingData.features.length !== trainingData.gazePoints.length) {
        console.error('Training data size mismatch');
        return false;
      }

      if (trainingData.features.length === 0) {
        console.error('No training data provided');
        return false;
      }

      // Store training data
      this.trainingHistory.push(trainingData);

      // Prepare data matrices
      const featureMatrix = new Matrix(trainingData.features);
      const gazeXVector = trainingData.gazePoints.map(gp => gp.x);
      const gazeYVector = trainingData.gazePoints.map(gp => gp.y);

      // Train each model type
      this.trainLinearModel(featureMatrix, gazeXVector, gazeYVector);
      this.trainPolynomialModel(trainingData.features, gazeXVector, gazeYVector);
      this.trainNeuralModel(trainingData.features, gazeXVector, gazeYVector);

      // Update ensemble weights based on performance
      this.updateEnsembleWeights(trainingData);

      // Update performance metrics
      this.evaluateModelPerformance(trainingData);

      console.log('Model training completed successfully');
      return true;

    } catch (error) {
      console.error('Model training error:', error);
      return false;
    }
  }

  // Train linear regression model
  private trainLinearModel(features: Matrix, gazeX: number[], gazeY: number[]): void {
    try {
      // Use simple gradient descent instead of matrix inversion
      const learningRate = 0.001;
      const epochs = 100;
      const featureCount = features.columns;
      
      // Initialize weights
      let xWeights = new Array(featureCount).fill(0);
      let yWeights = new Array(featureCount).fill(0);
      let xBias = 0;
      let yBias = 0;

      // Training loop
      for (let epoch = 0; epoch < epochs; epoch++) {
        for (let i = 0; i < features.rows; i++) {
          const featureRow = features.getRow(i);
          
          // Forward pass
          let predX = xBias;
          let predY = yBias;
          for (let j = 0; j < featureCount; j++) {
            predX += featureRow[j] * xWeights[j];
            predY += featureRow[j] * yWeights[j];
          }

          // Calculate errors
          const errorX = gazeX[i] - predX;
          const errorY = gazeY[i] - predY;

          // Update weights
          xBias += learningRate * errorX;
          yBias += learningRate * errorY;
          
          for (let j = 0; j < featureCount; j++) {
            xWeights[j] += learningRate * errorX * featureRow[j];
            yWeights[j] += learningRate * errorY * featureRow[j];
          }
        }
      }

      this.linearWeights = {
        xBias,
        yBias,
        xWeights,
        yWeights
      };

    } catch (error) {
      console.error('Linear model training error:', error);
      this.initializeLinearModel(features.columns);
    }
  }

  // Train polynomial regression model
  private trainPolynomialModel(features: number[][], gazeX: number[], gazeY: number[]): void {
    try {
      // Generate polynomial features
      const polyFeatures = features.map(f => this.generatePolynomialFeatures(f, 2));
      
      // Use gradient descent for polynomial model too
      const learningRate = 0.0001;
      const epochs = 100;
      const featureCount = polyFeatures[0].length;
      
      // Initialize coefficients
      let xCoefficients = new Array(featureCount + 1).fill(0); // +1 for bias
      let yCoefficients = new Array(featureCount + 1).fill(0);

      // Training loop
      for (let epoch = 0; epoch < epochs; epoch++) {
        for (let i = 0; i < polyFeatures.length; i++) {
          const features = polyFeatures[i];
          
          // Forward pass
          let predX = xCoefficients[0]; // bias
          let predY = yCoefficients[0];
          
          for (let j = 0; j < featureCount; j++) {
            predX += features[j] * xCoefficients[j + 1];
            predY += features[j] * yCoefficients[j + 1];
          }

          // Calculate errors
          const errorX = gazeX[i] - predX;
          const errorY = gazeY[i] - predY;

          // Update coefficients
          xCoefficients[0] += learningRate * errorX; // bias
          yCoefficients[0] += learningRate * errorY;
          
          for (let j = 0; j < featureCount; j++) {
            xCoefficients[j + 1] += learningRate * errorX * features[j];
            yCoefficients[j + 1] += learningRate * errorY * features[j];
          }
        }
      }

      this.polynomialCoefficients = {
        xCoefficients,
        yCoefficients
      };

    } catch (error) {
      console.error('Polynomial model training error:', error);
      this.initializePolynomialModel(features[0].length);
    }
  }

  // Train neural network (simplified backpropagation)
  private trainNeuralModel(features: number[][], gazeX: number[], gazeY: number[]): void {
    try {
      if (!this.neuralNetwork) {
        this.initializeNeuralNetwork(features[0].length);
      }

      const network = this.neuralNetwork!;
      const learningRate = this.config.learningRate;
      const epochs = 50;

      // Training loop
      for (let epoch = 0; epoch < epochs; epoch++) {
        for (let i = 0; i < features.length; i++) {
          const input = features[i];
          const target = [gazeX[i], gazeY[i]];

          // Forward pass
          const hiddenOutput = this.forwardPassHidden(input, network);
          const output = this.forwardPassOutput(hiddenOutput, network);

          // Backward pass
          this.backwardPass(input, hiddenOutput, output, target, network, learningRate);
        }
      }

    } catch (error) {
      console.error('Neural network training error:', error);
      this.initializeNeuralNetwork(features[0].length);
    }
  }

  // Neural network forward pass (hidden layer)
  private forwardPassHidden(input: number[], network: any): number[] {
    const hiddenSize = network.hiddenWeights.columns;
    const hidden = new Array(hiddenSize).fill(0);

    for (let h = 0; h < hiddenSize; h++) {
      let sum = network.hiddenBiases[h];
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * network.hiddenWeights.get(i, h);
      }
      hidden[h] = this.sigmoid(sum);
    }

    return hidden;
  }

  // Neural network forward pass (output layer)
  private forwardPassOutput(hidden: number[], network: any): number[] {
    const outputSize = network.outputWeights.columns;
    const output = new Array(outputSize).fill(0);

    for (let o = 0; o < outputSize; o++) {
      let sum = network.outputBiases[o];
      for (let h = 0; h < hidden.length; h++) {
        sum += hidden[h] * network.outputWeights.get(h, o);
      }
      output[o] = this.sigmoid(sum);
    }

    return output;
  }

  // Neural network backward pass
  private backwardPass(
    input: number[],
    hidden: number[],
    output: number[],
    target: number[],
    network: any,
    learningRate: number
  ): void {
    // Output layer gradients
    const outputErrors = output.map((o, i) => target[i] - o);
    const outputDeltas = outputErrors.map((err, i) => err * this.sigmoidDerivative(output[i]));

    // Hidden layer gradients
    const hiddenErrors = new Array(hidden.length).fill(0);
    for (let h = 0; h < hidden.length; h++) {
      for (let o = 0; o < output.length; o++) {
        hiddenErrors[h] += outputDeltas[o] * network.outputWeights.get(h, o);
      }
    }
    const hiddenDeltas = hiddenErrors.map((err, i) => err * this.sigmoidDerivative(hidden[i]));

    // Update output weights and biases
    for (let h = 0; h < hidden.length; h++) {
      for (let o = 0; o < output.length; o++) {
        const weight = network.outputWeights.get(h, o);
        network.outputWeights.set(h, o, weight + learningRate * outputDeltas[o] * hidden[h]);
      }
    }
    for (let o = 0; o < output.length; o++) {
      network.outputBiases[o] += learningRate * outputDeltas[o];
    }

    // Update hidden weights and biases
    for (let i = 0; i < input.length; i++) {
      for (let h = 0; h < hidden.length; h++) {
        const weight = network.hiddenWeights.get(i, h);
        network.hiddenWeights.set(i, h, weight + learningRate * hiddenDeltas[h] * input[i]);
      }
    }
    for (let h = 0; h < hidden.length; h++) {
      network.hiddenBiases[h] += learningRate * hiddenDeltas[h];
    }
  }

  // Sigmoid activation function
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  // Sigmoid derivative
  private sigmoidDerivative(x: number): number {
    return x * (1 - x);
  }

  // Generate polynomial features
  private generatePolynomialFeatures(features: number[], degree: number): number[] {
    const polyFeatures: number[] = [];

    // Original features
    polyFeatures.push(...features);

    // Degree 2 features
    if (degree >= 2) {
      // Squared terms
      for (const f of features) {
        polyFeatures.push(f * f);
      }

      // Cross terms
      for (let i = 0; i < features.length; i++) {
        for (let j = i + 1; j < features.length; j++) {
          polyFeatures.push(features[i] * features[j]);
        }
      }
    }

    return polyFeatures;
  }

  // Apply temporal smoothing
  private applyTemporalSmoothing(gazePoint: GazePoint): GazePoint {
    if (!this.temporalFilter.enabled) {
      return gazePoint;
    }

    // Add to history
    this.temporalFilter.history.push(gazePoint);

    // Keep only recent points
    if (this.temporalFilter.history.length > this.temporalFilter.windowSize) {
      this.temporalFilter.history = this.temporalFilter.history.slice(-this.temporalFilter.windowSize);
    }

    // Not enough history for smoothing
    if (this.temporalFilter.history.length < 2) {
      return gazePoint;
    }

    // Apply weighted average
    let weightedX = 0;
    let weightedY = 0;
    let totalWeight = 0;

    const history = this.temporalFilter.history;
    const weights = this.temporalFilter.weights;

    for (let i = 0; i < history.length; i++) {
      const weight = weights[i] || weights[weights.length - 1];
      weightedX += history[i].x * weight;
      weightedY += history[i].y * weight;
      totalWeight += weight;
    }

    return {
      ...gazePoint,
      x: weightedX / totalWeight,
      y: weightedY / totalWeight
    };
  }

  // Calculate prediction confidence
  private calculatePredictionConfidence(featureSet: FeatureSet, modelType: string): number {
    let confidence = featureSet.metadata.confidence;

    // Adjust based on model type
    switch (modelType) {
      case 'linear':
        confidence *= 0.9; // Linear models are generally less confident
        break;
      case 'polynomial':
        confidence *= 0.95;
        break;
      case 'neural':
        confidence *= 0.98;
        break;
      case 'ensemble':
        confidence *= 1.0; // Ensemble maintains confidence
        break;
    }

    // Adjust based on temporal consistency
    if (this.predictionHistory.length > 2) {
      const recentPredictions = this.predictionHistory.slice(-3);
      const variation = this.calculateSpatialVariation(recentPredictions);
      confidence *= Math.max(0.5, 1 - variation); // Reduce confidence if predictions are inconsistent
    }

    return Math.max(0, Math.min(1, confidence));
  }

  // Calculate spatial variation in recent predictions
  private calculateSpatialVariation(predictions: GazePoint[]): number {
    if (predictions.length < 2) return 0;

    let totalVariation = 0;
    for (let i = 1; i < predictions.length; i++) {
      const dx = predictions[i].x - predictions[i-1].x;
      const dy = predictions[i].y - predictions[i-1].y;
      totalVariation += Math.sqrt(dx * dx + dy * dy);
    }

    return totalVariation / (predictions.length - 1);
  }

  // Initialize models
  private initializeModels(): void {
    // Models will be initialized when first used
  }

  // Initialize linear model
  private initializeLinearModel(featureCount: number): void {
    this.linearWeights = {
      xBias: 0.5,
      yBias: 0.5,
      xWeights: new Array(featureCount).fill(0).map(() => (Math.random() - 0.5) * 0.01),
      yWeights: new Array(featureCount).fill(0).map(() => (Math.random() - 0.5) * 0.01)
    };
  }

  // Initialize polynomial model
  private initializePolynomialModel(featureCount: number): void {
    const polyFeatureCount = featureCount + featureCount + (featureCount * (featureCount - 1)) / 2;
    this.polynomialCoefficients = {
      xCoefficients: new Array(polyFeatureCount + 1).fill(0).map(() => (Math.random() - 0.5) * 0.01),
      yCoefficients: new Array(polyFeatureCount + 1).fill(0).map(() => (Math.random() - 0.5) * 0.01)
    };
  }

  // Initialize neural network
  private initializeNeuralNetwork(inputSize: number): void {
    const hiddenSize = Math.min(20, Math.max(5, Math.floor(inputSize / 2)));

    this.neuralNetwork = {
      hiddenWeights: Matrix.rand(inputSize, hiddenSize).sub(0.5).mul(0.1),
      outputWeights: Matrix.rand(hiddenSize, 2).sub(0.5).mul(0.1),
      hiddenBiases: new Array(hiddenSize).fill(0),
      outputBiases: new Array(2).fill(0)
    };
  }

  // Initialize ensemble model
  private initializeEnsembleModel(featureCount: number): void {
    this.initializeLinearModel(featureCount);
    this.initializePolynomialModel(featureCount);
    this.initializeNeuralNetwork(featureCount);

    this.ensembleModels = {
      linear: this.linearWeights,
      polynomial: this.polynomialCoefficients,
      neural: this.neuralNetwork,
      weights: [0.3, 0.3, 0.4] // Initial ensemble weights
    };
  }

  // Update ensemble weights based on performance
  private updateEnsembleWeights(trainingData: TrainingData): void {
    // This would typically involve cross-validation
    // For now, use simple performance-based weighting
    this.ensembleModels!.weights = [0.3, 0.3, 0.4];
  }

  // Evaluate model performance
  private evaluateModelPerformance(trainingData: TrainingData): void {
    // Calculate performance metrics on training data
    let totalError = 0;
    let errorSquareSum = 0;

    for (let i = 0; i < trainingData.features.length; i++) {
      const features = {
        combined: trainingData.features[i],
        geometric: [],
        appearance: [],
        temporal: [],
        contextual: [],
        metadata: {
          extractionTime: 0,
          featureCount: trainingData.features[i].length,
          quality: 1.0,
          confidence: 1.0,
          source: 'test',
          version: '1.0'
        }
      };

      const prediction = this.estimateGaze(features);
      if (prediction) {
        const actualGaze = trainingData.gazePoints[i];
        const dx = prediction.x - actualGaze.x;
        const dy = prediction.y - actualGaze.y;
        const error = Math.sqrt(dx * dx + dy * dy);

        totalError += error;
        errorSquareSum += error * error;
      }
    }

    const sampleCount = trainingData.features.length;
    this.performanceMetrics.averageError = totalError / sampleCount;
    this.performanceMetrics.stdDeviation = Math.sqrt(errorSquareSum / sampleCount - Math.pow(this.performanceMetrics.averageError, 2));
    this.performanceMetrics.accuracy = Math.max(0, 1 - this.performanceMetrics.averageError * 5); // Rough accuracy measure
  }

  // Add to prediction history
  private addToPredictionHistory(gazePoint: GazePoint): void {
    this.predictionHistory.push(gazePoint);

    // Keep last 100 predictions
    if (this.predictionHistory.length > 100) {
      this.predictionHistory = this.predictionHistory.slice(-100);
    }
  }

  // Configuration and utility methods
  updateConfig(newConfig: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ModelConfig {
    return { ...this.config };
  }

  getPerformanceMetrics(): ModelPerformance {
    return { ...this.performanceMetrics };
  }

  getPredictionHistory(count?: number): GazePoint[] {
    if (count) {
      return this.predictionHistory.slice(-count);
    }
    return [...this.predictionHistory];
  }

  getTrainingHistory(): TrainingData[] {
    return [...this.trainingHistory];
  }

  // Reset model state
  reset(): void {
    this.models.clear();
    this.trainingHistory = [];
    this.predictionHistory = [];
    this.temporalFilter.history = [];
    this.linearWeights = null;
    this.polynomialCoefficients = null;
    this.neuralNetwork = null;
    this.ensembleModels = null;
  }
}
