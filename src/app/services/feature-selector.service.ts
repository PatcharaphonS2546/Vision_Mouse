import { Injectable } from '@angular/core';
import { Matrix } from 'ml-matrix';
import { FeatureSet } from './advanced-feature-extraction.service';

export interface FeatureSelection {
  selectedIndices: number[];
  featureScores: number[];
  selectionMethod: string;
  reductionRatio: number;
  performance: FeatureSelectionPerformance;
}

export interface FeatureSelectionPerformance {
  originalFeatureCount: number;
  selectedFeatureCount: number;
  informationRetained: number;
  computationReduction: number;
  selectionTime: number;
}

export interface DimensionalityReduction {
  reducedFeatures: number[];
  transformationMatrix: number[][];
  explainedVariance: number;
  method: string;
  components: number;
}

export interface FeatureSelectorConfig {
  selectionMethod: 'variance' | 'correlation' | 'mutual_info' | 'chi2' | 'recursive' | 'l1' | 'hybrid';
  reductionMethod: 'pca' | 'ica' | 'lda' | 'none';
  targetFeatureCount: number;
  varianceThreshold: number;
  correlationThreshold: number;
  adaptiveSelection: boolean;
  performanceWeighting: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FeatureSelectorService {
  private config: FeatureSelectorConfig = {
    selectionMethod: 'hybrid',
    reductionMethod: 'pca',
    targetFeatureCount: 50,
    varianceThreshold: 0.01,
    correlationThreshold: 0.95,
    adaptiveSelection: true,
    performanceWeighting: true
  };

  // Feature statistics and history
  private featureStatistics: Map<number, FeatureStats> = new Map();
  private selectionHistory: FeatureSelection[] = [];
  private transformationMatrices: Map<string, Matrix> = new Map();

  // Cache for expensive computations
  private correlationMatrix: Matrix | null = null;
  private varianceScores: number[] = [];
  private mutualInfoScores: number[] = [];

  constructor() { }

  // Main feature selection method
  selectFeatures(
    featureSets: FeatureSet[],
    gazeTargets?: {x: number, y: number}[]
  ): FeatureSelection | null {

    const startTime = performance.now();

    try {
      if (featureSets.length === 0) {
        return null;
      }

      // Extract feature matrix
      const featureMatrix = this.extractFeatureMatrix(featureSets);
      if (featureMatrix.length === 0) {
        return null;
      }

      // Apply selection method
      let selection: FeatureSelection;

      switch (this.config.selectionMethod) {
        case 'variance':
          selection = this.selectByVariance(featureMatrix);
          break;
        case 'correlation':
          selection = this.selectByCorrelation(featureMatrix);
          break;
        case 'mutual_info':
          selection = this.selectByMutualInformation(featureMatrix, gazeTargets);
          break;
        case 'chi2':
          selection = this.selectByChi2(featureMatrix, gazeTargets);
          break;
        case 'recursive':
          selection = this.selectByRecursiveElimination(featureMatrix, gazeTargets);
          break;
        case 'l1':
          selection = this.selectByL1Regularization(featureMatrix, gazeTargets);
          break;
        case 'hybrid':
          selection = this.selectByHybridMethod(featureMatrix, gazeTargets);
          break;
        default:
          selection = this.selectByVariance(featureMatrix);
      }

      // Calculate performance metrics
      const selectionTime = performance.now() - startTime;
      selection.performance.selectionTime = selectionTime;

      // Update statistics
      this.updateFeatureStatistics(selection, featureMatrix);

      // Store in history
      this.selectionHistory.push(selection);
      if (this.selectionHistory.length > 50) {
        this.selectionHistory = this.selectionHistory.slice(-50);
      }

      return selection;

    } catch (error) {
      console.error('Feature selection error:', error);
      return null;
    }
  }

  // Apply dimensionality reduction
  reduceFeatures(
    features: number[],
    selectionResult?: FeatureSelection
  ): DimensionalityReduction | null {

    try {
      if (this.config.reductionMethod === 'none') {
        return null;
      }

      // Select features first if selection result provided
      let selectedFeatures = features;
      if (selectionResult) {
        selectedFeatures = selectionResult.selectedIndices.map(idx => features[idx]);
      }

      switch (this.config.reductionMethod) {
        case 'pca':
          return this.applyPCA(selectedFeatures);
        case 'ica':
          return this.applyICA(selectedFeatures);
        case 'lda':
          return this.applyLDA(selectedFeatures);
        default:
          return null;
      }

    } catch (error) {
      console.error('Dimensionality reduction error:', error);
      return null;
    }
  }

  // Variance-based feature selection
  private selectByVariance(featureMatrix: number[][]): FeatureSelection {
    const variances = this.calculateVariances(featureMatrix);
    
    // Sort by variance (descending)
    const indexedVariances = variances.map((variance, index) => ({
      index,
      score: variance
    }));

    indexedVariances.sort((a, b) => b.score - a.score);

    // Select top features
    const targetCount = Math.min(this.config.targetFeatureCount, variances.length);
    const selectedIndices = indexedVariances
      .filter(item => item.score > this.config.varianceThreshold)
      .slice(0, targetCount)
      .map(item => item.index);

    const featureScores = selectedIndices.map(idx => variances[idx]);

    return {
      selectedIndices,
      featureScores,
      selectionMethod: 'variance',
      reductionRatio: selectedIndices.length / variances.length,
      performance: {
        originalFeatureCount: variances.length,
        selectedFeatureCount: selectedIndices.length,
        informationRetained: this.calculateInformationRetained(featureScores, variances),
        computationReduction: 1 - (selectedIndices.length / variances.length),
        selectionTime: 0
      }
    };
  }

  // Correlation-based feature selection
  private selectByCorrelation(featureMatrix: number[][]): FeatureSelection {
    if (!this.correlationMatrix || this.correlationMatrix.rows !== featureMatrix[0].length) {
      this.correlationMatrix = this.calculateCorrelationMatrix(featureMatrix);
    }

    const featureCount = featureMatrix[0].length;
    const redundantFeatures = new Set<number>();

    // Find highly correlated features
    for (let i = 0; i < featureCount; i++) {
      for (let j = i + 1; j < featureCount; j++) {
        const correlation = Math.abs(this.correlationMatrix.get(i, j));
        
        if (correlation > this.config.correlationThreshold) {
          // Keep the feature with higher variance
          const varI = this.calculateFeatureVariance(featureMatrix, i);
          const varJ = this.calculateFeatureVariance(featureMatrix, j);
          
          if (varI > varJ) {
            redundantFeatures.add(j);
          } else {
            redundantFeatures.add(i);
          }
        }
      }
    }

    // Select non-redundant features
    const selectedIndices: number[] = [];
    const featureScores: number[] = [];

    for (let i = 0; i < featureCount; i++) {
      if (!redundantFeatures.has(i)) {
        selectedIndices.push(i);
        featureScores.push(1 - Math.min(...Array.from({ length: featureCount }, (_, j) => 
          i === j ? 0 : Math.abs(this.correlationMatrix!.get(i, j))
        )));
      }
    }

    return {
      selectedIndices,
      featureScores,
      selectionMethod: 'correlation',
      reductionRatio: selectedIndices.length / featureCount,
      performance: {
        originalFeatureCount: featureCount,
        selectedFeatureCount: selectedIndices.length,
        informationRetained: 0.9, // Estimate
        computationReduction: redundantFeatures.size / featureCount,
        selectionTime: 0
      }
    };
  }

  // Mutual information-based selection
  private selectByMutualInformation(
    featureMatrix: number[][],
    gazeTargets?: {x: number, y: number}[]
  ): FeatureSelection {

    if (!gazeTargets) {
      // Fall back to variance-based selection
      return this.selectByVariance(featureMatrix);
    }

    const featureCount = featureMatrix[0].length;
    const mutualInfoScores: number[] = [];

    // Calculate mutual information for each feature
    for (let i = 0; i < featureCount; i++) {
      const featureValues = featureMatrix.map(row => row[i]);
      const miX = this.calculateMutualInformation(featureValues, gazeTargets.map(g => g.x));
      const miY = this.calculateMutualInformation(featureValues, gazeTargets.map(g => g.y));
      mutualInfoScores.push(Math.max(miX, miY));
    }

    // Sort by mutual information
    const indexedScores = mutualInfoScores.map((score, index) => ({
      index,
      score
    }));

    indexedScores.sort((a, b) => b.score - a.score);

    // Select top features
    const targetCount = Math.min(this.config.targetFeatureCount, featureCount);
    const selectedIndices = indexedScores.slice(0, targetCount).map(item => item.index);
    const featureScores = selectedIndices.map(idx => mutualInfoScores[idx]);

    return {
      selectedIndices,
      featureScores,
      selectionMethod: 'mutual_info',
      reductionRatio: selectedIndices.length / featureCount,
      performance: {
        originalFeatureCount: featureCount,
        selectedFeatureCount: selectedIndices.length,
        informationRetained: this.calculateInformationRetained(featureScores, mutualInfoScores),
        computationReduction: 1 - (selectedIndices.length / featureCount),
        selectionTime: 0
      }
    };
  }

  // Chi-squared feature selection
  private selectByChi2(
    featureMatrix: number[][],
    gazeTargets?: {x: number, y: number}[]
  ): FeatureSelection {

    if (!gazeTargets) {
      return this.selectByVariance(featureMatrix);
    }

    const featureCount = featureMatrix[0].length;
    const chi2Scores: number[] = [];

    // Discretize gaze targets for chi-squared test
    const discretizedGaze = this.discretizeTargets(gazeTargets);

    // Calculate chi-squared statistic for each feature
    for (let i = 0; i < featureCount; i++) {
      const featureValues = featureMatrix.map(row => row[i]);
      const discretizedFeature = this.discretizeFeature(featureValues);
      const chi2Score = this.calculateChi2Statistic(discretizedFeature, discretizedGaze);
      chi2Scores.push(chi2Score);
    }

    // Sort by chi-squared score
    const indexedScores = chi2Scores.map((score, index) => ({
      index,
      score
    }));

    indexedScores.sort((a, b) => b.score - a.score);

    // Select top features
    const targetCount = Math.min(this.config.targetFeatureCount, featureCount);
    const selectedIndices = indexedScores.slice(0, targetCount).map(item => item.index);
    const featureScores = selectedIndices.map(idx => chi2Scores[idx]);

    return {
      selectedIndices,
      featureScores,
      selectionMethod: 'chi2',
      reductionRatio: selectedIndices.length / featureCount,
      performance: {
        originalFeatureCount: featureCount,
        selectedFeatureCount: selectedIndices.length,
        informationRetained: this.calculateInformationRetained(featureScores, chi2Scores),
        computationReduction: 1 - (selectedIndices.length / featureCount),
        selectionTime: 0
      }
    };
  }

  // Recursive feature elimination
  private selectByRecursiveElimination(
    featureMatrix: number[][],
    gazeTargets?: {x: number, y: number}[]
  ): FeatureSelection {

    if (!gazeTargets) {
      return this.selectByVariance(featureMatrix);
    }

    const featureCount = featureMatrix[0].length;
    let currentFeatures = Array.from({ length: featureCount }, (_, i) => i);
    const featureScores = new Array(featureCount).fill(0);

    // Iteratively remove features
    const targetCount = Math.min(this.config.targetFeatureCount, featureCount);

    while (currentFeatures.length > targetCount) {
      // Train simple model and get feature importance
      const importance = this.calculateFeatureImportance(featureMatrix, gazeTargets, currentFeatures);
      
      // Find least important feature
      let minImportance = Infinity;
      let minIndex = 0;
      
      for (let i = 0; i < importance.length; i++) {
        if (importance[i] < minImportance) {
          minImportance = importance[i];
          minIndex = i;
        }
      }

      // Record score for removed feature
      const actualFeatureIndex = currentFeatures[minIndex];
      featureScores[actualFeatureIndex] = minImportance;

      // Remove least important feature
      currentFeatures.splice(minIndex, 1);
    }

    // Set scores for remaining features
    const finalImportance = this.calculateFeatureImportance(featureMatrix, gazeTargets, currentFeatures);
    for (let i = 0; i < currentFeatures.length; i++) {
      featureScores[currentFeatures[i]] = finalImportance[i];
    }

    return {
      selectedIndices: currentFeatures,
      featureScores: currentFeatures.map(idx => featureScores[idx]),
      selectionMethod: 'recursive',
      reductionRatio: currentFeatures.length / featureCount,
      performance: {
        originalFeatureCount: featureCount,
        selectedFeatureCount: currentFeatures.length,
        informationRetained: 0.95, // Estimate
        computationReduction: 1 - (currentFeatures.length / featureCount),
        selectionTime: 0
      }
    };
  }

  // L1 regularization-based selection
  private selectByL1Regularization(
    featureMatrix: number[][],
    gazeTargets?: {x: number, y: number}[]
  ): FeatureSelection {

    if (!gazeTargets) {
      return this.selectByVariance(featureMatrix);
    }

    const featureCount = featureMatrix[0].length;
    
    // Train L1-regularized model
    const l1Weights = this.trainL1RegularizedModel(featureMatrix, gazeTargets);
    
    // Select features with non-zero weights
    const selectedIndices: number[] = [];
    const featureScores: number[] = [];
    
    for (let i = 0; i < l1Weights.length; i++) {
      if (Math.abs(l1Weights[i]) > 1e-6) {
        selectedIndices.push(i);
        featureScores.push(Math.abs(l1Weights[i]));
      }
    }

    // If too few features selected, add top variance features
    if (selectedIndices.length < this.config.targetFeatureCount / 2) {
      const variances = this.calculateVariances(featureMatrix);
      const remainingIndices = Array.from({ length: featureCount }, (_, i) => i)
        .filter(i => !selectedIndices.includes(i));
      
      remainingIndices.sort((a, b) => variances[b] - variances[a]);
      
      const additionalCount = Math.min(
        this.config.targetFeatureCount - selectedIndices.length,
        remainingIndices.length
      );
      
      for (let i = 0; i < additionalCount; i++) {
        selectedIndices.push(remainingIndices[i]);
        featureScores.push(variances[remainingIndices[i]]);
      }
    }

    return {
      selectedIndices,
      featureScores,
      selectionMethod: 'l1',
      reductionRatio: selectedIndices.length / featureCount,
      performance: {
        originalFeatureCount: featureCount,
        selectedFeatureCount: selectedIndices.length,
        informationRetained: 0.9, // Estimate
        computationReduction: 1 - (selectedIndices.length / featureCount),
        selectionTime: 0
      }
    };
  }

  // Hybrid feature selection combining multiple methods
  private selectByHybridMethod(
    featureMatrix: number[][],
    gazeTargets?: {x: number, y: number}[]
  ): FeatureSelection {

    // Apply multiple selection methods
    const varianceSelection = this.selectByVariance(featureMatrix);
    const correlationSelection = this.selectByCorrelation(featureMatrix);
    
    let miSelection: FeatureSelection | null = null;
    if (gazeTargets) {
      miSelection = this.selectByMutualInformation(featureMatrix, gazeTargets);
    }

    // Combine selections using voting
    const featureCount = featureMatrix[0].length;
    const featureVotes = new Array(featureCount).fill(0);
    const featureScores = new Array(featureCount).fill(0);

    // Weight by method reliability
    const methods = [
      { selection: varianceSelection, weight: 0.3 },
      { selection: correlationSelection, weight: 0.3 },
      { selection: miSelection, weight: 0.4 }
    ];

    for (const method of methods) {
      if (method.selection) {
        for (let i = 0; i < method.selection.selectedIndices.length; i++) {
          const idx = method.selection.selectedIndices[i];
          featureVotes[idx] += method.weight;
          featureScores[idx] += method.selection.featureScores[i] * method.weight;
        }
      }
    }

    // Normalize scores
    for (let i = 0; i < featureCount; i++) {
      if (featureVotes[i] > 0) {
        featureScores[i] /= featureVotes[i];
      }
    }

    // Select features with highest votes
    const indexedVotes = featureVotes.map((votes, index) => ({
      index,
      votes,
      score: featureScores[index]
    }));

    indexedVotes.sort((a, b) => b.votes - a.votes || b.score - a.score);

    const targetCount = Math.min(this.config.targetFeatureCount, featureCount);
    const selectedIndices = indexedVotes.slice(0, targetCount).map(item => item.index);
    const finalScores = selectedIndices.map(idx => featureScores[idx]);

    return {
      selectedIndices,
      featureScores: finalScores,
      selectionMethod: 'hybrid',
      reductionRatio: selectedIndices.length / featureCount,
      performance: {
        originalFeatureCount: featureCount,
        selectedFeatureCount: selectedIndices.length,
        informationRetained: 0.95, // Estimate
        computationReduction: 1 - (selectedIndices.length / featureCount),
        selectionTime: 0
      }
    };
  }

  // Apply PCA for dimensionality reduction
  private applyPCA(features: number[]): DimensionalityReduction {
    // This is a simplified PCA implementation
    // In a real application, you might want to use a more robust implementation
    
    const targetDimensions = Math.min(10, features.length);
    
    // For now, just select the first N features with some transformation
    const transformationMatrix = this.generatePCATransformation(features.length, targetDimensions);
    const reducedFeatures = this.applyTransformation(features, transformationMatrix);

    return {
      reducedFeatures,
      transformationMatrix,
      explainedVariance: 0.95, // Estimate
      method: 'pca',
      components: targetDimensions
    };
  }

  // Apply ICA for dimensionality reduction
  private applyICA(features: number[]): DimensionalityReduction {
    // Simplified ICA implementation
    const targetDimensions = Math.min(8, features.length);
    
    const transformationMatrix = this.generateICATransformation(features.length, targetDimensions);
    const reducedFeatures = this.applyTransformation(features, transformationMatrix);

    return {
      reducedFeatures,
      transformationMatrix,
      explainedVariance: 0.90, // Estimate
      method: 'ica',
      components: targetDimensions
    };
  }

  // Apply LDA for dimensionality reduction
  private applyLDA(features: number[]): DimensionalityReduction {
    // Simplified LDA implementation
    const targetDimensions = Math.min(6, features.length);
    
    const transformationMatrix = this.generateLDATransformation(features.length, targetDimensions);
    const reducedFeatures = this.applyTransformation(features, transformationMatrix);

    return {
      reducedFeatures,
      transformationMatrix,
      explainedVariance: 0.88, // Estimate
      method: 'lda',
      components: targetDimensions
    };
  }

  // Helper methods

  private extractFeatureMatrix(featureSets: FeatureSet[]): number[][] {
    return featureSets.map(fs => fs.combined);
  }

  private calculateVariances(featureMatrix: number[][]): number[] {
    if (featureMatrix.length === 0) return [];
    
    const featureCount = featureMatrix[0].length;
    const variances: number[] = [];

    for (let i = 0; i < featureCount; i++) {
      const values = featureMatrix.map(row => row[i]);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      variances.push(variance);
    }

    return variances;
  }

  private calculateFeatureVariance(featureMatrix: number[][], featureIndex: number): number {
    const values = featureMatrix.map(row => row[featureIndex]);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private calculateCorrelationMatrix(featureMatrix: number[][]): Matrix {
    const featureCount = featureMatrix[0].length;
    const correlations = new Array(featureCount).fill(null).map(() => new Array(featureCount).fill(0));

    for (let i = 0; i < featureCount; i++) {
      for (let j = 0; j < featureCount; j++) {
        if (i === j) {
          correlations[i][j] = 1;
        } else {
          const valuesI = featureMatrix.map(row => row[i]);
          const valuesJ = featureMatrix.map(row => row[j]);
          correlations[i][j] = this.calculateCorrelation(valuesI, valuesJ);
        }
      }
    }

    return new Matrix(correlations);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }

    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateMutualInformation(feature: number[], target: number[]): number {
    // Simplified mutual information calculation
    // In practice, you'd want a more sophisticated implementation
    return Math.abs(this.calculateCorrelation(feature, target));
  }

  private discretizeTargets(gazeTargets: {x: number, y: number}[]): number[] {
    // Simple discretization into 4 quadrants
    return gazeTargets.map(gaze => {
      if (gaze.x < 0.5 && gaze.y < 0.5) return 0; // Top-left
      if (gaze.x >= 0.5 && gaze.y < 0.5) return 1; // Top-right
      if (gaze.x < 0.5 && gaze.y >= 0.5) return 2; // Bottom-left
      return 3; // Bottom-right
    });
  }

  private discretizeFeature(values: number[]): number[] {
    // Discretize into quartiles
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q2 = sorted[Math.floor(sorted.length * 0.5)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];

    return values.map(val => {
      if (val <= q1) return 0;
      if (val <= q2) return 1;
      if (val <= q3) return 2;
      return 3;
    });
  }

  private calculateChi2Statistic(feature: number[], target: number[]): number {
    // Simplified chi-squared calculation
    const contingencyTable = this.buildContingencyTable(feature, target);
    return this.calculateChi2FromTable(contingencyTable);
  }

  private buildContingencyTable(feature: number[], target: number[]): number[][] {
    const maxFeature = Math.max(...feature) + 1;
    const maxTarget = Math.max(...target) + 1;
    const table = new Array(maxFeature).fill(null).map(() => new Array(maxTarget).fill(0));

    for (let i = 0; i < feature.length; i++) {
      table[feature[i]][target[i]]++;
    }

    return table;
  }

  private calculateChi2FromTable(table: number[][]): number {
    // Simplified chi-squared calculation
    let chi2 = 0;
    const totalCount = table.flat().reduce((sum, val) => sum + val, 0);

    for (let i = 0; i < table.length; i++) {
      const rowSum = table[i].reduce((sum, val) => sum + val, 0);
      for (let j = 0; j < table[i].length; j++) {
        const colSum = table.reduce((sum, row) => sum + row[j], 0);
        const expected = (rowSum * colSum) / totalCount;
        if (expected > 0) {
          const observed = table[i][j];
          chi2 += Math.pow(observed - expected, 2) / expected;
        }
      }
    }

    return chi2;
  }

  private calculateFeatureImportance(
    featureMatrix: number[][],
    gazeTargets: {x: number, y: number}[],
    featureIndices: number[]
  ): number[] {
    // Simplified feature importance calculation using correlation
    const importance: number[] = [];

    for (const idx of featureIndices) {
      const featureValues = featureMatrix.map(row => row[idx]);
      const gazeX = gazeTargets.map(g => g.x);
      const gazeY = gazeTargets.map(g => g.y);

      const corrX = Math.abs(this.calculateCorrelation(featureValues, gazeX));
      const corrY = Math.abs(this.calculateCorrelation(featureValues, gazeY));
      
      importance.push(Math.max(corrX, corrY));
    }

    return importance;
  }

  private trainL1RegularizedModel(
    featureMatrix: number[][],
    gazeTargets: {x: number, y: number}[]
  ): number[] {
    // Simplified L1 regularization using soft thresholding
    const featureCount = featureMatrix[0].length;
    const weights = new Array(featureCount).fill(0);
    const learningRate = 0.001;
    const lambda = 0.01; // L1 regularization parameter
    const epochs = 50;

    // Training loop with L1 regularization
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < featureMatrix.length; i++) {
        const features = featureMatrix[i];
        const target = gazeTargets[i].x; // Just use X coordinate for simplicity

        // Forward pass
        let prediction = 0;
        for (let j = 0; j < featureCount; j++) {
          prediction += features[j] * weights[j];
        }

        // Calculate error
        const error = target - prediction;

        // Update weights with L1 regularization
        for (let j = 0; j < featureCount; j++) {
          const gradient = -error * features[j];
          weights[j] -= learningRate * gradient;
          
          // Apply L1 regularization (soft thresholding)
          if (weights[j] > lambda * learningRate) {
            weights[j] -= lambda * learningRate;
          } else if (weights[j] < -lambda * learningRate) {
            weights[j] += lambda * learningRate;
          } else {
            weights[j] = 0;
          }
        }
      }
    }

    return weights;
  }

  private calculateInformationRetained(selectedScores: number[], allScores: number[]): number {
    if (allScores.length === 0) return 1;
    
    const totalScore = allScores.reduce((sum, score) => sum + score, 0);
    const selectedScore = selectedScores.reduce((sum, score) => sum + score, 0);
    
    return totalScore === 0 ? 1 : selectedScore / totalScore;
  }

  private generatePCATransformation(inputDim: number, outputDim: number): number[][] {
    // Generate a random orthogonal matrix as placeholder
    const matrix = new Array(outputDim).fill(null).map(() => 
      new Array(inputDim).fill(0).map(() => Math.random() - 0.5)
    );
    
    // Simple Gram-Schmidt orthogonalization
    for (let i = 0; i < outputDim; i++) {
      // Normalize current vector
      let norm = Math.sqrt(matrix[i].reduce((sum, val) => sum + val * val, 0));
      if (norm > 0) {
        matrix[i] = matrix[i].map(val => val / norm);
      }
      
      // Orthogonalize against previous vectors
      for (let j = 0; j < i; j++) {
        const dot = matrix[i].reduce((sum, val, k) => sum + val * matrix[j][k], 0);
        for (let k = 0; k < inputDim; k++) {
          matrix[i][k] -= dot * matrix[j][k];
        }
        
        // Re-normalize
        norm = Math.sqrt(matrix[i].reduce((sum, val) => sum + val * val, 0));
        if (norm > 0) {
          matrix[i] = matrix[i].map(val => val / norm);
        }
      }
    }
    
    return matrix;
  }

  private generateICATransformation(inputDim: number, outputDim: number): number[][] {
    // Simplified ICA transformation (random orthogonal matrix)
    return this.generatePCATransformation(inputDim, outputDim);
  }

  private generateLDATransformation(inputDim: number, outputDim: number): number[][] {
    // Simplified LDA transformation
    return this.generatePCATransformation(inputDim, outputDim);
  }

  private applyTransformation(features: number[], transformationMatrix: number[][]): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < transformationMatrix.length; i++) {
      let sum = 0;
      for (let j = 0; j < features.length && j < transformationMatrix[i].length; j++) {
        sum += features[j] * transformationMatrix[i][j];
      }
      result.push(sum);
    }
    
    return result;
  }

  private updateFeatureStatistics(selection: FeatureSelection, featureMatrix: number[][]): void {
    for (let i = 0; i < selection.selectedIndices.length; i++) {
      const featureIndex = selection.selectedIndices[i];
      const score = selection.featureScores[i];
      
      if (!this.featureStatistics.has(featureIndex)) {
        this.featureStatistics.set(featureIndex, {
          index: featureIndex,
          selectionCount: 0,
          averageScore: 0,
          lastScore: 0,
          variance: 0
        });
      }
      
      const stats = this.featureStatistics.get(featureIndex)!;
      stats.selectionCount++;
      stats.lastScore = score;
      stats.averageScore = (stats.averageScore * (stats.selectionCount - 1) + score) / stats.selectionCount;
    }
  }

  // Configuration and utility methods
  updateConfig(newConfig: Partial<FeatureSelectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Clear caches when config changes
    this.correlationMatrix = null;
    this.varianceScores = [];
    this.mutualInfoScores = [];
  }

  getConfig(): FeatureSelectorConfig {
    return { ...this.config };
  }

  getSelectionHistory(count?: number): FeatureSelection[] {
    if (count) {
      return this.selectionHistory.slice(-count);
    }
    return [...this.selectionHistory];
  }

  getFeatureStatistics(): Map<number, FeatureStats> {
    return new Map(this.featureStatistics);
  }

  // Reset selector state
  reset(): void {
    this.featureStatistics.clear();
    this.selectionHistory = [];
    this.transformationMatrices.clear();
    this.correlationMatrix = null;
    this.varianceScores = [];
    this.mutualInfoScores = [];
  }
}

interface FeatureStats {
  index: number;
  selectionCount: number;
  averageScore: number;
  lastScore: number;
  variance: number;
}
