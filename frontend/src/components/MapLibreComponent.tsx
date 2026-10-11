import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AlertCircle, Shield, Zap, RefreshCw, Crosshair, CheckCircle2 } from 'lucide-react';

export interface SignalNode {
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

export interface CorridorNode {
  id: number;
  name: string;
  district_id?: number;
  state_id?: number;
  intersections?: Array<{
    id: number;
    name: string;
    lat: number;
    lon: number;
    sequence_order?: number;
    distance_to_next_m?: number;
  }>;
}

interface MapProps {
  mode?: 'live' | 'simulation';
  corridors?: CorridorNode[];
  selectedCorridor?: CorridorNode | null;
  intersections?: SignalNode[];
  vehicles?: Array<{ id: string; lon: number; lat: number }>;
  districtName?: string;
  stateName?: string;
  onSelectSignal?: (signal: SignalNode) => void;
}

type TileMode = 'dark' | 'street' | 'satellite';

export default function MapLibreComponent({
  mode: _mode,
  corridors = [],
  selectedCorridor,
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
  const [tileMode, setTileMode] = useState<TileMode>('dark');
  const [activeSignal, setActiveSignal] = useState<SignalNode | null>(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  // Live ticking countdown state
  const [liveSignals, setLiveSignals] = useState<SignalNode[]>([]);

  // Initialize live signals from props
  useEffect(() => {
    if (intersections && intersections.length > 0) {
      setLiveSignals(
        intersections.map((int, idx) => ({
          ...int,
          signal_status: int.signal_status || (idx % 2 === 0 ? 'green' : 'red'),
          time_remaining: int.time_remaining || (20 + ((idx * 9) % 40)),
          cycle_length: int.cycle_length || 90,
          phase: int.phase || (idx % 2 === 0 ? 'North-South Green' : 'East-West Green'),
          live_queue: int.live_queue || (6 + ((idx * 3) % 15)),
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

  // Compute district centroid (Default: Guntur, Andhra Pradesh)
  const districtCenter = useMemo((): [number, number] => {
    if (intersections && intersections.length > 0) {
      const avgLon = intersections.reduce((sum, i) => sum + i.lon, 0) / intersections.length;
      const avgLat = intersections.reduce((sum, i) => sum + i.lat, 0) / intersections.length;
      return [avgLon, avgLat];
    }
    // Guntur, Andhra Pradesh verified centroid
    return [80.4365, 16.3067];
  }, [intersections]);

  // Recenter / Fit bounds helper
  const fitDistrictBounds = useCallback(() => {
    if (!map.current) return;
    if (liveSignals.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      liveSignals.forEach((sig) => {
        bounds.extend([sig.lon, sig.lat]);
      });
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 15.5, duration: 900 });
    } else {
      map.current.flyTo({ center: [80.4365, 16.3067], zoom: 13.5, duration: 900 });
    }
  }, [liveSignals]);

  // Initialize Map with public OpenStreetMap & ArcGIS raster sources
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      const mapInstance = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
            },
            'satellite-tiles': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              ],
              tileSize: 256,
              attribution: 'Esri, Maxar, Earthstar Geographics',
            },
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
              layout: {
                visibility: 'visible',
              },
              paint: {
                'raster-brightness-max': 0.7,
                'raster-contrast': 0.25,
                'raster-saturation': -0.85,
              },
            },
            {
              id: 'satellite-layer',
              type: 'raster',
              source: 'satellite-tiles',
              minzoom: 0,
              maxzoom: 19,
              layout: {
                visibility: 'none',
              },
            },
          ],
        },
        center: districtCenter,
        zoom: 13.5,
        attributionControl: false,
      });

      mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
      mapInstance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      mapInstance.on('load', () => {
        setIsStyleLoaded(true);

        // Add corridors GeoJSON source
        mapInstance.addSource('corridors', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Corridors glow halo
        mapInstance.addLayer({
          id: 'corridors-glow',
          type: 'line',
          source: 'corridors',
          paint: {
            'line-color': '#06b6d4',
            'line-width': 7,
            'line-opacity': 0.35,
            'line-blur': 3,
          },
        });

        // Corridors dynamic line
        mapInstance.addLayer({
          id: 'corridors-line',
          type: 'line',
          source: 'corridors',
          paint: {
            'line-color': ['case', ['boolean', ['get', 'isSelected'], false], '#10b981', '#38bdf8'],
            'line-width': 3,
            'line-opacity': 0.9,
            'line-dasharray': [3, 1],
          },
        });

        // Add vehicles source for simulation mode
        mapInstance.addSource('vehicles', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        mapInstance.addLayer({
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

        mapInstance.resize();
      });

      mapInstance.on('error', (e) => {
        console.warn('MapLibre event:', e);
      });

      map.current = mapInstance;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize district map');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setIsStyleLoaded(false);
      }
    };
  }, []);

  // Handle ResizeObserver for dynamic layout / sidebar changes
  useEffect(() => {
    if (!mapContainer.current) return;
    const observer = new ResizeObserver(() => {
      map.current?.resize();
    });
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  // Handle tile switch (Dark OSM / Street OSM / Satellite)
  useEffect(() => {
    if (!map.current || !isStyleLoaded) return;

    try {
      if (tileMode === 'satellite') {
        map.current.setLayoutProperty('osm-layer', 'visibility', 'none');
        map.current.setLayoutProperty('satellite-layer', 'visibility', 'visible');
      } else {
        map.current.setLayoutProperty('osm-layer', 'visibility', 'visible');
        map.current.setLayoutProperty('satellite-layer', 'visibility', 'none');

        if (tileMode === 'dark') {
          map.current.setPaintProperty('osm-layer', 'raster-brightness-max', 0.7);
          map.current.setPaintProperty('osm-layer', 'raster-contrast', 0.25);
          map.current.setPaintProperty('osm-layer', 'raster-saturation', -0.85);
        } else {
          // Standard street map
          map.current.setPaintProperty('osm-layer', 'raster-brightness-max', 1.0);
          map.current.setPaintProperty('osm-layer', 'raster-contrast', 0.0);
          map.current.setPaintProperty('osm-layer', 'raster-saturation', 0.0);
        }
      }
    } catch (err) {
      console.warn('Error changing tile style properties:', err);
    }
  }, [tileMode, isStyleLoaded]);

  // Render Corridor Routes on the Map
  useEffect(() => {
    if (!map.current || !isStyleLoaded || !map.current.getSource('corridors')) return;

    const source = map.current.getSource('corridors') as maplibregl.GeoJSONSource;
    if (corridors && corridors.length > 0) {
      const features: any[] = [];

      corridors.forEach((c) => {
        const intList = c.intersections || [];
        if (intList.length >= 2) {
          const sorted = [...intList].sort(
            (a, b) => (a.sequence_order || 0) - (b.sequence_order || 0)
          );
          const coords = sorted.map((item) => [item.lon, item.lat]);
          const isSelected = selectedCorridor ? selectedCorridor.id === c.id : false;

          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: {
              id: c.id,
              name: c.name,
              isSelected,
            },
          });
        }
      });

      source.setData({
        type: 'FeatureCollection',
        features,
      });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [corridors, selectedCorridor, isStyleLoaded]);

  // Fit map to district nodes when signals load
  useEffect(() => {
    if (!map.current || liveSignals.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    liveSignals.forEach((sig) => {
      bounds.extend([sig.lon, sig.lat]);
    });

    map.current.fitBounds(bounds, { padding: 60, maxZoom: 15.5, duration: 1000 });
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
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: ${statusGlow};
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
            top: -6px;
            z-index: 1;
            opacity: 0.55;
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
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(51, 65, 85, 0.85);
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
  }, [liveSignals, onSelectSignal]);

  // Update simulation vehicles
  useEffect(() => {
    if (!map.current || !isStyleLoaded || !map.current.getSource('vehicles')) return;

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
  }, [vehicles, isStyleLoaded]);

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 bg-red-950/20 p-6 text-center">
        <AlertCircle size={32} className="mb-2" />
        <p className="font-semibold text-sm">District Map Offline</p>
        <p className="text-xs mt-1 text-slate-400">{error}</p>
        <button
          onClick={() => {
            setError(null);
            window.location.reload();
          }}
          className="mt-4 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-xs text-white border border-slate-700 flex items-center gap-1.5"
        >
          <RefreshCw size={12} /> Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#070b12] overflow-hidden select-none">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Map Control Overlays */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
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

        {/* 3-Mode Map Imagery Toggle */}
        <div className="flex items-center bg-[#0c1322]/90 backdrop-blur-md rounded-xl border border-slate-700/80 p-0.5 shadow-xl text-xs">
          <button
            onClick={() => setTileMode('dark')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              tileMode === 'dark'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tactical
          </button>
          <button
            onClick={() => setTileMode('street')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              tileMode === 'street'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Street
          </button>
          <button
            onClick={() => setTileMode('satellite')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              tileMode === 'satellite'
                ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Satellite
          </button>
        </div>

        {/* Re-center / Fit Bounds Button */}
        <button
          onClick={fitDistrictBounds}
          className="flex items-center gap-1.5 bg-[#0c1322]/90 backdrop-blur-md hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-xl text-xs font-medium transition-all"
          title="Fit view to district signals"
        >
          <Crosshair size={13} className="text-emerald-400" />
          <span>Center District</span>
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
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  Signal Controller #{activeSignal.id}
                </span>
                {activeSignal.is_verified && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold flex items-center gap-1 border border-emerald-500/30">
                    <CheckCircle2 size={10} /> Verified
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-white leading-tight mt-0.5">
                {activeSignal.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{activeSignal.corridor}</p>
            </div>
            <button
              onClick={() => setActiveSignal(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
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

            {/* Action */}
            <div className="pt-1 flex gap-2">
              <button
                onClick={() => {
                  alert(
                    `Emergency Green Wave Clearance dispatched for ${activeSignal.name}! Priority green wave engaged.`
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
