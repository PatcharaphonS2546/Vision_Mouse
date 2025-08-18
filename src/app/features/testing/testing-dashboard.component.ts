/**
 * Testing & Validation Dashboard Component - UI Only
 * Simplified version for UI interaction, backend will handle testing logic
 */

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, interval, BehaviorSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { Point2D } from '../../core/interfaces/core.interface';

// UI-only interfaces
interface TestConfiguration {
  testType: 'accuracy' | 'precision' | 'latency' | 'drift' | 'custom';
  duration: number;
  targetCount: number;
  targetSize: number;
  showTrajectory: boolean;
  randomOrder: boolean;
  includeCalibration: boolean;
}

interface TestTarget {
  id: number;
  position: Point2D;
  radius: number;
  active: boolean;
  completed: boolean;
  accuracy?: number;
}

interface TestSession {
  id: string;
  configuration: TestConfiguration;
  startTime: number;
  endTime?: number;
  status: 'preparing' | 'running' | 'completed' | 'failed';
  currentTargetIndex: number;
  targets: TestTarget[];
}

interface TestResults {
  sessionId: string;
  overallAccuracy: number;
  averageLatency: number;
  targetResults: any[];
  summary: string;
}

interface ValidationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  latency: number;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  selector: 'app-testing-dashboard',
  template: `
    <div class="testing-dashboard">
      <div class="dashboard-header">
        <h2>Testing & Validation Dashboard</h2>
        <div class="test-status" [ngClass]="'status-' + currentSession?.status">
          <span class="status-dot"></span>
          {{ getStatusText(currentSession?.status || 'idle') }}
        </div>
      </div>

      <!-- Test Configuration Panel -->
      <div class="config-panel">
        <h3>Test Configuration</h3>
        <div class="config-form">
          <div class="form-group">
            <label>Test Type:</label>
            <select [(ngModel)]="testConfig.testType" [disabled]="isTestRunning">
              <option value="accuracy">Accuracy Test</option>
              <option value="precision">Precision Test</option>
              <option value="latency">Latency Test</option>
              <option value="drift">Drift Test</option>
              <option value="custom">Custom Test</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Duration (seconds):</label>
            <input type="number" [(ngModel)]="testConfig.duration" 
                   [disabled]="isTestRunning" min="10" max="300">
          </div>
          
          <div class="form-group">
            <label>Target Count:</label>
            <input type="number" [(ngModel)]="testConfig.targetCount" 
                   [disabled]="isTestRunning" min="5" max="50">
          </div>
          
          <div class="form-group">
            <label>Target Size (pixels):</label>
            <input type="number" [(ngModel)]="testConfig.targetSize" 
                   [disabled]="isTestRunning" min="20" max="100">
          </div>
          
          <div class="checkbox-group">
            <label>
              <input type="checkbox" [(ngModel)]="testConfig.showTrajectory" [disabled]="isTestRunning">
              Show Gaze Trajectory
            </label>
            <label>
              <input type="checkbox" [(ngModel)]="testConfig.randomOrder" [disabled]="isTestRunning">
              Random Target Order
            </label>
            <label>
              <input type="checkbox" [(ngModel)]="testConfig.includeCalibration" [disabled]="isTestRunning">
              Include Pre-Calibration
            </label>
          </div>
        </div>
      </div>

      <!-- Test Control Buttons -->
      <div class="control-buttons">
        <button (click)="startTest()" [disabled]="isTestRunning" class="btn-primary">
          <i class="icon-play"></i> Start Test
        </button>
        <button (click)="pauseTest()" [disabled]="!isTestRunning" class="btn-secondary">
          <i class="icon-pause"></i> Pause
        </button>
        <button (click)="stopTest()" [disabled]="!isTestRunning" class="btn-danger">
          <i class="icon-stop"></i> Stop Test
        </button>
        <button (click)="exportResults()" [disabled]="!hasResults" class="btn-success">
          <i class="icon-export"></i> Export Results
        </button>
      </div>

      <!-- Test Canvas Area -->
      <div class="test-area" *ngIf="isTestRunning">
        <canvas #testCanvas 
                width="1200" 
                height="800" 
                (click)="onTargetClick($event)">
        </canvas>
        
        <div class="test-overlay">
          <div class="progress-info">
            <span>Target {{ currentTargetIndex + 1 }} of {{ testConfig.targetCount }}</span>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="testProgress"></div>
            </div>
          </div>
          
          <div class="real-time-metrics" *ngIf="realtimeMetrics">
            <div class="metric">
              <label>Current Accuracy:</label>
              <span>{{ (realtimeMetrics.accuracy * 100) | number:'1.1-1' }}%</span>
            </div>
            <div class="metric">
              <label>Average Latency:</label>
              <span>{{ realtimeMetrics.latency | number:'1.0-0' }}ms</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Panel -->
      <div class="results-panel" *ngIf="testResults">
        <h3>Test Results</h3>
        <div class="results-summary">
          <div class="metric-card">
            <h4>Overall Accuracy</h4>
            <div class="metric-value">{{ (testResults.overallAccuracy * 100) | number:'1.1-1' }}%</div>
          </div>
          
          <div class="metric-card">
            <h4>Average Latency</h4>
            <div class="metric-value">{{ testResults.averageLatency | number:'1.0-0' }}ms</div>
          </div>
          
          <div class="metric-card">
            <h4>Precision Score</h4>
            <div class="metric-value">{{ (validationMetrics.precision * 100) | number:'1.1-1' }}%</div>
          </div>
          
          <div class="metric-card">
            <h4>F1 Score</h4>
            <div class="metric-value">{{ (validationMetrics.f1Score * 100) | number:'1.1-1' }}%</div>
          </div>
        </div>
        
        <div class="detailed-results">
          <h4>Target Analysis</h4>
          <div class="target-grid">
            <div *ngFor="let target of testTargets; let i = index" 
                 class="target-result" 
                 [ngClass]="{'completed': target.completed, 'missed': !target.completed}">
              <span class="target-number">{{ i + 1 }}</span>
              <span class="target-accuracy" *ngIf="target.accuracy">
                {{ (target.accuracy * 100) | number:'1.0-0' }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Session History -->
      <div class="history-panel">
        <h3>Recent Test Sessions</h3>
        <div class="session-list">
          <div *ngFor="let session of recentSessions" class="session-item">
            <div class="session-info">
              <span class="session-id">{{ session.id }}</span>
              <span class="session-type">{{ session.configuration.testType }}</span>
              <span class="session-date">{{ session.startTime | date:'short' }}</span>
            </div>
            <div class="session-actions">
              <button (click)="loadSession(session.id)" class="btn-link">View</button>
              <button (click)="deleteSession(session.id)" class="btn-link danger">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './testing-dashboard.component.css'
})
export class TestingDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('testCanvas') testCanvas!: ElementRef<HTMLCanvasElement>;
  
  private destroy$ = new Subject<void>();
  private updateTimer$ = new Subject<void>();

  // Test Configuration
  testConfig: TestConfiguration = {
    testType: 'accuracy',
    duration: 60,
    targetCount: 20,
    targetSize: 40,
    showTrajectory: true,
    randomOrder: true,
    includeCalibration: false
  };

  // Test State
  currentSession: TestSession | null = null;
  testResults: TestResults | null = null;
  validationMetrics: ValidationMetrics = {
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    latency: 0
  };
  
  realtimeMetrics: any = null;
  testTargets: TestTarget[] = [];
  currentTargetIndex = 0;
  testProgress = 0;
  isTestRunning = false;
  hasResults = false;

  // Recent Sessions
  recentSessions: TestSession[] = [];

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) {}

  ngOnInit() {
    this.initializeDashboard();
    this.generateMockSessions();
  }

  ngAfterViewInit() {
    this.initializeCanvas();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.updateTimer$.next();
    this.updateTimer$.complete();
  }

  private initializeDashboard() {
    console.log('Testing Dashboard initialized - UI Only Mode');
  }

  private initializeCanvas() {
    if (this.testCanvas) {
      const canvas = this.testCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  startTest() {
    this.isTestRunning = true;
    this.hasResults = false;
    this.testProgress = 0;
    this.currentTargetIndex = 0;
    
    // Generate test targets
    this.generateTestTargets();
    
    // Create test session
    this.currentSession = {
      id: 'test_' + Date.now(),
      configuration: { ...this.testConfig },
      startTime: Date.now(),
      status: 'running',
      currentTargetIndex: 0,
      targets: this.testTargets
    };

    // Start test simulation
    this.simulateTest();
    
    console.log('Test started with configuration:', this.testConfig);
  }

  pauseTest() {
    if (this.currentSession) {
      this.currentSession.status = 'preparing';
    }
    console.log('Test paused');
  }

  stopTest() {
    this.isTestRunning = false;
    this.completeTest();
    console.log('Test stopped');
  }

  onTargetClick(event: MouseEvent) {
    if (!this.isTestRunning || this.currentTargetIndex >= this.testTargets.length) return;
    
    const canvas = this.testCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const currentTarget = this.testTargets[this.currentTargetIndex];
    const distance = Math.sqrt(
      Math.pow(x - currentTarget.position.x, 2) + 
      Math.pow(y - currentTarget.position.y, 2)
    );
    
    const hit = distance <= currentTarget.radius;
    currentTarget.completed = hit;
    currentTarget.accuracy = hit ? Math.max(0, 1 - (distance / currentTarget.radius)) : 0;
    
    this.nextTarget();
  }

  private generateTestTargets() {
    this.testTargets = [];
    const canvas = this.testCanvas?.nativeElement;
    const width = canvas?.width || 1200;
    const height = canvas?.height || 800;
    
    for (let i = 0; i < this.testConfig.targetCount; i++) {
      this.testTargets.push({
        id: i,
        position: {
          x: Math.random() * (width - 100) + 50,
          y: Math.random() * (height - 100) + 50
        },
        radius: this.testConfig.targetSize / 2,
        active: false,
        completed: false
      });
    }
    
    if (this.testConfig.randomOrder) {
      this.shuffleArray(this.testTargets);
    }
  }

  private shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private simulateTest() {
    // Update real-time metrics
    interval(1000).pipe(
      takeUntil(this.destroy$),
      takeUntil(this.updateTimer$)
    ).subscribe(() => {
      if (this.isTestRunning) {
        this.updateRealtimeMetrics();
        this.drawTestCanvas();
      }
    });
  }

  private updateRealtimeMetrics() {
    const completedTargets = this.testTargets.filter(t => t.completed);
    const totalAccuracy = completedTargets.reduce((sum, t) => sum + (t.accuracy || 0), 0);
    
    this.realtimeMetrics = {
      accuracy: completedTargets.length > 0 ? totalAccuracy / completedTargets.length : 0,
      latency: Math.random() * 100 + 150, // Mock latency
      targetsHit: completedTargets.length,
      totalTargets: this.testTargets.length
    };
  }

  private drawTestCanvas() {
    const canvas = this.testCanvas?.nativeElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw targets
    this.testTargets.forEach((target, index) => {
      if (index === this.currentTargetIndex) {
        // Active target
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(target.position.x, target.position.y, target.radius, 0, 2 * Math.PI);
        ctx.fill();
      } else if (target.completed) {
        // Completed target
        ctx.fillStyle = '#44ff44';
        ctx.beginPath();
        ctx.arc(target.position.x, target.position.y, target.radius * 0.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }

  private nextTarget() {
    this.currentTargetIndex++;
    this.testProgress = (this.currentTargetIndex / this.testTargets.length) * 100;
    
    if (this.currentTargetIndex >= this.testTargets.length) {
      this.completeTest();
    }
  }

  private completeTest() {
    this.isTestRunning = false;
    this.hasResults = true;
    this.updateTimer$.next();
    
    if (this.currentSession) {
      this.currentSession.status = 'completed';
      this.currentSession.endTime = Date.now();
    }
    
    // Generate results
    const completedTargets = this.testTargets.filter(t => t.completed);
    const totalAccuracy = completedTargets.reduce((sum, t) => sum + (t.accuracy || 0), 0);
    
    this.testResults = {
      sessionId: this.currentSession?.id || '',
      overallAccuracy: completedTargets.length > 0 ? totalAccuracy / completedTargets.length : 0,
      averageLatency: Math.random() * 50 + 120,
      targetResults: this.testTargets.map(t => ({
        id: t.id,
        hit: t.completed,
        accuracy: t.accuracy || 0
      })),
      summary: `Test completed: ${completedTargets.length}/${this.testTargets.length} targets hit`
    };
    
    this.validationMetrics = {
      accuracy: this.testResults.overallAccuracy,
      precision: Math.random() * 0.2 + 0.8,
      recall: Math.random() * 0.2 + 0.75,
      f1Score: Math.random() * 0.2 + 0.8,
      latency: this.testResults.averageLatency
    };
    
    // Add to recent sessions
    if (this.currentSession) {
      this.recentSessions.unshift(this.currentSession);
      if (this.recentSessions.length > 10) {
        this.recentSessions.pop();
      }
    }
    
    console.log('Test completed:', this.testResults);
  }

  exportResults() {
    if (!this.testResults) return;
    
    const data = {
      session: this.currentSession,
      results: this.testResults,
      metrics: this.validationMetrics,
      exportTime: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test_results_${this.testResults.sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    console.log('Results exported');
  }

  loadSession(sessionId: string) {
    console.log('Loading session:', sessionId);
    // In real app, would make HTTP request to backend
  }

  deleteSession(sessionId: string) {
    this.recentSessions = this.recentSessions.filter(s => s.id !== sessionId);
    console.log('Session deleted:', sessionId);
  }

  getStatusText(status: string): string {
    const statusTexts: { [key: string]: string } = {
      'idle': 'Ready',
      'preparing': 'Preparing',
      'running': 'Running',
      'completed': 'Completed',
      'failed': 'Failed'
    };
    return statusTexts[status] || 'Unknown';
  }

  private generateMockSessions() {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      this.recentSessions.push({
        id: `session_${now - i * 300000}`,
        configuration: {
          testType: ['accuracy', 'precision', 'latency'][Math.floor(Math.random() * 3)] as any,
          duration: 60,
          targetCount: 20,
          targetSize: 40,
          showTrajectory: true,
          randomOrder: true,
          includeCalibration: false
        },
        startTime: now - i * 300000,
        endTime: now - i * 300000 + 60000,
        status: 'completed',
        currentTargetIndex: 20,
        targets: []
      });
    }
  }
}
