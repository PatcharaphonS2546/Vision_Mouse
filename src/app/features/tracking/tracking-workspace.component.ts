/**
 * Eye Tracking Workspace Component - UI Only
 * Simplified version for UI interaction, backend will handle tracking logic
 */

import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, interval, BehaviorSubject } from 'rxjs';

import { 
  StateService, 
  CameraService,
  ErrorHandlerService,
  NotificationService
} from '../../core/core.module';

import {
  Point2D,
  SystemStatus
} from '../../core/interfaces/core.interface';

// UI-only interfaces
interface GazeData {
  position: Point2D;
  confidence: number;
  timestamp: number;
}

interface TrackingSettings {
  sensitivity: number;
  smoothing: number;
  calibrationEnabled: boolean;
  mouseControlEnabled: boolean;
}

// UI-only camera status type
type CameraStatusType = 'disconnected' | 'initializing' | 'ready' | 'error';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  selector: 'app-tracking-workspace',
  template: `
    <div class="tracking-workspace">
      <div class="workspace-header">
        <h2>Eye Tracking Workspace</h2>
        <div class="tracking-status" [ngClass]="'status-' + trackingStatus">
          <span class="status-dot"></span>
          {{ getStatusText(trackingStatus) }}
        </div>
      </div>

      <!-- Camera Preview -->
      <div class="camera-section">
        <div class="camera-preview" [ngClass]="{'camera-ready': cameraReady}">
          <video #videoElement autoplay muted playsinline></video>
          <div class="camera-overlay">
            <div *ngIf="!cameraReady" class="camera-status">
              <i class="icon-camera-off"></i>
              <p>กำลังรอกล้อง...</p>
            </div>
            
            <!-- Gaze visualization -->
            <div *ngIf="currentGaze && showGazePoint" 
                 class="gaze-point"
                 [style.left.px]="currentGaze.position.x"
                 [style.top.px]="currentGaze.position.y">
            </div>
          </div>
        </div>
      </div>

      <!-- Control Panel -->
      <div class="control-panel">
        <div class="controls-section">
          <h3>Tracking Controls</h3>
          
          <div class="control-group">
            <button (click)="startTracking()" [disabled]="isTracking || !cameraReady" class="btn-primary">
              <i class="icon-play"></i> Start Tracking
            </button>
            <button (click)="stopTracking()" [disabled]="!isTracking" class="btn-secondary">
              <i class="icon-stop"></i> Stop Tracking
            </button>
            <button (click)="calibrate()" [disabled]="isTracking" class="btn-success">
              <i class="icon-target"></i> Calibrate
            </button>
          </div>
          
          <div class="settings-group">
            <div class="setting-item">
              <label>Sensitivity:</label>
              <input type="range" 
                     min="0.1" max="2.0" step="0.1"
                     [(ngModel)]="settings.sensitivity"
                     [disabled]="isTracking">
              <span>{{ settings.sensitivity }}</span>
            </div>
            
            <div class="setting-item">
              <label>Smoothing:</label>
              <input type="range" 
                     min="0" max="1" step="0.1"
                     [(ngModel)]="settings.smoothing"
                     [disabled]="isTracking">
              <span>{{ settings.smoothing }}</span>
            </div>
            
            <div class="checkbox-group">
              <label>
                <input type="checkbox" 
                       [(ngModel)]="settings.mouseControlEnabled"
                       [disabled]="isTracking">
                Mouse Control
              </label>
              <label>
                <input type="checkbox" 
                       [(ngModel)]="showGazePoint">
                Show Gaze Point
              </label>
            </div>
          </div>
        </div>

        <!-- Real-time Metrics -->
        <div class="metrics-section">
          <h3>Real-time Metrics</h3>
          <div class="metrics-grid">
            <div class="metric-card">
              <label>FPS:</label>
              <span class="metric-value">{{ currentFPS | number:'1.0-0' }}</span>
            </div>
            <div class="metric-card">
              <label>Latency:</label>
              <span class="metric-value">{{ currentLatency | number:'1.0-0' }}ms</span>
            </div>
            <div class="metric-card">
              <label>Accuracy:</label>
              <span class="metric-value">{{ (currentAccuracy * 100) | number:'1.1-1' }}%</span>
            </div>
            <div class="metric-card">
              <label>Confidence:</label>
              <span class="metric-value">{{ (currentGaze?.confidence || 0) * 100 | number:'1.0-0' }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Gaze Visualization Canvas -->
      <div class="visualization-section" *ngIf="isTracking">
        <h3>Gaze Visualization</h3>
        <canvas #gazeCanvas width="800" height="600"></canvas>
        
        <div class="visualization-controls">
          <button (click)="clearTrail()" class="btn-secondary">Clear Trail</button>
          <button (click)="exportGazeData()" class="btn-success">Export Data</button>
        </div>
      </div>

      <!-- System Information -->
      <div class="system-info">
        <h3>System Status</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Camera Status:</label>
            <span [ngClass]="'status-' + cameraStatus">{{ getCameraStatusText(cameraStatus) }}</span>
          </div>
          <div class="info-item">
            <label>Processing Load:</label>
            <span>{{ processingLoad | number:'1.0-0' }}%</span>
          </div>
          <div class="info-item">
            <label>Memory Usage:</label>
            <span>{{ memoryUsage | number:'1.0-0' }}MB</span>
          </div>
          <div class="info-item">
            <label>Session Duration:</label>
            <span>{{ sessionDuration | number:'1.0-0' }}s</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './tracking-workspace.component.css'
})
export class TrackingWorkspaceComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('gazeCanvas') gazeCanvas!: ElementRef<HTMLCanvasElement>;
  
  private destroy$ = new Subject<void>();
  private gazeTrail: Point2D[] = [];
  private sessionStartTime = 0;

  // UI State
  trackingStatus: 'idle' | 'initializing' | 'tracking' | 'calibrating' | 'error' = 'idle';
  cameraStatus: CameraStatusType = 'disconnected';
  cameraReady = false;
  isTracking = false;
  showGazePoint = true;

  // Settings
  settings: TrackingSettings = {
    sensitivity: 1.0,
    smoothing: 0.3,
    calibrationEnabled: true,
    mouseControlEnabled: false
  };

  // Real-time Data
  currentGaze: GazeData | null = null;
  currentFPS = 0;
  currentLatency = 0;
  currentAccuracy = 0;
  processingLoad = 0;
  memoryUsage = 0;
  sessionDuration = 0;

  constructor(
    private http: HttpClient,
    private stateService: StateService,
    private cameraService: CameraService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.initializeWorkspace();
    this.checkCameraStatus();
  }

  ngAfterViewInit() {
    this.initializeCamera();
    this.initializeCanvas();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopTracking();
  }

  private initializeWorkspace() {
    console.log('Tracking Workspace initialized - UI Only Mode');
  }

  private initializeCamera() {
    // Mock camera initialization
    setTimeout(() => {
      this.cameraReady = true;
      this.cameraStatus = 'ready';
      this.cdr.detectChanges();
    }, 2000);
  }

  private initializeCanvas() {
    if (this.gazeCanvas) {
      const canvas = this.gazeCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  private checkCameraStatus() {
    // Mock camera status check
    this.cameraStatus = 'initializing';
    
    setTimeout(() => {
      this.cameraStatus = 'ready';
      this.cameraReady = true;
    }, 1500);
  }

  startTracking() {
    if (!this.cameraReady) {
      this.notifications.showError('Camera not ready');
      return;
    }

    this.isTracking = true;
    this.trackingStatus = 'tracking';
    this.sessionStartTime = Date.now();
    
    // Start simulation
    this.simulateTracking();
    
    this.notifications.showSuccess('Eye tracking started');
    console.log('Eye tracking started');
  }

  stopTracking() {
    this.isTracking = false;
    this.trackingStatus = 'idle';
    this.sessionDuration = (Date.now() - this.sessionStartTime) / 1000;
    
    this.notifications.showInfo('Eye tracking stopped');
    console.log('Eye tracking stopped');
  }

  calibrate() {
    this.trackingStatus = 'calibrating';
    
    // Mock calibration process
    setTimeout(() => {
      this.trackingStatus = 'idle';
      this.notifications.showSuccess('Calibration completed');
    }, 3000);
    
    console.log('Starting calibration...');
  }

  private simulateTracking() {
    interval(50).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (this.isTracking) {
        this.updateMockGaze();
        this.updateMetrics();
        this.drawGazeVisualization();
        this.sessionDuration = (Date.now() - this.sessionStartTime) / 1000;
      }
    });
  }

  private updateMockGaze() {
    // Generate mock gaze data
    this.currentGaze = {
      position: {
        x: Math.random() * 800,
        y: Math.random() * 600
      },
      confidence: Math.random() * 0.3 + 0.7,
      timestamp: Date.now()
    };

    // Add to trail
    this.gazeTrail.push(this.currentGaze.position);
    if (this.gazeTrail.length > 100) {
      this.gazeTrail.shift();
    }
  }

  private updateMetrics() {
    this.currentFPS = Math.random() * 10 + 25;
    this.currentLatency = Math.random() * 20 + 15;
    this.currentAccuracy = Math.random() * 0.2 + 0.8;
    this.processingLoad = Math.random() * 30 + 20;
    this.memoryUsage = Math.random() * 100 + 150;
  }

  private drawGazeVisualization() {
    const canvas = this.gazeCanvas?.nativeElement;
    if (!canvas || !this.isTracking) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw gaze trail
    if (this.gazeTrail.length > 1) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < this.gazeTrail.length; i++) {
        const point = this.gazeTrail[i];
        const alpha = i / this.gazeTrail.length;
        
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      
      ctx.stroke();
    }

    // Draw current gaze point
    if (this.currentGaze) {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(this.currentGaze.position.x, this.currentGaze.position.y, 8, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  clearTrail() {
    this.gazeTrail = [];
    console.log('Gaze trail cleared');
  }

  exportGazeData() {
    const data = {
      session: {
        startTime: this.sessionStartTime,
        duration: this.sessionDuration,
        settings: this.settings
      },
      gazeTrail: this.gazeTrail,
      exportTime: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gaze_data_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    this.notifications.showSuccess('Gaze data exported');
    console.log('Gaze data exported');
  }

  getStatusText(status: string): string {
    const statusTexts: { [key: string]: string } = {
      'idle': 'Ready',
      'initializing': 'Initializing',
      'tracking': 'Tracking',
      'calibrating': 'Calibrating',
      'error': 'Error'
    };
    return statusTexts[status] || 'Unknown';
  }

  getCameraStatusText(status: CameraStatusType): string {
    const statusTexts: { [key: string]: string } = {
      'disconnected': 'Disconnected',
      'initializing': 'Initializing',
      'ready': 'Ready',
      'error': 'Error'
    };
    return statusTexts[status] || 'Unknown';
  }
}
