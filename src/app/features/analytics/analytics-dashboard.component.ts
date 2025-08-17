/**
 * Analytics Dashboard Component
 * Advanced data analytics with ML insights and export capabilities
 */

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, interval, combineLatest } from 'rxjs';

import { 
  StateService, 
  ErrorHandlerService,
  NotificationService
} from '../../core/core.module';

import { MachineLearningService } from '../../services/machine-learning.service';
import { DataExportService } from '../../services/data-export.service';

import {
  Point2D,
  GazeEstimationResult,
  PerformanceMetrics,
  QualityLevel
} from '../../core/interfaces/core.interface';

interface AnalyticsData {
  sessionDuration: number;
  totalGazePoints: number;
  averageAccuracy: number;
  gazeHeatmap: HeatmapPoint[];
  fixationData: FixationPoint[];
  saccadeData: SaccadeData[];
  performanceHistory: PerformanceSnapshot[];
  qualityDistribution: QualityDistribution;
  usagePatterns: UsagePattern[];
}

interface HeatmapPoint extends Point2D {
  intensity: number;
  duration: number;
  timestamp: number;
}

interface FixationPoint extends Point2D {
  duration: number;
  quality: QualityLevel;
  timestamp: number;
  id: string;
}

interface SaccadeData {
  from: Point2D;
  to: Point2D;
  velocity: number;
  accuracy: number;
  timestamp: number;
}

interface PerformanceSnapshot {
  timestamp: number;
  fps: number;
  latency: number;
  accuracy: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface QualityDistribution {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

interface UsagePattern {
  timeOfDay: string;
  averageAccuracy: number;
  sessionCount: number;
  averageDuration: number;
}

interface MLInsight {
  type: 'optimization' | 'pattern' | 'recommendation' | 'anomaly';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  suggestion?: string;
}

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="analytics-dashboard">
      
      <!-- Header -->
      <div class="dashboard-header">
        <div class="header-left">
          <h2>📊 Advanced Analytics Dashboard</h2>
          <div class="session-info">
            <span class="session-duration">Session: {{formatDuration(analyticsData.sessionDuration)}}</span>
            <span class="data-points">Points: {{analyticsData.totalGazePoints | number}}</span>
          </div>
        </div>
        
        <div class="header-controls">
          <select [(ngModel)]="selectedTimeRange" (change)="updateTimeRange()" class="time-range-select">
            <option value="1h">ล่าสุด 1 ชั่วโมง</option>
            <option value="24h">ล่าสุด 24 ชั่วโมง</option>
            <option value="7d">ล่าสุด 7 วัน</option>
            <option value="30d">ล่าสุด 30 วัน</option>
            <option value="all">ทั้งหมด</option>
          </select>
          
          <button class="btn btn-primary" (click)="exportData()">
            <span class="btn-icon">📤</span>
            Export Data
          </button>
          
          <button class="btn btn-outline" (click)="refreshAnalytics()">
            <span class="btn-icon">🔄</span>
            Refresh
          </button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-section">
        <div class="summary-grid">
          <div class="summary-card primary">
            <div class="card-icon">🎯</div>
            <div class="card-content">
              <h3>Average Accuracy</h3>
              <div class="metric-value">{{analyticsData.averageAccuracy | number:'1.1-1'}}%</div>
              <div class="metric-change" [ngClass]="getAccuracyTrend()">
                {{getAccuracyChange()}}
              </div>
            </div>
          </div>
          
          <div class="summary-card">
            <div class="card-icon">👁️</div>
            <div class="card-content">
              <h3>Fixations</h3>
              <div class="metric-value">{{analyticsData.fixationData.length | number}}</div>
              <div class="metric-subtitle">{{getAverageFixationDuration()}}ms avg</div>
            </div>
          </div>
          
          <div class="summary-card">
            <div class="card-icon">⚡</div>
            <div class="card-content">
              <h3>Saccades</h3>
              <div class="metric-value">{{analyticsData.saccadeData.length | number}}</div>
              <div class="metric-subtitle">{{getAverageSaccadeVelocity()}}°/s avg</div>
            </div>
          </div>
          
          <div class="summary-card">
            <div class="card-icon">⏱️</div>
            <div class="card-content">
              <h3>Response Time</h3>
              <div class="metric-value">{{getAverageLatency()}}ms</div>
              <div class="metric-subtitle">{{getLatencyTrend()}}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Analytics Content -->
      <div class="analytics-content">
        
        <!-- Left Column -->
        <div class="analytics-left">
          
          <!-- Heatmap Visualization -->
          <div class="analytics-card heatmap-card">
            <div class="card-header">
              <h3>🔥 Gaze Heatmap</h3>
              <div class="card-controls">
                <select [(ngModel)]="heatmapMode" class="control-select">
                  <option value="intensity">ความเข้มข้น</option>
                  <option value="duration">ระยะเวลา</option>
                  <option value="quality">คุณภาพ</option>
                </select>
              </div>
            </div>
            
            <div class="heatmap-container">
              <canvas #heatmapCanvas 
                      class="heatmap-canvas"
                      [width]="heatmapWidth"
                      [height]="heatmapHeight">
              </canvas>
              
              <div class="heatmap-overlay">
                <div class="heatmap-legend">
                  <div class="legend-title">Intensity</div>
                  <div class="legend-gradient"></div>
                  <div class="legend-labels">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Fixation Analysis -->
          <div class="analytics-card">
            <div class="card-header">
              <h3>👁️ Fixation Analysis</h3>
            </div>
            
            <div class="fixation-analysis">
              <div class="fixation-stats">
                <div class="stat-item">
                  <label>Total Fixations:</label>
                  <span>{{analyticsData.fixationData.length}}</span>
                </div>
                <div class="stat-item">
                  <label>Average Duration:</label>
                  <span>{{getAverageFixationDuration()}}ms</span>
                </div>
                <div class="stat-item">
                  <label>Longest Fixation:</label>
                  <span>{{getLongestFixation()}}ms</span>
                </div>
              </div>
              
              <div class="fixation-distribution">
                <h4>Duration Distribution</h4>
                <div class="distribution-chart">
                  <div *ngFor="let bucket of getFixationDistribution()" 
                       class="distribution-bar"
                       [style.height.%]="bucket.percentage">
                    <div class="bar-label">{{bucket.range}}</div>
                    <div class="bar-value">{{bucket.count}}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column -->
        <div class="analytics-right">
          
          <!-- ML Insights -->
          <div class="analytics-card insights-card">
            <div class="card-header">
              <h3>🤖 ML Insights</h3>
              <div class="insights-status">
                <span class="status-dot" [ngClass]="mlInsightsStatus"></span>
                <span>{{getMlStatusText()}}</span>
              </div>
            </div>
            
            <div class="insights-content">
              <div *ngFor="let insight of mlInsights" class="insight-item" [ngClass]="'insight-' + insight.type">
                <div class="insight-header">
                  <div class="insight-icon">{{getInsightIcon(insight.type)}}</div>
                  <h4>{{insight.title}}</h4>
                  <div class="confidence-badge">{{(insight.confidence * 100) | number:'1.0-0'}}%</div>
                </div>
                
                <p class="insight-description">{{insight.description}}</p>
                
                <div *ngIf="insight.actionable && insight.suggestion" class="insight-action">
                  <button class="btn btn-sm btn-outline" (click)="applyInsight(insight)">
                    <span class="btn-icon">⚡</span>
                    {{insight.suggestion}}
                  </button>
                </div>
              </div>
              
              <div *ngIf="mlInsights.length === 0" class="no-insights">
                <div class="no-insights-icon">🔍</div>
                <p>กำลังวิเคราะห์ข้อมูล...</p>
                <small>ML insights จะปรากฏเมื่อมีข้อมูลเพียงพอ</small>
              </div>
            </div>
          </div>

          <!-- Performance Trends -->
          <div class="analytics-card">
            <div class="card-header">
              <h3>📈 Performance Trends</h3>
            </div>
            
            <div class="performance-trends">
              <canvas #performanceChart 
                      class="performance-chart"
                      [width]="chartWidth"
                      [height]="chartHeight">
              </canvas>
            </div>
          </div>

          <!-- Quality Distribution -->
          <div class="analytics-card">
            <div class="card-header">
              <h3>⭐ Quality Distribution</h3>
            </div>
            
            <div class="quality-analysis">
              <div class="quality-pie-chart">
                <canvas #qualityChart 
                        class="quality-chart"
                        width="200" 
                        height="200">
                </canvas>
              </div>
              
              <div class="quality-legend">
                <div class="legend-item excellent">
                  <div class="legend-color"></div>
                  <span>Excellent ({{analyticsData.qualityDistribution.excellent}}%)</span>
                </div>
                <div class="legend-item good">
                  <div class="legend-color"></div>
                  <span>Good ({{analyticsData.qualityDistribution.good}}%)</span>
                </div>
                <div class="legend-item fair">
                  <div class="legend-color"></div>
                  <span>Fair ({{analyticsData.qualityDistribution.fair}}%)</span>
                </div>
                <div class="legend-item poor">
                  <div class="legend-color"></div>
                  <span>Poor ({{analyticsData.qualityDistribution.poor}}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Usage Patterns -->
      <div class="patterns-section">
        <div class="analytics-card full-width">
          <div class="card-header">
            <h3>🕒 Usage Patterns</h3>
          </div>
          
          <div class="patterns-content">
            <div class="patterns-grid">
              <div *ngFor="let pattern of analyticsData.usagePatterns" class="pattern-item">
                <div class="pattern-time">{{pattern.timeOfDay}}</div>
                <div class="pattern-stats">
                  <div class="stat">
                    <label>Accuracy:</label>
                    <span>{{pattern.averageAccuracy | number:'1.1-1'}}%</span>
                  </div>
                  <div class="stat">
                    <label>Sessions:</label>
                    <span>{{pattern.sessionCount}}</span>
                  </div>
                  <div class="stat">
                    <label>Avg Duration:</label>
                    <span>{{formatDuration(pattern.averageDuration)}}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Export Options Modal -->
      <div class="export-modal" [ngClass]="{ 'modal-open': showExportModal }">
        <div class="modal-backdrop" (click)="closeExportModal()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>📤 Export Analytics Data</h3>
            <button class="btn btn-sm" (click)="closeExportModal()">✕</button>
          </div>
          
          <div class="modal-body">
            <div class="export-options">
              <div class="option-group">
                <h4>Data Range</h4>
                <label class="checkbox-label">
                  <input type="radio" name="exportRange" value="current" [(ngModel)]="exportOptions.range">
                  <span>Current View ({{selectedTimeRange}})</span>
                </label>
                <label class="checkbox-label">
                  <input type="radio" name="exportRange" value="all" [(ngModel)]="exportOptions.range">
                  <span>All Historical Data</span>
                </label>
              </div>
              
              <div class="option-group">
                <h4>Data Types</h4>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="exportOptions.includeGazeData">
                  <span>Gaze Points & Heatmap</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="exportOptions.includeFixations">
                  <span>Fixation Data</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="exportOptions.includeSaccades">
                  <span>Saccade Data</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="exportOptions.includePerformance">
                  <span>Performance Metrics</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="exportOptions.includeInsights">
                  <span>ML Insights</span>
                </label>
              </div>
              
              <div class="option-group">
                <h4>Format</h4>
                <select [(ngModel)]="exportOptions.format" class="format-select">
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel (XLSX)</option>
                  <option value="pdf">PDF Report</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closeExportModal()">Cancel</button>
            <button class="btn btn-primary" (click)="performExport()">
              <span class="btn-icon">📤</span>
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analytics-dashboard {
      padding: 20px;
      max-width: 1600px;
      margin: 0 auto;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      color: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      backdrop-filter: blur(10px);
    }

    .header-left h2 {
      margin: 0 0 8px 0;
      font-size: 1.8rem;
      font-weight: 300;
    }

    .session-info {
      display: flex;
      gap: 20px;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .header-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .time-range-select, .control-select, .format-select {
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      font-size: 0.9rem;
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

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }

    /* Summary Cards */
    .summary-section {
      margin-bottom: 30px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }

    .summary-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: transform 0.3s ease;
    }

    .summary-card:hover {
      transform: translateY(-4px);
    }

    .summary-card.primary {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.3) 0%, rgba(129, 199, 132, 0.3) 100%);
      border: 1px solid rgba(76, 175, 80, 0.4);
    }

    .card-icon {
      font-size: 2.5rem;
    }

    .card-content h3 {
      margin: 0 0 8px 0;
      font-size: 1rem;
      font-weight: 500;
      opacity: 0.8;
    }

    .metric-value {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 4px;
    }

    .metric-change {
      font-size: 0.9rem;
      font-weight: 500;
    }

    .metric-change.positive { color: #4caf50; }
    .metric-change.negative { color: #f44336; }
    .metric-change.neutral { color: #ff9800; }

    .metric-subtitle {
      font-size: 0.9rem;
      opacity: 0.7;
    }

    /* Analytics Content */
    .analytics-content {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 20px;
      margin-bottom: 30px;
    }

    .analytics-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      margin-bottom: 20px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .card-header h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 500;
    }

    /* Heatmap */
    .heatmap-container {
      position: relative;
      height: 400px;
      border-radius: 8px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.3);
    }

    .heatmap-canvas {
      width: 100%;
      height: 100%;
    }

    .heatmap-overlay {
      position: absolute;
      top: 10px;
      right: 10px;
    }

    .heatmap-legend {
      background: rgba(0, 0, 0, 0.7);
      padding: 12px;
      border-radius: 6px;
      min-width: 120px;
    }

    .legend-title {
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .legend-gradient {
      height: 20px;
      background: linear-gradient(90deg, #0066cc 0%, #ff0000 100%);
      border-radius: 2px;
      margin-bottom: 6px;
    }

    .legend-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
    }

    /* Fixation Analysis */
    .fixation-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      text-align: center;
      padding: 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }

    .stat-item label {
      font-size: 0.8rem;
      opacity: 0.7;
      margin-bottom: 4px;
    }

    .stat-item span {
      font-weight: 600;
      font-size: 1.1rem;
    }

    .distribution-chart {
      display: flex;
      align-items: end;
      gap: 4px;
      height: 100px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }

    .distribution-bar {
      flex: 1;
      background: linear-gradient(180deg, #4caf50 0%, #81c784 100%);
      border-radius: 2px;
      position: relative;
      min-height: 10px;
      display: flex;
      flex-direction: column;
      justify-content: end;
    }

    .bar-label {
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.7rem;
      white-space: nowrap;
    }

    .bar-value {
      position: absolute;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.7rem;
      font-weight: 600;
    }

    /* ML Insights */
    .insights-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4caf50;
    }

    .insights-content {
      max-height: 600px;
      overflow-y: auto;
    }

    .insight-item {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      border-left: 4px solid transparent;
    }

    .insight-optimization { border-left-color: #2196f3; }
    .insight-pattern { border-left-color: #ff9800; }
    .insight-recommendation { border-left-color: #4caf50; }
    .insight-anomaly { border-left-color: #f44336; }

    .insight-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .insight-icon {
      font-size: 1.2rem;
    }

    .insight-header h4 {
      margin: 0;
      flex: 1;
      font-size: 1rem;
      font-weight: 500;
    }

    .confidence-badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .insight-description {
      margin: 0 0 12px 0;
      font-size: 0.9rem;
      line-height: 1.4;
      opacity: 0.9;
    }

    .insight-action {
      margin-top: 8px;
    }

    .no-insights {
      text-align: center;
      padding: 40px 20px;
      opacity: 0.7;
    }

    .no-insights-icon {
      font-size: 3rem;
      margin-bottom: 16px;
    }

    /* Charts */
    .performance-chart, .quality-chart {
      width: 100%;
      border-radius: 8px;
    }

    .quality-analysis {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .quality-legend {
      flex: 1;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 0.9rem;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    .legend-item.excellent .legend-color { background: #4caf50; }
    .legend-item.good .legend-color { background: #8bc34a; }
    .legend-item.fair .legend-color { background: #ff9800; }
    .legend-item.poor .legend-color { background: #f44336; }

    /* Usage Patterns */
    .patterns-section {
      margin-bottom: 30px;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .patterns-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .pattern-item {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .pattern-time {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 12px;
      color: #81c784;
    }

    .pattern-stats {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .stat {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
    }

    .stat label {
      opacity: 0.7;
    }

    /* Export Modal */
    .export-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
      display: none;
    }

    .export-modal.modal-open {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(5px);
    }

    .modal-content {
      background: rgba(30, 41, 59, 0.95);
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      position: relative;
      z-index: 1;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 500;
    }

    .modal-body {
      padding: 20px;
    }

    .option-group {
      margin-bottom: 24px;
    }

    .option-group h4 {
      margin: 0 0 12px 0;
      font-size: 1rem;
      font-weight: 500;
      color: #81c784;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .checkbox-label input {
      cursor: pointer;
    }

    .modal-footer {
      display: flex;
      justify-content: end;
      gap: 12px;
      padding: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* Responsive Design */
    @media (max-width: 1200px) {
      .analytics-content {
        grid-template-columns: 1fr;
      }
      
      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .dashboard-header {
        flex-direction: column;
        gap: 15px;
      }
      
      .header-controls {
        flex-wrap: wrap;
      }
      
      .summary-grid {
        grid-template-columns: 1fr;
      }
      
      .fixation-stats {
        grid-template-columns: 1fr;
      }
      
      .quality-analysis {
        flex-direction: column;
      }
      
      .patterns-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  
  @ViewChild('heatmapCanvas') heatmapCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('performanceChart') performanceChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('qualityChart') qualityChart!: ElementRef<HTMLCanvasElement>;
  
  private destroy$ = new Subject<void>();
  private heatmapContext?: CanvasRenderingContext2D;
  private performanceContext?: CanvasRenderingContext2D;
  private qualityContext?: CanvasRenderingContext2D;
  
  // Component state
  selectedTimeRange = '24h';
  heatmapMode = 'intensity';
  showExportModal = false;
  mlInsightsStatus = 'ready';
  
  // Chart dimensions
  heatmapWidth = 800;
  heatmapHeight = 400;
  chartWidth = 350;
  chartHeight = 200;
  
  // Analytics data
  analyticsData: AnalyticsData = {
    sessionDuration: 3600000, // 1 hour in ms
    totalGazePoints: 15420,
    averageAccuracy: 87.5,
    gazeHeatmap: [],
    fixationData: [],
    saccadeData: [],
    performanceHistory: [],
    qualityDistribution: {
      excellent: 45,
      good: 35,
      fair: 15,
      poor: 5
    },
    usagePatterns: []
  };
  
  mlInsights: MLInsight[] = [];
  
  exportOptions = {
    range: 'current' as 'current' | 'all',
    includeGazeData: true,
    includeFixations: true,
    includeSaccades: true,
    includePerformance: true,
    includeInsights: false,
    includeCalibration: false,
    format: 'json' as 'json' | 'csv' | 'xlsx' | 'pdf'
  };

  constructor(
    private stateService: StateService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService,
    private mlService: MachineLearningService,
    private exportService: DataExportService
  ) {}

  ngOnInit() {
    this.initializeAnalytics();
    this.generateMLInsights();
    this.subscribeToData();
  }

  ngAfterViewInit() {
    this.initializeCharts();
    this.renderVisualizations();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeAnalytics() {
    // Generate sample data
    this.generateSampleData();
    
    // Start periodic updates
    interval(5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateRealTimeData();
      });
  }

  private subscribeToData() {
    // Subscribe to state service for real-time data
    this.stateService.performanceMetrics
      .pipe(takeUntil(this.destroy$))
      .subscribe(metrics => {
        this.addPerformanceSnapshot(metrics);
      });
  }

  private initializeCharts() {
    if (this.heatmapCanvas?.nativeElement) {
      this.heatmapContext = this.heatmapCanvas.nativeElement.getContext('2d')!;
    }
    
    if (this.performanceChart?.nativeElement) {
      this.performanceContext = this.performanceChart.nativeElement.getContext('2d')!;
    }
    
    if (this.qualityChart?.nativeElement) {
      this.qualityContext = this.qualityChart.nativeElement.getContext('2d')!;
    }
  }

  private renderVisualizations() {
    this.renderHeatmap();
    this.renderPerformanceChart();
    this.renderQualityChart();
  }

  private renderHeatmap() {
    if (!this.heatmapContext) return;
    
    const ctx = this.heatmapContext;
    ctx.clearRect(0, 0, this.heatmapWidth, this.heatmapHeight);
    
    // Render heatmap points
    this.analyticsData.gazeHeatmap.forEach(point => {
      const radius = Math.max(10, point.intensity * 30);
      const alpha = Math.min(1, point.intensity);
      
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  private renderPerformanceChart() {
    if (!this.performanceContext) return;
    
    const ctx = this.performanceContext;
    ctx.clearRect(0, 0, this.chartWidth, this.chartHeight);
    
    // Simple line chart for performance data
    const data = this.analyticsData.performanceHistory.slice(-20); // Last 20 points
    if (data.length < 2) return;
    
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    data.forEach((point, index) => {
      const x = (index / (data.length - 1)) * this.chartWidth;
      const y = this.chartHeight - (point.fps / 60) * this.chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
  }

  private renderQualityChart() {
    if (!this.qualityContext) return;
    
    const ctx = this.qualityContext;
    const centerX = 100;
    const centerY = 100;
    const radius = 80;
    
    ctx.clearRect(0, 0, 200, 200);
    
    const data = [
      { value: this.analyticsData.qualityDistribution.excellent, color: '#4caf50' },
      { value: this.analyticsData.qualityDistribution.good, color: '#8bc34a' },
      { value: this.analyticsData.qualityDistribution.fair, color: '#ff9800' },
      { value: this.analyticsData.qualityDistribution.poor, color: '#f44336' }
    ];
    
    let currentAngle = -Math.PI / 2;
    
    data.forEach(segment => {
      const sliceAngle = (segment.value / 100) * 2 * Math.PI;
      
      ctx.fillStyle = segment.color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      
      currentAngle += sliceAngle;
    });
  }

  private generateSampleData() {
    // Generate sample heatmap data
    for (let i = 0; i < 100; i++) {
      this.analyticsData.gazeHeatmap.push({
        x: Math.random() * this.heatmapWidth,
        y: Math.random() * this.heatmapHeight,
        intensity: Math.random(),
        duration: 100 + Math.random() * 500,
        timestamp: Date.now() - Math.random() * 3600000
      });
    }
    
    // Generate sample fixation data
    for (let i = 0; i < 50; i++) {
      this.analyticsData.fixationData.push({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        duration: 200 + Math.random() * 800,
        quality: ['excellent', 'good', 'fair', 'poor'][Math.floor(Math.random() * 4)] as QualityLevel,
        timestamp: Date.now() - Math.random() * 3600000,
        id: `fix_${i}`
      });
    }
    
    // Generate sample usage patterns
    const timeSlots = ['00-06', '06-12', '12-18', '18-24'];
    timeSlots.forEach(slot => {
      this.analyticsData.usagePatterns.push({
        timeOfDay: slot,
        averageAccuracy: 70 + Math.random() * 25,
        sessionCount: Math.floor(Math.random() * 20) + 1,
        averageDuration: 600000 + Math.random() * 1800000 // 10-40 minutes
      });
    });
    
    // Generate performance history
    for (let i = 0; i < 100; i++) {
      this.analyticsData.performanceHistory.push({
        timestamp: Date.now() - (100 - i) * 60000, // Every minute
        fps: 25 + Math.random() * 35,
        latency: 10 + Math.random() * 40,
        accuracy: 70 + Math.random() * 25,
        cpuUsage: 20 + Math.random() * 60,
        memoryUsage: 100 + Math.random() * 400
      });
    }
  }

  private generateMLInsights() {
    this.mlInsights = [
      {
        type: 'optimization',
        title: 'Performance Optimization Available',
        description: 'ระบบตรวจพบว่าการเพิ่ม smoothing level เป็น 0.4 จะช่วยเพิ่มความแม่นยำ',
        confidence: 0.89,
        actionable: true,
        suggestion: 'Apply Optimization'
      },
      {
        type: 'pattern',
        title: 'Usage Pattern Detected',
        description: 'คุณมีความแม่นยำสูงสุดในช่วง 14:00-18:00 และลดลงหลัง 20:00',
        confidence: 0.76,
        actionable: false
      },
      {
        type: 'recommendation',
        title: 'Calibration Recommendation',
        description: 'แนะนำให้ปรับเทียบใหม่ เนื่องจากความแม่นยำลดลง 8% ในสัปดาห์ที่ผ่านมา',
        confidence: 0.82,
        actionable: true,
        suggestion: 'Recalibrate Now'
      }
    ];
  }

  private updateRealTimeData() {
    // Update session duration
    this.analyticsData.sessionDuration += 5000;
    
    // Add new gaze points
    this.analyticsData.totalGazePoints += Math.floor(Math.random() * 10);
    
    // Update average accuracy
    this.analyticsData.averageAccuracy += (Math.random() - 0.5) * 0.5;
    this.analyticsData.averageAccuracy = Math.max(60, Math.min(95, this.analyticsData.averageAccuracy));
  }

  private addPerformanceSnapshot(metrics: PerformanceMetrics) {
    this.analyticsData.performanceHistory.push({
      timestamp: Date.now(),
      fps: metrics.fps,
      latency: metrics.latency,
      accuracy: this.analyticsData.averageAccuracy,
      cpuUsage: metrics.cpuUsage,
      memoryUsage: metrics.memoryUsage
    });
    
    // Keep only last 100 snapshots
    if (this.analyticsData.performanceHistory.length > 100) {
      this.analyticsData.performanceHistory.shift();
    }
    
    // Re-render charts
    this.renderPerformanceChart();
  }

  // Event Handlers
  updateTimeRange() {
    this.refreshAnalytics();
  }

  refreshAnalytics() {
    this.notifications.showInfo('กำลังรีเฟรชข้อมูล...');
    // In a real implementation, this would fetch new data based on time range
    setTimeout(() => {
      this.renderVisualizations();
      this.notifications.showSuccess('อัปเดตข้อมูลแล้ว');
    }, 1000);
  }

  exportData() {
    this.showExportModal = true;
  }

  closeExportModal() {
    this.showExportModal = false;
  }

  performExport() {
    // Use the export service
    this.exportService.exportData(this.analyticsData, this.exportOptions)
      .then(() => {
        this.notifications.showSuccess(`ส่งออกข้อมูลเป็น ${this.exportOptions.format.toUpperCase()} สำเร็จ`);
        this.closeExportModal();
      })
      .catch(error => {
        this.notifications.showError(`เกิดข้อผิดพลาดในการส่งออก: ${error.message}`);
      });
  }

  applyInsight(insight: MLInsight) {
    this.notifications.showInfo(`กำลังปรับใช้: ${insight.suggestion}`);
    // In a real implementation, this would apply the optimization
  }

  // Helper Methods
  formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getAccuracyTrend(): string {
    // Simulate trend calculation
    const change = (Math.random() - 0.5) * 10;
    if (change > 2) return 'positive';
    if (change < -2) return 'negative';
    return 'neutral';
  }

  getAccuracyChange(): string {
    const change = (Math.random() - 0.5) * 10;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  }

  getAverageFixationDuration(): number {
    if (this.analyticsData.fixationData.length === 0) return 0;
    const total = this.analyticsData.fixationData.reduce((sum, fix) => sum + fix.duration, 0);
    return Math.round(total / this.analyticsData.fixationData.length);
  }

  getLongestFixation(): number {
    if (this.analyticsData.fixationData.length === 0) return 0;
    return Math.max(...this.analyticsData.fixationData.map(fix => fix.duration));
  }

  getAverageSaccadeVelocity(): number {
    if (this.analyticsData.saccadeData.length === 0) return 0;
    const total = this.analyticsData.saccadeData.reduce((sum, sac) => sum + sac.velocity, 0);
    return Math.round(total / this.analyticsData.saccadeData.length);
  }

  getAverageLatency(): number {
    if (this.analyticsData.performanceHistory.length === 0) return 0;
    const recent = this.analyticsData.performanceHistory.slice(-10);
    const total = recent.reduce((sum, perf) => sum + perf.latency, 0);
    return Math.round(total / recent.length);
  }

  getLatencyTrend(): string {
    if (this.analyticsData.performanceHistory.length < 2) return 'stable';
    const recent = this.analyticsData.performanceHistory.slice(-5);
    const avg = recent.reduce((sum, perf) => sum + perf.latency, 0) / recent.length;
    return avg < 25 ? 'excellent' : avg < 50 ? 'good' : 'needs improvement';
  }

  getMlStatusText(): string {
    const statusMap: { [key: string]: string } = {
      'ready': 'Ready',
      'processing': 'Analyzing...',
      'error': 'Error'
    };
    return statusMap[this.mlInsightsStatus] || this.mlInsightsStatus;
  }

  getInsightIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'optimization': '⚡',
      'pattern': '📈',
      'recommendation': '💡',
      'anomaly': '⚠️'
    };
    return iconMap[type] || '🔍';
  }

  getFixationDistribution() {
    const buckets = [
      { range: '0-200ms', min: 0, max: 200, count: 0 },
      { range: '200-500ms', min: 200, max: 500, count: 0 },
      { range: '500-1000ms', min: 500, max: 1000, count: 0 },
      { range: '1000ms+', min: 1000, max: Infinity, count: 0 }
    ];
    
    this.analyticsData.fixationData.forEach(fixation => {
      const bucket = buckets.find(b => fixation.duration >= b.min && fixation.duration < b.max);
      if (bucket) bucket.count++;
    });
    
    const maxCount = Math.max(...buckets.map(b => b.count));
    
    return buckets.map(bucket => ({
      ...bucket,
      percentage: maxCount > 0 ? (bucket.count / maxCount) * 100 : 0
    }));
  }
}
