import { Injectable } from '@angular/core';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

@Injectable({
  providedIn: 'root'
})
export class MediapipeService {
private faceLandmarker?: FaceLandmarker;
  private lastVideoTime = -1;
  isInitialized = false;

  constructor() { }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        // ระบุ path ไปยังโฟลเดอร์ wasm ที่ copy มาไว้ใน assets
        './assets/wasm'
      );
      this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, // หรือ path ไปยัง model ที่ download มา
          delegate: 'GPU' // หรือ 'CPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1, // ต้องการ Track กี่หน้า
        outputFacialTransformationMatrixes: true, // สำคัญสำหรับ Head Pose
        outputFaceBlendshapes: false // เปิดถ้าต้องการข้อมูล Blendshapes (เช่น การขยับปาก, ยิ้ม)
      });
      this.isInitialized = true;
      console.log('MediaPipe FaceLandmarker initialized successfully.');
    } catch (error) {
      console.error('Error initializing MediaPipe FaceLandmarker:', error);
      this.isInitialized = false;
    }
  }

  detectLandmarks(videoElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, timestamp: number): FaceLandmarkerResult | undefined {
    if (!this.faceLandmarker || !this.isInitialized || (videoElement instanceof HTMLVideoElement && videoElement.readyState < 2)) { // ตรวจสอบ video readiness (สำหรับ video element)
        return undefined;
    }

    // ป้องกันการเรียกซ้ำซ้อนสำหรับ frame เดียวกัน
    if (timestamp !== this.lastVideoTime) {
      this.lastVideoTime = timestamp;
      // ตรวจสอบขนาดของ video/canvas ก่อนเรียก detect
      const videoWidth = (videoElement instanceof HTMLVideoElement) ? videoElement.videoWidth : videoElement.width;
      const videoHeight = (videoElement instanceof HTMLVideoElement) ? videoElement.videoHeight : videoElement.height;
       if (videoWidth > 0 && videoHeight > 0) {
         return this.faceLandmarker.detectForVideo(videoElement, timestamp);
       }
    }
    return undefined;
  }

  close() {
     this.faceLandmarker?.close();
     this.isInitialized = false;
     console.log('MediaPipe FaceLandmarker closed.');
  }
}
