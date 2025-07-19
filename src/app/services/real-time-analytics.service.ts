import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';

export interface GazeAnalyticsData {
  // Basic gaze metrics
  gazePoint: { x: number; y: number };
  confidence: number;
  timestamp: number;
  
  // Quality metrics
  trackingQuality: number;
  stabilityScore: number;
  accuracyScore: number;
  
  // Processing metrics
  processingTime: number;
  frameRate: number;
  
  // Head pose data
  headPose?: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  
  // Facial landmarks confidence
  landmarksConfidence?: number;
}

export interface AnalyticsMetrics {
  // Session statistics
  sessionDuration: number;
  totalGazePoints: number;
  averageConfidence: number;
  
  // Quality metrics
  averageTrackingQuality: number;
  stabilityIndex: number;
  accuracyIndex: number;
  
  // Performance metrics
  averageProcessingTime: number;
  averageFrameRate: number;
  performanceScore: number;
  
  // User behavior patterns
  gazePatterns: {
    fixationCount: number;
    saccadeCount: number;
    averageFixationDuration: number;
    scanPathLength: number;
  };
  
  // Heat map data
  heatMapData: Array<{
    x: number;
    y: number;
    intensity: number;
    duration: number;
  }>;
  
  // Attention areas
  attentionAreas: Array<{
    region: string;
    timeSpent: number;
    percentage: number;
    averageConfidence: number;
  }>;
  
  // System health
  systemHealth: {
    errorRate: number;
    recoveryRate: number;
    systemStability: number;
  };
}

export interface RealTimeStats {
  // Current metrics
  current: {
    gazePoint: { x: number; y: number };
    confidence: number;
    quality: number;
    fps: number;
    latency: number;
  };
  
  // Recent averages (last 30 seconds)
  recent: {
    averageConfidence: number;
    averageQuality: number;
    averageFps: number;
    averageLatency: number;
    stability: number;
  };
  
  // Session totals
  session: {
    duration: number;
    totalPoints: number;
    errorCount: number;
    successRate: number;
  };
  
  // Performance trends
  trends: {
    confidenceTrend: 'improving' | 'stable' | 'declining';
    qualityTrend: 'improving' | 'stable' | 'declining';
    performanceTrend: 'improving' | 'stable' | 'declining';
  };
}

export interface AnalyticsConfig {
  // Data collection settings
  enableHeatMap: boolean;
  enableGazePatterns: boolean;
  enablePerformanceTracking: boolean;
  
  // Sampling settings
  samplingRate: number; // Hz
  dataRetentionTime: number; // minutes
  heatMapResolution: number;
  
  // Analysis settings
  fixationThreshold: number; // milliseconds
  saccadeThreshold: number; // pixels
  stabilityWindow: number; // milliseconds
  
  // Real-time update intervals
  realtimeUpdateInterval: number; // milliseconds
  metricsUpdateInterval: number; // milliseconds
  
  // Storage settings
  maxDataPoints: number;
  enableDataExport: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RealTimeAnalyticsService {
  private config: AnalyticsConfig = {
    enableHeatMap: true,
    enableGazePatterns: true,
    enablePerformanceTracking: true,
    samplingRate: 20, // 20 Hz
    dataRetentionTime: 60, // 1 hour
    heatMapResolution: 50,
    fixationThreshold: 100, // 100ms
    saccadeThreshold: 30, // 30 pixels
    stabilityWindow: 1000, // 1 second
    realtimeUpdateInterval: 100, // 100ms
    metricsUpdateInterval: 1000, // 1 second
    maxDataPoints: 10000,
    enableDataExport: true
  };

  // Data streams
  private gazeDataStream: GazeAnalyticsData[] = [];
  private sessionStartTime = 0;
  private isCollecting = false;

  // Observables
  private metricsSubject = new BehaviorSubject<AnalyticsMetrics>({
    sessionDuration: 0,
    totalGazePoints: 0,
    averageConfidence: 0,
    averageTrackingQuality: 0,
    stabilityIndex: 0,
    accuracyIndex: 0,
    averageProcessingTime: 0,
    averageFrameRate: 0,
    performanceScore: 0,
    gazePatterns: {
      fixationCount: 0,
      saccadeCount: 0,
      averageFixationDuration: 0,
      scanPathLength: 0
    },
    heatMapData: [],
    attentionAreas: [],
    systemHealth: {
      errorRate: 0,
      recoveryRate: 100,
      systemStability: 100
    }
  });

  private realTimeStatsSubject = new BehaviorSubject<RealTimeStats>({
    current: {
      gazePoint: { x: 0, y: 0 },
      confidence: 0,
      quality: 0,
      fps: 0,
      latency: 0
    },
    recent: {
      averageConfidence: 0,
      averageQuality: 0,
      averageFps: 0,
      averageLatency: 0,
      stability: 0
    },
    session: {
      duration: 0,
      totalPoints: 0,
      errorCount: 0,
      successRate: 0
    },
    trends: {
      confidenceTrend: 'stable',
      qualityTrend: 'stable',
      performanceTrend: 'stable'
    }
  });

  // Heat map data
  private heatMapGrid: number[][] = [];
  
  // Pattern analysis
  private fixations: Array<{ x: number; y: number; duration: number; timestamp: number }> = [];
  private saccades: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; duration: number }> = [];
  
  // Performance tracking
  private performanceHistory: Array<{ timestamp: number; fps: number; quality: number; confidence: number }> = [];
  
  // Error tracking
  private errorHistory: Array<{ timestamp: number; type: string; severity: number }> = [];

  constructor() {
    this.initializeAnalytics();
  }

  // Public API
  get analyticsMetrics$(): Observable<AnalyticsMetrics> {
    return this.metricsSubject.asObservable();
  }

  get realTimeStats$(): Observable<RealTimeStats> {
    return this.realTimeStatsSubject.asObservable();
  }

  get combinedAnalytics$(): Observable<{ metrics: AnalyticsMetrics; stats: RealTimeStats }> {
    return combineLatest([
      this.analyticsMetrics$,
      this.realTimeStats$
    ]).pipe(
      map(([metrics, stats]) => ({ metrics, stats }))
    );
  }

  // Start data collection
  startAnalytics(): void {
    if (this.isCollecting) {
      console.warn('Analytics already running');
      return;
    }

    this.isCollecting = true;
    this.sessionStartTime = Date.now();
    
    // Initialize heat map grid
    this.initializeHeatMap();
    
    // Start real-time updates
    this.startRealTimeUpdates();
    
    console.log('Real-time analytics started');
  }

  // Stop data collection
  stopAnalytics(): void {
    this.isCollecting = false;
    console.log('Real-time analytics stopped');
  }

  // Record gaze data point
  recordGazeData(data: GazeAnalyticsData): void {
    if (!this.isCollecting) return;

    // Add timestamp if not provided
    if (!data.timestamp) {
      data.timestamp = Date.now();
    }

    // Add to data stream
    this.gazeDataStream.push(data);
    
    // Maintain data stream size
    if (this.gazeDataStream.length > this.config.maxDataPoints) {
      this.gazeDataStream = this.gazeDataStream.slice(-this.config.maxDataPoints);
    }

    // Update heat map
    if (this.config.enableHeatMap) {
      this.updateHeatMap(data.gazePoint.x, data.gazePoint.y, data.confidence);
    }

    // Analyze gaze patterns
    if (this.config.enableGazePatterns) {
      this.analyzeGazePatterns(data);
    }

    // Update performance tracking
    if (this.config.enablePerformanceTracking) {
      this.updatePerformanceTracking(data);
    }

    // Update real-time stats
    this.updateRealTimeStats(data);
  }

  // Record error
  recordError(type: string, severity: number = 1): void {
    this.errorHistory.push({
      timestamp: Date.now(),
      type,
      severity
    });

    // Keep error history manageable
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000);
    }

    // Update system health
    this.updateSystemHealth();
  }

  // Get current session metrics
  getCurrentMetrics(): AnalyticsMetrics {
    return this.metricsSubject.value;
  }

  // Get current real-time stats
  getCurrentStats(): RealTimeStats {
    return this.realTimeStatsSubject.value;
  }

  // Get heat map data for visualization
  getHeatMapData(): Array<{ x: number; y: number; intensity: number }> {
    const data: Array<{ x: number; y: number; intensity: number }> = [];
    const resolution = this.config.heatMapResolution;
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        if (this.heatMapGrid[i] && this.heatMapGrid[i][j] > 0) {
          data.push({
            x: (i / resolution) * 100, // Percentage
            y: (j / resolution) * 100, // Percentage
            intensity: this.heatMapGrid[i][j]
          });
        }
      }
    }
    
    return data;
  }

  // Export analytics data
  exportData(): { 
    gazeData: GazeAnalyticsData[]; 
    metrics: AnalyticsMetrics; 
    stats: RealTimeStats;
    config: AnalyticsConfig;
  } {
    return {
      gazeData: [...this.gazeDataStream],
      metrics: this.getCurrentMetrics(),
      stats: this.getCurrentStats(),
      config: { ...this.config }
    };
  }

  // Clear all data
  clearData(): void {
    this.gazeDataStream = [];
    this.fixations = [];
    this.saccades = [];
    this.performanceHistory = [];
    this.errorHistory = [];
    this.initializeHeatMap();
    
    // Reset observables
    this.resetMetrics();
    this.resetRealTimeStats();
    
    console.log('Analytics data cleared');
  }

  // Configuration methods
  updateConfiguration(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize heat map if resolution changed
    if (newConfig.heatMapResolution) {
      this.initializeHeatMap();
    }
  }

  getConfiguration(): AnalyticsConfig {
    return { ...this.config };
  }

  // Private implementation methods

  private initializeAnalytics(): void {
    this.initializeHeatMap();
    this.resetMetrics();
    this.resetRealTimeStats();
  }

  private initializeHeatMap(): void {
    const resolution = this.config.heatMapResolution;
    this.heatMapGrid = Array(resolution).fill(null).map(() => Array(resolution).fill(0));
  }

  private startRealTimeUpdates(): void {
    // Real-time stats updates
    setInterval(() => {
      if (this.isCollecting) {
        this.updateRealTimeMetrics();
      }
    }, this.config.realtimeUpdateInterval);

    // Full metrics updates
    setInterval(() => {
      if (this.isCollecting) {
        this.updateFullMetrics();
      }
    }, this.config.metricsUpdateInterval);
  }

  private updateHeatMap(x: number, y: number, intensity: number): void {
    // Convert screen coordinates to grid coordinates
    const resolution = this.config.heatMapResolution;
    const gridX = Math.floor((x / 100) * resolution); // Assuming x is percentage
    const gridY = Math.floor((y / 100) * resolution); // Assuming y is percentage
    
    if (gridX >= 0 && gridX < resolution && gridY >= 0 && gridY < resolution) {
      this.heatMapGrid[gridX][gridY] += intensity;
    }
  }

  private analyzeGazePatterns(data: GazeAnalyticsData): void {
    const recentData = this.getRecentData(this.config.stabilityWindow);
    
    if (recentData.length < 2) return;

    const lastPoint = recentData[recentData.length - 2];
    const currentPoint = data;
    
    const distance = this.calculateDistance(
      lastPoint.gazePoint,
      currentPoint.gazePoint
    );
    
    const timeDiff = currentPoint.timestamp - lastPoint.timestamp;

    // Detect fixations (low movement for extended time)
    if (distance < this.config.saccadeThreshold && timeDiff > this.config.fixationThreshold) {
      this.recordFixation(currentPoint.gazePoint, timeDiff);
    }
    
    // Detect saccades (rapid movement)
    if (distance > this.config.saccadeThreshold) {
      this.recordSaccade(lastPoint.gazePoint, currentPoint.gazePoint, timeDiff);
    }
  }

  private updatePerformanceTracking(data: GazeAnalyticsData): void {
    this.performanceHistory.push({
      timestamp: data.timestamp,
      fps: data.frameRate,
      quality: data.trackingQuality,
      confidence: data.confidence
    });

    // Keep performance history manageable
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-1000);
    }
  }

  private updateRealTimeStats(data: GazeAnalyticsData): void {
    const currentStats = this.realTimeStatsSubject.value;
    const recentData = this.getRecentData(30000); // Last 30 seconds

    const updatedStats: RealTimeStats = {
      current: {
        gazePoint: data.gazePoint,
        confidence: data.confidence,
        quality: data.trackingQuality,
        fps: data.frameRate,
        latency: data.processingTime
      },
      recent: {
        averageConfidence: this.calculateAverage(recentData.map(d => d.confidence)),
        averageQuality: this.calculateAverage(recentData.map(d => d.trackingQuality)),
        averageFps: this.calculateAverage(recentData.map(d => d.frameRate)),
        averageLatency: this.calculateAverage(recentData.map(d => d.processingTime)),
        stability: this.calculateStability(recentData)
      },
      session: {
        duration: Date.now() - this.sessionStartTime,
        totalPoints: this.gazeDataStream.length,
        errorCount: this.errorHistory.length,
        successRate: this.calculateSuccessRate()
      },
      trends: this.calculateTrends()
    };

    this.realTimeStatsSubject.next(updatedStats);
  }

  private updateRealTimeMetrics(): void {
    // This method updates metrics that need frequent refresh
    const recentData = this.getRecentData(5000); // Last 5 seconds
    
    if (recentData.length === 0) return;

    const currentStats = this.realTimeStatsSubject.value;
    const latestData = recentData[recentData.length - 1];

    const updatedStats: RealTimeStats = {
      ...currentStats,
      current: {
        gazePoint: latestData.gazePoint,
        confidence: latestData.confidence,
        quality: latestData.trackingQuality,
        fps: latestData.frameRate,
        latency: latestData.processingTime
      },
      session: {
        ...currentStats.session,
        duration: Date.now() - this.sessionStartTime,
        totalPoints: this.gazeDataStream.length
      }
    };

    this.realTimeStatsSubject.next(updatedStats);
  }

  private updateFullMetrics(): void {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const totalPoints = this.gazeDataStream.length;
    
    if (totalPoints === 0) return;

    const metrics: AnalyticsMetrics = {
      sessionDuration,
      totalGazePoints: totalPoints,
      averageConfidence: this.calculateAverage(this.gazeDataStream.map(d => d.confidence)),
      averageTrackingQuality: this.calculateAverage(this.gazeDataStream.map(d => d.trackingQuality)),
      stabilityIndex: this.calculateStabilityIndex(),
      accuracyIndex: this.calculateAccuracyIndex(),
      averageProcessingTime: this.calculateAverage(this.gazeDataStream.map(d => d.processingTime)),
      averageFrameRate: this.calculateAverage(this.gazeDataStream.map(d => d.frameRate)),
      performanceScore: this.calculatePerformanceScore(),
      gazePatterns: this.calculateGazePatterns(),
      heatMapData: this.generateHeatMapData(),
      attentionAreas: this.calculateAttentionAreas(),
      systemHealth: this.calculateSystemHealth()
    };

    this.metricsSubject.next(metrics);
  }

  private updateSystemHealth(): void {
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < 60000 // Last minute
    );
    
    const errorRate = recentErrors.length / 60; // Errors per second
    const recoveryRate = this.calculateRecoveryRate();
    const systemStability = Math.max(0, 100 - (errorRate * 10));

    const currentMetrics = this.metricsSubject.value;
    this.metricsSubject.next({
      ...currentMetrics,
      systemHealth: {
        errorRate,
        recoveryRate,
        systemStability
      }
    });
  }

  // Calculation helper methods
  private getRecentData(timeWindow: number): GazeAnalyticsData[] {
    const cutoffTime = Date.now() - timeWindow;
    return this.gazeDataStream.filter(data => data.timestamp >= cutoffTime);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateDistance(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
  }

  private calculateStability(data: GazeAnalyticsData[]): number {
    if (data.length < 2) return 100;

    const movements = [];
    for (let i = 1; i < data.length; i++) {
      movements.push(this.calculateDistance(data[i-1].gazePoint, data[i].gazePoint));
    }

    const avgMovement = this.calculateAverage(movements);
    return Math.max(0, 100 - (avgMovement * 2)); // Lower movement = higher stability
  }

  private calculateStabilityIndex(): number {
    const recentData = this.getRecentData(10000); // Last 10 seconds
    return this.calculateStability(recentData);
  }

  private calculateAccuracyIndex(): number {
    // Calculate based on confidence and tracking quality
    const avgConfidence = this.calculateAverage(this.gazeDataStream.map(d => d.confidence));
    const avgQuality = this.calculateAverage(this.gazeDataStream.map(d => d.trackingQuality));
    return (avgConfidence + avgQuality) / 2;
  }

  private calculatePerformanceScore(): number {
    const avgFps = this.calculateAverage(this.gazeDataStream.map(d => d.frameRate));
    const avgLatency = this.calculateAverage(this.gazeDataStream.map(d => d.processingTime));
    const avgQuality = this.calculateAverage(this.gazeDataStream.map(d => d.trackingQuality));
    
    // Performance score based on FPS (target 20), latency (target <100ms), and quality
    const fpsScore = Math.min(100, (avgFps / 20) * 100);
    const latencyScore = Math.max(0, 100 - avgLatency);
    const qualityScore = avgQuality;
    
    return (fpsScore + latencyScore + qualityScore) / 3;
  }

  private calculateSuccessRate(): number {
    const validPoints = this.gazeDataStream.filter(d => d.confidence > 0.5).length;
    return this.gazeDataStream.length > 0 ? (validPoints / this.gazeDataStream.length) * 100 : 0;
  }

  private calculateTrends(): {
    confidenceTrend: 'improving' | 'stable' | 'declining';
    qualityTrend: 'improving' | 'stable' | 'declining';
    performanceTrend: 'improving' | 'stable' | 'declining';
  } {
    const recentData = this.getRecentData(30000); // Last 30 seconds
    const olderData = this.gazeDataStream.filter(d => 
      d.timestamp < Date.now() - 30000 && d.timestamp >= Date.now() - 60000
    ); // Previous 30 seconds

    if (recentData.length === 0 || olderData.length === 0) {
      return {
        confidenceTrend: 'stable',
        qualityTrend: 'stable',
        performanceTrend: 'stable'
      };
    }

    const recentConfidence = this.calculateAverage(recentData.map(d => d.confidence));
    const olderConfidence = this.calculateAverage(olderData.map(d => d.confidence));
    
    const recentQuality = this.calculateAverage(recentData.map(d => d.trackingQuality));
    const olderQuality = this.calculateAverage(olderData.map(d => d.trackingQuality));
    
    const recentPerformance = this.calculateAverage(recentData.map(d => d.frameRate));
    const olderPerformance = this.calculateAverage(olderData.map(d => d.frameRate));

    return {
      confidenceTrend: this.getTrend(recentConfidence, olderConfidence),
      qualityTrend: this.getTrend(recentQuality, olderQuality),
      performanceTrend: this.getTrend(recentPerformance, olderPerformance)
    };
  }

  private getTrend(recent: number, older: number): 'improving' | 'stable' | 'declining' {
    const threshold = 0.05; // 5% threshold for detecting trends
    const difference = (recent - older) / older;
    
    if (difference > threshold) return 'improving';
    if (difference < -threshold) return 'declining';
    return 'stable';
  }

  private recordFixation(point: { x: number; y: number }, duration: number): void {
    this.fixations.push({
      x: point.x,
      y: point.y,
      duration,
      timestamp: Date.now()
    });

    // Keep fixations manageable
    if (this.fixations.length > 1000) {
      this.fixations = this.fixations.slice(-1000);
    }
  }

  private recordSaccade(from: { x: number; y: number }, to: { x: number; y: number }, duration: number): void {
    this.saccades.push({
      from,
      to,
      duration
    });

    // Keep saccades manageable
    if (this.saccades.length > 1000) {
      this.saccades = this.saccades.slice(-1000);
    }
  }

  private calculateGazePatterns(): {
    fixationCount: number;
    saccadeCount: number;
    averageFixationDuration: number;
    scanPathLength: number;
  } {
    const avgFixationDuration = this.fixations.length > 0 
      ? this.calculateAverage(this.fixations.map(f => f.duration))
      : 0;

    const scanPathLength = this.saccades.reduce((total, saccade) => {
      return total + this.calculateDistance(saccade.from, saccade.to);
    }, 0);

    return {
      fixationCount: this.fixations.length,
      saccadeCount: this.saccades.length,
      averageFixationDuration: avgFixationDuration,
      scanPathLength
    };
  }

  private generateHeatMapData(): Array<{ x: number; y: number; intensity: number; duration: number }> {
    return this.getHeatMapData().map(point => ({
      ...point,
      duration: point.intensity * 100 // Approximate duration based on intensity
    }));
  }

  private calculateAttentionAreas(): Array<{
    region: string;
    timeSpent: number;
    percentage: number;
    averageConfidence: number;
  }> {
    // Define screen regions
    const regions = [
      { name: 'Top-Left', bounds: { x1: 0, y1: 0, x2: 50, y2: 50 } },
      { name: 'Top-Right', bounds: { x1: 50, y1: 0, x2: 100, y2: 50 } },
      { name: 'Bottom-Left', bounds: { x1: 0, y1: 50, x2: 50, y2: 100 } },
      { name: 'Bottom-Right', bounds: { x1: 50, y1: 50, x2: 100, y2: 100 } },
      { name: 'Center', bounds: { x1: 25, y1: 25, x2: 75, y2: 75 } }
    ];

    const totalDuration = this.gazeDataStream.length > 0 
      ? this.gazeDataStream[this.gazeDataStream.length - 1].timestamp - this.gazeDataStream[0].timestamp
      : 1;

    return regions.map(region => {
      const pointsInRegion = this.gazeDataStream.filter(point => 
        point.gazePoint.x >= region.bounds.x1 &&
        point.gazePoint.x <= region.bounds.x2 &&
        point.gazePoint.y >= region.bounds.y1 &&
        point.gazePoint.y <= region.bounds.y2
      );

      const timeSpent = pointsInRegion.length * (1000 / this.config.samplingRate); // Approximate time in ms
      const percentage = (timeSpent / totalDuration) * 100;
      const averageConfidence = pointsInRegion.length > 0 
        ? this.calculateAverage(pointsInRegion.map(p => p.confidence))
        : 0;

      return {
        region: region.name,
        timeSpent,
        percentage,
        averageConfidence
      };
    });
  }

  private calculateSystemHealth(): {
    errorRate: number;
    recoveryRate: number;
    systemStability: number;
  } {
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < 60000 // Last minute
    );
    
    const errorRate = recentErrors.length / 60; // Errors per second
    const recoveryRate = this.calculateRecoveryRate();
    const systemStability = Math.max(0, 100 - (errorRate * 10));

    return {
      errorRate,
      recoveryRate,
      systemStability
    };
  }

  private calculateRecoveryRate(): number {
    // Calculate based on successful data points after errors
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < 60000
    );
    
    if (recentErrors.length === 0) return 100;

    let recoveryCount = 0;
    for (const error of recentErrors) {
      const dataAfterError = this.gazeDataStream.filter(
        data => data.timestamp > error.timestamp && data.timestamp < error.timestamp + 5000
      );
      
      if (dataAfterError.some(data => data.confidence > 0.7)) {
        recoveryCount++;
      }
    }

    return (recoveryCount / recentErrors.length) * 100;
  }

  private resetMetrics(): void {
    this.metricsSubject.next({
      sessionDuration: 0,
      totalGazePoints: 0,
      averageConfidence: 0,
      averageTrackingQuality: 0,
      stabilityIndex: 0,
      accuracyIndex: 0,
      averageProcessingTime: 0,
      averageFrameRate: 0,
      performanceScore: 0,
      gazePatterns: {
        fixationCount: 0,
        saccadeCount: 0,
        averageFixationDuration: 0,
        scanPathLength: 0
      },
      heatMapData: [],
      attentionAreas: [],
      systemHealth: {
        errorRate: 0,
        recoveryRate: 100,
        systemStability: 100
      }
    });
  }

  private resetRealTimeStats(): void {
    this.realTimeStatsSubject.next({
      current: {
        gazePoint: { x: 0, y: 0 },
        confidence: 0,
        quality: 0,
        fps: 0,
        latency: 0
      },
      recent: {
        averageConfidence: 0,
        averageQuality: 0,
        averageFps: 0,
        averageLatency: 0,
        stability: 0
      },
      session: {
        duration: 0,
        totalPoints: 0,
        errorCount: 0,
        successRate: 0
      },
      trends: {
        confidenceTrend: 'stable',
        qualityTrend: 'stable',
        performanceTrend: 'stable'
      }
    });
  }
}
