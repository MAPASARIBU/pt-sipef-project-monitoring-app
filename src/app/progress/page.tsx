'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, Project, ProgressUpdate } from '@/lib/db';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function ActualProgress() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [initialData, setInitialData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [graphModalProject, setGraphModalProject] = useState<Project | null>(null);

  const [authUser, setAuthUser] = useState<string | null>(null);
  const [loginUnitId, setLoginUnitId] = useState<string | null>(null);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    setAuthUser(getCookie('auth') || null);
    setLoginUnitId(getCookie('loginUnitId') || null);

    fetch('/api/db')
      .then(r => r.json())
      .then(d => {
        setData(d);
        setInitialData(JSON.parse(JSON.stringify(d)));
        setLoading(false);
      });
  }, []);

  if (loading || !data) return <div className="p-4">Loading Actual Progress...</div>;

  const isAdmin = authUser === 'admin';
  const loggedInUser = data.users.find(u => u.name === authUser);
  const userRole = loggedInUser ? data.roles.find(r => r.id === loggedInUser.roleId) : null;
  const roleName = userRole?.name.toLowerCase() || '';

  const isEngineeringHO = roleName.includes('engineering ho');
  const isPurchasing = roleName.includes('purchasing');
  const isDirectorHO = roleName.includes('director engineering');
  const isRegionalDirector = roleName.includes('regional director');
  const isRegionalController = roleName.includes('regional control');
  
  const isEngineeringRmo = roleName.includes('engineering rmo') || roleName.includes('staff rmo');
  const isOuStaff = roleName.includes('office assistant') || roleName.includes('manager');
  
  const isAuthorizedToInput = isAdmin || isEngineeringRmo || isOuStaff;

  const isForbiddenFromMonitoring = isEngineeringHO || isPurchasing || isDirectorHO || isRegionalDirector || isRegionalController || roleName.includes('ho') || loginUnitId === 'HO';
  const canInputMonitoring = isAuthorizedToInput && !isForbiddenFromMonitoring;

  const isRmo = isEngineeringRmo || roleName.includes('rmo');
  const hasGlobalView = isAdmin || isEngineeringHO || isPurchasing || isDirectorHO || roleName.includes('head of operation');
  const hasRegionalView = roleName.includes('regional director') || roleName.includes('regional control') || roleName.includes('rmo');

  const activeUnitId = loggedInUser?.unitId || (loginUnitId !== 'HO' ? loginUnitId : null);
  const activeUnit = data.units.find(u => u.id === activeUnitId);

  const isLockedToRegion = !!(activeUnit && !hasGlobalView) || isRmo || hasRegionalView;
  const isLockedToUnit = !!(activeUnit && !isRmo && !hasGlobalView && !hasRegionalView);
  
  const displaySelectedRegionId = selectedRegionId || (isLockedToRegion ? (loggedInUser?.regionId || activeUnit?.regionId || '') : '');
  const displaySelectedUnitId = selectedUnitId || (isLockedToUnit ? activeUnitId || '' : '');

  const unitsInRegion = data.units.filter(u => u.regionId === displaySelectedRegionId);
  
  const getVisibleProjects = (p: Project) => {
    if (displaySelectedUnitId && String(p.unitId) !== String(displaySelectedUnitId)) return false;
    if (displaySelectedRegionId && !displaySelectedUnitId) {
      const u = data.units.find(x => String(x.id) === String(p.unitId));
      if (u?.regionId !== displaySelectedRegionId) return false;
    }
    
    if (!displaySelectedRegionId && !displaySelectedUnitId) {
      if (isLockedToUnit && String(p.unitId) !== String(activeUnitId)) return false;
      if (isLockedToRegion) {
        const u = data.units.find(x => String(x.id) === String(p.unitId));
        if (u?.regionId !== (loggedInUser?.regionId || activeUnit?.regionId)) return false;
      }
    }
    return true;
  };

  const getUnitName = (unitId?: string) => {
    const u = data.units.find(x => String(x.id) === String(unitId));
    return u ? (u.abbreviation || u.name) : '-';
  };

  const sortProjects = (projects: Project[]) => {
    return [...projects].sort((a, b) => {
      const unitA = data.units.find(x => x.id === a.unitId);
      const unitB = data.units.find(x => x.id === b.unitId);
      
      const regionA = data.regions.find(r => r.id === unitA?.regionId);
      const regionB = data.regions.find(r => r.id === unitB?.regionId);

      const regionOrder: { [key: string]: number } = {
        'NORTH SUMATERA (NS)': 1,
        'BENGKULU (BK)': 2,
        'SOUTH SUMATERA (SS)': 3
      };
      
      const orderA = regionA ? (regionOrder[regionA.name] || 99) : 99;
      const orderB = regionB ? (regionOrder[regionB.name] || 99) : 99;

      if (orderA !== orderB) return orderA - orderB;

      const nameA = unitA?.name || '';
      const nameB = unitB?.name || '';
      if (nameA !== nameB) return nameA.localeCompare(nameB);

      const stationA = a.station || '';
      const stationB = b.station || '';
      if (stationA !== stationB) return stationA.localeCompare(stationB);

      return 0;
    });
  };

  // Filter for Table 1: Projects that have a contract and are visible to this user
  const contractedProjects = sortProjects(data.projects.filter(p => p.contractNumber && getVisibleProjects(p)));

  // Filter for Table 2 & 3: Projects that already have PR and PO filled
  const monitoringProjects = contractedProjects.filter(p => p.prNo && p.poNo);
  
  // Calculate max progress columns needed
  const maxProgressCount = Math.max(0, ...monitoringProjects.map(p => p.progressHistory?.length || 0));
  const hasAny100Percent = monitoringProjects.some(p => p.progressPercent === 100);

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? { ...p, ...updates } : p)
      };
    });
  };

  const handleSaveToDb = async (type: 'prpo' | 'monitoring') => {
    if (type === 'prpo') {
      if (!window.confirm("Apakah Anda yakin input PR dan PO sudah benar? Data yang sudah lengkap dan tersimpan tidak dapat diubah lagi.")) {
        return;
      }
    } else if (type === 'monitoring') {
      if (!window.confirm("Simpan data Monitoring Realisation Lapangan?")) {
        return;
      }
    }

    setSaving(true);
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setInitialData(JSON.parse(JSON.stringify(data)));
    setSaving(false);
    alert('Data Saved Successfully!');
  };

  const addProgress = (projectId: string) => {
    const p = data.projects.find(x => x.id === projectId);
    if (!p) return;
    const history = p.progressHistory ? [...p.progressHistory] : [];
    history.push({ 
      id: Date.now().toString(), 
      date: new Date().toISOString().split('T')[0], 
      percent: 0 
    });
    updateProject(projectId, { progressHistory: history });
  };

  const updateProgressValue = (projectId: string, progId: string, percent: number) => {
    const p = data.projects.find(x => x.id === projectId);
    if (!p || !p.progressHistory) return;
    const history = p.progressHistory.map(h => h.id === progId ? { ...h, percent } : h);
    
    // Auto-update the main progressPercent for the dashboard
    const latestPercent = history.length > 0 ? history[history.length - 1].percent : p.progressPercent;
    updateProject(projectId, { 
      progressHistory: history, 
      progressPercent: latestPercent, 
      progressUpdateDate: new Date().toISOString().split('T')[0] 
    });
  };

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">4. Actual Progress Update</h1>
      </div>

      {/* --- SELECTION --- */}
      <div className="card mb-6" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Select Region & Operational Unit</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '1.1rem' }}>Filter by Region</label>
            <select className="form-select" style={{ fontSize: '1.1rem', padding: '0.75rem' }} value={displaySelectedRegionId} onChange={e => { setSelectedRegionId(e.target.value); setSelectedUnitId(''); }} disabled={isLockedToRegion}>
              <option value="">-- Select Region --</option>
              {data.regions.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '1.1rem' }}>Filter by Operational Unit</label>
            <select className="form-select" style={{ fontSize: '1.1rem', padding: '0.75rem' }} value={displaySelectedUnitId} onChange={e => setSelectedUnitId(e.target.value)} disabled={!displaySelectedRegionId || isLockedToUnit}>
              <option value="">-- Select Unit --</option>
              {unitsInRegion.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <>
        {/* --- TABLE 1: CONTRACTED PROJECTS (PR & PO) --- */}
          {(!isForbiddenFromMonitoring || isAdmin) && (
            <div className="card mb-6" style={{ borderTop: '4px solid var(--primary)', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#0369a1' }}>Daftar Project Contracted</h2>
                  <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Isi Nomor PR terlebih dahulu, setelah itu Nomor PO bisa diisi.</p>
                </div>
                {isAuthorizedToInput && (
                  <button type="button" className="btn btn-primary" onClick={() => handleSaveToDb('prpo')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save PR & PO'}
                  </button>
                )}
              </div>
              
              {contractedProjects.length === 0 ? (
                <div className="text-muted p-4 text-center border rounded">Belum ada project yang terkontrak di OU ini.</div>
              ) : (
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead style={{ background: '#f0f9ff' }}>
                    <tr>
                      <th style={{ width: '5%' }}>Region</th>
                      <th style={{ width: '8%' }}>UO / Mill</th>
                      <th style={{ width: '27%' }}>Nama Project</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Harga Disetujui (Rp)</th>
                      <th style={{ width: '15%' }}>No. Contract</th>
                      <th style={{ width: '15%' }}>No. PR</th>
                      <th style={{ width: '15%' }}>No. PO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractedProjects.map(p => {
                      const initP = initialData?.projects.find(x => x.id === p.id);
                      const isLocked = Boolean(initP?.prNo && initP?.poNo);
                      const u = data.units.find(x => String(x.id) === String(p.unitId));
                      const region = data.regions.find(r => r.id === u?.regionId);
                      const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                      return (
                      <tr key={`t1-${p.id}`}>
                        <td style={{ fontWeight: 600 }}><span className="badge badge-gray">{regionAbbr}</span></td>
                        <td style={{ fontWeight: 600 }}>{getUnitName(p.unitId)}</td>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ textAlign: 'right', color: '#0369a1', fontWeight: 600 }}>{(p.finalTenderPrice || 0).toLocaleString('id-ID')}</td>
                        <td>{p.contractNumber}</td>
                        <td>
                          <input type="text" className="form-input" style={{ padding: '0.4rem', fontSize: '0.85rem', background: (!isAuthorizedToInput || isLocked) ? '#f8fafc' : '#fff' }} placeholder="Input PR No..." value={p.prNo || ''} onChange={e => updateProject(p.id, { prNo: e.target.value })} disabled={!isAuthorizedToInput || isLocked} />
                        </td>
                        <td>
                          <input type="text" className="form-input" style={{ padding: '0.4rem', fontSize: '0.85rem', background: (!isAuthorizedToInput || !p.prNo || isLocked) ? '#f8fafc' : '#fff' }} placeholder="Input PO No..." value={p.poNo || ''} onChange={e => updateProject(p.id, { poNo: e.target.value })} disabled={!isAuthorizedToInput || !p.prNo || isLocked} />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* --- TABLE 2: MONITORING REALISATION LAPANGAN (BASTL & PROGRESS) --- */}
          {(!isForbiddenFromMonitoring || isAdmin) && monitoringProjects.length > 0 && (
            <div className="card mb-6" style={{ borderTop: '4px solid #10b981', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#059669' }}>Monitoring Realitation Lapangan</h2>
                  <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Isi tanggal BASTL untuk membuka pengisian progress. Tambahkan kolom progress secara dinamis.</p>
                </div>
                {canInputMonitoring && (
                  <button type="button" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} onClick={() => handleSaveToDb('monitoring')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Monitoring'}
                  </button>
                )}
              </div>

              <div style={{ minWidth: '100%', overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  <thead style={{ background: '#f0fdf4' }}>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f0fdf4', minWidth: '60px' }}>Region</th>
                      <th style={{ position: 'sticky', left: '60px', zIndex: 10, background: '#f0fdf4', minWidth: '80px' }}>UO / Mill</th>
                      <th style={{ position: 'sticky', left: '140px', zIndex: 10, background: '#f0fdf4', minWidth: '200px' }}>Nama Project</th>
                      <th>Vendor Terpilih</th>
                      <th>Tanggal BASTL</th>
                      {Array.from({ length: maxProgressCount }).map((_, i) => (
                        <th key={`prog-th-${i}`} style={{ textAlign: 'center', minWidth: '120px' }}>Progress {i + 1}</th>
                      ))}
                      <th style={{ textAlign: 'center' }}>Action</th>
                      {hasAny100Percent && <th style={{ textAlign: 'center', minWidth: '140px' }}>Tanggal BAST</th>}
                      {hasAny100Percent && <th style={{ textAlign: 'center', minWidth: '140px' }}>Nomor SR</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {monitoringProjects.map(p => {
                      const initP = initialData?.projects.find(x => x.id === p.id);
                      const isBastSrLocked = Boolean(initP?.bastDate && initP?.srNo);
                      const isBastlLocked = Boolean(initP?.bastlDate);
                      const u = data.units.find(x => String(x.id) === String(p.unitId));
                      const region = data.regions.find(r => r.id === u?.regionId);
                      const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                      return (
                      <tr key={`t2-${p.id}`}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 9, background: '#fff', fontWeight: 600, borderRight: '1px solid #f1f5f9' }}><span className="badge badge-gray">{regionAbbr}</span></td>
                        <td style={{ position: 'sticky', left: '60px', zIndex: 9, background: '#fff', fontWeight: 600, borderRight: '1px solid #f1f5f9' }}>{getUnitName(p.unitId)}</td>
                        <td style={{ position: 'sticky', left: '140px', zIndex: 9, background: '#fff', fontWeight: 600, borderRight: '1px solid #f1f5f9' }}>{p.name}</td>
                        <td style={{ color: '#0369a1', fontWeight: 500 }}>{p.tenderResultWinner}</td>
                        <td>
                          <input type="date" className="form-input" style={{ padding: '0.4rem', fontSize: '0.85rem', width: '130px', background: (isBastlLocked || !canInputMonitoring) ? '#f1f5f9' : '#fff' }} value={p.bastlDate || ''} onChange={e => updateProject(p.id, { bastlDate: e.target.value })} disabled={!canInputMonitoring || isBastlLocked} />
                        </td>
                        
                        {/* Progress Columns */}
                        {Array.from({ length: maxProgressCount }).map((_, i) => {
                          const prog = p.progressHistory?.[i];
                          return (
                            <td key={`prog-td-${p.id}-${i}`} style={{ textAlign: 'center' }}>
                              {prog ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                  <input 
                                    type="number" 
                                    min={i > 0 ? (p.progressHistory?.[i - 1]?.percent || 0) : 0} 
                                    max="100" 
                                    className="form-input" 
                                    style={{ padding: '0.4rem', fontSize: '0.85rem', width: '70px', textAlign: 'right', background: (i < (p.progressHistory?.length || 0) - 1 || !canInputMonitoring) ? '#e2e8f0' : '#fff', cursor: (i < (p.progressHistory?.length || 0) - 1 || !canInputMonitoring) ? 'not-allowed' : 'auto' }} 
                                    value={prog.percent} 
                                    disabled={i < (p.progressHistory?.length || 0) - 1 || !canInputMonitoring}
                                    onChange={e => updateProgressValue(p.id, prog.id, Number(e.target.value))} 
                                    onBlur={e => {
                                      let val = Number(e.target.value);
                                      const prev = i > 0 ? (p.progressHistory?.[i - 1]?.percent || 0) : 0;
                                      if (val < prev) {
                                        alert(`Progress tidak boleh lebih kecil dari progress sebelumnya (${prev}%)`);
                                        val = prev;
                                      }
                                      if (val > 100) val = 100;
                                      updateProgressValue(p.id, prog.id, val);
                                    }}
                                  />
                                  <span style={{ fontWeight: 600 }}>%</span>
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          );
                        })}
                        
                        {/* Action Column */}
                        <td style={{ textAlign: 'center' }}>
                          {p.progressPercent === 100 ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>Selesai</span>
                          ) : (
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} 
                              onClick={() => addProgress(p.id)}
                              disabled={!p.bastlDate || !canInputMonitoring}
                              title={!canInputMonitoring ? "Tidak memiliki akses" : (!p.bastlDate ? "Isi tanggal BASTL terlebih dahulu" : "Tambah monitoring progress")}
                            >
                              + Monitoring Progress
                            </button>
                          )}
                        </td>
                        
                        {hasAny100Percent && (
                          <td style={{ textAlign: 'center' }}>
                            {p.progressPercent === 100 && (
                              <input 
                                type="date" 
                                className="form-input" 
                                style={{ padding: '0.4rem', fontSize: '0.85rem', width: '130px', background: (p.bastDate || !canInputMonitoring || isBastSrLocked) ? '#f1f5f9' : '#fff' }} 
                                value={p.bastDate || ''} 
                                onChange={e => updateProject(p.id, { bastDate: e.target.value })} 
                                disabled={!canInputMonitoring || isBastSrLocked} 
                              />
                            )}
                          </td>
                        )}
                        {hasAny100Percent && (
                          <td style={{ textAlign: 'center' }}>
                            {p.progressPercent === 100 && (
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ padding: '0.4rem', fontSize: '0.85rem', width: '130px', background: (!canInputMonitoring || isBastSrLocked) ? '#f8fafc' : '#fff' }} 
                                placeholder="Nomor SR..."
                                value={p.srNo || ''} 
                                onChange={e => updateProject(p.id, { srNo: e.target.value })} 
                                disabled={!canInputMonitoring || isBastSrLocked} 
                              />
                            )}
                          </td>
                        )}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- TABLE 3: HISTORICAL REALISATION CONTRACT --- */}
          {monitoringProjects.filter(p => p.progressHistory && p.progressHistory.length > 0).length > 0 && (
            <div className="card mb-6" style={{ borderTop: '4px solid #64748b', overflowX: 'auto' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#475569' }}>Historical Realisation Contract</h2>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Catatan riwayat progres yang sudah disimpan.</p>
              </div>
              
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ width: '5%' }}>Region</th>
                    <th style={{ width: '8%' }}>UO / Mill</th>
                    <th style={{ width: '27%' }}>Nama Project</th>
                    <th>No. Contract</th>
                    <th>Vendor</th>
                    <th>Tgl BASTL</th>
                    <th>Latest Progress</th>
                    <th>Update Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoringProjects.filter(p => p.progressHistory && p.progressHistory.length > 0).map(p => {
                    const u = data.units.find(x => String(x.id) === String(p.unitId));
                    const region = data.regions.find(r => r.id === u?.regionId);
                    const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                    return (
                    <tr key={`t3-${p.id}`}>
                      <td style={{ fontWeight: 600 }}><span className="badge badge-gray">{regionAbbr}</span></td>
                      <td style={{ fontWeight: 600 }}>{getUnitName(p.unitId)}</td>
                      <td style={{ fontWeight: 600 }}>
                        <button 
                          type="button" 
                          onClick={() => setGraphModalProject(p)}
                          style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 600, textAlign: 'left' }}
                        >
                          {p.name}
                        </button>
                      </td>
                      <td>{p.contractNumber}</td>
                      <td>{p.tenderResultWinner}</td>
                      <td>{p.bastlDate}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: p.progressPercent === 100 ? '#16a34a' : '#d97706' }}>
                          {p.progressPercent || 0}%
                        </span>
                      </td>
                      <td className="text-muted">{p.progressUpdateDate || '-'}</td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </>

      {/* --- GRAPH MODAL --- */}
      {graphModalProject && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '2rem', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#1e293b' }}>Grafik Progress: {graphModalProject.name}</h2>
              <button type="button" onClick={() => setGraphModalProject(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {(() => {
              const p = graphModalProject;
              const history = p.progressHistory || [];
              const plannedMonths = Number(p.plannedDuration) || 3; // Default 3 months
              const plannedWeeks = plannedMonths * 4;
              
              const labels = [];
              const dataPoints = [];
              
              // We simulate weekly intervals from BASTL Date
              let currentPercent = 0;
              
              // Map actual history dates to week indices roughly
              const bastl = new Date(p.bastlDate || p.createdAt || Date.now());
              const weekData: Record<number, number> = {};
              
              history.forEach(h => {
                const date = new Date(h.date);
                const diffTime = Math.abs(date.getTime() - bastl.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const weekIndex = Math.floor(diffDays / 7);
                // Keep highest percent for that week
                if (!weekData[weekIndex] || h.percent > weekData[weekIndex]) {
                  weekData[weekIndex] = h.percent;
                }
              });

              const maxActualWeek = Math.max(-1, ...Object.keys(weekData).map(Number));
              const totalWeeksToDisplay = Math.max(plannedWeeks, maxActualWeek);
              
              let lastKnownPercent = 0;
              for (let w = 0; w <= totalWeeksToDisplay; w++) {
                labels.push(`W ${w}`);
                
                // For actual progress, we only put data points where an update happened.
                // We use null for gaps so the chart can interpolate (draw a straight line) between updates.
                if (weekData[w] !== undefined) {
                  dataPoints.push(weekData[w]);
                  lastKnownPercent = weekData[w];
                } else if (w === 0 && weekData[w] === undefined) {
                  // Ensure we always start from 0 if there's no data at week 0
                  dataPoints.push(0);
                } else if (w > maxActualWeek) {
                  // Future weeks have no line
                  dataPoints.push(null);
                } else {
                  // Gaps between updates
                  dataPoints.push(null);
                }
              }

              const chartData = {
                labels,
                datasets: [
                  {
                    label: 'Actual Progress (%)',
                    data: dataPoints,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    tension: 0.2,
                    pointRadius: 4,
                    spanGaps: true, // Interpolate between missing data points
                  },
                  {
                    label: 'Target Selesai (100%)',
                    data: labels.map((_, i) => i <= plannedWeeks ? (i / plannedWeeks) * 100 : 100),
                    borderColor: 'rgb(34, 197, 94)',
                    borderDash: [5, 5],
                    pointRadius: 0,
                  }
                ],
              };

              const options = {
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Progress (%)' }
                  },
                  x: {
                    title: { display: true, text: `Time (Weeks from BASTL) - Target: ${plannedMonths} Bulan` }
                  }
                },
              };

              return (
                <div>
                  <div style={{ height: '400px' }}>
                    <Line options={options} data={chartData} />
                  </div>
                  {maxActualWeek > plannedWeeks && lastKnownPercent < 100 && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '6px' }}>
                      <strong>Peringatan:</strong> Realisasi pekerjaan melewati waktu rencana (Target: {plannedWeeks} minggu, saat ini {maxActualWeek} minggu) namun belum selesai (Progress {lastKnownPercent}%).
                    </div>
                  )}
                  {maxActualWeek > plannedWeeks && lastKnownPercent === 100 && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', borderRadius: '6px' }}>
                      <strong>Catatan:</strong> Proyek telah selesai 100%, namun melewati batas waktu kontrak awal.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
