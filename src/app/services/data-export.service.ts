/**
 * Data Export Service
 * Professional data export capabilities with multiple formats
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  range: 'current' | 'all';
  includeGazeData: boolean;
  includeFixations: boolean;
  includeSaccades: boolean;
  includePerformance: boolean;
  includeInsights: boolean;
  includeCalibration: boolean;
}

interface ExportProgress {
  status: 'idle' | 'preparing' | 'exporting' | 'complete' | 'error';
  progress: number;
  message: string;
  filename?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataExportService {
  
  private exportProgress$ = new BehaviorSubject<ExportProgress>({
    status: 'idle',
    progress: 0,
    message: ''
  });

  get exportProgress() {
    return this.exportProgress$.asObservable();
  }

  /**
   * Export analytics data in specified format
   */
  async exportData(data: any, options: ExportOptions): Promise<void> {
    this.updateProgress('preparing', 10, 'เตรียมข้อมูลส่งออก...');

    try {
      const processedData = this.processExportData(data, options);
      this.updateProgress('exporting', 50, 'กำลังสร้างไฟล์...');

      let blob: Blob;
      let filename: string;

      switch (options.format) {
        case 'json':
          ({ blob, filename } = this.exportAsJSON(processedData, options));
          break;
        case 'csv':
          ({ blob, filename } = this.exportAsCSV(processedData, options));
          break;
        case 'xlsx':
          ({ blob, filename } = await this.exportAsExcel(processedData, options));
          break;
        case 'pdf':
          ({ blob, filename } = await this.exportAsPDF(processedData, options));
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      this.updateProgress('complete', 100, 'ส่งออกเสร็จสิ้น', filename);
      this.downloadFile(blob, filename);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateProgress('error', 0, `เกิดข้อผิดพลาด: ${errorMessage}`);
      throw error;
    }
  }

  private processExportData(data: any, options: ExportOptions): any {
    const processed: any = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        format: options.format,
        range: options.range,
        generatedBy: 'Vision Mouse Analytics'
      }
    };

    if (options.includeGazeData && data.gazeHeatmap) {
      processed.gazeData = {
        heatmapPoints: data.gazeHeatmap,
        totalPoints: data.totalGazePoints,
        sessionDuration: data.sessionDuration
      };
    }

    if (options.includeFixations && data.fixationData) {
      processed.fixationAnalysis = {
        fixations: data.fixationData,
        averageDuration: this.calculateAverageFixationDuration(data.fixationData),
        totalFixations: data.fixationData.length
      };
    }

    if (options.includeSaccades && data.saccadeData) {
      processed.saccadeAnalysis = {
        saccades: data.saccadeData,
        averageVelocity: this.calculateAverageSaccadeVelocity(data.saccadeData),
        totalSaccades: data.saccadeData.length
      };
    }

    if (options.includePerformance && data.performanceHistory) {
      processed.performanceMetrics = {
        history: data.performanceHistory,
        averageAccuracy: data.averageAccuracy,
        qualityDistribution: data.qualityDistribution
      };
    }

    if (options.includeInsights && data.mlInsights) {
      processed.mlInsights = data.mlInsights;
    }

    return processed;
  }

  private exportAsJSON(data: any, options: ExportOptions): { blob: Blob; filename: string } {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `vision-mouse-analytics-${this.getTimestamp()}.json`;
    
    return { blob, filename };
  }

  private exportAsCSV(data: any, options: ExportOptions): { blob: Blob; filename: string } {
    let csvContent = '';
    
    // Header
    csvContent += 'Vision Mouse Analytics Export\n';
    csvContent += `Export Date,${data.exportInfo.timestamp}\n`;
    csvContent += `Format,${data.exportInfo.format}\n\n`;

    // Gaze Data
    if (data.gazeData) {
      csvContent += 'Gaze Heatmap Data\n';
      csvContent += 'X,Y,Intensity,Duration,Timestamp\n';
      data.gazeData.heatmapPoints.forEach((point: any) => {
        csvContent += `${point.x},${point.y},${point.intensity},${point.duration},${point.timestamp}\n`;
      });
      csvContent += '\n';
    }

    // Fixation Data
    if (data.fixationAnalysis) {
      csvContent += 'Fixation Data\n';
      csvContent += 'X,Y,Duration,Quality,Timestamp,ID\n';
      data.fixationAnalysis.fixations.forEach((fixation: any) => {
        csvContent += `${fixation.x},${fixation.y},${fixation.duration},${fixation.quality},${fixation.timestamp},${fixation.id}\n`;
      });
      csvContent += '\n';
    }

    // Performance Data
    if (data.performanceMetrics) {
      csvContent += 'Performance History\n';
      csvContent += 'Timestamp,FPS,Latency,Accuracy,CPU Usage,Memory Usage\n';
      data.performanceMetrics.history.forEach((perf: any) => {
        csvContent += `${perf.timestamp},${perf.fps},${perf.latency},${perf.accuracy},${perf.cpuUsage},${perf.memoryUsage}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `vision-mouse-analytics-${this.getTimestamp()}.csv`;
    
    return { blob, filename };
  }

  private async exportAsExcel(data: any, options: ExportOptions): Promise<{ blob: Blob; filename: string }> {
    // In a real implementation, this would use a library like xlsx
    // For now, we'll simulate Excel export
    
    this.updateProgress('exporting', 70, 'กำลังสร้างไฟล์ Excel...');
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create a simple Excel-like structure (simplified)
    const excelData = this.convertToExcelFormat(data);
    const blob = new Blob([JSON.stringify(excelData, null, 2)], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const filename = `vision-mouse-analytics-${this.getTimestamp()}.xlsx`;
    
    return { blob, filename };
  }

  private async exportAsPDF(data: any, options: ExportOptions): Promise<{ blob: Blob; filename: string }> {
    // In a real implementation, this would use a library like jsPDF
    // For now, we'll create a simple PDF-like structure
    
    this.updateProgress('exporting', 80, 'กำลังสร้างรายงาน PDF...');
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const pdfContent = this.generatePDFContent(data);
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const filename = `vision-mouse-report-${this.getTimestamp()}.pdf`;
    
    return { blob, filename };
  }

  private convertToExcelFormat(data: any): any {
    // Simplified Excel format structure
    return {
      worksheets: [
        {
          name: 'Summary',
          data: this.createSummarySheet(data)
        },
        {
          name: 'Gaze Data',
          data: data.gazeData?.heatmapPoints || []
        },
        {
          name: 'Fixations',
          data: data.fixationAnalysis?.fixations || []
        },
        {
          name: 'Performance',
          data: data.performanceMetrics?.history || []
        }
      ]
    };
  }

  private createSummarySheet(data: any): any[] {
    return [
      ['Vision Mouse Analytics Summary'],
      ['Export Date', data.exportInfo.timestamp],
      [''],
      ['Metrics', 'Value'],
      ['Total Gaze Points', data.gazeData?.totalPoints || 0],
      ['Total Fixations', data.fixationAnalysis?.totalFixations || 0],
      ['Average Accuracy', `${data.performanceMetrics?.averageAccuracy || 0}%`],
      ['Session Duration', this.formatDuration(data.gazeData?.sessionDuration || 0)]
    ];
  }

  private generatePDFContent(data: any): string {
    // Simplified PDF content generation
    let content = `%PDF-1.4
Vision Mouse Analytics Report
Generated: ${data.exportInfo.timestamp}

=== SUMMARY ===
Total Gaze Points: ${data.gazeData?.totalPoints || 0}
Total Fixations: ${data.fixationAnalysis?.totalFixations || 0}
Average Accuracy: ${data.performanceMetrics?.averageAccuracy || 0}%
Session Duration: ${this.formatDuration(data.gazeData?.sessionDuration || 0)}

=== PERFORMANCE ANALYSIS ===
`;

    if (data.performanceMetrics?.qualityDistribution) {
      const quality = data.performanceMetrics.qualityDistribution;
      content += `
Quality Distribution:
- Excellent: ${quality.excellent}%
- Good: ${quality.good}%
- Fair: ${quality.fair}%
- Poor: ${quality.poor}%
`;
    }

    if (data.mlInsights && data.mlInsights.length > 0) {
      content += `
=== ML INSIGHTS ===
`;
      data.mlInsights.forEach((insight: any, index: number) => {
        content += `
${index + 1}. ${insight.title}
   ${insight.description}
   Confidence: ${(insight.confidence * 100).toFixed(1)}%
`;
      });
    }

    return content;
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private updateProgress(status: ExportProgress['status'], progress: number, message: string, filename?: string): void {
    this.exportProgress$.next({
      status,
      progress,
      message,
      filename
    });
  }

  private getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }

  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private calculateAverageFixationDuration(fixations: any[]): number {
    if (fixations.length === 0) return 0;
    const total = fixations.reduce((sum, fix) => sum + fix.duration, 0);
    return Math.round(total / fixations.length);
  }

  private calculateAverageSaccadeVelocity(saccades: any[]): number {
    if (saccades.length === 0) return 0;
    const total = saccades.reduce((sum, sac) => sum + sac.velocity, 0);
    return Math.round(total / saccades.length);
  }
}
