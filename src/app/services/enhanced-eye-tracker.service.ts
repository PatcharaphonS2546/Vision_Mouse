import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MediapipeService } from './mediapipe.service';
import { AdvancedGazeCalculationService, GazeCalculationResult } from './advanced-gaze-calculation.service';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface EyeRegion {
  landmarks: NormalizedLandmark[];
  center: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
  isOpen: boolean;
  openness: number; // 0-1 scale
  pupilPosition?: { x: number; y: number };
  quality: 'excellent' | 'good' | 'poor';
}

export interface FaceRegion {
  landmarks: NormalizedLandmark[];
  bounds: { x: number; y: number; width: number; height: number };
  pose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  quality: 'excellent' | 'good' | 'poor';
  confidence: number;
}

export interface EyeTrackingData {
  leftEye: EyeRegion;
  rightEye: EyeRegion;
  face: FaceRegion;
  timestamp: number;
  frameNumber: number;
  lowLightMode: boolean;
  averageConfidence: number;
}

export interface LowLightOptimization {
  enabled: boolean;
  brightnessBoost: number;
  contrastEnhancement: number;
  noiseReduction: boolean;
  stabilization: boolean;
  confidenceThreshold: number;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedEyeTrackerService {
  // Eye landmark indices from MediaPipe Face Landmarker
  private readonly LEFT_EYE_INDICES = [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
  ];
  
  private readonly RIGHT_EYE_INDICES = [
    362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
  ];

  private readonly FACE_OUTLINE_INDICES = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 
    400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54
  ];

  // State management
  private eyeTrackingData$ = new BehaviorSubject<EyeTrackingData | null>(null);
  private processingActive$ = new BehaviorSubject<boolean>(false);
  private lowLightMode$ = new BehaviorSubject<boolean>(false);

  // Performance tracking
  private frameNumber = 0;
  private processingTimes: number[] = [];
  private lastProcessTime = 0;

  // Low light optimization settings
  private lowLightOptimization: LowLightOptimization = {
    enabled: false,
    brightnessBoost: 1.3,
    contrastEnhancement: 1.2,
    noiseReduction: true,
    stabilization: true,
    confidenceThreshold: 0.3 // Lower threshold for low light
  };

  // Eye state tracking for stability
  private eyeStateHistory: Array<{ leftOpen: boolean; rightOpen: boolean; timestamp: number }> = [];
  private readonly historySize = 10;

  constructor(
    private mediapipeService: MediapipeService,
    private gazeCalculationService: AdvancedGazeCalculationService
  ) {
    this.initializeAutoLightDetection();
  }

  /**
   * Get eye tracking data observable
   */
  getEyeTrackingData(): Observable<EyeTrackingData | null> {
    return this.eyeTrackingData$.asObservable();
  }

  /**
   * Get processing status
   */
  getProcessingStatus(): Observable<boolean> {
    return this.processingActive$.asObservable();
  }

  /**
   * Get low light mode status
   */
  getLowLightMode(): Observable<boolean> {
    return this.lowLightMode$.asObservable();
  }

  /**
   * Get advanced gaze calculation results
   */
  getGazeResults(): Observable<GazeCalculationResult | null> {
    return this.gazeCalculationService.getGazeResults();
  }

  /**
   * Start eye tracking
   */
  async startTracking(): Promise<boolean> {
    try {
      // Initialize MediaPipe if not already done
      if (!this.mediapipeService.isInitialized) {
        await this.mediapipeService.initialize({
          confidenceThreshold: this.lowLightOptimization.enabled 
            ? this.lowLightOptimization.confidenceThreshold 
            : 0.5,
          performanceMode: 'balanced'
        });
      }

      this.processingActive$.next(true);
      this.frameNumber = 0;
      console.log('Enhanced eye tracking started');
      return true;
    } catch (error) {
      console.error('Failed to start eye tracking:', error);
      this.processingActive$.next(false);
      return false;
    }
  }

  /**
   * Stop eye tracking
   */
  stopTracking(): void {
    this.processingActive$.next(false);
    this.eyeTrackingData$.next(null);
    this.frameNumber = 0;
    console.log('Enhanced eye tracking stopped');
  }

  /**
   * Process video frame for eye tracking
   */
  processFrame(videoElement: HTMLVideoElement, timestamp: number): EyeTrackingData | null {
    if (!this.processingActive$.value) return null;

    const startTime = performance.now();
    this.frameNumber++;

    try {
      // Get face landmarks from MediaPipe
      const faceLandmarks = this.mediapipeService.detectLandmarks(videoElement, timestamp);
      
      if (!faceLandmarks || !faceLandmarks.faceLandmarks || faceLandmarks.faceLandmarks.length === 0) {
        return null;
      }

      // Process the first detected face
      const landmarks = faceLandmarks.faceLandmarks[0];
      
      // Extract eye regions
      const leftEye = this.extractEyeRegion(landmarks, this.LEFT_EYE_INDICES, 'left');
      const rightEye = this.extractEyeRegion(landmarks, this.RIGHT_EYE_INDICES, 'right');
      
      // Extract face region
      const face = this.extractFaceRegion(landmarks, faceLandmarks);

      // Calculate average confidence
      const averageConfidence = this.calculateAverageConfidence(leftEye, rightEye, face);

      // Apply low light adjustments if needed
      if (this.lowLightOptimization.enabled) {
        this.applyLowLightAdjustments(leftEye, rightEye, face);
      }

      // Create eye tracking data
      const eyeTrackingData: EyeTrackingData = {
        leftEye,
        rightEye,
        face,
        timestamp,
        frameNumber: this.frameNumber,
        lowLightMode: this.lowLightOptimization.enabled,
        averageConfidence
      };

      // Update eye state history for stability
      this.updateEyeStateHistory(leftEye, rightEye, timestamp);

      // Record processing time
      const processingTime = performance.now() - startTime;
      this.recordProcessingTime(processingTime);

      // Emit new data
      this.eyeTrackingData$.next(eyeTrackingData);

      // Calculate advanced gaze point
      this.calculateAdvancedGaze(eyeTrackingData);

      return eyeTrackingData;

    } catch (error) {
      console.error('Error processing frame for eye tracking:', error);
      return null;
    }
  }

  /**
   * Extract eye region from landmarks
   */
  private extractEyeRegion(landmarks: NormalizedLandmark[], eyeIndices: number[], side: 'left' | 'right'): EyeRegion {
    const eyeLandmarks = eyeIndices.map(index => landmarks[index]).filter(lm => lm);
    
    // Calculate eye bounds
    const bounds = this.calculateBounds(eyeLandmarks);
    
    // Calculate eye center
    const center = this.calculateCenter(eyeLandmarks);
    
    // Determine eye openness
    const openness = this.calculateEyeOpenness(eyeLandmarks, side);
    const isOpen = openness > 0.3; // Threshold for considering eye "open"
    
    // Estimate pupil position (simplified approach)
    const pupilPosition = this.estimatePupilPosition(eyeLandmarks, center);
    
    // Assess quality
    const quality = this.assessEyeQuality(eyeLandmarks, openness);

    return {
      landmarks: eyeLandmarks,
      center,
      bounds,
      isOpen,
      openness,
      pupilPosition,
      quality
    };
  }

  /**
   * Extract face region from landmarks
   */
  private extractFaceRegion(landmarks: NormalizedLandmark[], result: FaceLandmarkerResult): FaceRegion {
    const faceLandmarks = this.FACE_OUTLINE_INDICES.map(index => landmarks[index]).filter(lm => lm);
    
    // Calculate face bounds
    const bounds = this.calculateBounds(landmarks);
    
    // Calculate head pose (simplified)
    const pose = this.calculateHeadPose(landmarks, result);
    
    // Assess face quality
    const quality = this.assessFaceQuality(landmarks);
    
    // Calculate confidence (if available from transformation matrices)
    const confidence = this.calculateFaceConfidence(result);

    return {
      landmarks: faceLandmarks,
      bounds,
      pose,
      quality,
      confidence
    };
  }

  /**
   * Calculate bounds from landmarks
   */
  private calculateBounds(landmarks: NormalizedLandmark[]): { x: number; y: number; width: number; height: number } {
    if (landmarks.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const xs = landmarks.map(lm => lm.x);
    const ys = landmarks.map(lm => lm.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Calculate center point from landmarks
   */
  private calculateCenter(landmarks: NormalizedLandmark[]): { x: number; y: number } {
    if (landmarks.length === 0) {
      return { x: 0, y: 0 };
    }

    const avgX = landmarks.reduce((sum, lm) => sum + lm.x, 0) / landmarks.length;
    const avgY = landmarks.reduce((sum, lm) => sum + lm.y, 0) / landmarks.length;

    return { x: avgX, y: avgY };
  }

  /**
   * Calculate eye openness ratio
   */
  private calculateEyeOpenness(eyeLandmarks: NormalizedLandmark[], side: 'left' | 'right'): number {
    if (eyeLandmarks.length < 6) return 0;

    // Use specific points for eye aspect ratio calculation
    // This is a simplified approach - in production you'd use more sophisticated methods
    try {
      const p1 = eyeLandmarks[1]; // Top of eye
      const p2 = eyeLandmarks[5]; // Bottom of eye
      const p3 = eyeLandmarks[0]; // Left corner
      const p4 = eyeLandmarks[3]; // Right corner

      const verticalDistance = Math.abs(p1.y - p2.y);
      const horizontalDistance = Math.abs(p4.x - p3.x);

      // Eye aspect ratio
      const ratio = verticalDistance / (horizontalDistance + 0.001); // Avoid division by zero
      
      // Normalize to 0-1 range (typical EAR values are around 0.2-0.3 for open eyes)
      return Math.min(ratio * 3, 1.0);
    } catch {
      return 0.5; // Default moderate openness
    }
  }

  /**
   * Estimate pupil position within eye region
   */
  private estimatePupilPosition(eyeLandmarks: NormalizedLandmark[], center: { x: number; y: number }): { x: number; y: number } {
    // This is a simplified estimation - in production you'd use more sophisticated iris tracking
    // For now, assume pupil is at the center of the eye region
    return center;
  }

  /**
   * Assess eye quality based on landmark stability and visibility
   */
  private assessEyeQuality(eyeLandmarks: NormalizedLandmark[], openness: number): 'excellent' | 'good' | 'poor' {
    if (eyeLandmarks.length < 8) return 'poor';
    
    // Check visibility scores if available
    const avgVisibility = eyeLandmarks.reduce((sum, lm) => sum + (lm.visibility || 1), 0) / eyeLandmarks.length;
    
    if (avgVisibility > 0.8 && openness > 0.4) return 'excellent';
    if (avgVisibility > 0.6 && openness > 0.2) return 'good';
    return 'poor';
  }

  /**
   * Assess face quality
   */
  private assessFaceQuality(landmarks: NormalizedLandmark[]): 'excellent' | 'good' | 'poor' {
    if (landmarks.length < 400) return 'poor'; // MediaPipe provides 468 landmarks
    
    const avgVisibility = landmarks.reduce((sum, lm) => sum + (lm.visibility || 1), 0) / landmarks.length;
    
    if (avgVisibility > 0.8) return 'excellent';
    if (avgVisibility > 0.6) return 'good';
    return 'poor';
  }

  /**
   * Calculate head pose (simplified)
   */
  private calculateHeadPose(landmarks: NormalizedLandmark[], result: FaceLandmarkerResult): { pitch: number; yaw: number; roll: number } {
    // This would typically use transformation matrices from MediaPipe
    // For now, use simplified geometric calculations
    
    try {
      // Nose tip and other reference points
      const noseTip = landmarks[1];
      const leftEyeCorner = landmarks[33];
      const rightEyeCorner = landmarks[263];
      const chin = landmarks[18];

      // Calculate yaw (left-right rotation)
      const eyeDistance = Math.abs(rightEyeCorner.x - leftEyeCorner.x);
      const noseToLeftEye = Math.abs(noseTip.x - leftEyeCorner.x);
      const noseToRightEye = Math.abs(noseTip.x - rightEyeCorner.x);
      const yaw = (noseToRightEye - noseToLeftEye) / eyeDistance * 45; // Approximate in degrees

      // Calculate pitch (up-down rotation)
      const noseToEyeLevel = (leftEyeCorner.y + rightEyeCorner.y) / 2;
      const pitch = (noseTip.y - noseToEyeLevel) * 90; // Approximate in degrees

      // Calculate roll (head tilt)
      const eyeLevelTilt = Math.atan2(rightEyeCorner.y - leftEyeCorner.y, rightEyeCorner.x - leftEyeCorner.x);
      const roll = eyeLevelTilt * (180 / Math.PI); // Convert to degrees

      return { pitch, yaw, roll };
    } catch {
      return { pitch: 0, yaw: 0, roll: 0 };
    }
  }

  /**
   * Calculate face confidence from result
   */
  private calculateFaceConfidence(result: FaceLandmarkerResult): number {
    // Use face detection scores if available
    // For now, return a default confidence
    return 0.8; // This would be calculated from actual detection confidence
  }

  /**
   * Calculate average confidence across all regions
   */
  private calculateAverageConfidence(leftEye: EyeRegion, rightEye: EyeRegion, face: FaceRegion): number {
    const qualityToScore = (quality: string) => {
      switch (quality) {
        case 'excellent': return 0.9;
        case 'good': return 0.7;
        case 'poor': return 0.4;
        default: return 0.5;
      }
    };

    const leftEyeScore = qualityToScore(leftEye.quality);
    const rightEyeScore = qualityToScore(rightEye.quality);
    const faceScore = face.confidence;

    return (leftEyeScore + rightEyeScore + faceScore) / 3;
  }

  /**
   * Apply adjustments for low light conditions
   */
  private applyLowLightAdjustments(leftEye: EyeRegion, rightEye: EyeRegion, face: FaceRegion): void {
    // Relax quality thresholds in low light
    if (leftEye.quality === 'poor' && leftEye.openness > 0.1) {
      leftEye.quality = 'good';
    }
    
    if (rightEye.quality === 'poor' && rightEye.openness > 0.1) {
      rightEye.quality = 'good';
    }
    
    if (face.quality === 'poor' && face.confidence > 0.3) {
      face.quality = 'good';
    }
  }

  /**
   * Update eye state history for stability analysis
   */
  private updateEyeStateHistory(leftEye: EyeRegion, rightEye: EyeRegion, timestamp: number): void {
    this.eyeStateHistory.push({
      leftOpen: leftEye.isOpen,
      rightOpen: rightEye.isOpen,
      timestamp
    });

    // Keep only recent history
    if (this.eyeStateHistory.length > this.historySize) {
      this.eyeStateHistory = this.eyeStateHistory.slice(-this.historySize);
    }
  }

  /**
   * Record processing time for performance monitoring
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    if (this.processingTimes.length > 30) {
      this.processingTimes = this.processingTimes.slice(-30);
    }
    this.lastProcessTime = time;
  }

  /**
   * Enable/disable low light mode
   */
  enableLowLightMode(enabled: boolean): void {
    this.lowLightOptimization.enabled = enabled;
    this.lowLightMode$.next(enabled);
    
    console.log(`Low light mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Auto-detect low light conditions
   */
  private initializeAutoLightDetection(): void {
    // This would analyze video frames to detect lighting conditions
    // For now, provide manual control
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): { averageProcessingTime: number; fps: number } {
    const avgTime = this.processingTimes.length > 0 
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length 
      : 0;
    
    const fps = avgTime > 0 ? Math.round(1000 / avgTime) : 0;
    
    return {
      averageProcessingTime: avgTime,
      fps
    };
  }

  /**
   * Get eye state stability (useful for detecting blinks vs. eye movements)
   */
  getEyeStability(): { leftEyeStable: boolean; rightEyeStable: boolean } {
    if (this.eyeStateHistory.length < 5) {
      return { leftEyeStable: false, rightEyeStable: false };
    }

    const recent = this.eyeStateHistory.slice(-5);
    const leftStates = recent.map(h => h.leftOpen);
    const rightStates = recent.map(h => h.rightOpen);

    // Consider stable if state hasn't changed in recent frames
    const leftEyeStable = leftStates.every(state => state === leftStates[0]);
    const rightEyeStable = rightStates.every(state => state === rightStates[0]);

    return { leftEyeStable, rightEyeStable };
  }

  /**
   * Calculate advanced gaze point using dedicated service
   */
  private calculateAdvancedGaze(eyeTrackingData: EyeTrackingData): void {
    try {
      const gazeResult = this.gazeCalculationService.calculateGazePoint(eyeTrackingData);
      if (gazeResult) {
        console.log('Advanced gaze calculated:', gazeResult);
      }
    } catch (error) {
      console.error('Error calculating advanced gaze:', error);
    }
  }

  /**
   * Set calibration matrix for advanced gaze calculation
   */
  setCalibrationMatrix(matrix: any): void {
    this.gazeCalculationService.setCalibrationMatrix(matrix);
  }

  /**
   * Reset gaze calculation smoothing
   */
  resetGazeSmoothing(): void {
    this.gazeCalculationService.resetSmoothing();
  }
}
