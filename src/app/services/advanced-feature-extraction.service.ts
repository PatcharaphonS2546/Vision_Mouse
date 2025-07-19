import { Injectable } from '@angular/core';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FaceData } from './face-tracker.service';
import { HeadPose } from './head-pose.service';
import { EyeRegion } from './enhanced-eyeball-detector';

export interface FeatureSet {
  geometric: number[];
  appearance: number[];
  temporal: number[];
  contextual: number[];
  combined: number[];
  metadata: FeatureMetadata;
}

export interface FeatureMetadata {
  extractionTime: number;
  featureCount: number;
  quality: number;
  confidence: number;
  source: string;
  version: string;
}

export interface ExtractionConfig {
  includeGeometric: boolean;
  includeAppearance: boolean;
  includeTemporal: boolean;
  includeContextual: boolean;
  geometricComplexity: 'basic' | 'intermediate' | 'advanced';
  temporalWindow: number;
  normalizationMethod: 'none' | 'local' | 'global';
  featureSelection: boolean;
  dimensionalityReduction: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdvancedFeatureExtractionService {
  private config: ExtractionConfig = {
    includeGeometric: true,
    includeAppearance: true,
    includeTemporal: true,
    includeContextual: true,
    geometricComplexity: 'advanced',
    temporalWindow: 10,
    normalizationMethod: 'local',
    featureSelection: true,
    dimensionalityReduction: false
  };

  // Feature extraction history for temporal features
  private extractionHistory: FeatureSet[] = [];
  private readonly maxHistorySize = 50;

  // Pre-computed feature indices for efficiency
  private readonly FACE_OUTLINE_INDICES = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  ];

  private readonly EYE_LANDMARK_INDICES = {
    leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
    leftIris: [469, 470, 471, 472],
    rightIris: [474, 475, 476, 477]
  };

  private readonly MOUTH_INDICES = [
    78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
    415, 310, 311, 312, 13, 82, 81, 80, 78
  ];

  constructor() { }

  // Main feature extraction method
  extractAdvancedFeatures(
    landmarks: NormalizedLandmark[],
    faceData?: FaceData,
    headPose?: HeadPose,
    eyeRegions?: { left: EyeRegion | null, right: EyeRegion | null },
    timestamp: number = Date.now()
  ): FeatureSet | null {

    const startTime = performance.now();

    try {
      const featureSet: FeatureSet = {
        geometric: [],
        appearance: [],
        temporal: [],
        contextual: [],
        combined: [],
        metadata: {
          extractionTime: 0,
          featureCount: 0,
          quality: 0,
          confidence: 0,
          source: 'advanced-extractor',
          version: '3.0'
        }
      };

      // Extract geometric features
      if (this.config.includeGeometric) {
        featureSet.geometric = this.extractGeometricFeatures(landmarks, faceData, headPose, eyeRegions);
      }

      // Extract appearance features
      if (this.config.includeAppearance) {
        featureSet.appearance = this.extractAppearanceFeatures(landmarks, faceData, eyeRegions);
      }

      // Extract temporal features
      if (this.config.includeTemporal && this.extractionHistory.length > 0) {
        featureSet.temporal = this.extractTemporalFeatures();
      }

      // Extract contextual features
      if (this.config.includeContextual) {
        featureSet.contextual = this.extractContextualFeatures(faceData, headPose, eyeRegions);
      }

      // Combine all features
      featureSet.combined = this.combineFeatures(featureSet);

      // Apply normalization if needed
      if (this.config.normalizationMethod !== 'none') {
        this.normalizeFeatureSet(featureSet);
      }

      // Calculate metadata
      const extractionTime = performance.now() - startTime;
      featureSet.metadata = this.calculateMetadata(featureSet, extractionTime, faceData, headPose, eyeRegions);

      // Add to history for temporal features
      this.addToHistory(featureSet);

      return featureSet;

    } catch (error) {
      console.error('Advanced feature extraction error:', error);
      return null;
    }
  }

  // Extract geometric features from facial landmarks
  private extractGeometricFeatures(
    landmarks: NormalizedLandmark[],
    faceData?: FaceData,
    headPose?: HeadPose,
    eyeRegions?: { left: EyeRegion | null, right: EyeRegion | null }
  ): number[] {

    const features: number[] = [];

    // Basic landmark coordinates (normalized)
    if (this.config.geometricComplexity === 'basic') {
      // Just extract key landmark positions
      const keyIndices = [1, 33, 362, 61, 291, 17]; // Nose, eyes, mouth corners, chin
      for (const idx of keyIndices) {
        if (landmarks[idx]) {
          features.push(landmarks[idx].x, landmarks[idx].y);
        }
      }
    }

    // Intermediate geometric features
    if (this.config.geometricComplexity === 'intermediate' || this.config.geometricComplexity === 'advanced') {
      // Eye aspect ratios
      features.push(...this.calculateEyeAspectRatios(landmarks));
      
      // Eye distances and angles
      features.push(...this.calculateEyeGeometry(landmarks));
      
      // Mouth features
      features.push(...this.calculateMouthFeatures(landmarks));
      
      // Face proportions
      features.push(...this.calculateFaceProportions(landmarks));
    }

    // Advanced geometric features
    if (this.config.geometricComplexity === 'advanced') {
      // Facial asymmetry measures
      features.push(...this.calculateFacialAsymmetry(landmarks));
      
      // Curvature features
      features.push(...this.calculateCurvatureFeatures(landmarks));
      
      // Angular relationships
      features.push(...this.calculateAngularFeatures(landmarks));
      
      // Distance ratios
      features.push(...this.calculateDistanceRatios(landmarks));
      
      // Head pose derived features
      if (headPose) {
        features.push(...this.calculateHeadPoseDerivedFeatures(headPose, landmarks));
      }
    }

    return features;
  }

  // Calculate eye aspect ratios
  private calculateEyeAspectRatios(landmarks: NormalizedLandmark[]): number[] {
    const features: number[] = [];

    // Left eye aspect ratio
    const leftEAR = this.calculateSingleEyeAspectRatio(landmarks, this.EYE_LANDMARK_INDICES.leftEye);
    features.push(leftEAR);

    // Right eye aspect ratio
    const rightEAR = this.calculateSingleEyeAspectRatio(landmarks, this.EYE_LANDMARK_INDICES.rightEye);
    features.push(rightEAR);

    // Eye aspect ratio difference
    features.push(Math.abs(leftEAR - rightEAR));

    return features;
  }

  // Calculate single eye aspect ratio
  private calculateSingleEyeAspectRatio(landmarks: NormalizedLandmark[], eyeIndices: number[]): number {
    if (eyeIndices.length < 6) return 0;

    try {
      // Get eye landmarks
      const eyeLandmarks = eyeIndices.map(idx => landmarks[idx]).filter(l => l);
      
      if (eyeLandmarks.length < 6) return 0;

      // Calculate vertical distances
      const verticalDist1 = this.euclideanDistance(eyeLandmarks[1], eyeLandmarks[5]);
      const verticalDist2 = this.euclideanDistance(eyeLandmarks[2], eyeLandmarks[4]);

      // Calculate horizontal distance
      const horizontalDist = this.euclideanDistance(eyeLandmarks[0], eyeLandmarks[3]);

      // Eye aspect ratio
      return (verticalDist1 + verticalDist2) / (2.0 * horizontalDist);

    } catch {
      return 0;
    }
  }

  // Calculate eye geometry features
  private calculateEyeGeometry(landmarks: NormalizedLandmark[]): number[] {
    const features: number[] = [];

    try {
      // Eye centers
      const leftEyeCenter = this.calculateEyeCenter(landmarks, this.EYE_LANDMARK_INDICES.leftEye);
      const rightEyeCenter = this.calculateEyeCenter(landmarks, this.EYE_LANDMARK_INDICES.rightEye);

      // Distance between eyes
      const eyeDistance = this.euclideanDistance(leftEyeCenter, rightEyeCenter);
      features.push(eyeDistance);

      // Eye angle (tilt)
      const eyeAngle = Math.atan2(
        rightEyeCenter.y - leftEyeCenter.y,
        rightEyeCenter.x - leftEyeCenter.x
      );
      features.push(eyeAngle);

      // Pupil positions relative to eye centers (if available)
      if (landmarks[468] && landmarks[473]) { // Pupil landmarks
        const leftPupil = landmarks[468];
        const rightPupil = landmarks[473];

        // Pupil displacement from eye center
        features.push(
          leftPupil.x - leftEyeCenter.x,
          leftPupil.y - leftEyeCenter.y,
          rightPupil.x - rightEyeCenter.x,
          rightPupil.y - rightEyeCenter.y
        );
      } else {
        features.push(0, 0, 0, 0); // Padding
      }

    } catch {
      features.push(...new Array(7).fill(0)); // Padding for errors
    }

    return features;
  }

  // Calculate eye center from landmarks
  private calculateEyeCenter(landmarks: NormalizedLandmark[], eyeIndices: number[]): {x: number, y: number} {
    const eyeLandmarks = eyeIndices.map(idx => landmarks[idx]).filter(l => l);
    
    if (eyeLandmarks.length === 0) return {x: 0, y: 0};

    const centerX = eyeLandmarks.reduce((sum, l) => sum + l.x, 0) / eyeLandmarks.length;
    const centerY = eyeLandmarks.reduce((sum, l) => sum + l.y, 0) / eyeLandmarks.length;

    return {x: centerX, y: centerY};
  }

  // Calculate mouth features
  private calculateMouthFeatures(landmarks: NormalizedLandmark[]): number[] {
    const features: number[] = [];

    try {
      // Mouth aspect ratio
      const mouthLandmarks = this.MOUTH_INDICES.map(idx => landmarks[idx]).filter(l => l);
      
      if (mouthLandmarks.length >= 6) {
        // Mouth width
        const mouthWidth = this.euclideanDistance(mouthLandmarks[0], mouthLandmarks[6]);
        
        // Mouth height
        const mouthHeight = this.euclideanDistance(mouthLandmarks[3], mouthLandmarks[9]);
        
        // Mouth aspect ratio
        const mouthAR = mouthHeight / (mouthWidth || 1);
        features.push(mouthAR);

        // Mouth area (approximate)
        const mouthArea = mouthWidth * mouthHeight;
        features.push(mouthArea);
      } else {
        features.push(0, 0); // Padding
      }

    } catch {
      features.push(0, 0); // Padding for errors
    }

    return features;
  }

  // Calculate face proportions
  private calculateFaceProportions(landmarks: NormalizedLandmark[]): number[] {
    const features: number[] = [];

    try {
      // Face bounding box
      const facePoints = this.FACE_OUTLINE_INDICES.map(idx => landmarks[idx]).filter(l => l);
      
      if (facePoints.length > 10) {
        const xCoords = facePoints.map(p => p.x);
        const yCoords = facePoints.map(p => p.y);

        const faceWidth = Math.max(...xCoords) - Math.min(...xCoords);
        const faceHeight = Math.max(...yCoords) - Math.min(...yCoords);

        // Face aspect ratio
        features.push(faceHeight / (faceWidth || 1));

        // Face area
        features.push(faceWidth * faceHeight);

        // Face center
        const faceCenterX = (Math.max(...xCoords) + Math.min(...xCoords)) / 2;
        const faceCenterY = (Math.max(...yCoords) + Math.min(...yCoords)) / 2;
        features.push(faceCenterX, faceCenterY);
      } else {
        features.push(0, 0, 0, 0); // Padding
      }

    } catch {
      features.push(0, 0, 0, 0); // Padding for errors
    }

    return features;
  }

  // Calculate facial asymmetry
  private calculateFacialAsymmetry(landmarks: NormalizedLandmark[]): number[] {
    const features: number[] = [];

    try {
      // Calculate face midline
      const noseTip = landmarks[1];
      const forehead = landmarks[10];
      const chin = landmarks[18];

      if (noseTip && forehead && chin) {
        // Face symmetry line (vertical)
        const midlineX = (noseTip.x + forehead.x + chin.x) / 3;

        // Check asymmetry for key features
        const leftEyeCenter = this.calculateEyeCenter(landmarks, this.EYE_LANDMARK_INDICES.leftEye);
        const rightEyeCenter = this.calculateEyeCenter(landmarks, this.EYE_LANDMARK_INDICES.rightEye);

        // Eye symmetry
        const leftEyeDistance = Math.abs(leftEyeCenter.x - midlineX);
        const rightEyeDistance = Math.abs(rightEyeCenter.x - midlineX);
        const eyeAsymmetry = Math.abs(leftEyeDistance - rightEyeDistance);
        features.push(eyeAsymmetry);

        // Mouth corners symmetry
        if (landmarks[61] && landmarks[291]) {
          const leftMouthDistance = Math.abs(landmarks[61].x - midlineX);
          const rightMouthDistance = Math.abs(landmarks[291].x - midlineX);
          const mouthAsymmetry = Math.abs(leftMouthDistance - rightMouthDistance);
          features.push(mouthAsymmetry);
        } else {
          features.push(0);
        }
      } else {
        features.push(0, 0);
      }

    } catch {
      features.push(0, 0); // Padding for errors
    }

    return features;
  }

  // Calculate curvature features
  private calculateCurvatureFeatures(landmarks: NormalizedLandmark[]): number[] {
    const features: number[] = [];

    try {
      // Face outline curvature
      const outlinePoints = this.FACE_OUTLINE_INDICES.map(idx => landmarks[idx]).filter(l => l);
      
      if (outlinePoints.length >= 5) {
        let totalCurvature = 0;
        let curvatureCount = 0;

        for (let i = 2; i < outlinePoints.length - 2; i++) {
          const curvature = this.calculatePointCurvature(
            outlinePoints[i-2],
            outlinePoints[i],
            outlinePoints[i+2]
          );
          totalCurvature += Math.abs(curvature);
          curvatureCount++;
        }

        const avgCurvature = curvatureCount > 0 ? totalCurvature / curvatureCount : 0;
        features.push(avgCurvature);
      } else {
        features.push(0);
      }

    } catch {
      features.push(0);
    }

    return features;
  }

  // Calculate point curvature
  private calculatePointCurvature(p1: NormalizedLandmark, p2: NormalizedLandmark, p3: NormalizedLandmark): number {
    // Calculate curvature using three points
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p3.x - p2.x;
    const dy2 = p3.y - p2.y;

    const crossProduct = dx1 * dy2 - dy1 * dx2;
    const magnitude1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const magnitude2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    return crossProduct / (magnitude1 * magnitude2 || 1);
  }

  // Calculate angular features
  private calculateAngularFeatures(landmarks: NormalizedLandmark[]): number[] {
    const features: number[] = [];

    try {
      // Calculate angles between key facial features
      const noseTip = landmarks[1];
      const leftEyeCenter = this.calculateEyeCenter(landmarks, this.EYE_LANDMARK_INDICES.leftEye);
      const rightEyeCenter = this.calculateEyeCenter(landmarks, this.EYE_LANDMARK_INDICES.rightEye);

      if (noseTip && leftEyeCenter && rightEyeCenter) {
        // Angle between nose and eyes
        const leftNoseAngle = this.calculateAngle(leftEyeCenter, noseTip, rightEyeCenter);
        features.push(leftNoseAngle);

        // Angle of eye line relative to horizontal
        const eyeLineAngle = Math.atan2(
          rightEyeCenter.y - leftEyeCenter.y,
          rightEyeCenter.x - leftEyeCenter.x
        );
        features.push(eyeLineAngle);
      } else {
        features.push(0, 0);
      }

    } catch {
      features.push(0, 0);
    }

    return features;
  }

  // Calculate angle between three points
  private calculateAngle(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}): number {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    return Math.acos(dotProduct / (magnitude1 * magnitude2 || 1));
  }

  // Calculate distance ratios
  private calculateDistanceRatios(landmarks: NormalizedLandmark[]): number[] {
    const features: number[] = [];

    try {
      // Key distance measurements
      const noseTip = landmarks[1];
      const leftEyeCenter = this.calculateEyeCenter(landmarks, this.EYE_LANDMARK_INDICES.leftEye);
      const rightEyeCenter = this.calculateEyeCenter(landmarks, this.EYE_LANDMARK_INDICES.rightEye);
      const chin = landmarks[18];

      if (noseTip && leftEyeCenter && rightEyeCenter && chin) {
        // Eye to nose ratios
        const leftEyeToNose = this.euclideanDistance(leftEyeCenter, noseTip);
        const rightEyeToNose = this.euclideanDistance(rightEyeCenter, noseTip);
        const eyeToEye = this.euclideanDistance(leftEyeCenter, rightEyeCenter);

        features.push(
          leftEyeToNose / (eyeToEye || 1),
          rightEyeToNose / (eyeToEye || 1)
        );

        // Nose to chin ratio
        const noseToChin = this.euclideanDistance(noseTip, chin);
        features.push(noseToChin / (eyeToEye || 1));
      } else {
        features.push(0, 0, 0);
      }

    } catch {
      features.push(0, 0, 0);
    }

    return features;
  }

  // Calculate head pose derived features
  private calculateHeadPoseDerivedFeatures(headPose: HeadPose, landmarks: NormalizedLandmark[]): number[] {
    const features: number[] = [];

    // Head pose angles
    features.push(
      headPose.roll / 180,   // Normalized to [-1, 1]
      headPose.pitch / 180,  // Normalized to [-1, 1]
      headPose.yaw / 180     // Normalized to [-1, 1]
    );

    // Head pose confidence
    features.push(headPose.confidence);

    // Derived features based on pose
    const poseVector = Math.sqrt(
      headPose.roll * headPose.roll +
      headPose.pitch * headPose.pitch +
      headPose.yaw * headPose.yaw
    );
    features.push(poseVector / 180); // Normalized total pose deviation

    return features;
  }

  // Euclidean distance between two points
  private euclideanDistance(p1: {x: number, y: number}, p2: {x: number, y: number}): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Extract appearance features
  private extractAppearanceFeatures(
    landmarks: NormalizedLandmark[],
    faceData?: FaceData,
    eyeRegions?: { left: EyeRegion | null, right: EyeRegion | null }
  ): number[] {
    const features: number[] = [];

    // Landmark visibility scores
    const visibilityScores = landmarks.map(l => l.visibility || 0);
    features.push(
      Math.min(...visibilityScores),
      Math.max(...visibilityScores),
      visibilityScores.reduce((sum, v) => sum + v, 0) / visibilityScores.length
    );

    // Face quality metrics
    if (faceData) {
      features.push(
        faceData.quality.averageVisibility,
        faceData.quality.blurriness,
        faceData.quality.headPoseScore,
        faceData.quality.overallScore
      );
    } else {
      features.push(0, 0, 0, 0);
    }

    // Eye quality metrics
    if (eyeRegions) {
      const leftQuality = eyeRegions.left?.quality || { overall: 0, sharpness: 0, contrast: 0, visibility: 0 };
      const rightQuality = eyeRegions.right?.quality || { overall: 0, sharpness: 0, contrast: 0, visibility: 0 };

      features.push(
        leftQuality.overall,
        leftQuality.sharpness,
        leftQuality.contrast,
        leftQuality.visibility,
        rightQuality.overall,
        rightQuality.sharpness,
        rightQuality.contrast,
        rightQuality.visibility
      );
    } else {
      features.push(...new Array(8).fill(0));
    }

    return features;
  }

  // Extract temporal features
  private extractTemporalFeatures(): number[] {
    const features: number[] = [];

    if (this.extractionHistory.length < 2) {
      return features;
    }

    const windowSize = Math.min(this.config.temporalWindow, this.extractionHistory.length);
    const recentFeatures = this.extractionHistory.slice(-windowSize);

    // Calculate temporal derivatives for geometric features
    const geometricFeatures = recentFeatures.map(fs => fs.geometric);
    if (geometricFeatures.length >= 2) {
      features.push(...this.calculateTemporalDerivatives(geometricFeatures));
    }

    // Calculate stability measures
    features.push(...this.calculateTemporalStability(recentFeatures));

    return features;
  }

  // Calculate temporal derivatives
  private calculateTemporalDerivatives(featureHistory: number[][]): number[] {
    const derivatives: number[] = [];

    if (featureHistory.length < 2) return derivatives;

    const current = featureHistory[featureHistory.length - 1];
    const previous = featureHistory[featureHistory.length - 2];

    // First derivatives (velocity)
    for (let i = 0; i < Math.min(current.length, previous.length); i++) {
      derivatives.push(current[i] - previous[i]);
    }

    return derivatives;
  }

  // Calculate temporal stability
  private calculateTemporalStability(featureHistory: FeatureSet[]): number[] {
    const stability: number[] = [];

    if (featureHistory.length < 3) {
      return [1.0]; // Default high stability
    }

    // Calculate variance over time for key features
    const geometricSequences: number[][] = [];
    const minLength = Math.min(...featureHistory.map(fs => fs.geometric.length));

    for (let i = 0; i < minLength; i++) {
      const sequence = featureHistory.map(fs => fs.geometric[i]);
      geometricSequences.push(sequence);
    }

    // Calculate variance for each feature
    for (const sequence of geometricSequences.slice(0, 10)) { // Limit to first 10 features
      const mean = sequence.reduce((sum, val) => sum + val, 0) / sequence.length;
      const variance = sequence.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sequence.length;
      stability.push(1.0 / (1.0 + variance)); // Convert variance to stability score
    }

    return stability;
  }

  // Extract contextual features
  private extractContextualFeatures(
    faceData?: FaceData,
    headPose?: HeadPose,
    eyeRegions?: { left: EyeRegion | null, right: EyeRegion | null }
  ): number[] {
    const features: number[] = [];

    // Face tracking context
    if (faceData) {
      features.push(
        faceData.confidence,
        faceData.quality.faceSize,
        faceData.quality.lightingQuality === 'good' ? 1 : faceData.quality.lightingQuality === 'adequate' ? 0.5 : 0
      );
    } else {
      features.push(0, 0, 0);
    }

    // Head pose context
    if (headPose) {
      // Suitability for gaze estimation
      const poseRange = Math.sqrt(headPose.roll * headPose.roll + headPose.pitch * headPose.pitch + headPose.yaw * headPose.yaw);
      const suitability = Math.max(0, 1 - poseRange / 90); // Normalize to [0, 1]
      features.push(suitability);
    } else {
      features.push(0);
    }

    // Eye context
    if (eyeRegions) {
      const leftOpen = eyeRegions.left?.eyeOpenness || 0;
      const rightOpen = eyeRegions.right?.eyeOpenness || 0;
      const avgOpenness = (leftOpen + rightOpen) / 2;

      features.push(
        avgOpenness,
        Math.abs(leftOpen - rightOpen), // Eye asymmetry
        (eyeRegions.left ? 1 : 0) + (eyeRegions.right ? 1 : 0) // Eyes detected count
      );
    } else {
      features.push(0, 0, 0);
    }

    return features;
  }

  // Combine all feature types
  private combineFeatures(featureSet: FeatureSet): number[] {
    const combined: number[] = [];

    combined.push(...featureSet.geometric);
    combined.push(...featureSet.appearance);
    combined.push(...featureSet.temporal);
    combined.push(...featureSet.contextual);

    return combined;
  }

  // Normalize feature set
  private normalizeFeatureSet(featureSet: FeatureSet): void {
    if (this.config.normalizationMethod === 'local') {
      // Local normalization (per feature vector)
      featureSet.geometric = this.localNormalize(featureSet.geometric);
      featureSet.appearance = this.localNormalize(featureSet.appearance);
      featureSet.temporal = this.localNormalize(featureSet.temporal);
      featureSet.contextual = this.localNormalize(featureSet.contextual);
      featureSet.combined = this.localNormalize(featureSet.combined);
    }
    // Global normalization would require historical statistics
  }

  // Local normalization
  private localNormalize(features: number[]): number[] {
    if (features.length === 0) return features;

    const min = Math.min(...features);
    const max = Math.max(...features);

    if (max === min) return features.map(() => 0);

    return features.map(val => (val - min) / (max - min));
  }

  // Calculate feature metadata
  private calculateMetadata(
    featureSet: FeatureSet,
    extractionTime: number,
    faceData?: FaceData,
    headPose?: HeadPose,
    eyeRegions?: { left: EyeRegion | null, right: EyeRegion | null }
  ): FeatureMetadata {

    const featureCount = featureSet.combined.length;

    // Calculate overall quality
    let qualitySum = 0;
    let qualityCount = 0;

    if (faceData) {
      qualitySum += faceData.quality.overallScore;
      qualityCount++;
    }

    if (headPose) {
      qualitySum += headPose.confidence;
      qualityCount++;
    }

    if (eyeRegions?.left) {
      qualitySum += eyeRegions.left.quality.overall;
      qualityCount++;
    }

    if (eyeRegions?.right) {
      qualitySum += eyeRegions.right.quality.overall;
      qualityCount++;
    }

    const quality = qualityCount > 0 ? qualitySum / qualityCount : 0;

    // Calculate confidence based on feature completeness
    const expectedFeatureCount = 100; // Approximate expected count
    const completeness = Math.min(1, featureCount / expectedFeatureCount);
    const confidence = quality * completeness;

    return {
      extractionTime,
      featureCount,
      quality,
      confidence,
      source: 'advanced-extractor',
      version: '3.0'
    };
  }

  // Add to extraction history
  private addToHistory(featureSet: FeatureSet): void {
    this.extractionHistory.push(featureSet);

    if (this.extractionHistory.length > this.maxHistorySize) {
      this.extractionHistory = this.extractionHistory.slice(-this.maxHistorySize);
    }
  }

  // Configuration management
  updateConfig(newConfig: Partial<ExtractionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ExtractionConfig {
    return { ...this.config };
  }

  // Get extraction history
  getExtractionHistory(count?: number): FeatureSet[] {
    if (count) {
      return this.extractionHistory.slice(-count);
    }
    return [...this.extractionHistory];
  }

  // Reset extraction state
  reset(): void {
    this.extractionHistory = [];
  }
}
