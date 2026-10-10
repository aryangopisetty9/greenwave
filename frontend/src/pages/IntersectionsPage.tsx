import { useState } from 'react';
import { apiFetch } from '../api/client';
import { Search, CheckCircle, Clock, Zap, MapPin, Radio } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function IntersectionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterVerified, setFilterVerified] = useState('all');
  const queryClient = useQueryClient();
  const [greenWaveSuccess, setGreenWaveSuccess] = useState<string | null>(null);

  const { data: intersectionsList } = useQuery({
    queryKey: ['intersections'],
    queryFn: async () => {
      return await apiFetch('intersections');
    },
    refetchInterval: 10000,
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiFetch(`intersections/${id}/verify`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intersections'] });
    },
  });

  const greenWaveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiFetch(`intersections/${id}/greenwave`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      setGreenWaveSuccess(data?.message || 'Green Wave Corridor priority engaged!');
      setTimeout(() => setGreenWaveSuccess(null), 4000);
    },
  });

  const intersections = intersectionsList || [];

  const filteredIntersections = intersections.filter((i: any) => {
    const matchesSearch =
      i.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.corridor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.district?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSource = filterSource === 'all' || i.source === filterSource;
    const matchesVerified =
      filterVerified === 'all' ||
      (filterVerified === 'verified' ? i.is_verified : !i.is_verified);

    return matchesSearch && matchesSource && matchesVerified;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio size={14} className="text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              District Signal Registry
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Traffic Signal Controllers & Intersections
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor live phase states, countdowns, approach queues, and emergency green wave clearance.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={15}
            />
            <input
              type="text"
              placeholder="Search by signal, corridor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Sources</option>
            <option value="OSM">OSM</option>
            <option value="manual">Manual</option>
          </select>

          <select
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value)}
            className="px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified</option>
            <option value="unverified">Pending</option>
          </select>
        </div>
      </div>

      {/* Alert Banner for Green Wave */}
      {greenWaveSuccess && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-1">
          <Zap size={16} className="text-emerald-400" />
          <span className="font-semibold">{greenWaveSuccess}</span>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-[#0c1220]/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">Signal / Identifier</th>
                <th className="px-5 py-4">Location & Arterial</th>
                <th className="px-5 py-4">Live Phase & Timer</th>
                <th className="px-5 py-4">Queue & Speed</th>
                <th className="px-5 py-4">Verification</th>
                <th className="px-5 py-4 text-right">Officer Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredIntersections.map((int: any) => {
                const isGreen = int.signal_status === 'green';
                const isYellow = int.signal_status === 'yellow';

                return (
                  <tr
                    key={int.id}
                    className="hover:bg-slate-850/50 transition-colors group"
                  >
                    {/* Signal Name */}
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isGreen
                              ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                              : isYellow
                              ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                              : 'bg-red-400 shadow-[0_0_8px_#ef4444]'
                          }`}
                        />
                        {int.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Signal Node #{int.id} • Lat: {int.lat?.toFixed(4)}, Lon: {int.lon?.toFixed(4)}
                      </div>
                    </td>

                    {/* Location & Corridor */}
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-200">{int.corridor}</div>
                      <div className="text-[11px] text-cyan-400 mt-0.5 flex items-center gap-1">
                        <MapPin size={11} />
                        {int.city}, {int.district} ({int.state})
                      </div>
                    </td>

                    {/* Live Signal Timing */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${
                            isGreen
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : isYellow
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                          }`}
                        >
                          {int.phase || 'Cycle Active'}
                        </span>
                        <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {int.time_remaining || 25}s
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Cycle Length: {int.cycle_length || 90}s
                      </div>
                    </td>

                    {/* Queue & Speed */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-200">
                        {int.live_queue || 8} vehicles queued
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Flow Speed: <span className="text-cyan-400 font-mono">{int.speed_kmh || 38.0} km/h</span>
                      </div>
                    </td>

                    {/* Verification Status */}
                    <td className="px-5 py-4">
                      {int.is_verified ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <CheckCircle size={14} />
                          <span>Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                          <Clock size={14} />
                          <span>Pending Review</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Source: {int.source || 'OSM'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => greenWaveMutation.mutate(int.id)}
                          disabled={greenWaveMutation.isPending}
                          className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                          title="Trigger Green Wave corridor preemption"
                        >
                          <Zap size={13} />
                          <span>Green Wave</span>
                        </button>

                        {!int.is_verified && (
                          <button
                            onClick={() => verifyMutation.mutate(int.id)}
                            disabled={verifyMutation.isPending}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-all"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredIntersections.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No intersections found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
