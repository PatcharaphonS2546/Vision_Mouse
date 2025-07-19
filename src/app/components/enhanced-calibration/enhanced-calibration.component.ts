import { Component, OnInit, OnDestroy, EventEmitter, Output, Input, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { EnhancedCalibrationService, CalibrationStatus, CalibrationProgress, CalibrationAccuracy, CalibrationSettings } from '../../services/enhanced-calibration.service';

@Component({
  selector: 'app-enhanced-calibration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Calibration Overlay -->
    <div class="calibration-overlay" *ngIf="isActive" [class.fullscreen]="fullscreen">
      
      <!-- Header -->
      <div class="calibration-header">
        <h2>Eye Tracking Calibration</h2>
        <button class="close-btn" (click)="cancelCalibration()" [disabled]="status === 'validating'">
          ✕
        </button>
      </div>

      <!-- Progress Bar -->
      <div class="progress-container" *ngIf="progress">
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="getProgressPercentage()"></div>
        </div>
        <div class="progress-text">
          Point {{ progress.currentPoint + 1 }} of {{ progress.totalPoints }}
          <span *ngIf="progress.qualityScore > 0">
            - Quality: {{ (progress.qualityScore * 100) | number:'1.0-0' }}%
          </span>
        </div>
      </div>

      <!-- Status Message -->
      <div class="status-message" [ngClass]="getStatusClass()">
        {{ getStatusMessage() }}
      </div>

      <!-- Instructions -->
      <div class="instructions" *ngIf="status === 'collecting'">
        <p>Look at the red dot and press <strong>SPACE</strong> when ready</p>
        <p class="tip">Keep your head still and look directly at each point</p>
      </div>

      <!-- Calibration Point -->
      <div 
        class="calibration-point" 
        *ngIf="currentPoint && showPoint"
        [style.left.px]="currentPoint.x - pointRadius" 
        [style.top.px]="currentPoint.y - pointRadius"
        [style.width.px]="pointRadius * 2"
        [style.height.px]="pointRadius * 2"
        [class.pulsing]="canCapture">
        <div class="point-inner"></div>
        <div class="point-ring" *ngIf="canCapture"></div>
      </div>

      <!-- Quality Feedback -->
      <div class="quality-feedback" *ngIf="lastQuality">
        <div class="quality-indicator" [ngClass]="getQualityClass(lastQuality.overallConfidence)">
          {{ getQualityText(lastQuality.overallConfidence) }}
        </div>
      </div>

      <!-- Calibration Results -->
      <div class="calibration-results" *ngIf="accuracy && status === 'completed'">
        <h3>Calibration Complete!</h3>
        <div class="accuracy-metrics">
          <div class="metric">
            <span class="label">Accuracy:</span>
            <span class="value" [ngClass]="getAccuracyClass(accuracy.accuracy)">
              {{ (accuracy.accuracy * 100) | number:'1.1-1' }}%
            </span>
          </div>
          <div class="metric">
            <span class="label">Average Error:</span>
            <span class="value">{{ accuracy.averageError | number:'1.1-1' }}px</span>
          </div>
          <div class="metric">
            <span class="label">Max Error:</span>
            <span class="value">{{ accuracy.maxError | number:'1.1-1' }}px</span>
          </div>
        </div>
        <button class="finish-btn" (click)="finishCalibration()">Use This Calibration</button>
        <button class="retry-btn" (click)="retryCalibration()">Recalibrate</button>
      </div>

      <!-- Settings Panel (if configurable) -->
      <div class="settings-panel" *ngIf="showSettings && status === 'idle'">
        <h3>Calibration Settings</h3>
        <div class="setting-group">
          <label>Point Pattern:</label>
          <select [(ngModel)]="settings.pointPattern">
            <option value="grid">Grid</option>
            <option value="random">Random</option>
            <option value="adaptive">Adaptive</option>
          </select>
        </div>
        <div class="setting-group">
          <label>Number of Points:</label>
          <select [(ngModel)]="settings.pointCount">
            <option value="9">9 Points (Fast)</option>
            <option value="16">16 Points (Accurate)</option>
            <option value="25">25 Points (Precise)</option>
          </select>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .calibration-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
    }

    .calibration-header {
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .close-btn {
      background: #ff4444;
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 20px;
      cursor: pointer;
      transition: background 0.3s;
    }

    .close-btn:hover:not(:disabled) {
      background: #ff6666;
    }

    .close-btn:disabled {
      background: #666;
      cursor: not-allowed;
    }

    .progress-container {
      position: absolute;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      width: 400px;
      text-align: center;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #333;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #8BC34A);
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 14px;
      color: #ccc;
    }

    .status-message {
      font-size: 24px;
      font-weight: bold;
      margin: 20px 0;
      text-align: center;
    }

    .status-message.collecting { color: #4CAF50; }
    .status-message.validating { color: #FF9800; }
    .status-message.completed { color: #2196F3; }
    .status-message.failed { color: #f44336; }

    .instructions {
      text-align: center;
      margin: 20px 0;
      max-width: 400px;
    }

    .instructions p {
      margin: 10px 0;
      font-size: 18px;
    }

    .instructions .tip {
      font-size: 14px;
      color: #ccc;
      font-style: italic;
    }

    .calibration-point {
      position: absolute;
      border-radius: 50%;
      background: #ff4444;
      cursor: crosshair;
      box-shadow: 0 0 20px rgba(255, 68, 68, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease;
    }

    .calibration-point.pulsing {
      animation: pulse 1.5s infinite;
    }

    .point-inner {
      width: 60%;
      height: 60%;
      background: #ffffff;
      border-radius: 50%;
    }

    .point-ring {
      position: absolute;
      width: 120%;
      height: 120%;
      border: 2px solid rgba(255, 255, 255, 0.6);
      border-radius: 50%;
      animation: ring 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }

    @keyframes ring {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    .quality-feedback {
      position: absolute;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
    }

    .quality-indicator {
      padding: 10px 20px;
      border-radius: 25px;
      font-weight: bold;
      text-align: center;
      min-width: 120px;
    }

    .quality-indicator.excellent { background: #4CAF50; }
    .quality-indicator.good { background: #8BC34A; }
    .quality-indicator.fair { background: #FF9800; }
    .quality-indicator.poor { background: #f44336; }

    .calibration-results {
      text-align: center;
      max-width: 500px;
      padding: 30px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 15px;
      backdrop-filter: blur(10px);
    }

    .accuracy-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }

    .metric {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 15px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
    }

    .metric .label {
      font-size: 14px;
      color: #ccc;
      margin-bottom: 5px;
    }

    .metric .value {
      font-size: 20px;
      font-weight: bold;
    }

    .metric .value.excellent { color: #4CAF50; }
    .metric .value.good { color: #8BC34A; }
    .metric .value.fair { color: #FF9800; }
    .metric .value.poor { color: #f44336; }

    .finish-btn, .retry-btn {
      margin: 10px;
      padding: 12px 24px;
      border: none;
      border-radius: 25px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s;
    }

    .finish-btn {
      background: #4CAF50;
      color: white;
    }

    .finish-btn:hover {
      background: #45a049;
      transform: translateY(-2px);
    }

    .retry-btn {
      background: transparent;
      color: white;
      border: 2px solid white;
    }

    .retry-btn:hover {
      background: white;
      color: black;
    }

    .settings-panel {
      background: rgba(255, 255, 255, 0.1);
      padding: 20px;
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }

    .setting-group {
      margin: 15px 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .setting-group label {
      min-width: 120px;
      font-weight: bold;
    }

    .setting-group select {
      padding: 8px;
      border-radius: 5px;
      border: none;
      background: white;
      color: black;
    }
  `]
})
export class EnhancedCalibrationComponent implements OnInit, OnDestroy {
  @Input() fullscreen: boolean = true;
  @Input() showSettings: boolean = false;
  @Output() calibrationComplete = new EventEmitter<boolean>();
  @Output() calibrationCancelled = new EventEmitter<void>();

  // State
  isActive: boolean = false;
  status: CalibrationStatus = CalibrationStatus.IDLE;
  progress: CalibrationProgress | null = null;
  accuracy: CalibrationAccuracy | null = null;

  // Current calibration point
  currentPoint: { x: number, y: number } | null = null;
  showPoint: boolean = false;
  canCapture: boolean = false;
  pointRadius: number = 20;

  // Quality feedback
  lastQuality: any = null;

  // Settings
  settings: CalibrationSettings = {
    pointPattern: 'grid',
    pointCount: 16,
    samplesPerPoint: 3,
    pointDisplayTime: 2000,
    pointRadius: 20,
    validationEnabled: true,
    adaptiveThreshold: 0.8
  };

  // Subscriptions
  private subscriptions: Subscription[] = [];
  private pointTimer: any = null;

  constructor(
    private calibrationService: EnhancedCalibrationService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.subscribeToCalibrationEvents();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.pointTimer) {
      clearTimeout(this.pointTimer);
    }
  }

  // Subscribe to calibration service events
  private subscribeToCalibrationEvents(): void {
    this.subscriptions.push(
      this.calibrationService.getCalibrationStatus().subscribe(status => {
        this.status = status;
        this.handleStatusChange(status);
      }),

      this.calibrationService.getCalibrationProgress().subscribe(progress => {
        this.progress = progress;
      }),

      this.calibrationService.getCalibrationAccuracy().subscribe(accuracy => {
        this.accuracy = accuracy;
      })
    );
  }

  // Handle status changes
  private handleStatusChange(status: CalibrationStatus): void {
    switch (status) {
      case CalibrationStatus.COLLECTING:
        this.startPointSequence();
        break;
      case CalibrationStatus.COMPLETED:
        this.showPoint = false;
        break;
      case CalibrationStatus.FAILED:
        this.showPoint = false;
        break;
    }
  }

  // Start calibration
  async startCalibration(): Promise<void> {
    this.isActive = true;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    await this.calibrationService.startCalibration(screenWidth, screenHeight, this.settings);
  }

  // Cancel calibration
  cancelCalibration(): void {
    this.calibrationService.cancelCalibration();
    this.isActive = false;
    this.calibrationCancelled.emit();
  }

  // Finish calibration
  finishCalibration(): void {
    this.isActive = false;
    this.calibrationComplete.emit(true);
  }

  // Retry calibration
  async retryCalibration(): Promise<void> {
    this.calibrationService.clearCalibration();
    await this.startCalibration();
  }

  // Start point sequence
  private startPointSequence(): void {
    if (!this.progress) return;

    // Show next calibration point
    this.showNextPoint();
  }

  // Show next calibration point
  private showNextPoint(): void {
    if (!this.progress) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Generate point position based on current progress
    const pointIndex = this.progress.currentPoint;
    const totalPoints = this.progress.totalPoints;
    
    // Use grid pattern for simplicity
    const gridSize = Math.ceil(Math.sqrt(totalPoints));
    const col = pointIndex % gridSize;
    const row = Math.floor(pointIndex / gridSize);
    
    const margin = 0.1;
    const x = (margin + (col / (gridSize - 1)) * (1 - 2 * margin)) * screenWidth;
    const y = (margin + (row / (gridSize - 1)) * (1 - 2 * margin)) * screenHeight;

    this.currentPoint = { x, y };
    this.showPoint = true;
    this.canCapture = false;

    // After display time, allow capture
    this.pointTimer = setTimeout(() => {
      this.canCapture = true;
    }, this.settings.pointDisplayTime / 2);
  }

  // Handle spacebar press
  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && this.canCapture && this.currentPoint) {
      event.preventDefault();
      this.captureCalibrationPoint();
    }
  }

  // Capture calibration point (this would be called from parent component with features)
  async captureCalibrationPoint(features?: number[]): Promise<void> {
    if (!this.currentPoint || !this.canCapture) return;

    // For demo purposes, use dummy features
    const dummyFeatures = features || new Array(10).fill(0).map(() => Math.random());
    
    const success = await this.calibrationService.addCalibrationPoint(
      this.currentPoint.x,
      this.currentPoint.y,
      dummyFeatures,
      window.innerWidth,
      window.innerHeight
    );

    if (success) {
      this.showQualityFeedback('good');
      
      // Move to next point or complete
      if (this.progress && this.progress.currentPoint + 1 < this.progress.totalPoints) {
        setTimeout(() => this.showNextPoint(), 1000);
      } else {
        await this.calibrationService.completeCalibration();
      }
    } else {
      this.showQualityFeedback('poor');
    }
  }

  // Show quality feedback
  private showQualityFeedback(quality: string): void {
    this.lastQuality = { overallConfidence: quality === 'good' ? 0.8 : 0.3 };
    setTimeout(() => this.lastQuality = null, 2000);
  }

  // Get progress percentage
  getProgressPercentage(): number {
    if (!this.progress) return 0;
    return (this.progress.currentPoint / this.progress.totalPoints) * 100;
  }

  // Get status message
  getStatusMessage(): string {
    switch (this.status) {
      case CalibrationStatus.INITIALIZING:
        return 'Preparing calibration...';
      case CalibrationStatus.COLLECTING:
        return 'Collecting calibration data...';
      case CalibrationStatus.VALIDATING:
        return 'Validating calibration...';
      case CalibrationStatus.COMPLETED:
        return 'Calibration completed!';
      case CalibrationStatus.FAILED:
        return 'Calibration failed';
      default:
        return 'Ready to calibrate';
    }
  }

  // Get status CSS class
  getStatusClass(): string {
    return this.status.toLowerCase();
  }

  // Get quality CSS class
  getQualityClass(confidence: number): string {
    if (confidence >= 0.8) return 'excellent';
    if (confidence >= 0.6) return 'good';
    if (confidence >= 0.4) return 'fair';
    return 'poor';
  }

  // Get quality text
  getQualityText(confidence: number): string {
    if (confidence >= 0.8) return 'Excellent!';
    if (confidence >= 0.6) return 'Good';
    if (confidence >= 0.4) return 'Fair';
    return 'Poor - Try again';
  }

  // Get accuracy CSS class
  getAccuracyClass(accuracy: number): string {
    if (accuracy >= 0.9) return 'excellent';
    if (accuracy >= 0.7) return 'good';
    if (accuracy >= 0.5) return 'fair';
    return 'poor';
  }
}
