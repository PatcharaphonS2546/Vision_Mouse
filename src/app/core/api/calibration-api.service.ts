/**
 * Calibration API Service
 * Handles calibration-related API calls to Python Backend
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API_CONFIG, CalibrationData, CalibrationResult } from './api.config';

@Injectable({
  providedIn: 'root'
})
export class CalibrationApiService {
  
  constructor(private baseApi: BaseApiService) {}

  /**
   * Start calibration process
   */
  startCalibration(config: any): Observable<CalibrationResult> {
    return this.baseApi.post<CalibrationResult>(
      API_CONFIG.ENDPOINTS.CALIBRATION.START,
      config
    );
  }

  /**
   * Submit calibration point
   */
  submitCalibrationPoint(point: CalibrationData): Observable<any> {
    return this.baseApi.post<any>(
      API_CONFIG.ENDPOINTS.CALIBRATION.SUBMIT_POINT,
      point
    );
  }

  /**
   * Complete calibration
   */
  completeCalibration(): Observable<CalibrationResult> {
    return this.baseApi.post<CalibrationResult>(
      API_CONFIG.ENDPOINTS.CALIBRATION.COMPLETE
    );
  }

  /**
   * Validate calibration
   */
  validateCalibration(): Observable<any> {
    return this.baseApi.get<any>(
      API_CONFIG.ENDPOINTS.CALIBRATION.VALIDATE
    );
  }

  /**
   * Reset calibration
   */
  resetCalibration(): Observable<any> {
    return this.baseApi.post<any>(
      API_CONFIG.ENDPOINTS.CALIBRATION.RESET
    );
  }

  /**
   * Get calibration status
   */
  getCalibrationStatus(): Observable<any> {
    return this.baseApi.get<any>(
      API_CONFIG.ENDPOINTS.CALIBRATION.STATUS
    );
  }

  /**
   * Save calibration data
   */
  saveCalibration(data: CalibrationResult): Observable<any> {
    return this.baseApi.post<any>(
      API_CONFIG.ENDPOINTS.CALIBRATION.SAVE,
      data
    );
  }

  /**
   * Load saved calibration
   */
  loadCalibration(id: string): Observable<CalibrationResult> {
    return this.baseApi.get<CalibrationResult>(
      `${API_CONFIG.ENDPOINTS.CALIBRATION.LOAD}/${id}`
    );
  }
}
