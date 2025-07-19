import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { Subject, interval, takeUntil } from 'rxjs';

// Register Chart.js components
Chart.register(...registerables);

interface PerformanceData {
  timestamp: string;
  gazeAccuracy: number;
  frameRate: number;
  latency: number;
  aiConfidence: number;
}

@Component({
  selector: 'app-performance-charts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="performance-charts">
      <!-- Real-time Performance Chart -->
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Real-time Performance</h3>
          <div class="chart-controls">
            <button class="btn btn-sm" [class.active]="selectedMetric === 'accuracy'" (click)="selectMetric('accuracy')">
              Accuracy
            </button>
            <button class="btn btn-sm" [class.active]="selectedMetric === 'framerate'" (click)="selectMetric('framerate')">
              Frame Rate
            </button>
            <button class="btn btn-sm" [class.active]="selectedMetric === 'latency'" (click)="selectMetric('latency')">
              Latency
            </button>
            <button class="btn btn-sm" [class.active]="selectedMetric === 'ai'" (click)="selectMetric('ai')">
              AI Confidence
            </button>
          </div>
        </div>
        <div class="chart-content">
          <canvas #performanceChart></canvas>
        </div>
      </div>

      <!-- Gaze Accuracy Distribution -->
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Accuracy Distribution</h3>
          <span class="chart-subtitle">Last 100 samples</span>
        </div>
        <div class="chart-content">
          <canvas #accuracyChart></canvas>
        </div>
      </div>

      <!-- AI Performance Radar -->
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">AI Performance Radar</h3>
          <span class="chart-subtitle">Multi-dimensional analysis</span>
        </div>
        <div class="chart-content">
          <canvas #radarChart></canvas>
        </div>
      </div>

      <!-- System Health Gauge -->
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">System Health</h3>
          <span class="chart-subtitle">Overall performance score</span>
        </div>
        <div class="chart-content">
          <div class="gauge-container">
            <canvas #gaugeChart></canvas>
            <div class="gauge-label">
              <span class="gauge-value">{{ systemHealth }}%</span>
              <span class="gauge-text">Health Score</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./performance-charts.component.scss'],
})
export class PerformanceChartsComponent implements OnInit, OnDestroy {
  @ViewChild('performanceChart') performanceChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('accuracyChart') accuracyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radarChart') radarChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gaugeChart') gaugeChartRef!: ElementRef<HTMLCanvasElement>;

  private destroy$ = new Subject<void>();
  
  // Charts
  private performanceChart: Chart | null = null;
  private accuracyChart: Chart | null = null;
  private radarChart: Chart | null = null;
  private gaugeChart: Chart | null = null;

  // Data
  performanceData: PerformanceData[] = [];
  selectedMetric: 'accuracy' | 'framerate' | 'latency' | 'ai' = 'accuracy';
  systemHealth = 85;

  ngOnInit(): void {
    this.initializeCharts();
    this.startDataGeneration();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyCharts();
  }

  private initializeCharts(): void {
    setTimeout(() => {
      this.createPerformanceChart();
      this.createAccuracyChart();
      this.createRadarChart();
      this.createGaugeChart();
    }, 100);
  }

  private createPerformanceChart(): void {
    const ctx = this.performanceChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.performanceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Gaze Accuracy (%)',
          data: [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 750,
          easing: 'easeInOutQuart'
        },
        scales: {
          x: {
            display: false
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.8)'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        },
        elements: {
          point: {
            radius: 0,
            hoverRadius: 6
          }
        }
      }
    });
  }

  private createAccuracyChart(): void {
    const ctx = this.accuracyChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.accuracyChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Excellent (90-100%)', 'Good (80-90%)', 'Fair (70-80%)', 'Poor (<70%)'],
        datasets: [{
          data: [25, 45, 20, 10],
          backgroundColor: [
            '#10b981',
            '#3b82f6', 
            '#f59e0b',
            '#ef4444'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgba(255, 255, 255, 0.8)',
              usePointStyle: true,
              padding: 15
            }
          }
        }
      }
    });
  }

  private createRadarChart(): void {
    const ctx = this.radarChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: [
          'Accuracy',
          'Speed', 
          'Stability',
          'AI Confidence',
          'Calibration',
          'Responsiveness'
        ],
        datasets: [{
          label: 'Current Performance',
          data: [85, 78, 92, 88, 95, 82],
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.2)',
          borderWidth: 2,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            angleLines: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            pointLabels: {
              color: 'rgba(255, 255, 255, 0.8)',
              font: {
                size: 12
              }
            },
            ticks: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: 'rgba(255, 255, 255, 0.8)'
            }
          }
        }
      }
    });
  }

  private createGaugeChart(): void {
    const ctx = this.gaugeChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.gaugeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [this.systemHealth, 100 - this.systemHealth],
          backgroundColor: [
            this.getHealthColor(this.systemHealth),
            'rgba(255, 255, 255, 0.1)'
          ],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '80%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        }
      }
    });
  }

  private getHealthColor(health: number): string {
    if (health >= 90) return '#10b981';
    if (health >= 75) return '#3b82f6';
    if (health >= 60) return '#f59e0b';
    return '#ef4444';
  }

  private startDataGeneration(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.generateNewData();
        this.updateCharts();
        this.updateSystemHealth();
      });
  }

  private generateNewData(): void {
    const timestamp = new Date().toLocaleTimeString();
    const newData: PerformanceData = {
      timestamp,
      gazeAccuracy: 75 + Math.random() * 20,
      frameRate: 28 + Math.random() * 4,
      latency: 15 + Math.random() * 10,
      aiConfidence: 80 + Math.random() * 15
    };

    this.performanceData.push(newData);
    
    // Keep only last 50 data points
    if (this.performanceData.length > 50) {
      this.performanceData.shift();
    }
  }

  private updateCharts(): void {
    if (this.performanceChart) {
      const chart = this.performanceChart;
      chart.data.labels = this.performanceData.map(d => d.timestamp);
      
      let data: number[] = [];
      let label = '';
      let color = '#3b82f6';
      
      switch (this.selectedMetric) {
        case 'accuracy':
          data = this.performanceData.map(d => d.gazeAccuracy);
          label = 'Gaze Accuracy (%)';
          color = '#3b82f6';
          break;
        case 'framerate':
          data = this.performanceData.map(d => d.frameRate);
          label = 'Frame Rate (FPS)';
          color = '#10b981';
          break;
        case 'latency':
          data = this.performanceData.map(d => d.latency);
          label = 'Latency (ms)';
          color = '#f59e0b';
          break;
        case 'ai':
          data = this.performanceData.map(d => d.aiConfidence);
          label = 'AI Confidence (%)';
          color = '#8b5cf6';
          break;
      }
      
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].label = label;
      chart.data.datasets[0].borderColor = color;
      chart.data.datasets[0].backgroundColor = color + '20';
      chart.update('none');
    }

    // Update radar chart with latest data
    if (this.radarChart && this.performanceData.length > 0) {
      const latest = this.performanceData[this.performanceData.length - 1];
      this.radarChart.data.datasets[0].data = [
        latest.gazeAccuracy,
        latest.frameRate * 1.5, // Scale for better visualization
        85 + Math.random() * 10, // Stability (simulated)
        latest.aiConfidence,
        90 + Math.random() * 8, // Calibration (simulated)
        80 + Math.random() * 15 // Responsiveness (simulated)
      ];
      this.radarChart.update('none');
    }
  }

  private updateSystemHealth(): void {
    if (this.performanceData.length > 0) {
      const latest = this.performanceData[this.performanceData.length - 1];
      this.systemHealth = Math.round(
        (latest.gazeAccuracy + latest.aiConfidence + (latest.frameRate * 2)) / 4
      );
      
      if (this.gaugeChart && this.gaugeChart.data.datasets[0]) {
        this.gaugeChart.data.datasets[0].data = [this.systemHealth, 100 - this.systemHealth];
        const backgrounds = this.gaugeChart.data.datasets[0].backgroundColor;
        if (Array.isArray(backgrounds)) {
          backgrounds[0] = this.getHealthColor(this.systemHealth);
        }
        this.gaugeChart.update('none');
      }
    }
  }

  selectMetric(metric: 'accuracy' | 'framerate' | 'latency' | 'ai'): void {
    this.selectedMetric = metric;
    this.updateCharts();
  }

  private destroyCharts(): void {
    this.performanceChart?.destroy();
    this.accuracyChart?.destroy();
    this.radarChart?.destroy();
    this.gaugeChart?.destroy();
  }
}
