import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

// Import services
import { MediapipeService } from '../../services/mediapipe.service';
import { CalibrationService } from '../../services/calibration.service';
import { EnhancedCalibrationService, CalibrationStatus } from '../../services/enhanced-calibration.service';
import { GazeEstimationService } from '../../services/gaze-estimation.service';
import { RealTimeProcessingService, RealTimeMetrics } from '../../services/real-time-processing.service';
import { PerformanceService } from '../../services/performance.service';
import { ErrorHandlerService } from '../../services/error-handler.service';

// Import components
import { GazeTrackerComponent } from '../gaze-tracker/gaze-tracker.component';
import { EnhancedCalibrationComponent } from '../enhanced-calibration/enhanced-calibration.component';

export interface UserPreferences {
  theme: string;
  autoStart: boolean;
  showTutorial: boolean;
  defaultCalibrationPattern: '9-point' | '13-point' | '16-point';
  enableNotifications: boolean;
  autoSaveSettings: boolean;
  expertMode: boolean;
}

@Component({
  selector: 'app-main-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GazeTrackerComponent,
    EnhancedCalibrationComponent
  ],
  template: `
    <div class="main-dashboard">
      
      <!-- Top Navigation Bar -->
      <header class="top-navbar">
        <div class="navbar-brand">
          <h1>Vision Mouse</h1>
          <span class="version">v2.0</span>
        </div>
        
        <nav class="navbar-menu">
          <button 
            class="nav-item" 
            [class.active]="currentView === 'tracking'"
            (click)="setView('tracking')">
            Tracking
          </button>
          
          <button 
            class="nav-item" 
            [class.active]="currentView === 'calibration'"
            (click)="setView('calibration')">
            Calibration
          </button>
          
          <button 
            class="nav-item" 
            [class.active]="currentView === 'analytics'"
            (click)="setView('analytics')">
            Analytics
          </button>
          
          <button 
            class="nav-item" 
            [class.active]="currentView === 'settings'"
            (click)="setView('settings')">
            Settings
          </button>
        </nav>
        
        <div class="navbar-actions">
          <!-- System Status -->
          <div class="status-indicator" [class]="systemStatus">
            <div class="status-dot"></div>
            <span>{{ getStatusText() }}</span>
          </div>
          
          <!-- Quick Actions -->
          <button 
            class="quick-action" 
            [class.active]="isTracking"
            (click)="toggleTracking()"
            [disabled]="!systemReady">
            {{ isTracking ? 'Stop' : 'Start' }}
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <div class="main-content">
        
        <!-- Sidebar with Quick Stats -->
        <aside class="sidebar" *ngIf="showSidebar">
          <div class="sidebar-content">
            <h3>Quick Stats</h3>
            <div class="stat-grid">
              <div class="stat-item">
                <span class="stat-value">{{ realTimeMetrics.frameRate }}</span>
                <span class="stat-label">FPS</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ realTimeMetrics.averageLatency.toFixed(1) }}</span>
                <span class="stat-label">Latency (ms)</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ realTimeMetrics.processingLoad }}</span>
                <span class="stat-label">Load (%)</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ calibrationAccuracy.toFixed(1) }}</span>
                <span class="stat-label">Accuracy (%)</span>
              </div>
            </div>
            
            <!-- System Health -->
            <div class="system-health">
              <h3>System Health</h3>
              <div class="health-item">
                <span class="health-label">Camera</span>
                <div class="health-indicator" [class]="cameraStatus">
                  <div class="health-dot"></div>
                  <span>{{ cameraStatus }}</span>
                </div>
              </div>
              <div class="health-item">
                <span class="health-label">MediaPipe</span>
                <div class="health-indicator" [class]="mediapipeStatus">
                  <div class="health-dot"></div>
                  <span>{{ mediapipeStatus }}</span>
                </div>
              </div>
              <div class="health-item">
                <span class="health-label">Calibration</span>
                <div class="health-indicator" [class]="calibrationStatusText">
                  <div class="health-dot"></div>
                  <span>{{ calibrationStatusText }}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Content Views -->
        <main class="content-area">
          
          <!-- Tracking View -->
          <div *ngIf="currentView === 'tracking'" class="view-container tracking-view">
            <div class="view-header">
              <h2>Eye Gaze Tracking</h2>
              <div class="view-actions">
                <button 
                  class="action-btn secondary"
                  (click)="openCalibrationWizard()">
                  Quick Calibrate
                </button>
              </div>
            </div>
            
            <div class="tracking-content">
              <app-gaze-tracker></app-gaze-tracker>
            </div>
          </div>

          <!-- Calibration View -->
          <div *ngIf="currentView === 'calibration'" class="view-container calibration-view">
            <div class="view-header">
              <h2>Calibration Center</h2>
              <div class="view-actions">
                <select 
                  class="calibration-pattern-select"
                  [(ngModel)]="selectedCalibrationPattern">
                  <option value="9-point">9-Point Grid</option>
                  <option value="13-point">13-Point Grid</option>
                  <option value="16-point">16-Point Grid</option>
                </select>
                <button 
                  class="action-btn primary"
                  (click)="startEnhancedCalibration()"
                  [disabled]="!systemReady">
                  Start Calibration
                </button>
              </div>
            </div>
            
            <div class="calibration-content">
              <div class="calibration-info">
                <div class="info-card">
                  <h3>Calibration Status</h3>
                  <div class="status-info">
                    <div class="status-item">
                      <span class="label">Pattern:</span>
                      <span class="value">{{ selectedCalibrationPattern }}</span>
                    </div>
                    <div class="status-item">
                      <span class="label">Points Collected:</span>
                      <span class="value">{{ calibrationPointsCollected }}/{{ getTotalCalibrationPoints() }}</span>
                    </div>
                    <div class="status-item">
                      <span class="label">Accuracy:</span>
                      <span class="value">{{ calibrationAccuracy.toFixed(1) }}%</span>
                    </div>
                    <div class="status-item">
                      <span class="label">Quality:</span>
                      <span class="value" [class]="getQualityClass()">{{ getQualityText() }}</span>
                    </div>
                  </div>
                </div>
                
                <div class="info-card">
                  <h3>Tips for Better Calibration</h3>
                  <ul class="calibration-tips">
                    <li>Ensure good lighting on your face</li>
                    <li>Keep your head steady during calibration</li>
                    <li>Look directly at each calibration point</li>
                    <li>Maintain comfortable distance from screen</li>
                    <li>Minimize head movement between points</li>
                  </ul>
                </div>
              </div>
              
              <!-- Enhanced Calibration Component -->
              <div class="enhanced-calibration-container">
                <app-enhanced-calibration
                  *ngIf="showEnhancedCalibration"
                  (calibrationComplete)="onCalibrationComplete($event)"
                  (calibrationCancelled)="onCalibrationCancelled()">
                </app-enhanced-calibration>
              </div>
            </div>
          </div>

          <!-- Analytics View -->
          <div *ngIf="currentView === 'analytics'" class="view-container analytics-view">
            <div class="view-header">
              <h2>Analytics Dashboard</h2>
              <div class="view-actions">
                <select class="time-range-select" [(ngModel)]="selectedTimeRange">
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
                <button class="action-btn secondary" (click)="exportAnalytics()">
                  Export Data
                </button>
              </div>
            </div>
            
            <div class="analytics-content">
              <div class="analytics-placeholder">
                <h3>Performance Metrics</h3>
                <p>Real-time analytics and performance charts will be displayed here.</p>
                
                <div class="metrics-summary">
                  <div class="metric-card">
                    <h4>Session Duration</h4>
                    <span class="metric-value">{{ getSessionDuration() }}</span>
                  </div>
                  <div class="metric-card">
                    <h4>Average FPS</h4>
                    <span class="metric-value">{{ realTimeMetrics.frameRate }}</span>
                  </div>
                  <div class="metric-card">
                    <h4>Processing Load</h4>
                    <span class="metric-value">{{ realTimeMetrics.processingLoad }}%</span>
                  </div>
                  <div class="metric-card">
                    <h4>Quality Score</h4>
                    <span class="metric-value">{{ realTimeMetrics.adaptiveQuality }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Settings View -->
          <div *ngIf="currentView === 'settings'" class="view-container settings-view">
            <div class="view-header">
              <h2>Settings & Configuration</h2>
              <div class="view-actions">
                <button class="action-btn secondary" (click)="resetToDefaults()">
                  Reset to Defaults
                </button>
                <button class="action-btn primary" (click)="saveSettings()">
                  Save Settings
                </button>
              </div>
            </div>
            
            <div class="settings-content">
              <div class="setting-group">
                <h3>User Preferences</h3>
                
                <div class="setting-item checkbox">
                  <input 
                    type="checkbox" 
                    id="autoStart"
                    [(ngModel)]="userPreferences.autoStart"
                    (change)="updateUserPreferences()">
                  <label for="autoStart">Auto-start tracking on launch</label>
                </div>
                
                <div class="setting-item checkbox">
                  <input 
                    type="checkbox" 
                    id="enableNotifications"
                    [(ngModel)]="userPreferences.enableNotifications"
                    (change)="updateUserPreferences()">
                  <label for="enableNotifications">Enable system notifications</label>
                </div>
                
                <div class="setting-item checkbox">
                  <input 
                    type="checkbox" 
                    id="expertMode"
                    [(ngModel)]="userPreferences.expertMode"
                    (change)="updateUserPreferences()">
                  <label for="expertMode">Expert mode (show advanced options)</label>
                </div>
                
                <div class="setting-item">
                  <label>Default Calibration Pattern</label>
                  <select 
                    [(ngModel)]="userPreferences.defaultCalibrationPattern"
                    (change)="updateUserPreferences()">
                    <option value="9-point">9-Point Grid</option>
                    <option value="13-point">13-Point Grid</option>
                    <option value="16-point">16-Point Grid</option>
                  </select>
                </div>
              </div>
              
              <div class="setting-group">
                <h3>Performance Settings</h3>
                
                <div class="setting-item">
                  <label>Target Frame Rate</label>
                  <input 
                    type="range" 
                    min="15" 
                    max="60" 
                    [(ngModel)]="performanceSettings.targetFPS"
                    (input)="updatePerformanceSettings()">
                  <span>{{ performanceSettings.targetFPS }} FPS</span>
                </div>
                
                <div class="setting-item">
                  <label>Processing Quality</label>
                  <select [(ngModel)]="performanceSettings.quality" (change)="updatePerformanceSettings()">
                    <option value="low">Low (Fastest)</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="high">High (Best Quality)</option>
                    <option value="ultra">Ultra (Maximum Quality)</option>
                  </select>
                </div>
                
                <div class="setting-item checkbox">
                  <input 
                    type="checkbox" 
                    id="adaptiveQuality"
                    [(ngModel)]="performanceSettings.adaptiveQuality"
                    (change)="updatePerformanceSettings()">
                  <label for="adaptiveQuality">Enable adaptive quality control</label>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <!-- Status Bar -->
      <footer class="status-bar">
        <div class="status-left">
          <span class="status-item">
            Camera: {{ cameraStatus }}
          </span>
          <span class="status-item">
            FPS: {{ realTimeMetrics.frameRate }}
          </span>
          <span class="status-item">
            Latency: {{ realTimeMetrics.averageLatency.toFixed(1) }}ms
          </span>
        </div>
        
        <div class="status-center">
          <span class="session-info">
            Session: {{ getSessionDuration() }}
          </span>
        </div>
        
        <div class="status-right">
          <span class="status-item">
            {{ getCurrentTime() }}
          </span>
        </div>
      </footer>

      <!-- Notifications -->
      <div 
        *ngFor="let notification of notifications" 
        class="notification-toast"
        [class]="notification.type">
        <div class="notification-content">
          <span>{{ notification.message }}</span>
        </div>
        <button class="notification-close" (click)="dismissNotification(notification)">×</button>
      </div>
    </div>
  `,
  styles: [`
    .main-dashboard {
      display: flex;
      flex-direction: column;
      height: 100vh;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f8f9fa;
    }

    /* Top Navigation */
    .top-navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: white;
      border-bottom: 1px solid #dee2e6;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .navbar-brand {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .navbar-brand h1 {
      margin: 0;
      color: #007bff;
      font-size: 1.5rem;
    }

    .version {
      background: #007bff;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    .navbar-menu {
      display: flex;
      gap: 0.5rem;
    }

    .nav-item {
      padding: 0.75rem 1.5rem;
      background: transparent;
      border: 1px solid #007bff;
      color: #007bff;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 500;
    }

    .nav-item:hover,
    .nav-item.active {
      background: #007bff;
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,123,255,0.3);
    }

    .navbar-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #dee2e6;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #28a745;
    }

    .status-indicator.warning .status-dot {
      background: #ffc107;
    }

    .status-indicator.error .status-dot {
      background: #dc3545;
    }

    .quick-action {
      padding: 0.75rem 1.5rem;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .quick-action:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .quick-action:disabled {
      background: #6c757d;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .quick-action.active {
      background: #dc3545;
    }

    /* Main Content Layout */
    .main-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .sidebar {
      width: 300px;
      background: white;
      border-right: 1px solid #dee2e6;
      padding: 1.5rem;
      overflow-y: auto;
    }

    .sidebar-content h3 {
      margin: 0 0 1rem 0;
      color: #495057;
      font-size: 1.1rem;
    }

    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-item {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 6px;
      text-align: center;
      border: 1px solid #e9ecef;
    }

    .stat-value {
      display: block;
      font-size: 1.5rem;
      font-weight: bold;
      color: #007bff;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .system-health {
      margin-top: 2rem;
    }

    .health-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid #e9ecef;
    }

    .health-item:last-child {
      border-bottom: none;
    }

    .health-label {
      font-weight: 500;
      color: #495057;
    }

    .health-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .health-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #28a745;
    }

    .health-indicator.disconnected .health-dot,
    .health-indicator.error .health-dot,
    .health-indicator.uncalibrated .health-dot {
      background: #dc3545;
    }

    .health-indicator.loading .health-dot,
    .health-indicator.calibrating .health-dot {
      background: #ffc107;
    }

    /* Content Area */
    .content-area {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
      background: #f8f9fa;
    }

    .view-container {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      height: calc(100vh - 200px);
      overflow-y: auto;
    }

    .view-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e9ecef;
    }

    .view-header h2 {
      margin: 0;
      color: #495057;
    }

    .view-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .action-btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .action-btn.primary {
      background: #007bff;
      color: white;
    }

    .action-btn.secondary {
      background: #6c757d;
      color: white;
    }

    .action-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .action-btn:disabled {
      background: #e9ecef;
      color: #6c757d;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    /* Calibration Specific */
    .calibration-content {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 2rem;
      height: 100%;
    }

    .calibration-info {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .info-card {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 6px;
      border: 1px solid #e9ecef;
    }

    .info-card h3 {
      margin: 0 0 1rem 0;
      color: #495057;
    }

    .status-info {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-item .label {
      font-weight: 500;
      color: #6c757d;
    }

    .status-item .value {
      font-weight: bold;
      color: #495057;
    }

    .calibration-tips {
      margin: 0;
      padding-left: 1.5rem;
    }

    .calibration-tips li {
      margin-bottom: 0.5rem;
      color: #6c757d;
    }

    /* Analytics */
    .analytics-content {
      padding: 2rem 0;
    }

    .metrics-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }

    .metric-card {
      background: #f8f9fa;
      padding: 2rem;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #e9ecef;
    }

    .metric-card h4 {
      margin: 0 0 1rem 0;
      color: #6c757d;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-value {
      font-size: 2rem;
      font-weight: bold;
      color: #007bff;
    }

    /* Settings */
    .settings-content {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      max-width: 600px;
    }

    .setting-group {
      background: #f8f9fa;
      padding: 2rem;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    }

    .setting-group h3 {
      margin: 0 0 1.5rem 0;
      color: #495057;
    }

    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding: 0.75rem 0;
    }

    .setting-item:last-child {
      margin-bottom: 0;
    }

    .setting-item.checkbox {
      justify-content: flex-start;
      gap: 1rem;
    }

    .setting-item label {
      font-weight: 500;
      color: #495057;
      cursor: pointer;
    }

    .setting-item input[type="range"] {
      width: 150px;
    }

    .setting-item select {
      padding: 0.5rem;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: white;
    }

    /* Status Bar */
    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 2rem;
      background: #e9ecef;
      border-top: 1px solid #dee2e6;
      font-size: 0.875rem;
      color: #6c757d;
    }

    .status-left,
    .status-right {
      display: flex;
      gap: 2rem;
    }

    .status-item {
      font-weight: 500;
    }

    /* Notifications */
    .notification-toast {
      position: fixed;
      top: 100px;
      right: 20px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 1rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 300px;
      margin-bottom: 0.5rem;
    }

    .notification-toast.success {
      border-left: 4px solid #28a745;
    }

    .notification-toast.warning {
      border-left: 4px solid #ffc107;
    }

    .notification-toast.error {
      border-left: 4px solid #dc3545;
    }

    .notification-toast.info {
      border-left: 4px solid #007bff;
    }

    .notification-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #6c757d;
      padding: 0;
      margin-left: 1rem;
    }

    /* Quality indicators */
    .value.excellent { color: #28a745; }
    .value.good { color: #007bff; }
    .value.fair { color: #ffc107; }
    .value.poor { color: #dc3545; }

    /* Responsive Design */
    @media (max-width: 1200px) {
      .sidebar {
        width: 250px;
      }
      
      .calibration-content {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .navbar-menu {
        flex-direction: column;
        gap: 0.25rem;
      }
      
      .navbar-actions {
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .main-content {
        flex-direction: column;
      }
      
      .sidebar {
        width: 100%;
        max-height: 200px;
      }
      
      .metrics-summary {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class MainDashboardComponent implements OnInit, OnDestroy {
  // View State
  currentView: 'tracking' | 'calibration' | 'analytics' | 'settings' = 'tracking';
  
  // UI State
  showSidebar = true;
  showEnhancedCalibration = false;
  
  // System State
  systemReady = false;
  isTracking = false;
  systemStatus: 'healthy' | 'warning' | 'error' = 'healthy';
  cameraStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  mediapipeStatus: 'ready' | 'loading' | 'error' = 'loading';
  calibrationStatusText: 'uncalibrated' | 'calibrating' | 'calibrated' = 'uncalibrated';
  
  // Metrics and Data
  realTimeMetrics: RealTimeMetrics = {
    frameRate: 0,
    averageLatency: 0,
    droppedFrames: 0,
    processingLoad: 0,
    memoryUsage: 0,
    queueLength: 0,
    adaptiveQuality: 100
  };
  
  sessionStats = {
    startTime: Date.now(),
    gazePoints: 0,
    calibrationCount: 0
  };
  
  // Calibration Data
  calibrationPointsCollected = 0;
  calibrationAccuracy = 0;
  selectedCalibrationPattern: '9-point' | '13-point' | '16-point' = '9-point';
  
  // Settings
  userPreferences: UserPreferences = {
    theme: 'Default',
    autoStart: false,
    showTutorial: true,
    defaultCalibrationPattern: '9-point',
    enableNotifications: true,
    autoSaveSettings: true,
    expertMode: false
  };
  
  performanceSettings = {
    targetFPS: 30,
    quality: 'medium',
    adaptiveQuality: true
  };
  
  // Notifications
  notifications: Array<{
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
  }> = [];
  
  selectedTimeRange = '24h';
  
  private subscriptions: Subscription[] = [];

  constructor(
    private mediapipeService: MediapipeService,
    private calibrationService: CalibrationService,
    private enhancedCalibrationService: EnhancedCalibrationService,
    private gazeEstimationService: GazeEstimationService,
    private realTimeProcessingService: RealTimeProcessingService,
    private performanceService: PerformanceService,
    private errorHandlerService: ErrorHandlerService
  ) {
    this.loadUserPreferences();
  }

  ngOnInit(): void {
    this.initializeSystem();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.saveUserPreferences();
  }

  // System Initialization
  private async initializeSystem(): Promise<void> {
    try {
      // Initialize MediaPipe
      await this.mediapipeService.initialize();
      this.mediapipeStatus = this.mediapipeService.isInitialized ? 'ready' : 'error';
      
      // Initialize real-time processing
      this.realTimeProcessingService.start();
      
      this.systemReady = true;
      this.systemStatus = 'healthy';
      this.cameraStatus = 'connected';
      
      this.showNotification('System initialized successfully', 'success');
      
      if (this.userPreferences.autoStart) {
        this.startTracking();
      }
      
    } catch (error) {
      this.systemStatus = 'error';
      this.showNotification('System initialization failed', 'error');
    }
  }

  // Subscription Setup
  private setupSubscriptions(): void {
    // Real-time metrics
    const metricsSubscription = this.realTimeProcessingService.getMetrics().subscribe(metrics => {
      this.realTimeMetrics = metrics;
      this.updateSystemHealth();
    });
    this.subscriptions.push(metricsSubscription);
    
    // Calibration status
    const calibrationSubscription = this.enhancedCalibrationService.getCalibrationStatus().subscribe(status => {
      this.updateCalibrationStatus(status);
    });
    this.subscriptions.push(calibrationSubscription);
  }

  // View Management
  setView(view: 'tracking' | 'calibration' | 'analytics' | 'settings'): void {
    this.currentView = view;
  }

  // Tracking Control
  toggleTracking(): void {
    if (this.isTracking) {
      this.stopTracking();
    } else {
      this.startTracking();
    }
  }

  startTracking(): void {
    if (!this.systemReady) return;
    
    this.isTracking = true;
    this.sessionStats.startTime = Date.now();
    this.showNotification('Gaze tracking started', 'success');
  }

  stopTracking(): void {
    this.isTracking = false;
    this.showNotification('Gaze tracking stopped', 'info');
  }

  // Calibration Control
  openCalibrationWizard(): void {
    this.setView('calibration');
    this.startEnhancedCalibration();
  }

  startEnhancedCalibration(): void {
    this.showEnhancedCalibration = true;
    this.calibrationStatusText = 'calibrating';
  }

  onCalibrationComplete(result: any): void {
    this.showEnhancedCalibration = false;
    this.calibrationStatusText = 'calibrated';
    this.calibrationAccuracy = result.accuracy || 85;
    this.showNotification('Calibration completed successfully', 'success');
  }

  onCalibrationCancelled(): void {
    this.showEnhancedCalibration = false;
    this.calibrationStatusText = 'uncalibrated';
  }

  getTotalCalibrationPoints(): number {
    switch (this.selectedCalibrationPattern) {
      case '9-point': return 9;
      case '13-point': return 13;
      case '16-point': return 16;
      default: return 9;
    }
  }

  // Settings Management
  updateUserPreferences(): void {
    if (this.userPreferences.autoSaveSettings) {
      this.saveSettings();
    }
  }

  updatePerformanceSettings(): void {
    this.realTimeProcessingService.updateSettings({
      targetFPS: this.performanceSettings.targetFPS,
      adaptiveQualityEnabled: this.performanceSettings.adaptiveQuality
    });
    if (this.userPreferences.autoSaveSettings) {
      this.saveSettings();
    }
  }

  saveSettings(): void {
    const settings = {
      userPreferences: this.userPreferences,
      performanceSettings: this.performanceSettings
    };
    localStorage.setItem('visionMouseSettings', JSON.stringify(settings));
    this.showNotification('Settings saved successfully', 'success');
  }

  resetToDefaults(): void {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      this.userPreferences = {
        theme: 'Default',
        autoStart: false,
        showTutorial: true,
        defaultCalibrationPattern: '9-point',
        enableNotifications: true,
        autoSaveSettings: true,
        expertMode: false
      };
      this.performanceSettings = {
        targetFPS: 30,
        quality: 'medium',
        adaptiveQuality: true
      };
      this.showNotification('Settings reset to defaults', 'info');
    }
  }

  // Analytics
  exportAnalytics(): void {
    const data = {
      sessionStats: this.sessionStats,
      realTimeMetrics: this.realTimeMetrics,
      calibrationData: {
        accuracy: this.calibrationAccuracy,
        pattern: this.selectedCalibrationPattern
      },
      exportTime: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vision-mouse-analytics-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showNotification('Analytics data exported', 'success');
  }

  // Utility Methods
  private updateSystemHealth(): void {
    if (this.realTimeMetrics.processingLoad > 90 || this.realTimeMetrics.droppedFrames > 50) {
      this.systemStatus = 'error';
    } else if (this.realTimeMetrics.processingLoad > 70 || this.realTimeMetrics.droppedFrames > 20) {
      this.systemStatus = 'warning';
    } else {
      this.systemStatus = 'healthy';
    }
  }

  private updateCalibrationStatus(status: CalibrationStatus): void {
    switch (status) {
      case CalibrationStatus.IDLE:
        this.calibrationStatusText = 'uncalibrated';
        break;
      case CalibrationStatus.COLLECTING:
      case CalibrationStatus.INITIALIZING:
      case CalibrationStatus.VALIDATING:
        this.calibrationStatusText = 'calibrating';
        break;
      case CalibrationStatus.COMPLETED:
        this.calibrationStatusText = 'calibrated';
        break;
      case CalibrationStatus.FAILED:
        this.calibrationStatusText = 'uncalibrated';
        break;
    }
  }

  private loadUserPreferences(): void {
    const saved = localStorage.getItem('visionMouseUserPreferences');
    if (saved) {
      this.userPreferences = { ...this.userPreferences, ...JSON.parse(saved) };
    }
  }

  private saveUserPreferences(): void {
    localStorage.setItem('visionMouseUserPreferences', JSON.stringify(this.userPreferences));
  }

  // Public Utility Methods for Template
  getStatusText(): string {
    switch (this.systemStatus) {
      case 'healthy': return 'System Healthy';
      case 'warning': return 'Performance Warning';
      case 'error': return 'System Error';
      default: return 'Unknown';
    }
  }

  getQualityClass(): string {
    if (this.calibrationAccuracy > 80) return 'excellent';
    if (this.calibrationAccuracy > 60) return 'good';
    if (this.calibrationAccuracy > 40) return 'fair';
    return 'poor';
  }

  getQualityText(): string {
    if (this.calibrationAccuracy > 80) return 'Excellent';
    if (this.calibrationAccuracy > 60) return 'Good';
    if (this.calibrationAccuracy > 40) return 'Fair';
    return 'Poor';
  }

  getSessionDuration(): string {
    const duration = Date.now() - this.sessionStats.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return minutes + ':' + seconds.toString().padStart(2, '0');
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString();
  }

  showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): void {
    const notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    };
    
    this.notifications.push(notification);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      this.dismissNotification(notification);
    }, 5000);
  }

  dismissNotification(notification: any): void {
    const index = this.notifications.indexOf(notification);
    if (index > -1) {
      this.notifications.splice(index, 1);
    }
  }
}
