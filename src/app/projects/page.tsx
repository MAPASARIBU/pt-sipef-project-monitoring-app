'use client';
import { useEffect, useState } from 'react';
import { DatabaseSchema, Project } from '@/lib/db';
import Link from 'next/link';

export default function ProjectsList() {
  const [data, setData] = useState<DatabaseSchema | null>(null);

  useEffect(() => {
    fetch('/api/db').then(res => res.json()).then(db => setData(db));
  }, []);

  if (!data) return <div className="p-4">Loading Projects...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Projects Monitoring</h1>
        <Link href="/projects/new" className="btn btn-primary">+ New Project</Link>
      </div>

      <div className="card">
        {data.projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p className="text-muted" style={{ marginBottom: '1rem' }}>No projects have been added yet.</p>
            <Link href="/projects/new" className="btn btn-primary">Start a New Project</Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Project Name</th>
                  <th>Region & Unit</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p, idx) => {
                  const unit = data.units.find(u => u.id === p.unitId);
                  const region = data.regions.find(r => r.id === unit?.regionId);
                  const unitName = unit ? unit.name : 'HO';
                  const regionName = region ? region.name : 'Unknown';
                  
                  let status = 'Initiation';
                  if (p.contractNumber) status = 'Contract Realization';
                  else if (p.openTenderDate) status = 'Tender Phase';
                  else if (p.docSubmissionDate) status = 'Doc Submission';

                  return (
                    <tr key={p.id}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{regionName}</div>
                        <div>{unitName}</div>
                      </td>
                      <td>
                        <span className={`badge ${p.category === 'CAPEX' ? 'badge-blue' : 'badge-green'}`} style={{ marginRight: '0.5rem' }}>
                          {p.category}
                        </span>
                        <span className="badge badge-gray">{p.type}</span>
                      </td>
                      <td>
                        <span className="badge badge-gray">{status}</span>
                        {p.progressPercent !== undefined && p.progressPercent > 0 && (
                          <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--success)' }}>
                            Progress: {p.progressPercent}%
                          </div>
                        )}
                      </td>
                      <td>
                        <Link href={`/projects/${p.id}`} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                          Update Progress
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
