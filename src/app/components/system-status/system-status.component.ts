import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { PerformanceService, SystemPerformance } from '../../services/performance.service';
import { ErrorHandlerService, SystemStatus, ErrorInfo } from '../../services/error-handler.service';
import { VideoSourceService } from '../../services/video-source.service';
import { MediapipeService } from '../../services/mediapipe.service';

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
  cameraQuality: any = null;
  
  // MediaPipe state
  mediaPipeInitialized = false;
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  // Display toggles
  showAdvancedMetrics = false;
  showErrorDetails = false;

  constructor(
    private performanceService: PerformanceService,
    private errorHandler: ErrorHandlerService,
    private videoSourceService: VideoSourceService,
    private mediaPipeService: MediapipeService
  ) { }

  ngOnInit(): void {
    this.subscribeToServices();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private subscribeToServices(): void {
    // Performance monitoring
    this.subscriptions.push(
      this.performanceService.systemPerformance.subscribe(performance => {
        this.performance = performance;
      })
    );

    // System status monitoring
    this.subscriptions.push(
      this.errorHandler.systemStatus.subscribe(status => {
        this.systemStatus = status;
      })
    );

    // Error monitoring
    this.subscriptions.push(
      this.errorHandler.errors.subscribe(errors => {
        this.errors = errors.filter(e => !e.resolved);
      })
    );

    // Camera monitoring
    this.subscriptions.push(
      this.videoSourceService.streamStatus.subscribe(active => {
        this.cameraActive = active;
      })
    );

    this.subscriptions.push(
      this.videoSourceService.cameraQuality.subscribe(quality => {
        this.cameraQuality = quality;
      })
    );

    // MediaPipe monitoring
    this.mediaPipeInitialized = this.mediaPipeService.initialized;
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
    this.errorHandler.clearResolvedErrors();
  }

  // Clear all errors
  clearAllErrors(): void {
    this.errorHandler.clearAllErrors();
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
    const performanceRecommendations = this.performanceService.getPerformanceRecommendations();
    const troubleshootingSuggestions = this.errorHandler.getTroubleshootingSuggestions();
    
    return [...performanceRecommendations, ...troubleshootingSuggestions];
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
}
