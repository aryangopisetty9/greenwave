import { 
  evaluateQueueMetric, 
  evaluateDecisionReasoning,
  type ApproachDirection 
} from '../utils/simulationSignalLogic';
import { 
  Activity, 
  AlertTriangle, 
  Info, 
  Layers, 
  Clock, 
  CheckCircle, 
  ShieldAlert, 
  Crosshair, 
  TrendingUp, 
  Cpu 
} from 'lucide-react';

interface QueuePanelProps {
  approaches: any;
}

export function ApproachQueuePanel({ approaches }: QueuePanelProps) {
  const directions: ApproachDirection[] = ['north', 'south', 'east', 'west'];
  const metrics = directions.map(dir => evaluateQueueMetric(dir, approaches?.[dir]));

  return (
    <div className="bg-card/60 rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <h4 className="font-bold text-sm text-foreground">Queue Demand Estimates</h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border">
          Unit: veh (est.)
        </span>
      </div>

      {/* Uncalibrated ROI Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 flex items-start gap-2 text-amber-400 text-xs">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block text-[11px] uppercase tracking-wider">Uncalibrated ROI Active</span>
          <span className="text-[11px] opacity-90">
            Values are approximate vehicle counts within the default 40% approach detection zone until camera polygon calibration is completed.
          </span>
        </div>
      </div>

      {/* 4 Approach Queue Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {metrics.map(metric => {
          const isZero = metric.status === 'zero';
          const isStale = metric.status === 'stale';
          const isUnavailable = metric.status === 'unavailable';

          return (
            <div 
              key={metric.direction}
              className={`p-3 rounded-lg border flex flex-col justify-between transition-colors ${
                isUnavailable 
                  ? 'bg-destructive/5 border-destructive/20 opacity-70' 
                  : isStale 
                  ? 'bg-amber-500/5 border-amber-500/30' 
                  : isZero
                  ? 'bg-muted/20 border-border/80'
                  : 'bg-card border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">
                  {metric.label}
                </span>
                {isStale ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    STALE
                  </span>
                ) : isUnavailable ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">
                    UNAVAILABLE
                  </span>
                ) : isZero ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    CLEAR
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    ACTIVE
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between">
                <span className="font-mono text-lg font-bold text-foreground">
                  {metric.displayValue}
                </span>
                {metric.lastUpdatedFormatted && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock size={10} />
                    {metric.lastUpdatedFormatted}
                  </span>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                {metric.helperText}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TrackingPanelProps {
  approaches: any;
}

export function TrackingMetricsPanel({ approaches }: TrackingPanelProps) {
  // Aggregate tracking numbers across approaches for intersection summary
  const directions: ApproachDirection[] = ['north', 'south', 'east', 'west'];
  
  let totalCurrentlyTracked = 0;
  let totalRawDetections = 0;
  let totalCumulativeTrackIds = 0;

  directions.forEach(dir => {
    const app = approaches?.[dir];
    if (app) {
      totalCurrentlyTracked += app.currently_tracked ?? 0;
      totalRawDetections += app.raw_detections ?? 0;
      totalCumulativeTrackIds += app.cumulative_track_ids ?? app.total_unique_tracked ?? 0;
    }
  });

  return (
    <div className="bg-card/60 rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary" />
          <h4 className="font-bold text-sm text-foreground">Computer Vision Tracking Metrics</h4>
        </div>
        <span className="text-[10px] text-muted-foreground">Across all 4 cameras</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* 1. Currently Tracked Objects */}
        <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Currently Tracked Objects</span>
            <Crosshair size={13} className="text-primary" />
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-foreground">{totalCurrentlyTracked}</span>
            <span className="text-[11px] text-muted-foreground">active targets</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Active centroid tracker objects currently in frame across all 4 cameras.
          </p>
        </div>

        {/* 2. Raw Frame Detections */}
        <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Raw Frame Detections</span>
            <Cpu size={13} className="text-primary" />
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-foreground">{totalRawDetections}</span>
            <span className="text-[11px] text-muted-foreground">bounding boxes</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Raw YOLOv8 inference detections in the latest processed video frames.
          </p>
        </div>

        {/* 3. Cumulative Track IDs in ROI */}
        <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Cumulative Track IDs (ROI)</span>
            <TrendingUp size={13} className="text-primary" />
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-foreground">{totalCumulativeTrackIds}</span>
            <span className="text-[11px] text-muted-foreground">registered IDs</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Cumulative tracker IDs observed in ROI. <span className="opacity-80">Trackers reacquire objects after occlusion; does not represent unique physical vehicles.</span>
          </p>
        </div>

        {/* 4. Line-Crossing Traffic Count */}
        <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between opacity-85">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Line-Crossing Traffic Count</span>
            <Info size={13} className="text-muted-foreground" />
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="font-mono text-base font-semibold text-muted-foreground">Not Configured</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            No virtual tripwire or crossing gate logic is configured in the current CV pipeline.
          </p>
        </div>
      </div>
    </div>
  );
}

interface DecisionPanelProps {
  status: any;
}

export function DecisionReasoningPanel({ status }: DecisionPanelProps) {
  const reasoning = evaluateDecisionReasoning(status);

  return (
    <div className="bg-card/60 rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-primary" />
          <h4 className="font-bold text-sm text-foreground">Signal Decision Engine Reasoning</h4>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          Updated: {reasoning.lastUpdate}
        </span>
      </div>

      {/* Degraded Status Alert */}
      {reasoning.isDegraded && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex items-start gap-2 text-amber-400 text-xs">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Decision Degradation Warning:</strong>
            <span className="opacity-90">{reasoning.degradedReason}</span>
          </div>
        </div>
      )}

      {/* Compact Decision Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-2.5 rounded-lg bg-card border border-border flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Active / Proposed Phase
          </span>
          <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
            <CheckCircle size={14} className="text-primary" />
            {reasoning.currentPhase}
          </span>
          {reasoning.proposedDuration !== null && (
            <span className="text-muted-foreground font-mono text-[11px]">
              Duration: {reasoning.proposedDuration}s
            </span>
          )}
        </div>

        <div className="p-2.5 rounded-lg bg-card border border-border flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Operator Approval State
          </span>
          <span className="font-bold text-foreground text-sm">
            {reasoning.operatorStatus}
          </span>
          <span className="text-muted-foreground font-mono text-[11px]">
            Signals: {reasoning.safeSignalSummary}
          </span>
        </div>
      </div>

      {/* Decision Reasoning Explanation */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border/80 text-xs flex flex-col gap-1.5">
        <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
          Decision Rationale:
        </span>
        <p className="text-foreground leading-relaxed">
          {reasoning.reason}
        </p>

        {/* Queue Estimates used in Decision */}
        <div className="mt-1 pt-2 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div><span className="text-muted-foreground">North Q:</span> <strong className="text-foreground">{reasoning.queueInputs.north}</strong></div>
          <div><span className="text-muted-foreground">South Q:</span> <strong className="text-foreground">{reasoning.queueInputs.south}</strong></div>
          <div><span className="text-muted-foreground">East Q:</span> <strong className="text-foreground">{reasoning.queueInputs.east}</strong></div>
          <div><span className="text-muted-foreground">West Q:</span> <strong className="text-foreground">{reasoning.queueInputs.west}</strong></div>
        </div>
      </div>
    </div>
  );
}
