import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { checkRateLimit, processSignal, incrementThroughput } from './ingestion';
import { WorkItemContext, WorkItemStateError } from './workflow';
import { WorkItemsStore, SignalModel } from './models';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Fallback MongoDB if DB fails to connect
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/ims_db', {
  serverSelectionTimeoutMS: 2000
}).catch(err => {
  console.log("MongoDB connection skipped/failed, using in-memory fallbacks where possible.");
});

// API Routes

// 1. Ingestion Endpoint
app.post('/api/signals', async (req, res) => {
  const ip = req.ip || 'unknown';
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const { componentId, type, payload } = req.body;
  if (!componentId || !type) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // Fire and forget processing
  processSignal(req.body).catch(err => console.error(err));
  incrementThroughput();

  res.status(202).json({ status: "Accepted" });
});

// 2. Health Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date() });
});

// 3. Get Active Incidents (Dashboard Feed)
app.get('/api/incidents', (req, res) => {
  const active = Array.from(WorkItemsStore.values());
  // Sort by severity (P0 > P1 > P2 > P3)
  active.sort((a, b) => a.severity.localeCompare(b.severity));
  res.json(active);
});

// 4. Get Incident Details
app.get('/api/incidents/:id', async (req, res) => {
  const wi = WorkItemsStore.get(req.params.id);
  if (!wi) return res.status(404).json({ error: 'Not found' });
  
  let signals: any[] = [];
  try {
    if (mongoose.connection.readyState === 1) {
      signals = await SignalModel.find({ workItemId: wi.id }).sort({ timestamp: -1 }).limit(50);
    }
  } catch (e) { }

  res.json({
    workItem: wi,
    signals
  });
});

// 5. Update Incident Status / RCA
app.post('/api/incidents/:id/state', (req, res) => {
  const wi = WorkItemsStore.get(req.params.id);
  if (!wi) return res.status(404).json({ error: 'Not found' });

  const { action, rca } = req.body; // action: 'next' or 'close'

  const context = new WorkItemContext(wi);
  try {
    if (action === 'next') {
      context.next();
    } else if (action === 'close') {
      context.close(rca);
    }
    res.json(context.getWorkItem());
  } catch (error: any) {
    if (error instanceof WorkItemStateError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
