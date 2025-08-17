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
  CameraService,
  ErrorHandlerService,
  NotificationService
} from '../../core/core.module';

import { EnhancedCalibrationService, CalibrationStatus, CalibrationProgress } from '../../services/enhanced-calibration.service';
import { MediapipeService } from '../../services/mediapipe.service';

import {
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
        <div *ngIf="calibrationStatus === CalibrationStatus.IDLE" class="intro-section">
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
        <div *ngIf="calibrationStatus === CalibrationStatus.COLLECTING" class="calibration-active">
          
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
            <div class="quality-badge" [ngClass]="'quality-' + getQualityLevel(currentProgress.qualityScore)">
              {{getQualityText(currentProgress.qualityScore)}}
            </div>
            <div class="quality-score">
              {{(currentProgress.qualityScore * 100) | number:'1.0-0'}}%
            </div>
          </div>

          <!-- Calibration Point Display -->
          <div class="calibration-point-display">
            <!-- Debug Info -->
            <div *ngIf="showDebug" class="point-debug">
              Point: {{currentCalibrationPoint?.x}}, {{currentCalibrationPoint?.y}}
            </div>
            
            <!-- Eye Tracking Guidance -->
            <div class="eye-guidance" *ngIf="currentCalibrationPoint">
              <div class="guidance-crosshair"
                   [style.left.px]="currentCalibrationPoint.x - 50"
                   [style.top.px]="currentCalibrationPoint.y - 50">
                <div class="crosshair-vertical"></div>
                <div class="crosshair-horizontal"></div>
              </div>
              
              <div class="guidance-circle"
                   [style.left.px]="currentCalibrationPoint.x - 25"
                   [style.top.px]="currentCalibrationPoint.y - 25">
              </div>
            </div>
            
            <div class="calibration-point"
                 [style.left.px]="currentCalibrationPoint?.x || 100"
                 [style.top.px]="currentCalibrationPoint?.y || 100"
                 [ngClass]="calibrationPointClass"
                 *ngIf="currentCalibrationPoint || showDebug">
              <!-- Center dot for precise focusing -->
              <div class="center-dot"></div>
            </div>
            
            <!-- Fallback point if no current point -->
            <div class="calibration-point fallback-point"
                 style="left: 200px; top: 200px;"
                 *ngIf="!currentCalibrationPoint">
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
            <p>👁️ <strong>มองตรงกลางจุดสีแดง</strong> และอย่าขยับหัวมากเกินไป</p>
            <p>🎯 <strong>เน้นมอง</strong>: ให้ตามองตรงกลางจุดที่มีเส้นกากบาท</p>
            <p>📐 <strong>ระยะห่าง</strong>: นั่งห่างจากหน้าจอประมาณ 50-70 ซม.</p>
            <div class="accuracy-feedback" *ngIf="showDebug && currentProgress">
              <small>คุณภาพปัจจุบัน: {{(currentProgress.qualityScore * 100) | number:'1.0-0'}}%</small>
            </div>
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
        <div *ngIf="calibrationStatus === CalibrationStatus.VALIDATING" class="processing-section">
          <div class="processing-content">
            <div class="processing-spinner">
              <div class="spinner"></div>
            </div>
            <h3>🔄 กำลังประมวลผล...</h3>
            <p>กรุณารอสักครู่ ระบบกำลังคำนวณการปรับเทียบ</p>
          </div>
        </div>

        <!-- Completed State -->
        <div *ngIf="calibrationStatus === CalibrationStatus.COMPLETED" class="completed-section">
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
        <div *ngIf="calibrationStatus === CalibrationStatus.FAILED" class="failed-section">
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

        <!-- Default/Fallback State -->
        <div *ngIf="calibrationStatus !== CalibrationStatus.COLLECTING && 
                    calibrationStatus !== CalibrationStatus.VALIDATING && 
                    calibrationStatus !== CalibrationStatus.COMPLETED && 
                    calibrationStatus !== CalibrationStatus.FAILED" class="intro-section">
          <div class="intro-content">
            <div class="intro-icon">🎯</div>
            <h3>เริ่มต้นการปรับเทียบ</h3>
            <p>การปรับเทียบจะช่วยเพิ่มความแม่นยำในการติดตามสายตา</p>
            
            <div class="calibration-options">
              <div class="option-group">
                <label for="pointCount">จำนวนจุดปรับเทียบ:</label>
                <select id="pointCount" [(ngModel)]="pointCount" class="form-select">
                  <option value="9">9 จุด (แนะนำ)</option>
                  <option value="13">13 จุด (ความแม่นยำสูง)</option>
                  <option value="16">16 จุด (ความแม่นยำสูงสุด)</option>
                </select>
              </div>
            </div>

            <div class="intro-actions">
              <button 
                class="btn btn-primary btn-large" 
                (click)="startCalibration()"
                [disabled]="!canStartCalibration">
                <span class="btn-icon">🚀</span>
                เริ่มการปรับเทียบ
              </button>
              
              <div class="requirements" *ngIf="!canStartCalibration">
                <div class="requirement-item" [ngClass]="{'met': cameraReady}">
                  <span class="status-icon">{{cameraReady ? '✅' : '❌'}}</span>
                  กล้องพร้อมใช้งาน
                </div>
              </div>
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
            <label>Status Text:</label>
            <span>{{getStatusText(calibrationStatus)}}</span>
          </div>
          <div class="debug-item">
            <label>IDLE Value:</label>
            <span>{{CalibrationStatus.IDLE}}</span>
          </div>
          <div class="debug-item">
            <label>Camera Ready:</label>
            <span>{{cameraReady}}</span>
          </div>
          <div class="debug-item">
            <label>Can Start:</label>
            <span>{{canStartCalibration}}</span>
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
            <span>{{(currentProgress.qualityScore * 100) | number:'1.0-0'}}%</span>
          </div>
          <div class="debug-item">
            <label>MediaPipe Ready:</label>
            <span>{{isMediaPipeReady() ? '✅ Yes' : '❌ No'}}</span>
          </div>
          <div class="debug-item">
            <label>Data Source:</label>
            <span>{{getDataSourceText()}}</span>
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
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .center-dot {
      width: 4px;
      height: 4px;
      background: white;
      border-radius: 50%;
      position: absolute;
    }

    .eye-guidance {
      position: absolute;
      pointer-events: none;
    }

    .guidance-crosshair {
      position: absolute;
      width: 100px;
      height: 100px;
      transform: translate(-50%, -50%);
    }

    .crosshair-vertical, .crosshair-horizontal {
      position: absolute;
      background: rgba(255, 255, 255, 0.3);
    }

    .crosshair-vertical {
      width: 1px;
      height: 100px;
      left: 50%;
      top: 0;
      transform: translateX(-50%);
    }

    .crosshair-horizontal {
      width: 100px;
      height: 1px;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }

    .guidance-circle {
      position: absolute;
      width: 50px;
      height: 50px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      animation: guidancePulse 2s infinite;
    }

    @keyframes guidancePulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.2; }
      50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.4; }
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

    .live-instructions {
      text-align: center;
      margin: 30px 0;
      padding: 20px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      border-left: 4px solid #2196f3;
    }

    .live-instructions p {
      margin: 8px 0;
      font-size: 1.1rem;
    }

    .accuracy-feedback {
      margin-top: 15px;
      padding: 10px;
      background: rgba(33, 150, 243, 0.2);
      border-radius: 6px;
      color: #81d4fa;
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
  
  // Expose enum for template
  CalibrationStatus = CalibrationStatus;
  
  // Component state
  calibrationStatus: CalibrationStatus = CalibrationStatus.IDLE;
  currentProgress: CalibrationProgress | null = null;
  lastResult: CalibrationResult | null = null;
  
  // Configuration
  pointCount: number = 9;
  showDebug = true; // Set to true for development
  
  // UI state
  currentCalibrationPoint: Point2D | null = null;
  calibrationPointClass = 'point-waiting';
  cameraReady = false;
  canStartCalibration = false;
  
  // Data collection
  private collectionTimer: any = null;
  private collectionInterval = 200; // ms between data samples
  private samplesCollected = 0;
  private currentPointIndex = 0; // Track current calibration point index

  constructor(
    private stateService: StateService,
    private calibrationService: EnhancedCalibrationService,
    private cameraService: CameraService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService,
    private mediapipeService: MediapipeService
  ) {}

  ngOnInit() {
    this.initializeComponent();
    this.subscribeToServices();
  }

  ngOnDestroy() {
    this.stopDataCollection();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeComponent() {
    try {
      console.log('Initializing calibration component...');
      console.log('Initial status:', this.calibrationStatus);
      console.log('IDLE enum value:', CalibrationStatus.IDLE);
      
      // Initialize MediaPipe service
      try {
        await this.mediapipeService.initialize();
        console.log('✅ MediaPipe service initialized for calibration');
      } catch (error) {
        console.warn('⚠️ MediaPipe initialization failed, will use mock data:', error);
      }
      
      // Check camera readiness
      await this.checkCameraStatus();
      
      // Load any existing calibration state
      this.loadCalibrationState();
      
      console.log('Component initialized, status:', this.calibrationStatus);
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to initialize calibration component');
    }
  }

  private subscribeToServices() {
    // Subscribe to calibration status
    this.calibrationService.getCalibrationStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe((status: CalibrationStatus) => {
        console.log('Status changed:', status);
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
        this.canStartCalibration = this.cameraReady && this.calibrationStatus === CalibrationStatus.IDLE;
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
    // Get last result from current session
    const currentSession = this.calibrationService.getCurrentSession();
    if (currentSession && currentSession.accuracy) {
      this.lastResult = {
        success: true,
        accuracy: currentSession.accuracy.accuracy,
        quality: 'good' as QualityLevel, // Default quality level
        duration: currentSession.endTime ? currentSession.endTime - currentSession.startTime : 0,
        matrix: {
          matrix: [],
          accuracy: currentSession.accuracy.accuracy,
          quality: 'good' as QualityLevel,
          pointCount: currentSession.points.length,
          timestamp: Date.now()
        },
        pointsData: []
      };
    }
  }

  private updateUIForStatus(status: CalibrationStatus) {
    switch (status) {
      case CalibrationStatus.INITIALIZING:
        // Reset point index when starting new calibration
        this.currentPointIndex = 0;
        break;
      case CalibrationStatus.COLLECTING:
        this.startCalibrationPointAnimation();
        break;
      case CalibrationStatus.COMPLETED:
      case CalibrationStatus.VALIDATING:
        // Stop any running data collection when calibration completes
        this.stopDataCollection();
        this.loadCalibrationState(); // Reload state instead of getLastResult
        break;
    }
  }

  private updateCalibrationDisplay() {
    if (!this.currentProgress) {
      console.log('No current progress');
      return;
    }

    console.log('Updating calibration display, progress:', this.currentProgress);
    console.log('Current point:', this.currentCalibrationPoint);

    // Update calibration point animation
    this.updateCalibrationPointAnimation();
  }

  private startCalibrationPointAnimation() {
    // Show real calibration points based on enhanced calibration service
    if (this.currentProgress) {
      console.log('Starting point animation for point:', this.currentPointIndex);
      
      // Get current session for point information
      const currentSession = this.calibrationService.getCurrentSession();
      console.log('Current session:', currentSession);
      
      if (currentSession && currentSession.points && currentSession.points.length > 0) {
        // Use the last point in the session
        const lastPoint = currentSession.points[currentSession.points.length - 1];
        this.currentCalibrationPoint = {
          x: lastPoint.screenX,
          y: lastPoint.screenY
        };
        console.log('Using session point:', this.currentCalibrationPoint);
      } else {
        // Fallback to generated point if service doesn't provide one
        this.currentCalibrationPoint = this.generateCalibrationPoint(this.currentPointIndex);
        console.log('Using generated point:', this.currentCalibrationPoint);
      }
      
      this.calibrationPointClass = 'point-active';
      
      // Start data collection timer
      this.startDataCollection();
    }
  }

  private startDataCollection() {
    this.samplesCollected = 0;
    console.log('Starting data collection...');
    
    this.collectionTimer = setInterval(() => {
      this.collectSample();
    }, this.collectionInterval);
  }

  private async collectSample() {
    if (!this.currentCalibrationPoint || !this.currentProgress) return;
    
    this.samplesCollected++;
    console.log(`Collecting sample ${this.samplesCollected}/${this.currentProgress.requiredSamples} for point ${this.currentPointIndex}`);
    
    try {
      // Try to extract real features from MediaPipe first
      const realFeatures = this.extractRealFeatures();
      
      if (realFeatures && realFeatures.length === 10) {
        console.log('✅ Using REAL eye tracking data from MediaPipe for calibration');
        
        // Check gaze accuracy for real features
        const gazeCheck = this.checkGazeAccuracy(realFeatures, this.currentCalibrationPoint);
        
        if (gazeCheck.isAccurate) {
          console.log(`✅ Good gaze alignment (${gazeCheck.accuracy.toFixed(1)}% accurate)`);
        } else {
          console.warn(`⚠️ Poor gaze alignment (${gazeCheck.accuracy.toFixed(1)}% accurate) - User may not be looking at target`);
          this.notifications.showWarning(`กรุณามองที่จุดสีแดง! (ความแม่นยำ: ${gazeCheck.accuracy.toFixed(0)}%)`);
        }
        
        const success = await this.calibrationService.addCalibrationPoint(
          this.currentCalibrationPoint.x,
          this.currentCalibrationPoint.y,
          realFeatures,
          window.innerWidth,
          window.innerHeight
        );
        
        this.handleSampleResult(success);
      } else {
        console.warn('⚠️ Failed to extract real features, falling back to MOCK data');
        
        // Use mock features as fallback
        const mockFeatures = this.generateMockFeatures();
        
        const success = await this.calibrationService.addCalibrationPoint(
          this.currentCalibrationPoint.x,
          this.currentCalibrationPoint.y,
          mockFeatures,
          window.innerWidth,
          window.innerHeight
        );
        
        this.handleSampleResult(success);
      }
      
    } catch (error) {
      console.error('Error collecting sample:', error);
      this.stopDataCollection();
    }
  }

  private checkGazeAccuracy(features: number[], targetPoint: Point2D): { isAccurate: boolean, accuracy: number } {
    // Extract eye positions from features
    // Features: [leftIrisX, leftIrisY, leftIrisZ, rightIrisX, rightIrisY, rightIrisZ, leftPupilX, leftPupilY, rightPupilX, rightPupilY]
    
    const leftEyeX = features[0];   // Left iris X (normalized)
    const leftEyeY = features[1];   // Left iris Y (normalized)
    const rightEyeX = features[3];  // Right iris X (normalized)
    const rightEyeY = features[4];  // Right iris Y (normalized)
    
    // Calculate average gaze direction
    const averageGazeX = (leftEyeX + rightEyeX) / 2;
    const averageGazeY = (leftEyeY + rightEyeY) / 2;
    
    // Convert target point to normalized coordinates
    const normalizedTargetX = targetPoint.x / window.innerWidth;
    const normalizedTargetY = targetPoint.y / window.innerHeight;
    
    // Calculate distance between gaze and target
    const distanceX = Math.abs(averageGazeX - normalizedTargetX);
    const distanceY = Math.abs(averageGazeY - normalizedTargetY);
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    // Calculate accuracy percentage (closer = higher accuracy)
    // Max acceptable distance is ~0.2 (20% of screen) for good accuracy
    const maxDistance = 0.2;
    const accuracy = Math.max(0, Math.min(100, (1 - distance / maxDistance) * 100));
    
    // Consider accurate if within 15% of screen distance and accuracy > 70%
    const isAccurate = distance < 0.15 && accuracy > 70;
    
    return { isAccurate, accuracy };
  }

  private handleSampleResult(success: boolean) {
    if (!this.currentProgress) return;
    
    // Check if current point is completed (using samplesCollected for this specific point)
    if (success && this.samplesCollected >= this.currentProgress.requiredSamples) {
      this.stopDataCollection();
      console.log(`Point ${this.currentPointIndex} collection completed, moving to next point`);
      
      // Check if we completed all points
      if (this.currentPointIndex >= this.currentProgress.totalPoints - 1) {
        console.log('All points completed, finishing calibration');
        // Ensure all timers are stopped before completing
        this.stopDataCollection();
        this.calibrationService.completeCalibration();
        return; // Exit to prevent further processing
      } else {
        // Move to next point
        setTimeout(() => {
          this.moveToNextPoint();
        }, 1000); // Brief pause before next point
      }
    }
  }

  private extractRealFeatures(): number[] | null {
    try {
      // Get video element from camera service
      const videoElement = document.querySelector('video') as HTMLVideoElement;
      if (!videoElement) {
        console.warn('No video element found for feature extraction');
        return null;
      }

      // Use MediaPipe service to get real facial landmarks
      const mediaPipeResults = this.mediapipeService.detectLandmarks(videoElement, Date.now());
      
      if (!mediaPipeResults || !mediaPipeResults.faceLandmarks || mediaPipeResults.faceLandmarks.length === 0) {
        console.warn('No face landmarks detected by MediaPipe');
        return null;
      }

      const landmarks = mediaPipeResults.faceLandmarks[0];
      if (landmarks.length < 478) {
        console.warn('Insufficient landmarks detected:', landmarks.length);
        return null;
      }

      // Extract real eye tracking features using same method as tracking workspace
      const LEFT_IRIS_INDICES = [473, 474, 475, 476, 477];
      const RIGHT_IRIS_INDICES = [468, 469, 470, 471, 472];
      const LEFT_PUPIL = 468;
      const RIGHT_PUPIL = 473;

      const leftIrisCenter = this.calculateAveragePosition(landmarks, LEFT_IRIS_INDICES);
      const rightIrisCenter = this.calculateAveragePosition(landmarks, RIGHT_IRIS_INDICES);
      const leftPupil = landmarks[LEFT_PUPIL];
      const rightPupil = landmarks[RIGHT_PUPIL];

      if (!leftIrisCenter || !rightIrisCenter || !leftPupil || !rightPupil) {
        console.warn('Failed to extract required landmark points');
        return null;
      }

      // Create 10-feature array for gaze estimation
      const features: number[] = [
        leftIrisCenter.x ?? 0, leftIrisCenter.y ?? 0, leftIrisCenter.z ?? 0,
        rightIrisCenter.x ?? 0, rightIrisCenter.y ?? 0, rightIrisCenter.z ?? 0,
        leftPupil.x ?? 0, leftPupil.y ?? 0,
        rightPupil.x ?? 0, rightPupil.y ?? 0
      ];

      // Validate features
      if (features.length !== 10) {
        console.warn(`Feature extraction error: expected 10 features, got ${features.length}`);
        return null;
      }
      
      if (features.some(isNaN)) {
        console.warn("NaN value detected in extracted features:", features);
        return null;
      }

      console.log('✅ Real features extracted from MediaPipe:', {
        leftIrisCenter,
        rightIrisCenter,
        leftPupil: { x: leftPupil.x, y: leftPupil.y },
        rightPupil: { x: rightPupil.x, y: rightPupil.y },
        features
      });

      return features;
      
    } catch (error) {
      console.error('Error extracting real features:', error);
      return null;
    }
  }

  private calculateAveragePosition(landmarks: any[], indices: number[]): { x: number, y: number, z?: number } | null {
    let sumX = 0, sumY = 0, sumZ = 0, count = 0;
    let hasZ = false;
    
    for (const index of indices) {
      const lm = landmarks?.[index];
      if (lm && typeof lm.x === 'number' && typeof lm.y === 'number') {
        sumX += lm.x; 
        sumY += lm.y;
        if (typeof lm.z === 'number') { 
          sumZ += lm.z; 
          hasZ = true; 
        }
        count++;
      }
    }
    
    if (count === 0) return null;
    
    const avgPos: { x: number, y: number, z?: number } = { 
      x: sumX / count, 
      y: sumY / count 
    };
    
    if (hasZ) { 
      avgPos.z = sumZ / count; 
    }
    
    return avgPos;
  }

  private stopDataCollection() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
  }

  private generateMockFeatures(): number[] {
    // Generate realistic mock eye tracking features (10 features) as fallback
    // These should match the structure of real features from MediaPipe
    return [
      // Left iris center (x, y, z) - normalized coordinates
      0.3 + (Math.random() - 0.5) * 0.1,  // x: around 0.3 ± 0.05
      0.4 + (Math.random() - 0.5) * 0.1,  // y: around 0.4 ± 0.05  
      0.0 + (Math.random() - 0.5) * 0.02, // z: around 0.0 ± 0.01
      // Right iris center (x, y, z) - normalized coordinates
      0.6 + (Math.random() - 0.5) * 0.1,  // x: around 0.6 ± 0.05
      0.4 + (Math.random() - 0.5) * 0.1,  // y: around 0.4 ± 0.05
      0.0 + (Math.random() - 0.5) * 0.02, // z: around 0.0 ± 0.01
      // Left pupil (x, y) - normalized coordinates
      0.3 + (Math.random() - 0.5) * 0.05, // x: around 0.3 ± 0.025
      0.4 + (Math.random() - 0.5) * 0.05, // y: around 0.4 ± 0.025
      // Right pupil (x, y) - normalized coordinates  
      0.6 + (Math.random() - 0.5) * 0.05, // x: around 0.6 ± 0.025
      0.4 + (Math.random() - 0.5) * 0.05  // y: around 0.4 ± 0.025
    ];
  }

  private moveToNextPoint() {
    if (!this.currentProgress) return;
    
    console.log(`Moving from point ${this.currentPointIndex} to next point`);
    
    // Move to next point
    this.currentPointIndex++;
    
    // Generate next point position
    if (this.currentPointIndex < this.currentProgress.totalPoints) {
      this.currentCalibrationPoint = this.generateCalibrationPoint(this.currentPointIndex);
      console.log(`Next point position (index ${this.currentPointIndex}):`, this.currentCalibrationPoint);
      
      // Reset sample counter for new point
      this.samplesCollected = 0;
      
      // Restart data collection for next point
      this.startDataCollection();
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
    
    // Ensure pointIndex is within valid range (0-8 for 9 points)
    const pointIdx = Math.max(0, pointIndex);
    const row = Math.floor(pointIdx / cols);
    const col = pointIdx % cols;
    
    console.log(`Generating point ${pointIndex}: row=${row}, col=${col}`);
    
    const availableWidth = window.innerWidth - (2 * margin);
    const availableHeight = window.innerHeight - (2 * margin);
    
    const x = margin + (col * availableWidth / (cols - 1));
    const y = margin + (row * availableHeight / (rows - 1));
    
    console.log(`Point coordinates: x=${x}, y=${y}, screen=${window.innerWidth}x${window.innerHeight}`);
    
    return { x, y };
  }

  // UI Event Handlers
  async startCalibration() {
    if (!this.canStartCalibration) return;

    try {
      // Show notification about data source
      if (this.isMediaPipeReady()) {
        this.notifications.showSuccess('🎯 เริ่มการปรับเทียบด้วยข้อมูลจากตาจริง!');
        console.log('✅ Starting calibration with REAL eye tracking data');
      } else {
        this.notifications.showWarning('⚠️ เริ่มการปรับเทียบด้วยข้อมูลจำลอง (MediaPipe ไม่พร้อม)');
        console.log('⚠️ Starting calibration with MOCK data (MediaPipe not ready)');
      }
      
      console.log('Starting calibration with', this.pointCount, 'points');
      await this.calibrationService.startCalibration(
        window.innerWidth, 
        window.innerHeight,
        { pointCount: this.pointCount }
      );
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to start calibration');
    }
  }

  async cancelCalibration() {
    try {
      console.log('Cancelling calibration...');
      await this.calibrationService.reset();
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to cancel calibration');
    }
  }

  async retryCalibration() {
    await this.calibrationService.reset();
    // Wait a moment then restart
    setTimeout(() => this.startCalibration(), 500);
  }

  async recalibrate() {
    await this.calibrationService.reset();
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
      [CalibrationStatus.IDLE]: 'ยังไม่เริ่ม',
      [CalibrationStatus.INITIALIZING]: 'กำลังเตรียม',
      [CalibrationStatus.COLLECTING]: 'กำลังเก็บข้อมูล',
      [CalibrationStatus.VALIDATING]: 'กำลังประมวลผล',
      [CalibrationStatus.COMPLETED]: 'สำเร็จแล้ว',
      [CalibrationStatus.FAILED]: 'ไม่สำเร็จ'
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

  isMediaPipeReady(): boolean {
    try {
      return this.mediapipeService && 
             typeof this.mediapipeService.isInitialized === 'boolean' && 
             this.mediapipeService.isInitialized;
    } catch (error) {
      return false;
    }
  }

  getDataSourceText(): string {
    if (this.isMediaPipeReady()) {
      return '👁️ Real Eye Data';
    }
    return '🎲 Mock Data';
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
