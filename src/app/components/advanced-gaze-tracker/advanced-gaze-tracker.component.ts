import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, combineLatest, interval } from 'rxjs';
import { takeUntil, startWith } from 'rxjs/operators';

// Import all services
import { SystemIntegrationService, SystemState } from '../../services/system-integration.service';
import { OptimizationManagerService, OptimizationState, PerformanceMetrics } from '../../services/optimization-manager.service';
import { RealTimeAnalyticsService, AnalyticsMetrics, RealTimeStats } from '../../services/real-time-analytics.service';
import { CalibrationService } from '../../services/calibration.service';
import { ErrorHandlerService, ErrorInfo } from '../../services/error-handler.service';

type ProcessingMode = 'performance' | 'balanced' | 'quality' | 'adaptive';

interface SystemStatus {
  isRunning: boolean;
  mode: ProcessingMode;
  health: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  performance: {
    fps: number;
    latency: number;
    accuracy: number;
    stability: number;
  };
  optimization: {
    level: number;
    status: string;
    recommendations: string[];
  };
  analytics: {
    sessionDuration: number;
    totalGazePoints: number;
    errorRate: number;
    successRate: number;
  };
}

interface GazeVisualization {
  currentGaze: { x: number; y: number };
  gazeTrail: Array<{ x: number; y: number; timestamp: number; opacity: number }>;
  heatMapVisible: boolean;
  fixationPoints: Array<{ x: number; y: number; duration: number }>;
}

@Component({
  selector: 'app-advanced-gaze-tracker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="advanced-gaze-tracker">
      <!-- Header Controls -->
      <div class="tracker-header">
        <div class="system-controls">
          <button 
            class="control-btn start-btn"
            [class.active]="systemStatus.isRunning"
            (click)="toggleSystem()"
            [disabled]="isCalibrating">
            {{ systemStatus.isRunning ? 'Stop Tracking' : 'Start Tracking' }}
          </button>
          
          <button 
            class="control-btn calibrate-btn"
            (click)="startCalibration()"
            [disabled]="systemStatus.isRunning">
            Calibrate
          </button>
          
          <div class="mode-selector">
            <label for="mode-select">Mode:</label>
            <select 
              id="mode-select" 
              [value]="systemStatus.mode" 
              (change)="changeMode($event)"
              [disabled]="systemStatus.isRunning">
              <option value="performance">Performance</option>
              <option value="balanced">Balanced</option>
              <option value="quality">Quality</option>
              <option value="adaptive">Adaptive</option>
            </select>
          </div>
        </div>

        <div class="system-status">
          <div class="status-indicator" [class]="'status-' + systemStatus.health">
            <span class="status-dot"></span>
            <span class="status-text">{{ getStatusText() }}</span>
          </div>
          
          <div class="quick-metrics">
            <div class="metric">
              <span class="metric-label">FPS:</span>
              <span class="metric-value">{{ systemStatus.performance.fps.toFixed(1) }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Accuracy:</span>
              <span class="metric-value">{{ systemStatus.performance.accuracy.toFixed(0) }}%</span>
            </div>
            <div class="metric">
              <span class="metric-label">Latency:</span>
              <span class="metric-value">{{ systemStatus.performance.latency.toFixed(0) }}ms</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="tracker-content">
        <!-- Video and Gaze Display -->
        <div class="video-section">
          <div class="video-container">
            <video 
              #videoElement 
              class="video-feed"
              autoplay 
              muted>
            </video>
            
            <!-- Gaze Overlay -->
            <div class="gaze-overlay" #gazeOverlay>
              <!-- Current gaze point -->
              <div 
                class="gaze-cursor"
                [style.left.px]="gazeVisualization.currentGaze.x"
                [style.top.px]="gazeVisualization.currentGaze.y"
                [class.active]="systemStatus.isRunning">
              </div>
              
              <!-- Gaze trail -->
              <div 
                *ngFor="let point of gazeVisualization.gazeTrail" 
                class="gaze-trail-point"
                [style.left.px]="point.x"
                [style.top.px]="point.y"
                [style.opacity]="point.opacity">
              </div>
              
              <!-- Fixation points -->
              <div 
                *ngFor="let fixation of gazeVisualization.fixationPoints" 
                class="fixation-point"
                [style.left.px]="fixation.x"
                [style.top.px]="fixation.y"
                [style.width.px]="Math.min(50, fixation.duration / 10)"
                [style.height.px]="Math.min(50, fixation.duration / 10)">
              </div>
              
              <!-- Heat map canvas -->
              <canvas 
                #heatMapCanvas 
                class="heat-map-canvas"
                [class.visible]="gazeVisualization.heatMapVisible">
              </canvas>
            </div>
            
            <!-- Calibration overlay -->
            <div class="calibration-overlay" *ngIf="isCalibrating">
              <div class="calibration-point" 
                   [style.left.px]="calibrationPoint.x" 
                   [style.top.px]="calibrationPoint.y">
                <div class="point-circle"></div>
                <div class="point-instruction">Look at this point</div>
              </div>
            </div>
          </div>
          
          <!-- Video Controls -->
          <div class="video-controls">
            <button class="control-btn" (click)="toggleHeatMap()">
              {{ gazeVisualization.heatMapVisible ? 'Hide Heat Map' : 'Show Heat Map' }}
            </button>
            <button class="control-btn" (click)="clearGazeData()">
              Clear Gaze Data
            </button>
            <button class="control-btn" (click)="exportData()">
              Export Data
            </button>
          </div>
        </div>

        <!-- Analytics Dashboard -->
        <div class="analytics-section">
          <!-- Real-time Metrics -->
          <div class="metrics-panel">
            <h3>Real-time Metrics</h3>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-title">Performance</div>
                <div class="metric-main">{{ systemStatus.performance.fps.toFixed(1) }} FPS</div>
                <div class="metric-sub">{{ systemStatus.performance.latency.toFixed(0) }}ms latency</div>
              </div>
              
              <div class="metric-card">
                <div class="metric-title">Quality</div>
                <div class="metric-main">{{ systemStatus.performance.accuracy.toFixed(0) }}%</div>
                <div class="metric-sub">{{ systemStatus.performance.stability.toFixed(0) }}% stable</div>
              </div>
              
              <div class="metric-card">
                <div class="metric-title">Session</div>
                <div class="metric-main">{{ formatDuration(systemStatus.analytics.sessionDuration) }}</div>
                <div class="metric-sub">{{ systemStatus.analytics.totalGazePoints }} points</div>
              </div>
              
              <div class="metric-card">
                <div class="metric-title">Success Rate</div>
                <div class="metric-main">{{ systemStatus.analytics.successRate.toFixed(1) }}%</div>
                <div class="metric-sub">{{ systemStatus.analytics.errorRate.toFixed(2) }}% errors</div>
              </div>
            </div>
          </div>

          <!-- Optimization Status -->
          <div class="optimization-panel">
            <h3>System Optimization</h3>
            <div class="optimization-status">
              <div class="optimization-level">
                <label>Optimization Level:</label>
                <div class="level-bar">
                  <div class="level-fill" [style.width.%]="systemStatus.optimization.level"></div>
                  <span class="level-text">{{ systemStatus.optimization.level }}%</span>
                </div>
              </div>
              
              <div class="optimization-info">
                <div class="status-text">{{ systemStatus.optimization.status }}</div>
                <div class="recommendations" *ngIf="systemStatus.optimization.recommendations.length > 0">
                  <strong>Recommendations:</strong>
                  <ul>
                    <li *ngFor="let rec of systemStatus.optimization.recommendations">{{ rec }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- System Health -->
          <div class="health-panel">
            <h3>System Health</h3>
            <div class="health-indicators">
              <div class="health-indicator" [class]="'health-' + systemStatus.health">
                <div class="indicator-icon"></div>
                <div class="indicator-text">
                  <div class="indicator-title">{{ getHealthTitle() }}</div>
                  <div class="indicator-desc">{{ getHealthDescription() }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Debug Panel (collapsible) -->
      <div class="debug-section" [class.collapsed]="debugCollapsed">
        <div class="debug-header" (click)="debugCollapsed = !debugCollapsed">
          <h3>Debug Information</h3>
          <span class="collapse-icon">{{ debugCollapsed ? '▼' : '▲' }}</span>
        </div>
        
        <div class="debug-content" *ngIf="!debugCollapsed">
          <div class="debug-tabs">
            <button 
              *ngFor="let tab of debugTabs" 
              class="debug-tab"
              [class.active]="activeDebugTab === tab.id"
              (click)="activeDebugTab = tab.id">
              {{ tab.label }}
            </button>
          </div>
          
          <div class="debug-panel-content">
            <div *ngIf="activeDebugTab === 'system'" class="debug-data">
              <pre>{{ debugData.system | json }}</pre>
            </div>
            <div *ngIf="activeDebugTab === 'performance'" class="debug-data">
              <pre>{{ debugData.performance | json }}</pre>
            </div>
            <div *ngIf="activeDebugTab === 'analytics'" class="debug-data">
              <pre>{{ debugData.analytics | json }}</pre>
            </div>
            <div *ngIf="activeDebugTab === 'errors'" class="debug-data">
              <div *ngFor="let error of debugData.errors" class="error-entry">
                <span class="error-time">{{ formatTime(error.timestamp) }}</span>
                <span class="error-type">{{ error.level }}</span>
                <span class="error-message">{{ error.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./advanced-gaze-tracker.component.css']
})
export class AdvancedGazeTrackerComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('gazeOverlay') gazeOverlay!: ElementRef<HTMLDivElement>;
  @ViewChild('heatMapCanvas') heatMapCanvas!: ElementRef<HTMLCanvasElement>;

  private destroy$ = new Subject<void>();

  // Component state
  systemStatus: SystemStatus = {
    isRunning: false,
    mode: 'balanced',
    health: 'good',
    performance: {
      fps: 0,
      latency: 0,
      accuracy: 0,
      stability: 0
    },
    optimization: {
      level: 50,
      status: 'Ready',
      recommendations: []
    },
    analytics: {
      sessionDuration: 0,
      totalGazePoints: 0,
      errorRate: 0,
      successRate: 0
    }
  };

  gazeVisualization: GazeVisualization = {
    currentGaze: { x: 0, y: 0 },
    gazeTrail: [],
    heatMapVisible: false,
    fixationPoints: []
  };

  // Calibration state
  isCalibrating = false;
  calibrationPoint = { x: 0, y: 0 };

  // Debug state
  debugCollapsed = true;
  activeDebugTab = 'system';
  debugTabs = [
    { id: 'system', label: 'System' },
    { id: 'performance', label: 'Performance' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'errors', label: 'Errors' }
  ];

  debugData: {
    system: any;
    performance: any;
    analytics: any;
    errors: ErrorInfo[];
  } = {
    system: {},
    performance: {},
    analytics: {},
    errors: []
  };

  // Template helper
  Math = Math;

  constructor(
    private systemIntegration: SystemIntegrationService,
    private optimizationManager: OptimizationManagerService,
    private realTimeAnalytics: RealTimeAnalyticsService,
    private calibrationService: CalibrationService,
    private errorHandler: ErrorHandlerService
  ) {}

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.initializeErrorHandling();
  }

  ngAfterViewInit(): void {
    this.initializeCanvas();
    this.setupVideoElement();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.systemIntegration.stopSystem();
  }

  // Public methods
  async toggleSystem(): Promise<void> {
    try {
      if (this.systemStatus.isRunning) {
        await this.stopSystem();
      } else {
        await this.startSystem();
      }
    } catch (error) {
      console.error('System toggle error:', error);
    }
  }

  async startCalibration(): Promise<void> {
    try {
      this.isCalibrating = true;
      
      // Simple calibration simulation
      const points = [
        { x: 100, y: 100 },
        { x: 500, y: 100 },
        { x: 900, y: 100 },
        { x: 100, y: 300 },
        { x: 500, y: 300 },
        { x: 900, y: 300 },
        { x: 100, y: 500 },
        { x: 500, y: 500 },
        { x: 900, y: 500 }
      ];
      
      for (let i = 0; i < points.length; i++) {
        this.calibrationPoint = points[i];
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      this.isCalibrating = false;
      console.log('Calibration completed');
    } catch (error) {
      this.isCalibrating = false;
      console.error('Calibration error:', error);
    }
  }

  changeMode(event: any): void {
    const mode = event.target.value as ProcessingMode;
    console.log('Mode changed to:', mode);
    // Store mode change for future use
    this.systemStatus.mode = mode;
  }

  toggleHeatMap(): void {
    this.gazeVisualization.heatMapVisible = !this.gazeVisualization.heatMapVisible;
    this.updateHeatMapVisibility();
  }

  clearGazeData(): void {
    this.realTimeAnalytics.clearData();
    this.gazeVisualization.gazeTrail = [];
    this.gazeVisualization.fixationPoints = [];
    this.clearHeatMap();
  }

  exportData(): void {
    try {
      const data = this.realTimeAnalytics.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `gaze-data-${new Date().toISOString()}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    }
  }

  // Status and formatting methods
  getStatusText(): string {
    switch (this.systemStatus.health) {
      case 'excellent': return 'Excellent';
      case 'good': return 'Good';
      case 'fair': return 'Fair';
      case 'poor': return 'Poor';
      case 'critical': return 'Critical';
      default: return 'Unknown';
    }
  }

  getHealthTitle(): string {
    switch (this.systemStatus.health) {
      case 'excellent': return 'System Running Perfectly';
      case 'good': return 'System Running Well';
      case 'fair': return 'System Running Adequately';
      case 'poor': return 'System Performance Issues';
      case 'critical': return 'Critical System Issues';
      default: return 'System Status Unknown';
    }
  }

  getHealthDescription(): string {
    switch (this.systemStatus.health) {
      case 'excellent': return 'All systems operating at optimal performance';
      case 'good': return 'Minor optimizations may improve performance';
      case 'fair': return 'Some performance issues detected';
      case 'poor': return 'Significant performance degradation';
      case 'critical': return 'Immediate attention required';
      default: return 'Unable to determine system health';
    }
  }

  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
  }

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  // Private implementation methods
  private async startSystem(): Promise<void> {
    // Simulate starting camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera start error:', error);
    }

    // Start all services
    this.systemIntegration.startSystem();
    this.optimizationManager.startOptimization();
    this.realTimeAnalytics.startAnalytics();

    this.systemStatus.isRunning = true;
  }

  private async stopSystem(): Promise<void> {
    this.systemIntegration.stopSystem();
    this.optimizationManager.stopOptimization();
    this.realTimeAnalytics.stopAnalytics();

    // Stop video stream
    if (this.videoElement?.nativeElement?.srcObject) {
      const stream = this.videoElement.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.videoElement.nativeElement.srcObject = null;
    }

    this.systemStatus.isRunning = false;
  }

  private initializeSubscriptions(): void {
    // System state subscription
    this.systemIntegration.systemState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: any) => {
        this.updateSystemStatus(state);
        this.debugData.system = state;
      });

    // Optimization state subscription
    this.optimizationManager.optimizationState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((optimizationState: any) => {
        this.updateOptimizationStatus(optimizationState);
      });

    // Performance metrics subscription
    this.optimizationManager.performanceMetrics$
      .pipe(takeUntil(this.destroy$))
      .subscribe((metrics: any) => {
        this.updatePerformanceMetrics(metrics);
        this.debugData.performance = metrics;
      });

    // Analytics subscription
    this.realTimeAnalytics.combinedAnalytics$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ metrics, stats }: any) => {
        this.updateAnalyticsData(metrics, stats);
        this.debugData.analytics = { metrics, stats };
      });

    // Simulate gaze data for demo
    interval(100).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.systemStatus.isRunning) {
        const mockGazeData = {
          screenGaze: {
            x: Math.random() * 800,
            y: Math.random() * 600
          },
          confidence: Math.random() * 0.5 + 0.5,
          quality: Math.random() * 30 + 70,
          stability: Math.random() * 20 + 80,
          accuracy: Math.random() * 20 + 80,
          processingTime: Math.random() * 20 + 10,
          frameRate: Math.random() * 5 + 15
        };
        this.updateGazeVisualization(mockGazeData);
      }
    });
  }

  private initializeErrorHandling(): void {
    // Basic error handling setup
    console.log('Error handling initialized');
  }

  private initializeCanvas(): void {
    if (this.heatMapCanvas?.nativeElement) {
      const canvas = this.heatMapCanvas.nativeElement;
      const rect = this.gazeOverlay.nativeElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }

  private setupVideoElement(): void {
    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.addEventListener('loadedmetadata', () => {
        // Video is ready, update canvas size if needed
        this.initializeCanvas();
      });
    }
  }

  private updateSystemStatus(state: any): void {
    // Map state properties safely
    this.systemStatus.mode = state.currentMode || this.systemStatus.mode;
    this.systemStatus.health = this.mapHealthStatus(state.systemHealth || 75);
  }

  private updateOptimizationStatus(optimizationState: OptimizationState): void {
    this.systemStatus.optimization = {
      level: optimizationState.optimizationLevel,
      status: optimizationState.performanceStatus,
      recommendations: optimizationState.recommendations
    };
  }

  private updatePerformanceMetrics(metrics: PerformanceMetrics): void {
    this.systemStatus.performance = {
      fps: metrics.currentFPS,
      latency: metrics.currentLatency,
      accuracy: metrics.predictionAccuracy,
      stability: metrics.trackingStability
    };
  }

  private updateAnalyticsData(metrics: AnalyticsMetrics, stats: RealTimeStats): void {
    this.systemStatus.analytics = {
      sessionDuration: metrics.sessionDuration,
      totalGazePoints: metrics.totalGazePoints,
      errorRate: metrics.systemHealth.errorRate,
      successRate: stats.session.successRate
    };
  }

  private updateGazeVisualization(gazeData: any): void {
    if (!gazeData || !gazeData.screenGaze) return;

    const now = Date.now();
    const point = {
      x: gazeData.screenGaze.x,
      y: gazeData.screenGaze.y,
      timestamp: now,
      opacity: 1
    };

    // Update current gaze
    this.gazeVisualization.currentGaze = { x: point.x, y: point.y };

    // Add to trail
    this.gazeVisualization.gazeTrail.push(point);

    // Update trail opacity
    this.gazeVisualization.gazeTrail.forEach(trailPoint => {
      const age = now - trailPoint.timestamp;
      trailPoint.opacity = Math.max(0, 1 - (age / 2000)); // Fade over 2 seconds
    });

    // Remove old trail points
    this.gazeVisualization.gazeTrail = this.gazeVisualization.gazeTrail.filter(
      trailPoint => trailPoint.opacity > 0
    );

    // Update heat map
    if (this.gazeVisualization.heatMapVisible) {
      this.updateHeatMapPoint(point.x, point.y, gazeData.confidence || 1);
    }

    // Record analytics data
    this.realTimeAnalytics.recordGazeData({
      gazePoint: { x: point.x, y: point.y },
      confidence: gazeData.confidence || 0,
      timestamp: now,
      trackingQuality: gazeData.quality || 0,
      stabilityScore: gazeData.stability || 0,
      accuracyScore: gazeData.accuracy || 0,
      processingTime: gazeData.processingTime || 0,
      frameRate: gazeData.frameRate || 0
    });
  }

  private updateHeatMapPoint(x: number, y: number, intensity: number): void {
    if (!this.heatMapCanvas?.nativeElement) return;

    const canvas = this.heatMapCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create radial gradient for heat point
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 30);
    gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity * 0.5})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 0, ${intensity * 0.3})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x - 30, y - 30, 60, 60);
  }

  private updateHeatMapVisibility(): void {
    if (this.heatMapCanvas?.nativeElement) {
      this.heatMapCanvas.nativeElement.style.display = 
        this.gazeVisualization.heatMapVisible ? 'block' : 'none';
    }
  }

  private clearHeatMap(): void {
    if (this.heatMapCanvas?.nativeElement) {
      const canvas = this.heatMapCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  private mapHealthStatus(systemHealth: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (systemHealth >= 90) return 'excellent';
    if (systemHealth >= 75) return 'good';
    if (systemHealth >= 60) return 'fair';
    if (systemHealth >= 40) return 'poor';
    return 'critical';
  }
}
