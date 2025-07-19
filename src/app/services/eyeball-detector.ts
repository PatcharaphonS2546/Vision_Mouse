// Enhanced EyeballDetector.ts
// Advanced eyeball detection with pupil tracking and eye closure detection

import { Injectable } from '@angular/core';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface EyeRegion {
  landmarks: NormalizedLandmark[];
  boundingBox: { x: number, y: number, width: number, height: number };
  pupilCenter: { x: number, y: number } | null;
  irisRadius: number;
  eyeOpenness: number; // 0 = closed, 1 = fully open
  quality: EyeQuality;
}

export interface EyeQuality {
  sharpness: number; // 0-1
  contrast: number; // 0-1
  visibility: number; // 0-1
  tracking: number; // 0-1
  overall: number; // 0-1
}

export interface EyeBall3D {
  center: number[]; // [x, y, z]
  radius: number;
  confidence: number;
  detected: boolean;
}

export interface PupilData {
  center: { x: number, y: number };
  radius: number;
  confidence: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class EyeballDetector {
  public leftEye: EyeBall3D = {
    center: [0, 0, 0],
    radius: 0.02,
    confidence: 0.0,
    detected: false
  };
  public rightEye: EyeBall3D = {
    center: [0, 0, 0],
    radius: 0.02,
    confidence: 0.0,
    detected: false
  };
  public currentConfidence: number = 0.0;
  public centerDetected: boolean = false;
  public searchCompleted: boolean = false;

  // Enhanced tracking
  private leftEyeRegion: EyeRegion | null = null;
  private rightEyeRegion: EyeRegion | null = null;
  private pupilHistory: Map<string, PupilData[]> = new Map();
  
  // Core properties for legacy compatibility
  public eyeCenter: number[] = [0, 0, 0];
  public eyeRadius: number = 0.02;
  private minConfidence: number = 0.995;
  private reasonableConfidence: number = 0.997;
  private pointsThreshold: number = 300;
  private pointsHistorySize: number = 400;
  private refreshTimeThreshold: number = 10000;
  
  // Configuration
  private readonly config = {
    minConfidence: 0.5,
    reasonableConfidence: 0.7,
    pointsThreshold: 10,
    pointsHistorySize: 100,
    refreshTimeThreshold: 5000, // ms
    eyeClosureThreshold: 0.3,
    pupilDetectionRadius: 0.05,
    irisDetectionRadius: 0.08,
    smoothingWindow: 5
  };

  private pointsForEyeCenter: number[][] | null = null;
  private lastUpdateTime: number = 0;

  constructor() {
    // Initialize with default values
    this.initialize();
  }

  private initialize(
    initialEyeCenter: number[] = [0, 0, 0],
    initialEyeRadius: number = 0.02,
    minConfidence: number = 0.995,
    reasonableConfidence: number = 0.997,
    pointsThreshold: number = 300,
    pointsHistorySize: number = 400,
    refreshTimeThreshold: number = 10000
  ): void {
    // Initialize default eye structures
    this.leftEye = {
      center: [0, 0, 0],
      radius: 0.02,
      confidence: 0,
      detected: false
    };
    
    this.rightEye = {
      center: [0, 0, 0],
      radius: 0.02,
      confidence: 0,
      detected: false
    };

    // Initialize legacy properties
    this.eyeCenter = [...initialEyeCenter];
    this.eyeRadius = initialEyeRadius;
    this.minConfidence = minConfidence;
    this.reasonableConfidence = reasonableConfidence;
    this.pointsThreshold = pointsThreshold;
    this.pointsHistorySize = pointsHistorySize;
    this.refreshTimeThreshold = refreshTimeThreshold;
    this.lastUpdateTime = Date.now();
  }

  update(newPoints: number[][], timestampMs: number): void {
    if (this.pointsForEyeCenter) {
      this.pointsForEyeCenter = this.pointsForEyeCenter.concat(newPoints).slice(-this.pointsHistorySize);
    } else {
      this.pointsForEyeCenter = newPoints.slice();
    }
    if (this.pointsForEyeCenter.length >= this.pointsThreshold && !this.searchCompleted) {
      const {center, radius, confidence} = EyeballDetector.solveForSphere(this.pointsForEyeCenter, this.eyeCenter, this.eyeRadius);
      if (confidence && confidence > this.currentConfidence) {
        this.eyeCenter = center;
        this.eyeRadius = radius;
        this.currentConfidence = confidence;
        this.lastUpdateTime = timestampMs;
        if (confidence >= this.minConfidence) this.centerDetected = true;
        if (confidence >= this.reasonableConfidence) this.searchCompleted = true;
      }
      if ((timestampMs - this.lastUpdateTime) > this.refreshTimeThreshold) {
        this.searchCompleted = false;
      }
    }
  }

  static solveForSphere(
    points: number[][],
    initialCenter: number[],
    initialRadius: number,
    radiusBounds: [number, number] = [0.015, 0.025]
  ): {center: number[], radius: number, confidence: number} {
    // Least squares fit for sphere: minimize sum((||p_i - c|| - r)^2)
    // Use simple gradient descent for small N
    let center = [...initialCenter];
    let radius = initialRadius;
    let lr = 0.01; // learning rate
    let maxIter = 100;
    let bestLoss = Infinity;
    let bestCenter = center;
    let bestRadius = radius;
    for (let iter = 0; iter < maxIter; ++iter) {
      let gradC = [0,0,0];
      let gradR = 0;
      let loss = 0;
      for (const p of points) {
        const dx = p[0] - center[0];
        const dy = p[1] - center[1];
        const dz = p[2] - center[2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const res = dist - radius;
        loss += res*res;
        if (dist > 1e-6) {
          gradC[0] += -2 * res * dx / dist;
          gradC[1] += -2 * res * dy / dist;
          gradC[2] += -2 * res * dz / dist;
        }
        gradR += 2 * res * -1;
      }
      gradC = gradC.map(g => g/points.length);
      gradR /= points.length;
      center = [center[0] - lr*gradC[0], center[1] - lr*gradC[1], center[2] - lr*gradC[2]];
      radius = Math.max(radiusBounds[0], Math.min(radiusBounds[1], radius - lr*gradR));
      if (loss < bestLoss) {
        bestLoss = loss;
        bestCenter = [...center];
        bestRadius = radius;
      }
    }
    const confidence = 1 / (1 + bestLoss);
    return {center: bestCenter, radius: bestRadius, confidence};
  }

  reset(): void {
    this.pointsForEyeCenter = null;
    this.currentConfidence = 0.0;
    this.centerDetected = false;
    this.searchCompleted = false;
    this.lastUpdateTime = Date.now();
  }
}
