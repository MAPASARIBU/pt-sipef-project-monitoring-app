'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, Region, Unit } from '@/lib/db';

export default function MasterData() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(false);

  // Unit selection
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // Modal State
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [addUnitTab, setAddUnitTab] = useState<'type1' | 'type2'>('type1');

  // Type I state
  const [unitName, setUnitName] = useState('');
  const [unitAbbreviation, setUnitAbbreviation] = useState('');
  const [unitType, setUnitType] = useState<'Estate' | 'Mill' | 'RMO' | 'Lainnya'>('Estate');
  
  // Edit and Hover States
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitAbbreviation, setEditUnitAbbreviation] = useState('');
  const [editUnitType, setEditUnitType] = useState<'Estate' | 'Mill' | 'RMO' | 'Lainnya'>('Estate');

  // Type II state
  const [bulkData, setBulkData] = useState('');
  const [bulkError, setBulkError] = useState('');

  // Vendor Modal State
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [addVendorTab, setAddVendorTab] = useState<'type1' | 'type2'>('type1');

  // Vendor Type 1 State (Manual Input)
  const [vendorName, setVendorName] = useState('');
  const [vendorContacts, setVendorContacts] = useState([{ email: '', personName: '', contactNumber: '' }]);

  // Vendor Type 2 State (Excel Paste)
  const [vendorBulkData, setVendorBulkData] = useState('');
  const [vendorBulkError, setVendorBulkError] = useState('');

  const [authUser, setAuthUser] = useState<string | null>(null);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    setAuthUser(getCookie('auth') || null);
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await fetch('/api/db');
    const db = await res.json();
    setData(db);
  };

  const saveData = async (newData: DatabaseSchema) => {
    setLoading(true);
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });
    setData(newData);
    setLoading(false);
  };

  const handleAddUnitType1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !unitName || !selectedRegionId) return;
    const newUnit: Unit = {
      id: Date.now().toString(),
      regionId: selectedRegionId,
      name: unitName,
      abbreviation: unitAbbreviation,
      type: unitType
    };
    await saveData({ ...data, units: [...data.units, newUnit] });
    setUnitName('');
    setUnitAbbreviation('');
    setShowAddUnitModal(false);
  };

  const handleAddUnitType2 = async () => {
    setBulkError('');
    if (!bulkData.trim() || !data || !selectedRegionId) return;

    const rows = bulkData.split('\n').filter(row => row.trim() !== '');
    const newUnits: Unit[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].split('\t').map(c => c.trim());
      if (cols.length < 3) continue;
      
      const [name, abbr, typeCode] = cols;
      let mappedType: 'Estate' | 'Mill' | 'RMO' | 'Lainnya';
      if (typeCode === '1') mappedType = 'RMO';
      else if (typeCode === '2') mappedType = 'Estate';
      else if (typeCode === '3') mappedType = 'Mill';
      else {
        setBulkError(`Baris ${i + 1} Error: Kode Unit Type '${typeCode}' tidak valid. Harus angka 1, 2, atau 3!`);
        return;
      }
      
      newUnits.push({
        id: Date.now().toString() + i.toString(),
        regionId: selectedRegionId,
        name: name,
        abbreviation: abbr,
        type: mappedType
      });
    }

    if (newUnits.length > 0) {
      await saveData({ ...data, units: [...data.units, ...newUnits] });
      setBulkData('');
      setShowAddUnitModal(false);
    }
  };

  const handleSaveEditUnit = async (unitId: string) => {
    if (!data || !editUnitName) return;
    const updatedUnits = data.units.map(u => 
      u.id === unitId 
        ? { ...u, name: editUnitName, abbreviation: editUnitAbbreviation, type: editUnitType } 
        : u
    );
    await saveData({ ...data, units: updatedUnits });
    setEditUnitId(null);
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!data) return;
    if (confirm('Yakin ingin menghapus unit ini?')) {
      const updatedUnits = data.units.filter(u => u.id !== unitId);
      await saveData({ ...data, units: updatedUnits });
    }
  };

  // --- VENDOR HANDLERS ---
  const handleAddVendorContactRow = () => {
    if (vendorContacts.length >= 3) return;
    setVendorContacts([...vendorContacts, { email: '', personName: '', contactNumber: '' }]);
  };

  const handleUpdateVendorContactRow = (index: number, field: string, value: string) => {
    const newContacts = [...vendorContacts];
    newContacts[index] = { ...newContacts[index], [field]: value } as any;
    setVendorContacts(newContacts);
  };

  const handleRemoveVendorContactRow = (index: number) => {
    if (vendorContacts.length <= 1) return;
    setVendorContacts(vendorContacts.filter((_, i) => i !== index));
  };

  const handleAddVendorType1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !vendorName.trim() || vendorContacts.length === 0) return;
    
    const validContacts = vendorContacts.filter(c => c.email || c.personName || c.contactNumber);
    if (validContacts.length === 0) {
      alert('Minimal isi 1 kontak!');
      return;
    }

    const newVendor = {
      id: `v-${Date.now()}`,
      name: vendorName,
      contacts: validContacts
    };

    await saveData({ ...data, vendors: [...(data.vendors || []), newVendor] });
    setVendorName('');
    setVendorContacts([{ email: '', personName: '', contactNumber: '' }]);
    setShowAddVendorModal(false);
  };

  const handleAddVendorType2 = async () => {
    setVendorBulkError('');
    if (!vendorBulkData.trim() || !data) return;

    const rows = vendorBulkData.split('\n').filter(row => row.trim() !== '');
    const newVendors: any[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].split('\t').map(c => c.trim());
      if (cols.length < 4) {
        setVendorBulkError(`Baris ${i + 1} Error: Data tidak lengkap. Butuh 4 kolom (Vendor Name, Email, Person Name, Contact Number)`);
        return;
      }
      
      const [name, email, personName, contactNumber] = cols;
      
      newVendors.push({
        id: `v-${Date.now()}-${i}`,
        name: name,
        contacts: [{ email, personName, contactNumber }]
      });
    }

    if (newVendors.length > 0) {
      await saveData({ ...data, vendors: [...(data.vendors || []), ...newVendors] });
      setVendorBulkData('');
      setShowAddVendorModal(false);
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!data) return;
    if (confirm('Yakin ingin menghapus vendor ini?')) {
      const updatedVendors = data.vendors.filter(v => v.id !== vendorId);
      await saveData({ ...data, vendors: updatedVendors });
    }
  };

  if (!data) return <div className="p-4">Loading Master Data...</div>;

  const isAdmin = authUser === 'admin';
  const loggedInUser = data.users.find(u => u.name === authUser);
  const userRole = loggedInUser ? data.roles.find(r => r.id === loggedInUser.roleId) : null;
  const roleName = userRole?.name.toLowerCase() || '';

  const canEditUnits = isAdmin || roleName.includes('project manager') || roleName.includes('manager project');
  const canEditVendors = isAdmin || roleName.includes('engineering ho') || roleName.includes('deputy director engineering');

  const selectedRegion = data.regions.find(r => r.id === selectedRegionId);
  const regionUnits = selectedRegionId ? data.units.filter(u => u.regionId === selectedRegionId) : [];

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Master Data Management</h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Regions Column */}
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Regions / Wilayah</h2>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {data.regions.map(r => {
                  const isHoverable = r.type === 'Operasional';
                  return (
                    <tr 
                      key={r.id} 
                      style={{ 
                        background: selectedRegionId === r.id ? '#f0fdf4' : '',
                        cursor: isHoverable ? 'pointer' : 'default'
                      }}
                      onClick={() => {
                        if (isHoverable) setSelectedRegionId(r.id);
                      }}
                      className={isHoverable ? 'hoverable-row' : ''}
                    >
                      <td>{r.name}</td>
                      <td><span className={`badge ${r.type === 'HO' ? 'badge-gray' : 'badge-green'}`}>{r.type}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Units Column */}
        {selectedRegion && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: 'var(--primary)' }}>Units for {selectedRegion.name}</h2>
              {canEditUnits && (
                <button className="btn btn-primary" onClick={() => setShowAddUnitModal(true)}>+ Add Unit(s)</button>
              )}
            </div>

            {regionUnits.length === 0 ? (
              <p className="text-muted">No units added yet.</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Singkatan</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionUnits.map(u => (
                      <tr 
                        key={u.id}
                        onMouseEnter={() => setHoveredUnitId(u.id)}
                        onMouseLeave={() => setHoveredUnitId(null)}
                      >
                        <td>
                          {editUnitId === u.id ? (
                            <input type="text" className="form-input" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={editUnitName} onChange={e => setEditUnitName(e.target.value)} />
                          ) : (
                            u.name
                          )}
                        </td>
                        <td>
                          {editUnitId === u.id ? (
                            <input type="text" className="form-input" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={editUnitAbbreviation} onChange={e => setEditUnitAbbreviation(e.target.value)} />
                          ) : (
                            u.abbreviation || '-'
                          )}
                        </td>
                        <td style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', minHeight: '40px' }}>
                          {editUnitId === u.id ? (
                            <select className="form-select" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={editUnitType} onChange={e => setEditUnitType(e.target.value as any)}>
                              <option value="Estate">Estate</option>
                              <option value="Mill">Mill</option>
                              <option value="RMO">RMO</option>
                              <option value="Lainnya">Lainnya</option>
                            </select>
                          ) : (
                            <span className="badge badge-blue">{u.type}</span>
                          )}
                          
                          {/* Actions */}
                          {canEditUnits && (
                            editUnitId === u.id ? (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleSaveEditUnit(u.id)}>Save</button>
                                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setEditUnitId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.5rem', opacity: hoveredUnitId === u.id ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }}>
                                <button title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ea5e9', fontWeight: 600 }} onClick={() => {
                                  setEditUnitId(u.id);
                                  setEditUnitName(u.name);
                                  setEditUnitAbbreviation(u.abbreviation || '');
                                  setEditUnitType(u.type);
                                }}>✎ Edit</button>
                                <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 600 }} onClick={() => handleDeleteUnit(u.id)}>🗑 Hapus</button>
                              </div>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- MASTER VENDOR SECTION --- */}
      <div className="card mt-6" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'var(--primary)' }}>Master Vendor</h2>
          {canEditVendors && (
            <button className="btn btn-primary" onClick={() => setShowAddVendorModal(true)}>+ Add new vendor</button>
          )}
        </div>

        {(!data.vendors || data.vendors.length === 0) ? (
          <p className="text-muted">No vendors added yet.</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Vendor Name</th>
                  <th style={{ width: '60%' }}>Contact Info</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.vendors.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, verticalAlign: 'top' }}>{v.name}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {v.contacts.map((c, i) => (
                          <div key={i} style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '4px', fontSize: '0.85rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                              <div><span className="text-muted">Email:</span> {c.email || '-'}</div>
                              <div><span className="text-muted">Person:</span> {c.personName || '-'}</div>
                              <div><span className="text-muted">Contact:</span> {c.contactNumber || '-'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ verticalAlign: 'top', textAlign: 'center' }}>
                      {canEditVendors && (
                        <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 600 }} onClick={() => handleDeleteVendor(v.id)}>🗑 Hapus</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- ADD UNIT MODAL --- */}
      {showAddUnitModal && selectedRegion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '600px', maxWidth: '95vw', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Add Unit(s) to {selectedRegion.name}</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddUnitModal(false)} style={{ padding: '0.4rem 0.8rem' }}>Tutup</button>
            </div>
            
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
              <button 
                type="button"
                style={{ flex: 1, padding: '1rem', fontWeight: 600, borderBottom: addUnitTab === 'type1' ? '3px solid var(--primary)' : '3px solid transparent', background: addUnitTab === 'type1' ? '#fff' : '#f8fafc' }}
                onClick={() => setAddUnitTab('type1')}
              >
                Type I (Satu Persatu)
              </button>
              <button 
                type="button"
                style={{ flex: 1, padding: '1rem', fontWeight: 600, borderBottom: addUnitTab === 'type2' ? '3px solid var(--primary)' : '3px solid transparent', background: addUnitTab === 'type2' ? '#fff' : '#f8fafc' }}
                onClick={() => setAddUnitTab('type2')}
              >
                Type II (Copy-Paste Excel)
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '60vh' }}>
              {addUnitTab === 'type1' ? (
                <form onSubmit={handleAddUnitType1}>
                  <div className="form-group mb-4">
                    <label className="form-label">Unit Name</label>
                    <input type="text" className="form-input" value={unitName} onChange={e => setUnitName(e.target.value)} required placeholder="Misal: BUNGA TANJUNG MILL" />
                  </div>
                  <div className="form-group mb-4">
                    <label className="form-label">Singkatan</label>
                    <input type="text" className="form-input" value={unitAbbreviation} onChange={e => setUnitAbbreviation(e.target.value)} placeholder="Misal: BTM" required />
                  </div>
                  <div className="form-group mb-6">
                    <label className="form-label">Unit Type</label>
                    <select className="form-select" value={unitType} onChange={e => setUnitType(e.target.value as any)}>
                      <option value="Estate">Estate</option>
                      <option value="Mill">Mill</option>
                      <option value="RMO">RMO</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" disabled={loading}>+ Simpan Unit</button>
                  </div>
                </form>
              ) : (
                <div>
                  <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #bfdbfe' }}>
                    <strong style={{ color: '#1e3a8a', display: 'block', marginBottom: '0.5rem' }}>Panduan Copy-Paste dari Excel:</strong>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#1e40af', fontSize: '0.9rem' }}>
                      <li>Copy persis 3 kolom: <strong>Unit Name</strong>, <strong>Singkatan</strong>, dan <strong>Kode Unit Type</strong>.</li>
                      <li>Untuk kolom Kode Unit Type, mohon gunakan angka berikut agar sistem tidak error:
                        <ul style={{ marginTop: '0.25rem' }}>
                          <li><strong>1</strong> = RMO</li>
                          <li><strong>2</strong> = Estate</li>
                          <li><strong>3</strong> = Mill</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  {bulkError && (
                    <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #f87171' }}>
                      <strong>Peringatan!</strong> {bulkError}
                    </div>
                  )}

                  <div className="form-group mb-6">
                    <label className="form-label">Paste Data Excel Di Sini</label>
                    <textarea 
                      className="form-input" 
                      rows={8} 
                      placeholder={"BUNGA TANJUNG MILL\\tBTM\\t3\\nESTATE A\\tEA\\t2\\nRMO NORTH SUMATERA\\tRMO-NS\\t1"}
                      value={bulkData}
                      onChange={e => setBulkData(e.target.value)}
                      style={{ fontFamily: 'monospace', whiteSpace: 'pre' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-primary" onClick={handleAddUnitType2} disabled={loading || !bulkData.trim()}>
                      + Simpan Semua Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD VENDOR MODAL --- */}
      {showAddVendorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '700px', maxWidth: '95vw', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Add New Vendor</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddVendorModal(false)} style={{ padding: '0.4rem 0.8rem' }}>Tutup</button>
            </div>
            
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
              <button 
                type="button"
                style={{ flex: 1, padding: '1rem', fontWeight: 600, borderBottom: addVendorTab === 'type1' ? '3px solid var(--primary)' : '3px solid transparent', background: addVendorTab === 'type1' ? '#fff' : '#f8fafc' }}
                onClick={() => setAddVendorTab('type1')}
              >
                Method 1 (Manual Input)
              </button>
              <button 
                type="button"
                style={{ flex: 1, padding: '1rem', fontWeight: 600, borderBottom: addVendorTab === 'type2' ? '3px solid var(--primary)' : '3px solid transparent', background: addVendorTab === 'type2' ? '#fff' : '#f8fafc' }}
                onClick={() => setAddVendorTab('type2')}
              >
                Method 2 (Copy-Paste Excel)
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '70vh' }}>
              {addVendorTab === 'type1' ? (
                <form onSubmit={handleAddVendorType1}>
                  <div className="form-group mb-6">
                    <label className="form-label">Vendor Name</label>
                    <input type="text" className="form-input" value={vendorName} onChange={e => setVendorName(e.target.value)} required placeholder="Misal: PT. MAJU BERSAMA" />
                  </div>
                  
                  <div className="mb-4">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>Contact Persons (Maksimal 3)</label>
                      {vendorContacts.length < 3 && (
                        <button type="button" onClick={handleAddVendorContactRow} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>+ Tambah Kontak</button>
                      )}
                    </div>
                    
                    {vendorContacts.map((c, i) => (
                      <div key={i} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: '#64748b' }}>Kontak {i + 1}</strong>
                          {vendorContacts.length > 1 && (
                            <button type="button" onClick={() => handleRemoveVendorContactRow(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>Hapus</button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <input type="email" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem' }} placeholder="Email" value={c.email} onChange={e => handleUpdateVendorContactRow(i, 'email', e.target.value)} />
                          </div>
                          <div>
                            <input type="text" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem' }} placeholder="Nama Person" value={c.personName} onChange={e => handleUpdateVendorContactRow(i, 'personName', e.target.value)} />
                          </div>
                          <div>
                            <input type="text" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem' }} placeholder="No. Contact" value={c.contactNumber} onChange={e => handleUpdateVendorContactRow(i, 'contactNumber', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={loading}>+ Simpan Vendor</button>
                  </div>
                </form>
              ) : (
                <div>
                  <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #bfdbfe' }}>
                    <strong style={{ color: '#1e3a8a', display: 'block', marginBottom: '0.5rem' }}>Panduan Copy-Paste dari Excel:</strong>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#1e40af', fontSize: '0.9rem' }}>
                      <li>Metode ini hanya untuk vendor dengan <strong>1 kontak</strong>.</li>
                      <li>Copy persis 4 kolom berurutan: <strong>Vendor Name</strong>, <strong>Email</strong>, <strong>Person Name</strong>, dan <strong>Contact Number</strong>.</li>
                    </ul>
                  </div>

                  {vendorBulkError && (
                    <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #f87171' }}>
                      <strong>Peringatan!</strong> {vendorBulkError}
                    </div>
                  )}

                  <div className="form-group mb-6">
                    <label className="form-label">Paste Data Excel Di Sini</label>
                    <textarea 
                      className="form-input" 
                      rows={8} 
                      placeholder={"PT. MAJU\\tmaju@email.com\\tBudi\\t0812345678\\nPT. JAYA\\tjaya@email.com\\tAndi\\t0888888888"}
                      value={vendorBulkData}
                      onChange={e => setVendorBulkData(e.target.value)}
                      style={{ fontFamily: 'monospace', whiteSpace: 'pre' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-primary" onClick={handleAddVendorType2} disabled={loading || !vendorBulkData.trim()}>
                      + Simpan Semua Vendor
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
