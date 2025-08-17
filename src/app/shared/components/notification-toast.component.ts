/**
 * Notification Toast Component
 * Displays toast notifications to users
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { NotificationService, Notification } from '../../core/services/notification.service';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notification-container">
      <div 
        *ngFor="let notification of notifications; trackBy: trackByNotification" 
        class="notification-toast"
        [class]="'notification-' + notification.type"
        [class.notification-persistent]="notification.persistent">
        
        <div class="notification-content">
          <div class="notification-icon">
            <span [ngSwitch]="notification.type">
              <span *ngSwitchCase="'success'">✅</span>
              <span *ngSwitchCase="'error'">❌</span>
              <span *ngSwitchCase="'warning'">⚠️</span>
              <span *ngSwitchDefault>ℹ️</span>
            </span>
          </div>
          
          <div class="notification-message">{{ notification.message }}</div>
          
          <div class="notification-progress" *ngIf="notification.progress !== undefined">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                [style.width.%]="notification.progress">
              </div>
            </div>
            <span class="progress-text">{{ notification.progress.toFixed(0) }}%</span>
          </div>
          
          <div class="notification-actions" *ngIf="notification.actions?.length">
            <button 
              *ngFor="let action of notification.actions"
              class="notification-action-btn"
              [class]="'btn-' + (action.style || 'primary')"
              (click)="executeAction(action, notification.id)">
              {{ action.label }}
            </button>
          </div>
        </div>
        
        <button 
          class="notification-close"
          (click)="dismissNotification(notification.id)"
          aria-label="ปิด">
          ✕
        </button>
      </div>
    </div>
  `,
  styles: [`
    .notification-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
    }

    .notification-toast {
      display: flex;
      align-items: flex-start;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-bottom: 12px;
      padding: 16px;
      min-height: 60px;
      border-left: 4px solid #ccc;
      animation: slideInRight 0.3s ease-out;
      position: relative;
      overflow: hidden;
    }

    .notification-success {
      border-left-color: #10b981;
      background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
    }

    .notification-error {
      border-left-color: #ef4444;
      background: linear-gradient(135deg, #fef2f2 0%, #fef1f1 100%);
    }

    .notification-warning {
      border-left-color: #f59e0b;
      background: linear-gradient(135deg, #fffbeb 0%, #fefcf0 100%);
    }

    .notification-info {
      border-left-color: #3b82f6;
      background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%);
    }

    .notification-content {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex: 1;
    }

    .notification-icon {
      font-size: 18px;
      line-height: 1;
      margin-top: 2px;
    }

    .notification-message {
      flex: 1;
      font-size: 14px;
      line-height: 1.4;
      color: #374151;
      margin-top: 2px;
    }

    .notification-progress {
      margin-top: 8px;
      width: 100%;
    }

    .progress-bar {
      height: 4px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 4px;
    }

    .progress-fill {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s ease;
      border-radius: 2px;
    }

    .progress-text {
      font-size: 12px;
      color: #6b7280;
    }

    .notification-actions {
      margin-top: 8px;
      display: flex;
      gap: 8px;
    }

    .notification-action-btn {
      padding: 4px 12px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-secondary {
      background: #e5e7eb;
      color: #374151;
    }

    .btn-secondary:hover {
      background: #d1d5db;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .notification-close {
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      font-size: 16px;
      color: #9ca3af;
      cursor: pointer;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .notification-close:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #374151;
    }

    .notification-persistent::before {
      content: '';
      position: absolute;
      bottom: 0;
      left: 4px;
      right: 0;
      height: 2px;
      background: currentColor;
      opacity: 0.3;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @media (max-width: 768px) {
      .notification-container {
        left: 10px;
        right: 10px;
        max-width: none;
      }
    }
  `]
})
export class NotificationToastComponent implements OnInit, OnDestroy {
  
  notifications: Notification[] = [];
  private destroy$ = new Subject<void>();

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.notificationService.getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.notifications = notifications;
      });

    // Clean up expired notifications periodically
    setInterval(() => {
      this.notificationService.clearExpired();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  dismissNotification(id: string): void {
    this.notificationService.dismissNotification(id);
  }

  executeAction(action: any, notificationId: string): void {
    action.action();
    // Optionally dismiss the notification after action execution
    this.dismissNotification(notificationId);
  }

  trackByNotification(index: number, notification: Notification): string {
    return notification.id;
  }
}
