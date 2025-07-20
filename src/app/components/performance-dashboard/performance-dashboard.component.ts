import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, interval, combineLatest } from 'rxjs';
import { ProductionPerformanceService, AdvancedPerformanceMetrics, OptimizationAction } from '../../services/production-performance.service';
import { MemoryPoolService, PoolStatistics } from '../../services/memory-pool.service';

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
            <h3>Processing Latency</h3>
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
            <div class="progress-bar" [style.width.%]="Math.max(0, 100 - (metrics.currentLatency / 100) * 100)"
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
            <svg #performanceChart width="100%" height="200" viewBox="0 0 600 200">
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
          <div *ngFor="let pool of memoryPools | keyvalue" class="pool-card">
            <div class="pool-header">
              <span class="pool-name">{{pool.key}}</span>
              <span class="pool-usage">{{pool.value.availableObjects}}/{{pool.value.totalObjects}}</span>
            </div>
            <div class="pool-stats">
              <div class="stat">
                <span class="label">Memory:</span>
                <span class="value">{{pool.value.memoryUsageMB | number:'1.1-1'}}MB</span>
              </div>
              <div class="stat">
                <span class="label">Hit Rate:</span>
                <span class="value">{{(pool.value.hitRate * 100) | number:'1.0-0'}}%</span>
              </div>
              <div class="stat">
                <span class="label">Peak Usage:</span>
                <span class="value">{{pool.value.peakUsage}}</span>
              </div>
            </div>
            <div class="pool-bar">
              <div class="usage-bar" [style.width.%]="(pool.value.availableObjects / pool.value.totalObjects) * 100"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Optimizations -->
      <div class="optimizations-section">
        <h3>🔧 Recent Optimizations</h3>
        <div class="optimizations-list">
          <div *ngFor="let action of recentOptimizations" class="optimization-item"
               [class]="action.impact">
            <div class="optimization-header">
              <span class="optimization-type">{{getOptimizationIcon(action.type)}}</span>
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
            <option value="ultra-quality">💎 Ultra Quality</option>
          </select>
        </div>
      </div>

      <!-- System Status -->
      <div class="system-status">
        <h3>🖥️ System Status</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">Frame Drop Rate:</span>
            <span class="status-value" [class.warning]="metrics.frameDropRate > 5">
              {{metrics.frameDropRate | number:'1.1-1'}}%
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Error Rate:</span>
            <span class="status-value" [class.warning]="metrics.errorRate > 1">
              {{metrics.errorRate | number:'1.1-1'}}%
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Battery Impact:</span>
            <span class="status-value" [class]="metrics.batteryImpact">
              {{metrics.batteryImpact}}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Thermal State:</span>
            <span class="status-value" [class]="metrics.thermalState">
              {{metrics.thermalState}}
            </span>
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
      border-radius: 25px;
      background: rgba(255, 255, 255, 0.1);
    }

    .overall-score.excellent { background: linear-gradient(45deg, #4CAF50, #8BC34A); }
    .overall-score.good { background: linear-gradient(45deg, #FF9800, #FFC107); }
    .overall-score.fair { background: linear-gradient(45deg, #FF5722, #FF9800); }
    .overall-score.poor { background: linear-gradient(45deg, #F44336, #FF5722); }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    }

    .metric-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }

    .metric-icon {
      font-size: 1.5em;
      margin-right: 10px;
    }

    .metric-header h3 {
      margin: 0;
      font-size: 1.1em;
      color: #b0b0b0;
    }

    .primary-value {
      font-size: 2.2em;
      font-weight: bold;
      margin-bottom: 8px;
      background: linear-gradient(45deg, #ffffff, #e0e0e0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .secondary-values {
      display: flex;
      gap: 15px;
      font-size: 0.9em;
      color: #b0b0b0;
      margin-bottom: 15px;
    }

    .metric-bar {
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .progress-bar.excellent { background: linear-gradient(90deg, #4CAF50, #8BC34A); }
    .progress-bar.good { background: linear-gradient(90deg, #FF9800, #FFC107); }
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
      font-size: 1.2em;
    }

    .optimization-action {
      flex: 1;
      color: #ffffff;
      font-weight: 500;
    }

    .optimization-time {
      color: #b0b0b0;
      font-size: 0.8em;
    }

    .optimization-details {
      display: flex;
      gap: 15px;
      font-size: 0.9em;
      color: #b0b0b0;
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
      font-size: 1em;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .control-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }

    .control-btn.primary {
      background: linear-gradient(45deg, #4CAF50, #2196F3);
    }

    .control-btn.secondary {
      background: linear-gradient(45deg, #FF9800, #FF5722);
    }

    .control-btn.active {
      background: linear-gradient(45deg, #9C27B0, #673AB7);
    }

    .mode-selector {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .mode-selector label {
      color: #ffffff;
      font-weight: 500;
    }

    .mode-selector select {
      padding: 8px 15px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      font-size: 1em;
    }

    .system-status {
      margin: 30px 0;
    }

    .system-status h3 {
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
      align-items: center;
      padding: 12px;
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
  private performanceService = inject(ProductionPerformanceService);
  private memoryPoolService = inject(MemoryPoolService);

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

  memoryPools: Map<string, PoolStatistics> = new Map();
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

  // Expose Math for template
  Math = Math;

  ngOnInit(): void {
    this.initializeMonitoring();
    this.startChartUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeMonitoring(): void {
    // Subscribe to performance metrics
    this.performanceService.performanceMetrics$
      .pipe(takeUntil(this.destroy$))
      .subscribe(metrics => {
        this.metrics = metrics;
        this.updateChartData();
      });

    // Subscribe to memory pool statistics
    interval(2000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.memoryPools = this.memoryPoolService.getMemoryStatistics();
        this.totalPoolMemory = this.memoryPoolService.getTotalMemoryUsage();
      });

    // Subscribe to optimization actions
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.recentOptimizations = this.performanceService.getOptimizationActions()
          .slice(-10)
          .reverse();
      });

    // Start monitoring
    this.performanceService.startAdvancedMonitoring();
    this.isMonitoring = true;
  }

  private startChartUpdates(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateChartPoints();
      });
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
    this.performanceService.forceOptimization();
  }

  clearMemoryPools(): void {
    this.memoryPoolService.clearAllPools();
  }

  resetTracking(): void {
    this.performanceService.resetPerformanceTracking();
    this.chartHistory = { fps: [], latency: [] };
    this.fpsChartPoints = '';
    this.latencyChartPoints = '';
  }

  toggleMonitoring(): void {
    if (this.isMonitoring) {
      this.performanceService.stopMonitoring();
    } else {
      this.performanceService.startAdvancedMonitoring();
    }
    this.isMonitoring = !this.isMonitoring;
  }

  changePerformanceMode(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const mode = select.value as any;
    this.currentMode = mode;
    
    this.performanceService.updateConfiguration({
      qualityMode: mode
    });
  }

  // Utility methods
  getOptimizationIcon(type: string): string {
    const icons = {
      memory: '💾',
      cpu: '🔥',
      quality: '🎨',
      thermal: '🌡️',
      emergency: '🚨'
    };
    return icons[type as keyof typeof icons] || '⚙️';
  }

  getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}
