'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, Project, Unit, Region } from '@/lib/db';
import { useRouter } from 'next/navigation';

export default function ProjectInitiation() {
  const router = useRouter();
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [modalRegionId, setModalRegionId] = useState<string>('');
  const [stagedProjects, setStagedProjects] = useState<Partial<Project>[]>([]);

  // Project Form Fields
  const [project, setProject] = useState<Partial<Project>>({
    category: 'CAPEX',
    type: 'CIVIL',
    execution: 'NON LEBARAN',
    planQty: 1,
    planPricePerQty: 0
  });

  // Filter States
  const [filterCategory, setFilterCategory] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterWorkType, setFilterWorkType] = useState('');

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
        setLoading(false);
      });
  }, []);

  const openNewProjectModal = () => {
    setModalStep(1);
    
    if (!data) return;
    const isAdmin = authUser === 'admin';
    const loggedInUser = data.users.find(u => u.name === authUser);
    const userRole = loggedInUser ? data.roles.find(r => r.id === loggedInUser.roleId) : null;
    const roleName = userRole?.name.toLowerCase() || '';

    const hasGlobalView = isAdmin || 
      roleName.includes('director engineering') || 
      roleName.includes('head of operation') || 
      roleName.includes('engineering ho') || 
      roleName.includes('purchasing');

    const activeUnitId = loggedInUser?.unitId || (loginUnitId !== 'HO' ? loginUnitId : null);
    const activeUnit = data.units.find(u => u.id === activeUnitId);
    
    const isRmo = roleName.includes('rmo');

    let defaultRegionId = '';
    let defaultUnitId = '';

    if ((activeUnit && !hasGlobalView) || isRmo) {
      defaultRegionId = activeUnit ? activeUnit.regionId : '';
      if (!isRmo) {
        defaultUnitId = activeUnit ? activeUnit.id : '';
      }
    }

    setModalRegionId(defaultRegionId);
    setStagedProjects([]);
    setProject({ category: 'CAPEX', type: 'CIVIL', execution: 'NON LEBARAN', planQty: 1, planPricePerQty: 0, unitId: defaultUnitId });
    setIsModalOpen(true);
  };

  const handleNextStep = () => {
    if (!modalRegionId || !project.unitId) return;
    setModalStep(2);
  };

  const handleStageProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.unitId || !project.name) return;

    const stagedProject = {
      ...project,
      id: 'temp-' + Date.now().toString() + Math.random().toString(),
      createdAt: new Date().toISOString()
    };
    
    setStagedProjects([...stagedProjects, stagedProject]);
    
    // Reset inputs, keep the selected unit
    setProject(prev => ({
      ...prev,
      name: '',
      planQty: 1,
      planPricePerQty: 0
    }));
  };

  const handleSaveAll = async () => {
    if (!data || stagedProjects.length === 0) return;

    setSaving(true);
    
    const finalProjects = stagedProjects.map((p, idx) => ({
      ...p,
      id: Date.now().toString() + idx.toString()
    })) as Project[];

    const newData = { ...data, projects: [...data.projects, ...finalProjects] };
    
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });

    setData(newData);
    setSaving(false);
    setIsModalOpen(false);
  };

  const removeStagedProject = (tempId: string) => {
    setStagedProjects(stagedProjects.filter(p => p.id !== tempId));
  };

  const getAbbreviation = (text: string) => {
    const match = text.match(/\(([^)]+)\)/);
    return match ? match[1] : text;
  };

  const getWorkTypeAbbr = (type: string) => {
    if (!type) return '-';
    switch (type.toUpperCase()) {
      case 'MECHANICAL': return 'mech';
      case 'ELECTRICAL': return 'elec';
      case 'CIVIL': return 'cvil';
      case 'HEAVY EQUIPMENT': return 'Heqp';
      case 'SERVICE CONTRACT': return 'SerQ';
      default: return type;
    }
  };

  if (loading || !data) return <div className="p-4">Loading Initiation Form...</div>;

  const isAdmin = authUser === 'admin';
  const loggedInUser = data.users.find(u => u.name === authUser);
  const userRole = loggedInUser ? data.roles.find(r => r.id === loggedInUser.roleId) : null;
  const roleName = userRole?.name.toLowerCase() || '';

  const hasGlobalView = isAdmin || 
    roleName.includes('director engineering') || 
    roleName.includes('head of operation') || 
    roleName.includes('engineering ho') || 
    roleName.includes('purchasing');

  const hasRegionalView = roleName.includes('regional director') || roleName.includes('regional control') || roleName.includes('rmo');

  const visibleProjects = data.projects.filter(p => {
    if (hasGlobalView) return true;
    
    const projectUnit = data.units.find(u => u.id === p.unitId);
    
    if (hasRegionalView && loggedInUser?.regionId) {
      return projectUnit?.regionId === loggedInUser.regionId;
    }

    const activeUnitId = loggedInUser?.unitId || (loginUnitId !== 'HO' ? loginUnitId : null);
    const activeUnit = data.units.find(u => u.id === activeUnitId);
    const isRmo = roleName.includes('rmo');

    if (isRmo && activeUnit) {
      return projectUnit?.regionId === activeUnit.regionId;
    }

    if (activeUnitId) {
      return p.unitId === activeUnitId;
    }
    return false;
  });

  const filteredProjects = visibleProjects.filter(p => {
    const u = data.units.find(x => x.id === p.unitId);
    const r = data.regions.find(reg => reg.id === u?.regionId);
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterRegion && r?.id !== filterRegion) return false;
    if (filterUnit && p.unitId !== filterUnit) return false;
    if (filterWorkType && p.type !== filterWorkType) return false;
    return true;
  }).sort((a, b) => {
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

  const selectedUnit = data.units.find(u => u.id === project.unitId);
  const isMill = selectedUnit?.type === 'Mill';
  const availableUnits = data.units.filter(u => u.regionId === modalRegionId);

  const activeUnitId = loggedInUser?.unitId || (loginUnitId !== 'HO' ? loginUnitId : null);
  const activeUnit = data.units.find(u => u.id === activeUnitId);
  const isRmo = roleName.includes('rmo');
  const isEngineeringHO = roleName.includes('engineering ho');
  const isPurchasing = roleName.includes('purchasing');
  
  const isLockedToRegion = !!(activeUnit && !hasGlobalView) || isRmo || hasRegionalView;
  const isLockedToUnit = !!(activeUnit && !isRmo && !hasGlobalView && !hasRegionalView);
  
  const displayFilterRegion = filterRegion || (isLockedToRegion ? (loggedInUser?.regionId || activeUnit?.regionId || '') : '');
  const displayFilterUnit = filterUnit || (isLockedToUnit ? activeUnitId || '' : '');

  return (
    <div>
      <div className="page-header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">1. Project Initiation</h1>
        {(!isEngineeringHO && !isPurchasing) && (
          <button 
            className="btn btn-primary" 
            onClick={openNewProjectModal}
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.95rem', fontWeight: 600 }}
          >
            + New Project
          </button>
        )}
      </div>

      <div className="card mb-6" style={{ borderTop: '4px solid var(--primary)', overflowX: 'auto' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Daftar Proyek (Initiation)</h2>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <select className="form-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem', width: 'auto' }}>
            <option value="">All Categories</option>
            <option value="CAPEX">CAPEX</option>
            <option value="OPEX">OPEX</option>
          </select>
          <select className="form-select" value={displayFilterRegion} onChange={e => {setFilterRegion(e.target.value); setFilterUnit('');}} style={{ padding: '0.4rem', fontSize: '0.85rem', width: 'auto' }} disabled={isLockedToRegion}>
            <option value="">All Regions</option>
            {data.regions.filter(r => r.type === 'Operasional').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="form-select" value={displayFilterUnit} onChange={e => setFilterUnit(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem', width: 'auto' }} disabled={isLockedToUnit || (!displayFilterRegion && false)}>
            <option value="">All OU/Mills</option>
            {data.units.filter(u => !displayFilterRegion || u.regionId === displayFilterRegion).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="form-select" value={filterWorkType} onChange={e => setFilterWorkType(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem', width: 'auto' }}>
            <option value="">All Work Types</option>
            <option value="MECHANICAL">MECHANICAL</option>
            <option value="CIVIL">CIVIL</option>
            <option value="ELECTRICAL">ELECTRICAL</option>
            <option value="HEAVY EQUIPMENT">HEAVY EQ.</option>
            <option value="SERVICE CONTRACT">SERVICE CONTRACT</option>
          </select>
          {(filterCategory || filterRegion || filterUnit || filterWorkType) && (
            <button className="btn btn-secondary" onClick={() => {setFilterCategory(''); setFilterRegion(''); setFilterUnit(''); setFilterWorkType('');}} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Clear Filters</button>
          )}
        </div>

        {filteredProjects.length === 0 ? (
          <p className="text-muted">Belum ada proyek yang dapat ditampilkan atau tidak ada data yang cocok dengan filter.</p>
        ) : (
          <table className="data-table" style={{ fontSize: '0.75rem' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ width: '3%' }}>No</th>
                <th style={{ width: '5%' }}>Ctgry</th>
                <th style={{ width: '3%' }}>Reg</th>
                <th style={{ width: '7%' }}>OU/Mill</th>
                <th style={{ width: '42%' }}>Project Name</th>
                <th style={{ width: '10%' }}>Work Type</th>
                <th style={{ width: '5%', textAlign: 'right' }}>Qty</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Harga/Qty</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Total Harga (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: React.ReactNode[] = [];
                let currentUnitId: string | null = null;
                let currentUnitSum = 0;
                let globalIndex = 1;

                filteredProjects.forEach((p, index) => {
                  if (currentUnitId !== p.unitId) {
                    if (currentUnitId !== null) {
                      const uPrev = data.units.find(x => x.id === currentUnitId);
                      rows.push(
                        <tr key={`subtotal-${currentUnitId}`} style={{ background: '#f1f5f9' }}>
                          <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, color: '#334155' }}>
                            Total Budget {uPrev ? (uPrev.abbreviation || uPrev.name) : 'OU'}:
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>
                            {currentUnitSum.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    }
                    currentUnitId = p.unitId;
                    currentUnitSum = 0;
                  }

                  const rowTotal = (p.planQty || 0) * (p.planPricePerQty || 0);
                  currentUnitSum += rowTotal;

                  const u = data.units.find(x => x.id === p.unitId);
                  const region = data.regions.find(r => r.id === u?.regionId);
                  
                  rows.push(
                    <tr key={p.id}>
                      <td>{globalIndex++}</td>
                      <td><span style={{ fontWeight: 600, fontSize: '0.75rem', color: p.category === 'CAPEX' ? '#0369a1' : '#b45309' }}>{p.category === 'CAPEX' ? 'CPX' : p.category === 'OPEX' ? 'OPX' : p.category}</span></td>
                      <td>{region ? getAbbreviation(region.name) : '-'}</td>
                      <td>{u ? (u.abbreviation || u.name.split(' ').map((w: string) => w[0]?.toUpperCase()).join('')) : '-'}</td>
                      <td style={{ fontWeight: 600 }}>
                        {p.name}
                        {p.station && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>
                            Stasiun: {p.station}
                          </div>
                        )}
                      </td>
                      <td>{getWorkTypeAbbr(p.type || '')}</td>
                      <td style={{ textAlign: 'right' }}>{p.planQty}</td>
                      <td style={{ textAlign: 'right' }}>{(p.planPricePerQty || 0).toLocaleString('id-ID')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{rowTotal.toLocaleString('id-ID')}</td>
                    </tr>
                  );
                });

                if (currentUnitId !== null) {
                  const uPrev = data.units.find(x => x.id === currentUnitId);
                  rows.push(
                    <tr key={`subtotal-${currentUnitId}-last`} style={{ background: '#f1f5f9' }}>
                      <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, color: '#334155' }}>
                        Total Budget {uPrev ? (uPrev.abbreviation || uPrev.name) : 'OU'}:
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>
                        {currentUnitSum.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                }

                return rows;
              })()}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: modalStep === 1 ? '600px' : '95vw', maxWidth: '1400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, transition: 'all 0.3s ease' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '12px 12px 0 0' }}>
              <h2 style={{ margin: 0, color: 'var(--primary)' }}>Create New Project {modalStep === 2 && '- Tambah Multiple'}</h2>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {modalStep === 2 && stagedProjects.length > 0 && (
                  <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving} style={{ padding: '0.5rem 1rem', background: '#16a34a', borderColor: '#15803d' }}>
                    {saving ? 'Menyimpan...' : `Simpan Semua Project (${stagedProjects.length})`}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem 1rem' }}>Tutup</button>
              </div>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: modalStep === 1 ? 'column' : 'row', gap: '2rem' }}>
              
              {/* STEP 1: SELECT REGION & OU */}
              {modalStep === 1 && (
                <div style={{ flex: 1 }}>
                  <div className="form-group mb-6">
                    <label className="form-label">Pilih Region</label>
                    <select className="form-select" value={modalRegionId} onChange={e => {
                      setModalRegionId(e.target.value);
                      setProject({...project, unitId: ''});
                    }} disabled={isLockedToRegion}>
                      <option value="">-- Pilih Region --</option>
                      {data.regions.filter(r => r.type === 'Operasional').map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group mb-6">
                    <label className="form-label">Pilih Operational Unit (OU) / Mill</label>
                    <select className="form-select" value={project.unitId || ''} onChange={e => setProject({...project, unitId: e.target.value})} disabled={isLockedToUnit || !modalRegionId}>
                      <option value="">-- Pilih OU / Mill --</option>
                      {availableUnits.map(u => (
                        <option key={u.id} value={u.id}>{u.name} {u.abbreviation ? `(${u.abbreviation})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                    <button type="button" className="btn btn-primary" onClick={handleNextStep} disabled={!modalRegionId || !project.unitId}>
                      Lanjut &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: MULTI-ADD FORM & TABLE */}
              {modalStep === 2 && (
                <>
                  {/* Left Column: Form */}
                  <div style={{ flex: '0 0 400px', borderRight: '1px solid #e2e8f0', paddingRight: '2rem' }}>
                    <form onSubmit={handleStageProject}>
                      <div className="form-group mb-4">
                        <label className="form-label" style={{ color: '#0369a1' }}>
                          Region & Unit Terpilih:
                        </label>
                        <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.9rem', fontWeight: 600 }}>
                          {data.regions.find(r => r.id === modalRegionId)?.name} <br/>
                          <span style={{ color: '#166534' }}>{data.units.find(u => u.id === project.unitId)?.name}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                          <label className="form-label">Category</label>
                          <select className="form-select" value={project.category} onChange={e => setProject({...project, category: e.target.value as any})}>
                            <option value="CAPEX">CAPEX</option>
                            <option value="OPEX">OPEX</option>
                          </select>
                        </div>
                        
                        {isMill && (
                          <div className="form-group">
                            <label className="form-label">Stasiun</label>
                            <select className="form-select" value={project.station || ''} onChange={e => setProject({...project, station: e.target.value})}>
                              <option value="">Pilih...</option>
                              <option value="Loading Ramp">Loading Ramp</option>
                              <option value="Sterilizer">Sterilizer</option>
                              <option value="Thresher">Thresher</option>
                              <option value="Press">Press</option>
                              <option value="Clarification">Clarification</option>
                              <option value="Kernel">Kernel</option>
                              <option value="Boiler">Boiler</option>
                              <option value="Power Plant">Power Plant</option>
                              <option value="Effluent">Effluent</option>
                            </select>
                          </div>
                        )}

                        <div className={`form-group ${!isMill ? 'col-span-2' : ''}`}>
                          <label className="form-label">Project / Item Name</label>
                          <input type="text" className="form-input" value={project.name || ''} onChange={e => setProject({...project, name: e.target.value})} required />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Quantity</label>
                          <input type="number" className="form-input" value={project.planQty} onChange={e => setProject({...project, planQty: Number(e.target.value)})} min="1" required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Harga / Qty (Rp)</label>
                          <input type="text" className="form-input" style={{ textAlign: 'right' }} value={project.planPricePerQty ? project.planPricePerQty.toLocaleString('id-ID') : ''} onChange={e => setProject({...project, planPricePerQty: Number(e.target.value.replace(/\D/g, ''))})} required />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Work Type</label>
                          <select className="form-select" value={project.type} onChange={e => setProject({...project, type: e.target.value as any})}>
                            {isMill ? (
                              <>
                                <option value="MECHANICAL">MECHANICAL</option>
                                <option value="CIVIL">CIVIL</option>
                                <option value="ELECTRICAL">ELECTRICAL</option>
                                <option value="HEAVY EQUIPMENT">HEAVY EQ.</option>
                                <option value="SERVICE CONTRACT">SERVICE CONTRACT</option>
                              </>
                            ) : (
                              <option value="CIVIL">CIVIL</option>
                            )}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Exec. Plan</label>
                          <select className="form-select" value={project.execution} onChange={e => setProject({...project, execution: e.target.value as any})}>
                            <option value="NON LEBARAN">NON LEBARAN</option>
                            <option value="LEBARAN">LEBARAN</option>
                          </select>
                        </div>

                        <div className="form-group col-span-2">
                          <label className="form-label">Total Harga (Rp)</label>
                          <div className="form-input" style={{ background: '#eef6fc', fontWeight: 600, textAlign: 'right', color: '#0369a1' }}>
                            {((project.planQty || 0) * (project.planPricePerQty || 0)).toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>
                      
                      <button type="submit" className="btn btn-secondary w-full" style={{ marginTop: '1.5rem', width: '100%', display: 'block', background: '#f8fafc', border: '2px dashed #cbd5e1' }}>
                        + Tambah ke Daftar Kanan
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Staged Table */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}>Daftar Project Baru ({stagedProjects.length})</h3>
                      <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Klik tombol hijau "Simpan Semua Project" di pojok kanan atas untuk menyimpan ke database.</p>
                    </div>

                    <div className="table-container" style={{ flex: 1, maxHeight: '60vh', overflowY: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.75rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '3%' }}>REG</th>
                            <th style={{ width: '7%' }}>OU/MILL</th>
                            <th style={{ width: '5%' }}>CTGRY</th>
                            <th style={{ width: '10%' }}>STATION</th>
                            <th style={{ width: '35%' }}>PROJECT NAME</th>
                            <th style={{ width: '8%' }}>WORK TYPE</th>
                            <th style={{ width: '4%', textAlign: 'right' }}>QTY</th>
                            <th style={{ width: '10%', textAlign: 'right' }}>HARGA/QTY</th>
                            <th style={{ width: '15%', textAlign: 'right' }}>TOTAL HARGA</th>
                            <th style={{ width: '3%', textAlign: 'center' }}>HAPUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stagedProjects.length === 0 ? (
                            <tr>
                              <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                Belum ada project yang ditambahkan.<br/>Silakan isi form di sebelah kiri dan klik "Tambah".
                              </td>
                            </tr>
                          ) : (
                            stagedProjects.map((p, index) => {
                              const u = data.units.find(x => x.id === p.unitId);
                              const r = data.regions.find(reg => reg.id === u?.regionId);
                              const regionAbbr = r ? getAbbreviation(r.name) : '-';
                              const unitAbbr = u ? (u.abbreviation || u.name.split(' ').map((w: string) => w[0]?.toUpperCase()).join('')) : '-';

                              return (
                                <tr key={p.id}>
                                  <td><span className="badge badge-gray">{regionAbbr}</span></td>
                                  <td>{unitAbbr}</td>
                                  <td><span style={{ fontWeight: 600, fontSize: '0.75rem', color: p.category === 'CAPEX' ? '#0369a1' : '#b45309' }}>{p.category === 'CAPEX' ? 'CPX' : p.category === 'OPEX' ? 'OPX' : p.category}</span></td>
                                  <td>{p.station || '-'}</td>
                                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                                  <td>{getWorkTypeAbbr(p.type || '')}</td>
                                  <td style={{ textAlign: 'right' }}>{p.planQty}</td>
                                  <td style={{ textAlign: 'right' }}>{(p.planPricePerQty || 0).toLocaleString('id-ID')}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{((p.planQty || 0) * (p.planPricePerQty || 0)).toLocaleString('id-ID')}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button 
                                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }} 
                                      onClick={() => removeStagedProject(p.id!)}
                                      title="Hapus"
                                    >×</button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
