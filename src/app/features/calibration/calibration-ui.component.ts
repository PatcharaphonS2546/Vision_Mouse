/**
 * Calibration Component - UI Only
 * Simplified version for UI interaction, backend will handle calibration logic
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { 
  StateService, 
  CameraService,
  ErrorHandlerService,
  NotificationService
} from '../../core/core.module';

import { CalibrationStatus, CalibrationProgress, CalibrationResult, CalibrationPoint } from './calibration.interface';
import { Point2D, QualityLevel } from '../../core/interfaces/core.interface';

@Component({
  selector: 'app-calibration',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="calibration-container">
      <div class="calibration-header">
        <h2>การปรับจูนระบบ (Calibration)</h2>
        <div class="status-indicator" [ngClass]="'status-' + calibrationStatus">
          <span class="status-dot"></span>
          {{ getStatusText(calibrationStatus) }}
        </div>
      </div>

      <!-- Camera Preview -->
      <div class="camera-section">
        <div class="camera-preview" [ngClass]="{'camera-ready': cameraReady}">
          <video #videoElement autoplay muted playsinline></video>
          <div class="camera-overlay">
            <div *ngIf="!cameraReady" class="camera-status">
              <i class="icon-camera-off"></i>
              <p>กำลังรอกล้อง...</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Calibration Controls -->
      <div class="calibration-controls">
        <button 
          class="btn-primary btn-start-calibration"
          [disabled]="!canStartCalibration"
          (click)="startCalibration()">
          เริ่มการปรับจูน
        </button>
        
        <button 
          class="btn-secondary"
          [disabled]="calibrationStatus === CalibrationStatus.IDLE"
          (click)="resetCalibration()">
          รีเซ็ต
        </button>
      </div>

      <!-- Progress Display -->
      <div *ngIf="currentProgress" class="progress-section">
        <div class="progress-info">
          <h3>{{ currentProgress.message }}</h3>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="currentProgress.percentage"></div>
          </div>
          <div class="progress-details">
            <span>{{ currentProgress.currentStep }} / {{ currentProgress.totalSteps }}</span>
            <span *ngIf="currentProgress.estimatedTimeRemaining > 0">
              เหลือเวลา: {{ currentProgress.estimatedTimeRemaining }}s
            </span>
          </div>
        </div>
      </div>

      <!-- Results Display -->
      <div *ngIf="lastResult" class="results-section">
        <div class="result-card" [ngClass]="{'success': lastResult.success, 'error': !lastResult.success}">
          <h3>ผลการปรับจูน</h3>
          <div class="result-metrics">
            <div class="metric">
              <label>ความแม่นยำ:</label>
              <span>{{ (lastResult.accuracy * 100) | number:'1.1-1' }}%</span>
            </div>
            <div class="metric">
              <label>คุณภาพ:</label>
              <span class="quality-badge" [ngClass]="'quality-' + lastResult.quality">
                {{ getQualityText(lastResult.quality) }}
              </span>
            </div>
            <div class="metric">
              <label>เวลาที่ใช้:</label>
              <span>{{ (lastResult.duration / 1000) | number:'1.1-1' }}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calibration-container {
      padding: 1rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .calibration-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-weight: 500;
    }

    .status-idle { background: #f5f5f5; color: #666; }
    .status-initializing { background: #fff3cd; color: #856404; }
    .status-collecting { background: #d1ecf1; color: #0c5460; }
    .status-validating { background: #cfe2ff; color: #084298; }
    .status-completed { background: #d1e7dd; color: #0f5132; }
    .status-failed { background: #f8d7da; color: #721c24; }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .camera-section {
      margin-bottom: 1rem;
    }

    .camera-preview {
      position: relative;
      width: 100%;
      height: 400px;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
    }

    .camera-preview video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .camera-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .camera-status {
      text-align: center;
      color: white;
    }

    .calibration-controls {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .btn-primary, .btn-secondary {
      padding: 0.75rem 2rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-primary:disabled, .btn-secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .progress-section {
      margin-bottom: 1rem;
    }

    .progress-bar {
      width: 100%;
      height: 20px;
      background: #e9ecef;
      border-radius: 10px;
      overflow: hidden;
      margin: 0.5rem 0;
    }

    .progress-fill {
      height: 100%;
      background: #007bff;
      transition: width 0.3s ease;
    }

    .progress-details {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      color: #666;
    }

    .results-section {
      margin-top: 1rem;
    }

    .result-card {
      padding: 1rem;
      border-radius: 8px;
      border: 2px solid;
    }

    .result-card.success {
      border-color: #28a745;
      background: #f8fff9;
    }

    .result-card.error {
      border-color: #dc3545;
      background: #fff8f8;
    }

    .result-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .quality-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .quality-excellent { background: #d1e7dd; color: #0f5132; }
    .quality-good { background: #cfe2ff; color: #084298; }
    .quality-fair { background: #fff3cd; color: #856404; }
    .quality-poor { background: #f8d7da; color: #721c24; }
  `]
})
export class CalibrationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // UI State
  calibrationStatus: CalibrationStatus = CalibrationStatus.IDLE;
  currentProgress: CalibrationProgress | null = null;
  lastResult: CalibrationResult | null = null;
  
  // Camera state
  cameraReady = false;
  canStartCalibration = false;
  
  // Enum reference for template
  CalibrationStatus = CalibrationStatus;

  constructor(
    private stateService: StateService,
    private cameraService: CameraService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.initializeComponent();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeComponent() {
    try {
      console.log('Initializing calibration component...');
      await this.checkCameraStatus();
      console.log('Component initialized');
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to initialize calibration component');
    }
  }

  private async checkCameraStatus() {
    // Subscribe to camera state
    this.cameraService.getState().subscribe(state => {
      this.cameraReady = state.isStreaming && state.hasPermission;
      this.canStartCalibration = this.cameraReady && this.calibrationStatus === CalibrationStatus.IDLE;
    });

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

  async startCalibration() {
    try {
      this.calibrationStatus = CalibrationStatus.INITIALIZING;
      this.notifications.showInfo('เริ่มการปรับจูนระบบ');
      
      // TODO: Call backend API
      // const response = await this.http.post('/api/calibration/start', {}).toPromise();
      
      // Mock progress for demo
      this.currentProgress = {
        currentStep: 1,
        totalSteps: 9,
        percentage: 11,
        message: 'กำลังเก็บข้อมูลจุดที่ 1',
        estimatedTimeRemaining: 30,
        requiredSamples: 5,
        totalPoints: 9,
        currentPoint: 1,
        collectedSamples: 0
      };
      
      this.calibrationStatus = CalibrationStatus.COLLECTING;
      
      // Simulate calibration process
      this.simulateCalibrationProcess();
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to start calibration');
      this.calibrationStatus = CalibrationStatus.FAILED;
    }
  }

  async resetCalibration() {
    try {
      // TODO: Call backend API to reset
      // await this.http.post('/api/calibration/reset', {}).toPromise();
      
      this.calibrationStatus = CalibrationStatus.IDLE;
      this.currentProgress = null;
      this.lastResult = null;
      this.notifications.showInfo('รีเซ็ตการปรับจูนเรียบร้อย');
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to reset calibration');
    }
  }

  private simulateCalibrationProcess() {
    // Mock calibration process for demo
    let step = 1;
    const totalSteps = 9;
    
    const interval = setInterval(() => {
      if (step >= totalSteps) {
        clearInterval(interval);
        this.completeCalibration();
        return;
      }
      
      step++;
      if (this.currentProgress) {
        this.currentProgress = {
          ...this.currentProgress,
          currentStep: step,
          percentage: (step / totalSteps) * 100,
          message: `กำลังเก็บข้อมูลจุดที่ ${step}`,
          estimatedTimeRemaining: (totalSteps - step) * 3
        };
      }
    }, 3000);
  }

  private completeCalibration() {
    this.calibrationStatus = CalibrationStatus.COMPLETED;
    this.currentProgress = null;
    
    // Mock result
    this.lastResult = {
      success: true,
      accuracy: 0.92,
      quality: 'good',
      duration: 27000,
      points: [],
      message: 'การปรับจูนเสร็จสิ้น'
    };
    
    this.notifications.showSuccess('การปรับจูนเสร็จสิ้น ความแม่นยำ 92%');
    
    setTimeout(() => {
      this.calibrationStatus = CalibrationStatus.IDLE;
      this.canStartCalibration = this.cameraReady;
    }, 3000);
  }

  getStatusText(status: CalibrationStatus): string {
    const statusTexts = {
      [CalibrationStatus.IDLE]: 'ยังไม่เริ่ม',
      [CalibrationStatus.INITIALIZING]: 'กำลังเตรียม',
      [CalibrationStatus.COLLECTING]: 'กำลังเก็บข้อมูล',
      [CalibrationStatus.VALIDATING]: 'กำลังประมวลผล',
      [CalibrationStatus.COMPLETED]: 'เสร็จสิ้น',
      [CalibrationStatus.FAILED]: 'ล้มเหลว'
    };
    return statusTexts[status] || 'ไม่ทราบสถานะ';
  }

  getQualityText(quality: QualityLevel | string | number): string {
    if (typeof quality === 'number') {
      if (quality >= 0.9) return 'ดีเยี่ยม';
      if (quality >= 0.7) return 'ดี';
      if (quality >= 0.5) return 'พอใช้';
      return 'ต้องปรับปรุง';
    }
    
    const qualityTexts = {
      'excellent': 'ดีเยี่ยม',
      'good': 'ดี',
      'fair': 'พอใช้',
      'poor': 'ต้องปรับปรุง'
    };
    return qualityTexts[quality as QualityLevel] || 'ไม่ทราบ';
  }

  getQualityLevel(score?: number): string {
    if (!score) return 'poor';
    if (score >= 0.9) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'fair';
    return 'poor';
  }
}
