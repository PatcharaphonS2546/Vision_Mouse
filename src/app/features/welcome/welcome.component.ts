/**
 * Welcome Page Component
 * Landing page with onboarding and system overview
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Observable } from 'rxjs';

import { StateService, SystemStatus, CameraState } from '../../core/core.module';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="welcome-container">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-content">
          <h1 class="hero-title">
            👁️ Vision Mouse
            <span class="version-badge">v2.0</span>
          </h1>
          <p class="hero-subtitle">
            Advanced Eye Tracking System for Hands-Free Computer Control
          </p>
          <p class="hero-description">
            ระบบติดตามสายตาขั้นสูงที่ให้คุณควบคุมคอมพิวเตอร์ด้วยดวงตา
            พร้อมเทคโนโลยี AI และการปรับเทียบแบบอัตโนมัติ
          </p>

          <div class="hero-actions">
            <button 
              class="btn btn-primary btn-large"
              (click)="startQuickSetup()"
              [disabled]="isSetupInProgress">
              <span class="btn-icon">🚀</span>
              <span>เริ่มใช้งาน</span>
            </button>

            <button 
              class="btn btn-secondary btn-large"
              (click)="viewFeatures()">
              <span class="btn-icon">✨</span>
              <span>ดูฟีเจอร์</span>
            </button>
          </div>

          <!-- System Status Preview -->
          <div class="status-preview" *ngIf="systemStatus$ | async as status">
            <div class="status-item" 
                 [class.status-ready]="status === 'ready' || status === 'running'">
              <span class="status-dot"></span>
              <span>System Status: {{ getStatusText(status) }}</span>
            </div>
          </div>
        </div>

        <div class="hero-visual">
          <div class="eye-animation">
            <div class="eye" [class.tracking]="isDemo">
              <div class="pupil"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features Overview -->
      <section class="features-section">
        <h2>🎯 ฟีเจอร์หลัก</h2>
        
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">📷</div>
            <h3>Real-time Eye Tracking</h3>
            <p>ติดตามสายตาแบบเรียลไทม์ด้วยความแม่นยำสูง</p>
            <div class="feature-status">
              <span class="status-indicator" 
                    [class.ready]="(cameraState$ | async)?.isInitialized">
              </span>
              <span>{{ getCameraStatusText() }}</span>
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🎯</div>
            <h3>Smart Calibration</h3>
            <p>ระบบปรับเทียบอัตโนมัติด้วย AI</p>
            <div class="feature-status">
              <span class="status-indicator" 
                    [class.ready]="isCalibrated$ | async">
              </span>
              <span>{{ getCalibrationStatusText() }}</span>
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🖱️</div>
            <h3>Mouse Control</h3>
            <p>ควบคุมเมาส์ด้วยการเคลื่อนไหวของดวงตา</p>
            <div class="feature-status">
              <span class="status-indicator" 
                    [class.ready]="canUseMouse$ | async">
              </span>
              <span>{{ getMouseStatusText() }}</span>
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">📊</div>
            <h3>Analytics & Insights</h3>
            <p>วิเคราะห์พฤติกรรมการใช้งานและประสิทธิภาพ</p>
            <div class="feature-status">
              <span class="status-indicator ready"></span>
              <span>พร้อมใช้งาน</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Quick Setup Section -->
      <section class="setup-section">
        <h2>⚡ เริ่มต้นอย่างรวดเร็ว</h2>
        
        <div class="setup-steps">
          <div class="setup-step" 
               [class.step-completed]="(cameraState$ | async)?.hasPermission"
               [class.step-active]="currentStep === 1">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Camera Permission</h4>
              <p>อนุญาตการเข้าถึงกล้อง</p>
              <button 
                class="btn btn-sm"
                [disabled]="(cameraState$ | async)?.hasPermission"
                (click)="requestCameraPermission()">
                {{ (cameraState$ | async)?.hasPermission ? '✅ อนุญาตแล้ว' : '📷 อนุญาต' }}
              </button>
            </div>
          </div>

          <div class="setup-step" 
               [class.step-completed]="isCalibrated$ | async"
               [class.step-active]="currentStep === 2">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Calibration</h4>
              <p>ปรับเทียบระบบติดตามสายตา</p>
              <button 
                class="btn btn-sm"
                [disabled]="!(cameraState$ | async)?.hasPermission || (isCalibrated$ | async)"
                (click)="startCalibration()">
                {{ (isCalibrated$ | async) ? '✅ เสร็จแล้ว' : '🎯 เริ่มปรับเทียบ' }}
              </button>
              <a routerLink="/calibration-new" class="btn btn-outline btn-sm">
                ⚙️ ปรับเทียบใหม่
              </a>
            </div>
          </div>

          <div class="setup-step" 
               [class.step-completed]="canUseMouse$ | async"
               [class.step-active]="currentStep === 3">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Start Tracking</h4>
              <p>เริ่มใช้งานระบบติดตามสายตา</p>
              <button 
                class="btn btn-sm"
                [disabled]="!(isCalibrated$ | async)"
                (click)="startTracking()">
                👁️ เริ่มติดตาม
              </button>
              <a routerLink="/tracking" class="btn btn-primary btn-sm">
                🚀 Eye Tracking Workspace
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- Quick Access -->
      <section class="quick-access-section">
        <h2>🚀 Quick Access</h2>
        
        <div class="quick-access-grid">
          <a routerLink="/tracking" class="quick-access-card primary">
            <div class="card-icon">👁️</div>
            <h3>Eye Tracking Workspace</h3>
            <p>Real-time eye tracking ด้วย visualization และ controls</p>
            <div class="card-footer">
              <span class="btn-text">เริ่มใช้งาน →</span>
            </div>
          </a>

          <a routerLink="/calibration-new" class="quick-access-card">
            <div class="card-icon">🎯</div>
            <h3>Advanced Calibration</h3>
            <p>ระบบปรับเทียบขั้นสูงพร้อม quality assessment</p>
            <div class="card-footer">
              <span class="btn-text">ปรับเทียบ →</span>
            </div>
          </a>

          <a routerLink="/performance" class="quick-access-card">
            <div class="card-icon">📊</div>
            <h3>Performance Monitor</h3>
            <p>ติดตามประสิทธิภาพระบบแบบเรียลไทม์</p>
            <div class="card-footer">
              <span class="btn-text">ดูสถิติ →</span>
            </div>
          </a>

          <a routerLink="/analytics" class="quick-access-card">
            <div class="card-icon">🤖</div>
            <h3>Advanced Analytics</h3>
            <p>AI-powered insights และการวิเคราะห์ข้อมูลขั้นสูง</p>
            <div class="card-footer">
              <span class="btn-text">วิเคราะห์ →</span>
            </div>
          </a>

          <a routerLink="/testing" class="quick-access-card">
            <div class="card-icon">🧪</div>
            <h3>Testing & Validation</h3>
            <p>ระบบทดสอบความแม่นยำและการตรวจสอบอย่างครอบคลุม</p>
            <div class="card-footer">
              <span class="btn-text">ทดสอบ →</span>
            </div>
          </a>
        </div>
      </section>

      <!-- Help & Resources -->
      <section class="help-section">
        <h2>💡 ความช่วยเหลือ</h2>
        
        <div class="help-grid">
          <a routerLink="/help/tutorial" class="help-card">
            <div class="help-icon">🎓</div>
            <h4>Tutorial</h4>
            <p>คู่มือการใช้งานทีละขั้นตอน</p>
          </a>

          <a routerLink="/help/troubleshoot" class="help-card">
            <div class="help-icon">🔧</div>
            <h4>Troubleshooting</h4>
            <p>แก้ไขปัญหาที่พบบ่อย</p>
          </a>

          <a routerLink="/help/faq" class="help-card">
            <div class="help-icon">❓</div>
            <h4>FAQ</h4>
            <p>คำถามที่พบบ่อย</p>
          </a>

          <a routerLink="/workspace/settings" class="help-card">
            <div class="help-icon">⚙️</div>
            <h4>Settings</h4>
            <p>ตั้งค่าและปรับแต่งระบบ</p>
          </a>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .welcome-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Hero Section */
    .hero-section {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 48px;
      align-items: center;
      min-height: 60vh;
      margin-bottom: 80px;
    }

    .hero-title {
      font-size: 3.5rem;
      font-weight: 800;
      margin: 0 0 16px 0;
      background: linear-gradient(135deg, #fff 0%, #e0e7ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1.1;
    }

    .version-badge {
      font-size: 1rem;
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 12px;
      border-radius: 20px;
      margin-left: 12px;
      color: white;
    }

    .hero-subtitle {
      font-size: 1.5rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      margin: 0 0 16px 0;
    }

    .hero-description {
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.8);
      line-height: 1.6;
      margin: 0 0 32px 0;
    }

    .hero-actions {
      display: flex;
      gap: 16px;
      margin-bottom: 32px;
    }

    .btn {
      padding: 16px 24px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }

    .btn-large {
      padding: 18px 32px;
      font-size: 18px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .btn-secondary:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .status-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      backdrop-filter: blur(10px);
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      transition: background 0.3s ease;
    }

    .status-item.status-ready .status-dot {
      background: #10b981;
    }

    /* Eye Animation */
    .hero-visual {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .eye-animation {
      position: relative;
      width: 200px;
      height: 200px;
    }

    .eye {
      width: 120px;
      height: 80px;
      background: white;
      border-radius: 50%;
      position: relative;
      margin: 60px auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .pupil {
      width: 40px;
      height: 40px;
      background: radial-gradient(circle, #1f2937 0%, #000 100%);
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      transition: all 0.3s ease;
    }

    .eye.tracking .pupil {
      animation: eyeTrack 4s infinite ease-in-out;
    }

    @keyframes eyeTrack {
      0%, 100% { transform: translate(-50%, -50%); }
      25% { transform: translate(-30%, -50%); }
      50% { transform: translate(-50%, -30%); }
      75% { transform: translate(-70%, -50%); }
    }

    /* Features Section */
    .features-section {
      margin-bottom: 80px;
    }

    .features-section h2 {
      text-align: center;
      font-size: 2.5rem;
      margin-bottom: 48px;
      color: white;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }

    .feature-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
    }

    .feature-card:hover {
      transform: translateY(-4px);
      background: rgba(255, 255, 255, 0.15);
    }

    .feature-icon {
      font-size: 3rem;
      margin-bottom: 16px;
    }

    .feature-card h3 {
      margin: 0 0 12px 0;
      color: white;
      font-size: 1.25rem;
    }

    .feature-card p {
      color: rgba(255, 255, 255, 0.8);
      margin: 0 0 16px 0;
      line-height: 1.5;
    }

    .feature-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
    }

    .status-indicator.ready {
      background: #10b981;
    }

    /* Setup Section */
    .setup-section {
      margin-bottom: 80px;
    }

    /* Quick Access Section */
    .quick-access-section {
      margin-bottom: 80px;
    }

    .quick-access-section h2 {
      text-align: center;
      margin-bottom: 48px;
      font-size: 2.5rem;
      font-weight: 700;
    }

    .quick-access-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 24px;
    }

    .quick-access-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 32px;
      text-decoration: none;
      color: white;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      min-height: 200px;
      position: relative;
      overflow: hidden;
    }

    .quick-access-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
      transition: left 0.5s ease;
    }

    .quick-access-card:hover {
      transform: translateY(-8px);
      background: rgba(255, 255, 255, 0.15);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .quick-access-card:hover::before {
      left: 100%;
    }

    .quick-access-card.primary {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%);
      border: 1px solid rgba(59, 130, 246, 0.4);
    }

    .quick-access-card.primary:hover {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(147, 51, 234, 0.4) 100%);
    }

    .card-icon {
      font-size: 3.5rem;
      margin-bottom: 20px;
    }

    .quick-access-card h3 {
      margin: 0 0 16px 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: white;
    }

    .quick-access-card p {
      margin: 0 0 24px 0;
      color: rgba(255, 255, 255, 0.8);
      line-height: 1.6;
      flex: 1;
    }

    .card-footer {
      margin-top: auto;
    }

    .btn-text {
      font-weight: 600;
      font-size: 1.1rem;
      color: white;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: gap 0.3s ease;
    }

    .quick-access-card:hover .btn-text {
      gap: 12px;
    }

    .setup-section h2 {
      text-align: center;
      font-size: 2.5rem;
      margin-bottom: 48px;
      color: white;
    }

    .setup-steps {
      display: flex;
      gap: 24px;
      justify-content: center;
    }

    .setup-step {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      min-width: 200px;
      position: relative;
      transition: all 0.3s ease;
    }

    .setup-step.step-active {
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .setup-step.step-completed {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .step-number {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 18px;
      margin: 0 auto 16px auto;
      color: white;
    }

    .step-content h4 {
      margin: 0 0 8px 0;
      color: white;
    }

    .step-content p {
      margin: 0 0 16px 0;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
    }

    .btn-sm {
      padding: 8px 16px;
      font-size: 14px;
    }

    /* Help Section */
    .help-section h2 {
      text-align: center;
      font-size: 2.5rem;
      margin-bottom: 48px;
      color: white;
    }

    .help-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }

    .help-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      text-decoration: none;
      color: white;
      transition: all 0.3s ease;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .help-card:hover {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.15);
      text-decoration: none;
      color: white;
    }

    .help-icon {
      font-size: 2rem;
      margin-bottom: 12px;
    }

    .help-card h4 {
      margin: 0 0 8px 0;
      font-size: 1.1rem;
    }

    .help-card p {
      margin: 0;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .hero-section {
        grid-template-columns: 1fr;
        text-align: center;
        gap: 32px;
      }

      .hero-title {
        font-size: 2.5rem;
      }

      .setup-steps {
        flex-direction: column;
        align-items: center;
      }

      .btn-large {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class WelcomeComponent implements OnInit {
  
  systemStatus$: Observable<SystemStatus>;
  cameraState$: Observable<CameraState>;
  isCalibrated$: Observable<boolean>;
  canUseMouse$: Observable<boolean>;
  
  isSetupInProgress = false;
  isDemo = true;
  currentStep = 1;

  constructor(
    private stateService: StateService,
    private router: Router
  ) {
    this.systemStatus$ = this.stateService.systemStatus;
    this.cameraState$ = this.stateService.cameraState;
    this.isCalibrated$ = this.stateService.isCalibrated();
    this.canUseMouse$ = this.stateService.canStartGazeTracking();
  }

  ngOnInit(): void {
    // Start demo animation
    setTimeout(() => {
      this.isDemo = true;
    }, 1000);
  }

  startQuickSetup(): void {
    this.isSetupInProgress = true;
    this.router.navigate(['/setup']);
  }

  viewFeatures(): void {
    this.router.navigate(['/help']);
  }

  requestCameraPermission(): void {
    this.router.navigate(['/setup/camera']);
  }

  startCalibration(): void {
    this.router.navigate(['/setup/calibration']);
  }

  startTracking(): void {
    this.router.navigate(['/workspace/tracking']);
  }

  getStatusText(status: SystemStatus): string {
    switch (status) {
      case 'initializing': return 'กำลังเริ่มต้น';
      case 'ready': return 'พร้อม';
      case 'running': return 'ทำงาน';
      case 'error': return 'ข้อผิดพลาด';
      case 'stopped': return 'หยุด';
      default: return 'ไม่ทราบ';
    }
  }

  getCameraStatusText(): string {
    // Implement based on camera state
    return 'ตรวจสอบ...';
  }

  getCalibrationStatusText(): string {
    // Implement based on calibration state
    return 'ยังไม่เสร็จ';
  }

  getMouseStatusText(): string {
    // Implement based on mouse capability
    return 'ยังไม่พร้อม';
  }
}
