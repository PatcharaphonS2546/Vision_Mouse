import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { GazeTrackerComponent } from './components/gaze-tracker/gaze-tracker.component';
import { CalibrationComponent } from './components/calibration/calibration.component';
import { FormsModule } from '@angular/forms';
import { VideoSourceComponent } from './components/video-source/video-source.component';
import { SystemStatusComponent } from './components/system-status/system-status.component';
import { AdvancedGazeTrackerComponent } from './components/advanced-gaze-tracker/advanced-gaze-tracker.component';
import { ModernDashboardComponent } from './components/modern-dashboard/modern-dashboard.component';

// Services
import { VideoSourceService } from './services/video-source.service';
import { MediapipeService } from './services/mediapipe.service';
import { PerformanceService } from './services/performance.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { GazeEstimationService } from './services/gaze-estimation.service';
import { GazeProcessingService } from './services/gaze-processing.service';
import { CalibrationService } from './services/calibration.service';
import { FaceTrackerService } from './services/face-tracker.service';
import { HeadPoseService } from './services/head-pose.service';
import { SystemIntegrationService } from './services/system-integration.service';
import { OptimizationManagerService } from './services/optimization-manager.service';
import { RealTimeAnalyticsService } from './services/real-time-analytics.service';

// AI/ML Services  
import { SmartCalibrationService } from './services/ai-ml/smart-calibration.service';
import { NeuralNetworkService } from './services/ai-ml/neural-network.service';
import { PredictiveAnalyticsService } from './services/ai-ml/predictive-analytics.service';
import { AdaptiveLearningService } from './services/ai-ml/adaptive-learning.service';
import { AIIntegrationService } from './services/ai-ml/ai-integration.service';

@NgModule({
  declarations: [
    AppComponent,
    VideoSourceComponent,
    SystemStatusComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    CalibrationComponent,
    FormsModule,
    GazeTrackerComponent,
    AdvancedGazeTrackerComponent,
    ModernDashboardComponent
  ],
  providers: [
    VideoSourceService,
    MediapipeService,
    PerformanceService,
    ErrorHandlerService,
    GazeEstimationService,
    GazeProcessingService,
    CalibrationService,
    FaceTrackerService,
    HeadPoseService,
    SystemIntegrationService,
    OptimizationManagerService,
    RealTimeAnalyticsService,
    SmartCalibrationService,
    NeuralNetworkService,
    PredictiveAnalyticsService,
    AdaptiveLearningService,
    AIIntegrationService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
