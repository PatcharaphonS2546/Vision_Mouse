/**
 * Notification Service
 * Toast notification system for user feedback
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  progress?: number;
  actions?: NotificationAction[];
  timestamp: number;
  persistent?: boolean;
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  
  private readonly notifications$ = new BehaviorSubject<Notification[]>([]);
  private notificationCounter = 0;
  private readonly defaultDuration = 5000; // 5 seconds

  constructor() {}

  // Basic notifications
  showSuccess(message: string, duration: number = this.defaultDuration): void {
    this.addNotification({
      type: 'success',
      message,
      duration
    });
  }

  showError(message: string, duration: number = this.defaultDuration): void {
    this.addNotification({
      type: 'error',
      message,
      duration: duration * 2, // Errors show longer
      persistent: true
    });
  }

  showWarning(message: string, duration: number = this.defaultDuration): void {
    this.addNotification({
      type: 'warning',
      message,
      duration: duration * 1.5
    });
  }

  showInfo(message: string, duration: number = this.defaultDuration): void {
    this.addNotification({
      type: 'info',
      message,
      duration
    });
  }

  // Advanced notifications
  showProgress(message: string, progress: number): string {
    const id = `notification_${++this.notificationCounter}`;
    
    const notification: Notification = {
      id,
      type: 'info',
      message,
      progress,
      timestamp: Date.now(),
      persistent: true
    };

    this.addNotificationDirect(notification);
    return id;
  }

  updateProgress(id: string, progress: number, message?: string): void {
    const notifications = this.notifications$.value;
    const updatedNotifications = notifications.map(notification => {
      if (notification.id === id) {
        return {
          ...notification,
          progress,
          message: message || notification.message
        };
      }
      return notification;
    });
    
    this.notifications$.next(updatedNotifications);
  }

  showCustom(config: Partial<Notification>): string {
    const id = `notification_${++this.notificationCounter}`;
    
    const notification: Notification = {
      id,
      type: 'info',
      message: '',
      timestamp: Date.now(),
      duration: this.defaultDuration,
      ...config
    };

    this.addNotificationDirect(notification);
    return id;
  }

  showActionNotification(
    message: string, 
    actions: NotificationAction[], 
    type: NotificationType = 'info',
    persistent: boolean = true
  ): string {
    return this.showCustom({
      type,
      message,
      actions,
      persistent
    });
  }

  // Management
  getNotifications(): Observable<Notification[]> {
    return this.notifications$.asObservable();
  }

  dismissNotification(id: string): void {
    const notifications = this.notifications$.value.filter(n => n.id !== id);
    this.notifications$.next(notifications);
  }

  clearAll(): void {
    this.notifications$.next([]);
  }

  clearByType(type: NotificationType): void {
    const notifications = this.notifications$.value.filter(n => n.type !== type);
    this.notifications$.next(notifications);
  }

  clearExpired(): void {
    const now = Date.now();
    const notifications = this.notifications$.value.filter(notification => {
      if (notification.persistent) return true;
      if (!notification.duration) return true;
      
      return (now - notification.timestamp) < notification.duration;
    });
    
    this.notifications$.next(notifications);
  }

  // Helper methods
  private addNotification(config: Omit<Notification, 'id' | 'timestamp'>): void {
    const notification: Notification = {
      id: `notification_${++this.notificationCounter}`,
      timestamp: Date.now(),
      ...config
    };

    this.addNotificationDirect(notification);
    
    // Auto-dismiss non-persistent notifications
    if (!notification.persistent && notification.duration) {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, notification.duration);
    }
  }

  private addNotificationDirect(notification: Notification): void {
    const currentNotifications = this.notifications$.value;
    const updatedNotifications = [notification, ...currentNotifications].slice(0, 10); // Keep last 10
    this.notifications$.next(updatedNotifications);
  }

  // Utility methods
  showLoadingNotification(message: string): string {
    return this.showProgress(message, 0);
  }

  updateLoadingNotification(id: string, progress: number, message?: string): void {
    this.updateProgress(id, progress, message);
  }

  completeLoadingNotification(id: string, successMessage: string): void {
    this.dismissNotification(id);
    this.showSuccess(successMessage);
  }

  failLoadingNotification(id: string, errorMessage: string): void {
    this.dismissNotification(id);
    this.showError(errorMessage);
  }

  // Batch operations
  showMultiple(notifications: Array<Omit<Notification, 'id' | 'timestamp'>>): string[] {
    return notifications.map(config => {
      const notification: Notification = {
        id: `notification_${++this.notificationCounter}`,
        timestamp: Date.now(),
        ...config
      };
      
      this.addNotificationDirect(notification);
      return notification.id;
    });
  }

  // Quick notification helpers
  quickSuccess(message: string): void {
    this.showSuccess(message, 2000);
  }

  quickError(message: string): void {
    this.showError(message, 4000);
  }

  quickInfo(message: string): void {
    this.showInfo(message, 3000);
  }

  // System notifications
  systemReady(): void {
    this.showSuccess('ระบบพร้อมใช้งาน 🎉', 3000);
  }

  systemError(error: string): void {
    this.showError(`ข้อผิดพลาดระบบ: ${error}`, 8000);
  }

  calibrationComplete(): void {
    this.showSuccess('การปรับเทียบสำเร็จ! 🎯', 4000);
  }

  trackingStarted(): void {
    this.showSuccess('เริ่มติดตามสายตาแล้ว 👁️', 3000);
  }
}
