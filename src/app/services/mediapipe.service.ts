import { Injectable, inject } from '@angular/core';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { BehaviorSubject, Observable } from 'rxjs';
import { ProductionPerformanceService } from './production-performance.service';
import { MemoryPoolService } from './memory-pool.service';

export interface MediaPipePerformanceMetrics {
  averageProcessingTime: number;
  frameRate: number;
  memoryUsage: number;
  detectionQuality: 'excellent' | 'good' | 'poor';
}

export interface FaceDetectionQuality {
  faceDetected: boolean;
  landmarkCount: number;
  confidenceScore: number;
  faceBounds: { x: number, y: number, width: number, height: number } | null;
  stability: number; // 0-1
}

export interface OptimizedProcessingConfig {
  enableFrameSkipping: boolean;
  frameSkipCount: number;
  qualityLevel: number; // 0-100
  batchProcessing: boolean;
  enableMemoryPooling: boolean;
  adaptiveProcessing: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MediapipeService {
  private faceLandmarker?: FaceLandmarker;
  private lastVideoTime = -1;
  public isInitialized = false;
  
  // Inject performance services
  private performanceService = inject(ProductionPerformanceService);
  private memoryPool = inject(MemoryPoolService);
  
  // Performance tracking
  private performanceMetrics$ = new BehaviorSubject<MediaPipePerformanceMetrics | null>(null);
  private faceQuality$ = new BehaviorSubject<FaceDetectionQuality | null>(null);
  private processingTimes: number[] = [];
  private lastProcessingTime = 0;
  
  // Optimization state
  private frameSkipCounter = 0;
  private processingQueue: any[] = [];
  private isProcessing = false;
  private optimizationConfig: OptimizedProcessingConfig = {
    enableFrameSkipping: true,
    frameSkipCount: 1,
    qualityLevel: 80,
    batchProcessing: false,
    enableMemoryPooling: true,
    adaptiveProcessing: true
  };
  
  // Logging throttle variables
  private lastOptimizationLogTime: number = 0;
  private lastLoggedFrameRate: number = 0;
  private lastLoggedQuality: number = 0;
  private adaptiveOptimizationInterval?: number;
  
  // Configuration
  private config = {
    modelPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    wasmPath: './assets/wasm',
    maxFaces: 1,
    confidenceThreshold: 0.5,
    performanceMode: 'balanced' as 'fast' | 'balanced' | 'accurate'
  };

  constructor() { }

  async initialize(customConfig?: Partial<typeof this.config>): Promise<void> {
    if (this.isInitialized) return;

    // Merge custom config
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    try {
      console.log('Initializing MediaPipe FaceLandmarker with production optimizations...');
      
      const filesetResolver = await FilesetResolver.forVisionTasks(
        this.config.wasmPath
      );
      
      this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: this.config.modelPath,
          delegate: this.getOptimalDelegate()
        },
        runningMode: 'VIDEO',
        numFaces: this.config.maxFaces,
        minFaceDetectionConfidence: this.config.confidenceThreshold,
        minFacePresenceConfidence: this.config.confidenceThreshold,
        minTrackingConfidence: this.config.confidenceThreshold,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false
      });
      
      this.isInitialized = true;
      console.log('MediaPipe FaceLandmarker initialized successfully.');
      
      // Start performance monitoring and optimization
      this.startPerformanceMonitoring();
      this.startAdaptiveOptimization();
      
    } catch (error) {
      console.error('Error initializing MediaPipe FaceLandmarker:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  detectLandmarks(
    videoElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, 
    timestamp: number
  ): FaceLandmarkerResult | undefined {
    
    if (!this.faceLandmarker || !this.isInitialized) {
      console.warn('MediaPipe not initialized');
      return undefined;
    }

    // Start performance tracking
    this.performanceService.startFrameProcessing();

    // Check video element readiness
    if (videoElement instanceof HTMLVideoElement && videoElement.readyState < 2) {
      this.performanceService.endFrameProcessing();
      return undefined;
    }

    // Frame skipping optimization
    if (this.shouldSkipFrame()) {
      this.performanceService.endFrameProcessing();
      return undefined;
    }

    // Prevent duplicate processing for same frame
    if (timestamp === this.lastVideoTime) {
      this.performanceService.endFrameProcessing();
      return undefined;
    }

    const startTime = performance.now();

    try {
      // Validate video dimensions
      const videoWidth = (videoElement instanceof HTMLVideoElement) 
        ? videoElement.videoWidth 
        : videoElement.width;
      const videoHeight = (videoElement instanceof HTMLVideoElement) 
        ? videoElement.videoHeight 
        : videoElement.height;

      if (videoWidth <= 0 || videoHeight <= 0) {
        this.performanceService.endFrameProcessing();
        return undefined;
      }

      this.lastVideoTime = timestamp;

      // Get frame data using memory pool if enabled
      let frameData: any = null;
      if (this.optimizationConfig.enableMemoryPooling) {
        frameData = this.memoryPool.acquire('frame-processing');
        if (frameData && typeof frameData === 'object') {
          (frameData as any).timestamp = timestamp;
          (frameData as any).data = videoElement;
        }
      }

      // Process with quality optimization
      const detectionResult = this.processWithOptimization(videoElement, timestamp);

      // Release frame data back to pool
      if (frameData) {
        this.memoryPool.release('frame-processing', frameData);
      }

      // Record processing time
      const totalProcessingTime = performance.now() - startTime;
      this.recordProcessingTime(totalProcessingTime);
      
      // Update face quality assessment
      this.assessFaceQuality(detectionResult);

      // End performance tracking
      this.performanceService.endFrameProcessing();

      return detectionResult;
      
    } catch (error) {
      console.error('Error during landmark detection:', error);
      this.performanceService.endFrameProcessing();
      return undefined;
    }
  }

  // Process with optimization based on current settings
  private processWithOptimization(
    videoElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, 
    timestamp: number
  ): FaceLandmarkerResult | undefined {
    if (!this.faceLandmarker) return undefined;

    try {
      // Apply quality optimization if needed
      if (this.optimizationConfig.qualityLevel < 100) {
        // Reduce processing precision for performance
        return this.faceLandmarker.detectForVideo(videoElement, timestamp);
      }

      // Normal processing
      return this.faceLandmarker.detectForVideo(videoElement, timestamp);
    } catch (error) {
      console.error('Error in optimized processing:', error);
      return undefined;
    }
  }

  // Check if current frame should be skipped for performance
  private shouldSkipFrame(): boolean {
    if (!this.optimizationConfig.enableFrameSkipping) return false;

    this.frameSkipCounter++;
    if (this.frameSkipCounter >= this.optimizationConfig.frameSkipCount) {
      this.frameSkipCounter = 0;
      return false;
    }
    return true;
  }

  // Record processing time for performance tracking
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only last 30 measurements
    if (this.processingTimes.length > 30) {
      this.processingTimes = this.processingTimes.slice(-30);
    }

    // Update performance metrics
    this.updatePerformanceMetrics(time);
  }

  // Assess face detection quality
  private assessFaceQuality(result: FaceLandmarkerResult | undefined): void {
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      this.faceQuality$.next({
        faceDetected: false,
        landmarkCount: 0,
        confidenceScore: 0,
        faceBounds: null,
        stability: 0
      });
      return;
    }

    const landmarks = result.faceLandmarks[0];
    const landmarkCount = landmarks.length;
    
    // Calculate face bounds
    const xs = landmarks.map(p => p.x);
    const ys = landmarks.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const faceBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    // Calculate stability based on landmark consistency
    const stability = this.calculateLandmarkStability(landmarks);
    
    // Estimate confidence based on landmark distribution
    const confidenceScore = this.estimateDetectionConfidence(landmarks, faceBounds);

    this.faceQuality$.next({
      faceDetected: true,
      landmarkCount,
      confidenceScore,
      faceBounds,
      stability
    });
  }

  // Calculate landmark stability
  private calculateLandmarkStability(landmarks: any[]): number {
    // Simple stability calculation based on landmark count and distribution
    const expectedLandmarks = 468; // MediaPipe face landmarks
    const completeness = landmarks.length / expectedLandmarks;
    
    // Check for reasonable face proportions
    const xs = landmarks.map(p => p.x);
    const ys = landmarks.map(p => p.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const aspectRatio = width / height;
    
    // Typical face aspect ratio is around 0.7-0.9
    const aspectRatioScore = aspectRatio >= 0.6 && aspectRatio <= 1.0 ? 1.0 : 0.5;
    
    return Math.min(1.0, completeness * aspectRatioScore);
  }

  // Estimate detection confidence
  private estimateDetectionConfidence(landmarks: any[], faceBounds: any): number {
    // Base confidence on face size (larger faces are typically more reliable)
    const faceArea = faceBounds.width * faceBounds.height;
    const sizeScore = Math.min(1.0, faceArea * 10); // Normalize face area
    
    // Check landmark density
    const landmarkDensity = landmarks.length / faceArea;
    const densityScore = Math.min(1.0, landmarkDensity / 1000);
    
    return (sizeScore + densityScore) / 2;
  }

  // Start adaptive optimization based on performance metrics
  private startAdaptiveOptimization(): void {
    if (this.adaptiveOptimizationInterval) {
      clearInterval(this.adaptiveOptimizationInterval);
    }
    
    this.adaptiveOptimizationInterval = window.setInterval(() => {
      this.adaptOptimizationSettings();
    }, 2000); // Check every 2 seconds
  }

  // Stop adaptive optimization
  private stopAdaptiveOptimization(): void {
    if (this.adaptiveOptimizationInterval) {
      clearInterval(this.adaptiveOptimizationInterval);
      this.adaptiveOptimizationInterval = undefined;
    }
  }

  // Adapt optimization settings based on current performance
  private adaptOptimizationSettings(): void {
    if (!this.optimizationConfig.adaptiveProcessing) return;

    const metrics = this.performanceMetrics$.value;
    if (!metrics) return;

    // Skip optimization if no recent processing activity
    const currentTime = Date.now();
    if (currentTime - this.lastProcessingTime > 5000) {
      // No processing for 5 seconds, stop adaptive optimization
      this.stopAdaptiveOptimization();
      return;
    }

    // Adjust frame skipping based on performance
    if (metrics.frameRate < 20) {
      this.optimizationConfig.frameSkipCount = Math.min(3, this.optimizationConfig.frameSkipCount + 1);
      this.optimizationConfig.qualityLevel = Math.max(30, this.optimizationConfig.qualityLevel - 10);
    } else if (metrics.frameRate > 35) {
      this.optimizationConfig.frameSkipCount = Math.max(1, this.optimizationConfig.frameSkipCount - 1);
      this.optimizationConfig.qualityLevel = Math.min(100, this.optimizationConfig.qualityLevel + 5);
    }

    // Log optimization changes only when there's a significant change and not too frequently
    const hasSignificantChange = (
      Math.abs(metrics.frameRate - (this.lastLoggedFrameRate || 0)) > 5 ||
      Math.abs(this.optimizationConfig.qualityLevel - (this.lastLoggedQuality || 0)) > 5
    );

    if (hasSignificantChange && (currentTime - (this.lastOptimizationLogTime || 0)) > 2000) {
      console.log('Adaptive optimization update:', {
        frameRate: metrics.frameRate,
        frameSkip: this.optimizationConfig.frameSkipCount,
        quality: this.optimizationConfig.qualityLevel
      });
      this.lastOptimizationLogTime = currentTime;
      this.lastLoggedFrameRate = metrics.frameRate;
      this.lastLoggedQuality = this.optimizationConfig.qualityLevel;
    }
  }

  // Update optimization configuration
  updateOptimizationConfig(config: Partial<OptimizedProcessingConfig>): void {
    this.optimizationConfig = { ...this.optimizationConfig, ...config };
    console.log('Optimization config updated:', this.optimizationConfig);
  }

  // Get current optimization status
  getOptimizationStatus(): OptimizedProcessingConfig {
    return { ...this.optimizationConfig };
  }

  // Determine optimal delegate based on device capabilities
  private getOptimalDelegate(): 'GPU' | 'CPU' {
    // Check if WebGL is available for GPU acceleration
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl ? 'GPU' : 'CPU';
    } catch {
      return 'CPU';
    }
  }

  // Start performance monitoring
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      if (this.processingTimes.length > 0) {
        const avgTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
        const frameRate = this.processingTimes.length > 0 ? 1000 / avgTime : 0;
        
        const metrics: MediaPipePerformanceMetrics = {
          averageProcessingTime: avgTime,
          frameRate: Math.min(frameRate, 60), // Cap at 60 FPS
          memoryUsage: this.estimateMemoryUsage(),
          detectionQuality: this.categorizePerformance(avgTime)
        };
        
        this.performanceMetrics$.next(metrics);
        
        // Reset for next interval
        this.processingTimes = [];
      }
    }, 1000); // Update every second
  }

  // Update performance metrics
  private updatePerformanceMetrics(processingTime: number): void {
    this.processingTimes.push(processingTime);
    
    // Keep only last 30 measurements
    if (this.processingTimes.length > 30) {
      this.processingTimes = this.processingTimes.slice(-30);
    }
  }

  // Assess detection quality
  private assessDetectionQuality(
    result: FaceLandmarkerResult, 
    videoWidth: number, 
    videoHeight: number
  ): void {
    const hasDetection = result.faceLandmarks && result.faceLandmarks.length > 0;
    
    if (!hasDetection) {
      this.faceQuality$.next({
        faceDetected: false,
        landmarkCount: 0,
        confidenceScore: 0,
        faceBounds: null,
        stability: 0
      });
      return;
    }

    const landmarks = result.faceLandmarks[0];
    const landmarkCount = landmarks.length;
    
    // Calculate face bounds
    const xCoords = landmarks.map(l => l.x * videoWidth);
    const yCoords = landmarks.map(l => l.y * videoHeight);
    const faceBounds = {
      x: Math.min(...xCoords),
      y: Math.min(...yCoords),
      width: Math.max(...xCoords) - Math.min(...xCoords),
      height: Math.max(...yCoords) - Math.min(...yCoords)
    };
    
    // Calculate confidence score (simplified)
    const avgVisibility = landmarks
      .filter(l => l.visibility !== undefined)
      .reduce((sum, l) => sum + (l.visibility || 0), 0) / landmarks.length;
    
    const quality: FaceDetectionQuality = {
      faceDetected: true,
      landmarkCount,
      confidenceScore: avgVisibility,
      faceBounds,
      stability: this.calculateStability(landmarks)
    };
    
    this.faceQuality$.next(quality);
  }

  // Calculate face stability across frames
  private calculateStability(landmarks: any[]): number {
    // This would compare with previous frame landmarks
    // For now, return a simplified calculation
    return Math.min(1.0, landmarks.length / 468); // MediaPipe has 468 landmarks
  }

  // Estimate memory usage (simplified)
  private estimateMemoryUsage(): number {
    // This is a rough estimate
    return (performance as any).memory?.usedJSHeapSize || 0;
  }

  // Categorize performance quality
  private categorizePerformance(avgTime: number): 'excellent' | 'good' | 'poor' {
    if (avgTime < 16) return 'excellent'; // 60+ FPS
    if (avgTime < 33) return 'good';      // 30+ FPS
    return 'poor';                        // <30 FPS
  }

  // Validate detection results
  validateDetection(result: FaceLandmarkerResult): boolean {
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      return false;
    }

    const landmarks = result.faceLandmarks[0];
    
    // Check if we have minimum required landmarks
    if (landmarks.length < 400) { // MediaPipe should give 468 landmarks
      return false;
    }

    // Check if landmarks are within valid range
    const validLandmarks = landmarks.every(l => 
      l.x >= 0 && l.x <= 1 && 
      l.y >= 0 && l.y <= 1
    );

    return validLandmarks;
  }

  // Update configuration
  updateConfiguration(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('MediaPipe configuration updated:', this.config);
  }

  // Get current configuration
  getConfiguration(): typeof this.config {
    return { ...this.config };
  }

  // Cleanup method for component destruction
  cleanup(): void {
    this.stopAdaptiveOptimization();
    this.processingTimes = [];
    this.lastProcessingTime = 0;
    this.lastOptimizationLogTime = 0;
    this.lastLoggedFrameRate = 0;
    this.lastLoggedQuality = 0;
    console.log('MediaPipe service cleaned up');
  }

  // Observable getters
  get performanceMetrics(): Observable<MediaPipePerformanceMetrics | null> {
    return this.performanceMetrics$.asObservable();
  }

  get faceQuality(): Observable<FaceDetectionQuality | null> {
    return this.faceQuality$.asObservable();
  }

  // Getters
  get initialized(): boolean {
    return this.isInitialized;
  }

  close(): void {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = undefined;
    }
    
    this.isInitialized = false;
    this.lastVideoTime = -1;
    this.processingTimes = [];
    
    // Reset observables
    this.performanceMetrics$.next(null);
    this.faceQuality$.next(null);
    
    console.log('MediaPipe FaceLandmarker closed.');
  }
}
