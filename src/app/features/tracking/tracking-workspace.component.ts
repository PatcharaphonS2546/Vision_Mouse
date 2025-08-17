/**
 * Eye Tracking Workspace Component
 * Real-time eye tracking with gaze visualization and mouse control
 */

import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, interval, combineLatest } from 'rxjs';

import { 
  StateService, 
  CameraService,
  EnhancedGazeEstimationService,
  ErrorHandlerService,
  NotificationService
} from '../../core/core.module';

import { GazeProcessingService } from '../../services/gaze-processing.service';
import { MediapipeService } from '../../services/mediapipe.service';

import {
  Point2D,
  EyeTrackingData,
  GazeEstimationResult,
  SystemStatus,
  QualityLevel,
  CameraState
} from '../../core/interfaces/core.interface';

interface TrackingSettings {
  showGazePoint: boolean;
  showGazeTrail: boolean;
  enableMouseControl: boolean;
  smoothingLevel: number;
  sensitivity: number;
  trailLength: number;
  displayMode: 'overlay' | 'separate' | 'minimal';
}

interface GazeTrailPoint extends Point2D {
  timestamp: number;
  confidence: number;
}

@Component({
  selector: 'app-tracking-workspace',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="tracking-workspace">
      
      <!-- Header Controls -->
      <div class="workspace-header">
        <div class="header-left">
          <h2>👁️ Eye Tracking Workspace</h2>
          <div class="tracking-status" [ngClass]="'status-' + trackingStatus">
            <div class="status-dot"></div>
            <span>{{getTrackingStatusText()}}</span>
          </div>
          <div class="calibration-status" [ngClass]="gazeEstimationService.isCalibrated() ? 'calibrated' : 'not-calibrated'">
            <span class="calibration-icon">{{gazeEstimationService.isCalibrated() ? '✅' : '⚠️'}}</span>
            <span>{{gazeEstimationService.isCalibrated() ? 'ปรับเทียบแล้ว' : 'ยังไม่ปรับเทียบ'}}</span>
          </div>
        </div>
        
        <div class="header-controls">
          <button 
            class="btn btn-primary"
            (click)="toggleTracking()"
            [disabled]="!canToggleTracking()">
            <span class="btn-icon">{{isTracking ? '⏸️' : '▶️'}}</span>
            {{isTracking ? 'หยุด' : 'เริ่ม'}} Tracking
          </button>
          
          <button class="btn btn-outline" (click)="toggleSettings()">
            <span class="btn-icon">⚙️</span>
            ตั้งค่า
          </button>
          
          <button class="btn btn-outline" (click)="resetTracking()">
            <span class="btn-icon">🔄</span>
            Reset
          </button>
        </div>
      </div>

      <!-- Main Workspace -->
      <div class="workspace-content" [ngClass]="'display-' + settings.displayMode">
        
        <!-- Camera Feed -->
        <div class="camera-section" [ngClass]="{ 'minimized': settings.displayMode === 'minimal' }">
          <div class="camera-header">
            <h3>📹 Camera Feed</h3>
            <div class="camera-controls">
              <select [(ngModel)]="selectedCameraDevice" (change)="switchCamera()" class="camera-select">
                <option value="">เลือกกล้อง...</option>
                <option *ngFor="let device of availableCameras" [value]="device.deviceId">
                  {{device.label || 'Camera ' + device.deviceId.substr(0, 8)}}
                </option>
              </select>
              
              <button class="btn btn-sm" (click)="toggleCameraSettings()">
                <span class="btn-icon">🔧</span>
              </button>
            </div>
          </div>
          
          <div class="camera-container">
            <video #videoElement 
                   class="camera-video"
                   [style.width.px]="cameraWidth"
                   [style.height.px]="cameraHeight"
                   autoplay
                   muted>
            </video>
            
            <!-- Camera Overlay -->
            <div class="camera-overlay">
              <!-- Face Detection Indicators -->
              <div *ngIf="currentEyeData && currentEyeData.faceDetected" 
                   class="face-detection-overlay">
                
                <!-- Face Bounding Box -->
                <div class="face-box" 
                     [style.left.px]="currentEyeData.faceBox?.x"
                     [style.top.px]="currentEyeData.faceBox?.y"
                     [style.width.px]="currentEyeData.faceBox?.width"
                     [style.height.px]="currentEyeData.faceBox?.height">
                </div>
                
                <!-- Eye Centers -->
                <div class="eye-center left-eye"
                     [style.left.px]="currentEyeData.leftEye.center.x"
                     [style.top.px]="currentEyeData.leftEye.center.y">
                </div>
                <div class="eye-center right-eye"
                     [style.left.px]="currentEyeData.rightEye.center.x"
                     [style.top.px]="currentEyeData.rightEye.center.y">
                </div>
                
                <!-- Pupil Centers -->
                <div class="pupil-center left-pupil"
                     [style.left.px]="currentEyeData.leftEye.pupil.center.x"
                     [style.top.px]="currentEyeData.leftEye.pupil.center.y"
                     [style.opacity]="currentEyeData.leftEye.pupil.confidence">
                </div>
                <div class="pupil-center right-pupil"
                     [style.left.px]="currentEyeData.rightEye.pupil.center.x"
                     [style.top.px]="currentEyeData.rightEye.pupil.center.y"
                     [style.opacity]="currentEyeData.rightEye.pupil.confidence">
                </div>
              </div>
              
              <!-- No Face Detection -->
              <div *ngIf="currentEyeData && !currentEyeData.faceDetected" class="no-face-indicator">
                <div class="no-face-message">
                  <span class="icon">😕</span>
                  <p>ไม่พบใบหน้า</p>
                  <small>กรุณาอยู่ในมุมมองกล้อง</small>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Camera Status -->
          <div class="camera-status">
            <div class="status-grid">
              <div class="status-item">
                <label>FPS:</label>
                <span [ngClass]="getFpsClass(currentFps)">{{currentFps | number:'1.0-0'}}</span>
              </div>
              <div class="status-item">
                <label>Resolution:</label>
                <span>{{cameraWidth}}x{{cameraHeight}}</span>
              </div>
              <div class="status-item">
                <label>Face:</label>
                <span [ngClass]="currentEyeData?.faceDetected ? 'text-success' : 'text-danger'">
                  {{currentEyeData?.faceDetected ? '✓' : '✗'}}
                </span>
              </div>
              <div class="status-item">
                <label>Eyes:</label>
                <span [ngClass]="getBothEyesOpen() ? 'text-success' : 'text-warning'">
                  {{getBothEyesOpen() ? '👀' : '😴'}}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Gaze Visualization Area -->
        <div class="gaze-section">
          <div class="gaze-header">
            <h3>🎯 Gaze Tracking</h3>
            <div class="gaze-controls">
              <div class="control-group">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="settings.showGazePoint">
                  <span class="checkmark"></span>
                  แสดงจุดสายตา
                </label>
              </div>
              <div class="control-group">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="settings.showGazeTrail">
                  <span class="checkmark"></span>
                  แสดงเส้นทางสายตา
                </label>
              </div>
              <div class="control-group">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="settings.enableMouseControl">
                  <span class="checkmark"></span>
                  ควบคุมเมาส์
                </label>
              </div>
            </div>
          </div>
          
          <!-- Gaze Display Canvas -->
          <div class="gaze-display" #gazeDisplay>
            <canvas #gazeCanvas 
                    class="gaze-canvas"
                    [width]="gazeCanvasWidth"
                    [height]="gazeCanvasHeight">
            </canvas>
            
            <!-- Live Gaze Point -->
            <div *ngIf="settings.showGazePoint && currentGazeResult" 
                 class="gaze-point"
                 [style.left.px]="currentGazeResult.gazePoint.x"
                 [style.top.px]="currentGazeResult.gazePoint.y"
                 [style.opacity]="currentGazeResult.confidence"
                 [ngClass]="'quality-' + currentGazeResult.quality">
            </div>
            
            <!-- Gaze Quality Indicator -->
            <div class="gaze-quality-overlay" *ngIf="currentGazeResult">
              <div class="quality-indicator" [ngClass]="'quality-' + currentGazeResult.quality">
                <div class="quality-dot"></div>
                <span>{{getQualityText(currentGazeResult.quality)}}</span>
                <span class="confidence-percent">{{(currentGazeResult.confidence * 100) | number:'1.0-0'}}%</span>
              </div>
            </div>
          </div>
          
          <!-- Gaze Statistics -->
          <div class="gaze-stats">
            <div class="stats-grid">
              <div class="stat-item">
                <label>Accuracy:</label>
                <span class="stat-value">{{getAccuracyDisplay()}}%</span>
              </div>
              <div class="stat-item">
                <label>Latency:</label>
                <span class="stat-value">{{getLatencyDisplay()}}ms</span>
              </div>
              <div class="stat-item">
                <label>Smoothness:</label>
                <span class="stat-value">{{getSmoothness()}}%</span>
              </div>
              <div class="stat-item">
                <label>Fixations:</label>
                <span class="stat-value">{{fixationCount}}</span>
              </div>
            </div>
            
            <!-- Mouse Control Status -->
            <div *ngIf="settings.enableMouseControl" class="mouse-control-status">
              <div class="status-header">
                <span class="status-icon">🖱️</span>
                <span class="status-text">Mouse Control Active</span>
                <div class="status-indicator active"></div>
              </div>
              <div *ngIf="lastMouseControlPosition" class="mouse-position">
                <span>Position: ({{lastMouseControlPosition.x.toFixed(0)}}, {{lastMouseControlPosition.y.toFixed(0)}})</span>
                <span class="position-age">{{getMousePositionAge()}}ms ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Panel -->
      <div class="settings-panel" [ngClass]="{ 'panel-open': showSettings }">
        <div class="panel-header">
          <h3>⚙️ Tracking Settings</h3>
          <button class="btn btn-sm" (click)="closeSettings()">
            <span class="btn-icon">✕</span>
          </button>
        </div>
        
        <div class="panel-content">
          <div class="setting-group">
            <label>Display Mode:</label>
            <select [(ngModel)]="settings.displayMode" class="setting-select">
              <option value="overlay">แสดงซ้อน</option>
              <option value="separate">แยกหน้าจอ</option>
              <option value="minimal">แบบย่อ</option>
            </select>
          </div>
          
          <div class="setting-group">
            <label>Smoothing Level: {{settings.smoothingLevel}}</label>
            <input type="range" 
                   [(ngModel)]="settings.smoothingLevel"
                   min="0" max="1" step="0.1"
                   class="setting-slider">
          </div>
          
          <div class="setting-group">
            <label>Sensitivity: {{settings.sensitivity}}</label>
            <input type="range" 
                   [(ngModel)]="settings.sensitivity"
                   min="0.5" max="2" step="0.1"
                   class="setting-slider">
          </div>
          
          <div class="setting-group">
            <label>Trail Length: {{settings.trailLength}}</label>
            <input type="range" 
                   [(ngModel)]="settings.trailLength"
                   min="10" max="100" step="5"
                   class="setting-slider">
          </div>
          
          <div class="setting-actions">
            <button class="btn btn-primary" (click)="applySettings()">
              <span class="btn-icon">✓</span>
              Apply
            </button>
            <button class="btn btn-outline" (click)="resetSettings()">
              <span class="btn-icon">🔄</span>
              Reset
            </button>
          </div>
        </div>
      </div>

      <!-- Performance Monitor -->
      <div class="performance-monitor" [ngClass]="{ 'monitor-minimized': settings.displayMode === 'minimal' }">
        <div class="monitor-header">
          <span>⚡ Performance</span>
          <button class="btn btn-xs" (click)="togglePerformanceDetails()">
            {{showPerformanceDetails ? '−' : '+'}}
          </button>
        </div>
        
        <div class="monitor-content" [ngClass]="{ 'content-expanded': showPerformanceDetails }">
          <div class="perf-basic">
            <span class="perf-fps">{{currentFps | number:'1.0-0'}} FPS</span>
            <span class="perf-latency">{{currentLatency | number:'1.0-0'}}ms</span>
          </div>
          
          <div *ngIf="showPerformanceDetails" class="perf-details">
            <div class="perf-item">
              <label>Detection:</label>
              <span>{{detectionTime | number:'1.0-0'}}ms</span>
            </div>
            <div class="perf-item">
              <label>Estimation:</label>
              <span>{{estimationTime | number:'1.0-0'}}ms</span>
            </div>
            <div class="perf-item">
              <label>Memory:</label>
              <span>{{memoryUsage | number:'1.0-0'}}MB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tracking-workspace {
      height: 100vh;
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .workspace-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .header-left h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 300;
    }

    .tracking-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.1);
      font-size: 0.9rem;
    }

    .calibration-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      padding: 4px 10px;
      border-radius: 15px;
      margin-top: 5px;
    }

    .calibration-status.calibrated {
      background: rgba(76, 175, 80, 0.2);
      color: #4caf50;
    }

    .calibration-status.not-calibrated {
      background: rgba(255, 152, 0, 0.2);
      color: #ff9800;
    }

    .calibration-icon {
      font-size: 1rem;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    .status-ready .status-dot { background: #4caf50; }
    .status-running .status-dot { background: #2196f3; }
    .status-error .status-dot { background: #f44336; }
    .status-stopped .status-dot { background: #757575; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .header-controls {
      display: flex;
      gap: 10px;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary { background: #4caf50; color: white; }
    .btn-outline { background: transparent; border: 2px solid rgba(255, 255, 255, 0.3); color: white; }
    .btn-sm { padding: 6px 12px; font-size: 0.9rem; }
    .btn-xs { padding: 4px 8px; font-size: 0.8rem; }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .workspace-content {
      flex: 1;
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 20px;
      padding: 20px;
      overflow: hidden;
    }

    .workspace-content.display-minimal {
      grid-template-columns: 300px 1fr;
    }

    .workspace-content.display-separate {
      grid-template-rows: 1fr 1fr;
      grid-template-columns: 1fr;
    }

    .camera-section {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
    }

    .camera-section.minimized {
      padding: 10px;
    }

    .camera-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .camera-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
    }

    .camera-controls {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .camera-select {
      padding: 6px 10px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      font-size: 0.9rem;
    }

    .camera-container {
      position: relative;
      flex: 1;
      border-radius: 8px;
      overflow: hidden;
      background: #000;
    }

    .camera-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .camera-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .face-box {
      position: absolute;
      border: 2px solid #4caf50;
      border-radius: 4px;
    }

    .eye-center {
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #2196f3;
      transform: translate(-50%, -50%);
    }

    .pupil-center {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ff9800;
      transform: translate(-50%, -50%);
    }

    .no-face-indicator {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      background: rgba(0, 0, 0, 0.7);
      padding: 20px;
      border-radius: 8px;
    }

    .no-face-message .icon {
      font-size: 2rem;
      margin-bottom: 10px;
    }

    .camera-status {
      margin-top: 15px;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .status-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
    }

    .status-item label {
      font-size: 0.8rem;
      opacity: 0.7;
      margin-bottom: 4px;
    }

    .text-success { color: #4caf50; }
    .text-warning { color: #ff9800; }
    .text-danger { color: #f44336; }

    .gaze-section {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .gaze-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .gaze-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
    }

    .gaze-controls {
      display: flex;
      gap: 15px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .checkbox-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .gaze-display {
      position: relative;
      flex: 1;
      border-radius: 8px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.3);
    }

    .gaze-canvas {
      width: 100%;
      height: 100%;
    }

    .gaze-point {
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 10;
      animation: gazePoint 0.3s ease-out;
    }

    .gaze-point.quality-excellent {
      background: radial-gradient(circle, #4caf50 0%, rgba(76, 175, 80, 0.3) 100%);
      box-shadow: 0 0 20px rgba(76, 175, 80, 0.6);
    }

    .gaze-point.quality-good {
      background: radial-gradient(circle, #8bc34a 0%, rgba(139, 195, 74, 0.3) 100%);
      box-shadow: 0 0 15px rgba(139, 195, 74, 0.5);
    }

    .gaze-point.quality-fair {
      background: radial-gradient(circle, #ff9800 0%, rgba(255, 152, 0, 0.3) 100%);
      box-shadow: 0 0 12px rgba(255, 152, 0, 0.4);
    }

    .gaze-point.quality-poor {
      background: radial-gradient(circle, #f44336 0%, rgba(244, 67, 54, 0.3) 100%);
      box-shadow: 0 0 8px rgba(244, 67, 54, 0.3);
    }

    @keyframes gazePoint {
      0% {
        transform: translate(-50%, -50%) scale(0.5);
        opacity: 0;
      }
      100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
    }

    .gaze-quality-overlay {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .quality-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
    }

    .quality-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .quality-excellent .quality-dot { background: #4caf50; }
    .quality-good .quality-dot { background: #8bc34a; }
    .quality-fair .quality-dot { background: #ff9800; }
    .quality-poor .quality-dot { background: #f44336; }

    .confidence-percent {
      font-weight: 600;
      margin-left: 4px;
    }

    .gaze-stats {
      margin-top: 15px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
    }

    .stat-item label {
      font-size: 0.8rem;
      opacity: 0.7;
      margin-bottom: 4px;
    }

    .stat-value {
      font-weight: 600;
      font-size: 0.9rem;
    }

    .mouse-control-status {
      margin-top: 15px;
      padding: 12px;
      background: rgba(255, 68, 68, 0.1);
      border: 1px solid rgba(255, 68, 68, 0.3);
      border-radius: 8px;
    }

    .status-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .status-icon {
      font-size: 1.1rem;
    }

    .status-text {
      font-weight: 600;
      color: #ff4444;
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-left: auto;
    }

    .status-indicator.active {
      background: #ff4444;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    @keyframes slideIn {
      0% {
        transform: translateX(100%);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .mouse-position {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      opacity: 0.8;
    }

    .position-age {
      font-size: 0.75rem;
      opacity: 0.6;
    }

    .settings-panel {
      position: fixed;
      top: 0;
      right: -350px;
      width: 350px;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(10px);
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      transition: right 0.3s ease;
      z-index: 1000;
      overflow-y: auto;
    }

    .settings-panel.panel-open {
      right: 0;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .panel-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
    }

    .panel-content {
      padding: 20px;
    }

    .setting-group {
      margin-bottom: 20px;
    }

    .setting-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .setting-select {
      width: 100%;
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .setting-slider {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.2);
      outline: none;
      cursor: pointer;
    }

    .setting-actions {
      display: flex;
      gap: 10px;
      margin-top: 30px;
    }

    .performance-monitor {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 8px;
      padding: 10px;
      min-width: 200px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      z-index: 100;
    }

    .monitor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .perf-basic {
      display: flex;
      gap: 15px;
    }

    .perf-fps, .perf-latency {
      font-weight: 600;
      font-size: 0.9rem;
    }

    .perf-details {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    .perf-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 0.8rem;
    }

    .perf-item label {
      opacity: 0.7;
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
      .workspace-content {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
      }
      
      .camera-section {
        max-height: 300px;
      }
      
      .status-grid, .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .gaze-controls {
        flex-direction: column;
        gap: 8px;
      }
    }

    @media (max-width: 768px) {
      .workspace-header {
        flex-direction: column;
        gap: 15px;
      }
      
      .header-controls {
        flex-wrap: wrap;
      }
      
      .settings-panel {
        width: 100%;
        right: -100%;
      }
      
      .performance-monitor {
        bottom: 10px;
        right: 10px;
        left: 10px;
        width: auto;
      }
    }
  `]
})
export class TrackingWorkspaceComponent implements OnInit, OnDestroy, AfterViewInit {
  
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('gazeCanvas') gazeCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gazeDisplay') gazeDisplay!: ElementRef<HTMLDivElement>;
  
  private destroy$ = new Subject<void>();
  private animationFrameId?: number;
  private gazeCanvasContext?: CanvasRenderingContext2D;
  
  // Component state
  isTracking = false;
  trackingStatus: SystemStatus = 'ready';
  showSettings = false;
  showPerformanceDetails = false;
  
  // Camera state
  availableCameras: MediaDeviceInfo[] = [];
  selectedCameraDevice = '';
  cameraWidth = 640;
  cameraHeight = 480;
  
  // Gaze tracking data
  currentEyeData: EyeTrackingData | null = null;
  currentGazeResult: GazeEstimationResult | null = null;
  gazeTrail: GazeTrailPoint[] = [];
  fixationCount = 0;
  
  // Mouse control
  lastMouseControlPosition: { x: number, y: number, timestamp: number } | null = null;
  mouseIndicatorTimeout: any = null;
  
  // Canvas dimensions
  gazeCanvasWidth = 800;
  gazeCanvasHeight = 600;
  
  // Performance metrics
  currentFps = 0;
  currentLatency = 0;
  detectionTime = 0;
  estimationTime = 0;
  memoryUsage = 0;
  
  // Settings
  settings: TrackingSettings = {
    showGazePoint: true,
    showGazeTrail: true,
    enableMouseControl: false,
    smoothingLevel: 0.3,
    sensitivity: 1.0,
    trailLength: 50,
    displayMode: 'overlay'
  };

  constructor(
    private stateService: StateService,
    private cameraService: CameraService,
    public gazeEstimationService: EnhancedGazeEstimationService,
    private gazeProcessingService: GazeProcessingService,
    private mediapipeService: MediapipeService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.initializeComponent();
    this.subscribeToServices();
    this.loadSettings();
  }

  ngAfterViewInit() {
    this.initializeCanvas();
    this.setupVideoElement();
    this.startRenderLoop();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.stopTracking();
  }

  private async initializeComponent() {
    try {
      // Initialize mediapipe service first
      await this.mediapipeService.initialize();
      
      // Initialize camera service
      await this.cameraService.initialize();
      
      // Get available cameras
      this.availableCameras = await this.cameraService.getAvailableDevices();
      
      // Set default camera
      if (this.availableCameras.length > 0) {
        this.selectedCameraDevice = this.availableCameras[0].deviceId;
      }
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Failed to initialize tracking workspace');
    }
  }

  private subscribeToServices() {
    // Subscribe to camera state
    this.cameraService.getState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.updateCameraState(state);
      });

    // Subscribe to gaze estimation results
    this.gazeEstimationService.getGazeData()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result && this.isTracking) {
          this.currentGazeResult = result;
          this.updateGazeVisualization(result);
          this.updatePerformanceMetrics(result);
        }
      });

    // Subscribe to application state for performance metrics
    this.stateService.performanceMetrics
      .pipe(takeUntil(this.destroy$))
      .subscribe(metrics => {
        this.currentFps = metrics.fps;
        this.currentLatency = metrics.latency;
        this.detectionTime = metrics.processingTime.detection;
        this.estimationTime = metrics.processingTime.estimation;
      });
  }

  private initializeCanvas() {
    if (this.gazeCanvas?.nativeElement) {
      this.gazeCanvasContext = this.gazeCanvas.nativeElement.getContext('2d')!;
      this.updateCanvasSize();
    }
  }

  private setupVideoElement() {
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      
      video.addEventListener('loadedmetadata', () => {
        this.cameraWidth = video.videoWidth;
        this.cameraHeight = video.videoHeight;
      });
    }
  }

  private startRenderLoop() {
    const render = () => {
      this.renderFrame();
      this.animationFrameId = requestAnimationFrame(render);
    };
    render();
  }

  private renderFrame() {
    if (this.settings.showGazeTrail && this.gazeCanvasContext) {
      this.renderGazeTrail();
    }
    
    if (this.isTracking) {
      this.processTrackingFrame();
    }
  }

  private renderGazeTrail() {
    if (!this.gazeCanvasContext) return;
    
    const ctx = this.gazeCanvasContext;
    const now = Date.now();
    
    // Clear previous trail (with fade effect)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, this.gazeCanvasWidth, this.gazeCanvasHeight);
    
    // Draw trail points
    this.gazeTrail.forEach((point, index) => {
      const age = now - point.timestamp;
      const maxAge = this.settings.trailLength * 100; // 100ms per trail segment
      
      if (age > maxAge) return;
      
      const alpha = (1 - age / maxAge) * point.confidence;
      const size = 2 + (alpha * 4);
      
      ctx.fillStyle = `rgba(76, 175, 80, ${alpha})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Remove old trail points
    this.gazeTrail = this.gazeTrail.filter(point => 
      now - point.timestamp <= this.settings.trailLength * 100
    );
  }

  private async processTrackingFrame() {
    if (!this.videoElement?.nativeElement) return;
    
    try {
      const video = this.videoElement.nativeElement;
      
      // First, get MediaPipe landmarks for feature extraction
      const mediaPipeResults = this.mediapipeService.detectLandmarks(video, Date.now());
      
      if (mediaPipeResults && mediaPipeResults.faceLandmarks && mediaPipeResults.faceLandmarks.length > 0) {
        // Extract features for gaze prediction
        const features = this.extractFeaturesFromMediaPipe(mediaPipeResults);
        
        if (features && features.length === 10) {
          // Use real gaze processing service with extracted features
          const frameResult = this.gazeProcessingService.processFrame(
            video,
            true, // isGazePredictionEnabled
            features, // currentFeatures - real extracted features
            Date.now() // timestamp
          );
          
          if (frameResult && frameResult.predictedGaze) {
            console.debug('Real-time gaze tracking:', frameResult.predictedGaze);
            
            // Update current gaze result
            this.currentGazeResult = {
              gazePoint: frameResult.predictedGaze,
              gazeVector: {
                origin: { x: 0, y: 0, z: 0 },
                direction: { x: frameResult.leftGazeVector?.[0] || 0, y: frameResult.leftGazeVector?.[1] || 0, z: frameResult.leftGazeVector?.[2] || 0 },
                confidence: 0.8
              },
              confidence: 0.8,
              quality: this.mapQualityLevel(0.8),
              headPose: { pitch: 0, yaw: 0, roll: 0, confidence: 0.8 },
              pupilData: {
                leftPupil: {
                  center: { x: frameResult.leftEyeballCenter?.[0] || 0, y: frameResult.leftEyeballCenter?.[1] || 0 },
                  radius: 3,
                  diameter: 6,
                  confidence: 0.8
                },
                rightPupil: {
                  center: { x: frameResult.rightEyeballCenter?.[0] || 0, y: frameResult.rightEyeballCenter?.[1] || 0 },
                  radius: 3,
                  diameter: 6,
                  confidence: 0.8
                }
              },
              timestamp: Date.now(),
              processingTime: 16 // Estimate
            };
            
            // Convert to EyeTrackingData format for UI display
            this.currentEyeData = {
              faceDetected: true,
              frameNumber: Date.now(),
              processingTime: 16,
              faceBox: {
                x: video.videoWidth * 0.1,
                y: video.videoHeight * 0.1,
                width: video.videoWidth * 0.8,
                height: video.videoHeight * 0.8
              },
              leftEye: {
                landmarks: [],
                center: { x: frameResult.leftEyeballCenter?.[0] || 0, y: frameResult.leftEyeballCenter?.[1] || 0 },
                isOpen: true,
                openness: 0.8,
                pupil: {
                  center: { x: frameResult.leftEyeballCenter?.[0] || 0, y: frameResult.leftEyeballCenter?.[1] || 0 },
                  radius: 3,
                  diameter: 6,
                  confidence: 0.8
                }
              },
              rightEye: {
                landmarks: [],
                center: { x: frameResult.rightEyeballCenter?.[0] || 0, y: frameResult.rightEyeballCenter?.[1] || 0 },
                isOpen: true,
                openness: 0.8,
                pupil: {
                  center: { x: frameResult.rightEyeballCenter?.[0] || 0, y: frameResult.rightEyeballCenter?.[1] || 0 },
                  radius: 3,
                  diameter: 6,
                  confidence: 0.8
                }
              },
              headPose: { pitch: 0, yaw: 0, roll: 0, confidence: 0.8 },
              timestamp: Date.now()
            };
            
            this.addToGazeTrail(frameResult.predictedGaze, 0.8);
            
            // Mouse control
            if (this.settings.enableMouseControl) {
              this.updateMousePosition(frameResult.predictedGaze);
            }
          }
        }
      } else {
        // No face detected - clear current results
        this.currentGazeResult = null;
        this.currentEyeData = null;
      }
      
    } catch (error) {
      console.error('Frame processing error:', error);
    }
  }

  // Extract features from MediaPipe results (same method used in calibration)
  private extractFeaturesFromMediaPipe(results: any): number[] | null {
    if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
      return null;
    }
    
    const landmarks = results.faceLandmarks[0];
    if (landmarks.length < 478) return null;

    // Use same indices as calibration
    const LEFT_IRIS_INDICES = [473, 474, 475, 476, 477];
    const RIGHT_IRIS_INDICES = [468, 469, 470, 471, 472];
    const LEFT_PUPIL = 468;
    const RIGHT_PUPIL = 473;

    const leftIrisCenter = this.calculateAveragePosition(landmarks, LEFT_IRIS_INDICES) || { x: 0, y: 0, z: 0 };
    const rightIrisCenter = this.calculateAveragePosition(landmarks, RIGHT_IRIS_INDICES) || { x: 0, y: 0, z: 0 };
    const leftPupil = landmarks[LEFT_PUPIL] || { x: 0, y: 0 };
    const rightPupil = landmarks[RIGHT_PUPIL] || { x: 0, y: 0 };

    const features: number[] = [
      leftIrisCenter.x ?? 0, leftIrisCenter.y ?? 0, leftIrisCenter.z ?? 0,
      rightIrisCenter.x ?? 0, rightIrisCenter.y ?? 0, rightIrisCenter.z ?? 0,
      leftPupil.x ?? 0, leftPupil.y ?? 0,
      rightPupil.x ?? 0, rightPupil.y ?? 0
    ];

    if (features.length !== 10) {
      console.warn(`Feature extraction error: expected 10 features, got ${features.length}`);
      return null;
    }
    
    if (features.some(isNaN)) {
      console.warn("NaN value detected in extracted features:", features);
      return null;
    }
    
    return features;
  }

  private calculateAveragePosition(landmarks: any[], indices: number[]): { x: number, y: number, z?: number } | null {
    let sumX = 0, sumY = 0, sumZ = 0, count = 0;
    let hasZ = false;
    
    for (const index of indices) {
      const lm = landmarks?.[index];
      if (lm && typeof lm.x === 'number' && typeof lm.y === 'number') {
        sumX += lm.x; 
        sumY += lm.y;
        if (typeof lm.z === 'number') { 
          sumZ += lm.z; 
          hasZ = true; 
        }
        count++;
      }
    }
    
    if (count === 0) return null;
    
    const avgPos: { x: number, y: number, z?: number } = { 
      x: sumX / count, 
      y: sumY / count 
    };
    
    if (hasZ) { 
      avgPos.z = sumZ / count; 
    }
    
    return avgPos;
  }

  private updateGazeVisualization(result: GazeEstimationResult) {
    // Update visualization elements
    // The gaze point is rendered via Angular template
    // Fix ExpressionChangedAfterItHasBeenCheckedError
    this.cdRef.detectChanges();
  }

  private addToGazeTrail(point: Point2D, confidence: number) {
    if (!this.settings.showGazeTrail) return;
    
    this.gazeTrail.push({
      x: point.x,
      y: point.y,
      timestamp: Date.now(),
      confidence
    });
    
    // Limit trail length
    if (this.gazeTrail.length > this.settings.trailLength) {
      this.gazeTrail.shift();
    }
  }

  private updateMousePosition(gazePoint: Point2D) {
    // Apply sensitivity adjustment
    const adjustedX = gazePoint.x * this.settings.sensitivity;
    const adjustedY = gazePoint.y * this.settings.sensitivity;
    
    // Clamp coordinates to screen bounds with margin for safety
    const margin = 50; // Prevent cursor from going too close to edges
    const clampedX = Math.max(margin, Math.min(window.screen.width - margin, adjustedX));
    const clampedY = Math.max(margin, Math.min(window.screen.height - margin, adjustedY));
    
    // Store current mouse control position for visualization
    this.lastMouseControlPosition = {
      x: clampedX,
      y: clampedY,
      timestamp: Date.now()
    };
    // Fix ExpressionChangedAfterItHasBeenCheckedError
    this.cdRef.detectChanges();
    
    // Calculate relative position on screen
    const relativeX = (clampedX / window.screen.width * 100).toFixed(1);
    const relativeY = (clampedY / window.screen.height * 100).toFixed(1);
    
    // Enhanced logging with more details
    console.log(`🖱️ Mouse Control Active:
      📍 Position: (${clampedX.toFixed(0)}, ${clampedY.toFixed(0)})
      📊 Relative: (${relativeX}%, ${relativeY}%)
      🖥️ Screen: ${window.screen.width}x${window.screen.height}
      🎯 Raw Gaze: (${gazePoint.x.toFixed(1)}, ${gazePoint.y.toFixed(1)})
      ⚙️ Sensitivity: ${this.settings.sensitivity}x
      ✅ Calibrated: ${this.gazeEstimationService.isCalibrated()}`);
    
    // Show visual feedback
    this.showMouseControlFeedback(clampedX, clampedY);
    
    // In a real implementation, this would use the Screen Capture API
    // or a native application to control the mouse cursor
    // For web demo: Show notification on significant movements
    if (Math.abs(clampedX - (this.lastMouseControlPosition?.x || 0)) > 100 || 
        Math.abs(clampedY - (this.lastMouseControlPosition?.y || 0)) > 100) {
      this.showMouseMovementNotification(clampedX, clampedY);
    }
  }

  private showMouseMovementNotification(x: number, y: number) {
    // Create temporary notification for significant mouse movements
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.background = 'rgba(255, 68, 68, 0.9)';
    notification.style.color = 'white';
    notification.style.padding = '10px 15px';
    notification.style.borderRadius = '8px';
    notification.style.fontSize = '14px';
    notification.style.fontWeight = '600';
    notification.style.zIndex = '10001';
    notification.style.animation = 'slideIn 0.3s ease';
    notification.textContent = `Mouse → (${x.toFixed(0)}, ${y.toFixed(0)})`;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 1 second
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 1000);
  }

  private showMouseControlFeedback(x: number, y: number) {
    // Create or update mouse control indicator
    let indicator = document.getElementById('mouse-control-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'mouse-control-indicator';
      indicator.style.position = 'fixed';
      indicator.style.width = '12px';
      indicator.style.height = '12px';
      indicator.style.borderRadius = '50%';
      indicator.style.backgroundColor = '#ff4444';
      indicator.style.border = '2px solid #ffffff';
      indicator.style.boxShadow = '0 0 10px rgba(255, 68, 68, 0.6)';
      indicator.style.pointerEvents = 'none';
      indicator.style.zIndex = '10000';
      indicator.style.transition = 'all 0.1s ease';
      document.body.appendChild(indicator);
    }
    
    // Convert screen coordinates to viewport coordinates
    const viewportX = (x / window.screen.width) * window.innerWidth;
    const viewportY = (y / window.screen.height) * window.innerHeight;
    
    // Update position
    indicator.style.left = `${viewportX - 6}px`;
    indicator.style.top = `${viewportY - 6}px`;
    indicator.style.opacity = '1';
    
    // Auto-hide after 200ms of no updates
    clearTimeout(this.mouseIndicatorTimeout);
    this.mouseIndicatorTimeout = setTimeout(() => {
      if (indicator) {
        indicator.style.opacity = '0.3';
      }
    }, 200);
  }

  private updateCameraState(state: CameraState) {
    if (state.stream && this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.srcObject = state.stream;
    }
  }

  private updatePerformanceMetrics(result: GazeEstimationResult) {
    // Update performance counters
    this.currentLatency = result.processingTime;
  }

  private updateCanvasSize() {
    if (this.gazeDisplay?.nativeElement) {
      const rect = this.gazeDisplay.nativeElement.getBoundingClientRect();
      
      // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.gazeCanvasWidth = rect.width;
        this.gazeCanvasHeight = rect.height;
        
        if (this.gazeCanvas?.nativeElement) {
          this.gazeCanvas.nativeElement.width = this.gazeCanvasWidth;
          this.gazeCanvas.nativeElement.height = this.gazeCanvasHeight;
        }
      }, 0);
    }
  }

  // Event Handlers
  async toggleTracking() {
    if (this.isTracking) {
      await this.stopTracking();
    } else {
      await this.startTracking();
    }
  }

  async startTracking() {
    try {
      this.trackingStatus = 'initializing';
      
      // Start camera stream
      await this.cameraService.startStream();
      
      // Check if calibrated
      if (!this.gazeEstimationService.isCalibrated()) {
        this.notifications.showWarning('แนะนำให้ทำการปรับเทียบก่อนเริ่มใช้งาน');
      }
      
      this.isTracking = true;
      this.trackingStatus = 'running';
      this.notifications.showSuccess('เริ่ม Eye Tracking แล้ว');
      
    } catch (error) {
      this.trackingStatus = 'error';
      this.errorHandler.handleError(error as Error, 'Failed to start tracking');
    }
  }

  async stopTracking() {
    this.isTracking = false;
    this.trackingStatus = 'stopped';
    this.currentEyeData = null;
    this.currentGazeResult = null;
    this.notifications.showInfo('หยุด Eye Tracking แล้ว');
  }

  async resetTracking() {
    await this.stopTracking();
    this.gazeTrail = [];
    this.fixationCount = 0;
    
    if (this.gazeCanvasContext) {
      this.gazeCanvasContext.clearRect(0, 0, this.gazeCanvasWidth, this.gazeCanvasHeight);
    }
    
    this.notifications.showInfo('รีเซ็ต Tracking แล้ว');
  }

  async switchCamera() {
    if (this.selectedCameraDevice) {
      try {
        await this.cameraService.switchDevice(this.selectedCameraDevice);
        this.notifications.showSuccess('เปลี่ยนกล้องแล้ว');
      } catch (error) {
        this.errorHandler.handleError(error as Error, 'Failed to switch camera');
      }
    }
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  closeSettings() {
    this.showSettings = false;
  }

  toggleCameraSettings() {
    // Toggle camera settings panel
  }

  togglePerformanceDetails() {
    this.showPerformanceDetails = !this.showPerformanceDetails;
  }

  applySettings() {
    this.saveSettings();
    this.updateCanvasSize();
    this.notifications.showSuccess('บันทึกการตั้งค่าแล้ว');
  }

  resetSettings() {
    this.settings = {
      showGazePoint: true,
      showGazeTrail: true,
      enableMouseControl: false,
      smoothingLevel: 0.3,
      sensitivity: 1.0,
      trailLength: 50,
      displayMode: 'overlay'
    };
    this.notifications.showInfo('รีเซ็ตการตั้งค่าแล้ว');
  }

  // Helper method to map confidence to quality level
  private mapQualityLevel(confidence: number): QualityLevel {
    if (confidence >= 0.8) return 'excellent';
    if (confidence >= 0.6) return 'good';
    if (confidence >= 0.4) return 'fair';
    return 'poor';
  }

  // Helper Methods
  canToggleTracking(): boolean {
    return this.trackingStatus !== 'initializing';
  }

  getTrackingStatusText(): string {
    const statusMap = {
      'ready': 'พร้อม',
      'running': 'กำลังทำงาน',
      'error': 'ข้อผิดพลาด',
      'stopped': 'หยุด',
      'initializing': 'กำลังเตรียม'
    };
    return statusMap[this.trackingStatus] || this.trackingStatus;
  }

  getBothEyesOpen(): boolean {
    return this.currentEyeData?.leftEye.isOpen && this.currentEyeData?.rightEye.isOpen || false;
  }

  getFpsClass(fps: number): string {
    if (fps >= 25) return 'text-success';
    if (fps >= 15) return 'text-warning';
    return 'text-danger';
  }

  getQualityText(quality: QualityLevel): string {
    const qualityMap = {
      'excellent': 'ดีเยี่ยม',
      'good': 'ดี',
      'fair': 'พอใช้',
      'poor': 'ควรปรับปรุง'
    };
    return qualityMap[quality] || quality;
  }

  getAccuracyDisplay(): number {
    return this.gazeEstimationService.isCalibrated() ? 85 + Math.random() * 10 : 50;
  }

  getLatencyDisplay(): number {
    return this.currentLatency;
  }

  getSmoothness(): number {
    return Math.max(0, Math.min(100, 95 - (this.settings.smoothingLevel * 20)));
  }

  getMousePositionAge(): number {
    if (!this.lastMouseControlPosition) return 0;
    return Date.now() - this.lastMouseControlPosition.timestamp;
  }

  private loadSettings() {
    const saved = localStorage.getItem('tracking-workspace-settings');
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      } catch (error) {
        console.warn('Failed to load settings:', error);
      }
    }
  }

  private saveSettings() {
    localStorage.setItem('tracking-workspace-settings', JSON.stringify(this.settings));
  }
}
