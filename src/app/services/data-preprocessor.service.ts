import { Injectable } from '@angular/core';
import { Matrix } from 'ml-matrix';

export interface FeatureVector {
  raw: number[];
  normalized: number[];
  processed: number[];
  timestamp: number;
  quality: number;
  source: string;
}

export interface PreprocessingConfig {
  normalizationMethod: 'minmax' | 'zscore' | 'robust';
  smoothingWindow: number;
  outlierThreshold: number;
  missingDataStrategy: 'interpolate' | 'zero' | 'drop' | 'forward_fill';
  temporalWindow: number;
  featureSelection: boolean;
  dimensionalityReduction: boolean;
}

export interface DataStatistics {
  mean: number[];
  std: number[];
  min: number[];
  max: number[];
  median: number[];
  quartiles: { q1: number[], q3: number[] };
  outlierCount: number;
  missingCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataPreprocessorService {
  private config: PreprocessingConfig = {
    normalizationMethod: 'minmax',
    smoothingWindow: 5,
    outlierThreshold: 3, // Standard deviations
    missingDataStrategy: 'interpolate',
    temporalWindow: 30,
    featureSelection: true,
    dimensionalityReduction: false
  };

  // Feature history for temporal processing
  private featureHistory: FeatureVector[] = [];
  private readonly maxHistorySize = 1000;

  // Statistical data for normalization
  private statistics: DataStatistics | null = null;
  private isStatisticsValid = false;

  constructor() { }

  // Main preprocessing pipeline
  preprocessFeatures(
    rawFeatures: number[],
    timestamp: number,
    quality: number = 1.0,
    source: string = 'unknown'
  ): FeatureVector | null {
    
    if (!rawFeatures || rawFeatures.length === 0) {
      return null;
    }

    try {
      // Handle missing data
      const cleanedFeatures = this.handleMissingData(rawFeatures);
      
      if (!cleanedFeatures) {
        return null;
      }

      // Remove outliers
      const outlierFreeFeatures = this.removeOutliers(cleanedFeatures);

      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(outlierFreeFeatures);

      // Apply temporal smoothing
      const smoothedFeatures = this.applySmoothingToFeatures(
        normalizedFeatures, 
        timestamp, 
        quality
      );

      // Create feature vector
      const featureVector: FeatureVector = {
        raw: rawFeatures,
        normalized: normalizedFeatures,
        processed: smoothedFeatures,
        timestamp,
        quality,
        source
      };

      // Add to history
      this.addToHistory(featureVector);

      // Update statistics
      this.updateStatistics();

      return featureVector;

    } catch (error) {
      console.error('Feature preprocessing error:', error);
      return null;
    }
  }

  // Handle missing data based on strategy
  private handleMissingData(features: number[]): number[] | null {
    const missingIndices = features
      .map((val, idx) => isNaN(val) || val === null || val === undefined ? idx : -1)
      .filter(idx => idx !== -1);

    if (missingIndices.length === 0) {
      return features; // No missing data
    }

    const cleanFeatures = [...features];

    switch (this.config.missingDataStrategy) {
      case 'zero':
        missingIndices.forEach(idx => cleanFeatures[idx] = 0);
        break;

      case 'interpolate':
        return this.interpolateMissingValues(cleanFeatures, missingIndices);

      case 'forward_fill':
        return this.forwardFillMissingValues(cleanFeatures, missingIndices);

      case 'drop':
        // If too many missing values, drop the entire feature vector
        if (missingIndices.length > features.length * 0.3) {
          return null;
        }
        // Otherwise, use interpolation as fallback
        return this.interpolateMissingValues(cleanFeatures, missingIndices);

      default:
        missingIndices.forEach(idx => cleanFeatures[idx] = 0);
    }

    return cleanFeatures;
  }

  // Interpolate missing values
  private interpolateMissingValues(features: number[], missingIndices: number[]): number[] {
    const result = [...features];

    for (const idx of missingIndices) {
      // Find previous and next valid values
      let prevValue = 0;
      let nextValue = 0;
      let prevIdx = -1;
      let nextIdx = -1;

      // Find previous valid value
      for (let i = idx - 1; i >= 0; i--) {
        if (!isNaN(result[i]) && result[i] !== null && result[i] !== undefined) {
          prevValue = result[i];
          prevIdx = i;
          break;
        }
      }

      // Find next valid value
      for (let i = idx + 1; i < result.length; i++) {
        if (!isNaN(result[i]) && result[i] !== null && result[i] !== undefined) {
          nextValue = result[i];
          nextIdx = i;
          break;
        }
      }

      // Interpolate
      if (prevIdx !== -1 && nextIdx !== -1) {
        const weight = (idx - prevIdx) / (nextIdx - prevIdx);
        result[idx] = prevValue + weight * (nextValue - prevValue);
      } else if (prevIdx !== -1) {
        result[idx] = prevValue;
      } else if (nextIdx !== -1) {
        result[idx] = nextValue;
      } else {
        result[idx] = 0; // Fallback
      }
    }

    return result;
  }

  // Forward fill missing values
  private forwardFillMissingValues(features: number[], missingIndices: number[]): number[] {
    const result = [...features];

    for (const idx of missingIndices) {
      // Find previous valid value
      for (let i = idx - 1; i >= 0; i--) {
        if (!isNaN(result[i]) && result[i] !== null && result[i] !== undefined) {
          result[idx] = result[i];
          break;
        }
      }

      // If no previous value found, use 0
      if (isNaN(result[idx]) || result[idx] === null || result[idx] === undefined) {
        result[idx] = 0;
      }
    }

    return result;
  }

  // Remove outliers using statistical methods
  private removeOutliers(features: number[]): number[] {
    if (!this.statistics || !this.isStatisticsValid) {
      return features; // Can't remove outliers without statistics
    }

    const result = [...features];
    const threshold = this.config.outlierThreshold;

    for (let i = 0; i < features.length; i++) {
      if (i >= this.statistics.mean.length) break;

      const zScore = Math.abs(
        (features[i] - this.statistics.mean[i]) / (this.statistics.std[i] || 1)
      );

      if (zScore > threshold) {
        // Replace outlier with median value
        result[i] = this.statistics.median[i] || 0;
      }
    }

    return result;
  }

  // Normalize features based on selected method
  private normalizeFeatures(features: number[]): number[] {
    if (!this.statistics || !this.isStatisticsValid) {
      // First-time processing, use simple normalization
      return this.simpleNormalization(features);
    }

    switch (this.config.normalizationMethod) {
      case 'minmax':
        return this.minMaxNormalization(features);
      
      case 'zscore':
        return this.zScoreNormalization(features);
      
      case 'robust':
        return this.robustNormalization(features);
      
      default:
        return this.minMaxNormalization(features);
    }
  }

  // Min-Max normalization
  private minMaxNormalization(features: number[]): number[] {
    if (!this.statistics) return features;

    return features.map((val, idx) => {
      if (idx >= this.statistics!.min.length) return val;
      
      const min = this.statistics!.min[idx];
      const max = this.statistics!.max[idx];
      
      if (max === min) return 0; // Avoid division by zero
      
      return (val - min) / (max - min);
    });
  }

  // Z-score normalization
  private zScoreNormalization(features: number[]): number[] {
    if (!this.statistics) return features;

    return features.map((val, idx) => {
      if (idx >= this.statistics!.mean.length) return val;
      
      const mean = this.statistics!.mean[idx];
      const std = this.statistics!.std[idx];
      
      if (std === 0) return 0; // Avoid division by zero
      
      return (val - mean) / std;
    });
  }

  // Robust normalization using median and IQR
  private robustNormalization(features: number[]): number[] {
    if (!this.statistics) return features;

    return features.map((val, idx) => {
      if (idx >= this.statistics!.median.length) return val;
      
      const median = this.statistics!.median[idx];
      const q1 = this.statistics!.quartiles.q1[idx];
      const q3 = this.statistics!.quartiles.q3[idx];
      const iqr = q3 - q1;
      
      if (iqr === 0) return 0; // Avoid division by zero
      
      return (val - median) / iqr;
    });
  }

  // Simple normalization for first-time processing
  private simpleNormalization(features: number[]): number[] {
    const min = Math.min(...features);
    const max = Math.max(...features);
    
    if (max === min) return features.map(() => 0);
    
    return features.map(val => (val - min) / (max - min));
  }

  // Apply temporal smoothing
  private applySmoothingToFeatures(
    features: number[],
    timestamp: number,
    quality: number
  ): number[] {
    
    if (this.featureHistory.length < this.config.smoothingWindow) {
      return features; // Not enough history for smoothing
    }

    // Get recent features within the smoothing window
    const recentFeatures = this.featureHistory
      .slice(-this.config.smoothingWindow)
      .map(fv => fv.normalized);

    // Add current features
    recentFeatures.push(features);

    // Apply weighted moving average
    return this.weightedMovingAverage(recentFeatures, quality);
  }

  // Weighted moving average considering quality
  private weightedMovingAverage(featuresList: number[][], currentQuality: number): number[] {
    if (featuresList.length === 0) return [];

    const numFeatures = featuresList[0].length;
    const result = new Array(numFeatures).fill(0);

    // Get quality weights from history + current
    const qualityWeights = this.featureHistory
      .slice(-this.config.smoothingWindow)
      .map(fv => fv.quality);
    qualityWeights.push(currentQuality);

    // Calculate weighted average
    let totalWeight = 0;

    for (let i = 0; i < featuresList.length; i++) {
      const weight = qualityWeights[i] || 1.0;
      totalWeight += weight;

      for (let j = 0; j < numFeatures; j++) {
        result[j] += featuresList[i][j] * weight;
      }
    }

    // Normalize by total weight
    if (totalWeight > 0) {
      for (let j = 0; j < numFeatures; j++) {
        result[j] /= totalWeight;
      }
    }

    return result;
  }

  // Add feature vector to history
  private addToHistory(featureVector: FeatureVector): void {
    this.featureHistory.push(featureVector);

    // Maintain history size
    if (this.featureHistory.length > this.maxHistorySize) {
      this.featureHistory = this.featureHistory.slice(-this.maxHistorySize);
    }
  }

  // Update statistical data
  private updateStatistics(): void {
    if (this.featureHistory.length < 10) {
      this.isStatisticsValid = false;
      return; // Need minimum samples
    }

    try {
      const recentFeatures = this.featureHistory
        .slice(-100) // Use last 100 samples
        .map(fv => fv.normalized);

      this.statistics = this.calculateStatistics(recentFeatures);
      this.isStatisticsValid = true;

    } catch (error) {
      console.error('Statistics calculation error:', error);
      this.isStatisticsValid = false;
    }
  }

  // Calculate comprehensive statistics
  private calculateStatistics(featuresList: number[][]): DataStatistics {
    if (featuresList.length === 0) {
      throw new Error('No features to calculate statistics');
    }

    const numFeatures = featuresList[0].length;
    const stats: DataStatistics = {
      mean: new Array(numFeatures).fill(0),
      std: new Array(numFeatures).fill(0),
      min: new Array(numFeatures).fill(Infinity),
      max: new Array(numFeatures).fill(-Infinity),
      median: new Array(numFeatures).fill(0),
      quartiles: {
        q1: new Array(numFeatures).fill(0),
        q3: new Array(numFeatures).fill(0)
      },
      outlierCount: 0,
      missingCount: 0
    };

    // Calculate for each feature dimension
    for (let featureIdx = 0; featureIdx < numFeatures; featureIdx++) {
      const values = featuresList.map(features => features[featureIdx]);
      
      // Remove NaN values
      const validValues = values.filter(v => !isNaN(v) && v !== null && v !== undefined);
      
      if (validValues.length === 0) continue;

      // Mean
      stats.mean[featureIdx] = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;

      // Standard deviation
      const variance = validValues.reduce((sum, val) => sum + Math.pow(val - stats.mean[featureIdx], 2), 0) / validValues.length;
      stats.std[featureIdx] = Math.sqrt(variance);

      // Min/Max
      stats.min[featureIdx] = Math.min(...validValues);
      stats.max[featureIdx] = Math.max(...validValues);

      // Median and quartiles
      const sortedValues = [...validValues].sort((a, b) => a - b);
      const midIndex = Math.floor(sortedValues.length / 2);
      
      if (sortedValues.length % 2 === 0) {
        stats.median[featureIdx] = (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2;
      } else {
        stats.median[featureIdx] = sortedValues[midIndex];
      }

      // Quartiles
      const q1Index = Math.floor(sortedValues.length * 0.25);
      const q3Index = Math.floor(sortedValues.length * 0.75);
      stats.quartiles.q1[featureIdx] = sortedValues[q1Index];
      stats.quartiles.q3[featureIdx] = sortedValues[q3Index];

      // Count missing values
      stats.missingCount += values.length - validValues.length;
    }

    return stats;
  }

  // Batch processing for multiple feature vectors
  batchPreprocess(
    featuresArray: Array<{features: number[], timestamp: number, quality?: number, source?: string}>
  ): FeatureVector[] {
    
    const results: FeatureVector[] = [];

    for (const item of featuresArray) {
      const result = this.preprocessFeatures(
        item.features,
        item.timestamp,
        item.quality || 1.0,
        item.source || 'batch'
      );

      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // Get temporal features (derivatives, patterns)
  getTemporalFeatures(windowSize: number = 10): number[] | null {
    if (this.featureHistory.length < windowSize) {
      return null;
    }

    const recentFeatures = this.featureHistory
      .slice(-windowSize)
      .map(fv => fv.processed);

    const temporalFeatures: number[] = [];

    if (recentFeatures.length < 2) return null;

    const numFeatures = recentFeatures[0].length;

    // Calculate derivatives (rate of change)
    for (let i = 0; i < numFeatures; i++) {
      const values = recentFeatures.map(features => features[i]);
      
      // First derivative (velocity)
      const firstDerivative = this.calculateDerivative(values, 1);
      temporalFeatures.push(firstDerivative);

      // Second derivative (acceleration)
      if (values.length >= 3) {
        const secondDerivative = this.calculateDerivative(values, 2);
        temporalFeatures.push(secondDerivative);
      }

      // Variance over window
      const variance = this.calculateVariance(values);
      temporalFeatures.push(variance);
    }

    return temporalFeatures;
  }

  // Calculate derivative of a signal
  private calculateDerivative(values: number[], order: number): number {
    if (values.length < order + 1) return 0;

    if (order === 1) {
      // First derivative: (current - previous)
      return values[values.length - 1] - values[values.length - 2];
    } else if (order === 2) {
      // Second derivative: (current - 2*previous + before_previous)
      const n = values.length;
      return values[n - 1] - 2 * values[n - 2] + values[n - 3];
    }

    return 0;
  }

  // Calculate variance of values
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return variance;
  }

  // Configuration management
  updateConfig(newConfig: Partial<PreprocessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): PreprocessingConfig {
    return { ...this.config };
  }

  // Get current statistics
  getStatistics(): DataStatistics | null {
    return this.statistics;
  }

  // Reset preprocessor state
  reset(): void {
    this.featureHistory = [];
    this.statistics = null;
    this.isStatisticsValid = false;
  }

  // Get feature history for analysis
  getFeatureHistory(count?: number): FeatureVector[] {
    if (count) {
      return this.featureHistory.slice(-count);
    }
    return [...this.featureHistory];
  }
}
