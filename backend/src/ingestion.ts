import Redis from 'ioredis';
import mongoose from 'mongoose';
import { SignalModel, WorkItemsStore } from './models';
import { createOrGetWorkItem } from './workflow';
import crypto from 'crypto';

// In-memory fallback if Redis is not available
const memoryRateLimit = new Map<string, { count: number, resetAt: number }>();
const DEBOUNCE_WINDOW_SEC = 10;
const RATE_LIMIT_MAX = 10000; // max signals per sec per IP

let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    retryStrategy() {
      return null; // Stop retrying, fallback to in-memory
    }
  });
  redis.on('error', () => { redis = null; });
} catch (e) {
  redis = null;
}

export async function checkRateLimit(ip: string): Promise<boolean> {
  const now = Date.now();
  if (redis) {
    const key = `ratelimit:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 1);
    }
    return current <= RATE_LIMIT_MAX;
  } else {
    let limit = memoryRateLimit.get(ip);
    if (!limit || limit.resetAt < now) {
      limit = { count: 0, resetAt: now + 1000 };
    }
    limit.count += 1;
    memoryRateLimit.set(ip, limit);
    return limit.count <= RATE_LIMIT_MAX;
  }
}

// In-memory buffer for async processing
const signalBuffer: any[] = [];
const BATCH_SIZE = 500;

export async function processSignal(signal: any) {
  const { componentId, type, payload } = signal;
  
  // 1. Debouncing
  let shouldCreateWorkItem = true;
  if (redis) {
    const debounceKey = `debounce:${componentId}`;
    const count = await redis.incr(debounceKey);
    if (count === 1) {
      await redis.expire(debounceKey, DEBOUNCE_WINDOW_SEC);
    } else {
      shouldCreateWorkItem = false;
    }
  } else {
    // In memory fallback for debounce
    const limit = memoryRateLimit.get(`debounce:${componentId}`);
    if (!limit || limit.resetAt < Date.now()) {
      memoryRateLimit.set(`debounce:${componentId}`, { count: 1, resetAt: Date.now() + (DEBOUNCE_WINDOW_SEC * 1000) });
    } else {
      shouldCreateWorkItem = false;
    }
  }

  let workItemId = null;
  if (shouldCreateWorkItem) {
    const wi = createOrGetWorkItem(componentId);
    workItemId = wi.id;
  } else {
    // find active work item
    const activeWi = Array.from(WorkItemsStore.values()).find(wi => wi.componentId === componentId && wi.status !== 'CLOSED');
    workItemId = activeWi ? activeWi.id : null;
  }

  // 2. Add to buffer for async batch insert
  signalBuffer.push({
    componentId,
    type,
    payload,
    timestamp: new Date(),
    workItemId
  });

  if (signalBuffer.length >= BATCH_SIZE) {
    flushSignals(); // Non-blocking fire and forget
  }
}

// Periodically flush buffer
setInterval(flushSignals, 1000);

export async function flushSignals() {
  if (signalBuffer.length === 0) return;
  const batch = signalBuffer.splice(0, signalBuffer.length);
  
  // Retry logic for MongoDB write
  let retries = 3;
  while (retries > 0) {
    try {
      if (mongoose.connection.readyState === 1) {
        await SignalModel.insertMany(batch, { ordered: false });
        return;
      } else {
        throw new Error("Mongo not connected");
      }
    } catch (e) {
      retries--;
      if (retries === 0) {
        console.error("Failed to insert signals to Data Lake after 3 retries", e);
        // In a real app, send to DLQ (Dead Letter Queue)
      } else {
        await new Promise(res => setTimeout(res, 500)); // wait before retry
      }
    }
  }
}

// Expose throughput metrics
let signalsProcessedLast5Sec = 0;
export function incrementThroughput() {
  signalsProcessedLast5Sec++;
}

setInterval(() => {
  console.log(`[METRICS] Throughput: ${signalsProcessedLast5Sec / 5} signals/sec`);
  signalsProcessedLast5Sec = 0;
}, 5000);
