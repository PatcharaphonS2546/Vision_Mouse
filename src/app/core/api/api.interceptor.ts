/**
 * API HTTP Interceptor
 * Handles authentication, error handling, and request/response transformation
 */

import { Injectable } from '@angular/core';
import { 
  HttpInterceptor, 
  HttpRequest, 
  HttpHandler, 
  HttpEvent,
  HttpErrorResponse,
  HttpResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, finalize } from 'rxjs/operators';

@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  
  constructor() {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    
    // Clone the request and add headers
    let apiReq = req.clone({
      setHeaders: {
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    // Add authentication token if available
    const authToken = this.getAuthToken();
    if (authToken) {
      apiReq = apiReq.clone({
        setHeaders: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    }

    // Add request ID for tracking
    const requestId = this.generateRequestId();
    apiReq = apiReq.clone({
      setHeaders: {
        'X-Request-ID': requestId
      }
    });

    // Log request (development only)
    if (!this.isProduction()) {
      console.log(`🚀 API Request [${requestId}]:`, {
        method: apiReq.method,
        url: apiReq.url,
        headers: apiReq.headers.keys(),
        body: apiReq.body
      });
    }

    const startTime = Date.now();

    return next.handle(apiReq).pipe(
      // Log successful responses
      tap(event => {
        if (event instanceof HttpResponse) {
          const duration = Date.now() - startTime;
          if (!this.isProduction()) {
            console.log(`✅ API Response [${requestId}] (${duration}ms):`, {
              status: event.status,
              statusText: event.statusText,
              body: event.body
            });
          }
        }
      }),
      
      // Handle errors
      catchError((error: HttpErrorResponse) => {
        const duration = Date.now() - startTime;
        
        if (!this.isProduction()) {
          console.error(`❌ API Error [${requestId}] (${duration}ms):`, {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            url: error.url,
            error: error.error
          });
        }

        return this.handleError(error, requestId);
      }),

      // Finalize request
      finalize(() => {
        const duration = Date.now() - startTime;
        if (!this.isProduction()) {
          console.log(`🏁 Request completed [${requestId}] in ${duration}ms`);
        }
      })
    );
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse, requestId: string): Observable<never> {
    let userMessage = 'An unexpected error occurred';
    
    switch (error.status) {
      case 0:
        userMessage = 'Unable to connect to server. Please check your internet connection.';
        break;
      case 400:
        userMessage = error.error?.message || 'Invalid request. Please check your input.';
        break;
      case 401:
        userMessage = 'You are not authorized. Please log in again.';
        this.handleUnauthorized();
        break;
      case 403:
        userMessage = 'You do not have permission to perform this action.';
        break;
      case 404:
        userMessage = 'The requested resource was not found.';
        break;
      case 422:
        userMessage = 'Validation error. Please check your input.';
        break;
      case 429:
        userMessage = 'Too many requests. Please try again later.';
        break;
      case 500:
        userMessage = 'Server error. Please try again later.';
        break;
      case 502:
      case 503:
      case 504:
        userMessage = 'Service temporarily unavailable. Please try again later.';
        break;
      default:
        userMessage = error.error?.message || `HTTP Error ${error.status}: ${error.statusText}`;
    }

    // Create enhanced error object
    const enhancedError = {
      ...error,
      userMessage,
      requestId,
      timestamp: new Date().toISOString()
    };

    return throwError(enhancedError);
  }

  /**
   * Handle unauthorized responses
   */
  private handleUnauthorized(): void {
    // Clear auth token
    this.clearAuthToken();
    
    // Redirect to login or refresh token
    // This would typically involve routing to login page
    console.warn('Unauthorized access detected. User should be redirected to login.');
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string | null {
    // In a real application, this would get the token from:
    // - localStorage
    // - sessionStorage
    // - AuthService
    // - HTTP-only cookies
    return localStorage.getItem('auth_token');
  }

  /**
   * Clear authentication token
   */
  private clearAuthToken(): void {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if running in production
   */
  private isProduction(): boolean {
    // In Angular, you can inject environment or check NODE_ENV
    return false; // Set to true in production
  }
}
