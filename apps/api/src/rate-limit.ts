import { createHash } from "node:crypto";
import Redis from "ioredis";

export type LimitResult = { allowed: boolean; remaining: number; retryAfter: number };
const script = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then return {0, 0, math.max(1, redis.call('PTTL', KEYS[1]))} end
count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, tonumber(ARGV[1]) - count, math.max(1, redis.call('PTTL', KEYS[1]))}
`;
export class MemoryLimits {
  private entries = new Map<string, { count: number; expires: number }>();
  private nextSweep = 0;
  constructor(private maximumKeys = 20000) {}
  consume(key: string, limit: number, window: number, now = Date.now()): LimitResult {
    if (now >= this.nextSweep) {
      for (const [k,v] of this.entries) if (v.expires <= now) this.entries.delete(k);
      this.nextSweep = now + 1000;
    }
    let entry = this.entries.get(key);
    if (!entry || entry.expires <= now) {
      if (!entry && this.entries.size >= this.maximumKeys) throw busy();
      entry = { count: 0, expires: now + window }; this.entries.set(key,entry);
    }
    const allowed = entry.count < limit;
    if (allowed) entry.count++;
    return { allowed, remaining: Math.max(0,limit-entry.count), retryAfter: Math.max(1,Math.ceil((entry.expires-now)/1000)) };
  }
  get size() { return this.entries.size; }
}
const memory = new MemoryLimits();
let redis: Redis | undefined;
const prefix = process.env.RATE_LIMIT_PREFIX || "haskins:limits:v1:";
function busy() { return Object.assign(Error("Service busy. Please try again shortly."),{status:503,retryAfter:1}); }
export async function initializeLimits() {
  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV === "production") throw Error("REDIS_URL is required in production for shared API rate limits.");
    return;
  }
  redis = new Redis(process.env.REDIS_URL,{lazyConnect:true,enableOfflineQueue:false,maxRetriesPerRequest:1,connectTimeout:2000,commandTimeout:750,retryStrategy:n=>Math.min(n*200,3000)});
  // No connection strings, raw IPs, email addresses or credentials in logs.
  redis.on("error",()=>{});
  await redis.connect(); await redis.ping();
}
export async function consumeLimit(key: string, limit: number, window: number): Promise<LimitResult> {
  if (!redis) {
    if (process.env.REDIS_URL || process.env.NODE_ENV === "production") throw busy();
    return memory.consume(key,limit,window);
  }
  if (redis.status !== "ready") throw busy();
  try {
    const digest = createHash("sha256").update(key).digest("hex");
    const result = await redis.eval(script,1,prefix+digest,String(limit),String(window)) as number[];
    return {allowed:result[0]===1,remaining:result[1],retryAfter:Math.max(1,Math.ceil(result[2]/1000))};
  } catch { throw busy(); }
}
export async function enforceLimit(key: string, limit = 8, window = 900000) {
  const result = await consumeLimit(key,limit,window);
  if (!result.allowed) throw Object.assign(Error("Too many requests. Please try again later."),{status:429,retryAfter:result.retryAfter});
  return result;
}
export async function closeLimits() { if (redis) { redis.disconnect(); redis=undefined; } }
