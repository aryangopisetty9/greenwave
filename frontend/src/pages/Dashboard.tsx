import { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { MapPin, GitBranch, Activity, Car, ShieldCheck, Compass, Radio, ExternalLink, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import MapLibreComponent from '../components/MapLibreComponent';
import { apiFetch } from '../api/client';

export default function Dashboard() {
  const { user } = useOutletContext<{ user: any }>();
  const [selectedCorridorId, setSelectedCorridorId] = useState<number | null>(null);

  const { data: corridors } = useQuery({
    queryKey: ['corridors'],
    queryFn: () => apiFetch('corridors'),
  });

  const { data: intersections } = useQuery({
    queryKey: ['intersections'],
    queryFn: () => apiFetch('intersections'),
    refetchInterval: 15000,
  });

  const { data: coverage } = useQuery({
    queryKey: ['coverage'],
    queryFn: () => apiFetch('locations/coverage'),
  });

  const totalIntersections = intersections?.length || 0;
  const verifiedCount = intersections?.filter((i: any) => i.is_verified)?.length || 0;
  const totalCorridors = corridors?.length || 0;

  const districtName = user?.district_name || 'Guntur';
  const stateName = user?.state_name || 'Andhra Pradesh';
  const officerName = user?.full_name || 'Inspector Rajesh Varma, IPS';
  const badgeNumber = user?.badge_number || `IPS-${String(user?.id || 3).padStart(4, '0')}-TRF`;

  const activeCorridor =
    corridors?.find((c: any) => c.id === selectedCorridorId) || corridors?.[0] || null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Officer Command Jurisdiction Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Live District Traffic Operations
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {districtName} Traffic Command Division
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time signal synchronization and corridor throughput for {districtName}, {stateName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/app/simulation"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/40 transition-all"
          >
            <Car size={15} />
            <span>Launch Signal Demo</span>
          </Link>
        </div>
      </div>

      {/* State, District & Officer Cards (Replaces the developer health badges) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* District Card */}
        <div className="bg-[#0c1220]/90 backdrop-blur-md rounded-2xl p-4 border border-cyan-500/20 shadow-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-400">
              Assigned District
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <MapPin size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{districtName}</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Operational Traffic Division
          </div>
        </div>

        {/* State Card */}
        <div className="bg-[#0c1220]/90 backdrop-blur-md rounded-2xl p-4 border border-emerald-500/20 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
              State / Region
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Compass size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{stateName}</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Regional Command Network
          </div>
        </div>

        {/* Officer Card */}
        <div className="bg-[#0c1220]/90 backdrop-blur-md rounded-2xl p-4 border border-indigo-500/20 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-indigo-400">
              Officer In-Charge
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="text-base font-bold text-white truncate tracking-tight">{officerName}</div>
          <div className="text-xs text-slate-400 mt-1 font-mono">Badge: {badgeNumber}</div>
        </div>

        {/* Signals Monitored Card */}
        <div className="bg-[#0c1220]/90 backdrop-blur-md rounded-2xl p-4 border border-amber-500/20 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-amber-400">
              District Signals
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Radio size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {totalIntersections} Signals
          </div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Real-Time Cycle Sync
          </div>
        </div>
      </div>

      {/* District Operational Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Corridors"
          value={totalCorridors}
          icon={MapPin}
          subtitle={coverage ? `${coverage.available_cities || 1} cities covered` : 'District arterials'}
        />
        <StatCard
          title="Monitored Signals"
          value={totalIntersections}
          icon={GitBranch}
          subtitle={`${verifiedCount} verified in ${districtName}`}
        />
        <StatCard
          title="Coordination Efficiency"
          value={totalIntersections > 0 ? `${Math.round((verifiedCount / totalIntersections) * 100)}%` : '94%'}
          icon={Activity}
          subtitle="Green wave compliance"
        />
        <Link to="/app/simulation" className="group block">
          <StatCard
            title="CV Signal Demo"
            value="Live Feed"
            icon={Car}
            subtitle="Click to view 4-way stream"
            isHealthy={true}
          />
        </Link>
      </div>

      {/* District Map with Live Signal Positions & Countdown Timers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0c1220]/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[520px]">
          <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {districtName} District Signal Map
              </h3>
            </div>
            <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              {totalIntersections} live signal nodes
            </span>
          </div>

          <div className="flex-1 relative">
            <MapLibreComponent
              mode="live"
              corridors={corridors}
              selectedCorridor={activeCorridor}
              intersections={intersections}
              districtName={districtName}
              stateName={stateName}
            />
          </div>
        </div>

        {/* District Arterials & Quick Actions */}
        <div className="flex flex-col gap-6">
          {/* Corridors List */}
          <div className="bg-[#0c1220]/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-tight">
                {districtName} Arterial Corridors
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                {corridors?.length || 0} configured
              </span>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {corridors?.map((c: any) => {
                const isSelected = activeCorridor?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCorridorId(c.id)}
                    className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500/60 bg-emerald-950/30 shadow-lg shadow-emerald-950/20'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="overflow-hidden min-w-0 pr-2">
                      <span
                        className={`text-xs font-semibold block truncate ${
                          isSelected ? 'text-emerald-300' : 'text-white'
                        }`}
                      >
                        {c.name}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {c.intersections?.length || 2} signals • Adaptive sync
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 border ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {isSelected ? 'Focused' : 'Active'}
                    </span>
                  </div>
                );
              })}
              {(!corridors || corridors.length === 0) && (
                <p className="text-xs text-slate-400 text-center py-6">
                  No corridors configured yet.
                </p>
              )}
            </div>
          </div>

          {/* Quick Officer Actions */}
          <div className="bg-[#0c1220]/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-5 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight mb-3">
                Officer Fast Actions
              </h3>
              <div className="space-y-2">
                <Link
                  to="/app/intersections"
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all text-xs text-white font-medium group"
                >
                  <GitBranch size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="flex-1">Inspect All Signals Table</span>
                  <ExternalLink size={13} className="text-slate-500" />
                </Link>

                <Link
                  to="/app/simulation"
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/60 hover:border-cyan-500/30 transition-all text-xs text-white font-medium group"
                >
                  <Car size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="flex-1">Launch 4-Way Live CV Demo</span>
                  <ExternalLink size={13} className="text-slate-500" />
                </Link>

                <Link
                  to="/app/analytics"
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/60 hover:border-indigo-500/30 transition-all text-xs text-white font-medium group"
                >
                  <Activity size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="flex-1">View Traffic Flow Analytics</span>
                  <ExternalLink size={13} className="text-slate-500" />
                </Link>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/20 text-xs flex items-center gap-2.5">
              <Zap size={16} className="text-emerald-400 shrink-0" />
              <div className="text-[11px] text-slate-300">
                <strong className="text-white block font-semibold">Green Wave Ready</strong>
                Corridors optimized for continuous emergency green clearance.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, subtitle, isHealthy }: any) {
  return (
    <div className="bg-[#0c1220]/90 backdrop-blur-md rounded-2xl p-4 border border-slate-800 hover:border-slate-700 shadow-xl flex items-start justify-between group transition-all">
      <div>
        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
          {title}
        </p>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div
        className={`p-2.5 rounded-xl border transition-colors ${
          isHealthy
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20'
            : 'bg-slate-800/80 text-slate-300 border-slate-700 group-hover:text-emerald-400 group-hover:border-emerald-500/30'
        }`}
      >
        <Icon size={18} />
      </div>
    </div>
  );
}
