'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, User } from '@/lib/db';

export default function UserManagement() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [regionId, setRegionId] = useState('');

  const fetchData = async () => {
    const res = await fetch('/api/db');
    const db = await res.json();
    setData(db);
    
    // Authorization Check
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    const authUser = getCookie('auth');
    
    let isAdmin = false;
    if (authUser === 'admin') {
      isAdmin = true;
    } else if (authUser) {
      const user = db.users.find((u: any) => u.name === authUser);
      if (user) {
        const role = db.roles.find((r: any) => r.id === user.roleId);
        if (role && (role.accessLevel === 'admin' || role.name === 'Administrator')) {
          isAdmin = true;
        }
      }
    }
    
    if (!isAdmin) {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !name || !roleId) return;

    setLoading(true);
    const newUser: User = {
      id: Date.now().toString(),
      name,
      password,
      roleId,
      unitId: unitId || undefined,
      regionId: regionId || undefined
    };

    const newData = { ...data, users: [...data.users, newUser] };
    
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });

    setData(newData);
    setName('');
    setPassword('');
    setRoleId('');
    setUnitId('');
    setRegionId('');
    setLoading(false);
    setShowAddUserModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!data || !confirm('Are you sure you want to delete this user?')) return;
    setLoading(true);
    const newData = { ...data, users: data.users.filter(u => u.id !== id) };
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });
    setData(newData);
    setLoading(false);
  };

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Edit Role/Unit states
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState('');
  const [editUnitId, setEditUnitId] = useState('');
  const [editRegionId, setEditRegionId] = useState('');

  const openEditPassword = (id: string) => {
    setEditingUserId(id);
    setNewPassword('');
  };

  const handleSavePassword = async () => {
    if (!editingUserId || !data || !newPassword) return;
    
    setLoading(true);
    const newData = {
      ...data,
      users: data.users.map(u => u.id === editingUserId ? { ...u, password: newPassword } : u)
    };
    
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });
    
    setData(newData);
    setLoading(false);
    setEditingUserId(null);
    setNewPassword('');
    alert("Password berhasil diubah!");
  };

  const openEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditRoleId(user.roleId);
    setEditUnitId(user.unitId || '');
    setEditRegionId(user.regionId || '');
    setEditUserModalOpen(true);
  };

  const handleSaveUserEdit = async () => {
    if (!editingUserId || !data || !editRoleId) return;
    
    setLoading(true);
    const newData = {
      ...data,
      users: data.users.map(u => u.id === editingUserId ? { ...u, roleId: editRoleId, unitId: editUnitId || undefined, regionId: editRegionId || undefined } : u)
    };
    
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });
    
    setData(newData);
    setLoading(false);
    setEditUserModalOpen(false);
    setEditingUserId(null);
    alert("Role dan Unit berhasil diubah!");
  };

  if (!data) return <div className="p-4">Loading User Management...</div>;

  return (
    <div>
      <div className="page-header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">User Management</h1>
        <button className="btn btn-primary" onClick={() => setShowAddUserModal(true)}>+ Add New User</button>
      </div>

      <div className="card w-full">
        <h2 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Registered Users</h2>
          {data.users.length === 0 ? (
            <p className="text-muted">No users registered yet.</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Assigned Unit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map(u => {
                    const role = data.roles.find(r => r.id === u.roleId);
                    const unit = data.units.find(un => un.id === u.unitId);
                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td>
                          <span className={`badge ${role?.accessLevel === 'view' ? 'badge-gray' : 'badge-blue'}`}>
                            {role?.name || 'Unknown Role'}
                          </span>
                        </td>
                        <td>{unit ? unit.name : (u.regionId ? `${data.regions.find(r => r.id === u.regionId)?.name} (Region)` : 'N/A')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              type="button"
                              onClick={() => openEditUser(u)}
                              className="btn btn-secondary" 
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', color: '#059669', borderColor: '#a7f3d0' }}
                            >
                              Edit Role/Unit
                            </button>
                            <button 
                              type="button"
                              onClick={() => openEditPassword(u.id)}
                              className="btn btn-secondary" 
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'var(--border)' }}
                            >
                              Edit Password
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDelete(u.id)}
                              className="btn btn-secondary" 
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', color: 'red', borderColor: 'rgba(255,0,0,0.2)' }}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* Modal Add New User */}
      {showAddUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Add New User</h3>
              <button onClick={() => setShowAddUserModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Full Name / Username</label>
                <input type="text" className="form-input w-full" value={name} onChange={e => setName(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="text" className="form-input w-full" value={password} onChange={e => setPassword(e.target.value)} placeholder="Default password" required />
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select w-full" value={roleId} onChange={e => setRoleId(e.target.value)} required>
                  <option value="">Select a Role...</option>
                  {data.roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {(() => {
                const selectedRoleName = data.roles.find(r => r.id === roleId)?.name?.toLowerCase() || '';
                const isRegionalRole = selectedRoleName.includes('region') || selectedRoleName.includes('rce');
                const isGlobalRole = selectedRoleName.includes('ho') || selectedRoleName.includes('director') || selectedRoleName.includes('head of') || selectedRoleName.includes('purchasing');

                if (isRegionalRole) {
                  return (
                    <div className="form-group mb-4">
                      <label className="form-label block mb-2" style={{ fontWeight: 600 }}>Pilih Region</label>
                      <select className="form-select w-full" value={regionId} onChange={e => { setRegionId(e.target.value); setUnitId(''); }} required>
                        <option value="">-- Pilih Region --</option>
                        {data.regions.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <small style={{ color: 'var(--text-muted)' }}>Select a region since this role manages a specific Region.</small>
                    </div>
                  );
                }

                if (isGlobalRole) {
                  return (
                    <div className="form-group mb-4">
                      <label className="form-label block mb-2" style={{ fontWeight: 600, color: '#64748b' }}>Assigned Unit</label>
                      <div style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.9rem' }}>
                        🌟 Global Access (Tidak perlu pilih Region/Unit)
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="form-group mb-4">
                    <label className="form-label block mb-2" style={{ fontWeight: 600 }}>Pilih Unit Operasional (Wajib)</label>
                    <select className="form-select w-full" value={unitId} onChange={e => { setUnitId(e.target.value); setRegionId(''); }} required>
                      <option value="">-- Pilih Unit --</option>
                      {data.units.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({data.regions.find(r => r.id === u.regionId)?.name})</option>
                      ))}
                    </select>
                    <small style={{ color: 'var(--text-muted)' }}>Select a unit if this user manages a specific Mill, Estate, or RMO.</small>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Saving...' : 'Simpan User Baru'}
                </button>
                <button type="button" onClick={() => setShowAddUserModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Password */}
      {editingUserId && !editUserModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Ganti Password</h3>
            <div className="form-group">
              <label className="form-label">Password Baru</label>
              <input 
                type="text" 
                className="form-input" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Masukkan password baru..."
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="button" onClick={handleSavePassword} className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button type="button" onClick={() => setEditingUserId(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Role/Unit */}
      {editUserModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Edit Role & Unit</h3>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={editRoleId} onChange={e => setEditRoleId(e.target.value)} required>
                <option value="">Select a Role...</option>
                {data.roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            {(() => {
              const selectedRoleName = data.roles.find(r => r.id === editRoleId)?.name?.toLowerCase() || '';
              const isRegionalRole = selectedRoleName.includes('region') || selectedRoleName.includes('rce');
              const isGlobalRole = selectedRoleName.includes('ho') || selectedRoleName.includes('director') || selectedRoleName.includes('head of') || selectedRoleName.includes('purchasing');

              if (isRegionalRole) {
                return (
                  <div className="form-group mb-4">
                    <label className="form-label block mb-2" style={{ fontWeight: 600 }}>Pilih Region</label>
                    <select className="form-select w-full" value={editRegionId} onChange={e => { setEditRegionId(e.target.value); setEditUnitId(''); }} required>
                      <option value="">-- Pilih Region --</option>
                      {data.regions.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <small style={{ color: 'var(--text-muted)' }}>Select a region since this role manages a specific Region.</small>
                  </div>
                );
              }

              if (isGlobalRole) {
                return (
                  <div className="form-group mb-4">
                    <label className="form-label block mb-2" style={{ fontWeight: 600, color: '#64748b' }}>Assigned Unit</label>
                    <div style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.9rem' }}>
                      🌟 Global Access (Tidak perlu pilih Region/Unit)
                    </div>
                  </div>
                );
              }

              return (
                <div className="form-group mb-4">
                  <label className="form-label block mb-2" style={{ fontWeight: 600 }}>Pilih Unit Operasional (Wajib)</label>
                  <select className="form-select w-full" value={editUnitId} onChange={e => { setEditUnitId(e.target.value); setEditRegionId(''); }} required>
                    <option value="">-- Pilih Unit --</option>
                    {data.units.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({data.regions.find(r => r.id === u.regionId)?.name})</option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-muted)' }}>Select a unit if this user manages a specific Mill, Estate, or RMO.</small>
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" onClick={handleSaveUserEdit} className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
              <button type="button" onClick={() => { setEditUserModalOpen(false); setEditingUserId(null); }} className="btn btn-secondary" style={{ flex: 1 }}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
