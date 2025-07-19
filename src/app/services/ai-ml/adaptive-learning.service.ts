import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, filter, debounceTime } from 'rxjs/operators';

export interface LearningParameter {
  name: string;
  value: number;
  range: { min: number; max: number };
  importance: number; // 0-1 weight for optimization
  description: string;
  category: 'calibration' | 'tracking' | 'prediction' | 'filtering';
}

export interface PerformanceMetric {
  name: string;
  value: number;
  target: number;
  weight: number; // Importance in overall performance
  trend: 'improving' | 'stable' | 'declining';
  history: Array<{ timestamp: number; value: number }>;
}

export interface LearningStrategy {
  id: string;
  name: string;
  description: string;
  type: 'gradient_descent' | 'genetic_algorithm' | 'reinforcement' | 'bayesian';
  parameters: LearningParameter[];
  isActive: boolean;
  performance: number; // 0-1 score
  confidence: number;
}

export interface AdaptationEvent {
  timestamp: Date;
  type: 'parameter_update' | 'strategy_change' | 'performance_improvement' | 'user_feedback';
  description: string;
  parameters: Record<string, any>;
  performanceImpact: number; // -1 to 1
  confidence: number;
}

export interface PersonalizationProfile {
  userId: string;
  createdAt: Date;
  lastUpdated: Date;
  sessionCount: number;
  
  // Learned characteristics
  eyeMovementCharacteristics: {
    averageSaccadeSpeed: number;
    preferredFixationDuration: number;
    blinkRate: number;
    trackingStability: number;
  };
  
  // Optimized parameters
  calibrationParameters: Record<string, number>;
  trackingParameters: Record<string, number>;
  predictionParameters: Record<string, number>;
  
  // Performance history
  accuracyHistory: number[];
  stabilityHistory: number[];
  responseTimeHistory: number[];
  
  // Preferences
  preferredCalibrationStrategy: string;
  adaptationSensitivity: number; // 0-1, how quickly to adapt
  feedbackPreferences: {
    enableAutoAdjust: boolean;
    requireConfirmation: boolean;
    showDetailedMetrics: boolean;
  };
}

export interface LearningInsight {
  type: 'optimization' | 'adaptation' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  suggestedActions: string[];
  expectedImprovement: number; // 0-1 expected performance gain
  adaptationRequired: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdaptiveLearningService {
  private learningParameters$ = new BehaviorSubject<LearningParameter[]>([]);
  private performanceMetrics$ = new BehaviorSubject<PerformanceMetric[]>([]);
  private activeStrategies$ = new BehaviorSubject<LearningStrategy[]>([]);
  private personalizationProfile$ = new BehaviorSubject<PersonalizationProfile | null>(null);
  private adaptationEvents$ = new BehaviorSubject<AdaptationEvent[]>([]);
  private learningInsights$ = new BehaviorSubject<LearningInsight[]>([]);
  
  private isLearning = false;
  private learningInterval: any;
  private adaptationThreshold = 0.05; // Minimum improvement to trigger adaptation
  private maxParameterChange = 0.1; // Maximum parameter change per adaptation
  private learningRate = 0.01; // Base learning rate
  
  private performanceHistory: Array<{
    timestamp: number;
    overall: number;
    accuracy: number;
    stability: number;
    responseTime: number;
  }> = [];

  constructor() {
    this.initializeService();
    this.startLearningLoop();
  }

  /**
   * Initialize the adaptive learning service
   */
  initializeService(): void {
    console.log('Initializing Adaptive Learning Service...');
    
    // Initialize default learning parameters
    this.initializeDefaultParameters();
    
    // Initialize performance metrics
    this.initializePerformanceMetrics();
    
    // Initialize learning strategies
    this.initializeLearningStrategies();
    
    // Load existing personalization profile
    this.loadPersonalizationProfile();
    
    console.log('Adaptive Learning Service initialized');
  }

  /**
   * Start continuous learning and adaptation
   */
  startLearning(): void {
    if (this.isLearning) return;
    
    this.isLearning = true;
    console.log('Starting adaptive learning...');
    
    // Continuous learning loop
    this.learningInterval = setInterval(() => {
      this.performLearningCycle();
    }, 10000); // Learn every 10 seconds
  }

  /**
   * Stop learning process
   */
  stopLearning(): void {
    this.isLearning = false;
    
    if (this.learningInterval) {
      clearInterval(this.learningInterval);
      this.learningInterval = null;
    }
    
    console.log('Adaptive learning stopped');
  }

  /**
   * Update performance metrics from system feedback
   */
  updatePerformanceMetrics(metrics: {
    accuracy?: number;
    stability?: number;
    responseTime?: number;
    calibrationError?: number;
    trackingQuality?: number;
  }): void {
    const currentMetrics = this.performanceMetrics$.value;
    const timestamp = Date.now();
    
    // Update individual metrics
    const updatedMetrics = currentMetrics.map(metric => {
      const newValue = metrics[metric.name as keyof typeof metrics];
      if (newValue !== undefined) {
        // Add to history
        metric.history.push({ timestamp, value: newValue });
        
        // Keep only last 100 data points
        if (metric.history.length > 100) {
          metric.history = metric.history.slice(-100);
        }
        
        // Calculate trend
        if (metric.history.length >= 3) {
          const recent = metric.history.slice(-3);
          const trend = this.calculateTrend(recent.map(h => h.value));
          metric.trend = trend;
        }
        
        // Update current value
        const oldValue = metric.value;
        metric.value = newValue;
        
        return { ...metric };
      }
      return metric;
    });
    
    this.performanceMetrics$.next(updatedMetrics);
    
    // Add to overall performance history
    const overall = this.calculateOverallPerformance(metrics);
    this.performanceHistory.push({
      timestamp,
      overall,
      accuracy: metrics.accuracy || 0,
      stability: metrics.stability || 0,
      responseTime: metrics.responseTime || 0
    });
    
    // Trigger adaptation if needed
    this.evaluateAdaptationNeed();
  }

  /**
   * Provide user feedback to guide learning
   */
  provideFeedback(feedback: {
    type: 'positive' | 'negative' | 'suggestion';
    category: 'calibration' | 'tracking' | 'prediction' | 'overall';
    description: string;
    severity?: number; // 0-1 for negative feedback
    parameters?: Record<string, any>;
  }): void {
    const event: AdaptationEvent = {
      timestamp: new Date(),
      type: 'user_feedback',
      description: `${feedback.type}: ${feedback.description}`,
      parameters: {
        category: feedback.category,
        ...feedback.parameters
      },
      performanceImpact: feedback.type === 'positive' ? 0.1 : (feedback.type === 'negative' ? -(feedback.severity || 0.1) : 0),
      confidence: 0.8
    };
    
    this.addAdaptationEvent(event);
    
    // Immediate adaptation for strong negative feedback
    if (feedback.type === 'negative' && (feedback.severity || 0) > 0.7) {
      this.performEmergencyAdaptation(feedback);
    }
  }

  /**
   * Manually trigger parameter optimization
   */
  optimizeParameters(category?: string): void {
    console.log(`Optimizing parameters${category ? ` for ${category}` : ''}...`);
    
    const strategies = this.activeStrategies$.value.filter(s => s.isActive);
    
    for (const strategy of strategies) {
      if (!category || strategy.parameters.some(p => p.category === category)) {
        this.executeOptimizationStrategy(strategy);
      }
    }
    
    this.generateLearningInsights();
  }

  /**
   * Create personalization profile for user
   */
  createPersonalizationProfile(userId: string): PersonalizationProfile {
    const profile: PersonalizationProfile = {
      userId,
      createdAt: new Date(),
      lastUpdated: new Date(),
      sessionCount: 1,
      
      eyeMovementCharacteristics: {
        averageSaccadeSpeed: 300, // Default values
        preferredFixationDuration: 250,
        blinkRate: 17,
        trackingStability: 0.8
      },
      
      calibrationParameters: this.getDefaultCalibrationParameters(),
      trackingParameters: this.getDefaultTrackingParameters(),
      predictionParameters: this.getDefaultPredictionParameters(),
      
      accuracyHistory: [],
      stabilityHistory: [],
      responseTimeHistory: [],
      
      preferredCalibrationStrategy: 'adaptive',
      adaptationSensitivity: 0.5,
      feedbackPreferences: {
        enableAutoAdjust: true,
        requireConfirmation: false,
        showDetailedMetrics: true
      }
    };
    
    this.personalizationProfile$.next(profile);
    this.savePersonalizationProfile(profile);
    
    return profile;
  }

  /**
   * Update personalization profile with learned characteristics
   */
  updatePersonalizationProfile(characteristics: Partial<PersonalizationProfile>): void {
    const currentProfile = this.personalizationProfile$.value;
    if (!currentProfile) return;
    
    const updatedProfile: PersonalizationProfile = {
      ...currentProfile,
      ...characteristics,
      lastUpdated: new Date(),
      sessionCount: currentProfile.sessionCount + 1
    };
    
    this.personalizationProfile$.next(updatedProfile);
    this.savePersonalizationProfile(updatedProfile);
  }

  /**
   * Get optimized parameters for current user
   */
  getOptimizedParameters(category: string): Record<string, number> {
    const profile = this.personalizationProfile$.value;
    if (!profile) return {};
    
    switch (category) {
      case 'calibration':
        return profile.calibrationParameters;
      case 'tracking':
        return profile.trackingParameters;
      case 'prediction':
        return profile.predictionParameters;
      default:
        return {};
    }
  }

  /**
   * Get learning parameters
   */
  getLearningParameters(): Observable<LearningParameter[]> {
    return this.learningParameters$.asObservable();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Observable<PerformanceMetric[]> {
    return this.performanceMetrics$.asObservable();
  }

  /**
   * Get active learning strategies
   */
  getActiveStrategies(): Observable<LearningStrategy[]> {
    return this.activeStrategies$.asObservable();
  }

  /**
   * Get personalization profile
   */
  getPersonalizationProfile(): Observable<PersonalizationProfile | null> {
    return this.personalizationProfile$.asObservable();
  }

  /**
   * Get adaptation events
   */
  getAdaptationEvents(): Observable<AdaptationEvent[]> {
    return this.adaptationEvents$.asObservable();
  }

  /**
   * Get learning insights
   */
  getLearningInsights(): Observable<LearningInsight[]> {
    return this.learningInsights$.asObservable();
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): Observable<{
    overall: number;
    trend: 'improving' | 'stable' | 'declining';
    topMetrics: PerformanceMetric[];
    recommendations: string[];
  }> {
    return this.performanceMetrics$.pipe(
      map(metrics => {
        const overall = this.calculateOverallPerformanceScore(metrics);
        const trend = this.calculateOverallTrend();
        const topMetrics = metrics
          .filter(m => m.value > m.target * 0.9)
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);
        
        const recommendations = this.generatePerformanceRecommendations(metrics);
        
        return {
          overall,
          trend,
          topMetrics,
          recommendations
        };
      })
    );
  }

  // Private helper methods

  private initializeDefaultParameters(): void {
    const defaultParameters: LearningParameter[] = [
      // Calibration parameters
      {
        name: 'calibrationPointCount',
        value: 9,
        range: { min: 5, max: 25 },
        importance: 0.9,
        description: 'Number of calibration points',
        category: 'calibration'
      },
      {
        name: 'calibrationTolerance',
        value: 0.05,
        range: { min: 0.01, max: 0.2 },
        importance: 0.8,
        description: 'Calibration error tolerance',
        category: 'calibration'
      },
      {
        name: 'adaptiveCalibrationThreshold',
        value: 0.1,
        range: { min: 0.05, max: 0.3 },
        importance: 0.7,
        description: 'Threshold for adaptive recalibration',
        category: 'calibration'
      },
      
      // Tracking parameters
      {
        name: 'smoothingFactor',
        value: 0.3,
        range: { min: 0.1, max: 0.8 },
        importance: 0.8,
        description: 'Gaze tracking smoothing factor',
        category: 'tracking'
      },
      {
        name: 'outlierThreshold',
        value: 3.0,
        range: { min: 1.5, max: 5.0 },
        importance: 0.7,
        description: 'Outlier detection threshold (standard deviations)',
        category: 'tracking'
      },
      {
        name: 'temporalWindowSize',
        value: 5,
        range: { min: 3, max: 15 },
        importance: 0.6,
        description: 'Temporal filtering window size',
        category: 'tracking'
      },
      
      // Prediction parameters
      {
        name: 'predictionHorizon',
        value: 200,
        range: { min: 50, max: 500 },
        importance: 0.7,
        description: 'Prediction time horizon (ms)',
        category: 'prediction'
      },
      {
        name: 'velocityWeight',
        value: 0.6,
        range: { min: 0.2, max: 1.0 },
        importance: 0.6,
        description: 'Weight of velocity in prediction',
        category: 'prediction'
      },
      {
        name: 'accelerationWeight',
        value: 0.3,
        range: { min: 0.0, max: 0.8 },
        importance: 0.5,
        description: 'Weight of acceleration in prediction',
        category: 'prediction'
      },
      
      // Filtering parameters
      {
        name: 'kalmanProcessNoise',
        value: 0.01,
        range: { min: 0.001, max: 0.1 },
        importance: 0.6,
        description: 'Kalman filter process noise',
        category: 'filtering'
      },
      {
        name: 'kalmanMeasurementNoise',
        value: 0.1,
        range: { min: 0.01, max: 1.0 },
        importance: 0.6,
        description: 'Kalman filter measurement noise',
        category: 'filtering'
      }
    ];
    
    this.learningParameters$.next(defaultParameters);
  }

  private initializePerformanceMetrics(): void {
    const defaultMetrics: PerformanceMetric[] = [
      {
        name: 'accuracy',
        value: 0.8,
        target: 0.95,
        weight: 0.4,
        trend: 'stable',
        history: []
      },
      {
        name: 'stability',
        value: 0.75,
        target: 0.9,
        weight: 0.3,
        trend: 'stable',
        history: []
      },
      {
        name: 'responseTime',
        value: 150,
        target: 100,
        weight: 0.2,
        trend: 'stable',
        history: []
      },
      {
        name: 'calibrationError',
        value: 0.08,
        target: 0.03,
        weight: 0.1,
        trend: 'stable',
        history: []
      }
    ];
    
    this.performanceMetrics$.next(defaultMetrics);
  }

  private initializeLearningStrategies(): void {
    const strategies: LearningStrategy[] = [
      {
        id: 'gradient_descent_calibration',
        name: 'Gradient Descent Calibration',
        description: 'Optimize calibration parameters using gradient descent',
        type: 'gradient_descent',
        parameters: this.learningParameters$.value.filter(p => p.category === 'calibration'),
        isActive: true,
        performance: 0.7,
        confidence: 0.8
      },
      {
        id: 'bayesian_tracking',
        name: 'Bayesian Tracking Optimization',
        description: 'Optimize tracking parameters using Bayesian optimization',
        type: 'bayesian',
        parameters: this.learningParameters$.value.filter(p => p.category === 'tracking'),
        isActive: true,
        performance: 0.6,
        confidence: 0.7
      },
      {
        id: 'reinforcement_prediction',
        name: 'Reinforcement Learning Prediction',
        description: 'Optimize prediction parameters using reinforcement learning',
        type: 'reinforcement',
        parameters: this.learningParameters$.value.filter(p => p.category === 'prediction'),
        isActive: false,
        performance: 0.5,
        confidence: 0.6
      },
      {
        id: 'genetic_overall',
        name: 'Genetic Algorithm Overall',
        description: 'Global optimization using genetic algorithm',
        type: 'genetic_algorithm',
        parameters: this.learningParameters$.value,
        isActive: false,
        performance: 0.4,
        confidence: 0.5
      }
    ];
    
    this.activeStrategies$.next(strategies);
  }

  private startLearningLoop(): void {
    // Start learning automatically
    this.startLearning();
  }

  private performLearningCycle(): void {
    if (!this.isLearning) return;
    
    try {
      // 1. Evaluate current performance
      const currentPerformance = this.evaluateCurrentPerformance();
      
      // 2. Check if adaptation is needed
      if (this.shouldAdapt(currentPerformance)) {
        // 3. Select and execute optimization strategy
        const strategy = this.selectOptimizationStrategy();
        if (strategy) {
          this.executeOptimizationStrategy(strategy);
        }
      }
      
      // 4. Update personalization profile
      this.updateLearningCharacteristics();
      
      // 5. Generate insights
      this.generateLearningInsights();
      
    } catch (error) {
      console.error('Error in learning cycle:', error);
    }
  }

  private evaluateCurrentPerformance(): number {
    const metrics = this.performanceMetrics$.value;
    return this.calculateOverallPerformanceScore(metrics);
  }

  private shouldAdapt(currentPerformance: number): boolean {
    if (this.performanceHistory.length < 3) return false;
    
    const recentPerformance = this.performanceHistory.slice(-3).map(h => h.overall);
    const averageRecent = recentPerformance.reduce((sum, p) => sum + p, 0) / recentPerformance.length;
    
    // Adapt if performance is below threshold or declining
    return currentPerformance < 0.8 || averageRecent < currentPerformance - this.adaptationThreshold;
  }

  private selectOptimizationStrategy(): LearningStrategy | null {
    const strategies = this.activeStrategies$.value.filter(s => s.isActive);
    if (strategies.length === 0) return null;
    
    // Select strategy with highest performance and confidence
    return strategies.reduce((best, current) => 
      (current.performance * current.confidence) > (best.performance * best.confidence) ? current : best
    );
  }

  private executeOptimizationStrategy(strategy: LearningStrategy): void {
    console.log(`Executing optimization strategy: ${strategy.name}`);
    
    const parameters = this.learningParameters$.value;
    const relevantParams = parameters.filter(p => 
      strategy.parameters.some(sp => sp.name === p.name)
    );
    
    let updatedParams: LearningParameter[] = [];
    
    switch (strategy.type) {
      case 'gradient_descent':
        updatedParams = this.executeGradientDescent(relevantParams);
        break;
      case 'bayesian':
        updatedParams = this.executeBayesianOptimization(relevantParams);
        break;
      case 'reinforcement':
        updatedParams = this.executeReinforcementLearning(relevantParams);
        break;
      case 'genetic_algorithm':
        updatedParams = this.executeGeneticAlgorithm(relevantParams);
        break;
    }
    
    if (updatedParams.length > 0) {
      this.applyParameterUpdates(updatedParams);
      
      const event: AdaptationEvent = {
        timestamp: new Date(),
        type: 'parameter_update',
        description: `Applied ${strategy.name} optimization`,
        parameters: this.parametersToObject(updatedParams),
        performanceImpact: 0, // Will be measured later
        confidence: strategy.confidence
      };
      
      this.addAdaptationEvent(event);
    }
  }

  private executeGradientDescent(parameters: LearningParameter[]): LearningParameter[] {
    const updatedParams: LearningParameter[] = [];
    
    for (const param of parameters) {
      // Simplified gradient estimation using recent performance
      const gradient = this.estimateGradient(param);
      const adjustment = -this.learningRate * gradient;
      
      // Apply bounded update
      const newValue = this.boundValue(
        param.value + adjustment * this.maxParameterChange,
        param.range
      );
      
      if (Math.abs(newValue - param.value) > 0.001) {
        updatedParams.push({
          ...param,
          value: newValue
        });
      }
    }
    
    return updatedParams;
  }

  private executeBayesianOptimization(parameters: LearningParameter[]): LearningParameter[] {
    const updatedParams: LearningParameter[] = [];
    
    for (const param of parameters) {
      // Bayesian optimization using historical performance data
      const optimalValue = this.findBayesianOptimal(param);
      
      if (Math.abs(optimalValue - param.value) > 0.001) {
        updatedParams.push({
          ...param,
          value: optimalValue
        });
      }
    }
    
    return updatedParams;
  }

  private executeReinforcementLearning(parameters: LearningParameter[]): LearningParameter[] {
    const updatedParams: LearningParameter[] = [];
    
    // Q-learning inspired parameter adjustment
    for (const param of parameters) {
      const reward = this.calculateParameterReward(param);
      const exploration = Math.random() < 0.1; // 10% exploration
      
      let newValue: number;
      if (exploration) {
        // Explore: random adjustment within bounds
        const range = param.range.max - param.range.min;
        newValue = param.range.min + Math.random() * range;
      } else {
        // Exploit: move toward higher reward
        const direction = reward > 0 ? 1 : -1;
        const adjustment = direction * this.learningRate * this.maxParameterChange;
        newValue = this.boundValue(param.value + adjustment, param.range);
      }
      
      if (Math.abs(newValue - param.value) > 0.001) {
        updatedParams.push({
          ...param,
          value: newValue
        });
      }
    }
    
    return updatedParams;
  }

  private executeGeneticAlgorithm(parameters: LearningParameter[]): LearningParameter[] {
    // Simplified genetic algorithm
    const populationSize = 10;
    const population = this.generateParameterPopulation(parameters, populationSize);
    
    // Evaluate fitness (performance) for each individual
    const fitness = population.map(individual => this.evaluateParameterFitness(individual));
    
    // Select best individuals
    const selectedIndices = this.selectBestIndividuals(fitness, 5);
    const selected = selectedIndices.map(i => population[i]);
    
    // Create new generation through crossover and mutation
    const newGeneration = this.createNewGeneration(selected, parameters);
    
    // Return best individual from new generation
    return newGeneration[0] || [];
  }

  private estimateGradient(parameter: LearningParameter): number {
    // Estimate gradient using finite difference from recent performance history
    if (this.performanceHistory.length < 2) return 0;
    
    const recent = this.performanceHistory.slice(-5);
    if (recent.length < 2) return 0;
    
    // Simple finite difference approximation
    const deltaPerformance = recent[recent.length - 1].overall - recent[0].overall;
    const deltaTime = recent[recent.length - 1].timestamp - recent[0].timestamp;
    
    // Assume parameter correlation with performance (simplified)
    return deltaPerformance / (deltaTime / 1000); // Per second
  }

  private findBayesianOptimal(parameter: LearningParameter): number {
    // Simplified Bayesian optimization using performance history
    const history = this.performanceHistory.slice(-20); // Last 20 measurements
    if (history.length < 3) return parameter.value;
    
    // Find parameter value that correlates with best performance
    const bestPerformance = Math.max(...history.map(h => h.overall));
    const bestEntry = history.find(h => h.overall === bestPerformance);
    
    if (!bestEntry) return parameter.value;
    
    // Simple interpolation toward best performing value
    const targetValue = parameter.value + (bestPerformance - 0.5) * 0.1; // Simplified mapping
    
    return this.boundValue(targetValue, parameter.range);
  }

  private calculateParameterReward(parameter: LearningParameter): number {
    // Calculate reward based on recent performance change
    if (this.performanceHistory.length < 2) return 0;
    
    const recent = this.performanceHistory.slice(-2);
    const performanceChange = recent[1].overall - recent[0].overall;
    
    // Weight by parameter importance
    return performanceChange * parameter.importance;
  }

  private generateParameterPopulation(parameters: LearningParameter[], size: number): LearningParameter[][] {
    const population: LearningParameter[][] = [];
    
    for (let i = 0; i < size; i++) {
      const individual = parameters.map(param => ({
        ...param,
        value: param.range.min + Math.random() * (param.range.max - param.range.min)
      }));
      population.push(individual);
    }
    
    return population;
  }

  private evaluateParameterFitness(parameters: LearningParameter[]): number {
    // Simplified fitness evaluation based on parameter optimality
    let fitness = 0;
    
    for (const param of parameters) {
      const normalized = (param.value - param.range.min) / (param.range.max - param.range.min);
      const optimality = 1 - Math.abs(0.5 - normalized); // Assume optimal is in middle
      fitness += optimality * param.importance;
    }
    
    return fitness / parameters.length;
  }

  private selectBestIndividuals(fitness: number[], count: number): number[] {
    return fitness
      .map((f, i) => ({ fitness: f, index: i }))
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, count)
      .map(item => item.index);
  }

  private createNewGeneration(parents: LearningParameter[][], template: LearningParameter[]): LearningParameter[][] {
    const newGeneration: LearningParameter[][] = [];
    
    // Keep best parent
    newGeneration.push(parents[0]);
    
    // Create offspring through crossover
    for (let i = 1; i < parents.length; i++) {
      const parent1 = parents[i % parents.length];
      const parent2 = parents[(i + 1) % parents.length];
      const offspring = this.crossover(parent1, parent2, template);
      newGeneration.push(this.mutate(offspring, 0.1)); // 10% mutation rate
    }
    
    return newGeneration;
  }

  private crossover(parent1: LearningParameter[], parent2: LearningParameter[], template: LearningParameter[]): LearningParameter[] {
    const offspring: LearningParameter[] = [];
    
    for (let i = 0; i < template.length; i++) {
      const param = template[i];
      const value = Math.random() < 0.5 ? 
        (parent1[i]?.value || param.value) : 
        (parent2[i]?.value || param.value);
      
      offspring.push({
        ...param,
        value: this.boundValue(value, param.range)
      });
    }
    
    return offspring;
  }

  private mutate(individual: LearningParameter[], mutationRate: number): LearningParameter[] {
    return individual.map(param => {
      if (Math.random() < mutationRate) {
        const range = param.range.max - param.range.min;
        const mutation = (Math.random() - 0.5) * range * 0.1; // 10% of range
        const newValue = this.boundValue(param.value + mutation, param.range);
        
        return {
          ...param,
          value: newValue
        };
      }
      return param;
    });
  }

  private boundValue(value: number, range: { min: number; max: number }): number {
    return Math.max(range.min, Math.min(range.max, value));
  }

  private applyParameterUpdates(updatedParams: LearningParameter[]): void {
    const currentParams = this.learningParameters$.value;
    const newParams = currentParams.map(param => {
      const update = updatedParams.find(up => up.name === param.name);
      return update || param;
    });
    
    this.learningParameters$.next(newParams);
    
    // Update personalization profile
    const profile = this.personalizationProfile$.value;
    if (profile) {
      const parametersByCategory = this.groupParametersByCategory(updatedParams);
      
      const updatedProfile = {
        ...profile,
        calibrationParameters: { ...profile.calibrationParameters, ...parametersByCategory['calibration'] },
        trackingParameters: { ...profile.trackingParameters, ...parametersByCategory['tracking'] },
        predictionParameters: { ...profile.predictionParameters, ...parametersByCategory['prediction'] },
        lastUpdated: new Date()
      };
      
      this.personalizationProfile$.next(updatedProfile);
    }
  }

  private groupParametersByCategory(parameters: LearningParameter[]): Record<string, Record<string, number>> {
    const groups: Record<string, Record<string, number>> = {
      calibration: {},
      tracking: {},
      prediction: {},
      filtering: {}
    };
    
    for (const param of parameters) {
      groups[param.category][param.name] = param.value;
    }
    
    return groups;
  }

  private parametersToObject(parameters: LearningParameter[]): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const param of parameters) {
      obj[param.name] = param.value;
    }
    return obj;
  }

  private addAdaptationEvent(event: AdaptationEvent): void {
    const events = this.adaptationEvents$.value;
    events.push(event);
    
    // Keep only last 100 events
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    
    this.adaptationEvents$.next([...events]);
  }

  private evaluateAdaptationNeed(): void {
    if (this.performanceHistory.length < 5) return;
    
    const recent = this.performanceHistory.slice(-5);
    const averageRecent = recent.reduce((sum, h) => sum + h.overall, 0) / recent.length;
    
    if (averageRecent < 0.7) {
      this.optimizeParameters();
    }
  }

  private performEmergencyAdaptation(feedback: any): void {
    console.log('Performing emergency adaptation based on negative feedback...');
    
    // Quick parameter adjustments based on feedback category
    const params = this.learningParameters$.value;
    const relevantParams = params.filter(p => p.category === feedback.category);
    
    const adjustedParams = relevantParams.map(param => ({
      ...param,
      value: this.boundValue(
        param.value + (Math.random() - 0.5) * 0.2 * (param.range.max - param.range.min),
        param.range
      )
    }));
    
    this.applyParameterUpdates(adjustedParams);
  }

  private updateLearningCharacteristics(): void {
    const profile = this.personalizationProfile$.value;
    if (!profile) return;
    
    // Update eye movement characteristics based on recent data
    if (this.performanceHistory.length >= 5) {
      const recentPerformance = this.performanceHistory.slice(-5);
      const avgAccuracy = recentPerformance.reduce((sum, h) => sum + h.accuracy, 0) / recentPerformance.length;
      const avgStability = recentPerformance.reduce((sum, h) => sum + h.stability, 0) / recentPerformance.length;
      const avgResponseTime = recentPerformance.reduce((sum, h) => sum + h.responseTime, 0) / recentPerformance.length;
      
      const updatedCharacteristics = {
        ...profile.eyeMovementCharacteristics,
        trackingStability: avgStability,
        // Add more characteristic updates based on performance data
      };
      
      profile.accuracyHistory.push(avgAccuracy);
      profile.stabilityHistory.push(avgStability);
      profile.responseTimeHistory.push(avgResponseTime);
      
      // Keep only last 50 history entries
      profile.accuracyHistory = profile.accuracyHistory.slice(-50);
      profile.stabilityHistory = profile.stabilityHistory.slice(-50);
      profile.responseTimeHistory = profile.responseTimeHistory.slice(-50);
      
      const updatedProfile = {
        ...profile,
        eyeMovementCharacteristics: updatedCharacteristics,
        lastUpdated: new Date()
      };
      
      this.personalizationProfile$.next(updatedProfile);
    }
  }

  private generateLearningInsights(): void {
    const insights: LearningInsight[] = [];
    const metrics = this.performanceMetrics$.value;
    const parameters = this.learningParameters$.value;
    
    // Performance optimization insights
    const lowPerformanceMetrics = metrics.filter(m => m.value < m.target * 0.8);
    for (const metric of lowPerformanceMetrics) {
      insights.push({
        type: 'optimization',
        title: `Improve ${metric.name}`,
        description: `${metric.name} is below target (${(metric.value * 100).toFixed(1)}% vs ${(metric.target * 100).toFixed(1)}%)`,
        confidence: 0.8,
        actionable: true,
        suggestedActions: this.generateMetricImprovementActions(metric),
        expectedImprovement: (metric.target - metric.value) / metric.target,
        adaptationRequired: true
      });
    }
    
    // Parameter insights
    const extremeParams = parameters.filter(p => {
      const normalized = (p.value - p.range.min) / (p.range.max - p.range.min);
      return normalized < 0.1 || normalized > 0.9;
    });
    
    for (const param of extremeParams) {
      insights.push({
        type: 'adaptation',
        title: `Parameter at extreme value`,
        description: `${param.name} is at an extreme value, consider adjustment`,
        confidence: 0.6,
        actionable: true,
        suggestedActions: [`Adjust ${param.name} toward middle range`],
        expectedImprovement: 0.1,
        adaptationRequired: true
      });
    }
    
    // Trend insights
    const decliningMetrics = metrics.filter(m => m.trend === 'declining');
    if (decliningMetrics.length > 0) {
      insights.push({
        type: 'prediction',
        title: 'Performance decline detected',
        description: `${decliningMetrics.length} metrics showing declining trend`,
        confidence: 0.7,
        actionable: true,
        suggestedActions: ['Review recent changes', 'Consider recalibration', 'Check environmental factors'],
        expectedImprovement: 0.15,
        adaptationRequired: true
      });
    }
    
    this.learningInsights$.next(insights);
  }

  private generateMetricImprovementActions(metric: PerformanceMetric): string[] {
    const actions: string[] = [];
    
    switch (metric.name) {
      case 'accuracy':
        actions.push('Increase calibration points', 'Reduce calibration tolerance', 'Improve head position stability');
        break;
      case 'stability':
        actions.push('Increase smoothing factor', 'Reduce outlier threshold', 'Optimize temporal filtering');
        break;
      case 'responseTime':
        actions.push('Reduce prediction horizon', 'Optimize processing pipeline', 'Simplify algorithms');
        break;
      case 'calibrationError':
        actions.push('Increase calibration accuracy', 'Add more calibration points', 'Improve point distribution');
        break;
      default:
        actions.push('Optimize related parameters', 'Review system configuration');
    }
    
    return actions;
  }

  private calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = (last - first) / first;
    
    if (change > 0.05) return 'improving';
    if (change < -0.05) return 'declining';
    return 'stable';
  }

  private calculateOverallPerformance(metrics: {
    accuracy?: number;
    stability?: number;
    responseTime?: number;
    calibrationError?: number;
    trackingQuality?: number;
  }): number {
    // Weighted average of metrics
    let score = 0;
    let totalWeight = 0;
    
    if (metrics.accuracy !== undefined) {
      score += metrics.accuracy * 0.4;
      totalWeight += 0.4;
    }
    
    if (metrics.stability !== undefined) {
      score += metrics.stability * 0.3;
      totalWeight += 0.3;
    }
    
    if (metrics.responseTime !== undefined) {
      // Convert response time to score (lower is better)
      const responseScore = Math.max(0, 1 - (metrics.responseTime - 50) / 200);
      score += responseScore * 0.2;
      totalWeight += 0.2;
    }
    
    if (metrics.calibrationError !== undefined) {
      // Convert error to score (lower is better)
      const errorScore = Math.max(0, 1 - metrics.calibrationError / 0.2);
      score += errorScore * 0.1;
      totalWeight += 0.1;
    }
    
    return totalWeight > 0 ? score / totalWeight : 0.5;
  }

  private calculateOverallPerformanceScore(metrics: PerformanceMetric[]): number {
    let weightedScore = 0;
    let totalWeight = 0;
    
    for (const metric of metrics) {
      let normalizedValue: number;
      
      if (metric.name === 'responseTime' || metric.name === 'calibrationError') {
        // For metrics where lower is better
        normalizedValue = Math.max(0, 1 - metric.value / (metric.target * 2));
      } else {
        // For metrics where higher is better
        normalizedValue = metric.value;
      }
      
      weightedScore += normalizedValue * metric.weight;
      totalWeight += metric.weight;
    }
    
    return totalWeight > 0 ? weightedScore / totalWeight : 0.5;
  }

  private calculateOverallTrend(): 'improving' | 'stable' | 'declining' {
    if (this.performanceHistory.length < 5) return 'stable';
    
    const recent = this.performanceHistory.slice(-5).map(h => h.overall);
    return this.calculateTrend(recent);
  }

  private generatePerformanceRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];
    
    for (const metric of metrics) {
      if (metric.value < metric.target * 0.9) {
        recommendations.push(...this.generateMetricImprovementActions(metric));
      }
    }
    
    // Remove duplicates
    return Array.from(new Set(recommendations));
  }

  private getDefaultCalibrationParameters(): Record<string, number> {
    return {
      calibrationPointCount: 9,
      calibrationTolerance: 0.05,
      adaptiveCalibrationThreshold: 0.1
    };
  }

  private getDefaultTrackingParameters(): Record<string, number> {
    return {
      smoothingFactor: 0.3,
      outlierThreshold: 3.0,
      temporalWindowSize: 5
    };
  }

  private getDefaultPredictionParameters(): Record<string, number> {
    return {
      predictionHorizon: 200,
      velocityWeight: 0.6,
      accelerationWeight: 0.3
    };
  }

  private loadPersonalizationProfile(): void {
    try {
      const stored = localStorage.getItem('visionmouse_personalization_profile');
      if (stored) {
        const profile = JSON.parse(stored);
        // Convert date strings back to Date objects
        profile.createdAt = new Date(profile.createdAt);
        profile.lastUpdated = new Date(profile.lastUpdated);
        
        this.personalizationProfile$.next(profile);
      }
    } catch (error) {
      console.warn('Failed to load personalization profile:', error);
    }
  }

  private savePersonalizationProfile(profile: PersonalizationProfile): void {
    try {
      localStorage.setItem('visionmouse_personalization_profile', JSON.stringify(profile));
    } catch (error) {
      console.warn('Failed to save personalization profile:', error);
    }
  }

  ngOnDestroy(): void {
    this.stopLearning();
  }
}
