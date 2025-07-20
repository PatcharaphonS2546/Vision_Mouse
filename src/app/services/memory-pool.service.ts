import { Injectable } from '@angular/core';

// Frame object interface for pooling
export interface PooledFrame {
  id: string;
  data: ImageData | any;
  timestamp: number;
  processed: boolean;
  priority: 'high' | 'medium' | 'low';
  
  // Pooling methods
  reset(): void;
  isAvailable(): boolean;
}

// Generic pooled object interface
export interface PooledObject {
  reset(): void;
  isAvailable(): boolean;
}

// Memory pool statistics
export interface PoolStatistics {
  totalObjects: number;
  availableObjects: number;
  peakUsage: number;
  memoryUsageMB: number;
  hitRate: number;
  missCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class MemoryPoolService {
  private framePools = new Map<string, PooledFrame[]>();
  private objectPools = new Map<string, any[]>();
  private statistics = new Map<string, PoolStatistics>();
  private readonly maxPoolSize = 50;
  private readonly maxTotalMemory = 200; // MB

  constructor() {
    this.initializePools();
    this.startMemoryMonitoring();
  }

  // Initialize default pools
  private initializePools(): void {
    // Frame processing pool
    this.createPool('frame-processing', this.createFrameObject.bind(this), 10);
    
    // Calibration data pool
    this.createPool('calibration-data', this.createCalibrationObject.bind(this), 20);
    
    // Feature extraction pool
    this.createPool('feature-extraction', this.createFeatureObject.bind(this), 15);
    
    // Gaze estimation pool
    this.createPool('gaze-estimation', this.createGazeObject.bind(this), 25);

    console.log('Memory pools initialized');
  }

  // Create a new object pool
  createPool<T>(poolName: string, factory: () => T, initialSize: number = 10): void {
    if (this.objectPools.has(poolName)) {
      console.warn(`Pool ${poolName} already exists`);
      return;
    }

    const pool: T[] = [];
    for (let i = 0; i < initialSize; i++) {
      pool.push(factory());
    }

    this.objectPools.set(poolName, pool);
    this.statistics.set(poolName, {
      totalObjects: initialSize,
      availableObjects: initialSize,
      peakUsage: 0,
      memoryUsageMB: this.estimatePoolMemory(pool),
      hitRate: 0,
      missCount: 0
    });

    console.log(`Created pool '${poolName}' with ${initialSize} objects`);
  }

  // Acquire object from pool
  acquire<T>(poolName: string): T | null {
    const pool = this.objectPools.get(poolName);
    const stats = this.statistics.get(poolName);
    
    if (!pool || !stats) {
      console.error(`Pool '${poolName}' not found`);
      return null;
    }

    // Try to get available object
    for (let i = 0; i < pool.length; i++) {
      const obj = pool[i] as any;
      if (obj && obj.isAvailable && obj.isAvailable()) {
        obj.reset();
        stats.availableObjects--;
        stats.hitRate = (stats.totalObjects - stats.missCount) / stats.totalObjects;
        this.updatePeakUsage(poolName);
        return obj;
      }
    }

    // Pool is empty, create new object if under limit
    if (pool.length < this.maxPoolSize) {
      const newObj = this.createObjectForPool(poolName);
      if (newObj) {
        pool.push(newObj);
        stats.totalObjects++;
        stats.availableObjects++;
        stats.memoryUsageMB = this.estimatePoolMemory(pool);
        return this.acquire(poolName); // Recursive call to get the new object
      }
    }

    // Pool is full, increment miss count
    stats.missCount++;
    console.warn(`Pool '${poolName}' is exhausted, creating temporary object`);
    return this.createObjectForPool(poolName);
  }

  // Release object back to pool
  release<T>(poolName: string, obj: T): void {
    const pool = this.objectPools.get(poolName);
    const stats = this.statistics.get(poolName);
    
    if (!pool || !stats) {
      console.error(`Pool '${poolName}' not found`);
      return;
    }

    const pooledObj = obj as any;
    if (pooledObj && pooledObj.reset) {
      pooledObj.reset();
      stats.availableObjects++;
      
      // Ensure object is in pool
      if (!pool.includes(obj)) {
        if (pool.length < this.maxPoolSize) {
          pool.push(obj);
          stats.totalObjects++;
        }
      }
    }
  }

  // Memory cleanup and optimization
  optimizeMemory(): void {
    let totalMemoryFreed = 0;
    
    for (const [poolName, pool] of this.objectPools.entries()) {
      const stats = this.statistics.get(poolName);
      if (!stats) continue;

      // Remove excess objects if pool is oversized
      const targetSize = Math.max(5, Math.floor(stats.totalObjects * 0.7));
      const availableObjects = pool.filter((obj: any) => obj.isAvailable && obj.isAvailable());
      
      if (availableObjects.length > targetSize) {
        const toRemove = availableObjects.slice(targetSize);
        toRemove.forEach(obj => {
          const index = pool.indexOf(obj);
          if (index > -1) {
            pool.splice(index, 1);
            stats.totalObjects--;
            stats.availableObjects--;
          }
        });
        
        const memoryFreed = this.estimatePoolMemory(toRemove);
        totalMemoryFreed += memoryFreed;
        stats.memoryUsageMB = this.estimatePoolMemory(pool);
        
        console.log(`Optimized pool '${poolName}': removed ${toRemove.length} objects, freed ${memoryFreed.toFixed(2)}MB`);
      }
    }

    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }

    // Only log if significant memory was freed
    if (totalMemoryFreed > 1) { // Only log if more than 1MB freed
      console.log(`Memory optimization complete: freed ${totalMemoryFreed.toFixed(2)}MB total`);
    }
  }

  // Get memory statistics for all pools
  getMemoryStatistics(): Map<string, PoolStatistics> {
    // Update current memory usage
    for (const [poolName, pool] of this.objectPools.entries()) {
      const stats = this.statistics.get(poolName);
      if (stats) {
        stats.memoryUsageMB = this.estimatePoolMemory(pool);
        stats.availableObjects = pool.filter((obj: any) => obj.isAvailable && obj.isAvailable()).length;
      }
    }
    
    return new Map(this.statistics);
  }

  // Get total memory usage
  getTotalMemoryUsage(): number {
    let total = 0;
    for (const stats of this.statistics.values()) {
      total += stats.memoryUsageMB;
    }
    return total;
  }

  // Clear all pools
  clearAllPools(): void {
    for (const [poolName, pool] of this.objectPools.entries()) {
      pool.length = 0;
      const stats = this.statistics.get(poolName);
      if (stats) {
        stats.totalObjects = 0;
        stats.availableObjects = 0;
        stats.memoryUsageMB = 0;
      }
    }
    console.log('All memory pools cleared');
  }

  // Factory methods for different object types
  private createFrameObject(): PooledFrame {
    return {
      id: this.generateId(),
      data: null,
      timestamp: 0,
      processed: false,
      priority: 'medium',
      
      reset(): void {
        this.data = null;
        this.timestamp = 0;
        this.processed = false;
        this.priority = 'medium';
      },
      
      isAvailable(): boolean {
        return this.data === null && !this.processed;
      }
    };
  }

  private createCalibrationObject(): any {
    return {
      points: [],
      timestamp: 0,
      accuracy: 0,
      isValid: false,
      
      reset(): void {
        this.points = [];
        this.timestamp = 0;
        this.accuracy = 0;
        this.isValid = false;
      },
      
      isAvailable(): boolean {
        return this.points.length === 0 && !this.isValid;
      }
    };
  }

  private createFeatureObject(): any {
    return {
      landmarks: [],
      eyeRegions: null,
      features: new Map(),
      confidence: 0,
      
      reset(): void {
        this.landmarks = [];
        this.eyeRegions = null;
        this.features.clear();
        this.confidence = 0;
      },
      
      isAvailable(): boolean {
        return this.landmarks.length === 0 && this.eyeRegions === null;
      }
    };
  }

  private createGazeObject(): any {
    return {
      x: 0,
      y: 0,
      confidence: 0,
      timestamp: 0,
      features: null,
      
      reset(): void {
        this.x = 0;
        this.y = 0;
        this.confidence = 0;
        this.timestamp = 0;
        this.features = null;
      },
      
      isAvailable(): boolean {
        return this.timestamp === 0 && this.features === null;
      }
    };
  }

  // Create object for specific pool
  private createObjectForPool(poolName: string): any {
    switch (poolName) {
      case 'frame-processing':
        return this.createFrameObject();
      case 'calibration-data':
        return this.createCalibrationObject();
      case 'feature-extraction':
        return this.createFeatureObject();
      case 'gaze-estimation':
        return this.createGazeObject();
      default:
        return {};
    }
  }

  // Estimate memory usage of pool
  private estimatePoolMemory(pool: any[]): number {
    if (pool.length === 0) return 0;
    
    // Rough estimation based on object properties
    const sampleObj = pool[0];
    let estimatedSize = 0;
    
    if (sampleObj.data && sampleObj.data instanceof ImageData) {
      estimatedSize += sampleObj.data.data.length * 4; // RGBA bytes
    }
    
    // Base object overhead
    estimatedSize += 100; // Estimated base object size in bytes
    
    return (pool.length * estimatedSize) / (1024 * 1024); // Convert to MB
  }

  // Update peak usage statistics
  private updatePeakUsage(poolName: string): void {
    const stats = this.statistics.get(poolName);
    if (stats) {
      const currentUsage = stats.totalObjects - stats.availableObjects;
      stats.peakUsage = Math.max(stats.peakUsage, currentUsage);
    }
  }

  // Generate unique ID
  private generateId(): string {
    return `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Start memory monitoring
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const totalMemory = this.getTotalMemoryUsage();
      
      if (totalMemory > this.maxTotalMemory) {
        console.warn(`Memory usage (${totalMemory.toFixed(2)}MB) exceeds limit (${this.maxTotalMemory}MB), optimizing...`);
        this.optimizeMemory();
      }
    }, 10000); // Check every 10 seconds
  }
}
