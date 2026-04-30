import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, Database } from 'lucide-react';

export default function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [rca, setRca] = useState({
    rootCauseCategory: 'CODE_BUG',
    fixApplied: '',
    preventionSteps: '',
    startTime: '',
    endTime: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchDetail = async () => {
    try {
      const res = await axios.get(`http://localhost:3000/api/incidents/${id}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const updateState = async (action: 'next' | 'close') => {
    setError('');
    try {
      const payload = action === 'close' ? { action, rca: {
        startTime: rca.startTime || data.workItem.createdAt,
        endTime: rca.endTime || new Date().toISOString(),
        ...rca
      } } : { action };

      await axios.post(`http://localhost:3000/api/incidents/${id}/state`, payload);
      fetchDetail();
    } catch (err: any) {
      setError(err.response?.data?.error || "Error updating state");
    }
  };

  if (!data) return <div className="container">Loading...</div>;

  const { workItem, signals } = data;

  return (
    <div className="animated">
      <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border)', marginBottom: '1rem' }} onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="card" style={{ cursor: 'default' }}>
        <div className="card-header">
          <h2>{workItem.componentId}</h2>
          <span className="status-badge" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>{workItem.status}</span>
        </div>
        <div style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Incident ID: {workItem.id} | Severity: {workItem.severity}
        </div>
        
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '1rem' }}>
          {workItem.status === 'OPEN' && <button className="btn" onClick={() => updateState('next')}>Investigate</button>}
          {workItem.status === 'INVESTIGATING' && <button className="btn" onClick={() => updateState('next')}>Mark Resolved</button>}
        </div>
      </div>

      <div className="detail-view">
        <div className="signals-panel">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} /> Raw Data Lake Signals (Max 50)
          </h3>
          <div className="signals-list">
            {signals.length === 0 ? "No raw signals found (MongoDB might be unavailable or syncing)." : 
              signals.map((s: any, i: number) => (
                <div key={i} style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--warning)' }}>[{new Date(s.timestamp).toLocaleTimeString()}]</span> {s.type}
                  <pre style={{ marginTop: '0.5rem', color: '#64748b' }}>{JSON.stringify(s.payload, null, 2)}</pre>
                </div>
              ))
            }
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} /> Root Cause Analysis (RCA)
          </h3>
          {workItem.status === 'CLOSED' ? (
            <div className="rca-form">
              <p><strong>Category:</strong> {workItem.rca?.rootCauseCategory}</p>
              <p><strong>Fix:</strong> {workItem.rca?.fixApplied}</p>
              <p><strong>Prevention:</strong> {workItem.rca?.preventionSteps}</p>
              <p><strong>Time to Repair:</strong> {Math.round((new Date(workItem.rca?.endTime).getTime() - new Date(workItem.rca?.startTime).getTime()) / 60000)} mins</p>
            </div>
          ) : (
            <div className="rca-form">
              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label>Incident Start (Optional Override)</label>
                  <input type="datetime-local" className="form-control" value={rca.startTime} onChange={e => setRca({...rca, startTime: e.target.value})} />
                </div>
                <div>
                  <label>Incident End (Optional Override)</label>
                  <input type="datetime-local" className="form-control" value={rca.endTime} onChange={e => setRca({...rca, endTime: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={rca.rootCauseCategory} onChange={e => setRca({...rca, rootCauseCategory: e.target.value})}>
                  <option value="CODE_BUG">Code Bug</option>
                  <option value="INFRA_FAILURE">Infrastructure Failure</option>
                  <option value="CONFIG_ERROR">Configuration Error</option>
                  <option value="EXTERNAL_API">External API Outage</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fix Applied</label>
                <textarea className="form-control" rows={3} value={rca.fixApplied} onChange={e => setRca({...rca, fixApplied: e.target.value})}></textarea>
              </div>
              <div className="form-group">
                <label>Prevention Steps</label>
                <textarea className="form-control" rows={3} value={rca.preventionSteps} onChange={e => setRca({...rca, preventionSteps: e.target.value})}></textarea>
              </div>
              <button 
                className="btn" 
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={workItem.status !== 'RESOLVED'}
                onClick={() => updateState('close')}
              >
                Submit RCA & Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
