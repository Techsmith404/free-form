import {
  dbGetPendingMutations,
  dbRemovePendingMutations,
  dbGetLastSyncTime,
  dbSetLastSyncTime,
  dbGetDeviceName,
  dbPutItems,
  dbPutNotebooks,
  dbPutTemplates,
  dbPutReminders,
  dbPutConflicts,
  dbGetConflicts,
  dbPutSetting
} from './offlineDb';
import { api } from '../api';
import { ConflictRecord, SyncResponseBody } from '../types';

export interface SyncState {
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  conflicts: ConflictRecord[];
  error: string | null;
}

type SyncListener = (state: SyncState) => void;

class SyncService {
  private isSyncing = false;
  private lastSyncTime: string | null = null;
  private pendingCount = 0;
  private conflicts: ConflictRecord[] = [];
  private error: string | null = null;
  private listeners = new Set<SyncListener>();
  private intervalId: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.performSync();
      });

      // Auto periodic sync every 30s when online
      this.intervalId = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.performSync().catch(() => {});
        }
      }, 30000);

      // Load initial local state
      this.refreshLocalStats();
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public getState(): SyncState {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingCount: this.pendingCount,
      conflicts: this.conflicts,
      error: this.error
    };
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  public async refreshLocalStats() {
    try {
      const pending = await dbGetPendingMutations();
      this.pendingCount = pending.length;
      this.lastSyncTime = await dbGetLastSyncTime();
      this.conflicts = await dbGetConflicts();
      this.notify();
    } catch {}
  }

  public async performSync(): Promise<SyncResponseBody | null> {
    if (this.isSyncing) return null;
    this.isSyncing = true;
    this.error = null;
    this.notify();

    try {
      const mutations = await dbGetPendingMutations();
      const lastSyncTime = await dbGetLastSyncTime();
      const deviceName = await dbGetDeviceName();

      const response = await api.sync({
        device_name: deviceName,
        last_sync_timestamp: lastSyncTime || undefined,
        mutations
      });

      if (response && response.success) {
        // 1. Clear processed outbox mutations
        if (response.processed_mutation_ids?.length > 0) {
          await dbRemovePendingMutations(response.processed_mutation_ids);
        }

        // 2. Apply server changes to local IndexedDB
        if (response.server_changes) {
          const { items, notebooks, templates, reminders, settings } = response.server_changes;
          if (items && items.length > 0) await dbPutItems(items);
          if (notebooks && notebooks.length > 0) await dbPutNotebooks(notebooks);
          if (templates && templates.length > 0) await dbPutTemplates(templates);
          if (reminders && reminders.length > 0) await dbPutReminders(reminders);
          if (settings) {
            for (const [k, v] of Object.entries(settings)) {
              await dbPutSetting(k, v);
            }
          }
        }

        // 3. Save new conflicts
        if (response.conflicts && response.conflicts.length > 0) {
          await dbPutConflicts(response.conflicts);
        }

        // 4. Update sync timestamp
        if (response.server_time) {
          await dbSetLastSyncTime(response.server_time);
          this.lastSyncTime = response.server_time;
        }

        await this.refreshLocalStats();

        // Dispatch global event for UI re-render
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('freeform:sync-complete', { detail: response }));
        }

        return response;
      }
      return null;
    } catch (err: any) {
      this.error = err.message || 'Sync failed';
      await this.refreshLocalStats();
      return null;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  public setConflicts(conflicts: ConflictRecord[]) {
    this.conflicts = conflicts;
    dbPutConflicts(conflicts).catch(() => {});
    this.notify();
  }
}

export const syncService = new SyncService();
