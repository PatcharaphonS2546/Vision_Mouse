import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, interval } from 'rxjs';

// Mock interfaces for UI
interface EyeTrackingData {
  leftEye: { x: number; y: number; confidence: number };
  rightEye: { x: number; y: number; confidence: number };
  gazePoint: { x: number; y: number; confidence: number };
  timestamp: number;
}

interface CalibrationProgress {
  currentStep: number;
  totalSteps: number;
  percentage: number;
  message: string;
}

interface PerformanceMetrics {
  fps: number;
  latency: number;
  accuracy: number;
  stability: number;
}

@Component({
  selector: 'app-eye-tracking-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="eye-tracking-test-container">
      <div class="test-header">
        <h2>ทดสอบการติดตามดวงตา</h2>
        <div class="status-indicator" [ngClass]="{'active': isTracking, 'inactive': !isTracking}">
          <span class="status-dot"></span>
          {{ isTracking ? 'กำลังติดตาม' : 'หยุดติดตาม' }}
        </div>
      </div>

      <!-- Video Display -->
      <div class="video-section">
        <div class="video-container">
          <video #videoElement autoplay muted playsinline></video>
          <canvas #overlayCanvas class="overlay-canvas"></canvas>
          
          <!-- Gaze Point Indicator -->
          <div class="gaze-indicator" 
               [style.left.px]="gazePoint.x" 
               [style.top.px]="gazePoint.y"
               [style.opacity]="gazePoint.confidence">
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls-section">
        <button class="btn btn-primary" 
                [disabled]="!cameraReady"
                (click)="toggleTracking()">
          {{ isTracking ? 'หยุดติดตาม' : 'เริ่มติดตาม' }}
        </button>
        
        <button class="btn btn-secondary" 
                [disabled]="!isTracking"
                (click)="startCalibration()">
          เริ่มปรับจูน
        </button>
        
        <button class="btn btn-info" (click)="resetTracking()">
          รีเซ็ต
        </button>
      </div>

      <!-- Performance Metrics -->
      <div class="metrics-section">
        <div class="metrics-grid">
          <div class="metric-card">
            <label>FPS</label>
            <span class="metric-value">{{ currentFps.toFixed(1) }}</span>
          </div>
          
          <div class="metric-card">
            <label>Latency</label>
            <span class="metric-value">{{ currentLatency.toFixed(1) }}ms</span>
          </div>
          
          <div class="metric-card">
            <label>Accuracy</label>
            <span class="metric-value">{{ (accuracy * 100).toFixed(1) }}%</span>
          </div>
          
          <div class="metric-card">
            <label>Confidence</label>
            <span class="metric-value" [ngClass]="getConfidenceClass(gazePoint.confidence)">
              {{ (gazePoint.confidence * 100).toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- Eye Data Display -->
      <div class="eye-data-section" *ngIf="eyeTrackingData">
        <div class="eye-data-grid">
          <div class="eye-data-card">
            <h4>ดวงตาซ้าย</h4>
            <div class="eye-coords">
              <span>X: {{ eyeTrackingData.leftEye.x.toFixed(2) }}</span>
              <span>Y: {{ eyeTrackingData.leftEye.y.toFixed(2) }}</span>
              <span>Conf: {{ (eyeTrackingData.leftEye.confidence * 100).toFixed(1) }}%</span>
            </div>
          </div>
          
          <div class="eye-data-card">
            <h4>ดวงตาขวา</h4>
            <div class="eye-coords">
              <span>X: {{ eyeTrackingData.rightEye.x.toFixed(2) }}</span>
              <span>Y: {{ eyeTrackingData.rightEye.y.toFixed(2) }}</span>
              <span>Conf: {{ (eyeTrackingData.rightEye.confidence * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Calibration Progress -->
      <div class="calibration-section" *ngIf="calibrationProgress">
        <div class="progress-card">
          <h4>{{ calibrationProgress.message }}</h4>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="calibrationProgress.percentage"></div>
          </div>
          <div class="progress-text">
            {{ calibrationProgress.currentStep }} / {{ calibrationProgress.totalSteps }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .eye-tracking-test-container {
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .test-header h2 {
      margin: 0;
      color: #333;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-weight: 500;
    }

    .status-indicator.active {
      background: #d1e7dd;
      color: #0f5132;
    }

    .status-indicator.inactive {
      background: #f8d7da;
      color: #721c24;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .video-section {
      margin-bottom: 1rem;
    }

    .video-container {
      position: relative;
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
    }

    .video-container video {
      width: 100%;
      height: auto;
      display: block;
    }

    .overlay-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .gaze-indicator {
      position: absolute;
      width: 12px;
      height: 12px;
      border: 2px solid #ff0000;
      border-radius: 50%;
      background: rgba(255, 0, 0, 0.3);
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: all 0.1s ease;
    }

    .controls-section {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-info {
      background: #17a2b8;
      color: white;
    }

    .metrics-section {
      margin-bottom: 1rem;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .metric-card {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 1rem;
      text-align: center;
    }

    .metric-card label {
      display: block;
      font-size: 0.9rem;
      color: #6c757d;
      margin-bottom: 0.5rem;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #495057;
    }

    .confidence-excellent { color: #28a745; }
    .confidence-good { color: #17a2b8; }
    .confidence-fair { color: #ffc107; }
    .confidence-poor { color: #dc3545; }

    .eye-data-section {
      margin-bottom: 1rem;
    }

    .eye-data-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .eye-data-card {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 1rem;
    }

    .eye-data-card h4 {
      margin: 0 0 1rem 0;
      color: #495057;
    }

    .eye-coords {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .eye-coords span {
      font-family: monospace;
      background: #f8f9fa;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .calibration-section {
      margin-bottom: 1rem;
    }

    .progress-card {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 1rem;
    }

    .progress-card h4 {
      margin: 0 0 1rem 0;
      color: #495057;
    }

    .progress-bar {
      width: 100%;
      height: 20px;
      background: #e9ecef;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: #007bff;
      transition: width 0.3s ease;
    }

    .progress-text {
      text-align: center;
      font-size: 0.9rem;
      color: #6c757d;
    }
  `]
})
export class EyeTrackingTestComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('overlayCanvas', { static: false }) overlayCanvas!: ElementRef<HTMLCanvasElement>;

  private destroy$ = new Subject<void>();
  
  // State
  isTracking = false;
  cameraReady = false;
  
  // Mock data
  eyeTrackingData: EyeTrackingData = {
    leftEye: { x: 0, y: 0, confidence: 0 },
    rightEye: { x: 0, y: 0, confidence: 0 },
    gazePoint: { x: 0, y: 0, confidence: 0 },
    timestamp: 0
  };

  gazePoint = { x: 400, y: 300, confidence: 0.8 };
  
  calibrationProgress: CalibrationProgress | null = null;
  
  // Performance metrics
  currentFps = 30.0;
  currentLatency = 15.2;
  accuracy = 0.85;

  constructor(
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.initializeCamera();
    this.startMockTracking();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeCamera() {
    try {
      // Mock camera initialization
      setTimeout(() => {
        this.cameraReady = true;
        console.log('Mock camera initialized');
      }, 1000);

      // Mock camera stream
      if (this.videoElement?.nativeElement) {
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            this.videoElement.nativeElement.srcObject = stream;
          })
          .catch(error => {
            console.error('Camera access failed:', error);
          });
      }
    } catch (error) {
      console.error('Failed to initialize camera:', error);
    }
  }

  private startMockTracking() {
    // Mock eye tracking data updates
    interval(100).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.isTracking) {
        this.updateMockData();
      }
    });

    // Mock performance updates
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updatePerformanceMetrics();
    });
  }

  private updateMockData() {
    // Simulate eye movement
    const baseX = 400 + Math.sin(Date.now() / 1000) * 100;
    const baseY = 300 + Math.cos(Date.now() / 1500) * 80;
    const noise = () => (Math.random() - 0.5) * 20;

    this.eyeTrackingData = {
      leftEye: {
        x: baseX + noise(),
        y: baseY + noise(),
        confidence: 0.8 + Math.random() * 0.2
      },
      rightEye: {
        x: baseX + noise(),
        y: baseY + noise(),
        confidence: 0.8 + Math.random() * 0.2
      },
      gazePoint: {
        x: baseX,
        y: baseY,
        confidence: 0.7 + Math.random() * 0.3
      },
      timestamp: Date.now()
    };

    this.gazePoint = {
      x: this.eyeTrackingData.gazePoint.x,
      y: this.eyeTrackingData.gazePoint.y,
      confidence: this.eyeTrackingData.gazePoint.confidence
    };
  }

  private updatePerformanceMetrics() {
    // Simulate performance fluctuations
    this.currentFps = 28 + Math.random() * 4;
    this.currentLatency = 12 + Math.random() * 8;
    this.accuracy = Math.max(0.7, Math.min(0.95, this.accuracy + (Math.random() - 0.5) * 0.1));
  }

  toggleTracking() {
    this.isTracking = !this.isTracking;
    
    if (this.isTracking) {
      // TODO: Call backend API to start tracking
      console.log('Starting eye tracking...');
    } else {
      // TODO: Call backend API to stop tracking
      console.log('Stopping eye tracking...');
    }
  }

  startCalibration() {
    // TODO: Call backend API to start calibration
    console.log('Starting calibration...');
    
    // Mock calibration process
    this.calibrationProgress = {
      currentStep: 1,
      totalSteps: 9,
      percentage: 11,
      message: 'กำลังเก็บข้อมูลจุดที่ 1'
    };

    // Simulate calibration progress
    let step = 1;
    const interval = setInterval(() => {
      if (!this.calibrationProgress || step >= 9) {
        clearInterval(interval);
        this.calibrationProgress = null;
        return;
      }
      
      step++;
      this.calibrationProgress = {
        currentStep: step,
        totalSteps: 9,
        percentage: (step / 9) * 100,
        message: `กำลังเก็บข้อมูลจุดที่ ${step}`
      };
    }, 2000);
  }

  resetTracking() {
    // TODO: Call backend API to reset tracking
    console.log('Resetting tracking...');
    
    this.isTracking = false;
    this.calibrationProgress = null;
    this.eyeTrackingData = {
      leftEye: { x: 0, y: 0, confidence: 0 },
      rightEye: { x: 0, y: 0, confidence: 0 },
      gazePoint: { x: 0, y: 0, confidence: 0 },
      timestamp: 0
    };
    this.gazePoint = { x: 400, y: 300, confidence: 0 };
  }

  getConfidenceClass(confidence: number): string {
    if (confidence >= 0.9) return 'confidence-excellent';
    if (confidence >= 0.8) return 'confidence-good';
    if (confidence >= 0.6) return 'confidence-fair';
    return 'confidence-poor';
  }
}
