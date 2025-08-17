import { Injectable } from '@angular/core';
import { PointOfGaze } from './gaze-estimation.service';

export interface MouseMovementConfig {
  enableSmoothing: boolean;
  smoothingFactor: number; // 0-1, higher = more smoothing
  enableAcceleration: boolean;
  accelerationThreshold: number; // pixels per frame
  maxAcceleration: number;
  enableDeadZone: boolean;
  deadZoneRadius: number; // pixels
  enableJumpDetection: boolean;
  jumpThreshold: number; // pixels
  enableVelocitySmoothing: boolean;
  velocitySmoothingFactor: number;
}

export interface MouseMovementStats {
  totalMovements: number;
  averageVelocity: number;
  maxVelocity: number;
  smoothingEfficiency: number;
  jumpDetections: number;
  deadZoneActivations: number;
}

@Injectable({
  providedIn: 'root'
})
export class MouseSmoothingService {

  private config: MouseMovementConfig = {
    enableSmoothing: true,
    smoothingFactor: 0.7,
    enableAcceleration: true,
    accelerationThreshold: 50,
    maxAcceleration: 2.5,
    enableDeadZone: true,
    deadZoneRadius: 8,
    enableJumpDetection: true,
    jumpThreshold: 200,
    enableVelocitySmoothing: true,
    velocitySmoothingFactor: 0.8
  };

  private previousPosition: PointOfGaze = { x: 0, y: 0 };
  private velocityHistory: { vx: number, vy: number }[] = [];
  private smoothedVelocity = { vx: 0, vy: 0 };
  private stats: MouseMovementStats = {
    totalMovements: 0,
    averageVelocity: 0,
    maxVelocity: 0,
    smoothingEfficiency: 0,
    jumpDetections: 0,
    deadZoneActivations: 0
  };

  private initialized = false;
  private readonly VELOCITY_HISTORY_SIZE = 5;

  constructor() {}

  /**
   * Apply mouse movement smoothing to gaze coordinates
   */
  smoothMouseMovement(newGaze: PointOfGaze): PointOfGaze {
    if (!this.initialized) {
      this.previousPosition = { ...newGaze };
      this.initialized = true;
      return newGaze;
    }

    let smoothedGaze = { ...newGaze };

    // Calculate movement vector
    const dx = newGaze.x - this.previousPosition.x;
    const dy = newGaze.y - this.previousPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Update stats
    this.stats.totalMovements++;
    this.updateVelocityStats(distance);

    // Jump detection
    if (this.config.enableJumpDetection && distance > this.config.jumpThreshold) {
      console.log(`🦘 Jump detected: ${distance.toFixed(1)}px, dampening movement`);
      this.stats.jumpDetections++;
      
      // Dampen large jumps
      const dampening = Math.min(this.config.jumpThreshold / distance, 0.5);
      smoothedGaze.x = this.previousPosition.x + dx * dampening;
      smoothedGaze.y = this.previousPosition.y + dy * dampening;
    }

    // Dead zone check
    if (this.config.enableDeadZone && distance < this.config.deadZoneRadius) {
      this.stats.deadZoneActivations++;
      smoothedGaze = { ...this.previousPosition }; // Stay in place
    }

    // Velocity-based acceleration
    if (this.config.enableAcceleration) {
      smoothedGaze = this.applyVelocityAcceleration(smoothedGaze, distance);
    }

    // Apply smoothing
    if (this.config.enableSmoothing) {
      smoothedGaze = this.applyPositionSmoothing(smoothedGaze);
    }

    // Velocity smoothing
    if (this.config.enableVelocitySmoothing) {
      smoothedGaze = this.applyVelocitySmoothing(smoothedGaze);
    }

    // Update previous position
    this.previousPosition = { ...smoothedGaze };

    return smoothedGaze;
  }

  /**
   * Apply velocity-based acceleration
   */
  private applyVelocityAcceleration(gaze: PointOfGaze, velocity: number): PointOfGaze {
    if (velocity < this.config.accelerationThreshold) {
      return gaze; // No acceleration for slow movements
    }

    const accelerationFactor = Math.min(
      1 + (velocity - this.config.accelerationThreshold) / 100,
      this.config.maxAcceleration
    );

    const dx = gaze.x - this.previousPosition.x;
    const dy = gaze.y - this.previousPosition.y;

    return {
      x: this.previousPosition.x + dx * accelerationFactor,
      y: this.previousPosition.y + dy * accelerationFactor,
      timestamp: gaze.timestamp,
      confidence: gaze.confidence
    };
  }

  /**
   * Apply position smoothing using exponential moving average
   */
  private applyPositionSmoothing(gaze: PointOfGaze): PointOfGaze {
    const factor = this.config.smoothingFactor;
    
    return {
      x: this.previousPosition.x * factor + gaze.x * (1 - factor),
      y: this.previousPosition.y * factor + gaze.y * (1 - factor),
      timestamp: gaze.timestamp,
      confidence: gaze.confidence
    };
  }

  /**
   * Apply velocity smoothing to reduce jitter
   */
  private applyVelocitySmoothing(gaze: PointOfGaze): PointOfGaze {
    const dx = gaze.x - this.previousPosition.x;
    const dy = gaze.y - this.previousPosition.y;

    // Update velocity history
    this.velocityHistory.push({ vx: dx, vy: dy });
    if (this.velocityHistory.length > this.VELOCITY_HISTORY_SIZE) {
      this.velocityHistory.shift();
    }

    // Calculate smoothed velocity
    const factor = this.config.velocitySmoothingFactor;
    this.smoothedVelocity.vx = this.smoothedVelocity.vx * factor + dx * (1 - factor);
    this.smoothedVelocity.vy = this.smoothedVelocity.vy * factor + dy * (1 - factor);

    return {
      x: this.previousPosition.x + this.smoothedVelocity.vx,
      y: this.previousPosition.y + this.smoothedVelocity.vy,
      timestamp: gaze.timestamp,
      confidence: gaze.confidence
    };
  }

  /**
   * Update velocity statistics
   */
  private updateVelocityStats(velocity: number): void {
    this.stats.maxVelocity = Math.max(this.stats.maxVelocity, velocity);
    
    // Running average
    this.stats.averageVelocity = 
      (this.stats.averageVelocity * (this.stats.totalMovements - 1) + velocity) / 
      this.stats.totalMovements;

    // Calculate smoothing efficiency
    if (this.velocityHistory.length >= 2) {
      const recentVariance = this.calculateVelocityVariance();
      this.stats.smoothingEfficiency = Math.max(0, 1 - recentVariance / 100);
    }
  }

  /**
   * Calculate velocity variance for smoothing efficiency
   */
  private calculateVelocityVariance(): number {
    if (this.velocityHistory.length < 2) return 0;

    const velocities = this.velocityHistory.map(v => Math.sqrt(v.vx * v.vx + v.vy * v.vy));
    const mean = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    const variance = velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocities.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Configure mouse smoothing parameters
   */
  configureMouseSmoothing(config: Partial<MouseMovementConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🖱️ Mouse smoothing configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): MouseMovementConfig {
    return { ...this.config };
  }

  /**
   * Get movement statistics
   */
  getStats(): MouseMovementStats {
    return { ...this.stats };
  }

  /**
   * Reset smoothing state and statistics
   */
  reset(): void {
    this.initialized = false;
    this.previousPosition = { x: 0, y: 0 };
    this.velocityHistory = [];
    this.smoothedVelocity = { vx: 0, vy: 0 };
    
    // Reset stats
    this.stats = {
      totalMovements: 0,
      averageVelocity: 0,
      maxVelocity: 0,
      smoothingEfficiency: 0,
      jumpDetections: 0,
      deadZoneActivations: 0
    };
    
    console.log('🔄 Mouse smoothing reset');
  }

  /**
   * Get smoothing recommendations based on current performance
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.stats.jumpDetections > this.stats.totalMovements * 0.1) {
      recommendations.push('🦘 การกระโดดของเมาส์เยอะ - ลองเพิ่มค่า smoothingFactor');
    }

    if (this.stats.smoothingEfficiency < 0.6) {
      recommendations.push('📐 ความนุ่มนวลยังไม่เพียงพอ - ลองเปิด velocitySmoothing');
    }

    if (this.stats.deadZoneActivations > this.stats.totalMovements * 0.3) {
      recommendations.push('🎯 Dead zone ใหญ่เกินไป - ลองลดค่า deadZoneRadius');
    }

    if (this.stats.averageVelocity > 100) {
      recommendations.push('⚡ การเคลื่อนไหวเร็วเกินไป - ลองเพิ่ม smoothingFactor');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ การตั้งค่าเหมาะสมแล้ว');
    }

    return recommendations;
  }
}
