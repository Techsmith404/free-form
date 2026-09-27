import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  Notebook,
  Item,
  FormTemplate,
  Tag,
  ItemType,
  CounterHistoryEntry,
  Timer,
  Reminder,
  AppSettings,
  ConflictRecord,
  SyncRequestBody,
  SyncResponseBody
} from '../types/index.js';
import {
  dbGetItems,
  dbGetItem,
  dbPutItem,
  dbPutItems,
  dbDeleteItem,
  dbGetNotebooks,
  dbPutNotebook,
  dbPutNotebooks,
  dbDeleteNotebook,
  dbGetTemplates,
  dbPutTemplate,
  dbPutTemplates,
  dbDeleteTemplate,
  dbGetReminders,
  dbPutReminder,
  dbPutReminders,
  dbDeleteReminder,
  dbGetSetting,
  dbPutSetting,
  dbGetConflicts,
  dbPutConflict,
  dbDeleteConflict,
  dbQueueMutation
} from '../services/offlineDb.js';
import { syncService } from '../services/syncService.js';

const SERVER_URL_KEY = 'freeform_server_url';
let cachedServerUrl: string = '';

export async function initServerUrl(): Promise<string> {
  if (typeof window !== 'undefined') {
    try {
      const res = await Preferences.get({ key: SERVER_URL_KEY });
      if (res.value) {
        cachedServerUrl = res.value.replace(/\/+$/, '');
        return cachedServerUrl;
      }
    } catch {}
    const local = localStorage.getItem(SERVER_URL_KEY);
    if (local) {
      cachedServerUrl = local.replace(/\/+$/, '');
      return cachedServerUrl;
    }
  }
  return '';
}

export function getServerUrl(): string {
  if (cachedServerUrl) return cachedServerUrl;
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(SERVER_URL_KEY);
    if (local) {
      cachedServerUrl = local.replace(/\/+$/, '');
      return cachedServerUrl;
    }
  }
  return '';
}

export async function setServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  cachedServerUrl = clean;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SERVER_URL_KEY, clean);
    } catch {}
    try {
      await Preferences.set({ key: SERVER_URL_KEY, value: clean });
    } catch {}
  }
}

export function apiUrl(endpoint: string): string {
  const base = getServerUrl();
  const cleanEp = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  return base ? `${base}/api${cleanEp}` : `/api${cleanEp}`;
}

export function getWebSocketUrl(): string {
  const base = getServerUrl();
  if (base) {
    const isHttps = base.startsWith('https://');
    const host = base.replace(/^https?:\/\//, '');
    return `${isHttps ? 'wss:' : 'ws:'}//${host}/api/ws`;
  }
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  return `${isHttps ? 'wss:' : 'ws:'}//${host}/api/ws`;
}

export function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const base = getServerUrl();
  return base ? `${base}${url}` : url;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================================
// NOTEBOOKS API (Offline-First)
// =============================================================================

export async function fetchNotebooks(): Promise<Notebook[]> {
  try {
    const res = await fetch(apiUrl('/notebooks'));
    if (res.ok) {
      const serverNotebooks: Notebook[] = await res.json();
      await dbPutNotebooks(serverNotebooks);
      return serverNotebooks;
    }
  } catch {}
  return dbGetNotebooks();
}

export async function createNotebook(data: Partial<Notebook>): Promise<Notebook> {
  const now = new Date().toISOString();
  const notebook: Notebook = {
    id: data.id || generateUUID(),
    name: data.name || 'Untitled Notebook',
    description: data.description || '',
    color: data.color || '#22c55e',
    icon: data.icon || 'folder',
    parent_id: data.parent_id ?? null,
    default_template_id: data.default_template_id ?? null,
    view_mode: data.view_mode || 'grid',
    sort_order: data.sort_order || 0,
    hide_from_all: data.hide_from_all ? 1 : 0,
    created_at: data.created_at || now,
    updated_at: now
  };

  await dbPutNotebook(notebook);
  await dbQueueMutation('create_notebook', notebook);
  syncService.performSync().catch(() => {});

  return notebook;
}

export async function updateNotebook(id: string, data: Partial<Notebook>): Promise<Notebook> {
  const existingList = await dbGetNotebooks();
  const existing = existingList.find((n) => n.id === id);
  const now = new Date().toISOString();

  const updated: Notebook = {
    ...(existing || {}),
    ...data,
    id,
    name: data.name ?? existing?.name ?? 'Notebook',
    description: data.description ?? existing?.description ?? '',
    color: data.color ?? existing?.color ?? '#22c55e',
    icon: data.icon ?? existing?.icon ?? 'folder',
    parent_id: data.parent_id !== undefined ? data.parent_id : existing?.parent_id ?? null,
    default_template_id: data.default_template_id !== undefined ? data.default_template_id : existing?.default_template_id ?? null,
    view_mode: data.view_mode ?? existing?.view_mode ?? 'grid',
    sort_order: data.sort_order ?? existing?.sort_order ?? 0,
    hide_from_all: data.hide_from_all !== undefined ? (data.hide_from_all ? 1 : 0) : existing?.hide_from_all ?? 0,
    created_at: existing?.created_at || now,
    updated_at: now
  };

  await dbPutNotebook(updated);
  await dbQueueMutation('update_notebook', { ...data, id }, existing?.updated_at);
  syncService.performSync().catch(() => {});

  return updated;
}

export async function deleteNotebook(id: string): Promise<void> {
  await dbDeleteNotebook(id);
  await dbQueueMutation('delete_notebook', { id });
  syncService.performSync().catch(() => {});
}

// =============================================================================
// ITEMS API (Offline-First)
// =============================================================================

export interface ItemQueryParams {
  notebook_id?: string;
  type?: ItemType;
  is_favorite?: boolean;
  is_archived?: boolean;
  include_hidden?: boolean;
  search?: string;
  tag?: string;
}

export async function fetchItems(params?: ItemQueryParams): Promise<Item[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.notebook_id) searchParams.set('notebook_id', params.notebook_id);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.is_favorite) searchParams.set('is_favorite', '1');
    if (params?.is_archived) searchParams.set('is_archived', '1');
    if (params?.include_hidden) searchParams.set('include_hidden', '1');
    if (params?.search) searchParams.set('search', params.search);
    if (params?.tag) searchParams.set('tag', params.tag);

    const res = await fetch(`${apiUrl('/items')}?${searchParams.toString()}`);
    if (res.ok) {
      const serverItems: Item[] = await res.json();
      await dbPutItems(serverItems);
      return serverItems;
    }
  } catch {}

  // Local filtering from IndexedDB
  const all = await dbGetItems();
  const notebooks = await dbGetNotebooks();
  const hiddenNbMap = new Map<string, boolean>();
  for (const nb of notebooks) {
    if (nb.hide_from_all) hiddenNbMap.set(nb.id, true);
  }

  return all.filter((item) => {
    if (params?.is_archived) {
      if (!item.is_archived) return false;
    } else {
      if (item.is_archived) return false;
    }

    if (params?.notebook_id) {
      if (params.notebook_id === 'uncategorized') {
        if (item.notebook_id) return false;
      } else if (item.notebook_id !== params.notebook_id) {
        return false;
      }
    } else {
      // Global feed filtering
      if (!params?.include_hidden) {
        if (item.hide_from_all) return false;
        if (item.notebook_id && hiddenNbMap.get(item.notebook_id)) return false;
      }
    }

    if (params?.type && item.type !== params.type) return false;
    if (params?.is_favorite && !item.is_favorite) return false;

    if (params?.search) {
      const q = params.search.toLowerCase();
      const titleMatch = item.title.toLowerCase().includes(q);
      const contentMatch = (item.content || '').toLowerCase().includes(q);
      if (!titleMatch && !contentMatch) return false;
    }

    return true;
  });
}

export async function fetchItem(id: string): Promise<Item> {
  try {
    const res = await fetch(`${apiUrl('/items')}/${id}`);
    if (res.ok) {
      const item: Item = await res.json();
      await dbPutItem(item);
      return item;
    }
  } catch {}

  const local = await dbGetItem(id);
  if (!local) throw new Error('Item not found');
  return local;
}

export async function createItem(data: Partial<Item>): Promise<Item> {
  const now = new Date().toISOString();
  const id = data.id || generateUUID();

  let content = data.content || '';
  if (data.type === 'form_entry' && data.metadata?.values) {
    // Generate basic markdown if offline
    if (!content) {
      content = `# ${data.title || 'Form Entry'}\n\n`;
      for (const [k, v] of Object.entries(data.metadata.values)) {
        content += `**${k}**: ${v}\n`;
      }
    }
  }

  const item: Item = {
    id,
    notebook_id: data.notebook_id ?? null,
    title: data.title || 'Untitled',
    type: data.type || 'note',
    content,
    metadata: data.metadata || {},
    is_favorite: data.is_favorite ? 1 : 0,
    is_pinned: data.is_pinned ? 1 : 0,
    is_archived: data.is_archived ? 1 : 0,
    hide_from_all: data.hide_from_all ? 1 : 0,
    priority: data.priority || '',
    created_at: data.created_at || now,
    updated_at: now
  };

  await dbPutItem(item);
  await dbQueueMutation('create_item', item);
  syncService.performSync().catch(() => {});

  return item;
}

export async function updateItem(id: string, data: Partial<Item>): Promise<Item> {
  const existing = await dbGetItem(id);
  const now = new Date().toISOString();

  const updated: Item = {
    id,
    notebook_id: data.notebook_id !== undefined ? data.notebook_id : existing?.notebook_id ?? null,
    title: data.title ?? existing?.title ?? 'Untitled',
    type: data.type ?? existing?.type ?? 'note',
    content: data.content ?? existing?.content ?? '',
    metadata: data.metadata !== undefined ? data.metadata : existing?.metadata ?? {},
    is_favorite: data.is_favorite !== undefined ? (data.is_favorite ? 1 : 0) : existing?.is_favorite ?? 0,
    is_pinned: data.is_pinned !== undefined ? (data.is_pinned ? 1 : 0) : existing?.is_pinned ?? 0,
    is_archived: data.is_archived !== undefined ? (data.is_archived ? 1 : 0) : existing?.is_archived ?? 0,
    hide_from_all: data.hide_from_all !== undefined ? (data.hide_from_all ? 1 : 0) : existing?.hide_from_all ?? 0,
    priority: data.priority !== undefined ? data.priority : existing?.priority ?? '',
    created_at: existing?.created_at || now,
    updated_at: now,
    tags: data.tags !== undefined ? data.tags : existing?.tags
  };

  await dbPutItem(updated);
  await dbQueueMutation('update_item', { id, ...data }, existing?.updated_at);
  syncService.performSync().catch(() => {});

  return updated;
}

export async function deleteItem(id: string, permanent: boolean = false): Promise<void> {
  if (permanent) {
    await dbDeleteItem(id);
  } else {
    const existing = await dbGetItem(id);
    if (existing) {
      existing.is_archived = 1;
      existing.updated_at = new Date().toISOString();
      await dbPutItem(existing);
    }
  }

  await dbQueueMutation('delete_item', { id, permanent });
  syncService.performSync().catch(() => {});
}

export async function counterAction(
  id: string,
  payload: { delta?: number; reset?: boolean; note?: string; setValue?: number }
): Promise<{ count: number; delta: number; metadata: any; history_entry?: CounterHistoryEntry }> {
  const existing = await dbGetItem(id);
  const now = new Date().toISOString();
  let count = 0;
  let delta = payload.delta ?? 0;

  if (existing) {
    const meta = existing.metadata || {};
    const currentVal = Number(meta.count ?? 0);

    if (payload.delta !== undefined) {
      count = currentVal + payload.delta;
    } else if (payload.setValue !== undefined) {
      count = Number(payload.setValue);
      delta = count - currentVal;
    } else if (payload.reset) {
      count = Number(meta.resetValue ?? 0);
      delta = count - currentVal;
    }

    meta.count = count;
    existing.metadata = meta;
    existing.updated_at = now;
    await dbPutItem(existing);
  }

  await dbQueueMutation('counter_adjust', { id, ...payload }, existing?.updated_at);
  syncService.performSync().catch(() => {});

  return {
    count,
    delta,
    metadata: existing?.metadata || { count }
  };
}

export async function fetchCounterHistory(id: string): Promise<CounterHistoryEntry[]> {
  try {
    const res = await fetch(`${apiUrl('/items')}/${id}/counter/history`);
    if (res.ok) return res.json();
  } catch {}
  return [];
}

// =============================================================================
// TEMPLATES API (Offline-First)
// =============================================================================

export async function fetchTemplates(): Promise<FormTemplate[]> {
  try {
    const res = await fetch(apiUrl('/templates'));
    if (res.ok) {
      const serverTemplates: FormTemplate[] = await res.json();
      await dbPutTemplates(serverTemplates);
      return serverTemplates;
    }
  } catch {}
  return dbGetTemplates();
}

export async function createTemplate(data: Partial<FormTemplate>): Promise<FormTemplate> {
  const now = new Date().toISOString();
  const template: FormTemplate = {
    id: data.id || generateUUID(),
    name: data.name || 'Untitled Template',
    description: data.description || '',
    icon: data.icon || 'file-text',
    color: data.color || '#3b82f6',
    default_notebook_id: data.default_notebook_id ?? null,
    fields_schema: data.fields_schema || [],
    enable_processed_tracking: data.enable_processed_tracking !== false,
    created_at: data.created_at || now,
    updated_at: now
  };

  await dbPutTemplate(template);
  await dbQueueMutation('create_template', template);
  syncService.performSync().catch(() => {});

  return template;
}

export async function updateTemplate(id: string, data: Partial<FormTemplate>): Promise<FormTemplate> {
  const existingList = await dbGetTemplates();
  const existing = existingList.find((t) => t.id === id);
  const now = new Date().toISOString();

  const updated: FormTemplate = {
    ...(existing || {}),
    ...data,
    id,
    name: data.name ?? existing?.name ?? 'Template',
    description: data.description ?? existing?.description ?? '',
    icon: data.icon ?? existing?.icon ?? 'file-text',
    color: data.color ?? existing?.color ?? '#3b82f6',
    default_notebook_id: data.default_notebook_id !== undefined ? data.default_notebook_id : existing?.default_notebook_id ?? null,
    fields_schema: data.fields_schema ?? existing?.fields_schema ?? [],
    enable_processed_tracking: data.enable_processed_tracking !== undefined ? data.enable_processed_tracking : existing?.enable_processed_tracking ?? true,
    created_at: existing?.created_at || now,
    updated_at: now
  };

  await dbPutTemplate(updated);
  await dbQueueMutation('update_template', { ...data, id }, existing?.updated_at);
  syncService.performSync().catch(() => {});

  return updated;
}

export async function deleteTemplate(id: string): Promise<void> {
  await dbDeleteTemplate(id);
  await dbQueueMutation('delete_template', { id });
  syncService.performSync().catch(() => {});
}

export async function previewTemplateMarkdown(id: string, values: Record<string, any>): Promise<string> {
  try {
    const res = await fetch(`${apiUrl('/templates')}/${id}/preview-markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });
    if (res.ok) {
      const data = await res.json();
      return data.markdown;
    }
  } catch {}
  return '';
}

export async function fetchTags(): Promise<Tag[]> {
  try {
    const res = await fetch(apiUrl('/tags'));
    if (res.ok) return res.json();
  } catch {}
  return [];
}

export async function scrapeUrl(url: string) {
  const res = await fetch(apiUrl('/scrape'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) throw new Error('Failed to scrape URL');
  return res.json();
}

export async function uploadFile(file: File): Promise<{ url: string; name: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(apiUrl('/upload'), {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload file');
  return res.json();
}

export async function uploadBase64(base64Data: string, filename?: string): Promise<{ url: string; name: string; size: number }> {
  const res = await fetch(apiUrl('/upload-base64'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, filename })
  });
  if (!res.ok) throw new Error('Failed to upload base64');
  return res.json();
}

export function getExportUrl(): string {
  return apiUrl('/export');
}

// =============================================================================
// TIMERS API
// =============================================================================

export async function fetchTimers(): Promise<Timer[]> {
  try {
    const res = await fetch(apiUrl('/timers'));
    if (res.ok) return res.json();
  } catch {}
  return [];
}

export async function createTimer(data: {
  title: string;
  duration_seconds: number;
  notebook_id?: string | null;
  auto_start?: boolean;
}): Promise<Timer> {
  const res = await fetch(apiUrl('/timers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create timer');
  return res.json();
}

export async function startTimer(id: string): Promise<Timer> {
  const res = await fetch(`${apiUrl('/timers')}/${id}/start`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start timer');
  return res.json();
}

export async function pauseTimer(id: string): Promise<Timer> {
  const res = await fetch(`${apiUrl('/timers')}/${id}/pause`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to pause timer');
  return res.json();
}

export async function resetTimer(id: string): Promise<Timer> {
  const res = await fetch(`${apiUrl('/timers')}/${id}/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset timer');
  return res.json();
}

export async function dismissTimer(id: string): Promise<Timer> {
  const res = await fetch(`${apiUrl('/timers')}/${id}/dismiss`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to dismiss timer');
  return res.json();
}

export async function deleteTimer(id: string): Promise<void> {
  const res = await fetch(`${apiUrl('/timers')}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete timer');
}

// =============================================================================
// REMINDERS API (Offline-First)
// =============================================================================

export async function fetchReminders(): Promise<Reminder[]> {
  try {
    const res = await fetch(apiUrl('/reminders'));
    if (res.ok) {
      const serverReminders: Reminder[] = await res.json();
      await dbPutReminders(serverReminders);
      return serverReminders;
    }
  } catch {}
  return dbGetReminders();
}

export async function createReminder(data: {
  id?: string;
  title: string;
  notes?: string;
  due_date: string;
  priority?: 'low' | 'normal' | 'high';
  notebook_id?: string | null;
}): Promise<Reminder> {
  const now = new Date().toISOString();
  const reminder: Reminder = {
    id: data.id || generateUUID(),
    title: data.title,
    notes: data.notes || '',
    due_date: data.due_date,
    status: 'pending',
    priority: data.priority || 'normal',
    notebook_id: data.notebook_id ?? null,
    created_at: now,
    updated_at: now
  };

  await dbPutReminder(reminder);
  await dbQueueMutation('create_reminder', reminder);
  syncService.performSync().catch(() => {});

  return reminder;
}

export async function updateReminder(id: string, data: Partial<Reminder>): Promise<Reminder> {
  const list = await dbGetReminders();
  const existing = list.find((r) => r.id === id);
  const now = new Date().toISOString();

  const updated: Reminder = {
    id,
    title: data.title ?? existing?.title ?? 'Reminder',
    notes: data.notes ?? existing?.notes ?? '',
    due_date: data.due_date ?? existing?.due_date ?? now,
    status: data.status ?? existing?.status ?? 'pending',
    priority: data.priority ?? existing?.priority ?? 'normal',
    notebook_id: data.notebook_id !== undefined ? data.notebook_id : existing?.notebook_id ?? null,
    created_at: existing?.created_at || now,
    updated_at: now
  };

  await dbPutReminder(updated);
  await dbQueueMutation('update_reminder', { id, ...data }, existing?.updated_at);
  syncService.performSync().catch(() => {});

  return updated;
}

export async function completeReminder(id: string): Promise<Reminder> {
  return updateReminder(id, { status: 'completed' });
}

export async function dismissReminder(id: string): Promise<Reminder> {
  return updateReminder(id, { status: 'dismissed' });
}

export async function snoozeReminder(id: string, minutes: number = 5): Promise<Reminder> {
  const list = await dbGetReminders();
  const existing = list.find((r) => r.id === id);
  const now = Date.now();
  const newDue = new Date(now + minutes * 60 * 1000).toISOString();
  return updateReminder(id, { due_date: newDue, status: 'pending' });
}

export async function deleteReminder(id: string): Promise<void> {
  await dbDeleteReminder(id);
  await dbQueueMutation('delete_reminder', { id });
  syncService.performSync().catch(() => {});
}

// =============================================================================
// SETTINGS API (Offline-First)
// =============================================================================

export async function fetchSettings(): Promise<AppSettings> {
  try {
    const res = await fetch(apiUrl('/settings'));
    if (res.ok) {
      const serverSettings: AppSettings = await res.json();
      await dbPutSetting('theme', serverSettings.theme);
      await dbPutSetting('priorities', serverSettings.priorities);
      return serverSettings;
    }
  } catch {}

  const theme = (await dbGetSetting('theme')) || 'system';
  const priorities = (await dbGetSetting('priorities')) || [
    { id: 'low', label: 'Low', color: '#3b82f6' },
    { id: 'medium', label: 'Medium', color: '#22c55e' },
    { id: 'high', label: 'High', color: '#f59e0b' },
    { id: 'urgent', label: 'Urgent', color: '#ef4444' }
  ];

  return { theme, priorities };
}

export async function updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
  if (data.theme) await dbPutSetting('theme', data.theme);
  if (data.priorities) await dbPutSetting('priorities', data.priorities);

  await dbQueueMutation('update_settings', data);
  syncService.performSync().catch(() => {});

  return fetchSettings();
}

// =============================================================================
// SYNC & CONFLICTS API
// =============================================================================

export async function sync(payload: SyncRequestBody): Promise<SyncResponseBody> {
  const res = await fetch(apiUrl('/sync'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Sync failed with server');
  return res.json();
}

export async function fetchConflicts(): Promise<ConflictRecord[]> {
  try {
    const res = await fetch(apiUrl('/conflicts'));
    if (res.ok) {
      const serverConflicts: ConflictRecord[] = await res.json();
      return serverConflicts;
    }
  } catch {}
  return dbGetConflicts();
}

export async function resolveConflict(
  id: string,
  payload: {
    action: 'keep_active' | 'use_conflict' | 'keep_both' | 'custom_merge';
    title?: string;
    content?: string;
    metadata?: any;
  }
): Promise<{ success: boolean; conflictId: string }> {
  try {
    const res = await fetch(`${apiUrl('/conflicts')}/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await dbDeleteConflict(id);
      syncService.refreshLocalStats();
      return res.json();
    }
  } catch {}

  // Fallback local resolution
  await dbDeleteConflict(id);
  syncService.refreshLocalStats();
  return { success: true, conflictId: id };
}

export const api = {
  apiUrl,
  getServerUrl,
  setServerUrl,
  getWebSocketUrl,
  resolveAssetUrl,
  fetchNotebooks,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  fetchItems,
  fetchItem,
  createItem,
  updateItem,
  deleteItem,
  counterAction,
  fetchCounterHistory,
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplateMarkdown,
  fetchTags,
  scrapeUrl,
  uploadFile,
  uploadBase64,
  getExportUrl,
  fetchTimers,
  createTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  dismissTimer,
  deleteTimer,
  fetchReminders,
  createReminder,
  updateReminder,
  completeReminder,
  dismissReminder,
  snoozeReminder,
  deleteReminder,
  fetchSettings,
  updateSettings,
  sync,
  fetchConflicts,
  resolveConflict
};
