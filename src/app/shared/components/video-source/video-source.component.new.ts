import { Component, ElementRef, OnDestroy, OnInit, ViewChild, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

// UI-only interface
interface CameraQuality {
  resolution: string;
  fps: number;
  bitrate: number;
  lighting?: string;
}

@Component({
  selector: 'app-video-source',
  standalone: false,
  templateUrl: './video-source.component.html',
  styleUrl: './video-source.component.css'
})
export class VideoSourceComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('esp32Image') esp32ImageElement!: ElementRef<HTMLImageElement>;

  // Events
  @Output() videoReady = new EventEmitter<HTMLVideoElement>();
  @Output() streamStatus = new EventEmitter<boolean>();
  @Output() qualityUpdate = new EventEmitter<CameraQuality>();

  // State
  isLoading = false;
  hasPermission = false;
  cameraDevices: MediaDeviceInfo[] = [];
  selectedDeviceId = '';
  isStreaming = false;
  streamError = '';
  localStream: MediaStream | null = null;
  currentQuality: CameraQuality = {
    resolution: '640x480',
    fps: 30,
    bitrate: 1000,
    lighting: 'good'
  };

  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.checkPermissions();
    this.detectDevices();
    this.startQualityMonitoring();
  }

  ngOnDestroy() {
    this.stopCamera();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async checkPermissions() {
    try {
      // Mock permission check
      setTimeout(() => {
        this.hasPermission = true;
        this.detectDevices();
      }, 500);
    } catch (error) {
      console.error('Permission check failed:', error);
    }
  }

  private async detectDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameraDevices = devices.filter(device => device.kind === 'videoinput');
      if (this.cameraDevices.length > 0) {
        this.selectedDeviceId = this.cameraDevices[0].deviceId;
      }
    } catch (error) {
      console.error('Device detection failed:', error);
    }
  }

  private startQualityMonitoring() {
    // Mock quality monitoring
    setInterval(() => {
      if (this.isStreaming) {
        this.currentQuality = {
          resolution: '640x480',
          fps: 28 + Math.random() * 4,
          bitrate: 900 + Math.random() * 200,
          lighting: Math.random() > 0.8 ? 'poor' : Math.random() > 0.3 ? 'good' : 'adequate'
        };
        this.qualityUpdate.emit(this.currentQuality);
        this.updateQualityFeedback();
      }
    }, 2000);
  }

  private updateQualityFeedback() {
    if (this.currentQuality.lighting === 'poor') {
      this.streamError = 'Poor lighting detected. Please improve lighting conditions.';
    } else if (this.currentQuality.lighting === 'adequate') {
      this.streamError = 'Lighting could be improved for better tracking accuracy.';
    } else {
      this.streamError = '';
    }
  }

  async startLocalCamera(): Promise<boolean> {
    try {
      this.isLoading = true;
      this.streamError = '';

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      });

      if (this.localVideoElement?.nativeElement) {
        this.localVideoElement.nativeElement.srcObject = stream;
        this.localStream = stream;
        this.isStreaming = true;
        this.videoReady.emit(this.localVideoElement.nativeElement);
        this.streamStatus.emit(true);
      }

      return true;
    } catch (error) {
      console.error('Failed to start camera:', error);
      this.streamError = 'Failed to access camera. Please check permissions.';
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  stopCamera() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
      this.isStreaming = false;
      this.streamStatus.emit(false);
    }

    if (this.localVideoElement?.nativeElement) {
      this.localVideoElement.nativeElement.srcObject = null;
    }
  }

  switchCamera(deviceId: string) {
    this.selectedDeviceId = deviceId;
    if (this.isStreaming) {
      this.stopCamera();
      setTimeout(() => {
        this.startLocalCamera();
      }, 100);
    }
  }

  async startESP32Stream(ip: string): Promise<boolean> {
    try {
      this.isLoading = true;
      this.streamError = '';

      // Mock ESP32 connection
      if (this.esp32ImageElement?.nativeElement) {
        this.esp32ImageElement.nativeElement.src = `http://${ip}/stream`;
        this.isStreaming = true;
        this.streamStatus.emit(true);
      }

      return true;
    } catch (error) {
      console.error('Failed to connect to ESP32:', error);
      this.streamError = 'Failed to connect to ESP32 camera.';
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  getQualityIndicator(): string {
    if (!this.currentQuality || !this.isStreaming) return 'offline';
    
    const fps = this.currentQuality.fps;
    const lighting = this.currentQuality.lighting;
    
    if (fps < 20 || lighting === 'poor') return 'poor';
    if (fps < 25 || lighting === 'adequate') return 'fair';
    return 'good';
  }

  getStatusMessage(): string {
    if (!this.hasPermission) return 'Camera permission required';
    if (this.isLoading) return 'Initializing camera...';
    if (this.streamError) return this.streamError;
    if (!this.isStreaming) return 'Camera stopped';
    return `Streaming at ${this.currentQuality.fps.toFixed(0)} FPS`;
  }
}
