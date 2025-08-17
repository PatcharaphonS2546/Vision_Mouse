import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserSession {
  userId: string;
  sessionId: string;
  createdAt: Date;
  lastActive: Date;
  calibrationData?: any;
  preferences?: any;
  performanceStats?: any;
}

export interface UserPreferences {
  sensitivity: number;
  smoothing: number;
  clickDwell: number;
  theme: 'light' | 'dark' | 'high-contrast';
  language: 'th' | 'en';
  fontSize: 'small' | 'medium' | 'large';
  autoStart: boolean;
  showTutorial: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserSessionService {
  private readonly STORAGE_PREFIX = 'vision_mouse_';
  private readonly USER_ID_KEY = 'user_id';
  private readonly SESSION_KEY = 'session_data';
  private readonly PREFERENCES_KEY = 'preferences';

  private userSessionSubject = new BehaviorSubject<UserSession | null>(null);
  public userSession$ = this.userSessionSubject.asObservable();

  private defaultPreferences: UserPreferences = {
    sensitivity: 1.0,
    smoothing: 0.3,
    clickDwell: 1000,
    theme: 'light',
    language: 'th',
    fontSize: 'medium',
    autoStart: false,
    showTutorial: true
  };

  constructor() {
    this.initializeUserSession();
  }

  /**
   * Initialize or restore user session
   */
  private initializeUserSession(): void {
    try {
      let userId = this.getStoredUserId();
      
      if (!userId) {
        userId = this.generateUserId();
        this.storeUserId(userId);
      }

      const sessionId = this.generateSessionId();
      const now = new Date();

      const userSession: UserSession = {
        userId,
        sessionId,
        createdAt: now,
        lastActive: now,
        calibrationData: this.getStoredCalibrationData(),
        preferences: this.getStoredPreferences(),
        performanceStats: this.getStoredPerformanceStats()
      };

      this.userSessionSubject.next(userSession);
      this.saveSession(userSession);

      console.log('User session initialized:', { userId, sessionId });
    } catch (error) {
      console.error('Failed to initialize user session:', error);
    }
  }

  /**
   * Generate unique user ID based on browser fingerprint
   */
  private generateUserId(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Browser fingerprint components
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      canvas: ctx ? this.getCanvasFingerprint(ctx) : '',
      timestamp: Date.now()
    };

    // Create hash from fingerprint
    const fingerprintString = JSON.stringify(fingerprint);
    const hash = this.simpleHash(fingerprintString);
    
    return `user_${hash}_${Date.now()}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get canvas fingerprint for browser uniqueness
   */
  private getCanvasFingerprint(ctx: CanvasRenderingContext2D): string {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Vision Mouse Fingerprint 🖱️👁️', 2, 2);
    return ctx.canvas.toDataURL();
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get stored user ID
   */
  private getStoredUserId(): string | null {
    return localStorage.getItem(this.STORAGE_PREFIX + this.USER_ID_KEY);
  }

  /**
   * Store user ID
   */
  private storeUserId(userId: string): void {
    localStorage.setItem(this.STORAGE_PREFIX + this.USER_ID_KEY, userId);
  }

  /**
   * Get current user session
   */
  getCurrentSession(): UserSession | null {
    return this.userSessionSubject.value;
  }

  /**
   * Update last active timestamp
   */
  updateLastActive(): void {
    const session = this.userSessionSubject.value;
    if (session) {
      session.lastActive = new Date();
      this.userSessionSubject.next(session);
      this.saveSession(session);
    }
  }

  /**
   * Save calibration data
   */
  saveCalibrationData(calibrationData: any): void {
    const session = this.userSessionSubject.value;
    if (session) {
      session.calibrationData = calibrationData;
      this.userSessionSubject.next(session);
      this.saveSession(session);
      
      // Also store separately for quick access
      localStorage.setItem(
        this.STORAGE_PREFIX + 'calibration_' + session.userId,
        JSON.stringify(calibrationData)
      );
    }
  }

  /**
   * Get stored calibration data
   */
  private getStoredCalibrationData(): any | null {
    const userId = this.getStoredUserId();
    if (!userId) return null;

    try {
      const data = localStorage.getItem(this.STORAGE_PREFIX + 'calibration_' + userId);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save user preferences
   */
  savePreferences(preferences: Partial<UserPreferences>): void {
    const session = this.userSessionSubject.value;
    if (session) {
      session.preferences = { ...this.defaultPreferences, ...session.preferences, ...preferences };
      this.userSessionSubject.next(session);
      this.saveSession(session);
      
      // Also store separately
      localStorage.setItem(
        this.STORAGE_PREFIX + this.PREFERENCES_KEY + '_' + session.userId,
        JSON.stringify(session.preferences)
      );
    }
  }

  /**
   * Get user preferences
   */
  getPreferences(): UserPreferences {
    const session = this.userSessionSubject.value;
    return session?.preferences || this.defaultPreferences;
  }

  /**
   * Get stored preferences
   */
  private getStoredPreferences(): UserPreferences {
    const userId = this.getStoredUserId();
    if (!userId) return this.defaultPreferences;

    try {
      const data = localStorage.getItem(this.STORAGE_PREFIX + this.PREFERENCES_KEY + '_' + userId);
      const stored = data ? JSON.parse(data) : {};
      return { ...this.defaultPreferences, ...stored };
    } catch {
      return this.defaultPreferences;
    }
  }

  /**
   * Save performance statistics
   */
  savePerformanceStats(stats: any): void {
    const session = this.userSessionSubject.value;
    if (session) {
      session.performanceStats = { ...session.performanceStats, ...stats };
      this.userSessionSubject.next(session);
      this.saveSession(session);
    }
  }

  /**
   * Get stored performance stats
   */
  private getStoredPerformanceStats(): any | null {
    const userId = this.getStoredUserId();
    if (!userId) return null;

    try {
      const data = localStorage.getItem(this.STORAGE_PREFIX + 'performance_' + userId);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSession(session: UserSession): void {
    try {
      localStorage.setItem(
        this.STORAGE_PREFIX + this.SESSION_KEY,
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  /**
   * Clear all user data (for privacy)
   */
  clearUserData(): void {
    const userId = this.getStoredUserId();
    if (userId) {
      // Remove all user-specific data
      const keysToRemove = [
        this.STORAGE_PREFIX + this.USER_ID_KEY,
        this.STORAGE_PREFIX + this.SESSION_KEY,
        this.STORAGE_PREFIX + 'calibration_' + userId,
        this.STORAGE_PREFIX + this.PREFERENCES_KEY + '_' + userId,
        this.STORAGE_PREFIX + 'performance_' + userId
      ];

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      // Reinitialize with new user
      this.initializeUserSession();
    }
  }

  /**
   * Export user data for backup/transfer
   */
  exportUserData(): string {
    const session = this.userSessionSubject.value;
    if (!session) return '{}';

    const exportData = {
      userId: session.userId,
      calibrationData: session.calibrationData,
      preferences: session.preferences,
      performanceStats: session.performanceStats,
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import user data from backup
   */
  importUserData(dataString: string): boolean {
    try {
      const importData = JSON.parse(dataString);
      
      if (importData.calibrationData) {
        this.saveCalibrationData(importData.calibrationData);
      }
      
      if (importData.preferences) {
        this.savePreferences(importData.preferences);
      }
      
      if (importData.performanceStats) {
        this.savePerformanceStats(importData.performanceStats);
      }

      return true;
    } catch (error) {
      console.error('Failed to import user data:', error);
      return false;
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): any {
    const session = this.userSessionSubject.value;
    if (!session) return null;

    return {
      userId: session.userId,
      sessionCount: this.getSessionCount(),
      totalUsageTime: this.getTotalUsageTime(),
      calibrationHistory: this.getCalibrationHistory(),
      lastUsed: session.lastActive
    };
  }

  /**
   * Get session count (mock implementation)
   */
  private getSessionCount(): number {
    // In real implementation, this would track session history
    return 1;
  }

  /**
   * Get total usage time (mock implementation)
   */
  private getTotalUsageTime(): number {
    // In real implementation, this would track cumulative usage time
    const session = this.userSessionSubject.value;
    if (!session) return 0;
    
    return Date.now() - session.createdAt.getTime();
  }

  /**
   * Get calibration history (mock implementation)
   */
  private getCalibrationHistory(): any[] {
    // In real implementation, this would track calibration sessions
    return [];
  }
}
