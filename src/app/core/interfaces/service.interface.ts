/**
 * Service Interfaces
 * Defines contracts for all core services in the Vision Mouse system
 */

import { Observable } from 'rxjs';
import {
  CameraState,
  EyeTrackingData,
  GazeEstimationResult,
  CalibrationResult,
  CalibrationProgress,
  CalibrationMatrix,
  PerformanceMetrics,
  SystemConfig,
  Point2D,
  SystemStatus,
  CalibrationStatus
} from './core.interface';

/**
 * Camera Service Interface
 */
export interface ICameraService {
  // State management
  getState(): Observable<CameraState>;
  getCurrentState(): CameraState;
  
  // Camera operations
  initialize(): Promise<void>;
  startStream(): Promise<MediaStream>;
  stopStream(): Promise<void>;
  cleanup(): Promise<void>;
  
  // Device management
  getAvailableDevices(): Promise<MediaDeviceInfo[]>;
  switchDevice(deviceId: string): Promise<void>;
  
  // Configuration
  updateConstraints(constraints: MediaStreamConstraints): Promise<void>;
  
  // Status
  isReady(): boolean;
  hasPermission(): boolean;
}

/**
 * Face Detection Service Interface
 */
export interface IFaceDetectionService {
  // Lifecycle
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  
  // Detection
  detectFace(frame: HTMLVideoElement | HTMLCanvasElement): Promise<EyeTrackingData | null>;
  
  // Status
  getStatus(): Observable<SystemStatus>;
  isReady(): boolean;
  
  // Configuration
  configure(config: any): void;
}

/**
 * Eye Tracking Service Interface
 */
export interface IEyeTrackingService {
  // State management
  getTrackingData(): Observable<EyeTrackingData>;
  getCurrentData(): EyeTrackingData | null;
  
  // Tracking operations
  startTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  
  // Processing
  processFrame(frame: HTMLVideoElement): Promise<EyeTrackingData | null>;
  
  // Status
  isTracking(): boolean;
  getStatus(): Observable<SystemStatus>;
}

/**
 * Calibration Service Interface
 */
export interface ICalibrationService {
  // State management
  getStatus(): Observable<CalibrationStatus>;
  getProgress(): Observable<CalibrationProgress | null>;
  
  // Calibration operations
  startCalibration(pointCount?: number): Promise<void>;
  addCalibrationPoint(screenPoint: Point2D, eyeData: EyeTrackingData): Promise<void>;
  completeCalibration(): Promise<CalibrationResult>;
  resetCalibration(): Promise<void>;
  
  // Quality assessment
  assessQuality(eyeData: EyeTrackingData): number;
  
  // Status
  isCalibrated(): boolean;
  getCurrentProgress(): CalibrationProgress | null;
  getLastResult(): CalibrationResult | null;
}

/**
 * Gaze Estimation Service Interface
 */
export interface IGazeEstimationService {
  // State management
  getGazeData(): Observable<GazeEstimationResult | null>;
  getCurrentGaze(): GazeEstimationResult | null;
  
  // Estimation
  estimateGaze(eyeData: EyeTrackingData): Promise<GazeEstimationResult | null>;
  
  // Calibration integration
  updateCalibration(matrix: CalibrationMatrix): void;
  clearCalibration(): void;
  isCalibrated(): boolean;
  
  // Status
  isReady(): boolean;
}

/**
 * Performance Monitor Service Interface
 */
export interface IPerformanceMonitorService {
  // Monitoring
  getMetrics(): Observable<PerformanceMetrics>;
  getCurrentMetrics(): PerformanceMetrics;
  
  // Recording
  startMonitoring(): void;
  stopMonitoring(): void;
  recordFrameTime(operation: string, time: number): void;
  
  // Analysis
  getAverageMetrics(duration: number): PerformanceMetrics;
  getPerformanceReport(): any;
  
  // Optimization
  shouldOptimize(): boolean;
  getOptimizationSuggestions(): string[];
}

/**
 * Configuration Service Interface
 */
export interface IConfigurationService {
  // Configuration management
  getConfig(): Observable<SystemConfig>;
  getCurrentConfig(): SystemConfig;
  updateConfig(config: Partial<SystemConfig>): Promise<void>;
  resetToDefaults(): Promise<void>;
  
  // Persistence
  saveConfig(): Promise<void>;
  loadConfig(): Promise<SystemConfig>;
  
  // Validation
  validateConfig(config: SystemConfig): boolean;
  getConfigErrors(config: SystemConfig): string[];
}

/**
 * Storage Service Interface
 */
export interface IStorageService {
  // Generic storage
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  
  // Specific data
  saveCalibrationData(data: CalibrationResult): Promise<void>;
  loadCalibrationData(): Promise<CalibrationResult | null>;
  saveUserPreferences(preferences: any): Promise<void>;
  loadUserPreferences(): Promise<any>;
  
  // Export/Import
  exportData(): Promise<Blob>;
  importData(data: Blob): Promise<void>;
}

/**
 * Error Handler Service Interface
 */
export interface IErrorHandlerService {
  // Error handling
  handleError(error: Error, context?: string): void;
  reportError(error: any, severity: 'low' | 'medium' | 'high' | 'critical'): void;
  
  // Error tracking
  getErrors(): Observable<any[]>;
  clearErrors(): void;
  
  // Recovery
  canRecover(error: any): boolean;
  attemptRecovery(error: any): Promise<boolean>;
}

/**
 * Notification Service Interface
 */
export interface INotificationService {
  // Basic notifications
  showSuccess(message: string, duration?: number): void;
  showError(message: string, duration?: number): void;
  showWarning(message: string, duration?: number): void;
  showInfo(message: string, duration?: number): void;
  
  // Advanced notifications
  showProgress(message: string, progress: number): void;
  showCustom(config: any): void;
  
  // Management
  clearAll(): void;
  clearByType(type: string): void;
}

/**
 * Analytics Service Interface
 */
export interface IAnalyticsService {
  // Event tracking
  trackEvent(event: string, data?: any): void;
  trackPerformance(metric: string, value: number): void;
  trackError(error: Error, context?: string): void;
  
  // Session tracking
  startSession(): void;
  endSession(): void;
  
  // Data collection
  getAnalyticsData(): Promise<any>;
  exportAnalytics(): Promise<Blob>;
  
  // Privacy
  setConsentLevel(level: 'none' | 'basic' | 'full'): void;
  clearAnalyticsData(): Promise<void>;
}
