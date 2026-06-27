'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, Project, InvitedPT, Unit } from '@/lib/db';

export default function PSDExecution() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Dashboard State (2.2)
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [viewMode, setViewMode] = useState<'project' | 'vendor'>('project');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showBatchPsdForm, setShowBatchPsdForm] = useState(false);
  const [batchPsdDate, setBatchPsdDate] = useState('');
  const [batchOpenDate, setBatchOpenDate] = useState('');

  const [authUser, setAuthUser] = useState<string | null>(null);
  const [loginUnitId, setLoginUnitId] = useState<string | null>(null);

  // Bidding State (2.3)
  const [nextProcessModal, setNextProcessModal] = useState<{ projectId: string, stage: 1 | 2 } | null>(null);
  const [modalCheckedPts, setModalCheckedPts] = useState<string[]>([]);

  // History State (2.4)
  const [showHistorySelectionModal, setShowHistorySelectionModal] = useState(false);
  const [showDetailedHistoryModal, setShowDetailedHistoryModal] = useState(false);
  const [selectedHistoryProjectIds, setSelectedHistoryProjectIds] = useState<string[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Historical Filters
  const [histRegionId, setHistRegionId] = useState('');
  const [histUnitId, setHistUnitId] = useState('');
  const [histCategory, setHistCategory] = useState('');

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
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!data) return;
    const isAdmin = authUser === 'admin';
    const loggedInUser = data.users.find(u => u.name === authUser);
    const userRole = loggedInUser ? data.roles.find(r => r.id === loggedInUser.roleId) : null;
    const roleName = userRole?.name.toLowerCase() || '';

    const isEngineeringHO = roleName.includes('engineering ho');
    const isPurchasing = roleName.includes('purchasing');
    const isDirector = roleName.includes('director engineering');
    
    const isRmo = roleName.includes('rmo');
    const hasGlobalView = isAdmin || isEngineeringHO || isPurchasing || isDirector || roleName.includes('head of operation');

    const activeUnitId = loggedInUser?.unitId || (loginUnitId !== 'HO' ? loginUnitId : null);
    const activeUnit = data.units.find(u => u.id === activeUnitId);

    if ((activeUnit && !hasGlobalView && !hasRegionalView) || (isRmo && activeUnit)) {
      setSelectedRegionId(activeUnit.regionId);
      if (!isRmo) {
        setSelectedUnitId(activeUnit.id);
      }
    }
  }, [data, authUser, loginUnitId]);

  if (loading || !data) return <div className="p-4">Loading PSD Dashboard...</div>;

  const isAdmin = authUser === 'admin';
  const loggedInUser = data.users.find(u => u.name === authUser);
  const userRole = loggedInUser ? data.roles.find(r => r.id === loggedInUser.roleId) : null;
  const roleName = userRole?.name.toLowerCase() || '';

  const isEngineeringHO = roleName.includes('engineering ho');
  const isPurchasing = roleName.includes('purchasing');
  const isDirector = roleName.includes('director engineering');
  const isAuthorizedToInput = isAdmin || isEngineeringHO || isPurchasing || isDirector;

  const isRmo = roleName.includes('rmo');
  const hasGlobalView = isAdmin || isEngineeringHO || isPurchasing || isDirector || roleName.includes('head of operation');

  const hasRegionalView = roleName.includes('regional director') || roleName.includes('regional control') || roleName.includes('rmo');
  const activeUnitId = loggedInUser?.unitId || (loginUnitId !== 'HO' ? loginUnitId : null);
  const activeUnit = data.units.find(u => u.id === activeUnitId);

  const isLockedToRegion = !!(activeUnit && !hasGlobalView) || isRmo || hasRegionalView;
  const isLockedToUnit = !!(activeUnit && !isRmo && !hasGlobalView && !hasRegionalView);
  
  const displaySelectedRegionId = selectedRegionId || (isLockedToRegion ? (loggedInUser?.regionId || activeUnit?.regionId || '') : '');
  const displaySelectedUnitId = selectedUnitId || (isLockedToUnit ? activeUnitId || '' : '');
  
  const displayHistRegionId = histRegionId || (isLockedToRegion ? (loggedInUser?.regionId || activeUnit?.regionId || '') : '');
  const displayHistUnitId = histUnitId || (isLockedToUnit ? activeUnitId || '' : '');

  const getVisibleProjects = (p: any, isHist: boolean = false) => {
    const categoryFilter = isHist ? histCategory : filterCategory;
    const regionFilter = isHist ? displayHistRegionId : displaySelectedRegionId;
    const unitFilter = isHist ? displayHistUnitId : displaySelectedUnitId;
    
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (unitFilter && String(p.unitId) !== String(unitFilter)) return false;
    if (regionFilter && !unitFilter) {
      const u = data.units.find((x: any) => String(x.id) === String(p.unitId));
      if (u?.regionId !== regionFilter) return false;
    }
    return true;
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

  // -- LOGIC FOR 2.2 DASHBOARD --
  const incomingProjects = sortProjects(data.projects.filter(p => p.tenderDateToPsd && !p.tenderPsdDate && getVisibleProjects(p, false)));

  const vendorMap = new Map<string, { pt: InvitedPT, projects: Project[] }>();
  incomingProjects.forEach(proj => {
    (proj.invitedPts || []).forEach(pt => {
      if (!vendorMap.has(pt.ptName)) {
        vendorMap.set(pt.ptName, { pt, projects: [] });
      }
      vendorMap.get(pt.ptName)!.projects.push(proj);
    });
  });
  const vendorViewList = Array.from(vendorMap.values());

  const handleToggleProject = (id: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleSaveBatchPsd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || selectedProjectIds.length === 0) return;

    setSaving(true);
    const updatedProjects = data.projects.map(p => {
      if (selectedProjectIds.includes(p.id)) {
        return { ...p, tenderPsdDate: batchPsdDate, openTenderDate: batchOpenDate };
      }
      return p;
    });

    const newData = { ...data, projects: updatedProjects };
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });
    
    setData(newData);
    setSaving(false);
    setShowBatchPsdForm(false);
    setSelectedProjectIds([]);
    setBatchPsdDate('');
    setBatchOpenDate('');
    alert(`Successfully set PSD Tender Date for ${selectedProjectIds.length} projects!`);
  };

  // -- LOGIC FOR 2.3 BIDDING --
  const biddingProjects = sortProjects(data.projects.filter(p => p.tenderPsdDate && !p.isBiddingFinished && getVisibleProjects(p, false)));
  const completedBiddingProjects = sortProjects(data.projects.filter(p => p.tenderPsdDate && p.isBiddingFinished && getVisibleProjects(p, true)));

  const allVendorsSet = new Set<string>();
  const rev1VendorsSet = new Set<string>();
  const rev2VendorsSet = new Set<string>();
  biddingProjects.forEach(p => {
    (p.invitedPts || []).forEach(pt => {
      allVendorsSet.add(pt.ptName);
      if (pt.isInvitedToRev1) rev1VendorsSet.add(pt.ptName);
      if (pt.isInvitedToRev2) rev2VendorsSet.add(pt.ptName);
    });
  });
  const allVendors = Array.from(allVendorsSet);
  const rev1Vendors = Array.from(rev1VendorsSet);
  const rev2Vendors = Array.from(rev2VendorsSet);

  const handleBidUpdate = (projectId: string, ptId: string, field: 'initialBid' | 'revisedBid1' | 'revisedBid2', value: string) => {
    if (!data) return;
    const project = data.projects.find(p => p.id === projectId);
    if (!project || !project.invitedPts) return;

    const numValue = value === '' ? undefined : Number(value);
    const updatedPts = project.invitedPts.map(pt => {
      if (pt.id === ptId) return { ...pt, [field]: numValue };
      return pt;
    });

    const updatedProjects = data.projects.map(p => 
      p.id === projectId ? { ...p, invitedPts: updatedPts } : p
    );
    setData({ ...data, projects: updatedProjects });
    
    fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, projects: updatedProjects })
    });
  };

  const handleBidFileUpdate = (projectId: string, ptId: string, field: 'initialBidFile' | 'revisedBid1File' | 'revisedBid2File', value: string) => {
    if (!data) return;
    const project = data.projects.find(p => p.id === projectId);
    if (!project || !project.invitedPts) return;

    const updatedPts = project.invitedPts.map(pt => {
      if (pt.id === ptId) return { ...pt, [field]: value };
      return pt;
    });

    const updatedProjects = data.projects.map(p => 
      p.id === projectId ? { ...p, invitedPts: updatedPts } : p
    );
    setData({ ...data, projects: updatedProjects });
    
    fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, projects: updatedProjects })
    });
  };

  const handleWinnerUpdate = (projectId: string, field: 'tenderResultWinner' | 'finalTenderPrice', value: any) => {
    if (!data) return;
    const updatedProjects = data.projects.map(p => 
      p.id === projectId ? { ...p, [field]: value } : p
    );
    setData({ ...data, projects: updatedProjects });
    fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, projects: updatedProjects })
    });
  };

  const finishBidding = async (projectId: string) => {
    if (!data) return;
    setSaving(true);
    const updatedProjects = data.projects.map(p => 
      p.id === projectId ? { ...p, isBiddingFinished: true } : p
    );
    const newData = { ...data, projects: updatedProjects };
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });
    setData(newData);
    setSaving(false);
    alert('Evaluasi Bidding Selesai! Data disimpan ke Histori.');
  };

  const openNextProcessModal = (projectId: string, stage: 1 | 2) => {
    const project = data.projects.find(p => p.id === projectId);
    if (!project || !project.invitedPts) return;

    const preChecked = project.invitedPts
      .filter(pt => stage === 1 ? pt.isInvitedToRev1 : pt.isInvitedToRev2)
      .map(pt => pt.id);

    setModalCheckedPts(preChecked);
    setNextProcessModal({ projectId, stage });
  };

  const saveNextProcess = async () => {
    if (!data || !nextProcessModal) return;
    setSaving(true);
    
    const { projectId, stage } = nextProcessModal;
    const fieldToUpdate = stage === 1 ? 'isInvitedToRev1' : 'isInvitedToRev2';

    const updatedProjects = data.projects.map(p => {
      if (p.id === projectId && p.invitedPts) {
        const updatedPts = p.invitedPts.map(pt => ({
          ...pt,
          [fieldToUpdate]: modalCheckedPts.includes(pt.id)
        }));
        return { ...p, invitedPts: updatedPts };
      }
      return p;
    });

    const newData = { ...data, projects: updatedProjects };
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });

    setData(newData);
    setSaving(false);
    setNextProcessModal(null);
  };

  const getUnitName = (unitId: string) => { const u = data.units.find(u => String(u.id) === String(unitId)); return u ? (u.abbreviation || u.name) : 'Unknown'; };

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">2C. PSD Execution (Purchasing Dashboard)</h1>
      </div>

      <div className="card mb-6" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-3 gap-4">
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>Filter by Region</label>
            <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={displaySelectedRegionId} onChange={e => {
              setSelectedRegionId(e.target.value);
              setSelectedUnitId('');
              setSelectedProjectIds([]);
              setShowBatchPsdForm(false);
            }} disabled={isLockedToRegion}>
              <option value="">-- Select Region --</option>
              {data.regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>Pilih OU / Mill</label>
            <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={displaySelectedUnitId} onChange={e => {
              setSelectedUnitId(e.target.value);
              setSelectedProjectIds([]);
            }} disabled={isLockedToUnit || !displaySelectedRegionId}>
              <option value="">-- Pilih OU / Mill --</option>
              {data.units.filter(u => u.regionId === displaySelectedRegionId).map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>Category</label>
            <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="CAPEX">CAPEX</option>
              <option value="OPEX">OPEX</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- DASHBOARD 2.2 --- */}
      {isAuthorizedToInput && (
        <div className="card mb-6" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <h2 style={{ marginBottom: '1.5rem', color: '#d97706' }}>1. Tender PSD to Vendor (Incoming from Eng HO)</h2>

          <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <button className={`btn ${viewMode === 'project' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('project')}>Group By Project</button>
              <button className={`btn ${viewMode === 'vendor' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('vendor')}>Group By Vendor</button>
            </div>

            {incomingProjects.length === 0 ? (
              <p className="text-muted">No incoming projects from Engineering HO for this unit.</p>
            ) : (
              <>
                {viewMode === 'project' ? (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                          <th style={{ width: '10%' }}>Region</th>
                          <th style={{ width: '15%' }}>UO / Mill</th>
                          <th>Project Name</th>
                          <th>Files (from Ops)</th>
                          <th>Invited Vendors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomingProjects.map(p => {
                          const u = data.units.find(x => String(x.id) === String(p.unitId));
                          const region = data.regions.find(r => r.id === u?.regionId);
                          const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                          return (
                          <tr key={p.id} style={{ cursor: 'pointer', background: selectedProjectIds.includes(p.id) ? '#fff8eb' : 'transparent' }} onClick={() => handleToggleProject(p.id)}>
                            <td style={{ textAlign: 'center' }}>
                              <input type="checkbox" style={{ transform: 'scale(1.2)' }} checked={selectedProjectIds.includes(p.id)} readOnly />
                            </td>
                            <td style={{ fontWeight: 600 }}><span className="badge badge-gray">{regionAbbr}</span></td>
                            <td style={{ fontWeight: 600 }}>{getUnitName(p.unitId)}</td>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td>
                              <div style={{ fontSize: '0.8rem' }}>
                                <div>BoQ: {p.boqFiles && p.boqFiles.length > 0 ? (
                                  <div style={{ display: 'inline-flex', gap: '0.2rem', flexWrap: 'wrap', verticalAlign: 'top' }}>
                                    {p.boqFiles.map((f, i) => {
                                      const fileName = f.includes('-') ? f.split('-').slice(1).join('-') : f;
                                      return <a key={i} href={f} target="_blank" rel="noreferrer" style={{ color: 'green', textDecoration: 'underline' }}>✓ {fileName}</a>;
                                    })}
                                  </div>
                                ) : <span style={{ color: 'red' }}>✗ Missing</span>}</div>
                                <div>Drawing: {p.drawingFiles && p.drawingFiles.length > 0 ? (
                                  <div style={{ display: 'inline-flex', gap: '0.2rem', flexWrap: 'wrap', verticalAlign: 'top' }}>
                                    {p.drawingFiles.map((f, i) => {
                                      const fileName = f.includes('-') ? f.split('-').slice(1).join('-') : f;
                                      return <a key={i} href={f} target="_blank" rel="noreferrer" style={{ color: 'green', textDecoration: 'underline' }}>✓ {fileName}</a>;
                                    })}
                                  </div>
                                ) : <span style={{ color: 'red' }}>✗ Missing</span>}</div>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.85rem' }}>
                                {(p.invitedPts || []).map((pt, i) => (
                                  <div key={i}>• {pt.ptName}</div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Vendor Name & Contact</th>
                          <th>Projects Invited To (in this OU)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorViewList.map((v, i) => (
                          <tr key={i}>
                            <td style={{ verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 600 }}>{v.pt.ptName}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{v.pt.email} | {v.pt.contactPhone}</div>
                            </td>
                            <td>
                              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.9rem' }}>
                                {v.projects.map(p => <li key={p.id}>{p.name}</li>)}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {viewMode === 'project' && selectedProjectIds.length > 0 && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    {!showBatchPsdForm ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-primary" onClick={() => setShowBatchPsdForm(true)} style={{ background: '#d97706', borderColor: '#d97706' }}>
                          Set Tender PSD Date ({selectedProjectIds.length} Projects)
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveBatchPsd} style={{ background: '#fff8eb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                        <h3 style={{ marginTop: 0, color: '#d97706' }}>Execute Tender to Vendor</h3>
                        <div className="grid grid-cols-2 gap-6 mb-4">
                          <div className="form-group">
                            <label className="form-label">Tender PSD Date (Execution Date)</label>
                            <input type="date" className="form-input" value={batchPsdDate} onChange={e => setBatchPsdDate(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Open Tender Date (Optional)</label>
                            <input type="date" className="form-input" value={batchOpenDate} onChange={e => setBatchOpenDate(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                          <button type="button" className="btn btn-secondary" onClick={() => setShowBatchPsdForm(false)}>Cancel</button>
                          <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#d97706', borderColor: '#d97706' }}>
                            {saving ? 'Saving...' : 'Save & Move to Bidding'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* --- BIDDING 2.3 --- */}
      {isAuthorizedToInput && (
      <div className="card mb-6" style={{ borderTop: '4px solid #10b981', overflowX: 'auto' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#059669' }}>2. Evaluasi Bidding & Pemenang</h2>
        <p className="text-muted mb-4">Input otomatis tersimpan saat Anda mengetik (Auto-save).</p>
        
        {biddingProjects.length === 0 ? (
          <div className="text-muted p-4 text-center border rounded" style={{ borderColor: '#e2e8f0' }}>Tidak ada proyek yang siap untuk evaluasi bidding.</div>
        ) : (
          <div style={{ minWidth: '100%', overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <table className="data-table" style={{ fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 30, background: '#f0fdf4', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <tr>
                  <th rowSpan={2} style={{ width: '100px', minWidth: '100px', maxWidth: '100px', verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 40, background: '#f0fdf4', borderRight: '1px solid #d1fae5' }}>Region</th>
                  <th rowSpan={2} style={{ width: '200px', minWidth: '200px', maxWidth: '200px', verticalAlign: 'middle', position: 'sticky', left: '100px', zIndex: 40, background: '#f0fdf4', borderRight: '1px solid #d1fae5' }}>List Project</th>
                  <th rowSpan={2} style={{ width: '150px', minWidth: '150px', maxWidth: '150px', verticalAlign: 'middle', textAlign: 'right', background: '#eef6fc', color: '#0369a1', position: 'sticky', left: '300px', zIndex: 40, borderRight: '1px solid #bae6fd' }}>Budget (Rp)</th>
                  <th colSpan={allVendors.length} style={{ textAlign: 'center', background: '#d1fae5', borderBottom: '1px solid #a7f3d0' }}>Penawaran Awal</th>
                  <th rowSpan={2} style={{ width: '100px', textAlign: 'center', background: '#e2e8f0', verticalAlign: 'middle' }}>Next Process</th>
                  {rev1Vendors.length > 0 && <th colSpan={rev1Vendors.length} style={{ textAlign: 'center', background: '#d1fae5', borderBottom: '1px solid #a7f3d0' }}>Revisi 1</th>}
                  {rev1Vendors.length > 0 && <th rowSpan={2} style={{ width: '100px', textAlign: 'center', background: '#e2e8f0', verticalAlign: 'middle' }}>Next Process</th>}
                  {rev2Vendors.length > 0 && <th colSpan={rev2Vendors.length} style={{ textAlign: 'center', background: '#d1fae5', borderBottom: '1px solid #a7f3d0' }}>Revisi 2</th>}
                  <th rowSpan={2} style={{ width: '200px', minWidth: '200px', verticalAlign: 'middle', padding: '0.75rem' }}>Winner Selection</th>
                </tr>
                <tr>
                  {allVendors.map(v => <th key={`awal-${v}`} style={{ textAlign: 'center', minWidth: '150px', padding: '0.75rem' }}>{v}</th>)}
                  {rev1Vendors.map(v => <th key={`rev1-${v}`} style={{ textAlign: 'center', minWidth: '150px', padding: '0.75rem' }}>{v}</th>)}
                  {rev2Vendors.map(v => <th key={`rev2-${v}`} style={{ textAlign: 'center', minWidth: '150px', padding: '0.75rem' }}>{v}</th>)}
                </tr>
              </thead>
              <tbody>
                {biddingProjects.map(p => {
                  const u = data.units.find(x => String(x.id) === String(p.unitId));
                  const region = data.regions.find(r => r.id === u?.regionId);
                  const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                  return (
                    <tr key={p.id}>
                      {/* REGION */}
                      <td style={{ verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 10, background: '#ffffff', borderRight: '1px solid #f1f5f9', width: '100px', minWidth: '100px', maxWidth: '100px', fontWeight: 600 }}>
                        <span className="badge badge-gray">{regionAbbr}</span>
                      </td>
                      <td style={{ verticalAlign: 'middle', position: 'sticky', left: '100px', zIndex: 10, background: '#ffffff', borderRight: '1px solid #f1f5f9', width: '200px', minWidth: '200px', maxWidth: '200px' }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{getUnitName(p.unitId)}</span> | BoQ: {p.boqFiles && p.boqFiles.length > 0 ? '✓' : '✗'} | Drw: {p.drawingFiles && p.drawingFiles.length > 0 ? '✓' : '✗'}
                        </div>
                      </td>
                      
                      {/* BUDGET COLUMN */}
                      <td style={{ verticalAlign: 'middle', textAlign: 'right', fontWeight: 600, color: '#0369a1', background: '#f8fafc', position: 'sticky', left: '300px', zIndex: 10, borderRight: '1px solid #e2e8f0', width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                        {((p.planQty || 0) * (p.planPricePerQty || 0)).toLocaleString('id-ID')}
                      </td>
                      
                      {/* PENAWARAN AWAL */}
                      {allVendors.map(vName => {
                        const pt = p.invitedPts?.find(x => x.ptName === vName);
                        return (
                          <td key={`awal-${vName}`} style={{ verticalAlign: 'middle', textAlign: 'center', padding: '0.75rem' }}>
                            {pt ? (
                              <div>
                                <input type="text" className="form-input" style={{ padding: '0.5rem', fontSize: '0.9rem', height: 'auto', textAlign: 'right', width: '100%', minWidth: '110px' }} placeholder="Rp" value={pt.initialBid ? pt.initialBid.toLocaleString('id-ID') : ''} onChange={e => handleBidUpdate(p.id, pt.id, 'initialBid', e.target.value.replace(/\D/g, ''))} />
                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', textAlign: 'left' }}>
                                  {pt.initialBidFile ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                      <a href="#" onClick={e => e.preventDefault()} style={{ color: 'var(--primary)', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={pt.initialBidFile}>{pt.initialBidFile}</a>
                                      <button type="button" onClick={() => handleBidFileUpdate(p.id, pt.id, 'initialBidFile', '')} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✖</button>
                                    </div>
                                  ) : (
                                    <label style={{ cursor: 'pointer', color: '#0369a1', background: '#e0f2fe', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'block', textAlign: 'center', border: '1px dashed #7dd3fc' }}>
                                      + Attach File
                                      <input type="file" style={{ display: 'none' }} accept=".pdf,.xls,.xlsx" onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                          handleBidFileUpdate(p.id, pt.id, 'initialBidFile', e.target.files[0].name);
                                        }
                                      }} />
                                    </label>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        );
                      })}
                      
                      {/* NEXT PROCESS 1 */}
                      <td style={{ verticalAlign: 'middle', textAlign: 'center', background: '#f8fafc' }}>
                        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => openNextProcessModal(p.id, 1)}>Pilih Lanjut</button>
                      </td>

                      {/* REVISI 1 */}
                      {rev1Vendors.length > 0 && rev1Vendors.map(vName => {
                        const pt = p.invitedPts?.find(x => x.ptName === vName && x.isInvitedToRev1);
                        return (
                          <td key={`rev1-${vName}`} style={{ verticalAlign: 'middle', textAlign: 'center', padding: '0.75rem' }}>
                            {pt ? (
                              <div>
                                <input type="text" className="form-input" style={{ padding: '0.5rem', fontSize: '0.9rem', height: 'auto', textAlign: 'right', width: '100%', minWidth: '110px' }} placeholder="Rp" value={pt.revisedBid1 ? pt.revisedBid1.toLocaleString('id-ID') : ''} onChange={e => handleBidUpdate(p.id, pt.id, 'revisedBid1', e.target.value.replace(/\D/g, ''))} />
                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', textAlign: 'left' }}>
                                  {pt.revisedBid1File ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                      <a href="#" onClick={e => e.preventDefault()} style={{ color: 'var(--primary)', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={pt.revisedBid1File}>{pt.revisedBid1File}</a>
                                      <button type="button" onClick={() => handleBidFileUpdate(p.id, pt.id, 'revisedBid1File', '')} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✖</button>
                                    </div>
                                  ) : (
                                    <label style={{ cursor: 'pointer', color: '#0369a1', background: '#e0f2fe', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'block', textAlign: 'center', border: '1px dashed #7dd3fc' }}>
                                      + Attach File
                                      <input type="file" style={{ display: 'none' }} accept=".pdf,.xls,.xlsx" onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                          handleBidFileUpdate(p.id, pt.id, 'revisedBid1File', e.target.files[0].name);
                                        }
                                      }} />
                                    </label>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* NEXT PROCESS 2 */}
                      {rev1Vendors.length > 0 && (
                        <td style={{ verticalAlign: 'middle', textAlign: 'center', background: '#f8fafc' }}>
                          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => openNextProcessModal(p.id, 2)}>Pilih Lanjut</button>
                        </td>
                      )}

                      {/* REVISI 2 */}
                      {rev2Vendors.length > 0 && rev2Vendors.map(vName => {
                        const pt = p.invitedPts?.find(x => x.ptName === vName && x.isInvitedToRev2);
                        return (
                          <td key={`rev2-${vName}`} style={{ verticalAlign: 'middle', textAlign: 'center', padding: '0.75rem' }}>
                            {pt ? (
                              <div>
                                <input type="text" className="form-input" style={{ padding: '0.5rem', fontSize: '0.9rem', height: 'auto', textAlign: 'right', width: '100%', minWidth: '110px' }} placeholder="Rp" value={pt.revisedBid2 ? pt.revisedBid2.toLocaleString('id-ID') : ''} onChange={e => handleBidUpdate(p.id, pt.id, 'revisedBid2', e.target.value.replace(/\D/g, ''))} />
                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', textAlign: 'left' }}>
                                  {pt.revisedBid2File ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                      <a href="#" onClick={e => e.preventDefault()} style={{ color: 'var(--primary)', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={pt.revisedBid2File}>{pt.revisedBid2File}</a>
                                      <button type="button" onClick={() => handleBidFileUpdate(p.id, pt.id, 'revisedBid2File', '')} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✖</button>
                                    </div>
                                  ) : (
                                    <label style={{ cursor: 'pointer', color: '#0369a1', background: '#e0f2fe', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'block', textAlign: 'center', border: '1px dashed #7dd3fc' }}>
                                      + Attach File
                                      <input type="file" style={{ display: 'none' }} accept=".pdf,.xls,.xlsx" onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                          handleBidFileUpdate(p.id, pt.id, 'revisedBid2File', e.target.files[0].name);
                                        }
                                      }} />
                                    </label>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* WINNER */}
                      <td style={{ verticalAlign: 'middle', background: '#f0fdf4', padding: '0.75rem' }}>
                        <select className="form-select" style={{ fontSize: '0.8rem', padding: '0.5rem', height: 'auto', marginBottom: '0.5rem', width: '100%', minWidth: '150px' }} value={p.tenderResultWinner || ''} onChange={e => handleWinnerUpdate(p.id, 'tenderResultWinner', e.target.value)}>
                          <option value="">-- Pilih Pemenang --</option>
                          {(p.invitedPts || []).map(pt => (
                            <option key={pt.id} value={pt.ptName}>{pt.ptName}</option>
                          ))}
                        </select>
                        <input type="text" className="form-input" style={{ fontSize: '0.9rem', padding: '0.5rem', height: 'auto', marginBottom: '0.5rem', textAlign: 'right', width: '100%', minWidth: '150px' }} placeholder="Harga Final (Rp)" value={p.finalTenderPrice ? p.finalTenderPrice.toLocaleString('id-ID') : ''} onChange={e => handleWinnerUpdate(p.id, 'finalTenderPrice', e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined)} />
                        <button type="button" className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }} onClick={() => finishBidding(p.id)} disabled={!p.tenderResultWinner || saving}>Selesai & Simpan</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* --- HISTORY BIDDING 2.4 --- */}
      {completedBiddingProjects.length > 0 && (
        <div className="card mb-6" style={{ borderTop: '4px solid #64748b', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ marginBottom: '0.5rem', color: '#475569' }}>3. Histori Evaluasi Selesai</h2>
              <p className="text-muted mb-0">Daftar proyek yang sudah ditetapkan pemenangnya.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem', minWidth: '150px', width: 'auto' }} value={displayHistRegionId} onChange={e => { setHistRegionId(e.target.value); setHistUnitId(''); }} disabled={isLockedToRegion}>
                <option value="">-- Pilih Region --</option>
                {data.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem', minWidth: '150px', width: 'auto', maxWidth: '300px' }} value={displayHistUnitId} onChange={e => setHistUnitId(e.target.value)} disabled={!displayHistRegionId || isLockedToUnit}>
                <option value="">-- Pilih OU / Mill --</option>
                {data.units.filter(u => u.regionId === displayHistRegionId).map(u => <option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
              </select>
              <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem', minWidth: '150px', width: 'auto' }} value={histCategory} onChange={e => setHistCategory(e.target.value)}>
                <option value="">All Categories</option>
                <option value="CAPEX">CAPEX</option>
                <option value="OPEX">OPEX</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistorySelectionModal(true)}>Lihat Detail Histori</button>
            </div>
          </div>
          
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead style={{ background: '#f1f5f9' }}>
              <tr>
                <th>Region</th>
                <th>UO</th>
                <th>List Project</th>
                <th>Vendor Pemenang</th>
                <th style={{ textAlign: 'right' }}>Nilai Disepakati (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {completedBiddingProjects.map(p => {
                const u = data.units.find(x => String(x.id) === String(p.unitId));
                const region = data.regions.find(r => r.id === u?.regionId);
                const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                return (
                <tr key={p.id}>
                  <td style={{ verticalAlign: 'middle', fontWeight: 600 }}><span className="badge badge-gray">{regionAbbr}</span></td>
                  <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>{getUnitName(p.unitId)}</td>
                  <td style={{ verticalAlign: 'middle' }}><div style={{ fontWeight: 600 }}>{p.name}</div></td>
                  <td style={{ verticalAlign: 'middle', fontWeight: 600, color: 'var(--primary)' }}>{p.tenderResultWinner}</td>
                  <td style={{ verticalAlign: 'middle', textAlign: 'right', fontWeight: 600 }}>{p.finalTenderPrice?.toLocaleString('id-ID')}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* --- MODAL PILIH HISTORY --- */}
      {showHistorySelectionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Pilih Proyek Untuk Dilihat Detail Historinya</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', overflowY: 'auto' }}>
              {completedBiddingProjects.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedHistoryProjectIds.includes(p.id)} 
                    onChange={(e) => setSelectedHistoryProjectIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))} 
                  />
                  <span style={{ fontWeight: 600 }}>{p.name}</span> <span className="text-muted">({getUnitName(p.unitId)})</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistorySelectionModal(false)}>Batal</button>
              <button type="button" className="btn btn-primary" onClick={() => { setShowHistorySelectionModal(false); setShowDetailedHistoryModal(true); }} disabled={selectedHistoryProjectIds.length === 0}>Lihat Detail</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DETAIL HISTORY --- */}
      {showDetailedHistoryModal && (() => {
        const historyProjects = completedBiddingProjects.filter(p => selectedHistoryProjectIds.includes(p.id));
        
        const stage0Set = new Set<string>();
        const stage1Set = new Set<string>();
        const stage2Set = new Set<string>();
        const winnerSet = new Set<string>();

        historyProjects.forEach(p => {
          (p.invitedPts || []).forEach(pt => {
            stage0Set.add(pt.ptName);
            if (pt.isInvitedToRev1) stage1Set.add(pt.ptName);
            if (pt.isInvitedToRev2) stage2Set.add(pt.ptName);
          });
          if (p.tenderResultWinner) winnerSet.add(p.tenderResultWinner);
        });

        const s0Vendors = Array.from(stage0Set);
        const s1Vendors = Array.from(stage1Set);
        const s2Vendors = Array.from(stage2Set);
        const wVendors = Array.from(winnerSet);

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card" style={{ width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', paddingBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Detail Histori Evaluasi Bidding</h3>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDetailedHistoryModal(false)}>Tutup</button>
              </div>
              
              <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1, margin: '0 -1.5rem', padding: '0 1.5rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ paddingBottom: '1.5rem', paddingTop: '1rem' }}>
                  <table className="data-table" style={{ fontSize: '0.85rem', margin: 0, borderCollapse: 'collapse', minWidth: 'max-content' }}>
                    <thead style={{ background: '#f1f5f9', position: 'sticky', top: '-1rem', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                      <tr>
                        <th rowSpan={2} style={{ width: '100px', minWidth: '100px', maxWidth: '100px', borderRight: '1px solid #cbd5e1', verticalAlign: 'middle', borderBottom: '1px solid #cbd5e1', position: 'sticky', left: 0, zIndex: 12, background: '#f1f5f9' }}>UO</th>
                        <th rowSpan={2} style={{ width: '250px', minWidth: '250px', maxWidth: '250px', borderRight: '1px solid #cbd5e1', verticalAlign: 'middle', borderBottom: '1px solid #cbd5e1', position: 'sticky', left: '100px', zIndex: 12, background: '#f1f5f9' }}>List Project</th>
                        {s0Vendors.length > 0 && <th colSpan={s0Vendors.length} style={{ textAlign: 'center', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>PENAWARAN AWAL</th>}
                        {s1Vendors.length > 0 && <th colSpan={s1Vendors.length} style={{ textAlign: 'center', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>PENAWARAN REVISI I</th>}
                        {s2Vendors.length > 0 && <th colSpan={s2Vendors.length} style={{ textAlign: 'center', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>PENAWARAN REVISI II</th>}
                        {wVendors.length > 0 && <th colSpan={wVendors.length} style={{ textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>WINNER</th>}
                      </tr>
                      <tr>
                        {s0Vendors.map(v => <th key={`s0-${v}`} style={{ fontWeight: 600, fontSize: '0.75rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #cbd5e1', background: '#f1f5f9' }}>{v}</th>)}
                        {s1Vendors.map(v => <th key={`s1-${v}`} style={{ fontWeight: 600, fontSize: '0.75rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #cbd5e1', background: '#f1f5f9' }}>{v}</th>)}
                        {s2Vendors.map(v => <th key={`s2-${v}`} style={{ fontWeight: 600, fontSize: '0.75rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #cbd5e1', background: '#f1f5f9' }}>{v}</th>)}
                        {wVendors.map(v => <th key={`w-${v}`} style={{ fontWeight: 600, fontSize: '0.75rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #cbd5e1', background: '#f1f5f9' }}>{v}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {historyProjects.map(p => (
                        <tr key={p.id} style={{ background: '#fff' }}>
                          <td style={{ fontWeight: 600, borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 1, background: '#f8fafc' }}>{getUnitName(p.unitId)}</td>
                          <td style={{ borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'sticky', left: '100px', zIndex: 1, background: '#f8fafc' }}>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                          </td>
                          
                          {/* Penawaran Awal */}
                          {s0Vendors.map(v => {
                            const pt = (p.invitedPts || []).find(x => x.ptName === v);
                            return <td key={`s0-${p.id}-${v}`} style={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: pt ? 'transparent' : '#f8fafc' }}>{pt?.initialBid ? pt.initialBid.toLocaleString('id-ID') : '-'}</td>;
                          })}
                          
                          {/* Penawaran Revisi 1 */}
                          {s1Vendors.map(v => {
                            const pt = (p.invitedPts || []).filter(x => x.isInvitedToRev1).find(x => x.ptName === v);
                            return <td key={`s1-${p.id}-${v}`} style={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: pt ? 'transparent' : '#f8fafc' }}>{pt?.revisedBid1 ? pt.revisedBid1.toLocaleString('id-ID') : '-'}</td>;
                          })}
                          
                          {/* Penawaran Revisi 2 */}
                          {s2Vendors.map(v => {
                            const pt = (p.invitedPts || []).filter(x => x.isInvitedToRev2).find(x => x.ptName === v);
                            return <td key={`s2-${p.id}-${v}`} style={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: pt ? 'transparent' : '#f8fafc' }}>{pt?.revisedBid2 ? pt.revisedBid2.toLocaleString('id-ID') : '-'}</td>;
                          })}
                          
                          {/* Winner */}
                          {wVendors.map(v => {
                            const isWinner = p.tenderResultWinner === v;
                            return <td key={`w-${p.id}-${v}`} style={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: isWinner ? '#f0fdf4' : '#f8fafc', color: isWinner ? '#16a34a' : 'inherit', fontWeight: isWinner ? 600 : 400 }}>{isWinner && p.finalTenderPrice ? p.finalTenderPrice.toLocaleString('id-ID') : '-'}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- MODAL NEXT PROCESS --- */}
      {nextProcessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--primary)' }}>Lanjut Minta Penawaran (Revisi {nextProcessModal.stage})</h3>
            <p className="text-muted mb-4">Pilih vendor mana saja yang lolos untuk memberikan penawaran revisi {nextProcessModal.stage}.</p>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: '4px' }}>
              {(data?.projects.find(p => p.id === nextProcessModal.projectId)?.invitedPts || []).map(pt => {
                // If it's stage 2, only show vendors that made it to stage 1
                if (nextProcessModal.stage === 2 && !pt.isInvitedToRev1) return null;
                
                return (
                  <label key={pt.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: modalCheckedPts.includes(pt.id) ? '#f0fdf4' : '#fff' }}>
                    <input 
                      type="checkbox" 
                      style={{ marginRight: '1rem', transform: 'scale(1.2)' }}
                      checked={modalCheckedPts.includes(pt.id)}
                      onChange={(e) => {
                        if (e.target.checked) setModalCheckedPts(prev => [...prev, pt.id]);
                        else setModalCheckedPts(prev => prev.filter(id => id !== pt.id));
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{pt.ptName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pt.contactName}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setNextProcessModal(null)}>Batal</button>
              <button type="button" className="btn btn-primary" onClick={saveNextProcess} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Lanjut Minta Penawaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
