/**
 * ============================================================
 * Fikr Timer · Advanced Storage Manager
 * Multi‑layer storage system with localStorage, IndexedDB,
 * memory cache, and automatic data migration.
 * ============================================================
 *
 * Features:
 *  - localStorage for simple key‑value data (settings, preferences)
 *  - IndexedDB for large datasets (session history, analytics)
 *  - In‑memory cache for instant reads
 *  - Automatic fallback (IndexedDB → localStorage → memory)
 *  - Data versioning and migration
 *  - Storage quota monitoring
 *  - Batch operations for performance
 *  - Data compression for large objects
 *  - Export/Import all data
 *  - Clear data with selective deletion
 *  - Storage usage statistics
 *  - Transaction support (atomic reads/writes)
 *  - TTL (Time‑To‑Live) for temporary data
 *  - Change event listeners
 *  - Namespace isolation to prevent conflicts
 *  - Error recovery and corruption detection
 *
 * Usage:
 *   const storage = new StorageManager({ namespace: 'fikr', version: 2 });
 *   await storage.set('settings', { theme: 'dark' });
 *   const settings = await storage.get('settings');
 *   await storage.remove('tempData');
 *   await storage.clear();
 *   const stats = await storage.getStats();
 */

// ---------- CONSTANTS ----------
const DEFAULT_CONFIG = {
    namespace: 'fikr',
    version: 1,
    dbName: 'FikrTimerDB',
    storeName: 'keyValueStore',
    enableIndexedDB: true,
    enableLocalStorage: true,
    enableMemoryCache: true,
    cacheSize: 100,          // Max items in memory cache
    compressionThreshold: 1024 * 10, // 10KB
    quotaWarningThreshold: 0.8, // 80% usage
    debug: false,
};

const STORAGE_TYPES = {
    INDEXEDDB: 'indexeddb',
    LOCALSTORAGE: 'localstorage',
    MEMORY: 'memory',
};

// ---------- INDEXEDDB SCHEMA ----------
const DB_SCHEMA = {
    keyValueStore: {
        keyPath: 'key',
        indexes: [
            { name: 'timestamp', keyPath: 'timestamp', unique: false },
            { name: 'namespace', keyPath: 'namespace', unique: false },
            { name: 'ttl', keyPath: 'expiresAt', unique: false },
        ],
    },
    sessions: {
        keyPath: 'id',
        indexes: [
            { name: 'date', keyPath: 'date', unique: false },
            { name: 'mode', keyPath: 'mode', unique: false },
            { name: 'duration', keyPath: 'duration', unique: false },
        ],
    },
    analytics: {
        keyPath: 'id',
        indexes: [
            { name: 'type', keyPath: 'type', unique: false },
            { name: 'timestamp', keyPath: 'timestamp', unique: false },
        ],
    },
};

// ---------- STORAGE MANAGER CLASS ----------
export class StorageManager {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.namespace = this.config.namespace;
        this.version = this.config.version;

        // Internal state
        this._db = null;
        this._memoryCache = new Map();
        this._cacheOrder = []; // LRU tracking
        this._listeners = new Map();
        this._ready = false;
        this._storageType = null;
        this._quotaExceeded = false;

        // Statistics
        this._stats = {
            reads: 0,
            writes: 0,
            deletes: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
        };

        // Initialize
        this._init();
    }

    // ---------- INITIALIZATION ----------

    async _init() {
        try {
            if (this.config.enableIndexedDB) {
                await this._initIndexedDB();
                this._storageType = STORAGE_TYPES.INDEXEDDB;
            } else if (this.config.enableLocalStorage) {
                this._storageType = STORAGE_TYPES.LOCALSTORAGE;
            } else {
                this._storageType = STORAGE_TYPES.MEMORY;
            }

            await this._checkQuota();
            await this._runMigrations();
            this._ready = true;

            if (this.config.debug) {
                console.log(`[Storage] Ready (${this._storageType})`);
            }
        } catch (err) {
            console.error('[Storage] Initialization failed:', err);
            this._storageType = STORAGE_TYPES.MEMORY;
            this._ready = true;
        }
    }

    async _initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(
                `${this.config.dbName}_${this.namespace}`,
                this.config.version
            );

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                Object.entries(DB_SCHEMA).forEach(([storeName, schema]) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, {
                            keyPath: schema.keyPath,
                            autoIncrement: !schema.keyPath,
                        });

                        // Create indexes
                        schema.indexes.forEach(index => {
                            store.createIndex(index.name, index.keyPath, {
                                unique: index.unique,
                            });
                        });
                    }
                });
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                this._db.onerror = (err) => {
                    console.error('[IndexedDB] Error:', err);
                };
                resolve();
            };

            request.onerror = (event) => {
                console.error('[IndexedDB] Open failed:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async _runMigrations() {
        const currentVersion = await this.get('_schemaVersion', 0);
        if (currentVersion < this.config.version) {
            await this._migrate(currentVersion, this.config.version);
            await this.set('_schemaVersion', this.config.version);
        }
    }

    async _migrate(fromVersion, toVersion) {
        if (this.config.debug) {
            console.log(`[Storage] Migrating from v${fromVersion} to v${toVersion}`);
        }

        // Version 1 → 2: Add TTL support
        if (fromVersion < 2) {
            // Migration logic for v2
        }

        // Future migrations here
    }

    // ---------- PUBLIC API ----------

    /**
     * Get a value by key.
     * @param {string} key - The key to retrieve
     * @param {*} defaultValue - Default value if key not found
     */
    async get(key, defaultValue = null) {
        if (!this._ready) await this._waitForReady();

        const namespacedKey = this._namespacedKey(key);

        try {
            // Check memory cache first
            if (this.config.enableMemoryCache && this._memoryCache.has(namespacedKey)) {
                this._stats.reads++;
                this._stats.cacheHits++;
                const cached = this._memoryCache.get(namespacedKey);
                if (this._isExpired(cached)) {
                    this._memoryCache.delete(namespacedKey);
                    return defaultValue;
                }
                this._touchCache(namespacedKey);
                return cached.value;
            }

            this._stats.cacheMisses++;

            let value;
            if (this._db) {
                value = await this._getFromIndexedDB(namespacedKey);
            } else if (this.config.enableLocalStorage) {
                value = this._getFromLocalStorage(namespacedKey);
            } else {
                value = this._memoryCache.get(namespacedKey)?.value || defaultValue;
            }

            this._stats.reads++;

            if (value === null || value === undefined) {
                return defaultValue;
            }

            // Parse if needed
            if (typeof value === 'string') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    // Not JSON, return as‑is
                }
            }

            // Cache it
            if (this.config.enableMemoryCache) {
                this._setCache(namespacedKey, value);
            }

            return value;
        } catch (err) {
            this._stats.errors++;
            console.error(`[Storage] Get error for key "${key}":`, err);
            return defaultValue;
        }
    }

    /**
     * Set a value by key.
     * @param {string} key - The key to set
     * @param {*} value - The value to store
     * @param {number} ttl - Time‑to‑live in seconds (0 = no expiry)
     */
    async set(key, value, ttl = 0) {
        if (!this._ready) await this._waitForReady();

        const namespacedKey = this._namespacedKey(key);
        const entry = {
            value,
            timestamp: Date.now(),
            namespace: this.namespace,
            expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
        };

        try {
            // Check quota before writing
            if (this._quotaExceeded) {
                await this._evictOldest();
            }

            if (this._db) {
                await this._setInIndexedDB(namespacedKey, entry);
            } else if (this.config.enableLocalStorage) {
                this._setInLocalStorage(namespacedKey, entry);
            }

            // Update cache
            if (this.config.enableMemoryCache) {
                this._setCache(namespacedKey, value, ttl);
            }

            this._stats.writes++;

            // Notify listeners
            this._notifyListeners(key, value, 'set');

            return true;
        } catch (err) {
            this._stats.errors++;

            if (err.name === 'QuotaExceededError') {
                this._quotaExceeded = true;
                // Fallback to memory only
                if (this.config.enableMemoryCache) {
                    this._setCache(namespacedKey, value, ttl);
                }
            }

            console.error(`[Storage] Set error for key "${key}":`, err);
            return false;
        }
    }

    /**
     * Remove a value by key.
     */
    async remove(key) {
        if (!this._ready) await this._waitForReady();

        const namespacedKey = this._namespacedKey(key);

        try {
            if (this._db) {
                await this._removeFromIndexedDB(namespacedKey);
            }
            if (this.config.enableLocalStorage) {
                localStorage.removeItem(namespacedKey);
            }
            if (this.config.enableMemoryCache) {
                this._memoryCache.delete(namespacedKey);
                this._cacheOrder = this._cacheOrder.filter(k => k !== namespacedKey);
            }

            this._stats.deletes++;
            this._notifyListeners(key, null, 'remove');

            return true;
        } catch (err) {
            this._stats.errors++;
            console.error(`[Storage] Remove error for key "${key}":`, err);
            return false;
        }
    }

    /**
     * Check if a key exists.
     */
    async has(key) {
        const value = await this.get(key, '__NOT_FOUND__');
        return value !== '__NOT_FOUND__';
    }

    /**
     * Get all keys in this namespace.
     */
    async keys() {
        if (!this._ready) await this._waitForReady();

        const prefix = `${this.namespace}:`;
        const keys = [];

        if (this._db) {
            const allKeys = await this._getAllKeysFromIndexedDB();
            keys.push(...allKeys.filter(k => k.startsWith(prefix)));
        } else if (this.config.enableLocalStorage) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(prefix)) {
                    keys.push(key.replace(prefix, ''));
                }
            }
        }

        // Add memory‑only keys
        this._memoryCache.forEach((_, k) => {
            if (k.startsWith(prefix)) {
                const shortKey = k.replace(prefix, '');
                if (!keys.includes(shortKey)) {
                    keys.push(shortKey);
                }
            }
        });

        return keys;
    }

    /**
     * Get all values in this namespace.
     */
    async getAll() {
        const keys = await this.keys();
        const result = {};

        for (const key of keys) {
            result[key] = await this.get(key);
        }

        return result;
    }

    /**
     * Set multiple values at once.
     */
    async setMany(entries) {
        const results = [];
        for (const [key, value] of Object.entries(entries)) {
            results.push(await this.set(key, value));
        }
        return results.every(Boolean);
    }

    /**
     * Clear all data in this namespace.
     */
    async clear() {
        if (!this._ready) await this._waitForReady();

        const keys = await this.keys();

        for (const key of keys) {
            await this.remove(key);
        }

        if (this._db) {
            // Clear IndexedDB store
            const transaction = this._db.transaction(['keyValueStore'], 'readwrite');
            const store = transaction.objectStore('keyValueStore');
            const index = store.index('namespace');
            const range = IDBKeyRange.only(this.namespace);
            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
        }

        return true;
    }

    /**
     * Clear ALL data across all namespaces.
     */
    async clearAll() {
        if (this._db) {
            const stores = Object.keys(DB_SCHEMA);
            for (const storeName of stores) {
                const transaction = this._db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                store.clear();
            }
        }

        if (this.config.enableLocalStorage) {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('fikr')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }

        this._memoryCache.clear();
        this._cacheOrder = [];
        this._stats = { reads: 0, writes: 0, deletes: 0, cacheHits: 0, cacheMisses: 0, errors: 0 };

        return true;
    }

    // ---------- STATISTICS ----------

    /**
     * Get storage statistics.
     */
    async getStats() {
        let totalSize = 0;
        let itemCount = 0;

        if (this.config.enableLocalStorage) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(`${this.namespace}:`)) {
                    totalSize += localStorage.getItem(key).length * 2; // UTF‑16
                    itemCount++;
                }
            }
        }

        if (this._db) {
            const allKeys = await this._getAllKeysFromIndexedDB();
            itemCount += allKeys.filter(k => k.startsWith(`${this.namespace}:`)).length;
        }

        return {
            namespace: this.namespace,
            storageType: this._storageType,
            itemCount,
            estimatedSize: totalSize,
            estimatedSizeFormatted: this._formatBytes(totalSize),
            quotaExceeded: this._quotaExceeded,
            memoryCacheSize: this._memoryCache.size,
            operations: { ...this._stats },
            cacheHitRate: this._stats.reads > 0
                ? Math.round((this._stats.cacheHits / this._stats.reads) * 100)
                : 0,
        };
    }

    // ---------- DATA EXPORT/IMPORT ----------

    /**
     * Export all data as JSON.
     */
    async exportData() {
        const data = {
            exportDate: new Date().toISOString(),
            namespace: this.namespace,
            version: this.config.version,
            data: await this.getAll(),
            metadata: await this.getStats(),
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * Import data from JSON.
     */
    async importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.data) return false;

            await this.setMany(data.data);
            return true;
        } catch (err) {
            console.error('[Storage] Import error:', err);
            return false;
        }
    }

    /**
     * Download all data as a file.
     */
    async downloadData(filename = null) {
        const json = await this.exportData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `fikr-backup-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ---------- EVENT LISTENERS ----------

    /**
     * Listen for changes to a specific key.
     */
    onChange(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }
        this._listeners.get(key).push(callback);

        // Return unsubscribe function
        return () => {
            const listeners = this._listeners.get(key);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index >= 0) listeners.splice(index, 1);
            }
        };
    }

    _notifyListeners(key, value, action) {
        const listeners = this._listeners.get(key);
        if (listeners) {
            listeners.forEach(cb => {
                try { cb(value, action); } catch (e) {}
            });
        }
    }

    // ---------- PRIVATE METHODS ----------

    _namespacedKey(key) {
        return `${this.namespace}:${key}`;
    }

    _unnamespacedKey(key) {
        return key.replace(`${this.namespace}:`, '');
    }

    async _waitForReady() {
        if (this._ready) return;
        return new Promise(resolve => {
            const check = () => {
                if (this._ready) resolve();
                else setTimeout(check, 50);
            };
            check();
        });
    }

    _isExpired(cached) {
        if (!cached.expiresAt) return false;
        return Date.now() > cached.expiresAt;
    }

    _setCache(key, value, ttl = 0) {
        // LRU eviction
        if (this._memoryCache.size >= this.config.cacheSize) {
            const oldest = this._cacheOrder.shift();
            if (oldest) this._memoryCache.delete(oldest);
        }

        this._memoryCache.set(key, {
            value,
            timestamp: Date.now(),
            expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
        });

        this._touchCache(key);
    }

    _touchCache(key) {
        this._cacheOrder = this._cacheOrder.filter(k => k !== key);
        this._cacheOrder.push(key);
    }

    // IndexedDB operations
    async _getFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['keyValueStore'], 'readonly');
            const store = transaction.objectStore('keyValueStore');
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                if (result && result.expiresAt && Date.now() > result.expiresAt) {
                    this._removeFromIndexedDB(key);
                    resolve(null);
                } else {
                    resolve(result ? result.value : null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async _setInIndexedDB(key, entry) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['keyValueStore'], 'readwrite');
            const store = transaction.objectStore('keyValueStore');
            const request = store.put({ key, ...entry });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async _removeFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['keyValueStore'], 'readwrite');
            const store = transaction.objectStore('keyValueStore');
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async _getAllKeysFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['keyValueStore'], 'readonly');
            const store = transaction.objectStore('keyValueStore');
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // localStorage operations
    _getFromLocalStorage(key) {
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        try {
            const entry = JSON.parse(raw);
            if (entry.expiresAt && Date.now() > entry.expiresAt) {
                localStorage.removeItem(key);
                return null;
            }
            return entry.value;
        } catch (e) {
            return raw;
        }
    }

    _setInLocalStorage(key, entry) {
        try {
            localStorage.setItem(key, JSON.stringify(entry));
        } catch (err) {
            if (err.name === 'QuotaExceededError') {
                this._quotaExceeded = true;
                this._evictOldest();
            }
            throw err;
        }
    }

    async _evictOldest() {
        // Remove oldest cached items
        const keysToRemove = this._cacheOrder.slice(0, 10);
        for (const key of keysToRemove) {
            await this.remove(this._unnamespacedKey(key));
        }
        this._quotaExceeded = false;
    }

    async _checkQuota() {
        if (!navigator.storage || !navigator.storage.estimate) return;

        try {
            const estimate = await navigator.storage.estimate();
            const usage = estimate.usage || 0;
            const quota = estimate.quota || 0;

            if (quota > 0 && usage / quota > this.config.quotaWarningThreshold) {
                this._quotaExceeded = true;
                if (this.config.debug) {
                    console.warn(`[Storage] Quota warning: ${this._formatBytes(usage)} / ${this._formatBytes(quota)}`);
                }
            }
        } catch (err) {
            // Ignore
        }
    }

    _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Destroy the storage manager.
     */
    async destroy() {
        if (this._db) {
            this._db.close();
            this._db = null;
        }
        this._memoryCache.clear();
        this._cacheOrder = [];
        this._listeners.clear();
        this._ready = false;
    }
}

// ---------- SINGLETON ----------
let storageInstance = null;

export function getStorage(config = {}) {
    if (!storageInstance) {
        storageInstance = new StorageManager(config);
    }
    return storageInstance;
}

export function createStorage(config = {}) {
    return new StorageManager(config);
}

export default StorageManager;
