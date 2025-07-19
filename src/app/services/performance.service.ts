import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';

export interface SystemPerformance {
  frameRate: number;
  averageProcessingTime: number;
  memoryUsage: number;
  cpuUsage: number;
  gpuSupport: boolean;
  status: 'excellent' | 'good' | 'poor' | 'critical';
}

export interface PerformanceMetrics {
  timestamp: number;
  frameProcessingTime: number;
  detectionTime: number;
  gazeEstimationTime: number;
  totalTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceService {
  private systemPerformance$ = new BehaviorSubject<SystemPerformance>({
    frameRate: 0,
    averageProcessingTime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    gpuSupport: false,
    status: 'poor'
  });

  private metrics: PerformanceMetrics[] = [];
  private frameCount = 0;
  private startTime = window.performance.now();
  private lastFrameTime = 0;

  // Performance thresholds
  private readonly thresholds = {
    excellent: { fps: 50, processingTime: 20 },
    good: { fps: 30, processingTime: 33 },
    poor: { fps: 15, processingTime: 66 },
    critical: { fps: 10, processingTime: 100 }
  };

  constructor() {
    this.initializePerformanceMonitoring();
    this.detectGPUSupport();
  }

  // Initialize performance monitoring
  private initializePerformanceMonitoring(): void {
    // Monitor every second
    interval(1000).subscribe(() => {
      this.updatePerformanceMetrics();
    });

    // Reset metrics every 30 seconds to prevent memory buildup
    interval(30000).subscribe(() => {
      this.resetMetrics();
    });
  }

  // Detect GPU support
  private detectGPUSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      const hasWebGL = !!gl;
      
      this.updateGPUSupport(hasWebGL);
      return hasWebGL;
    } catch (error) {
      this.updateGPUSupport(false);
      return false;
    }
  }

  // Record frame processing metrics
  recordFrameMetrics(metrics: Partial<PerformanceMetrics>): void {
    const now = window.performance.now();
    
    const frameMetrics: PerformanceMetrics = {
      timestamp: now,
      frameProcessingTime: metrics.frameProcessingTime || 0,
      detectionTime: metrics.detectionTime || 0,
      gazeEstimationTime: metrics.gazeEstimationTime || 0,
      totalTime: metrics.totalTime || 0
    };

    this.metrics.push(frameMetrics);
    this.frameCount++;

    // Calculate frame rate
    if (this.lastFrameTime > 0) {
      const deltaTime = now - this.lastFrameTime;
      // Update FPS calculation
    }
    
    this.lastFrameTime = now;

    // Keep only last 60 measurements
    if (this.metrics.length > 60) {
      this.metrics = this.metrics.slice(-60);
    }
  }

  // Update performance metrics
  private updatePerformanceMetrics(): void {
    if (this.metrics.length === 0) return;

    const now = window.performance.now();
    const timeSpan = now - this.startTime;
    const fps = this.frameCount / (timeSpan / 1000);

    // Calculate average processing times
    const avgProcessingTime = this.calculateAverageProcessingTime();
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.estimateCPUUsage();
    const status = this.determineStatus(fps, avgProcessingTime);

    const performanceData: SystemPerformance = {
      frameRate: Math.round(fps * 10) / 10,
      averageProcessingTime: Math.round(avgProcessingTime * 10) / 10,
      memoryUsage,
      cpuUsage,
      gpuSupport: this.systemPerformance$.value.gpuSupport,
      status
    };

    this.systemPerformance$.next(performanceData);
  }

  // Calculate average processing time
  private calculateAverageProcessingTime(): number {
    if (this.metrics.length === 0) return 0;

    const totalTime = this.metrics.reduce((sum, metric) => sum + metric.totalTime, 0);
    return totalTime / this.metrics.length;
  }

  // Get memory usage
  private getMemoryUsage(): number {
    try {
      const memoryInfo = (window.performance as any).memory;
      if (memoryInfo) {
        return Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024); // MB
      }
    } catch (error) {
      console.warn('Memory API not available');
    }
    return 0;
  }

  // Estimate CPU usage (simplified)
  private estimateCPUUsage(): number {
    // This is a simplified estimation based on processing times
    const avgTime = this.calculateAverageProcessingTime();
    if (avgTime === 0) return 0;

    // Estimate based on target 60 FPS (16.67ms per frame)
    const targetTime = 16.67;
    const usage = Math.min(100, (avgTime / targetTime) * 100);
    
    return Math.round(usage);
  }

  // Determine system status
  private determineStatus(fps: number, avgTime: number): 'excellent' | 'good' | 'poor' | 'critical' {
    if (fps >= this.thresholds.excellent.fps && avgTime <= this.thresholds.excellent.processingTime) {
      return 'excellent';
    } else if (fps >= this.thresholds.good.fps && avgTime <= this.thresholds.good.processingTime) {
      return 'good';
    } else if (fps >= this.thresholds.poor.fps && avgTime <= this.thresholds.poor.processingTime) {
      return 'poor';
    } else {
      return 'critical';
    }
  }

  // Update GPU support status
  private updateGPUSupport(supported: boolean): void {
    const current = this.systemPerformance$.value;
    this.systemPerformance$.next({
      ...current,
      gpuSupport: supported
    });
  }

  // Reset metrics
  private resetMetrics(): void {
    this.metrics = [];
    this.frameCount = 0;
    this.startTime = window.performance.now();
  }

  // Get detailed metrics for analysis
  getDetailedMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // Get performance recommendations
  getPerformanceRecommendations(): string[] {
    const current = this.systemPerformance$.value;
    const recommendations: string[] = [];

    if (current.frameRate < 30) {
      recommendations.push('Frame rate is low. Consider reducing video resolution or adjusting quality settings.');
    }

    if (current.averageProcessingTime > 50) {
      recommendations.push('Processing time is high. Consider enabling hardware acceleration or closing other applications.');
    }

    if (!current.gpuSupport) {
      recommendations.push('GPU acceleration not available. Performance may be limited.');
    }

    if (current.memoryUsage > 500) {
      recommendations.push('High memory usage detected. Consider refreshing the application.');
    }

    if (current.cpuUsage > 80) {
      recommendations.push('High CPU usage detected. Close unnecessary applications for better performance.');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is performing optimally.');
    }

    return recommendations;
  }

  // Get optimal settings based on current performance
  getOptimalSettings(): any {
    const current = this.systemPerformance$.value;
    
    if (current.status === 'critical' || current.status === 'poor') {
      return {
        resolution: { width: 640, height: 480 },
        frameRate: 15,
        qualitySettings: 'low',
        enableGPU: current.gpuSupport
      };
    } else if (current.status === 'good') {
      return {
        resolution: { width: 1280, height: 720 },
        frameRate: 30,
        qualitySettings: 'medium',
        enableGPU: current.gpuSupport
      };
    } else {
      return {
        resolution: { width: 1920, height: 1080 },
        frameRate: 60,
        qualitySettings: 'high',
        enableGPU: current.gpuSupport
      };
    }
  }

  // Observable getter
  get systemPerformance(): Observable<SystemPerformance> {
    return this.systemPerformance$.asObservable();
  }

  // Get current performance snapshot
  get currentPerformance(): SystemPerformance {
    return this.systemPerformance$.value;
  }
}
