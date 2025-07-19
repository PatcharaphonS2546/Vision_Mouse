import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ValidationTestingService, TestResult, TestSuite, ValidationMetrics } from '../../services/validation-testing.service';

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
                <span class="value">{{ suite.overallScore.toFixed(1) }}</span>
                <span class="label">Score</span>
              </div>
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
                <div class="metric-value">{{ validationMetrics.accuracy.temporalConsistency.toFixed(1) }}%</div>
                <div class="metric-label">Temporal Consistency</div>
                <div class="metric-bar">
                  <div class="bar-fill accuracy" [style.width.%]="validationMetrics.accuracy.temporalConsistency"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Performance Metrics -->
          <div class="metric-section">
            <h3>Performance</h3>
            <div class="metric-cards">
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.performance.averageLatency.toFixed(1) }}ms</div>
                <div class="metric-label">Average Latency</div>
                <div class="metric-bar">
                  <div class="bar-fill performance" [style.width.%]="Math.max(0, 100 - validationMetrics.performance.averageLatency)"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.performance.frameRate.toFixed(1) }}</div>
                <div class="metric-label">Frame Rate (FPS)</div>
                <div class="metric-bar">
                  <div class="bar-fill performance" [style.width.%]="(validationMetrics.performance.frameRate / 30) * 100"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.performance.cpuUsage.toFixed(1) }}%</div>
                <div class="metric-label">CPU Usage</div>
                <div class="metric-bar">
                  <div class="bar-fill" [class]="getCPUUsageClass()" [style.width.%]="validationMetrics.performance.cpuUsage"></div>
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">{{ validationMetrics.performance.memoryUsage.toFixed(0) }}MB</div>
                <div class="metric-label">Memory Usage</div>
                <div class="metric-bar">
                  <div class="bar-fill" [class]="getMemoryUsageClass()" [style.width.%]="(validationMetrics.performance.memoryUsage / 500) * 100"></div>
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
                  <div class="bar-fill reliability" [style.width.%]="Math.max(0, 100 - (validationMetrics.reliability.errorRecoveryTime / 20))"></div>
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
      background: linear-gradient(90deg, #007bff, #28a745);
      transition: width 0.3s ease;
    }

    /* Results Overview */
    .results-overview {
      margin-bottom: 2rem;
    }

    .results-overview h2 {
      margin-bottom: 1rem;
      color: #2c3e50;
    }

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
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
      grid-template-columns: repeat(2, 1fr);
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
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .suite-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e9ecef;
    }

    .status-indicator {
      width: 20px;
      height: 20px;
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
      margin-bottom: 1rem;
      color: #2c3e50;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2rem;
    }

    .metric-section {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .metric-section h3 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e9ecef;
    }

    .metric-cards {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .metric-card {
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e9ecef;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 0.25rem;
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
      background: linear-gradient(90deg, #28a745, #20c997);
    }

    .bar-fill.performance {
      background: linear-gradient(90deg, #007bff, #6610f2);
    }

    .bar-fill.reliability {
      background: linear-gradient(90deg, #fd7e14, #e83e8c);
    }

    .bar-fill.warning {
      background: linear-gradient(90deg, #ffc107, #fd7e14);
    }

    .bar-fill.danger {
      background: linear-gradient(90deg, #dc3545, #e83e8c);
    }

    /* Detailed Results */
    .detailed-results {
      margin-bottom: 2rem;
    }

    .detailed-results h2 {
      margin-bottom: 1rem;
      color: #2c3e50;
    }

    .test-suite-details {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 1rem;
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
      text-transform: uppercase;
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

  constructor(
    private validationTestingService: ValidationTestingService
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.loadTestHistory();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private setupSubscriptions(): void {
    // Subscribe to current test updates
    const currentTestSub = this.validationTestingService.getCurrentTest().subscribe(testName => {
      this.currentTest = testName;
    });
    this.subscriptions.push(currentTestSub);

    // Subscribe to validation metrics
    const metricsSub = this.validationTestingService.getValidationMetrics().subscribe(metrics => {
      this.validationMetrics = metrics;
    });
    this.subscriptions.push(metricsSub);

    // Check if testing is in progress
    this.isTestingInProgress = this.validationTestingService.isTestingInProgress();
  }

  async runFullTestSuite(): Promise<void> {
    this.isTestingInProgress = true;
    this.testProgress = 0;
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        this.testProgress = Math.min(95, this.testProgress + Math.random() * 10);
      }, 500);
      
      const testSuites = await this.validationTestingService.runFullTestSuite();
      
      clearInterval(progressInterval);
      this.testProgress = 100;
      
      this.testSuites = testSuites;
      
      // Add to test history
      const overallScore = testSuites.reduce((sum, suite) => sum + suite.overallScore, 0) / testSuites.length;
      const overallPassed = testSuites.every(suite => suite.passed);
      const totalDuration = testSuites.reduce((sum, suite) => sum + suite.duration, 0);
      
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
    }
  }

  exportResults(): void {
    if (this.testSuites.length === 0) return;
    
    const exportData = this.validationTestingService.exportTestResults();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  getCPUUsageClass(): string {
    if (!this.validationMetrics) return '';
    
    const usage = this.validationMetrics.performance.cpuUsage;
    if (usage < 50) return 'performance';
    if (usage < 75) return 'warning';
    return 'danger';
  }

  getMemoryUsageClass(): string {
    if (!this.validationMetrics) return '';
    
    const usage = this.validationMetrics.performance.memoryUsage;
    if (usage < 200) return 'performance';
    if (usage < 350) return 'warning';
    return 'danger';
  }

  private loadTestHistory(): void {
    const saved = localStorage.getItem('visionMouseTestHistory');
    if (saved) {
      this.testHistory = JSON.parse(saved);
    }
  }

  private saveTestHistory(): void {
    // Keep only last 10 test runs
    this.testHistory = this.testHistory.slice(0, 10);
    localStorage.setItem('visionMouseTestHistory', JSON.stringify(this.testHistory));
  }

  // Add Math to component for template access
  Math = Math;
}
