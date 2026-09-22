export type ItemType = 'note' | 'counter' | 'bookmark' | 'poster' | 'form_entry';

export interface Notebook {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  parent_id: string | null;
  default_template_id: string | null;
  default_template_name?: string | null;
  view_mode: 'grid' | 'list' | 'split';
  sort_order: number;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'checkbox'
  | 'rating'
  | 'table'
  | 'signature'
  | 'image'
  | 'header';

export interface FormFieldTableColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'checkbox';
}

export interface FormFieldDefinition {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  columns?: FormFieldTableColumn[];
  defaultRows?: number;
  description?: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  default_notebook_id: string | null;
  fields_schema: FormFieldDefinition[];
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

export interface CounterMetadata {
  count: number;
  step: number;
  min?: number | null;
  max?: number | null;
  unit?: string;
  resetValue?: number;
}

export interface BookmarkMetadata {
  url: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  favicon?: string;
  siteName?: string;
}

export interface PosterImage {
  id: string;
  url: string;
  name: string;
  caption?: string;
  size?: number;
}

export interface PosterMetadata {
  images: PosterImage[];
}

export interface FormEntryMetadata {
  template_id: string;
  template_name: string;
  values: Record<string, any>;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  count?: number;
}

export interface Item {
  id: string;
  notebook_id: string | null;
  notebook_name?: string;
  notebook_color?: string;
  title: string;
  type: ItemType;
  content: string;
  metadata: any;
  is_favorite: number;
  is_pinned: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
  tags?: Tag[] | string[];
}

export interface CounterHistoryEntry {
  id: string;
  item_id: string;
  delta: number;
  new_value: number;
  note: string;
  created_at: string;
}
