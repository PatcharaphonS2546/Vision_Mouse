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
  getCurrentGaze(frameData?: any): Observable<GazePoint> {
    // ต้องใช้ POST สำหรับ /gaze/predict และต้องส่ง field 'file' เป็น FormData
    const formData = new FormData();
    // รองรับทั้งกรณี frameData เป็น Blob/File หรือ base64 string
    if (frameData instanceof Blob || frameData instanceof File) {
      formData.append('file', frameData);
    } else if (typeof frameData === 'string') {
      // ถ้าเป็น base64 string ให้แปลงเป็น Blob ก่อน
      const byteString = atob(frameData.split(',')[1] || frameData);
      const mimeString = frameData.split(',')[0]?.split(':')[1]?.split(';')[0] || 'image/jpeg';
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      formData.append('file', blob);
    } else {
      throw new Error('frameData must be a File, Blob, or base64 string');
    }
    return this.baseApi.post<GazePoint>(
      API_CONFIG.ENDPOINTS.TRACKING.GAZE,
      formData
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
