import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Mock interfaces for UI-only component
interface AdvancedPerformanceMetrics {
  currentFPS: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  currentLatency: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  memoryUsage: number;
  memoryPeak: number;
  cpuUsage: number;
  gpuUsage: number;
  processingQuality: number;
  adaptiveQualityLevel: number;
  frameDropRate: number;
  errorRate: number;
  thermalState: string;
  batteryImpact: string;
  networkLatency: number;
  overallScore: number;
  timestamp: number;
}

interface PoolStatistics {
  totalObjects: number;
  availableObjects: number;
  memoryUsageMB: number;
  hitRate: number;
  peakUsage: number;
}

interface OptimizationAction {
  type: string;
  action: string;
  appliedAt: number;
  impact: string;
  expectedGain: string;
}

@Component({
  selector: 'app-performance-dashboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="performance-dashboard">
      <div class="dashboard-header">
        <h2>🚀 Production Performance Monitor</h2>
        <div class="overall-score" [class.excellent]="metrics.overallScore >= 90" 
             [class.good]="metrics.overallScore >= 70 && metrics.overallScore < 90"
             [class.fair]="metrics.overallScore >= 50 && metrics.overallScore < 70"
             [class.poor]="metrics.overallScore < 50">
          Score: {{metrics.overallScore}}
        </div>
      </div>

      <!-- Real-time Metrics Grid -->
      <div class="metrics-grid">
        <!-- FPS Metrics -->
        <div class="metric-card fps-card">
          <div class="metric-header">
            <span class="metric-icon">📊</span>
            <h3>Frame Rate</h3>
          </div>
          <div class="metric-values">
            <div class="primary-value">{{metrics.currentFPS | number:'1.1-1'}} FPS</div>
            <div class="secondary-values">
              <span>Avg: {{metrics.averageFPS | number:'1.1-1'}}</span>
              <span>Min: {{metrics.minFPS | number:'1.1-1'}}</span>
              <span>Max: {{metrics.maxFPS | number:'1.1-1'}}</span>
            </div>
          </div>
          <div class="metric-bar">
            <div class="progress-bar" [style.width.%]="(metrics.currentFPS / 60) * 100"
                 [class.excellent]="metrics.currentFPS >= 30"
                 [class.good]="metrics.currentFPS >= 20 && metrics.currentFPS < 30"
                 [class.poor]="metrics.currentFPS < 20"></div>
          </div>
        </div>

        <!-- Latency Metrics -->
        <div class="metric-card latency-card">
          <div class="metric-header">
            <span class="metric-icon">⚡</span>
            <h3>Latency</h3>
          </div>
          <div class="metric-values">
            <div class="primary-value">{{metrics.currentLatency | number:'1.1-1'}}ms</div>
            <div class="secondary-values">
              <span>Avg: {{metrics.averageLatency | number:'1.1-1'}}ms</span>
              <span>P95: {{metrics.p95Latency | number:'1.1-1'}}ms</span>
              <span>P99: {{metrics.p99Latency | number:'1.1-1'}}ms</span>
            </div>
          </div>
          <div class="metric-bar">
            <div class="progress-bar" [style.width.%]="getLatencyBarWidth(metrics.currentLatency)"
                 [class.excellent]="metrics.currentLatency <= 20"
                 [class.good]="metrics.currentLatency <= 33 && metrics.currentLatency > 20"
                 [class.poor]="metrics.currentLatency > 33"></div>
          </div>
        </div>

        <!-- Memory Metrics -->
        <div class="metric-card memory-card">
          <div class="metric-header">
            <span class="metric-icon">💾</span>
            <h3>Memory Usage</h3>
          </div>
          <div class="metric-values">
            <div class="primary-value">{{metrics.memoryUsage | number:'1.0-0'}}MB</div>
            <div class="secondary-values">
              <span>Peak: {{metrics.memoryPeak | number:'1.0-0'}}MB</span>
              <span>Pools: {{totalPoolMemory | number:'1.1-1'}}MB</span>
            </div>
          </div>
          <div class="metric-bar">
            <div class="progress-bar" [style.width.%]="(metrics.memoryUsage / 500) * 100"
                 [class.excellent]="metrics.memoryUsage <= 150"
                 [class.good]="metrics.memoryUsage <= 250 && metrics.memoryUsage > 150"
                 [class.poor]="metrics.memoryUsage > 250"></div>
          </div>
        </div>

        <!-- CPU Usage -->
        <div class="metric-card cpu-card">
          <div class="metric-header">
            <span class="metric-icon">🔥</span>
            <h3>CPU Usage</h3>
          </div>
          <div class="metric-values">
            <div class="primary-value">{{metrics.cpuUsage | number:'1.0-0'}}%</div>
            <div class="secondary-values">
              <span>Quality: {{metrics.processingQuality | number:'1.0-0'}}%</span>
              <span>Thermal: {{metrics.thermalState}}</span>
            </div>
          </div>
          <div class="metric-bar">
            <div class="progress-bar" [style.width.%]="metrics.cpuUsage"
                 [class.excellent]="metrics.cpuUsage <= 30"
                 [class.good]="metrics.cpuUsage <= 50 && metrics.cpuUsage > 30"
                 [class.poor]="metrics.cpuUsage > 50"></div>
          </div>
        </div>
      </div>

      <!-- Performance Charts -->
      <div class="charts-section">
        <div class="chart-container">
          <h3>📈 Performance Trends (Last 60s)</h3>
          <div class="chart-area">
            <svg width="100%" height="200" viewBox="0 0 600 200">
              <!-- FPS Line -->
              <polyline [attr.points]="fpsChartPoints" 
                        fill="none" stroke="#4CAF50" stroke-width="2" class="fps-line"/>
              <!-- Latency Line -->
              <polyline [attr.points]="latencyChartPoints" 
                        fill="none" stroke="#FF5722" stroke-width="2" class="latency-line"/>
              <!-- Grid lines -->
              <g class="grid-lines">
                <line *ngFor="let y of gridLines" 
                      x1="0" [attr.y1]="y" x2="600" [attr.y2]="y" 
                      stroke="#333" stroke-width="0.5"/>
              </g>
            </svg>
            <div class="chart-legend">
              <span class="legend-item fps">🟢 FPS</span>
              <span class="legend-item latency">🔴 Latency (ms)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Memory Pool Status -->
      <div class="memory-pools-section">
        <h3>🏊 Memory Pools Status</h3>
        <div class="pools-grid">
          <div *ngFor="let pool of memoryPoolsArray" class="pool-card">
            <div class="pool-header">
              <span class="pool-name">{{pool.name}}</span>
              <span class="pool-usage">{{pool.stats.availableObjects}}/{{pool.stats.totalObjects}}</span>
            </div>
            <div class="pool-stats">
              <div class="stat">
                <span class="label">Memory:</span>
                <span class="value">{{pool.stats.memoryUsageMB | number:'1.1-1'}}MB</span>
              </div>
              <div class="stat">
                <span class="label">Hit Rate:</span>
                <span class="value">{{(pool.stats.hitRate * 100) | number:'1.0-0'}}%</span>
              </div>
              <div class="stat">
                <span class="label">Peak Usage:</span>
                <span class="value">{{pool.stats.peakUsage}}</span>
              </div>
            </div>
            <div class="pool-bar">
              <div class="usage-bar" [style.width.%]="getPoolUsagePercentage(pool.stats)"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Optimizations Applied -->
      <div class="optimizations-section">
        <h3>🛠️ Recent Optimizations</h3>
        <div class="optimizations-list">
          <div *ngFor="let action of recentOptimizations" 
               class="optimization-item" 
               [class]="getOptimizationPriority(action.type)">
            <div class="optimization-header">
              <span class="optimization-icon">{{getOptimizationIcon(action.type)}}</span>
              <span class="optimization-type">{{action.type}}</span>
              <span class="optimization-action">{{action.action}}</span>
              <span class="optimization-time">{{getTimeAgo(action.appliedAt)}}</span>
            </div>
            <div class="optimization-details">
              <span class="impact">Impact: {{action.impact}}</span>
              <span class="gain">Expected Gain: {{action.expectedGain}}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Control Panel -->
      <div class="control-panel">
        <h3>⚙️ Performance Controls</h3>
        <div class="controls-grid">
          <button class="control-btn primary" (click)="forceOptimization()">
            🚀 Force Optimization
          </button>
          <button class="control-btn secondary" (click)="clearMemoryPools()">
            🧹 Clear Memory Pools
          </button>
          <button class="control-btn secondary" (click)="resetTracking()">
            🔄 Reset Tracking
          </button>
          <button class="control-btn" [class.active]="isMonitoring" (click)="toggleMonitoring()">
            {{isMonitoring ? '⏸️ Pause' : '▶️ Start'}} Monitoring
          </button>
        </div>
        
        <!-- Performance Mode Selector -->
        <div class="mode-selector">
          <label>Performance Mode:</label>
          <select (change)="changePerformanceMode($event)" [value]="currentMode">
            <option value="ultra-performance">🏃 Ultra Performance</option>
            <option value="performance">⚡ Performance</option>
            <option value="balanced">⚖️ Balanced</option>
            <option value="quality">🎨 Quality</option>
          </select>
        </div>
      </div>

      <!-- System Status -->
      <div class="status-section">
        <h3>📊 System Status</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">Thermal State:</span>
            <span class="status-value" [class]="getStatusClass(metrics.thermalState)">{{metrics.thermalState}}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Battery Impact:</span>
            <span class="status-value" [class]="getStatusClass(metrics.batteryImpact)">{{metrics.batteryImpact}}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Network Latency:</span>
            <span class="status-value">{{metrics.networkLatency}}ms</span>
          </div>
          <div class="status-item">
            <span class="status-label">Error Rate:</span>
            <span class="status-value" [class]="getErrorRateClass(metrics.errorRate)">{{(metrics.errorRate * 100) | number:'1.2-2'}}%</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .performance-dashboard {
      padding: 20px;
      background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
      color: #ffffff;
      min-height: 100vh;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      backdrop-filter: blur(10px);
    }

    .dashboard-header h2 {
      margin: 0;
      font-size: 2em;
      background: linear-gradient(45deg, #4CAF50, #2196F3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .overall-score {
      font-size: 1.5em;
      font-weight: bold;
      padding: 10px 20px;
      border-radius: 50px;
      text-align: center;
    }

    .overall-score.excellent { background: linear-gradient(45deg, #4CAF50, #8BC34A); }
    .overall-score.good { background: linear-gradient(45deg, #2196F3, #03DAC6); }
    .overall-score.fair { background: linear-gradient(45deg, #FF9800, #FFC107); }
    .overall-score.poor { background: linear-gradient(45deg, #F44336, #FF5722); }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .metric-card {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 20px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .metric-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    .metric-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
    }

    .metric-icon {
      font-size: 1.5em;
    }

    .metric-header h3 {
      margin: 0;
      color: #ffffff;
    }

    .metric-values {
      margin-bottom: 15px;
    }

    .primary-value {
      font-size: 2.2em;
      font-weight: bold;
      margin-bottom: 5px;
      background: linear-gradient(45deg, #ffffff, #e0e0e0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .secondary-values {
      display: flex;
      gap: 15px;
      font-size: 0.9em;
      color: #b0b0b0;
    }

    .metric-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-bar.excellent { background: linear-gradient(90deg, #4CAF50, #8BC34A); }
    .progress-bar.good { background: linear-gradient(90deg, #2196F3, #03DAC6); }
    .progress-bar.poor { background: linear-gradient(90deg, #F44336, #FF5722); }

    .charts-section {
      margin: 30px 0;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 20px;
    }

    .chart-container h3 {
      margin: 0 0 20px 0;
      color: #ffffff;
    }

    .chart-area {
      position: relative;
    }

    .chart-legend {
      display: flex;
      gap: 20px;
      margin-top: 10px;
    }

    .legend-item {
      font-size: 0.9em;
      color: #b0b0b0;
    }

    .memory-pools-section {
      margin: 30px 0;
    }

    .memory-pools-section h3 {
      margin-bottom: 20px;
      color: #ffffff;
    }

    .pools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
    }

    .pool-card {
      background: rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 15px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .pool-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .pool-name {
      font-weight: bold;
      color: #ffffff;
    }

    .pool-usage {
      color: #4CAF50;
      font-family: monospace;
    }

    .pool-stats {
      margin-bottom: 10px;
    }

    .stat {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 0.9em;
    }

    .label {
      color: #b0b0b0;
    }

    .value {
      color: #ffffff;
      font-family: monospace;
    }

    .pool-bar {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .usage-bar {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #8BC34A);
      transition: width 0.3s ease;
    }

    .optimizations-section {
      margin: 30px 0;
    }

    .optimizations-section h3 {
      margin-bottom: 20px;
      color: #ffffff;
    }

    .optimizations-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .optimization-item {
      background: rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      border-left: 4px solid transparent;
    }

    .optimization-item.critical { border-left-color: #F44336; }
    .optimization-item.high { border-left-color: #FF9800; }
    .optimization-item.medium { border-left-color: #FFC107; }
    .optimization-item.low { border-left-color: #4CAF50; }

    .optimization-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 5px;
    }

    .optimization-type {
      font-weight: bold;
      color: #ffffff;
    }

    .optimization-action {
      color: #b0b0b0;
      flex-grow: 1;
    }

    .optimization-time {
      color: #666;
      font-size: 0.8em;
    }

    .optimization-details {
      display: flex;
      gap: 15px;
      font-size: 0.85em;
    }

    .impact {
      color: #03DAC6;
    }

    .gain {
      color: #4CAF50;
    }

    .control-panel {
      margin: 30px 0;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 20px;
    }

    .control-panel h3 {
      margin: 0 0 20px 0;
      color: #ffffff;
    }

    .controls-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .control-btn {
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .control-btn.primary {
      background: linear-gradient(45deg, #4CAF50, #8BC34A);
    }

    .control-btn.secondary {
      background: linear-gradient(45deg, #2196F3, #03DAC6);
    }

    .control-btn.active {
      background: linear-gradient(45deg, #FF9800, #FFC107);
    }

    .control-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }

    .mode-selector {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .mode-selector label {
      color: #ffffff;
      font-weight: 500;
    }

    .mode-selector select {
      padding: 8px 15px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      font-size: 0.9em;
    }

    .status-section {
      margin: 30px 0;
    }

    .status-section h3 {
      margin-bottom: 20px;
      color: #ffffff;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 15px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 8px;
    }

    .status-label {
      color: #b0b0b0;
    }

    .status-value {
      color: #ffffff;
      font-weight: bold;
    }

    .status-value.warning {
      color: #FF9800;
    }

    .status-value.critical {
      color: #F44336;
    }

    .status-value.serious {
      color: #FF5722;
    }

    .status-value.high {
      color: #FF5722;
    }

    .status-value.moderate {
      color: #FF9800;
    }

    .status-value.minimal {
      color: #4CAF50;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .performance-dashboard {
        padding: 10px;
      }

      .metrics-grid {
        grid-template-columns: 1fr;
      }

      .pools-grid {
        grid-template-columns: 1fr;
      }

      .controls-grid {
        grid-template-columns: 1fr;
      }

      .status-grid {
        grid-template-columns: 1fr;
      }

      .dashboard-header {
        flex-direction: column;
        gap: 15px;
        text-align: center;
      }
    }

    /* Scrollbar Styling */
    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  `]
})
export class PerformanceDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Component state
  metrics: AdvancedPerformanceMetrics = {
    currentFPS: 0,
    averageFPS: 0,
    minFPS: 0,
    maxFPS: 0,
    currentLatency: 0,
    averageLatency: 0,
    p95Latency: 0,
    p99Latency: 0,
    memoryUsage: 0,
    memoryPeak: 0,
    cpuUsage: 0,
    gpuUsage: 0,
    processingQuality: 100,
    adaptiveQualityLevel: 100,
    frameDropRate: 0,
    errorRate: 0,
    thermalState: 'normal',
    batteryImpact: 'minimal',
    networkLatency: 0,
    overallScore: 100,
    timestamp: Date.now()
  };

  memoryPoolsArray: Array<{name: string, stats: PoolStatistics}> = [];
  recentOptimizations: OptimizationAction[] = [];
  isMonitoring = false;
  currentMode = 'balanced';
  totalPoolMemory = 0;

  // Chart data
  fpsChartPoints = '';
  latencyChartPoints = '';
  gridLines = [40, 80, 120, 160];
  
  // Chart history
  private chartHistory: { fps: number[], latency: number[] } = { fps: [], latency: [] };
  private readonly maxChartPoints = 60; // 60 seconds of data

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.initializeMockData();
    this.initializeMonitoring();
    this.startChartUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeMockData(): void {
    // Initialize mock metrics
    this.metrics = {
      currentFPS: 28.5,
      averageFPS: 29.2,
      minFPS: 25.1,
      maxFPS: 30.0,
      currentLatency: 18.2,
      averageLatency: 19.5,
      p95Latency: 24.8,
      p99Latency: 31.2,
      memoryUsage: 185,
      memoryPeak: 220,
      cpuUsage: 42,
      gpuUsage: 35,
      processingQuality: 92,
      adaptiveQualityLevel: 88,
      frameDropRate: 0.8,
      errorRate: 0.002,
      thermalState: 'normal',
      batteryImpact: 'minimal',
      networkLatency: 12,
      overallScore: 87,
      timestamp: Date.now()
    };

    // Initialize mock memory pools
    this.memoryPoolsArray = [
      {
        name: 'Frame Buffer Pool',
        stats: {
          totalObjects: 100,
          availableObjects: 85,
          memoryUsageMB: 45.2,
          hitRate: 0.95,
          peakUsage: 95
        }
      },
      {
        name: 'Gaze Data Pool',
        stats: {
          totalObjects: 200,
          availableObjects: 178,
          memoryUsageMB: 22.8,
          hitRate: 0.89,
          peakUsage: 190
        }
      },
      {
        name: 'Processing Cache',
        stats: {
          totalObjects: 50,
          availableObjects: 42,
          memoryUsageMB: 38.5,
          hitRate: 0.92,
          peakUsage: 48
        }
      },
      {
        name: 'Neural Network Cache',
        stats: {
          totalObjects: 25,
          availableObjects: 20,
          memoryUsageMB: 120.4,
          hitRate: 0.88,
          peakUsage: 24
        }
      }
    ];

    this.totalPoolMemory = this.memoryPoolsArray.reduce((sum, pool) => sum + pool.stats.memoryUsageMB, 0);

    // Initialize mock optimizations
    this.recentOptimizations = [
      {
        type: 'memory',
        action: 'Cleared unused frame buffers',
        appliedAt: Date.now() - 30000,
        impact: 'High',
        expectedGain: '12'
      },
      {
        type: 'cpu',
        action: 'Reduced processing quality to maintain FPS',
        appliedAt: Date.now() - 120000,
        impact: 'Medium',
        expectedGain: '8'
      },
      {
        type: 'quality',
        action: 'Adjusted adaptive quality threshold',
        appliedAt: Date.now() - 180000,
        impact: 'Low',
        expectedGain: '5'
      }
    ];

    // Initialize chart history with some mock data
    for (let i = 0; i < 20; i++) {
      this.chartHistory.fps.push(25 + Math.random() * 8);
      this.chartHistory.latency.push(15 + Math.random() * 10);
    }
  }

  private initializeMonitoring(): void {
    // Simulate real-time monitoring
    this.isMonitoring = true;
    
    // TODO: Replace with backend API calls
    // this.http.get<AdvancedPerformanceMetrics>('/api/performance/metrics').subscribe(metrics => {
    //   this.metrics = metrics;
    // });
  }

  private startChartUpdates(): void {
    timer(0, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateMockMetrics();
        this.updateChartData();
        this.updateChartPoints();
      });
  }

  private updateMockMetrics(): void {
    // Simulate fluctuating metrics
    this.metrics.currentFPS += (Math.random() - 0.5) * 2;
    this.metrics.currentLatency += (Math.random() - 0.5) * 3;
    this.metrics.cpuUsage += (Math.random() - 0.5) * 5;
    this.metrics.memoryUsage += (Math.random() - 0.5) * 10;

    // Keep values within reasonable bounds
    this.metrics.currentFPS = Math.max(20, Math.min(30, this.metrics.currentFPS));
    this.metrics.currentLatency = Math.max(12, Math.min(35, this.metrics.currentLatency));
    this.metrics.cpuUsage = Math.max(25, Math.min(70, this.metrics.cpuUsage));
    this.metrics.memoryUsage = Math.max(150, Math.min(300, this.metrics.memoryUsage));

    // Update calculated values
    this.metrics.overallScore = Math.round(
      ((this.metrics.currentFPS / 30) * 30) +
      (Math.max(0, (50 - this.metrics.currentLatency)) / 50 * 25) +
      (Math.max(0, (100 - this.metrics.cpuUsage)) / 100 * 25) +
      (Math.max(0, (400 - this.metrics.memoryUsage)) / 400 * 20)
    );

    this.metrics.timestamp = Date.now();
  }

  private updateChartData(): void {
    // Add new data points
    this.chartHistory.fps.push(this.metrics.currentFPS);
    this.chartHistory.latency.push(this.metrics.currentLatency);

    // Limit history size
    if (this.chartHistory.fps.length > this.maxChartPoints) {
      this.chartHistory.fps = this.chartHistory.fps.slice(-this.maxChartPoints);
    }
    if (this.chartHistory.latency.length > this.maxChartPoints) {
      this.chartHistory.latency = this.chartHistory.latency.slice(-this.maxChartPoints);
    }
  }

  private updateChartPoints(): void {
    const width = 600;
    const height = 200;
    const padding = 20;

    // Update FPS chart points
    if (this.chartHistory.fps.length > 1) {
      const maxFPS = Math.max(60, Math.max(...this.chartHistory.fps));
      const fpsPoints = this.chartHistory.fps.map((fps, index) => {
        const x = padding + (index / (this.maxChartPoints - 1)) * (width - 2 * padding);
        const y = height - padding - ((fps / maxFPS) * (height - 2 * padding));
        return `${x},${y}`;
      });
      this.fpsChartPoints = fpsPoints.join(' ');
    }

    // Update latency chart points
    if (this.chartHistory.latency.length > 1) {
      const maxLatency = Math.max(100, Math.max(...this.chartHistory.latency));
      const latencyPoints = this.chartHistory.latency.map((latency, index) => {
        const x = padding + (index / (this.maxChartPoints - 1)) * (width - 2 * padding);
        const y = height - padding - ((latency / maxLatency) * (height - 2 * padding));
        return `${x},${y}`;
      });
      this.latencyChartPoints = latencyPoints.join(' ');
    }
  }

  // Event handlers
  forceOptimization(): void {
    const newOptimization: OptimizationAction = {
      type: 'manual',
      action: 'Manual optimization triggered',
      appliedAt: Date.now(),
      impact: 'High',
      expectedGain: '15'
    };
    
    this.recentOptimizations.unshift(newOptimization);
    if (this.recentOptimizations.length > 10) {
      this.recentOptimizations.pop();
    }

    // TODO: Call backend API
    // this.http.post('/api/performance/force-optimization', {}).subscribe();
  }

  clearMemoryPools(): void {
    this.memoryPoolsArray.forEach(pool => {
      pool.stats.availableObjects = pool.stats.totalObjects;
      pool.stats.memoryUsageMB *= 0.7; // Simulate memory cleanup
    });

    // TODO: Call backend API
    // this.http.post('/api/performance/clear-memory-pools', {}).subscribe();
  }

  resetTracking(): void {
    this.chartHistory = { fps: [], latency: [] };
    this.fpsChartPoints = '';
    this.latencyChartPoints = '';

    // TODO: Call backend API
    // this.http.post('/api/performance/reset-tracking', {}).subscribe();
  }

  toggleMonitoring(): void {
    this.isMonitoring = !this.isMonitoring;

    // TODO: Call backend API
    // this.http.post('/api/performance/toggle-monitoring', { enabled: this.isMonitoring }).subscribe();
  }

  changePerformanceMode(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const mode = select.value;
    this.currentMode = mode;

    // TODO: Call backend API
    // this.http.put('/api/performance/mode', { mode }).subscribe();
  }

  // Utility methods
  getOptimizationIcon(type: string): string {
    const icons: Record<string, string> = {
      memory: '💾',
      cpu: '🔥',
      quality: '🎨',
      network: '🌐',
      manual: '🔧'
    };
    return icons[type] || '⚙️';
  }

  getOptimizationPriority(type: string): string {
    const priorities: Record<string, string> = {
      memory: 'high',
      cpu: 'critical',
      quality: 'medium',
      network: 'low',
      manual: 'high'
    };
    return priorities[type] || 'medium';
  }

  getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  getStatusClass(status: string): string {
    const statusClasses: Record<string, string> = {
      normal: '',
      warning: 'warning',
      critical: 'critical',
      serious: 'serious',
      high: 'high',
      moderate: 'moderate',
      minimal: 'minimal'
    };
    return statusClasses[status] || '';
  }

  getErrorRateClass(errorRate: number): string {
    if (errorRate > 0.01) return 'critical';
    if (errorRate > 0.005) return 'warning';
    return 'minimal';
  }

  getLatencyBarWidth(latency: number): number {
    return Math.max(0, 100 - (latency / 100) * 100);
  }

  getPoolUsagePercentage(stats: PoolStatistics): number {
    return (stats.availableObjects / stats.totalObjects) * 100;
  }
}
