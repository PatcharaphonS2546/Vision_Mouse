import { Injectable } from '@angular/core';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { BehaviorSubject, Observable } from 'rxjs';

export interface HeadPose {
  roll: number;    // Rotation around Z-axis (head tilt left/right)
  pitch: number;   // Rotation around X-axis (head up/down)
  yaw: number;     // Rotation around Y-axis (head left/right)
  confidence: number;
  timestamp: number;
}

export interface HeadMovement {
  velocity: { roll: number, pitch: number, yaw: number };
  acceleration: { roll: number, pitch: number, yaw: number };
  stability: number; // 0-1, higher = more stable
  tracking: boolean;
}

export interface HeadPoseQuality {
  accuracy: number; // 0-1
  stability: number; // 0-1
  trackingReliability: number; // 0-1
  overall: number; // 0-1
}

@Injectable({
  providedIn: 'root'
})
export class HeadPoseService {
  private currentPose$ = new BehaviorSubject<HeadPose | null>(null);
  private headMovement$ = new BehaviorSubject<HeadMovement | null>(null);
  private poseQuality$ = new BehaviorSubject<HeadPoseQuality | null>(null);
  
  // Head pose history for movement calculation
  private poseHistory: HeadPose[] = [];
  private readonly maxHistorySize = 30; // ~1 second at 30fps
  
  // 3D model points for PnP solver (in model coordinate system)
  private readonly modelPoints = [
    [0.0, 0.0, 0.0],       // Nose tip
    [0.0, -330.0, -65.0],  // Chin
    [-225.0, 170.0, -135.0], // Left eye left corner
    [225.0, 170.0, -135.0],  // Right eye right corner
    [-150.0, -150.0, -125.0], // Left mouth corner
    [150.0, -150.0, -125.0]   // Right mouth corner
  ];
  
  // Corresponding landmark indices from MediaPipe
  private readonly landmarkIndices = [
    1,   // Nose tip
    18,  // Chin
    33,  // Left eye left corner
    362, // Right eye right corner
    61,  // Left mouth corner
    291  // Right mouth corner
  ];

  // Camera parameters (estimated for typical webcam)
  private cameraMatrix = [
    [800, 0, 320],
    [0, 800, 240],
    [0, 0, 1]
  ];
  
  private distCoeffs = [0.1, -0.2, 0, 0, 0]; // Simplified distortion

  constructor() { }

  // Main head pose estimation method
  estimateHeadPose(
    landmarks: NormalizedLandmark[],
    imageWidth: number,
    imageHeight: number,
    timestamp: number
  ): HeadPose | null {
    
    if (landmarks.length < Math.max(...this.landmarkIndices) + 1) {
      return null;
    }

    try {
      // Extract 2D image points
      const imagePoints = this.extractImagePoints(landmarks, imageWidth, imageHeight);
      
      // Update camera matrix for current image size
      this.updateCameraMatrix(imageWidth, imageHeight);
      
      // Solve PnP to get rotation and translation vectors
      const pose = this.solvePnP(imagePoints);
      
      if (!pose) return null;
      
      // Calculate quality metrics
      const quality = this.assessPoseQuality(pose, landmarks);
      
      // Update pose history and calculate movement
      this.updatePoseHistory(pose);
      
      // Update observables
      this.currentPose$.next(pose);
      this.poseQuality$.next(quality);
      
      const movement = this.calculateHeadMovement();
      this.headMovement$.next(movement);
      
      return pose;
      
    } catch (error) {
      console.error('Head pose estimation error:', error);
      return null;
    }
  }

  // Extract 2D image points from landmarks
  private extractImagePoints(
    landmarks: NormalizedLandmark[],
    imageWidth: number,
    imageHeight: number
  ): number[][] {
    
    return this.landmarkIndices.map(index => {
      const landmark = landmarks[index];
      return [
        landmark.x * imageWidth,
        landmark.y * imageHeight
      ];
    });
  }

  // Update camera matrix for current image dimensions
  private updateCameraMatrix(imageWidth: number, imageHeight: number): void {
    // Estimate focal length based on image width
    const focalLength = imageWidth * 0.8; // Typical assumption
    
    this.cameraMatrix = [
      [focalLength, 0, imageWidth / 2],
      [0, focalLength, imageHeight / 2],
      [0, 0, 1]
    ];
  }

  // Solve PnP problem to get head pose
  private solvePnP(imagePoints: number[][]): HeadPose | null {
    // This is a simplified PnP solver
    // In production, you might use OpenCV.js or a more robust implementation
    
    try {
      // Calculate pose using simplified geometric approach
      const pose = this.simplifiedPoseEstimation(imagePoints);
      
      return {
        roll: pose.roll,
        pitch: pose.pitch,
        yaw: pose.yaw,
        confidence: pose.confidence,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('PnP solver error:', error);
      return null;
    }
  }

  // Simplified pose estimation (geometric approach)
  private simplifiedPoseEstimation(imagePoints: number[][]): HeadPose {
    // Extract key points
    const noseTip = imagePoints[0];
    const chin = imagePoints[1];
    const leftEye = imagePoints[2];
    const rightEye = imagePoints[3];
    const leftMouth = imagePoints[4];
    const rightMouth = imagePoints[5];
    
    // Calculate face center
    const faceCenter = [
      (leftEye[0] + rightEye[0]) / 2,
      (leftEye[1] + rightEye[1]) / 2
    ];
    
    // Calculate yaw (left/right rotation)
    const eyeDistance = Math.sqrt(
      Math.pow(rightEye[0] - leftEye[0], 2) + 
      Math.pow(rightEye[1] - leftEye[1], 2)
    );
    
    const noseToCenter = noseTip[0] - faceCenter[0];
    const yaw = Math.atan2(noseToCenter, eyeDistance) * (180 / Math.PI);
    
    // Calculate pitch (up/down rotation)
    const noseToEyeDistance = Math.sqrt(
      Math.pow(noseTip[0] - faceCenter[0], 2) + 
      Math.pow(noseTip[1] - faceCenter[1], 2)
    );
    
    const noseToChinDistance = Math.sqrt(
      Math.pow(chin[0] - noseTip[0], 2) + 
      Math.pow(chin[1] - noseTip[1], 2)
    );
    
    const verticalOffset = (noseTip[1] - faceCenter[1]) / noseToEyeDistance;
    const pitch = Math.atan(verticalOffset) * (180 / Math.PI);
    
    // Calculate roll (head tilt)
    const eyeSlope = (rightEye[1] - leftEye[1]) / (rightEye[0] - leftEye[0]);
    const roll = Math.atan(eyeSlope) * (180 / Math.PI);
    
    // Calculate confidence based on feature symmetry and visibility
    const confidence = this.calculatePoseConfidence(imagePoints);
    
    return {
      roll: this.normalizeAngle(roll),
      pitch: this.normalizeAngle(pitch),
      yaw: this.normalizeAngle(yaw),
      confidence,
      timestamp: Date.now()
    };
  }

  // Calculate pose confidence based on feature quality
  private calculatePoseConfidence(imagePoints: number[][]): number {
    // Check if all points are within reasonable bounds
    const imageWidth = this.cameraMatrix[0][2] * 2;
    const imageHeight = this.cameraMatrix[1][2] * 2;
    
    let validPoints = 0;
    
    for (const point of imagePoints) {
      if (point[0] >= 0 && point[0] <= imageWidth && 
          point[1] >= 0 && point[1] <= imageHeight) {
        validPoints++;
      }
    }
    
    const pointConfidence = validPoints / imagePoints.length;
    
    // Check facial symmetry
    const leftEye = imagePoints[2];
    const rightEye = imagePoints[3];
    const leftMouth = imagePoints[4];
    const rightMouth = imagePoints[5];
    
    const eyeSymmetry = 1 - Math.abs(
      (leftEye[1] + rightEye[1]) / 2 - (leftMouth[1] + rightMouth[1]) / 2
    ) / imageHeight;
    
    return (pointConfidence + eyeSymmetry) / 2;
  }

  // Normalize angle to [-180, 180] range
  private normalizeAngle(angle: number): number {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  // Assess pose quality
  private assessPoseQuality(pose: HeadPose, landmarks: NormalizedLandmark[]): HeadPoseQuality {
    // Accuracy based on landmark visibility
    const relevantLandmarks = this.landmarkIndices.map(i => landmarks[i]);
    const visibilityScores = relevantLandmarks.map(l => l.visibility || 0);
    const accuracy = visibilityScores.reduce((sum, v) => sum + v, 0) / visibilityScores.length;
    
    // Stability based on recent pose history
    const stability = this.calculatePoseStability();
    
    // Tracking reliability based on confidence and history
    const trackingReliability = pose.confidence * Math.min(1, this.poseHistory.length / 10);
    
    const overall = (accuracy + stability + trackingReliability) / 3;
    
    return {
      accuracy,
      stability,
      trackingReliability,
      overall
    };
  }

  // Update pose history
  private updatePoseHistory(pose: HeadPose): void {
    this.poseHistory.push(pose);
    
    // Maintain history size
    if (this.poseHistory.length > this.maxHistorySize) {
      this.poseHistory = this.poseHistory.slice(-this.maxHistorySize);
    }
  }

  // Calculate pose stability
  private calculatePoseStability(): number {
    if (this.poseHistory.length < 3) return 1;
    
    const recentPoses = this.poseHistory.slice(-5); // Last 5 poses
    
    // Calculate variance in each rotation axis
    const rollValues = recentPoses.map(p => p.roll);
    const pitchValues = recentPoses.map(p => p.pitch);
    const yawValues = recentPoses.map(p => p.yaw);
    
    const rollVariance = this.calculateVariance(rollValues);
    const pitchVariance = this.calculateVariance(pitchValues);
    const yawVariance = this.calculateVariance(yawValues);
    
    // Convert variance to stability score (lower variance = higher stability)
    const maxVariance = 10; // degrees squared
    const rollStability = Math.max(0, 1 - rollVariance / maxVariance);
    const pitchStability = Math.max(0, 1 - pitchVariance / maxVariance);
    const yawStability = Math.max(0, 1 - yawVariance / maxVariance);
    
    return (rollStability + pitchStability + yawStability) / 3;
  }

  // Calculate variance of an array
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  }

  // Calculate head movement metrics
  private calculateHeadMovement(): HeadMovement {
    if (this.poseHistory.length < 3) {
      return {
        velocity: { roll: 0, pitch: 0, yaw: 0 },
        acceleration: { roll: 0, pitch: 0, yaw: 0 },
        stability: 1,
        tracking: true
      };
    }
    
    const current = this.poseHistory[this.poseHistory.length - 1];
    const previous = this.poseHistory[this.poseHistory.length - 2];
    const beforePrevious = this.poseHistory[this.poseHistory.length - 3];
    
    const timeDelta = (current.timestamp - previous.timestamp) / 1000; // seconds
    
    // Calculate velocity (change per second)
    const velocity = {
      roll: (current.roll - previous.roll) / timeDelta,
      pitch: (current.pitch - previous.pitch) / timeDelta,
      yaw: (current.yaw - previous.yaw) / timeDelta
    };
    
    // Calculate acceleration (change in velocity per second)
    const prevTimeDelta = (previous.timestamp - beforePrevious.timestamp) / 1000;
    const prevVelocity = {
      roll: (previous.roll - beforePrevious.roll) / prevTimeDelta,
      pitch: (previous.pitch - beforePrevious.pitch) / prevTimeDelta,
      yaw: (previous.yaw - beforePrevious.yaw) / prevTimeDelta
    };
    
    const acceleration = {
      roll: (velocity.roll - prevVelocity.roll) / timeDelta,
      pitch: (velocity.pitch - prevVelocity.pitch) / timeDelta,
      yaw: (velocity.yaw - prevVelocity.yaw) / timeDelta
    };
    
    // Calculate overall movement stability
    const velocityMagnitude = Math.sqrt(
      velocity.roll * velocity.roll + 
      velocity.pitch * velocity.pitch + 
      velocity.yaw * velocity.yaw
    );
    
    const stability = Math.max(0, 1 - velocityMagnitude / 50); // 50 deg/s as max
    
    return {
      velocity,
      acceleration,
      stability,
      tracking: true
    };
  }

  // Compensate gaze estimation for head movement
  compensateGazeForHeadPose(
    gazeVector: { x: number, y: number },
    headPose: HeadPose
  ): { x: number, y: number } {
    
    // Convert angles to radians
    const rollRad = (headPose.roll * Math.PI) / 180;
    const pitchRad = (headPose.pitch * Math.PI) / 180;
    const yawRad = (headPose.yaw * Math.PI) / 180;
    
    // Apply rotation compensation
    // This is a simplified compensation - in practice, you'd use full 3D rotation matrices
    
    let compensatedX = gazeVector.x;
    let compensatedY = gazeVector.y;
    
    // Yaw compensation (left/right head movement)
    compensatedX = gazeVector.x + (yawRad * 0.5); // Scale factor may need tuning
    
    // Pitch compensation (up/down head movement)
    compensatedY = gazeVector.y + (pitchRad * 0.5); // Scale factor may need tuning
    
    // Roll compensation affects both X and Y
    const cosRoll = Math.cos(rollRad);
    const sinRoll = Math.sin(rollRad);
    
    const finalX = compensatedX * cosRoll - compensatedY * sinRoll;
    const finalY = compensatedX * sinRoll + compensatedY * cosRoll;
    
    return { x: finalX, y: finalY };
  }

  // Check if head pose is suitable for gaze estimation
  isHeadPoseSuitableForGaze(headPose: HeadPose): boolean {
    const maxYaw = 30;   // degrees
    const maxPitch = 25; // degrees
    const maxRoll = 20;  // degrees
    const minConfidence = 0.7;
    
    return Math.abs(headPose.yaw) <= maxYaw &&
           Math.abs(headPose.pitch) <= maxPitch &&
           Math.abs(headPose.roll) <= maxRoll &&
           headPose.confidence >= minConfidence;
  }

  // Get current head pose
  getCurrentHeadPose(): HeadPose | null {
    return this.currentPose$.value;
  }

  // Get head movement data
  getHeadMovement(): HeadMovement | null {
    return this.headMovement$.value;
  }

  // Reset head pose tracking
  reset(): void {
    this.poseHistory = [];
    this.currentPose$.next(null);
    this.headMovement$.next(null);
    this.poseQuality$.next(null);
  }

  // Observable getters
  get currentPose(): Observable<HeadPose | null> {
    return this.currentPose$.asObservable();
  }

  get headMovement(): Observable<HeadMovement | null> {
    return this.headMovement$.asObservable();
  }

  get poseQuality(): Observable<HeadPoseQuality | null> {
    return this.poseQuality$.asObservable();
  }
}
