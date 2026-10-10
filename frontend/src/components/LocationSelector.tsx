import { useState, useEffect } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

interface LocationSelectorProps {
  onLocationChange: (location: any) => void;
  selectedState?: number;
  selectedDistrict?: number;
  selectedCity?: number;
  selectedCorridor?: number;
}

export default function LocationSelector({ 
  onLocationChange,
  selectedState: initSt,
  selectedDistrict: initDt,
  selectedCity: initCt,
  selectedCorridor: initCr
}: LocationSelectorProps) {
  const { data: user } = useQuery({
    queryKey: ['userMe'],
    queryFn: async () => {
      return await apiFetch('auth/me');
    }
  });

  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [corridors, setCorridors] = useState<any[]>([]);

  const [stateId, setStateId] = useState<number | ''>(initSt || '');
  const [districtId, setDistrictId] = useState<number | ''>(initDt || '');
  const [cityId, setCityId] = useState<number | ''>(initCt || '');
  const [corridorId, setCorridorId] = useState<number | ''>(initCr || '');

  // Apply user locks
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'global_admin') {
      if (user.state_id) setStateId(user.state_id);
      if (user.district_id) setDistrictId(user.district_id);
    }
  }, [user]);

  // Fetch States
  useEffect(() => {
    apiFetch('locations/states')
      .then(data => setStates(data))
      .catch(console.error);
  }, []);

  // Fetch Districts when State changes
  useEffect(() => {
    // Only reset if it's an admin (operators are locked to district)
    if (user?.role === 'admin' || user?.role === 'global_admin') {
      setDistricts([]); setDistrictId('');
      setCities([]); setCityId('');
      setCorridors([]); setCorridorId('');
    }
    if (stateId) {
      apiFetch(`locations/states/${stateId}/districts`)
        .then(data => {
          setDistricts(data);
          if (user?.role !== 'admin' && user?.role !== 'global_admin' && user?.district_id) {
            setDistrictId(user.district_id); // ensure it's selected
          }
        })
        .catch(console.error);
    }
  }, [stateId, user]);

  // Fetch Cities when District changes
  useEffect(() => {
    setCities([]); setCityId('');
    setCorridors([]); setCorridorId('');
    if (districtId) {
      apiFetch(`locations/districts/${districtId}/cities`)
        .then(data => setCities(data))
        .catch(console.error);
    }
  }, [districtId]);

  // Fetch Corridors when City changes
  useEffect(() => {
    setCorridors([]); setCorridorId('');
    if (cityId) {
      apiFetch(`locations/cities/${cityId}/corridors`)
        .then(data => setCorridors(data))
        .catch(console.error);
    }
  }, [cityId]);

  // Notify parent of changes
  useEffect(() => {
    onLocationChange({
      stateId,
      districtId,
      cityId,
      corridorId,
      corridor: corridors.find(c => c.id === corridorId)
    });
  }, [stateId, districtId, cityId, corridorId, corridors]);

  if (user && user.role !== 'admin' && !user.district_id) {
    return (
      <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
        <AlertCircle size={16} />
        <span>Your account has no authorized district assigned. Please contact your administrator.</span>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
        <MapPin size={14} />
        <span className="font-medium hidden sm:inline">Region</span>
      </div>
      
      {/* State Selector: Hidden/Locked if operator */}
      {isAdmin && (
        <select 
          className="bg-card border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
          value={stateId}
          onChange={(e) => setStateId(Number(e.target.value) || '')}
        >
          <option value="">Select State / UT</option>
          {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {!isAdmin && stateId && (
        <div className="bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 cursor-not-allowed opacity-80">
          {states.find(s => s.id === stateId)?.name || 'Loading State...'}
        </div>
      )}

      {/* District Selector: Hidden if operator */}
      {isAdmin && districts.length > 0 && (
        <select 
          className="bg-card border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
          value={districtId}
          onChange={(e) => setDistrictId(Number(e.target.value) || '')}
        >
          <option value="">Select District</option>
          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}
      {!isAdmin && districtId && districts.length > 0 && (
        <div className="bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 cursor-not-allowed opacity-80">
          {districts.find(d => d.id === districtId)?.name || 'Loading District...'}
        </div>
      )}

      {cities.length > 0 && (
        <select 
          className="bg-card border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
          value={cityId}
          onChange={(e) => setCityId(Number(e.target.value) || '')}
        >
          <option value="">Select City / Town</option>
          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {corridors.length > 0 && (
        <select 
          className="bg-card border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
          value={corridorId}
          onChange={(e) => setCorridorId(Number(e.target.value) || '')}
        >
          <option value="">Select Corridor</option>
          {corridors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
    </div>
  );
}
