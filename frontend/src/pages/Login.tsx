import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, ArrowRight, User, MapPin, Map } from 'lucide-react';
import TrafficLogo from '../components/TrafficLogo';
import { apiFetch } from '../api/client';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');

  // Location Data
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  useEffect(() => {
    if (!isLogin) {
      // Fetch states when switching to signup
      setLoadingLocations(true);
      apiFetch('locations/states')
        .then(data => {
          if (Array.isArray(data)) {
            setStates(data);
          } else {
            console.error('Invalid states data:', data);
            setStates([]);
          }
          setLoadingLocations(false);
        })
        .catch(err => {
          console.error('Error fetching states:', err);
          setStates([]);
          setLoadingLocations(false);
        });
    }
  }, [isLogin]);

  useEffect(() => {
    // When state changes, clear district and fetch new ones
    setDistrictId('');
    if (stateId) {
      setLoadingLocations(true);
      apiFetch(`locations/states/${stateId}/districts`)
        .then(data => {
          if (Array.isArray(data)) {
            setDistricts(data);
          } else {
            console.error('Invalid districts data:', data);
            setDistricts([]);
          }
          setLoadingLocations(false);
        })
        .catch(err => {
          console.error('Error fetching districts:', err);
          setDistricts([]);
          setLoadingLocations(false);
        });
    } else {
      setDistricts([]);
    }
  }, [stateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const data = await apiFetch('auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        localStorage.setItem('token', data.access_token);
        navigate('/app');
      } else {
        await apiFetch('auth/signup', {
          method: 'POST',
          body: JSON.stringify({ 
            full_name: fullName,
            email, 
            password,
            state_id: parseInt(stateId),
            district_id: parseInt(districtId)
          }),
        });
        
        // Auto-login after successful signup
        const data = await apiFetch('auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        localStorage.setItem('token', data.access_token);
        navigate('/app');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Left pane - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-card border-r border-border">
        {/* Animated road/grid background */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, black, transparent)'
        }} />
        
        <div className="relative z-10 flex flex-col justify-center px-16 h-full text-left">
          <div className="flex items-center gap-4 text-primary mb-12">
            <TrafficLogo size={56} />
            <div>
              <h1 className="text-4xl font-extrabold text-foreground tracking-tight">GreenWave</h1>
              <p className="text-xs font-semibold text-primary tracking-widest uppercase mt-1">Intelligent Traffic Coordination</p>
            </div>
          </div>
          
          <h2 className="text-3xl font-medium text-foreground mb-6 leading-tight">
            Smarter Signals.<br/>
            Smoother Journeys.
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
            Coordinate urban traffic corridors, evaluate signal timing strategies, and explore measurable improvements through advanced simulation.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20"><Map size={16} /></div>
              Corridor mapping & network virtualization
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20"><TrafficLogo size={16} /></div>
              Algorithmic signal synchronization
            </div>
          </div>
        </div>
      </div>

      {/* Right pane - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
        <div className="w-full max-w-md space-y-6 glass-panel p-8 rounded-2xl relative z-10">
          
          {/* Mobile Header */}
          <div className="flex justify-center lg:hidden mb-6 flex-col items-center">
            <TrafficLogo size={48} className="text-primary mb-4" />
            <h1 className="text-2xl font-bold text-foreground">GreenWave</h1>
          </div>
          
          {/* Auth Tabs */}
          <div className="flex p-1 bg-muted rounded-lg mb-8">
            <button 
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isLogin ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => { setIsLogin(true); setError(''); }}
            >
              Sign In
            </button>
            <button 
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isLogin ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => { setIsLogin(false); setError(''); }}
            >
              Create Account
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground"><User size={18} /></div>
                  <input
                    type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all sm:text-sm"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground"><Mail size={18} /></div>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all sm:text-sm"
                  placeholder="operator@greenwave.com"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">State</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground"><MapPin size={18} /></div>
                    <select
                      required value={stateId} onChange={e => setStateId(e.target.value)} disabled={loadingLocations}
                      className="block w-full pl-10 pr-8 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary transition-all sm:text-sm appearance-none"
                    >
                      <option value="" disabled>Select State</option>
                      {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">District</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      {loadingLocations && stateId ? <Loader2 size={16} className="animate-spin" /> : <Map size={18} />}
                    </div>
                    <select
                      required value={districtId} onChange={e => setDistrictId(e.target.value)} disabled={!stateId || loadingLocations}
                      className="block w-full pl-10 pr-8 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary transition-all sm:text-sm appearance-none disabled:opacity-50"
                    >
                      <option value="" disabled>{stateId ? 'Select District' : 'Select State First'}</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground"><Lock size={18} /></div>
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground"><Lock size={18} /></div>
                  <input
                    type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading || (!isLogin && loadingLocations)}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? 'Sign in to Dashboard' : 'Create Operator Account')}
              {!loading && <ArrowRight size={18} />}
            </button>
            
            {!isLogin && (
              <p className="text-xs text-center text-muted-foreground mt-4">
                By creating an account, you will be registered as a District Operator pending administrative approval.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
