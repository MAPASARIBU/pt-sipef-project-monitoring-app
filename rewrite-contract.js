const fs = require('fs');
const content = `
'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, Project } from '@/lib/db';

export default function ContractRealization() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [plannedDuration, setPlannedDuration] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectValues, setProjectValues] = useState<Record<string, { actualQty: number, actualCostPerUnit: number }>>({});

  const [authUser, setAuthUser] = useState<string | null>(null);
  const [loginUnitId, setLoginUnitId] = useState<string | null>(null);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = \`; \${document.cookie}\`;
      const parts = value.split(\`; \${name}=\`);
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

  const isAdmin = authUser === 'admin';
  const loggedInUser = data?.users.find(u => u.name === authUser);
  const userRole = loggedInUser ? data?.roles.find(r => r.id === loggedInUser.roleId) : null;
  const roleName = userRole?.name.toLowerCase() || '';

  const isEngineeringHO = roleName.includes('engineering ho');
  const isDirector = roleName.includes('director engineering');
  const isAuthorizedToInput = isAdmin || isEngineeringHO || isDirector || roleName.includes('rmo');

  const isRmo = roleName.includes('rmo');
  const hasGlobalView = isAdmin || isEngineeringHO || isDirector || roleName.includes('head of operation') || roleName.includes('purchasing');
  const hasRegionalView = roleName.includes('regional director') || roleName.includes('regional control') || roleName.includes('rmo');

  const activeUnitId = loggedInUser?.unitId || (loginUnitId !== 'HO' ? loginUnitId : null);
  const activeUnit = data?.units.find(u => u.id === activeUnitId);

  useEffect(() => {
    if (data && authUser) {
      if ((activeUnit && !hasGlobalView && !hasRegionalView) || (isRmo && activeUnit)) {
        setSelectedRegionId(activeUnit.regionId);
        if (!isRmo) {
          setSelectedUnitId(activeUnit.id);
        }
      }
    }
  }, [data, authUser, loginUnitId]);

  const isLockedToRegion = !!(activeUnit && !hasGlobalView) || isRmo || hasRegionalView;
  const isLockedToUnit = !!(activeUnit && !isRmo && !hasGlobalView && !hasRegionalView);

  const displaySelectedRegionId = selectedRegionId || (isLockedToRegion ? (loggedInUser?.regionId || activeUnit?.regionId || '') : '');
  const displaySelectedUnitId = selectedUnitId || (isLockedToUnit ? activeUnitId || '' : '');

  const getUnitName = (unitId: string) => {
    if (!data) return '';
    const u = data.units.find(x => x.id === unitId);
    return u ? u.name : unitId;
  };

  const getVisibleProjects = (p: any) => {
    if (displaySelectedUnitId && String(p.unitId) !== String(displaySelectedUnitId)) return false;
    if (displaySelectedRegionId && !displaySelectedUnitId) {
      const u = data?.units.find((x: any) => String(x.id) === String(p.unitId));
      if (u?.regionId !== displaySelectedRegionId) return false;
    }
    return true;
  };

  // Only show pending projects that have a Tender Winner and no contract yet
  const pendingProjects = data?.projects.filter(p => p.tenderResultWinner && !p.contractNumber && getVisibleProjects(p)) || [];
  
  // Extract unique vendors from pending projects
  const vendorsSet = new Set<string>();
  pendingProjects.forEach(p => vendorsSet.add(p.tenderResultWinner!));
  const vendors = Array.from(vendorsSet);

  const vendorProjects = pendingProjects.filter(p => p.tenderResultWinner === selectedVendor);

  // Initialize values when vendor changes
  useEffect(() => {
    if (selectedVendor && data) {
      const initialValues: Record<string, { actualQty: number, actualCostPerUnit: number }> = {};
      vendorProjects.forEach(p => {
        initialValues[p.id] = {
          actualQty: p.actualQty || 1,
          actualCostPerUnit: p.actualCostPerUnit || p.finalTenderPrice || 0,
        };
      });
      setProjectValues(initialValues);
      setSelectedProjectIds(vendorProjects.map(p => p.id));
    } else {
      setSelectedProjectIds([]);
      setProjectValues({});
    }
  }, [selectedVendor]);

  const toggleProjectSelection = (id: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleUpdateValue = (id: string, field: 'actualQty' | 'actualCostPerUnit', value: number) => {
    setProjectValues(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !contractNumber || selectedProjectIds.length === 0 || !plannedDuration) {
      alert("Harap isi semua field dan pilih minimal 1 proyek.");
      return;
    }

    setSaving(true);

    const payload = selectedProjectIds.map(id => ({
      id,
      contractNumber,
      plannedDuration,
      actualQty: projectValues[id].actualQty,
      actualCostPerUnit: projectValues[id].actualCostPerUnit
    }));

    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'batchUpdateContract', updates: payload })
    });

    const newData = await fetch('/api/db').then(r => r.json());
    setData(newData);
    
    setSelectedVendor('');
    setContractNumber('');
    setPlannedDuration('');
    setSaving(false);
    alert('Contract Realization berhasil disimpan untuk proyek terpilih!');
  };

  if (loading || !data) return <div className="p-4">Loading Contract Realization...</div>;

  let grandTotal = 0;
  selectedProjectIds.forEach(id => {
    if (projectValues[id]) {
      grandTotal += projectValues[id].actualQty * projectValues[id].actualCostPerUnit;
    }
  });

  // History Kontrak
  let contractedProjects = data.projects.filter(p => p.contractNumber && getVisibleProjects(p));

  // Group history by contract number
  const historyByContract: Record<string, typeof contractedProjects> = {};
  contractedProjects.forEach(p => {
    if (!historyByContract[p.contractNumber!]) historyByContract[p.contractNumber!] = [];
    historyByContract[p.contractNumber!].push(p);
  });

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">3. Contract Realization</h1>
      </div>

      <div className="filter-card mb-6 p-4" style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>Pilih Region</label>
            <select className="form-select" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={displaySelectedRegionId} onChange={e => {
              setSelectedRegionId(e.target.value);
              setSelectedUnitId('');
              setSelectedVendor('');
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
              setSelectedVendor('');
            }} disabled={isLockedToUnit || !displaySelectedRegionId}>
              <option value="">-- Pilih OU / Mill --</option>
              {data.units.filter(u => u.regionId === displaySelectedRegionId).map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isAuthorizedToInput && (
        <form className="card mb-6" onSubmit={handleSave} style={{ borderTop: '4px solid #0369a1' }}>
          <h2 style={{ marginBottom: '1.5rem', color: '#0369a1' }}>Input Contract Realization</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group mb-0">
              <label className="form-label">Pilih Vendor (Tender Winner)</label>
              <select className="form-select" value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)} required>
                <option value="">-- Pilih Vendor --</option>
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              {vendors.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>Tidak ada proyek yang menunggu kontrak di OU/Region ini.</p>
              )}
            </div>
            
            {selectedVendor && (
              <div className="form-group mb-0" style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Nomor Kontrak Payung / SPK</label>
                  <input type="text" className="form-input" value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="Contoh: HO-BK-BTOM-2026-0009" required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Planned Duration (Weeks)</label>
                  <input type="text" className="form-input" value={plannedDuration} onChange={e => setPlannedDuration(e.target.value)} placeholder="Contoh: 12 Weeks" required />
                </div>
              </div>
            )}
          </div>

          {selectedVendor && vendorProjects.length > 0 && (
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Detail Proyek untuk {selectedVendor}</h3>
              
              <div style={{ overflowX: 'auto', marginBottom: '1.5rem', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <table className="data-table">
                  <thead style={{ background: '#eff6ff' }}>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedProjectIds.length === vendorProjects.length && vendorProjects.length > 0} 
                          onChange={e => setSelectedProjectIds(e.target.checked ? vendorProjects.map(p => p.id) : [])} 
                        />
                      </th>
                      <th>Nama Proyek</th>
                      <th>Unit Operasional (UO)</th>
                      <th>Harga Final Tender</th>
                      <th style={{ width: '120px' }}>Actual Qty</th>
                      <th style={{ width: '200px' }}>Cost / Unit (Rp)</th>
                      <th style={{ width: '200px', textAlign: 'right' }}>Total Cost (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorProjects.map(p => {
                      const isChecked = selectedProjectIds.includes(p.id);
                      const vals = projectValues[p.id] || { actualQty: 1, actualCostPerUnit: 0 };
                      const rowTotal = vals.actualQty * vals.actualCostPerUnit;
                      
                      return (
                        <tr key={p.id} style={{ opacity: isChecked ? 1 : 0.5, background: isChecked ? '#fff' : '#f8fafc' }}>
                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <input type="checkbox" checked={isChecked} onChange={() => toggleProjectSelection(p.id)} />
                          </td>
                          <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ verticalAlign: 'middle' }}>{getUnitName(p.unitId)}</td>
                          <td style={{ verticalAlign: 'middle', color: '#64748b' }}>
                            Rp {p.finalTenderPrice?.toLocaleString('id-ID')}
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <input 
                              type="number" 
                              className="form-input" 
                              value={vals.actualQty || ''} 
                              onChange={e => handleUpdateValue(p.id, 'actualQty', Number(e.target.value))} 
                              disabled={!isChecked} 
                              style={{ padding: '0.4rem', textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={vals.actualCostPerUnit ? vals.actualCostPerUnit.toLocaleString('id-ID') : ''} 
                              onChange={e => handleUpdateValue(p.id, 'actualCostPerUnit', Number(e.target.value.replace(/\\D/g, '')))} 
                              disabled={!isChecked} 
                              style={{ padding: '0.4rem', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ verticalAlign: 'middle', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                            {rowTotal.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#e0f2fe', borderTop: '2px solid #bae6fd' }}>
                      <td colSpan={6} style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', padding: '1rem' }}>Grand Total Nilai Kontrak:</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: '#0369a1', padding: '1rem' }}>
                        Rp {grandTotal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving || selectedProjectIds.length === 0} style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>
                  {saving ? 'Menyimpan...' : 'Simpan Kontrak untuk Proyek Terpilih'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* --- HISTORY CONTRACTS --- */}
      {(!hasGlobalView || isAdmin || Object.keys(historyByContract).length > 0) && (
        <div className="card" style={{ borderTop: '4px solid #64748b' }}>
          <h2 style={{ marginBottom: '1.5rem', color: '#475569' }}>Histori Realisasi Kontrak</h2>
          <p className="text-muted mb-4">Daftar kontrak payung yang sudah diterbitkan beserta proyek di dalamnya.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.keys(historyByContract).length === 0 ? (
              <p className="text-muted">Tidak ada histori kontrak untuk Region / OU ini.</p>
            ) : (
              Object.entries(historyByContract)
                .sort((a, b) => {
                  const maxIdA = Math.max(...a[1].map(p => Number(p.id) || 0));
                  const maxIdB = Math.max(...b[1].map(p => Number(p.id) || 0));
                  return maxIdB - maxIdA;
                })
                .map(([contractNum, projs]) => {
                const vendor = projs[0].tenderResultWinner;
                const totalContractVal = projs.reduce((sum, p) => sum + ((p.actualQty || 0) * (p.actualCostPerUnit || 0)), 0);
                
                return (
                  <div key={contractNum} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0f172a' }}>Kontrak No: {contractNum}</div>
                        <div style={{ color: '#475569', fontWeight: 600 }}>Vendor: {vendor}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Total Nilai Kontrak</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0369a1' }}>Rp {totalContractVal.toLocaleString('id-ID')}</div>
                      </div>
                    </div>
                    
                    <table className="data-table" style={{ fontSize: '0.85rem', margin: 0 }}>
                      <thead style={{ background: '#f1f5f9' }}>
                        <tr>
                          <th>Proyek</th>
                          <th>UO</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Cost / Unit</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projs.map(p => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td>{getUnitName(p.unitId)}</td>
                            <td style={{ textAlign: 'right' }}>{p.actualQty}</td>
                            <td style={{ textAlign: 'right' }}>Rp {p.actualCostPerUnit?.toLocaleString('id-ID')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>Rp {((p.actualQty || 0) * (p.actualCostPerUnit || 0)).toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
`;
fs.writeFileSync('src/app/contract/page.tsx', content);
console.log('Contract Page Overwritten successfully.');
