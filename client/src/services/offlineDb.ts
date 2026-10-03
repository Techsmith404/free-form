import { Item, Notebook, FormTemplate, Reminder, ConflictRecord, SyncMutation, MutationType } from '../types';

const DB_NAME = 'freeform_local_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notebooks')) {
        db.createObjectStore('notebooks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reminders')) {
        db.createObjectStore('reminders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('conflicts')) {
        db.createObjectStore('conflicts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ==========================================
// Items
// ==========================================
export async function dbGetItems(): Promise<Item[]> {
  const db = await getDb();
  const tx = db.transaction('items', 'readonly');
  const store = tx.objectStore('items');
  return promisifyRequest<Item[]>(store.getAll());
}

export async function dbGetItem(id: string): Promise<Item | undefined> {
  const db = await getDb();
  const tx = db.transaction('items', 'readonly');
  const store = tx.objectStore('items');
  return promisifyRequest<Item | undefined>(store.get(id));
}

export async function dbPutItem(item: Item): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('items', 'readwrite');
  const store = tx.objectStore('items');
  store.put(item);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbPutItems(items: Item[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('items', 'readwrite');
  const store = tx.objectStore('items');
  for (const item of items) {
    store.put(item);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDeleteItem(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('items', 'readwrite');
  const store = tx.objectStore('items');
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// Notebooks
// ==========================================
export async function dbGetNotebooks(): Promise<Notebook[]> {
  const db = await getDb();
  const tx = db.transaction('notebooks', 'readonly');
  const store = tx.objectStore('notebooks');
  return promisifyRequest<Notebook[]>(store.getAll());
}

export async function dbPutNotebook(notebook: Notebook): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('notebooks', 'readwrite');
  const store = tx.objectStore('notebooks');
  store.put(notebook);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbPutNotebooks(notebooks: Notebook[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('notebooks', 'readwrite');
  const store = tx.objectStore('notebooks');
  for (const nb of notebooks) {
    store.put(nb);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDeleteNotebook(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('notebooks', 'readwrite');
  const store = tx.objectStore('notebooks');
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// Templates
// ==========================================
export async function dbGetTemplates(): Promise<FormTemplate[]> {
  const db = await getDb();
  const tx = db.transaction('templates', 'readonly');
  const store = tx.objectStore('templates');
  return promisifyRequest<FormTemplate[]>(store.getAll());
}

export async function dbPutTemplate(template: FormTemplate): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('templates', 'readwrite');
  const store = tx.objectStore('templates');
  store.put(template);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbPutTemplates(templates: FormTemplate[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('templates', 'readwrite');
  const store = tx.objectStore('templates');
  for (const tpl of templates) {
    store.put(tpl);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDeleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('templates', 'readwrite');
  const store = tx.objectStore('templates');
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// Reminders
// ==========================================
export async function dbGetReminders(): Promise<Reminder[]> {
  const db = await getDb();
  const tx = db.transaction('reminders', 'readonly');
  const store = tx.objectStore('reminders');
  return promisifyRequest<Reminder[]>(store.getAll());
}

export async function dbPutReminder(reminder: Reminder): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('reminders', 'readwrite');
  const store = tx.objectStore('reminders');
  store.put(reminder);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbPutReminders(reminders: Reminder[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('reminders', 'readwrite');
  const store = tx.objectStore('reminders');
  for (const rem of reminders) {
    store.put(rem);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDeleteReminder(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('reminders', 'readwrite');
  const store = tx.objectStore('reminders');
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// Conflicts
// ==========================================
export async function dbGetConflicts(): Promise<ConflictRecord[]> {
  const db = await getDb();
  const tx = db.transaction('conflicts', 'readonly');
  const store = tx.objectStore('conflicts');
  const rows = await promisifyRequest<ConflictRecord[]>(store.getAll());
  return rows.filter((r) => r.status === 'unresolved');
}

export async function dbPutConflict(conflict: ConflictRecord): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('conflicts', 'readwrite');
  const store = tx.objectStore('conflicts');
  store.put(conflict);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbPutConflicts(conflicts: ConflictRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('conflicts', 'readwrite');
  const store = tx.objectStore('conflicts');
  for (const c of conflicts) {
    store.put(c);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDeleteConflict(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('conflicts', 'readwrite');
  const store = tx.objectStore('conflicts');
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// Settings
// ==========================================
export async function dbGetSetting(key: string): Promise<any> {
  const db = await getDb();
  const tx = db.transaction('settings', 'readonly');
  const store = tx.objectStore('settings');
  const entry = await promisifyRequest<{ key: string; value: any } | undefined>(store.get(key));
  return entry?.value;
}

export async function dbPutSetting(key: string, value: any): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('settings', 'readwrite');
  const store = tx.objectStore('settings');
  store.put({ key, value });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// Outbox (Offline Mutation Queue)
// ==========================================
export async function dbQueueMutation(type: MutationType, data: any, baseTimestamp?: string): Promise<SyncMutation> {
  const db = await getDb();
  const mutation: SyncMutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    data,
    client_timestamp: new Date().toISOString(),
    base_timestamp: baseTimestamp
  };

  const tx = db.transaction('outbox', 'readwrite');
  const store = tx.objectStore('outbox');
  store.put(mutation);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(mutation);
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetPendingMutations(): Promise<SyncMutation[]> {
  const db = await getDb();
  const tx = db.transaction('outbox', 'readonly');
  const store = tx.objectStore('outbox');
  return promisifyRequest<SyncMutation[]>(store.getAll());
}

export async function dbRemovePendingMutations(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('outbox', 'readwrite');
  const store = tx.objectStore('outbox');
  for (const id of ids) {
    store.delete(id);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// Meta Sync State
// ==========================================
export async function dbGetLastSyncTime(): Promise<string | null> {
  const db = await getDb();
  const tx = db.transaction('meta', 'readonly');
  const store = tx.objectStore('meta');
  const res = await promisifyRequest<{ key: string; value: string } | undefined>(store.get('last_sync_timestamp'));
  return res?.value ?? null;
}

export async function dbSetLastSyncTime(timestamp: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('meta', 'readwrite');
  const store = tx.objectStore('meta');
  store.put({ key: 'last_sync_timestamp', value: timestamp });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetDeviceName(): Promise<string> {
  const db = await getDb();
  const tx = db.transaction('meta', 'readonly');
  const store = tx.objectStore('meta');
  const res = await promisifyRequest<{ key: string; value: string } | undefined>(store.get('device_name'));
  if (res?.value) return res.value;

  const defaultName = typeof navigator !== 'undefined'
    ? `${navigator.userAgent.includes('Android') ? 'Android Device' : navigator.userAgent.includes('Mobile') ? 'Mobile Phone' : 'Desktop'}`
    : 'Free Form Client';
  return defaultName;
}
