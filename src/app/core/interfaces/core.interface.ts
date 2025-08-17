/**
 * Core System Interfaces
 * Defines the fundamental data structures for the Vision Mouse system
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export interface Vector3D {
  origin: Point3D;
  direction: Point3D;
  confidence: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * System Status Types
 */
export type SystemStatus = 'initializing' | 'ready' | 'running' | 'error' | 'stopped';
export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor';
export type CalibrationStatus = 'not-started' | 'initializing' | 'collecting' | 'processing' | 'completed' | 'failed';

/**
 * Camera & Video Interfaces
 */
export interface CameraState {
  isInitialized: boolean;
  isStreaming: boolean;
  hasPermission: boolean;
  error?: string;
  stream?: MediaStream;
  constraints: MediaStreamConstraints;
}

export interface VideoMetrics {
  fps: number;
  resolution: Dimensions;
  latency: number;
  frameCount: number;
}

/**
 * Face Detection Interfaces
 */
export interface FaceLandmarks {
  landmarks: Point3D[];
  boundingBox: BoundingBox;
  confidence: number;
  timestamp: number;
}

export interface EyeRegion {
  landmarks: Point3D[];
  center: Point2D;
  isOpen: boolean;
  openness: number;
  pupil: PupilData;
}

export interface PupilData {
  center: Point2D;
  diameter: number;
  radius?: number; // Optional for compatibility
  confidence: number;
}

export interface HeadPose {
  yaw: number;    // Left-right rotation
  pitch: number;  // Up-down rotation  
  roll: number;   // Tilt rotation
  confidence: number;
}

/**
 * Eye Tracking Data
 */
export interface EyeTrackingData {
  faceDetected: boolean;
  faceBox?: BoundingBox; // Face bounding box
  faceLandmarks?: FaceLandmarks;
  leftEye: EyeRegion;
  rightEye: EyeRegion;
  headPose: HeadPose;
  timestamp: number;
  frameNumber: number;
  processingTime: number;
}

/**
 * Gaze Estimation
 */
export interface GazeVector {
  origin: Point3D;
  direction: Point3D;
  confidence: number;
}

export interface GazePoint {
  screenPoint: Point2D;
  confidence: number;
  quality: QualityLevel;
  timestamp: number;
}

export interface GazeEstimationResult {
  gazePoint: Point2D;
  gazeVector: GazeVector;
  confidence: number;
  quality: QualityLevel;
  headPose: HeadPose;
  pupilData: {
    leftPupil: PupilData;
    rightPupil: PupilData;
  };
  timestamp: number;
  processingTime: number;
}

/**
 * Calibration System
 */
export interface CalibrationPoint {
  id: string;
  screenPosition: Point2D;
  samples: CalibrationSample[];
  quality: QualityLevel;
  isCompleted: boolean;
}

export interface CalibrationSample {
  eyeData: EyeTrackingData;
  gazeData: GazeEstimationResult;
  timestamp: number;
  quality: number;
}

export interface CalibrationMatrix {
  matrix: number[][];
  accuracy: number;
  quality: QualityLevel;
  pointCount: number;
  timestamp: number;
}

export interface CalibrationProgress {
  currentPoint: number;
  totalPoints: number;
  collectedSamples: number;
  requiredSamples: number;
  quality: number;
  status: CalibrationStatus;
  estimatedTimeRemaining: number;
}

export interface CalibrationResult {
  success: boolean;
  matrix: CalibrationMatrix;
  accuracy: number;
  quality: QualityLevel;
  error?: string;
  duration: number;
  pointsData: CalibrationPoint[];
}

/**
 * Performance Monitoring
 */
export interface PerformanceMetrics {
  fps: number;
  latency: number;
  memoryUsage: number;
  cpuUsage: number;
  frameDrops: number;
  processingTime: {
    detection: number;
    tracking: number;
    calibration: number;
    estimation: number;
    total: number;
  };
  timestamp: number;
}

export interface SystemHealth {
  overall: QualityLevel;
  camera: SystemStatus;
  detection: SystemStatus;
  tracking: SystemStatus;
  calibration: SystemStatus;
  estimation: SystemStatus;
  performance: PerformanceMetrics;
  errors: SystemError[];
}

export interface SystemError {
  id: string;
  type: 'camera' | 'detection' | 'tracking' | 'calibration' | 'estimation' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: any;
  timestamp: number;
  resolved: boolean;
}

/**
 * Configuration & Settings
 */
export interface CameraConfig {
  deviceId?: string;
  resolution: Dimensions;
  frameRate: number;
  facingMode: 'user' | 'environment';
}

export interface CalibrationConfig {
  pointCount: 9 | 13 | 16;
  samplesPerPoint: number;
  sampleDelay: number;
  qualityThreshold: number;
  timeoutPerPoint: number;
  showProgress: boolean;
}

export interface TrackingConfig {
  smoothingFactor: number;
  confidenceThreshold: number;
  enableLowLightMode: boolean;
  enablePrediction: boolean;
  maxTrackingDistance: number;
}

export interface SystemConfig {
  camera: CameraConfig;
  calibration: CalibrationConfig;
  tracking: TrackingConfig;
  performance: {
    targetFPS: number;
    maxMemoryUsage: number;
    enableWorkers: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    showDebugInfo: boolean;
    enableAccessibility: boolean;
  };
}

/**
 * Application State
 */
export interface ApplicationState {
  system: {
    status: SystemStatus;
    health: SystemHealth;
    config: SystemConfig;
  };
  camera: CameraState;
  tracking: {
    isActive: boolean;
    currentData?: EyeTrackingData;
    lastUpdate: number;
  };
  calibration: {
    status: CalibrationStatus;
    progress?: CalibrationProgress;
    result?: CalibrationResult;
  };
  gaze: {
    isActive: boolean;
    currentPoint?: Point2D;
    confidence: number;
    quality: QualityLevel;
  };
  performance: PerformanceMetrics;
}
