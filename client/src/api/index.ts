import {
  Notebook,
  Item,
  FormTemplate,
  Tag,
  ItemType,
  CounterHistoryEntry
} from '../types/index.js';

const API_BASE = '/api';

export async function fetchNotebooks(): Promise<Notebook[]> {
  const res = await fetch(`${API_BASE}/notebooks`);
  if (!res.ok) throw new Error('Failed to fetch notebooks');
  return res.json();
}

export async function createNotebook(data: Partial<Notebook>): Promise<Notebook> {
  const res = await fetch(`${API_BASE}/notebooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create notebook');
  return res.json();
}

export async function updateNotebook(id: string, data: Partial<Notebook>): Promise<Notebook> {
  const res = await fetch(`${API_BASE}/notebooks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update notebook');
  return res.json();
}

export async function deleteNotebook(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/notebooks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete notebook');
}

export interface ItemQueryParams {
  notebook_id?: string;
  type?: ItemType;
  is_favorite?: boolean;
  is_archived?: boolean;
  search?: string;
  tag?: string;
}

export async function fetchItems(params?: ItemQueryParams): Promise<Item[]> {
  const searchParams = new URLSearchParams();
  if (params?.notebook_id) searchParams.set('notebook_id', params.notebook_id);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.is_favorite) searchParams.set('is_favorite', '1');
  if (params?.is_archived) searchParams.set('is_archived', '1');
  if (params?.search) searchParams.set('search', params.search);
  if (params?.tag) searchParams.set('tag', params.tag);

  const res = await fetch(`${API_BASE}/items?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch items');
  return res.json();
}

export async function fetchItem(id: string): Promise<Item> {
  const res = await fetch(`${API_BASE}/items/${id}`);
  if (!res.ok) throw new Error('Failed to fetch item');
  return res.json();
}

export async function createItem(data: Partial<Item>): Promise<Item> {
  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create item');
  return res.json();
}

export async function updateItem(id: string, data: Partial<Item>): Promise<Item> {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update item');
  return res.json();
}

export async function deleteItem(id: string, permanent: boolean = false): Promise<void> {
  const res = await fetch(`${API_BASE}/items/${id}${permanent ? '?permanent=1' : ''}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete item');
}

export async function counterAction(
  id: string,
  payload: { delta?: number; reset?: boolean; note?: string; setValue?: number }
): Promise<{ count: number; delta: number; metadata: any; history_entry: CounterHistoryEntry }> {
  const res = await fetch(`${API_BASE}/items/${id}/counter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to update counter');
  return res.json();
}

export async function fetchCounterHistory(id: string): Promise<CounterHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/items/${id}/counter/history`);
  if (!res.ok) throw new Error('Failed to fetch counter history');
  return res.json();
}

export async function fetchTemplates(): Promise<FormTemplate[]> {
  const res = await fetch(`${API_BASE}/templates`);
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

export async function createTemplate(data: Partial<FormTemplate>): Promise<FormTemplate> {
  const res = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create template');
  return res.json();
}

export async function updateTemplate(id: string, data: Partial<FormTemplate>): Promise<FormTemplate> {
  const res = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update template');
  return res.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/templates/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete template');
}

export async function previewTemplateMarkdown(id: string, values: Record<string, any>): Promise<string> {
  const res = await fetch(`${API_BASE}/templates/${id}/preview-markdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  });
  if (!res.ok) throw new Error('Failed to preview markdown');
  const data = await res.json();
  return data.markdown;
}

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(`${API_BASE}/tags`);
  if (!res.ok) throw new Error('Failed to fetch tags');
  return res.json();
}

export async function scrapeUrl(url: string) {
  const res = await fetch(`${API_BASE}/scrape`, {
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
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload file');
  return res.json();
}

export async function uploadBase64(base64Data: string, filename?: string): Promise<{ url: string; name: string; size: number }> {
  const res = await fetch(`${API_BASE}/upload-base64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, filename })
  });
  if (!res.ok) throw new Error('Failed to upload base64');
  return res.json();
}

export function getExportUrl(): string {
  return `${API_BASE}/export`;
}
