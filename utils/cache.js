const NodeCache = require('node-cache');
const logger = require('./logger');

class Cache {
  constructor(ttlSeconds = 3600) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2,
      useClones: false
    });

    this.hits = 0;
    this.misses = 0;

    // Log eventos do cache
    this.cache.on('set', (key, value) => {
      logger.debug(`Cache SET: ${key}`);
    });

    this.cache.on('del', (key, value) => {
      logger.debug(`Cache DEL: ${key}`);
    });

    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache EXPIRED: ${key}`);
    });
  }

  // Obter valor do cache
  get(key) {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      this.hits++;
      logger.debug(`Cache HIT: ${key}`);
      return value;
    }
    
    this.misses++;
    logger.debug(`Cache MISS: ${key}`);
    return null;
  }

  // Definir valor no cache
  set(key, value, ttl = null) {
    const success = ttl 
      ? this.cache.set(key, value, ttl)
      : this.cache.set(key, value);
    
    if (success) {
      logger.debug(`Cache SET successful: ${key}`);
    } else {
      logger.warn(`Cache SET failed: ${key}`);
    }
    
    return success;
  }

  // Verificar se chave existe
  has(key) {
    return this.cache.has(key);
  }

  // Remover chave
  delete(key) {
    return this.cache.del(key);
  }

  // Limpar todo o cache
  clear() {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
    logger.info('Cache cleared');
  }

  // Obter estatísticas
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

  // Obter múltiplos valores
  mget(keys) {
    return keys.map(key => ({
      key,
      value: this.get(key)
    }));
  }

  // Definir múltiplos valores
  mset(items) {
    items.forEach(({ key, value, ttl }) => {
      this.set(key, value, ttl);
    });
  }

  // Obter TTL de uma chave
  getTTL(key) {
    return this.cache.getTtl(key);
  }

  // Listar todas as chaves
  keys() {
    return this.cache.keys();
  }
}

module.exports = Cache;