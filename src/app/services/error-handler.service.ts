import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ErrorInfo {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  source: 'camera' | 'mediapipe' | 'gaze-estimation' | 'calibration' | 'general';
  message: string;
  details?: any;
  resolved: boolean;
}

export interface SystemStatus {
  camera: 'ok' | 'warning' | 'error';
  mediapipe: 'ok' | 'warning' | 'error';
  gazeEstimation: 'ok' | 'warning' | 'error';
  calibration: 'ok' | 'warning' | 'error';
  overall: 'ok' | 'warning' | 'error' | 'critical';
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  private errors$ = new BehaviorSubject<ErrorInfo[]>([]);
  private systemStatus$ = new BehaviorSubject<SystemStatus>({
    camera: 'ok',
    mediapipe: 'ok',
    gazeEstimation: 'ok',
    calibration: 'ok',
    overall: 'ok'
  });

  private errorLog: ErrorInfo[] = [];
  private maxLogSize = 100;

  constructor() {
    // Monitor system status every 5 seconds
    setInterval(() => {
      this.updateSystemStatus();
    }, 5000);
  }

  // Log error with context
  logError(
    source: ErrorInfo['source'],
    message: string,
    level: ErrorInfo['level'] = 'error',
    details?: any
  ): string {
    const errorId = this.generateErrorId();
    
    const error: ErrorInfo = {
      id: errorId,
      timestamp: Date.now(),
      level,
      source,
      message,
      details,
      resolved: false
    };

    this.addError(error);
    
    // Console logging based on level
    switch (level) {
      case 'critical':
        console.error(`[CRITICAL][${source.toUpperCase()}] ${message}`, details);
        break;
      case 'error':
        console.error(`[ERROR][${source.toUpperCase()}] ${message}`, details);
        break;
      case 'warning':
        console.warn(`[WARNING][${source.toUpperCase()}] ${message}`, details);
        break;
      case 'info':
        console.info(`[INFO][${source.toUpperCase()}] ${message}`, details);
        break;
    }

    return errorId;
  }

  // Log camera-specific errors
  logCameraError(message: string, level: ErrorInfo['level'] = 'error', details?: any): string {
    return this.logError('camera', message, level, details);
  }

  // Log MediaPipe-specific errors
  logMediaPipeError(message: string, level: ErrorInfo['level'] = 'error', details?: any): string {
    return this.logError('mediapipe', message, level, details);
  }

  // Log gaze estimation errors
  logGazeEstimationError(message: string, level: ErrorInfo['level'] = 'error', details?: any): string {
    return this.logError('gaze-estimation', message, level, details);
  }

  // Log calibration errors
  logCalibrationError(message: string, level: ErrorInfo['level'] = 'error', details?: any): string {
    return this.logError('calibration', message, level, details);
  }

  // Mark error as resolved
  resolveError(errorId: string): boolean {
    const errorIndex = this.errorLog.findIndex(e => e.id === errorId);
    if (errorIndex !== -1) {
      this.errorLog[errorIndex].resolved = true;
      this.updateErrorStream();
      return true;
    }
    return false;
  }

  // Clear resolved errors
  clearResolvedErrors(): void {
    this.errorLog = this.errorLog.filter(error => !error.resolved);
    this.updateErrorStream();
  }

  // Clear all errors
  clearAllErrors(): void {
    this.errorLog = [];
    this.updateErrorStream();
  }

  // Get errors by source
  getErrorsBySource(source: ErrorInfo['source']): ErrorInfo[] {
    return this.errorLog.filter(error => error.source === source && !error.resolved);
  }

  // Get errors by level
  getErrorsByLevel(level: ErrorInfo['level']): ErrorInfo[] {
    return this.errorLog.filter(error => error.level === level && !error.resolved);
  }

  // Get unresolved errors
  getUnresolvedErrors(): ErrorInfo[] {
    return this.errorLog.filter(error => !error.resolved);
  }

  // Check if system has critical errors
  hasCriticalErrors(): boolean {
    return this.errorLog.some(error => error.level === 'critical' && !error.resolved);
  }

  // Get system diagnostics
  getSystemDiagnostics(): any {
    const errors = this.getUnresolvedErrors();
    const errorsBySource = {
      camera: errors.filter(e => e.source === 'camera').length,
      mediapipe: errors.filter(e => e.source === 'mediapipe').length,
      gazeEstimation: errors.filter(e => e.source === 'gaze-estimation').length,
      calibration: errors.filter(e => e.source === 'calibration').length,
      general: errors.filter(e => e.source === 'general').length
    };

    const errorsByLevel = {
      critical: errors.filter(e => e.level === 'critical').length,
      error: errors.filter(e => e.level === 'error').length,
      warning: errors.filter(e => e.level === 'warning').length,
      info: errors.filter(e => e.level === 'info').length
    };

    return {
      totalErrors: errors.length,
      totalResolved: this.errorLog.filter(e => e.resolved).length,
      errorsBySource,
      errorsByLevel,
      systemStatus: this.systemStatus$.value,
      lastUpdated: Date.now()
    };
  }

  // Get troubleshooting suggestions
  getTroubleshootingSuggestions(): string[] {
    const suggestions: string[] = [];
    const errors = this.getUnresolvedErrors();
    const status = this.systemStatus$.value;

    // Camera issues
    if (status.camera === 'error') {
      suggestions.push('Check camera permissions and ensure camera is not used by another application');
      suggestions.push('Try refreshing the page or restarting the browser');
    }

    // MediaPipe issues
    if (status.mediapipe === 'error') {
      suggestions.push('Ensure MediaPipe assets are properly loaded');
      suggestions.push('Check browser compatibility and WebGL support');
    }

    // Performance issues
    const criticalErrors = errors.filter(e => e.level === 'critical');
    if (criticalErrors.length > 0) {
      suggestions.push('Critical system errors detected - restart the application');
    }

    // General suggestions
    if (errors.length > 5) {
      suggestions.push('Multiple errors detected - check console for detailed information');
    }

    return suggestions;
  }

  // Private methods
  private addError(error: ErrorInfo): void {
    this.errorLog.push(error);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
    
    this.updateErrorStream();
    this.updateSystemStatus();
  }

  private updateErrorStream(): void {
    this.errors$.next([...this.errorLog]);
  }

  private updateSystemStatus(): void {
    const errors = this.getUnresolvedErrors();
    
    const status: SystemStatus = {
      camera: this.getComponentStatus('camera', errors),
      mediapipe: this.getComponentStatus('mediapipe', errors),
      gazeEstimation: this.getComponentStatus('gaze-estimation', errors),
      calibration: this.getComponentStatus('calibration', errors),
      overall: 'ok'
    };

    // Determine overall status
    const componentStatuses = [status.camera, status.mediapipe, status.gazeEstimation, status.calibration];
    
    if (componentStatuses.includes('error') || this.hasCriticalErrors()) {
      status.overall = 'critical';
    } else if (componentStatuses.includes('warning')) {
      status.overall = 'warning';
    } else if (errors.length > 0) {
      status.overall = 'warning';
    } else {
      status.overall = 'ok';
    }

    this.systemStatus$.next(status);
  }

  private getComponentStatus(
    source: ErrorInfo['source'], 
    errors: ErrorInfo[]
  ): 'ok' | 'warning' | 'error' {
    const componentErrors = errors.filter(e => e.source === source);
    
    if (componentErrors.some(e => e.level === 'critical' || e.level === 'error')) {
      return 'error';
    } else if (componentErrors.some(e => e.level === 'warning')) {
      return 'warning';
    } else {
      return 'ok';
    }
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Observable getters
  get errors(): Observable<ErrorInfo[]> {
    return this.errors$.asObservable();
  }

  get systemStatus(): Observable<SystemStatus> {
    return this.systemStatus$.asObservable();
  }

  // Current state getters
  get currentErrors(): ErrorInfo[] {
    return this.errors$.value;
  }

  get currentSystemStatus(): SystemStatus {
    return this.systemStatus$.value;
  }
}
