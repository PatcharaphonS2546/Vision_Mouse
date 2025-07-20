// optimization.worker.ts
// Web Worker for performance optimization calculations

interface PerformanceData {
  history: any[];
  config: any;
}

interface OptimizationRecommendation {
  type: 'memory' | 'cpu' | 'quality' | 'thermal';
  action: string;
  impact: 'minimal' | 'low' | 'medium' | 'high';
  gain: number;
  confidence: number;
}

class OptimizationWorker {
  private analysisBuffer: any[] = [];
  private readonly ANALYSIS_BUFFER_SIZE = 100;

  constructor() {
    console.log('Optimization worker initialized');
  }

  // Main message handler
  handleMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    switch (type) {
      case 'analyze_performance':
        this.analyzePerformance(data);
        break;
      case 'predict_optimization':
        this.analyzePerformance(data); // Use same analysis for prediction
        break;
      case 'calculate_trends':
        this.postMessage({
          type: 'trend_analysis',
          trends: this.calculateDetailedTrends(data.history || []),
          timestamp: Date.now()
        });
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  }

  // Analyze performance data and generate recommendations
  private analyzePerformance(data: PerformanceData): void {
    const { history, config } = data;
    
    if (history.length < 10) {
      return; // Not enough data for analysis
    }

    const recommendations: OptimizationRecommendation[] = [];
    
    // Add to analysis buffer
    this.analysisBuffer.push(...history);
    if (this.analysisBuffer.length > this.ANALYSIS_BUFFER_SIZE) {
      this.analysisBuffer = this.analysisBuffer.slice(-this.ANALYSIS_BUFFER_SIZE);
    }

    // Analyze FPS trends
    const fpsAnalysis = this.analyzeFPSTrends(history, config);
    if (fpsAnalysis) {
      recommendations.push(fpsAnalysis);
    }

    // Analyze memory trends
    const memoryAnalysis = this.analyzeMemoryTrends(history, config);
    if (memoryAnalysis) {
      recommendations.push(memoryAnalysis);
    }

    // Analyze latency patterns
    const latencyAnalysis = this.analyzeLatencyPatterns(history, config);
    if (latencyAnalysis) {
      recommendations.push(latencyAnalysis);
    }

    // Analyze quality vs performance balance
    const qualityAnalysis = this.analyzeQualityBalance(history, config);
    if (qualityAnalysis) {
      recommendations.push(qualityAnalysis);
    }

    // Send recommendations back to main thread
    if (recommendations.length > 0) {
      this.postMessage({
        type: 'optimization_recommendation',
        recommendations,
        timestamp: Date.now()
      });
    }

    // Send detailed analysis
    this.postMessage({
      type: 'performance_analysis',
      analysis: {
        trends: this.calculateDetailedTrends(history),
        predictions: this.generatePredictions(history, config),
        recommendations,
        confidence: this.calculateOverallConfidence(recommendations)
      }
    });
  }

  // Analyze FPS trends and recommend optimizations
  private analyzeFPSTrends(history: any[], config: any): OptimizationRecommendation | null {
    const fpsValues = history.map(h => h.currentFPS);
    const avgFPS = this.calculateAverage(fpsValues);
    const fpsTrend = this.calculateTrend(fpsValues);
    const fpsVariance = this.calculateVariance(fpsValues);

    // Declining FPS trend
    if (fpsTrend < -0.5 && avgFPS < config.targetFPS * 0.9) {
      return {
        type: 'cpu',
        action: 'reduce_processing_load',
        impact: 'medium',
        gain: Math.abs(fpsTrend) * 10,
        confidence: 0.8
      };
    }

    // High FPS variance (unstable performance)
    if (fpsVariance > 25 && avgFPS < config.targetFPS) {
      return {
        type: 'cpu',
        action: 'stabilize_frame_rate',
        impact: 'low',
        gain: 15,
        confidence: 0.7
      };
    }

    // Opportunity to increase quality
    if (avgFPS > config.targetFPS * 1.3 && fpsTrend > 0.2) {
      return {
        type: 'quality',
        action: 'increase_processing_quality',
        impact: 'low',
        gain: 20,
        confidence: 0.6
      };
    }

    return null;
  }

  // Analyze memory usage patterns
  private analyzeMemoryTrends(history: any[], config: any): OptimizationRecommendation | null {
    const memoryValues = history.map(h => h.memoryUsage);
    const avgMemory = this.calculateAverage(memoryValues);
    const memoryTrend = this.calculateTrend(memoryValues);
    const peakMemory = Math.max(...memoryValues);

    // Memory leak detection
    if (memoryTrend > 0.5 && avgMemory > config.maxMemoryUsage * 0.7) {
      return {
        type: 'memory',
        action: 'aggressive_memory_cleanup',
        impact: 'high',
        gain: 30,
        confidence: 0.9
      };
    }

    // High memory usage
    if (peakMemory > config.maxMemoryUsage * 0.9) {
      return {
        type: 'memory',
        action: 'optimize_memory_allocation',
        impact: 'medium',
        gain: 25,
        confidence: 0.8
      };
    }

    // Memory fragmentation indication
    const memoryVariance = this.calculateVariance(memoryValues);
    if (memoryVariance > 100 && avgMemory > config.maxMemoryUsage * 0.6) {
      return {
        type: 'memory',
        action: 'defragment_memory_pools',
        impact: 'low',
        gain: 15,
        confidence: 0.6
      };
    }

    return null;
  }

  // Analyze latency patterns
  private analyzeLatencyPatterns(history: any[], config: any): OptimizationRecommendation | null {
    const latencyValues = history.map(h => h.currentLatency);
    const avgLatency = this.calculateAverage(latencyValues);
    const latencyTrend = this.calculateTrend(latencyValues);
    const p95Latency = this.calculatePercentile(latencyValues, 95);

    // High latency
    if (avgLatency > config.maxLatency * 1.2) {
      return {
        type: 'cpu',
        action: 'optimize_processing_pipeline',
        impact: 'high',
        gain: 40,
        confidence: 0.9
      };
    }

    // Increasing latency trend
    if (latencyTrend > 1.0 && avgLatency > config.maxLatency * 0.8) {
      return {
        type: 'cpu',
        action: 'prevent_latency_degradation',
        impact: 'medium',
        gain: 25,
        confidence: 0.7
      };
    }

    // High latency spikes
    if (p95Latency > config.maxLatency * 2) {
      return {
        type: 'cpu',
        action: 'reduce_latency_spikes',
        impact: 'medium',
        gain: 30,
        confidence: 0.8
      };
    }

    return null;
  }

  // Analyze quality vs performance balance
  private analyzeQualityBalance(history: any[], config: any): OptimizationRecommendation | null {
    const qualityValues = history.map(h => h.processingQuality);
    const fpsValues = history.map(h => h.currentFPS);
    
    const avgQuality = this.calculateAverage(qualityValues);
    const avgFPS = this.calculateAverage(fpsValues);

    // Quality too low while performance is good
    if (avgQuality < 60 && avgFPS > config.targetFPS * 1.1) {
      return {
        type: 'quality',
        action: 'restore_processing_quality',
        impact: 'low',
        gain: 20,
        confidence: 0.7
      };
    }

    // Quality too high while performance is poor
    if (avgQuality > 90 && avgFPS < config.targetFPS * 0.8) {
      return {
        type: 'quality',
        action: 'reduce_quality_for_performance',
        impact: 'medium',
        gain: 35,
        confidence: 0.8
      };
    }

    return null;
  }

  // Calculate detailed performance trends
  private calculateDetailedTrends(history: any[]): any {
    const fpsValues = history.map(h => h.currentFPS);
    const latencyValues = history.map(h => h.currentLatency);
    const memoryValues = history.map(h => h.memoryUsage);
    const qualityValues = history.map(h => h.processingQuality);

    return {
      fps: {
        trend: this.calculateTrend(fpsValues),
        variance: this.calculateVariance(fpsValues),
        stability: this.calculateStability(fpsValues)
      },
      latency: {
        trend: this.calculateTrend(latencyValues),
        variance: this.calculateVariance(latencyValues),
        spikes: this.detectSpikes(latencyValues)
      },
      memory: {
        trend: this.calculateTrend(memoryValues),
        variance: this.calculateVariance(memoryValues),
        leakIndication: this.detectMemoryLeak(memoryValues)
      },
      quality: {
        trend: this.calculateTrend(qualityValues),
        variance: this.calculateVariance(qualityValues),
        degradation: this.detectQualityDegradation(qualityValues)
      }
    };
  }

  // Generate performance predictions
  private generatePredictions(history: any[], config: any): any {
    if (history.length < 20) {
      return null;
    }

    const fpsValues = history.map(h => h.currentFPS);
    const latencyValues = history.map(h => h.currentLatency);
    const memoryValues = history.map(h => h.memoryUsage);

    return {
      nextFPS: this.predictNextValue(fpsValues),
      nextLatency: this.predictNextValue(latencyValues),
      nextMemoryUsage: this.predictNextValue(memoryValues),
      performanceDegradationRisk: this.calculateDegradationRisk(history),
      timeToOptimization: this.estimateOptimizationTime(history, config)
    };
  }

  // Predict next value using simple linear regression
  private predictNextValue(values: number[]): number {
    if (values.length < 3) return values[values.length - 1] || 0;

    const n = values.length;
    const x = values.map((_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return slope * n + intercept;
  }

  // Calculate performance degradation risk
  private calculateDegradationRisk(history: any[]): number {
    const recent = history.slice(-10);
    const older = history.slice(-20, -10);

    if (recent.length < 5 || older.length < 5) return 0;

    const recentFPS = this.calculateAverage(recent.map(h => h.currentFPS));
    const olderFPS = this.calculateAverage(older.map(h => h.currentFPS));
    
    const recentLatency = this.calculateAverage(recent.map(h => h.currentLatency));
    const olderLatency = this.calculateAverage(older.map(h => h.currentLatency));

    let risk = 0;
    
    // FPS degradation
    if (recentFPS < olderFPS * 0.95) risk += 30;
    
    // Latency increase
    if (recentLatency > olderLatency * 1.05) risk += 25;
    
    // Memory trend
    const recentMemory = this.calculateAverage(recent.map(h => h.memoryUsage));
    const olderMemory = this.calculateAverage(older.map(h => h.memoryUsage));
    if (recentMemory > olderMemory * 1.1) risk += 20;

    return Math.min(100, risk);
  }

  // Estimate time until optimization needed
  private estimateOptimizationTime(history: any[], config: any): number {
    const fpsValues = history.map(h => h.currentFPS);
    const trend = this.calculateTrend(fpsValues);
    
    if (trend >= 0) return -1; // Performance is stable or improving
    
    const currentFPS = fpsValues[fpsValues.length - 1];
    const targetFPS = config.targetFPS * 0.8; // 80% of target as threshold
    
    if (currentFPS <= targetFPS) return 0; // Need optimization now
    
    // Estimate time based on trend
    const fpsDeclineRate = Math.abs(trend);
    const timeToThreshold = (currentFPS - targetFPS) / fpsDeclineRate;
    
    return Math.max(0, timeToThreshold);
  }

  // Calculate overall confidence in recommendations
  private calculateOverallConfidence(recommendations: OptimizationRecommendation[]): number {
    if (recommendations.length === 0) return 0;
    
    const avgConfidence = recommendations.reduce((sum, rec) => sum + rec.confidence, 0) / recommendations.length;
    const impactWeight = recommendations.reduce((sum, rec) => {
      const weight = rec.impact === 'high' ? 1.0 : rec.impact === 'medium' ? 0.8 : 0.6;
      return sum + weight;
    }, 0) / recommendations.length;
    
    return avgConfidence * impactWeight;
  }

  // Utility functions
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mid = Math.floor(values.length / 2);
    const first = values.slice(0, mid);
    const second = values.slice(mid);
    
    const firstAvg = this.calculateAverage(first);
    const secondAvg = this.calculateAverage(second);
    
    return secondAvg - firstAvg;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const avg = this.calculateAverage(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    return this.calculateAverage(squaredDiffs);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index] || 0;
  }

  private calculateStability(values: number[]): number {
    const variance = this.calculateVariance(values);
    const avg = this.calculateAverage(values);
    
    if (avg === 0) return 0;
    
    const cv = Math.sqrt(variance) / avg; // Coefficient of variation
    return Math.max(0, 100 - cv * 100); // Stability score (0-100)
  }

  private detectSpikes(values: number[]): number {
    if (values.length < 3) return 0;
    
    const avg = this.calculateAverage(values);
    const stdDev = Math.sqrt(this.calculateVariance(values));
    const threshold = avg + stdDev * 2;
    
    return values.filter(val => val > threshold).length;
  }

  private detectMemoryLeak(values: number[]): boolean {
    if (values.length < 10) return false;
    
    const trend = this.calculateTrend(values);
    const recentTrend = this.calculateTrend(values.slice(-5));
    
    return trend > 0.5 && recentTrend > 0.3;
  }

  private detectQualityDegradation(values: number[]): boolean {
    if (values.length < 5) return false;
    
    const trend = this.calculateTrend(values);
    const avg = this.calculateAverage(values);
    
    return trend < -2 && avg < 70;
  }

  // Post message back to main thread
  private postMessage(data: any): void {
    (self as any).postMessage(data);
  }
}

// Initialize worker
const worker = new OptimizationWorker();

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  worker.handleMessage(event);
});

// Export for TypeScript compilation
export default null;
