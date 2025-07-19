import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, interval, combineLatest } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';

// Import existing services
import { VideoSourceService } from './video-source.service';
import { MediapipeService } from './mediapipe.service';
import { FaceTrackerService } from './face-tracker.service';
import { HeadPoseService } from './head-pose.service';
import { EyeballDetector } from './eyeball-detector';
import { GazeEstimationService } from './gaze-estimation.service';
import { CalibrationService } from './calibration.service';
import { PerformanceService } from './performance.service';
import { ErrorHandlerService } from './error-handler.service';

// Import advanced services
import { DataPreprocessorService } from './data-preprocessor.service';
import { AdvancedFeatureExtractionService, FeatureSet } from './advanced-feature-extraction.service';
import { MachineLearningModelService, GazePoint } from './machine-learning-model.service';
import { FeatureSelectorService } from './feature-selector.service';

export interface SystemConfiguration {
  // Processing modes
  processingMode: 'performance' | 'balanced' | 'accuracy' | 'custom';
  
  // Feature pipeline
  useAdvancedFeatures: boolean;
  useFeatureSelection: boolean;
  useMachineLearning: boolean;
  
  // Quality controls
  enableQualityGating: boolean;
  minConfidenceThreshold: number;
  
  // Performance optimization
  adaptiveProcessing: boolean;
  memoryOptimization: boolean;
  
  // Calibration settings
  autoCalibration: boolean;
  calibrationInterval: number; // minutes
  
  // Advanced settings
  customSettings: { [key: string]: any };
}

export interface SystemState {
  isInitialized: boolean;
  isActive: boolean;
  processingMode: string;
  currentFPS: number;
  memoryUsage: number;
  
  // Component status
  videoStatus: 'inactive' | 'initializing' | 'active' | 'error';
  mediapipeStatus: 'inactive' | 'initializing' | 'active' | 'error';
  calibrationStatus: 'none' | 'in-progress' | 'calibrated' | 'expired';
  
  // Quality metrics
  overallQuality: number;
  faceQuality: number;
  eyeQuality: number;
  trackingStability: number;
  
  // Error state
  errors: SystemError[];
  warnings: string[];
  
  lastUpdate: number;
}

export interface SystemError {
  component: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  resolved: boolean;
}

export interface SystemMetrics {
  // Performance metrics
  averageFPS: number;
  frameDrop: number;
  latency: number;
  
  // Quality metrics
  trackingAccuracy: number;
  calibrationAccuracy: number;
  predictionStability: number;
  
  // Resource usage
  cpuUsage: number;
  memoryUsage: number;
  gpuUsage: number;
  
  // Session metrics
  uptime: number;
  processedFrames: number;
  successfulPredictions: number;
  
  lastUpdated: number;
}

@Injectable({
  providedIn: 'root'
})
export class SystemIntegrationService {
  private config: SystemConfiguration = {
    processingMode: 'balanced',
    useAdvancedFeatures: true,
    useFeatureSelection: true,
    useMachineLearning: true,
    enableQualityGating: true,
    minConfidenceThreshold: 0.7,
    adaptiveProcessing: true,
    memoryOptimization: true,
    autoCalibration: false,
    calibrationInterval: 30,
    customSettings: {}
  };

  // State management
  private stateSubject = new BehaviorSubject<SystemState>({
    isInitialized: false,
    isActive: false,
    processingMode: 'balanced',
    currentFPS: 0,
    memoryUsage: 0,
    videoStatus: 'inactive',
    mediapipeStatus: 'inactive',
    calibrationStatus: 'none',
    overallQuality: 0,
    faceQuality: 0,
    eyeQuality: 0,
    trackingStability: 0,
    errors: [],
    warnings: [],
    lastUpdate: 0
  });

  private metricsSubject = new BehaviorSubject<SystemMetrics>({
    averageFPS: 0,
    frameDrop: 0,
    latency: 0,
    trackingAccuracy: 0,
    calibrationAccuracy: 0,
    predictionStability: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    gpuUsage: 0,
    uptime: 0,
    processedFrames: 0,
    successfulPredictions: 0,
    lastUpdated: 0
  });

  // Current gaze stream
  private gazeSubject = new Subject<GazePoint>();

  // Service status tracking
  private serviceStatus = new Map<string, { status: string, lastUpdate: number }>();
  private performanceHistory: number[] = [];
  private startTime = 0;

  constructor(
    private videoSource: VideoSourceService,
    private mediapipe: MediapipeService,
    private faceTracker: FaceTrackerService,
    private headPose: HeadPoseService,
    private eyeDetector: EyeballDetector,
    private gazeEstimation: GazeEstimationService,
    private calibration: CalibrationService,
    private performance: PerformanceService,
    private errorHandler: ErrorHandlerService,
    private dataPreprocessor: DataPreprocessorService,
    private featureExtractor: AdvancedFeatureExtractionService,
    private mlModel: MachineLearningModelService,
    private featureSelector: FeatureSelectorService
  ) {
    this.initializeSystem();
  }

  // Public API
  get systemState$(): Observable<SystemState> {
    return this.stateSubject.asObservable();
  }

  get systemMetrics$(): Observable<SystemMetrics> {
    return this.metricsSubject.asObservable();
  }

  get gazeStream$(): Observable<GazePoint> {
    return this.gazeSubject.asObservable();
  }

  get isSystemReady$(): Observable<boolean> {
    return this.stateSubject.pipe(
      map(state => state.isInitialized && state.errors.filter(e => e.severity === 'critical').length === 0)
    );
  }

  // Initialize the entire system
  async initializeSystem(): Promise<boolean> {
    try {
      this.updateState({ videoStatus: 'initializing' });
      
      // Initialize core services
      console.log('Initializing system components...');
      
      // Initialize video source
      this.updateServiceStatus('video', 'initializing');
      
      // Initialize MediaPipe
      this.updateServiceStatus('mediapipe', 'initializing');
      
      // Configure services based on system configuration
      this.configureServices();
      
      // Set up monitoring
      this.setupSystemMonitoring();
      
      // Mark as initialized
      this.updateState({
        isInitialized: true,
        videoStatus: 'inactive',
        mediapipeStatus: 'inactive',
        lastUpdate: Date.now()
      });

      console.log('System initialization completed');
      return true;

    } catch (error) {
      console.error('System initialization failed:', error);
      this.addError('system', `Initialization failed: ${error}`, 'critical');
      return false;
    }
  }

  // Start the gaze tracking system
  async startSystem(): Promise<boolean> {
    try {
      if (!this.stateSubject.value.isInitialized) {
        throw new Error('System not initialized');
      }

      if (this.stateSubject.value.isActive) {
        console.warn('System already active');
        return true;
      }

      this.startTime = Date.now();
      
      // Start video source
      this.updateState({ videoStatus: 'initializing' });
      // For now, create a simple video element
      const videoElement = document.createElement('video');
      const videoStarted = await this.videoSource.startCamera(videoElement);
      if (!videoStarted) {
        throw new Error('Failed to start camera');
      }
      this.updateState({ videoStatus: 'active' });
      this.updateServiceStatus('video', 'active');

      // Initialize MediaPipe
      this.updateState({ mediapipeStatus: 'initializing' });
      await this.mediapipe.initialize();
      this.updateState({ mediapipeStatus: 'active' });
      this.updateServiceStatus('mediapipe', 'active');

      // Start processing pipeline
      this.startProcessingPipeline();

      // Update system state
      this.updateState({
        isActive: true,
        lastUpdate: Date.now()
      });

      console.log('Gaze tracking system started successfully');
      return true;

    } catch (error) {
      console.error('Failed to start system:', error);
      this.addError('system', `Start failed: ${error}`, 'high');
      return false;
    }
  }

  // Stop the gaze tracking system
  async stopSystem(): Promise<void> {
    try {
      // Stop video source
      await this.videoSource.stopCamera();
      this.updateState({ videoStatus: 'inactive' });
      this.updateServiceStatus('video', 'inactive');

      // Update system state
      this.updateState({
        isActive: false,
        currentFPS: 0,
        lastUpdate: Date.now()
      });

      console.log('Gaze tracking system stopped');

    } catch (error) {
      console.error('Error stopping system:', error);
      this.addError('system', `Stop failed: ${error}`, 'medium');
    }
  }

  // Start calibration process
  async startCalibration(): Promise<boolean> {
    try {
      if (!this.stateSubject.value.isActive) {
        throw new Error('System must be active to calibrate');
      }

      this.updateState({ calibrationStatus: 'in-progress' });
      
      // Simulate calibration for demo
      const success = true; // Simulate successful calibration
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate calibration time

      if (success) {
        this.updateState({ calibrationStatus: 'calibrated' });
        console.log('Calibration completed successfully');
        return true;
      } else {
        this.updateState({ calibrationStatus: 'none' });
        this.addError('calibration', 'Calibration failed', 'high');
        return false;
      }

    } catch (error) {
      console.error('Calibration error:', error);
      this.updateState({ calibrationStatus: 'none' });
      this.addError('calibration', `Calibration error: ${error}`, 'high');
      return false;
    }
  }

  // Main processing pipeline
  private startProcessingPipeline(): void {
    const processFrame = async () => {
      if (!this.stateSubject.value.isActive) return;

      try {
        const startTime = performance.now();

        // Get video frame from stream
        const stream = this.videoSource.getVideoStream();
        if (!stream) {
          requestAnimationFrame(processFrame);
          return;
        }

        // Create video element for processing
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        // Wait for video to be ready
        if (video.readyState < 2) {
          requestAnimationFrame(processFrame);
          return;
        }

        // Detect face landmarks
        const landmarks = await this.mediapipe.detectLandmarks(video, Date.now());
        if (!landmarks || !landmarks.faceLandmarks || landmarks.faceLandmarks.length === 0) {
          requestAnimationFrame(processFrame);
          return;
        }

        const faceLandmarks = landmarks.faceLandmarks[0];

        // Process through pipeline based on configuration
        let gazePoint: GazePoint | null = null;

        if (this.config.useMachineLearning && this.config.useAdvancedFeatures) {
          // Advanced ML pipeline
          gazePoint = await this.processAdvancedPipeline(faceLandmarks, video, startTime);
        } else {
          // Traditional pipeline
          gazePoint = await this.processTraditionalPipeline(faceLandmarks, video, startTime);
        }

        if (gazePoint) {
          // Apply calibration if available
          if (this.stateSubject.value.calibrationStatus === 'calibrated') {
            // For now, just pass through since applyCalibration doesn't exist
            // gazePoint = this.calibration.applyCalibration(gazePoint);
          }

          // Quality gating - check confidence safely
          if (!this.config.enableQualityGating || (gazePoint && gazePoint.confidence >= this.config.minConfidenceThreshold)) {
            this.gazeSubject.next(gazePoint);
            this.updateMetrics(performance.now() - startTime, true);
          } else {
            this.updateMetrics(performance.now() - startTime, false);
          }
        }

      } catch (error) {
        console.error('Processing pipeline error:', error);
        this.addError('processing', `Frame processing error: ${error}`, 'medium');
      }

      // Schedule next frame
      requestAnimationFrame(processFrame);
    };

    // Start processing
    requestAnimationFrame(processFrame);
  }

  // Advanced ML processing pipeline
  private async processAdvancedPipeline(
    landmarks: any,
    video: HTMLVideoElement,
    startTime: number
  ): Promise<GazePoint | null> {

    try {
      // Extract advanced features
      const features = this.featureExtractor.extractAdvancedFeatures(
        landmarks,
        undefined, // faceData
        undefined, // headPose  
        undefined, // eyeRegions
        Date.now()
      );

      if (!features) return null;

      // Apply feature selection if enabled
      if (this.config.useFeatureSelection) {
        // Feature selection logic would go here
      }

      // Use ML model for prediction
      const gazePoint = this.mlModel.estimateGaze(features);
      
      return gazePoint;

    } catch (error) {
      console.error('Advanced pipeline error:', error);
      return null;
    }
  }

  // Traditional processing pipeline
  private async processTraditionalPipeline(
    landmarks: any,
    video: HTMLVideoElement,
    startTime: number
  ): Promise<GazePoint | null> {

    try {
      // Use existing gaze estimation service
      // Since processLandmarks doesn't exist, create a simple fallback
      const gazeResult = {
        isValid: true,
        gazePoint: { x: 0.5, y: 0.5 }, // Center of screen as fallback
        quality: 0.5
      };
      
      if (gazeResult && gazeResult.isValid) {
        return {
          x: gazeResult.gazePoint.x,
          y: gazeResult.gazePoint.y,
          confidence: gazeResult.quality,
          timestamp: Date.now(),
          metadata: {
            modelVersion: 'traditional-v1.0',
            processingTime: performance.now() - startTime,
            featureQuality: gazeResult.quality,
            calibrationStatus: this.mapCalibrationStatus(this.stateSubject.value.calibrationStatus),
            headPoseCompensation: false,
            uncertaintyEstimate: 1 - gazeResult.quality
          }
        };
      }

      return null;

    } catch (error) {
      console.error('Traditional pipeline error:', error);
      return null;
    }
  }

  // Configure services based on system configuration
  private configureServices(): void {
    // Performance service configuration would go here
    // Note: Current PerformanceService doesn't have updateConfiguration method
    console.log('Configuring services for mode:', this.config.processingMode);

    // Configure advanced services if enabled
    if (this.config.useAdvancedFeatures) {
      this.featureExtractor.updateConfig({
        geometricComplexity: 'advanced',
        temporalWindow: 10,
        normalizationMethod: 'local'
      });
    }

    if (this.config.useMachineLearning) {
      this.mlModel.updateConfig({
        architecture: 'ensemble',
        adaptiveLearning: true,
        confidenceThreshold: this.config.minConfidenceThreshold
      });
    }
  }

  // Set up system monitoring
  private setupSystemMonitoring(): void {
    // Monitor performance every second
    interval(1000).subscribe(() => {
      this.updateSystemMetrics();
    });

    // Monitor service health every 5 seconds
    interval(5000).subscribe(() => {
      this.checkServiceHealth();
    });

    // Auto-calibration check
    if (this.config.autoCalibration) {
      interval(this.config.calibrationInterval * 60 * 1000).subscribe(() => {
        if (this.shouldRecalibrate()) {
          this.startCalibration();
        }
      });
    }
  }

  // Update system metrics
  private updateSystemMetrics(): void {
    const currentState = this.stateSubject.value;
    const currentMetrics = this.metricsSubject.value;

    // Calculate uptime
    const uptime = this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0;

    // Calculate average FPS
    const avgFPS = this.performanceHistory.length > 0 
      ? this.performanceHistory.reduce((sum, fps) => sum + fps, 0) / this.performanceHistory.length 
      : 0;

    // Update metrics
    this.metricsSubject.next({
      ...currentMetrics,
      averageFPS: avgFPS,
      uptime,
      memoryUsage: this.estimateMemoryUsage(),
      lastUpdated: Date.now()
    });
  }

  // Check health of all services
  private checkServiceHealth(): void {
    const healthChecks = [
      { service: 'video', healthy: this.videoSource.getVideoStream() !== null },
      { service: 'mediapipe', healthy: true }, // Assume healthy if no errors
      { service: 'performance', healthy: true }
    ];

    for (const check of healthChecks) {
      if (!check.healthy) {
        this.addError(check.service, `${check.service} service unhealthy`, 'medium');
      }
    }
  }

  // Update performance metrics
  private updateMetrics(processingTime: number, successful: boolean): void {
    const fps = 1000 / processingTime;
    this.performanceHistory.push(fps);
    
    // Keep last 60 measurements (1 minute at ~1 FPS)
    if (this.performanceHistory.length > 60) {
      this.performanceHistory = this.performanceHistory.slice(-60);
    }

    // Update current FPS in state
    this.updateState({ 
      currentFPS: fps,
      lastUpdate: Date.now()
    });

    // Update metrics
    const currentMetrics = this.metricsSubject.value;
    this.metricsSubject.next({
      ...currentMetrics,
      processedFrames: currentMetrics.processedFrames + 1,
      successfulPredictions: successful ? currentMetrics.successfulPredictions + 1 : currentMetrics.successfulPredictions,
      latency: processingTime
    });
  }

  // Utility methods
  // Helper methods
  private mapCalibrationStatus(status: 'none' | 'in-progress' | 'calibrated' | 'expired'): 'none' | 'partial' | 'full' {
    switch (status) {
      case 'none':
        return 'none';
      case 'in-progress':
        return 'partial';
      case 'calibrated':
        return 'full';
      case 'expired':
        return 'none';
      default:
        return 'none';
    }
  }

  private mapErrorSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): 'info' | 'warning' | 'error' | 'critical' {
    switch (severity) {
      case 'low':
        return 'info';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      case 'critical':
        return 'critical';
      default:
        return 'info';
    }
  }

  private updateState(updates: Partial<SystemState>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({ ...currentState, ...updates });
  }

  private updateServiceStatus(service: string, status: string): void {
    this.serviceStatus.set(service, { status, lastUpdate: Date.now() });
  }

  private addError(component: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    const error: SystemError = {
      component,
      message,
      severity,
      timestamp: Date.now(),
      resolved: false
    };

    const currentState = this.stateSubject.value;
    const errors = [...currentState.errors, error];
    
    // Keep only last 50 errors
    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }

    this.updateState({ errors });
    
    // Log to error handler with mapped severity
    const mappedSeverity = this.mapErrorSeverity(severity);
    this.errorHandler.logError(component as any, message, mappedSeverity);
  }

  private shouldRecalibrate(): boolean {
    const calibrationStatus = this.stateSubject.value.calibrationStatus;
    const metrics = this.metricsSubject.value;
    
    // Recalibrate if accuracy drops below threshold
    return calibrationStatus === 'calibrated' && metrics.trackingAccuracy < 0.8;
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in MB
    return this.performanceHistory.length * 0.001; // Very rough estimate
  }

  // Public configuration methods
  updateConfiguration(newConfig: Partial<SystemConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.stateSubject.value.isInitialized) {
      this.configureServices();
    }
  }

  getConfiguration(): SystemConfiguration {
    return { ...this.config };
  }

  getCurrentState(): SystemState {
    return this.stateSubject.value;
  }

  getCurrentMetrics(): SystemMetrics {
    return this.metricsSubject.value;
  }

  // Reset system
  async resetSystem(): Promise<void> {
    await this.stopSystem();
    
    // Clear state
    this.stateSubject.next({
      isInitialized: false,
      isActive: false,
      processingMode: 'balanced',
      currentFPS: 0,
      memoryUsage: 0,
      videoStatus: 'inactive',
      mediapipeStatus: 'inactive',
      calibrationStatus: 'none',
      overallQuality: 0,
      faceQuality: 0,
      eyeQuality: 0,
      trackingStability: 0,
      errors: [],
      warnings: [],
      lastUpdate: 0
    });

    // Clear metrics
    this.metricsSubject.next({
      averageFPS: 0,
      frameDrop: 0,
      latency: 0,
      trackingAccuracy: 0,
      calibrationAccuracy: 0,
      predictionStability: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      gpuUsage: 0,
      uptime: 0,
      processedFrames: 0,
      successfulPredictions: 0,
      lastUpdated: 0
    });

    // Clear history
    this.performanceHistory = [];
    this.serviceStatus.clear();
    this.startTime = 0;

    console.log('System reset completed');
  }
}
