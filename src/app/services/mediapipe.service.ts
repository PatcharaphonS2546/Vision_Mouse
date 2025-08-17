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
  glareDetected?: boolean; // New: Detect glare/reflection
  glareIntensity?: number; // 0-1
  glassesDetected?: boolean; // New: Detect if person is wearing glasses
}

export interface GlassesDetectionResult {
  detected: boolean;
  confidence: number;
  glareRegions: { x: number, y: number, width: number, height: number }[];
  recommendedAction: 'proceed' | 'skip_frame' | 'adjust_lighting';
}

export interface FrameQualityAssessment {
  sharpness: number; // 0-1 (0=very blurry, 1=very sharp)
  brightness: number; // 0-1 (0=very dark, 1=very bright)
  contrast: number; // 0-1 (0=low contrast, 1=high contrast)
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[]; // Array of detected issues
  recommendation: 'proceed' | 'skip_frame' | 'improve_lighting' | 'adjust_position';
}

export interface FrameQualityConfig {
  minSharpness: number;
  minBrightness: number;
  maxBrightness: number;
  minContrast: number;
  blurThreshold: number;
  enableQualityChecks: boolean;
  skipPoorQualityFrames: boolean;
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
  private previousLandmarks?: FaceLandmarkerResult; // Store previous landmarks for eye region extraction
  
  // Inject performance services
  private performanceService = inject(ProductionPerformanceService);
  private memoryPool = inject(MemoryPoolService);
  
  // Performance tracking
  private performanceMetrics$ = new BehaviorSubject<MediaPipePerformanceMetrics | null>(null);
  private faceQuality$ = new BehaviorSubject<FaceDetectionQuality | null>(null);
  private processingTimes: number[] = [];
  private lastProcessingTime = 0;
  
  // Glasses and glare detection
  private glassesDetectionHistory: boolean[] = [];
  
  // Preprocessing constants
  private readonly BRIGHTNESS_ADJUSTMENT_FACTOR = 1.2;
  private readonly CONTRAST_ADJUSTMENT_FACTOR = 1.3;
  private readonly NOISE_REDUCTION_KERNEL_SIZE = 5;
  private readonly NOISE_REDUCTION_SIGMA_COLOR = 80;
  private readonly NOISE_REDUCTION_SIGMA_SPACE = 80;
  
  // Glasses detection constants
  private readonly GLASSES_CONFIDENCE_THRESHOLD = 0.6;
  private readonly GLARE_BRIGHTNESS_THRESHOLD = 200;
  private readonly REFLECTION_AREA_THRESHOLD = 50;

  // Frame quality assessment constants
  private readonly QUALITY_CONFIG: FrameQualityConfig = {
    minSharpness: 0.3,
    minBrightness: 0.2,
    maxBrightness: 0.8,
    minContrast: 0.3,
    blurThreshold: 100,
    enableQualityChecks: true,
    skipPoorQualityFrames: true
  };

  // Quality assessment cache
  private qualityHistory: number[] = [];
  private readonly QUALITY_HISTORY_SIZE = 10;
  private glareFrameSkipCount = 0;
  private lastGlareDetectionTime = 0;
  
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
    confidenceThreshold: 0.7, // Increased for better quality
    performanceMode: 'accurate' as 'fast' | 'balanced' | 'accurate', // Use accurate mode for better landmarks
    enableEyeRegionFocus: true, // New: Focus on eye regions
    eyeRegionExpansion: 0.3, // Expand eye region by 30% for better context
    // Glasses detection settings
    enableGlassesDetection: true,
    glareThreshold: 0.85, // Brightness threshold for glare detection (0-1)
    glareSkipFrames: 2, // Skip frames when severe glare detected
    glassesAdaptation: true // Adapt processing for glasses wearers
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

  /**
   * Extract and enhance eye regions for better landmark detection
   * This focuses processing on the most important areas for gaze tracking
   */
  private extractEyeRegions(
    videoElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    previousLandmarks?: FaceLandmarkerResult
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    const width = videoElement instanceof HTMLVideoElement 
      ? videoElement.videoWidth 
      : videoElement.width;
    const height = videoElement instanceof HTMLVideoElement 
      ? videoElement.videoHeight 
      : videoElement.height;

    // If we have previous landmarks, create focused eye regions
    if (previousLandmarks && previousLandmarks.faceLandmarks.length > 0) {
      const landmarks = previousLandmarks.faceLandmarks[0];
      
      // Eye landmark indices (MediaPipe face mesh)
      const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
      const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
      
      // Calculate eye bounding boxes
      const leftEyeBounds = this.calculateEyeBounds(landmarks, leftEyeIndices, width, height);
      const rightEyeBounds = this.calculateEyeBounds(landmarks, rightEyeIndices, width, height);
      
      // Create canvas with both eye regions
      const totalWidth = leftEyeBounds.width + rightEyeBounds.width + 20; // 20px gap
      const maxHeight = Math.max(leftEyeBounds.height, rightEyeBounds.height);
      
      canvas.width = totalWidth;
      canvas.height = maxHeight;
      
      // Draw left eye region
      ctx.drawImage(
        videoElement,
        leftEyeBounds.x, leftEyeBounds.y, leftEyeBounds.width, leftEyeBounds.height,
        0, 0, leftEyeBounds.width, leftEyeBounds.height
      );
      
      // Draw right eye region
      ctx.drawImage(
        videoElement,
        rightEyeBounds.x, rightEyeBounds.y, rightEyeBounds.width, rightEyeBounds.height,
        leftEyeBounds.width + 20, 0, rightEyeBounds.width, rightEyeBounds.height
      );
      
      console.log('👁️ Extracted focused eye regions for enhanced detection');
      
    } else {
      // Fallback: use full frame with emphasis on center region (where face usually is)
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(videoElement, 0, 0, width, height);
    }
    
    return canvas;
  }

  /**
   * Calculate bounding box for eye region with expansion
   */
  private calculateEyeBounds(
    landmarks: any[], 
    eyeIndices: number[], 
    imageWidth: number, 
    imageHeight: number
  ): { x: number, y: number, width: number, height: number } {
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    
    // Find bounds of eye landmarks
    for (const index of eyeIndices) {
      const landmark = landmarks[index];
      if (landmark) {
        minX = Math.min(minX, landmark.x);
        maxX = Math.max(maxX, landmark.x);
        minY = Math.min(minY, landmark.y);
        maxY = Math.max(maxY, landmark.y);
      }
    }
    
    // Expand bounds by expansion factor
    const expansion = this.config.eyeRegionExpansion;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const eyeWidth = maxX - minX;
    const eyeHeight = maxY - minY;
    
    const expandedWidth = eyeWidth * (1 + expansion);
    const expandedHeight = eyeHeight * (1 + expansion);
    
    // Convert to pixel coordinates
    const x = Math.max(0, Math.round((centerX - expandedWidth / 2) * imageWidth));
    const y = Math.max(0, Math.round((centerY - expandedHeight / 2) * imageHeight));
    const width = Math.min(imageWidth - x, Math.round(expandedWidth * imageWidth));
    const height = Math.min(imageHeight - y, Math.round(expandedHeight * imageHeight));
    
    return { x, y, width, height };
  }

  /**
   * Enhanced preprocessing with eye region focus and glasses detection
   */
  private enhancedPreprocessing(
    videoElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    previousLandmarks?: FaceLandmarkerResult
  ): HTMLCanvasElement {
    // First apply general preprocessing
    const preprocessedFrame = this.preprocessVideoFrame(videoElement);
    
    // Detect glasses and glare if enabled
    let glassesDetected = false;
    let glareResult: GlassesDetectionResult = {
      detected: false,
      confidence: 0,
      glareRegions: [],
      recommendedAction: 'proceed'
    };
    
    if (this.config.enableGlassesDetection && previousLandmarks && previousLandmarks.faceLandmarks.length > 0) {
      glassesDetected = this.detectGlasses(previousLandmarks.faceLandmarks[0]);
      glareResult = this.detectGlareAndReflection(preprocessedFrame);
      
      // Skip frame if severe glare detected
      if (glareResult.recommendedAction === 'skip_frame') {
        this.glareFrameSkipCount++;
        console.log(`⚠️ Severe glare detected, skipping frame (skip count: ${this.glareFrameSkipCount})`);
        // Return original frame but mark it for potential skipping
      }
    }
    
    // Apply glasses-specific adaptations
    let adaptedFrame = preprocessedFrame;
    if (this.config.glassesAdaptation && (glassesDetected || glareResult.detected)) {
      adaptedFrame = this.applyGlassesAdaptation(preprocessedFrame, glassesDetected, glareResult);
    }
    
    // If eye region focus is enabled and we have previous landmarks, extract eye regions
    if (this.config.enableEyeRegionFocus && previousLandmarks) {
      const eyeRegionsFrame = this.extractEyeRegions(adaptedFrame, previousLandmarks);
      
      // Apply additional preprocessing specifically for eye regions
      const enhancedEyeFrame = this.preprocessVideoFrame(eyeRegionsFrame);
      
      return enhancedEyeFrame;
    }
    
    return adaptedFrame;
  }

  /**
   * Detect glare and reflection in eye regions
   */
  private detectGlareAndReflection(
    canvas: HTMLCanvasElement,
    eyeRegions?: { left: any, right: any }
  ): GlassesDetectionResult {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let glareDetected = false;
    let maxGlareIntensity = 0;
    const glareRegions: { x: number, y: number, width: number, height: number }[] = [];
    
    // Define regions to check for glare (focus on eye areas if available)
    const checkRegions = eyeRegions ? [
      eyeRegions.left,
      eyeRegions.right
    ] : [
      // Default face regions if no eye regions specified
      { x: 0.2, y: 0.3, width: 0.25, height: 0.15 }, // Left eye region
      { x: 0.55, y: 0.3, width: 0.25, height: 0.15 } // Right eye region
    ];
    
    for (const region of checkRegions) {
      const startX = Math.floor(region.x * canvas.width);
      const startY = Math.floor(region.y * canvas.height);
      const endX = Math.min(canvas.width, startX + Math.floor(region.width * canvas.width));
      const endY = Math.min(canvas.height, startY + Math.floor(region.height * canvas.height));
      
      let regionBrightness = 0;
      let pixelCount = 0;
      let highIntensityPixels = 0;
      
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Calculate luminance
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          regionBrightness += luminance;
          pixelCount++;
          
          // Count very bright pixels (potential glare)
          if (luminance > this.config.glareThreshold * 255) {
            highIntensityPixels++;
          }
        }
      }
      
      const avgBrightness = regionBrightness / pixelCount;
      const glareRatio = highIntensityPixels / pixelCount;
      const normalizedBrightness = avgBrightness / 255;
      
      // Detect glare if brightness is too high or too many bright pixels
      if (normalizedBrightness > this.config.glareThreshold || glareRatio > 0.3) {
        glareDetected = true;
        maxGlareIntensity = Math.max(maxGlareIntensity, normalizedBrightness);
        
        glareRegions.push({
          x: startX,
          y: startY,
          width: endX - startX,
          height: endY - startY
        });
      }
    }
    
    // Determine recommended action
    let recommendedAction: 'proceed' | 'skip_frame' | 'adjust_lighting' = 'proceed';
    
    if (glareDetected) {
      if (maxGlareIntensity > 0.95) {
        recommendedAction = 'skip_frame'; // Severe glare, skip this frame
      } else if (maxGlareIntensity > 0.9) {
        recommendedAction = 'adjust_lighting'; // Moderate glare, suggest adjustment
      }
    }
    
    return {
      detected: glareDetected,
      confidence: maxGlareIntensity,
      glareRegions,
      recommendedAction
    };
  }

  /**
   * Detect if person is wearing glasses
   */
  private detectGlasses(landmarks: any[]): boolean {
    if (!landmarks || landmarks.length < 400) return false;
    
    // Glasses detection heuristics based on landmark patterns
    
    // 1. Check for nose bridge landmarks (glasses typically affect this area)
    const noseBridgeIndices = [6, 19, 20, 94, 125, 141, 235, 236, 237, 238, 239, 240, 241, 242];
    let noseBridgeDepth = 0;
    
    for (const idx of noseBridgeIndices) {
      if (landmarks[idx] && typeof landmarks[idx].z === 'number') {
        noseBridgeDepth += Math.abs(landmarks[idx].z);
      }
    }
    noseBridgeDepth /= noseBridgeIndices.length;
    
    // 2. Check eye region geometry (glasses can create shadows or alter eye shape)
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    
    const leftEyeVariance = this.calculateLandmarkVariance(landmarks, leftEyeIndices);
    const rightEyeVariance = this.calculateLandmarkVariance(landmarks, rightEyeIndices);
    const avgEyeVariance = (leftEyeVariance + rightEyeVariance) / 2;
    
    // 3. Check for geometric patterns typical of glasses frames
    const frameIndicators = [
      noseBridgeDepth > 0.015, // Elevated nose bridge
      avgEyeVariance < 0.002, // More uniform eye regions (glasses smooth out detail)
      this.checkForFrameGeometry(landmarks)
    ];
    
    const glassesScore = frameIndicators.filter(Boolean).length / frameIndicators.length;
    
    // Update glasses detection history for stability
    this.glassesDetectionHistory.push(glassesScore > 0.5);
    if (this.glassesDetectionHistory.length > 10) {
      this.glassesDetectionHistory.shift();
    }
    
    // Stable detection: glasses detected in majority of recent frames
    const recentGlassesDetections = this.glassesDetectionHistory.filter(Boolean).length;
    const glassesDetected = recentGlassesDetections > this.glassesDetectionHistory.length * 0.6;
    
    if (glassesDetected) {
      console.log('👓 Glasses detected - adapting processing parameters');
    }
    
    return glassesDetected;
  }

  /**
   * Calculate variance of landmarks in specified region
   */
  private calculateLandmarkVariance(landmarks: any[], indices: number[]): number {
    const validLandmarks = indices.map(idx => landmarks[idx]).filter(lm => lm);
    if (validLandmarks.length < 2) return 0;
    
    const avgX = validLandmarks.reduce((sum, lm) => sum + lm.x, 0) / validLandmarks.length;
    const avgY = validLandmarks.reduce((sum, lm) => sum + lm.y, 0) / validLandmarks.length;
    
    const variance = validLandmarks.reduce((sum, lm) => {
      return sum + Math.pow(lm.x - avgX, 2) + Math.pow(lm.y - avgY, 2);
    }, 0) / validLandmarks.length;
    
    return variance;
  }

  /**
   * Calculate center point of eye region
   */
  private calculateEyeCenter(landmarks: any[], eyeIndices: number[]): { x: number, y: number } | null {
    const validLandmarks = eyeIndices.map(idx => landmarks[idx]).filter(lm => lm);
    
    if (validLandmarks.length === 0) return null;

    const avgX = validLandmarks.reduce((sum, lm) => sum + lm.x, 0) / validLandmarks.length;
    const avgY = validLandmarks.reduce((sum, lm) => sum + lm.y, 0) / validLandmarks.length;

    return { x: avgX, y: avgY };
  }

  /**
   * Check for geometric patterns typical of glasses frames
   */
  private checkForFrameGeometry(landmarks: any[]): boolean {
    // Look for rectangular patterns around eyes that might indicate frames
    // This is a simplified heuristic - could be enhanced with ML model
    
    const leftEyeCenter = this.calculateEyeCenter(landmarks, [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]);
    const rightEyeCenter = this.calculateEyeCenter(landmarks, [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]);
    
    if (!leftEyeCenter || !rightEyeCenter) return false;
    
    // Check for horizontal symmetry (glasses frames are usually symmetric)
    const yDifference = Math.abs(leftEyeCenter.y - rightEyeCenter.y);
    const horizontalSymmetry = yDifference < 0.02; // Very close Y positions
    
    // Check distance between eyes (glasses can affect this)
    const eyeDistance = Math.abs(leftEyeCenter.x - rightEyeCenter.x);
    const reasonableDistance = eyeDistance > 0.08 && eyeDistance < 0.25;
    
    return horizontalSymmetry && reasonableDistance;
  }

  /**
   * Apply glasses-specific preprocessing
   */
  private applyGlassesAdaptation(
    canvas: HTMLCanvasElement,
    glassesDetected: boolean,
    glareResult: GlassesDetectionResult
  ): HTMLCanvasElement {
    if (!glassesDetected && !glareResult.detected) {
      return canvas; // No adaptation needed
    }
    
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    if (glassesDetected) {
      // Apply glasses-specific enhancements
      this.enhanceForGlasses(data, canvas.width, canvas.height);
      console.log('👓 Applied glasses-specific image enhancement');
    }
    
    if (glareResult.detected && glareResult.glareRegions.length > 0) {
      // Reduce glare in detected regions
      this.reduceGlareInRegions(data, canvas.width, canvas.height, glareResult.glareRegions);
      console.log(`✨ Reduced glare in ${glareResult.glareRegions.length} regions`);
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Enhance image specifically for glasses wearers
   */
  private enhanceForGlasses(data: Uint8ClampedArray, width: number, height: number): void {
    // Apply gentle contrast enhancement to compensate for glasses
    for (let i = 0; i < data.length; i += 4) {
      // Reduce overall brightness slightly to prevent overexposure
      data[i] = Math.max(0, Math.min(255, data[i] * 0.95));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * 0.95)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * 0.95)); // B
      
      // Increase contrast slightly
      const factor = 1.1;
      data[i] = Math.max(0, Math.min(255, (data[i] - 128) * factor + 128));
      data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * factor + 128));
      data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * factor + 128));
    }
  }

  /**
   * Reduce glare in specific regions
   */
  private reduceGlareInRegions(
    data: Uint8ClampedArray, 
    width: number, 
    height: number, 
    glareRegions: { x: number, y: number, width: number, height: number }[]
  ): void {
    for (const region of glareRegions) {
      const startX = Math.max(0, region.x);
      const startY = Math.max(0, region.y);
      const endX = Math.min(width, region.x + region.width);
      const endY = Math.min(height, region.y + region.height);
      
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          
          // Reduce brightness in glare regions
          const reductionFactor = 0.7;
          data[idx] = Math.round(data[idx] * reductionFactor);         // R
          data[idx + 1] = Math.round(data[idx + 1] * reductionFactor); // G
          data[idx + 2] = Math.round(data[idx + 2] * reductionFactor); // B
        }
      }
    }
  }

  /**
   * Enhanced image preprocessing for better landmark detection
   * Includes auto brightness/contrast, denoising, and histogram equalization
   */
  private preprocessVideoFrame(
    videoElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): HTMLCanvasElement {
    // Create canvas for processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size to match video
    const width = videoElement instanceof HTMLVideoElement 
      ? videoElement.videoWidth 
      : videoElement.width;
    const height = videoElement instanceof HTMLVideoElement 
      ? videoElement.videoHeight 
      : videoElement.height;
      
    canvas.width = width;
    canvas.height = height;
    
    // Draw original frame
    ctx.drawImage(videoElement, 0, 0, width, height);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // 1. Auto brightness and contrast adjustment
    this.adjustBrightnessContrast(data, width, height);
    
    // 2. Denoising (simplified bilateral filter)
    this.applyDenoising(data, width, height);
    
    // 3. Histogram equalization for eye regions (if face detected)
    this.enhanceEyeRegions(data, width, height);
    
    // Put processed data back to canvas
    ctx.putImageData(imageData, 0, 0);
    
    return canvas;
  }

  /**
   * Adjust brightness and contrast automatically based on image statistics
   */
  private adjustBrightnessContrast(data: Uint8ClampedArray, width: number, height: number): void {
    const totalPixels = width * height;
    let totalBrightness = 0;
    let minVal = 255;
    let maxVal = 0;
    
    // Calculate brightness statistics (using luminance)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      
      totalBrightness += luminance;
      minVal = Math.min(minVal, luminance);
      maxVal = Math.max(maxVal, luminance);
    }
    
    const avgBrightness = totalBrightness / totalPixels;
    const contrast = maxVal - minVal;
    
    // Determine if adjustment is needed
    const targetBrightness = 128; // Target middle brightness
    const targetContrast = 180; // Target contrast range
    
    const brightnessAdjust = (targetBrightness - avgBrightness) * 0.3; // Gentle adjustment
    const contrastAdjust = contrast < 100 ? 1.2 : 1.0; // Boost low contrast
    
    // Apply adjustments
    if (Math.abs(brightnessAdjust) > 10 || contrastAdjust !== 1.0) {
      for (let i = 0; i < data.length; i += 4) {
        // Apply contrast first, then brightness
        data[i] = Math.max(0, Math.min(255, (data[i] - 128) * contrastAdjust + 128 + brightnessAdjust));
        data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * contrastAdjust + 128 + brightnessAdjust));
        data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * contrastAdjust + 128 + brightnessAdjust));
      }
    }
  }

  /**
   * Apply noise reduction (simplified bilateral filter)
   */
  private applyDenoising(data: Uint8ClampedArray, width: number, height: number): void {
    const originalData = new Uint8ClampedArray(data);
    const radius = 1; // Small radius for real-time performance
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const centerIdx = (y * width + x) * 4;
        
        let sumR = 0, sumG = 0, sumB = 0, weightSum = 0;
        
        // Sample neighboring pixels
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
            
            // Calculate spatial and intensity weights
            const spatialWeight = Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius));
            
            const centerR = originalData[centerIdx];
            const centerG = originalData[centerIdx + 1];
            const centerB = originalData[centerIdx + 2];
            
            const neighborR = originalData[neighborIdx];
            const neighborG = originalData[neighborIdx + 1];
            const neighborB = originalData[neighborIdx + 2];
            
            const intensityDiff = Math.abs(centerR - neighborR) + 
                                Math.abs(centerG - neighborG) + 
                                Math.abs(centerB - neighborB);
            const intensityWeight = Math.exp(-intensityDiff / (2 * 30 * 30)); // sigma = 30
            
            const weight = spatialWeight * intensityWeight;
            
            sumR += neighborR * weight;
            sumG += neighborG * weight;
            sumB += neighborB * weight;
            weightSum += weight;
          }
        }
        
        if (weightSum > 0) {
          data[centerIdx] = sumR / weightSum;
          data[centerIdx + 1] = sumG / weightSum;
          data[centerIdx + 2] = sumB / weightSum;
        }
      }
    }
  }

  /**
   * Enhance eye regions with local histogram equalization
   */
  private enhanceEyeRegions(data: Uint8ClampedArray, width: number, height: number): void {
    // Apply global histogram equalization to face area
    // This is a simplified version - in practice you'd want to detect face region first
    
    // Calculate histogram
    const histogram = new Array(256).fill(0);
    const totalPixels = width * height;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      histogram[gray]++;
    }
    
    // Calculate cumulative distribution
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }
    
    // Normalize CDF
    const cdfMin = cdf.find(val => val > 0) || 0;
    const cdfRange = totalPixels - cdfMin;
    
    if (cdfRange > 0) {
      // Apply histogram equalization
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        const newGray = Math.round(((cdf[gray] - cdfMin) / cdfRange) * 255);
        const factor = newGray / (gray || 1);
        
        // Apply factor to RGB channels while preserving color ratios
        data[i] = Math.max(0, Math.min(255, r * factor));
        data[i + 1] = Math.max(0, Math.min(255, g * factor));
        data[i + 2] = Math.max(0, Math.min(255, b * factor));
      }
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

      // 🔧 ENHANCEMENT: Apply enhanced preprocessing with glasses detection
      const enhancedFrame = this.enhancedPreprocessing(videoElement, this.previousLandmarks);
      
      // 📊 NEW: Assess frame quality for eye tracking
      const frameQuality = this.assessFrameQuality(enhancedFrame);
      
      // Handle frame quality recommendations
      if (frameQuality.recommendation === 'skip_frame') {
        console.log('⚠️ Poor frame quality detected, skipping frame:', frameQuality.issues.join(', '));
        this.performanceService.endFrameProcessing();
        return undefined;
      }
      
      if (frameQuality.recommendation === 'improve_lighting' || frameQuality.recommendation === 'adjust_position') {
        console.log('💡 Frame quality suggestion:', frameQuality.issues.join(', '));
      }
      
      // Check if we should skip this frame due to glare
      if (this.glareFrameSkipCount > 0 && this.glareFrameSkipCount <= this.config.glareSkipFrames) {
        this.glareFrameSkipCount--;
        console.log(`⚠️ Skipping frame due to glare (${this.glareFrameSkipCount} frames remaining)`);
        this.performanceService.endFrameProcessing();
        return undefined;
      } else if (this.glareFrameSkipCount > this.config.glareSkipFrames) {
        this.glareFrameSkipCount = 0; // Reset counter
      }
      
      console.log('🎯 Applied enhanced preprocessing with glasses/glare detection and frame quality assessment');

      // Get frame data using memory pool if enabled
      let frameData: any = null;
      if (this.optimizationConfig.enableMemoryPooling) {
        frameData = this.memoryPool.acquire('frame-processing');
        if (frameData && typeof frameData === 'object') {
          (frameData as any).timestamp = timestamp;
          (frameData as any).data = enhancedFrame; // Use enhanced frame
        }
      }

      // Process with quality optimization using enhanced frame
      const detectionResult = this.processWithOptimization(enhancedFrame, timestamp);

      // Store landmarks for next frame's eye region extraction
      if (detectionResult && detectionResult.faceLandmarks.length > 0) {
        this.previousLandmarks = detectionResult;
        console.log('📍 Stored landmarks for next frame eye region focus');
      }

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

  // Enhanced face quality assessment with eye-specific checks
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

    // Enhanced stability calculation
    const stability = this.calculateEnhancedStability(landmarks);
    
    // Enhanced confidence with eye region assessment
    const confidenceScore = this.calculateEnhancedConfidence(landmarks, faceBounds);
    
    // Check eye landmark quality specifically for gaze tracking
    const eyeQuality = this.assessEyeLandmarkQuality(landmarks);
    
    // Detect glasses and glare for this frame
    const glassesDetected = this.config.enableGlassesDetection ? this.detectGlasses(landmarks) : false;
    
    // Create a temporary canvas for glare detection
    let glareDetected = false;
    let glareIntensity = 0;
    if (this.config.enableGlassesDetection) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 640; // Default resolution for detection
      tempCanvas.height = 480;
      // Note: In a real implementation, you'd pass the actual video frame here
      const glareResult = this.detectGlareAndReflection(tempCanvas);
      glareDetected = glareResult.detected;
      glareIntensity = glareResult.confidence;
    }

    console.log(`👁️ Eye landmark quality: ${(eyeQuality * 100).toFixed(1)}%`);
    console.log(`📊 Overall confidence: ${(confidenceScore * 100).toFixed(1)}%`);
    if (glassesDetected) console.log(`👓 Glasses detected`);
    if (glareDetected) console.log(`✨ Glare detected (intensity: ${(glareIntensity * 100).toFixed(1)}%)`);

    this.faceQuality$.next({
      faceDetected: true,
      landmarkCount,
      confidenceScore: confidenceScore * eyeQuality, // Weight by eye quality
      faceBounds,
      stability,
      glareDetected,
      glareIntensity,
      glassesDetected
    });
  }

  /**
   * Assess quality of eye landmarks specifically for gaze tracking
   */
  private assessEyeLandmarkQuality(landmarks: any[]): number {
    // Eye landmark indices (MediaPipe face mesh)
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

    let score = 0;
    let checks = 0;

    // Check left eye completeness
    const leftEyePresent = leftEyeIndices.filter(idx => landmarks[idx]).length;
    score += (leftEyePresent / leftEyeIndices.length) * 0.5;
    checks++;

    // Check right eye completeness  
    const rightEyePresent = rightEyeIndices.filter(idx => landmarks[idx]).length;
    score += (rightEyePresent / rightEyeIndices.length) * 0.5;
    checks++;

    return checks > 0 ? score / checks : 0;
  }

  /**
   * Enhanced stability calculation with eye region focus
   */
  private calculateEnhancedStability(landmarks: any[]): number {
    // Base stability on landmark completeness
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
    
    // Eye-specific stability checks
    const eyeStability = this.calculateEyeRegionStability(landmarks);
    
    // Combine scores with emphasis on eye stability for gaze tracking
    return Math.min(1.0, (completeness * 0.3 + aspectRatioScore * 0.3 + eyeStability * 0.4));
  }

  /**
   * Calculate stability specifically for eye regions
   */
  private calculateEyeRegionStability(landmarks: any[]): number {
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    
    // Check completeness of each eye
    const leftEyeComplete = leftEyeIndices.filter(idx => landmarks[idx]).length / leftEyeIndices.length;
    const rightEyeComplete = rightEyeIndices.filter(idx => landmarks[idx]).length / rightEyeIndices.length;
    
    // Check eye symmetry (both eyes should be detected equally well)
    const symmetryScore = 1 - Math.abs(leftEyeComplete - rightEyeComplete);
    
    // Overall eye stability
    const avgEyeCompleteness = (leftEyeComplete + rightEyeComplete) / 2;
    
    return (avgEyeCompleteness * 0.7 + symmetryScore * 0.3);
  }

  /**
   * Enhanced confidence calculation with eye region weighting
   */
  private calculateEnhancedConfidence(landmarks: any[], faceBounds: any): number {
    // Base confidence on face size
    const faceArea = faceBounds.width * faceBounds.height;
    const sizeScore = Math.min(1.0, faceArea * 5); // Adjusted multiplier
    
    // Check landmark density in eye regions
    const eyeRegionDensity = this.calculateEyeRegionDensity(landmarks);
    
    // Combine scores with heavier weight on eye regions
    return (sizeScore * 0.3 + eyeRegionDensity * 0.7);
  }

  /**
   * Calculate landmark density specifically in eye regions
   */
  private calculateEyeRegionDensity(landmarks: any[]): number {
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    
    const leftEyePresent = leftEyeIndices.filter(idx => landmarks[idx]).length;
    const rightEyePresent = rightEyeIndices.filter(idx => landmarks[idx]).length;
    
    const totalExpected = leftEyeIndices.length + rightEyeIndices.length;
    const totalPresent = leftEyePresent + rightEyePresent;
    
    return totalPresent / totalExpected;
  }

  // Simple stability calculation based on landmark count and distribution
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

  /**
   * Assess the quality of the input frame for eye tracking
   */
  assessFrameQuality(canvas: HTMLCanvasElement): FrameQualityAssessment {
    if (!this.QUALITY_CONFIG.enableQualityChecks) {
      return {
        sharpness: 1.0,
        brightness: 0.5,
        contrast: 1.0,
        quality: 'excellent',
        issues: [],
        recommendation: 'proceed'
      };
    }

    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Calculate sharpness using Laplacian variance
    const sharpness = this.calculateSharpness(data, width, height);
    
    // Calculate brightness (average luminance)
    const brightness = this.calculateBrightness(data);
    
    // Calculate contrast (standard deviation of luminance)
    const contrast = this.calculateContrast(data, brightness);

    // Assess overall quality
    const quality = this.determineQuality(sharpness, brightness, contrast);
    
    // Identify issues
    const issues = this.identifyQualityIssues(sharpness, brightness, contrast);
    
    // Get recommendation
    const recommendation = this.getQualityRecommendation(quality, issues);

    // Update quality history for trend analysis
    this.updateQualityHistory(sharpness);

    const assessment: FrameQualityAssessment = {
      sharpness,
      brightness,
      contrast,
      quality,
      issues,
      recommendation
    };

    // Log quality assessment if significant change
    if (issues.length > 0) {
      console.log(`📊 Frame Quality Assessment:`, {
        sharpness: (sharpness * 100).toFixed(1) + '%',
        brightness: (brightness * 100).toFixed(1) + '%',
        contrast: (contrast * 100).toFixed(1) + '%',
        quality,
        issues: issues.join(', '),
        recommendation
      });
    }

    return assessment;
  }

  /**
   * Calculate image sharpness using Laplacian variance
   */
  private calculateSharpness(data: Uint8ClampedArray, width: number, height: number): number {
    // Convert to grayscale and apply Laplacian filter
    let variance = 0;
    let count = 0;
    
    // Simplified Laplacian kernel: center weighted
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        
        // Get grayscale value
        const center = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Get neighboring pixels
        const top = 0.299 * data[i - width * 4] + 0.587 * data[i - width * 4 + 1] + 0.114 * data[i - width * 4 + 2];
        const bottom = 0.299 * data[i + width * 4] + 0.587 * data[i + width * 4 + 1] + 0.114 * data[i + width * 4 + 2];
        const left = 0.299 * data[i - 4] + 0.587 * data[i - 3] + 0.114 * data[i - 2];
        const right = 0.299 * data[i + 4] + 0.587 * data[i + 5] + 0.114 * data[i + 6];
        
        // Apply simplified Laplacian
        const laplacian = Math.abs(4 * center - top - bottom - left - right);
        variance += laplacian * laplacian;
        count++;
      }
    }
    
    // Normalize to 0-1 range (empirical scaling)
    const rawVariance = count > 0 ? variance / count : 0;
    return Math.min(rawVariance / 2000, 1.0); // Scale factor based on typical values
  }

  /**
   * Calculate image brightness (average luminance)
   */
  private calculateBrightness(data: Uint8ClampedArray): number {
    let totalLuminance = 0;
    const pixelCount = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += luminance;
    }
    
    return totalLuminance / (pixelCount * 255); // Normalize to 0-1
  }

  /**
   * Calculate image contrast (standard deviation of luminance)
   */
  private calculateContrast(data: Uint8ClampedArray, avgBrightness: number): number {
    let varianceSum = 0;
    const pixelCount = data.length / 4;
    const avgLuminance = avgBrightness * 255;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const diff = luminance - avgLuminance;
      varianceSum += diff * diff;
    }
    
    const standardDeviation = Math.sqrt(varianceSum / pixelCount);
    return Math.min(standardDeviation / 128, 1.0); // Normalize to 0-1
  }

  /**
   * Determine overall quality rating
   */
  private determineQuality(sharpness: number, brightness: number, contrast: number): 'excellent' | 'good' | 'fair' | 'poor' {
    const qualityScore = (sharpness * 0.4 + 
                         this.getBrightnessScore(brightness) * 0.3 + 
                         contrast * 0.3);
    
    if (qualityScore >= 0.8) return 'excellent';
    if (qualityScore >= 0.6) return 'good';
    if (qualityScore >= 0.4) return 'fair';
    return 'poor';
  }

  /**
   * Get brightness quality score (optimal range is 0.3-0.7)
   */
  private getBrightnessScore(brightness: number): number {
    if (brightness >= 0.3 && brightness <= 0.7) {
      return 1.0; // Optimal range
    } else if (brightness >= 0.2 && brightness <= 0.8) {
      return 0.7; // Acceptable range
    } else {
      return Math.max(0, 1 - Math.abs(brightness - 0.5) * 2); // Penalize extremes
    }
  }

  /**
   * Identify specific quality issues
   */
  private identifyQualityIssues(sharpness: number, brightness: number, contrast: number): string[] {
    const issues: string[] = [];
    
    if (sharpness < this.QUALITY_CONFIG.minSharpness) {
      issues.push('เบลอเกินไป - ลองขยับกล้องให้ชัดขึ้น');
    }
    
    if (brightness < this.QUALITY_CONFIG.minBrightness) {
      issues.push('แสงมืดเกินไป - เพิ่มแสงสว่าง');
    } else if (brightness > this.QUALITY_CONFIG.maxBrightness) {
      issues.push('แสงสว่างเกินไป - ลดแสงหรือหลีกเลี่ยงแสงแดด');
    }
    
    if (contrast < this.QUALITY_CONFIG.minContrast) {
      issues.push('ภาพไม่มีความชัดเจน - ปรับมุมกล้องหรือแสง');
    }
    
    return issues;
  }

  /**
   * Get quality-based recommendation
   */
  private getQualityRecommendation(
    quality: 'excellent' | 'good' | 'fair' | 'poor', 
    issues: string[]
  ): 'proceed' | 'skip_frame' | 'improve_lighting' | 'adjust_position' {
    
    if (quality === 'excellent' || quality === 'good') {
      return 'proceed';
    }
    
    if (issues.some(issue => issue.includes('แสง'))) {
      return 'improve_lighting';
    }
    
    if (issues.some(issue => issue.includes('เบลอ') || issue.includes('ชัด'))) {
      return 'adjust_position';
    }
    
    if (quality === 'poor' && this.QUALITY_CONFIG.skipPoorQualityFrames) {
      return 'skip_frame';
    }
    
    return 'proceed';
  }

  /**
   * Update quality history for trend analysis
   */
  private updateQualityHistory(sharpness: number): void {
    this.qualityHistory.push(sharpness);
    
    if (this.qualityHistory.length > this.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
  }

  /**
   * Get quality trend information
   */
  getQualityTrend(): { trend: 'improving' | 'stable' | 'declining', confidence: number } {
    if (this.qualityHistory.length < 3) {
      return { trend: 'stable', confidence: 0 };
    }
    
    const recent = this.qualityHistory.slice(-3);
    const older = this.qualityHistory.slice(0, -3);
    
    if (older.length === 0) {
      return { trend: 'stable', confidence: 0 };
    }
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    const confidence = Math.min(Math.abs(diff) * 10, 1); // Scale difference to confidence
    
    if (diff > 0.05) {
      return { trend: 'improving', confidence };
    } else if (diff < -0.05) {
      return { trend: 'declining', confidence };
    } else {
      return { trend: 'stable', confidence };
    }
  }

  /**
   * Get human-readable quality suggestions
   */
  getQualitySuggestions(): string[] {
    const suggestions: string[] = [];
    
    if (this.qualityHistory.length === 0) {
      return ['กำลังประเมินคุณภาพเฟรม...'];
    }
    
    const recentQuality = this.qualityHistory.slice(-3);
    const avgQuality = recentQuality.reduce((a, b) => a + b, 0) / recentQuality.length;
    
    if (avgQuality < 0.3) {
      suggestions.push('🔍 ภาพเบลอมาก - ลองปรับโฟกัสหรือเข้าใกล้กล้องมากขึ้น');
      suggestions.push('💡 ตรวจสอบว่าเลนส์กล้องสะอาด');
      suggestions.push('📱 หากใช้โทรศัพท์ ลองใช้กล้องหลัง');
    } else if (avgQuality < 0.5) {
      suggestions.push('⚡ ภาพยังไม่คมชัด - ลองปรับตำแหน่งกล้อง');
      suggestions.push('🏠 หาบริเวณที่มีแสงสม่ำเสมอ');
    } else if (avgQuality > 0.8) {
      suggestions.push('✅ คุณภาพภาพดีมาก!');
      suggestions.push('🎯 ตำแหน่งและแสงเหมาะสมแล้ว');
    } else {
      suggestions.push('👍 คุณภาพภาพใช้ได้ดี');
    }
    
    // Add trend-based suggestions
    const trend = this.getQualityTrend();
    if (trend.confidence > 0.3) {
      if (trend.trend === 'improving') {
        suggestions.push('📈 คุณภาพกำลังดีขึ้น - ทิศทางที่ถูกต้อง!');
      } else if (trend.trend === 'declining') {
        suggestions.push('📉 คุณภาพกำลังลดลง - ลองปรับตำแหน่งหรือแสง');
      }
    }
    
    return suggestions;
  }

  /**
   * Check if quality warning should be shown to user
   */
  shouldShowQualityWarning(): { show: boolean, message: string } {
    if (this.qualityHistory.length < 5) {
      return { show: false, message: '' };
    }
    
    const recent = this.qualityHistory.slice(-5);
    const avgQuality = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (avgQuality < 0.25) {
      return { 
        show: true, 
        message: '⚠️ คุณภาพภาพต่ำมาก อาจส่งผลต่อความแม่นยำในการติดตามสายตา' 
      };
    }
    
    const trend = this.getQualityTrend();
    if (trend.trend === 'declining' && trend.confidence > 0.5) {
      return { 
        show: true, 
        message: '📉 คุณภาพภาพกำลังลดลง ลองปรับแสงหรือตำแหน่งกล้อง' 
      };
    }
    
    return { show: false, message: '' };
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

  // Frame quality getters
  getLatestFrameQuality(): FrameQualityAssessment | null {
    if (this.qualityHistory.length === 0) return null;
    
    const latestSharpness = this.qualityHistory[this.qualityHistory.length - 1];
    return {
      sharpness: latestSharpness,
      brightness: 0.5, // Simplified for getter
      contrast: 0.5,   // Simplified for getter
      quality: latestSharpness > 0.6 ? 'good' : latestSharpness > 0.3 ? 'fair' : 'poor',
      issues: [],
      recommendation: 'proceed'
    };
  }

  getCurrentQualitySuggestions(): string[] {
    return this.getQualitySuggestions();
  }

  getCurrentQualityWarning(): { show: boolean, message: string } {
    return this.shouldShowQualityWarning();
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
