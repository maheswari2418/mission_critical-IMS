import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, Activity } from 'lucide-react';

export default function Dashboard() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/incidents');
      setIncidents(res.data);
    } catch (e) {
      console.error("Failed to fetch");
    }
  };

  return (
    <div className="animated">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Activity color="var(--info)" />
        <h2>Live Active Incidents Feed</h2>
      </div>
      
      {incidents.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
          No active incidents. Systems are healthy.
        </div>
      ) : (
        incidents.map((incident) => (
          <div key={incident.id} className="card" onClick={() => navigate(`/incident/${incident.id}`)}>
            <div className="card-header">
              <span className={`severity-badge severity-${incident.severity.toLowerCase()}`}>
                <AlertCircle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/>
                {incident.severity}
              </span>
              <span className="status-badge">{incident.status}</span>
            </div>
            <h3 style={{ margin: '0.5rem 0' }}>{incident.componentId}</h3>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Created: {new Date(incident.createdAt).toLocaleString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
