/**
 * App Shell Component
 * Main application layout and navigation
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { StateService, SystemStatus, CameraState } from '../../core/core.module';
import { NotificationToastComponent } from '../../shared/shared.module';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificationToastComponent],
  template: `
    <div class="app-shell">
      <!-- Header Navigation -->
      <header class="app-header">
        <div class="header-content">
          <div class="brand">
            <h1>👁️ Vision Mouse</h1>
            <span class="version">v2.0</span>
          </div>

          <!-- System Status Indicators -->
          <div class="status-indicators">
            <div class="status-item" [class.status-good]="systemStatus === 'ready' || systemStatus === 'running'">
              <span class="status-icon">🖥️</span>
              <span class="status-label">System</span>
              <span class="status-value">{{ getSystemStatusText() }}</span>
            </div>

            <div class="status-item" [class.status-good]="cameraState.isStreaming">
              <span class="status-icon">📷</span>
              <span class="status-label">Camera</span>
              <span class="status-value">{{ getCameraStatusText() }}</span>
            </div>

            <div class="status-item" [class.status-good]="isCalibrated">
              <span class="status-icon">🎯</span>
              <span class="status-label">Calibration</span>
              <span class="status-value">{{ getCalibrationStatusText() }}</span>
            </div>
          </div>

          <!-- Navigation Menu -->
          <nav class="main-nav">
            <a routerLink="/welcome" 
               routerLinkActive="active"
               class="nav-link">
              <span class="nav-icon">🏠</span>
              <span class="nav-label">หน้าหลัก</span>
            </a>

            <a routerLink="/calibration-new" 
               routerLinkActive="active"
               class="nav-link">
              <span class="nav-icon">🎯</span>
              <span class="nav-label">ปรับเทียบ</span>
            </a>

            <a routerLink="/tracking" 
               routerLinkActive="active"
               class="nav-link">
              <span class="nav-icon">👁️</span>
              <span class="nav-label">Eye Tracking</span>
            </a>

            <a routerLink="/performance" 
               routerLinkActive="active"
               class="nav-link">
              <span class="nav-icon">📊</span>
              <span class="nav-label">Performance</span>
            </a>

            <a routerLink="/analytics" 
               routerLinkActive="active"
               class="nav-link">
              <span class="nav-icon">🤖</span>
              <span class="nav-label">Analytics</span>
            </a>

            <a routerLink="/testing" 
               routerLinkActive="active"
               class="nav-link">
              <span class="nav-icon">🧪</span>
              <span class="nav-label">Testing</span>
            </a>

            <a routerLink="/setup" 
               routerLinkActive="active"
               class="nav-link"
               [class.nav-disabled]="!canAccessSetup()">
              <span class="nav-icon">⚙️</span>
              <span class="nav-label">ตั้งค่า</span>
            </a>

            <a routerLink="/workspace/tracking" 
               routerLinkActive="active"
               class="nav-link"
               [class.nav-disabled]="!canAccessWorkspace()">
              <span class="nav-icon">👁️</span>
              <span class="nav-label">ติดตามสายตา</span>
            </a>

            <a routerLink="/workspace/analytics" 
               routerLinkActive="active"
               class="nav-link"
               [class.nav-disabled]="!canAccessWorkspace()">
              <span class="nav-icon">📊</span>
              <span class="nav-label">สถิติ</span>
            </a>

            <a routerLink="/help" 
               routerLinkActive="active"
               class="nav-link">
              <span class="nav-icon">❓</span>
              <span class="nav-label">ช่วยเหลือ</span>
            </a>
          </nav>

          <!-- Quick Actions -->
          <div class="quick-actions">
            <button 
              class="quick-action-btn"
              [disabled]="!canQuickCalibrate()"
              (click)="quickCalibrate()"
              title="ปรับเทียบด่วน">
              🎯
            </button>

            <button 
              class="quick-action-btn"
              [disabled]="!canToggleTracking()"
              (click)="toggleTracking()"
              [title]="isTrackingActive ? 'หยุดติดตาม' : 'เริ่มติดตาม'">
              {{ isTrackingActive ? '⏸️' : '▶️' }}
            </button>

            <button 
              class="quick-action-btn"
              (click)="openSettings()"
              title="การตั้งค่า">
              ⚙️
            </button>
          </div>
        </div>
      </header>

      <!-- Main Content Area -->
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>

      <!-- Footer -->
      <footer class="app-footer">
        <div class="footer-content">
          <div class="footer-info">
            <span>Vision Mouse - Advanced Eye Tracking System</span>
            <span class="separator">•</span>
            <span>Performance: {{ currentFPS }}fps</span>
            <span class="separator">•</span>
            <span>Memory: {{ memoryUsage }}MB</span>
          </div>

          <div class="footer-actions">
            <button class="footer-btn" (click)="exportData()">📤 Export</button>
            <button class="footer-btn" (click)="showDebugInfo()">🔍 Debug</button>
          </div>
        </div>
      </footer>

      <!-- Notifications -->
      <app-notification-toast></app-notification-toast>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    /* Header Styles */
    .app-header {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding: 16px 24px;
    }

    .header-content {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 24px;
      align-items: center;
    }

    .brand h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }

    .version {
      font-size: 12px;
      opacity: 0.7;
      margin-left: 8px;
    }

    /* Status Indicators */
    .status-indicators {
      display: flex;
      gap: 16px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      font-size: 13px;
      transition: all 0.3s ease;
    }

    .status-item.status-good {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-icon {
      font-size: 14px;
    }

    .status-label {
      font-weight: 500;
    }

    .status-value {
      opacity: 0.8;
      font-size: 12px;
    }

    /* Navigation */
    .main-nav {
      display: flex;
      gap: 8px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 8px;
      text-decoration: none;
      color: rgba(255, 255, 255, 0.8);
      transition: all 0.3s ease;
      font-size: 14px;
      font-weight: 500;
    }

    .nav-link:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .nav-link.active {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .nav-link.nav-disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .nav-icon {
      font-size: 16px;
    }

    /* Quick Actions */
    .quick-actions {
      display: flex;
      gap: 8px;
    }

    .quick-action-btn {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .quick-action-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.05);
    }

    .quick-action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Main Content */
    .app-main {
      flex: 1;
      overflow: auto;
      padding: 24px;
    }

    /* Footer */
    .app-footer {
      background: rgba(0, 0, 0, 0.2);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 24px;
    }

    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }

    .footer-info {
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0.8;
    }

    .separator {
      opacity: 0.5;
    }

    .footer-actions {
      display: flex;
      gap: 8px;
    }

    .footer-btn {
      padding: 6px 12px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .footer-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
      .header-content {
        grid-template-columns: auto 1fr auto;
      }
      
      .status-indicators {
        display: none;
      }
    }

    @media (max-width: 768px) {
      .header-content {
        grid-template-columns: 1fr auto;
      }

      .main-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(10px);
        padding: 12px;
        justify-content: space-around;
        z-index: 1000;
      }

      .nav-link {
        flex-direction: column;
        gap: 4px;
        padding: 8px 12px;
      }

      .nav-label {
        font-size: 11px;
      }

      .app-main {
        padding-bottom: 80px;
      }
    }
  `]
})
export class AppShellComponent implements OnInit, OnDestroy {
  
  systemStatus: SystemStatus = 'initializing';
  cameraState: CameraState = {
    isInitialized: false,
    isStreaming: false,
    hasPermission: false,
    constraints: {}
  };
  
  isCalibrated = false;
  isTrackingActive = false;
  currentFPS = 0;
  memoryUsage = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private stateService: StateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscribeToState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToState(): void {
    // System status
    this.stateService.systemStatus
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.systemStatus = status;
      });

    // Camera state
    this.stateService.cameraState
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.cameraState = state;
      });

    // Calibration status
    this.stateService.isCalibrated()
      .pipe(takeUntil(this.destroy$))
      .subscribe(calibrated => {
        this.isCalibrated = calibrated;
      });

    // Tracking status
    this.stateService.trackingActive
      .pipe(takeUntil(this.destroy$))
      .subscribe(active => {
        this.isTrackingActive = active;
      });

    // Performance metrics
    this.stateService.performanceMetrics
      .pipe(takeUntil(this.destroy$))
      .subscribe(metrics => {
        this.currentFPS = Math.round(metrics.fps);
        this.memoryUsage = Math.round(metrics.memoryUsage);
      });
  }

  // Status text helpers
  getSystemStatusText(): string {
    switch (this.systemStatus) {
      case 'initializing': return 'กำลังเริ่มต้น';
      case 'ready': return 'พร้อม';
      case 'running': return 'ทำงาน';
      case 'error': return 'ข้อผิดพลาด';
      case 'stopped': return 'หยุด';
      default: return 'ไม่ทราบ';
    }
  }

  getCameraStatusText(): string {
    if (this.cameraState.isStreaming) return 'ทำงาน';
    if (this.cameraState.isInitialized) return 'พร้อม';
    if (!this.cameraState.hasPermission) return 'ไม่อนุญาต';
    return 'ไม่พร้อม';
  }

  getCalibrationStatusText(): string {
    return this.isCalibrated ? 'เสร็จสิ้น' : 'ยังไม่เสร็จ';
  }

  // Navigation guards
  canAccessSetup(): boolean {
    return true; // Setup should always be accessible
  }

  canAccessWorkspace(): boolean {
    return this.cameraState.isInitialized && this.cameraState.hasPermission;
  }

  // Quick actions
  canQuickCalibrate(): boolean {
    return this.cameraState.isStreaming;
  }

  canToggleTracking(): boolean {
    return this.cameraState.isStreaming && this.isCalibrated;
  }

  quickCalibrate(): void {
    this.router.navigate(['/setup/calibration']);
  }

  toggleTracking(): void {
    // Implement tracking toggle logic
    console.log('Toggle tracking');
  }

  openSettings(): void {
    this.router.navigate(['/workspace/settings']);
  }

  // Footer actions
  exportData(): void {
    console.log('Export data');
  }

  showDebugInfo(): void {
    this.router.navigate(['/admin']);
  }
}
