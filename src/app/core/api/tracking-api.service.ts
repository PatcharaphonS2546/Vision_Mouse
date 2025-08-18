/**
 * Tracking API Service
 * Handles eye tracking and gaze estimation API calls to Python Backend
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API_CONFIG, TrackingData, GazePoint, EyeData } from './api.config';

@Injectable({
  providedIn: 'root'
})
export class TrackingApiService {
  
  constructor(private baseApi: BaseApiService) {}

  /**
   * Start tracking session
   */
  startTracking(config: any): Observable<any> {
    return this.baseApi.post<any>(
      API_CONFIG.ENDPOINTS.TRACKING.START,
      config
    );
  }

  /**
   * Stop tracking session
   */
  stopTracking(): Observable<any> {
    return this.baseApi.post<any>(
      API_CONFIG.ENDPOINTS.TRACKING.STOP
    );
  }

  /**
   * Process frame for tracking
   */
  processFrame(frameData: any): Observable<TrackingData> {
    return this.baseApi.post<TrackingData>(
      API_CONFIG.ENDPOINTS.TRACKING.PROCESS,
      frameData
    );
  }

  /**
   * Get current gaze point
   */
  getCurrentGaze(): Observable<GazePoint> {
    return this.baseApi.get<GazePoint>(
      API_CONFIG.ENDPOINTS.TRACKING.GAZE
    );
  }

  /**
   * Get eye detection data
   */
  getEyeData(): Observable<EyeData> {
    return this.baseApi.get<EyeData>(
      API_CONFIG.ENDPOINTS.TRACKING.EYES
    );
  }

  /**
   * Get tracking status
   */
  getTrackingStatus(): Observable<any> {
    return this.baseApi.get<any>(
      API_CONFIG.ENDPOINTS.TRACKING.STATUS
    );
  }

  /**
   * Update tracking configuration
   */
  updateConfig(config: any): Observable<any> {
    return this.baseApi.put<any>(
      API_CONFIG.ENDPOINTS.TRACKING.CONFIG,
      config
    );
  }

  /**
   * Get tracking statistics
   */
  getTrackingStats(): Observable<any> {
    return this.baseApi.get<any>(
      API_CONFIG.ENDPOINTS.TRACKING.STATS
    );
  }

  /**
   * Reset tracking data
   */
  resetTracking(): Observable<any> {
    return this.baseApi.post<any>(
      API_CONFIG.ENDPOINTS.TRACKING.RESET
    );
  }

  /**
   * Export tracking session data
   */
  exportTrackingData(sessionId: string): Observable<Blob> {
    return this.baseApi.downloadFile(
      `${API_CONFIG.ENDPOINTS.TRACKING.EXPORT}/${sessionId}`
    );
  }
}
