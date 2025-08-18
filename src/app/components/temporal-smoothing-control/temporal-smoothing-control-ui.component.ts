import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { HttpClient } from '@angular/common/http';

// Mock interfaces for UI
interface SmoothingConfig {
  windowSize: number;
  threshold: number;
  enabled: boolean;
  enableKalmanFilter?: boolean;
  enableExponentialSmoothing?: boolean;
  enableTemporalSmoothing?: boolean;
  enableOutlierDetection?: boolean;
  kalmanQ?: number;
  kalmanR?: number;
  exponentialAlpha?: number;
  temporalWindowSize?: number;
  outlierThreshold?: number;
  kalmanProcessNoise?: number;
}

interface MouseMovementConfig {
  smoothingFactor: number;
  acceleration: number;
  enabled: boolean;
  enableSmoothing?: boolean;
  enableAcceleration?: boolean;
  maxSpeed?: number;
  minSpeed?: number;
  accelerationThreshold?: number;
  maxAcceleration?: number;
}

interface SmoothingStats {
  averageLatency: number;
  jitterReduction: number;
  stabilityIndex: number;
  qualityScore: number;
}

@Component({
  selector: 'app-temporal-smoothing-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="temporal-smoothing-container">
      <div class="control-header">
        <h3>การปรับการทำงานเรียบ (Temporal Smoothing)</h3>
        <div class="toggle-group">
          <label class="toggle-switch">
            <input type="checkbox" [(ngModel)]="isActive" (change)="toggleSmoothing()">
            <span class="slider"></span>
            เปิดใช้งาน
          </label>
        </div>
      </div>

      <div class="control-panels" [class.disabled]="!isActive">
        
        <!-- Gaze Smoothing Panel -->
        <div class="panel gaze-panel">
          <h4>การปรับจุดสายตา (Gaze Smoothing)</h4>
          
          <div class="control-group">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="gazeConfig.enableKalmanFilter"
                     (change)="updateGazeConfig()">
              <span>Kalman Filter</span>
            </label>
          </div>

          <div class="control-group">
            <label>ขนาดหน้าต่าง ({{ gazeConfig.windowSize }})</label>
            <input type="range" 
                   min="3" max="15" step="1"
                   [(ngModel)]="gazeConfig.windowSize"
                   (input)="updateGazeConfig()">
          </div>

          <div class="control-group">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="gazeConfig.enableExponentialSmoothing"
                     (change)="updateGazeConfig()">
              <span>การลดการสั่นไหว</span>
            </label>
          </div>

          <div class="control-group" *ngIf="gazeConfig.enableExponentialSmoothing">
            <label>การลดการสั่นไหว (α = {{ (gazeConfig.exponentialAlpha || 0.5).toFixed(2) }})</label>
            <input type="range" 
                   min="0.1" max="0.9" step="0.1"
                   [(ngModel)]="gazeConfig.exponentialAlpha"
                   (input)="updateGazeConfig()">
          </div>

          <div class="control-group">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="gazeConfig.enableOutlierDetection"
                     (change)="updateGazeConfig()">
              <span>ตรวจจับจุดผิดปกติ</span>
            </label>
          </div>

          <div class="control-group" *ngIf="gazeConfig.enableOutlierDetection">
            <label>ขีดจำกัดจุดผิดปกติ ({{ gazeConfig.outlierThreshold || 50 }}px)</label>
            <input type="range" 
                   min="10" max="100" step="5"
                   [(ngModel)]="gazeConfig.outlierThreshold"
                   (input)="updateGazeConfig()">
          </div>
        </div>

        <!-- Mouse Smoothing Panel -->
        <div class="panel mouse-panel">
          <h4>การปรับการเคลื่อนไหวเมาส์ (Mouse Smoothing)</h4>
          
          <div class="control-group">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="mouseConfig.enableSmoothing"
                     (change)="updateMouseConfig()">
              <span>เปิดใช้การปรับเรียบ</span>
            </label>
          </div>

          <div class="control-group">
            <label>ความเรียบ ({{ mouseConfig.smoothingFactor.toFixed(1) }})</label>
            <input type="range" 
                   min="0.1" max="1.0" step="0.1"
                   [(ngModel)]="mouseConfig.smoothingFactor"
                   (input)="updateMouseConfig()">
          </div>

          <div class="control-group">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="mouseConfig.enableAcceleration"
                     (change)="updateMouseConfig()">
              <span>เปิดใช้การเร่ง</span>
            </label>
          </div>

          <div class="control-group" *ngIf="mouseConfig.enableAcceleration">
            <label>ค่าการเร่ง ({{ mouseConfig.acceleration.toFixed(1) }}x)</label>
            <input type="range" 
                   min="0.5" max="3.0" step="0.1"
                   [(ngModel)]="mouseConfig.acceleration"
                   (input)="updateMouseConfig()">
          </div>

          <div class="control-group">
            <label>ขีดจำกัดการเร่ง ({{ mouseConfig.accelerationThreshold || 50 }}px/s)</label>
            <input type="range" 
                   min="20" max="100" step="5"
                   [(ngModel)]="mouseConfig.accelerationThreshold"
                   (input)="updateMouseConfig()">
          </div>
        </div>

        <!-- Statistics Panel -->
        <div class="panel stats-panel">
          <h4>สถิติการทำงาน</h4>
          
          <div class="stats-grid">
            <div class="stat-item">
              <label>ความล่าช้าเฉลี่ย:</label>
              <span>{{ gazeStats.averageLatency.toFixed(1) }}ms</span>
            </div>
            
            <div class="stat-item">
              <label>การลดความสั่นไหว:</label>
              <span>{{ (gazeStats.jitterReduction * 100).toFixed(1) }}%</span>
            </div>
            
            <div class="stat-item">
              <label>ความเสถียร:</label>
              <span>{{ (gazeStats.stabilityIndex * 100).toFixed(1) }}%</span>
            </div>
            
            <div class="stat-item">
              <label>คุณภาพโดยรวม:</label>
              <span [class]="getQualityClass(gazeStats.qualityScore)">
                {{ (gazeStats.qualityScore * 100).toFixed(1) }}%
              </span>
            </div>
            
            <div class="stat-item">
              <label>ความเรียบเมาส์:</label>
              <span>{{ (mouseStats.jitterReduction * 100).toFixed(1) }}%</span>
            </div>
            
            <div class="stat-item">
              <label>ประสิทธิภาพเมาส์:</label>
              <span [class]="getQualityClass(mouseStats.qualityScore)">
                {{ (mouseStats.qualityScore * 100).toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button class="btn btn-primary" (click)="optimizeSettings()">
            ปรับค่าอัตโนมัติ
          </button>
          
          <button class="btn btn-secondary" (click)="resetToDefaults()">
            คืนค่าเริ่มต้น
          </button>
          
          <button class="btn btn-info" (click)="generateRecommendations()">
            แนะนำการตั้งค่า
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .temporal-smoothing-container {
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
      margin: 1rem 0;
    }

    .control-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #dee2e6;
    }

    .control-header h3 {
      margin: 0;
      color: #495057;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 60px;
      height: 34px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 34px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: #007bff;
    }

    input:checked + .slider:before {
      transform: translateX(26px);
    }

    .control-panels {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .control-panels.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .panel {
      background: white;
      border-radius: 6px;
      padding: 1rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .panel h4 {
      margin: 0 0 1rem 0;
      color: #343a40;
      font-size: 1.1rem;
    }

    .stats-panel {
      grid-column: 1 / -1;
    }

    .control-group {
      margin-bottom: 1rem;
    }

    .control-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #495057;
    }

    .checkbox-label {
      display: flex !important;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
      margin: 0;
    }

    input[type="range"] {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #dee2e6;
      outline: none;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    input[type="range"]:hover {
      opacity: 1;
    }

    input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #007bff;
      cursor: pointer;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .stat-item label {
      margin: 0;
      font-weight: normal;
    }

    .quality-excellent { color: #28a745; font-weight: bold; }
    .quality-good { color: #17a2b8; font-weight: bold; }
    .quality-fair { color: #ffc107; font-weight: bold; }
    .quality-poor { color: #dc3545; font-weight: bold; }

    .action-buttons {
      grid-column: 1 / -1;
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 1rem;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-primary:hover {
      background: #0056b3;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover {
      background: #545b62;
    }

    .btn-info {
      background: #17a2b8;
      color: white;
    }

    .btn-info:hover {
      background: #117a8b;
    }
  `]
})
export class TemporalSmoothingControlComponent implements OnInit, OnDestroy {
  private updateSubscription?: Subscription;
  
  isActive = true;
  
  gazeConfig: SmoothingConfig = {
    windowSize: 5,
    threshold: 0.3,
    enabled: true,
    enableKalmanFilter: true,
    enableExponentialSmoothing: false,
    enableTemporalSmoothing: true,
    enableOutlierDetection: true,
    kalmanQ: 0.1,
    kalmanR: 0.1,
    exponentialAlpha: 0.3,
    temporalWindowSize: 5,
    outlierThreshold: 50,
    kalmanProcessNoise: 0.1
  };

  mouseConfig: MouseMovementConfig = {
    smoothingFactor: 0.7,
    acceleration: 1.2,
    enabled: true,
    enableSmoothing: true,
    enableAcceleration: false,
    maxSpeed: 1500,
    minSpeed: 10,
    accelerationThreshold: 50,
    maxAcceleration: 2.5
  };

  gazeStats: SmoothingStats = {
    averageLatency: 12.5,
    jitterReduction: 0.85,
    stabilityIndex: 0.92,
    qualityScore: 0.88
  };

  mouseStats: SmoothingStats = {
    averageLatency: 8.2,
    jitterReduction: 0.78,
    stabilityIndex: 0.86,
    qualityScore: 0.82
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadConfigurations();
    this.startStatsUpdate();
  }

  ngOnDestroy() {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
    }
  }

  private loadConfigurations() {
    // TODO: Load configurations from backend API
    // this.http.get('/api/smoothing/gaze-config').subscribe(config => {
    //   this.gazeConfig = config;
    // });
    
    console.log('Loading smoothing configurations...');
  }

  private startStatsUpdate() {
    this.updateSubscription = interval(1000).subscribe(() => {
      this.updateStats();
    });
  }

  private updateStats() {
    // TODO: Get real stats from backend API
    // Mock random updates
    this.gazeStats = {
      ...this.gazeStats,
      averageLatency: 10 + Math.random() * 10,
      qualityScore: Math.max(0.7, Math.min(0.95, this.gazeStats.qualityScore + (Math.random() - 0.5) * 0.1))
    };

    this.mouseStats = {
      ...this.mouseStats,
      averageLatency: 5 + Math.random() * 8,
      qualityScore: Math.max(0.6, Math.min(0.9, this.mouseStats.qualityScore + (Math.random() - 0.5) * 0.1))
    };
  }

  toggleSmoothing() {
    // TODO: Call backend API to enable/disable smoothing
    console.log('Smoothing toggled:', this.isActive);
  }

  updateGazeConfig() {
    // TODO: Send updated config to backend API
    console.log('Gaze config updated:', this.gazeConfig);
  }

  updateMouseConfig() {
    // TODO: Send updated config to backend API
    console.log('Mouse config updated:', this.mouseConfig);
  }

  optimizeSettings() {
    // TODO: Call backend API for automatic optimization
    console.log('Optimizing settings...');
    
    // Mock optimization
    this.gazeConfig = {
      ...this.gazeConfig,
      windowSize: 7,
      enableKalmanFilter: true,
      enableExponentialSmoothing: true,
      exponentialAlpha: 0.4
    };
    
    this.mouseConfig = {
      ...this.mouseConfig,
      smoothingFactor: 0.8,
      enableAcceleration: true,
      acceleration: 1.5
    };
  }

  resetToDefaults() {
    // TODO: Call backend API to reset to defaults
    console.log('Resetting to defaults...');
    
    this.gazeConfig = {
      windowSize: 5,
      threshold: 0.3,
      enabled: true,
      enableKalmanFilter: true,
      enableExponentialSmoothing: false,
      enableTemporalSmoothing: true,
      enableOutlierDetection: true,
      kalmanQ: 0.1,
      kalmanR: 0.1,
      exponentialAlpha: 0.3,
      temporalWindowSize: 5,
      outlierThreshold: 50,
      kalmanProcessNoise: 0.05
    };

    this.mouseConfig = {
      smoothingFactor: 0.7,
      acceleration: 1.0,
      enabled: true,
      enableSmoothing: true,
      enableAcceleration: false,
      maxSpeed: 1200,
      minSpeed: 20,
      accelerationThreshold: 40,
      maxAcceleration: 2.0
    };
  }

  generateRecommendations() {
    // TODO: Call backend API for recommendations
    console.log('Generating recommendations...');
    alert('แนะนำ: ปรับค่า Kalman Filter และเปิดการลดการสั่นไหวสำหรับประสิทธิภาพที่ดีขึ้น');
  }

  getQualityClass(score: number): string {
    if (score >= 0.9) return 'quality-excellent';
    if (score >= 0.8) return 'quality-good';
    if (score >= 0.6) return 'quality-fair';
    return 'quality-poor';
  }
}
