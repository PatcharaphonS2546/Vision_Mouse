/**
 * Calibration Feature Component
 * Professional calibration interface with real-time feedback
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { 
  StateService, 
  EnhancedCalibrationService,
  CameraService,
  ErrorHandlerService,
  NotificationService
} from '../../core/core.module';

import {
  CalibrationStatus,
  CalibrationProgress,
  CalibrationResult,
  Point2D,
  QualityLevel
} from '../../core/interfaces/core.interface';

@Component({
  selector: 'app-calibration',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="calibration-container">
      <!-- Header -->
      <div class="calibration-header">
        <h2>🎯 การปรับเทียบระบบ Eye Tracking</h2>
        <div class="status-indicator" [ngClass]="'status-' + calibrationStatus">
          {{getStatusText(calibrationStatus)}}
        </div>
      </div>

      <!-- Calibration Area -->
      <div class="calibration-area" [ngClass]="'status-' + calibrationStatus">
        
        <!-- Not Started State -->
        <div *ngIf="calibrationStatus === 'not-started'" class="intro-section">
          <div class="intro-content">
            <div class="intro-icon">🎯</div>
            <h3>เริ่มต้นการปรับเทียบ</h3>
            <p>การปรับเทียบจะช่วยเพิ่มความแม่นยำในการติดตามสายตา</p>
            
            <div class="calibration-info">
              <div class="info-card">
                <div class="info-icon">👁️</div>
                <h4>จุดปรับเทียบ</h4>
                <p>{{pointCount}} จุด</p>
              </div>
              <div class="info-card">
                <div class="info-icon">⏱️</div>
                <h4>เวลาประมาณ</h4>
                <p>2-3 นาที</p>
              </div>
              <div class="info-card">
                <div class="info-icon">📊</div>
                <h4>ความแม่นยำ</h4>
                <p>สูงมาก</p>
              </div>
            </div>

            <div class="calibration-instructions">
              <h4>📋 วิธีการปรับเทียบ</h4>
              <ol>
                <li>นั่งให้สบายหน้าหน้าจอ ห่างประมาณ 60cm</li>
                <li>มองที่จุดสีแดงที่ปรากฏบนหน้าจอ</li>
                <li>รอจนกว่าจุดจะเปลี่ยนสีเป็นเขียว</li>
                <li>ทำซ้ำจนครบทุกจุด</li>
              </ol>
            </div>

            <div class="start-controls">
              <button 
                class="btn btn-primary btn-large"
                (click)="startCalibration()"
                [disabled]="!canStartCalibration">
                <span class="btn-icon">🚀</span>
                เริ่มการปรับเทียบ
              </button>
              
              <div class="point-selector">
                <label>จำนวนจุดปรับเทียบ:</label>
                <select [(ngModel)]="pointCount" class="point-select">
                  <option value="5">5 จุด (เร็ว)</option>
                  <option value="9">9 จุด (แนะนำ)</option>
                  <option value="13">13 จุด (ความแม่นยำสูง)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Calibration in Progress -->
        <div *ngIf="calibrationStatus === 'collecting'" class="calibration-active">
          
          <!-- Progress Header -->
          <div class="progress-header">
            <div class="progress-info">
              <span class="current-point">จุดที่ {{currentProgress?.currentPoint || 1}}</span>
              <span class="total-points">/ {{currentProgress?.totalPoints || pointCount}}</span>
            </div>
            <div class="time-remaining" *ngIf="currentProgress && currentProgress.estimatedTimeRemaining">
              เหลือเวลา: {{formatTime(currentProgress.estimatedTimeRemaining)}}
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" 
                   [style.width.%]="getProgressPercentage()"></div>
            </div>
            <div class="progress-text">
              {{getProgressPercentage() | number:'1.0-0'}}%
            </div>
          </div>

          <!-- Quality Indicator -->
          <div class="quality-indicator" *ngIf="currentProgress">
            <div class="quality-label">คุณภาพตัวอย่าง:</div>
            <div class="quality-badge" [ngClass]="'quality-' + getQualityLevel(currentProgress.quality)">
              {{getQualityText(currentProgress.quality)}}
            </div>
            <div class="quality-score">
              {{(currentProgress.quality * 100) | number:'1.0-0'}}%
            </div>
          </div>

          <!-- Calibration Point Display -->
          <div class="calibration-point-display">
            <div class="calibration-point"
                 [style.left.px]="currentCalibrationPoint?.x"
                 [style.top.px]="currentCalibrationPoint?.y"
                 [ngClass]="calibrationPointClass">
            </div>
          </div>

          <!-- Sample Progress -->
          <div class="sample-progress" *ngIf="currentProgress">
            <div class="sample-info">
              <span>ตัวอย่างที่เก็บ: </span>
              <span class="sample-count">
                {{currentProgress.collectedSamples}} / {{currentProgress.requiredSamples}}
              </span>
            </div>
            <div class="sample-bar">
              <div class="sample-fill" 
                   [style.width.%]="getSampleProgress()"></div>
            </div>
          </div>

          <!-- Instructions -->
          <div class="live-instructions">
            <p>👁️ มองที่จุดสีแดง และอย่าขยับหัวมากเกินไป</p>
          </div>

          <!-- Cancel Button -->
          <div class="calibration-controls">
            <button class="btn btn-outline" (click)="cancelCalibration()">
              <span class="btn-icon">❌</span>
              ยกเลิก
            </button>
          </div>
        </div>

        <!-- Processing State -->
        <div *ngIf="calibrationStatus === 'processing'" class="processing-section">
          <div class="processing-content">
            <div class="processing-spinner">
              <div class="spinner"></div>
            </div>
            <h3>🔄 กำลังประมวลผล...</h3>
            <p>กรุณารอสักครู่ ระบบกำลังคำนวณการปรับเทียบ</p>
          </div>
        </div>

        <!-- Completed State -->
        <div *ngIf="calibrationStatus === 'completed'" class="completed-section">
          <div class="completed-content" *ngIf="lastResult">
            <div class="success-icon">✅</div>
            <h3>🎉 การปรับเทียบสำเร็จ!</h3>
            
            <div class="result-metrics">
              <div class="metric-card">
                <div class="metric-icon">🎯</div>
                <div class="metric-label">ความแม่นยำ</div>
                <div class="metric-value">{{(lastResult.accuracy * 100) | number:'1.1-1'}}%</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">⭐</div>
                <div class="metric-label">คุณภาพ</div>
                <div class="metric-value">{{getQualityText(lastResult.quality)}}</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">⏱️</div>
                <div class="metric-label">เวลาที่ใช้</div>
                <div class="metric-value">{{formatDuration(lastResult.duration)}}</div>
              </div>
            </div>

            <div class="result-actions">
              <button class="btn btn-success" (click)="proceedToTracking()">
                <span class="btn-icon">▶️</span>
                เริ่มใช้งาน Eye Tracking
              </button>
              <button class="btn btn-outline" (click)="recalibrate()">
                <span class="btn-icon">🔄</span>
                ปรับเทียบใหม่
              </button>
            </div>
          </div>
        </div>

        <!-- Failed State -->
        <div *ngIf="calibrationStatus === 'failed'" class="failed-section">
          <div class="failed-content">
            <div class="error-icon">❌</div>
            <h3>⚠️ การปรับเทียบไม่สำเร็จ</h3>
            <p>เกิดข้อผิดพลาดระหว่างการปรับเทียบ กรุณาลองใหม่อีกครั้ง</p>
            
            <div class="error-suggestions">
              <h4>💡 คำแนะนำ:</h4>
              <ul>
                <li>ตรวจสอบแสงสว่างในห้อง</li>
                <li>ทำความสะอาดเลนส์กล้อง</li>
                <li>นั่งให้อยู่ในระยะที่เหมาะสม</li>
                <li>ตรวจสอบการอนุญาตใช้กล้อง</li>
              </ul>
            </div>

            <div class="retry-actions">
              <button class="btn btn-primary" (click)="retryCalibration()">
                <span class="btn-icon">🔄</span>
                ลองใหม่
              </button>
              <button class="btn btn-outline" (click)="goBack()">
                <span class="btn-icon">⬅️</span>
                กลับ
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Debug Info (Development Only) -->
      <div class="debug-panel" *ngIf="showDebug">
        <h4>🐛 Debug Information</h4>
        <div class="debug-grid">
          <div class="debug-item">
            <label>Status:</label>
            <span>{{calibrationStatus}}</span>
          </div>
          <div class="debug-item">
            <label>Camera Ready:</label>
            <span>{{cameraReady}}</span>
          </div>
          <div class="debug-item">
            <label>Point Count:</label>
            <span>{{pointCount}}</span>
          </div>
          <div class="debug-item" *ngIf="currentProgress">
            <label>Current Point:</label>
            <span>{{currentProgress.currentPoint}}/{{currentProgress.totalPoints}}</span>
          </div>
          <div class="debug-item" *ngIf="currentProgress">
            <label>Samples:</label>
            <span>{{currentProgress.collectedSamples}}/{{currentProgress.requiredSamples}}</span>
          </div>
          <div class="debug-item" *ngIf="currentProgress">
            <label>Quality:</label>
            <span>{{(currentProgress.quality * 100) | number:'1.0-0'}}%</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calibration-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .calibration-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      backdrop-filter: blur(10px);
    }

    .status-indicator {
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.9rem;
    }

    .status-not-started { background: #757575; }
    .status-initializing { background: #ff9800; }
    .status-collecting { background: #2196f3; }
    .status-processing { background: #ff9800; }
    .status-completed { background: #4caf50; }
    .status-failed { background: #f44336; }

    .calibration-area {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 40px;
      min-height: 600px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .intro-section, .completed-section, .failed-section, .processing-section {
      text-align: center;
      max-width: 600px;
    }

    .intro-icon, .success-icon, .error-icon {
      font-size: 4rem;
      margin-bottom: 20px;
    }

    .calibration-info {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 30px 0;
    }

    .info-card {
      background: rgba(255, 255, 255, 0.1);
      padding: 20px;
      border-radius: 10px;
      text-align: center;
    }

    .info-icon {
      font-size: 2rem;
      margin-bottom: 10px;
    }

    .calibration-instructions {
      background: rgba(255, 255, 255, 0.1);
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: left;
    }

    .start-controls {
      margin-top: 30px;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }

    .btn-primary { background: #4caf50; color: white; }
    .btn-success { background: #4caf50; color: white; }
    .btn-outline { background: transparent; color: white; border: 2px solid rgba(255, 255, 255, 0.3); }
    .btn-large { font-size: 1.1rem; padding: 16px 32px; }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .point-selector {
      margin-top: 20px;
    }

    .point-select {
      padding: 8px 12px;
      border-radius: 6px;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      margin-left: 10px;
    }

    .calibration-active {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .progress-container {
      margin-bottom: 30px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #81c784 100%);
      transition: width 0.3s ease;
    }

    .calibration-point-display {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 1000;
    }

    .calibration-point {
      position: absolute;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: all 0.3s ease;
    }

    .point-waiting { background: #f44336; box-shadow: 0 0 20px rgba(244, 67, 54, 0.6); }
    .point-active { background: #ff9800; box-shadow: 0 0 30px rgba(255, 152, 0, 0.8); animation: pulse 1s infinite; }
    .point-collecting { background: #2196f3; box-shadow: 0 0 25px rgba(33, 150, 243, 0.7); }
    .point-completing { background: #4caf50; box-shadow: 0 0 25px rgba(76, 175, 80, 0.7); }

    @keyframes pulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-50%, -50%) scale(1.2); }
    }

    .quality-indicator {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: center;
      margin: 20px 0;
    }

    .quality-badge {
      padding: 6px 12px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .quality-excellent { background: #4caf50; }
    .quality-good { background: #8bc34a; }
    .quality-fair { background: #ff9800; }
    .quality-poor { background: #f44336; }

    .sample-progress {
      margin: 20px 0;
    }

    .sample-bar {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 8px;
    }

    .sample-fill {
      height: 100%;
      background: #4caf50;
      transition: width 0.3s ease;
    }

    .result-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 30px 0;
    }

    .metric-card {
      background: rgba(255, 255, 255, 0.1);
      padding: 20px;
      border-radius: 10px;
      text-align: center;
    }

    .metric-icon {
      font-size: 2rem;
      margin-bottom: 10px;
    }

    .processing-spinner {
      margin-bottom: 20px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .debug-panel {
      margin-top: 40px;
      background: rgba(0, 0, 0, 0.3);
      padding: 20px;
      border-radius: 8px;
    }

    .debug-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .debug-item {
      display: flex;
      justify-content: space-between;
    }

    @media (max-width: 768px) {
      .calibration-info {
        grid-template-columns: 1fr;
      }
      
      .result-metrics {
        grid-template-columns: 1fr;
      }
      
      .debug-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CalibrationComponent implements OnInit, OnDestroy {
  
  private destroy$ = new Subject<void>();
  
  // Component state
  calibrationStatus: CalibrationStatus = 'not-started';
  currentProgress: CalibrationProgress | null = null;
  lastResult: CalibrationResult | null = null;
  
  // Configuration
  pointCount: number = 9;
  showDebug = false; // Set to true for development
  
  // UI state
  currentCalibrationPoint: Point2D | null = null;
  calibrationPointClass = 'point-waiting';
  cameraReady = false;
  canStartCalibration = false;

  constructor(
    private stateService: StateService,
    private calibrationService: EnhancedCalibrationService,
    private cameraService: CameraService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService
  ) {}

  ngOnInit() {
    this.initializeComponent();
    this.subscribeToServices();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeComponent() {
    try {
      // Check camera readiness
      await this.checkCameraStatus();
      
      // Load any existing calibration state
      this.loadCalibrationState();
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to initialize calibration component');
    }
  }

  private subscribeToServices() {
    // Subscribe to calibration status
    this.calibrationService.getCalibrationStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe((status: CalibrationStatus) => {
        this.calibrationStatus = status;
        this.updateUIForStatus(status);
      });

    // Subscribe to calibration progress
    this.calibrationService.getCalibrationProgress()
      .pipe(takeUntil(this.destroy$))
      .subscribe((progress: CalibrationProgress | null) => {
        this.currentProgress = progress;
        this.updateCalibrationDisplay();
      });

    // Subscribe to camera state
    this.cameraService.getState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.cameraReady = state.isStreaming && state.hasPermission;
        this.canStartCalibration = this.cameraReady && this.calibrationStatus === 'not-started';
      });
  }

  private async checkCameraStatus() {
    const currentState = this.cameraService.getCurrentState();
    
    if (!currentState.isStreaming) {
      try {
        await this.cameraService.initialize();
        await this.cameraService.startStream();
      } catch (error) {
        this.notifications.showError('ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาต');
        throw error;
      }
    }
  }

  private loadCalibrationState() {
    const lastResult = this.calibrationService.getLastResult();
    if (lastResult) {
      this.lastResult = lastResult;
    }
  }

  private updateUIForStatus(status: CalibrationStatus) {
    switch (status) {
      case 'collecting':
        this.startCalibrationPointAnimation();
        break;
      case 'completed':
        this.lastResult = this.calibrationService.getLastResult();
        break;
    }
  }

  private updateCalibrationDisplay() {
    if (!this.currentProgress) return;

    // Update calibration point animation
    this.updateCalibrationPointAnimation();
  }

  private startCalibrationPointAnimation() {
    // Show real calibration points based on enhanced calibration service
    if (this.currentProgress) {
      // Get real calibration point from the enhanced service
      const realPoint = this.calibrationService.getCurrentCalibrationPoint();
      
      if (realPoint) {
        this.currentCalibrationPoint = {
          x: realPoint.screenX,
          y: realPoint.screenY
        };
      } else {
        // Fallback to generated point if service doesn't provide one
        this.currentCalibrationPoint = this.generateCalibrationPoint(this.currentProgress.currentPoint);
      }
      
      this.calibrationPointClass = 'point-active';
    }
  }

  private updateCalibrationPointAnimation() {
    if (!this.currentProgress) return;

    const sampleProgress = this.getSampleProgress();
    
    if (sampleProgress < 30) {
      this.calibrationPointClass = 'point-active';
    } else if (sampleProgress < 70) {
      this.calibrationPointClass = 'point-collecting';
    } else {
      this.calibrationPointClass = 'point-completing';
    }
  }

  private generateCalibrationPoint(pointIndex: number): Point2D {
    // Generate calibration point positions in a 3x3 grid
    const margin = 100;
    const cols = 3;
    const rows = 3;
    
    const pointIdx = pointIndex - 1; // Convert to 0-based
    const row = Math.floor(pointIdx / cols);
    const col = pointIdx % cols;
    
    const availableWidth = window.innerWidth - (2 * margin);
    const availableHeight = window.innerHeight - (2 * margin);
    
    const x = margin + (col * availableWidth / (cols - 1));
    const y = margin + (row * availableHeight / (rows - 1));
    
    return { x, y };
  }

  // UI Event Handlers
  async startCalibration() {
    if (!this.canStartCalibration) return;

    try {
      await this.calibrationService.startCalibration(this.pointCount);
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to start calibration');
    }
  }

  async cancelCalibration() {
    try {
      await this.calibrationService.resetCalibration();
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to cancel calibration');
    }
  }

  async retryCalibration() {
    await this.calibrationService.resetCalibration();
    // Wait a moment then restart
    setTimeout(() => this.startCalibration(), 500);
  }

  async recalibrate() {
    await this.calibrationService.resetCalibration();
  }

  proceedToTracking() {
    // Navigate to tracking workspace
    this.notifications.showSuccess('พร้อมใช้งาน Eye Tracking แล้ว!');
    // In a real app, would navigate to tracking component
  }

  goBack() {
    // Navigate back to previous page
  }

  // Helper Methods
  getStatusText(status: CalibrationStatus): string {
    const statusMap = {
      'not-started': 'ยังไม่เริ่ม',
      'initializing': 'กำลังเตรียม',
      'collecting': 'กำลังเก็บข้อมูล',
      'processing': 'กำลังประมวลผล',
      'completed': 'สำเร็จแล้ว',
      'failed': 'ไม่สำเร็จ'
    };
    return statusMap[status] || status;
  }

  getQualityText(quality: QualityLevel | number): string {
    if (typeof quality === 'number') {
      if (quality >= 0.8) return 'ดีเยี่ยม';
      if (quality >= 0.6) return 'ดี';
      if (quality >= 0.4) return 'พอใช้';
      return 'ควรปรับปรุง';
    }
    
    const qualityMap = {
      'excellent': 'ดีเยี่ยม',
      'good': 'ดี',
      'fair': 'พอใช้',
      'poor': 'ควรปรับปรุง'
    };
    return qualityMap[quality] || quality;
  }

  getQualityLevel(quality: number): string {
    if (quality >= 0.8) return 'excellent';
    if (quality >= 0.6) return 'good';
    if (quality >= 0.4) return 'fair';
    return 'poor';
  }

  getProgressPercentage(): number {
    if (!this.currentProgress) return 0;
    return (this.currentProgress.currentPoint / this.currentProgress.totalPoints) * 100;
  }

  getSampleProgress(): number {
    if (!this.currentProgress) return 0;
    return (this.currentProgress.collectedSamples / this.currentProgress.requiredSamples) * 100;
  }

  formatTime(milliseconds: number): string {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${seconds} วินาที`;
  }

  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds} วินาที`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} นาที`;
  }
}
