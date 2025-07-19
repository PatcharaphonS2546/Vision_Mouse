import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';

import { GazeEstimationService } from '../../services/gaze-estimation.service';
import { CalibrationService } from '../../services/calibration.service';
import { SmartCalibrationService } from '../../services/ai-ml/smart-calibration.service';
import { NeuralNetworkService } from '../../services/ai-ml/neural-network.service';
import { PredictiveAnalyticsService } from '../../services/ai-ml/predictive-analytics.service';
import { AdaptiveLearningService } from '../../services/ai-ml/adaptive-learning.service';

interface DashboardMetrics {
  gazeAccuracy: number;
  calibrationQuality: number;
  aiConfidence: number;
  networkLatency: number;
  frameRate: number;
  dataPoints: number;
  sessionDuration: number;
  improveScore: number;
  predictionAccuracy: number;
  adaptationRate: number;
}

interface SystemStatus {
  camera: 'connected' | 'disconnected' | 'error';
  calibration: 'none' | 'partial' | 'complete' | 'expired';
  tracking: 'inactive' | 'active' | 'paused' | 'error';
  ai: 'disabled' | 'loading' | 'active' | 'error';
  network: 'offline' | 'slow' | 'normal' | 'fast';
}

@Component({
  selector: 'app-modern-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modern-dashboard">
      <!-- Header Section -->
      <header class="dashboard-header">
        <div class="header-content">
          <div class="brand">
            <h1 class="ai-title">Vision Mouse</h1>
            <p class="text-sm text-secondary">AI-Powered Gaze Estimation</p>
          </div>
          
          <div class="header-actions">
            <button class="btn btn-ghost btn-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </button>
            
            <div class="status-indicator" [ngClass]="'status-' + systemStatus.ai">
              <div class="status-dot"></div>
              <span class="status-text">{{ getAiStatusText() }}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Dashboard Grid -->
      <main class="dashboard-main">
        <!-- System Status Cards -->
        <section class="status-section">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Camera Status -->
            <div class="card card-elevated">
              <div class="card-body">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="data-label">Camera</p>
                    <p class="text-lg font-semibold" [ngClass]="getCameraStatusColor()">
                      {{ getCameraStatusText() }}
                    </p>
                  </div>
                  <div class="status-icon" [ngClass]="'status-' + systemStatus.camera">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Calibration Status -->
            <div class="card card-elevated">
              <div class="card-body">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="data-label">Calibration</p>
                    <p class="text-lg font-semibold" [ngClass]="getCalibrationStatusColor()">
                      {{ getCalibrationStatusText() }}
                    </p>
                  </div>
                  <div class="status-icon" [ngClass]="'status-' + systemStatus.calibration">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tracking Status -->
            <div class="card card-elevated">
              <div class="card-body">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="data-label">Tracking</p>
                    <p class="text-lg font-semibold" [ngClass]="getTrackingStatusColor()">
                      {{ getTrackingStatusText() }}
                    </p>
                  </div>
                  <div class="status-icon" [ngClass]="'status-' + systemStatus.tracking">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- AI Status -->
            <div class="card card-elevated">
              <div class="card-body">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="data-label">AI Engine</p>
                    <p class="text-lg font-semibold" [ngClass]="getAiStatusColor()">
                      {{ getAiStatusText() }}
                    </p>
                  </div>
                  <div class="status-icon" [ngClass]="'status-' + systemStatus.ai">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Metrics Dashboard -->
        <section class="metrics-section mt-8">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Real-time Metrics -->
            <div class="card card-elevated lg:col-span-2">
              <div class="card-header">
                <h3 class="card-title">Real-time Performance</h3>
                <p class="card-subtitle">Live system metrics and AI performance</p>
              </div>
              <div class="card-body">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div class="metric-card">
                    <p class="data-label">Gaze Accuracy</p>
                    <p class="metric-large text-primary">{{ metrics.gazeAccuracy.toFixed(1) }}%</p>
                    <div class="progress mt-2">
                      <div class="progress-bar" [style.width.%]="metrics.gazeAccuracy"></div>
                    </div>
                  </div>
                  
                  <div class="metric-card">
                    <p class="data-label">AI Confidence</p>
                    <p class="metric-large text-neural">{{ metrics.aiConfidence.toFixed(1) }}%</p>
                    <div class="progress mt-2">
                      <div class="progress-bar bg-neural-500" [style.width.%]="metrics.aiConfidence"></div>
                    </div>
                  </div>
                  
                  <div class="metric-card">
                    <p class="data-label">Frame Rate</p>
                    <p class="metric-large text-success">{{ metrics.frameRate }}</p>
                    <p class="text-xs text-tertiary">fps</p>
                  </div>
                  
                  <div class="metric-card">
                    <p class="data-label">Latency</p>
                    <p class="metric-large text-warning">{{ metrics.networkLatency }}</p>
                    <p class="text-xs text-tertiary">ms</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- AI Insights -->
            <div class="card card-elevated">
              <div class="card-header">
                <h3 class="card-title">AI Insights</h3>
                <p class="card-subtitle">Machine learning performance</p>
              </div>
              <div class="card-body">
                <div class="space-y-4">
                  <div class="insight-item">
                    <div class="flex justify-between items-center mb-1">
                      <span class="data-label">Prediction Accuracy</span>
                      <span class="data-value">{{ metrics.predictionAccuracy.toFixed(1) }}%</span>
                    </div>
                    <div class="progress">
                      <div class="progress-bar progress-success" [style.width.%]="metrics.predictionAccuracy"></div>
                    </div>
                  </div>
                  
                  <div class="insight-item">
                    <div class="flex justify-between items-center mb-1">
                      <span class="data-label">Adaptation Rate</span>
                      <span class="data-value">{{ metrics.adaptationRate.toFixed(1) }}%</span>
                    </div>
                    <div class="progress">
                      <div class="progress-bar bg-neural-500" [style.width.%]="metrics.adaptationRate"></div>
                    </div>
                  </div>
                  
                  <div class="insight-item">
                    <div class="flex justify-between items-center mb-1">
                      <span class="data-label">Improvement Score</span>
                      <span class="data-value">{{ metrics.improveScore.toFixed(1) }}%</span>
                    </div>
                    <div class="progress">
                      <div class="progress-bar progress-warning" [style.width.%]="metrics.improveScore"></div>
                    </div>
                  </div>
                  
                  <div class="insight-summary mt-4 p-3 bg-secondary rounded-lg">
                    <p class="text-sm text-secondary">
                      <strong>AI Status:</strong> Neural networks are {{ metrics.aiConfidence > 80 ? 'performing optimally' : 'adapting to improve accuracy' }}.
                      {{ metrics.dataPoints.toLocaleString() }} data points processed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Quick Actions -->
        <section class="actions-section mt-8">
          <div class="card card-elevated">
            <div class="card-header">
              <h3 class="card-title">Quick Actions</h3>
              <p class="card-subtitle">Calibration, settings, and AI controls</p>
            </div>
            <div class="card-body">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button class="btn btn-primary" (click)="startCalibration()">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Smart Calibration
                </button>
                
                <button class="btn btn-outline" (click)="toggleTracking()">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  {{ systemStatus.tracking === 'active' ? 'Pause' : 'Start' }} Tracking
                </button>
                
                <button class="btn btn-secondary" (click)="toggleAI()">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                  {{ systemStatus.ai === 'active' ? 'Disable' : 'Enable' }} AI
                </button>
                
                <button class="btn btn-ghost" (click)="openSettings()">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.5 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  Settings
                </button>
              </div>
            </div>
          </div>

          <!-- Eye Tracking Test Section -->
          <div class="card card-elevated mt-6 bg-gradient-to-r from-blue-600 to-purple-600">
            <div class="card-body text-center">
              <h3 class="text-xl font-bold text-white mb-2">🎯 เริ่มทดสอบ Eye Tracking จริง</h3>
              <p class="text-blue-100 mb-4">ข้อมูลด้านบนเป็นเพียงการจำลอง ทดสอบระบบจริงด้วยกล้องของคุณ</p>
              <button class="btn btn-primary btn-lg" (click)="startEyeTrackingTest()">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                เริ่มทดสอบกับกล้องจริง
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  `,
  styleUrls: ['./modern-dashboard.component.scss']
})
export class ModernDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  metrics: DashboardMetrics = {
    gazeAccuracy: 0,
    calibrationQuality: 0,
    aiConfidence: 0,
    networkLatency: 0,
    frameRate: 0,
    dataPoints: 0,
    sessionDuration: 0,
    improveScore: 0,
    predictionAccuracy: 0,
    adaptationRate: 0
  };

  systemStatus: SystemStatus = {
    camera: 'disconnected',
    calibration: 'none',
    tracking: 'inactive',
    ai: 'disabled',
    network: 'offline'
  };

  constructor(
    private router: Router,
    private gazeEstimationService: GazeEstimationService,
    private calibrationService: CalibrationService,
    private smartCalibrationService: SmartCalibrationService,
    private neuralNetworkService: NeuralNetworkService,
    private predictiveAnalyticsService: PredictiveAnalyticsService,
    private adaptiveLearningService: AdaptiveLearningService
  ) {}

  ngOnInit(): void {
    this.initializeServices();
    this.startMetricsUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeServices(): void {
    // Initialize AI services (simplified calls)
    console.log('Initializing AI services...');
    
    // Set initial system status
    this.updateSystemStatus();
  }

  private startMetricsUpdates(): void {
    // Update metrics every second
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateMetrics();
        this.updateSystemStatus();
      });
  }

  private updateMetrics(): void {
    // Simulate real-time metrics (in production, these would come from actual services)
    this.metrics = {
      gazeAccuracy: 75 + Math.random() * 20,
      calibrationQuality: 85 + Math.random() * 10, // Simplified
      aiConfidence: 80 + Math.random() * 15, // Simplified
      networkLatency: 15 + Math.random() * 10,
      frameRate: 28 + Math.random() * 4,
      dataPoints: Math.floor(Math.random() * 10000) + 50000,
      sessionDuration: Math.floor(Date.now() / 1000) % 3600,
      improveScore: 60 + Math.random() * 30,
      predictionAccuracy: 75 + Math.random() * 20, // Simplified
      adaptationRate: 65 + Math.random() * 25 // Simplified
    };
  }

  private updateSystemStatus(): void {
    this.systemStatus = {
      camera: this.getCameraStatus(),
      calibration: this.getCalibrationStatus(),
      tracking: this.getTrackingStatus(),
      ai: this.getAiStatus(),
      network: this.getNetworkStatus()
    };
  }

  private getCameraStatus(): SystemStatus['camera'] {
    // In production, check actual camera connection
    return Math.random() > 0.1 ? 'connected' : 'disconnected';
  }

  private getCalibrationStatus(): SystemStatus['calibration'] {
    // Simplified calibration check
    return Math.random() > 0.3 ? 'complete' : 'none';
  }

  private getTrackingStatus(): SystemStatus['tracking'] {
    // In production, check actual tracking state
    return Math.random() > 0.2 ? 'active' : 'inactive';
  }

  private getAiStatus(): SystemStatus['ai'] {
    // Simplified AI status check
    return Math.random() > 0.2 ? 'active' : 'disabled';
  }

  private getNetworkStatus(): SystemStatus['network'] {
    const latency = this.metrics.networkLatency;
    if (latency < 20) return 'fast';
    if (latency < 50) return 'normal';
    if (latency < 100) return 'slow';
    return 'offline';
  }

  // Status text getters
  getCameraStatusText(): string {
    switch (this.systemStatus.camera) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  }

  getCalibrationStatusText(): string {
    switch (this.systemStatus.calibration) {
      case 'complete': return 'Complete';
      case 'partial': return 'Partial';
      case 'expired': return 'Expired';
      case 'none': return 'Required';
      default: return 'Unknown';
    }
  }

  getTrackingStatusText(): string {
    switch (this.systemStatus.tracking) {
      case 'active': return 'Active';
      case 'paused': return 'Paused';
      case 'inactive': return 'Inactive';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  }

  getAiStatusText(): string {
    switch (this.systemStatus.ai) {
      case 'active': return 'Active';
      case 'loading': return 'Loading';
      case 'disabled': return 'Disabled';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  }

  // Status color getters
  getCameraStatusColor(): string {
    return this.systemStatus.camera === 'connected' ? 'text-success' : 'text-error';
  }

  getCalibrationStatusColor(): string {
    return this.systemStatus.calibration === 'complete' ? 'text-success' : 'text-warning';
  }

  getTrackingStatusColor(): string {
    return this.systemStatus.tracking === 'active' ? 'text-success' : 'text-secondary';
  }

  getAiStatusColor(): string {
    switch (this.systemStatus.ai) {
      case 'active': return 'text-neural';
      case 'loading': return 'text-warning';
      case 'error': return 'text-error';
      default: return 'text-secondary';
    }
  }

  // Action methods
  startCalibration(): void {
    console.log('Starting smart calibration...');
    // In production: this.smartCalibrationService.startSmartCalibration(config);
  }

  toggleTracking(): void {
    if (this.systemStatus.tracking === 'active') {
      // Pause tracking
      console.log('Pausing tracking...');
    } else {
      // Start tracking
      console.log('Starting tracking...');
    }
  }

  toggleAI(): void {
    if (this.systemStatus.ai === 'active') {
      console.log('Disabling AI...');
    } else {
      console.log('Enabling AI...');
      // In production: initialize AI services
    }
  }

  openSettings(): void {
    console.log('Opening settings...');
  }

  startEyeTrackingTest(): void {
    console.log('Navigating to Eye Tracking Test...');
    this.router.navigate(['/test']);
  }
}
