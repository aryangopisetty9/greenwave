import { Outlet, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  LogOut, LayoutDashboard, 
  Car, GitBranch, BarChart3, ShieldCheck, MapPin, Radio, Clock
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import TrafficLogo from '../components/TrafficLogo';
import { apiFetch } from '../api/client';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await apiFetch('auth/me');
      } catch (err) {
        throw new Error('Unauthorized');
      }
    },
    enabled: !!token,
    retry: false
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <TrafficLogo size={48} className="text-primary animate-pulse" />
      <span className="text-muted-foreground font-medium">Loading GreenWave Operations...</span>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  const navItems = [
    { name: 'Overview', path: '/app', icon: LayoutDashboard },
    { name: 'Intersections', path: '/app/intersections', icon: GitBranch },
    { name: 'Signal Demo', path: '/app/simulation', icon: Car },
    { name: 'Analytics', path: '/app/analytics', icon: BarChart3 },
  ];

  const currentPathName = navItems.find(i => i.path === location.pathname)?.name || 'Overview';
  const officerName = user.full_name || 'Inspector Rajesh Varma, IPS';
  const districtName = user.district_name || 'Guntur';
  const stateName = user.state_name || 'Andhra Pradesh';
  const badgeNo = user.badge_number || `IPS-${String(user.id).padStart(4, '0')}-TRF`;

  return (
    <div className="flex h-screen bg-[#080c14] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0c1220]/95 border-r border-slate-800/80 flex flex-col shrink-0 relative z-20 shadow-2xl backdrop-blur-xl">
        {/* Brand header */}
        <div className="h-16 flex items-center gap-3 px-6 text-primary font-bold text-xl border-b border-slate-800/80 bg-slate-900/40">
          <TrafficLogo size={28} /> 
          <div className="flex flex-col">
            <span className="text-white tracking-tight leading-none font-bold">GreenWave</span>
            <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase mt-0.5">Traffic Operations</span>
          </div>
        </div>
        
        {/* Officer Profile Badge */}
        <div className="p-4 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-slate-950/40">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[2px] shadow-lg shadow-emerald-950/40 shrink-0">
              <div className="w-full h-full bg-[#0d1527] rounded-[10px] flex items-center justify-center text-emerald-400 font-bold text-base">
                {officerName.replace('Inspector ', '').charAt(0)}
              </div>
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate leading-tight tracking-tight">
                {officerName}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                <ShieldCheck size={13} className="shrink-0" />
                <span className="truncate">District Traffic Officer</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 truncate">
                <MapPin size={12} className="text-cyan-400 shrink-0" />
                <span className="truncate">{districtName}, {stateName}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                {badgeNo}
              </div>
            </div>
          </div>
        </div>

        {/* Operations Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">
            Operations Console
          </div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group font-medium text-sm ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-950/20' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200 transition-colors'} />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Jurisdiction Quick Badge & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
          <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Sector</div>
            <div className="text-slate-200 font-semibold truncate flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              {districtName} Division
            </div>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              navigate('/login');
            }}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-transparent transition-all font-medium text-xs group"
          >
            <LogOut size={16} className="group-hover:text-red-400 transition-colors" /> Logout System
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-10 overflow-hidden bg-[#080c14]">
        <header className="h-16 border-b border-slate-800/80 bg-[#0c1220]/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">{currentPathName}</h1>
            <div className="h-4 w-[1px] bg-slate-700 hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/60">
              <MapPin size={13} className="text-cyan-400" />
              <span className="font-semibold text-white">{districtName}</span>
              <span className="text-slate-400">• {stateName}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Live Clock */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock size={13} className="text-emerald-400 animate-pulse" />
              <span>{currentTime}</span>
            </div>
            
            {/* Signals Active status (traffic oriented, not dev server) */}
            <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg font-medium">
              <Radio size={13} className="text-emerald-400 animate-pulse" />
              <span>Live District Signals Sync</span>
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-8 relative">
          <Outlet context={{ user }} />
        </div>
      </main>
    </div>
  );
}
