import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { MediapipeService, FrameQualityAssessment } from '../../services/mediapipe.service';

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
            <div class="metric-fill" [style.width.%]="sharpnessPercent"></div>
          </div>
          <span class="metric-value">{{ sharpnessPercent.toFixed(0) }}%</span>
        </div>
        
        <div class="metric">
          <span class="metric-label">ความสว่าง:</span>
          <div class="metric-bar">
            <div class="metric-fill" [style.width.%]="brightnessPercent"></div>
          </div>
          <span class="metric-value">{{ brightnessPercent.toFixed(0) }}%</span>
        </div>
        
        <div class="metric">
          <span class="metric-label">คอนทราสต์:</span>
          <div class="metric-bar">
            <div class="metric-fill" [style.width.%]="contrastPercent"></div>
          </div>
          <span class="metric-value">{{ contrastPercent.toFixed(0) }}%</span>
        </div>
      </div>
      
      <div class="quality-suggestions" *ngIf="suggestions.length > 0">
        <div class="suggestion" *ngFor="let suggestion of suggestions">
          {{ suggestion }}
        </div>
      </div>
      
      <div class="quality-warning" *ngIf="warning.show" [ngClass]="'warning-' + warningType">
        <span class="warning-icon">⚠️</span>
        <span class="warning-text">{{ warning.message }}</span>
      </div>
      
      <button class="toggle-details" (click)="toggleDetails()">
        {{ showDetails ? 'ซ่อนรายละเอียด' : 'แสดงรายละเอียด' }}
      </button>
    </div>
  `,
  styles: [`
    .frame-quality-indicator {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px;
      margin: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-left: 4px solid;
      transition: all 0.3s ease;
    }

    .frame-quality-indicator.excellent {
      border-left-color: #22c55e;
      background: rgba(34, 197, 94, 0.05);
    }

    .frame-quality-indicator.good {
      border-left-color: #3b82f6;
      background: rgba(59, 130, 246, 0.05);
    }

    .frame-quality-indicator.fair {
      border-left-color: #f59e0b;
      background: rgba(245, 158, 11, 0.05);
    }

    .frame-quality-indicator.poor {
      border-left-color: #ef4444;
      background: rgba(239, 68, 68, 0.05);
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
      color: #374151;
    }

    .quality-metrics {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .metric {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .metric-label {
      min-width: 80px;
      color: #6b7280;
    }

    .metric-bar {
      flex: 1;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }

    .metric-fill {
      height: 100%;
      background: linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #22c55e 100%);
      transition: width 0.3s ease;
    }

    .metric-value {
      min-width: 40px;
      text-align: right;
      font-weight: 500;
      color: #374151;
    }

    .quality-suggestions {
      background: rgba(59, 130, 246, 0.1);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .suggestion {
      font-size: 14px;
      color: #1e40af;
      margin-bottom: 4px;
    }

    .suggestion:last-child {
      margin-bottom: 0;
    }

    .quality-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      animation: pulse 2s infinite;
    }

    .quality-warning.warning-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .quality-warning.warning-warning {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .warning-icon {
      font-size: 18px;
    }

    .warning-text {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .toggle-details {
      background: none;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .toggle-details:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `]
})
export class FrameQualityIndicatorComponent implements OnInit, OnDestroy {
  private mediaPipeService = inject(MediapipeService);
  private subscription?: Subscription;
  private updateSubscription?: Subscription;

  showDetails = false;
  currentQuality: FrameQualityAssessment | null = null;
  suggestions: string[] = [];
  warning: { show: boolean, message: string } = { show: false, message: '' };

  // Display properties
  qualityClass = 'fair';
  qualityIcon = '📊';
  qualityText = 'กำลังประเมิน...';
  sharpnessPercent = 0;
  brightnessPercent = 0;
  contrastPercent = 0;
  warningType = 'warning';

  ngOnInit() {
    // Update quality indicators every 500ms
    this.updateSubscription = interval(500).subscribe(() => {
      this.updateQualityDisplay();
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.updateSubscription?.unsubscribe();
  }

  private updateQualityDisplay() {
    if (!this.mediaPipeService.initialized) {
      return;
    }

    // Get latest quality assessment
    this.currentQuality = this.mediaPipeService.getLatestFrameQuality();
    this.suggestions = this.mediaPipeService.getCurrentQualitySuggestions();
    this.warning = this.mediaPipeService.getCurrentQualityWarning();

    if (this.currentQuality) {
      this.updateQualityMetrics();
      this.updateQualityClass();
    }
  }

  private updateQualityMetrics() {
    if (!this.currentQuality) return;

    this.sharpnessPercent = this.currentQuality.sharpness * 100;
    this.brightnessPercent = this.currentQuality.brightness * 100;
    this.contrastPercent = this.currentQuality.contrast * 100;
  }

  private updateQualityClass() {
    if (!this.currentQuality) return;

    this.qualityClass = this.currentQuality.quality;

    switch (this.currentQuality.quality) {
      case 'excellent':
        this.qualityIcon = '✅';
        this.qualityText = 'ยอดเยี่ยม';
        break;
      case 'good':
        this.qualityIcon = '👍';
        this.qualityText = 'ดี';
        break;
      case 'fair':
        this.qualityIcon = '⚡';
        this.qualityText = 'พอใช้';
        break;
      case 'poor':
        this.qualityIcon = '⚠️';
        this.qualityText = 'ควรปรับปรุง';
        break;
      default:
        this.qualityIcon = '📊';
        this.qualityText = 'กำลังประเมิน...';
    }

    // Set warning type
    this.warningType = this.currentQuality.quality === 'poor' ? 'error' : 'warning';
  }

  toggleDetails() {
    this.showDetails = !this.showDetails;
  }
}
