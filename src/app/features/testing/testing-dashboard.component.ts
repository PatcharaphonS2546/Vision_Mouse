/**
 * Testing & Validation Dashboard Component
 * Comprehensive testing suite for eye tracking accuracy and system validation
 */

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { TestingService } from '../../services/testing.service';
import { GazeProcessingService } from '../../services/gaze-processing.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { Point2D, GazeEstimationResult, QualityLevel } from '../../core/interfaces/core.interface';
import { 
  TestConfiguration, 
  TestSession, 
  TestTarget, 
  TestResults, 
  ValidationMetrics 
} from '../../core/interfaces/testing.interface';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  selector: 'app-testing-dashboard',
  template: `
    <div class="testing-dashboard">
      <!-- Header Section -->
      <div class="dashboard-header">
        <h2>
          <i class="icon-lab" aria-hidden="true"></i>
          Testing & Validation Dashboard
        </h2>
        <p class="description">
          ระบบทดสอบและตรวจสอบความแม่นยำของการติดตามสายตาแบบครอบคลุม
        </p>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button 
          class="btn btn-primary"
          [class.loading]="isLoading"
          (click)="runQuickTest()"
          [disabled]="isTestRunning">
          <i class="icon-play" aria-hidden="true"></i>
          {{ isTestRunning ? 'กำลังทดสอบ...' : 'ทดสอบด่วน' }}
        </button>
        
        <button 
          class="btn btn-secondary"
          (click)="validateSystem()"
          [disabled]="isLoading">
          <i class="icon-check-circle" aria-hidden="true"></i>
          ตรวจสอบระบบ
        </button>
        
        <button 
          class="btn btn-tertiary"
          (click)="showTestingHistory()">
          <i class="icon-history" aria-hidden="true"></i>
          ประวัติการทดสอบ
        </button>
      </div>

      <!-- Live Status -->
      <div class="live-status">
        <div class="status-card" [class]="systemStatus.overall">
          <h4>สถานะระบบ</h4>
          <div class="status-indicator">
            <div class="indicator-dot" [class]="systemStatus.overall"></div>
            <span>{{ getSystemStatusText() }}</span>
          </div>
          <p class="last-update">อัปเดตล่าสุด: {{ systemStatus.lastUpdate | date:'medium' }}</p>
        </div>

        <div class="status-card">
          <h4>ความแม่นยำปัจจุบัน</h4>
          <div class="metric-value">
            {{ liveMetrics.currentAccuracy | number:'1.1-1' }}%
          </div>
          <div class="metric-trend" [class]="getAccuracyTrend()">
            <i [class]="'icon-' + getAccuracyTrend()"></i>
            {{ getAccuracyTrendText() }}
          </div>
        </div>

        <div class="status-card">
          <h4>เวลาตอบสนอง</h4>
          <div class="metric-value">
            {{ liveMetrics.responseTime | number:'1.0-0' }}ms
          </div>
          <div class="quality-indicator" [class]="getResponseTimeQuality()">
            {{ getResponseTimeText() }}
          </div>
        </div>

        <div class="status-card">
          <h4>ความเสถียร</h4>
          <div class="metric-value">
            {{ liveMetrics.stability | number:'1.1-1' }}%
          </div>
          <div class="stability-bar">
            <div class="bar-fill" [style.width.%]="liveMetrics.stability"></div>
          </div>
        </div>
      </div>

      <!-- Test Configuration Section -->
      <div class="test-configuration" *ngIf="!isTestRunning">
        <h3>การกำหนดค่าการทดสอบ</h3>
        
        <div class="config-grid">
          <div class="config-section">
            <label for="testType">ประเภทการทดสอบ</label>
            <select id="testType" [(ngModel)]="selectedTestType" (change)="onTestTypeChange()">
              <option value="">เลือกประเภทการทดสอบ</option>
              <option value="accuracy">ทดสอบความแม่นยำ</option>
              <option value="precision">ทดสอบความแม่เจอ</option>
              <option value="stability">ทดสอบความเสถียร</option>
              <option value="response">ทดสอบเวลาตอบสนอง</option>
              <option value="drift">วิเคราะห์การดริฟต์</option>
              <option value="comprehensive">ทดสอบครอบคลุม</option>
            </select>
          </div>

          <div class="config-section">
            <label for="testPattern">รูปแบบการทดสอบ</label>
            <select id="testPattern" [(ngModel)]="selectedTestPattern">
              <option value="grid">แบบตาราง</option>
              <option value="random">แบบสุ่ม</option>
              <option value="circular">แบบวงกลม</option>
              <option value="diagonal">แบบเส้นทแยง</option>
              <option value="fixation">จุดจับจ้อง</option>
            </select>
          </div>

          <div class="config-section">
            <label for="targetCount">จำนวนเป้าหมาย</label>
            <input 
              type="number" 
              id="targetCount" 
              [(ngModel)]="customConfig.targetCount"
              min="1" 
              max="25"
              class="form-control">
          </div>

          <div class="config-section">
            <label for="targetDuration">ระยะเวลาต่อเป้าหมาย (ms)</label>
            <input 
              type="number" 
              id="targetDuration" 
              [(ngModel)]="customConfig.targetDuration"
              min="500" 
              max="10000"
              step="100"
              class="form-control">
          </div>
        </div>

        <div class="advanced-settings">
          <button 
            class="btn btn-ghost"
            (click)="showAdvancedSettings = !showAdvancedSettings">
            <i class="icon-settings" aria-hidden="true"></i>
            การตั้งค่าขั้นสูง
            <i [class]="showAdvancedSettings ? 'icon-chevron-up' : 'icon-chevron-down'"></i>
          </button>

          <div class="advanced-panel" *ngIf="showAdvancedSettings">
            <div class="setting-row">
              <label>
                <input 
                  type="checkbox" 
                  [(ngModel)]="customConfig.recordGazeTrail">
                บันทึกเส้นทางการมอง
              </label>
            </div>
            
            <div class="setting-row">
              <label>
                <input 
                  type="checkbox" 
                  [(ngModel)]="customConfig.showFeedback">
                แสดงผลป้อนกลับแบบเรียลไทม์
              </label>
            </div>

            <div class="setting-row">
              <label for="accuracyThreshold">เกณฑ์ความแม่นยำ (%)</label>
              <input 
                type="number" 
                id="accuracyThreshold"
                [(ngModel)]="customConfig.accuracyThreshold"
                min="50" 
                max="100"
                class="form-control">
            </div>
          </div>
        </div>

        <div class="test-actions">
          <button 
            class="btn btn-primary btn-lg"
            (click)="startCustomTest()"
            [disabled]="!selectedTestType || isLoading">
            <i class="icon-play" aria-hidden="true"></i>
            เริ่มการทดสอบ
          </button>
        </div>
      </div>

      <!-- Active Test Section -->
      <div class="active-test" *ngIf="isTestRunning && currentSession">
        <div class="test-header">
          <h3>{{ currentSession.configuration.name }}</h3>
          <div class="test-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                [style.width.%]="getTestProgress()">
              </div>
            </div>
            <span class="progress-text">
              {{ currentSession.currentTargetIndex + 1 }} / {{ currentSession.targets.length }}
            </span>
          </div>
        </div>

        <div class="test-area">
          <canvas 
            #testCanvas
            class="test-canvas"
            width="800" 
            height="600"
            (click)="onCanvasClick($event)">
          </canvas>
          
          <div class="test-overlay">
            <div class="current-target-info" *ngIf="getCurrentTarget()">
              <p>เป้าหมายปัจจุบัน: {{ currentSession.currentTargetIndex + 1 }}</p>
              <p>เวลาที่เหลือ: {{ getRemainingTime() }}s</p>
            </div>
            
            <div class="live-feedback" *ngIf="customConfig.showFeedback">
              <div class="feedback-metric">
                <span>ความแม่นยำ:</span>
                <span class="value">{{ liveMetrics.currentAccuracy | number:'1.1-1' }}%</span>
              </div>
              <div class="feedback-metric">
                <span>ความมั่นใจ:</span>
                <span class="value">{{ liveMetrics.confidence | number:'1.1-1' }}%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="test-controls">
          <button 
            class="btn btn-warning"
            (click)="pauseTest()"
            *ngIf="currentSession.status === 'running'">
            <i class="icon-pause" aria-hidden="true"></i>
            หยุดชั่วคราว
          </button>

          <button 
            class="btn btn-primary"
            (click)="resumeTest()"
            *ngIf="currentSession.status === 'paused'">
            <i class="icon-play" aria-hidden="true"></i>
            ดำเนินการต่อ
          </button>

          <button 
            class="btn btn-danger"
            (click)="stopTest()">
            <i class="icon-stop" aria-hidden="true"></i>
            หยุดการทดสอบ
          </button>

          <button 
            class="btn btn-ghost"
            (click)="skipTarget()"
            *ngIf="currentSession.status === 'running'">
            <i class="icon-skip-forward" aria-hidden="true"></i>
            ข้ามเป้าหมาย
          </button>
        </div>
      </div>

      <!-- Test Results Section -->
      <div class="test-results" *ngIf="currentSession?.results">
        <h3>ผลการทดสอบ</h3>
        
        <div class="results-summary">
          <div class="summary-card excellent">
            <h4>ความแม่นยำโดยรวม</h4>
            <div class="metric-large">
              {{ (currentSession?.results?.overallAccuracy || 0) | number:'1.1-1' }}%
            </div>
            <div class="metric-grade">{{ getAccuracyGrade(currentSession?.results?.overallAccuracy || 0) }}</div>
          </div>

          <div class="summary-card good">
            <h4>เวลาตอบสนองเฉลี่ย</h4>
            <div class="metric-large">
              {{ (currentSession?.results?.averageResponseTime || 0) | number:'1.0-0' }}ms
            </div>
            <div class="metric-grade">{{ getResponseTimeGrade(currentSession?.results?.averageResponseTime || 0) }}</div>
          </div>

          <div class="summary-card">
            <h4>ความแม่เจอ</h4>
            <div class="metric-large">
              {{ (currentSession?.results?.precision || 0) | number:'1.1-1' }}%
            </div>
          </div>

          <div class="summary-card">
            <h4>ความสม่ำเสมอ</h4>
            <div class="metric-large">
              {{ (currentSession?.results?.consistency || 0) | number:'1.1-1' }}%
            </div>
          </div>
        </div>

        <div class="detailed-analysis">
          <div class="analysis-tabs">
            <button 
              class="tab-button"
              [class.active]="activeAnalysisTab === 'spatial'"
              (click)="activeAnalysisTab = 'spatial'">
              การวิเคราะห์เชิงพื้นที่
            </button>
            <button 
              class="tab-button"
              [class.active]="activeAnalysisTab === 'temporal'"
              (click)="activeAnalysisTab = 'temporal'">
              การวิเคราะห์เชิงเวลา
            </button>
            <button 
              class="tab-button"
              [class.active]="activeAnalysisTab === 'targets'"
              (click)="activeAnalysisTab = 'targets'">
              ผลตามเป้าหมาย
            </button>
          </div>

          <div class="tab-content">
            <!-- Spatial Analysis -->
            <div class="analysis-panel" *ngIf="activeAnalysisTab === 'spatial'">
              <div class="spatial-metrics">
                <div class="metric-row">
                  <span>ค่าเฉลี่ยการเยื้อง:</span>
                  <span>{{ (currentSession?.results?.spatialAnalysis?.offsetMagnitude || 0) | number:'1.1-1' }}px</span>
                </div>
                <div class="metric-row">
                  <span>รัศมีความแม่เจอ:</span>
                  <span>{{ (currentSession?.results?.spatialAnalysis?.precisionRadius || 0) | number:'1.1-1' }}px</span>
                </div>
                <div class="metric-row">
                  <span>ความแม่นยำส่วนกลาง:</span>
                  <span>{{ (currentSession?.results?.spatialAnalysis?.regionAccuracy?.centerAccuracy || 0) | number:'1.1-1' }}%</span>
                </div>
              </div>

              <div class="heatmap-container">
                <h5>แผนที่ความร้อนการมอง</h5>
                <canvas 
                  #heatmapCanvas
                  class="heatmap-canvas"
                  width="400" 
                  height="300">
                </canvas>
              </div>
            </div>

            <!-- Temporal Analysis -->
            <div class="analysis-panel" *ngIf="activeAnalysisTab === 'temporal'">
              <div class="temporal-metrics">
                <div class="metric-row">
                  <span>อัตราการดริฟต์:</span>
                  <span>{{ (currentSession?.results?.temporalAnalysis?.driftRate || 0) | number:'1.2-2' }}px/min</span>
                </div>
                <div class="metric-row">
                  <span>ผลกระทบจากความเหนื่อย:</span>
                  <span>{{ (currentSession?.results?.temporalAnalysis?.fatigueEffect || 0) | number:'1.1-1' }}%</span>
                </div>
                <div class="metric-row">
                  <span>ความสม่ำเสมอเชิงเวลา:</span>
                  <span>{{ (currentSession?.results?.temporalAnalysis?.consistencyMetric || 0) | number:'1.1-1' }}%</span>
                </div>
              </div>

              <div class="chart-container">
                <h5>แนวโน้มความแม่นยำตามเวลา</h5>
                <canvas 
                  #accuracyChart
                  class="chart-canvas"
                  width="400" 
                  height="200">
                </canvas>
              </div>
            </div>

            <!-- Target Results -->
            <div class="analysis-panel" *ngIf="activeAnalysisTab === 'targets'">
              <div class="target-results-table">
                <table>
                  <thead>
                    <tr>
                      <th>เป้าหมาย</th>
                      <th>ตำแหน่ง</th>
                      <th>ความแม่นยำ</th>
                      <th>เวลาตอบสนอง</th>
                      <th>คุณภาพ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let result of currentSession?.results?.targetResults || []; let i = index">
                      <td>{{ i + 1 }}</td>
                      <td>({{ result.position.x | number:'1.0-0' }}, {{ result.position.y | number:'1.0-0' }})</td>
                      <td>
                        <span [class]="getAccuracyClass(result.accuracy)">
                          {{ result.accuracy | number:'1.1-1' }}%
                        </span>
                      </td>
                      <td>{{ result.responseTime | number:'1.0-0' }}ms</td>
                      <td>
                        <span class="quality-badge" [class]="getQualityClass(result.accuracy)">
                          {{ getQualityText(result.accuracy) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div class="recommendations" *ngIf="(currentSession?.results?.recommendations?.length || 0) > 0">
          <h4>คำแนะนำ</h4>
          <ul class="recommendation-list">
            <li *ngFor="let recommendation of currentSession?.results?.recommendations || []">
              <i class="icon-info-circle" aria-hidden="true"></i>
              {{ typeof recommendation === 'string' ? recommendation : recommendation.description }}
            </li>
          </ul>
        </div>

        <div class="results-actions">
          <button 
            class="btn btn-primary"
            (click)="exportResults('json')">
            <i class="icon-download" aria-hidden="true"></i>
            ส่งออก JSON
          </button>
          
          <button 
            class="btn btn-secondary"
            (click)="exportResults('csv')">
            <i class="icon-file-text" aria-hidden="true"></i>
            ส่งออก CSV
          </button>
          
          <button 
            class="btn btn-tertiary"
            (click)="shareResults()">
            <i class="icon-share" aria-hidden="true"></i>
            แชร์ผลลัพธ์
          </button>

          <button 
            class="btn btn-ghost"
            (click)="clearResults()">
            <i class="icon-trash-2" aria-hidden="true"></i>
            ล้างผลลัพธ์
          </button>
        </div>
      </div>

      <!-- Environmental Monitoring -->
      <div class="environmental-monitoring">
        <h3>การตรวจสอบสภาพแวดล้อม</h3>
        
        <div class="env-grid">
          <div class="env-card">
            <div class="env-icon">
              <i class="icon-sun" aria-hidden="true"></i>
            </div>
            <div class="env-content">
              <h5>แสงสว่าง</h5>
              <div class="env-status" [class]="environmentalFactors.lighting">
                {{ getLightingText() }}
              </div>
              <div class="env-meter">
                <div class="meter-fill" [style.width.%]="getLightingLevel()"></div>
              </div>
            </div>
          </div>

          <div class="env-card">
            <div class="env-icon">
              <i class="icon-move" aria-hidden="true"></i>
            </div>
            <div class="env-content">
              <h5>การเคลื่อนไหวของหัว</h5>
              <div class="env-status" [class]="getHeadMovementClass()">
                {{ getHeadMovementText() }}
              </div>
              <div class="env-meter">
                <div class="meter-fill" [style.width.%]="environmentalFactors.headMovement"></div>
              </div>
            </div>
          </div>

          <div class="env-card">
            <div class="env-icon">
              <i class="icon-eye" aria-hidden="true"></i>
            </div>
            <div class="env-content">
              <h5>การมองเห็นดวงตา</h5>
              <div class="env-status" [class]="environmentalFactors.eyeVisibility">
                {{ getEyeVisibilityText() }}
              </div>
              <div class="env-meter">
                <div class="meter-fill" [style.width.%]="getEyeVisibilityLevel()"></div>
              </div>
            </div>
          </div>

          <div class="env-card">
            <div class="env-icon">
              <i class="icon-settings" aria-hidden="true"></i>
            </div>
            <div class="env-content">
              <h5>การปรับเทียบ</h5>
              <div class="env-status" [class]="getCalibrationAgeClass()">
                {{ getCalibrationText() }}
              </div>
              <p class="calibration-time">
                {{ getCalibrationAgeText() }}
              </p>
            </div>
          </div>
        </div>

        <div class="env-alerts" *ngIf="environmentalAlerts.length > 0">
          <h4>การแจ้งเตือนสภาพแวดล้อม</h4>
          <div class="alert-list">
            <div 
              class="alert-item"
              [class]="alert.severity"
              *ngFor="let alert of environmentalAlerts">
              <i [class]="'icon-' + alert.type" aria-hidden="true"></i>
              <span>{{ alert.message }}</span>
              <button 
                class="alert-dismiss"
                (click)="dismissAlert(alert.id)">
                <i class="icon-x" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Sessions -->
      <div class="recent-sessions">
        <div class="section-header">
          <h3>เซสชันล่าสุด</h3>
          <button 
            class="btn btn-ghost btn-sm"
            (click)="loadMoreSessions()">
            <i class="icon-refresh-cw" aria-hidden="true"></i>
            โหลดเพิ่มเติม
          </button>
        </div>

        <div class="sessions-grid">
          <div 
            class="session-card"
            *ngFor="let session of recentSessions"
            (click)="viewSession(session)">
            <div class="session-header">
              <h4>{{ session.configuration.name }}</h4>
              <span class="session-date">{{ session.startTime | date:'short' }}</span>
            </div>
            <div class="session-metrics">
              <div class="metric">
                <span class="label">ความแม่นยำ:</span>
                <span class="value" [class]="getAccuracyClass(session.results?.overallAccuracy || 0)">
                  {{ session.results?.overallAccuracy | number:'1.1-1' }}%
                </span>
              </div>
              <div class="metric">
                <span class="label">เวลาตอบสนอง:</span>
                <span class="value">{{ session.results?.averageResponseTime | number:'1.0-0' }}ms</span>
              </div>
            </div>
            <div class="session-status">
              <span class="status-badge" [class]="session.status">
                {{ getStatusText(session.status) }}
              </span>
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="recentSessions.length === 0">
          <i class="icon-inbox" aria-hidden="true"></i>
          <p>ยังไม่มีเซสชันการทดสอบ</p>
          <button 
            class="btn btn-primary"
            (click)="runQuickTest()">
            เริ่มการทดสอบแรก
          </button>
        </div>
      </div>

      <!-- Gaze Visualization -->
      <div class="gaze-visualization" *ngIf="liveMetrics.gazeTrail.length > 0">
        <h3>การแสดงภาพการมอง</h3>
        
        <div class="visualization-container">
          <canvas 
            #gazeVizCanvas
            class="gaze-canvas"
            width="400" 
            height="300">
          </canvas>
          
          <div class="viz-controls">
            <label>
              <input 
                type="checkbox" 
                [(ngModel)]="showGazeTrail">
              แสดงเส้นทางการมอง
            </label>
            
            <label>
              <input 
                type="checkbox" 
                [(ngModel)]="showHeatmap">
              แสดงแผนที่ความร้อน
            </label>
            
            <button 
              class="btn btn-sm btn-ghost"
              (click)="clearGazeVisualization()">
              <i class="icon-trash-2" aria-hidden="true"></i>
              ล้างการแสดงภาพ
            </button>
          </div>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div class="loading-overlay" *ngIf="isLoading">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p>{{ loadingMessage }}</p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./testing-dashboard.component.css']
})
export class TestingDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  
  @ViewChild('testCanvas', { static: false }) testCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gazeVizCanvas', { static: false }) gazeVizCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('heatmapCanvas', { static: false }) heatmapCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('accuracyChart', { static: false }) accuracyChart!: ElementRef<HTMLCanvasElement>;

  // Component State
  private destroy$ = new Subject<void>();
  
  // Test Configuration
  selectedTestType: string = '';
  selectedTestPattern: string = 'grid';
  showAdvancedSettings: boolean = false;
  
  customConfig = {
    targetCount: 9,
    targetDuration: 2000,
    accuracyThreshold: 85,
    recordGazeTrail: true,
    showFeedback: false
  };

  // Test Session State
  currentSession: TestSession | null = null;
  isTestRunning: boolean = false;
  isLoading: boolean = false;
  loadingMessage: string = '';

  // Live Metrics
  liveMetrics = {
    currentAccuracy: 0,
    responseTime: 0,
    stability: 0,
    confidence: 0,
    gazeTrail: [] as Point2D[]
  };

  // System Status
  systemStatus = {
    overall: 'good' as QualityLevel,
    lastUpdate: new Date()
  };

  // Environmental Factors
  environmentalFactors = {
    lighting: 'optimal' as QualityLevel,
    headMovement: 5,
    eyeVisibility: 'excellent' as QualityLevel,
    calibrationAge: 0
  };

  environmentalAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
  }> = [];

  // UI State
  activeAnalysisTab: string = 'spatial';
  showGazeTrail: boolean = true;
  showHeatmap: boolean = false;

  // Recent Sessions
  recentSessions: TestSession[] = [];

  // Canvas Contexts
  private testContext: CanvasRenderingContext2D | null = null;
  private gazeVizContext: CanvasRenderingContext2D | null = null;

  constructor(
    private testingService: TestingService,
    private gazeProcessingService: GazeProcessingService,
    private errorHandler: ErrorHandlerService
  ) {}

  ngOnInit() {
    this.initializeTestingDashboard();
    this.loadRecentSessions();
    this.startEnvironmentalMonitoring();
  }

  ngAfterViewInit() {
    this.initializeCanvases();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Initialization methods
  private initializeTestingDashboard() {
    this.setupTestingSubscriptions();
  }

  private setupTestingSubscriptions(): void {
    // Subscribe to current test session
    this.testingService.currentSession
      .pipe(takeUntil(this.destroy$))
      .subscribe(session => {
        if (session) {
          this.currentSession = session;
          this.isTestRunning = session.status === 'running' || session.status === 'paused';
        }
      });

    // Subscribe to live gaze data
    this.testingService.liveGazeData
      .pipe(takeUntil(this.destroy$))
      .subscribe(gazeData => {
        if (gazeData && this.isTestRunning) {
          this.updateGazeVisualization(gazeData);
        }
      });

    // Subscribe to test metrics
    this.testingService.testMetrics
      .pipe(takeUntil(this.destroy$))
      .subscribe(metrics => {
        if (metrics) {
          this.updateLiveMetrics(metrics);
        }
      });
  }

  private initializeCanvases() {
    if (this.testCanvas?.nativeElement) {
      this.testContext = this.testCanvas.nativeElement.getContext('2d')!;
    }
    
    if (this.gazeVizCanvas?.nativeElement) {
      this.gazeVizContext = this.gazeVizCanvas.nativeElement.getContext('2d')!;
    }
  }

  private loadRecentSessions() {
    // Simulate loading recent sessions
    this.recentSessions = [
      {
        id: 'session_1',
        configuration: {
          name: 'ทดสอบความแม่นยำ #3',
          type: 'accuracy',
          pattern: 'grid',
          targetCount: 9,
          targetDuration: 2000,
          accuracyThreshold: 85,
          recordGazeTrail: true,
          showFeedback: false
        },
        targets: [],
        status: 'completed',
        currentTargetIndex: 0,
        startTime: new Date(Date.now() - 86400000),
        results: {
          overallAccuracy: 87.5,
          averageResponseTime: 420,
          precision: 85.2,
          consistency: 82.1,
          stability: 89.3,
          qualityScore: 86.8,
          targetResults: [],
          spatialAnalysis: {
            averageOffset: { x: 0, y: 0 },
            offsetMagnitude: 15.2,
            precisionRadius: 28.5,
            spatialDistribution: { quadrants: [], zones: [], radialDistribution: [] },
            regionAccuracy: { cornerAccuracy: [], edgeAccuracy: [], centerAccuracy: 90, peripheryAccuracy: 85 },
            heatmapData: []
          },
          temporalAnalysis: {
            driftRate: 2.1,
            stabilityOverTime: [],
            fatigueEffect: 5.2,
            learningCurve: [],
            consistencyMetric: 82.1,
            responseTimeProgression: [],
            accuracyProgression: [],
            timeSeriesData: []
          },
          gazeAnalysis: {
            fixationAnalysis: { averageDuration: 0, fixationCount: 0, fixationRate: 0, stabilityIndex: 0, dispersionMetrics: { averageDispersion: 0, maxDispersion: 0, dispersionVariability: 0 } },
            saccadeAnalysis: { saccadeCount: 0, averageAmplitude: 0, averageVelocity: 0, averageLatency: 0, accuracyMetrics: { overshootRate: 0, undershootRate: 0, directionalAccuracy: 0, velocityConsistency: 0 } },
            smoothPursuitAnalysis: { gainValue: 0, phaseShift: 0, catchUpSaccades: 0, smoothnessIndex: 0 },
            blinkAnalysis: { blinkRate: 0, averageBlinkDuration: 0, blinkDistribution: [], dataLossPercentage: 0 },
            attentionAnalysis: { focusDistribution: { centralFocus: 0, peripheralFocus: 0, scanningBehavior: 0, explorationIndex: 0 }, attentionSpan: 0, distractionEvents: [], engagementScore: 0 }
          },
          recommendations: [{
            type: 'calibration',
            priority: 'high',
            title: 'ปรับเทียบระบบ',
            description: 'แนะนำให้ปรับเทียบระบบใหม่เพื่อเพิ่มความแม่นยำ',
            actionItems: ['ทำการปรับเทียบใหม่', 'ตรวจสอบการตั้งค่า'],
            expectedImpact: 'เพิ่มความแม่นยำ 15-25%',
            category: 'accuracy'
          }],
          environmentalFactors: { lightingCondition: 'optimal', headMovement: 'minimal', eyeVisibility: 'excellent', backgroundNoise: 'low', calibrationAge: 10 },
          statisticalSummary: { sampleSize: 0, confidenceInterval: { level: 0, lowerBound: 0, upperBound: 0, marginOfError: 0 }, distributionAnalysis: { mean: 0, median: 0, mode: 0, standardDeviation: 0, variance: 0, skewness: 0, kurtosis: 0, normality: { testName: '', pValue: 0, isNormal: false, significance: 0 } }, outlierAnalysis: { outlierCount: 0, outlierPercentage: 0, outlierThreshold: 0, outlierPoints: [] }, correlationMatrix: { accuracyVsResponseTime: 0, accuracyVsStability: 0, responseTimeVsConfidence: 0, stabilityVsEnvironment: 0 } }
        },
        metadata: {
          sessionId: 'session_1',
          createdAt: new Date(),
          version: '1.0.0',
          deviceInfo: { userAgent: '', screenResolution: { width: 0, height: 0 }, pixelRatio: 0 },
          environmentInfo: { lightingLevel: 0, ambientNoise: 0, timestamp: new Date(), conditions: { lighting: 'optimal', headMovement: 'minimal', eyeVisibility: 'excellent', backgroundNoise: 'low', distractions: 'none' } }
        }
      }
    ];
  }

  private startEnvironmentalMonitoring() {
    // Monitor environmental factors
    interval(5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateEnvironmentalFactors();
      });
  }

  private updateEnvironmentalFactors() {
    // Simulate environmental monitoring
    this.environmentalFactors.calibrationAge += 1;
    
    // Check for alerts
    if (this.environmentalFactors.calibrationAge > 30) {
      this.addEnvironmentalAlert('warning', 'calibration', 'แนะนำให้ปรับเทียบระบบใหม่');
    }
  }

  private addEnvironmentalAlert(severity: string, type: string, message: string) {
    const alertId = `alert_${Date.now()}`;
    
    // Check if alert already exists
    if (!this.environmentalAlerts.find(a => a.type === type)) {
      this.environmentalAlerts.push({
        id: alertId,
        severity,
        type,
        message
      });
    }
  }

  // Test Control Methods
  onTestTypeChange() {
    if (this.selectedTestType) {
      const configs = this.testingService.getTestConfigurations();
      const config = configs[this.selectedTestType];
      
      if (config) {
        this.customConfig.targetCount = config.targetCount;
        this.customConfig.targetDuration = config.targetDuration;
        this.customConfig.accuracyThreshold = config.accuracyThreshold;
        this.selectedTestPattern = config.pattern;
      }
    }
  }

  async runQuickTest() {
    try {
      this.isLoading = true;
      this.loadingMessage = 'กำลังเตรียมการทดสอบด่วน...';

      const session = this.testingService.createTestSession('accuracy');
      await this.testingService.startTest(session.id);
      
      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      this.errorHandler.handleError(error as Error, 'ไม่สามารถเริ่มการทดสอบด่วนได้');
    }
  }

  async startCustomTest() {
    if (!this.selectedTestType) return;

    try {
      this.isLoading = true;
      this.loadingMessage = 'กำลังเริ่มการทดสอบ...';

      const session = this.testingService.createTestSession(this.selectedTestType, {
        pattern: this.selectedTestPattern as any,
        targetCount: this.customConfig.targetCount,
        targetDuration: this.customConfig.targetDuration,
        accuracyThreshold: this.customConfig.accuracyThreshold,
        recordGazeTrail: this.customConfig.recordGazeTrail,
        showFeedback: this.customConfig.showFeedback
      });

      await this.testingService.startTest(session.id);
      
      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      this.errorHandler.handleError(error as Error, 'ไม่สามารถเริ่มการทดสอบได้');
    }
  }

  pauseTest() {
    this.testingService.pauseTest();
  }

  resumeTest() {
    this.testingService.resumeTest();
  }

  stopTest() {
    this.testingService.stopTest();
    this.isTestRunning = false;
  }

  skipTarget() {
    this.testingService.nextTarget();
  }

  async validateSystem() {
    try {
      this.isLoading = true;
      this.loadingMessage = 'กำลังตรวจสอบระบบ...';

      const metrics = await this.testingService.validateSystem();
      
      // Update UI with validation results
      this.updateLiveMetrics(metrics);
      
      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      this.errorHandler.handleError(error as Error, 'ไม่สามารถตรวจสอบระบบได้');
    }
  }

  // Canvas Event Handlers
  onCanvasClick(event: MouseEvent) {
    if (!this.isTestRunning || !this.currentSession) return;

    const rect = this.testCanvas.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Use real gaze processing instead of simulation
    const videoElement = this.getVideoElement(); // Helper method to get video element
    if (videoElement) {
      const frameResult = this.gazeProcessingService.processFrame(
        videoElement,
        true,
        null,
        Date.now()
      );
      
      if (frameResult && frameResult.predictedGaze) {
        const gazeResult: GazeEstimationResult = {
          gazePoint: frameResult.predictedGaze,
          gazeVector: {
            origin: { x: 0, y: 0, z: 0 },
            direction: { 
              x: frameResult.leftGazeVector?.[0] || 0, 
              y: frameResult.leftGazeVector?.[1] || 0, 
              z: frameResult.leftGazeVector?.[2] || 1 
            },
            confidence: frameResult.quality.overall
          },
          confidence: frameResult.quality.overall,
          quality: this.mapQualityLevel(frameResult.quality.overall),
          headPose: frameResult.headPose || {
            yaw: 0,
            pitch: 0,
            roll: 0,
            confidence: 0.9
          },
          pupilData: {
            leftPupil: { 
              center: { 
                x: frameResult.leftEyeballCenter?.[0] || 100, 
                y: frameResult.leftEyeballCenter?.[1] || 100 
              }, 
              diameter: 6, 
              confidence: frameResult.quality.eyeDetection 
            },
            rightPupil: { 
              center: { 
                x: frameResult.rightEyeballCenter?.[0] || 120, 
                y: frameResult.rightEyeballCenter?.[1] || 100 
              }, 
              diameter: 6, 
              confidence: frameResult.quality.eyeDetection 
            }
          },
          timestamp: Date.now(),
          processingTime: frameResult.processingTime
        };
        
        this.testingService.addGazeData(gazeResult);
      }
    } else {
      // Fallback to click position when video not available
      const gazeResult: GazeEstimationResult = {
        gazePoint: { x, y },
        gazeVector: {
          origin: { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 0, z: 1 },
          confidence: 0.5
        },
        confidence: 0.5,
        quality: 'fair',
        headPose: {
          yaw: 0,
          pitch: 0,
          roll: 0,
          confidence: 0.5
        },
        pupilData: {
          leftPupil: { center: { x: 100, y: 100 }, diameter: 6, confidence: 0.5 },
          rightPupil: { center: { x: 120, y: 100 }, diameter: 6, confidence: 0.5 }
        },
        timestamp: Date.now(),
        processingTime: 20
      };
      
      this.testingService.addGazeData(gazeResult);
    }
  }

  // Helper method to get video element (can be implemented based on your video setup)
  private getVideoElement(): HTMLVideoElement | null {
    // Return null for now - implement based on your video element setup
    return null;
  }

  // Helper method to map quality
  private mapQualityLevel(confidence: number): QualityLevel {
    if (confidence >= 0.8) return 'excellent';
    if (confidence >= 0.6) return 'good';
    if (confidence >= 0.4) return 'fair';
    return 'poor';
  }

  // UI Update Methods
  private updateLiveMetrics(metrics: ValidationMetrics) {
    this.liveMetrics.currentAccuracy = metrics.spatialAccuracy;
    this.liveMetrics.stability = metrics.temporalStability;
    this.liveMetrics.confidence = metrics.fixationAccuracy;
  }

  private updateGazeVisualization(gazeData: GazeEstimationResult) {
    if (!this.gazeVizContext) return;

    this.liveMetrics.gazeTrail.push(gazeData.gazePoint);
    
    // Keep only last 50 points
    if (this.liveMetrics.gazeTrail.length > 50) {
      this.liveMetrics.gazeTrail = this.liveMetrics.gazeTrail.slice(-50);
    }

    this.drawGazeVisualization();
  }

  private drawGazeVisualization() {
    if (!this.gazeVizContext) return;

    const ctx = this.gazeVizContext;
    const canvas = this.gazeVizCanvas.nativeElement;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.showGazeTrail && this.liveMetrics.gazeTrail.length > 1) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      this.liveMetrics.gazeTrail.forEach((point, index) => {
        const x = (point.x / 800) * canvas.width;
        const y = (point.y / 600) * canvas.height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }

    // Draw current gaze point
    if (this.liveMetrics.gazeTrail.length > 0) {
      const lastPoint = this.liveMetrics.gazeTrail[this.liveMetrics.gazeTrail.length - 1];
      const x = (lastPoint.x / 800) * canvas.width;
      const y = (lastPoint.y / 600) * canvas.height;
      
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  clearGazeVisualization() {
    this.liveMetrics.gazeTrail = [];
    if (this.gazeVizContext) {
      this.gazeVizContext.clearRect(0, 0, this.gazeVizCanvas.nativeElement.width, this.gazeVizCanvas.nativeElement.height);
    }
  }

  // Utility Methods
  getTestProgress(): number {
    if (!this.currentSession) return 0;
    return (this.currentSession.currentTargetIndex / this.currentSession.targets.length) * 100;
  }

  getCurrentTarget(): TestTarget | null {
    if (!this.currentSession) return null;
    return this.currentSession.targets[this.currentSession.currentTargetIndex] || null;
  }

  getRemainingTime(): number {
    const target = this.getCurrentTarget();
    if (!target || !target.startTime) return 0;
    
    const elapsed = Date.now() - target.startTime;
    const remaining = Math.max(0, this.customConfig.targetDuration - elapsed);
    return Math.ceil(remaining / 1000);
  }

  getSystemStatusText(): string {
    const statusMap = {
      'excellent': 'ระบบทำงานได้ดีเยี่ยม',
      'good': 'ระบบทำงานปกติ',
      'fair': 'ระบบมีปัญหาเล็กน้อย',
      'poor': 'ระบบมีปัญหา'
    };
    return statusMap[this.systemStatus.overall] || 'ไม่ทราบสถานะ';
  }

  getAccuracyTrend(): string {
    return this.liveMetrics.currentAccuracy > 85 ? 'trend-up' : 
           this.liveMetrics.currentAccuracy > 70 ? 'trend-stable' : 'trend-down';
  }

  getAccuracyTrendText(): string {
    return this.liveMetrics.currentAccuracy > 85 ? 'ดีเยี่ยม' : 
           this.liveMetrics.currentAccuracy > 70 ? 'ปกติ' : 'ต้องปรับปรุง';
  }

  getResponseTimeQuality(): string {
    return this.liveMetrics.responseTime < 300 ? 'excellent' :
           this.liveMetrics.responseTime < 500 ? 'good' :
           this.liveMetrics.responseTime < 800 ? 'fair' : 'poor';
  }

  getResponseTimeText(): string {
    return this.liveMetrics.responseTime < 300 ? 'เร็วมาก' :
           this.liveMetrics.responseTime < 500 ? 'เร็ว' :
           this.liveMetrics.responseTime < 800 ? 'ปกติ' : 'ช้า';
  }

  getAccuracyGrade(accuracy: number): string {
    if (accuracy >= 90) return 'A';
    if (accuracy >= 80) return 'B';
    if (accuracy >= 70) return 'C';
    if (accuracy >= 60) return 'D';
    return 'F';
  }

  getResponseTimeGrade(responseTime: number): string {
    if (responseTime < 300) return 'A';
    if (responseTime < 500) return 'B';
    if (responseTime < 800) return 'C';
    if (responseTime < 1200) return 'D';
    return 'F';
  }

  getAccuracyClass(accuracy: number): string {
    if (accuracy >= 85) return 'excellent';
    if (accuracy >= 70) return 'good';
    if (accuracy >= 55) return 'fair';
    return 'poor';
  }

  getQualityClass(accuracy: number): string {
    return this.getAccuracyClass(accuracy);
  }

  getQualityText(accuracy: number): string {
    if (accuracy >= 85) return 'ดีเยี่ยม';
    if (accuracy >= 70) return 'ดี';
    if (accuracy >= 55) return 'พอใช้';
    return 'ต้องปรับปรุง';
  }

  getLightingText(): string {
    const textMap: Record<string, string> = {
      'optimal': 'เหมาะสม',
      'bright': 'สว่างเกินไป',
      'dim': 'มืดเกินไป',
      'variable': 'ไม่สม่ำเสมอ',
      'excellent': 'ดีเยี่ยม',
      'good': 'ดี',
      'fair': 'พอใช้',
      'poor': 'ไม่ดี'
    };
    return textMap[this.environmentalFactors.lighting] || 'ไม่ทราบ';
  }

  getLightingLevel(): number {
    const levelMap: Record<string, number> = {
      'optimal': 85,
      'bright': 60,
      'dim': 40,
      'variable': 50,
      'excellent': 95,
      'good': 80,
      'fair': 60,
      'poor': 30
    };
    return levelMap[this.environmentalFactors.lighting] || 0;
  }

  getHeadMovementClass(): string {
    if (this.environmentalFactors.headMovement < 20) return 'good';
    if (this.environmentalFactors.headMovement < 50) return 'fair';
    return 'poor';
  }

  getHeadMovementText(): string {
    if (this.environmentalFactors.headMovement < 20) return 'น้อย';
    if (this.environmentalFactors.headMovement < 50) return 'ปานกลาง';
    return 'มาก';
  }

  getEyeVisibilityText(): string {
    const textMap = {
      'excellent': 'ดีเยี่ยม',
      'good': 'ดี',
      'fair': 'พอใช้',
      'poor': 'ไม่ดี'
    };
    return textMap[this.environmentalFactors.eyeVisibility] || 'ไม่ทราบ';
  }

  getEyeVisibilityLevel(): number {
    const levelMap = {
      'excellent': 95,
      'good': 80,
      'fair': 60,
      'poor': 30
    };
    return levelMap[this.environmentalFactors.eyeVisibility] || 0;
  }

  getCalibrationAgeClass(): string {
    if (this.environmentalFactors.calibrationAge < 15) return 'good';
    if (this.environmentalFactors.calibrationAge < 30) return 'fair';
    return 'poor';
  }

  getCalibrationText(): string {
    if (this.environmentalFactors.calibrationAge < 15) return 'ใหม่';
    if (this.environmentalFactors.calibrationAge < 30) return 'ปกติ';
    return 'เก่า';
  }

  getCalibrationAgeText(): string {
    return `${this.environmentalFactors.calibrationAge} นาทีที่แล้ว`;
  }

  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'preparing': 'กำลังเตรียม',
      'running': 'กำลังทำงาน',
      'completed': 'เสร็จสิ้น',
      'failed': 'ล้มเหลว',
      'paused': 'หยุดชั่วคราว'
    };
    return statusMap[status] || status;
  }

  // Action Methods
  async exportResults(format: 'json' | 'csv' | 'pdf') {
    if (!this.currentSession) return;

    try {
      const blob = await this.testingService.exportResults(this.currentSession, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-results-${this.currentSession.id}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'ไม่สามารถส่งออกผลลัพธ์ได้');
    }
  }

  shareResults() {
    if (!this.currentSession?.results) return;
    
    const text = `ผลการทดสอบ Eye Tracking:\n` +
                `ความแม่นยำ: ${this.currentSession.results.overallAccuracy.toFixed(1)}%\n` +
                `เวลาตอบสนอง: ${this.currentSession.results.averageResponseTime.toFixed(0)}ms`;
                
    if (navigator.share) {
      navigator.share({
        title: 'ผลการทดสอบ Eye Tracking',
        text: text
      });
    } else {
      navigator.clipboard.writeText(text);
    }
  }

  clearResults() {
    this.currentSession = null;
    this.isTestRunning = false;
    this.liveMetrics.gazeTrail = [];
    this.clearGazeVisualization();
  }

  dismissAlert(alertId: string) {
    this.environmentalAlerts = this.environmentalAlerts.filter(alert => alert.id !== alertId);
  }

  showTestingHistory() {
    // Implement testing history view
    console.log('📊 แสดงประวัติการทดสอบ');
  }

  loadMoreSessions() {
    // Implement loading more sessions
    console.log('📊 โหลดเซสชันเพิ่มเติม');
  }

  viewSession(session: TestSession) {
    this.currentSession = session;
    console.log('👁️ ดูรายละเอียดเซสชัน:', session.id);
  }
}
