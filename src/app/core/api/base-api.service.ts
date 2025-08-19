/**
 * Base API Service
 * Handles common HTTP operations and error handling for Python Backend
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { retry, catchError, map, timeout } from 'rxjs/operators';

import { API_CONFIG, ApiResponse, ApiError } from './api.config';

@Injectable({
  providedIn: 'root'
})
export class BaseApiService {
  private baseUrl = API_CONFIG.BASE_URL;
  
  constructor(private http: HttpClient) {}

  /**
   * GET Request
   */
  get<T>(endpoint: string, params?: any): Observable<T> {
    const url = this.buildUrl(endpoint);
    const httpParams = this.buildParams(params);

    // Prevent GET to gaze prediction endpoint
    if (endpoint === '/gaze/predict' || endpoint === API_CONFIG.ENDPOINTS.TRACKING.GAZE) {
      console.warn('GET /gaze/predict is not allowed. Use POST instead.');
      throw new Error('GET /gaze/predict is not allowed. Use POST instead.');
    }

    return this.http.get<ApiResponse<T>>(url, {
      params: httpParams,
      headers: this.getHeaders()
    }).pipe(
      timeout(API_CONFIG.TIMEOUT),
      retry(API_CONFIG.RETRY_ATTEMPTS),
      map(response => this.handleResponse<T>(response)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * POST Request
   */
  post<T>(endpoint: string, body?: any): Observable<T> {
    const url = this.buildUrl(endpoint);
    let headers: HttpHeaders;
    // ถ้า body เป็น FormData ไม่ต้องตั้ง Content-Type
    if (body instanceof FormData) {
      headers = new HttpHeaders({ 'Accept': 'application/json' });
    } else {
      headers = this.getHeaders();
    }
    return this.http.post<ApiResponse<T>>(url, body, {
      headers
    }).pipe(
      timeout(API_CONFIG.TIMEOUT),
      retry(API_CONFIG.RETRY_ATTEMPTS),
      map(response => this.handleResponse<T>(response)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * PUT Request
   */
  put<T>(endpoint: string, body?: any): Observable<T> {
    const url = this.buildUrl(endpoint);
    
    return this.http.put<ApiResponse<T>>(url, body, {
      headers: this.getHeaders()
    }).pipe(
      timeout(API_CONFIG.TIMEOUT),
      retry(API_CONFIG.RETRY_ATTEMPTS),
      map(response => this.handleResponse<T>(response)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * DELETE Request
   */
  delete<T>(endpoint: string): Observable<T> {
    const url = this.buildUrl(endpoint);
    
    return this.http.delete<ApiResponse<T>>(url, {
      headers: this.getHeaders()
    }).pipe(
      timeout(API_CONFIG.TIMEOUT),
      retry(API_CONFIG.RETRY_ATTEMPTS),
      map(response => this.handleResponse<T>(response)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Upload File
   */
  uploadFile<T>(endpoint: string, file: File, additionalData?: any): Observable<T> {
    const url = this.buildUrl(endpoint);
    const formData = new FormData();
    
    formData.append('file', file);
    if (additionalData) {
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }

    return this.http.post<ApiResponse<T>>(url, formData).pipe(
      timeout(API_CONFIG.TIMEOUT * 2), // Longer timeout for file uploads
      map(response => this.handleResponse<T>(response)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Download File
   */
  downloadFile(endpoint: string, params?: any): Observable<Blob> {
    const url = this.buildUrl(endpoint);
    const httpParams = this.buildParams(params);
    
    return this.http.get(url, {
      params: httpParams,
      headers: this.getHeaders(),
      responseType: 'blob'
    }).pipe(
      timeout(API_CONFIG.TIMEOUT * 3), // Longer timeout for downloads
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Health Check
   */
  healthCheck(): Observable<any> {
    return this.get(API_CONFIG.ENDPOINTS.HEALTH);
  }

  /**
   * Set Base URL (for configuration)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Private Helper Methods
   */
  private buildUrl(endpoint: string): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseUrl}/${cleanEndpoint}`;
  }

  private buildParams(params?: any): HttpParams {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== null && value !== undefined) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    
    return httpParams;
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // Add authentication headers here if needed
      // 'Authorization': `Bearer ${this.getAuthToken()}`
    });
  }

  private handleResponse<T>(response: ApiResponse<T>): T {
    // รองรับ response ที่ไม่มี success
    if ('success' in response && response.success && response.data !== undefined) {
      return response.data;
    } else if ('data' in response && response.data !== undefined) {
      return response.data;
    } else {
      // ถ้า response เป็น object ที่ไม่มี data ให้คืนทั้งก้อน
      if (typeof response === 'object') {
        return response as T;
      }
      let errMsg = 'Unknown API error';
      if (typeof response === 'object' && response !== null) {
        if ('error' in response && typeof (response as any).error === 'string') {
          errMsg = (response as any).error;
        } else if ('message' in response && typeof (response as any).message === 'string') {
          errMsg = (response as any).message;
        }
      }
      throw new Error(errMsg);
    }
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let apiError: ApiError;

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      apiError = {
        code: 'CLIENT_ERROR',
        message: error.error.message,
        timestamp: new Date().toISOString()
      };
    } else {
      // Server-side error
      let code = 'HTTP_UNKNOWN';
      if (typeof error.status === 'number' && error.status > 0) {
        code = `HTTP_${error.status}`;
      }
      apiError = {
        code,
        message: error.error?.message || error.message || 'Server error occurred',
        details: error.error,
        timestamp: new Date().toISOString()
      };
    }

    console.error('API Error:', apiError);
    return throwError(apiError);
  }
}
