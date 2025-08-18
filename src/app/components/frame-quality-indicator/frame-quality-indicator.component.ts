import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';

// UI-only interface
interface FrameQualityAssessment {
  overall: number;
  sharpness: number;
  brightness: number;
  contrast: number;
  lighting: number;
  faceDetected: boolean;
  eyesDetected: boolean;
  recommendedActions: string[];
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

@Component({
  selector: 'app-frame-quality-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="frame-quality-indicator" [ngClass]="qualityClass">
      <div class="quality-header">
        <span class="quality-icon">{{ qualityIcon }}</span>
        <span class="quality-text">คุณภาพเฟรม: {{ qualityText }}</span>
      </div>
      
      <div class="quality-metrics" *ngIf="showDetails">
        <div class="metric">
          <span class="metric-label">ความคม:</span>
          <div class="metric-bar">
            <div class="metric-fill" [style.width.%]="currentQuality.sharpness * 100"></div>
          </div>
          <span class="metric-value">{{ (currentQuality.sharpness * 100) | number:'1.0-0' }}%</span>
        </div>
        
        <div class="metric">
          <span class="metric-label">ความสว่าง:</span>
          <div class="metric-bar">
            <div class="metric-fill" [style.width.%]="currentQuality.brightness * 100"></div>
          </div>
          <span class="metric-value">{{ (currentQuality.brightness * 100) | number:'1.0-0' }}%</span>
        </div>
        
        <div class="metric">
          <span class="metric-label">คอนทราสต์:</span>
          <div class="metric-bar">
            <div class="metric-fill" [style.width.%]="currentQuality.contrast * 100"></div>
          </div>
          <span class="metric-value">{{ (currentQuality.contrast * 100) | number:'1.0-0' }}%</span>
        </div>
        
        <div class="metric">
          <span class="metric-label">แสงสว่าง:</span>
          <div class="metric-bar">
            <div class="metric-fill" [style.width.%]="currentQuality.lighting * 100"></div>
          </div>
          <span class="metric-value">{{ (currentQuality.lighting * 100) | number:'1.0-0' }}%</span>
        </div>
      </div>
      
      <div class="detection-status" *ngIf="showDetails">
        <div class="detection-item" [ngClass]="{'detected': currentQuality.faceDetected}">
          <span class="detection-icon">👤</span>
          <span class="detection-text">{{ currentQuality.faceDetected ? 'ตรวจพบใบหน้า' : 'ไม่พบใบหน้า' }}</span>
        </div>
        
        <div class="detection-item" [ngClass]="{'detected': currentQuality.eyesDetected}">
          <span class="detection-icon">👁️</span>
          <span class="detection-text">{{ currentQuality.eyesDetected ? 'ตรวจพบดวงตา' : 'ไม่พบดวงตา' }}</span>
        </div>
      </div>
      
      <div class="quality-suggestions" *ngIf="suggestions.length > 0 && showDetails">
        <h4>คำแนะนำการปรับปรุง:</h4>
        <ul>
          <li *ngFor="let suggestion of suggestions">{{ suggestion }}</li>
        </ul>
      </div>
      
      <div class="quality-warning" *ngIf="warning && showWarning" [ngClass]="warningType">
        <span class="warning-icon">⚠️</span>
        <span class="warning-text">{{ warning }}</span>
        <button class="warning-close" (click)="dismissWarning()">×</button>
      </div>
      
      <div class="quality-controls">
        <button class="toggle-details" (click)="toggleDetails()" [title]="showDetails ? 'ซ่อนรายละเอียด' : 'แสดงรายละเอียด'">
          <span class="toggle-icon">{{ showDetails ? '▼' : '▶' }}</span>
        </button>
        
        <div class="action-buttons" *ngIf="showDetails">
          <button class="calibrate-btn" (click)="calibrateCamera()" title="ปรับแต่งกล้อง">
            <span class="btn-icon">🎯</span>
          </button>
          
          <button class="optimize-btn" (click)="optimizeSettings()" title="ปรับแต่งการตั้งค่า">
            <span class="btn-icon">⚙️</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .frame-quality-indicator {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin: 8px 0;
      transition: all 0.3s ease;
    }

    .frame-quality-indicator.excellent {
      border-color: #4caf50;
      background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
    }

    .frame-quality-indicator.good {
      border-color: #8bc34a;
      background: linear-gradient(135deg, #f1f8e9 0%, #f9fbe7 100%);
    }

    .frame-quality-indicator.fair {
      border-color: #ff9800;
      background: linear-gradient(135deg, #fff3e0 0%, #ffc947 20%);
    }

    .frame-quality-indicator.poor {
      border-color: #f44336;
      background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
    }

    .quality-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .quality-icon {
      font-size: 20px;
    }

    .quality-text {
      font-weight: 600;
      color: var(--text-primary);
    }

    .quality-metrics {
      display: grid;
      gap: 8px;
      margin-bottom: 16px;
    }

    .metric {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .metric-label {
      min-width: 80px;
      font-size: 14px;
      color: var(--text-secondary);
    }

    .metric-bar {
      flex: 1;
      height: 8px;
      background: var(--background-secondary);
      border-radius: 4px;
      overflow: hidden;
    }

    .metric-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #8bc34a 50%, #ff9800 75%, #f44336 100%);
      transition: width 0.3s ease;
    }

    .metric-value {
      min-width: 40px;
      text-align: right;
      font-size: 14px;
      font-weight: 500;
    }

    .detection-status {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }

    .detection-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      background: var(--background-secondary);
      border: 1px solid var(--border-color);
      transition: all 0.3s ease;
    }

    .detection-item.detected {
      background: #e8f5e8;
      border-color: #4caf50;
      color: #2e7d32;
    }

    .detection-icon {
      font-size: 16px;
    }

    .detection-text {
      font-size: 14px;
      font-weight: 500;
    }

    .quality-suggestions {
      background: var(--background-secondary);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .quality-suggestions h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: var(--text-primary);
    }

    .quality-suggestions ul {
      margin: 0;
      padding-left: 20px;
    }

    .quality-suggestions li {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    .quality-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 6px;
      margin-bottom: 16px;
      animation: slideIn 0.3s ease;
    }

    .quality-warning.warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
    }

    .quality-warning.error {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      color: #721c24;
    }

    .warning-icon {
      font-size: 16px;
    }

    .warning-text {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
    }

    .warning-close {
      background: none;
      border: none;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      color: inherit;
      opacity: 0.7;
      transition: opacity 0.2s ease;
    }

    .warning-close:hover {
      opacity: 1;
    }

    .quality-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .toggle-details {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--text-secondary);
      font-size: 14px;
      transition: color 0.2s ease;
    }

    .toggle-details:hover {
      color: var(--text-primary);
    }

    .toggle-icon {
      font-size: 12px;
      transition: transform 0.3s ease;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    .calibrate-btn,
    .optimize-btn {
      background: var(--background-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 6px 10px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .calibrate-btn:hover,
    .optimize-btn:hover {
      background: var(--primary-color);
      color: white;
      transform: translateY(-1px);
    }

    .btn-icon {
      font-size: 14px;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    :root {
      --surface-color: #ffffff;
      --border-color: #e0e0e0;
      --text-primary: #333333;
      --text-secondary: #666666;
      --background-secondary: #f5f5f5;
      --primary-color: #1976d2;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --surface-color: #1e1e1e;
        --border-color: #404040;
        --text-primary: #ffffff;
        --text-secondary: #cccccc;
        --background-secondary: #2a2a2a;
        --primary-color: #64b5f6;
      }
    }
  `]
})
export class FrameQualityIndicatorComponent implements OnInit, OnDestroy {
  currentQuality: FrameQualityAssessment = {
    overall: 0.8,
    sharpness: 0.9,
    brightness: 0.85,
    contrast: 0.75,
    lighting: 0.8,
    faceDetected: true,
    eyesDetected: true,
    recommendedActions: [],
    quality: 'good'
  };

  qualityClass = 'good';
  qualityIcon = '✅';
  qualityText = 'ดี';
  
  showDetails = false;
  showWarning = false;
  warningType = 'warning';
  
  suggestions: string[] = [];
  warning: string | null = null;
  
  private updateSubscription?: Subscription;
  private http = inject(HttpClient);

  ngOnInit() {
    this.startQualityMonitoring();
    this.updateQualityDisplay();
  }

  ngOnDestroy() {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
    }
  }

  private startQualityMonitoring() {
    // Simulate quality monitoring with mock data
    this.updateSubscription = interval(2000).subscribe(() => {
      this.updateMockQuality();
    });
  }

  private updateMockQuality() {
    // Generate realistic quality variations
    this.currentQuality = {
      overall: 0.7 + Math.random() * 0.3,
      sharpness: 0.8 + Math.random() * 0.2,
      brightness: 0.7 + Math.random() * 0.3,
      contrast: 0.6 + Math.random() * 0.4,
      lighting: 0.75 + Math.random() * 0.25,
      faceDetected: Math.random() > 0.1,
      eyesDetected: Math.random() > 0.15,
      recommendedActions: this.generateRecommendations(),
      quality: this.getQualityLevel(this.currentQuality.overall)
    };
    
    this.updateQualityDisplay();
    this.updateSuggestions();
    this.checkWarnings();
  }

  private getQualityLevel(overall: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (overall >= 0.9) return 'excellent';
    if (overall >= 0.7) return 'good';
    if (overall >= 0.5) return 'fair';
    return 'poor';
  }

  private updateQualityDisplay() {
    this.qualityClass = this.currentQuality.quality;
    
    switch (this.currentQuality.quality) {
      case 'excellent':
        this.qualityIcon = '✅';
        this.qualityText = 'ดีเยี่ยม';
        break;
      case 'good':
        this.qualityIcon = '👍';
        this.qualityText = 'ดี';
        break;
      case 'fair':
        this.qualityIcon = '⚠️';
        this.qualityText = 'พอใช้';
        break;
      case 'poor':
        this.qualityIcon = '❌';
        this.qualityText = 'ต้องปรับปรุง';
        break;
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.currentQuality.sharpness < 0.7) {
      recommendations.push('ปรับโฟกัสกล้องให้คมชัดขึ้น');
    }
    
    if (this.currentQuality.brightness < 0.6) {
      recommendations.push('เพิ่มแสงสว่างในห้อง');
    }
    
    if (this.currentQuality.contrast < 0.5) {
      recommendations.push('ปรับการตั้งค่าคอนทราสต์ของกล้อง');
    }
    
    if (!this.currentQuality.faceDetected) {
      recommendations.push('วางตำแหน่งให้ใบหน้าอยู่ในกรอบกล้อง');
    }
    
    if (!this.currentQuality.eyesDetected) {
      recommendations.push('ปรับมุมกล้องให้เห็นดวงตาชัดเจน');
    }
    
    return recommendations;
  }

  private updateSuggestions() {
    this.suggestions = this.currentQuality.recommendedActions;
  }

  private checkWarnings() {
    this.warning = null;
    this.showWarning = false;
    
    if (this.currentQuality.quality === 'poor') {
      this.warning = 'คุณภาพเฟรมต่ำ อาจส่งผลต่อความแม่นยำในการติดตาม';
      this.warningType = 'error';
      this.showWarning = true;
    } else if (!this.currentQuality.faceDetected || !this.currentQuality.eyesDetected) {
      this.warning = 'ไม่สามารถตรวจพบใบหน้าหรือดวงตาได้ชัดเจน';
      this.warningType = 'warning';
      this.showWarning = true;
    }
  }

  toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  dismissWarning() {
    this.showWarning = false;
  }

  calibrateCamera() {
    console.log('Starting camera calibration...');
    // In real app, would make HTTP request to backend
  }

  optimizeSettings() {
    console.log('Optimizing camera settings...');
    // In real app, would make HTTP request to backend
  }
}
