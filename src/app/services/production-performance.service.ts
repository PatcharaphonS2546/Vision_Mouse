import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { MemoryPoolService } from './memory-pool.service';

export interface ProductionPerformanceConfig {
  // Performance targets
  targetFPS: number;
  maxLatency: number;
  maxMemoryUsage: number;
  maxCPUUsage: number;
  
  // Optimization modes
  qualityMode: 'ultra-performance' | 'performance' | 'balanced' | 'quality' | 'ultra-quality';
  adaptiveOptimization: boolean;
  aggressiveOptimization: boolean;
  
  // Memory management
  enableMemoryPooling: boolean;
  memoryCleanupInterval: number;
  maxMemoryPoolSize: number;
  
  // Processing optimization
  enableFrameSkipping: boolean;
  enableWebWorkers: boolean;
  enableGPUAcceleration: boolean;
  batchProcessing: boolean;
  
  // Advanced optimization
  enablePredictiveOptimization: boolean;
  enableAdaptiveQuality: boolean;
  emergencyOptimization: boolean;
}

export interface AdvancedPerformanceMetrics {
  // Real-time metrics
  currentFPS: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  
  // Latency metrics
  currentLatency: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  
  // Resource usage
  memoryUsage: number;
  memoryPeak: number;
  cpuUsage: number;
  gpuUsage: number;
  
  // Quality metrics
  processingQuality: number;
  adaptiveQualityLevel: number;
  frameDropRate: number;
  errorRate: number;
  
  // System metrics
  thermalState: 'normal' | 'fair' | 'serious' | 'critical';
  batteryImpact: 'minimal' | 'low' | 'moderate' | 'high';
  networkLatency: number;
  
  // Performance score
  overallScore: number;
  timestamp: number;
}

export interface OptimizationAction {
  id: string;
  type: 'memory' | 'cpu' | 'quality' | 'thermal' | 'emergency';
  action: string;
  impact: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  expectedGain: number;
  appliedAt: number;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductionPerformanceService {
  // Development mode configuration - disable aggressive monitoring
  private readonly isDevelopmentMode = true; // Set to false for production
  
  private config: ProductionPerformanceConfig = {
    targetFPS: 25, // Reduced from 30 for less aggressive optimization
    maxLatency: 40, // Increased tolerance (was 33ms)
    maxMemoryUsage: 300, // Increased from 200MB to 300MB
    maxCPUUsage: 50, // Increased from 30% to 50%
    qualityMode: 'balanced',
    adaptiveOptimization: true,
    aggressiveOptimization: false,
    enableMemoryPooling: true,
    memoryCleanupInterval: 30000, // Increased from 15 to 30 seconds
    maxMemoryPoolSize: 150, // Increased from 100
    enableFrameSkipping: true,
    enableWebWorkers: false, // Disabled temporarily to reduce overhead
    enableGPUAcceleration: true,
    batchProcessing: true,
    enablePredictiveOptimization: false, // Disabled to reduce complexity
    enableAdaptiveQuality: true,
    emergencyOptimization: !this.isDevelopmentMode // Disable emergency optimization in dev mode
  };

  private metrics$ = new BehaviorSubject<AdvancedPerformanceMetrics>({
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
  });

  private optimizationActions: OptimizationAction[] = [];
  private performanceHistory: AdvancedPerformanceMetrics[] = [];
  private latencyHistory: number[] = [];
  private fpsHistory: number[] = [];
  private memoryHistory: number[] = [];
  
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private processingStartTime = 0;
  private isMonitoring = false;
  private webWorker?: Worker;
  private optimizationWorker?: Worker;

  constructor(
    private memoryPool: MemoryPoolService,
    private ngZone: NgZone
  ) {
    this.initializeProductionOptimization();
  }

  // Initialize production-level optimization
  private initializeProductionOptimization(): void {
    if (this.isDevelopmentMode) {
      console.log('Development mode: Production performance optimization disabled');
      return;
    }
    
    console.log('Initializing production performance optimization...');
    
    // Set up quality mode
    this.applyQualityMode(this.config.qualityMode);
    
    // Initialize Web Workers if enabled
    if (this.config.enableWebWorkers) {
      this.initializeWebWorkers();
    }
    
    // Delay monitoring start to allow system to stabilize
    setTimeout(() => {
      this.startAdvancedMonitoring();
    }, 3000); // Wait 3 seconds before starting monitoring
    
    // Set up memory cleanup
    this.setupMemoryCleanup();
    
    // Initialize predictive optimization
    if (this.config.enablePredictiveOptimization) {
      this.initializePredictiveOptimization();
    }

    console.log('Production performance optimization initialized');
  }

  // Start advanced performance monitoring
  startAdvancedMonitoring(): void {
    if (this.isDevelopmentMode) {
      console.log('Development mode: Performance monitoring disabled');
      return;
    }
    
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    
    // Reduced frequency monitoring (10 FPS instead of 60 FPS)
    this.ngZone.runOutsideAngular(() => {
      const monitoringInterval = setInterval(() => {
        if (!this.isMonitoring) {
          clearInterval(monitoringInterval);
          return;
        }
        this.updatePerformanceMetrics();
        this.checkOptimizationTriggers();
      }, 100); // ~10 FPS monitoring (reduced from 16ms)
    });

    // Less frequent comprehensive analysis (every 2 seconds instead of 1)
    interval(2000).subscribe(() => {
      if (this.isMonitoring) {
        this.performComprehensiveAnalysis();
        this.updatePerformanceScore();
      }
    });

    console.log('Advanced performance monitoring started');
  }

  // Stop monitoring
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
  }

  // Record frame processing start
  startFrameProcessing(): void {
    this.processingStartTime = performance.now();
    this.frameCount++;
  }

  // Record frame processing end
  endFrameProcessing(): AdvancedPerformanceMetrics {
    const processingTime = performance.now() - this.processingStartTime;
    const currentTime = performance.now();
    
    // Update latency history
    this.latencyHistory.push(processingTime);
    if (this.latencyHistory.length > 1000) {
      this.latencyHistory = this.latencyHistory.slice(-1000);
    }
    
    // Calculate FPS
    const timeDelta = currentTime - this.lastFrameTime;
    const currentFPS = timeDelta > 0 ? 1000 / timeDelta : 0;
    
    this.fpsHistory.push(currentFPS);
    if (this.fpsHistory.length > 1000) {
      this.fpsHistory = this.fpsHistory.slice(-1000);
    }
    
    this.lastFrameTime = currentTime;
    
    return this.metrics$.value;
  }

  // Update performance metrics
  private updatePerformanceMetrics(): void {
    const currentMetrics = this.metrics$.value;
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.estimateCPUUsage();
    
    // Update memory history
    this.memoryHistory.push(memoryUsage);
    if (this.memoryHistory.length > 300) { // 5 minutes at 1Hz
      this.memoryHistory = this.memoryHistory.slice(-300);
    }
    
    // Calculate percentiles
    const sortedLatencies = [...this.latencyHistory].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);
    
    const updatedMetrics: AdvancedPerformanceMetrics = {
      ...currentMetrics,
      currentFPS: this.fpsHistory.length > 0 ? this.fpsHistory[this.fpsHistory.length - 1] : 0,
      averageFPS: this.calculateAverage(this.fpsHistory),
      minFPS: Math.min(...this.fpsHistory),
      maxFPS: Math.max(...this.fpsHistory),
      currentLatency: this.latencyHistory.length > 0 ? this.latencyHistory[this.latencyHistory.length - 1] : 0,
      averageLatency: this.calculateAverage(this.latencyHistory),
      p95Latency: sortedLatencies[p95Index] || 0,
      p99Latency: sortedLatencies[p99Index] || 0,
      memoryUsage,
      memoryPeak: Math.max(currentMetrics.memoryPeak, memoryUsage),
      cpuUsage,
      frameDropRate: this.calculateFrameDropRate(),
      thermalState: this.estimateThermalState(),
      batteryImpact: this.estimateBatteryImpact(),
      timestamp: Date.now()
    };
    
    this.metrics$.next(updatedMetrics);
    
    // Add to history
    this.performanceHistory.push(updatedMetrics);
    if (this.performanceHistory.length > 3600) { // 1 hour at 1Hz
      this.performanceHistory = this.performanceHistory.slice(-3600);
    }
  }

  // Check for optimization triggers
  private checkOptimizationTriggers(): void {
    if (this.isDevelopmentMode) {
      return; // Skip optimization triggers in development mode
    }
    
    const metrics = this.metrics$.value;
    const actions: OptimizationAction[] = [];
    
    // Critical performance triggers (made less sensitive)
    if (metrics.currentFPS < this.config.targetFPS * 0.3) { // Changed from 0.5 to 0.3
      actions.push(this.createOptimizationAction('emergency', 'critical_fps_drop', 'critical', 50));
    }
    
    // Memory pressure triggers (made less sensitive)
    if (metrics.memoryUsage > this.config.maxMemoryUsage * 0.95) { // Changed from 0.9 to 0.95
      actions.push(this.createOptimizationAction('memory', 'high_memory_usage', 'high', 30));
    }
    
    // CPU pressure triggers (made less sensitive)
    if (metrics.cpuUsage > this.config.maxCPUUsage * 0.9) { // Changed from 0.8 to 0.9
      actions.push(this.createOptimizationAction('cpu', 'high_cpu_usage', 'medium', 20));
    }
    
    // Thermal triggers
    if (metrics.thermalState === 'critical' || metrics.thermalState === 'serious') {
      actions.push(this.createOptimizationAction('thermal', 'thermal_throttling', 'high', 40));
    }
    
    // Quality degradation triggers
    if (metrics.processingQuality < 30 && metrics.currentFPS > this.config.targetFPS * 1.2) { // Changed from 50 to 30
      actions.push(this.createOptimizationAction('quality', 'restore_quality', 'low', 10));
    }
    
    // Apply optimizations
    actions.forEach(action => this.applyOptimizationAction(action));
  }

  // Apply quality mode
  private applyQualityMode(mode: ProductionPerformanceConfig['qualityMode']): void {
    console.log(`Applying quality mode: ${mode}`);
    
    switch (mode) {
      case 'ultra-performance':
        this.config.targetFPS = 15;
        this.config.maxLatency = 66;
        this.config.aggressiveOptimization = true;
        break;
        
      case 'performance':
        this.config.targetFPS = 20;
        this.config.maxLatency = 50;
        this.config.aggressiveOptimization = true;
        break;
        
      case 'balanced':
        this.config.targetFPS = 30;
        this.config.maxLatency = 33;
        this.config.aggressiveOptimization = false;
        break;
        
      case 'quality':
        this.config.targetFPS = 45;
        this.config.maxLatency = 22;
        this.config.aggressiveOptimization = false;
        break;
        
      case 'ultra-quality':
        this.config.targetFPS = 60;
        this.config.maxLatency = 16;
        this.config.aggressiveOptimization = false;
        break;
    }
  }

  // Initialize Web Workers
  private initializeWebWorkers(): void {
    try {
      // Performance monitoring worker
      this.optimizationWorker = new Worker(new URL('../workers/optimization.worker', import.meta.url));
      this.optimizationWorker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };
      
      console.log('Web Workers initialized');
    } catch (error) {
      console.warn('Web Workers not available:', error);
      this.config.enableWebWorkers = false;
    }
  }

  // Handle worker messages
  private handleWorkerMessage(data: any): void {
    switch (data.type) {
      case 'optimization_recommendation':
        this.applyWorkerOptimization(data.optimization);
        break;
      case 'performance_analysis':
        this.handlePerformanceAnalysis(data.analysis);
        break;
    }
  }

  // Apply worker optimization
  private applyWorkerOptimization(optimization: any): void {
    const action = this.createOptimizationAction(
      optimization.type,
      optimization.action,
      optimization.impact,
      optimization.expectedGain
    );
    this.applyOptimizationAction(action);
  }

  // Setup memory cleanup
  private setupMemoryCleanup(): void {
    if (!this.config.enableMemoryPooling) return;
    
    setInterval(() => {
      this.performMemoryCleanup();
    }, this.config.memoryCleanupInterval);
  }

  // Perform memory cleanup
  private performMemoryCleanup(): void {
    if (this.isDevelopmentMode) {
      // Silent cleanup in development mode - no logging
      this.memoryPool.optimizeMemory();
      return;
    }
    
    const beforeMemory = this.getMemoryUsage();
    
    // Clean memory pools
    this.memoryPool.optimizeMemory();
    
    // Clean performance history if too large
    if (this.performanceHistory.length > 1800) { // 30 minutes
      this.performanceHistory = this.performanceHistory.slice(-1800);
    }
    
    // Clean optimization actions history
    if (this.optimizationActions.length > 100) {
      this.optimizationActions = this.optimizationActions.slice(-100);
    }
    
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
    
    const afterMemory = this.getMemoryUsage();
    const memoryFreed = beforeMemory - afterMemory;
    
    if (memoryFreed > 5) { // If freed more than 5MB
      console.log(`Memory cleanup: freed ${memoryFreed.toFixed(2)}MB`);
    }
  }

  // Initialize predictive optimization
  private initializePredictiveOptimization(): void {
    // Send data to worker for analysis every 5 seconds
    setInterval(() => {
      if (this.optimizationWorker && this.performanceHistory.length > 10) {
        this.optimizationWorker.postMessage({
          type: 'analyze_performance',
          data: {
            history: this.performanceHistory.slice(-60), // Last minute
            config: this.config
          }
        });
      }
    }, 5000);
  }

  // Perform comprehensive analysis
  private performComprehensiveAnalysis(): void {
    const metrics = this.metrics$.value;
    
    // Analyze performance trends
    if (this.performanceHistory.length > 30) {
      const recentHistory = this.performanceHistory.slice(-30);
      const fpsArray = recentHistory.map(m => m.currentFPS);
      const latencyArray = recentHistory.map(m => m.currentLatency);
      
      // Detect performance degradation
      const fpsTrend = this.calculateTrend(fpsArray);
      const latencyTrend = this.calculateTrend(latencyArray);
      
      if (fpsTrend < -0.5) { // FPS declining
        this.applyOptimizationAction(
          this.createOptimizationAction('cpu', 'performance_degradation', 'medium', 25)
        );
      }
      
      if (latencyTrend > 0.5) { // Latency increasing
        this.applyOptimizationAction(
          this.createOptimizationAction('cpu', 'latency_increase', 'medium', 20)
        );
      }
    }
  }

  // Update overall performance score
  private updatePerformanceScore(): void {
    const metrics = this.metrics$.value;
    let score = 100;
    
    // FPS score (40% weight)
    const fpsRatio = metrics.averageFPS / this.config.targetFPS;
    const fpsScore = Math.min(100, fpsRatio * 100);
    score = score * 0.4 + fpsScore * 0.4;
    
    // Latency score (30% weight)
    const latencyRatio = this.config.maxLatency / Math.max(metrics.averageLatency, 1);
    const latencyScore = Math.min(100, latencyRatio * 100);
    score = score * 0.7 + latencyScore * 0.3;
    
    // Memory score (20% weight)
    const memoryRatio = (this.config.maxMemoryUsage - metrics.memoryUsage) / this.config.maxMemoryUsage;
    const memoryScore = Math.max(0, memoryRatio * 100);
    score = score * 0.8 + memoryScore * 0.2;
    
    // Quality score (10% weight)
    score = score * 0.9 + metrics.processingQuality * 0.1;
    
    const currentMetrics = this.metrics$.value;
    this.metrics$.next({
      ...currentMetrics,
      overallScore: Math.round(score)
    });
  }

  // Create optimization action
  private createOptimizationAction(
    type: OptimizationAction['type'],
    action: string,
    impact: OptimizationAction['impact'],
    expectedGain: number
  ): OptimizationAction {
    return {
      id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      action,
      impact,
      expectedGain,
      appliedAt: Date.now()
    };
  }

  // Apply optimization action
  private applyOptimizationAction(action: OptimizationAction): void {
    // Reduced logging frequency to minimize overhead
    if (action.impact === 'critical' || action.impact === 'high') {
      console.log(`Applying optimization: ${action.action} (${action.impact} impact)`);
    }
    
    switch (action.type) {
      case 'memory':
        this.performMemoryCleanup();
        break;
        
      case 'cpu':
        this.applyCPUOptimization(action);
        break;
        
      case 'quality':
        this.applyQualityOptimization(action);
        break;
        
      case 'thermal':
        this.applyThermalOptimization(action);
        break;
        
      case 'emergency':
        this.applyEmergencyOptimization(action);
        break;
    }
    
    this.optimizationActions.push(action);
  }

  // Apply CPU optimization
  private applyCPUOptimization(action: OptimizationAction): void {
    if (action.action.includes('high_cpu_usage')) {
      // Reduce processing frequency
      this.config.targetFPS = Math.max(15, this.config.targetFPS * 0.8);
    }
  }

  // Apply quality optimization
  private applyQualityOptimization(action: OptimizationAction): void {
    const currentMetrics = this.metrics$.value;
    if (action.action.includes('restore_quality')) {
      // Gradually restore quality
      const newQuality = Math.min(100, currentMetrics.processingQuality + 10);
      this.metrics$.next({
        ...currentMetrics,
        processingQuality: newQuality,
        adaptiveQualityLevel: newQuality
      });
    }
  }

  // Apply thermal optimization
  private applyThermalOptimization(action: OptimizationAction): void {
    // Aggressive performance reduction for thermal management
    this.config.targetFPS = Math.max(10, this.config.targetFPS * 0.6);
    this.config.aggressiveOptimization = true;
  }

  // Apply emergency optimization
  private applyEmergencyOptimization(action: OptimizationAction): void {
    // Reduced logging to minimize overhead
    if (this.config.aggressiveOptimization === false) {
      console.warn('Applying emergency optimization due to critical performance issues');
    }
    
    // Emergency mode: maximum performance optimization
    this.config.targetFPS = 15; // Increased from 10 to be less aggressive
    this.config.aggressiveOptimization = true;
    
    // Immediate memory cleanup
    this.performMemoryCleanup();
    
    // Reduce quality moderately (was too aggressive)
    const currentMetrics = this.metrics$.value;
    this.metrics$.next({
      ...currentMetrics,
      processingQuality: 50, // Increased from 30
      adaptiveQualityLevel: 50 // Increased from 30
    });
  }

  // Utility methods
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const first = values.slice(0, Math.floor(values.length / 2));
    const second = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = this.calculateAverage(first);
    const secondAvg = this.calculateAverage(second);
    
    return secondAvg - firstAvg;
  }

  private calculateFrameDropRate(): number {
    if (this.fpsHistory.length < 10) return 0;
    
    const targetFrameTime = 1000 / this.config.targetFPS;
    const droppedFrames = this.fpsHistory.filter(fps => fps < this.config.targetFPS * 0.8).length;
    
    return (droppedFrames / this.fpsHistory.length) * 100;
  }

  private getMemoryUsage(): number {
    try {
      const memoryInfo = (window.performance as any).memory;
      if (memoryInfo) {
        return Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024); // MB
      }
    } catch (error) {
      // Fallback estimation
    }
    return this.memoryPool.getTotalMemoryUsage() + 50; // Base usage estimate
  }

  private estimateCPUUsage(): number {
    // Estimate based on frame processing time
    const metrics = this.metrics$.value;
    const frameTime = 1000 / Math.max(metrics.currentFPS, 1);
    const processingRatio = metrics.currentLatency / frameTime;
    return Math.min(100, processingRatio * 100);
  }

  private estimateThermalState(): AdvancedPerformanceMetrics['thermalState'] {
    const metrics = this.metrics$.value;
    
    if (metrics.cpuUsage > 80 && metrics.frameDropRate > 20) {
      return 'critical';
    } else if (metrics.cpuUsage > 60 && metrics.frameDropRate > 10) {
      return 'serious';
    } else if (metrics.cpuUsage > 40) {
      return 'fair';
    } else {
      return 'normal';
    }
  }

  private estimateBatteryImpact(): AdvancedPerformanceMetrics['batteryImpact'] {
    const metrics = this.metrics$.value;
    
    if (metrics.cpuUsage > 50 && metrics.currentFPS > 30) {
      return 'high';
    } else if (metrics.cpuUsage > 30 && metrics.currentFPS > 20) {
      return 'moderate';
    } else if (metrics.cpuUsage > 15) {
      return 'low';
    } else {
      return 'minimal';
    }
  }

  private handlePerformanceAnalysis(analysis: any): void {
    // Handle analysis results from worker
    if (analysis.recommendations) {
      analysis.recommendations.forEach((rec: any) => {
        const action = this.createOptimizationAction(rec.type, rec.action, rec.impact, rec.gain);
        this.applyOptimizationAction(action);
      });
    }
  }

  // Public API
  get performanceMetrics$(): Observable<AdvancedPerformanceMetrics> {
    return this.metrics$.asObservable();
  }

  getPerformanceHistory(): AdvancedPerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  getOptimizationActions(): OptimizationAction[] {
    return [...this.optimizationActions];
  }

  updateConfiguration(newConfig: Partial<ProductionPerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.qualityMode) {
      this.applyQualityMode(newConfig.qualityMode);
    }
    
    console.log('Performance configuration updated', newConfig);
  }

  getConfiguration(): ProductionPerformanceConfig {
    return { ...this.config };
  }

  // Development mode control
  enableDevelopmentMode(enabled: boolean = true): void {
    (this as any).isDevelopmentMode = enabled;
    if (enabled) {
      this.stopMonitoring();
      console.log('Production performance service: Development mode enabled - monitoring disabled');
    } else {
      this.startAdvancedMonitoring();
      console.log('Production performance service: Development mode disabled - monitoring enabled');
    }
  }

  // Force optimization
  forceOptimization(): void {
    if (this.isDevelopmentMode) {
      console.log('Development mode: Force optimization disabled');
      return;
    }
    
    const emergencyAction = this.createOptimizationAction('emergency', 'manual_optimization', 'medium', 30);
    this.applyOptimizationAction(emergencyAction);
  }

  // Reset performance tracking
  resetPerformanceTracking(): void {
    this.performanceHistory = [];
    this.optimizationActions = [];
    this.latencyHistory = [];
    this.fpsHistory = [];
    this.memoryHistory = [];
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    
    console.log('Performance tracking reset');
  }
}
