/**
 * API Service Usage Examples
 * Demonstrates how to use the new API services in components
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Import API Services
import { 
  CalibrationApiService,
  TrackingApiService, 
  AnalyticsApiService,
  WebSocketService 
} from '../core/core.module';

@Component({
  selector: 'app-api-examples',
  template: `
    <div class="api-examples">
      <h2>API Integration Examples</h2>
      
      <!-- WebSocket Status -->
      <div class="connection-status">
        <h3>WebSocket Connection</h3>
        <p>Status: {{ connectionStatus?.connected ? 'Connected' : 'Disconnected' }}</p>
        <p>Reconnect Attempts: {{ connectionStatus?.reconnectAttempts || 0 }}</p>
        <button (click)="connectWebSocket()">Connect</button>
        <button (click)="disconnectWebSocket()">Disconnect</button>
      </div>

      <!-- Calibration Examples -->
      <div class="calibration-section">
        <h3>Calibration API</h3>
        <button (click)="startCalibration()">Start Calibration</button>
        <button (click)="getCalibrationStatus()">Get Status</button>
        <button (click)="resetCalibration()">Reset</button>
      </div>

      <!-- Tracking Examples -->
      <div class="tracking-section">
        <h3>Tracking API</h3>
        <button (click)="startTracking()">Start Tracking</button>
        <button (click)="stopTracking()">Stop Tracking</button>
        <button (click)="getCurrentGaze()">Get Gaze Point</button>
      </div>

      <!-- Analytics Examples -->
      <div class="analytics-section">
        <h3>Analytics API</h3>
        <button (click)="getPerformanceMetrics()">Get Performance</button>
        <button (click)="getDashboardData()">Get Dashboard</button>
        <button (click)="exportAnalytics()">Export Data</button>
      </div>

      <!-- Results Display -->
      <div class="results" *ngIf="lastResult">
        <h3>Last API Result:</h3>
        <pre>{{ lastResult | json }}</pre>
      </div>
    </div>
  `,
  styles: [`
    .api-examples {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .connection-status,
    .calibration-section,
    .tracking-section,
    .analytics-section {
      margin-bottom: 30px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    
    button {
      margin: 5px;
      padding: 8px 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    button:hover {
      background: #0056b3;
    }
    
    .results {
      margin-top: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    
    pre {
      background: white;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
  `]
})
export class ApiExampleComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  connectionStatus: any = null;
  lastResult: any = null;

  constructor(
    private calibrationApi: CalibrationApiService,
    private trackingApi: TrackingApiService,
    private analyticsApi: AnalyticsApiService,
    private websocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    // Monitor WebSocket connection status
    this.websocketService.getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.connectionStatus = status;
        console.log('WebSocket status:', status);
      });

    // Listen for WebSocket messages
    this.setupWebSocketListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.websocketService.disconnect();
  }

  /**
   * WebSocket Examples
   */
  connectWebSocket(): void {
    this.websocketService.connect()
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        message => {
          console.log('WebSocket message received:', message);
          this.lastResult = { type: 'WebSocket Message', data: message };
        },
        error => {
          console.error('WebSocket error:', error);
          this.lastResult = { type: 'WebSocket Error', error };
        }
      );
  }

  disconnectWebSocket(): void {
    this.websocketService.disconnect();
  }

  private setupWebSocketListeners(): void {
    // Listen for gaze updates
    this.websocketService.onGazeUpdate()
      .pipe(takeUntil(this.destroy$))
      .subscribe(gazeData => {
        console.log('Gaze update:', gazeData);
        this.lastResult = { type: 'Gaze Update', data: gazeData };
      });

    // Listen for calibration updates
    this.websocketService.onCalibrationUpdate()
      .pipe(takeUntil(this.destroy$))
      .subscribe(calibrationData => {
        console.log('Calibration update:', calibrationData);
        this.lastResult = { type: 'Calibration Update', data: calibrationData };
      });

    // Listen for performance updates
    this.websocketService.onPerformanceUpdate()
      .pipe(takeUntil(this.destroy$))
      .subscribe(performanceData => {
        console.log('Performance update:', performanceData);
        this.lastResult = { type: 'Performance Update', data: performanceData };
      });
  }

  /**
   * Calibration API Examples
   */
  startCalibration(): void {
    const config = {
      pointCount: 9,
      duration: 2000,
      screenResolution: { width: 1920, height: 1080 }
    };

    this.calibrationApi.startCalibration(config)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        result => {
          console.log('Calibration started:', result);
          this.lastResult = { type: 'Calibration Start', data: result };
        },
        error => {
          console.error('Calibration start error:', error);
          this.lastResult = { type: 'Error', error: error.userMessage };
        }
      );
  }

  getCalibrationStatus(): void {
    this.calibrationApi.getCalibrationStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        status => {
          console.log('Calibration status:', status);
          this.lastResult = { type: 'Calibration Status', data: status };
        },
        error => {
          console.error('Get calibration status error:', error);
          this.lastResult = { type: 'Error', error: error.userMessage };
        }
      );
  }

  resetCalibration(): void {
    this.calibrationApi.resetCalibration()
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        result => {
          console.log('Calibration reset:', result);
          this.lastResult = { type: 'Calibration Reset', data: result };
        },
        error => {
          console.error('Calibration reset error:', error);
          this.lastResult = { type: 'Error', error: error.userMessage };
        }
      );
  }

  /**
   * Tracking API Examples
   */
  startTracking(): void {
    const config = {
      mode: 'real-time',
      frameRate: 30,
      smoothing: true
    };

    this.trackingApi.startTracking(config)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        result => {
          console.log('Tracking started:', result);
          this.lastResult = { type: 'Tracking Start', data: result };
        },
        error => {
          console.error('Tracking start error:', error);
          this.lastResult = { type: 'Error', error: error.userMessage };
        }
      );
  }

  stopTracking(): void {
    this.trackingApi.stopTracking()
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        result => {
          console.log('Tracking stopped:', result);
          this.lastResult = { type: 'Tracking Stop', data: result };
        },
        error => {
          console.error('Tracking stop error:', error);
          this.lastResult = { type: 'Error', error: error.userMessage };
        }
      );
  }

  getCurrentGaze(): void {
    this.trackingApi.getCurrentGaze()
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        gazePoint => {
          console.log('Current gaze:', gazePoint);
          this.lastResult = { type: 'Current Gaze', data: gazePoint };
        },
        error => {
          console.error('Get gaze error:', error);
          this.lastResult = { type: 'Error', error: error.userMessage };
        }
      );
  }

  /**
   * Analytics API Examples
   */
  getPerformanceMetrics(): void {
    this.analyticsApi.getPerformanceMetrics('last_24h')
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        metrics => {
          console.log('Performance metrics:', metrics);
          this.lastResult = { type: 'Performance Metrics', data: metrics };
        },
        error => {
          console.error('Get performance metrics error:', error);
          this.lastResult = { type: 'Error', error: error.userMessage };
        }
      );
  }

  getDashboardData(): void {
    this.analyticsApi.getDashboardData()
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        data => {
          console.log('Dashboard data:', data);
          this.lastResult = { type: 'Dashboard Data', data };
        },
        error => {
          console.error('Get dashboard data error:', error);
          this.lastResult = { type: 'Error', error: error.userMessage };
        }
      );
  }

  exportAnalytics(): void {
    this.analyticsApi.exportAnalytics('json', { 
      dateRange: 'last_week',
      includeRawData: false 
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        blob => {
          console.log('Analytics exported:', blob);
          this.lastResult = { 
            type: 'Export Success', 
            data: { size: blob.size, type: blob.type }
          };
          
          // Download the file
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'analytics-export.json';
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error => {
          console.error('Export analytics error:', error);
          this.lastResult = { type: 'Error', error: error.userMessage };
        }
      );
  }
}
