import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, timer } from 'rxjs';

// Mock interfaces for UI-only component
interface TestResult {
  testName: string;
  passed: boolean;
  score: number;
  details: string;
  duration: number;
  timestamp: number;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: boolean;
  duration: number;
  overallScore: number;
}

interface ValidationMetrics {
  accuracy: {
    gazePointError: number;
    calibrationAccuracy: number;
    trackingStability: number;
    precision: number;
  };
  performance: {
    responseTime: number;
    frameRate: number;
    cpuUsage: number;
    memoryUsage: number;
  };
  reliability: {
    successRate: number;
    errorRecoveryTime: number;
    calibrationStability: number;
    overallReliability: number;
  };
}

@Component({
  selector: 'app-validation-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="validation-dashboard">
      
      <!-- Header -->
      <header class="dashboard-header">
        <h1>Validation & Testing Dashboard</h1>
        <div class="header-actions">
          <button 
            class="action-btn primary"
            (click)="runFullTestSuite()"
            [disabled]="isTestingInProgress">
            {{ isTestingInProgress ? 'Testing...' : 'Run Full Test Suite' }}
          </button>
          <button 
            class="action-btn secondary"
            (click)="exportResults()"
            [disabled]="testSuites.length === 0">
            Export Results
          </button>
        </div>
      </header>

      <!-- Current Test Progress -->
      <div class="progress-section" *ngIf="isTestingInProgress">
        <div class="progress-card">
          <h3>Test Progress</h3>
          <div class="current-test">
            <span class="test-name">{{ currentTest }}</span>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="testProgress"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Test Results Overview -->
      <div class="results-overview" *ngIf="testSuites.length > 0">
        <h2>Test Results Overview</h2>
        <div class="overview-grid">
          <div class="overview-card" *ngFor="let suite of testSuites" [class]="suite.passed ? 'passed' : 'failed'">
            <h3>{{ suite.name }}</h3>
            <div class="suite-stats">
              <div class="stat">
                <span class="value">{{ suite.tests.length }}</span>
                <span class="label">Tests</span>
              </div>
              <div class="stat">
                <span class="value">{{ getPassedTests(suite) }}</span>
                <span class="label">Passed</span>
              </div>
              <div class="stat">
                <span class="value">{{ suite.duration }}ms</span>
                <span class="label">Duration</span>
              </div>
            </div>
            <div class="suite-status">
              <span class="status-indicator" [class]="suite.passed ? 'passed' : 'failed'">
                {{ suite.passed ? '✓' : '✗' }}
              </span>
              <span>{{ suite.passed ? 'Passed' : 'Failed' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Validation Metrics -->
      <div class="validation-metrics" *ngIf="validationMetrics">
        <h2>Validation Metrics</h2>
        <div class="metrics-grid">
          
          <!-- Accuracy Metrics -->
          <div class="metric-section">
            <h3>Accuracy</h3>
            <div class="metric-cards">
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.accuracy.gazePointError.toFixed(2) }}°</div>
                <div class="metric-label">Gaze Point Error</div>
                <div class="metric-bar">
                  <div class="bar-fill accuracy" [style.width.%]="100 - (validationMetrics.accuracy.gazePointError * 25)"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.accuracy.calibrationAccuracy.toFixed(1) }}%</div>
                <div class="metric-label">Calibration Accuracy</div>
                <div class="metric-bar">
                  <div class="bar-fill accuracy" [style.width.%]="validationMetrics.accuracy.calibrationAccuracy"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.accuracy.trackingStability.toFixed(1) }}%</div>
                <div class="metric-label">Tracking Stability</div>
                <div class="metric-bar">
                  <div class="bar-fill accuracy" [style.width.%]="validationMetrics.accuracy.trackingStability"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.accuracy.precision.toFixed(2) }}px</div>
                <div class="metric-label">Precision</div>
                <div class="metric-bar">
                  <div class="bar-fill accuracy" [style.width.%]="getPrecisionWidth(validationMetrics.accuracy.precision)"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Performance Metrics -->
          <div class="metric-section">
            <h3>Performance</h3>
            <div class="metric-cards">
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.performance.responseTime.toFixed(0) }}ms</div>
                <div class="metric-label">Response Time</div>
                <div class="metric-bar">
                  <div class="bar-fill performance" [style.width.%]="getResponseTimeWidth(validationMetrics.performance.responseTime)"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.performance.frameRate.toFixed(1) }} FPS</div>
                <div class="metric-label">Frame Rate</div>
                <div class="metric-bar">
                  <div class="bar-fill performance" [style.width.%]="(validationMetrics.performance.frameRate / 30) * 100"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.performance.cpuUsage.toFixed(1) }}%</div>
                <div class="metric-label">CPU Usage</div>
                <div class="metric-bar">
                  <div class="bar-fill performance" [style.width.%]="validationMetrics.performance.cpuUsage"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.performance.memoryUsage.toFixed(0) }}MB</div>
                <div class="metric-label">Memory Usage</div>
                <div class="metric-bar">
                  <div class="bar-fill performance" [style.width.%]="(validationMetrics.performance.memoryUsage / 1000) * 100"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Reliability Metrics -->
          <div class="metric-section">
            <h3>Reliability</h3>
            <div class="metric-cards">
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.reliability.successRate.toFixed(1) }}%</div>
                <div class="metric-label">Success Rate</div>
                <div class="metric-bar">
                  <div class="bar-fill reliability" [style.width.%]="validationMetrics.reliability.successRate"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.reliability.errorRecoveryTime.toFixed(0) }}ms</div>
                <div class="metric-label">Error Recovery Time</div>
                <div class="metric-bar">
                  <div class="bar-fill reliability" [style.width.%]="getErrorRecoveryWidth(validationMetrics.reliability.errorRecoveryTime)"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.reliability.calibrationStability.toFixed(1) }}%</div>
                <div class="metric-label">Calibration Stability</div>
                <div class="metric-bar">
                  <div class="bar-fill reliability" [style.width.%]="validationMetrics.reliability.calibrationStability"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed Test Results -->
      <div class="detailed-results" *ngIf="testSuites.length > 0">
        <h2>Detailed Test Results</h2>
        
        <div class="test-suite-details" *ngFor="let suite of testSuites">
          <div class="suite-header" (click)="toggleSuiteExpanded(suite.name)">
            <h3>{{ suite.name }}</h3>
            <span class="suite-summary">
              {{ getPassedTests(suite) }}/{{ suite.tests.length }} passed
            </span>
            <span class="expand-icon" [class.expanded]="isSuiteExpanded(suite.name)">▼</span>
          </div>
          
          <div class="suite-content" *ngIf="isSuiteExpanded(suite.name)">
            <div class="test-result" 
                 *ngFor="let test of suite.tests" 
                 [class]="test.passed ? 'passed' : 'failed'">
              <div class="test-header">
                <span class="test-name">{{ test.testName }}</span>
                <span class="test-score">{{ test.score.toFixed(1) }}</span>
                <span class="test-status" [class]="test.passed ? 'passed' : 'failed'">
                  {{ test.passed ? '✓' : '✗' }}
                </span>
              </div>
              <div class="test-details">
                <p>{{ test.details }}</p>
                <div class="test-meta">
                  <span>Duration: {{ test.duration }}ms</span>
                  <span>Timestamp: {{ formatTimestamp(test.timestamp) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Test History -->
      <div class="test-history" *ngIf="testHistory.length > 0">
        <h2>Test History</h2>
        <div class="history-list">
          <div class="history-item" *ngFor="let run of testHistory">
            <div class="run-info">
              <span class="run-date">{{ formatTimestamp(run.timestamp) }}</span>
              <span class="run-duration">{{ run.duration }}ms</span>
              <span class="run-status" [class]="run.passed ? 'passed' : 'failed'">
                {{ run.passed ? 'Passed' : 'Failed' }}
              </span>
            </div>
            <div class="run-summary">
              Overall Score: {{ run.overallScore.toFixed(1) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .validation-dashboard {
      padding: 2rem;
      background: #f8f9fa;
      min-height: 100vh;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    /* Header */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .dashboard-header h1 {
      margin: 0;
      color: #2c3e50;
      font-size: 1.8rem;
    }

    .header-actions {
      display: flex;
      gap: 1rem;
    }

    .action-btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .action-btn.primary {
      background: #007bff;
      color: white;
    }

    .action-btn.secondary {
      background: #6c757d;
      color: white;
    }

    .action-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .action-btn:disabled {
      background: #e9ecef;
      color: #6c757d;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    /* Progress Section */
    .progress-section {
      margin-bottom: 2rem;
    }

    .progress-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .progress-card h3 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
    }

    .current-test {
      margin-bottom: 1rem;
    }

    .test-name {
      font-weight: 500;
      color: #495057;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      margin-top: 0.5rem;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #007bff;
      transition: width 0.3s ease;
    }

    /* Results Overview */
    .results-overview {
      margin-bottom: 2rem;
    }

    .results-overview h2 {
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
    }

    .overview-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-left: 4px solid #28a745;
    }

    .overview-card.failed {
      border-left-color: #dc3545;
    }

    .overview-card h3 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
    }

    .suite-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .stat {
      text-align: center;
    }

    .stat .value {
      display: block;
      font-size: 1.5rem;
      font-weight: bold;
      color: #007bff;
    }

    .stat .label {
      font-size: 0.875rem;
      color: #6c757d;
    }

    .suite-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-indicator {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }

    .status-indicator.passed {
      background: #28a745;
    }

    .status-indicator.failed {
      background: #dc3545;
    }

    /* Validation Metrics */
    .validation-metrics {
      margin-bottom: 2rem;
    }

    .validation-metrics h2 {
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 2rem;
    }

    .metric-section {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .metric-section h3 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
      border-bottom: 2px solid #e9ecef;
      padding-bottom: 0.5rem;
    }

    .metric-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .metric-card {
      text-align: center;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 6px;
    }

    .metric-value {
      display: block;
      font-size: 1.25rem;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }

    .metric-label {
      font-size: 0.875rem;
      color: #6c757d;
      margin-bottom: 0.5rem;
    }

    .metric-bar {
      width: 100%;
      height: 6px;
      background: #e9ecef;
      border-radius: 3px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .bar-fill.accuracy {
      background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%);
    }

    .bar-fill.performance {
      background: linear-gradient(90deg, #28a745 0%, #007bff 50%, #17a2b8 100%);
    }

    .bar-fill.reliability {
      background: linear-gradient(90deg, #ffc107 0%, #28a745 100%);
    }

    /* Detailed Results */
    .detailed-results {
      margin-bottom: 2rem;
    }

    .detailed-results h2 {
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .test-suite-details {
      background: white;
      margin-bottom: 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .suite-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: #f8f9fa;
      cursor: pointer;
      border-bottom: 1px solid #e9ecef;
    }

    .suite-header:hover {
      background: #e9ecef;
    }

    .suite-header h3 {
      margin: 0;
      color: #2c3e50;
    }

    .suite-summary {
      color: #6c757d;
      font-weight: 500;
    }

    .expand-icon {
      transition: transform 0.3s ease;
      color: #6c757d;
    }

    .expand-icon.expanded {
      transform: rotate(180deg);
    }

    .suite-content {
      padding: 1rem;
    }

    .test-result {
      padding: 1rem;
      margin-bottom: 0.5rem;
      border-radius: 6px;
      border-left: 4px solid #28a745;
    }

    .test-result.failed {
      border-left-color: #dc3545;
      background: #fff5f5;
    }

    .test-result.passed {
      background: #f0fff4;
    }

    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .test-name {
      font-weight: 500;
      color: #2c3e50;
    }

    .test-score {
      font-weight: bold;
      color: #007bff;
    }

    .test-status {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 0.75rem;
    }

    .test-status.passed {
      background: #28a745;
    }

    .test-status.failed {
      background: #dc3545;
    }

    .test-details p {
      margin: 0 0 0.5rem 0;
      color: #495057;
    }

    .test-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.875rem;
      color: #6c757d;
    }

    /* Test History */
    .test-history {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .test-history h2 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .history-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e9ecef;
    }

    .run-info {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .run-date {
      font-weight: 500;
      color: #2c3e50;
    }

    .run-duration {
      color: #6c757d;
    }

    .run-status {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .run-status.passed {
      background: #d4edda;
      color: #155724;
    }

    .run-status.failed {
      background: #f8d7da;
      color: #721c24;
    }

    .run-summary {
      font-weight: 500;
      color: #007bff;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .dashboard-header {
        flex-direction: column;
        gap: 1rem;
      }

      .overview-grid {
        grid-template-columns: 1fr;
      }

      .metrics-grid {
        grid-template-columns: 1fr;
      }

      .suite-stats {
        grid-template-columns: 1fr;
      }

      .test-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .history-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }
  `]
})
export class ValidationDashboardComponent implements OnInit, OnDestroy {
  testSuites: TestSuite[] = [];
  validationMetrics: ValidationMetrics | null = null;
  currentTest = '';
  isTestingInProgress = false;
  testProgress = 0;
  
  expandedSuites: Set<string> = new Set();
  testHistory: any[] = [];

  private subscriptions: Subscription[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.initializeMockData();
    this.setupSubscriptions();
    this.loadTestHistory();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeMockData(): void {
    // Initialize mock validation metrics
    this.validationMetrics = {
      accuracy: {
        gazePointError: 1.2,
        calibrationAccuracy: 92.5,
        trackingStability: 89.3,
        precision: 15.2
      },
      performance: {
        responseTime: 18.5,
        frameRate: 28.7,
        cpuUsage: 45.2,
        memoryUsage: 324
      },
      reliability: {
        successRate: 96.8,
        errorRecoveryTime: 120,
        calibrationStability: 94.1,
        overallReliability: 95.2
      }
    };

    // Initialize mock test suites
    this.testSuites = [
      {
        name: 'Eye Tracking Accuracy Tests',
        passed: true,
        duration: 15420,
        overallScore: 89.4,
        tests: [
          {
            testName: 'Grid Point Accuracy',
            passed: true,
            score: 92.1,
            details: 'Average deviation: 1.2°, Maximum deviation: 2.8°',
            duration: 5200,
            timestamp: Date.now() - 300000
          },
          {
            testName: 'Random Point Tracking',
            passed: true,
            score: 87.3,
            details: 'Smooth pursuit accuracy: 87%, Saccade precision: 85%',
            duration: 4800,
            timestamp: Date.now() - 240000
          },
          {
            testName: 'Fixation Stability',
            passed: true,
            score: 88.9,
            details: 'RMS deviation: 0.8°, Fixation duration: 2.1s avg',
            duration: 5420,
            timestamp: Date.now() - 180000
          }
        ]
      },
      {
        name: 'Calibration Validation Tests',
        passed: false,
        duration: 8340,
        overallScore: 73.2,
        tests: [
          {
            testName: 'Multi-point Calibration',
            passed: true,
            score: 91.5,
            details: 'All 9 calibration points successfully validated',
            duration: 3200,
            timestamp: Date.now() - 120000
          },
          {
            testName: 'Drift Compensation',
            passed: false,
            score: 54.9,
            details: 'Significant drift detected after 3 minutes of use',
            duration: 5140,
            timestamp: Date.now() - 60000
          }
        ]
      },
      {
        name: 'Performance Stress Tests',
        passed: true,
        duration: 22150,
        overallScore: 82.6,
        tests: [
          {
            testName: 'High-frequency Tracking',
            passed: true,
            score: 78.4,
            details: 'Maintained 30fps for 10 minutes continuous tracking',
            duration: 12000,
            timestamp: Date.now() - 30000
          },
          {
            testName: 'Low-light Conditions',
            passed: true,
            score: 86.8,
            details: 'Performance degradation < 10% in low light',
            duration: 10150,
            timestamp: Date.now() - 15000
          }
        ]
      }
    ];

    // Initialize mock test history
    this.testHistory = [
      {
        timestamp: Date.now() - 86400000,
        duration: 35200,
        passed: true,
        overallScore: 88.2
      },
      {
        timestamp: Date.now() - 172800000,
        duration: 28950,
        passed: false,
        overallScore: 72.1
      },
      {
        timestamp: Date.now() - 259200000,
        duration: 31780,
        passed: true,
        overallScore: 91.5
      }
    ];
  }

  private setupSubscriptions(): void {
    // Simulate periodic metric updates
    this.subscriptions.push(
      timer(0, 5000).subscribe(() => {
        this.updateMockMetrics();
      })
    );
  }

  private updateMockMetrics(): void {
    if (this.validationMetrics) {
      // Simulate slight metric fluctuations
      this.validationMetrics.performance.frameRate += (Math.random() - 0.5) * 2;
      this.validationMetrics.performance.cpuUsage += (Math.random() - 0.5) * 5;
      this.validationMetrics.performance.memoryUsage += (Math.random() - 0.5) * 10;
      
      // Keep values within reasonable bounds
      this.validationMetrics.performance.frameRate = Math.max(25, Math.min(30, this.validationMetrics.performance.frameRate));
      this.validationMetrics.performance.cpuUsage = Math.max(30, Math.min(70, this.validationMetrics.performance.cpuUsage));
      this.validationMetrics.performance.memoryUsage = Math.max(250, Math.min(500, this.validationMetrics.performance.memoryUsage));
    }
  }

  async runFullTestSuite(): Promise<void> {
    this.isTestingInProgress = true;
    this.testProgress = 0;
    
    try {
      // Simulate test execution with progress updates
      const testNames = [
        'Initializing test environment...',
        'Running eye tracking accuracy tests...',
        'Validating calibration points...',
        'Testing drift compensation...',
        'Performance stress testing...',
        'Generating test report...'
      ];

      for (let i = 0; i < testNames.length; i++) {
        this.currentTest = testNames[i];
        this.testProgress = ((i + 1) / testNames.length) * 100;
        
        // Simulate test duration
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      }
      
      // Add to test history
      const overallScore = this.testSuites.reduce((sum, suite) => sum + suite.overallScore, 0) / this.testSuites.length;
      const overallPassed = this.testSuites.every(suite => suite.passed);
      const totalDuration = this.testSuites.reduce((sum, suite) => sum + suite.duration, 0);
      
      this.testHistory.unshift({
        timestamp: Date.now(),
        duration: totalDuration,
        passed: overallPassed,
        overallScore: overallScore
      });
      
      this.saveTestHistory();
      
    } catch (error) {
      console.error('Test suite execution failed:', error);
    } finally {
      this.isTestingInProgress = false;
      this.testProgress = 0;
      this.currentTest = '';
    }

    // TODO: Call backend API
    // this.http.post('/api/validation/run-test-suite', {}).subscribe(results => {
    //   this.testSuites = results.testSuites;
    //   this.validationMetrics = results.metrics;
    // });
  }

  exportResults(): void {
    if (this.testSuites.length === 0) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      testSuites: this.testSuites,
      validationMetrics: this.validationMetrics,
      summary: {
        totalTests: this.testSuites.reduce((sum, suite) => sum + suite.tests.length, 0),
        passedTests: this.testSuites.reduce((sum, suite) => sum + this.getPassedTests(suite), 0),
        overallScore: this.testSuites.reduce((sum, suite) => sum + suite.overallScore, 0) / this.testSuites.length
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `validation-results-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);

    // TODO: Call backend API for server-side export
    // this.http.post('/api/validation/export-results', { format: 'json' }).subscribe();
  }

  getPassedTests(suite: TestSuite): number {
    return suite.tests.filter(test => test.passed).length;
  }

  toggleSuiteExpanded(suiteName: string): void {
    if (this.expandedSuites.has(suiteName)) {
      this.expandedSuites.delete(suiteName);
    } else {
      this.expandedSuites.add(suiteName);
    }
  }

  isSuiteExpanded(suiteName: string): boolean {
    return this.expandedSuites.has(suiteName);
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  private loadTestHistory(): void {
    const stored = localStorage.getItem('validationTestHistory');
    if (stored) {
      try {
        this.testHistory = JSON.parse(stored);
      } catch (error) {
        console.error('Failed to load test history:', error);
      }
    }

    // TODO: Load from backend API
    // this.http.get('/api/validation/test-history').subscribe(history => {
    //   this.testHistory = history;
    // });
  }

  private saveTestHistory(): void {
    localStorage.setItem('validationTestHistory', JSON.stringify(this.testHistory));

    // TODO: Save to backend API
    // this.http.post('/api/validation/save-test-history', this.testHistory).subscribe();
  }

  // Helper methods for metric bar calculations
  getPrecisionWidth(precision: number): number {
    return Math.max(0, 100 - precision * 2);
  }

  getResponseTimeWidth(responseTime: number): number {
    return Math.max(0, 100 - (responseTime / 5));
  }

  getErrorRecoveryWidth(errorRecoveryTime: number): number {
    return Math.max(0, 100 - (errorRecoveryTime / 20));
  }
}
