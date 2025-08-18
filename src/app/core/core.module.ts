/**
 * Core Module - UI Only with API Integration
 * Provides essential UI services and API communication
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

// Essential UI Services
import { StateService } from './state/state.service';
import { CameraService } from './services/camera.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { NotificationService } from './services/notification.service';

// API Services
import { BaseApiService } from './api/base-api.service';
import { CalibrationApiService } from './api/calibration-api.service';
import { TrackingApiService } from './api/tracking-api.service';
import { AnalyticsApiService } from './api/analytics-api.service';
import { WebSocketService } from './api/websocket.service';

// HTTP Interceptor
import { ApiInterceptor } from './api/api.interceptor';

// Interfaces
export * from './interfaces/core.interface';
export * from './interfaces/service.interface';

// Essential Services
export { StateService } from './state/state.service';
export { CameraService } from './services/camera.service';
export { ErrorHandlerService } from './services/error-handler.service';
export { NotificationService } from './services/notification.service';

// API Services
export { BaseApiService } from './api/base-api.service';
export { CalibrationApiService } from './api/calibration-api.service';
export { TrackingApiService } from './api/tracking-api.service';
export { AnalyticsApiService } from './api/analytics-api.service';
export { WebSocketService } from './api/websocket.service';

// API Configuration
export { API_CONFIG } from './api/api.config';
export type { CalibrationData, TrackingData, EyeData, AnalyticsData } from './api/api.config';

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule
  ],
  providers: [
    // Core UI Services
    StateService,
    CameraService,
    ErrorHandlerService,
    NotificationService,
    
    // API Services
    BaseApiService,
    CalibrationApiService,
    TrackingApiService,
    AnalyticsApiService,
    WebSocketService,
    
    // HTTP Interceptor
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiInterceptor,
      multi: true
    }
  ]
})
export class CoreModule {
  constructor() {
    // Setup global error handling
    ErrorHandlerService.setupGlobalErrorHandler();
  }
}
