export interface DriftReport {
  readonly from: string;
  readonly to: string;
  readonly timestamp: string;
  readonly structural: StructuralDriftMetric;
  readonly coupling: CouplingDriftMetric;
  readonly convention: ConventionDriftMetric;
  readonly violationTrend: ViolationTrendMetric;
  readonly alerts: readonly DriftAlert[];
}

export interface StructuralDriftMetric {
  readonly newCrossLayerDeps: readonly CrossLayerDep[];
  readonly removedCrossLayerDeps: readonly CrossLayerDep[];
  readonly totalNewEdges: number;
  readonly totalRemovedEdges: number;
}

export interface CrossLayerDep {
  readonly sourceLayer: string;
  readonly targetLayer: string;
  readonly count: number;
  readonly examples: readonly string[];
}

export interface CouplingDriftMetric {
  readonly perLayer: readonly LayerCouplingDelta[];
  readonly overallFanOutDelta: number;
  readonly topContributors: readonly FanOutContributor[];
}

export interface LayerCouplingDelta {
  readonly layer: string;
  readonly previousAvgFanOut: number;
  readonly currentAvgFanOut: number;
  readonly deltaPercent: number;
  readonly exceedsThreshold: boolean;
}

export interface FanOutContributor {
  readonly filePath: string;
  readonly previousFanOut: number;
  readonly currentFanOut: number;
  readonly delta: number;
}

export interface ConventionDriftMetric {
  readonly perLayer: readonly LayerConventionDelta[];
  readonly newlyNonCompliant: readonly string[];
}

export interface LayerConventionDelta {
  readonly layer: string;
  readonly previousCompliance: number;
  readonly currentCompliance: number;
  readonly deltaPercent: number;
}

export type ViolationTrendDirection = 'improving' | 'stable' | 'degrading' | 'insufficient_data';

export interface ViolationTrendMetric {
  readonly direction: ViolationTrendDirection;
  readonly dataPoints: number;
  readonly slope: number;
  readonly recentScores: readonly number[];
}

export interface DriftAlert {
  readonly metric: 'structural' | 'coupling' | 'convention' | 'violation_trend';
  readonly severity: 'critical' | 'warning';
  readonly message: string;
  readonly actualValue: number;
  readonly threshold: number;
}

export interface DriftThresholds {
  readonly maxCouplingDriftPercent: number;
  readonly maxConventionDropPercent: number;
  readonly structuralAnyNewCrossLayer: boolean;
}
