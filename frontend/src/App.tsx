import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import IncidentDetail from './IncidentDetail';

function App() {
  return (
    <Router>
      <div className="container">
        <header className="header">
          <h1 className="title">Mission-Critical IMS</h1>
          <div style={{ color: 'var(--text-muted)' }}>
            Real-time Incident Dashboard
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/incident/:id" element={<IncidentDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
