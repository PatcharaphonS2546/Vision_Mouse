import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SmartCalibrationPoint {
  x: number;
  y: number;
  importance: number; // 0-1, how critical this point is
  confidence: number; // 0-1, prediction confidence
  adaptiveWeight: number; // Dynamic weighting based on user patterns
}

export interface CalibrationStrategy {
  id: string;
  name: string;
  description: string;
  minPoints: number;
  maxPoints: number;
  strategy: 'minimal' | 'adaptive' | 'comprehensive' | 'intelligent';
}

export interface UserCalibrationProfile {
  userId: string;
  totalSessions: number;
  averageAccuracy: number;
  preferredStrategy: string;
  difficultAreas: { x: number; y: number; difficulty: number }[];
  learningProgress: number; // 0-1
  lastCalibrationQuality: number; // 0-1
}

export interface CalibrationOptimization {
  recommendedPoints: SmartCalibrationPoint[];
  estimatedAccuracy: number;
  timeEstimate: number; // seconds
  confidenceScore: number;
  adaptations: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SmartCalibrationService {
  private userProfile$ = new BehaviorSubject<UserCalibrationProfile | null>(null);
  private calibrationProgress$ = new BehaviorSubject<number>(0);
  private currentStrategy$ = new BehaviorSubject<CalibrationStrategy | null>(null);
  private isLearning$ = new BehaviorSubject<boolean>(false);

  private readonly CALIBRATION_STRATEGIES: CalibrationStrategy[] = [
    {
      id: 'minimal',
      name: 'Minimal Calibration',
      description: 'AI-optimized 3-point calibration for quick setup',
      minPoints: 3,
      maxPoints: 5,
      strategy: 'minimal'
    },
    {
      id: 'adaptive',
      name: 'Adaptive Calibration',
      description: 'Intelligent point selection based on user patterns',
      minPoints: 5,
      maxPoints: 9,
      strategy: 'adaptive'
    },
    {
      id: 'comprehensive',
      name: 'Comprehensive Calibration',
      description: 'Full-screen calibration for maximum accuracy',
      minPoints: 9,
      maxPoints: 16,
      strategy: 'comprehensive'
    },
    {
      id: 'intelligent',
      name: 'AI-Powered Calibration',
      description: 'Machine learning optimized calibration process',
      minPoints: 4,
      maxPoints: 12,
      strategy: 'intelligent'
    }
  ];

  private screenDimensions = { width: 1920, height: 1080 };
  private currentProfile: UserCalibrationProfile | null = null;
  private calibrationHistory: Array<{
    timestamp: Date;
    strategy: string;
    points: SmartCalibrationPoint[];
    accuracy: number;
    duration: number;
  }> = [];

  constructor() {
    this.initializeDefaultProfile();
    this.loadUserProfile();
  }

  /**
   * Initialize smart calibration with user profile
   */
  async initializeSmartCalibration(userId: string): Promise<void> {
    try {
      this.currentProfile = await this.loadOrCreateUserProfile(userId);
      this.userProfile$.next(this.currentProfile);
      
      // Select optimal strategy based on user history
      const optimalStrategy = this.selectOptimalStrategy(this.currentProfile);
      this.currentStrategy$.next(optimalStrategy);

      console.log(`Smart calibration initialized for user ${userId} with strategy: ${optimalStrategy.name}`);
    } catch (error) {
      console.error('Failed to initialize smart calibration:', error);
      this.initializeDefaultProfile();
    }
  }

  /**
   * Generate optimal calibration points using AI
   */
  generateSmartCalibrationPoints(strategy?: CalibrationStrategy): CalibrationOptimization {
    const selectedStrategy = strategy || this.getCurrentStrategy();
    const profile = this.currentProfile;

    let points: SmartCalibrationPoint[];
    let estimatedAccuracy: number;
    let adaptations: string[] = [];

    switch (selectedStrategy.strategy) {
      case 'minimal':
        points = this.generateMinimalPoints();
        estimatedAccuracy = 0.85;
        adaptations.push('Reduced calibration points for quick setup');
        break;

      case 'adaptive':
        points = this.generateAdaptivePoints(profile);
        estimatedAccuracy = 0.92;
        adaptations.push('Points adapted to user patterns');
        break;

      case 'comprehensive':
        points = this.generateComprehensivePoints();
        estimatedAccuracy = 0.96;
        adaptations.push('Full coverage for maximum accuracy');
        break;

      case 'intelligent':
        points = this.generateIntelligentPoints(profile);
        estimatedAccuracy = 0.94;
        adaptations.push('AI-optimized point placement');
        adaptations.push('Difficulty-based point weighting');
        break;

      default:
        points = this.generateAdaptivePoints(profile);
        estimatedAccuracy = 0.90;
    }

    // Apply user-specific optimizations
    if (profile) {
      points = this.applyUserOptimizations(points, profile);
      estimatedAccuracy = this.adjustAccuracyPrediction(estimatedAccuracy, profile);
    }

    const timeEstimate = this.estimateCalibrationTime(points, profile);
    const confidenceScore = this.calculateConfidenceScore(points, profile);

    return {
      recommendedPoints: points,
      estimatedAccuracy,
      timeEstimate,
      confidenceScore,
      adaptations
    };
  }

  /**
   * Start smart calibration process
   */
  async startSmartCalibration(optimization: CalibrationOptimization): Promise<boolean> {
    try {
      this.isLearning$.next(true);
      this.calibrationProgress$.next(0);

      console.log(`Starting smart calibration with ${optimization.recommendedPoints.length} points`);
      console.log(`Estimated accuracy: ${(optimization.estimatedAccuracy * 100).toFixed(1)}%`);
      console.log(`Estimated time: ${optimization.timeEstimate} seconds`);

      // Simulate calibration progress
      for (let i = 0; i < optimization.recommendedPoints.length; i++) {
        const progress = (i + 1) / optimization.recommendedPoints.length;
        this.calibrationProgress$.next(progress);
        
        // Simulate processing time per point
        await this.processCalibrationPoint(optimization.recommendedPoints[i]);
      }

      this.calibrationProgress$.next(1);
      this.isLearning$.next(false);

      // Record calibration session
      await this.recordCalibrationSession(optimization);

      console.log('Smart calibration completed successfully');
      return true;

    } catch (error) {
      console.error('Smart calibration failed:', error);
      this.isLearning$.next(false);
      return false;
    }
  }

  /**
   * Analyze calibration quality and provide feedback
   */
  analyzeCalibrationQuality(actualAccuracy: number, expectedAccuracy: number): {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    feedback: string[];
    improvements: string[];
  } {
    const qualityRatio = actualAccuracy / expectedAccuracy;
    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    const feedback: string[] = [];
    const improvements: string[] = [];

    if (qualityRatio >= 0.95) {
      quality = 'excellent';
      feedback.push('Calibration quality is excellent!');
      feedback.push('AI predictions were highly accurate');
    } else if (qualityRatio >= 0.85) {
      quality = 'good';
      feedback.push('Good calibration quality achieved');
      feedback.push('Minor deviations from predicted accuracy');
    } else if (qualityRatio >= 0.70) {
      quality = 'fair';
      feedback.push('Fair calibration quality');
      feedback.push('Some areas may need attention');
      improvements.push('Consider additional calibration points');
    } else {
      quality = 'poor';
      feedback.push('Calibration quality needs improvement');
      feedback.push('Significant accuracy issues detected');
      improvements.push('Try different calibration strategy');
      improvements.push('Check lighting and camera positioning');
    }

    // Add specific recommendations
    if (actualAccuracy < 0.8) {
      improvements.push('Use comprehensive calibration strategy');
      improvements.push('Ensure stable head position during calibration');
    }

    return { quality, feedback, improvements };
  }

  /**
   * Update user profile with learning data
   */
  async updateUserProfile(
    accuracy: number, 
    duration: number, 
    strategy: CalibrationStrategy,
    userFeedback?: number
  ): Promise<void> {
    if (!this.currentProfile) return;

    try {
      // Update session statistics
      this.currentProfile.totalSessions++;
      this.currentProfile.averageAccuracy = 
        (this.currentProfile.averageAccuracy * (this.currentProfile.totalSessions - 1) + accuracy) / 
        this.currentProfile.totalSessions;

      // Update learning progress
      const progressIncrease = this.calculateLearningProgress(accuracy, duration);
      this.currentProfile.learningProgress = Math.min(1, this.currentProfile.learningProgress + progressIncrease);

      // Update last calibration quality
      this.currentProfile.lastCalibrationQuality = accuracy;

      // Update preferred strategy if this one performed better
      if (accuracy > this.currentProfile.averageAccuracy) {
        this.currentProfile.preferredStrategy = strategy.id;
      }

      // Save updated profile
      await this.saveUserProfile(this.currentProfile);
      this.userProfile$.next(this.currentProfile);

      console.log(`User profile updated: ${this.currentProfile.totalSessions} sessions, ${(this.currentProfile.averageAccuracy * 100).toFixed(1)}% avg accuracy`);

    } catch (error) {
      console.error('Failed to update user profile:', error);
    }
  }

  /**
   * Get available calibration strategies
   */
  getCalibrationStrategies(): CalibrationStrategy[] {
    return [...this.CALIBRATION_STRATEGIES];
  }

  /**
   * Get recommended strategy for current user
   */
  getRecommendedStrategy(): CalibrationStrategy {
    if (!this.currentProfile) {
      return this.CALIBRATION_STRATEGIES.find(s => s.id === 'adaptive')!;
    }

    return this.selectOptimalStrategy(this.currentProfile);
  }

  /**
   * Observable streams for UI
   */
  get userProfile(): Observable<UserCalibrationProfile | null> {
    return this.userProfile$.asObservable();
  }

  get calibrationProgress(): Observable<number> {
    return this.calibrationProgress$.asObservable();
  }

  get currentStrategy(): Observable<CalibrationStrategy | null> {
    return this.currentStrategy$.asObservable();
  }

  get isLearning(): Observable<boolean> {
    return this.isLearning$.asObservable();
  }

  // Private helper methods

  private generateMinimalPoints(): SmartCalibrationPoint[] {
    const points: SmartCalibrationPoint[] = [
      { x: 0.2, y: 0.2, importance: 1.0, confidence: 0.9, adaptiveWeight: 1.0 },
      { x: 0.8, y: 0.2, importance: 1.0, confidence: 0.9, adaptiveWeight: 1.0 },
      { x: 0.5, y: 0.8, importance: 1.0, confidence: 0.9, adaptiveWeight: 1.0 }
    ];
    return points;
  }

  private generateAdaptivePoints(profile: UserCalibrationProfile | null): SmartCalibrationPoint[] {
    const basePoints = [
      { x: 0.1, y: 0.1, importance: 0.8, confidence: 0.85, adaptiveWeight: 1.0 },
      { x: 0.5, y: 0.1, importance: 0.9, confidence: 0.9, adaptiveWeight: 1.0 },
      { x: 0.9, y: 0.1, importance: 0.8, confidence: 0.85, adaptiveWeight: 1.0 },
      { x: 0.1, y: 0.5, importance: 0.9, confidence: 0.9, adaptiveWeight: 1.0 },
      { x: 0.5, y: 0.5, importance: 1.0, confidence: 0.95, adaptiveWeight: 1.0 },
      { x: 0.9, y: 0.5, importance: 0.9, confidence: 0.9, adaptiveWeight: 1.0 },
      { x: 0.1, y: 0.9, importance: 0.8, confidence: 0.85, adaptiveWeight: 1.0 },
      { x: 0.5, y: 0.9, importance: 0.9, confidence: 0.9, adaptiveWeight: 1.0 },
      { x: 0.9, y: 0.9, importance: 0.8, confidence: 0.85, adaptiveWeight: 1.0 }
    ];

    // Adapt points based on user's difficult areas
    if (profile && profile.difficultAreas.length > 0) {
      profile.difficultAreas.forEach(area => {
        const point = basePoints.find(p => 
          Math.abs(p.x - area.x / this.screenDimensions.width) < 0.2 &&
          Math.abs(p.y - area.y / this.screenDimensions.height) < 0.2
        );
        if (point) {
          point.importance = Math.min(1.0, point.importance + area.difficulty * 0.3);
          point.adaptiveWeight = Math.min(1.5, point.adaptiveWeight + area.difficulty * 0.2);
        }
      });
    }

    return basePoints;
  }

  private generateComprehensivePoints(): SmartCalibrationPoint[] {
    const points: SmartCalibrationPoint[] = [];
    
    // 4x4 grid for comprehensive coverage
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = (col + 1) / 5; // 0.2, 0.4, 0.6, 0.8
        const y = (row + 1) / 5; // 0.2, 0.4, 0.6, 0.8
        
        // Center point has highest importance
        const importance = (row === 1 || row === 2) && (col === 1 || col === 2) ? 1.0 : 0.8;
        
        points.push({
          x,
          y,
          importance,
          confidence: 0.9,
          adaptiveWeight: 1.0
        });
      }
    }

    return points;
  }

  private generateIntelligentPoints(profile: UserCalibrationProfile | null): SmartCalibrationPoint[] {
    // Start with adaptive points as base
    let points = this.generateAdaptivePoints(profile);

    // Apply AI optimizations
    if (profile) {
      // Remove points in easy areas if user has high accuracy
      if (profile.averageAccuracy > 0.9 && profile.totalSessions > 5) {
        points = points.filter(p => p.importance > 0.85);
      }

      // Add extra points in difficult areas
      profile.difficultAreas.forEach(area => {
        if (area.difficulty > 0.7) {
          points.push({
            x: area.x / this.screenDimensions.width,
            y: area.y / this.screenDimensions.height,
            importance: 0.9 + area.difficulty * 0.1,
            confidence: 0.8,
            adaptiveWeight: 1.2 + area.difficulty * 0.3
          });
        }
      });

      // Limit total points based on user experience
      const maxPoints = profile.learningProgress > 0.8 ? 8 : 12;
      if (points.length > maxPoints) {
        points = points
          .sort((a, b) => b.importance - a.importance)
          .slice(0, maxPoints);
      }
    }

    return points;
  }

  private applyUserOptimizations(
    points: SmartCalibrationPoint[], 
    profile: UserCalibrationProfile
  ): SmartCalibrationPoint[] {
    return points.map(point => {
      // Adjust confidence based on user's learning progress
      const confidenceBoost = profile.learningProgress * 0.1;
      point.confidence = Math.min(1.0, point.confidence + confidenceBoost);

      // Adjust importance based on historical accuracy
      if (profile.averageAccuracy > 0.9) {
        point.importance *= 1.1;
      }

      return point;
    });
  }

  private adjustAccuracyPrediction(baseAccuracy: number, profile: UserCalibrationProfile): number {
    // Adjust prediction based on user's historical performance
    const performanceFactor = profile.averageAccuracy / 0.85; // Normalize to expected baseline
    const experienceFactor = 1 + (profile.learningProgress * 0.1);
    
    return Math.min(0.98, baseAccuracy * performanceFactor * experienceFactor);
  }

  private estimateCalibrationTime(points: SmartCalibrationPoint[], profile: UserCalibrationProfile | null): number {
    const baseTimePerPoint = 3; // seconds
    const setupTime = 5; // seconds
    
    let timePerPoint = baseTimePerPoint;
    
    if (profile) {
      // Experienced users are faster
      const experienceReduction = profile.learningProgress * 0.5;
      timePerPoint = Math.max(2, baseTimePerPoint - experienceReduction);
    }

    return setupTime + (points.length * timePerPoint);
  }

  private calculateConfidenceScore(points: SmartCalibrationPoint[], profile: UserCalibrationProfile | null): number {
    const avgConfidence = points.reduce((sum, p) => sum + p.confidence, 0) / points.length;
    const pointsQuality = Math.min(1, points.length / 9); // Optimal around 9 points
    
    let profileBonus = 0;
    if (profile) {
      profileBonus = profile.learningProgress * 0.1;
    }

    return Math.min(1, avgConfidence * pointsQuality + profileBonus);
  }

  private async processCalibrationPoint(point: SmartCalibrationPoint): Promise<void> {
    // Simulate processing time based on point importance
    const processingTime = 200 + (point.importance * 300);
    await new Promise(resolve => setTimeout(resolve, processingTime));
  }

  private async recordCalibrationSession(optimization: CalibrationOptimization): Promise<void> {
    const session = {
      timestamp: new Date(),
      strategy: this.getCurrentStrategy().id,
      points: optimization.recommendedPoints,
      accuracy: optimization.estimatedAccuracy,
      duration: optimization.timeEstimate
    };

    this.calibrationHistory.push(session);

    // Keep only last 50 sessions
    if (this.calibrationHistory.length > 50) {
      this.calibrationHistory = this.calibrationHistory.slice(-50);
    }

    // Save to localStorage
    try {
      localStorage.setItem('visionmouse_calibration_history', JSON.stringify(this.calibrationHistory));
    } catch (error) {
      console.warn('Failed to save calibration history:', error);
    }
  }

  private calculateLearningProgress(accuracy: number, duration: number): number {
    // Calculate learning progress increase based on performance
    const accuracyBonus = Math.max(0, accuracy - 0.8) * 0.1;
    const efficiencyBonus = Math.max(0, (30 - duration) / 30) * 0.05;
    
    return Math.min(0.1, accuracyBonus + efficiencyBonus + 0.01); // Base progress + bonuses
  }

  private selectOptimalStrategy(profile: UserCalibrationProfile): CalibrationStrategy {
    // Select strategy based on user profile
    if (profile.totalSessions < 3) {
      return this.CALIBRATION_STRATEGIES.find(s => s.id === 'adaptive')!;
    }

    if (profile.averageAccuracy > 0.9 && profile.learningProgress > 0.7) {
      return this.CALIBRATION_STRATEGIES.find(s => s.id === 'minimal')!;
    }

    if (profile.averageAccuracy < 0.8) {
      return this.CALIBRATION_STRATEGIES.find(s => s.id === 'comprehensive')!;
    }

    // Use preferred strategy if available
    const preferred = this.CALIBRATION_STRATEGIES.find(s => s.id === profile.preferredStrategy);
    return preferred || this.CALIBRATION_STRATEGIES.find(s => s.id === 'intelligent')!;
  }

  private getCurrentStrategy(): CalibrationStrategy {
    return this.currentStrategy$.value || this.CALIBRATION_STRATEGIES.find(s => s.id === 'adaptive')!;
  }

  private async loadOrCreateUserProfile(userId: string): Promise<UserCalibrationProfile> {
    try {
      const stored = localStorage.getItem(`visionmouse_profile_${userId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load user profile:', error);
    }

    // Create new profile
    const newProfile: UserCalibrationProfile = {
      userId,
      totalSessions: 0,
      averageAccuracy: 0.85,
      preferredStrategy: 'adaptive',
      difficultAreas: [],
      learningProgress: 0,
      lastCalibrationQuality: 0
    };

    await this.saveUserProfile(newProfile);
    return newProfile;
  }

  private async saveUserProfile(profile: UserCalibrationProfile): Promise<void> {
    try {
      localStorage.setItem(`visionmouse_profile_${profile.userId}`, JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  }

  private loadUserProfile(): void {
    try {
      const defaultUserId = 'default_user';
      this.loadOrCreateUserProfile(defaultUserId).then(profile => {
        this.currentProfile = profile;
        this.userProfile$.next(profile);
      });
    } catch (error) {
      console.warn('Failed to load default user profile:', error);
    }
  }

  private initializeDefaultProfile(): void {
    this.currentProfile = {
      userId: 'default_user',
      totalSessions: 0,
      averageAccuracy: 0.85,
      preferredStrategy: 'adaptive',
      difficultAreas: [],
      learningProgress: 0,
      lastCalibrationQuality: 0
    };
    this.userProfile$.next(this.currentProfile);
  }
}
