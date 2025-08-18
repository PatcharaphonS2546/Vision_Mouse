import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, timer } from 'rxjs';

// Mock interfaces for UI-only component
interface RealTimeMetrics {
  frameRate: number;
  averageLatency: number;
  droppedFrames: number;
  processingLoad: number;
  memoryUsage: number;
  queueLength: number;
  adaptiveQuality: number;
}

interface AdaptiveSettings {
  targetFPS: number;
  maxLatency: number;
  qualityThreshold: number;
  adaptiveQualityEnabled: boolean;
  frameSkippingEnabled: boolean;
  prioritizedProcessing: boolean;
}

interface ProcessingPipeline {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  lastExecutionTime: number;
  maxExecutionTime: number;
  skipFrames: number;
}

@Component({
  selector: 'app-real-time-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="real-time-monitor">
      <h3>Real-time Processing Monitor</h3>
      
      <!-- Control Panel -->
      <div class="control-panel">
        <h4>Controls</h4>
        <div class="controls-grid">
          <button 
            (click)="toggleProcessing()" 
            [class.active]="isProcessingActive"
            class="control-btn">
            {{ isProcessingActive ? 'Stop' : 'Start' }} Processing
          </button>
          
          <button (click)="clearBuffer()" class="control-btn">
            Clear Buffer
          </button>
          
          <button (click)="resetMetrics()" class="control-btn">
            Reset Metrics
          </button>
        </div>
      </div>

      <!-- Real-time Metrics -->
      <div class="metrics-panel">
        <h4>Performance Metrics</h4>
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Frame Rate</span>
            <span class="metric-value" [class.warning]="metrics.frameRate < settings.targetFPS * 0.8">
              {{ metrics.frameRate }} FPS
            </span>
            <div class="metric-target">Target: {{ settings.targetFPS }} FPS</div>
          </div>
          
          <div class="metric-card">
            <span class="metric-label">Average Latency</span>
            <span class="metric-value" [class.warning]="metrics.averageLatency > settings.maxLatency">
              {{ metrics.averageLatency }}ms
            </span>
            <div class="metric-target">Max: {{ settings.maxLatency }}ms</div>
          </div>
          
          <div class="metric-card">
            <span class="metric-label">Processing Load</span>
            <span class="metric-value" [class.warning]="metrics.processingLoad > 80">
              {{ metrics.processingLoad }}%
            </span>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="metrics.processingLoad"></div>
            </div>
          </div>
          
          <div class="metric-card">
            <span class="metric-label">Dropped Frames</span>
            <span class="metric-value" [class.warning]="metrics.droppedFrames > 10">
              {{ metrics.droppedFrames }}
            </span>
          </div>
          
          <div class="metric-card">
            <span class="metric-label">Queue Length</span>
            <span class="metric-value" [class.warning]="metrics.queueLength > 3">
              {{ metrics.queueLength }}
            </span>
          </div>
          
          <div class="metric-card">
            <span class="metric-label">Adaptive Quality</span>
            <span class="metric-value">{{ metrics.adaptiveQuality }}%</span>
            <div class="progress-bar">
              <div class="progress-fill quality" [style.width.%]="metrics.adaptiveQuality"></div>
            </div>
          </div>
          
          <div class="metric-card">
            <span class="metric-label">Memory Usage</span>
            <span class="metric-value" [class.warning]="metrics.memoryUsage > 80">
              {{ metrics.memoryUsage }}%
            </span>
            <div class="progress-bar">
              <div class="progress-fill memory" [style.width.%]="metrics.memoryUsage"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pipeline Status -->
      <div class="pipelines-panel">
        <h4>Processing Pipelines</h4>
        <div class="pipelines-list">
          <div 
            *ngFor="let pipeline of pipelines" 
            class="pipeline-item"
            [class.disabled]="!pipeline.enabled">
            
            <div class="pipeline-header">
              <span class="pipeline-name">{{ pipeline.name }}</span>
              <span class="pipeline-priority">Priority: {{ pipeline.priority }}</span>
              <div class="pipeline-controls">
                <input 
                  type="checkbox" 
                  [(ngModel)]="pipeline.enabled"
                  (change)="updatePipelineEnabled(pipeline.id, pipeline.enabled)">
                <label>Enabled</label>
              </div>
            </div>
            
            <div class="pipeline-stats">
              <span>Last Execution: {{ pipeline.lastExecutionTime.toFixed(2) }}ms</span>
              <span>Max Time: {{ pipeline.maxExecutionTime }}ms</span>
              <span>Skip Frames: {{ pipeline.skipFrames }}</span>
            </div>
            
            <div class="pipeline-timing">
              <div class="timing-bar">
                <div 
                  class="timing-fill"
                  [style.width.%]="getTimingPercentage(pipeline)"
                  [class.over-limit]="pipeline.lastExecutionTime > pipeline.maxExecutionTime">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Adaptive Settings -->
      <div class="settings-panel">
        <h4>Adaptive Settings</h4>
        <div class="settings-grid">
          <div class="setting-item">
            <label>Target FPS</label>
            <input 
              type="number" 
              [(ngModel)]="settings.targetFPS"
              (change)="updateSettings()"
              min="15" 
              max="60">
          </div>
          
          <div class="setting-item">
            <label>Max Latency (ms)</label>
            <input 
              type="number" 
              [(ngModel)]="settings.maxLatency"
              (change)="updateSettings()"
              min="10" 
              max="100">
          </div>
          
          <div class="setting-item">
            <label>Quality Threshold</label>
            <input 
              type="range" 
              [(ngModel)]="settings.qualityThreshold"
              (input)="updateSettings()"
              min="0" 
              max="1" 
              step="0.1">
            <span>{{ (settings.qualityThreshold * 100) | number:'1.0-0' }}%</span>
          </div>
          
          <div class="setting-item checkbox">
            <input 
              type="checkbox" 
              [(ngModel)]="settings.adaptiveQualityEnabled"
              (change)="updateSettings()">
            <label>Adaptive Quality</label>
          </div>
          
          <div class="setting-item checkbox">
            <input 
              type="checkbox" 
              [(ngModel)]="settings.frameSkippingEnabled"
              (change)="updateSettings()">
            <label>Frame Skipping</label>
          </div>
          
          <div class="setting-item checkbox">
            <input 
              type="checkbox" 
              [(ngModel)]="settings.prioritizedProcessing"
              (change)="updateSettings()">
            <label>Prioritized Processing</label>
          </div>
        </div>
      </div>

      <!-- Performance History Chart -->
      <div class="chart-panel">
        <h4>Performance History</h4>
        <div class="performance-chart">
          <svg width="100%" height="200" viewBox="0 0 400 200">
            <!-- Grid lines -->
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" stroke-width="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
            
            <!-- Frame rate line -->
            <polyline
              *ngIf="performanceHistory.length > 1"
              [attr.points]="getChartPoints('frameRate')"
              fill="none"
              stroke="#4CAF50"
              stroke-width="2"/>
            
            <!-- Latency line -->
            <polyline
              *ngIf="performanceHistory.length > 1"
              [attr.points]="getChartPoints('latency')"
              fill="none"
              stroke="#FF5722"
              stroke-width="2"/>
            
            <!-- Legend -->
            <text x="10" y="20" fill="#4CAF50" font-size="12">Frame Rate</text>
            <text x="10" y="35" fill="#FF5722" font-size="12">Latency</text>
          </svg>
        </div>
      </div>

      <!-- Debug Information -->
      <div class="debug-panel" *ngIf="showDebugInfo">
        <h4>Debug Information</h4>
        <div class="debug-info">
          <pre>{{ getDebugInfo() | json }}</pre>
        </div>
      </div>
      
      <button 
        (click)="showDebugInfo = !showDebugInfo" 
        class="debug-toggle">
        {{ showDebugInfo ? 'Hide' : 'Show' }} Debug Info
      </button>
    </div>
  `,
  styles: [`
    .real-time-monitor {
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .real-time-monitor h3 {
      margin: 0 0 20px 0;
      color: #333;
      border-bottom: 2px solid #007bff;
      padding-bottom: 10px;
    }

    .real-time-monitor h4 {
      margin: 0 0 15px 0;
      color: #555;
      font-size: 1.1em;
    }

    /* Control Panel */
    .control-panel {
      margin-bottom: 25px;
      padding: 15px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .controls-grid {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }

    .control-btn {
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s ease;
    }

    .control-btn:hover {
      background: #0056b3;
      transform: translateY(-1px);
    }

    .control-btn.active {
      background: #28a745;
    }

    /* Metrics Panel */
    .metrics-panel {
      margin-bottom: 25px;
      padding: 15px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .metric-card {
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
      border-left: 4px solid #007bff;
      transition: all 0.3s ease;
    }

    .metric-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    .metric-label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }

    .metric-value {
      display: block;
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin-bottom: 5px;
    }

    .metric-value.warning {
      color: #dc3545;
    }

    .metric-target {
      font-size: 11px;
      color: #999;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 5px;
    }

    .progress-fill {
      height: 100%;
      background: #007bff;
      transition: width 0.3s ease;
    }

    .progress-fill.quality {
      background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%);
    }

    .progress-fill.memory {
      background: linear-gradient(90deg, #28a745 0%, #ffc107 70%, #dc3545 100%);
    }

    /* Pipelines Panel */
    .pipelines-panel {
      margin-bottom: 25px;
      padding: 15px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .pipeline-item {
      padding: 15px;
      margin-bottom: 10px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #dee2e6;
      transition: all 0.3s ease;
    }

    .pipeline-item.disabled {
      opacity: 0.6;
      background: #f1f3f4;
    }

    .pipeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .pipeline-name {
      font-weight: bold;
      color: #333;
    }

    .pipeline-priority {
      font-size: 12px;
      color: #666;
      background: #e9ecef;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .pipeline-controls {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .pipeline-stats {
      display: flex;
      gap: 20px;
      font-size: 12px;
      color: #666;
      margin-bottom: 10px;
    }

    .timing-bar {
      width: 100%;
      height: 6px;
      background: #e9ecef;
      border-radius: 3px;
      overflow: hidden;
    }

    .timing-fill {
      height: 100%;
      background: #28a745;
      transition: width 0.3s ease;
    }

    .timing-fill.over-limit {
      background: #dc3545;
    }

    /* Settings Panel */
    .settings-panel {
      margin-bottom: 25px;
      padding: 15px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .setting-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .setting-item.checkbox {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }

    .setting-item label {
      font-size: 13px;
      color: #555;
      font-weight: 500;
    }

    .setting-item input[type="number"], 
    .setting-item input[type="range"] {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .setting-item input[type="checkbox"] {
      width: 18px;
      height: 18px;
    }

    /* Chart Panel */
    .chart-panel {
      margin-bottom: 25px;
      padding: 15px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .performance-chart {
      border: 1px solid #ddd;
      border-radius: 4px;
      overflow: hidden;
    }

    /* Debug Panel */
    .debug-panel {
      margin-bottom: 15px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #dee2e6;
    }

    .debug-info {
      max-height: 300px;
      overflow-y: auto;
      background: #2d3748;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }

    .debug-toggle {
      padding: 8px 16px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .debug-toggle:hover {
      background: #545b62;
    }
  `]
})
export class RealTimeMonitorComponent implements OnInit, OnDestroy {
  metrics: RealTimeMetrics = {
    frameRate: 0,
    averageLatency: 0,
    droppedFrames: 0,
    processingLoad: 0,
    memoryUsage: 0,
    queueLength: 0,
    adaptiveQuality: 100
  };

  settings: AdaptiveSettings = {
    targetFPS: 30,
    maxLatency: 33,
    qualityThreshold: 0.7,
    adaptiveQualityEnabled: true,
    frameSkippingEnabled: true,
    prioritizedProcessing: true
  };

  pipelines: ProcessingPipeline[] = [];
  isProcessingActive = false;
  showDebugInfo = false;
  
  performanceHistory: any[] = [];
  private subscriptions: Subscription[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.initializeMockData();
    this.initializeMonitoring();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeMockData(): void {
    // Initialize mock metrics
    this.metrics = {
      frameRate: 28,
      averageLatency: 18,
      droppedFrames: 2,
      processingLoad: 45,
      memoryUsage: 32,
      queueLength: 1,
      adaptiveQuality: 85
    };

    // Initialize mock pipelines
    this.pipelines = [
      {
        id: 'face-detection',
        name: 'Face Detection',
        enabled: true,
        priority: 1,
        lastExecutionTime: 8.5,
        maxExecutionTime: 16,
        skipFrames: 0
      },
      {
        id: 'eye-tracking',
        name: 'Eye Tracking',
        enabled: true,
        priority: 2,
        lastExecutionTime: 12.3,
        maxExecutionTime: 20,
        skipFrames: 1
      },
      {
        id: 'gaze-estimation',
        name: 'Gaze Estimation',
        enabled: true,
        priority: 3,
        lastExecutionTime: 6.1,
        maxExecutionTime: 15,
        skipFrames: 0
      },
      {
        id: 'head-pose',
        name: 'Head Pose Detection',
        enabled: false,
        priority: 4,
        lastExecutionTime: 22.1,
        maxExecutionTime: 25,
        skipFrames: 2
      }
    ];

    // Initialize performance history with some mock data
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      this.performanceHistory.push({
        timestamp: now - (20 - i) * 1000,
        frameRate: 25 + Math.random() * 10,
        latency: 15 + Math.random() * 10
      });
    }
  }

  private initializeMonitoring(): void {
    // Simulate real-time metrics updates
    this.subscriptions.push(
      timer(0, 1000).subscribe(() => {
        this.updateMockMetrics();
      })
    );

    // Simulate pipeline status updates
    this.subscriptions.push(
      timer(0, 500).subscribe(() => {
        this.updateMockPipelineStats();
      })
    );
  }

  private updateMockMetrics(): void {
    // Simulate fluctuating metrics
    this.metrics.frameRate = Math.max(20, Math.min(30, this.metrics.frameRate + (Math.random() - 0.5) * 4));
    this.metrics.averageLatency = Math.max(10, Math.min(30, this.metrics.averageLatency + (Math.random() - 0.5) * 3));
    this.metrics.processingLoad = Math.max(20, Math.min(90, this.metrics.processingLoad + (Math.random() - 0.5) * 10));
    this.metrics.memoryUsage = Math.max(20, Math.min(80, this.metrics.memoryUsage + (Math.random() - 0.5) * 5));
    this.metrics.queueLength = Math.max(0, Math.min(5, Math.round(this.metrics.queueLength + (Math.random() - 0.5) * 2)));
    
    // Occasionally drop a frame
    if (Math.random() < 0.1) {
      this.metrics.droppedFrames++;
    }

    // Update adaptive quality based on performance
    if (this.metrics.frameRate < this.settings.targetFPS * 0.8 || this.metrics.averageLatency > this.settings.maxLatency) {
      this.metrics.adaptiveQuality = Math.max(50, this.metrics.adaptiveQuality - 5);
    } else {
      this.metrics.adaptiveQuality = Math.min(100, this.metrics.adaptiveQuality + 2);
    }

    this.addToPerformanceHistory(this.metrics);
  }

  private updateMockPipelineStats(): void {
    this.pipelines.forEach(pipeline => {
      if (pipeline.enabled) {
        // Simulate execution time fluctuation
        const variance = pipeline.maxExecutionTime * 0.3;
        pipeline.lastExecutionTime = Math.max(1, pipeline.lastExecutionTime + (Math.random() - 0.5) * variance);
        
        // Occasionally skip frames if performance is poor
        if (this.metrics.processingLoad > 70) {
          pipeline.skipFrames = Math.min(pipeline.skipFrames + 1, 3);
        } else {
          pipeline.skipFrames = Math.max(0, pipeline.skipFrames - 1);
        }
      }
    });
  }

  private addToPerformanceHistory(metrics: RealTimeMetrics): void {
    this.performanceHistory.push({
      timestamp: Date.now(),
      frameRate: metrics.frameRate,
      latency: metrics.averageLatency
    });

    // Keep only last 50 data points
    if (this.performanceHistory.length > 50) {
      this.performanceHistory.shift();
    }
  }

  toggleProcessing(): void {
    this.isProcessingActive = !this.isProcessingActive;
    
    if (this.isProcessingActive) {
      // Simulate processing startup
      this.metrics.frameRate = this.settings.targetFPS;
      this.metrics.processingLoad = 60;
    } else {
      // Simulate processing stop
      this.metrics.frameRate = 0;
      this.metrics.processingLoad = 10;
    }

    // TODO: Call backend API
    // this.http.post('/api/processing/toggle', { active: this.isProcessingActive }).subscribe();
  }

  clearBuffer(): void {
    this.metrics.queueLength = 0;
    this.metrics.droppedFrames = 0;
    
    // TODO: Call backend API
    // this.http.post('/api/processing/clear-buffer', {}).subscribe();
  }

  resetMetrics(): void {
    this.performanceHistory = [];
    this.metrics.droppedFrames = 0;
    
    // TODO: Call backend API
    // this.http.post('/api/processing/reset-metrics', {}).subscribe();
  }

  updateSettings(): void {
    // Apply settings changes immediately for UI feedback
    console.log('Settings updated:', this.settings);
    
    // TODO: Call backend API
    // this.http.put('/api/processing/settings', this.settings).subscribe();
  }

  updatePipelineEnabled(pipelineId: string, enabled: boolean): void {
    const pipeline = this.pipelines.find(p => p.id === pipelineId);
    if (pipeline) {
      pipeline.enabled = enabled;
      
      // TODO: Call backend API
      // this.http.put(`/api/processing/pipeline/${pipelineId}`, { enabled }).subscribe();
    }
  }

  getTimingPercentage(pipeline: ProcessingPipeline): number {
    return Math.min(100, (pipeline.lastExecutionTime / pipeline.maxExecutionTime) * 100);
  }

  getChartPoints(metric: 'frameRate' | 'latency'): string {
    if (this.performanceHistory.length < 2) return '';

    const width = 400;
    const height = 200;
    const maxPoints = 50;
    
    const data = this.performanceHistory.slice(-maxPoints);
    const xStep = width / (data.length - 1);
    
    let maxValue = 0;
    data.forEach(point => {
      maxValue = Math.max(maxValue, point[metric]);
    });
    
    const points = data.map((point, index) => {
      const x = index * xStep;
      const y = height - (point[metric] / maxValue) * height;
      return `${x},${y}`;
    });
    
    return points.join(' ');
  }

  getDebugInfo(): any {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      settings: this.settings,
      pipelinesStatus: this.pipelines.map(p => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        lastExecutionTime: p.lastExecutionTime
      })),
      isProcessingActive: this.isProcessingActive,
      performanceHistoryLength: this.performanceHistory.length,
      enabledPipelines: this.pipelines.filter(p => p.enabled).length
    };
  }

  // Load real-time settings from backend (placeholder)
  private loadSettings(): void {
    // TODO: Implement backend API call
    // this.http.get<AdaptiveSettings>('/api/processing/settings').subscribe(settings => {
    //   this.settings = settings;
    // });
  }

  // Load pipeline configuration from backend (placeholder)
  private loadPipelineConfig(): void {
    // TODO: Implement backend API call
    // this.http.get<ProcessingPipeline[]>('/api/processing/pipelines').subscribe(pipelines => {
    //   this.pipelines = pipelines;
    // });
  }

  // Save current configuration to backend (placeholder)
  private saveConfiguration(): void {
    // TODO: Implement backend API call
    // const config = {
    //   settings: this.settings,
    //   pipelines: this.pipelines.map(p => ({ id: p.id, enabled: p.enabled }))
    // };
    // this.http.post('/api/processing/save-config', config).subscribe();
  }
}
