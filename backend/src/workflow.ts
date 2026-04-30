import { WorkItem, WorkItemsStore, RCA } from './models';
import crypto from 'crypto';

// --- Strategy Pattern: Alerting ---
export interface AlertStrategy {
  sendAlert(workItem: WorkItem): void;
}

export class P0AlertStrategy implements AlertStrategy {
  sendAlert(workItem: WorkItem) {
    console.log(`[ALERT] P0 CRITICAL: PagerDuty triggered for ${workItem.componentId}`);
  }
}

export class P2AlertStrategy implements AlertStrategy {
  sendAlert(workItem: WorkItem) {
    console.log(`[ALERT] P2 WARNING: Slack message sent for ${workItem.componentId}`);
  }
}

export class DefaultAlertStrategy implements AlertStrategy {
  sendAlert(workItem: WorkItem) {
    console.log(`[ALERT] Email sent for ${workItem.componentId}`);
  }
}

export class AlertContext {
  private strategy: AlertStrategy;

  constructor(strategy: AlertStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: AlertStrategy) {
    this.strategy = strategy;
  }

  executeStrategy(workItem: WorkItem) {
    this.strategy.sendAlert(workItem);
  }
}

export function determineSeverity(componentId: string): 'P0' | 'P1' | 'P2' | 'P3' {
  if (componentId.includes('RDBMS')) return 'P0';
  if (componentId.includes('CACHE')) return 'P2';
  return 'P3';
}

export function triggerAlert(workItem: WorkItem) {
  let strategy: AlertStrategy;
  if (workItem.severity === 'P0') strategy = new P0AlertStrategy();
  else if (workItem.severity === 'P2') strategy = new P2AlertStrategy();
  else strategy = new DefaultAlertStrategy();

  const context = new AlertContext(strategy);
  context.executeStrategy(workItem);
}

// --- State Pattern: Work Item State ---
export class WorkItemStateError extends Error {}

export interface State {
  next(context: WorkItemContext): void;
  close(context: WorkItemContext, rca: RCA): void;
  getStatus(): 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
}

export class OpenState implements State {
  next(context: WorkItemContext) {
    context.setState(new InvestigatingState());
    context.getWorkItem().status = 'INVESTIGATING';
  }
  close(context: WorkItemContext, rca: RCA) {
    throw new WorkItemStateError("Cannot close directly from OPEN");
  }
  getStatus(): 'OPEN' { return 'OPEN'; }
}

export class InvestigatingState implements State {
  next(context: WorkItemContext) {
    context.setState(new ResolvedState());
    context.getWorkItem().status = 'RESOLVED';
  }
  close(context: WorkItemContext, rca: RCA) {
    throw new WorkItemStateError("Cannot close directly from INVESTIGATING");
  }
  getStatus(): 'INVESTIGATING' { return 'INVESTIGATING'; }
}

export class ResolvedState implements State {
  next(context: WorkItemContext) {
    throw new WorkItemStateError("Cannot move to next from RESOLVED. Use close() with RCA.");
  }
  close(context: WorkItemContext, rca: RCA) {
    if (!rca || !rca.rootCauseCategory || !rca.fixApplied) {
      throw new WorkItemStateError("Mandatory RCA is missing or incomplete");
    }
    context.getWorkItem().rca = rca;
    context.setState(new ClosedState());
    context.getWorkItem().status = 'CLOSED';
  }
  getStatus(): 'RESOLVED' { return 'RESOLVED'; }
}

export class ClosedState implements State {
  next(context: WorkItemContext) {
    throw new WorkItemStateError("Already CLOSED");
  }
  close(context: WorkItemContext, rca: RCA) {
    throw new WorkItemStateError("Already CLOSED");
  }
  getStatus(): 'CLOSED' { return 'CLOSED'; }
}

export class WorkItemContext {
  private state: State;
  private workItem: WorkItem;

  constructor(workItem: WorkItem) {
    this.workItem = workItem;
    switch (workItem.status) {
      case 'OPEN': this.state = new OpenState(); break;
      case 'INVESTIGATING': this.state = new InvestigatingState(); break;
      case 'RESOLVED': this.state = new ResolvedState(); break;
      case 'CLOSED': this.state = new ClosedState(); break;
      default: this.state = new OpenState();
    }
  }

  setState(state: State) {
    this.state = state;
    this.workItem.updatedAt = new Date();
  }

  next() {
    this.state.next(this);
  }

  close(rca: RCA) {
    this.state.close(this, rca);
  }

  getWorkItem() {
    return this.workItem;
  }
}

// Helper to create or get WorkItem
export function createOrGetWorkItem(componentId: string): WorkItem {
  // Simple logic to find active
  for (const wi of Array.from(WorkItemsStore.values())) {
    if (wi.componentId === componentId && wi.status !== 'CLOSED') {
      return wi;
    }
  }

  const newWi: WorkItem = {
    id: crypto.randomUUID(),
    componentId,
    status: 'OPEN',
    severity: determineSeverity(componentId),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  WorkItemsStore.set(newWi.id, newWi);
  triggerAlert(newWi);
  return newWi;
}
