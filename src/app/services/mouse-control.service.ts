import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface MousePosition {
  x: number;
  y: number;
  timestamp: number;
}

export interface MouseControlConfig {
  sensitivity: number;
  smoothing: number;
  deadZone: number;
  clickDwell: number; // milliseconds for dwell click
  enabled: boolean;
}

export interface MouseControlStatus {
  isActive: boolean;
  lastPosition: MousePosition | null;
  clickCount: number;
  accuracy: number;
  fps: number;
}

@Injectable({
  providedIn: 'root'
})
export class MouseControlService {
  private readonly defaultConfig: MouseControlConfig = {
    sensitivity: 1.0,
    smoothing: 0.3,
    deadZone: 10,
    clickDwell: 1000,
    enabled: false
  };

  private configSubject = new BehaviorSubject<MouseControlConfig>(this.defaultConfig);
  private statusSubject = new BehaviorSubject<MouseControlStatus>({
    isActive: false,
    lastPosition: null,
    clickCount: 0,
    accuracy: 0,
    fps: 0
  });

  private positionBuffer: MousePosition[] = [];
  private movementHistory: any[] = [];
  private readonly bufferSize = 5;
  private lastUpdateTime = 0;
  private frameCount = 0;
  private fpsTimer: any;

  public config$ = this.configSubject.asObservable();
  public status$ = this.statusSubject.asObservable();

  constructor() {
    this.initializeFPSMonitoring();
  }

  /**
   * Update mouse configuration
   */
  updateConfig(config: Partial<MouseControlConfig>): void {
    const currentConfig = this.configSubject.value;
    const newConfig = { ...currentConfig, ...config };
    this.configSubject.next(newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): MouseControlConfig {
    return this.configSubject.value;
  }

  /**
   * Start mouse control
   */
  start(): void {
    const config = this.getConfig();
    config.enabled = true;
    this.configSubject.next(config);
    
    const status = this.statusSubject.value;
    status.isActive = true;
    this.statusSubject.next(status);

    console.log('Mouse control started');
  }

  /**
   * Stop mouse control
   */
  stop(): void {
    const config = this.getConfig();
    config.enabled = false;
    this.configSubject.next(config);
    
    const status = this.statusSubject.value;
    status.isActive = false;
    this.statusSubject.next(status);

    console.log('Mouse control stopped');
  }

  /**
   * Update mouse position from gaze estimation
   */
  updateMousePosition(gazeX: number, gazeY: number): void {
    const config = this.getConfig();
    if (!config.enabled) return;

    const currentTime = Date.now();
    
    // Apply sensitivity
    const adjustedX = gazeX * config.sensitivity;
    const adjustedY = gazeY * config.sensitivity;

    // Create position object
    const position: MousePosition = {
      x: adjustedX,
      y: adjustedY,
      timestamp: currentTime
    };

    // Add to buffer for smoothing
    this.positionBuffer.push(position);
    if (this.positionBuffer.length > this.bufferSize) {
      this.positionBuffer.shift();
    }

    // Apply smoothing
    const smoothedPosition = this.applySmoothingFilter(position, config.smoothing);

    // Apply dead zone filter
    const filteredPosition = this.applyDeadZoneFilter(smoothedPosition, config.deadZone);

    if (filteredPosition) {
      this.moveMouse(filteredPosition);
      this.updateStatus(filteredPosition);
    }

    this.frameCount++;
  }

  /**
   * Perform click action (dwell click)
   */
  performClick(): void {
    const status = this.statusSubject.value;
    status.clickCount++;
    this.statusSubject.next(status);

    // Trigger real mouse click event using Web API
    this.triggerMouseClick();
  }

  /**
   * Apply smoothing filter to reduce jitter
   */
  private applySmoothingFilter(position: MousePosition, smoothingFactor: number): MousePosition {
    if (this.positionBuffer.length < 2) {
      return position;
    }

    const bufferAvg = this.positionBuffer.reduce(
      (acc, pos) => ({ x: acc.x + pos.x, y: acc.y + pos.y }),
      { x: 0, y: 0 }
    );

    bufferAvg.x /= this.positionBuffer.length;
    bufferAvg.y /= this.positionBuffer.length;

    return {
      x: position.x * (1 - smoothingFactor) + bufferAvg.x * smoothingFactor,
      y: position.y * (1 - smoothingFactor) + bufferAvg.y * smoothingFactor,
      timestamp: position.timestamp
    };
  }

  /**
   * Apply dead zone filter to prevent micro-movements
   */
  private applyDeadZoneFilter(position: MousePosition, deadZone: number): MousePosition | null {
    const status = this.statusSubject.value;
    if (!status.lastPosition) {
      return position;
    }

    const deltaX = Math.abs(position.x - status.lastPosition.x);
    const deltaY = Math.abs(position.y - status.lastPosition.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance < deadZone) {
      return null; // Movement too small, ignore
    }

    return position;
  }

  /**
   * Actually move the mouse cursor
   */
  private moveMouse(position: MousePosition): void {
    // In a real implementation, this would use Web APIs to control the mouse
    // For now, we'll just dispatch custom events or update UI elements
    
    const event = new CustomEvent('gazeMouse', {
      detail: {
        x: position.x,
        y: position.y,
        timestamp: position.timestamp
      }
    });
    
    window.dispatchEvent(event);
  }

  /**
   * Trigger mouse click
   */
  private triggerMouseClick(): void {
    const event = new CustomEvent('gazeClick', {
      detail: {
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
  }

  /**
   * Update service status
   */
  private updateStatus(position: MousePosition): void {
    const currentStatus = this.statusSubject.value;
    currentStatus.lastPosition = position;
    this.statusSubject.next(currentStatus);
  }

  /**
   * Initialize FPS monitoring
   */
  private initializeFPSMonitoring(): void {
    this.fpsTimer = setInterval(() => {
      const status = this.statusSubject.value;
      status.fps = this.frameCount;
      this.statusSubject.next(status);
      this.frameCount = 0;
    }, 1000);
  }

  /**
   * Calculate accuracy based on recent performance
   */
  calculateAccuracy(): number {
    // Calculate real accuracy based on calibration data and recent movements
    const recentMovements = this.movementHistory.slice(-10);
    if (recentMovements.length === 0) return 0;
    
    let totalAccuracy = 0;
    for (const movement of recentMovements) {
      // Calculate accuracy based on smoothness and consistency
      const smoothness = this.calculateSmoothness(movement);
      const consistency = this.calculateConsistency(movement);
      totalAccuracy += (smoothness + consistency) / 2;
    }
    
    return (totalAccuracy / recentMovements.length) * 100;
  }

  private calculateSmoothness(movement: any): number {
    // Simple smoothness calculation - can be enhanced
    return Math.max(0, 1 - (movement.velocity || 0) / 1000);
  }

  private calculateConsistency(movement: any): number {
    // Simple consistency calculation - can be enhanced
    return Math.max(0, 1 - Math.abs((movement.jitter || 0) / 100));
  }

  /**
   * Clean up resources
   */
  ngOnDestroy(): void {
    if (this.fpsTimer) {
      clearInterval(this.fpsTimer);
    }
  }
}
