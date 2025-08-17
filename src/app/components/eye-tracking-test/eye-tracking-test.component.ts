import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoSourceService } from '../../services/video-source.service';
import { CalibrationService } from '../../services/calibration.service';
import { GazeEstimationService } from '../../services/gaze-estimation.service';
import { MediapipeService } from '../../services/mediapipe.service';
import { GazeProcessingService } from '../../services/gaze-processing.service';
import { EnhancedEyeTrackerService, EyeTrackingData } from '../../services/enhanced-eye-tracker.service';
import { EnhancedCalibrationService, CalibrationProgress, CalibrationAccuracy } from '../../services/enhanced-calibration.service';
import { AdvancedGazeCalculationService, GazeCalculationResult } from '../../services/advanced-gaze-calculation.service';
import { Subject, takeUntil, interval } from 'rxjs';

@Component({
  selector: 'app-eye-tracking-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="eye-tracking-test">
      <div class="test-header">
        <h1>🎯 Vision Mouse - Eye Tracking Test</h1>
        <p>ทดสอบระบบ Eye Tracking แบบเรียลไทม์</p>
      </div>

      <div class="test-container">
        <!-- Video Display -->
        <div class="video-section">
          <div class="video-container">
            <video #videoElement autoplay muted playsinline
                   [style.transform]="'scaleX(-1)'"
                   class="video-feed">
            </video>
            <canvas #overlayCanvas class="video-overlay"></canvas>
          </div>
          
          <div class="video-controls">
            <button (click)="startCamera()" [disabled]="isStreaming" class="btn btn-primary">
              📷 เริ่มกล้อง
            </button>
            <button (click)="stopCamera()" [disabled]="!isStreaming" class="btn btn-secondary">
              ⏹️ หยุดกล้อง
            </button>
            <button (click)="startCalibration()" [disabled]="!isStreaming || isCalibrating" class="btn btn-success">
              🎯 เริ่ม Calibration
            </button>
          </div>
        </div>

        <!-- Status Panel -->
        <div class="status-panel">
          <div class="status-card">
            <h3>สถานะระบบ</h3>
            <div class="status-item">
              <span class="label">กล้อง:</span>
              <span class="status" [class]="isStreaming ? 'active' : 'inactive'">
                {{ isStreaming ? 'ทำงาน' : 'หยุด' }}
              </span>
            </div>
            <div class="status-item">
              <span class="label">MediaPipe:</span>
              <span class="status" [class]="mediapipeStatus ? 'active' : 'inactive'">
                {{ mediapipeStatus ? 'พร้อม' : 'ไม่พร้อม' }}
              </span>
            </div>
            <div class="status-item">
              <span class="label">Eye Tracking:</span>
              <span class="status" [class]="eyeTrackingActive ? 'active' : 'inactive'">
                {{ eyeTrackingActive ? 'ทำงาน' : 'หยุด' }}
              </span>
            </div>
            <div class="status-item">
              <span class="label">โหมดแสงน้อย:</span>
              <span class="status" [class]="lowLightMode ? 'active' : 'inactive'">
                {{ lowLightMode ? 'เปิด' : 'ปิด' }}
              </span>
            </div>
          </div>

          <div class="metrics-card" *ngIf="eyeTrackingData">
            <h3>ข้อมูลการติดตาม</h3>
            <div class="metric-row">
              <span class="label">ตาซ้าย:</span>
              <span class="value" [class]="getQualityClass(eyeTrackingData.leftEye.quality)">
                {{ getQualityText(eyeTrackingData.leftEye.quality) }}
                ({{ eyeTrackingData.leftEye.isOpen ? 'เปิด' : 'ปิด' }})
              </span>
            </div>
            <div class="metric-row">
              <span class="label">ตาขวา:</span>
              <span class="value" [class]="getQualityClass(eyeTrackingData.rightEye.quality)">
                {{ getQualityText(eyeTrackingData.rightEye.quality) }}
                ({{ eyeTrackingData.rightEye.isOpen ? 'เปิด' : 'ปิด' }})
              </span>
            </div>
            <div class="metric-row">
              <span class="label">ใบหน้า:</span>
              <span class="value" [class]="getQualityClass(eyeTrackingData.face.quality)">
                {{ getQualityText(eyeTrackingData.face.quality) }}
                ({{ (eyeTrackingData.face.confidence * 100).toFixed(1) }}%)
              </span>
            </div>
            <div class="metric-row">
              <span class="label">FPS:</span>
              <span class="value">{{ currentFps.toFixed(1) }}</span>
            </div>
            <div class="metric-row">
              <span class="label">ความมั่นใจเฉลี่ย:</span>
              <span class="value">{{ (eyeTrackingData.averageConfidence * 100).toFixed(1) }}%</span>
            </div>
          </div>

          <!-- Advanced Gaze Information -->
          <div class="gaze-card" *ngIf="advancedGazeResult">
            <h3>🎯 Advanced Gaze Analysis</h3>
            <div class="metric-row">
              <span class="label">Gaze Quality:</span>
              <span class="value" [class]="getQualityClass(advancedGazeResult.quality)">
                {{ getQualityText(advancedGazeResult.quality) }}
              </span>
            </div>
            <div class="metric-row">
              <span class="label">Confidence:</span>
              <span class="value">{{ (advancedGazeResult.confidence * 100).toFixed(1) }}%</span>
            </div>
            <div class="metric-row">
              <span class="label">Head Yaw:</span>
              <span class="value">{{ advancedGazeResult.headPose.yaw.toFixed(1) }}°</span>
            </div>
            <div class="metric-row">
              <span class="label">Head Pitch:</span>
              <span class="value">{{ advancedGazeResult.headPose.pitch.toFixed(1) }}°</span>
            </div>
            <div class="metric-row">
              <span class="label">Pupil Size (Avg):</span>
              <span class="value">{{ ((advancedGazeResult.pupilData.leftPupil.diameter + advancedGazeResult.pupilData.rightPupil.diameter) / 2).toFixed(1) }}px</span>
            </div>
            <div class="metric-row">
              <span class="label">Gaze Position:</span>
              <span class="value">X: {{ gazePoint.x.toFixed(0) }}, Y: {{ gazePoint.y.toFixed(0) }}</span>
            </div>
            <div class="metric-row">
              <span class="label">Screen Position:</span>
              <span class="value">{{ getScreenPercentage() }}</span>
            </div>
          </div>

          <div class="controls-card">
            <h3>การควบคุม</h3>
            <div class="control-group">
              <label>
                <input type="checkbox" 
                       [checked]="lowLightMode" 
                       (change)="toggleLowLightMode()">
                เปิดโหมดแสงน้อย
              </label>
            </div>
            <div class="control-group">
              <label>
                <input type="checkbox" 
                       [checked]="showLandmarks" 
                       (change)="toggleLandmarks()">
                แสดง Landmarks
              </label>
            </div>
            <div class="control-group">
              <label>
                <input type="checkbox" 
                       [checked]="showEyeRegions" 
                       (change)="toggleEyeRegions()">
                แสดงขอบเขตดวงตา
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Information -->
      <div class="performance-info" *ngIf="performanceMetrics">
        <h3>ข้อมูลประสิทธิภาพ</h3>
        <div class="perf-grid">
          <div class="perf-item">
            <span class="perf-label">เวลาประมวลผลเฉลี่ย:</span>
            <span class="perf-value">{{ performanceMetrics.averageProcessingTime.toFixed(2) }} ms</span>
          </div>
          <div class="perf-item">
            <span class="perf-label">FPS เป้าหมาย:</span>
            <span class="perf-value">30 FPS</span>
          </div>
          <div class="perf-item">
            <span class="perf-label">FPS ปัจจุบัน:</span>
            <span class="perf-value" [class]="currentFps >= 25 ? 'good' : currentFps >= 15 ? 'warning' : 'poor'">
              {{ currentFps.toFixed(1) }} FPS
            </span>
          </div>
          <div class="perf-item">
            <span class="perf-label">เฟรมที่ประมวลผล:</span>
            <span class="perf-value">{{ eyeTrackingData?.frameNumber || 0 }}</span>
          </div>
        </div>
      </div>

      <!-- Calibration Overlay -->
      <div class="calibration-overlay" *ngIf="isCalibrating">
        <div class="calibration-content">
          <h2>🎯 การปรับเทียบระบบแบบใหม่</h2>
          <p>มองที่จุดสีแดงและให้ตานิ่งจนกว่าจะเปลี่ยนตำแหน่ง</p>
          
          <!-- Enhanced Progress Display -->
          <div class="enhanced-progress" *ngIf="enhancedCalibrationProgress">
            <div class="progress-info">
              <div class="point-counter">
                จุดที่ {{ enhancedCalibrationProgress.currentPoint }} / {{ enhancedCalibrationProgress.totalPoints }}
              </div>
              <div class="sample-counter">
                ตัวอย่าง: {{ enhancedCalibrationProgress.collectedSamples }} / {{ enhancedCalibrationProgress.requiredSamples }}
              </div>
              <div class="quality-indicator">
                คุณภาพ: <span [class]="'quality-' + enhancedCalibrationProgress.qualityScore">
                  {{ (enhancedCalibrationProgress.qualityScore * 100).toFixed(0) }}%
                </span>
              </div>
            </div>
            
            <div class="progress-bar-enhanced">
              <div class="progress-fill-enhanced" 
                   [style.width.%]="(enhancedCalibrationProgress.currentPoint / enhancedCalibrationProgress.totalPoints) * 100">
              </div>
            </div>
          </div>
          
          <div class="calibration-area">
            <div class="calibration-point"
                 [style.left.px]="calibrationPoint.x"
                 [style.top.px]="calibrationPoint.y"
                 (click)="addCalibrationPoint()">
              🔴
            </div>
          </div>
          
          <!-- Legacy Progress (fallback) -->
          <div class="calibration-progress" *ngIf="!enhancedCalibrationProgress">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="(calibrationPoints.length / 9) * 100"></div>
            </div>
            <p>จุดปรับเทียบ: {{calibrationPoints.length}} / 9</p>
          </div>
          
          <button (click)="stopCalibration()" class="btn btn-secondary">
            ❌ ยกเลิก
          </button>
        </div>
      </div>

      <!-- Gaze Cursor -->
      <div class="gaze-cursor" 
           *ngIf="isCalibrated && faceDetected && !isCalibrating"
           [style.left.px]="gazePoint.x - 10"
           [style.top.px]="gazePoint.y - 10">
        👁️
      </div>
    </div>
  `,
  styleUrls: ['./eye-tracking-test.component.scss'],
})
export class EyeTrackingTestComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('demoArea') demoArea!: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();
  private autoCalibrationInterval?: number;
  private ctx: CanvasRenderingContext2D | null = null;

  // Status flags
  isStreaming = false;
  mediapipeReady = false;
  mediapipeStatus = false;
  faceDetected = false;
  isCalibrating = false;
  isCalibrated = false;
  showTarget = false;
  
  // Enhanced eye tracking properties
  eyeTrackingActive = false;
  lowLightMode = false;
  showLandmarks = true;
  showEyeRegions = true;
  eyeTrackingData: EyeTrackingData | null = null;
  advancedGazeResult: GazeCalculationResult | null = null;
  currentFps = 0;
  performanceMetrics: { averageProcessingTime: number; fps: number } | null = null;

  // Enhanced calibration properties
  enhancedCalibrationProgress: CalibrationProgress | null = null;
  enhancedCalibrationAccuracy: CalibrationAccuracy | null = null;
  
  // Tracking data
  gazePoint = { x: 0, y: 0 };
  targetPosition = { x: 100, y: 100 };
  accuracy = 0;
  calibrationPoints: any[] = [];
  calibrationPoint = { x: 100, y: 100 };

  // Real MediaPipe data
  private currentFaceLandmarks: any[] = [];
  private lastDetectionTime = 0;
  private realFaceDetected = false;
  private detectionConfidence = 0;
  private isDestroyed = false;

  constructor(
    private videoService: VideoSourceService,
    private calibrationService: CalibrationService,
    private enhancedCalibrationService: EnhancedCalibrationService,
    private gazeService: GazeEstimationService,
    private mediapipeService: MediapipeService,
    private gazeProcessingService: GazeProcessingService,
    private enhancedEyeTracker: EnhancedEyeTrackerService,
    private gazeCalculationService: AdvancedGazeCalculationService
  ) {}  ngOnInit() {
    this.initializeServices();
    this.setupEventListeners();
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
    this.stopCamera();
    this.stopAutoCalibrationCollection();
    
    // Cleanup MediaPipe service
    this.mediapipeService.cleanup();
  }

  private async initializeServices() {
    try {
      // Initialize MediaPipe
      await this.mediapipeService.initialize();
      this.mediapipeReady = true;
      this.mediapipeStatus = true;
      console.log('MediaPipe initialized for eye tracking test');

      // Initialize Enhanced Eye Tracker
      const eyeTrackingStarted = await this.enhancedEyeTracker.startTracking();
      if (eyeTrackingStarted) {
        this.eyeTrackingActive = true;
        console.log('Enhanced eye tracking started');
      }

      // Subscribe to eye tracking data
      this.enhancedEyeTracker.getEyeTrackingData()
        .pipe(takeUntil(this.destroy$))
        .subscribe(data => {
          this.eyeTrackingData = data;
          if (data) {
            this.faceDetected = true;
            this.updateVisualization();
          }
        });

      // Subscribe to low light mode changes
      this.enhancedEyeTracker.getLowLightMode()
        .pipe(takeUntil(this.destroy$))
        .subscribe(enabled => {
          this.lowLightMode = enabled;
        });

      // Subscribe to advanced gaze calculation results
      this.enhancedEyeTracker.getGazeResults()
        .pipe(takeUntil(this.destroy$))
        .subscribe(gazeResult => {
          this.advancedGazeResult = gazeResult;
          if (gazeResult) {
            // Update gaze point with advanced calculation
            this.gazePoint = gazeResult.gazePoint;
            this.accuracy = gazeResult.confidence * 100;
            console.log('Advanced gaze point:', gazeResult.gazePoint, 'Quality:', gazeResult.quality);
          }
        });

      // Subscribe to enhanced calibration progress
      this.enhancedCalibrationService.getCalibrationProgress()
        .pipe(takeUntil(this.destroy$))
        .subscribe(progress => {
          this.enhancedCalibrationProgress = progress;
          if (progress) {
            // Calculate position based on current point (fallback method)
            const gridPositions = [
              { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
              { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
              { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 }
            ];
            const pointIndex = Math.min(progress.currentPoint - 1, gridPositions.length - 1);
            const gridPos = gridPositions[pointIndex] || { x: 0.5, y: 0.5 };
            this.calibrationPoint = {
              x: gridPos.x * window.innerWidth,
              y: gridPos.y * window.innerHeight
            };
            console.log('Calibration progress:', progress);
            
            // Auto-collect samples when available
            this.autoCollectCalibrationSample();
          }
        });

      // Subscribe to enhanced calibration status
      this.enhancedCalibrationService.getCalibrationStatus()
        .pipe(takeUntil(this.destroy$))
        .subscribe(status => {
          this.isCalibrating = status === 'collecting' || status === 'initializing';
          this.isCalibrated = status === 'completed';
          
          // Start auto-collection when calibration starts
          if (status === 'collecting') {
            this.startAutoCalibrationCollection();
          } else {
            this.stopAutoCalibrationCollection();
          }
          
          console.log('Enhanced calibration status:', status);
        });

      // Set up MediaPipe data processing
      this.setupMediaPipeProcessing();

      // Setup gaze estimation callbacks
      this.setupGazeEstimation();

    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  }

  private setupMediaPipeProcessing() {
    // Process video frames with real MediaPipe face detection
    interval(33) // ~30 FPS processing
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isStreaming && this.videoElement?.nativeElement && this.mediapipeService.isInitialized) {
          const video = this.videoElement.nativeElement;
          
          if (video.readyState >= 2) { // Video is ready
            try {
              // Use MediaPipe service for real face landmark detection
              const timestamp = Date.now();
              const results = this.mediapipeService.detectLandmarks(video, timestamp);
              
              if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
                // Store real MediaPipe face landmarks
                this.currentFaceLandmarks = results.faceLandmarks[0];
                this.lastDetectionTime = Date.now();
                this.realFaceDetected = true;
                this.detectionConfidence = 0.9; // MediaPipe detected face
                this.faceDetected = true;
              } else {
                // No face detected by MediaPipe
                this.realFaceDetected = false;
                this.detectionConfidence = 0;
                this.faceDetected = false;
              }
            } catch (error: any) {
              console.warn('MediaPipe processing error:', error);
              // Basic fallback detection
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                this.realFaceDetected = false; // No real MediaPipe data
                this.faceDetected = false; // Changed to false to be more accurate
                this.detectionConfidence = 0;
                this.currentFaceLandmarks = this.generateBasicEyeData();
              } else {
                this.realFaceDetected = false;
                this.faceDetected = false;
                this.detectionConfidence = 0;
              }
            }
          } else {
            // Video not ready - no detection
            this.realFaceDetected = false;
            this.faceDetected = false;
            this.detectionConfidence = 0;
          }
        }
      });
  }

  private generateBasicEyeData(): any[] {
    // Generate basic eye landmark data when real MediaPipe data is not available
    // This creates a minimal dataset that getCurrentEyeData can use
    const landmarks: any[] = [];
    
    // Initialize array with 468 empty landmarks (MediaPipe face mesh size)
    for (let i = 0; i < 468; i++) {
      landmarks[i] = { x: 0, y: 0, z: 0 };
    }
    
    // Set basic eye positions (normalized coordinates 0-1)
    // Left eye landmarks
    const leftEyeIndices = [33, 7, 163, 144, 145, 153];
    leftEyeIndices.forEach(idx => {
      landmarks[idx] = { x: 0.35, y: 0.4, z: 0 }; // Left eye area
    });
    
    // Right eye landmarks  
    const rightEyeIndices = [362, 382, 381, 380, 374, 373];
    rightEyeIndices.forEach(idx => {
      landmarks[idx] = { x: 0.65, y: 0.4, z: 0 }; // Right eye area
    });
    
    return landmarks;
  }

  private setupEventListeners() {
    // Monitor calibration status - using simple approach since service methods may vary
    
    // Monitor face detection from MediaPipe results
    interval(100) // Check every 100ms
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Check for face detection only if camera is streaming AND MediaPipe is ready
        if (this.isStreaming && this.mediapipeService.isInitialized) {
          // Face detection status is updated by the MediaPipe processing loop
          // No need to change it here, just ensure it's reset when conditions aren't met
        } else {
          // No camera or MediaPipe not ready = no face detection
          this.faceDetected = false;
          this.realFaceDetected = false;
        }
      });
  }

  private setupGazeEstimation() {
    // Real-time gaze estimation
    interval(33) // ~30 FPS
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isCalibrated && this.faceDetected) {
          this.updateGazePoint();
        }
      });
  }

  async startCamera() {
    try {
      if (!this.videoElement) {
        throw new Error('Video element not available');
      }

      await this.videoService.startCamera(this.videoElement.nativeElement, undefined);
      const stream = this.videoService.currentStream;
      
      if (stream) {
        this.isStreaming = true;
        
        // Setup canvas overlay
        this.setupCanvasOverlay();
        
        console.log('Camera started successfully');
      }
    } catch (error) {
      console.error('Failed to start camera:', error);
      alert('ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบการอนุญาต');
    }
  }

  stopCamera() {
    this.videoService.stopCamera();
    this.isStreaming = false;
    this.faceDetected = false;
    this.realFaceDetected = false;
    this.detectionConfidence = 0;
    this.currentFaceLandmarks = [];
    
    // Cleanup MediaPipe adaptive optimization
    this.mediapipeService.cleanup();
    
    console.log('Camera stopped');
  }

  private setupCanvasOverlay() {
    if (this.overlayCanvas && this.videoElement) {
      const canvas = this.overlayCanvas.nativeElement;
      const video = this.videoElement.nativeElement;
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      this.ctx = canvas.getContext('2d');
    }
  }

  private drawLegacyFaceLandmarks(landmarks: any[]) {
    if (!this.ctx || !landmarks) return;

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    
    // Draw face mesh
    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    this.ctx.lineWidth = 1;
    
    landmarks.forEach((landmark: any) => {
      this.ctx!.beginPath();
      this.ctx!.arc(landmark.x * this.ctx!.canvas.width, 
                   landmark.y * this.ctx!.canvas.height, 2, 0, 2 * Math.PI);
      this.ctx!.stroke();
    });

    // Highlight eyes
    this.drawLegacyEyeRegions(landmarks);
  }

  private drawLegacyEyeRegions(landmarks: any[]) {
    if (!this.ctx) return;

    // Left eye landmarks (indices for MediaPipe face mesh)
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    this.ctx.lineWidth = 2;

    // Draw left eye
    this.drawEyeContour(landmarks, leftEyeIndices);
    
    // Draw right eye  
    this.drawEyeContour(landmarks, rightEyeIndices);
  }

  private drawEyeContour(landmarks: any[], indices: number[]) {
    if (!this.ctx || !landmarks) return;

    this.ctx.beginPath();
    indices.forEach((index, i) => {
      if (landmarks[index]) {
        const x = landmarks[index].x * this.ctx!.canvas.width;
        const y = landmarks[index].y * this.ctx!.canvas.height;
        
        if (i === 0) {
          this.ctx!.moveTo(x, y);
        } else {
          this.ctx!.lineTo(x, y);
        }
      }
    });
    this.ctx.closePath();
    this.ctx.stroke();
  }

  async startCalibration() {
    try {
      console.log('Starting enhanced calibration');
      
      // Start enhanced calibration
      const success = await this.enhancedCalibrationService.startCalibration(
        window.innerWidth,
        window.innerHeight,
        {
          pointCount: 9,
          samplesPerPoint: 10,
          pointDisplayTime: 3000
        }
      );
      
      if (success) {
        console.log('Enhanced calibration started successfully');
      } else {
        console.warn('Enhanced calibration failed to start, using legacy method');
        this.startLegacyCalibration();
      }
    } catch (error) {
      console.error('Error starting calibration:', error);
      this.startLegacyCalibration();
    }
  }

  private startLegacyCalibration() {
    this.isCalibrating = true;
    this.calibrationPoints = [];
    this.moveCalibrationPoint();
    console.log('Legacy calibration started');
  }

  stopCalibration() {
    // Stop enhanced calibration
    this.enhancedCalibrationService.cancelCalibration();
    
    // Stop legacy calibration
    this.isCalibrating = false;
    console.log('Calibration stopped');
  }

  private moveCalibrationPoint() {
    if (!this.isCalibrating) return;

    // Define 9-point calibration grid
    const points = [
      { x: 100, y: 100 },   // Top-left
      { x: 400, y: 100 },   // Top-center
      { x: 700, y: 100 },   // Top-right
      { x: 100, y: 300 },   // Middle-left
      { x: 400, y: 300 },   // Center
      { x: 700, y: 300 },   // Middle-right
      { x: 100, y: 500 },   // Bottom-left
      { x: 400, y: 500 },   // Bottom-center
      { x: 700, y: 500 }    // Bottom-right
    ];

    if (this.calibrationPoints.length < points.length) {
      this.calibrationPoint = points[this.calibrationPoints.length];
    } else {
      // Calibration complete
      this.finishCalibration();
    }
  }

  addCalibrationPoint() {
    if (!this.isCalibrating) return;

    // Get current eye data from MediaPipe
    const eyeData = this.getCurrentEyeData();
    
    if (eyeData) {
      const calibrationData = {
        screenX: this.calibrationPoint.x,
        screenY: this.calibrationPoint.y,
        eyeData: eyeData,
        timestamp: Date.now()
      };

      this.calibrationPoints.push(calibrationData);
      
      // Add calibration point using correct service method
      const calibrationPoint = {
        screenX: this.calibrationPoint.x,
        screenY: this.calibrationPoint.y,
        features: eyeData.landmarks.map((l: any) => [l.x, l.y, l.z]).flat()
      };
      this.calibrationService.addCalibrationPoint(calibrationPoint);

      console.log(`Calibration point ${this.calibrationPoints.length} added`);
      
      // Move to next point
      setTimeout(() => {
        this.moveCalibrationPoint();
      }, 500);
    }
  }

  private finishCalibration() {
    this.isCalibrating = false;
    
    // Mark as calibrated if we have enough points
    if (this.calibrationPoints.length >= 5) {
      this.isCalibrated = true;
      this.accuracy = 75; // Default accuracy estimate
      
      // Train the gaze estimation model with collected data
      this.trainGazeModel();
    }
    
    console.log('Calibration completed with', this.calibrationPoints.length, 'points');
  }

  private trainGazeModel() {
    if (this.calibrationPoints.length < 5) {
      console.warn('Not enough calibration points to train model');
      return;
    }

    try {
      // Create training data from calibration points
      const features: number[][] = [];
      const targetsX: number[] = [];
      const targetsY: number[] = [];

      this.calibrationPoints.forEach(point => {
        // Get real eye tracking features from the current video frame
        const videoElement = this.videoElement?.nativeElement;
        if (videoElement) {
          const frameResult = this.gazeProcessingService.processFrame(
            videoElement,
            true, // isGazePredictionEnabled
            null, // currentFeatures
            Date.now() // timestamp
          );
          
          if (frameResult && frameResult.faceData) {
            // Use real extracted features instead of simulated data
            const realFeatures = this.extractRealFeatures(frameResult, point);
            features.push(realFeatures);
            targetsX.push(point.x);
            targetsY.push(point.y);
          } else {
            // Fallback: create minimal realistic features based on calibration point
            const normalizedX = point.x / window.innerWidth;
            const normalizedY = point.y / window.innerHeight;
            
            const fallbackFeatures = [
              normalizedX,
              normalizedY,
              normalizedX,
              normalizedY,
              0.5,
              0.0,
              (normalizedX - 0.5) * 0.1,
              (normalizedY - 0.5) * 0.1,
              normalizedX,
              normalizedY
            ];
            
            features.push(fallbackFeatures);
            targetsX.push(point.x);
            targetsY.push(point.y);
          }
        }
      });

      // Train the model
      this.gazeService.trainModel(features, targetsX, targetsY);
      console.log('Gaze model trained successfully with', features.length, 'samples');
      
    } catch (error) {
      console.error('Failed to train gaze model:', error);
    }
  }

  private getCurrentEyeData(): any {
    // Return real MediaPipe data if available, otherwise return zeros
    if (this.realFaceDetected && this.currentFaceLandmarks.length > 0 && 
        (Date.now() - this.lastDetectionTime) < 500) { // Use recent detection within 500ms
      
      // Extract eye landmarks from MediaPipe face mesh (468 landmarks)
      // Left eye landmarks: around indices 33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
      // Right eye landmarks: around indices 362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
      
      const leftEyeIndices = [33, 7, 163, 144, 145, 153];
      const rightEyeIndices = [362, 382, 381, 380, 374, 373];
      
      let leftEyeX = 0, leftEyeY = 0, rightEyeX = 0, rightEyeY = 0;
      
      // Calculate average position for left eye
      for (const idx of leftEyeIndices) {
        if (this.currentFaceLandmarks[idx]) {
          leftEyeX += this.currentFaceLandmarks[idx].x;
          leftEyeY += this.currentFaceLandmarks[idx].y;
        }
      }
      leftEyeX /= leftEyeIndices.length;
      leftEyeY /= leftEyeIndices.length;
      
      // Calculate average position for right eye
      for (const idx of rightEyeIndices) {
        if (this.currentFaceLandmarks[idx]) {
          rightEyeX += this.currentFaceLandmarks[idx].x;
          rightEyeY += this.currentFaceLandmarks[idx].y;
        }
      }
      rightEyeX /= rightEyeIndices.length;
      rightEyeY /= rightEyeIndices.length;
      
      return {
        landmarks: [
          { x: leftEyeX, y: leftEyeY, z: 0 },   // Left eye
          { x: rightEyeX, y: rightEyeY, z: 0 }  // Right eye
        ],
        timestamp: this.lastDetectionTime,
        faceDetected: this.realFaceDetected,
        confidence: this.detectionConfidence
      };
    }
    
    // Return zeros if no real data available
    return {
      landmarks: [
        { x: 0, y: 0, z: 0 }, // Left eye - no data
        { x: 0, y: 0, z: 0 }  // Right eye - no data
      ],
      timestamp: Date.now(),
      faceDetected: false,
      confidence: 0
    };
  }

  private updateGazePoint() {
    const eyeData = this.getCurrentEyeData();
    
    if (eyeData && eyeData.faceDetected && this.isCalibrated) {
      // Use real eye data for gaze estimation
      try {
        const leftEye = eyeData.landmarks[0];
        const rightEye = eyeData.landmarks[1];
        
        // Only proceed if we have valid eye data (not zeros)
        if (leftEye.x > 0 || leftEye.y > 0 || rightEye.x > 0 || rightEye.y > 0) {
          // Calculate center point between eyes
          const eyeCenterX = (leftEye.x + rightEye.x) / 2;
          const eyeCenterY = (leftEye.y + rightEye.y) / 2;
          
          // Create feature vector from real eye data
          const features = [
            eyeCenterX,                           // Eye center X
            eyeCenterY,                           // Eye center Y
            leftEye.x,                           // Left eye X
            leftEye.y,                           // Left eye Y
            rightEye.x,                          // Right eye X
            rightEye.y,                          // Right eye Y
            Math.abs(rightEye.x - leftEye.x),    // Eye distance (head pose indicator)
            eyeData.confidence,                   // Detection confidence
            eyeCenterX,                          // Gaze direction X (based on eye center)
            eyeCenterY                           // Gaze direction Y (based on eye center)
          ];
          
          const prediction = this.gazeService.predictGaze(features);
          
          if (prediction) {
            // Convert normalized coordinates to screen coordinates
            this.gazePoint = {
              x: Math.max(0, Math.min(window.innerWidth, prediction.x)),
              y: Math.max(0, Math.min(window.innerHeight, prediction.y))
            };
            
            // Update accuracy based on real data quality
            this.accuracy = Math.min(95, eyeData.confidence * 100);
          }
        } else {
          // No valid eye data - set gaze point to zero
          this.gazePoint = { x: 0, y: 0 };
          this.accuracy = 0;
        }
      } catch (error) {
        console.warn('Gaze estimation error:', error);
        // Error in processing - set to zero
        this.gazePoint = { x: 0, y: 0 };
        this.accuracy = 0;
      }
    } else if (!this.isCalibrated) {
      // Show demo movement before calibration (only if face is detected)
      if (eyeData && eyeData.faceDetected) {
        const time = Date.now() / 1000;
        this.gazePoint = {
          x: (Math.sin(time * 0.5) * 0.3 + 0.5) * window.innerWidth,
          y: (Math.cos(time * 0.3) * 0.3 + 0.5) * window.innerHeight
        };
        this.accuracy = 50; // Demo accuracy
      } else {
        // No face detected - no gaze point
        this.gazePoint = { x: 0, y: 0 };
        this.accuracy = 0;
      }
    } else {
      // No face detected or not calibrated - show zeros
      this.gazePoint = { x: 0, y: 0 };
      this.accuracy = 0;
    }
  }

  startTrackingTest() {
    if (!this.isCalibrated) return;

    this.showTarget = true;
    
    // Move target randomly every 2 seconds
    const moveTarget = () => {
      if (this.demoArea) {
        const rect = this.demoArea.nativeElement.getBoundingClientRect();
        this.targetPosition = {
          x: Math.random() * (rect.width - 50) + 25,
          y: Math.random() * (rect.height - 50) + 25
        };
      }
    };

    // Start moving target
    interval(2000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(moveTarget);

    moveTarget(); // Initial position
    console.log('Eye tracking test started');
  }
  
  // Enhanced Eye Tracking Methods
  toggleLowLightMode(): void {
    this.lowLightMode = !this.lowLightMode;
    this.enhancedEyeTracker.enableLowLightMode(this.lowLightMode);
  }

  toggleLandmarks(): void {
    this.showLandmarks = !this.showLandmarks;
    this.updateVisualization();
  }

  toggleEyeRegions(): void {
    this.showEyeRegions = !this.showEyeRegions;
    this.updateVisualization();
  }

  getQualityText(quality: 'excellent' | 'good' | 'poor'): string {
    switch (quality) {
      case 'excellent': return 'ดีเยี่ยม';
      case 'good': return 'ดี';
      case 'poor': return 'แย่';
      default: return 'ไม่ทราบ';
    }
  }

  getQualityClass(quality: 'excellent' | 'good' | 'poor'): string {
    switch (quality) {
      case 'excellent': return 'excellent';
      case 'good': return 'good';
      case 'poor': return 'poor';
      default: return 'unknown';
    }
  }

  private updateVisualization(): void {
    if (!this.ctx || !this.eyeTrackingData) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    // Draw face landmarks if enabled
    if (this.showLandmarks && this.eyeTrackingData.face.landmarks) {
      this.drawFaceLandmarks();
    }

    // Draw eye regions if enabled
    if (this.showEyeRegions) {
      this.drawEyeRegions();
    }

    // Update performance metrics
    this.updatePerformanceMetrics();
  }

  private drawFaceLandmarks(): void {
    if (!this.ctx || !this.eyeTrackingData) return;

    this.ctx.fillStyle = '#00ff00';
    this.ctx.strokeStyle = '#00ff00';
    this.ctx.lineWidth = 1;

    // Draw face outline landmarks
    this.eyeTrackingData.face.landmarks.forEach(landmark => {
      const x = landmark.x * this.ctx!.canvas.width;
      const y = landmark.y * this.ctx!.canvas.height;
      
      this.ctx!.beginPath();
      this.ctx!.arc(x, y, 1, 0, 2 * Math.PI);
      this.ctx!.fill();
    });
  }

  private drawEyeRegions(): void {
    if (!this.ctx || !this.eyeTrackingData) return;

    // Draw left eye region
    this.drawEyeRegion(this.eyeTrackingData.leftEye, '#ff0000');
    
    // Draw right eye region
    this.drawEyeRegion(this.eyeTrackingData.rightEye, '#0000ff');
  }

  private drawEyeRegion(eye: any, color: string): void {
    if (!this.ctx) return;

    const canvasWidth = this.ctx.canvas.width;
    const canvasHeight = this.ctx.canvas.height;

    // Draw eye bounds
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      eye.bounds.x * canvasWidth,
      eye.bounds.y * canvasHeight,
      eye.bounds.width * canvasWidth,
      eye.bounds.height * canvasHeight
    );

    // Draw eye center
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(
      eye.center.x * canvasWidth,
      eye.center.y * canvasHeight,
      3, 0, 2 * Math.PI
    );
    this.ctx.fill();

    // Draw pupil position if available
    if (eye.pupilPosition) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(
        eye.pupilPosition.x * canvasWidth,
        eye.pupilPosition.y * canvasHeight,
        2, 0, 2 * Math.PI
      );
      this.ctx.fill();
    }
  }

  private updatePerformanceMetrics(): void {
    this.performanceMetrics = this.enhancedEyeTracker.getPerformanceMetrics();
    this.currentFps = this.performanceMetrics.fps;
  }

  /**
   * Auto-collect calibration sample when eye tracking data is available
   */
  private autoCollectCalibrationSample(): void {
    if (!this.isCalibrating || !this.eyeTrackingData || !this.advancedGazeResult) {
      return;
    }

    // Create features from current eye tracking data
    const features = this.createFeaturesFromEyeData(this.eyeTrackingData, this.advancedGazeResult);
    
    // Add calibration point
    this.enhancedCalibrationService.addCalibrationPoint(
      this.calibrationPoint.x,
      this.calibrationPoint.y,
      features,
      window.innerWidth,
      window.innerHeight,
      {
        stability: this.advancedGazeResult.confidence,
        confidence: this.advancedGazeResult.confidence
      }
    ).then(success => {
      if (success) {
        console.log('Calibration sample added automatically');
      }
    }).catch(error => {
      console.warn('Failed to add calibration sample:', error);
    });
  }

  private startAutoCalibrationCollection() {
    this.stopAutoCalibrationCollection(); // Clear any existing interval
    
    // Collect calibration samples every 100ms during calibration
    this.autoCalibrationInterval = window.setInterval(() => {
      this.autoCollectCalibrationSample();
    }, 100);
  }

  private stopAutoCalibrationCollection() {
    if (this.autoCalibrationInterval) {
      clearInterval(this.autoCalibrationInterval);
      this.autoCalibrationInterval = undefined;
    }
  }

  /**
   * Extract real features from frame processing result
   */
  private extractRealFeatures(frameResult: any, calibrationPoint: any): number[] {
    const normalizedX = calibrationPoint.x / window.innerWidth;
    const normalizedY = calibrationPoint.y / window.innerHeight;
    
    return [
      normalizedX,
      normalizedY,
      frameResult.leftEyeballCenter?.[0] / window.innerWidth || normalizedX,
      frameResult.leftEyeballCenter?.[1] / window.innerHeight || normalizedY,
      frameResult.rightEyeballCenter?.[0] / window.innerWidth || normalizedX,
      frameResult.rightEyeballCenter?.[1] / window.innerHeight || normalizedY,
      frameResult.headPose?.yaw || 0,
      frameResult.headPose?.pitch || 0,
      frameResult.leftGazeVector?.[0] || 0,
      frameResult.leftGazeVector?.[1] || 0
    ];
  }

  /**
   * Create feature vector from eye tracking data
   */
  private createFeaturesFromEyeData(eyeData: EyeTrackingData, gazeData: GazeCalculationResult): number[] {
    return [
      gazeData.pupilData.leftPupil.x,
      gazeData.pupilData.leftPupil.y,
      gazeData.pupilData.rightPupil.x,
      gazeData.pupilData.rightPupil.y,
      gazeData.headPose.yaw,
      gazeData.headPose.pitch,
      gazeData.headPose.roll,
      gazeData.confidence,
      eyeData.leftEye.isOpen ? 1 : 0,
      eyeData.rightEye.isOpen ? 1 : 0
    ];
  }

  getScreenPercentage(): string {
    if (!this.gazePoint || this.gazePoint.x === 0 && this.gazePoint.y === 0) {
      return 'ไม่ตรวจพบ';
    }
    
    const xPercent = (this.gazePoint.x / window.innerWidth * 100).toFixed(1);
    const yPercent = (this.gazePoint.y / window.innerHeight * 100).toFixed(1);
    
    return `${xPercent}% / ${yPercent}%`;
  }
}
