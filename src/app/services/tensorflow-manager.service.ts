import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

export interface TensorFlowConfig {
  backend: 'webgl' | 'cpu' | 'auto';
  enableProfiling: boolean;
  modelCacheSize: number;
  memoryLimit?: number;
}

export interface ModelArchitecture {
  type: 'sequential' | 'functional';
  layers: LayerConfig[];
  compilation: CompilationConfig;
}

export interface LayerConfig {
  type: string;
  config: any;
  inputShape?: number[];
}

export interface CompilationConfig {
  optimizer: string | any;
  loss: string | any;
  metrics: string[];
  learningRate?: number;
}

export class TensorFlowManager {
  private static instance: TensorFlowManager;
  private isInitialized = false;
  private backend: string = 'webgl';
  private models = new Map<string, tf.LayersModel>();
  private config: TensorFlowConfig;

  constructor(config: Partial<TensorFlowConfig> = {}) {
    this.config = {
      backend: 'auto',
      enableProfiling: false,
      modelCacheSize: 10,
      ...config
    };
  }

  static getInstance(config?: Partial<TensorFlowConfig>): TensorFlowManager {
    if (!TensorFlowManager.instance) {
      TensorFlowManager.instance = new TensorFlowManager(config);
    }
    return TensorFlowManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing TensorFlow.js...');

      // Try to set optimal backend
      if (this.config.backend === 'auto') {
        await this.initializeOptimalBackend();
      } else {
        await tf.setBackend(this.config.backend);
      }

      await tf.ready();
      
      this.backend = tf.getBackend();
      this.isInitialized = true;

      console.log(`TensorFlow.js initialized with ${this.backend} backend`);
      console.log(`TensorFlow.js version: ${tf.version.tfjs}`);

      // Set memory management
      if (this.config.memoryLimit) {
        tf.env().set('WEBGL_CPU_FORWARD', false);
        tf.env().set('WEBGL_PACK', true);
      }

      // Enable profiling if requested
      if (this.config.enableProfiling) {
        tf.env().set('DEBUG', true);
      }

    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
      throw error;
    }
  }

  private async initializeOptimalBackend(): Promise<void> {
    // Try WebGL first (best performance for neural networks)
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('Using WebGL backend for optimal performance');
      return;
    } catch (error) {
      console.warn('WebGL backend not available, trying CPU:', error);
    }

    // Fall back to CPU
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      console.log('Using CPU backend');
      return;
    } catch (error) {
      throw new Error('No TensorFlow.js backend available');
    }
  }

  async createModel(architecture: ModelArchitecture, modelId: string): Promise<tf.LayersModel> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`Creating TensorFlow.js model: ${modelId}`);

      let model: tf.LayersModel;

      if (architecture.type === 'sequential') {
        model = this.createSequentialModel(architecture);
      } else {
        model = this.createFunctionalModel(architecture);
      }

      // Compile the model
      const optimizer = this.createOptimizer(architecture.compilation);
      
      model.compile({
        optimizer: optimizer,
        loss: architecture.compilation.loss,
        metrics: architecture.compilation.metrics
      });

      // Cache the model
      this.models.set(modelId, model);

      console.log(`Model ${modelId} created and compiled successfully`);
      return model;

    } catch (error) {
      console.error(`Failed to create model ${modelId}:`, error);
      throw error;
    }
  }

  private createSequentialModel(architecture: ModelArchitecture): tf.Sequential {
    const model = tf.sequential();

    architecture.layers.forEach((layerConfig, index) => {
      const layer = this.createLayer(layerConfig, index === 0);
      model.add(layer);
    });

    return model;
  }

  private createFunctionalModel(architecture: ModelArchitecture): tf.LayersModel {
    // Simplified functional model creation
    // For complex architectures, this would need more sophisticated implementation
    throw new Error('Functional models not yet implemented');
  }

  private createLayer(config: LayerConfig, isFirst: boolean): tf.layers.Layer {
    const layerConfig = { ...config.config };

    // Add input shape to first layer
    if (isFirst && config.inputShape) {
      layerConfig.inputShape = config.inputShape;
    }

    switch (config.type) {
      case 'dense':
        return tf.layers.dense(layerConfig);
      
      case 'conv1d':
        return tf.layers.conv1d(layerConfig);
      
      case 'conv2d':
        return tf.layers.conv2d(layerConfig);
      
      case 'lstm':
        return tf.layers.lstm(layerConfig);
      
      case 'gru':
        return tf.layers.gru(layerConfig);
      
      case 'dropout':
        return tf.layers.dropout(layerConfig);
      
      case 'batchNormalization':
        return tf.layers.batchNormalization(layerConfig);
      
      case 'maxPooling1d':
        return tf.layers.maxPooling1d(layerConfig);
      
      case 'maxPooling2d':
        return tf.layers.maxPooling2d(layerConfig);
      
      case 'globalMaxPooling1d':
        return tf.layers.globalMaxPooling1d(layerConfig);
      
      case 'globalMaxPooling2d':
        return tf.layers.globalMaxPooling2d(layerConfig);
      
      case 'flatten':
        return tf.layers.flatten(layerConfig);
      
      case 'reshape':
        return tf.layers.reshape(layerConfig);
      
      default:
        throw new Error(`Unsupported layer type: ${config.type}`);
    }
  }

  private createOptimizer(compilation: CompilationConfig): tf.Optimizer {
    const lr = compilation.learningRate || 0.001;

    switch (compilation.optimizer) {
      case 'adam':
        return tf.train.adam(lr);
      
      case 'sgd':
        return tf.train.sgd(lr);
      
      case 'rmsprop':
        return tf.train.rmsprop(lr);
      
      case 'adagrad':
        return tf.train.adagrad(lr);
      
      default:
        if (typeof compilation.optimizer === 'object') {
          return compilation.optimizer;
        }
        return tf.train.adam(lr);
    }
  }

  async loadModel(modelPath: string, modelId: string): Promise<tf.LayersModel> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`Loading model from: ${modelPath}`);
      
      const model = await tf.loadLayersModel(modelPath);
      this.models.set(modelId, model);
      
      console.log(`Model ${modelId} loaded successfully`);
      return model;

    } catch (error) {
      console.error(`Failed to load model ${modelId}:`, error);
      throw error;
    }
  }

  async saveModel(modelId: string, savePath: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    try {
      await model.save(savePath);
      console.log(`Model ${modelId} saved to: ${savePath}`);
    } catch (error) {
      console.error(`Failed to save model ${modelId}:`, error);
      throw error;
    }
  }

  getModel(modelId: string): tf.LayersModel | undefined {
    return this.models.get(modelId);
  }

  disposeModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (model) {
      model.dispose();
      this.models.delete(modelId);
      console.log(`Model ${modelId} disposed`);
    }
  }

  disposeAllModels(): void {
    this.models.forEach((model, id) => {
      model.dispose();
      console.log(`Model ${id} disposed`);
    });
    this.models.clear();
  }

  getBackend(): string {
    return this.backend;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getMemoryInfo(): any {
    return tf.memory();
  }

  cleanupMemory(): void {
    tf.dispose();
    console.log('TensorFlow.js memory cleaned up');
  }

  // Pre-defined model architectures for gaze estimation
  static getGazeEstimationCNN(): ModelArchitecture {
    return {
      type: 'sequential',
      layers: [
        {
          type: 'conv1d',
          config: {
            filters: 64,
            kernelSize: 3,
            activation: 'relu',
            padding: 'same'
          },
          inputShape: [468, 3] // 468 facial landmarks with x,y,z
        },
        {
          type: 'batchNormalization',
          config: {}
        },
        {
          type: 'conv1d',
          config: {
            filters: 128,
            kernelSize: 3,
            activation: 'relu',
            padding: 'same'
          }
        },
        {
          type: 'batchNormalization',
          config: {}
        },
        {
          type: 'globalMaxPooling1d',
          config: {}
        },
        {
          type: 'dense',
          config: {
            units: 256,
            activation: 'relu'
          }
        },
        {
          type: 'dropout',
          config: {
            rate: 0.3
          }
        },
        {
          type: 'dense',
          config: {
            units: 128,
            activation: 'relu'
          }
        },
        {
          type: 'dropout',
          config: {
            rate: 0.2
          }
        },
        {
          type: 'dense',
          config: {
            units: 2,
            activation: 'linear'
          }
        }
      ],
      compilation: {
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae'],
        learningRate: 0.001
      }
    };
  }

  static getAttentionLSTM(): ModelArchitecture {
    return {
      type: 'sequential',
      layers: [
        {
          type: 'lstm',
          config: {
            units: 128,
            returnSequences: true,
            dropout: 0.2,
            recurrentDropout: 0.2
          },
          inputShape: [10, 468 * 3] // 10 frame sequence
        },
        {
          type: 'lstm',
          config: {
            units: 64,
            dropout: 0.2,
            recurrentDropout: 0.2
          }
        },
        {
          type: 'dense',
          config: {
            units: 64,
            activation: 'relu'
          }
        },
        {
          type: 'dropout',
          config: {
            rate: 0.3
          }
        },
        {
          type: 'dense',
          config: {
            units: 2,
            activation: 'linear'
          }
        }
      ],
      compilation: {
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae'],
        learningRate: 0.0005
      }
    };
  }

  static getEnsembleModel(): ModelArchitecture {
    return {
      type: 'sequential',
      layers: [
        {
          type: 'dense',
          config: {
            units: 128,
            activation: 'relu'
          },
          inputShape: [4] // Combined predictions from other models
        },
        {
          type: 'dropout',
          config: {
            rate: 0.2
          }
        },
        {
          type: 'dense',
          config: {
            units: 64,
            activation: 'relu'
          }
        },
        {
          type: 'dense',
          config: {
            units: 2,
            activation: 'linear'
          }
        }
      ],
      compilation: {
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae'],
        learningRate: 0.001
      }
    };
  }
}
