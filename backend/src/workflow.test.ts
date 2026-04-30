import { WorkItemContext, WorkItemStateError, createOrGetWorkItem } from './workflow';
import { WorkItemsStore } from './models';

describe('Workflow Engine & RCA Validation', () => {
  beforeEach(() => {
    WorkItemsStore.clear();
  });

  it('should initialize in OPEN state', () => {
    const wi = createOrGetWorkItem('TEST_COMPONENT_1');
    expect(wi.status).toBe('OPEN');
  });

  it('should transition from OPEN to INVESTIGATING to RESOLVED', () => {
    const wi = createOrGetWorkItem('TEST_COMPONENT_2');
    const context = new WorkItemContext(wi);
    
    context.next();
    expect(context.getWorkItem().status).toBe('INVESTIGATING');
    
    context.next();
    expect(context.getWorkItem().status).toBe('RESOLVED');
  });

  it('should reject closing from OPEN state', () => {
    const wi = createOrGetWorkItem('TEST_COMPONENT_3');
    const context = new WorkItemContext(wi);
    
    expect(() => {
      context.close({} as any);
    }).toThrow(WorkItemStateError);
    expect(context.getWorkItem().status).toBe('OPEN');
  });

  it('should reject closing without mandatory RCA fields', () => {
    const wi = createOrGetWorkItem('TEST_COMPONENT_4');
    const context = new WorkItemContext(wi);
    
    context.next(); // to INVESTIGATING
    context.next(); // to RESOLVED
    
    expect(() => {
      // Incomplete RCA object
      context.close({ rootCauseCategory: 'BUG' } as any);
    }).toThrow("Mandatory RCA is missing or incomplete");
  });

  it('should allow closing when valid RCA is provided', () => {
    const wi = createOrGetWorkItem('TEST_COMPONENT_5');
    const context = new WorkItemContext(wi);
    
    context.next(); // to INVESTIGATING
    context.next(); // to RESOLVED
    
    context.close({
      startTime: new Date(),
      endTime: new Date(),
      rootCauseCategory: 'CODE_BUG',
      fixApplied: 'Patched the null pointer exception',
      preventionSteps: 'Added unit tests'
    });
    
    expect(context.getWorkItem().status).toBe('CLOSED');
    expect(context.getWorkItem().rca).toBeDefined();
    expect(context.getWorkItem().rca?.rootCauseCategory).toBe('CODE_BUG');
  });
});
