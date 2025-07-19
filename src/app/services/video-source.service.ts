import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export interface CameraCapabilities {
  width: number;
  height: number;
  frameRate: number;
  facingMode?: string;
}

export interface CameraQuality {
  isGood: boolean;
  resolution: string;
  frameRate: number;
  lighting: 'good' | 'poor' | 'adequate';
  stability: number; // 0-1
}

@Injectable({
  providedIn: 'root'
})
export class VideoSourceService {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private currentDevice: CameraDevice | null = null;
  private isStreamActive = false;
  
  // Observables for state management
  private streamStatus$ = new BehaviorSubject<boolean>(false);
  private cameraQuality$ = new BehaviorSubject<CameraQuality | null>(null);
  private availableDevices$ = new BehaviorSubject<CameraDevice[]>([]);
  
  // Supported resolutions
  private supportedResolutions: CameraCapabilities[] = [
    { width: 1920, height: 1080, frameRate: 30 }, // 1080p
    { width: 1280, height: 720, frameRate: 30 },  // 720p
    { width: 640, height: 480, frameRate: 30 },   // 480p
  ];

  constructor() {
    this.initializeDeviceDetection();
  }

  // Initialize camera device detection
  private async initializeDeviceDetection(): Promise<void> {
    try {
      await this.requestPermissions();
      await this.detectAvailableDevices();
    } catch (error) {
      console.error('Failed to initialize camera detection:', error);
    }
  }

  // Request camera permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      
      // Stop the temporary stream
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Camera permission denied:', error);
      return false;
    }
  }

  // Detect available camera devices
  async detectAvailableDevices(): Promise<CameraDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.substring(0, 8)}`,
          kind: device.kind
        }));
      
      this.availableDevices$.next(videoDevices);
      return videoDevices;
    } catch (error) {
      console.error('Failed to detect devices:', error);
      return [];
    }
  }

  // Start camera with optimal settings
  async startCamera(
    videoElement: HTMLVideoElement, 
    deviceId?: string,
    preferredResolution?: CameraCapabilities
  ): Promise<boolean> {
    try {
      // Stop existing stream if any
      await this.stopCamera();

      // Determine best resolution
      const resolution = preferredResolution || this.supportedResolutions[0];
      
      // Configure constraints
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: resolution.width },
          height: { ideal: resolution.height },
          frameRate: { ideal: resolution.frameRate },
          facingMode: 'user' // Front camera preferred
        },
        audio: false
      };

      // Get media stream
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set up video element
      this.videoElement = videoElement;
      videoElement.srcObject = this.stream;
      
      return new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          this.isStreamActive = true;
          this.streamStatus$.next(true);
          
          // Start quality monitoring
          this.startQualityMonitoring();
          
          resolve(true);
        };
      });
      
    } catch (error) {
      console.error('Failed to start camera:', error);
      this.streamStatus$.next(false);
      return false;
    }
  }

  // Stop camera stream
  async stopCamera(): Promise<void> {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    
    this.isStreamActive = false;
    this.streamStatus$.next(false);
    this.cameraQuality$.next(null);
  }

  // Switch to different camera
  async switchCamera(deviceId: string): Promise<boolean> {
    if (!this.videoElement) return false;
    
    const devices = await this.detectAvailableDevices();
    const device = devices.find(d => d.deviceId === deviceId);
    
    if (!device) return false;
    
    this.currentDevice = device;
    return await this.startCamera(this.videoElement, deviceId);
  }

  // Start quality monitoring
  private startQualityMonitoring(): void {
    if (!this.videoElement || !this.stream) return;

    const checkQuality = () => {
      if (!this.isStreamActive) return;

      const videoTrack = this.stream!.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      const quality: CameraQuality = {
        isGood: this.assessOverallQuality(settings),
        resolution: `${settings.width}x${settings.height}`,
        frameRate: settings.frameRate || 30,
        lighting: this.assessLighting(),
        stability: this.assessStability()
      };
      
      this.cameraQuality$.next(quality);
      
      // Continue monitoring
      setTimeout(checkQuality, 2000); // Check every 2 seconds
    };
    
    checkQuality();
  }

  // Assess overall camera quality
  private assessOverallQuality(settings: MediaTrackSettings): boolean {
    const width = settings.width || 640;
    const height = settings.height || 480;
    const frameRate = settings.frameRate || 30;
    
    return width >= 720 && height >= 480 && frameRate >= 25;
  }

  // Assess lighting conditions (simplified)
  private assessLighting(): 'good' | 'poor' | 'adequate' {
    // This would need actual image analysis
    // For now, return a placeholder
    return 'adequate';
  }

  // Assess camera stability (simplified)
  private assessStability(): number {
    // This would need motion analysis
    // For now, return a placeholder
    return 0.8;
  }

  // Get current camera capabilities
  getCurrentCapabilities(): MediaTrackCapabilities | null {
    if (!this.stream) return null;
    
    const videoTrack = this.stream.getVideoTracks()[0];
    return videoTrack.getCapabilities();
  }

  // Get current camera settings
  getCurrentSettings(): MediaTrackSettings | null {
    if (!this.stream) return null;
    
    const videoTrack = this.stream.getVideoTracks()[0];
    return videoTrack.getSettings();
  }

  // Observable getters
  get streamStatus(): Observable<boolean> {
    return this.streamStatus$.asObservable();
  }

  get cameraQuality(): Observable<CameraQuality | null> {
    return this.cameraQuality$.asObservable();
  }

  get availableDevices(): Observable<CameraDevice[]> {
    return this.availableDevices$.asObservable();
  }

  // Getters
  get isActive(): boolean {
    return this.isStreamActive;
  }

  get currentVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  get currentStream(): MediaStream | null {
    return this.stream;
  }

  // Get video stream (alias for currentStream for compatibility)
  getVideoStream(): MediaStream | null {
    return this.stream;
  }
}
