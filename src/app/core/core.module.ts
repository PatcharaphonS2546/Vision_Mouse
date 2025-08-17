/**
 * Core Module
 * Provides all core services and utilities
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// Services
import { StateService } from './state/state.service';
import { CameraService } from './services/camera.service';
import { FaceDetectionService } from './services/face-detection.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { NotificationService } from './services/notification.service';
import { EnhancedCalibrationService } from './services/enhanced-calibration.service';
import { EnhancedGazeEstimationService } from './services/enhanced-gaze-estimation.service';

// Interfaces
export * from './interfaces/core.interface';
export * from './interfaces/service.interface';

// Services
export { StateService } from './state/state.service';
export { CameraService } from './services/camera.service';
export { FaceDetectionService } from './services/face-detection.service';
export { ErrorHandlerService } from './services/error-handler.service';
export { NotificationService } from './services/notification.service';
export { EnhancedCalibrationService } from './services/enhanced-calibration.service';
export { EnhancedGazeEstimationService } from './services/enhanced-gaze-estimation.service';

@NgModule({
  imports: [CommonModule],
  providers: [
    StateService,
    CameraService,
    FaceDetectionService,
    ErrorHandlerService,
    NotificationService,
    EnhancedCalibrationService,
    EnhancedGazeEstimationService
  ]
})
export class CoreModule {
  constructor() {
    // Setup global error handling
    ErrorHandlerService.setupGlobalErrorHandler();
  }
}
