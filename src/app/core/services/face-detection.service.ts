/**
 * Face Detection Service - Refactored
 * Clean MediaPipe wrapper with proper state management
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { IFaceDetectionService } from '../interfaces/service.interface';
import { EyeTrackingData, SystemStatus, Point3D, Point2D, BoundingBox } from '../interfaces/core.interface';
import { StateService } from '../state/state.service';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from './notification.service';

declare var MediaPipe: any;

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionService implements IFaceDetectionService {
  
  private faceMesh: any = null;
  private isInitialized = false;
  private frameCounter = 0;
  
  private readonly status$ = new BehaviorSubject<SystemStatus>('initializing');

  constructor(
    private stateService: StateService,
    private errorHandler: ErrorHandlerService,
    private notifications: NotificationService
  ) {}

  // Lifecycle
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      this.updateStatus('initializing');
      this.notifications.showInfo('กำลังโหลด MediaPipe...');

      // Load MediaPipe scripts
      await this.loadMediaPipeScripts();
      
      // Initialize Face Mesh
      await this.initializeFaceMesh();
      
      this.isInitialized = true;
      this.updateStatus('ready');
      this.notifications.showSuccess('MediaPipe พร้อมใช้งาน');

    } catch (error) {
      this.updateStatus('error');
      this.errorHandler.handleError(error as Error, 'MediaPipe initialization');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.faceMesh) {
        this.faceMesh.close();
        this.faceMesh = null;
      }
      
      this.isInitialized = false;
      this.updateStatus('stopped');
      
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'MediaPipe cleanup');
    }
  }

  // Detection
  async detectFace(frame: HTMLVideoElement | HTMLCanvasElement): Promise<EyeTrackingData | null> {
    try {
      if (!this.isReady()) {
        return null;
      }

      const startTime = performance.now();
      this.frameCounter++;

      return new Promise((resolve) => {
        this.faceMesh.onResults((results: any) => {
          const processingTime = performance.now() - startTime;
          const eyeData = this.processResults(results, processingTime);
          resolve(eyeData);
        });

        this.faceMesh.send({ image: frame });
      });

    } catch (error) {
      this.errorHandler.handleError(error as Error, 'Face detection');
      return null;
    }
  }

  // Status
  getStatus(): Observable<SystemStatus> {
    return this.status$.asObservable();
  }

  isReady(): boolean {
    return this.isInitialized && this.status$.value === 'ready';
  }

  // Configuration
  configure(config: any): void {
    if (this.faceMesh) {
      Object.keys(config).forEach(key => {
        if (this.faceMesh.setOptions) {
          this.faceMesh.setOptions({ [key]: config[key] });
        }
      });
    }
  }

  // Private methods
  private async loadMediaPipeScripts(): Promise<void> {
    // Check if MediaPipe is already loaded
    if (typeof MediaPipe !== 'undefined') {
      return;
    }

    // Load MediaPipe scripts dynamically
    const scripts = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
    ];

    for (const script of scripts) {
      await this.loadScript(script);
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private async initializeFaceMesh(): Promise<void> {
    const FaceMesh = (window as any).FaceMesh;
    if (!FaceMesh) {
      throw new Error('MediaPipe FaceMesh not available');
    }

    this.faceMesh = new FaceMesh({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
  }

  private processResults(results: any, processingTime: number): EyeTrackingData | null {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      return {
        faceDetected: false,
        leftEye: this.createEmptyEyeRegion(),
        rightEye: this.createEmptyEyeRegion(),
        headPose: { yaw: 0, pitch: 0, roll: 0, confidence: 0 },
        timestamp: Date.now(),
        frameNumber: this.frameCounter,
        processingTime
      };
    }

    const landmarks = results.multiFaceLandmarks[0];
    const faceLandmarks = this.convertLandmarks(landmarks);
    
    return {
      faceDetected: true,
      faceLandmarks: {
        landmarks: faceLandmarks,
        boundingBox: this.calculateBoundingBox(faceLandmarks),
        confidence: 0.9, // MediaPipe doesn't provide face confidence directly
        timestamp: Date.now()
      },
      leftEye: this.extractEyeRegion(landmarks, 'left'),
      rightEye: this.extractEyeRegion(landmarks, 'right'),
      headPose: this.calculateHeadPose(landmarks),
      timestamp: Date.now(),
      frameNumber: this.frameCounter,
      processingTime
    };
  }

  private convertLandmarks(landmarks: any[]): Point3D[] {
    return landmarks.map(landmark => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z || 0
    }));
  }

  private calculateBoundingBox(landmarks: Point3D[]): BoundingBox {
    const xs = landmarks.map(p => p.x);
    const ys = landmarks.map(p => p.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private extractEyeRegion(landmarks: any[], eye: 'left' | 'right'): any {
    // MediaPipe face mesh landmark indices for eyes
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    
    const eyeIndices = eye === 'left' ? leftEyeIndices : rightEyeIndices;
    const eyeLandmarks = eyeIndices.map(index => ({
      x: landmarks[index].x,
      y: landmarks[index].y,
      z: landmarks[index].z || 0
    }));

    const center = this.calculateEyeCenter(eyeLandmarks);
    const pupil = this.estimatePupilPosition(eyeLandmarks, center);
    
    return {
      landmarks: eyeLandmarks,
      center,
      isOpen: this.calculateEyeOpenness(eyeLandmarks) > 0.3,
      openness: this.calculateEyeOpenness(eyeLandmarks),
      pupil: {
        center: pupil,
        diameter: this.estimatePupilDiameter(eyeLandmarks),
        confidence: 0.8
      }
    };
  }

  private calculateEyeCenter(eyeLandmarks: Point3D[]): Point2D {
    const avgX = eyeLandmarks.reduce((sum, p) => sum + p.x, 0) / eyeLandmarks.length;
    const avgY = eyeLandmarks.reduce((sum, p) => sum + p.y, 0) / eyeLandmarks.length;
    return { x: avgX, y: avgY };
  }

  private estimatePupilPosition(eyeLandmarks: Point3D[], eyeCenter: Point2D): Point2D {
    // Simple estimation - in a real implementation, this would be more sophisticated
    return eyeCenter;
  }

  private estimatePupilDiameter(eyeLandmarks: Point3D[]): number {
    // Estimate based on eye region size
    const xs = eyeLandmarks.map(p => p.x);
    const ys = eyeLandmarks.map(p => p.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    return Math.min(width, height) * 0.3; // Rough estimation
  }

  private calculateEyeOpenness(eyeLandmarks: Point3D[]): number {
    // Calculate eye aspect ratio
    if (eyeLandmarks.length < 6) return 0;
    
    // Use specific points for eye openness calculation
    const p1 = eyeLandmarks[1];
    const p2 = eyeLandmarks[5];
    const p3 = eyeLandmarks[2];
    const p4 = eyeLandmarks[4];
    const p5 = eyeLandmarks[0];
    const p6 = eyeLandmarks[3];
    
    const verticalDist1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
    const verticalDist2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));
    const horizontalDist = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));
    
    return (verticalDist1 + verticalDist2) / (2 * horizontalDist);
  }

  private calculateHeadPose(landmarks: any[]): any {
    // Simplified head pose calculation
    // In a real implementation, this would use proper 3D pose estimation
    
    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[362];
    const chin = landmarks[17];
    
    // Calculate yaw (left-right rotation)
    const eyeDistance = Math.abs(leftEye.x - rightEye.x);
    const leftEyeDistance = Math.abs(nose.x - leftEye.x);
    const rightEyeDistance = Math.abs(nose.x - rightEye.x);
    
    const yaw = ((leftEyeDistance - rightEyeDistance) / eyeDistance) * 45; // Rough estimation
    
    // Calculate pitch (up-down rotation)
    const faceHeight = Math.abs(chin.y - ((leftEye.y + rightEye.y) / 2));
    const noseHeight = Math.abs(nose.y - ((leftEye.y + rightEye.y) / 2));
    
    const pitch = ((noseHeight / faceHeight) - 0.5) * 60; // Rough estimation
    
    return {
      yaw: Math.max(-45, Math.min(45, yaw)),
      pitch: Math.max(-30, Math.min(30, pitch)),
      roll: 0, // Would need more complex calculation
      confidence: 0.7
    };
  }

  private createEmptyEyeRegion(): any {
    return {
      landmarks: [],
      center: { x: 0, y: 0 },
      isOpen: false,
      openness: 0,
      pupil: {
        center: { x: 0, y: 0 },
        diameter: 0,
        confidence: 0
      }
    };
  }

  private updateStatus(status: SystemStatus): void {
    this.status$.next(status);
  }

  // Public utility methods
  getLandmarkIndices(): { leftEye: number[]; rightEye: number[]; face: number[] } {
    return {
      leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
      rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
      face: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
    };
  }

  getProcessingStats(): { framesProcessed: number; averageProcessingTime: number } {
    return {
      framesProcessed: this.frameCounter,
      averageProcessingTime: 0 // Would track this in a real implementation
    };
  }
}
