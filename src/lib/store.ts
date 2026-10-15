import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Tiny key/value + hash store. Uses Upstash Redis when its env vars exist
 * (Vercel Marketplace sets KV_REST_API_*), otherwise an in-process map so the
 * whole game runs locally with zero setup.
 */
export interface Store {
  kind: "redis" | "memory";
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hdel(key: string, field: string): Promise<void>;
  del(...keys: string[]): Promise<void>;
  hgetall<T>(key: string): Promise<Record<string, T>>;
  hincrby(key: string, field: string, by: number): Promise<void>;
  /** Set only if absent; true when this caller won. Used as a cheap cross-instance lock. */
  setNX(key: string, ttlSeconds: number): Promise<boolean>;
  /** One round trip: several GETs and HGETALLs. */
  readMany(gets: string[], hashes: string[]): Promise<{ gets: unknown[]; hashes: Record<string, unknown>[] }>;
}

function redisStore(url: string, token: string): Store {
  const redis = new Redis({ url, token });
  return {
    kind: "redis",
    async get<T>(key: string) {
      return (await redis.get<T>(key)) ?? null;
    },
    async set(key, value) {
      await redis.set(key, value);
    },
    async hset(key, field, value) {
      await redis.hset(key, { [field]: value });
    },
    async hget<T>(key: string, field: string) {
      return (await redis.hget<T>(key, field)) ?? null;
    },
    async hdel(key, field) {
      await redis.hdel(key, field);
    },
    async del(...keys) {
      if (keys.length) await redis.del(...keys);
    },
    async hgetall<T>(key: string) {
      return ((await redis.hgetall<Record<string, T>>(key)) ?? {}) as Record<string, T>;
    },
    async hincrby(key, field, by) {
      await redis.hincrby(key, field, by);
    },
    async setNX(key, ttlSeconds) {
      return (await redis.set(key, 1, { nx: true, ex: ttlSeconds })) === "OK";
    },
    async readMany(gets, hashes) {
      const p = redis.pipeline();
      for (const k of gets) p.get(k);
      for (const h of hashes) p.hgetall(h);
      const res = (await p.exec()) as unknown[];
      return {
        gets: res.slice(0, gets.length).map((v) => v ?? null),
        hashes: res.slice(gets.length).map((v) => (v ?? {}) as Record<string, unknown>),
      };
    },
  };
}

type Mem = { kv: Map<string, unknown>; h: Map<string, Map<string, unknown>>; locks: Map<string, number> };

function memoryStore(): Store {
  const g = globalThis as unknown as { __okMem?: Mem };
  g.__okMem ??= { kv: new Map(), h: new Map(), locks: new Map() };
  const mem = g.__okMem;
  mem.locks ??= new Map();
  const clone = <T,>(v: T): T => (v === undefined ? v : structuredClone(v));
  const hash = (k: string) => {
    let m = mem.h.get(k);
    if (!m) mem.h.set(k, (m = new Map()));
    return m;
  };
  const all = (k: string) => Object.fromEntries([...hash(k)].map(([f, v]) => [f, clone(v)]));
  return {
    kind: "memory",
    async get<T>(key: string) {
      return (clone(mem.kv.get(key)) as T) ?? null;
    },
    async set(key, value) {
      mem.kv.set(key, clone(value));
    },
    async hset(key, field, value) {
      hash(key).set(field, clone(value));
    },
    async hget<T>(key: string, field: string) {
      return (clone(hash(key).get(field)) as T) ?? null;
    },
    async hdel(key, field) {
      hash(key).delete(field);
    },
    async del(...keys) {
      for (const k of keys) {
        mem.kv.delete(k);
        mem.h.delete(k);
      }
    },
    async hgetall<T>(key: string) {
      return all(key) as Record<string, T>;
    },
    async hincrby(key, field, by) {
      const m = hash(key);
      m.set(field, (Number(m.get(field)) || 0) + by);
    },
    async setNX(key, ttlSeconds) {
      const now = Date.now();
      if (mem.locks.size > 2000) for (const [k, t] of mem.locks) if (t < now) mem.locks.delete(k);
      const until = mem.locks.get(key);
      if (until && until > now) return false;
      mem.locks.set(key, now + ttlSeconds * 1000);
      return true;
    },
    async readMany(gets, hashes) {
      return { gets: gets.map((k) => clone(mem.kv.get(k)) ?? null), hashes: hashes.map(all) };
    },
  };
}

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const store: Store = url && token ? redisStore(url, token) : memoryStore();
