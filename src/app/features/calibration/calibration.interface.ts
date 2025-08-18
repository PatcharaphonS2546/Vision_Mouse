/**
 * UI-only interfaces for calibration component
 * (Backend will handle actual calibration logic)
 */

export enum CalibrationStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  COLLECTING = 'collecting',
  PROCESSING = 'processing',
  VALIDATING = 'validating',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface CalibrationProgress {
  currentStep: number;
  totalSteps: number;
  percentage: number;
  message: string;
  estimatedTimeRemaining: number; // seconds
  qualityScore?: number; // 0-1
  
  // Additional properties used in the component
  requiredSamples: number;
  totalPoints: number;
  currentPoint: number;
  collectedSamples: number;
}

export interface CalibrationPoint {
  x: number;
  y: number;
  timestamp: number;
  quality: number; // 0-1
}

export interface CalibrationResult {
  accuracy: number;
  precision?: number;
  points: CalibrationPoint[];
  duration: number;
  success: boolean;
  message: string;
  quality?: string; // 'excellent' | 'good' | 'fair' | 'poor'
}
