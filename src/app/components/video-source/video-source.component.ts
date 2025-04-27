import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-video-source',
  standalone: false,
  templateUrl: './video-source.component.html',
  styleUrl: './video-source.component.css'
})
export class VideoSourceComponent implements OnInit, OnDestroy{
  // --- Configuration ---
  @ViewChild('localVideo') localVideoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('esp32Image') esp32ImageElement!: ElementRef<HTMLImageElement>; // ใช้ <img> สำหรับ MJPEG

  // --- State ---
  selectedSource: 'local' | 'esp32' = 'local'; // ค่าเริ่มต้น
  esp32Url: string = 'http://192.168.78.193:81/stream'; // <<--- ใส่ URL ของ ESP32-CAM ที่นี่!
  isStreaming: boolean = false;
  statusMessage: string = 'Ready';
  mjpegStreamUrl: string | null = null; // URL ที่จะผูกกับ <img>

  private localStream: MediaStream | null = null;

  constructor() { }

  ngOnInit(): void {
    // สามารถตั้งค่าเริ่มต้นอื่นๆ ที่นี่ได้
  }

  ngOnDestroy(): void {
    // *** สำคัญมาก: ต้องหยุด Stream เมื่อ Component ถูกทำลาย ***
    this.stopStream();
  }

  // --- User Actions ---

  startStream(): void {
    if (this.isStreaming) return; // ไม่เริ่มซ้ำ

    this.statusMessage = 'Starting stream...';
    this.isStreaming = true;

    if (this.selectedSource === 'local') {
      this.startLocalCamera();
    } else if (this.selectedSource === 'esp32') {
      this.startEsp32MjpegStream();
    }
  }

  stopStream(): void {
    this.statusMessage = 'Stopping stream...';
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
      if (this.localVideoElement) { // ตรวจสอบว่า Element มีจริงก่อน
         this.localVideoElement.nativeElement.srcObject = null;
      }
    }
    // หยุดการโหลด MJPEG โดยการล้าง URL
    this.mjpegStreamUrl = null;

    this.isStreaming = false;
    this.statusMessage = 'Stream stopped.';
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
