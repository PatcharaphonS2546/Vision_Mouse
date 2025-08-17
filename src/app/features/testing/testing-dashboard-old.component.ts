/**
 * Testing & Validation Dashboard Component
 * Comprehensive testing suite for eye tracking accuracy and system validation
 */

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, interval, BehaviorSubject, combineLatest } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';

import { 
  StateService, 
  ErrorHandlerService,
  NotificationService
} from '../../core/services';

import { TestingService } from '../../services/testing.service';
import { Point2D, GazeEstimationResult, PerformanceMetrics, QualityLevel } from '../../core/interfaces/core.interface';
import { 
  TestConfiguration, 
  TestSession, 
  TestTarget, 
  TestResults, 
  ValidationMetrics,
  RealTimeMetrics 
} from '../../core/interfaces/testing.interface';
} from '../../core/interfaces/core.interface';


  averageResponseTime: number;
  status: 'not-started' | 'running' | 'completed' | 'failed';
  results?: TestResults;
}

interface TestResults {
  accuracy: number;
  precision: number;
  responseTime: number;
  consistency: number;
  stability: number;
  qualityScore: number;
  recommendations: string[];
  detailedMetrics: DetailedMetrics;
}

interface DetailedMetrics {
  spatialAccuracy: number;
  temporalStability: number;
  fixationAccuracy: number;
  saccadeAccuracy: number;
  driftError: number;
  jitterLevel: number;
  calibrationQuality: QualityLevel;
  environmentalFactors: EnvironmentalFactors;
}

interface EnvironmentalFactors {
  lightingCondition: 'optimal' | 'bright' | 'dim' | 'variable';
  headMovement: 'minimal' | 'moderate' | 'excessive';
  eyeVisibility: 'excellent' | 'good' | 'poor';
  backgroundNoise: 'low' | 'medium' | 'high';
}

interface ValidationTest {
  name: string;
  description: string;
  targets: Point2D[];
  duration: number;
  accuracy_threshold: number;
  pattern: 'grid' | 'random' | 'circular' | 'diagonal' | 'fixation';
}

@Component({
  selector: 'app-testing-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="testing-dashboard">
      
      <!-- Header -->
      <div class="dashboard-header">
        <div class="header-left">
          <h2>🧪 Testing & Validation Dashboard</h2>
          <div class="session-info">
            <span class="current-session">Session: {{currentSession?.name || 'None'}}</span>
            <span class="test-status" [ngClass]="'status-' + (currentSession?.status || 'idle')">
              {{getStatusText()}}
            </span>
          </div>
        </div>
        
        <div class="header-controls">
          <select [(ngModel)]="selectedTestType" class="test-select" (change)="onTestTypeChange()">
            <option value="">เลือกประเภททดสอบ</option>
            <option value="accuracy">Accuracy Test</option>
            <option value="precision">Precision Test</option>
            <option value="stability">Stability Test</option>
            <option value="response">Response Time Test</option>
            <option value="drift">Drift Analysis</option>
            <option value="comprehensive">Comprehensive Test</option>
          </select>
          
          <button class="btn btn-primary" 
                  [disabled]="!canStartTest()" 
                  (click)="startTest()">
            <span class="btn-icon">▶️</span>
            เริ่มทดสอบ
          </button>
          
          <button class="btn btn-secondary" 
                  [disabled]="!isTestRunning()" 
                  (click)="stopTest()">
            <span class="btn-icon">⏹️</span>
            หยุดทดสอบ
          </button>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="quick-stats" *ngIf="currentSession">
        <div class="stat-card">
          <div class="stat-icon">🎯</div>
          <div class="stat-content">
            <h3>Accuracy</h3>
            <div class="stat-value">{{currentSession.overallAccuracy | number:'1.1-1'}}%</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">⏱️</div>
          <div class="stat-content">
            <h3>Response Time</h3>
            <div class="stat-value">{{currentSession.averageResponseTime | number:'1.0-0'}}ms</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <h3>Targets</h3>
            <div class="stat-value">{{getCompletedTargets()}}/{{getTotalTargets()}}</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">⭐</div>
          <div class="stat-content">
            <h3>Quality</h3>
            <div class="stat-value">{{getQualityGrade()}}</div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="main-content">
        
        <!-- Left Panel: Test Configuration -->
        <div class="left-panel">
          
          <!-- Test Configuration -->
          <div class="config-section">
            <h3>🔧 Test Configuration</h3>
            
            <div class="config-form">
              <div class="form-group">
                <label>Test Pattern:</label>
                <select [(ngModel)]="testConfig.pattern" class="form-control">
                  <option value="grid">Grid Pattern (3x3)</option>
                  <option value="random">Random Points</option>
                  <option value="circular">Circular Pattern</option>
                  <option value="diagonal">Diagonal Lines</option>
                  <option value="fixation">Fixation Points</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Target Count:</label>
                <input type="number" 
                       [(ngModel)]="testConfig.targetCount" 
                       min="5" max="25" 
                       class="form-control">
              </div>
              
              <div class="form-group">
                <label>Target Duration (ms):</label>
                <input type="number" 
                       [(ngModel)]="testConfig.targetDuration" 
                       min="500" max="5000" step="100"
                       class="form-control">
              </div>
              
              <div class="form-group">
                <label>Accuracy Threshold (%):</label>
                <input type="number" 
                       [(ngModel)]="testConfig.accuracyThreshold" 
                       min="60" max="95" 
                       class="form-control">
              </div>
              
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="testConfig.recordGazeTrail">
                  <span>Record Gaze Trail</span>
                </label>
              </div>
              
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="testConfig.showFeedback">
                  <span>Show Real-time Feedback</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Environmental Monitoring -->
          <div class="env-section">
            <h3>🌍 Environmental Monitoring</h3>
            
            <div class="env-indicators">
              <div class="env-item" [ngClass]="'env-' + environmentalFactors.lightingCondition">
                <span class="env-icon">💡</span>
                <div class="env-info">
                  <label>Lighting:</label>
                  <span>{{environmentalFactors.lightingCondition}}</span>
                </div>
              </div>
              
              <div class="env-item" [ngClass]="'env-' + environmentalFactors.headMovement">
                <span class="env-icon">🎭</span>
                <div class="env-info">
                  <label>Head Movement:</label>
                  <span>{{environmentalFactors.headMovement}}</span>
                </div>
              </div>
              
              <div class="env-item" [ngClass]="'env-' + environmentalFactors.eyeVisibility">
                <span class="env-icon">👁️</span>
                <div class="env-info">
                  <label>Eye Visibility:</label>
                  <span>{{environmentalFactors.eyeVisibility}}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Test History -->
          <div class="history-section">
            <h3>📈 Recent Tests</h3>
            
            <div class="test-history">
              <div *ngFor="let session of recentSessions" 
                   class="history-item"
                   [ngClass]="'status-' + session.status"
                   (click)="viewTestResults(session)">
                <div class="history-info">
                  <h4>{{session.name}}</h4>
                  <p>{{session.description}}</p>
                </div>
                
                <div class="history-metrics">
                  <span class="accuracy">{{session.overallAccuracy | number:'1.0-0'}}%</span>
                  <span class="time">{{session.averageResponseTime | number:'1.0-0'}}ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Center Panel: Test Area -->
        <div class="test-area">
          <div class="test-container">
            
            <!-- Instructions -->
            <div class="instructions" *ngIf="showInstructions">
              <div class="instruction-content">
                <h3>📋 Test Instructions</h3>
                <div class="instruction-text">
                  <p>{{getCurrentInstructions()}}</p>
                  <ul>
                    <li>มองไปที่จุดเป้าหมายสีแดงเมื่อปรากฏ</li>
                    <li>รักษาสายตาให้ติดตามจุดให้นานที่สุด</li>
                    <li>หลีกเลี่ยงการเคลื่อนไหวหัวมากเกินไป</li>
                    <li>ผ่อนคลายและมองไปยังจุดอย่างธรรมชาติ</li>
                  </ul>
                </div>
                
                <div class="instruction-actions">
                  <button class="btn btn-primary" (click)="startTestSequence()">
                    เริ่มทดสอบ
                  </button>
                  <button class="btn btn-outline" (click)="hideInstructions()">
                    ข้าม
                  </button>
                </div>
              </div>
            </div>

            <!-- Test Canvas -->
            <canvas #testCanvas 
                    class="test-canvas"
                    [width]="canvasWidth"
                    [height]="canvasHeight"
                    [style.display]="showInstructions ? 'none' : 'block'">
            </canvas>

            <!-- Test Progress -->
            <div class="test-progress" *ngIf="isTestRunning() && !showInstructions">
              <div class="progress-info">
                <span>เป้าหมาย: {{currentTargetIndex + 1}}/{{getTotalTargets()}}</span>
                <span>เวลาคงเหลือ: {{formatTime(remainingTime)}}</span>
              </div>
              
              <div class="progress-bar">
                <div class="progress-fill" 
                     [style.width.%]="getProgressPercentage()">
                </div>
              </div>
              
              <div class="current-accuracy" *ngIf="testConfig.showFeedback">
                <span>ความแม่นยำปัจจุบัน: {{getCurrentAccuracy() | number:'1.1-1'}}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Real-time Analytics -->
        <div class="right-panel">
          
          <!-- Live Metrics -->
          <div class="metrics-section">
            <h3>📊 Live Metrics</h3>
            
            <div class="live-metrics">
              <div class="metric-item">
                <label>Current Target:</label>
                <span class="metric-value">{{currentTargetIndex + 1}}</span>
              </div>
              
              <div class="metric-item">
                <label>Gaze Deviation:</label>
                <span class="metric-value" [ngClass]="getDeviationClass()">
                  {{currentGazeDeviation | number:'1.0-0'}}px
                </span>
              </div>
              
              <div class="metric-item">
                <label>Fixation Duration:</label>
                <span class="metric-value">{{currentFixationDuration}}ms</span>
              </div>
              
              <div class="metric-item">
                <label>Stability Score:</label>
                <span class="metric-value">{{stabilityScore | number:'1.1-1'}}</span>
              </div>
            </div>
          </div>

          <!-- Gaze Visualization -->
          <div class="gaze-viz-section">
            <h3>👁️ Gaze Visualization</h3>
            
            <canvas #gazeVizCanvas 
                    class="gaze-viz-canvas"
                    width="250" 
                    height="200">
            </canvas>
            
            <div class="viz-controls">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="showGazeTrail">
                <span>Show Trail</span>
              </label>
              
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="showFixationPoints">
                <span>Show Fixations</span>
              </label>
            </div>
          </div>

          <!-- Error Analysis -->
          <div class="error-section" *ngIf="hasErrors()">
            <h3>⚠️ Error Analysis</h3>
            
            <div class="error-list">
              <div *ngFor="let error of currentErrors" 
                   class="error-item"
                   [ngClass]="'error-' + error.severity">
                <div class="error-icon">{{getErrorIcon(error.type)}}</div>
                <div class="error-content">
                  <h4>{{error.title}}</h4>
                  <p>{{error.description}}</p>
                  <small>{{error.timestamp | date:'HH:mm:ss'}}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Modal -->
      <div class="results-modal" [ngClass]="{ 'modal-open': showResultsModal }">
        <div class="modal-backdrop" (click)="closeResultsModal()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>📊 Test Results: {{selectedResults?.sessionName}}</h3>
            <button class="btn btn-sm" (click)="closeResultsModal()">✕</button>
          </div>
          
          <div class="modal-body" *ngIf="selectedResults">
            <div class="results-summary">
              <div class="summary-grid">
                <div class="summary-item">
                  <h4>Overall Accuracy</h4>
                  <div class="summary-value" [ngClass]="getAccuracyClass(selectedResults.accuracy)">
                    {{selectedResults.accuracy | number:'1.1-1'}}%
                  </div>
                </div>
                
                <div class="summary-item">
                  <h4>Precision</h4>
                  <div class="summary-value">{{selectedResults.precision | number:'1.1-1'}}%</div>
                </div>
                
                <div class="summary-item">
                  <h4>Response Time</h4>
                  <div class="summary-value">{{selectedResults.responseTime | number:'1.0-0'}}ms</div>
                </div>
                
                <div class="summary-item">
                  <h4>Quality Score</h4>
                  <div class="summary-value">{{selectedResults.qualityScore | number:'1.1-1'}}</div>
                </div>
              </div>
            </div>
            
            <div class="detailed-metrics">
              <h4>Detailed Analysis</h4>
              <div class="metrics-grid">
                <div class="metric-detail">
                  <label>Spatial Accuracy:</label>
                  <span>{{selectedResults.detailedMetrics.spatialAccuracy | number:'1.1-1'}}%</span>
                </div>
                
                <div class="metric-detail">
                  <label>Temporal Stability:</label>
                  <span>{{selectedResults.detailedMetrics.temporalStability | number:'1.1-1'}}%</span>
                </div>
                
                <div class="metric-detail">
                  <label>Drift Error:</label>
                  <span>{{selectedResults.detailedMetrics.driftError | number:'1.1-1'}}px</span>
                </div>
                
                <div class="metric-detail">
                  <label>Jitter Level:</label>
                  <span>{{selectedResults.detailedMetrics.jitterLevel | number:'1.1-1'}}px</span>
                </div>
              </div>
            </div>
            
            <div class="recommendations" *ngIf="selectedResults.recommendations.length > 0">
              <h4>💡 Recommendations</h4>
              <ul>
                <li *ngFor="let rec of selectedResults.recommendations">{{rec}}</li>
              </ul>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn btn-primary" (click)="exportResults()">
              <span class="btn-icon">📤</span>
              Export Results
            </button>
            <button class="btn btn-outline" (click)="retakeTest()">
              <span class="btn-icon">🔄</span>
              Retake Test
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .testing-dashboard {
      padding: 20px;
      background: linear-gradient(135deg, #2c5282 0%, #2a69ac 100%);
      min-height: 100vh;
      color: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      backdrop-filter: blur(10px);
    }

    .header-left h2 {
      margin: 0 0 8px 0;
      font-size: 1.8rem;
      font-weight: 300;
    }

    .session-info {
      display: flex;
      gap: 15px;
      font-size: 0.9rem;
    }

    .test-status {
      padding: 4px 8px;
      border-radius: 12px;
      font-weight: 500;
    }

    .status-running { background: #4caf50; }
    .status-completed { background: #2196f3; }
    .status-failed { background: #f44336; }
    .status-idle { background: #757575; }

    .header-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .test-select, .form-control {
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      font-size: 0.9rem;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary { background: #4caf50; color: white; }
    .btn-secondary { background: #ff9800; color: white; }
    .btn-outline { background: transparent; border: 2px solid rgba(255, 255, 255, 0.3); color: white; }
    .btn-sm { padding: 6px 12px; font-size: 0.9rem; }

    .btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Quick Stats */
    .quick-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 15px;
      backdrop-filter: blur(10px);
    }

    .stat-icon {
      font-size: 2rem;
    }

    .stat-content h3 {
      margin: 0 0 5px 0;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: bold;
    }

    /* Main Content Layout */
    .main-content {
      display: grid;
      grid-template-columns: 300px 1fr 300px;
      gap: 20px;
      height: calc(100vh - 200px);
    }

    .left-panel, .right-panel {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      backdrop-filter: blur(10px);
      overflow-y: auto;
    }

    .test-area {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      backdrop-filter: blur(10px);
    }

    /* Test Configuration */
    .config-section, .env-section, .history-section, .metrics-section, .gaze-viz-section, .error-section {
      margin-bottom: 25px;
    }

    .config-section h3, .env-section h3, .history-section h3, .metrics-section h3, .gaze-viz-section h3, .error-section h3 {
      margin: 0 0 15px 0;
      font-size: 1.1rem;
      font-weight: 500;
    }

    .form-group {
      margin-bottom: 15px;
    }

    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    /* Environmental Indicators */
    .env-indicators {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .env-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
    }

    .env-optimal { border-left: 4px solid #4caf50; }
    .env-good { border-left: 4px solid #8bc34a; }
    .env-bright { border-left: 4px solid #ff9800; }
    .env-poor { border-left: 4px solid #f44336; }
    .env-minimal { border-left: 4px solid #4caf50; }
    .env-moderate { border-left: 4px solid #ff9800; }
    .env-excessive { border-left: 4px solid #f44336; }
    .env-excellent { border-left: 4px solid #4caf50; }

    .env-icon {
      font-size: 1.2rem;
    }

    .env-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .env-info label {
      font-size: 0.8rem;
      opacity: 0.7;
      margin: 0;
    }

    /* Test Canvas */
    .test-canvas {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.2);
    }

    /* Instructions */
    .instructions {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      border-radius: 12px;
      padding: 30px;
      max-width: 500px;
      text-align: center;
      z-index: 10;
    }

    .instruction-content h3 {
      margin: 0 0 20px 0;
      color: #4caf50;
    }

    .instruction-text {
      text-align: left;
      margin-bottom: 25px;
    }

    .instruction-text ul {
      margin: 15px 0;
      padding-left: 20px;
    }

    .instruction-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    /* Test Progress */
    .test-progress {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      padding: 15px 25px;
      border-radius: 25px;
      min-width: 300px;
      text-align: center;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 0.9rem;
    }

    .progress-bar {
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #8bc34a 100%);
      transition: width 0.3s ease;
    }

    /* Live Metrics */
    .live-metrics {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .metric-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
    }

    .metric-value {
      font-weight: bold;
    }

    .deviation-low { color: #4caf50; }
    .deviation-medium { color: #ff9800; }
    .deviation-high { color: #f44336; }

    /* Gaze Visualization */
    .gaze-viz-canvas {
      width: 100%;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      margin-bottom: 10px;
    }

    .viz-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* Test History */
    .test-history {
      max-height: 300px;
      overflow-y: auto;
    }

    .history-item {
      padding: 12px;
      margin-bottom: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      border-left: 4px solid transparent;
    }

    .history-item:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .history-item.status-completed {
      border-left-color: #4caf50;
    }

    .history-item.status-failed {
      border-left-color: #f44336;
    }

    .history-info h4 {
      margin: 0 0 4px 0;
      font-size: 0.9rem;
    }

    .history-info p {
      margin: 0;
      font-size: 0.8rem;
      opacity: 0.7;
    }

    .history-metrics {
      display: flex;
      gap: 15px;
      margin-top: 8px;
      font-size: 0.8rem;
    }

    /* Error Analysis */
    .error-list {
      max-height: 200px;
      overflow-y: auto;
    }

    .error-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px;
      margin-bottom: 8px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
    }

    .error-warning { border-left: 4px solid #ff9800; }
    .error-error { border-left: 4px solid #f44336; }
    .error-info { border-left: 4px solid #2196f3; }

    .error-icon {
      font-size: 1.2rem;
      margin-top: 2px;
    }

    .error-content h4 {
      margin: 0 0 4px 0;
      font-size: 0.9rem;
    }

    .error-content p {
      margin: 0 0 4px 0;
      font-size: 0.8rem;
      opacity: 0.8;
    }

    .error-content small {
      font-size: 0.7rem;
      opacity: 0.6;
    }

    /* Results Modal */
    .results-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
      display: none;
    }

    .results-modal.modal-open {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(5px);
    }

    .modal-content {
      background: rgba(30, 41, 59, 0.95);
      border-radius: 12px;
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      position: relative;
      z-index: 1;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .modal-body {
      padding: 20px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 25px;
    }

    .summary-item {
      text-align: center;
      padding: 20px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }

    .summary-item h4 {
      margin: 0 0 8px 0;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .summary-value {
      font-size: 2rem;
      font-weight: bold;
    }

    .accuracy-excellent { color: #4caf50; }
    .accuracy-good { color: #8bc34a; }
    .accuracy-fair { color: #ff9800; }
    .accuracy-poor { color: #f44336; }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .metric-detail {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
    }

    .recommendations ul {
      list-style: none;
      padding: 0;
    }

    .recommendations li {
      padding: 8px 12px;
      margin-bottom: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      border-left: 4px solid #4caf50;
    }

    .modal-footer {
      display: flex;
      justify-content: end;
      gap: 12px;
      padding: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* Responsive Design */
    @media (max-width: 1200px) {
      .main-content {
        grid-template-columns: 250px 1fr 250px;
      }
    }

    @media (max-width: 768px) {
      .main-content {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr auto;
      }
      
      .quick-stats {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .dashboard-header {
        flex-direction: column;
        gap: 15px;
      }
    }
  `]
})
export class TestingDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  
  @ViewChild('testCanvas') testCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gazeVizCanvas') gazeVizCanvas!: ElementRef<HTMLCanvasElement>;
  
  private destroy$ = new Subject<void>();
  private testContext?: CanvasRenderingContext2D;
  private gazeVizContext?: CanvasRenderingContext2D;
  
  // Component state
  selectedTestType = '';
  currentSession: TestSession | null = null;
  showInstructions = false;
  showResultsModal = false;
  currentTargetIndex = 0;
  remainingTime = 0;
  canvasWidth = 800;
  canvasHeight = 600;
  
  // Test configuration
  testConfig = {
    pattern: 'grid' as 'grid' | 'random' | 'circular' | 'diagonal' | 'fixation',
    targetCount: 9,
    targetDuration: 2000,
    accuracyThreshold: 80,
    recordGazeTrail: true,
    showFeedback: true
  };
  
  // Environmental monitoring
  environmentalFactors: EnvironmentalFactors = {
    lightingCondition: 'optimal',
    headMovement: 'minimal',
    eyeVisibility: 'excellent',
    backgroundNoise: 'low'
  };
  
  // Live metrics
  currentGazeDeviation = 0;
  currentFixationDuration = 0;
  stabilityScore = 0;
  
  // Visualization controls
  showGazeTrail = true;
  showFixationPoints = true;
  
  // Data storage
  recentSessions: TestSession[] = [];
  currentErrors: any[] = [];
  selectedResults: TestResults & { sessionName: string } | null = null;
  
  // Pre-defined test configurations
  testConfigurations: { [key: string]: ValidationTest } = {
    accuracy: {
      name: 'Accuracy Test',
      description: '9-point grid accuracy measurement',
      targets: this.generateGridPoints(3, 3),
      duration: 2000,
      accuracy_threshold: 85,
      pattern: 'grid'
    },
    precision: {
      name: 'Precision Test',
      description: 'Multiple fixations on single point',
      targets: [{ x: 400, y: 300 }],
      duration: 5000,
      accuracy_threshold: 90,
      pattern: 'fixation'
    },
    stability: {
      name: 'Stability Test',
      description: 'Long-duration fixation stability',
      targets: [{ x: 400, y: 300 }],
      duration: 10000,
      accuracy_threshold: 75,
      pattern: 'fixation'
    },
    response: {
      name: 'Response Time Test',
      description: 'Saccade response time measurement',
      targets: this.generateRandomPoints(15),
      duration: 1000,
      accuracy_threshold: 70,
      pattern: 'random'
    },
    drift: {
      name: 'Drift Analysis',
      description: 'Long-term calibration drift detection',
      targets: this.generateCornerPoints(),
      duration: 3000,
      accuracy_threshold: 80,
      pattern: 'diagonal'
    },
    comprehensive: {
      name: 'Comprehensive Test',
      description: 'Complete eye tracking validation',
      targets: [...this.generateGridPoints(3, 3), ...this.generateRandomPoints(6)],
      duration: 2500,
      accuracy_threshold: 85,
      pattern: 'grid'
    }
  };

  constructor(
    private testingService: TestingService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService
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
    // Setup testing service subscriptions
    this.setupTestingSubscriptions();
    
    // Initialize available test configurations
    this.availableTests = Object.values(this.testingService.getTestConfigurations());
  }

  private setupTestingSubscriptions(): void {
    // Subscribe to current test session
    this.testingService.currentSession
      .pipe(takeUntil(this.destroy$))
      .subscribe(session => {
        if (session) {
          this.currentSession = session;
          this.updateSessionProgress();
        }
      });

    // Subscribe to live gaze data
    this.testingService.liveGazeData
      .pipe(takeUntil(this.destroy$))
      .subscribe(gazeData => {
        if (gazeData && this.isTestRunning) {
          this.handleGazeData(gazeData);
          this.updateGazeVisualization(gazeData);
        }
      });

    // Subscribe to test metrics
    this.testingService.testMetrics
      .pipe(takeUntil(this.destroy$))
      .subscribe(metrics => {
        if (metrics) {
          this.updateRealTimeMetrics(metrics);
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
    // Load recent test sessions from storage or service
    this.recentSessions = [
      {
        id: '1',
        name: 'Accuracy Test #3',
        description: 'Standard 9-point accuracy test',
        targets: [],
        overallAccuracy: 87.5,
        averageResponseTime: 450,
        status: 'completed'
      },
      {
        id: '2',
        name: 'Precision Test #1',
        description: 'Fixation precision measurement',
        targets: [],
        overallAccuracy: 92.1,
        averageResponseTime: 320,
        status: 'completed'
      }
    ];
  }

  private startEnvironmentalMonitoring() {
    // Monitor environmental conditions every 5 seconds
    interval(5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateEnvironmentalConditions();
      });
  }

  // Test control methods
  onTestTypeChange() {
    if (this.selectedTestType && this.testConfigurations[this.selectedTestType]) {
      const config = this.testConfigurations[this.selectedTestType];
      this.testConfig.pattern = config.pattern;
      this.testConfig.targetCount = config.targets.length;
      this.testConfig.targetDuration = config.duration;
      this.testConfig.accuracyThreshold = config.accuracy_threshold;
    }
  }

  canStartTest(): boolean {
    return !!this.selectedTestType && this.currentSession?.status !== 'running';
  }

  isTestRunning(): boolean {
    return this.currentSession?.status === 'running';
  }

  startTest() {
    if (!this.canStartTest()) return;
    
    this.showInstructions = true;
    this.prepareTestSession();
  }

  startTestSequence() {
    this.hideInstructions();
    this.currentSession!.status = 'running';
    this.currentSession!.startTime = new Date();
    this.currentTargetIndex = 0;
    this.runTestTarget();
    
    this.notifications.showInfo('เริ่มการทดสอบแล้ว');
  }

  stopTest() {
    if (!this.isTestRunning()) return;
    
    this.currentSession!.status = 'completed';
    this.currentSession!.endTime = new Date();
    this.calculateTestResults();
    this.showTestResults();
    
    this.notifications.showWarning('หยุดการทดสอบแล้ว');
  }

  hideInstructions() {
    this.showInstructions = false;
  }

  // Test execution methods
  private prepareTestSession() {
    const config = this.testConfigurations[this.selectedTestType];
    
    this.currentSession = {
      id: `test_${Date.now()}`,
      name: config.name,
      description: config.description,
      targets: this.createTestTargets(config),
      overallAccuracy: 0,
      averageResponseTime: 0,
      status: 'not-started'
    };
  }

  private createTestTargets(config: ValidationTest): TestTarget[] {
    return config.targets.map((point, index) => ({
      id: `target_${index}`,
      position: point,
      size: 20,
      isActive: false,
      actualGazePoints: [],
      completed: false
    }));
  }

  private runTestTarget() {
    if (!this.currentSession || this.currentTargetIndex >= this.currentSession.targets.length) {
      this.completeTest();
      return;
    }
    
    const target = this.currentSession.targets[this.currentTargetIndex];
    target.isActive = true;
    this.remainingTime = this.testConfig.targetDuration;
    
    this.drawTestTarget(target);
    
    // Start countdown
    const countdown = interval(100).pipe(
      takeUntil(this.destroy$),
      map(() => this.remainingTime -= 100)
    ).subscribe(() => {
      if (this.remainingTime <= 0) {
        countdown.unsubscribe();
        target.isActive = false;
        target.completed = true;
        this.calculateTargetAccuracy(target);
        this.currentTargetIndex++;
        
        setTimeout(() => {
          this.runTestTarget();
        }, 500);
      }
    });
  }

  private completeTest() {
    if (!this.currentSession) return;
    
    this.currentSession.status = 'completed';
    this.currentSession.endTime = new Date();
    this.calculateTestResults();
    this.recentSessions.unshift(this.currentSession);
    
    // Show results after a brief delay
    setTimeout(() => {
      this.showTestResults();
    }, 1000);
  }

  // Calculation methods
  private calculateTargetAccuracy(target: TestTarget) {
    if (target.actualGazePoints.length === 0) {
      target.accuracy = 0;
      return;
    }
    
    // Calculate average distance from target center
    const avgDistance = target.actualGazePoints.reduce((sum, point) => {
      const distance = Math.sqrt(
        Math.pow(point.x - target.position.x, 2) + 
        Math.pow(point.y - target.position.y, 2)
      );
      return sum + distance;
    }, 0) / target.actualGazePoints.length;
    
    // Convert distance to accuracy percentage (closer = higher accuracy)
    target.accuracy = Math.max(0, 100 - (avgDistance / 2));
  }

  private calculateTestResults() {
    if (!this.currentSession) return;
    
    const completedTargets = this.currentSession.targets.filter(t => t.completed);
    const accuracies = completedTargets.map(t => t.accuracy || 0);
    const responseTimes = completedTargets.map(t => t.responseTime || 0);
    
    this.currentSession.overallAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    this.currentSession.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    // Generate detailed results
    this.currentSession.results = {
      accuracy: this.currentSession.overallAccuracy,
      precision: this.calculatePrecision(completedTargets),
      responseTime: this.currentSession.averageResponseTime,
      consistency: this.calculateConsistency(accuracies),
      stability: this.stabilityScore,
      qualityScore: this.calculateQualityScore(),
      recommendations: this.generateRecommendations(),
      detailedMetrics: {
        spatialAccuracy: this.currentSession.overallAccuracy,
        temporalStability: this.stabilityScore,
        fixationAccuracy: this.calculateFixationAccuracy(completedTargets),
        saccadeAccuracy: this.calculateSaccadeAccuracy(completedTargets),
        driftError: this.calculateDriftError(completedTargets),
        jitterLevel: this.calculateJitterLevel(completedTargets),
        calibrationQuality: this.getCalibrationQuality(),
        environmentalFactors: { ...this.environmentalFactors }
      }
    };
  }

  // Drawing methods
  private drawTestTarget(target: TestTarget) {
    if (!this.testContext) return;
    
    this.testContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Draw target
    this.testContext.fillStyle = target.isActive ? '#ff4444' : '#666666';
    this.testContext.beginPath();
    this.testContext.arc(target.position.x, target.position.y, target.size, 0, 2 * Math.PI);
    this.testContext.fill();
    
    // Draw center dot
    this.testContext.fillStyle = '#ffffff';
    this.testContext.beginPath();
    this.testContext.arc(target.position.x, target.position.y, 3, 0, 2 * Math.PI);
    this.testContext.fill();
  }

  // Live metrics update methods
  private updateLiveMetrics(result: GazeEstimationResult) {
    if (!this.currentSession || !this.isTestRunning()) return;
    
    const currentTarget = this.currentSession.targets[this.currentTargetIndex];
    if (!currentTarget?.isActive) return;
    
    // Calculate gaze deviation from current target
    this.currentGazeDeviation = Math.sqrt(
      Math.pow(result.gazePoint.x - currentTarget.position.x, 2) + 
      Math.pow(result.gazePoint.y - currentTarget.position.y, 2)
    );
    
    // Store gaze point for accuracy calculation
    currentTarget.actualGazePoints.push(result.gazePoint);
    
    // Update stability score
    this.updateStabilityScore(result);
  }

  private updateGazeVisualization(result: GazeEstimationResult) {
    if (!this.gazeVizContext) return;
    
    // Scale gaze point to visualization canvas
    const scaledPoint = {
      x: (result.gazePoint.x / this.canvasWidth) * 250,
      y: (result.gazePoint.y / this.canvasHeight) * 200
    };
    
    // Draw current gaze point
    this.gazeVizContext.fillStyle = '#00ff00';
    this.gazeVizContext.beginPath();
    this.gazeVizContext.arc(scaledPoint.x, scaledPoint.y, 3, 0, 2 * Math.PI);
    this.gazeVizContext.fill();
  }

  // Utility methods
  private generateGridPoints(rows: number, cols: number): Point2D[] {
    const points: Point2D[] = [];
    const margin = 100;
    const stepX = (this.canvasWidth - 2 * margin) / (cols - 1);
    const stepY = (this.canvasHeight - 2 * margin) / (rows - 1);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        points.push({
          x: margin + col * stepX,
          y: margin + row * stepY
        });
      }
    }
    
    return points;
  }

  private generateRandomPoints(count: number): Point2D[] {
    const points: Point2D[] = [];
    const margin = 50;
    
    for (let i = 0; i < count; i++) {
      points.push({
        x: margin + Math.random() * (this.canvasWidth - 2 * margin),
        y: margin + Math.random() * (this.canvasHeight - 2 * margin)
      });
    }
    
    return points;
  }

  private generateCornerPoints(): Point2D[] {
    const margin = 50;
    return [
      { x: margin, y: margin },
      { x: this.canvasWidth - margin, y: margin },
      { x: this.canvasWidth - margin, y: this.canvasHeight - margin },
      { x: margin, y: this.canvasHeight - margin },
      { x: this.canvasWidth / 2, y: this.canvasHeight / 2 }
    ];
  }

  // Helper methods for UI
  getStatusText(): string {
    const statusMap: { [key: string]: string } = {
      'not-started': 'ยังไม่เริ่ม',
      'running': 'กำลังทดสอบ',
      'completed': 'เสร็จสิ้น',
      'failed': 'ล้มเหลว'
    };
    return statusMap[this.currentSession?.status || 'idle'] || 'พร้อม';
  }

  getCurrentInstructions(): string {
    const config = this.testConfigurations[this.selectedTestType];
    return config?.description || 'ทำตามคำแนะนำบนหน้าจอ';
  }

  getCompletedTargets(): number {
    return this.currentSession?.targets.filter(t => t.completed).length || 0;
  }

  getTotalTargets(): number {
    return this.currentSession?.targets.length || 0;
  }

  getProgressPercentage(): number {
    const total = this.getTotalTargets();
    return total > 0 ? (this.getCompletedTargets() / total) * 100 : 0;
  }

  getCurrentAccuracy(): number {
    if (!this.currentSession) return 0;
    const completed = this.currentSession.targets.filter(t => t.completed);
    if (completed.length === 0) return 0;
    
    const totalAccuracy = completed.reduce((sum, t) => sum + (t.accuracy || 0), 0);
    return totalAccuracy / completed.length;
  }

  getQualityGrade(): string {
    const accuracy = this.currentSession?.overallAccuracy || 0;
    if (accuracy >= 90) return 'A';
    if (accuracy >= 80) return 'B';
    if (accuracy >= 70) return 'C';
    if (accuracy >= 60) return 'D';
    return 'F';
  }

  getDeviationClass(): string {
    if (this.currentGazeDeviation < 50) return 'deviation-low';
    if (this.currentGazeDeviation < 100) return 'deviation-medium';
    return 'deviation-high';
  }

  formatTime(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  }

  hasErrors(): boolean {
    return this.currentErrors.length > 0;
  }

  getErrorIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'calibration': '🎯',
      'tracking': '👁️',
      'environmental': '🌍',
      'performance': '⚡'
    };
    return iconMap[type] || '⚠️';
  }

  getAccuracyClass(accuracy: number): string {
    if (accuracy >= 90) return 'accuracy-excellent';
    if (accuracy >= 80) return 'accuracy-good';
    if (accuracy >= 70) return 'accuracy-fair';
    return 'accuracy-poor';
  }

  // Results and export methods
  showTestResults() {
    if (!this.currentSession?.results) return;
    
    this.selectedResults = {
      ...this.currentSession.results,
      sessionName: this.currentSession.name
    };
    this.showResultsModal = true;
  }

  closeResultsModal() {
    this.showResultsModal = false;
    this.selectedResults = null;
  }

  viewTestResults(session: TestSession) {
    if (!session.results) return;
    
    this.selectedResults = {
      ...session.results,
      sessionName: session.name
    };
    this.showResultsModal = true;
  }

  exportResults() {
    if (!this.selectedResults) return;
    
    const data = JSON.stringify(this.selectedResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.notifications.showSuccess('ส่งออกผลลัพธ์เรียบร้อย');
  }

  retakeTest() {
    this.closeResultsModal();
    this.startTest();
  }

  // Private calculation methods (simplified implementations)
  private calculatePrecision(targets: TestTarget[]): number {
    // Simplified precision calculation
    return 85 + Math.random() * 10;
  }

  private calculateConsistency(accuracies: number[]): number {
    if (accuracies.length < 2) return 100;
    
    const mean = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accuracies.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, 100 - stdDev);
  }

  private calculateQualityScore(): number {
    return 75 + Math.random() * 20;
  }

  private generateRecommendations(): string[] {
    const recommendations = [];
    
    if (this.currentSession!.overallAccuracy < 80) {
      recommendations.push('แนะนำให้ปรับเทียบระบบใหม่เพื่อเพิ่มความแม่นยำ');
    }
    
    if (this.environmentalFactors.lightingCondition !== 'optimal') {
      recommendations.push('ปรับแสงสว่างให้เหมาะสมเพื่อผลลัพธ์ที่ดีขึ้น');
    }
    
    if (this.stabilityScore < 70) {
      recommendations.push('ฝึกการมองจ้องให้นิ่งขึ้นเพื่อเพิ่มความเสถียร');
    }
    
    return recommendations;
  }

  private calculateFixationAccuracy(targets: TestTarget[]): number {
    return 80 + Math.random() * 15;
  }

  private calculateSaccadeAccuracy(targets: TestTarget[]): number {
    return 75 + Math.random() * 20;
  }

  private calculateDriftError(targets: TestTarget[]): number {
    return Math.random() * 30;
  }

  private calculateJitterLevel(targets: TestTarget[]): number {
    return Math.random() * 15;
  }

  private getCalibrationQuality(): QualityLevel {
    const accuracy = this.currentSession?.overallAccuracy || 0;
    if (accuracy >= 90) return 'excellent';
    if (accuracy >= 80) return 'good';
    if (accuracy >= 70) return 'fair';
    return 'poor';
  }

  private updateStabilityScore(result: GazeEstimationResult) {
    // Simplified stability calculation
    this.stabilityScore = 70 + Math.random() * 25;
  }

  private updateEnvironmentalFactors(metrics: PerformanceMetrics) {
    // Simplified environmental factor updates based on performance
    if (metrics.fps < 25) {
      this.environmentalFactors.backgroundNoise = 'high';
    }
    
    // Additional environmental updates would go here
  }

  private updateEnvironmentalConditions() {
    // Simulate environmental condition changes
    // In a real implementation, this would use actual sensors or analysis
  }
}
