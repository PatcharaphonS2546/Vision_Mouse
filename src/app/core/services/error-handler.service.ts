/**
 * Error Handler Service
 * Centralized error handling and recovery system
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AppError {
  id: string;
  type: 'camera' | 'detection' | 'tracking' | 'calibration' | 'estimation' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: any;
  timestamp: number;
  resolved: boolean;
  context?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  
  private readonly errors$ = new BehaviorSubject<AppError[]>([]);
  private errorCounter = 0;

  constructor() {}

  // Error handling
  handleError(error: Error, context?: string): void {
    console.error(`Error in ${context}:`, error);
    
    const appError: AppError = {
      id: `error_${++this.errorCounter}`,
      type: this.determineErrorType(error, context),
      severity: this.determineSeverity(error),
      message: error.message || 'Unknown error occurred',
      details: error,
      timestamp: Date.now(),
      resolved: false,
      context
    };

    this.addError(appError);
    
    // Auto-recovery attempt for certain errors
    if (this.canRecover(appError)) {
      this.attemptRecovery(appError);
    }
  }

  reportError(error: any, severity: 'low' | 'medium' | 'high' | 'critical', context?: string): void {
    const appError: AppError = {
      id: `error_${++this.errorCounter}`,
      type: 'system',
      severity,
      message: typeof error === 'string' ? error : error.message || 'Unknown error',
      details: error,
      timestamp: Date.now(),
      resolved: false,
      context
    };

    this.addError(appError);
  }

  // Error tracking
  getErrors(): Observable<AppError[]> {
    return this.errors$.asObservable();
  }

  getCurrentErrors(): AppError[] {
    return this.errors$.value;
  }

  clearErrors(): void {
    this.errors$.next([]);
  }

  clearError(errorId: string): void {
    const errors = this.errors$.value.filter(error => error.id !== errorId);
    this.errors$.next(errors);
  }

  markErrorResolved(errorId: string): void {
    const errors = this.errors$.value.map(error => 
      error.id === errorId ? { ...error, resolved: true } : error
    );
    this.errors$.next(errors);
  }

  // Recovery
  canRecover(error: AppError): boolean {
    switch (error.type) {
      case 'camera':
        return error.message.includes('permission') || error.message.includes('NotFound');
      case 'detection':
        return error.severity !== 'critical';
      case 'tracking':
        return true;
      default:
        return false;
    }
  }

  async attemptRecovery(error: AppError): Promise<boolean> {
    try {
      switch (error.type) {
        case 'camera':
          return await this.recoverCameraError(error);
        case 'detection':
          return await this.recoverDetectionError(error);
        case 'tracking':
          return await this.recoverTrackingError(error);
        default:
          return false;
      }
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      return false;
    }
  }

  // Helper methods
  private addError(error: AppError): void {
    const currentErrors = this.errors$.value;
    const updatedErrors = [error, ...currentErrors].slice(0, 50); // Keep last 50 errors
    this.errors$.next(updatedErrors);
  }

  private determineErrorType(error: Error, context?: string): AppError['type'] {
    if (!context) return 'system';
    
    const contextLower = context.toLowerCase();
    if (contextLower.includes('camera')) return 'camera';
    if (contextLower.includes('detection')) return 'detection';
    if (contextLower.includes('tracking')) return 'tracking';
    if (contextLower.includes('calibration')) return 'calibration';
    if (contextLower.includes('estimation')) return 'estimation';
    
    return 'system';
  }

  private determineSeverity(error: Error): AppError['severity'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return 'critical';
    }
    if (message.includes('permission') || message.includes('access')) {
      return 'high';
    }
    if (message.includes('network') || message.includes('timeout')) {
      return 'medium';
    }
    
    return 'low';
  }

  private async recoverCameraError(error: AppError): Promise<boolean> {
    // Implement camera-specific recovery logic
    return false;
  }

  private async recoverDetectionError(error: AppError): Promise<boolean> {
    // Implement detection-specific recovery logic
    return false;
  }

  private async recoverTrackingError(error: AppError): Promise<boolean> {
    // Implement tracking-specific recovery logic
    return false;
  }

  // Error statistics
  getErrorStats(): { total: number; byType: Record<string, number>; bySeverity: Record<string, number> } {
    const errors = this.errors$.value;
    const stats = {
      total: errors.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>
    };

    errors.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  // Global error handler
  static setupGlobalErrorHandler(): void {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
  }
}
