/**
 * Application State Management
 * Central state store using RxJS BehaviorSubjects
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  ApplicationState,
  CameraState,
  EyeTrackingData,
  CalibrationProgress,
  CalibrationResult,
  GazeEstimationResult,
  PerformanceMetrics,
  SystemConfig,
  SystemHealth,
  SystemStatus,
  CalibrationStatus,
  QualityLevel,
  Point2D
} from '../interfaces/core.interface';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  
  // Individual state subjects
  private readonly systemStatus$ = new BehaviorSubject<SystemStatus>('initializing');
  private readonly systemHealth$ = new BehaviorSubject<SystemHealth | null>(null);
  private readonly systemConfig$ = new BehaviorSubject<SystemConfig | null>(null);
  
  private readonly cameraState$ = new BehaviorSubject<CameraState>({
    isInitialized: false,
    isStreaming: false,
    hasPermission: false,
    constraints: {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      }
    }
  });
  
  private readonly trackingActive$ = new BehaviorSubject<boolean>(false);
  private readonly currentTrackingData$ = new BehaviorSubject<EyeTrackingData | null>(null);
  
  private readonly calibrationStatus$ = new BehaviorSubject<CalibrationStatus>('not-started');
  private readonly calibrationProgress$ = new BehaviorSubject<CalibrationProgress | null>(null);
  private readonly calibrationResult$ = new BehaviorSubject<CalibrationResult | null>(null);
  
  private readonly gazeActive$ = new BehaviorSubject<boolean>(false);
  private readonly currentGazePoint$ = new BehaviorSubject<Point2D | null>(null);
  private readonly gazeConfidence$ = new BehaviorSubject<number>(0);
  private readonly gazeQuality$ = new BehaviorSubject<QualityLevel>('poor');
  
  private readonly performanceMetrics$ = new BehaviorSubject<PerformanceMetrics>({
    fps: 0,
    latency: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    frameDrops: 0,
    processingTime: {
      detection: 0,
      tracking: 0,
      calibration: 0,
      estimation: 0,
      total: 0
    },
    timestamp: Date.now()
  });

  // Computed state observables
  private readonly applicationState$: Observable<ApplicationState> = combineLatest([
    this.systemStatus$,
    this.systemHealth$,
    this.systemConfig$,
    this.cameraState$,
    this.trackingActive$,
    this.currentTrackingData$,
    this.calibrationStatus$,
    this.calibrationProgress$,
    this.calibrationResult$,
    this.gazeActive$,
    this.currentGazePoint$,
    this.gazeConfidence$,
    this.gazeQuality$,
    this.performanceMetrics$
  ]).pipe(
    map(([
      systemStatus, systemHealth, systemConfig, cameraState,
      trackingActive, currentTrackingData,
      calibrationStatus, calibrationProgress, calibrationResult,
      gazeActive, currentGazePoint, gazeConfidence, gazeQuality,
      performanceMetrics
    ]) => ({
      system: {
        status: systemStatus,
        health: systemHealth!,
        config: systemConfig!
      },
      camera: cameraState,
      tracking: {
        isActive: trackingActive,
        currentData: currentTrackingData || undefined,
        lastUpdate: currentTrackingData?.timestamp || 0
      },
      calibration: {
        status: calibrationStatus,
        progress: calibrationProgress || undefined,
        result: calibrationResult || undefined
      },
      gaze: {
        isActive: gazeActive,
        currentPoint: currentGazePoint || undefined,
        confidence: gazeConfidence,
        quality: gazeQuality
      },
      performance: performanceMetrics
    }))
  );

  // Public getters for individual state pieces
  get systemStatus(): Observable<SystemStatus> {
    return this.systemStatus$.asObservable();
  }

  get systemHealth(): Observable<SystemHealth | null> {
    return this.systemHealth$.asObservable();
  }

  get systemConfig(): Observable<SystemConfig | null> {
    return this.systemConfig$.asObservable();
  }

  get cameraState(): Observable<CameraState> {
    return this.cameraState$.asObservable();
  }

  get trackingActive(): Observable<boolean> {
    return this.trackingActive$.asObservable();
  }

  get currentTrackingData(): Observable<EyeTrackingData | null> {
    return this.currentTrackingData$.asObservable();
  }

  get calibrationStatus(): Observable<CalibrationStatus> {
    return this.calibrationStatus$.asObservable();
  }

  get calibrationProgress(): Observable<CalibrationProgress | null> {
    return this.calibrationProgress$.asObservable();
  }

  get calibrationResult(): Observable<CalibrationResult | null> {
    return this.calibrationResult$.asObservable();
  }

  get gazeActive(): Observable<boolean> {
    return this.gazeActive$.asObservable();
  }

  get currentGazePoint(): Observable<Point2D | null> {
    return this.currentGazePoint$.asObservable();
  }

  get gazeConfidence(): Observable<number> {
    return this.gazeConfidence$.asObservable();
  }

  get gazeQuality(): Observable<QualityLevel> {
    return this.gazeQuality$.asObservable();
  }

  get performanceMetrics(): Observable<PerformanceMetrics> {
    return this.performanceMetrics$.asObservable();
  }

  get applicationState(): Observable<ApplicationState> {
    return this.applicationState$;
  }

  // State update methods
  updateSystemStatus(status: SystemStatus): void {
    this.systemStatus$.next(status);
  }

  updateSystemHealth(health: SystemHealth): void {
    this.systemHealth$.next(health);
  }

  updateSystemConfig(config: SystemConfig): void {
    this.systemConfig$.next(config);
  }

  updateCameraState(state: Partial<CameraState>): void {
    const currentState = this.cameraState$.value;
    this.cameraState$.next({ ...currentState, ...state });
  }

  updateTrackingActive(active: boolean): void {
    this.trackingActive$.next(active);
  }

  updateTrackingData(data: EyeTrackingData): void {
    this.currentTrackingData$.next(data);
  }

  updateCalibrationStatus(status: CalibrationStatus): void {
    this.calibrationStatus$.next(status);
  }

  updateCalibrationProgress(progress: CalibrationProgress): void {
    this.calibrationProgress$.next(progress);
  }

  updateCalibrationResult(result: CalibrationResult): void {
    this.calibrationResult$.next(result);
  }

  updateGazeActive(active: boolean): void {
    this.gazeActive$.next(active);
  }

  updateGazeData(result: GazeEstimationResult): void {
    this.currentGazePoint$.next(result.gazePoint);
    this.gazeConfidence$.next(result.confidence);
    this.gazeQuality$.next(result.quality);
  }

  updateGazeResult(result: GazeEstimationResult): void {
    this.updateGazeData(result);
  }

  getApplicationState(): Observable<ApplicationState> {
    return this.applicationState$;
  }

  updatePerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceMetrics$.next(metrics);
  }

  // Current value getters
  getCurrentSystemStatus(): SystemStatus {
    return this.systemStatus$.value;
  }

  getCurrentCameraState(): CameraState {
    return this.cameraState$.value;
  }

  getCurrentTrackingData(): EyeTrackingData | null {
    return this.currentTrackingData$.value;
  }

  getCurrentCalibrationStatus(): CalibrationStatus {
    return this.calibrationStatus$.value;
  }

  getCurrentGazePoint(): Point2D | null {
    return this.currentGazePoint$.value;
  }

  getCurrentPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMetrics$.value;
  }

  // Computed state getters
  isSystemReady(): Observable<boolean> {
    return this.systemStatus.pipe(
      map(status => status === 'ready' || status === 'running')
    );
  }

  isCameraReady(): Observable<boolean> {
    return this.cameraState.pipe(
      map(state => state.isInitialized && state.hasPermission)
    );
  }

  isTrackingReady(): Observable<boolean> {
    return combineLatest([this.isCameraReady(), this.trackingActive]).pipe(
      map(([cameraReady, trackingActive]) => cameraReady && trackingActive)
    );
  }

  isCalibrated(): Observable<boolean> {
    return this.calibrationStatus.pipe(
      map(status => status === 'completed')
    );
  }

  canStartGazeTracking(): Observable<boolean> {
    return combineLatest([this.isTrackingReady(), this.isCalibrated()]).pipe(
      map(([trackingReady, calibrated]) => trackingReady && calibrated)
    );
  }

  // Reset methods
  resetCalibration(): void {
    this.calibrationStatus$.next('not-started');
    this.calibrationProgress$.next(null);
    this.calibrationResult$.next(null);
  }

  resetTracking(): void {
    this.trackingActive$.next(false);
    this.currentTrackingData$.next(null);
  }

  resetGaze(): void {
    this.gazeActive$.next(false);
    this.currentGazePoint$.next(null);
    this.gazeConfidence$.next(0);
    this.gazeQuality$.next('poor');
  }

  resetAll(): void {
    this.resetCalibration();
    this.resetTracking();
    this.resetGaze();
    this.updateSystemStatus('initializing');
  }
}
