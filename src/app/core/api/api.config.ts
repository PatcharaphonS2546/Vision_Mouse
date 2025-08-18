/**
 * API Configuration
 * Central configuration for Python Backend API endpoints
 */

// Import interfaces from core.interface.ts
import type { 
  CalibrationResult, 
  GazePoint, 
  HeadPose, 
  PerformanceMetrics,
  Point2D,
  EyeTrackingData 
} from '../interfaces/core.interface';

export const API_CONFIG = {
  // Base URL for Python backend (will be configurable)
  BASE_URL: 'http://localhost:8000/api',
  
  // API Endpoints
  ENDPOINTS: {
    // Calibration endpoints
    CALIBRATION: {
      START: '/calibration/start',
      SUBMIT_POINT: '/calibration/point',
      COMPLETE: '/calibration/complete',
      VALIDATE: '/calibration/validate',
      RESET: '/calibration/reset',
      STATUS: '/calibration/status',
      SAVE: '/calibration/save',
      LOAD: '/calibration/load'
    },
    
    // Tracking endpoints
    TRACKING: {
      START: '/tracking/start',
      STOP: '/tracking/stop',
      PROCESS: '/tracking/process',
      GAZE: '/tracking/gaze',
      EYES: '/tracking/eyes',
      STATUS: '/tracking/status',
      CONFIG: '/tracking/config',
      STATS: '/tracking/stats',
      RESET: '/tracking/reset',
      EXPORT: '/tracking/export'
    },
    
    // Analytics endpoints
    ANALYTICS: {
      PERFORMANCE: '/analytics/performance',
      DASHBOARD: '/analytics/dashboard',
      ACCURACY: '/analytics/accuracy',
      SESSIONS: '/analytics/sessions',
      REPORTS: '/analytics/reports',
      EXPORT: '/analytics/export',
      REALTIME: '/analytics/realtime',
      TRENDS: '/analytics/trends'
    },
    
    // Legacy single endpoints (for backward compatibility)
    EYE_TRACKING: '/tracking',
    GAZE_ESTIMATION: '/gaze',
    CAMERA: '/camera',
    VIDEO_STREAM: '/video',
    FRAME_QUALITY: '/frame-quality',
    FACE_DETECTION: '/face-detection',
    LANDMARK_DETECTION: '/landmarks',
    FEATURE_EXTRACTION: '/features',
    PERFORMANCE: '/performance',
    EXPORT_DATA: '/export',
    HEALTH: '/health',
    STATUS: '/status',
    SETTINGS: '/settings'
  },
  
  // Request Configuration
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  
  // WebSocket Configuration
  WS_URL: 'ws://localhost:8000/ws',
  WS_ENDPOINTS: {
    REAL_TIME_TRACKING: '/tracking',
    LIVE_ANALYTICS: '/analytics',
    SYSTEM_EVENTS: '/events'
  }
};

/**
 * API Response Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * Request/Response Interfaces - API Specific
 */
export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

/**
 * API-specific Interfaces (not conflicting with core.interface.ts)
 */
export interface CalibrationData {
  point: {
    x: number;
    y: number;
  };
  timestamp: number;
  screenSize: {
    width: number;
    height: number;
  };
  eyeData?: {
    leftEye: EyePoint;
    rightEye: EyePoint;
  };
}

export interface TrackingData {
  frameId: string;
  timestamp: number;
  gazePoint: GazePoint;
  eyeData: EyeData;
  headPose?: HeadPose;
  confidence: number;
}

export interface EyeData {
  leftEye: EyePoint;
  rightEye: EyePoint;
  blinkState: 'open' | 'closed' | 'partial';
}

export interface EyePoint {
  center: { x: number; y: number };
  pupil: { x: number; y: number; radius: number };
  landmarks: { x: number; y: number }[];
  isVisible: boolean;
}

export interface AnalyticsData {
  sessionId: string;
  startTime: string;
  endTime?: string;
  duration: number;
  metrics: PerformanceMetrics;
  events: AnalyticsEvent[];
  summary: {
    totalFrames: number;
    successfulFrames: number;
    averageAccuracy: number;
    calibrationAccuracy?: number;
  };
}

export interface AnalyticsEvent {
  type: 'calibration' | 'tracking' | 'error' | 'performance';
  timestamp: string;
  data: any;
  severity?: 'info' | 'warning' | 'error';
}

// Re-export core interfaces for convenience
export type { 
  CalibrationResult, 
  GazePoint, 
  HeadPose, 
  PerformanceMetrics 
} from '../interfaces/core.interface';
