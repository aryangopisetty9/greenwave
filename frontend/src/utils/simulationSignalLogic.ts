export type SignalColor = 'RED' | 'YELLOW' | 'GREEN';
export type ApproachDirection = 'north' | 'south' | 'east' | 'west';

export interface ApproachSignalState {
  north: SignalColor;
  south: SignalColor;
  east: SignalColor;
  west: SignalColor;
}

export type TransitionState = 'GREEN' | 'YELLOW' | 'ALL-RED' | 'WAITING FOR APPROVAL' | 'STOPPED';

export interface EvaluatedSignalState {
  transitionState: TransitionState;
  activePhase: 'North-South' | 'East-West' | 'None';
  nsPermitted: boolean;
  ewPermitted: boolean;
  allRedActive: boolean;
  isWaitingApproval: boolean;
  remainingSeconds: number | null;
  safeSignalSummary: string;
  signals: ApproachSignalState;
  isFailsafe: boolean;
}

/**
 * Evaluates the real backend session state to determine signal lamps, permitted movements,
 * transition status, and remaining phase timing without inventing false green states.
 */
export function evaluateSignalState(sessionStatus: any): EvaluatedSignalState {
  const rawSignal = sessionStatus?.signal;
  
  // Safe default: All-Red
  const safeDefault: ApproachSignalState = {
    north: 'RED',
    south: 'RED',
    east: 'RED',
    west: 'RED'
  };

  if (!rawSignal || typeof rawSignal !== 'object') {
    return {
      transitionState: 'ALL-RED',
      activePhase: 'None',
      nsPermitted: false,
      ewPermitted: false,
      allRedActive: true,
      isWaitingApproval: false,
      remainingSeconds: null,
      safeSignalSummary: 'All approaches stopped (No signal data / Failsafe)',
      signals: safeDefault,
      isFailsafe: true
    };
  }

  // Sanitize lamp inputs
  const sanitizeColor = (val: any): SignalColor => {
    if (val === 'GREEN' || val === 'YELLOW' || val === 'RED') return val;
    return 'RED'; // Unknown or invalid value defaults to safe RED
  };

  const signals: ApproachSignalState = {
    north: sanitizeColor(rawSignal.north),
    south: sanitizeColor(rawSignal.south),
    east: sanitizeColor(rawSignal.east),
    west: sanitizeColor(rawSignal.west),
  };

  const isStopped = sessionStatus?.is_stopped || sessionStatus?.status === 'completed';
  const isWaitingApproval = Boolean(sessionStatus?.pending_recommendation);

  // Safety check: Detect conflicting greens (e.g. North and East green simultaneously)
  const nsHasGreen = signals.north === 'GREEN' || signals.south === 'GREEN';
  const ewHasGreen = signals.east === 'GREEN' || signals.west === 'GREEN';
  const conflictingGreens = nsHasGreen && ewHasGreen;

  if (conflictingGreens) {
    // Immediate failsafe clamp: all red
    return {
      transitionState: 'ALL-RED',
      activePhase: 'None',
      nsPermitted: false,
      ewPermitted: false,
      allRedActive: true,
      isWaitingApproval: false,
      remainingSeconds: null,
      safeSignalSummary: 'SAFETY INTERLOCK: Conflicting greens prevented. All Red hold.',
      signals: safeDefault,
      isFailsafe: true
    };
  }

  // Two-phase model validation:
  // North-South green requires BOTH North and South to be green, and East/West RED
  const nsGreenValid = signals.north === 'GREEN' && signals.south === 'GREEN' && signals.east === 'RED' && signals.west === 'RED';
  // East-West green requires BOTH East and West to be green, and North/South RED
  const ewGreenValid = signals.east === 'GREEN' && signals.west === 'GREEN' && signals.north === 'RED' && signals.south === 'RED';

  const anyYellow = signals.north === 'YELLOW' || signals.south === 'YELLOW' || signals.east === 'YELLOW' || signals.west === 'YELLOW';
  const allRed = signals.north === 'RED' && signals.south === 'RED' && signals.east === 'RED' && signals.west === 'RED';

  let transitionState: TransitionState = 'ALL-RED';
  let activePhase: 'North-South' | 'East-West' | 'None' = 'None';
  let nsPermitted = false;
  let ewPermitted = false;

  if (isWaitingApproval) {
    transitionState = 'WAITING FOR APPROVAL';
    activePhase = sessionStatus.pending_recommendation?.recommended_phase === 'East-West' ? 'East-West' : 'North-South';
    // During approval wait, physical signals must show actual safe state (all RED)
  } else if (isStopped) {
    transitionState = 'STOPPED';
  } else if (anyYellow) {
    transitionState = 'YELLOW';
    activePhase = (signals.north === 'YELLOW' || signals.south === 'YELLOW') ? 'North-South' : 'East-West';
  } else if (nsGreenValid) {
    transitionState = 'GREEN';
    activePhase = 'North-South';
    nsPermitted = true;
  } else if (ewGreenValid) {
    transitionState = 'GREEN';
    activePhase = 'East-West';
    ewPermitted = true;
  } else if (allRed) {
    transitionState = 'ALL-RED';
    activePhase = sessionStatus?.active_phase === 'East-West' ? 'East-West' : (sessionStatus?.active_phase === 'North-South' ? 'North-South' : 'None');
  }

  // Remaining phase time: strictly only if provided by backend as a valid non-negative number
  let remainingSeconds: number | null = null;
  if (
    typeof sessionStatus?.remaining_seconds === 'number' &&
    sessionStatus.remaining_seconds >= 0 &&
    !isWaitingApproval &&
    !isStopped
  ) {
    remainingSeconds = Math.round(sessionStatus.remaining_seconds);
  }

  const safeSignalSummary = `N:${signals.north} | S:${signals.south} | E:${signals.east} | W:${signals.west}`;

  return {
    transitionState,
    activePhase,
    nsPermitted,
    ewPermitted,
    allRedActive: allRed || transitionState === 'ALL-RED',
    isWaitingApproval,
    remainingSeconds,
    safeSignalSummary,
    signals,
    isFailsafe: false
  };
}

export interface QueueMetricEvaluation {
  direction: ApproachDirection;
  label: string;
  displayValue: string;
  unit: string;
  definition: string;
  rawValue: number | null;
  status: 'valid' | 'zero' | 'stale' | 'unavailable' | 'loading';
  helperText: string;
  isStale: boolean;
  isUncalibrated: boolean;
  ageSeconds: number | null;
  lastUpdatedFormatted: string | null;
}

const DIRECTION_LABELS: Record<ApproachDirection, string> = {
  north: 'Queue estimate — North approach',
  south: 'Queue estimate — South approach',
  east: 'Queue estimate — East approach',
  west: 'Queue estimate — West approach',
};

/**
 * Formats approach queue metrics according to strict specifications:
 * - Differentiates valid zero ('0 veh (est.)') from missing/unavailable
 * - Detects stale values (>10s old) and never displays them as live
 * - Labels uncalibrated 40% approach detection ROI
 */
export function evaluateQueueMetric(
  direction: ApproachDirection,
  approachData: any,
  nowMs: number = Date.now()
): QueueMetricEvaluation {
  const label = DIRECTION_LABELS[direction];
  const unit = 'veh (est.)';
  const definition = 'Approximate vehicle count detected inside uncalibrated 40% approach ROI';
  const isUncalibrated = true;

  if (!approachData || approachData.status === 'unavailable' || approachData.status === 'error' || approachData.error) {
    return {
      direction,
      label,
      displayValue: 'Unavailable',
      unit,
      definition,
      rawValue: null,
      status: 'unavailable',
      helperText: approachData?.error || 'Feed offline or CV job unavailable',
      isStale: false,
      isUncalibrated,
      ageSeconds: null,
      lastUpdatedFormatted: null
    };
  }

  const lastUpdated = approachData.last_updated;
  let ageSeconds: number | null = null;
  let isStale = false;
  let lastUpdatedFormatted: string | null = null;

  if (lastUpdated) {
    const updatedTime = new Date(lastUpdated).getTime();
    if (!isNaN(updatedTime)) {
      ageSeconds = Math.max(0, Math.round((nowMs - updatedTime) / 1000));
      isStale = ageSeconds > 10;
      lastUpdatedFormatted = new Date(lastUpdated).toLocaleTimeString();
    }
  }

  const rawQueue = approachData.queue_length_estimate;
  const framesProcessed = approachData.frames_processed ?? 0;

  // Stale check takes precedence over live display
  if (isStale) {
    const valText = typeof rawQueue === 'number' ? `${rawQueue} veh (est.) [Stale]` : 'Stale';
    return {
      direction,
      label,
      displayValue: valText,
      unit,
      definition,
      rawValue: typeof rawQueue === 'number' ? rawQueue : null,
      status: 'stale',
      helperText: `Stale: Last updated ${ageSeconds}s ago (${lastUpdatedFormatted || 'unknown time'})`,
      isStale: true,
      isUncalibrated,
      ageSeconds,
      lastUpdatedFormatted
    };
  }

  // Valid measured zero or positive integer
  if (typeof rawQueue === 'number' && Number.isFinite(rawQueue)) {
    return {
      direction,
      label,
      displayValue: `${rawQueue} ${unit}`,
      unit,
      definition,
      rawValue: rawQueue,
      status: rawQueue === 0 ? 'zero' : 'valid',
      helperText: rawQueue === 0 ? 'Clear: 0 vehicles observed in ROI' : `Active queue: ~${rawQueue} vehicles waiting in ROI`,
      isStale: false,
      isUncalibrated,
      ageSeconds,
      lastUpdatedFormatted
    };
  }

  // Still warming up / first frame
  if (framesProcessed === 0) {
    return {
      direction,
      label,
      displayValue: 'Initializing...',
      unit,
      definition,
      rawValue: null,
      status: 'loading',
      helperText: 'Awaiting first video inference frame',
      isStale: false,
      isUncalibrated,
      ageSeconds,
      lastUpdatedFormatted
    };
  }

  return {
    direction,
    label,
    displayValue: 'Unavailable',
    unit,
    definition,
    rawValue: null,
    status: 'unavailable',
    helperText: 'Queue measurement not present in response',
    isStale: false,
    isUncalibrated,
    ageSeconds,
    lastUpdatedFormatted
  };
}

export interface MetricItem {
  value: number | string;
  label: string;
  tooltip: string;
}

export interface TrackingMetricsBreakdown {
  currentlyTracked: MetricItem;
  rawDetections: MetricItem;
  cumulativeTrackIds: MetricItem;
  lineCrossingCount: MetricItem;
}

/**
 * Distinguishes tracked objects, raw detections, cumulative tracker IDs, and line-crossing counts.
 */
export function evaluateTrackingMetrics(approachData: any): TrackingMetricsBreakdown {
  const currentlyTracked = approachData?.currently_tracked ?? 0;
  const rawDetections = approachData?.raw_detections ?? 0;
  const cumulativeTrackIds = approachData?.cumulative_track_ids ?? approachData?.total_unique_tracked ?? 0;

  return {
    currentlyTracked: {
      value: currentlyTracked,
      label: 'Currently Tracked Objects',
      tooltip: 'Objects with active trajectories maintained by the centroid tracker in the current frame.'
    },
    rawDetections: {
      value: rawDetections,
      label: 'Raw Frame Detections',
      tooltip: 'YOLOv8 bounding box detections generated on the latest processed frame.'
    },
    cumulativeTrackIds: {
      value: cumulativeTrackIds,
      label: 'Cumulative Track IDs (ROI)',
      tooltip: 'Total distinct tracker IDs assigned in ROI. Note: Trackers can lose and reacquire objects; does not represent unique physical vehicles across the entire video.'
    },
    lineCrossingCount: {
      value: 'Not Configured',
      label: 'Line-Crossing Traffic Count',
      tooltip: 'No virtual tripwire or crossing detection logic is configured in the current CV pipeline.'
    }
  };
}

export interface DecisionReasoningState {
  currentPhase: string;
  safeSignalSummary: string;
  reason: string;
  proposedDuration: number | null;
  operatorStatus: string;
  lastUpdate: string;
  isDegraded: boolean;
  degradedReason?: string;
  queueInputs: {
    north: string;
    south: string;
    east: string;
    west: string;
  };
}

/**
 * Extracts and formats decision reasoning directly from the backend status.
 */
export function evaluateDecisionReasoning(status: any, nowMs: number = Date.now()): DecisionReasoningState {
  const signal = status?.signal || { north: 'RED', south: 'RED', east: 'RED', west: 'RED' };
  const safeSignalSummary = `N:${signal.north} | S:${signal.south} | E:${signal.east} | W:${signal.west}`;

  // Check CV health across all approaches
  let isDegraded = false;
  let degradedReason = '';

  const approaches = status?.approaches || {};
  const staleDirs: string[] = [];
  const errorDirs: string[] = [];

  for (const dir of ['north', 'south', 'east', 'west'] as ApproachDirection[]) {
    const app = approaches[dir];
    if (!app || app.status === 'error' || app.status === 'unavailable' || app.error) {
      errorDirs.push(dir.toUpperCase());
    } else if (app.last_updated) {
      const age = Math.round((nowMs - new Date(app.last_updated).getTime()) / 1000);
      if (age > 10) staleDirs.push(`${dir.toUpperCase()}(${age}s)`);
    }
  }

  if (errorDirs.length > 0) {
    isDegraded = true;
    degradedReason = `Feeds offline or errored: ${errorDirs.join(', ')}`;
  } else if (staleDirs.length > 0) {
    isDegraded = true;
    degradedReason = `Measurements stale: ${staleDirs.join(', ')}`;
  }

  // Pending recommendation takes precedence
  if (status?.pending_recommendation) {
    const rec = status.pending_recommendation;
    return {
      currentPhase: `Proposed: ${rec.recommended_phase || 'Pending'}`,
      safeSignalSummary,
      reason: rec.reason || 'AI recommendation awaiting operator approval',
      proposedDuration: typeof rec.duration === 'number' ? rec.duration : null,
      operatorStatus: 'Pending Operator Approval (Hold in All-Red)',
      lastUpdate: rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString() : 'Recent',
      isDegraded,
      degradedReason,
      queueInputs: {
        north: `Demand NS: ${rec.ns_demand ?? '—'}`,
        south: `Demand NS: ${rec.ns_demand ?? '—'}`,
        east: `Demand EW: ${rec.ew_demand ?? '—'}`,
        west: `Demand EW: ${rec.ew_demand ?? '—'}`
      }
    };
  }

  // Check recent logs
  const latestLog = status?.logs?.[0];
  if (latestLog) {
    return {
      currentPhase: `${latestLog.selected_phase || 'Active'} Phase`,
      safeSignalSummary,
      reason: latestLog.reason || 'Dynamic timing based on measured ROI queues',
      proposedDuration: typeof latestLog.duration === 'number' ? latestLog.duration : null,
      operatorStatus: 'Autonomous Timing Active',
      lastUpdate: latestLog.timestamp ? new Date(latestLog.timestamp).toLocaleTimeString() : 'Recent',
      isDegraded,
      degradedReason,
      queueInputs: {
        north: `${latestLog.north_queue ?? '—'} veh`,
        south: `${latestLog.south_queue ?? '—'} veh`,
        east: `${latestLog.east_queue ?? '—'} veh`,
        west: `${latestLog.west_queue ?? '—'} veh`
      }
    };
  }

  return {
    currentPhase: status?.active_phase || 'Initializing',
    safeSignalSummary,
    reason: status?.status === 'running' ? 'Collecting initial video queue measurements...' : 'Simulator idle',
    proposedDuration: null,
    operatorStatus: status?.status === 'running' ? 'Monitoring' : 'Standby',
    lastUpdate: '—',
    isDegraded,
    degradedReason,
    queueInputs: {
      north: '—',
      south: '—',
      east: '—',
      west: '—'
    }
  };
}
