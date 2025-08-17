/**
 * Testing Interfaces
 * Comprehensive interface definitions for eye tracking testing and validation
 */

import { Point2D, QualityLevel } from './core.interface';

// Test Configuration Interfaces
export interface TestConfiguration {
  name: string;
  type: TestType;
  pattern: TestPattern;
  targetCount: number;
  targetDuration: number;
  accuracyThreshold: number;
  recordGazeTrail: boolean;
  showFeedback: boolean;
  description?: string;
  difficulty?: DifficultyLevel;
  customSettings?: TestCustomSettings;
}

export type TestType = 'accuracy' | 'precision' | 'stability' | 'response' | 'drift' | 'comprehensive' | 'calibration-validation';

export type TestPattern = 'grid' | 'random' | 'circular' | 'diagonal' | 'fixation' | 'spiral' | 'figure-eight' | 'custom';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export interface TestCustomSettings {
  targetSize?: number;
  targetColor?: string;
  backgroundColor?: string;
  showCrosshair?: boolean;
  enableSound?: boolean;
  warmupTargets?: number;
  cooldownPeriod?: number;
}

// Test Session Interfaces
export interface TestSession {
  id: string;
  configuration: TestConfiguration;
  targets: TestTarget[];
  startTime?: Date;
  endTime?: Date;
  status: TestStatus;
  currentTargetIndex: number;
  results?: TestResults;
  metadata: TestSessionMetadata;
  participantInfo?: ParticipantInfo;
}

export type TestStatus = 'preparing' | 'warming-up' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface TestSessionMetadata {
  sessionId: string;
  createdAt: Date;
  version: string;
  deviceInfo: DeviceInfo;
  environmentInfo: EnvironmentInfo;
  calibrationInfo?: CalibrationInfo;
}

export interface ParticipantInfo {
  id?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  visionCorrection?: 'none' | 'glasses' | 'contacts' | 'both';
  experienceLevel?: 'novice' | 'intermediate' | 'expert';
  notes?: string;
}

export interface DeviceInfo {
  userAgent: string;
  screenResolution: { width: number; height: number };
  pixelRatio: number;
  cameraInfo?: {
    resolution: { width: number; height: number };
    frameRate: number;
    deviceId: string;
  };
}

export interface EnvironmentInfo {
  lightingLevel: number;
  ambientNoise: number;
  timestamp: Date;
  conditions: EnvironmentalConditions;
}

export interface EnvironmentalConditions {
  lighting: 'optimal' | 'bright' | 'dim' | 'variable' | 'unknown';
  headMovement: 'minimal' | 'moderate' | 'excessive';
  eyeVisibility: 'excellent' | 'good' | 'poor';
  backgroundNoise: 'low' | 'medium' | 'high';
  distractions: 'none' | 'minimal' | 'moderate' | 'high';
}

export interface CalibrationInfo {
  lastCalibrationTime: Date;
  calibrationQuality: QualityLevel;
  calibrationPoints: number;
  calibrationAccuracy: number;
  ageInMinutes: number;
}

// Test Target Interfaces
export interface TestTarget {
  id: string;
  position: Point2D;
  size: number;
  color?: string;
  shape?: TargetShape;
  isActive: boolean;
  startTime?: number;
  endTime?: number;
  gazePoints: GazePoint[];
  accuracy?: number;
  responseTime?: number;
  completed: boolean;
  metadata: TargetMetadata;
}

export type TargetShape = 'circle' | 'square' | 'crosshair' | 'dot' | 'ring';

export interface TargetMetadata {
  sequence: number;
  expectedDuration: number;
  actualDuration?: number;
  fixationDetected: boolean;
  saccadeDetected: boolean;
  qualityFlags: QualityFlag[];
}

export type QualityFlag = 'low-confidence' | 'excessive-movement' | 'poor-lighting' | 'blink-detected' | 'head-movement' | 'calibration-drift';

export interface GazePoint extends Point2D {
  timestamp: number;
  confidence: number;
  quality?: QualityLevel;
  isFiltered?: boolean;
  rawPoint?: Point2D;
  metadata?: GazePointMetadata;
}

export interface GazePointMetadata {
  eyeFeatures?: EyeFeatures;
  headPose?: HeadPose;
  environmentalFactors?: EnvironmentalFactors;
  processingFlags?: ProcessingFlag[];
}

export interface EyeFeatures {
  leftEye: EyeData;
  rightEye: EyeData;
  interOcularDistance: number;
  dominantEye: 'left' | 'right' | 'neither';
}

export interface EyeData {
  center: Point2D;
  pupilSize: number;
  eyelidOpenness: number;
  blinkDetected: boolean;
  gazeVector: { x: number; y: number; z: number };
}

export interface HeadPose {
  rotation: { pitch: number; yaw: number; roll: number };
  translation: { x: number; y: number; z: number };
  confidence: number;
}

export interface EnvironmentalFactors {
  lightingCondition: 'optimal' | 'bright' | 'dim' | 'variable';
  headMovement: 'minimal' | 'moderate' | 'excessive';
  eyeVisibility: 'excellent' | 'good' | 'poor';
  backgroundNoise: 'low' | 'medium' | 'high';
  calibrationAge: number;
}

export type ProcessingFlag = 'smoothed' | 'interpolated' | 'extrapolated' | 'outlier-removed' | 'confidence-boosted';

// Test Results Interfaces
export interface TestResults {
  overallAccuracy: number;
  averageResponseTime: number;
  precision: number;
  consistency: number;
  stability: number;
  qualityScore: number;
  targetResults: TargetResult[];
  spatialAnalysis: SpatialAnalysis;
  temporalAnalysis: TemporalAnalysis;
  gazeAnalysis: GazeAnalysis;
  recommendations: Recommendation[];
  environmentalFactors: EnvironmentalFactors;
  statisticalSummary: StatisticalSummary;
  comparisonData?: ComparisonData;
}

export interface TargetResult {
  targetId: string;
  position: Point2D;
  accuracy: number;
  responseTime: number;
  gazeTrail: Point2D[];
  fixationPoints: FixationPoint[];
  saccadePaths: SaccadePath[];
  qualityMetrics: TargetQualityMetrics;
  statisticalData: TargetStatisticalData;
}

export interface TargetQualityMetrics {
  dataCompleteness: number;
  signalToNoise: number;
  temporalConsistency: number;
  spatialStability: number;
  confidenceLevel: number;
}

export interface TargetStatisticalData {
  meanError: Point2D;
  standardDeviation: Point2D;
  variance: Point2D;
  outlierCount: number;
  validSampleCount: number;
}

export interface FixationPoint extends Point2D {
  duration: number;
  stability: number;
  quality: QualityLevel;
  dispersion: number;
  sampleCount: number;
  confidence: number;
}

export interface SaccadePath {
  from: Point2D;
  to: Point2D;
  duration: number;
  velocity: number;
  accuracy: number;
  amplitude: number;
  peak_velocity: number;
  latency: number;
}

export interface SpatialAnalysis {
  averageOffset: Point2D;
  offsetMagnitude: number;
  precisionRadius: number;
  spatialDistribution: SpatialDistribution;
  regionAccuracy: RegionAccuracy;
  heatmapData: HeatmapPoint[];
}

export interface SpatialDistribution {
  quadrants: number[];
  zones: ZoneAccuracy[];
  radialDistribution: RadialData[];
}

export interface ZoneAccuracy {
  zone: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  accuracy: number;
  sampleCount: number;
}

export interface RadialData {
  radius: number;
  accuracy: number;
  density: number;
}

export interface RegionAccuracy {
  cornerAccuracy: number[];
  edgeAccuracy: number[];
  centerAccuracy: number;
  peripheryAccuracy: number;
}

export interface HeatmapPoint extends Point2D {
  density: number;
  accuracy: number;
  frequency: number;
}

export interface TemporalAnalysis {
  driftRate: number;
  stabilityOverTime: number[];
  fatigueEffect: number;
  learningCurve: number[];
  consistencyMetric: number;
  responseTimeProgression: number[];
  accuracyProgression: number[];
  timeSeriesData: TimeSeriesData[];
}

export interface TimeSeriesData {
  timestamp: number;
  accuracy: number;
  responseTime: number;
  confidence: number;
  stability: number;
}

export interface GazeAnalysis {
  fixationAnalysis: FixationAnalysis;
  saccadeAnalysis: SaccadeAnalysis;
  smoothPursuitAnalysis: SmoothPursuitAnalysis;
  blinkAnalysis: BlinkAnalysis;
  attentionAnalysis: AttentionAnalysis;
}

export interface FixationAnalysis {
  averageDuration: number;
  fixationCount: number;
  fixationRate: number;
  stabilityIndex: number;
  dispersionMetrics: DispersionMetrics;
}

export interface DispersionMetrics {
  averageDispersion: number;
  maxDispersion: number;
  dispersionVariability: number;
}

export interface SaccadeAnalysis {
  saccadeCount: number;
  averageAmplitude: number;
  averageVelocity: number;
  averageLatency: number;
  accuracyMetrics: SaccadeAccuracyMetrics;
}

export interface SaccadeAccuracyMetrics {
  overshootRate: number;
  undershootRate: number;
  directionalAccuracy: number;
  velocityConsistency: number;
}

export interface SmoothPursuitAnalysis {
  gainValue: number;
  phaseShift: number;
  catchUpSaccades: number;
  smoothnessIndex: number;
}

export interface BlinkAnalysis {
  blinkRate: number;
  averageBlinkDuration: number;
  blinkDistribution: number[];
  dataLossPercentage: number;
}

export interface AttentionAnalysis {
  focusDistribution: FocusDistribution;
  attentionSpan: number;
  distractionEvents: DistractionEvent[];
  engagementScore: number;
}

export interface FocusDistribution {
  centralFocus: number;
  peripheralFocus: number;
  scanningBehavior: number;
  explorationIndex: number;
}

export interface DistractionEvent {
  timestamp: number;
  duration: number;
  type: 'external' | 'internal' | 'fatigue' | 'unknown';
  severity: 'low' | 'medium' | 'high';
}

export interface Recommendation {
  type: RecommendationType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actionItems: string[];
  expectedImpact: string;
  category: RecommendationCategory;
}

export type RecommendationType = 'calibration' | 'environment' | 'technique' | 'hardware' | 'software' | 'training';

export type RecommendationCategory = 'accuracy' | 'precision' | 'stability' | 'response-time' | 'consistency' | 'comfort';

export interface StatisticalSummary {
  sampleSize: number;
  confidenceInterval: ConfidenceInterval;
  distributionAnalysis: DistributionAnalysis;
  outlierAnalysis: OutlierAnalysis;
  correlationMatrix: CorrelationMatrix;
}

export interface ConfidenceInterval {
  level: number; // e.g., 95 for 95% confidence
  lowerBound: number;
  upperBound: number;
  marginOfError: number;
}

export interface DistributionAnalysis {
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  normality: NormalityTest;
}

export interface NormalityTest {
  testName: string;
  pValue: number;
  isNormal: boolean;
  significance: number;
}

export interface OutlierAnalysis {
  outlierCount: number;
  outlierPercentage: number;
  outlierThreshold: number;
  outlierPoints: OutlierPoint[];
}

export interface OutlierPoint extends Point2D {
  timestamp: number;
  deviationScore: number;
  type: 'mild' | 'extreme';
}

export interface CorrelationMatrix {
  accuracyVsResponseTime: number;
  accuracyVsStability: number;
  responseTimeVsConfidence: number;
  stabilityVsEnvironment: number;
}

export interface ComparisonData {
  benchmarkData: BenchmarkData;
  previousSessions: SessionComparison[];
  populationNorms: PopulationNorms;
  improvementMetrics: ImprovementMetrics;
}

export interface BenchmarkData {
  targetAccuracy: number;
  targetResponseTime: number;
  targetStability: number;
  qualityStandards: QualityStandards;
}

export interface QualityStandards {
  minimum: QualityThreshold;
  target: QualityThreshold;
  excellent: QualityThreshold;
}

export interface QualityThreshold {
  accuracy: number;
  responseTime: number;
  stability: number;
  precision: number;
}

export interface SessionComparison {
  sessionId: string;
  date: Date;
  accuracyChange: number;
  responseTimeChange: number;
  stabilityChange: number;
  overallImprovement: number;
}

export interface PopulationNorms {
  ageGroup: string;
  sampleSize: number;
  averageAccuracy: number;
  averageResponseTime: number;
  averageStability: number;
  percentileRanking: PercentileRanking;
}

export interface PercentileRanking {
  accuracy: number;
  responseTime: number;
  stability: number;
  overall: number;
}

export interface ImprovementMetrics {
  sessionCount: number;
  totalImprovement: number;
  improvementRate: number;
  consistencyTrend: 'improving' | 'stable' | 'declining';
  projectedPerformance: ProjectedPerformance;
}

export interface ProjectedPerformance {
  expectedAccuracy: number;
  expectedResponseTime: number;
  expectedStability: number;
  confidenceLevel: number;
}

// Validation Interfaces
export interface ValidationMetrics {
  spatialAccuracy: number;
  temporalStability: number;
  fixationAccuracy: number;
  saccadeAccuracy: number;
  driftError: number;
  jitterLevel: number;
  calibrationQuality: QualityLevel;
  systemReliability: SystemReliability;
  performanceBenchmarks: PerformanceBenchmarks;
}

export interface SystemReliability {
  uptime: number;
  errorRate: number;
  dataCompleteness: number;
  processingLatency: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface PerformanceBenchmarks {
  processingSpeed: number;
  accuracyRating: number;
  stabilityRating: number;
  reliabilityScore: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// Export Configuration Interfaces
export interface ExportConfiguration {
  format: ExportFormat;
  includeRawData: boolean;
  includeAnalysis: boolean;
  includeVisualization: boolean;
  compressionLevel: CompressionLevel;
  customFields?: string[];
}

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf' | 'xml' | 'hdf5';

export type CompressionLevel = 'none' | 'low' | 'medium' | 'high';

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileSize: number;
  format: ExportFormat;
  timestamp: Date;
  error?: string;
}

// Real-time Monitoring Interfaces
export interface RealTimeMetrics {
  currentAccuracy: number;
  currentStability: number;
  currentResponseTime: number;
  confidence: number;
  gazeTrail: Point2D[];
  environmentalStatus: EnvironmentalStatus;
  systemStatus: SystemStatus;
  alerts: Alert[];
}

export interface EnvironmentalStatus {
  lighting: QualityLevel;
  headPosition: QualityLevel;
  eyeVisibility: QualityLevel;
  cameraFocus: QualityLevel;
  backgroundStability: QualityLevel;
}

export interface SystemStatus {
  processingLatency: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
  errorCount: number;
  lastUpdate: Date;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  dismissed: boolean;
  actionRequired?: string;
}

export type AlertType = 'calibration-drift' | 'poor-lighting' | 'head-movement' | 'low-confidence' | 'system-error' | 'performance-degradation';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

// Machine Learning Interfaces
export interface MLAnalysisResult {
  predictedAccuracy: number;
  optimizationSuggestions: OptimizationSuggestion[];
  performanceInsights: PerformanceInsight[];
  learningProgress: LearningProgress;
  adaptiveParameters: AdaptiveParameters;
}

export interface OptimizationSuggestion {
  parameter: string;
  currentValue: number;
  suggestedValue: number;
  expectedImprovement: number;
  confidence: number;
  reasoning: string;
}

export interface PerformanceInsight {
  category: InsightCategory;
  insight: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  metrics: { [key: string]: number };
}

export type InsightCategory = 'accuracy' | 'speed' | 'consistency' | 'fatigue' | 'learning' | 'environmental';

export interface LearningProgress {
  sessionsAnalyzed: number;
  improvementRate: number;
  plateauDetected: boolean;
  nextMilestone: Milestone;
  skillAssessment: SkillAssessment;
}

export interface Milestone {
  target: string;
  currentProgress: number;
  estimatedCompletion: Date;
  difficulty: DifficultyLevel;
}

export interface SkillAssessment {
  overallLevel: SkillLevel;
  strengthAreas: string[];
  improvementAreas: string[];
  recommendedExercises: string[];
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface AdaptiveParameters {
  calibrationInterval: number;
  filteringStrength: number;
  confidenceThreshold: number;
  adaptationRate: number;
  personalizedSettings: { [key: string]: any };
}
