// Phase 1: Webcam API & ส่งภาพไป backend
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WebcamService {
  private videoElement: HTMLVideoElement | null = null;

  async startWebcam(videoElement: HTMLVideoElement): Promise<void> {
    this.videoElement = videoElement;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    await videoElement.play();
  }

  async captureFrame(): Promise<Blob | null> {
    if (!this.videoElement) return null;
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(this.videoElement, 0, 0);
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg');
    });
  }
}
