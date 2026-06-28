'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, Project, InvitedPT, Unit } from '@/lib/db';

export default function TenderExecution() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showTenderForm, setShowTenderForm] = useState(false);

  const [authUser, setAuthUser] = useState<string | null>(null);
  const [loginUnitId, setLoginUnitId] = useState<string | null>(null);

  // Batch Tender Form State
  const [tenderDateToPsd, setTenderDateToPsd] = useState('');
  const [tenderPsdDate, setTenderPsdDate] = useState('');
  const [openTenderDate, setOpenTenderDate] = useState('');
  const [tenderResultWinner, setTenderResultWinner] = useState('');
  const [invitedPts, setInvitedPts] = useState<InvitedPT[]>([]);
  
  // Vendor Modal State
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  
  // Historical Filters
  const [histRegionId, setHistRegionId] = useState('');
  const [histUnitId, setHistUnitId] = useState('');
  const [histCategory, setHistCategory] = useState('');
  const [groupByVendor, setGroupByVendor] = useState(false);

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

  if (loading || !data) return <div className="p-4">Loading...</div>;

  const isAdmin = authUser === 'admin';
  const loggedInUser = data.users.find(u => u.name === authUser);
  const userRole = loggedInUser ? data.roles.find(r => r.id === loggedInUser.roleId) : null;
  const roleName = userRole?.name.toLowerCase() || '';

  const isEngineeringHO = roleName.includes('engineering ho');
  const isPurchasing = roleName.includes('purchasing');
  const isDirector = roleName.includes('director engineering');
  const isAuthorizedToInput = isAdmin || isEngineeringHO || isDirector;

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

  // Find eligible projects for the selected unit: docComplete && continueProcess && no tender date to PSD yet
  const eligibleProjects = sortProjects(data.projects.filter(p => p.docComplete && p.continueProcess && !p.tenderDateToPsd && getVisibleProjects(p, false)));

  // Find historical projects that have been proceeded to PSD
  let historicalProjects = sortProjects(data.projects.filter(p => p.docComplete && p.continueProcess && p.tenderDateToPsd && getVisibleProjects(p, true)));

  const allHistVendorsSet = new Set<string>();
  historicalProjects.forEach(p => {
    (p.invitedPts || []).forEach(pt => allHistVendorsSet.add(pt.ptName));
  });
  const allHistVendors = Array.from(allHistVendorsSet).sort();

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUnitId(e.target.value);
    setSelectedProjectIds([]);
    setShowTenderForm(false);
  };

  const handleToggleProject = (id: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selectedProjectIds.length === 0) {
      alert("Please select at least 1 project to continue.");
      return;
    }
    setShowTenderForm(true);
  };

  const handleToggleVendor = (vendorId: string) => {
    setSelectedVendorIds(prev => prev.includes(vendorId) ? prev.filter(v => v !== vendorId) : [...prev, vendorId]);
  };

  const handleConfirmVendors = () => {
    if (!data || !data.vendors) return;
    
    // Convert selected vendors to InvitedPT objects
    const newPts: InvitedPT[] = [];
    selectedVendorIds.forEach((vid, i) => {
      const vendor = data.vendors.find(v => v.id === vid);
      if (vendor && vendor.contacts && vendor.contacts.length > 0) {
        const contact = vendor.contacts[0];
        newPts.push({
          id: `pt-${Date.now()}-${i}`,
          ptName: vendor.name,
          email: contact.email || '',
          contactName: contact.personName || '',
          contactPhone: contact.contactNumber || ''
        });
      }
    });

    setInvitedPts(newPts);
    setShowVendorModal(false);
  };

  const handleRemovePt = (ptId: string) => {
    setInvitedPts(prev => prev.filter(pt => pt.id !== ptId));
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || selectedProjectIds.length === 0) return;

    setSaving(true);
    
    // Update all selected projects
    const updatedProjects = data.projects.map(p => {
      if (selectedProjectIds.includes(p.id)) {
        return {
          ...p,
          tenderDateToPsd,
          invitedPts
        };
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
    setShowTenderForm(false);
    setSelectedProjectIds([]);
    setInvitedPts([]);
    setSelectedVendorIds([]);
    alert(`Successfully processed tender for ${selectedProjectIds.length} projects!`);
  };

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">2B. Tender Batch (Engineering HO)</h1>
      </div>

      <div className="card mb-6" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-3 gap-4">
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>Pilih Region</label>
            <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={displaySelectedRegionId} onChange={e => {
              setSelectedRegionId(e.target.value);
              setSelectedUnitId('');
              setSelectedProjectIds([]);
              setShowTenderForm(false);
            }} disabled={isLockedToRegion}>
              <option value="">-- Pilih Region --</option>
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
              setShowTenderForm(false);
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

      <div className="card mb-6" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Step 1: Select Projects for Tender</h2>
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Eligible Projects (Ready for Tender)</h3>
            
            {eligibleProjects.length === 0 ? (
              <p className="text-muted">No eligible projects found in this unit. Ensure Phase 2A (Doc Submission) is complete.</p>
            ) : (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                      <th style={{ width: '10%' }}>Region</th>
                      <th style={{ width: '15%' }}>UO / Mill</th>
                      <th style={{ width: '25%' }}>Project / Item Name</th>
                      <th style={{ width: '20%' }}>BoQ Attachment</th>
                      <th style={{ width: '15%' }}>Drawing Attachment</th>
                      <th style={{ width: '10%' }}>Doc Submission Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleProjects.map(p => {
                      const u = data.units.find(x => x.id === p.unitId);
                      const region = data.regions.find(r => r.id === u?.regionId);
                      const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                      return (
                      <tr key={p.id} style={{ cursor: isAuthorizedToInput ? 'pointer' : 'default', background: selectedProjectIds.includes(p.id) ? '#eef6fc' : 'transparent' }} onClick={() => isAuthorizedToInput && handleToggleProject(p.id)}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" style={{ transform: 'scale(1.2)' }} checked={selectedProjectIds.includes(p.id)} readOnly disabled={!isAuthorizedToInput} />
                        </td>
                        <td style={{ fontWeight: 600 }}><span className="badge badge-gray">{regionAbbr}</span></td>
                        <td style={{ fontWeight: 600 }}>{u ? (u.abbreviation || u.name) : p.unitId}</td>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>
                          {p.boqFiles && p.boqFiles.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              {p.boqFiles.map((f, i) => {
                                const fileName = f.includes('-') ? f.split('-').slice(1).join('-') : f;
                                return (
                                  <a key={i} href={f} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', padding: '0.2rem', background: '#e0f2fe', borderRadius: '4px', textDecoration: 'none', color: '#0369a1' }}>
                                    ✓ {fileName}
                                  </a>
                                );
                              })}
                            </div>
                          ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>-</span>}
                        </td>
                        <td>
                          {p.drawingFiles && p.drawingFiles.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              {p.drawingFiles.map((f, i) => {
                                const fileName = f.includes('-') ? f.split('-').slice(1).join('-') : f;
                                return (
                                  <a key={i} href={f} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', padding: '0.2rem', background: '#e0f2fe', borderRadius: '4px', textDecoration: 'none', color: '#0369a1' }}>
                                    ✓ {fileName}
                                  </a>
                                );
                              })}
                            </div>
                          ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>-</span>}
                        </td>
                        <td>{p.docSubmissionDate || '-'}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {eligibleProjects.length > 0 && isAuthorizedToInput && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-primary" onClick={handleContinue} disabled={selectedProjectIds.length === 0}>
                  Lanjut Input Vendor ({selectedProjectIds.length} Selected)
                </button>
              </div>
            )}
          </div>
        </div>

      {showTenderForm && (
        <form onSubmit={handleSaveBatch}>
          <div className="card mb-6" style={{ borderTop: '4px solid #0055ff' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#0055ff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              Step 2: Batch Tender Input ({selectedProjectIds.length} Projects)
            </h2>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="form-group">
                <label className="form-label">Tender Date TO PSD</label>
                <input type="date" className="form-input" value={tenderDateToPsd} onChange={e => setTenderDateToPsd(e.target.value)} required />
              </div>
            </div>

            {/* Master Vendor Selection Area */}
            <div style={{ background: '#f8fbfd', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #cce0ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--primary)' }}>Invited PTs (from Master Vendor)</h3>
                  <small className="text-muted">Pilih vendor dari Master Data untuk diikutkan dalam tender project ini.</small>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setShowVendorModal(true)}>
                  + Select Invited PTs
                </button>
              </div>

              {invitedPts.length > 0 && (
                <div className="table-container" style={{ marginBottom: 0, marginTop: '1rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PT / CV Name</th>
                        <th>Email Address</th>
                        <th>Contact Person</th>
                        <th>Contact Number</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitedPts.map(pt => (
                        <tr key={pt.id}>
                          <td style={{ fontWeight: 600 }}>{pt.ptName}</td>
                          <td>{pt.email || '-'}</td>
                          <td>{pt.contactName || '-'}</td>
                          <td>{pt.contactPhone || '-'}</td>
                          <td>
                            <button type="button" onClick={() => handleRemovePt(pt.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button type="button" onClick={() => setShowTenderForm(false)} className="btn btn-secondary" style={{ marginRight: '1rem' }}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#0055ff' }}>
                {saving ? 'Processing Batch...' : 'Save Batch Tender Input'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="card mb-6" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, color: '#475569' }}>Project Listing that has Proceed to PSD</h2>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem', minWidth: '150px', maxWidth: '250px' }} value={displayHistRegionId} onChange={e => { setHistRegionId(e.target.value); setHistUnitId(''); }} disabled={isLockedToRegion}>
                <option value="">-- Pilih Region --</option>
                {data.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem', minWidth: '150px', maxWidth: '300px' }} value={displayHistUnitId} onChange={e => setHistUnitId(e.target.value)} disabled={!displayHistRegionId || isLockedToUnit}>
                <option value="">-- Pilih OU / Mill --</option>
                {data.units.filter(u => u.regionId === displayHistRegionId).map(u => <option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
              </select>
              <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem', minWidth: '150px', maxWidth: '200px' }} value={histCategory} onChange={e => setHistCategory(e.target.value)}>
                <option value="">All Categories</option>
                <option value="CAPEX">CAPEX</option>
                <option value="OPEX">OPEX</option>
              </select>
              <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: '4px', padding: '0.2rem' }}>
                <button 
                  onClick={() => setGroupByVendor(false)} 
                  className={`btn ${!groupByVendor ? 'btn-primary' : 'btn-secondary'}`} 
                  style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', border: 'none', background: !groupByVendor ? '#0055ff' : 'transparent', color: !groupByVendor ? 'white' : '#64748b' }}
                >
                  Group by Project
                </button>
                <button 
                  onClick={() => setGroupByVendor(true)} 
                  className={`btn ${groupByVendor ? 'btn-primary' : 'btn-secondary'}`} 
                  style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', border: 'none', background: groupByVendor ? '#0055ff' : 'transparent', color: groupByVendor ? 'white' : '#64748b' }}
                >
                  Group by Vendor
                </button>
              </div>
            </div>
          </div>
          {groupByVendor ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem' }}>
              {allHistVendors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  Tidak ada histori project yang ditemukan untuk filter ini.
                </div>
              ) : (
                allHistVendors.map(vendorName => {
                  const vendorProjects = historicalProjects.filter(p => p.invitedPts?.some(pt => pt.ptName === vendorName));
                if (vendorProjects.length === 0) return null;
                return (
                  <div key={vendorName} className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.5rem', margin: 0 }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>🏢</span> {vendorName}
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.85rem', margin: 0, minWidth: '1000px' }}>
                        <thead style={{ background: '#e2e8f0' }}>
                          <tr>
                            <th style={{ width: '100px' }}>UO</th>
                            <th style={{ width: '250px' }}>List Project</th>
                            <th style={{ width: '200px' }}>BoQ Attachment</th>
                            <th style={{ width: '200px' }}>Drawing Attachment</th>
                            <th style={{ width: '150px' }}>Tender Date to PSD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vendorProjects.map(p => (
                            <tr key={p.id} style={{ background: 'white' }}>
                              <td style={{ verticalAlign: 'top', fontWeight: 600 }}>{(data.units.find(u => String(u.id) === String(p.unitId))?.abbreviation || p.unitId)}</td>
                              <td style={{ verticalAlign: 'top' }}>
                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Histori Tersimpan</div>
                              </td>
                              <td style={{ verticalAlign: 'top' }}>
                                {p.boqFiles && p.boqFiles.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    {p.boqFiles.map((f, i) => {
                                      const fileName = f.includes('-') ? f.split('-').slice(1).join('-') : f;
                                      return <a key={i} href={f} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#0369a1', textDecoration: 'none' }}>✓ {fileName}</a>;
                                    })}
                                  </div>
                                ) : <span className="text-muted">-</span>}
                              </td>
                              <td style={{ verticalAlign: 'top' }}>
                                {p.drawingFiles && p.drawingFiles.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    {p.drawingFiles.map((f, i) => {
                                      const fileName = f.includes('-') ? f.split('-').slice(1).join('-') : f;
                                      return <a key={i} href={f} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#0369a1', textDecoration: 'none' }}>✓ {fileName}</a>;
                                    })}
                                  </div>
                                ) : <span className="text-muted">-</span>}
                              </td>
                              <td style={{ verticalAlign: 'top', fontWeight: 500, color: '#16a34a' }}>{p.tenderDateToPsd}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
              )}
            </div>
          ) : (
            <div style={{ overflowY: 'auto', overflowX: 'auto', margin: '0 -1.5rem', padding: '0 1.5rem' }}>
              <div style={{ minWidth: '1300px', paddingBottom: '1.5rem' }}>
              <table className="data-table" style={{ fontSize: '0.85rem', margin: 0 }}>
                <thead style={{ background: '#f1f5f9' }}>
                  <tr>
                    <th style={{ width: '100px' }}>Region</th>
                    <th style={{ width: '100px' }}>UO</th>
                    <th style={{ width: '200px' }}>List Project</th>
                    <th style={{ width: '150px' }}>BoQ Attachment</th>
                    <th style={{ width: '150px' }}>Drawing Attachment</th>
                    <th style={{ width: '150px' }}>Tender Date to PSD</th>
                    <th>Invited Vendors</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        Tidak ada histori project yang ditemukan untuk filter ini.
                      </td>
                    </tr>
                  ) : (
                    historicalProjects.map(p => {
                      const u = data.units.find(x => String(x.id) === String(p.unitId));
                      const region = data.regions.find(r => r.id === u?.regionId);
                      const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                      return (
                        <tr key={p.id} style={{ background: '#f8fafc' }}>
                          <td style={{ verticalAlign: 'top', fontWeight: 600 }}><span className="badge badge-gray">{regionAbbr}</span></td>
                          <td style={{ verticalAlign: 'top', fontWeight: 600 }}>{u ? (u.abbreviation || u.name) : p.unitId}</td>
                          <td style={{ verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Histori Tersimpan</div>
                          </td>
                          
                          <td style={{ verticalAlign: 'top' }}>
                            {p.boqFiles && p.boqFiles.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                {p.boqFiles.map((f, i) => {
                                  const fileName = f.includes('-') ? f.split('-').slice(1).join('-') : f;
                                  return <a key={i} href={f} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#0369a1', textDecoration: 'none' }}>✓ {fileName}</a>;
                                })}
                              </div>
                            ) : <span className="text-muted">-</span>}
                          </td>
                          
                          <td style={{ verticalAlign: 'top' }}>
                            {p.drawingFiles && p.drawingFiles.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                {p.drawingFiles.map((f, i) => {
                                  const fileName = f.includes('-') ? f.split('-').slice(1).join('-') : f;
                                  return <a key={i} href={f} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#0369a1', textDecoration: 'none' }}>✓ {fileName}</a>;
                                })}
                              </div>
                            ) : <span className="text-muted">-</span>}
                          </td>

                          <td style={{ verticalAlign: 'top', fontWeight: 500, color: '#16a34a' }}>{p.tenderDateToPsd}</td>

                          <td style={{ verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                              {(p.invitedPts || []).length === 0 ? '-' : (p.invitedPts || []).map(pt => (
                                <div key={pt.id} style={{ flex: '0 0 auto', minWidth: '180px', background: '#fff', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '4px' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--primary)' }}>{pt.ptName}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>👤 {pt.contactName || '-'}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>📞 {pt.contactPhone || '-'}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>

      {/* --- VENDOR SELECTION MODAL --- */}
      {showVendorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '800px', maxWidth: '95vw', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Pilih Vendor dari Master Data</h3>
              <button className="btn btn-secondary" onClick={() => setShowVendorModal(false)} style={{ padding: '0.4rem 0.8rem' }}>Tutup</button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '60vh' }}>
              {(!data?.vendors || data.vendors.length === 0) ? (
                <p className="text-muted">Belum ada data vendor. Silakan tambahkan vendor di menu Master Data terlebih dahulu.</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '5%', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            style={{ transform: 'scale(1.2)' }}
                            checked={selectedVendorIds.length === data.vendors.length}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedVendorIds(data.vendors.map(v => v.id));
                              else setSelectedVendorIds([]);
                            }}
                          />
                        </th>
                        <th style={{ width: '30%' }}>Vendor Name</th>
                        <th style={{ width: '65%' }}>Primary Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.vendors.map(v => {
                        const contact = v.contacts && v.contacts.length > 0 ? v.contacts[0] : null;
                        return (
                          <tr key={v.id} style={{ cursor: 'pointer', background: selectedVendorIds.includes(v.id) ? '#eef6fc' : 'transparent' }} onClick={() => handleToggleVendor(v.id)}>
                            <td style={{ textAlign: 'center' }}>
                              <input type="checkbox" style={{ transform: 'scale(1.2)' }} checked={selectedVendorIds.includes(v.id)} readOnly />
                            </td>
                            <td style={{ fontWeight: 600 }}>{v.name}</td>
                            <td>
                              {contact ? (
                                <div style={{ fontSize: '0.85rem' }}>
                                  <span style={{ marginRight: '1rem' }}>📧 {contact.email || '-'}</span>
                                  <span style={{ marginRight: '1rem' }}>👤 {contact.personName || '-'}</span>
                                  <span>📞 {contact.contactNumber || '-'}</span>
                                </div>
                              ) : <span className="text-muted">-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted"><strong>{selectedVendorIds.length}</strong> vendor terpilih</span>
              <button type="button" className="btn btn-primary" onClick={handleConfirmVendors} disabled={selectedVendorIds.length === 0}>
                Konfirmasi Pilihan Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
