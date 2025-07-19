import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, animationFrameScheduler } from 'rxjs';
import { throttleTime, map, filter } from 'rxjs/operators';
import { PerformanceService } from './performance.service';
import { ErrorHandlerService } from './error-handler.service';

export interface ProcessingPipeline {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  maxExecutionTime: number; // ms
  lastExecutionTime: number;
  skipFrames: number; // Skip N frames between executions
  frameCounter: number;
}

export interface FrameBuffer {
  timestamp: number;
  data: any;
  processed: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface RealTimeMetrics {
  frameRate: number;
  averageLatency: number;
  droppedFrames: number;
  processingLoad: number; // 0-100%
  memoryUsage: number;
  queueLength: number;
  adaptiveQuality: number; // 0-100%
}

export interface AdaptiveSettings {
  targetFPS: number;
  maxLatency: number; // ms
  qualityThreshold: number; // 0-1
  adaptiveQualityEnabled: boolean;
  frameSkippingEnabled: boolean;
  prioritizedProcessing: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RealTimeProcessingService {
  private frameBuffer: FrameBuffer[] = [];
  private processingQueue: ProcessingPipeline[] = [];
  private isProcessing = false;
  private animationFrameId: number | null = null;

  // Real-time metrics
  private metrics$ = new BehaviorSubject<RealTimeMetrics>({
    frameRate: 0,
    averageLatency: 0,
    droppedFrames: 0,
    processingLoad: 0,
    memoryUsage: 0,
    queueLength: 0,
    adaptiveQuality: 100
  });

  // Adaptive settings
  private settings: AdaptiveSettings = {
    targetFPS: 30,
    maxLatency: 33, // ~30 FPS
    qualityThreshold: 0.7,
    adaptiveQualityEnabled: true,
    frameSkippingEnabled: true,
    prioritizedProcessing: true
  };

  // Performance tracking
  private frameCount = 0;
  private lastFrameTime = 0;
  private processingTimes: number[] = [];
  private droppedFrameCount = 0;
  private processingStartTime = 0;

  // Worker support for offloading
  private webWorker: Worker | null = null;
  private webWorkerSupported = false;

  constructor(
    private performanceService: PerformanceService,
    private errorHandler: ErrorHandlerService
  ) {
    this.initializeRealTimeProcessing();
    this.setupWebWorker();
    this.startMetricsCollection();
  }

  // Initialize real-time processing system
  private initializeRealTimeProcessing(): void {
    // Setup default processing pipelines
    this.registerPipeline({
      id: 'face-detection',
      name: 'Face Detection',
      enabled: true,
      priority: 1,
      maxExecutionTime: 16, // ~60 FPS
      lastExecutionTime: 0,
      skipFrames: 0,
      frameCounter: 0
    });

    this.registerPipeline({
      id: 'feature-extraction',
      name: 'Feature Extraction',
      enabled: true,
      priority: 2,
      maxExecutionTime: 8,
      lastExecutionTime: 0,
      skipFrames: 0,
      frameCounter: 0
    });

    this.registerPipeline({
      id: 'gaze-estimation',
      name: 'Gaze Estimation',
      enabled: true,
      priority: 3,
      maxExecutionTime: 5,
      lastExecutionTime: 0,
      skipFrames: 0,
      frameCounter: 0
    });

    this.registerPipeline({
      id: 'calibration',
      name: 'Calibration Processing',
      enabled: false,
      priority: 4,
      maxExecutionTime: 10,
      lastExecutionTime: 0,
      skipFrames: 1, // Process every other frame
      frameCounter: 0
    });

    console.log('Real-time processing system initialized');
  }

  // Setup Web Worker for background processing
  private setupWebWorker(): void {
    try {
      if (typeof Worker !== 'undefined') {
        // Create worker for heavy processing tasks
        const workerScript = `
          self.addEventListener('message', function(e) {
            const { type, data } = e.data;
            
            switch(type) {
              case 'processFeatures':
                // Simulate feature processing
                const result = self.processFeatures(data);
                self.postMessage({ type: 'featuresProcessed', result });
                break;
              case 'processGaze':
                // Simulate gaze processing
                const gazeResult = self.processGaze(data);
                self.postMessage({ type: 'gazeProcessed', result: gazeResult });
                break;
            }
          });

          self.processFeatures = function(data) {
            // Placeholder for actual feature processing
            return { processed: true, timestamp: Date.now() };
          };

          self.processGaze = function(data) {
            // Placeholder for actual gaze processing
            return { x: Math.random(), y: Math.random(), timestamp: Date.now() };
          };
        `;

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        this.webWorker = new Worker(URL.createObjectURL(blob));
        
        this.webWorker.onmessage = (e) => {
          this.handleWorkerMessage(e.data);
        };

        this.webWorkerSupported = true;
        console.log('Web Worker initialized for background processing');
      }
    } catch (error) {
      this.errorHandler.logError('general', 'Failed to initialize Web Worker', 'warning', error);
      this.webWorkerSupported = false;
    }
  }

  // Handle messages from Web Worker
  private handleWorkerMessage(data: any): void {
    const { type, result } = data;
    
    switch (type) {
      case 'featuresProcessed':
        // Handle processed features
        break;
      case 'gazeProcessed':
        // Handle processed gaze data
        break;
    }
  }

  // Start metrics collection
  private startMetricsCollection(): void {
    // Update metrics every 100ms
    setInterval(() => {
      this.updateMetrics();
    }, 100);

    // Monitor system performance
    this.performanceService.systemPerformance.subscribe((perf: any) => {
      this.adaptToPerformance(perf);
    });
  }

  // Register a processing pipeline
  registerPipeline(pipeline: ProcessingPipeline): void {
    const existingIndex = this.processingQueue.findIndex(p => p.id === pipeline.id);
    if (existingIndex >= 0) {
      this.processingQueue[existingIndex] = pipeline;
    } else {
      this.processingQueue.push(pipeline);
    }
    
    // Sort by priority
    this.processingQueue.sort((a, b) => a.priority - b.priority);
    
    console.log(`Pipeline '${pipeline.name}' registered with priority ${pipeline.priority}`);
  }

  // Process frame with real-time optimizations
  async processFrame(frameData: any, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<any> {
    const timestamp = performance.now();
    
    // Check if we should drop frames for performance
    if (this.shouldDropFrame()) {
      this.droppedFrameCount++;
      return null;
    }

    // Add to frame buffer
    const frame: FrameBuffer = {
      timestamp,
      data: frameData,
      processed: false,
      priority
    };

    this.frameBuffer.push(frame);

    // Limit buffer size
    if (this.frameBuffer.length > 5) {
      this.frameBuffer.shift(); // Remove oldest frame
    }

    // Process if not already processing
    if (!this.isProcessing) {
      return this.processNextFrame();
    }

    return null;
  }

  // Process next frame in buffer
  private async processNextFrame(): Promise<any> {
    if (this.frameBuffer.length === 0 || this.isProcessing) {
      return null;
    }

    this.isProcessing = true;
    this.processingStartTime = performance.now();

    try {
      // Get highest priority frame
      const frame = this.getHighestPriorityFrame();
      if (!frame) {
        this.isProcessing = false;
        return null;
      }

      // Process through pipelines
      let result = frame.data;
      
      for (const pipeline of this.processingQueue) {
        if (!pipeline.enabled) continue;
        
        // Check if should skip this frame for this pipeline
        if (this.shouldSkipPipeline(pipeline)) {
          continue;
        }

        const pipelineStart = performance.now();
        
        try {
          // Process based on pipeline type
          result = await this.executePipeline(pipeline, result);
          
          const pipelineTime = performance.now() - pipelineStart;
          pipeline.lastExecutionTime = pipelineTime;
          
          // Check if pipeline is taking too long
          if (pipelineTime > pipeline.maxExecutionTime) {
            console.warn(`Pipeline '${pipeline.name}' exceeded max execution time: ${pipelineTime}ms`);
            
            // Adapt pipeline settings
            if (this.settings.adaptiveQualityEnabled) {
              this.adaptPipelinePerformance(pipeline);
            }
          }
          
        } catch (error) {
          this.errorHandler.logError('general', `Pipeline '${pipeline.name}' failed`, 'warning', error);
          continue;
        }
      }

      frame.processed = true;
      const processingTime = performance.now() - this.processingStartTime;
      this.recordProcessingTime(processingTime);

      return result;

    } catch (error) {
      this.errorHandler.logError('general', 'Frame processing failed', 'error', error);
      return null;
    } finally {
      this.isProcessing = false;
      this.frameCount++;
      
      // Continue processing if more frames in buffer
      if (this.frameBuffer.length > 0) {
        // Use setTimeout to avoid blocking
        setTimeout(() => this.processNextFrame(), 0);
      }
    }
  }

  // Execute specific pipeline
  private async executePipeline(pipeline: ProcessingPipeline, data: any): Promise<any> {
    switch (pipeline.id) {
      case 'face-detection':
        return this.processFaceDetection(data);
      case 'feature-extraction':
        return this.processFeatureExtraction(data);
      case 'gaze-estimation':
        return this.processGazeEstimation(data);
      case 'calibration':
        return this.processCalibration(data);
      default:
        return data;
    }
  }

  // Process face detection
  private async processFaceDetection(data: any): Promise<any> {
    // Simulate face detection processing
    await this.simulateProcessing(5); // 5ms processing time
    return { ...data, faceDetected: true, landmarks: [] };
  }

  // Process feature extraction
  private async processFeatureExtraction(data: any): Promise<any> {
    // Use Web Worker if available for heavy processing
    if (this.webWorkerSupported && this.webWorker) {
      return new Promise((resolve) => {
        this.webWorker!.postMessage({ type: 'processFeatures', data });
        // For now, resolve immediately - in real implementation, wait for worker response
        resolve({ ...data, features: [] });
      });
    }
    
    await this.simulateProcessing(3);
    return { ...data, features: [] };
  }

  // Process gaze estimation
  private async processGazeEstimation(data: any): Promise<any> {
    await this.simulateProcessing(2);
    return { 
      ...data, 
      gaze: { 
        x: Math.random(), 
        y: Math.random(), 
        confidence: 0.8 
      } 
    };
  }

  // Process calibration
  private async processCalibration(data: any): Promise<any> {
    await this.simulateProcessing(8);
    return { ...data, calibrationProcessed: true };
  }

  // Simulate processing time
  private simulateProcessing(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get highest priority frame from buffer
  private getHighestPriorityFrame(): FrameBuffer | null {
    if (this.frameBuffer.length === 0) return null;
    
    const priorities = { high: 3, medium: 2, low: 1 };
    
    this.frameBuffer.sort((a, b) => {
      if (priorities[a.priority] !== priorities[b.priority]) {
        return priorities[b.priority] - priorities[a.priority];
      }
      return b.timestamp - a.timestamp; // Newer frames first
    });
    
    return this.frameBuffer.shift() || null;
  }

  // Check if frame should be dropped
  private shouldDropFrame(): boolean {
    if (!this.settings.frameSkippingEnabled) return false;
    
    const currentMetrics = this.metrics$.value;
    
    // Drop frame if processing load is too high
    if (currentMetrics.processingLoad > 90) return true;
    
    // Drop frame if queue is too long
    if (currentMetrics.queueLength > 3) return true;
    
    // Drop frame if average latency is too high
    if (currentMetrics.averageLatency > this.settings.maxLatency * 2) return true;
    
    return false;
  }

  // Check if pipeline should be skipped for this frame
  private shouldSkipPipeline(pipeline: ProcessingPipeline): boolean {
    pipeline.frameCounter++;
    
    if (pipeline.skipFrames > 0) {
      if (pipeline.frameCounter <= pipeline.skipFrames) {
        return true;
      } else {
        pipeline.frameCounter = 0; // Reset counter
      }
    }
    
    return false;
  }

  // Adapt pipeline performance based on timing
  private adaptPipelinePerformance(pipeline: ProcessingPipeline): void {
    if (!this.settings.adaptiveQualityEnabled) return;
    
    // Increase skip frames if pipeline is slow
    if (pipeline.lastExecutionTime > pipeline.maxExecutionTime * 1.5) {
      pipeline.skipFrames = Math.min(pipeline.skipFrames + 1, 3);
    } else if (pipeline.lastExecutionTime < pipeline.maxExecutionTime * 0.5) {
      pipeline.skipFrames = Math.max(pipeline.skipFrames - 1, 0);
    }
    
    console.log(`Adapted pipeline '${pipeline.name}': skip frames = ${pipeline.skipFrames}`);
  }

  // Adapt to overall system performance
  private adaptToPerformance(performance: any): void {
    if (!this.settings.adaptiveQualityEnabled) return;
    
    const currentMetrics = this.metrics$.value;
    
    // Adjust target FPS based on system performance
    if (performance.status === 'excellent') {
      this.settings.targetFPS = Math.min(60, this.settings.targetFPS + 5);
    } else if (performance.status === 'poor') {
      this.settings.targetFPS = Math.max(15, this.settings.targetFPS - 5);
    }
    
    // Adjust quality based on frame rate
    if (currentMetrics.frameRate < this.settings.targetFPS * 0.8) {
      const newQuality = Math.max(50, currentMetrics.adaptiveQuality - 10);
      this.updateAdaptiveQuality(newQuality);
    } else if (currentMetrics.frameRate > this.settings.targetFPS * 1.1) {
      const newQuality = Math.min(100, currentMetrics.adaptiveQuality + 5);
      this.updateAdaptiveQuality(newQuality);
    }
  }

  // Update adaptive quality setting
  private updateAdaptiveQuality(quality: number): void {
    const currentMetrics = this.metrics$.value;
    this.metrics$.next({
      ...currentMetrics,
      adaptiveQuality: quality
    });
    
    // Adjust pipeline settings based on quality
    this.processingQueue.forEach(pipeline => {
      if (quality < 70) {
        pipeline.skipFrames = Math.min(pipeline.skipFrames + 1, 2);
      } else if (quality > 90) {
        pipeline.skipFrames = Math.max(pipeline.skipFrames - 1, 0);
      }
    });
  }

  // Record processing time for metrics
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only last 100 measurements
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
  }

  // Update real-time metrics
  private updateMetrics(): void {
    const now = performance.now();
    const timeDelta = now - this.lastFrameTime;
    
    if (timeDelta > 0) {
      const frameRate = this.frameCount > 0 ? (this.frameCount / (timeDelta / 1000)) : 0;
      const averageLatency = this.processingTimes.length > 0 
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length 
        : 0;
      
      const processingLoad = Math.min(100, (averageLatency / 16) * 100); // 16ms = 60fps target
      
      this.metrics$.next({
        frameRate: Math.round(frameRate),
        averageLatency: Math.round(averageLatency * 100) / 100,
        droppedFrames: this.droppedFrameCount,
        processingLoad: Math.round(processingLoad),
        memoryUsage: this.getMemoryUsage(),
        queueLength: this.frameBuffer.length,
        adaptiveQuality: this.metrics$.value.adaptiveQuality
      });
    }
    
    this.lastFrameTime = now;
    this.frameCount = 0; // Reset for next interval
  }

  // Get memory usage estimate
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100);
    }
    return 0;
  }

  // Public API methods

  // Get real-time metrics observable
  getMetrics(): Observable<RealTimeMetrics> {
    return this.metrics$.asObservable();
  }

  // Get current settings
  getSettings(): AdaptiveSettings {
    return { ...this.settings };
  }

  // Update settings
  updateSettings(newSettings: Partial<AdaptiveSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('Real-time processing settings updated', this.settings);
  }

  // Enable/disable pipeline
  setPipelineEnabled(pipelineId: string, enabled: boolean): void {
    const pipeline = this.processingQueue.find(p => p.id === pipelineId);
    if (pipeline) {
      pipeline.enabled = enabled;
      console.log(`Pipeline '${pipeline.name}' ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  // Set pipeline priority
  setPipelinePriority(pipelineId: string, priority: number): void {
    const pipeline = this.processingQueue.find(p => p.id === pipelineId);
    if (pipeline) {
      pipeline.priority = priority;
      this.processingQueue.sort((a, b) => a.priority - b.priority);
      console.log(`Pipeline '${pipeline.name}' priority set to ${priority}`);
    }
  }

  // Get pipeline status
  getPipelineStatus(): ProcessingPipeline[] {
    return [...this.processingQueue];
  }

  // Clear frame buffer
  clearBuffer(): void {
    this.frameBuffer = [];
    console.log('Frame buffer cleared');
  }

  // Start real-time processing
  start(): void {
    if (this.animationFrameId) return;
    
    const processLoop = () => {
      if (this.frameBuffer.length > 0 && !this.isProcessing) {
        this.processNextFrame();
      }
      this.animationFrameId = requestAnimationFrame(processLoop);
    };
    
    processLoop();
    console.log('Real-time processing started');
  }

  // Stop real-time processing
  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.clearBuffer();
    this.isProcessing = false;
    console.log('Real-time processing stopped');
  }

  // Cleanup
  destroy(): void {
    this.stop();
    
    if (this.webWorker) {
      this.webWorker.terminate();
      this.webWorker = null;
    }
    
    console.log('Real-time processing service destroyed');
  }
}
