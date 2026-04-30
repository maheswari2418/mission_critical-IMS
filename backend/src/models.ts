import mongoose from 'mongoose';

// MongoDB Schema for Raw Signals (Data Lake)
const signalSchema = new mongoose.Schema({
  componentId: { type: String, required: true },
  type: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  timestamp: { type: Date, default: Date.now },
  workItemId: { type: String, required: false }
});

export const SignalModel = mongoose.model('Signal', signalSchema);

// Simulating Postgres with an in-memory or fallback array for simplicity if pg fails,
// but let's define the interface.
export interface WorkItem {
  id: string;
  componentId: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  createdAt: Date;
  updatedAt: Date;
  rca?: RCA;
}

export interface RCA {
  startTime: Date;
  endTime: Date;
  rootCauseCategory: string;
  fixApplied: string;
  preventionSteps: string;
}

// In-memory WorkItems store (Acting as Postgres cache/fallback)
export const WorkItemsStore: Map<string, WorkItem> = new Map();
