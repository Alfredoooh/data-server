const NodeCache = require('node-cache');

class Cache {
  constructor(ttlSeconds = 3600) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2,
      useClones: false
    });

    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const value = this.cache.get(key);

    if (value !== undefined) {
      this.hits++;
      return value;
    }

    this.misses++;
    return null;
  }

  set(key, value, ttl = null) {
    const success = ttl 
      ? this.cache.set(key, value, ttl)
      : this.cache.set(key, value);

    return success;
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.del(key);
  }

  clear() {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    const keys = this.cache.keys();
    const hitRate = this.hits + this.misses > 0 
      ? (this.hits / (this.hits + this.misses) * 100).toFixed(2)
      : 0;

    return {
      keys: keys.length,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      memory: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  getTTL(key) {
    return this.cache.getTtl(key);
  }

  keys() {
    return this.cache.keys();
  }
}

module.exports = Cache;