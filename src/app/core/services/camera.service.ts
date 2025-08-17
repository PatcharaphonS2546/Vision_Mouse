/**
 * Camera Service - Refactored
 * Handles all camera operations with proper error handling and state management
 */

import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, fromEvent, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { ICameraService } from '../interfaces/service.interface';
import { CameraState, Dimensions } from '../interfaces/core.interface';
import { StateService } from '../state/state.service';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class CameraService implements ICameraService {
  
  private stream: MediaStream | null = null;
  private activeDeviceId: string | null = null;
  private availableDevices: MediaDeviceInfo[] = [];
  
  private readonly state$ = new BehaviorSubject<CameraState>({
    isInitialized: false,
    isStreaming: false,
    hasPermission: false,
    constraints: {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: 'user'
      }
    }
  });

  constructor(
    private stateService: StateService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService
  ) {
    this.initializeDeviceChangeListener();
  }

  // State management
  getState(): Observable<CameraState> {
    return this.state$.asObservable();
  }

  getCurrentState(): CameraState {
    return this.state$.value;
  }

  // Initialization
  async initialize(): Promise<void> {
    try {
      this.updateState({ isInitialized: false });
      this.notifications.showInfo('กำลังเริ่มต้นระบบกล้อง...');

      // Check for camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์ไม่รองรับการเข้าถึงกล้อง');
      }

      // Check permissions
      const permissionStatus = await this.checkPermissions();
      if (permissionStatus === 'denied') {
        throw new Error('ไม่ได้รับอนุญาตให้เข้าถึงกล้อง');
      }

      // Enumerate devices
      await this.enumerateDevices();

      this.updateState({ 
        isInitialized: true,
        hasPermission: permissionStatus === 'granted'
      });

      this.notifications.showSuccess('ระบบกล้องพร้อมใช้งาน');
      
    } catch (error) {
      this.handleError(error as Error, 'Camera initialization failed');
      throw error;
    }
  }

  // Stream management
  async startStream(): Promise<MediaStream> {
    try {
      if (this.stream) {
        return this.stream;
      }

      this.notifications.showInfo('กำลังเริ่มสตรีมกล้อง...');

      const constraints = this.getCurrentConstraints();
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Update device info
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        this.activeDeviceId = videoTrack.getSettings().deviceId || null;
      }

      this.updateState({ 
        isStreaming: true,
        hasPermission: true,
        stream: this.stream
      });

      this.stateService.updateSystemStatus('running');
      this.notifications.showSuccess('กล้องเริ่มทำงานแล้ว');

      return this.stream;

    } catch (error) {
      this.handleError(error as Error, 'Failed to start camera stream');
      throw error;
    }
  }

  async stopStream(): Promise<void> {
    try {
      if (this.stream) {
        this.stream.getTracks().forEach(track => {
          track.stop();
        });
        this.stream = null;
        this.activeDeviceId = null;
      }

      this.updateState({ 
        isStreaming: false,
        stream: undefined
      });

      this.notifications.showInfo('กล้องหยุดทำงานแล้ว');

    } catch (error) {
      this.handleError(error as Error, 'Failed to stop camera stream');
    }
  }

  async cleanup(): Promise<void> {
    await this.stopStream();
    this.updateState({
      isInitialized: false,
      hasPermission: false
    });
  }

  // Device management
  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    try {
      await this.enumerateDevices();
      return this.availableDevices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      this.handleError(error as Error, 'Failed to get available devices');
      return [];
    }
  }

  async switchDevice(deviceId: string): Promise<void> {
    try {
      if (this.activeDeviceId === deviceId) {
        return;
      }

      const wasStreaming = this.state$.value.isStreaming;
      
      if (wasStreaming) {
        await this.stopStream();
      }

      // Update constraints with new device
      const currentState = this.state$.value;
      const videoConstraints = currentState.constraints.video as any;
      const newConstraints = {
        ...currentState.constraints,
        video: {
          ...videoConstraints,
          deviceId: { exact: deviceId }
        }
      };

      this.updateState({ constraints: newConstraints });

      if (wasStreaming) {
        await this.startStream();
      }

      this.notifications.showSuccess('เปลี่ยนกล้องสำเร็จ');

    } catch (error) {
      this.handleError(error as Error, 'Failed to switch camera device');
      throw error;
    }
  }

  // Configuration
  async updateConstraints(constraints: MediaStreamConstraints): Promise<void> {
    try {
      const wasStreaming = this.state$.value.isStreaming;
      
      if (wasStreaming) {
        await this.stopStream();
      }

      this.updateState({ constraints });

      if (wasStreaming) {
        await this.startStream();
      }

    } catch (error) {
      this.handleError(error as Error, 'Failed to update camera constraints');
      throw error;
    }
  }

  // Status checks
  isReady(): boolean {
    const state = this.state$.value;
    return state.isInitialized && state.hasPermission;
  }

  hasPermission(): boolean {
    return this.state$.value.hasPermission;
  }

  // Helper methods
  private async checkPermissions(): Promise<PermissionState> {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        return permission.state;
      }
      return 'prompt';
    } catch (error) {
      return 'prompt';
    }
  }

  private async enumerateDevices(): Promise<void> {
    try {
      this.availableDevices = await navigator.mediaDevices.enumerateDevices();
    } catch (error) {
      this.availableDevices = [];
      throw error;
    }
  }

  private getCurrentConstraints(): MediaStreamConstraints {
    const state = this.state$.value;
    return state.constraints;
  }

  private updateState(updates: Partial<CameraState>): void {
    const currentState = this.state$.value;
    const newState = { ...currentState, ...updates };
    this.state$.next(newState);
    this.stateService.updateCameraState(newState);
  }

  private handleError(error: Error, context: string): void {
    this.updateState({ error: error.message });
    this.errorHandler.handleError(error, context);
    this.notifications.showError(`ข้อผิดพลาดกล้อง: ${error.message}`);
  }

  private initializeDeviceChangeListener(): void {
    if (navigator.mediaDevices) {
      fromEvent(navigator.mediaDevices, 'devicechange')
        .pipe(debounceTime(1000))
        .subscribe(() => {
          this.enumerateDevices().catch(error => {
            this.handleError(error, 'Device enumeration after device change');
          });
        });
    }
  }

  // Utility methods for common camera operations
  async getOptimalResolution(): Promise<Dimensions> {
    try {
      const devices = await this.getAvailableDevices();
      if (devices.length === 0) {
        return { width: 640, height: 480 };
      }

      // Try to get capabilities
      const videoTrack = this.stream?.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities();
        if (capabilities.width && capabilities.height) {
          return {
            width: capabilities.width.max || 1280,
            height: capabilities.height.max || 720
          };
        }
      }

      return { width: 1280, height: 720 };
    } catch (error) {
      return { width: 640, height: 480 };
    }
  }

  async setResolution(resolution: Dimensions): Promise<void> {
    const currentConstraints = this.getCurrentConstraints();
    const videoConstraints = currentConstraints.video as any;
    const newConstraints = {
      ...currentConstraints,
      video: {
        ...videoConstraints,
        width: { ideal: resolution.width },
        height: { ideal: resolution.height }
      }
    };
    
    await this.updateConstraints(newConstraints);
  }

  async setFrameRate(frameRate: number): Promise<void> {
    const currentConstraints = this.getCurrentConstraints();
    const videoConstraints = currentConstraints.video as any;
    const newConstraints = {
      ...currentConstraints,
      video: {
        ...videoConstraints,
        frameRate: { ideal: frameRate }
      }
    };
    
    await this.updateConstraints(newConstraints);
  }

  getVideoElement(): HTMLVideoElement | null {
    if (!this.stream) return null;
    
    const video = document.createElement('video');
    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    
    return video;
  }
}
