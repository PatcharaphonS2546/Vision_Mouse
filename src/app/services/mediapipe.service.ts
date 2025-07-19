import { Injectable } from '@angular/core';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { BehaviorSubject, Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class MediapipeService {
  private faceLandmarker?: FaceLandmarker;
  private lastVideoTime = -1;
  public isInitialized = false;
  
  // Performance tracking
  private performanceMetrics$ = new BehaviorSubject<MediaPipePerformanceMetrics | null>(null);
  private faceQuality$ = new BehaviorSubject<FaceDetectionQuality | null>(null);
  private processingTimes: number[] = [];
  private lastProcessingTime = 0;
  
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
      console.log('Initializing MediaPipe FaceLandmarker...');
      
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
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
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

    // Check video element readiness
    if (videoElement instanceof HTMLVideoElement && videoElement.readyState < 2) {
      return undefined;
    }

    // Prevent duplicate processing for same frame
    if (timestamp === this.lastVideoTime) {
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
        return undefined;
      }

      this.lastVideoTime = timestamp;
      const result = this.faceLandmarker.detectForVideo(videoElement, timestamp);
      
      // Track performance
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(processingTime);
      
      // Assess detection quality
      this.assessDetectionQuality(result, videoWidth, videoHeight);
      
      return result;
      
    } catch (error) {
      console.error('Error during landmark detection:', error);
      return undefined;
    }
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
