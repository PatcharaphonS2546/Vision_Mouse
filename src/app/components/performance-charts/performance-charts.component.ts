import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, interval, takeUntil } from 'rxjs';

interface PerformanceData {
  timestamp: string;
  gazeAccuracy: number;
  frameRate: number;
  latency: number;
  aiConfidence: number;
}

@Component({
  selector: 'app-performance-charts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="performance-charts">
      <!-- Real-time Performance Metrics -->
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Real-time Performance</h3>
          <div class="chart-controls">
            <button class="control-btn" [class.active]="showGazeAccuracy" (click)="toggleMetric('gaze')">
              Gaze Accuracy
            </button>
            <button class="control-btn" [class.active]="showFrameRate" (click)="toggleMetric('fps')">
              Frame Rate
            </button>
            <button class="control-btn" [class.active]="showLatency" (click)="toggleMetric('latency')">
              Latency
            </button>
            <button class="control-btn" [class.active]="showAiConfidence" (click)="toggleMetric('ai')">
              AI Confidence
            </button>
          </div>
        </div>
        
        <div class="chart-content">
          <div class="mock-chart">
            <div class="chart-placeholder">
              <div class="chart-line" *ngIf="showGazeAccuracy" [style.height.%]="currentMetrics.gazeAccuracy * 100">
                <span class="metric-label">Gaze: {{ (currentMetrics.gazeAccuracy * 100) | number:'1.1-1' }}%</span>
              </div>
              <div class="chart-line" *ngIf="showFrameRate" [style.height.%]="(currentMetrics.frameRate / 60) * 100">
                <span class="metric-label">FPS: {{ currentMetrics.frameRate | number:'1.0-0' }}</span>
              </div>
              <div class="chart-line" *ngIf="showLatency" [style.height.%]="Math.max(0, 100 - currentMetrics.latency)">
                <span class="metric-label">Latency: {{ currentMetrics.latency | number:'1.0-0' }}ms</span>
              </div>
              <div class="chart-line" *ngIf="showAiConfidence" [style.height.%]="currentMetrics.aiConfidence * 100">
                <span class="metric-label">AI: {{ (currentMetrics.aiConfidence * 100) | number:'1.1-1' }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Accuracy Distribution -->
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Accuracy Distribution</h3>
          <span class="chart-subtitle">Last 100 samples</span>
        </div>
        
        <div class="chart-content">
          <div class="distribution-bars">
            <div *ngFor="let bucket of accuracyDistribution" class="bar-container">
              <div class="bar" [style.height.%]="bucket.percentage">
                <span class="bar-label">{{ bucket.count }}</span>
              </div>
              <span class="bar-range">{{ bucket.range }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Radar -->
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Performance Overview</h3>
          <span class="chart-subtitle">Multi-dimensional analysis</span>
        </div>
        
        <div class="chart-content">
          <div class="radar-chart">
            <div class="radar-metric" *ngFor="let metric of radarMetrics">
              <div class="metric-name">{{ metric.name }}</div>
              <div class="metric-bar">
                <div class="metric-fill" [style.width.%]="metric.value * 100"></div>
              </div>
              <div class="metric-value">{{ (metric.value * 100) | number:'1.0-0' }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Historical Data Table -->
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Historical Data</h3>
          <div class="chart-controls">
            <button class="control-btn" (click)="exportData()">Export CSV</button>
            <button class="control-btn" (click)="clearData()">Clear Data</button>
          </div>
        </div>
        
        <div class="chart-content">
          <div class="data-table">
            <div class="table-header">
              <span>Time</span>
              <span>Accuracy</span>
              <span>FPS</span>
              <span>Latency</span>
              <span>AI Confidence</span>
            </div>
            <div class="table-row" *ngFor="let data of recentData.slice(-10)">
              <span>{{ data.timestamp }}</span>
              <span>{{ (data.gazeAccuracy * 100) | number:'1.1-1' }}%</span>
              <span>{{ data.frameRate | number:'1.0-0' }}</span>
              <span>{{ data.latency | number:'1.0-0' }}ms</span>
              <span>{{ (data.aiConfidence * 100) | number:'1.1-1' }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .performance-charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      padding: 20px;
    }

    .chart-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }

    .chart-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .chart-subtitle {
      font-size: 12px;
      color: #666;
    }

    .chart-controls {
      display: flex;
      gap: 8px;
    }

    .control-btn {
      padding: 6px 12px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }

    .control-btn:hover {
      background: #f8f9fa;
    }

    .control-btn.active {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }

    .chart-content {
      padding: 20px;
      height: 250px;
    }

    .mock-chart {
      height: 100%;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      position: relative;
    }

    .chart-placeholder {
      height: 100%;
      display: flex;
      align-items: end;
      justify-content: space-around;
      padding: 10px;
    }

    .chart-line {
      width: 60px;
      background: linear-gradient(180deg, #007bff 0%, #28a745 50%, #ffc107 100%);
      border-radius: 4px 4px 0 0;
      position: relative;
      margin: 0 5px;
      transition: height 0.3s ease;
    }

    .metric-label {
      position: absolute;
      top: -25px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
    }

    .distribution-bars {
      display: flex;
      align-items: end;
      height: 100%;
      padding: 10px;
      gap: 5px;
    }

    .bar-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
    }

    .bar {
      width: 100%;
      background: #28a745;
      border-radius: 2px 2px 0 0;
      position: relative;
      display: flex;
      align-items: start;
      justify-content: center;
      padding-top: 5px;
    }

    .bar-label {
      font-size: 10px;
      font-weight: 600;
      color: white;
    }

    .bar-range {
      font-size: 10px;
      margin-top: 5px;
      color: #666;
    }

    .radar-chart {
      display: flex;
      flex-direction: column;
      gap: 15px;
      padding: 20px;
    }

    .radar-metric {
      display: grid;
      grid-template-columns: 120px 1fr 60px;
      gap: 15px;
      align-items: center;
    }

    .metric-name {
      font-size: 12px;
      font-weight: 500;
      color: #333;
    }

    .metric-bar {
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
    }

    .metric-fill {
      height: 100%;
      background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%);
      transition: width 0.3s ease;
    }

    .metric-value {
      font-size: 12px;
      font-weight: 600;
      text-align: right;
    }

    .data-table {
      font-size: 12px;
    }

    .table-header,
    .table-row {
      display: grid;
      grid-template-columns: 80px 80px 50px 60px 90px;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #e9ecef;
    }

    .table-header {
      font-weight: 600;
      background: #f8f9fa;
      padding: 10px 0;
    }

    .table-row:hover {
      background: #f8f9fa;
    }
  `]
})
export class PerformanceChartsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Chart visibility toggles
  showGazeAccuracy = true;
  showFrameRate = true;
  showLatency = false;
  showAiConfidence = false;

  // Current metrics
  currentMetrics: PerformanceData = {
    timestamp: new Date().toLocaleTimeString(),
    gazeAccuracy: 0.85,
    frameRate: 30,
    latency: 25,
    aiConfidence: 0.92
  };

  // Historical data
  recentData: PerformanceData[] = [];

  // Accuracy distribution
  accuracyDistribution = [
    { range: '90-100%', count: 45, percentage: 90 },
    { range: '80-89%', count: 32, percentage: 64 },
    { range: '70-79%', count: 18, percentage: 36 },
    { range: '60-69%', count: 5, percentage: 10 },
    { range: '< 60%', count: 0, percentage: 0 }
  ];

  // Radar metrics
  radarMetrics = [
    { name: 'Gaze Accuracy', value: 0.85 },
    { name: 'Eye Detection', value: 0.92 },
    { name: 'Face Tracking', value: 0.88 },
    { name: 'Calibration Quality', value: 0.91 },
    { name: 'System Performance', value: 0.87 },
    { name: 'Stability Index', value: 0.83 }
  ];

  constructor(private http: HttpClient) {}

  get Math() { return Math; }

  ngOnInit() {
    this.startDataCollection();
    this.generateInitialData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private startDataCollection() {
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateMetrics();
    });
  }

  private generateInitialData() {
    for (let i = 0; i < 50; i++) {
      this.recentData.push({
        timestamp: new Date(Date.now() - (50 - i) * 1000).toLocaleTimeString(),
        gazeAccuracy: 0.7 + Math.random() * 0.3,
        frameRate: 25 + Math.random() * 10,
        latency: 15 + Math.random() * 20,
        aiConfidence: 0.8 + Math.random() * 0.2
      });
    }
  }

  private updateMetrics() {
    this.currentMetrics = {
      timestamp: new Date().toLocaleTimeString(),
      gazeAccuracy: 0.7 + Math.random() * 0.3,
      frameRate: 25 + Math.random() * 10,
      latency: 15 + Math.random() * 20,
      aiConfidence: 0.8 + Math.random() * 0.2
    };

    this.recentData.push(this.currentMetrics);
    if (this.recentData.length > 100) {
      this.recentData.shift();
    }

    // Update radar metrics
    this.radarMetrics = [
      { name: 'Gaze Accuracy', value: this.currentMetrics.gazeAccuracy },
      { name: 'Eye Detection', value: 0.8 + Math.random() * 0.2 },
      { name: 'Face Tracking', value: 0.8 + Math.random() * 0.2 },
      { name: 'Calibration Quality', value: 0.85 + Math.random() * 0.15 },
      { name: 'System Performance', value: Math.max(0, 1 - this.currentMetrics.latency / 100) },
      { name: 'Stability Index', value: 0.75 + Math.random() * 0.25 }
    ];
  }

  toggleMetric(type: string) {
    switch (type) {
      case 'gaze':
        this.showGazeAccuracy = !this.showGazeAccuracy;
        break;
      case 'fps':
        this.showFrameRate = !this.showFrameRate;
        break;
      case 'latency':
        this.showLatency = !this.showLatency;
        break;
      case 'ai':
        this.showAiConfidence = !this.showAiConfidence;
        break;
    }
  }

  exportData() {
    const csvData = this.recentData.map(d => 
      `${d.timestamp},${d.gazeAccuracy},${d.frameRate},${d.latency},${d.aiConfidence}`
    ).join('\n');
    
    const header = 'Timestamp,Gaze Accuracy,Frame Rate,Latency,AI Confidence\n';
    const blob = new Blob([header + csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance_data_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  clearData() {
    this.recentData = [];
    console.log('Performance data cleared');
  }
}
