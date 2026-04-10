import { isTauri } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";

const DEFAULT_STORAGE_PREFIX = "workspace-launcher";
const STORE_FILENAME = "workspace-launcher.store.json";
const memoryFallback = new Map();
export const APP_STATE_STORAGE_KEY = `${DEFAULT_STORAGE_PREFIX}:app-state`;
export const APP_STATE_STORE_FILENAME = STORE_FILENAME;

let tauriStorePromise = null;

async function getTauriStore() {
  if (!isTauri()) {
    return null;
  }

  if (!tauriStorePromise) {
    tauriStorePromise = Store.load(STORE_FILENAME).catch((error) => {
      tauriStorePromise = null;
      throw error;
    });
  }

  return tauriStorePromise;
}

function getSafeStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    // Ignore and fall back.
  }

  return null;
}

function createFallbackAdapter(storageKey) {
  const storage = getSafeStorage();

  return {
    kind: storage ? "localStorage" : "memory",
    async get() {
      if (storage) {
        return storage.getItem(storageKey);
      }

      return memoryFallback.has(storageKey) ? memoryFallback.get(storageKey) : null;
    },
    async set(value) {
      if (storage) {
        storage.setItem(storageKey, value);
        return;
      }

      memoryFallback.set(storageKey, value);
    },
    async delete() {
      if (storage) {
        storage.removeItem(storageKey);
        return;
      }

      memoryFallback.delete(storageKey);
    },
  };
}

export function createPersistenceStore({
  key,
  namespace = DEFAULT_STORAGE_PREFIX,
  version = 1,
  serialize = JSON.stringify,
  deserialize = JSON.parse,
} = {}) {
  const storageKey = [namespace, key].filter(Boolean).join(":");
  const fallbackAdapter = createFallbackAdapter(storageKey);

  async function read(defaultValue = null) {
    if (isTauri()) {
      try {
        const store = await getTauriStore();
        const value = await store.get(storageKey);
        if (value == null) {
          return defaultValue;
        }

        if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
          return value.value;
        }

        return value;
      } catch {
        // Fall through to fallback adapter.
      }
    }

    const raw = await fallbackAdapter.get();
    if (raw == null || raw === "") {
      return defaultValue;
    }

    try {
      const parsed = deserialize(raw);
      if (parsed && typeof parsed === "object" && Object.prototype.hasOwnProperty.call(parsed, "value")) {
        return parsed.value;
      }

      return parsed;
    } catch {
      return defaultValue;
    }
  }

  async function write(value) {
    const payload = {
      version,
      updatedAt: new Date().toISOString(),
      value,
    };

    if (isTauri()) {
      try {
        const store = await getTauriStore();
        await store.set(storageKey, payload);
        await store.save();
        return payload;
      } catch {
        // Fall through to fallback adapter.
      }
    }

    await fallbackAdapter.set(serialize(payload));
    return payload;
  }

  async function remove() {
    if (isTauri()) {
      try {
        const store = await getTauriStore();
        await store.delete(storageKey);
        await store.save();
        return;
      } catch {
        // Fall through to fallback adapter.
      }
    }

    await fallbackAdapter.delete();
  }

  async function patch(updater) {
    const current = await read(null);
    const nextValue = typeof updater === "function" ? updater(current) : updater;
    return write(nextValue);
  }

  return {
    key: storageKey,
    version,
    read,
    write,
    patch,
    remove,
    isTauriBacked: isTauri,
  };
}

export const appPersistenceStore = createPersistenceStore({
  key: "app-state",
});
