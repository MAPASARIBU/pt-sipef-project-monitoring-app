'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, Project } from '@/lib/db';

type StagedProject = {
  boqFiles: File[];
  drawingFiles: File[];
  docComplete: 'Yes' | 'No' | '';
  checked: boolean;
};

export default function TenderDocumentSubmission() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Selection state
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterWorkType, setFilterWorkType] = useState('');

  // Staged data for projects
  const [stagedData, setStagedData] = useState<Record<string, StagedProject>>({});
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [loginUnitId, setLoginUnitId] = useState<string | null>(null);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    const cAuth = getCookie('auth');
    const cLuid = getCookie('loginUnitId');
    setAuthUser(cAuth || null);
    setLoginUnitId(cLuid || null);

    fetch('/api/db')
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);

        const isAdmin = cAuth === 'admin';
        const loggedInUser = d.users.find((u: any) => u.name === cAuth);
        const userRole = loggedInUser ? d.roles.find((r: any) => r.id === loggedInUser.roleId) : null;
        const roleName = userRole?.name.toLowerCase() || '';

        const hasGlobalView = isAdmin || 
          roleName.includes('director engineering') || 
          roleName.includes('head of operation') || 
          roleName.includes('engineering ho') || 
          roleName.includes('purchasing');

        const hasRegionalView = roleName.includes('regional director') || 
          roleName.includes('regional control') || 
          roleName.includes('rmo');

        const activeUnitId = loggedInUser?.unitId || (cLuid !== 'HO' ? cLuid : null);
        const activeUnit = d.units.find((u: any) => u.id === activeUnitId);
        const isRmo = roleName.includes('rmo');

        if ((activeUnit && !hasGlobalView && !hasRegionalView) || (isRmo && activeUnit)) {
          setSelectedRegionId(activeUnit.regionId);
          if (!isRmo) {
            setSelectedUnitId(activeUnit.id);
          }
        }
      });
  }, []);




  const handleFileChange = (projectId: string, type: 'boq' | 'drawing', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4); // Max 4
    setStagedData(prev => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || { boqFiles: [], drawingFiles: [], docComplete: '', checked: false }),
        [type === 'boq' ? 'boqFiles' : 'drawingFiles']: files
      }
    }));
  };

  const handleDocCompleteChange = (projectId: string, val: string) => {
    setStagedData(prev => {
      const current = prev[projectId] || { boqFiles: [], drawingFiles: [], docComplete: '', checked: false };
      // If setting to No, automatically uncheck
      const newChecked = val !== 'Yes' ? false : current.checked;
      return { ...prev, [projectId]: { ...current, docComplete: val as any, checked: newChecked } };
    });
  };

  const handleCheckChange = (projectId: string, checked: boolean) => {
    const current = stagedData[projectId] || { boqFiles: [], drawingFiles: [], docComplete: '', checked: false };
    
    if (checked) {
      if (current.docComplete !== 'Yes') {
        alert('Mohon pilih "Yes" pada kolom Document Complete sebelum mencentang!');
        return;
      }
      if (current.boqFiles.length === 0 && current.drawingFiles.length === 0) {
        alert('Mohon lampirkan minimal satu file BoQ atau Drawing sebelum mencentang!');
        return;
      }
    }

    setStagedData(prev => ({
      ...prev,
      [projectId]: { ...current, checked }
    }));
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return [];
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.urls as string[];
  };

  const handleSave = async () => {
    if (!data) return;

    // Find all checked projects
    const checkedProjectIds = Object.keys(stagedData).filter(id => stagedData[id].checked);
    if (checkedProjectIds.length === 0) {
      alert('Tidak ada project yang dipilih (dicentang) untuk di-submit.');
      return;
    }

    setSaving(true);
    
    try {
      // Upload files for each selected project
      const uploadedStagedData: Record<string, { boqUrls: string[], drawingUrls: string[] }> = {};
      
      for (const id of checkedProjectIds) {
        const stage = stagedData[id];
        const boqUrls = await uploadFiles(stage.boqFiles);
        const drawingUrls = await uploadFiles(stage.drawingFiles);
        uploadedStagedData[id] = { boqUrls, drawingUrls };
      }
      
      // Update data state
      const updatedProjects = data.projects.map(p => {
        if (checkedProjectIds.includes(p.id)) {
          const { boqUrls, drawingUrls } = uploadedStagedData[p.id];
          return {
            ...p,
            boqFiles: boqUrls,
            drawingFiles: drawingUrls,
            docComplete: true,
            continueProcess: true,
            docSubmissionDate: new Date().toISOString().split('T')[0] // Use today's date
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
      
      // Clear staged data for submitted ones
      const newStaged = { ...stagedData };
      checkedProjectIds.forEach(id => delete newStaged[id]);
      setStagedData(newStaged);
      
      alert('Document Submission Berhasil! Project yang dicentang otomatis pindah ke tahap 2B. TENDER Batch (HO Eng).');
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mengupload file. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) return <div className="p-4">Loading Tender Submission Form...</div>;

  const isAdmin = authUser === 'admin';
  const loggedInUser = data.users.find(u => u.name === authUser);
  const userRole = loggedInUser ? data.roles.find(r => r.id === loggedInUser.roleId) : null;
  const roleName = userRole?.name.toLowerCase() || '';
  const isEngineeringHO = roleName.includes('engineering ho');
  const hasGlobalView = isAdmin || roleName.includes('director engineering') || roleName.includes('head of operation') || roleName.includes('engineering ho') || roleName.includes('purchasing');
  const hasRegionalView = roleName.includes('regional director') || roleName.includes('regional control') || roleName.includes('rmo');
  const isAuthorizedToInput = isAdmin || roleName.includes('rmo') || (!hasRegionalView && !roleName.includes('engineering ho') && !roleName.includes('purchasing') && !roleName.includes('director engineering'));
  const activeUnitId = loggedInUser?.unitId || (loginUnitId !== 'HO' ? loginUnitId : null);
  const activeUnit = data.units.find(u => u.id === activeUnitId);
  const isRmo = roleName.includes('rmo');
  
  const isLockedToRegion = !!(activeUnit && !hasGlobalView) || isRmo || hasRegionalView;
  const isLockedToUnit = !!(activeUnit && !isRmo && !hasGlobalView && !hasRegionalView);
  
  const displaySelectedRegionId = selectedRegionId || (isLockedToRegion ? (loggedInUser?.regionId || activeUnit?.regionId || '') : '');
  const displaySelectedUnitId = selectedUnitId || (isLockedToUnit ? activeUnitId || '' : '');

  const getVisibleProjects = (p: any) => {
    if (displaySelectedUnitId && p.unitId !== displaySelectedUnitId) return false;
    if (displaySelectedRegionId && !displaySelectedUnitId) {
      const u = data.units.find((x: any) => x.id === p.unitId);
      if (u?.regionId !== displaySelectedRegionId) return false;
    }
    return true;
  };

  const completedProjects = data.projects.filter(p => {
    if (!(p.docComplete && p.continueProcess)) return false;
    return getVisibleProjects(p);
  }) || [];

  const eligibleProjects = data.projects.filter(p => {
    if (p.docComplete && p.continueProcess) return false;
    return getVisibleProjects(p);
  }) || [];

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

  const filteredEligibleProjects = sortProjects(eligibleProjects.filter(p => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterWorkType && p.type !== filterWorkType) return false;
    return true;
  }));

  const filteredCompletedProjects = sortProjects(completedProjects.filter(p => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterWorkType && p.type !== filterWorkType) return false;
    return true;
  }));

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">2A. Tender Document Submission (Ops)</h1>
      </div>

      <div className="card mb-6" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-4 gap-4">
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>Pilih Region</label>
            <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={displaySelectedRegionId} onChange={e => {
              setSelectedRegionId(e.target.value);
              setSelectedUnitId('');
              setStagedData({});
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
              setStagedData({});
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
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>Work Type</label>
            <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={filterWorkType} onChange={e => setFilterWorkType(e.target.value)}>
              <option value="">All Work Types</option>
              <option value="MECHANICAL">MECHANICAL</option>
              <option value="CIVIL">CIVIL</option>
              <option value="ELECTRICAL">ELECTRICAL</option>
              <option value="HEAVY EQUIPMENT">HEAVY EQ.</option>
              <option value="SERVICE CONTRACT">SERVICE CONTRACT</option>
            </select>
          </div>
        </div>
        {(filterCategory || filterWorkType) && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => {setFilterCategory(''); setFilterWorkType('');}} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Clear Filters</button>
          </div>
        )}
      </div>

      <div className="card mb-6" style={{ borderTop: '4px solid var(--primary)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#1e293b', margin: 0 }}>Daftar Project Document Belum Complete</h2>
          {isAuthorizedToInput && (
            <button 
              className="btn btn-primary" 
              onClick={handleSave} 
              disabled={saving || !Object.values(stagedData).some(s => s.checked)}
            >
              {saving ? 'Menyimpan...' : 'Save Document Submission'}
            </button>
          )}
        </div>

        {filteredEligibleProjects.length === 0 ? (
          <p className="text-muted">Tidak ada project yang butuh submission dokumen di OU ini.</p>
        ) : (
          <table className="data-table" style={{ fontSize: '0.75rem' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ width: '5%' }}>Region</th>
                <th style={{ width: '8%' }}>OU / Mill</th>
                <th style={{ width: '5%' }}>CTGRY</th>
                <th style={{ width: '10%' }}>STASIUN</th>
                <th style={{ width: '22%' }}>PROJECT NAME</th>
                <th style={{ width: '20%' }}>BoQ Attachment<br/><small className="text-muted" style={{textTransform:'none'}}>(Excel/PDF, Max 4)</small></th>
                <th style={{ width: '20%' }}>Drawing Attachment<br/><small className="text-muted" style={{textTransform:'none'}}>(PDF, Max 4)</small></th>
                <th style={{ width: '10%' }}>Document Complete</th>
                <th style={{ width: '5%', textAlign: 'center' }}>Submit</th>
              </tr>
            </thead>
            <tbody>
              {filteredEligibleProjects.map(p => {
                const stage = stagedData[p.id] || { boqFiles: [], drawingFiles: [], docComplete: '', checked: false };
                const unit = data.units.find(u => String(u.id) === String(p.unitId));
                const region = data.regions.find(r => unit && r.id === unit.regionId);
                const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                
                return (
                  <tr key={p.id} className={stage.checked ? 'row-selected' : ''} style={{ background: stage.checked ? '#f0fdf4' : 'transparent' }}>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}><span className="badge badge-gray">{regionAbbr}</span></td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 600 }}>{unit ? (unit.abbreviation || unit.name) : '-'}</td>
                    <td><span style={{ fontWeight: 600, fontSize: '0.75rem', color: p.category === 'CAPEX' ? '#0369a1' : '#b45309' }}>{p.category === 'CAPEX' ? 'CPX' : p.category === 'OPEX' ? 'OPX' : p.category}</span></td>
                    <td>{p.station || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    
                    <td>
                      {isAuthorizedToInput ? (
                        <input type="file" multiple accept=".xls,.xlsx,.pdf" onChange={e => handleFileChange(p.id, 'boq', e)} style={{ width: '150px' }} />
                      ) : (
                        <span className="text-muted">View Only</span>
                      )}
                      {stage.boqFiles.length > 0 && <div className="text-success mt-1" style={{ fontSize: '0.7rem' }}>{stage.boqFiles.length} file(s) selected</div>}
                    </td>
                    
                    <td>
                      {isAuthorizedToInput ? (
                        <input type="file" multiple accept=".pdf" onChange={e => handleFileChange(p.id, 'drawing', e)} style={{ width: '150px' }} />
                      ) : (
                        <span className="text-muted">View Only</span>
                      )}
                      {stage.drawingFiles.length > 0 && <div className="text-success mt-1" style={{ fontSize: '0.7rem' }}>{stage.drawingFiles.length} file(s) selected</div>}
                    </td>

                    <td>
                      {isAuthorizedToInput ? (
                        <select className="form-select" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', width: '90px' }} value={stage.docComplete} onChange={e => handleDocCompleteChange(p.id, e.target.value)}>
                          <option value="">- Pilih -</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                        checked={stage.checked}
                        onChange={(e) => handleCheckChange(p.id, e.target.checked)}
                        disabled={stage.docComplete !== 'Yes' || !isAuthorizedToInput}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filteredCompletedProjects.length > 0 && (
        <div className="card mb-6" style={{ borderTop: '4px solid var(--success)', overflowX: 'auto' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#1e293b', margin: 0 }}>Daftar Project COMPLETE</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Project di bawah ini sudah disubmit beserta kelengkapan dokumen dan diteruskan ke tahap 2B.</p>
          </div>
          
          <table className="data-table" style={{ fontSize: '0.75rem' }}>
            <thead style={{ background: '#f0fdf4' }}>
              <tr>
                <th style={{ width: '5%', textAlign: 'center' }}>Region</th>
                <th style={{ width: '10%', textAlign: 'center' }}>UO / MILL</th>
                <th style={{ width: '5%' }}>CTGRY</th>
                <th style={{ width: '25%' }}>PROJECT NAME</th>
                <th style={{ width: '5%', textAlign: 'right' }}>QTY</th>
                <th style={{ width: '15%', textAlign: 'right' }}>HARGA/QTY</th>
                <th style={{ width: '15%', textAlign: 'right' }}>TOTAL BUDGET</th>
                <th style={{ width: '10%', textAlign: 'center' }}>BoQ</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Drawing</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompletedProjects.map(p => {
                const u = data.units.find(x => x.id === p.unitId);
                const region = data.regions.find(r => u && r.id === u.regionId);
                const regionAbbr = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                
                return (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-gray">{regionAbbr}</span></td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{u ? (u.abbreviation || u.name) : p.unitId}</td>
                    <td><span style={{ fontWeight: 600, fontSize: '0.75rem', color: p.category === 'CAPEX' ? '#0369a1' : '#b45309' }}>{p.category === 'CAPEX' ? 'CPX' : p.category === 'OPEX' ? 'OPX' : p.category}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ textAlign: 'right' }}>{p.planQty}</td>
                    <td style={{ textAlign: 'right' }}>{(p.planPricePerQty || 0).toLocaleString('id-ID')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{((p.planQty || 0) * (p.planPricePerQty || 0)).toLocaleString('id-ID')}</td>
                    <td style={{ textAlign: 'center', color: '#16a34a', fontSize: '1.2rem', fontWeight: 'bold' }}>{(p.boqFiles && p.boqFiles.length > 0) ? '✓' : '-'}</td>
                    <td style={{ textAlign: 'center', color: '#16a34a', fontSize: '1.2rem', fontWeight: 'bold' }}>{(p.drawingFiles && p.drawingFiles.length > 0) ? '✓' : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
