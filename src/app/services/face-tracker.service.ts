import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface FaceData {
  landmarks: NormalizedLandmark[];
  boundingBox: { x: number, y: number, width: number, height: number };
  confidence: number;
  faceId: string;
  timestamp: number;
  quality: FaceQuality;
}

export interface FaceQuality {
  landmarkCount: number;
  averageVisibility: number;
  faceSize: number; // Relative to image size
  lightingQuality: 'good' | 'poor' | 'adequate';
  blurriness: number; // 0-1, 0 = sharp, 1 = very blurry
  headPoseScore: number; // 0-1, 1 = frontal pose
  overallScore: number; // 0-1, combined quality score
}

export interface FaceStability {
  positionStability: number; // 0-1
  sizeStability: number; // 0-1
  landmarkStability: number; // 0-1
  overallStability: number; // 0-1
  trackingLoss: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FaceTrackerService {
  private currentFace$ = new BehaviorSubject<FaceData | null>(null);
  private faceStability$ = new BehaviorSubject<FaceStability | null>(null);
  
  // Face tracking history for stability calculation
  private faceHistory: FaceData[] = [];
  private maxHistorySize = 30; // Keep last 30 frames (~1 second at 30fps)
  
  // Face tracking parameters
  private readonly config = {
    minFaceSize: 0.1, // Minimum face size relative to image
    maxFaceSize: 0.8, // Maximum face size relative to image
    minConfidence: 0.7,
    minLandmarkVisibility: 0.5,
    stabilityWindow: 10, // Frames to consider for stability
    maxTrackingLoss: 5 // Max frames without detection before tracking loss
  };
  
  private trackingLossCount = 0;
  private lastValidFace: FaceData | null = null;

  constructor() { }

  // Main face detection and tracking method
  detectAndTrackFace(
    mediaPipeResult: FaceLandmarkerResult, 
    videoWidth: number, 
    videoHeight: number,
    timestamp: number
  ): FaceData | null {
    
    if (!mediaPipeResult?.faceLandmarks || mediaPipeResult.faceLandmarks.length === 0) {
      this.handleTrackingLoss();
      return null;
    }

    const landmarks = mediaPipeResult.faceLandmarks[0];
    
    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(landmarks, videoWidth, videoHeight);
    
    // Assess face quality
    const quality = this.assessFaceQuality(landmarks, boundingBox, videoWidth, videoHeight);
    
    // Check if face meets minimum quality requirements
    if (!this.validateFaceQuality(quality)) {
      this.handleTrackingLoss();
      return null;
    }

    // Create face data
    const faceData: FaceData = {
      landmarks,
      boundingBox,
      confidence: quality.overallScore,
      faceId: this.generateFaceId(landmarks),
      timestamp,
      quality
    };

    // Update tracking state
    this.updateTracking(faceData);
    
    return faceData;
  }

  // Calculate bounding box from landmarks
  private calculateBoundingBox(
    landmarks: NormalizedLandmark[], 
    videoWidth: number, 
    videoHeight: number
  ): { x: number, y: number, width: number, height: number } {
    
    const xCoords = landmarks.map(l => l.x * videoWidth);
    const yCoords = landmarks.map(l => l.y * videoHeight);
    
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

  // Assess face quality based on various factors
  private assessFaceQuality(
    landmarks: NormalizedLandmark[], 
    boundingBox: { width: number, height: number },
    videoWidth: number, 
    videoHeight: number
  ): FaceQuality {
    
    // Landmark count and visibility
    const landmarkCount = landmarks.length;
    const visibleLandmarks = landmarks.filter(l => (l.visibility || 0) > this.config.minLandmarkVisibility);
    const averageVisibility = visibleLandmarks.length > 0 
      ? visibleLandmarks.reduce((sum, l) => sum + (l.visibility || 0), 0) / visibleLandmarks.length
      : 0;

    // Face size relative to image
    const imageArea = videoWidth * videoHeight;
    const faceArea = boundingBox.width * boundingBox.height;
    const faceSize = faceArea / imageArea;

    // Lighting quality (simplified based on landmark visibility)
    const lightingQuality = averageVisibility > 0.8 ? 'good' : 
                           averageVisibility > 0.6 ? 'adequate' : 'poor';

    // Blurriness estimation (simplified)
    const blurriness = this.estimateBlurriness(landmarks);

    // Head pose score (frontal vs profile)
    const headPoseScore = this.calculateHeadPoseScore(landmarks);

    // Overall score calculation
    const sizeScore = this.calculateSizeScore(faceSize);
    const visibilityScore = averageVisibility;
    const poseScore = headPoseScore;
    const sharpnessScore = 1 - blurriness;
    
    const overallScore = (sizeScore + visibilityScore + poseScore + sharpnessScore) / 4;

    return {
      landmarkCount,
      averageVisibility,
      faceSize,
      lightingQuality,
      blurriness,
      headPoseScore,
      overallScore
    };
  }

  // Estimate blurriness from landmark positions (simplified)
  private estimateBlurriness(landmarks: NormalizedLandmark[]): number {
    // This is a simplified estimation
    // In a real implementation, you might analyze edge sharpness
    
    // Check landmark position variance as a proxy for stability/sharpness
    const positions = landmarks.map(l => ({ x: l.x, y: l.y }));
    
    // Calculate variance in landmark positions
    let variance = 0;
    for (let i = 1; i < positions.length; i++) {
      const dx = positions[i].x - positions[i-1].x;
      const dy = positions[i].y - positions[i-1].y;
      variance += dx * dx + dy * dy;
    }
    
    variance /= positions.length;
    
    // Convert to blurriness score (0-1)
    return Math.min(1, variance * 1000); // Scale factor may need adjustment
  }

  // Calculate head pose score (0 = profile, 1 = frontal)
  private calculateHeadPoseScore(landmarks: NormalizedLandmark[]): number {
    if (landmarks.length < 468) return 0.5; // Default if not enough landmarks
    
    // Use specific landmark indices for nose and face outline
    const noseTip = landmarks[1]; // Nose tip
    const leftFace = landmarks[234]; // Left face contour
    const rightFace = landmarks[454]; // Right face contour
    
    if (!noseTip || !leftFace || !rightFace) return 0.5;
    
    // Calculate asymmetry
    const leftDistance = Math.abs(noseTip.x - leftFace.x);
    const rightDistance = Math.abs(rightFace.x - noseTip.x);
    
    const asymmetry = Math.abs(leftDistance - rightDistance) / (leftDistance + rightDistance);
    
    // Convert to frontal score (lower asymmetry = more frontal)
    return Math.max(0, 1 - asymmetry * 2);
  }

  // Calculate size score based on optimal face size
  private calculateSizeScore(faceSize: number): number {
    const optimal = 0.25; // 25% of image area is optimal
    const distance = Math.abs(faceSize - optimal);
    
    // Score decreases as we move away from optimal size
    return Math.max(0, 1 - distance * 4);
  }

  // Validate if face quality meets minimum requirements
  private validateFaceQuality(quality: FaceQuality): boolean {
    return quality.overallScore >= this.config.minConfidence &&
           quality.faceSize >= this.config.minFaceSize &&
           quality.faceSize <= this.config.maxFaceSize &&
           quality.averageVisibility >= this.config.minLandmarkVisibility;
  }

  // Generate unique face ID for tracking
  private generateFaceId(landmarks: NormalizedLandmark[]): string {
    // Create a simple hash from landmark positions
    const positions = landmarks.slice(0, 10).map(l => `${l.x.toFixed(3)},${l.y.toFixed(3)}`).join('|');
    return btoa(positions).substring(0, 8);
  }

  // Update tracking state and calculate stability
  private updateTracking(faceData: FaceData): void {
    // Add to history
    this.faceHistory.push(faceData);
    
    // Maintain history size
    if (this.faceHistory.length > this.maxHistorySize) {
      this.faceHistory = this.faceHistory.slice(-this.maxHistorySize);
    }
    
    // Reset tracking loss counter
    this.trackingLossCount = 0;
    this.lastValidFace = faceData;
    
    // Calculate stability
    const stability = this.calculateStability();
    
    // Update observables
    this.currentFace$.next(faceData);
    this.faceStability$.next(stability);
  }

  // Handle tracking loss
  private handleTrackingLoss(): void {
    this.trackingLossCount++;
    
    if (this.trackingLossCount >= this.config.maxTrackingLoss) {
      // Complete tracking loss
      const stability: FaceStability = {
        positionStability: 0,
        sizeStability: 0,
        landmarkStability: 0,
        overallStability: 0,
        trackingLoss: true
      };
      
      this.currentFace$.next(null);
      this.faceStability$.next(stability);
    }
  }

  // Calculate face stability metrics
  private calculateStability(): FaceStability {
    if (this.faceHistory.length < 2) {
      return {
        positionStability: 1,
        sizeStability: 1,
        landmarkStability: 1,
        overallStability: 1,
        trackingLoss: false
      };
    }

    const recentFrames = this.faceHistory.slice(-this.config.stabilityWindow);
    
    // Position stability
    const positionStability = this.calculatePositionStability(recentFrames);
    
    // Size stability
    const sizeStability = this.calculateSizeStability(recentFrames);
    
    // Landmark stability
    const landmarkStability = this.calculateLandmarkStability(recentFrames);
    
    // Overall stability
    const overallStability = (positionStability + sizeStability + landmarkStability) / 3;
    
    return {
      positionStability,
      sizeStability,
      landmarkStability,
      overallStability,
      trackingLoss: false
    };
  }

  // Calculate position stability
  private calculatePositionStability(frames: FaceData[]): number {
    if (frames.length < 2) return 1;
    
    const centerPositions = frames.map(frame => ({
      x: frame.boundingBox.x + frame.boundingBox.width / 2,
      y: frame.boundingBox.y + frame.boundingBox.height / 2
    }));
    
    let totalMovement = 0;
    for (let i = 1; i < centerPositions.length; i++) {
      const dx = centerPositions[i].x - centerPositions[i-1].x;
      const dy = centerPositions[i].y - centerPositions[i-1].y;
      totalMovement += Math.sqrt(dx * dx + dy * dy);
    }
    
    const averageMovement = totalMovement / (centerPositions.length - 1);
    
    // Convert to stability score (less movement = more stable)
    return Math.max(0, 1 - averageMovement * 10); // Scale factor may need adjustment
  }

  // Calculate size stability
  private calculateSizeStability(frames: FaceData[]): number {
    if (frames.length < 2) return 1;
    
    const sizes = frames.map(frame => frame.boundingBox.width * frame.boundingBox.height);
    
    const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Convert to stability score
    const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 0;
    return Math.max(0, 1 - coefficientOfVariation * 5);
  }

  // Calculate landmark stability
  private calculateLandmarkStability(frames: FaceData[]): number {
    if (frames.length < 2) return 1;
    
    let totalVariation = 0;
    const landmarkCount = Math.min(...frames.map(f => f.landmarks.length));
    
    for (let i = 0; i < landmarkCount; i++) {
      const landmarkPositions = frames.map(frame => frame.landmarks[i]);
      
      let landmarkVariation = 0;
      for (let j = 1; j < landmarkPositions.length; j++) {
        const dx = landmarkPositions[j].x - landmarkPositions[j-1].x;
        const dy = landmarkPositions[j].y - landmarkPositions[j-1].y;
        landmarkVariation += Math.sqrt(dx * dx + dy * dy);
      }
      
      totalVariation += landmarkVariation / (landmarkPositions.length - 1);
    }
    
    const averageLandmarkVariation = totalVariation / landmarkCount;
    
    // Convert to stability score
    return Math.max(0, 1 - averageLandmarkVariation * 100);
  }

  // Public methods for getting tracking state
  getCurrentFace(): FaceData | null {
    return this.currentFace$.value;
  }

  getFaceStability(): FaceStability | null {
    return this.faceStability$.value;
  }

  // Check if face tracking is active
  isTrackingActive(): boolean {
    return this.currentFace$.value !== null && !this.getFaceStability()?.trackingLoss;
  }

  // Get face tracking confidence
  getTrackingConfidence(): number {
    const face = this.getCurrentFace();
    return face ? face.confidence : 0;
  }

  // Reset tracking state
  resetTracking(): void {
    this.faceHistory = [];
    this.trackingLossCount = 0;
    this.lastValidFace = null;
    this.currentFace$.next(null);
    this.faceStability$.next(null);
  }

  // Update configuration
  updateConfiguration(newConfig: Partial<typeof this.config>): void {
    Object.assign(this.config, newConfig);
  }

  // Observable getters
  get currentFace(): Observable<FaceData | null> {
    return this.currentFace$.asObservable();
  }

  get faceStability(): Observable<FaceStability | null> {
    return this.faceStability$.asObservable();
  }
}
