import { useRef, useEffect, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AlertCircle, Layers, Shield, Zap } from 'lucide-react';

interface SignalNode {
  id: number;
  name: string;
  corridor?: string;
  city?: string;
  district?: string;
  state?: string;
  lat: number;
  lon: number;
  signal_status?: 'green' | 'yellow' | 'red';
  phase?: string;
  time_remaining?: number;
  cycle_length?: number;
  live_queue?: number;
  speed_kmh?: number;
  is_verified?: boolean;
}

interface MapProps {
  mode?: 'live' | 'simulation';
  selectedCorridor?: any;
  intersections?: SignalNode[];
  vehicles?: Array<{ id: string; lon: number; lat: number }>;
  districtName?: string;
  stateName?: string;
  onSelectSignal?: (signal: SignalNode) => void;
}

export default function MapLibreComponent({
  mode: _mode,
  selectedCorridor: _selectedCorridor,
  intersections = [],
  vehicles,
  districtName = 'District',
  stateName = '',
  onSelectSignal,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: number]: { marker: maplibregl.Marker; el: HTMLElement } }>({});
  const [error, setError] = useState<string | null>(null);
  const [tileMode, setTileMode] = useState<'dark' | 'satellite'>('dark');
  const [activeSignal, setActiveSignal] = useState<SignalNode | null>(null);

  // Live ticking countdown state
  const [liveSignals, setLiveSignals] = useState<SignalNode[]>([]);

  // Initialize live signals from props
  useEffect(() => {
    if (intersections && intersections.length > 0) {
      setLiveSignals(
        intersections.map((int, idx) => ({
          ...int,
          signal_status: int.signal_status || (idx % 2 === 0 ? 'green' : 'red'),
          time_remaining: int.time_remaining || (20 + (idx * 9) % 40),
          cycle_length: int.cycle_length || 90,
          phase: int.phase || (idx % 2 === 0 ? 'North-South Green' : 'East-West Green'),
          live_queue: int.live_queue || (6 + (idx * 3) % 15),
          speed_kmh: int.speed_kmh || (36 + (idx % 4) * 2.5),
        }))
      );
    }
  }, [intersections]);

  // Real-time second-by-second signal cycle countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSignals((prev) =>
        prev.map((sig) => {
          let rem = (sig.time_remaining ?? 30) - 1;
          let status = sig.signal_status;
          let phase = sig.phase;

          if (rem <= 0) {
            // Cycle phase
            if (status === 'green') {
              status = 'yellow';
              rem = 5;
              phase = 'Clearance Phase';
            } else if (status === 'yellow') {
              status = 'red';
              rem = 35;
              phase = 'Cross-Traffic Phase';
            } else {
              status = 'green';
              rem = 45;
              phase = 'North-South Green';
            }
          }

          return {
            ...sig,
            time_remaining: rem,
            signal_status: status,
            phase,
          };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Compute district centroid
  const districtCenter = useMemo((): [number, number] => {
    if (intersections && intersections.length > 0) {
      const avgLon = intersections.reduce((sum, i) => sum + i.lon, 0) / intersections.length;
      const avgLat = intersections.reduce((sum, i) => sum + i.lat, 0) / intersections.length;
      return [avgLon, avgLat];
    }
    // Guntur fallback if no points
    return [80.4365, 16.3067];
  }, [intersections]);

  // Initialize Map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      const tileSourceUrl =
        tileMode === 'dark'
          ? 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
          : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'basemap': {
              type: 'raster',
              tiles: [
                tileSourceUrl,
                tileSourceUrl.replace('a.basemaps', 'b.basemaps'),
                tileSourceUrl.replace('a.basemaps', 'c.basemaps'),
                tileSourceUrl.replace('a.basemaps', 'd.basemaps'),
              ],
              tileSize: 256,
              attribution: '&copy; CartoDB &copy; OpenStreetMap',
            },
          },
          layers: [
            {
              id: 'basemap-layer',
              type: 'raster',
              source: 'basemap',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: districtCenter,
        zoom: 13.5,
        attributionControl: false,
      });

      map.current.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
      map.current.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.current.on('load', () => {
        // Add vehicles source for simulation mode
        map.current?.addSource('vehicles', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.current?.addLayer({
          id: 'vehicles-layer',
          type: 'circle',
          source: 'vehicles',
          paint: {
            'circle-radius': 5,
            'circle-color': '#10b981',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          },
        });
      });
    } catch (err: any) {
      setError(err.message || 'Failed to initialize district map');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Handle tile switch
  useEffect(() => {
    if (!map.current || !map.current.getSource('basemap')) return;

    const tileSourceUrl =
      tileMode === 'dark'
        ? 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    const source = map.current.getSource('basemap') as any;
    if (source && source.tiles) {
      source.tiles = [
        tileSourceUrl,
        tileSourceUrl.replace('a.basemaps', 'b.basemaps'),
        tileSourceUrl.replace('a.basemaps', 'c.basemaps'),
        tileSourceUrl.replace('a.basemaps', 'd.basemaps'),
      ];
      // Trigger layer reload
      if (map.current.getLayer('basemap-layer')) {
        map.current.removeLayer('basemap-layer');
        map.current.addLayer({
          id: 'basemap-layer',
          type: 'raster',
          source: 'basemap',
          minzoom: 0,
          maxzoom: 19,
        });
      }
    }
  }, [tileMode]);

  // Fit map to district nodes when signals load
  useEffect(() => {
    if (!map.current || liveSignals.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    liveSignals.forEach((sig) => {
      bounds.extend([sig.lon, sig.lat]);
    });

    map.current.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1200 });
  }, [liveSignals.length]);

  // Render & Update Custom Signal DOM Markers
  useEffect(() => {
    if (!map.current) return;

    liveSignals.forEach((signal) => {
      let existing = markersRef.current[signal.id];

      const statusColor =
        signal.signal_status === 'green'
          ? '#10b981'
          : signal.signal_status === 'yellow'
          ? '#f59e0b'
          : '#ef4444';

      const statusGlow =
        signal.signal_status === 'green'
          ? 'rgba(16,185,129,0.5)'
          : signal.signal_status === 'yellow'
          ? 'rgba(245,158,11,0.5)'
          : 'rgba(239,68,68,0.5)';

      const statusEmoji =
        signal.signal_status === 'green'
          ? '🟢'
          : signal.signal_status === 'yellow'
          ? '🟡'
          : '🔴';

      if (!existing) {
        // Create new DOM element
        const el = document.createElement('div');
        el.className = 'greenwave-signal-marker cursor-pointer select-none';
        el.style.transform = 'translate(-50%, -50%)';

        el.addEventListener('click', () => {
          setActiveSignal(signal);
          if (onSelectSignal) onSelectSignal(signal);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([signal.lon, signal.lat])
          .addTo(map.current!);

        existing = { marker, el };
        markersRef.current[signal.id] = existing;
      }

      // Update marker content & live countdown
      existing.el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <!-- Live pulse aura -->
          <div style="
            position: absolute;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: ${statusGlow};
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
            top: -6px;
            z-index: 1;
            opacity: 0.6;
          "></div>

          <!-- Signal badge -->
          <div style="
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
            gap: 5px;
            background: #0b1120;
            border: 1.5px solid ${statusColor};
            border-radius: 9999px;
            padding: 3px 8px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.8), 0 0 10px ${statusGlow};
            transition: all 0.3s ease;
          ">
            <span style="font-size: 11px; line-height: 1;">${statusEmoji}</span>
            <span style="
              font-family: monospace;
              font-weight: 700;
              font-size: 11px;
              color: #f1f5f9;
              letter-spacing: -0.025em;
            ">${signal.time_remaining}s</span>
          </div>

          <!-- Signal Name tooltip label -->
          <div style="
            position: relative;
            z-index: 2;
            margin-top: 3px;
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(51, 65, 85, 0.8);
            color: #cbd5e1;
            font-size: 9px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
            pointer-events: none;
            backdrop-filter: blur(4px);
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
          ">
            ${signal.name.replace(' Signal', '').replace(' Traffic Signal', '')}
          </div>
        </div>
      `;
    });

    // Cleanup markers removed from liveSignals
    const currentIds = new Set(liveSignals.map((s) => s.id));
    Object.keys(markersRef.current).forEach((strId) => {
      const id = Number(strId);
      if (!currentIds.has(id)) {
        markersRef.current[id].marker.remove();
        delete markersRef.current[id];
      }
    });
  }, [liveSignals]);

  // Update simulation vehicles
  useEffect(() => {
    if (!map.current || !map.current.getSource('vehicles')) return;

    const source = map.current.getSource('vehicles') as maplibregl.GeoJSONSource;
    if (vehicles && vehicles.length > 0) {
      source.setData({
        type: 'FeatureCollection',
        features: vehicles.map((v) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
          properties: { id: v.id },
        })),
      });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [vehicles]);

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 bg-red-950/20 p-6 text-center">
        <AlertCircle size={32} className="mb-2" />
        <p className="font-semibold text-sm">District Map Offline</p>
        <p className="text-xs mt-1 text-slate-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#070b12] overflow-hidden select-none">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Map Control Overlays */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {/* District Jurisdiction Tag */}
        <div className="flex items-center gap-2 bg-[#0c1322]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700/80 shadow-xl">
          <Shield size={14} className="text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white tracking-tight">
              {districtName} Command Zone
            </span>
            <span className="text-[10px] text-slate-400">
              {liveSignals.length} Synchronized Signals {stateName ? `• ${stateName}` : ''}
            </span>
          </div>
        </div>

        {/* Map Imagery Toggle */}
        <button
          onClick={() => setTileMode((prev) => (prev === 'dark' ? 'satellite' : 'dark'))}
          className="flex items-center gap-1.5 bg-[#0c1322]/90 backdrop-blur-md hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-xl text-xs font-medium transition-all"
          title="Toggle Satellite / Tactical Map"
        >
          <Layers size={13} className="text-emerald-400" />
          <span>{tileMode === 'dark' ? 'Satellite View' : 'Tactical Dark'}</span>
        </button>
      </div>

      {/* Live Signal Legend Indicator */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-3 bg-[#0c1322]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] shadow-lg">
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Green Phase</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Clearance</span>
        </div>
        <div className="flex items-center gap-1.5 text-red-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span>Hold</span>
        </div>
        <div className="text-slate-500">• Click signal to inspect</div>
      </div>

      {/* Active Signal Officer HUD Modal / Drawer */}
      {activeSignal && (
        <div className="absolute top-4 right-4 z-20 w-80 bg-[#0c1322]/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                Signal Controller #{activeSignal.id}
              </span>
              <h3 className="text-sm font-bold text-white leading-tight mt-0.5">
                {activeSignal.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{activeSignal.corridor}</p>
            </div>
            <button
              onClick={() => setActiveSignal(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Live Timing Banner */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                  Current Phase
                </span>
                <span className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      activeSignal.signal_status === 'green'
                        ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                        : activeSignal.signal_status === 'yellow'
                        ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
                        : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                    }`}
                  ></span>
                  {activeSignal.phase}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                  Remaining
                </span>
                <span className="text-lg font-mono font-bold text-emerald-400">
                  {activeSignal.time_remaining}s
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Queue Density</span>
                <span className="text-sm font-bold text-white">
                  {activeSignal.live_queue} veh
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Approach Speed</span>
                <span className="text-sm font-bold text-cyan-400">
                  {activeSignal.speed_kmh} km/h
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-1 flex gap-2">
              <button
                onClick={() => {
                  alert(
                    `Emergency Green Wave Clearance dispatched for ${activeSignal.name}! Next 60 seconds given full green priority.`
                  );
                }}
                className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all"
              >
                <Zap size={13} />
                <span>Green Wave Priority</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
