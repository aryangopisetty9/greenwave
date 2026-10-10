import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, API_BASE_URL } from '../api/client';
import { Play, Square, AlertTriangle, Loader2, Video, Pause, List as ListIcon, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import IntersectionDiagram from '../components/IntersectionDiagram';
import { 
  ApproachQueuePanel, 
  TrackingMetricsPanel, 
  DecisionReasoningPanel 
} from '../components/TrafficMetricsPanels';

export default function SimulationPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const { data: videoCheck } = useQuery({
    queryKey: ['cv_demo_check'],
    queryFn: async () => {
      return await apiFetch('cv/demo/check');
    }
  });

  // Controlled status polling — exactly one interval, 1500ms
  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const data = await apiFetch(`cv/demo/status/${sessionId}`);
        if (data.status) {
          setStatus(data);
          if (data.status === 'completed' || data.status === 'error') {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      } catch (e) {
        console.error('Status poll error:', e);
      }
    };

    // Immediate first poll
    poll();
    pollingRef.current = setInterval(poll, 1500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [sessionId]);

  const startDemo = async () => {
    setLoading(true);
    setError(null);
    setSessionId(null);
    setStatus(null);
    try {
      const data = await apiFetch(`cv/demo/start`, {
        method: 'POST'
      });
      if (data && data.session_id) {
        setSessionId(data.session_id);
      } else {
        setError('Failed to start demo — no session ID returned.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  const performAction = useCallback(async (action: string) => {
    if (!sessionId || actionInProgress) return;
    setActionInProgress(true);
    try {
      await apiFetch(`cv/demo/action/${sessionId}?action=${action}`, {
        method: 'POST'
      });
      if (action === 'stop') {
        // Clear polling immediately
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setStatus((prev: any) => prev ? { ...prev, status: 'completed', is_stopped: true } : prev);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(false);
    }
  }, [sessionId, actionInProgress]);

  const allVideosReady = videoCheck && Object.values(videoCheck).every(v => v === true);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Four-Way Intersection — Intelligent Signal Control</h2>
          <p className="text-muted-foreground">Demonstrating YOLO-based queue estimation and dynamic phase selection.</p>
        </div>
        <div className="flex items-center gap-2">
          {!sessionId ? (
            <button 
              onClick={startDemo}
              disabled={loading || !allVideosReady}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Demo
            </button>
          ) : (
            <div className="flex gap-2">
              {status?.is_paused ? (
                <button onClick={() => performAction('resume')} disabled={actionInProgress} className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  <Play size={16} /> Resume
                </button>
              ) : (
                <button onClick={() => performAction('pause')} disabled={actionInProgress || status?.status !== 'running'} className="flex items-center gap-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  <Pause size={16} /> Pause
                </button>
              )}
              <button onClick={() => performAction('stop')} disabled={actionInProgress || (status?.status !== 'running' && status?.status !== 'initializing')} className="flex items-center gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                <Square size={16} /> Stop
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-lg flex items-start gap-3 mb-6 text-sm">
        <Video size={18} className="shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold block">RECORDED VIDEO DEMO</strong>
          <span className="opacity-90">This is a simulation of signal decisions using recorded footage; it does not control real traffic lights.</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-3">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}
      
      {!allVideosReady && !sessionId && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm rounded-lg">
          <strong>Missing Videos:</strong> Please place `north.mp4`, `south.mp4`, `east.mp4`, and `west.mp4` in `backend/app/data/videos/`.
        </div>
      )}

      {/* Main Analysis Area */}
      {sessionId ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          
          {/* Main Top Row: Videos (7 cols) + Intersection Diagram (5 cols) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
            {/* 4 Traffic Analysis Video Streams */}
            <div className="xl:col-span-7 glass-panel rounded-xl overflow-hidden border border-border p-4 bg-card/50 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-foreground">Traffic Analysis Camera Feeds</h3>
                  <p className="text-xs text-muted-foreground">Real-time object detection with YOLOv8 & centroid tracking</p>
                </div>
                {status && (
                  <span className={`text-xs px-2.5 py-1 rounded font-bold uppercase tracking-wider ${status.status === 'running' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : status.status === 'completed' ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive'}`}>
                    {status.status}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3.5 flex-1">
                <VideoFeed direction="north" sessionId={sessionId} feedStatus={status?.approaches?.north} />
                <VideoFeed direction="south" sessionId={sessionId} feedStatus={status?.approaches?.south} />
                <VideoFeed direction="east" sessionId={sessionId} feedStatus={status?.approaches?.east} />
                <VideoFeed direction="west" sessionId={sessionId} feedStatus={status?.approaches?.west} />
              </div>
            </div>
            
            {/* Clean Top-down Intersection Diagram */}
            <div className="xl:col-span-5 flex flex-col">
              <IntersectionDiagram status={status} />
            </div>
          </div>

          {/* Second Row: Queue Demand Estimates + Tracking Metrics + Decision Engine Reasoning */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            {/* Queue Estimates (6 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-5">
              <ApproachQueuePanel approaches={status?.approaches} />
              <TrackingMetricsPanel approaches={status?.approaches} />
            </div>

            {/* Decision Engine Reasoning (6 cols) */}
            <div className="lg:col-span-6 flex flex-col">
              <DecisionReasoningPanel status={status} />
            </div>
          </div>
          
          {/* Operator Action Request */}
          {status?.pending_recommendation && (
            <div className="glass-panel rounded-xl overflow-hidden border border-amber-500/50 bg-amber-500/10 mb-6 flex flex-col p-4">
               <div className="flex items-center gap-2 mb-3 text-amber-500">
                 <AlertTriangle size={20} />
                 <h3 className="font-bold text-sm">AI Signal Recommendation Pending Approval</h3>
               </div>
               <div className="text-sm mb-4 space-y-1">
                 <div><strong className="text-foreground">Recommended Phase:</strong> <span className="text-primary">{status.pending_recommendation.recommended_phase}</span> for {status.pending_recommendation.duration}s</div>
                 <div><strong className="text-foreground">Demand:</strong> NS: {status.pending_recommendation.ns_demand}, EW: {status.pending_recommendation.ew_demand}</div>
                 <div><strong className="text-foreground">Reasoning:</strong> {status.pending_recommendation.reason}</div>
                 <div className="text-xs text-muted-foreground mt-2">Timestamp: {new Date(status.pending_recommendation.timestamp).toLocaleTimeString()}</div>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => performAction('approve_recommendation')} disabled={actionInProgress} className="flex items-center gap-2 bg-green-500/20 text-green-500 hover:bg-green-500/30 px-4 py-2 rounded-lg text-sm font-bold border border-green-500/30 disabled:opacity-50">
                   <CheckCircle size={16} /> Apply AI Recommendation
                 </button>
                 <button onClick={() => performAction('reject_recommendation')} disabled={actionInProgress} className="flex items-center gap-2 bg-destructive/20 text-destructive hover:bg-destructive/30 px-4 py-2 rounded-lg text-sm font-bold border border-destructive/30 disabled:opacity-50">
                   <XCircle size={16} /> Reject & Alternate
                 </button>
               </div>
            </div>
          )}

          {/* Decision Log */}
          <div className="glass-panel rounded-xl overflow-hidden border border-border flex flex-col bg-card/50 flex-1 min-h-[300px]">
             <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-2">
               <ListIcon size={16} className="text-primary" />
               <h3 className="font-bold text-sm">Signal Decision Log</h3>
             </div>
             <div className="p-4 overflow-y-auto flex-1">
               {status?.logs && status.logs.length > 0 ? (
                 <div className="space-y-4">
                   {status.logs.map((log: any, idx: number) => (
                     <div key={idx} className="bg-card border border-border p-4 rounded-lg flex flex-col md:flex-row gap-6 items-start">
                       <div className="shrink-0 text-xs text-muted-foreground w-24">
                         {new Date(log.timestamp).toLocaleTimeString()}
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs shrink-0 bg-muted/20 p-2 rounded w-full md:w-auto">
                          <div>N Queue: <span className="font-bold text-foreground">{log.north_queue}</span></div>
                          <div>S Queue: <span className="font-bold text-foreground">{log.south_queue}</span></div>
                          <div>E Queue: <span className="font-bold text-foreground">{log.east_queue}</span></div>
                          <div>W Queue: <span className="font-bold text-foreground">{log.west_queue}</span></div>
                       </div>
                       <div className="flex-1 space-y-1 text-sm">
                          <div><span className="text-muted-foreground">Decision:</span> <span className="font-bold text-primary">{log.selected_phase} phase selected.</span></div>
                          <div><span className="text-muted-foreground">Reason:</span> {log.reason}</div>
                          <div><span className="text-muted-foreground">Proposed duration:</span> {log.duration}s</div>
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                   Waiting for first signal decision...
                 </div>
               )}
             </div>
          </div>
          
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border rounded-xl">
          <div className="text-center text-muted-foreground p-6">
            <Video size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-2">Click <strong>Demo</strong> to launch the four-way intersection simulator.</p>
            <p className="text-sm">The system will analyze recorded footage from 4 directions in real-time and make dynamic signal timing decisions.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoFeed({ direction, sessionId, feedStatus }: { direction: string, sessionId: string, feedStatus?: any }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Build stream URL using the Vite proxy path (relative), not hardcoded localhost
  const streamUrl = `${API_BASE_URL}/cv/demo/stream/${sessionId}/${direction}`;
  
  const handleRetry = () => {
    setImgError(false);
    setImgLoaded(false);
    // Force reload by updating src
    if (imgRef.current) {
      imgRef.current.src = streamUrl + '?t=' + Date.now();
    }
  };

  const feedError = feedStatus?.error;
  const feedProcessing = feedStatus?.status === 'processing';
  const framesProcessed = feedStatus?.frames_processed || 0;

  return (
    <div className="relative bg-black rounded-lg overflow-hidden aspect-video border border-border flex items-center justify-center">
      <div className="absolute top-2 left-2 bg-background/80 backdrop-blur text-foreground text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-sm z-10">
        {direction} Approach
      </div>
      
      {/* Feed status indicator */}
      <div className="absolute top-2 right-2 z-10">
        {feedError ? (
          <span className="bg-destructive/80 text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">ERROR</span>
        ) : feedProcessing && framesProcessed > 0 ? (
          <span className="bg-green-500/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>LIVE
          </span>
        ) : (
          <span className="bg-amber-500/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">LOADING</span>
        )}
      </div>
      
      {/* Loading state */}
      {!imgLoaded && !imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-0">
          <Loader2 size={24} className="animate-spin mb-2" />
          <span className="text-xs">Waiting for {direction} feed...</span>
        </div>
      )}
      
      {/* Error state with retry */}
      {imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive z-0 p-4">
          <AlertTriangle size={24} className="mb-2" />
          <span className="text-xs text-center mb-2">{feedError || `${direction} feed unavailable`}</span>
          <button onClick={handleRetry} className="flex items-center gap-1 text-xs bg-destructive/20 hover:bg-destructive/30 px-3 py-1 rounded border border-destructive/30">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}
      
      <img 
        ref={imgRef}
        src={streamUrl} 
        className={`w-full h-full object-cover ${imgError ? 'hidden' : ''}`}
        alt={`${direction} stream`}
        onLoad={() => setImgLoaded(true)}
        onError={() => { setImgError(true); setImgLoaded(false); }}
      />
    </div>
  );
}
