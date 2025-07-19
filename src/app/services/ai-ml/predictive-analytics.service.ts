import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';

export interface GazePattern {
  id: string;
  name: string;
  description: string;
  points: { x: number; y: number; timestamp: number; duration: number }[];
  frequency: number; // How often this pattern occurs
  confidence: number; // Pattern recognition confidence
  type: 'reading' | 'scanning' | 'focusing' | 'searching' | 'navigation';
}

export interface AttentionHeatmap {
  width: number;
  height: number;
  data: number[][]; // 2D array of attention intensity (0-1)
  timeWindow: { start: Date; end: Date };
  totalFixations: number;
  averageDuration: number;
}

export interface GazePrediction {
  nextGazePoint: { x: number; y: number };
  confidence: number;
  timeToGaze: number; // Predicted time in milliseconds
  probability: number; // Probability of this prediction
  context: string; // Context that influenced prediction
  alternatives: Array<{
    point: { x: number; y: number };
    probability: number;
  }>;
}

export interface UserBehaviorProfile {
  userId: string;
  sessionCount: number;
  totalGazeTime: number;
  commonPatterns: GazePattern[];
  preferredRegions: Array<{ x: number; y: number; preference: number }>;
  averageFixationDuration: number;
  readingSpeed: number; // Words per minute equivalent
  attentionSpan: number; // Average attention duration
  taskEfficiency: number; // 0-1 score
}

export interface PredictiveInsight {
  type: 'pattern' | 'anomaly' | 'efficiency' | 'attention' | 'fatigue';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  recommendations: string[];
  impact: 'low' | 'medium' | 'high';
}

@Injectable({
  providedIn: 'root'
})
export class PredictiveAnalyticsService {
  private gazeHistory: Array<{ x: number; y: number; timestamp: number; confidence: number }> = [];
  private currentHeatmap$ = new BehaviorSubject<AttentionHeatmap | null>(null);
  private detectedPatterns$ = new BehaviorSubject<GazePattern[]>([]);
  private userProfile$ = new BehaviorSubject<UserBehaviorProfile | null>(null);
  private predictions$ = new BehaviorSubject<GazePrediction[]>([]);
  private insights$ = new BehaviorSubject<PredictiveInsight[]>([]);

  private readonly HISTORY_LIMIT = 10000; // Maximum gaze points to keep in memory
  private readonly PATTERN_MIN_POINTS = 5; // Minimum points to form a pattern
  private readonly HEATMAP_RESOLUTION = 50; // Heatmap grid resolution
  private readonly PREDICTION_HORIZON = 3; // Number of predictions to generate

  private isAnalyzing = false;
  private analysisInterval: any;
  private currentSession: {
    startTime: Date;
    gazePoints: number;
    patterns: GazePattern[];
  } | null = null;

  constructor() {
    this.initializeService();
    this.startContinuousAnalysis();
  }

  /**
   * Initialize the predictive analytics service
   */
  initializeService(): void {
    console.log('Initializing Predictive Analytics Service...');
    
    this.currentSession = {
      startTime: new Date(),
      gazePoints: 0,
      patterns: []
    };

    // Load user profile if available
    this.loadUserProfile();
    
    console.log('Predictive Analytics Service initialized');
  }

  /**
   * Add new gaze point to analysis
   */
  addGazePoint(x: number, y: number, confidence: number = 1.0): void {
    const gazePoint = {
      x,
      y,
      timestamp: Date.now(),
      confidence
    };

    this.gazeHistory.push(gazePoint);
    
    if (this.currentSession) {
      this.currentSession.gazePoints++;
    }

    // Maintain history limit
    if (this.gazeHistory.length > this.HISTORY_LIMIT) {
      this.gazeHistory = this.gazeHistory.slice(-this.HISTORY_LIMIT);
    }

    // Trigger real-time analysis for recent data
    this.performRealTimeAnalysis();
  }

  /**
   * Generate attention heatmap for specified time window
   */
  generateAttentionHeatmap(
    timeWindow: { start: Date; end: Date },
    width: number = 1920,
    height: number = 1080
  ): AttentionHeatmap {
    const startTime = timeWindow.start.getTime();
    const endTime = timeWindow.end.getTime();

    // Filter gaze points within time window
    const relevantPoints = this.gazeHistory.filter(point => 
      point.timestamp >= startTime && point.timestamp <= endTime
    );

    // Create heatmap grid
    const gridWidth = this.HEATMAP_RESOLUTION;
    const gridHeight = this.HEATMAP_RESOLUTION;
    const heatmapData: number[][] = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(0));

    // Calculate cell dimensions
    const cellWidth = width / gridWidth;
    const cellHeight = height / gridHeight;

    // Populate heatmap
    let totalFixations = 0;
    let totalDuration = 0;

    for (let i = 0; i < relevantPoints.length; i++) {
      const point = relevantPoints[i];
      const nextPoint = relevantPoints[i + 1];

      // Calculate grid position
      const gridX = Math.min(gridWidth - 1, Math.floor(point.x / cellWidth));
      const gridY = Math.min(gridHeight - 1, Math.floor(point.y / cellHeight));

      // Calculate fixation duration
      const duration = nextPoint ? nextPoint.timestamp - point.timestamp : 100; // Default 100ms
      
      // Add weighted intensity based on confidence and duration
      const intensity = (point.confidence * Math.min(duration, 2000)) / 2000; // Cap at 2 seconds
      heatmapData[gridY][gridX] += intensity;

      totalFixations++;
      totalDuration += duration;
    }

    // Normalize heatmap values
    const maxValue = Math.max(...heatmapData.flat());
    if (maxValue > 0) {
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          heatmapData[y][x] /= maxValue;
        }
      }
    }

    const heatmap: AttentionHeatmap = {
      width: gridWidth,
      height: gridHeight,
      data: heatmapData,
      timeWindow,
      totalFixations,
      averageDuration: totalFixations > 0 ? totalDuration / totalFixations : 0
    };

    this.currentHeatmap$.next(heatmap);
    return heatmap;
  }

  /**
   * Detect and classify gaze patterns
   */
  detectGazePatterns(): GazePattern[] {
    if (this.gazeHistory.length < this.PATTERN_MIN_POINTS) {
      return [];
    }

    const patterns: GazePattern[] = [];

    // Detect reading patterns
    const readingPatterns = this.detectReadingPatterns();
    patterns.push(...readingPatterns);

    // Detect scanning patterns
    const scanningPatterns = this.detectScanningPatterns();
    patterns.push(...scanningPatterns);

    // Detect focusing patterns
    const focusingPatterns = this.detectFocusingPatterns();
    patterns.push(...focusingPatterns);

    // Detect searching patterns
    const searchingPatterns = this.detectSearchingPatterns();
    patterns.push(...searchingPatterns);

    // Update detected patterns
    this.detectedPatterns$.next(patterns);

    if (this.currentSession) {
      this.currentSession.patterns = patterns;
    }

    return patterns;
  }

  /**
   * Predict next gaze locations
   */
  predictNextGaze(): GazePrediction[] {
    if (this.gazeHistory.length < 3) {
      return [];
    }

    const predictions: GazePrediction[] = [];
    const recentPoints = this.gazeHistory.slice(-10); // Use last 10 points

    // Velocity-based prediction
    const velocityPrediction = this.predictBasedOnVelocity(recentPoints);
    if (velocityPrediction) {
      predictions.push(velocityPrediction);
    }

    // Pattern-based prediction
    const patternPrediction = this.predictBasedOnPatterns(recentPoints);
    if (patternPrediction) {
      predictions.push(patternPrediction);
    }

    // Context-based prediction
    const contextPrediction = this.predictBasedOnContext(recentPoints);
    if (contextPrediction) {
      predictions.push(contextPrediction);
    }

    // Sort by confidence
    predictions.sort((a, b) => b.confidence - a.confidence);

    // Take top predictions
    const topPredictions = predictions.slice(0, this.PREDICTION_HORIZON);
    this.predictions$.next(topPredictions);

    return topPredictions;
  }

  /**
   * Generate predictive insights about user behavior
   */
  generateInsights(): PredictiveInsight[] {
    const insights: PredictiveInsight[] = [];

    // Analyze attention patterns
    const attentionInsights = this.analyzeAttentionPatterns();
    insights.push(...attentionInsights);

    // Analyze efficiency
    const efficiencyInsights = this.analyzeEfficiency();
    insights.push(...efficiencyInsights);

    // Detect fatigue indicators
    const fatigueInsights = this.detectFatigueIndicators();
    insights.push(...fatigueInsights);

    // Identify anomalies
    const anomalyInsights = this.detectAnomalies();
    insights.push(...anomalyInsights);

    this.insights$.next(insights);
    return insights;
  }

  /**
   * Update user behavior profile
   */
  updateUserProfile(userId: string): UserBehaviorProfile {
    const patterns = this.detectedPatterns$.value;
    const currentProfile = this.userProfile$.value;

    // Calculate metrics
    const totalGazeTime = this.calculateTotalGazeTime();
    const averageFixationDuration = this.calculateAverageFixationDuration();
    const preferredRegions = this.identifyPreferredRegions();

    const profile: UserBehaviorProfile = {
      userId,
      sessionCount: currentProfile ? currentProfile.sessionCount + 1 : 1,
      totalGazeTime: (currentProfile?.totalGazeTime || 0) + totalGazeTime,
      commonPatterns: this.mergePatterns(currentProfile?.commonPatterns || [], patterns),
      preferredRegions,
      averageFixationDuration,
      readingSpeed: this.estimateReadingSpeed(),
      attentionSpan: this.calculateAttentionSpan(),
      taskEfficiency: this.calculateTaskEfficiency()
    };

    this.userProfile$.next(profile);
    this.saveUserProfile(profile);

    return profile;
  }

  /**
   * Get current attention heatmap
   */
  getCurrentHeatmap(): Observable<AttentionHeatmap | null> {
    return this.currentHeatmap$.asObservable();
  }

  /**
   * Get detected patterns
   */
  getDetectedPatterns(): Observable<GazePattern[]> {
    return this.detectedPatterns$.asObservable();
  }

  /**
   * Get user behavior profile
   */
  getUserProfile(): Observable<UserBehaviorProfile | null> {
    return this.userProfile$.asObservable();
  }

  /**
   * Get gaze predictions
   */
  getPredictions(): Observable<GazePrediction[]> {
    return this.predictions$.asObservable();
  }

  /**
   * Get predictive insights
   */
  getInsights(): Observable<PredictiveInsight[]> {
    return this.insights$.asObservable();
  }

  /**
   * Clear analysis data
   */
  clearAnalysisData(): void {
    this.gazeHistory = [];
    this.currentHeatmap$.next(null);
    this.detectedPatterns$.next([]);
    this.predictions$.next([]);
    this.insights$.next([]);
    
    if (this.currentSession) {
      this.currentSession.gazePoints = 0;
      this.currentSession.patterns = [];
    }
  }

  // Private helper methods

  private startContinuousAnalysis(): void {
    // Run analysis every 5 seconds
    this.analysisInterval = setInterval(() => {
      if (this.gazeHistory.length > 0 && !this.isAnalyzing) {
        this.performPeriodicAnalysis();
      }
    }, 5000);
  }

  private performRealTimeAnalysis(): void {
    // Quick real-time analysis for immediate feedback
    if (this.gazeHistory.length >= 5) {
      const recentPoints = this.gazeHistory.slice(-5);
      this.predictNextGaze();
    }
  }

  private performPeriodicAnalysis(): void {
    this.isAnalyzing = true;

    try {
      // Generate heatmap for last 30 seconds
      const now = new Date();
      const thirtySecondsAgo = new Date(now.getTime() - 30000);
      this.generateAttentionHeatmap({ start: thirtySecondsAgo, end: now });

      // Detect patterns
      this.detectGazePatterns();

      // Generate predictions
      this.predictNextGaze();

      // Generate insights
      this.generateInsights();

    } catch (error) {
      console.error('Error in periodic analysis:', error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  private detectReadingPatterns(): GazePattern[] {
    const patterns: GazePattern[] = [];
    
    // Look for left-to-right, top-to-bottom movement patterns
    const recentPoints = this.gazeHistory.slice(-50);
    
    if (recentPoints.length < 10) return patterns;

    // Group points into potential reading lines
    const lines = this.groupPointsIntoLines(recentPoints);
    
    for (const line of lines) {
      if (line.length >= 5) { // Minimum points for a reading line
        const pattern: GazePattern = {
          id: `reading_${Date.now()}_${Math.random()}`,
          name: 'Reading Pattern',
          description: 'Left-to-right reading movement detected',
          points: line,
          frequency: this.calculatePatternFrequency('reading'),
          confidence: this.calculateReadingConfidence(line),
          type: 'reading'
        };
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private detectScanningPatterns(): GazePattern[] {
    const patterns: GazePattern[] = [];
    const recentPoints = this.gazeHistory.slice(-30);

    if (recentPoints.length < 5) return patterns;

    // Look for rapid eye movements with short fixations
    const rapidMovements = this.identifyRapidMovements(recentPoints);
    
    if (rapidMovements.length >= 5) {
      const pattern: GazePattern = {
        id: `scanning_${Date.now()}_${Math.random()}`,
        name: 'Scanning Pattern',
        description: 'Rapid scanning behavior detected',
        points: rapidMovements,
        frequency: this.calculatePatternFrequency('scanning'),
        confidence: this.calculateScanningConfidence(rapidMovements),
        type: 'scanning'
      };
      patterns.push(pattern);
    }

    return patterns;
  }

  private detectFocusingPatterns(): GazePattern[] {
    const patterns: GazePattern[] = [];
    const recentPoints = this.gazeHistory.slice(-20);

    if (recentPoints.length < 5) return patterns;

    // Look for clusters of points in small areas (focusing)
    const clusters = this.identifyGazeClusters(recentPoints);
    
    for (const cluster of clusters) {
      if (cluster.length >= 5 && this.calculateClusterDensity(cluster) > 0.8) {
        const pattern: GazePattern = {
          id: `focusing_${Date.now()}_${Math.random()}`,
          name: 'Focusing Pattern',
          description: 'Concentrated attention detected',
          points: cluster,
          frequency: this.calculatePatternFrequency('focusing'),
          confidence: this.calculateFocusingConfidence(cluster),
          type: 'focusing'
        };
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private detectSearchingPatterns(): GazePattern[] {
    const patterns: GazePattern[] = [];
    const recentPoints = this.gazeHistory.slice(-40);

    if (recentPoints.length < 10) return patterns;

    // Look for non-linear, exploratory movements
    const searchMovements = this.identifySearchMovements(recentPoints);
    
    if (searchMovements.length >= 10) {
      const pattern: GazePattern = {
        id: `searching_${Date.now()}_${Math.random()}`,
        name: 'Searching Pattern',
        description: 'Exploratory search behavior detected',
        points: searchMovements,
        frequency: this.calculatePatternFrequency('searching'),
        confidence: this.calculateSearchingConfidence(searchMovements),
        type: 'searching'
      };
      patterns.push(pattern);
    }

    return patterns;
  }

  private predictBasedOnVelocity(points: Array<{ x: number; y: number; timestamp: number }>): GazePrediction | null {
    if (points.length < 3) return null;

    const last = points[points.length - 1];
    const secondLast = points[points.length - 2];
    const thirdLast = points[points.length - 3];

    // Calculate velocity and acceleration
    const velocity = {
      x: (last.x - secondLast.x) / (last.timestamp - secondLast.timestamp),
      y: (last.y - secondLast.y) / (last.timestamp - secondLast.timestamp)
    };

    const acceleration = {
      x: ((last.x - secondLast.x) - (secondLast.x - thirdLast.x)) / Math.pow(last.timestamp - secondLast.timestamp, 2),
      y: ((last.y - secondLast.y) - (secondLast.y - thirdLast.y)) / Math.pow(last.timestamp - secondLast.timestamp, 2)
    };

    // Predict next position based on velocity and acceleration
    const timeToGaze = 300; // 300ms prediction
    const predictedX = last.x + velocity.x * timeToGaze + 0.5 * acceleration.x * Math.pow(timeToGaze, 2);
    const predictedY = last.y + velocity.y * timeToGaze + 0.5 * acceleration.y * Math.pow(timeToGaze, 2);

    // Calculate confidence based on velocity consistency
    const velocityMagnitude = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    const confidence = Math.min(0.9, Math.max(0.1, 1 - velocityMagnitude / 5));

    return {
      nextGazePoint: { x: predictedX, y: predictedY },
      confidence,
      timeToGaze,
      probability: confidence,
      context: 'velocity-based prediction',
      alternatives: []
    };
  }

  private predictBasedOnPatterns(points: Array<{ x: number; y: number; timestamp: number }>): GazePrediction | null {
    const patterns = this.detectedPatterns$.value;
    if (patterns.length === 0) return null;

    // Find the most relevant pattern
    const mostRelevantPattern = patterns.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    // Predict based on pattern continuation
    const patternPoints = mostRelevantPattern.points;
    if (patternPoints.length < 2) return null;

    const lastPattern = patternPoints[patternPoints.length - 1];
    const secondLastPattern = patternPoints[patternPoints.length - 2];

    const dx = lastPattern.x - secondLastPattern.x;
    const dy = lastPattern.y - secondLastPattern.y;

    return {
      nextGazePoint: { 
        x: lastPattern.x + dx, 
        y: lastPattern.y + dy 
      },
      confidence: mostRelevantPattern.confidence * 0.8,
      timeToGaze: 250,
      probability: mostRelevantPattern.confidence,
      context: `${mostRelevantPattern.type} pattern continuation`,
      alternatives: []
    };
  }

  private predictBasedOnContext(points: Array<{ x: number; y: number; timestamp: number }>): GazePrediction | null {
    // Context-based prediction using screen regions and common UI patterns
    const last = points[points.length - 1];
    
    // Predict return to center if at edges
    if (last.x < 100 || last.x > 1820 || last.y < 100 || last.y > 980) {
      return {
        nextGazePoint: { x: 960, y: 540 }, // Screen center
        confidence: 0.6,
        timeToGaze: 500,
        probability: 0.6,
        context: 'edge-to-center prediction',
        alternatives: []
      };
    }

    return null;
  }

  private analyzeAttentionPatterns(): PredictiveInsight[] {
    const insights: PredictiveInsight[] = [];
    const patterns = this.detectedPatterns$.value;

    // Analyze reading efficiency
    const readingPatterns = patterns.filter(p => p.type === 'reading');
    if (readingPatterns.length > 0) {
      const avgConfidence = readingPatterns.reduce((sum, p) => sum + p.confidence, 0) / readingPatterns.length;
      
      if (avgConfidence > 0.8) {
        insights.push({
          type: 'attention',
          title: 'Efficient Reading Pattern',
          description: 'Your reading patterns show high efficiency and focus',
          confidence: avgConfidence,
          actionable: false,
          recommendations: ['Continue current reading approach'],
          impact: 'low'
        });
      }
    }

    return insights;
  }

  private analyzeEfficiency(): PredictiveInsight[] {
    const insights: PredictiveInsight[] = [];
    
    if (this.gazeHistory.length > 100) {
      const efficiency = this.calculateTaskEfficiency();
      
      if (efficiency < 0.6) {
        insights.push({
          type: 'efficiency',
          title: 'Low Task Efficiency Detected',
          description: 'Your gaze patterns suggest decreased efficiency',
          confidence: 0.75,
          actionable: true,
          recommendations: [
            'Take a short break',
            'Adjust screen position',
            'Improve lighting conditions'
          ],
          impact: 'medium'
        });
      }
    }

    return insights;
  }

  private detectFatigueIndicators(): PredictiveInsight[] {
    const insights: PredictiveInsight[] = [];
    
    if (this.gazeHistory.length > 200) {
      const recentPoints = this.gazeHistory.slice(-100);
      const olderPoints = this.gazeHistory.slice(-200, -100);
      
      const recentVariability = this.calculateGazeVariability(recentPoints);
      const olderVariability = this.calculateGazeVariability(olderPoints);
      
      if (recentVariability > olderVariability * 1.5) {
        insights.push({
          type: 'fatigue',
          title: 'Potential Fatigue Detected',
          description: 'Increased gaze variability suggests possible fatigue',
          confidence: 0.7,
          actionable: true,
          recommendations: [
            'Consider taking a break',
            'Perform eye exercises',
            'Check screen distance and brightness'
          ],
          impact: 'high'
        });
      }
    }

    return insights;
  }

  private detectAnomalies(): PredictiveInsight[] {
    const insights: PredictiveInsight[] = [];
    
    // Detect unusual patterns or behaviors
    const patterns = this.detectedPatterns$.value;
    const lowConfidencePatterns = patterns.filter(p => p.confidence < 0.4);
    
    if (lowConfidencePatterns.length > patterns.length * 0.3) {
      insights.push({
        type: 'anomaly',
        title: 'Unusual Gaze Patterns',
        description: 'Detected irregular gaze behavior patterns',
        confidence: 0.6,
        actionable: true,
        recommendations: [
          'Check calibration accuracy',
          'Ensure proper head position',
          'Verify lighting conditions'
        ],
        impact: 'medium'
      });
    }

    return insights;
  }

  // Additional helper methods for pattern analysis

  private groupPointsIntoLines(points: Array<{ x: number; y: number; timestamp: number }>): Array<Array<{ x: number; y: number; timestamp: number; duration: number }>> {
    // Simplified line grouping algorithm
    const lines: Array<Array<{ x: number; y: number; timestamp: number; duration: number }>> = [];
    let currentLine: Array<{ x: number; y: number; timestamp: number; duration: number }> = [];
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const nextPoint = points[i + 1];
      const duration = nextPoint ? nextPoint.timestamp - point.timestamp : 100;
      
      const linePoint = { ...point, duration };
      
      if (currentLine.length === 0) {
        currentLine.push(linePoint);
      } else {
        const lastPoint = currentLine[currentLine.length - 1];
        const yDiff = Math.abs(point.y - lastPoint.y);
        
        // If Y difference is small, continue current line
        if (yDiff < 50) {
          currentLine.push(linePoint);
        } else {
          // Start new line
          if (currentLine.length >= 3) {
            lines.push(currentLine);
          }
          currentLine = [linePoint];
        }
      }
    }
    
    if (currentLine.length >= 3) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  private identifyRapidMovements(points: Array<{ x: number; y: number; timestamp: number }>): Array<{ x: number; y: number; timestamp: number; duration: number }> {
    const rapidMovements: Array<{ x: number; y: number; timestamp: number; duration: number }> = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      const distance = Math.sqrt(Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2));
      const time = next.timestamp - current.timestamp;
      const velocity = distance / time;
      
      // Rapid movement threshold
      if (velocity > 0.5) { // pixels per millisecond
        rapidMovements.push({
          ...current,
          duration: time
        });
      }
    }
    
    return rapidMovements;
  }

  private identifyGazeClusters(points: Array<{ x: number; y: number; timestamp: number }>): Array<Array<{ x: number; y: number; timestamp: number; duration: number }>> {
    const clusters: Array<Array<{ x: number; y: number; timestamp: number; duration: number }>> = [];
    const clusterThreshold = 50; // pixels
    
    let currentCluster: Array<{ x: number; y: number; timestamp: number; duration: number }> = [];
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const nextPoint = points[i + 1];
      const duration = nextPoint ? nextPoint.timestamp - point.timestamp : 100;
      
      if (currentCluster.length === 0) {
        currentCluster.push({ ...point, duration });
      } else {
        const clusterCenter = this.calculateClusterCenter(currentCluster);
        const distance = Math.sqrt(Math.pow(point.x - clusterCenter.x, 2) + Math.pow(point.y - clusterCenter.y, 2));
        
        if (distance <= clusterThreshold) {
          currentCluster.push({ ...point, duration });
        } else {
          if (currentCluster.length >= 3) {
            clusters.push(currentCluster);
          }
          currentCluster = [{ ...point, duration }];
        }
      }
    }
    
    if (currentCluster.length >= 3) {
      clusters.push(currentCluster);
    }
    
    return clusters;
  }

  private identifySearchMovements(points: Array<{ x: number; y: number; timestamp: number }>): Array<{ x: number; y: number; timestamp: number; duration: number }> {
    // Identify non-linear, exploratory movements
    const searchMovements: Array<{ x: number; y: number; timestamp: number; duration: number }> = [];
    
    for (let i = 2; i < points.length; i++) {
      const prev = points[i - 2];
      const current = points[i - 1];
      const next = points[i];
      
      // Calculate direction changes
      const angle1 = Math.atan2(current.y - prev.y, current.x - prev.x);
      const angle2 = Math.atan2(next.y - current.y, next.x - current.x);
      const angleDiff = Math.abs(angle2 - angle1);
      
      // Large direction changes indicate searching
      if (angleDiff > Math.PI / 3) { // 60 degrees
        searchMovements.push({
          ...current,
          duration: next.timestamp - current.timestamp
        });
      }
    }
    
    return searchMovements;
  }

  private calculateClusterCenter(cluster: Array<{ x: number; y: number }>): { x: number; y: number } {
    const sumX = cluster.reduce((sum, point) => sum + point.x, 0);
    const sumY = cluster.reduce((sum, point) => sum + point.y, 0);
    
    return {
      x: sumX / cluster.length,
      y: sumY / cluster.length
    };
  }

  private calculateClusterDensity(cluster: Array<{ x: number; y: number }>): number {
    if (cluster.length < 2) return 0;
    
    const center = this.calculateClusterCenter(cluster);
    const distances = cluster.map(point => 
      Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2))
    );
    
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    
    // Higher density = lower average distance
    return Math.max(0, 1 - (avgDistance / 100));
  }

  private calculatePatternFrequency(patternType: string): number {
    // Simplified frequency calculation
    const patterns = this.detectedPatterns$.value;
    const typePatterns = patterns.filter(p => p.type === patternType);
    
    return typePatterns.length / Math.max(1, patterns.length);
  }

  private calculateReadingConfidence(line: Array<{ x: number; y: number }>): number {
    if (line.length < 3) return 0;
    
    // Calculate how linear the movement is (left-to-right)
    let leftToRightCount = 0;
    
    for (let i = 1; i < line.length; i++) {
      if (line[i].x > line[i - 1].x) {
        leftToRightCount++;
      }
    }
    
    return leftToRightCount / (line.length - 1);
  }

  private calculateScanningConfidence(movements: Array<{ x: number; y: number }>): number {
    // Higher confidence for more rapid, varied movements
    if (movements.length < 3) return 0;
    
    const coverage = this.calculateScreenCoverage(movements);
    return Math.min(1, coverage * 2); // Scale to 0-1 range
  }

  private calculateFocusingConfidence(cluster: Array<{ x: number; y: number }>): number {
    return this.calculateClusterDensity(cluster);
  }

  private calculateSearchingConfidence(movements: Array<{ x: number; y: number }>): number {
    // Higher confidence for more direction changes and coverage
    const coverage = this.calculateScreenCoverage(movements);
    const directionChanges = this.calculateDirectionChanges(movements);
    
    return (coverage + directionChanges) / 2;
  }

  private calculateScreenCoverage(points: Array<{ x: number; y: number }>): number {
    if (points.length === 0) return 0;
    
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    
    const screenWidth = 1920; // Assume standard screen
    const screenHeight = 1080;
    
    const coverageX = (maxX - minX) / screenWidth;
    const coverageY = (maxY - minY) / screenHeight;
    
    return (coverageX + coverageY) / 2;
  }

  private calculateDirectionChanges(points: Array<{ x: number; y: number }>): number {
    if (points.length < 3) return 0;
    
    let changes = 0;
    
    for (let i = 2; i < points.length; i++) {
      const prev = points[i - 2];
      const current = points[i - 1];
      const next = points[i];
      
      const angle1 = Math.atan2(current.y - prev.y, current.x - prev.x);
      const angle2 = Math.atan2(next.y - current.y, next.x - current.x);
      const angleDiff = Math.abs(angle2 - angle1);
      
      if (angleDiff > Math.PI / 4) { // 45 degrees
        changes++;
      }
    }
    
    return changes / (points.length - 2);
  }

  private calculateTotalGazeTime(): number {
    if (this.gazeHistory.length < 2) return 0;
    
    const first = this.gazeHistory[0];
    const last = this.gazeHistory[this.gazeHistory.length - 1];
    
    return last.timestamp - first.timestamp;
  }

  private calculateAverageFixationDuration(): number {
    const fixations = this.identifyFixations();
    if (fixations.length === 0) return 0;
    
    const totalDuration = fixations.reduce((sum, fixation) => sum + fixation.duration, 0);
    return totalDuration / fixations.length;
  }

  private identifyFixations(): Array<{ x: number; y: number; duration: number }> {
    const fixations: Array<{ x: number; y: number; duration: number }> = [];
    const fixationThreshold = 50; // pixels
    
    let currentFixation: { x: number; y: number; startTime: number; points: Array<{ x: number; y: number; timestamp: number }> } | null = null;
    
    for (const point of this.gazeHistory) {
      if (!currentFixation) {
        currentFixation = {
          x: point.x,
          y: point.y,
          startTime: point.timestamp,
          points: [point]
        };
      } else {
        const distance = Math.sqrt(Math.pow(point.x - currentFixation.x, 2) + Math.pow(point.y - currentFixation.y, 2));
        
        if (distance <= fixationThreshold) {
          currentFixation.points.push(point);
          // Update fixation center
          const avgX = currentFixation.points.reduce((sum, p) => sum + p.x, 0) / currentFixation.points.length;
          const avgY = currentFixation.points.reduce((sum, p) => sum + p.y, 0) / currentFixation.points.length;
          currentFixation.x = avgX;
          currentFixation.y = avgY;
        } else {
          // End current fixation
          const duration = point.timestamp - currentFixation.startTime;
          if (duration >= 100) { // Minimum fixation duration
            fixations.push({
              x: currentFixation.x,
              y: currentFixation.y,
              duration
            });
          }
          
          // Start new fixation
          currentFixation = {
            x: point.x,
            y: point.y,
            startTime: point.timestamp,
            points: [point]
          };
        }
      }
    }
    
    return fixations;
  }

  private identifyPreferredRegions(): Array<{ x: number; y: number; preference: number }> {
    const regions: Array<{ x: number; y: number; preference: number }> = [];
    
    // Divide screen into grid and calculate time spent in each region
    const gridSize = 200; // pixels
    const regionMap = new Map<string, { totalTime: number; visits: number }>();
    
    for (let i = 0; i < this.gazeHistory.length - 1; i++) {
      const point = this.gazeHistory[i];
      const nextPoint = this.gazeHistory[i + 1];
      
      const regionX = Math.floor(point.x / gridSize);
      const regionY = Math.floor(point.y / gridSize);
      const regionKey = `${regionX}_${regionY}`;
      
      const duration = nextPoint.timestamp - point.timestamp;
      
      if (!regionMap.has(regionKey)) {
        regionMap.set(regionKey, { totalTime: 0, visits: 0 });
      }
      
      const region = regionMap.get(regionKey)!;
      region.totalTime += duration;
      region.visits++;
    }
    
    // Convert to preferred regions
    const totalTime = this.calculateTotalGazeTime();
    
    for (const [key, data] of regionMap.entries()) {
      const [x, y] = key.split('_').map(Number);
      const preference = data.totalTime / totalTime;
      
      if (preference > 0.01) { // Only include regions with >1% of total time
        regions.push({
          x: x * gridSize + gridSize / 2,
          y: y * gridSize + gridSize / 2,
          preference
        });
      }
    }
    
    return regions.sort((a, b) => b.preference - a.preference).slice(0, 10); // Top 10 regions
  }

  private estimateReadingSpeed(): number {
    // Simplified reading speed estimation (words per minute)
    const readingPatterns = this.detectedPatterns$.value.filter(p => p.type === 'reading');
    if (readingPatterns.length === 0) return 0;
    
    // Estimate based on horizontal movement speed and pattern duration
    let totalWords = 0;
    let totalTime = 0;
    
    for (const pattern of readingPatterns) {
      const points = pattern.points;
      if (points.length < 2) continue;
      
      const duration = points[points.length - 1].timestamp - points[0].timestamp;
      const distance = Math.abs(points[points.length - 1].x - points[0].x);
      
      // Rough estimation: 10 pixels per character, 5 characters per word
      const estimatedWords = distance / 50;
      const timeInMinutes = duration / 60000;
      
      totalWords += estimatedWords;
      totalTime += timeInMinutes;
    }
    
    return totalTime > 0 ? totalWords / totalTime : 0;
  }

  private calculateAttentionSpan(): number {
    // Calculate average duration of focused attention periods
    const fixations = this.identifyFixations();
    if (fixations.length === 0) return 0;
    
    // Group fixations into attention periods
    const attentionPeriods: number[] = [];
    let currentPeriod = 0;
    
    for (let i = 0; i < fixations.length - 1; i++) {
      const current = fixations[i];
      const next = fixations[i + 1];
      
      currentPeriod += current.duration;
      
      // End period if there's a large gap or distance
      if (next.duration > 2000) { // 2 second gap
        attentionPeriods.push(currentPeriod);
        currentPeriod = 0;
      }
    }
    
    if (currentPeriod > 0) {
      attentionPeriods.push(currentPeriod);
    }
    
    if (attentionPeriods.length === 0) return 0;
    
    const totalAttention = attentionPeriods.reduce((sum, period) => sum + period, 0);
    return totalAttention / attentionPeriods.length;
  }

  private calculateTaskEfficiency(): number {
    // Calculate efficiency based on gaze patterns and coverage
    if (this.gazeHistory.length < 10) return 0.5;
    
    const patterns = this.detectedPatterns$.value;
    const totalPatternConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0);
    const avgConfidence = patterns.length > 0 ? totalPatternConfidence / patterns.length : 0.5;
    
    const coverage = this.calculateScreenCoverage(this.gazeHistory);
    const gazeVariability = this.calculateGazeVariability(this.gazeHistory);
    
    // Efficiency = pattern confidence * (1 - excessive coverage) * (1 - excessive variability)
    const efficiencyCoverage = Math.min(1, 1 - Math.max(0, coverage - 0.7));
    const efficiencyVariability = Math.min(1, 1 - Math.max(0, gazeVariability - 0.5));
    
    return avgConfidence * efficiencyCoverage * efficiencyVariability;
  }

  private calculateGazeVariability(points: Array<{ x: number; y: number }>): number {
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const current = points[i];
      const distance = Math.sqrt(Math.pow(current.x - prev.x, 2) + Math.pow(current.y - prev.y, 2));
      totalDistance += distance;
    }
    
    const avgDistance = totalDistance / (points.length - 1);
    
    // Normalize to 0-1 range (assuming max reasonable distance is 500px)
    return Math.min(1, avgDistance / 500);
  }

  private mergePatterns(existing: GazePattern[], newPatterns: GazePattern[]): GazePattern[] {
    // Merge patterns, keeping most recent and highest confidence
    const merged = [...existing];
    
    for (const newPattern of newPatterns) {
      const similarExisting = existing.find(p => 
        p.type === newPattern.type && 
        Math.abs(p.confidence - newPattern.confidence) < 0.2
      );
      
      if (!similarExisting) {
        merged.push(newPattern);
      } else if (newPattern.confidence > similarExisting.confidence) {
        // Replace with higher confidence pattern
        const index = merged.indexOf(similarExisting);
        merged[index] = newPattern;
      }
    }
    
    // Keep only top patterns (max 20)
    return merged
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);
  }

  private loadUserProfile(): void {
    try {
      const stored = localStorage.getItem('visionmouse_predictive_profile');
      if (stored) {
        const profile = JSON.parse(stored);
        this.userProfile$.next(profile);
      }
    } catch (error) {
      console.warn('Failed to load user profile:', error);
    }
  }

  private saveUserProfile(profile: UserBehaviorProfile): void {
    try {
      localStorage.setItem('visionmouse_predictive_profile', JSON.stringify(profile));
    } catch (error) {
      console.warn('Failed to save user profile:', error);
    }
  }

  ngOnDestroy(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }
}
