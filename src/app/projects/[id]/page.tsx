'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, Project, Unit, Region } from '@/lib/db';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProjectDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === 'new';
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [project, setProject] = useState<Partial<Project>>({
    category: 'CAPEX',
    type: 'CIVIL',
    execution: 'NON LEBARAN',
    docComplete: false,
    continueProcess: true
  });

  useEffect(() => {
    fetch('/api/db').then(res => res.json()).then((db: DatabaseSchema) => {
      setData(db);
      if (!isNew) {
        const existing = db.projects.find(p => p.id === params.id);
        if (existing) setProject(existing);
      }
    });
  }, [isNew, params.id]);

  if (!data) return <div className="p-4">Loading...</div>;

  const selectedUnit = data.units.find(u => u.id === project.unitId);
  const isMill = selectedUnit?.type === 'Mill';

  // Automatically enforce type CIVIL if not Mill
  if (selectedUnit && !isMill && project.type !== 'CIVIL') {
    setProject({ ...project, type: 'CIVIL' });
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let finalProject = { ...project };
    if (isNew) {
      finalProject.id = Date.now().toString();
      finalProject.createdAt = new Date().toISOString();
      data.projects.push(finalProject as Project);
    } else {
      const idx = data.projects.findIndex(p => p.id === finalProject.id);
      if (idx !== -1) data.projects[idx] = finalProject as Project;
    }
    
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setSaving(false);
    router.push('/projects');
  };

  return (
    <div>
      <div className="page-header mb-4">
        <h1 className="page-title">{isNew ? 'Create New Project' : 'Project Details & Progress'}</h1>
        <Link href="/projects" className="btn btn-secondary">Back</Link>
      </div>

      <form onSubmit={handleSave}>
        {/* Phase 1: Initiation */}
        <div className="card mb-6">
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>1. Project Initiation</h2>
          <div className="grid grid-cols-2 gap-6">
            
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Operational Unit</label>
              <select className="form-select" value={project.unitId || ''} onChange={e => setProject({...project, unitId: e.target.value})} required>
                <option value="">Select Unit...</option>
                {data.units.map(u => {
                  const reg = data.regions.find(r => r.id === u.regionId);
                  return <option key={u.id} value={u.id}>{reg?.name} - {u.name} ({u.type})</option>;
                })}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={project.category} onChange={e => setProject({...project, category: e.target.value as 'CAPEX'|'OPEX'})}>
                <option value="CAPEX">CAPEX</option>
                <option value="OPEX">NON CAPEX (OPEX)</option>
              </select>
            </div>

            {isMill && (
              <div className="form-group">
                <label className="form-label">Stasiun (Station)</label>
                <select className="form-select" value={project.station || ''} onChange={e => setProject({...project, station: e.target.value})} required>
                  <option value="">Pilih Stasiun...</option>
                  <option value="Loading Ramp">Loading Ramp</option>
                  <option value="Sterilizer">Sterilizer</option>
                  <option value="Thresher">Thresher</option>
                  <option value="Press">Press</option>
                  <option value="Boiler">Boiler</option>
                  <option value="Kernel">Kernel</option>
                  <option value="Clarification">Clarification</option>
                  <option value="Empty Bunch">Empty Bunch</option>
                  <option value="Power Plant">Power Plant</option>
                  <option value="Water Treatment">Water Treatment</option>
                  <option value="General">General / Lainnya</option>
                </select>
              </div>
            )}

            <div className="form-group" style={{ gridColumn: isMill ? 'span 2' : 'span 1' }}>
              <label className="form-label">Project / Item Name</label>
              <input type="text" className="form-input" value={project.name || ''} onChange={e => setProject({...project, name: e.target.value})} required />
            </div>

            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input type="number" className="form-input" value={project.planQty || ''} onChange={e => setProject({...project, planQty: Number(e.target.value)})} required />
            </div>
            
            <div className="form-group">
              <label className="form-label">Harga / Quantity (Rp)</label>
              <input type="number" className="form-input" value={project.planPricePerQty || ''} onChange={e => setProject({...project, planPricePerQty: Number(e.target.value)})} required />
            </div>
            
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Total Harga Rencana (Rp)</label>
              <div className="form-input" style={{ background: '#e0f2fe', fontWeight: 'bold' }}>
                {((project.planQty || 0) * (project.planPricePerQty || 0)).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Work Type</label>
              <select className="form-select" value={project.type} onChange={e => setProject({...project, type: e.target.value as any})} disabled={!isMill}>
                <option value="CIVIL">CIVIL</option>
                {isMill && (
                  <>
                    <option value="MECHANICAL">MECHANICAL</option>
                    <option value="ELECTRICAL">ELECTRICAL</option>
                    <option value="HEAVY EQUIPMENT">HEAVY EQUIPMENT</option>
                  </>
                )}
              </select>
              {!isMill && <small style={{ color: 'var(--text-muted)' }}>Non-Mill units must be CIVIL type.</small>}
            </div>

            <div className="form-group">
              <label className="form-label">Execution Plan</label>
              <select className="form-select" value={project.execution} onChange={e => setProject({...project, execution: e.target.value as any})}>
                <option value="NON LEBARAN">NON LEBARAN</option>
                <option value="LEBARAN">LEBARAN</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Project Initiation'}
            </button>
          </div>
        </div>

        {/* Phase 2, 3, 4 only visible when editing an existing project */}
        {!isNew && (
          <>
            {/* Phase 2: Tender Document Progress */}
            <div className="card mb-6">
              <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>2. Tender Progress</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="form-group">
                  <label className="form-label">Doc Submission Date to HO</label>
                  <input type="date" className="form-input" value={project.docSubmissionDate || ''} onChange={e => setProject({...project, docSubmissionDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Documents Complete?</label>
                  <select className="form-select" value={project.docComplete ? 'Yes' : 'No'} onChange={e => setProject({...project, docComplete: e.target.value === 'Yes'})}>
                    <option value="No">No (TIDAK LENGKAP)</option>
                    <option value="Yes">Yes (LENGKAP)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Continue Process?</label>
                  <select className="form-select" value={project.continueProcess ? 'Yes' : 'No'} onChange={e => setProject({...project, continueProcess: e.target.value === 'Yes'})}>
                    <option value="Yes">LANJUT</option>
                    <option value="No">BATAL</option>
                  </select>
                </div>

                {project.docComplete && project.continueProcess && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Tender Date TO PSD</label>
                      <input type="date" className="form-input" value={project.tenderDateToPsd || ''} onChange={e => setProject({...project, tenderDateToPsd: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tender PSD Date</label>
                      <input type="date" className="form-input" value={project.tenderPsdDate || ''} onChange={e => setProject({...project, tenderPsdDate: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Invited PTs / Contacts</label>
                      <input type="text" className="form-input" placeholder="List of PTs..." value={Array.isArray(project.invitedPts) ? project.invitedPts.map(pt => pt.ptName).join(', ') : (project.invitedPts || '')} disabled />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Open Tender Date</label>
                      <input type="date" className="form-input" value={project.openTenderDate || ''} onChange={e => setProject({...project, openTenderDate: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Winner (Tender Result)</label>
                      <input type="text" className="form-input" placeholder="Winning PT" value={project.tenderResultWinner || ''} onChange={e => setProject({...project, tenderResultWinner: e.target.value})} />
                    </div>
                  </>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Tender Progress'}
                </button>
              </div>
            </div>

            {/* Phase 3: Contract Realization */}
            {project.tenderResultWinner && (
              <div className="card mb-6">
                <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>3. Contract Realization</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="form-label">Contract Number</label>
                    <input type="text" className="form-input" value={project.contractNumber || ''} onChange={e => setProject({...project, contractNumber: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Actual Quantity</label>
                    <input type="number" className="form-input" value={project.actualQty || ''} onChange={e => setProject({...project, actualQty: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost / Unit (Rp)</label>
                    <input type="number" className="form-input" value={project.actualCostPerUnit || ''} onChange={e => setProject({...project, actualCostPerUnit: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Cost (Rp)</label>
                    <div className="form-input" style={{ background: '#f8fbfd' }}>
                      {((project.actualQty || 0) * (project.actualCostPerUnit || 0)).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Contract Realization'}
                  </button>
                </div>
              </div>
            )}

            {/* Phase 4: Work Progress */}
            {project.contractNumber && (
              <div className="card mb-6">
                <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>4. Actual Progress Update</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="form-label">PR No</label>
                    <input type="text" className="form-input" value={project.prNo || ''} onChange={e => setProject({...project, prNo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PO No</label>
                    <input type="text" className="form-input" value={project.poNo || ''} onChange={e => setProject({...project, poNo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Planned Duration</label>
                    <input type="text" className="form-input" placeholder="e.g. 30 Hari" value={project.plannedDuration || ''} onChange={e => setProject({...project, plannedDuration: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Work Start Date</label>
                    <input type="date" className="form-input" value={project.startDate || ''} onChange={e => setProject({...project, startDate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Progress Percentage (%)</label>
                    <input type="number" max="100" min="0" className="form-input" value={project.progressPercent || ''} onChange={e => setProject({...project, progressPercent: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Progress Update Date</label>
                    <input type="date" className="form-input" value={project.progressUpdateDate || ''} onChange={e => setProject({...project, progressUpdateDate: e.target.value})} />
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Progress Update'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
          <Link href="/projects" className="btn btn-secondary">← Back to Projects List</Link>
        </div>
      </form>
    </div>
  );
}
