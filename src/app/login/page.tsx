'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);

  // Fetch db to populate units dropdown
  useEffect(() => {
    fetch('/api/db')
      .then(r => r.json())
      .then(db => {
        setUnits(db.units || []);
        setRegions(db.regions || []);
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId) {
      setError('Silakan pilih Operational Unit (OU) terlebih dahulu!');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/db');
      const db = await res.json();
      
      // Check if user exists with matching username and password
      const userMatch = db.users.find((u: any) => u.name === username && u.password === password);
      
      if ((username === 'admin' && password === 'admin123') || userMatch) {
        let finalLoginUnitId = selectedUnitId;
        if (userMatch) {
          if (userMatch.unitId) {
            finalLoginUnitId = userMatch.unitId;
          } else if (userMatch.regionId) {
            finalLoginUnitId = `REGION_${userMatch.regionId}`;
          }
        }
        
        // Set a cookie manually for the middleware to read
        document.cookie = `auth=${username}; path=/; max-age=86400`; // 1 day expiration
        document.cookie = `loginUnitId=${finalLoginUnitId}; path=/; max-age=86400`;
        router.push('/');
      } else {
        setError('Username atau Password salah!');
        setLoading(false);
      }
    } catch (err) {
      setError('Gagal melakukan login. Cek koneksi server.');
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      zIndex: 9999, 
      backgroundColor: '#f8fbfd', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/logo_ai.png" alt="SIPEF Logo" style={{ height: '100px', objectFit: 'contain', marginBottom: '0.5rem', borderRadius: '12px' }} />
          <h1 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            PT Sipef
          </h1>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>Project Monitoring System</p>
        </div>

        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          {error && <div style={{ color: 'red', background: '#ffebee', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}
          
          <div className="form-group mb-4">
            <label className="form-label">Region / Operational Unit (OU)</label>
            <select 
              className="form-select" 
              value={selectedUnitId} 
              onChange={e => setSelectedUnitId(e.target.value)}
              required
            >
              <option value="">-- Pilih Lokasi --</option>
              <option value="HO">HEAD OFFICE (HO)</option>
              {regions.length > 0 && (
                <optgroup label="Region">
                  {regions.filter(r => r.id !== '1').map(r => (
                    <option key={`reg_${r.id}`} value={`REGION_${r.id}`}>Region {r.name}</option>
                  ))}
                </optgroup>
              )}
              {units.length > 0 && (
                <optgroup label="Operational Unit / Mill">
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name} {u.abbreviation ? `(${u.abbreviation})` : ''}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="Masukkan username..."
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Masukkan password..."
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '1rem', padding: '0.75rem' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
