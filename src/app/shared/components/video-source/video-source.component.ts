import { Component, ElementRef, OnDestroy, OnInit, ViewChild, Output, EventEmitter } from '@angular/core';
import { VideoSourceService, CameraQuality } from '../../services/video-source.service';
import { Subject, takeUntil } from 'rxjs';

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
  selectedSource: 'local' | 'esp32' = 'local';
  esp32Url: string = 'http://192.168.78.193:81/stream';
  isStreaming: boolean = false;
  statusMessage: string = 'Ready';
  mjpegStreamUrl: string | null = null;
  
  // Camera settings for low light
  cameraSettings = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    exposure: 0,
    autoExposure: true,
    noiseReduction: true
  };

  private destroy$ = new Subject<void>();
  private localStream: MediaStream | null = null;
  private qualityMonitorInterval: any;

  constructor(private videoSourceService: VideoSourceService) { }

  ngOnInit(): void {
    this.initializeVideoSource();
    this.subscribeToQualityUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopStream();
    if (this.qualityMonitorInterval) {
      clearInterval(this.qualityMonitorInterval);
    }
  }

  private initializeVideoSource(): void {
    // Request camera permissions on component load
    this.videoSourceService.requestPermissions()
      .then(granted => {
        if (granted) {
          this.statusMessage = 'Camera permission granted';
          this.videoSourceService.detectAvailableDevices();
        } else {
          this.statusMessage = 'Camera permission denied';
        }
      });
  }

  private subscribeToQualityUpdates(): void {
    // Monitor stream quality
    this.videoSourceService.streamStatus
      .pipe(takeUntil(this.destroy$))
      .subscribe((status: boolean) => {
        this.isStreaming = status;
        this.streamStatus.emit(status);
      });

    this.videoSourceService.cameraQuality
      .pipe(takeUntil(this.destroy$))
      .subscribe((quality: CameraQuality | null) => {
        if (quality) {
          this.qualityUpdate.emit(quality);
          this.adjustForLowLight(quality);
        }
      });
  }

  private adjustForLowLight(quality: CameraQuality): void {
    // Adjust camera settings based on lighting conditions
    if (quality.lighting === 'poor') {
      this.statusMessage = 'Poor lighting detected - adjusting settings';
      this.optimizeForLowLight();
    } else if (quality.lighting === 'adequate') {
      this.statusMessage = 'Adequate lighting - applying mild adjustments';
      this.applyMildAdjustments();
    } else {
      this.statusMessage = 'Good lighting conditions';
    }
  }

  private async optimizeForLowLight(): Promise<void> {
    const videoElement = this.localVideoElement?.nativeElement;
    if (!videoElement || !this.localStream) return;

    try {
      const videoTrack = this.localStream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();

      // Apply constraints for better low-light performance
      const constraints: MediaTrackConstraints = {};

      // Reduce frame rate to allow more light gathering
      if (capabilities.frameRate) {
        constraints.frameRate = { max: 15 }; // Lower FPS for more light
      }

      // Use lower resolution for better performance in low light
      if (capabilities.width && capabilities.height) {
        constraints.width = { max: 640 };
        constraints.height = { max: 480 };
      }

      await videoTrack.applyConstraints(constraints);
      
      // Apply CSS filters for additional enhancement
      videoElement.style.filter = 'brightness(1.3) contrast(1.2) saturate(0.8) sepia(0.1)';
      
    } catch (error) {
      console.log('Could not apply low-light optimizations, using CSS filters only:', error);
      // Fallback to CSS-only enhancement
      const videoElement = this.localVideoElement?.nativeElement;
      if (videoElement) {
        videoElement.style.filter = 'brightness(1.3) contrast(1.2) saturate(0.8)';
      }
    }
  }

  private async applyMildAdjustments(): Promise<void> {
    const videoElement = this.localVideoElement?.nativeElement;
    if (!videoElement) return;

    // Apply mild CSS enhancements
    videoElement.style.filter = 'brightness(1.05) contrast(1.02)';
  }

  // User Actions
  async startStream(): Promise<void> {
    if (this.isStreaming) return;

    this.statusMessage = 'Starting stream...';

    if (this.selectedSource === 'local') {
      await this.startLocalCameraWithService();
    } else if (this.selectedSource === 'esp32') {
      this.startEsp32MjpegStream();
    }
  }

  stopStream(): void {
    this.statusMessage = 'Stopping stream...';
    
    // Stop using video source service
    this.videoSourceService.stopCamera();
    
    // Stop local stream if any
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
      if (this.localVideoElement) {
         this.localVideoElement.nativeElement.srcObject = null;
      }
    }
    
    // Stop MJPEG stream
    this.mjpegStreamUrl = null;

    this.isStreaming = false;
    this.statusMessage = 'Stream stopped.';
  }

  // Start local camera using VideoSourceService
  private async startLocalCameraWithService(): Promise<void> {
    try {
      const videoElement = this.localVideoElement.nativeElement;
      const success = await this.videoSourceService.startCamera(videoElement);
      
      if (success) {
        this.localStream = this.videoSourceService.currentStream;
        this.statusMessage = 'Local camera started with enhanced settings.';
        this.videoReady.emit(videoElement);
        
        // Start FPS monitoring
        this.startFpsMonitoring();
      } else {
        throw new Error('Failed to start camera with service');
      }
    } catch (error: any) {
      console.error("Error starting camera with service:", error);
      this.statusMessage = `Error: ${error.message || error}`;
      this.isStreaming = false;
      
      // Fallback to basic camera
      await this.startLocalCamera();
    }
  }

  // FPS monitoring for performance
  private startFpsMonitoring(): void {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measureFps = () => {
      if (!this.isStreaming) return;
      
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) { // Every second
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        console.log(`Current FPS: ${fps}`);
        
        if (fps < 20) {
          console.warn('Low FPS detected, may need optimization');
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFps);
    };
    
    requestAnimationFrame(measureFps);
  }

  // --- Private Helpers ---

  private async startLocalCamera(): Promise<void> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (this.localVideoElement) { // ตรวจสอบว่า Element มีจริงก่อน
            this.localVideoElement.nativeElement.srcObject = this.localStream;
            this.localVideoElement.nativeElement.play(); // บาง browser อาจต้อง play() ด้วย
            this.statusMessage = 'Local camera started.';
        } else {
             throw new Error('Local video element not found.');
        }
      } else {
        throw new Error('getUserMedia is not supported in this browser.');
      }
    } catch (error: any) {
      console.error("Error accessing local camera:", error);
      this.statusMessage = `Error starting local camera: ${error.message || error}`;
      this.isStreaming = false; // ตั้งค่า isStreaming กลับเป็น false ถ้าเกิดข้อผิดพลาด
    }
  }

  private startEsp32MjpegStream(): void {
    if (!this.esp32Url || !this.esp32Url.startsWith('http')) {
        this.statusMessage = 'Invalid ESP32 URL format (should start with http://).';
        this.isStreaming = false;
        return;
    }
    // แค่กำหนด URL ให้กับ mjpegStreamUrl, Angular Binding จะอัปเดต src ของ <img> เอง
    this.mjpegStreamUrl = this.esp32Url;
    this.statusMessage = 'Attempting to connect to ESP32 stream...';
    // เราจะรู้ว่าสำเร็จหรือไม่จาก event (load) หรือ (error) ของ <img> tag
  }

  // --- Event Handlers for Template ---

  // เรียกเมื่อผู้ใช้เปลี่ยน <select>
  onSourceChange(): void {
    // หยุด stream เก่าก่อนที่จะเปลี่ยน source
    if (this.isStreaming) {
      this.stopStream();
    }
    // Reset status message
     this.statusMessage = 'Source changed. Click Start Stream.';
  }

  // เรียกเมื่อ <img> โหลดสำเร็จ (สำหรับ MJPEG)
  onEsp32LoadSuccess(): void {
    if(this.selectedSource === 'esp32' && this.isStreaming) {
        this.statusMessage = 'ESP32 stream connected successfully.';
    }
  }

  // เรียกเมื่อ <img> โหลดไม่สำเร็จ (สำหรับ MJPEG)
  onEsp32LoadError(): void {
     if(this.selectedSource === 'esp32' && this.isStreaming) {
        console.error("Error loading ESP32 stream from URL:", this.esp32Url);
        this.statusMessage = 'Error loading ESP32 stream. Check URL and ESP32 status.';
        // อาจจะหยุด Stream ไปเลยก็ได้
        this.stopStream(); // หยุดเพื่อให้ผู้ใช้กด Start ใหม่ได้
     }
  }
}
