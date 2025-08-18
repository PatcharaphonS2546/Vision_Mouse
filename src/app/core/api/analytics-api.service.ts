/**
 * Analytics API Service
 * Handles analytics and performance data API calls to Python Backend
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API_CONFIG, PerformanceMetrics, AnalyticsData } from './api.config';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsApiService {
  
  constructor(private baseApi: BaseApiService) {}

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(timeRange?: string): Observable<PerformanceMetrics> {
    const params = timeRange ? { timeRange } : {};
    return this.baseApi.get<PerformanceMetrics>(
      API_CONFIG.ENDPOINTS.ANALYTICS.PERFORMANCE,
      params
    );
  }

  /**
   * Get analytics dashboard data
   */
  getDashboardData(): Observable<AnalyticsData> {
    return this.baseApi.get<AnalyticsData>(
      API_CONFIG.ENDPOINTS.ANALYTICS.DASHBOARD
    );
  }

  /**
   * Get accuracy metrics
   */
  getAccuracyMetrics(sessionId?: string): Observable<any> {
    const params = sessionId ? { sessionId } : {};
    return this.baseApi.get<any>(
      API_CONFIG.ENDPOINTS.ANALYTICS.ACCURACY,
      params
    );
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): Observable<any> {
    return this.baseApi.get<any>(
      `${API_CONFIG.ENDPOINTS.ANALYTICS.SESSIONS}/${sessionId}`
    );
  }

  /**
   * Get all sessions list
   */
  getAllSessions(limit?: number, offset?: number): Observable<any[]> {
    const params: any = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    
    return this.baseApi.get<any[]>(
      API_CONFIG.ENDPOINTS.ANALYTICS.SESSIONS,
      params
    );
  }

  /**
   * Generate analytics report
   */
  generateReport(reportType: string, filters?: any): Observable<any> {
    const body = { reportType, filters };
    return this.baseApi.post<any>(
      API_CONFIG.ENDPOINTS.ANALYTICS.REPORTS,
      body
    );
  }

  /**
   * Export analytics data
   */
  exportAnalytics(format: 'csv' | 'json', filters?: any): Observable<Blob> {
    const params = { format, ...filters };
    return this.baseApi.downloadFile(
      API_CONFIG.ENDPOINTS.ANALYTICS.EXPORT,
      params
    );
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): Observable<any> {
    return this.baseApi.get<any>(
      API_CONFIG.ENDPOINTS.ANALYTICS.REALTIME
    );
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(days: number = 7): Observable<any> {
    return this.baseApi.get<any>(
      API_CONFIG.ENDPOINTS.ANALYTICS.TRENDS,
      { days }
    );
  }

  /**
   * Delete session data
   */
  deleteSession(sessionId: string): Observable<any> {
    return this.baseApi.delete<any>(
      `${API_CONFIG.ENDPOINTS.ANALYTICS.SESSIONS}/${sessionId}`
    );
  }
}
