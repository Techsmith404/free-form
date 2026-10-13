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
  SyncResponseBody,
  AuthStatusResponse,
  User,
  Invite,
  ApiToken,
  Webhook
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

export function normalizeUrl(url: string): string {
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean) return '';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    // If it starts with localhost or is an IP address or port, default to http://, otherwise https://
    clean = clean.startsWith('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(clean) || /:\d+$/.test(clean)
      ? `http://${clean}`
      : `https://${clean}`;
  }
  return clean;
}

export async function initServerUrl(): Promise<string> {
  if (typeof window !== 'undefined') {
    try {
      const res = await Preferences.get({ key: SERVER_URL_KEY });
      if (res.value) {
        cachedServerUrl = normalizeUrl(res.value);
        return cachedServerUrl;
      }
    } catch {}
    try {
      const local = localStorage.getItem(SERVER_URL_KEY);
      if (local) {
        cachedServerUrl = normalizeUrl(local);
        return cachedServerUrl;
      }
    } catch {}
  }
  return '';
}

export function getServerUrl(): string {
  if (cachedServerUrl) return cachedServerUrl;
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(SERVER_URL_KEY);
      if (local) {
        cachedServerUrl = normalizeUrl(local);
        return cachedServerUrl;
      }
    } catch {}
  }
  return '';
}

export async function setServerUrl(url: string): Promise<string> {
  const clean = normalizeUrl(url);
  cachedServerUrl = clean;
  if (typeof window !== 'undefined') {
    try {
      if (clean) {
        localStorage.setItem(SERVER_URL_KEY, clean);
      } else {
        localStorage.removeItem(SERVER_URL_KEY);
      }
    } catch {}
    try {
      if (clean) {
        await Preferences.set({ key: SERVER_URL_KEY, value: clean });
      } else {
        await Preferences.remove({ key: SERVER_URL_KEY });
      }
    } catch {}
  }
  return clean;
}

const AUTH_TOKEN_KEY = 'freeform_auth_token';
let cachedAuthToken: string = '';

export function getAuthToken(): string {
  if (cachedAuthToken) return cachedAuthToken;
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(AUTH_TOKEN_KEY);
      if (local) {
        cachedAuthToken = local;
        return cachedAuthToken;
      }
    } catch {}
  }
  return '';
}

export async function setAuthToken(token: string | null): Promise<void> {
  cachedAuthToken = token || '';
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch {}
    try {
      if (token) {
        await Preferences.set({ key: AUTH_TOKEN_KEY, value: token });
      } else {
        await Preferences.remove({ key: AUTH_TOKEN_KEY });
      }
    } catch {}
  }
}

export async function initAuthToken(): Promise<string> {
  if (typeof window !== 'undefined') {
    try {
      const res = await Preferences.get({ key: AUTH_TOKEN_KEY });
      if (res.value) {
        cachedAuthToken = res.value;
        return cachedAuthToken;
      }
    } catch {}
    try {
      const local = localStorage.getItem(AUTH_TOKEN_KEY);
      if (local) {
        cachedAuthToken = local;
        return cachedAuthToken;
      }
    } catch {}
  }
  return '';
}

export function apiUrl(endpoint: string): string {
  const base = getServerUrl();
  const stripped = endpoint.replace(/^\/?api(\/|$)/, '$1');
  const cleanEp = stripped.startsWith('/') ? stripped : '/' + stripped;
  if (base) {
    const cleanBase = base.replace(/\/+$/, '');
    return `${cleanBase}/api${cleanEp}`;
  }
  return `/api${cleanEp}`;
}

export function getWebSocketUrl(): string {
  const token = getAuthToken();
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
  const base = getServerUrl();
  if (base) {
    try {
      const url = new URL(base);
      const isHttps = url.protocol === 'https:';
      const host = url.host;
      return `${isHttps ? 'wss:' : 'ws:'}//${host}/api/ws${tokenQuery}`;
    } catch {
      const isHttps = base.startsWith('https://');
      const host = base.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      return `${isHttps ? 'wss:' : 'ws:'}//${host}/api/ws${tokenQuery}`;
    }
  }
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  return `${isHttps ? 'wss:' : 'ws:'}//${host}/api/ws${tokenQuery}`;
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

/**
 * Executes a fetch request with a strict abort timeout to prevent stalled TCP hangs
 * when operating disconnected or on unroutable mobile networks.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = 2500
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init?.headers);
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(input, {
      ...init,
      headers,
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// =============================================================================
// NOTEBOOKS API (Offline-First)
// =============================================================================

export async function fetchNotebooks(): Promise<Notebook[]> {
  try {
    const res = await fetchWithTimeout(apiUrl('/notebooks'), {}, 2500);
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

    const res = await fetchWithTimeout(`${apiUrl('/items')}?${searchParams.toString()}`, {}, 2500);
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
  const nbMap = new Map<string, Notebook>();
  for (const nb of notebooks) {
    if (nb.hide_from_all) hiddenNbMap.set(nb.id, true);
    nbMap.set(nb.id, nb);
  }

  const filtered = all.filter((item) => {
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

  // Attach notebook_name and notebook_color if missing from local item record
  for (const item of filtered) {
    if (item.notebook_id && !item.notebook_name) {
      const nb = nbMap.get(item.notebook_id);
      if (nb) {
        item.notebook_name = nb.name;
        item.notebook_color = nb.color;
      }
    }
  }

  // Sort pinned first, then updated_at DESC (matching server behavior)
  filtered.sort((a, b) => {
    if (b.is_pinned !== a.is_pinned) return (b.is_pinned || 0) - (a.is_pinned || 0);
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return filtered;
}

export async function fetchItem(id: string): Promise<Item> {
  try {
    const res = await fetchWithTimeout(`${apiUrl('/items')}/${id}`, {}, 2500);
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

export interface BacklinkItem {
  id: string;
  title: string;
  type: string;
  notebook_id: string | null;
  notebook_name: string | null;
  updated_at: string;
}

export async function fetchItemBacklinks(id: string): Promise<BacklinkItem[]> {
  try {
    const res = await fetchWithTimeout(`${apiUrl('/items')}/${id}/backlinks`, {}, 2500);
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  // Offline fallback via IndexedDB
  try {
    const target = await dbGetItem(id);
    if (!target || !target.title) return [];
    const allItems = await dbGetItems();
    const notebooks = await dbGetNotebooks();
    const nbMap = new Map(notebooks.map((n) => [n.id, n.name]));
    const cleanTargetTitle = target.title.trim().toLowerCase();

    return allItems
      .filter((it) => {
        if (it.id === id || it.is_archived) return false;
        if (!it.content) return false;
        return it.content.toLowerCase().includes(`[[${cleanTargetTitle}`);
      })
      .map((it) => ({
        id: it.id,
        title: it.title,
        type: it.type,
        notebook_id: it.notebook_id ?? null,
        notebook_name: it.notebook_id ? nbMap.get(it.notebook_id) || null : null,
        updated_at: it.updated_at
      }));
  } catch {
    return [];
  }
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

export async function restoreItem(id: string): Promise<Item> {
  return updateItem(id, { is_archived: 0 });
}

export async function emptyTrash(): Promise<{ count: number }> {
  let count = 0;
  // 1. Clear locally in IndexedDB
  const allItems = await dbGetItems();
  const trashed = allItems.filter((i) => i.is_archived === 1);
  for (const item of trashed) {
    await dbDeleteItem(item.id);
  }
  count = trashed.length;

  // 2. Clear on server if reachable
  try {
    const res = await fetchWithTimeout(apiUrl('/items/trash/empty'), {
      method: 'POST'
    }, 3000);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.count === 'number') {
        count = data.count;
      }
    }
  } catch {}

  syncService.performSync().catch(() => {});
  return { count };
}

export async function restoreAllTrash(): Promise<{ count: number }> {
  let count = 0;
  const now = new Date().toISOString();
  // 1. Update locally in IndexedDB
  const allItems = await dbGetItems();
  const trashed = allItems.filter((i) => i.is_archived === 1);
  for (const item of trashed) {
    item.is_archived = 0;
    item.updated_at = now;
    await dbPutItem(item);
    await dbQueueMutation('update_item', { id: item.id, is_archived: 0 }, item.updated_at);
  }
  count = trashed.length;

  // 2. Update on server if reachable
  try {
    const res = await fetchWithTimeout(apiUrl('/items/trash/restore-all'), {
      method: 'POST'
    }, 3000);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.count === 'number') {
        count = data.count;
      }
    }
  } catch {}

  syncService.performSync().catch(() => {});
  return { count };
}

export async function batchUpdateItems(ids: string[], updates: Partial<Item>): Promise<{ count: number }> {
  const now = new Date().toISOString();
  // 1. Update in IndexedDB & queue mutations
  for (const id of ids) {
    const existing = await dbGetItem(id);
    if (existing) {
      const merged: Item = {
        ...existing,
        ...updates,
        updated_at: now
      };
      await dbPutItem(merged);
      await dbQueueMutation('update_item', { id, ...updates }, existing.updated_at);
    }
  }

  // 2. Server call
  let count = ids.length;
  try {
    const res = await fetchWithTimeout(apiUrl('/items/batch-update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates })
    }, 5000);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.count === 'number') count = data.count;
    }
  } catch {}

  syncService.performSync().catch(() => {});
  return { count };
}

export async function batchDeleteItems(ids: string[], permanent: boolean = false): Promise<{ count: number }> {
  const now = new Date().toISOString();
  for (const id of ids) {
    if (permanent) {
      await dbDeleteItem(id);
    } else {
      const existing = await dbGetItem(id);
      if (existing) {
        existing.is_archived = 1;
        existing.updated_at = now;
        await dbPutItem(existing);
      }
    }
    await dbQueueMutation('delete_item', { id, permanent });
  }

  let count = ids.length;
  try {
    const res = await fetchWithTimeout(apiUrl('/items/batch-delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, permanent })
    }, 5000);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.count === 'number') count = data.count;
    }
  } catch {}

  syncService.performSync().catch(() => {});
  return { count };
}

export async function batchMoveItems(ids: string[], notebook_id: string | null): Promise<{ count: number }> {
  return batchUpdateItems(ids, { notebook_id });
}

export async function exportBatchNotes(ids: string[]): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(apiUrl('/export/batch'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids })
  });

  if (!res.ok) throw new Error('Failed to export selected notes');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `free-form-selected-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
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
    const res = await fetchWithTimeout(apiUrl('/templates'), {}, 2500);
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
    const res = await fetchWithTimeout(apiUrl('/tags'), {}, 2500);
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
    const res = await fetchWithTimeout(apiUrl('/timers'), {}, 2500);
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
  const res = await fetchWithTimeout(apiUrl('/timers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, 4000);
  if (!res.ok) throw new Error('Failed to create timer');
  return res.json();
}

export async function startTimer(id: string): Promise<Timer> {
  const res = await fetchWithTimeout(`${apiUrl('/timers')}/${id}/start`, { method: 'POST' }, 4000);
  if (!res.ok) throw new Error('Failed to start timer');
  return res.json();
}

export async function pauseTimer(id: string): Promise<Timer> {
  const res = await fetchWithTimeout(`${apiUrl('/timers')}/${id}/pause`, { method: 'POST' }, 4000);
  if (!res.ok) throw new Error('Failed to pause timer');
  return res.json();
}

export async function resetTimer(id: string): Promise<Timer> {
  const res = await fetchWithTimeout(`${apiUrl('/timers')}/${id}/reset`, { method: 'POST' }, 4000);
  if (!res.ok) throw new Error('Failed to reset timer');
  return res.json();
}

export async function dismissTimer(id: string): Promise<Timer> {
  const res = await fetchWithTimeout(`${apiUrl('/timers')}/${id}/dismiss`, { method: 'POST' }, 4000);
  if (!res.ok) throw new Error('Failed to dismiss timer');
  return res.json();
}

export async function deleteTimer(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${apiUrl('/timers')}/${id}`, { method: 'DELETE' }, 4000);
  if (!res.ok) throw new Error('Failed to delete timer');
}

// =============================================================================
// REMINDERS API (Offline-First)
// =============================================================================

export async function fetchReminders(): Promise<Reminder[]> {
  try {
    const res = await fetchWithTimeout(apiUrl('/reminders'), {}, 2500);
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
    const res = await fetchWithTimeout(apiUrl('/settings'), {}, 2500);
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
  const res = await fetchWithTimeout(apiUrl('/sync'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, 4000);
  if (!res.ok) throw new Error('Sync failed with server');
  return res.json();
}

export async function fetchConflicts(): Promise<ConflictRecord[]> {
  try {
    const res = await fetchWithTimeout(apiUrl('/conflicts'), {}, 2500);
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

// =============================================================================
// AUTH & USER API
// =============================================================================

export async function checkAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetchWithTimeout(apiUrl('/auth/status'), {}, 2500);
  if (!res.ok) {
    throw new Error('Failed to fetch auth status');
  }
  return res.json();
}

export async function setupOwner(data: { username: string; password: string; email?: string }): Promise<{ token: string; user: User }> {
  const res = await fetch(apiUrl('/auth/setup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to setup owner account');
  }
  const result = await res.json();
  if (result.token) {
    await setAuthToken(result.token);
  }
  return result;
}

export async function loginUser(data: { username: string; password: string; remember_me?: boolean }): Promise<{ token: string; user: User }> {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Invalid credentials');
  }
  const result = await res.json();
  if (result.token) {
    await setAuthToken(result.token);
  }
  return result;
}

export async function registerUser(data: { username: string; password: string; email?: string; invite_code: string }): Promise<{ token: string; user: User }> {
  const res = await fetch(apiUrl('/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Registration failed');
  }
  const result = await res.json();
  if (result.token) {
    await setAuthToken(result.token);
  }
  return result;
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {}
  await setAuthToken(null);
}

export async function fetchInvites(): Promise<Invite[]> {
  const res = await fetchWithTimeout(apiUrl('/auth/invites'));
  if (!res.ok) throw new Error('Failed to fetch invites');
  return res.json();
}

export async function createInvite(data: { role?: string; max_uses?: number; expires_in_days?: number }): Promise<Invite> {
  const res = await fetch(apiUrl('/auth/invites'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create invite');
  }
  return res.json();
}

export async function deleteInvite(code: string): Promise<void> {
  const res = await fetch(`${apiUrl('/auth/invites')}/${code}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getAuthToken()}`
    }
  });
  if (!res.ok) throw new Error('Failed to delete invite');
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetchWithTimeout(apiUrl('/auth/users'));
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function importBackup(file: File): Promise<{ success: boolean; stats: any; error?: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl('/import'), {
    method: 'POST',
    headers,
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to import backup');
  }

  return res.json();
}

export const api = {
  apiUrl,
  getServerUrl,
  setServerUrl,
  getWebSocketUrl,
  resolveAssetUrl,
  getAuthToken,
  setAuthToken,
  initAuthToken,
  checkAuthStatus,
  setupOwner,
  loginUser,
  registerUser,
  logoutUser,
  fetchInvites,
  createInvite,
  deleteInvite,
  fetchUsers,
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
  importBackup,
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
  resolveConflict,
  restoreItem,
  emptyTrash,
  restoreAllTrash
};

// ==========================================
// VAULT IMPORTERS & CLOUD MIGRATION
// ==========================================

export async function importObsidianVault(file: File): Promise<{ success: boolean; stats: any; message: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchWithTimeout(apiUrl('/import/obsidian'), {
    method: 'POST',
    body: formData,
    credentials: 'include'
  }, 30000);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function importGoogleKeep(jsonData: any): Promise<{ success: boolean; stats: any; message: string }> {
  const res = await fetchWithTimeout(apiUrl('/import/keep'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonData),
    credentials: 'include'
  }, 15000);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ==========================================
// PERSONAL ACCESS TOKENS (PATs)
// ==========================================

export async function fetchApiTokens(): Promise<ApiToken[]> {
  const res = await fetchWithTimeout(apiUrl('/tokens'), { credentials: 'include' }, 4000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createApiToken(
  name: string,
  scopes: string = 'read,write',
  expiresInDays?: number
): Promise<{ id: string; name: string; token: string; scopes: string; token_prefix: string; expires_at: string | null; created_at: string }> {
  const res = await fetchWithTimeout(apiUrl('/tokens'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, scopes, expires_in_days: expiresInDays }),
    credentials: 'include'
  }, 4000);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create token' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteApiToken(id: string): Promise<void> {
  const res = await fetchWithTimeout(apiUrl(`/tokens/${id}`), {
    method: 'DELETE',
    credentials: 'include'
  }, 4000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ==========================================
// OUTBOUND WEBHOOKS
// ==========================================

export async function fetchWebhooks(): Promise<Webhook[]> {
  const res = await fetchWithTimeout(apiUrl('/webhooks'), { credentials: 'include' }, 4000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createWebhook(webhook: {
  name: string;
  url: string;
  secret?: string;
  events?: string;
}): Promise<Webhook & { secret?: string }> {
  const res = await fetchWithTimeout(apiUrl('/webhooks'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhook),
    credentials: 'include'
  }, 4000);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create webhook' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook> {
  const res = await fetchWithTimeout(apiUrl(`/webhooks/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
    credentials: 'include'
  }, 4000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteWebhook(id: string): Promise<void> {
  const res = await fetchWithTimeout(apiUrl(`/webhooks/${id}`), {
    method: 'DELETE',
    credentials: 'include'
  }, 4000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function testWebhook(id: string): Promise<{ success: boolean; status: number }> {
  const res = await fetchWithTimeout(apiUrl(`/webhooks/${id}/test`), {
    method: 'POST',
    credentials: 'include'
  }, 6000);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to test webhook' }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}


