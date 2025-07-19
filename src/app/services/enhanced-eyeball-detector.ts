// Enhanced EyeballDetector.ts
// Advanced eyeball detection with pupil tracking and eye closure detection

import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface EyeRegion {
  landmarks: NormalizedLandmark[];
  boundingBox: { x: number, y: number, width: number, height: number };
  pupilCenter: { x: number, y: number } | null;
  irisRadius: number;
  eyeOpenness: number; // 0 = closed, 1 = fully open
  quality: EyeQuality;
}

export interface EyeQuality {
  sharpness: number; // 0-1
  contrast: number; // 0-1
  visibility: number; // 0-1
  tracking: number; // 0-1
  overall: number; // 0-1
}

export interface EyeBall3D {
  center: number[]; // [x, y, z]
  radius: number;
  confidence: number;
  detected: boolean;
}

export interface PupilData {
  center: { x: number, y: number };
  radius: number;
  confidence: number;
  timestamp: number;
}

export class EyeballDetector {
  public leftEye: EyeBall3D;
  public rightEye: EyeBall3D;
  public currentConfidence: number = 0.0;
  public centerDetected: boolean = false;
  public searchCompleted: boolean = false;

  // Enhanced tracking
  private leftEyeRegion: EyeRegion | null = null;
  private rightEyeRegion: EyeRegion | null = null;
  private pupilHistory: Map<string, PupilData[]> = new Map();
  
  // Configuration
  private readonly config = {
    minConfidence: 0.5,
    reasonableConfidence: 0.7,
    pointsThreshold: 10,
    pointsHistorySize: 100,
    refreshTimeThreshold: 5000, // ms
    eyeClosureThreshold: 0.3,
    pupilDetectionRadius: 0.05,
    irisDetectionRadius: 0.08,
    smoothingWindow: 5
  };

  private pointsForEyeCenter: number[][] | null = null;
  private lastUpdateTime: number = 0;

  constructor(
    minConfidence: number = 0.5,
    reasonableConfidence: number = 0.7,
    pointsThreshold: number = 10,
    pointsHistorySize: number = 100,
    refreshTimeThreshold: number = 5000
  ) {
    // Initialize configuration
    this.config.minConfidence = minConfidence;
    this.config.reasonableConfidence = reasonableConfidence;
    this.config.pointsThreshold = pointsThreshold;
    this.config.pointsHistorySize = pointsHistorySize;
    this.config.refreshTimeThreshold = refreshTimeThreshold;
    
    // Initialize eye objects
    this.leftEye = {
      center: [0, 0, 0],
      radius: 0.02,
      confidence: 0,
      detected: false
    };
    
    this.rightEye = {
      center: [0, 0, 0],
      radius: 0.02,
      confidence: 0,
      detected: false
    };

    this.lastUpdateTime = Date.now();
  }

  // Main detection method for both eyes
  detectEyeRegions(
    landmarks: NormalizedLandmark[],
    videoWidth: number,
    videoHeight: number,
    timestamp: number
  ): { left: EyeRegion | null, right: EyeRegion | null } {
    
    // Extract eye landmarks
    const leftEyeLandmarks = this.extractEyeLandmarks(landmarks, 'left');
    const rightEyeLandmarks = this.extractEyeLandmarks(landmarks, 'right');
    
    // Process each eye
    const leftEyeRegion = leftEyeLandmarks ? 
      this.processEyeRegion(leftEyeLandmarks, 'left', videoWidth, videoHeight, timestamp) : null;
    
    const rightEyeRegion = rightEyeLandmarks ? 
      this.processEyeRegion(rightEyeLandmarks, 'right', videoWidth, videoHeight, timestamp) : null;
    
    // Update internal state
    this.leftEyeRegion = leftEyeRegion;
    this.rightEyeRegion = rightEyeRegion;
    
    // Update 3D eye models
    this.update3DEyeModels(leftEyeRegion, rightEyeRegion, timestamp);
    
    return { left: leftEyeRegion, right: rightEyeRegion };
  }

  // Extract eye landmarks from MediaPipe face landmarks
  private extractEyeLandmarks(landmarks: NormalizedLandmark[], eye: 'left' | 'right'): NormalizedLandmark[] | null {
    if (landmarks.length < 468) return null; // MediaPipe face landmarks should have 468 points
    
    // MediaPipe eye landmark indices
    const leftEyeIndices = [
      33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
    ];
    
    const rightEyeIndices = [
      362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
    ];
    
    // Iris landmarks (if available)
    const leftIrisIndices = [469, 470, 471, 472]; // Left iris
    const rightIrisIndices = [474, 475, 476, 477]; // Right iris
    
    const indices = eye === 'left' ? 
      [...leftEyeIndices, ...leftIrisIndices] : 
      [...rightEyeIndices, ...rightIrisIndices];
    
    try {
      return indices.map(i => landmarks[i]).filter(l => l !== undefined);
    } catch {
      return null;
    }
  }

  // Process individual eye region
  private processEyeRegion(
    eyeLandmarks: NormalizedLandmark[],
    eye: 'left' | 'right',
    videoWidth: number,
    videoHeight: number,
    timestamp: number
  ): EyeRegion {
    
    // Calculate bounding box
    const boundingBox = this.calculateEyeBoundingBox(eyeLandmarks, videoWidth, videoHeight);
    
    // Detect pupil center
    const pupilCenter = this.detectPupilCenter(eyeLandmarks, boundingBox);
    
    // Calculate iris radius
    const irisRadius = this.calculateIrisRadius(eyeLandmarks, boundingBox);
    
    // Calculate eye openness
    const eyeOpenness = this.calculateEyeOpenness(eyeLandmarks);
    
    // Assess quality
    const quality = this.assessEyeQuality(eyeLandmarks, pupilCenter, eyeOpenness);
    
    // Store pupil data for smoothing
    if (pupilCenter) {
      this.storePupilData(eye, pupilCenter, irisRadius, quality.overall, timestamp);
    }
    
    return {
      landmarks: eyeLandmarks,
      boundingBox,
      pupilCenter: this.smoothPupilPosition(eye, pupilCenter),
      irisRadius,
      eyeOpenness,
      quality
    };
  }

  // Calculate eye bounding box
  private calculateEyeBoundingBox(
    eyeLandmarks: NormalizedLandmark[],
    videoWidth: number,
    videoHeight: number
  ): { x: number, y: number, width: number, height: number } {
    
    const xCoords = eyeLandmarks.map(l => l.x * videoWidth);
    const yCoords = eyeLandmarks.map(l => l.y * videoHeight);
    
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  // Detect pupil center using iris landmarks
  private detectPupilCenter(
    eyeLandmarks: NormalizedLandmark[],
    boundingBox: { x: number, y: number, width: number, height: number }
  ): { x: number, y: number } | null {
    
    // Try to use iris landmarks (last 4 landmarks should be iris)
    const irisLandmarks = eyeLandmarks.slice(-4);
    
    if (irisLandmarks.length === 4) {
      // Calculate center of iris landmarks
      const centerX = irisLandmarks.reduce((sum, l) => sum + l.x, 0) / 4;
      const centerY = irisLandmarks.reduce((sum, l) => sum + l.y, 0) / 4;
      
      return { x: centerX, y: centerY };
    }
    
    // Fallback: estimate pupil center as eye center
    const eyeCenterX = boundingBox.x + boundingBox.width / 2;
    const eyeCenterY = boundingBox.y + boundingBox.height / 2;
    
    return { x: eyeCenterX, y: eyeCenterY };
  }

  // Calculate iris radius
  private calculateIrisRadius(
    eyeLandmarks: NormalizedLandmark[],
    boundingBox: { x: number, y: number, width: number, height: number }
  ): number {
    
    // Use iris landmarks if available
    const irisLandmarks = eyeLandmarks.slice(-4);
    
    if (irisLandmarks.length === 4) {
      // Calculate radius from iris landmarks
      const center = {
        x: irisLandmarks.reduce((sum, l) => sum + l.x, 0) / 4,
        y: irisLandmarks.reduce((sum, l) => sum + l.y, 0) / 4
      };
      
      const distances = irisLandmarks.map(l => 
        Math.sqrt(Math.pow(l.x - center.x, 2) + Math.pow(l.y - center.y, 2))
      );
      
      return distances.reduce((sum, d) => sum + d, 0) / distances.length;
    }
    
    // Fallback: estimate as fraction of eye width
    return boundingBox.width * 0.3; // Iris is roughly 30% of eye width
  }

  // Calculate eye openness (0 = closed, 1 = fully open)
  private calculateEyeOpenness(eyeLandmarks: NormalizedLandmark[]): number {
    if (eyeLandmarks.length < 6) return 0.5; // Default if not enough landmarks
    
    // Calculate vertical distance between upper and lower eyelids
    // Using approximate indices for upper and lower eyelid points
    const upperEyelid = eyeLandmarks.slice(1, 4); // Upper eyelid points
    const lowerEyelid = eyeLandmarks.slice(4, 7); // Lower eyelid points
    
    if (upperEyelid.length === 0 || lowerEyelid.length === 0) return 0.5;
    
    // Calculate average vertical distance
    let totalDistance = 0;
    let pointCount = 0;
    
    for (let i = 0; i < Math.min(upperEyelid.length, lowerEyelid.length); i++) {
      const distance = Math.abs(upperEyelid[i].y - lowerEyelid[i].y);
      totalDistance += distance;
      pointCount++;
    }
    
    const averageDistance = pointCount > 0 ? totalDistance / pointCount : 0;
    
    // Normalize to 0-1 range (this threshold may need adjustment)
    const maxEyeOpenness = 0.03; // Typical max eye openness in normalized coordinates
    return Math.min(1, averageDistance / maxEyeOpenness);
  }

  // Assess eye quality
  private assessEyeQuality(
    eyeLandmarks: NormalizedLandmark[],
    pupilCenter: { x: number, y: number } | null,
    eyeOpenness: number
  ): EyeQuality {
    
    // Visibility based on landmark visibility scores
    const visibilityScores = eyeLandmarks
      .map(l => l.visibility || 0)
      .filter(v => v > 0);
    
    const visibility = visibilityScores.length > 0 ?
      visibilityScores.reduce((sum, v) => sum + v, 0) / visibilityScores.length : 0;
    
    // Tracking quality based on pupil detection success
    const tracking = pupilCenter ? 0.8 : 0.3;
    
    // Sharpness estimation (simplified)
    const sharpness = visibility * 0.8 + tracking * 0.2;
    
    // Contrast estimation (simplified)
    const contrast = eyeOpenness > this.config.eyeClosureThreshold ? 0.8 : 0.3;
    
    // Overall quality
    const overall = (sharpness + contrast + visibility + tracking) / 4;
    
    return {
      sharpness,
      contrast,
      visibility,
      tracking,
      overall
    };
  }

  // Store pupil data for smoothing
  private storePupilData(
    eye: 'left' | 'right',
    pupilCenter: { x: number, y: number },
    radius: number,
    confidence: number,
    timestamp: number
  ): void {
    
    if (!this.pupilHistory.has(eye)) {
      this.pupilHistory.set(eye, []);
    }
    
    const history = this.pupilHistory.get(eye)!;
    
    const pupilData: PupilData = {
      center: pupilCenter,
      radius,
      confidence,
      timestamp
    };
    
    history.push(pupilData);
    
    // Keep only recent data
    const cutoffTime = timestamp - this.config.refreshTimeThreshold;
    this.pupilHistory.set(eye, history.filter(d => d.timestamp > cutoffTime));
    
    // Limit history size
    if (history.length > this.config.smoothingWindow) {
      this.pupilHistory.set(eye, history.slice(-this.config.smoothingWindow));
    }
  }

  // Smooth pupil position using recent history
  private smoothPupilPosition(
    eye: 'left' | 'right',
    currentPosition: { x: number, y: number } | null
  ): { x: number, y: number } | null {
    
    if (!currentPosition) return null;
    
    const history = this.pupilHistory.get(eye);
    if (!history || history.length === 0) return currentPosition;
    
    // Weighted average based on confidence
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    
    for (const data of history) {
      const weight = data.confidence;
      weightedX += data.center.x * weight;
      weightedY += data.center.y * weight;
      totalWeight += weight;
    }
    
    if (totalWeight === 0) return currentPosition;
    
    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight
    };
  }

  // Update 3D eye models
  private update3DEyeModels(
    leftEye: EyeRegion | null,
    rightEye: EyeRegion | null,
    timestamp: number
  ): void {
    
    // Update left eye 3D model
    if (leftEye && leftEye.quality.overall > this.config.minConfidence) {
      this.leftEye.detected = true;
      this.leftEye.confidence = leftEye.quality.overall;
      // 3D center estimation would go here (simplified for now)
      this.leftEye.center = [leftEye.boundingBox.x, leftEye.boundingBox.y, 0];
      this.leftEye.radius = leftEye.irisRadius;
    } else {
      this.leftEye.detected = false;
      this.leftEye.confidence = 0;
    }
    
    // Update right eye 3D model
    if (rightEye && rightEye.quality.overall > this.config.minConfidence) {
      this.rightEye.detected = true;
      this.rightEye.confidence = rightEye.quality.overall;
      // 3D center estimation would go here (simplified for now)
      this.rightEye.center = [rightEye.boundingBox.x, rightEye.boundingBox.y, 0];
      this.rightEye.radius = rightEye.irisRadius;
    } else {
      this.rightEye.detected = false;
      this.rightEye.confidence = 0;
    }
    
    // Update overall confidence and detection status
    this.currentConfidence = Math.max(this.leftEye.confidence, this.rightEye.confidence);
    this.centerDetected = this.leftEye.detected || this.rightEye.detected;
    this.searchCompleted = this.currentConfidence > this.config.reasonableConfidence;
    
    this.lastUpdateTime = timestamp;
  }

  // Public getter methods
  getLeftEyeRegion(): EyeRegion | null {
    return this.leftEyeRegion;
  }

  getRightEyeRegion(): EyeRegion | null {
    return this.rightEyeRegion;
  }

  // Check if eyes are closed
  areEyesClosed(): boolean {
    const leftClosed = !this.leftEyeRegion || 
      this.leftEyeRegion.eyeOpenness < this.config.eyeClosureThreshold;
    const rightClosed = !this.rightEyeRegion || 
      this.rightEyeRegion.eyeOpenness < this.config.eyeClosureThreshold;
    
    return leftClosed && rightClosed;
  }

  // Get best eye for gaze estimation
  getBestEyeForGaze(): 'left' | 'right' | null {
    if (!this.leftEyeRegion && !this.rightEyeRegion) return null;
    
    if (!this.leftEyeRegion) return 'right';
    if (!this.rightEyeRegion) return 'left';
    
    // Choose eye with better quality
    return this.leftEyeRegion.quality.overall >= this.rightEyeRegion.quality.overall ? 
      'left' : 'right';
  }

  // Reset detector state
  reset(): void {
    this.leftEyeRegion = null;
    this.rightEyeRegion = null;
    this.pupilHistory.clear();
    this.currentConfidence = 0;
    this.centerDetected = false;
    this.searchCompleted = false;
    
    // Reset 3D models
    this.leftEye.detected = false;
    this.leftEye.confidence = 0;
    this.rightEye.detected = false;
    this.rightEye.confidence = 0;
  }
}
