/**
 * Analytics Dashboard Component - Enhanced API Integration
 * Real-time analytics with Python backend
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError } from 'rxjs';
import { of } from 'rxjs';

import { 
  StateService, 
  ErrorHandlerService,
  NotificationService,
  AnalyticsApiService,
  WebSocketService
} from '../core/core.module';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="analytics-dashboard">
      <!-- Header with Backend Status -->
      <div class="dashboard-header">
        <div class="header-left">
          <h2>📊 Analytics Dashboard</h2>
          <div class="connection-status" [ngClass]="{'connected': backendConnected, 'disconnected': !backendConnected}">
            <span class="status-dot"></span>
            {{ backendConnected ? 'Connected to Backend' : 'Using Mock Data' }}
          </div>
        </div>
        
        <div class="header-controls">
          <select [(ngModel)]="selectedTimeRange" (change)="updateTimeRange()" class="time-range-select">
            <option value="1h">Last 1 Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          <button class="btn btn-primary" (click)="exportData()">
            📤 Export
          </button>
          
          <button class="btn btn-outline" (click)="refreshData()">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Real-time Data Section -->
      <div *ngIf="realTimeMetrics" class="realtime-section">
        <h3>Real-time Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">{{ realTimeMetrics.accuracy?.mean | number:'1.1-2' }}%</div>
            <div class="metric-label">Average Accuracy</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">{{ realTimeMetrics.latency?.mean | number:'1.0-0' }}ms</div>
            <div class="metric-label">Latency</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">{{ realTimeMetrics.frameRate?.current | number:'1.0-0' }}</div>
            <div class="metric-label">Frame Rate</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">{{ realTimeMetrics.eyeDetection?.successRate | number:'1.1-1' }}%</div>
            <div class="metric-label">Eye Detection</div>
          </div>
        </div>
      </div>

      <!-- Performance Dashboard -->
      <div class="performance-section">
        <h3>Performance Overview</h3>
        <div class="performance-grid">
          <div class="chart-container">
            <h4>Accuracy Trends</h4>
            <div class="chart-placeholder" #accuracyChart>
              <p *ngIf="!performanceData">Loading chart data...</p>
              <canvas *ngIf="performanceData" width="400" height="200"></canvas>
            </div>
          </div>
          
          <div class="chart-container">
            <h4>Response Time</h4>
            <div class="chart-placeholder" #latencyChart>
              <p *ngIf="!performanceData">Loading chart data...</p>
              <canvas *ngIf="performanceData" width="400" height="200"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Session Data -->
      <div class="sessions-section">
        <h3>Recent Sessions</h3>
        <div class="sessions-table" *ngIf="sessionsData?.length; else noSessions">
          <div class="table-header">
            <div class="col">Date</div>
            <div class="col">Duration</div>
            <div class="col">Accuracy</div>
            <div class="col">Status</div>
            <div class="col">Actions</div>
          </div>
          <div class="table-row" *ngFor="let session of sessionsData">
            <div class="col">{{ session.startTime | date:'short' }}</div>
            <div class="col">{{ formatDuration(session.duration) }}</div>
            <div class="col">{{ session.averageAccuracy | number:'1.1-1' }}%</div>
            <div class="col">
              <span class="status-badge" [ngClass]="session.status">{{ session.status }}</span>
            </div>
            <div class="col">
              <button class="btn btn-sm" (click)="viewSession(session.sessionId)">View</button>
              <button class="btn btn-sm btn-danger" (click)="deleteSession(session.sessionId)">Delete</button>
            </div>
          </div>
        </div>
        
        <ng-template #noSessions>
          <div class="no-data">
            <p>No session data available</p>
            <button class="btn btn-primary" (click)="refreshData()">Refresh Data</button>
          </div>
        </ng-template>
      </div>

      <!-- Export Options Modal -->
      <div *ngIf="showExportModal" class="modal-overlay" (click)="closeExportModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Export Analytics Data</h3>
            <button class="modal-close" (click)="closeExportModal()">×</button>
          </div>
          
          <div class="modal-body">
            <div class="form-group">
              <label>Format:</label>
              <select [(ngModel)]="exportOptions.format">
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>
                <input type="checkbox" [(ngModel)]="exportOptions.includeRawData">
                Include Raw Data
              </label>
            </div>
            
            <div class="form-group">
              <label>
                <input type="checkbox" [(ngModel)]="exportOptions.includePerformance">
                Include Performance Metrics
              </label>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeExportModal()">Cancel</button>
            <button class="btn btn-primary" (click)="performExport()">Export</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analytics-dashboard {
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .header-left h2 {
      margin: 0 0 0.5rem 0;
      color: #333;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 15px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .connection-status.connected {
      background: #d1e7dd;
      color: #0f5132;
    }

    .connection-status.disconnected {
      background: #fff3cd;
      color: #856404;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .header-controls {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .time-range-select {
      padding: 0.5rem 1rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-primary:hover {
      background: #0056b3;
    }

    .btn-outline {
      background: white;
      color: #007bff;
      border: 1px solid #007bff;
    }

    .btn-outline:hover {
      background: #007bff;
      color: white;
    }

    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.85rem;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .realtime-section {
      margin-bottom: 2rem;
    }

    .realtime-section h3 {
      margin: 0 0 1rem 0;
      color: #333;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .metric-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
    }

    .metric-value {
      font-size: 2rem;
      font-weight: bold;
      color: #007bff;
      margin-bottom: 0.5rem;
    }

    .metric-label {
      color: #666;
      font-size: 0.9rem;
    }

    .performance-section,
    .sessions-section {
      margin-bottom: 2rem;
    }

    .performance-section h3,
    .sessions-section h3 {
      margin: 0 0 1rem 0;
      color: #333;
    }

    .performance-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .chart-container {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1rem;
    }

    .chart-container h4 {
      margin: 0 0 1rem 0;
      color: #333;
      font-size: 1rem;
    }

    .chart-placeholder {
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .sessions-table {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }

    .table-header,
    .table-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr;
      gap: 1rem;
      padding: 0.75rem 1rem;
    }

    .table-header {
      background: #f8f9fa;
      font-weight: 600;
      color: #333;
    }

    .table-row {
      border-top: 1px solid #e0e0e0;
    }

    .table-row:hover {
      background: #f8f9fa;
    }

    .col {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .status-badge.completed {
      background: #d1e7dd;
      color: #0f5132;
    }

    .status-badge.active {
      background: #cfe2ff;
      color: #084298;
    }

    .status-badge.failed {
      background: #f8d7da;
      color: #721c24;
    }

    .no-data {
      text-align: center;
      padding: 2rem;
      color: #666;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .modal-header h3 {
      margin: 0;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #666;
    }

    .modal-body {
      padding: 1rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .form-group select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .form-group input[type="checkbox"] {
      margin-right: 0.5rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem;
      border-top: 1px solid #e0e0e0;
    }

    @media (max-width: 768px) {
      .dashboard-header {
        flex-direction: column;
        gap: 1rem;
      }

      .performance-grid {
        grid-template-columns: 1fr;
      }

      .table-header,
      .table-row {
        grid-template-columns: 1fr;
        gap: 0.5rem;
      }

      .col {
        padding: 0.25rem 0;
      }
    }
  `]
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // API Integration
  backendConnected = false;
  realTimeMetrics: any = null;
  performanceData: any = null;
  sessionsData: any[] = [];
  
  // UI State
  selectedTimeRange = '24h';
  showExportModal = false;
  
  exportOptions = {
    format: 'json' as 'json' | 'csv',
    includeRawData: true,
    includePerformance: true
  };

  constructor(
    private stateService: StateService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService,
    private analyticsApi: AnalyticsApiService,
    private websocketService: WebSocketService
  ) {}

  ngOnInit() {
    this.checkBackendConnection();
    this.loadInitialData();
    this.setupWebSocketUpdates();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async checkBackendConnection() {
    try {
      // Test backend connection
      await this.analyticsApi.getPerformanceMetrics()
        .pipe(
          takeUntil(this.destroy$),
          catchError(() => of(null))
        )
        .toPromise();
      
      this.backendConnected = true;
      console.log('Analytics backend connected');
    } catch (error) {
      this.backendConnected = false;
      console.warn('Analytics backend not available, using mock data');
      this.loadMockData();
    }
  }

  private async loadInitialData() {
    if (this.backendConnected) {
      try {
        // Load real data from backend
        const [metrics, dashboard, sessions] = await Promise.all([
          this.analyticsApi.getPerformanceMetrics(this.selectedTimeRange)
            .pipe(takeUntil(this.destroy$)).toPromise(),
          this.analyticsApi.getDashboardData()
            .pipe(takeUntil(this.destroy$)).toPromise(),
          this.analyticsApi.getAllSessions(10, 0)
            .pipe(takeUntil(this.destroy$)).toPromise()
        ]);

        this.realTimeMetrics = metrics;
        this.performanceData = dashboard;
        this.sessionsData = sessions || [];
        
      } catch (error) {
        this.errorHandler.handleError(error as Error, 'Failed to load analytics data');
        this.loadMockData();
      }
    }
  }

  private loadMockData() {
    // Mock data for demo purposes
    this.realTimeMetrics = {
      accuracy: { mean: 0.89, std: 0.05, min: 0.75, max: 0.98 },
      latency: { mean: 45, std: 8, p95: 65, p99: 85 },
      frameRate: { current: 30, average: 28.5, target: 30 },
      eyeDetection: { successRate: 0.94, failureRate: 0.06, partialDetection: 0.12 }
    };

    this.performanceData = {
      sessionId: 'mock-session',
      startTime: new Date().toISOString(),
      duration: 1800000, // 30 minutes
      metrics: this.realTimeMetrics
    };

    this.sessionsData = [
      {
        sessionId: 'session-1',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        duration: 1800000,
        averageAccuracy: 0.91,
        status: 'completed'
      },
      {
        sessionId: 'session-2',
        startTime: new Date(Date.now() - 7200000).toISOString(),
        duration: 1200000,
        averageAccuracy: 0.87,
        status: 'completed'
      },
      {
        sessionId: 'session-3',
        startTime: new Date(Date.now() - 10800000).toISOString(),
        duration: 600000,
        averageAccuracy: 0.82,
        status: 'failed'
      }
    ];
  }

  private setupWebSocketUpdates() {
    if (this.backendConnected) {
      // Listen for real-time performance updates
      this.websocketService.onPerformanceUpdate()
        .pipe(takeUntil(this.destroy$))
        .subscribe(data => {
          console.log('Real-time performance update:', data);
          this.realTimeMetrics = { ...this.realTimeMetrics, ...data };
        });
    }
  }

  async updateTimeRange() {
    if (this.backendConnected) {
      try {
        const metrics = await this.analyticsApi.getPerformanceMetrics(this.selectedTimeRange)
          .pipe(takeUntil(this.destroy$))
          .toPromise();
        
        this.realTimeMetrics = metrics;
        this.notifications.showInfo(`Updated to ${this.selectedTimeRange} timeframe`);
      } catch (error) {
        this.errorHandler.handleError(error as Error, 'Failed to update time range');
      }
    }
  }

  async refreshData() {
    this.notifications.showInfo('Refreshing analytics data...');
    await this.loadInitialData();
    this.notifications.showSuccess('Analytics data refreshed');
  }

  exportData() {
    this.showExportModal = true;
  }

  closeExportModal() {
    this.showExportModal = false;
  }

  async performExport() {
    try {
      if (this.backendConnected) {
        // Export from backend
        const blob = await this.analyticsApi.exportAnalytics(
          this.exportOptions.format,
          {
            timeRange: this.selectedTimeRange,
            includeRawData: this.exportOptions.includeRawData,
            includePerformance: this.exportOptions.includePerformance
          }
        ).pipe(takeUntil(this.destroy$)).toPromise();

        if (blob) {
          // Download the file
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `analytics-${Date.now()}.${this.exportOptions.format}`;
          link.click();
          window.URL.revokeObjectURL(url);
        }
      } else {
        // Export mock data
        const data = {
          metrics: this.realTimeMetrics,
          performance: this.performanceData,
          sessions: this.sessionsData,
          exportedAt: new Date().toISOString()
        };

        const dataStr = this.exportOptions.format === 'json' 
          ? JSON.stringify(data, null, 2)
          : this.convertToCSV(data);

        const blob = new Blob([dataStr], { 
          type: this.exportOptions.format === 'json' ? 'application/json' : 'text/csv' 
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics-mock-${Date.now()}.${this.exportOptions.format}`;
        link.click();
        window.URL.revokeObjectURL(url);
      }

      this.notifications.showSuccess('Data exported successfully');
      this.closeExportModal();
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to export data');
    }
  }

  async viewSession(sessionId: string) {
    try {
      if (this.backendConnected) {
        const sessionData = await this.analyticsApi.getSessionStats(sessionId)
          .pipe(takeUntil(this.destroy$))
          .toPromise();
        
        console.log('Session data:', sessionData);
        this.notifications.showInfo(`Loaded session ${sessionId}`);
      } else {
        console.log('Mock session view:', sessionId);
        this.notifications.showInfo(`Viewing session ${sessionId} (mock)`);
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to load session');
    }
  }

  async deleteSession(sessionId: string) {
    if (confirm('Are you sure you want to delete this session?')) {
      try {
        if (this.backendConnected) {
          await this.analyticsApi.deleteSession(sessionId)
            .pipe(takeUntil(this.destroy$))
            .toPromise();
        }

        // Remove from local data
        this.sessionsData = this.sessionsData.filter(s => s.sessionId !== sessionId);
        this.notifications.showSuccess('Session deleted successfully');
        
      } catch (error) {
        this.errorHandler.handleError(error as Error, 'Failed to delete session');
      }
    }
  }

  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion for sessions data
    const sessions = data.sessions || [];
    const headers = ['Session ID', 'Start Time', 'Duration', 'Accuracy', 'Status'];
    const rows = sessions.map((session: any) => [
      session.sessionId,
      session.startTime,
      this.formatDuration(session.duration),
      `${(session.averageAccuracy * 100).toFixed(1)}%`,
      session.status
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}
