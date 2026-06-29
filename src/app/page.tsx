'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, User, Project } from '@/lib/db';
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

export default function Dashboard() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [roleName, setRoleName] = useState<string>('Guest');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [loginUnitId, setLoginUnitId] = useState<string | null>(null);
  const [graphModalProject, setGraphModalProject] = useState<Project | null>(null);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    const authUser = getCookie('auth');
    setLoginUnitId(getCookie('loginUnitId') || null);

    fetch('/api/db')
      .then(res => res.json())
      .then(db => {
        setData(db);
        if (authUser === 'admin') {
          setRoleName('Administrator');
          setCurrentUser({ id: 'admin', name: 'admin', roleId: '18' });
        } else {
          const user = db.users.find((u: User) => u.name === authUser);
          if (user) {
            setCurrentUser(user);
            const role = db.roles.find((r: {id: string, name: string}) => r.id === user.roleId);
            if (role) setRoleName(role.name);
          }
        }
      });
  }, []);

  if (!data) return <div className="p-4">Loading Dashboard...</div>;

  const roleNameLower = roleName.toLowerCase();
  const isAdmin = currentUser?.id === 'admin';
  const isEngineeringHO = roleNameLower.includes('engineering ho');
  const isPurchasing = roleNameLower.includes('purchasing');
  const isDirectorHO = roleNameLower.includes('director engineering');
  const isRegionalDirector = roleNameLower.includes('regional director');
  const isRegionalController = roleNameLower.includes('regional control');
  const isEngineeringRmo = roleNameLower.includes('engineering rmo') || roleNameLower.includes('staff rmo');
  const isRmo = isEngineeringRmo || roleNameLower.includes('rmo');

  const hasGlobalView = isAdmin || isEngineeringHO || isPurchasing || isDirectorHO || roleNameLower.includes('head of operation') || roleNameLower.includes('ho');
  const hasRegionalView = isRegionalDirector || isRegionalController || isRmo;

  const activeUnitId = currentUser?.unitId || (loginUnitId !== 'HO' ? loginUnitId : null);
  const activeUnit = data.units.find(u => u.id === activeUnitId);

  const isLockedToRegion = !!(activeUnit && !hasGlobalView) || isRmo || hasRegionalView;
  const isLockedToUnit = !!(activeUnit && !isRmo && !hasGlobalView && !hasRegionalView);
  
  const displaySelectedRegionId = selectedRegionId || (isLockedToRegion ? (currentUser?.regionId || activeUnit?.regionId || '') : '');
  const displaySelectedUnitId = selectedUnitId || (isLockedToUnit ? activeUnitId || '' : '');

  const unitsInRegion = data.units.filter(u => u.regionId === displaySelectedRegionId);

  let visibleProjects = data.projects.filter(p => {
    if (displaySelectedUnitId && String(p.unitId) !== String(displaySelectedUnitId)) return false;
    if (displaySelectedRegionId && !displaySelectedUnitId) {
      const u = data.units.find(x => String(x.id) === String(p.unitId));
      if (u?.regionId !== displaySelectedRegionId) return false;
    }
    return true;
  });

  // Sort visibleProjects by Region (HO -> NS -> BK -> SS) then by OU Alphabetically
  visibleProjects = [...visibleProjects].sort((a, b) => {
    const unitA = data.units.find(u => u.id === a.unitId);
    const unitB = data.units.find(u => u.id === b.unitId);
    const regionA = unitA ? data.regions.find(r => r.id === unitA.regionId) : null;
    const regionB = unitB ? data.regions.find(r => r.id === unitB.regionId) : null;
    
    const regNameA = regionA ? (regionA.name.match(/\(([^)]+)\)/)?.[1] || regionA.name) : 'ZZZ';
    const regNameB = regionB ? (regionB.name.match(/\(([^)]+)\)/)?.[1] || regionB.name) : 'ZZZ';

    const orderMap: Record<string, number> = { 'HO': 1, 'NS': 2, 'BK': 3, 'SS': 4 };
    const orderA = orderMap[regNameA] || 99;
    const orderB = orderMap[regNameB] || 99;

    if (orderA !== orderB) return orderA - orderB;

    const ouNameA = unitA ? (unitA.abbreviation || unitA.name) : 'ZZZ';
    const ouNameB = unitB ? (unitB.abbreviation || unitB.name) : 'ZZZ';

    if (ouNameA !== ouNameB) return ouNameA.localeCompare(ouNameB);

    return (a.category || '').localeCompare(b.category || '');
  });

  const totalProjects = visibleProjects.length;
  const submissionOps = visibleProjects.filter(p => p.docComplete).length;
  const masukHO = visibleProjects.filter(p => p.continueProcess).length;
  const tenderPsd = visibleProjects.filter(p => p.tenderDateToPsd).length;
  const evalBidding = visibleProjects.filter(p => p.openTenderDate).length;
  const winner = visibleProjects.filter(p => p.tenderResultWinner).length;
  const contract = visibleProjects.filter(p => p.contractNumber).length;
  const createPRCount = visibleProjects.filter(p => p.prNo).length;
  const terbitPOCount = visibleProjects.filter(p => p.poNo).length;
  const onProgress = visibleProjects.filter(p => p.startDate || (p.progressPercent && p.progressPercent > 0 && p.progressPercent < 100)).length;
  const closed = visibleProjects.filter(p => p.progressPercent === 100).length;
  const srDoneCount = visibleProjects.filter(p => p.srNo).length;

  // Category Breakdown
  const capexCount = visibleProjects.filter(p => p.category === 'CAPEX').length;
  const opexCount = visibleProjects.filter(p => p.category === 'OPEX').length;

  // Type Breakdown
  const typeMech = visibleProjects.filter(p => p.type === 'MECHANICAL').length;
  const typeElec = visibleProjects.filter(p => p.type === 'ELECTRICAL').length;
  const typeCivil = visibleProjects.filter(p => p.type === 'CIVIL').length;
  const typeServ = visibleProjects.filter(p => p.type === 'SERVICE CONTRACT').length;
  const typeHeavy = visibleProjects.filter(p => p.type === 'HEAVY EQUIPMENT').length;

  // Format IDR currency
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  // 2. Summary by Region Calculations
  const summaryByRegion: Record<string, { name: string, planned: number, actual: number }> = {};
  let totalGrandPlanned = 0;
  let totalGrandActual = 0;

  visibleProjects.forEach(p => {
    const unit = data.units.find(u => u.id === p.unitId);
    const region = unit ? data.regions.find(r => r.id === unit.regionId) : null;
    const regionName = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : 'Unknown Region';
    
    const plannedVal = (p.planQty || 0) * (p.planPricePerQty || 0);
    const actualVal = p.actualTotalCost || ((p.actualQty || 0) * (p.actualCostPerUnit || 0));

    if (!summaryByRegion[regionName]) {
      summaryByRegion[regionName] = { name: regionName, planned: 0, actual: 0 };
    }
    
    summaryByRegion[regionName].planned += plannedVal;
    summaryByRegion[regionName].actual += actualVal;
    
    totalGrandPlanned += plannedVal;
    totalGrandActual += actualVal;
  });

  const summaryArray = Object.values(summaryByRegion).sort((a, b) => a.name.localeCompare(b.name));

  const formatType = (t: string) => {
    if (t === 'MECHANICAL') return 'MECH';
    if (t === 'ELECTRICAL') return 'ELEC';
    if (t === 'CIVIL') return 'CIVIL';
    if (t === 'HEAVY EQUIPMENT') return 'HEAVY';
    if (t === 'SERVICE CONTRACT') return 'SERVICE';
    return t;
  };

  const allowedSummaryRoles = ['engineering ho', 'director', 'head of operation', 'purchasing', 'rmo', 'administrator'];
  const showSummary = allowedSummaryRoles.some(r => roleName.toLowerCase().includes(r));

  const exportToCSV = () => {
    const headers = [
      'Region', 'OU', 'Category', 'Project Name', 'Type', 'Status', 'Qty', 
      'Total Harga Rencana', 'Actual Contract', 'Selisih', 'Nama Vendor', 'No Contract', 
      'No PR', 'No PO', 'Tgl BASTL', 'Progress', 'Tgl BAST', 'No SR'
    ];
    
    const rows = visibleProjects.map(p => {
      const unit = data.units.find(u => u.id === p.unitId);
      const region = unit ? data.regions.find(r => r.id === unit.regionId) : null;
      
      const plannedVal = (p.planQty || 0) * (p.planPricePerQty || 0);
      const actualVal = p.actualTotalCost || ((p.actualQty || 0) * (p.actualCostPerUnit || 0));
      const diffVal = actualVal - plannedVal;

      return [
        region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-',
        unit ? (unit.abbreviation || unit.name) : '-',
        p.category,
        `"${p.name.replace(/"/g, '""')}"`,
        formatType(p.type),
        p.contractNumber ? 'Contracted' : p.openTenderDate ? 'Tendering' : 'Initiation',
        p.planQty || 0,
        plannedVal,
        actualVal,
        diffVal,
        p.tenderResultWinner || '-',
        p.contractNumber || '-',
        p.prNo || '-',
        p.poNo || '-',
        p.bastlDate || '-',
        `${p.progressPercent || 0}%`,
        p.bastDate || '-',
        p.srNo || '-'
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "recent_projects.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard Overview</h1>
        <div className="user-role-badge badge badge-blue">Role: {roleName}</div>
      </div>

      {/* Filter Section */}
      <div className="card mb-6" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem 1.25rem', maxWidth: '600px' }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Select Region</label>
            <select 
              className="form-input" 
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
              value={selectedRegionId} 
              onChange={e => { setSelectedRegionId(e.target.value); setSelectedUnitId(''); }}
              disabled={isLockedToRegion}
            >
              <option value="">-- All Regions --</option>
              {data.regions.filter(r => r.type !== 'HO').map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Select Operational Unit</label>
            <select 
              className="form-input" 
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
              value={selectedUnitId} 
              onChange={e => setSelectedUnitId(e.target.value)}
              disabled={isLockedToUnit || (!selectedRegionId && !isLockedToRegion)}
            >
              <option value="">-- All Units --</option>
              {unitsInRegion.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Metric Cards */}
      {(() => {
        const getPct = (val: number) => totalProjects > 0 ? Math.round((val / totalProjects) * 100) + '%' : '0%';
        
        return (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Total Initiation</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{totalProjects}</div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Submission (BoQ)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{submissionOps}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>{getPct(submissionOps)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Masuk HO Eng</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{masukHO}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>{getPct(masukHO)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Tender PSD</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{tenderPsd}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>{getPct(tenderPsd)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Evaluasi Bidding</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{evalBidding}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>{getPct(evalBidding)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Sudah Pemenang</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{winner}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>{getPct(winner)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Kontrak Terbit</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{contract}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>{getPct(contract)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Create PR</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8b5cf6' }}>{createPRCount}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c4b5fd' }}>{getPct(createPRCount)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Terbit PO</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8b5cf6' }}>{terbitPOCount}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c4b5fd' }}>{getPct(terbitPOCount)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>On Progress</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--secondary)' }}>{onProgress}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#93c5fd' }}>{getPct(onProgress)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Selesai (Close)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{closed}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#86efac' }}>{getPct(closed)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-label text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Sudah Ada No SR</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{srDoneCount}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6ee7b7' }}>{getPct(srDoneCount)}</div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Category Card */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem', color: 'var(--primary)', fontSize: '1.1rem' }}>Project Category Breakdown</h2>
          <div className="grid grid-cols-2 gap-4">
            <div style={{ background: '#f0f9ff', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>CAPEX</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0369a1' }}>{capexCount}</span>
            </div>
            <div style={{ background: '#fffbeb', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>OPEX</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b45309' }}>{opexCount}</span>
            </div>
          </div>
        </div>

        {/* Type Card */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem', color: 'var(--primary)', fontSize: '1.1rem' }}>Work Type Breakdown</h2>
          <div className="grid grid-cols-3 gap-3">
            <div style={{ background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 600 }}>MECHANICAL</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{typeMech}</span>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 600 }}>ELECTRICAL</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{typeElec}</span>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 600 }}>CIVIL</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{typeCivil}</span>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 600 }}>SERVICE</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{typeServ}</span>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 600 }}>HEAVY EQ.</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{typeHeavy}</span>
            </div>
          </div>
        </div>
      </div>

      {showSummary && (
      <div className="card mb-6">
        <h2 style={{ marginBottom: '1rem', color: 'var(--primary)', fontSize: '1.1rem' }}>Project Values Summary by Region</h2>
        <div className="table-container">
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.5rem 0.75rem', width: '25%' }}>Region</th>
                <th style={{ padding: '0.5rem 0.75rem', width: '25%', textAlign: 'right' }}>Total Harga Rencana</th>
                <th style={{ padding: '0.5rem 0.75rem', width: '25%', textAlign: 'right' }}>Actual Nilai Contract</th>
                <th style={{ padding: '0.5rem 0.75rem', width: '25%', textAlign: 'right' }}>Selisih (Actual vs Rencana)</th>
              </tr>
            </thead>
            <tbody>
              {summaryArray.map(item => (
                <tr key={item.name}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatIDR(item.planned)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatIDR(item.actual)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: (item.actual - item.planned) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatIDR(item.actual - item.planned)}
                  </td>
                </tr>
              ))}
              {summaryArray.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted" style={{ padding: '1rem' }}>No data available</td>
                </tr>
              )}
            </tbody>
            {summaryArray.length > 0 && (
              <tfoot style={{ background: '#f8fafc', fontWeight: 700 }}>
                <tr>
                  <td style={{ padding: '0.5rem 0.75rem' }}>GRAND TOTAL</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatIDR(totalGrandPlanned)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatIDR(totalGrandActual)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: (totalGrandActual - totalGrandPlanned) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatIDR(totalGrandActual - totalGrandPlanned)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      )}

      <div className="card mb-6 print-only" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--primary)', margin: 0 }}>Recent Projects Details</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={exportToCSV} 
              className="btn btn-secondary no-print"
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              ⬇️ Export Excel (CSV)
            </button>
            <button 
              onClick={() => window.print()} 
              className="btn btn-primary no-print"
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              🖨️ Print Data
            </button>
          </div>
        </div>
        {totalProjects === 0 ? (
          <p className="text-muted">No projects found. Add one in the Projects tab.</p>
        ) : (
          <div className="table-container" style={{ minWidth: '1500px' }}>
            <table className="data-table" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.4rem 0.75rem' }}>Region</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>OU</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>Category</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>Project Name</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>Type</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>Status</th>
                  <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>Total Harga Rencana</th>
                  <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>Actual Contract</th>
                  <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>Selisih</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>Nama Vendor</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>No Contract</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>No PR</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>No PO</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>Tgl BASTL</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>Progress</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>Tgl BAST</th>
                  <th style={{ padding: '0.4rem 0.75rem' }}>No SR</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const groups: Project[][] = [];
                  visibleProjects.forEach(p => {
                    const lastGroup = groups[groups.length - 1];
                    if (lastGroup && lastGroup[0].unitId === p.unitId) {
                      lastGroup.push(p);
                    } else {
                      groups.push([p]);
                    }
                  });

                  return groups.flatMap((group, gIdx) => {
                    let sumPlanned = 0;
                    let sumActual = 0;
                    let sumDiff = 0;
                    
                    const unit = data.units.find(u => u.id === group[0].unitId);
                    const unitName = unit ? (unit.abbreviation || unit.name) : '-';

                    const rowElements = group.map(p => {
                      const region = data.regions.find(r => r.id === unit?.regionId);
                      const regionName = region ? (region.name.match(/\(([^)]+)\)/)?.[1] || region.name) : '-';
                      
                      const plannedVal = (p.planQty || 0) * (p.planPricePerQty || 0);
                      const actualVal = p.actualTotalCost || ((p.actualQty || 0) * (p.actualCostPerUnit || 0));
                      const diffVal = actualVal - plannedVal;

                      sumPlanned += plannedVal;
                      sumActual += actualVal;
                      sumDiff += diffVal;

                      return (
                        <tr key={p.id}>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{regionName}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{unitName}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.category}</td>
                          <td style={{ padding: '0.4rem 0.75rem', fontWeight: 500 }}>
                            {p.bastlDate ? (
                              <button 
                                type="button" 
                                onClick={() => setGraphModalProject(p)}
                                style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 500, textAlign: 'left' }}
                              >
                                {p.name}
                              </button>
                            ) : (
                              <span>{p.name}</span>
                            )}
                          </td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{formatType(p.type)}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.contractNumber ? 'Contracted' : p.openTenderDate ? 'Tendering' : 'Initiation'}</td>
                          <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{p.planQty || 0}</td>
                          <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{formatIDR(plannedVal)}</td>
                          <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{formatIDR(actualVal)}</td>
                          <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: diffVal > 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {formatIDR(diffVal)}
                          </td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.tenderResultWinner || '-'}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.contractNumber || '-'}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.prNo || '-'}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.poNo || '-'}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.bastlDate || '-'}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.progressPercent || 0}%</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.bastDate || '-'}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>{p.srNo || '-'}</td>
                        </tr>
                      );
                    });

                    const subtotalRow = (
                      <tr key={`subtotal-${gIdx}`} style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', fontWeight: 700 }}>
                        <td colSpan={7} style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>SUBTOTAL {unitName}</td>
                        <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: '#0369a1' }}>{formatIDR(sumPlanned)}</td>
                        <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: '#0369a1' }}>{formatIDR(sumActual)}</td>
                        <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: sumDiff > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatIDR(sumDiff)}</td>
                        <td colSpan={8}></td>
                      </tr>
                    );

                    return [...rowElements, subtotalRow];
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                if (!weekData[weekIndex] || h.percent > weekData[weekIndex]) {
                  weekData[weekIndex] = h.percent;
                }
              });

              const maxActualWeek = Math.max(-1, ...Object.keys(weekData).map(Number));
              const totalWeeksToDisplay = Math.max(plannedWeeks, maxActualWeek);
              
              let lastKnownPercent = 0;
              for (let w = 0; w <= totalWeeksToDisplay; w++) {
                labels.push(`W ${w}`);
                if (weekData[w] !== undefined) {
                  dataPoints.push(weekData[w]);
                  lastKnownPercent = weekData[w];
                } else if (w === 0 && weekData[w] === undefined) {
                  dataPoints.push(0);
                } else if (w > maxActualWeek) {
                  dataPoints.push(null);
                } else {
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
                    spanGaps: true,
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
