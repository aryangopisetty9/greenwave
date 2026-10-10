import { 
  evaluateSignalState, 
  type SignalColor 
} from '../utils/simulationSignalLogic';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  CircleDot, 
  ArrowUpDown, 
  ArrowLeftRight,
  ShieldCheck
} from 'lucide-react';

interface IntersectionDiagramProps {
  status: any;
}

export default function IntersectionDiagram({ status }: IntersectionDiagramProps) {
  const evalState = evaluateSignalState(status);
  const { 
    transitionState, 
    activePhase, 
    nsPermitted, 
    ewPermitted, 
    allRedActive, 
    isWaitingApproval, 
    remainingSeconds, 
    signals,
    safeSignalSummary,
    isFailsafe
  } = evalState;

  // Accessible color badges
  const getBadgeStyle = () => {
    switch (transitionState) {
      case 'GREEN':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'YELLOW':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'WAITING FOR APPROVAL':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse';
      case 'ALL-RED':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-card/60 rounded-xl border border-border p-4 shadow-sm select-none">
      {/* Header with Phase Name & Transition State */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <CircleDot size={18} className="text-primary" />
            <h3 className="font-bold text-base text-foreground tracking-tight">
              {activePhase === 'North-South' 
                ? 'NORTH–SOUTH PHASE' 
                : activePhase === 'East-West' 
                ? 'EAST–WEST PHASE' 
                : isWaitingApproval 
                ? 'AWAITING APPROVAL PHASE'
                : 'ALL-RED CLEARANCE'}
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Real-time top-down intersection signal state & permitted movements
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Transition State Badge */}
          <span 
            className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getBadgeStyle()}`}
            aria-label={`Current state: ${transitionState}`}
          >
            {transitionState === 'GREEN' && <CheckCircle size={14} className="text-emerald-400" />}
            {transitionState === 'YELLOW' && <AlertTriangle size={14} className="text-amber-300" />}
            {transitionState === 'WAITING FOR APPROVAL' && <ShieldAlert size={14} className="text-amber-400" />}
            {transitionState === 'ALL-RED' && <ShieldAlert size={14} className="text-red-400" />}
            <span>{transitionState}</span>
          </span>

          {/* Remaining phase time only if valid */}
          {remainingSeconds !== null ? (
            <span className="text-xs px-2.5 py-1 rounded-md font-mono font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <Clock size={13} />
              {remainingSeconds}s remaining
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-md text-muted-foreground bg-muted/30 border border-border/50">
              {isWaitingApproval ? 'Timing held' : 'Clearance hold'}
            </span>
          )}
        </div>
      </div>

      {/* Prominent Operator Approval Hold Banner */}
      {isWaitingApproval && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-amber-400 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="shrink-0" />
            <span className="font-semibold">
              WAITING FOR OPERATOR APPROVAL — ALL APPROACHES HELD ON SAFE RED
            </span>
          </div>
          <span className="font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
            SAFE INTERLOCK ACTIVE
          </span>
        </div>
      )}

      {/* Failsafe Warning if triggered */}
      {isFailsafe && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-destructive/15 border border-destructive/30 flex items-center gap-2 text-destructive text-xs">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="font-semibold">{safeSignalSummary}</span>
        </div>
      )}

      {/* Top-down SVG Intersection Canvas */}
      <div className="relative flex-1 min-h-[300px] w-full flex items-center justify-center bg-slate-950/80 rounded-lg p-2 border border-border/60 overflow-hidden">
        <svg 
          viewBox="0 0 440 440" 
          className="w-full h-full max-w-[420px] max-h-[420px]"
          aria-label="Top-down four-way road intersection diagram"
        >
          <defs>
            {/* Arrow marker for permitted traffic movement */}
            <marker id="arrow-emerald" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#10b981" />
            </marker>
            <marker id="arrow-lane" markerWidth="5" markerHeight="5" refX="3" refY="2.5" orient="auto">
              <path d="M0,0 L0,5 L5,2.5 z" fill="#94a3b8" />
            </marker>

            {/* Glowing filters for illuminated lamps */}
            <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.9" />
            </filter>
            <filter id="glow-yellow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#eab308" floodOpacity="0.9" />
            </filter>
            <filter id="glow-green" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#22c55e" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* Grass / Roadside backdrop */}
          <rect x="0" y="0" width="440" height="440" fill="#0b1120" />

          {/* Corner Curbs / Walkways */}
          {/* NW corner */}
          <path d="M 0,0 L 160,0 L 160,160 L 0,160 Z" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          {/* NE corner */}
          <path d="M 280,0 L 440,0 L 440,160 L 280,160 Z" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          {/* SW corner */}
          <path d="M 0,280 L 160,280 L 160,440 L 0,440 Z" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          {/* SE corner */}
          <path d="M 280,280 L 440,280 L 440,440 L 280,440 Z" fill="#0f172a" stroke="#334155" strokeWidth="2" />

          {/* Road Asphalt */}
          {/* Vertical road (North-South) */}
          <rect x="160" y="0" width="120" height="440" fill="#1e293b" />
          {/* Horizontal road (East-West) */}
          <rect x="0" y="160" width="440" height="120" fill="#1e293b" />

          {/* Central Intersection Box */}
          <rect x="160" y="160" width="120" height="120" fill="#1e293b" />

          {/* Permitted Movement Corridor Highlight */}
          {nsPermitted && (
            <g>
              {/* Green road overlay */}
              <rect x="162" y="0" width="116" height="440" fill="#10b981" fillOpacity="0.16" />
              {/* Northbound & Southbound movement flow vectors */}
              <line 
                x1="190" y1="30" x2="190" y2="410" 
                stroke="#10b981" strokeWidth="5" strokeDasharray="8 6" 
                markerEnd="url(#arrow-emerald)"
              />
              <line 
                x1="250" y1="410" x2="250" y2="30" 
                stroke="#10b981" strokeWidth="5" strokeDasharray="8 6" 
                markerEnd="url(#arrow-emerald)"
              />
            </g>
          )}

          {ewPermitted && (
            <g>
              {/* Green road overlay */}
              <rect x="0" y="162" width="440" height="116" fill="#10b981" fillOpacity="0.16" />
              {/* Eastbound & Westbound movement flow vectors */}
              <line 
                x1="30" y1="250" x2="410" y2="250" 
                stroke="#10b981" strokeWidth="5" strokeDasharray="8 6" 
                markerEnd="url(#arrow-emerald)"
              />
              <line 
                x1="410" y1="190" x2="30" y2="190" 
                stroke="#10b981" strokeWidth="5" strokeDasharray="8 6" 
                markerEnd="url(#arrow-emerald)"
              />
            </g>
          )}

          {/* All-Red or Approval Hold Center Box Highlight */}
          {(allRedActive || isWaitingApproval) && (
            <rect 
              x="162" y="162" width="116" height="116" 
              fill={isWaitingApproval ? '#f59e0b' : '#ef4444'} 
              fillOpacity="0.08" 
              stroke={isWaitingApproval ? '#f59e0b' : '#ef4444'} 
              strokeWidth="2" 
              strokeDasharray="4 4"
            />
          )}

          {/* Road Markings: Center dividers (yellow dashed) */}
          {/* North Road Centerline */}
          <line x1="220" y1="0" x2="220" y2="155" stroke="#facc15" strokeWidth="3" strokeDasharray="10 8" />
          {/* South Road Centerline */}
          <line x1="220" y1="285" x2="220" y2="440" stroke="#facc15" strokeWidth="3" strokeDasharray="10 8" />
          {/* West Road Centerline */}
          <line x1="0" y1="220" x2="155" y2="220" stroke="#facc15" strokeWidth="3" strokeDasharray="10 8" />
          {/* East Road Centerline */}
          <line x1="285" y1="220" x2="440" y2="220" stroke="#facc15" strokeWidth="3" strokeDasharray="10 8" />

          {/* Stop Lines (Bold White Bars at incoming approaches) */}
          {/* North Approach Stop Bar (Southbound incoming: x=160..220 at y=158) */}
          <line x1="160" y1="158" x2="220" y2="158" stroke="#ffffff" strokeWidth="5" strokeLinecap="square" />
          {/* South Approach Stop Bar (Northbound incoming: x=220..280 at y=282) */}
          <line x1="220" y1="282" x2="280" y2="282" stroke="#ffffff" strokeWidth="5" strokeLinecap="square" />
          {/* West Approach Stop Bar (Eastbound incoming: y=220..280 at x=158) */}
          <line x1="158" y1="220" x2="158" y2="280" stroke="#ffffff" strokeWidth="5" strokeLinecap="square" />
          {/* East Approach Stop Bar (Westbound incoming: y=160..220 at x=282) */}
          <line x1="282" y1="160" x2="282" y2="220" stroke="#ffffff" strokeWidth="5" strokeLinecap="square" />

          {/* Directional Lane Arrows on incoming approaches */}
          {/* North Incoming (Heading South into intersection) */}
          <line x1="190" y1="50" x2="190" y2="120" stroke="#94a3b8" strokeWidth="2.5" markerEnd="url(#arrow-lane)" />
          {/* South Incoming (Heading North into intersection) */}
          <line x1="250" y1="390" x2="250" y2="320" stroke="#94a3b8" strokeWidth="2.5" markerEnd="url(#arrow-lane)" />
          {/* West Incoming (Heading East into intersection) */}
          <line x1="50" y1="250" x2="120" y2="250" stroke="#94a3b8" strokeWidth="2.5" markerEnd="url(#arrow-lane)" />
          {/* East Incoming (Heading West into intersection) */}
          <line x1="390" y1="190" x2="320" y2="190" stroke="#94a3b8" strokeWidth="2.5" markerEnd="url(#arrow-lane)" />

          {/* Approach Labels (Outer Edge Text) */}
          <text x="190" y="16" fill="#cbd5e1" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="1">
            NORTH APPROACH
          </text>
          <text x="250" y="430" fill="#cbd5e1" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="1">
            SOUTH APPROACH
          </text>
          <text x="18" y="244" fill="#cbd5e1" fontSize="10" fontWeight="bold" textAnchor="start" letterSpacing="1" transform="rotate(-90, 18, 244)">
            WEST APPROACH
          </text>
          <text x="424" y="244" fill="#cbd5e1" fontSize="10" fontWeight="bold" textAnchor="start" letterSpacing="1" transform="rotate(90, 424, 244)">
            EAST APPROACH
          </text>

          {/* Traffic Light Housings with 3 Lamps each (RED, YELLOW, GREEN) */}
          {/* 1. North Approach Signal Housing */}
          <TrafficLightHousing 
            x={108} 
            y={95} 
            color={signals.north} 
            label="NORTH" 
            approachLabel="N Light" 
            orientation="vertical"
          />

          {/* 2. South Approach Signal Housing */}
          <TrafficLightHousing 
            x={292} 
            y={245} 
            color={signals.south} 
            label="SOUTH" 
            approachLabel="S Light" 
            orientation="vertical"
          />

          {/* 3. West Approach Signal Housing */}
          <TrafficLightHousing 
            x={88} 
            y={292} 
            color={signals.west} 
            label="WEST" 
            approachLabel="W Light" 
            orientation="horizontal"
          />

          {/* 4. East Approach Signal Housing */}
          <TrafficLightHousing 
            x={292} 
            y={88} 
            color={signals.east} 
            label="EAST" 
            approachLabel="E Light" 
            orientation="horizontal"
          />

          {/* Center Indicator Badge inside the intersection */}
          <g transform="translate(220, 220)">
            {nsPermitted ? (
              <g>
                <circle r="22" fill="#042f2e" stroke="#10b981" strokeWidth="2" />
                <path d="M-8,-4 L0,-12 L8,-4 M0,-12 L0,12 M-8,4 L0,12 L8,4" stroke="#10b981" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </g>
            ) : ewPermitted ? (
              <g>
                <circle r="22" fill="#042f2e" stroke="#10b981" strokeWidth="2" />
                <path d="M-4,-8 L-12,0 L-4,8 M-12,0 L12,0 M4,-8 L12,0 L4,8" stroke="#10b981" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </g>
            ) : transitionState === 'YELLOW' ? (
              <g>
                <circle r="22" fill="#451a03" stroke="#f59e0b" strokeWidth="2" />
                <path d="M0,-9 L10,8 L-10,8 Z" fill="#f59e0b" />
                <circle cx="0" cy="5" r="1.2" fill="#000" />
                <rect x="-0.8" y="-4" width="1.6" height="6" fill="#000" rx="0.5" />
              </g>
            ) : isWaitingApproval ? (
              <g>
                <circle r="22" fill="#451a03" stroke="#f59e0b" strokeWidth="2" />
                <path d="M-8,-8 L8,8 M8,-8 L-8,8" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
              </g>
            ) : (
              <g>
                <circle r="22" fill="#450a0a" stroke="#ef4444" strokeWidth="2" />
                <rect x="-9" y="-3" width="18" height="6" rx="2" fill="#ef4444" />
              </g>
            )}
          </g>
        </svg>

        {/* Live overlay banner in center-bottom */}
        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 backdrop-blur-sm border border-border/70 rounded-md px-3 py-1.5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            {nsPermitted ? (
              <>
                <ArrowUpDown size={14} className="text-emerald-400" />
                <span className="font-semibold text-emerald-400">PERMITTED FLOW: NORTH ⇄ SOUTH</span>
              </>
            ) : ewPermitted ? (
              <>
                <ArrowLeftRight size={14} className="text-emerald-400" />
                <span className="font-semibold text-emerald-400">PERMITTED FLOW: EAST ⇄ WEST</span>
              </>
            ) : transitionState === 'YELLOW' ? (
              <>
                <AlertTriangle size={14} className="text-amber-300" />
                <span className="font-semibold text-amber-300">CLEARANCE INTERVAL IN PROGRESS (PREPARE TO STOP)</span>
              </>
            ) : isWaitingApproval ? (
              <>
                <ShieldAlert size={14} className="text-amber-400" />
                <span className="font-semibold text-amber-400">SAFETY HOLD — AWAITING OPERATOR CONFIRMATION</span>
              </>
            ) : (
              <>
                <ShieldCheck size={14} className="text-red-400" />
                <span className="font-semibold text-red-400">ALL-RED CLEARANCE HOLD — ALL FLOW STOPPED</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {safeSignalSummary}
          </span>
        </div>
      </div>

      {/* Accessible Signal Legend */}
      <div className="mt-3 pt-2.5 border-t border-border grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]"></span>
          <span className="font-medium text-foreground">STOP</span>
          <span className="text-[10px] opacity-75">(Red Lamp)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_6px_#eab308]"></span>
          <span className="font-medium text-foreground">CLEAR</span>
          <span className="text-[10px] opacity-75">(Yellow Lamp)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#22c55e]"></span>
          <span className="font-medium text-foreground">PERMITTED</span>
          <span className="text-[10px] opacity-75">(Green Lamp)</span>
        </div>
      </div>
    </div>
  );
}

interface TrafficLightHousingProps {
  x: number;
  y: number;
  color: SignalColor;
  label: string;
  approachLabel: string;
  orientation: 'vertical' | 'horizontal';
}

function TrafficLightHousing({ 
  x, 
  y, 
  color, 
  label, 
  approachLabel, 
  orientation 
}: TrafficLightHousingProps) {
  const isRed = color === 'RED';
  const isYellow = color === 'YELLOW';
  const isGreen = color === 'GREEN';

  // Text badge for accessibility (color-independent)
  const stateBadgeText = isRed ? 'STOP' : isYellow ? 'CLEAR' : 'GO';
  const badgeTextColor = isRed ? '#f87171' : isYellow ? '#fde047' : '#4ade80';

  if (orientation === 'vertical') {
    return (
      <g transform={`translate(${x}, ${y})`} aria-label={`${label} approach traffic light: ${stateBadgeText}`}>
        {/* Housing case */}
        <rect 
          x="-16" y="-6" width="32" height="66" 
          rx="6" fill="#090d16" stroke="#475569" strokeWidth="2" 
        />
        {/* Visor hoods */}
        <path d="M-12,4 Q0,-2 12,4" fill="none" stroke="#64748b" strokeWidth="1.5" />
        <path d="M-12,22 Q0,16 12,22" fill="none" stroke="#64748b" strokeWidth="1.5" />
        <path d="M-12,40 Q0,34 12,40" fill="none" stroke="#64748b" strokeWidth="1.5" />

        {/* 1. RED Lamp (top) */}
        <circle 
          cx="0" cy="8" r="6.5" 
          fill={isRed ? '#ef4444' : '#271212'} 
          stroke={isRed ? '#fca5a5' : '#1e1111'} 
          strokeWidth={isRed ? 1.5 : 1}
          filter={isRed ? 'url(#glow-red)' : undefined}
        />

        {/* 2. YELLOW Lamp (middle) */}
        <circle 
          cx="0" cy="26" r="6.5" 
          fill={isYellow ? '#eab308' : '#241e0a'} 
          stroke={isYellow ? '#fef08a' : '#1c1706'} 
          strokeWidth={isYellow ? 1.5 : 1}
          filter={isYellow ? 'url(#glow-yellow)' : undefined}
        />

        {/* 3. GREEN Lamp (bottom) */}
        <circle 
          cx="0" cy="44" r="6.5" 
          fill={isGreen ? '#22c55e' : '#0b1f14'} 
          stroke={isGreen ? '#86efac' : '#08170e'} 
          strokeWidth={isGreen ? 1.5 : 1}
          filter={isGreen ? 'url(#glow-green)' : undefined}
        />

        {/* Label & Accessibility Badge */}
        <text x="0" y="-10" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">
          {approachLabel}
        </text>
        <rect x="-14" y="64" width="28" height="12" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1" />
        <text x="0" y="73" fill={badgeTextColor} fontSize="7" fontWeight="bold" textAnchor="middle">
          {stateBadgeText}
        </text>
      </g>
    );
  }

  // Horizontal orientation
  return (
    <g transform={`translate(${x}, ${y})`} aria-label={`${label} approach traffic light: ${stateBadgeText}`}>
      {/* Housing case */}
      <rect 
        x="-6" y="-16" width="66" height="32" 
        rx="6" fill="#090d16" stroke="#475569" strokeWidth="2" 
      />

      {/* 1. RED Lamp (left) */}
      <circle 
        cx="8" cy="0" r="6.5" 
        fill={isRed ? '#ef4444' : '#271212'} 
        stroke={isRed ? '#fca5a5' : '#1e1111'} 
        strokeWidth={isRed ? 1.5 : 1}
        filter={isRed ? 'url(#glow-red)' : undefined}
      />

      {/* 2. YELLOW Lamp (middle) */}
      <circle 
        cx="26" cy="0" r="6.5" 
        fill={isYellow ? '#eab308' : '#241e0a'} 
        stroke={isYellow ? '#fef08a' : '#1c1706'} 
        strokeWidth={isYellow ? 1.5 : 1}
        filter={isYellow ? 'url(#glow-yellow)' : undefined}
      />

      {/* 3. GREEN Lamp (right) */}
      <circle 
        cx="44" cy="0" r="6.5" 
        fill={isGreen ? '#22c55e' : '#0b1f14'} 
        stroke={isGreen ? '#86efac' : '#08170e'} 
        strokeWidth={isGreen ? 1.5 : 1}
        filter={isGreen ? 'url(#glow-green)' : undefined}
      />

      {/* Label & Accessibility Badge */}
      <text x="27" y="-20" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">
        {approachLabel}
      </text>
      <rect x="13" y="19" width="28" height="12" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1" />
      <text x="27" y="28" fill={badgeTextColor} fontSize="7" fontWeight="bold" textAnchor="middle">
        {stateBadgeText}
      </text>
    </g>
  );
}
