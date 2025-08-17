import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { GazeEstimationService, SmoothingConfig } from '../../services/gaze-estimation.service';
import { MouseSmoothingService, MouseMovementConfig } from '../../services/mouse-smoothing.service';
import { EnhancedEyeTrackerService } from '../../services/enhanced-eye-tracker.service';

@Component({
  selector: 'app-temporal-smoothing-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="smoothing-control-panel">
      <div class="panel-header">
        <h3>⚡ Temporal Smoothing Control</h3>
        <div class="status-indicator" [ngClass]="statusClass">
          {{ statusText }}
        </div>
      </div>

      <!-- Gaze Smoothing Configuration -->
      <div class="smoothing-section">
        <h4>🎯 Gaze Smoothing</h4>
        
        <div class="control-group">
          <label class="toggle-label">
            <input type="checkbox" 
                   [(ngModel)]="gazeConfig.enableKalmanFilter"
                   (change)="updateGazeConfig()">
            <span class="toggle-text">เปิดใช้ Kalman Filter</span>
          </label>
        </div>

        <div class="control-group">
          <label class="toggle-label">
            <input type="checkbox" 
                   [(ngModel)]="gazeConfig.enableExponentialSmoothing"
                   (change)="updateGazeConfig()">
            <span class="toggle-text">เปิดใช้ Exponential Smoothing</span>
          </label>
        </div>

        <div class="control-group">
          <label class="toggle-label">
            <input type="checkbox" 
                   [(ngModel)]="gazeConfig.enableOutlierDetection"
                   (change)="updateGazeConfig()">
            <span class="toggle-text">ตรวจจับจุดผิดปกติ</span>
          </label>
        </div>

        <div class="slider-group">
          <label>การลดการสั่นไหว (α = {{ gazeConfig.exponentialAlpha.toFixed(2) }})</label>
          <input type="range" 
                 min="0.1" max="1.0" step="0.1"
                 [(ngModel)]="gazeConfig.exponentialAlpha"
                 (input)="updateGazeConfig()" />
        </div>

        <div class="slider-group">
          <label>ขีดจำกัดจุดผิดปกติ ({{ gazeConfig.outlierThreshold }}px)</label>
          <input type="range" 
                 min="50" max="300" step="25"
                 [(ngModel)]="gazeConfig.outlierThreshold"
                 (input)="updateGazeConfig()" />
        </div>
      </div>

      <!-- Mouse Smoothing Configuration -->
      <div class="smoothing-section">
        <h4>🖱️ Mouse Movement Smoothing</h4>
        
        <div class="control-group">
          <label class="toggle-label">
            <input type="checkbox" 
                   [(ngModel)]="mouseConfig.enableSmoothing"
                   (change)="updateMouseConfig()">
            <span class="toggle-text">เปิดใช้ Mouse Smoothing</span>
          </label>
        </div>

        <div class="control-group">
          <label class="toggle-label">
            <input type="checkbox" 
                   [(ngModel)]="mouseConfig.enableDeadZone"
                   (change)="updateMouseConfig()">
            <span class="toggle-text">เปิดใช้ Dead Zone</span>
          </label>
        </div>

        <div class="control-group">
          <label class="toggle-label">
            <input type="checkbox" 
                   [(ngModel)]="mouseConfig.enableJumpDetection"
                   (change)="updateMouseConfig()">
            <span class="toggle-text">ตรวจจับการกระโดด</span>
          </label>
        </div>

        <div class="slider-group">
          <label>ความนุ่มนวล ({{ (mouseConfig.smoothingFactor * 100).toFixed(0) }}%)</label>
          <input type="range" 
                 min="0.1" max="1.0" step="0.1"
                 [(ngModel)]="mouseConfig.smoothingFactor"
                 (input)="updateMouseConfig()" />
        </div>

        <div class="slider-group">
          <label>รัศมี Dead Zone ({{ mouseConfig.deadZoneRadius }}px)</label>
          <input type="range" 
                 min="2" max="20" step="2"
                 [(ngModel)]="mouseConfig.deadZoneRadius"
                 (input)="updateMouseConfig()" />
        </div>
      </div>

      <!-- Statistics -->
      <div class="statistics-section">
        <h4>📊 Smoothing Statistics</h4>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Gaze Frames</div>
            <div class="stat-value">{{ gazeStats.totalFrames }}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Outliers Rejected</div>
            <div class="stat-value">{{ gazeStats.rejectedOutliers }}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Mouse Movements</div>
            <div class="stat-value">{{ mouseStats.totalMovements }}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Jump Detections</div>
            <div class="stat-value">{{ mouseStats.jumpDetections }}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Avg Velocity</div>
            <div class="stat-value">{{ mouseStats.averageVelocity.toFixed(1) }}px</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Efficiency</div>
            <div class="stat-value">{{ (mouseStats.smoothingEfficiency * 100).toFixed(0) }}%</div>
          </div>
        </div>
      </div>

      <!-- Recommendations -->
      <div class="recommendations-section" *ngIf="recommendations.length > 0">
        <h4>💡 คำแนะนำ</h4>
        <div class="recommendation" *ngFor="let rec of recommendations">
          {{ rec }}
        </div>
      </div>

      <!-- Control Buttons -->
      <div class="control-buttons">
        <button class="btn btn-warning" (click)="resetSmoothing()">
          🔄 รีเซ็ต Smoothing
        </button>
        <button class="btn btn-info" (click)="loadOptimalSettings()">
          ⚡ ตั้งค่าแนะนำ
        </button>
      </div>
    </div>
  `,
  styles: [`
    .smoothing-control-panel {
      background: #ffffff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      margin: 16px;
      max-width: 800px;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    }

    .panel-header h3 {
      margin: 0;
      color: #1f2937;
      font-size: 1.5rem;
    }

    .status-indicator {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .status-indicator.active {
      background: #dcfce7;
      color: #166534;
    }

    .status-indicator.inactive {
      background: #fef2f2;
      color: #991b1b;
    }

    .smoothing-section {
      margin-bottom: 24px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
    }

    .smoothing-section h4 {
      margin: 0 0 16px 0;
      color: #374151;
      font-size: 1.125rem;
    }

    .control-group {
      margin-bottom: 12px;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      gap: 8px;
    }

    .toggle-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #3b82f6;
    }

    .toggle-text {
      color: #374151;
      font-size: 0.9rem;
    }

    .slider-group {
      margin-bottom: 16px;
    }

    .slider-group label {
      display: block;
      margin-bottom: 6px;
      color: #6b7280;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .slider-group input[type="range"] {
      width: 100%;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      outline: none;
      accent-color: #3b82f6;
    }

    .statistics-section {
      margin-bottom: 24px;
    }

    .statistics-section h4 {
      margin: 0 0 16px 0;
      color: #374151;
      font-size: 1.125rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }

    .stat-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }

    .stat-label {
      font-size: 0.75rem;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
    }

    .recommendations-section {
      margin-bottom: 24px;
      padding: 16px;
      background: #fef3c7;
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
    }

    .recommendations-section h4 {
      margin: 0 0 12px 0;
      color: #92400e;
    }

    .recommendation {
      font-size: 0.875rem;
      color: #92400e;
      margin-bottom: 8px;
      padding: 4px 0;
    }

    .control-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-warning {
      background: #f59e0b;
      color: #ffffff;
    }

    .btn-warning:hover {
      background: #d97706;
    }

    .btn-info {
      background: #3b82f6;
      color: #ffffff;
    }

    .btn-info:hover {
      background: #2563eb;
    }
  `]
})
export class TemporalSmoothingControlComponent implements OnInit, OnDestroy {
  private gazeEstimationService = inject(GazeEstimationService);
  private mouseSmoothingService = inject(MouseSmoothingService);
  private eyeTrackerService = inject(EnhancedEyeTrackerService);
  
  private updateSubscription?: Subscription;

  // Configuration objects
  gazeConfig: SmoothingConfig = {
    enableKalmanFilter: true,
    enableExponentialSmoothing: true,
    enableOutlierDetection: true,
    kalmanProcessNoise: 0.1,
    kalmanMeasurementNoise: 10,
    exponentialAlpha: 0.3,
    outlierThreshold: 150,
    smoothingWindowSize: 5,
    minConfidenceThreshold: 0.5
  };

  mouseConfig: MouseMovementConfig = {
    enableSmoothing: true,
    smoothingFactor: 0.7,
    enableAcceleration: true,
    accelerationThreshold: 50,
    maxAcceleration: 2.5,
    enableDeadZone: true,
    deadZoneRadius: 8,
    enableJumpDetection: true,
    jumpThreshold: 200,
    enableVelocitySmoothing: true,
    velocitySmoothingFactor: 0.8
  };

  // Statistics
  gazeStats = {
    totalFrames: 0,
    rejectedOutliers: 0,
    outlierRate: 0,
    averageConfidence: 0
  };

  mouseStats = {
    totalMovements: 0,
    averageVelocity: 0,
    maxVelocity: 0,
    smoothingEfficiency: 0,
    jumpDetections: 0,
    deadZoneActivations: 0
  };

  recommendations: string[] = [];
  
  statusClass = 'active';
  statusText = 'กำลังทำงาน';

  ngOnInit() {
    // Load current configurations
    this.loadCurrentConfigurations();
    
    // Update statistics every second
    this.updateSubscription = interval(1000).subscribe(() => {
      this.updateStatistics();
      this.updateRecommendations();
    });
  }

  ngOnDestroy() {
    this.updateSubscription?.unsubscribe();
  }

  private loadCurrentConfigurations() {
    this.gazeConfig = this.gazeEstimationService.getSmoothingConfiguration();
    this.mouseConfig = this.mouseSmoothingService.getConfiguration();
  }

  updateGazeConfig() {
    this.gazeEstimationService.configureSmoothingParameters(this.gazeConfig);
    console.log('🎯 Gaze smoothing configuration updated');
  }

  updateMouseConfig() {
    this.mouseSmoothingService.configureMouseSmoothing(this.mouseConfig);
    this.eyeTrackerService.configureMouseSmoothing(this.mouseConfig);
    console.log('🖱️ Mouse smoothing configuration updated');
  }

  private updateStatistics() {
    this.gazeStats = this.gazeEstimationService.getSmoothingStats();
    this.mouseStats = this.mouseSmoothingService.getStats();
    
    // Update status
    if (this.gazeConfig.enableKalmanFilter || this.gazeConfig.enableExponentialSmoothing) {
      this.statusClass = 'active';
      this.statusText = 'กำลังทำงาน';
    } else {
      this.statusClass = 'inactive';
      this.statusText = 'ปิดใช้งาน';
    }
  }

  private updateRecommendations() {
    this.recommendations = [];
    
    // Gaze-related recommendations
    if (this.gazeStats.outlierRate > 0.1) {
      this.recommendations.push('🎯 จุดผิดปกติเยอะ - ลองลดค่า outlierThreshold');
    }
    
    if (this.gazeStats.averageConfidence < 0.5) {
      this.recommendations.push('📊 ความเชื่อมั่นต่ำ - ตรวจสอบแสงและตำแหน่ง');
    }

    // Mouse-related recommendations
    const mouseRecs = this.eyeTrackerService.getMouseSmoothingRecommendations();
    this.recommendations.push(...mouseRecs);

    // Performance recommendations
    if (this.mouseStats.smoothingEfficiency < 0.6) {
      this.recommendations.push('⚡ ประสิทธิภาพต่ำ - ลองเพิ่ม velocitySmoothing');
    }
  }

  resetSmoothing() {
    this.gazeEstimationService.configureSmoothingParameters({
      enableKalmanFilter: true,
      enableExponentialSmoothing: true,
      enableOutlierDetection: true,
      exponentialAlpha: 0.3,
      outlierThreshold: 150,
      smoothingWindowSize: 5
    });
    
    this.mouseSmoothingService.reset();
    this.loadCurrentConfigurations();
    
    console.log('🔄 Smoothing settings reset to defaults');
  }

  loadOptimalSettings() {
    // Optimal settings based on testing
    this.gazeConfig = {
      enableKalmanFilter: true,
      enableExponentialSmoothing: true,
      enableOutlierDetection: true,
      kalmanProcessNoise: 0.05,
      kalmanMeasurementNoise: 8,
      exponentialAlpha: 0.4,
      outlierThreshold: 120,
      smoothingWindowSize: 6,
      minConfidenceThreshold: 0.6
    };

    this.mouseConfig = {
      enableSmoothing: true,
      smoothingFactor: 0.8,
      enableAcceleration: true,
      accelerationThreshold: 40,
      maxAcceleration: 2.0,
      enableDeadZone: true,
      deadZoneRadius: 6,
      enableJumpDetection: true,
      jumpThreshold: 150,
      enableVelocitySmoothing: true,
      velocitySmoothingFactor: 0.9
    };

    this.updateGazeConfig();
    this.updateMouseConfig();
    
    console.log('⚡ Optimal smoothing settings applied');
  }
}
