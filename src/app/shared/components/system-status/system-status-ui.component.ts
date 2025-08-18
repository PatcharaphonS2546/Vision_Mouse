import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, timer } from 'rxjs';

// Mock interfaces for UI-only component
interface SystemPerformance {
  status: 'excellent' | 'good' | 'poor' | 'critical';
  cpuUsage: number;
  memoryUsage: number;
  frameRate: number;
  processingLatency: number;
  timestamp: number;
}

interface SystemStatus {
  overall: 'ok' | 'warning' | 'error' | 'critical';
  subsystems: {
    camera: string;
    processing: string;
    calibration: string;
    tracking: string;
  };
  timestamp: number;
}

interface ErrorInfo {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  timestamp: number;
  resolved: boolean;
  context?: any;
}

interface CameraQuality {
  resolution: string;
  frameRate: number;
  quality: 'excellent' | 'good' | 'poor';
}

@Component({
  selector: 'app-system-status',
  standalone: false,
  templateUrl: './system-status.component.html',
  styleUrl: './system-status.component.css'
})
export class SystemStatusComponent implements OnInit, OnDestroy {
  // System state
  performance: SystemPerformance | null = null;
  systemStatus: SystemStatus | null = null;
  errors: ErrorInfo[] = [];
  
  // Camera state
  cameraActive = false;
  cameraQuality: CameraQuality | null = null;
  
  // MediaPipe state
  mediaPipeInitialized = false;
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  // Display toggles
  showAdvancedMetrics = false;
  showErrorDetails = false;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.initializeMockData();
    this.subscribeToMockServices();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeMockData(): void {
    // Mock performance data
    this.performance = {
      status: 'good',
      cpuUsage: 45,
      memoryUsage: 320,
      frameRate: 30,
      processingLatency: 16,
      timestamp: Date.now()
    };

    // Mock system status
    this.systemStatus = {
      overall: 'ok',
      subsystems: {
        camera: 'ok',
        processing: 'ok',
        calibration: 'ok',
        tracking: 'ok'
      },
      timestamp: Date.now()
    };

    // Mock camera state
    this.cameraActive = true;
    this.cameraQuality = {
      resolution: '1920x1080',
      frameRate: 30,
      quality: 'good'
    };

    // Mock MediaPipe state
    this.mediaPipeInitialized = true;

    // Mock errors
    this.errors = [
      {
        id: 'err001',
        level: 'warning',
        message: 'Camera frame rate dropped below optimal threshold',
        source: 'VideoSource',
        timestamp: Date.now() - 30000,
        resolved: false
      },
      {
        id: 'err002',
        level: 'info',
        message: 'Calibration completed successfully',
        source: 'Calibration',
        timestamp: Date.now() - 60000,
        resolved: true
      }
    ];
  }

  private subscribeToMockServices(): void {
    // Simulate periodic updates every 1 second
    this.subscriptions.push(
      timer(0, 1000).subscribe(() => {
        this.updateMockPerformance();
      })
    );

    // Simulate periodic status updates every 5 seconds
    this.subscriptions.push(
      timer(0, 5000).subscribe(() => {
        this.updateMockSystemStatus();
      })
    );
  }

  private updateMockPerformance(): void {
    if (this.performance) {
      // Simulate fluctuating performance metrics
      this.performance.cpuUsage = Math.max(20, Math.min(80, this.performance.cpuUsage + (Math.random() - 0.5) * 10));
      this.performance.memoryUsage = Math.max(200, Math.min(500, this.performance.memoryUsage + (Math.random() - 0.5) * 20));
      this.performance.frameRate = Math.max(25, Math.min(30, this.performance.frameRate + (Math.random() - 0.5) * 2));
      this.performance.processingLatency = Math.max(10, Math.min(25, this.performance.processingLatency + (Math.random() - 0.5) * 3));
      this.performance.timestamp = Date.now();

      // Update status based on metrics
      if (this.performance.cpuUsage > 70 || this.performance.processingLatency > 20) {
        this.performance.status = 'poor';
      } else if (this.performance.cpuUsage > 50 || this.performance.processingLatency > 18) {
        this.performance.status = 'good';
      } else {
        this.performance.status = 'excellent';
      }
    }
  }

  private updateMockSystemStatus(): void {
    if (this.systemStatus) {
      this.systemStatus.timestamp = Date.now();
      
      // Simulate occasional status changes
      if (Math.random() < 0.1) {
        const statuses = ['ok', 'warning', 'error'];
        this.systemStatus.overall = statuses[Math.floor(Math.random() * statuses.length)] as any;
      }
    }
  }

  // Get status color class
  getStatusColorClass(status: string): string {
    switch (status) {
      case 'ok': return 'status-ok';
      case 'warning': return 'status-warning';
      case 'error': return 'status-error';
      case 'critical': return 'status-critical';
      default: return 'status-unknown';
    }
  }

  // Get performance level color
  getPerformanceLevelClass(): string {
    if (!this.performance) return 'status-unknown';
    
    switch (this.performance.status) {
      case 'excellent': return 'status-excellent';
      case 'good': return 'status-good';
      case 'poor': return 'status-poor';
      case 'critical': return 'status-critical';
      default: return 'status-unknown';
    }
  }

  // Get error count by level
  getErrorCountByLevel(level: string): number {
    return this.errors.filter(e => e.level === level).length;
  }

  // Get recent errors (last 5)
  getRecentErrors(): ErrorInfo[] {
    return this.errors
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }

  // Clear resolved errors
  clearResolvedErrors(): void {
    this.errors = this.errors.filter(e => !e.resolved);
    // TODO: Call backend API
    // this.http.post('/api/errors/clear-resolved', {}).subscribe();
  }

  // Clear all errors
  clearAllErrors(): void {
    this.errors = [];
    // TODO: Call backend API
    // this.http.post('/api/errors/clear-all', {}).subscribe();
  }

  // Toggle advanced metrics
  toggleAdvancedMetrics(): void {
    this.showAdvancedMetrics = !this.showAdvancedMetrics;
  }

  // Toggle error details
  toggleErrorDetails(): void {
    this.showErrorDetails = !this.showErrorDetails;
  }

  // Get system recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.performance) {
      if (this.performance.cpuUsage > 70) {
        recommendations.push('Consider closing other applications to reduce CPU usage');
      }
      if (this.performance.memoryUsage > 400) {
        recommendations.push('Memory usage is high - restart application if performance degrades');
      }
      if (this.performance.frameRate < 28) {
        recommendations.push('Frame rate is below optimal - check camera settings');
      }
      if (this.performance.processingLatency > 20) {
        recommendations.push('Processing latency is high - consider reducing video resolution');
      }
    }

    if (this.errors.length > 5) {
      recommendations.push('Multiple errors detected - review system status');
    }

    if (!this.cameraActive) {
      recommendations.push('Camera is not active - check camera permissions and connection');
    }

    return recommendations;
  }

  // Format timestamp
  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  // Get camera status text
  getCameraStatusText(): string {
    if (!this.cameraActive) return 'Camera Inactive';
    if (!this.cameraQuality) return 'Camera Active';
    
    return `Camera: ${this.cameraQuality.resolution} @ ${this.cameraQuality.frameRate}fps`;
  }

  // Get MediaPipe status text
  getMediaPipeStatusText(): string {
    return this.mediaPipeInitialized ? 'MediaPipe Ready' : 'MediaPipe Not Initialized';
  }

  // Load system status from backend (placeholder)
  private loadSystemStatus(): void {
    // TODO: Implement backend API call
    // this.http.get<SystemStatus>('/api/system/status').subscribe(status => {
    //   this.systemStatus = status;
    // });
  }

  // Load performance data from backend (placeholder)
  private loadPerformanceData(): void {
    // TODO: Implement backend API call
    // this.http.get<SystemPerformance>('/api/system/performance').subscribe(performance => {
    //   this.performance = performance;
    // });
  }

  // Load error log from backend (placeholder)
  private loadErrorLog(): void {
    // TODO: Implement backend API call
    // this.http.get<ErrorInfo[]>('/api/system/errors').subscribe(errors => {
    //   this.errors = errors.filter(e => !e.resolved);
    // });
  }
}
