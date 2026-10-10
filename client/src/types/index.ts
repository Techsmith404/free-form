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
  hide_from_all?: number;
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
  enable_processed_tracking?: boolean;
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
  is_processed?: boolean;
  processed_at?: string | null;
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
  hide_from_all?: number;
  priority?: string;
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

export type TimerStatus = 'idle' | 'running' | 'paused' | 'ringing' | 'dismissed';

export interface Timer {
  id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds: number;
  status: TimerStatus;
  target_end_time: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  notebook_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ReminderStatus = 'pending' | 'triggered' | 'completed' | 'dismissed';
export type ReminderPriority = 'low' | 'normal' | 'high';

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  due_date: string;
  status: ReminderStatus;
  priority: ReminderPriority;
  notebook_id: string | null;
  created_at: string;
  updated_at: string;
}

export type RealtimeEvent =
  | { type: 'SYNC_STATE'; payload: { timers: Timer[]; reminders: Reminder[]; conflicts?: ConflictRecord[] } }
  | { type: 'TIMER_UPDATED'; payload: { timer: Timer } }
  | { type: 'TIMER_DELETED'; payload: { timerId: string } }
  | { type: 'TIMER_RING'; payload: { timer: Timer } }
  | { type: 'TIMER_DISMISSED'; payload: { timerId: string } }
  | { type: 'REMINDER_UPDATED'; payload: { reminder: Reminder } }
  | { type: 'REMINDER_DELETED'; payload: { reminderId: string } }
  | { type: 'REMINDER_TRIGGER'; payload: { reminder: Reminder } }
  | { type: 'REMINDER_DISMISSED'; payload: { reminderId: string } }
  | { type: 'CONFLICT_CREATED'; payload: { conflict: ConflictRecord } }
  | { type: 'CONFLICT_RESOLVED'; payload: { conflictId: string } };

export type ThemeMode = 'dark' | 'light' | 'system';

export interface NotePriority {
  id: string;
  label: string;
  color: string;
}

export interface AppSettings {
  theme: ThemeMode;
  priorities: NotePriority[];
  [key: string]: any;
}

export interface ConflictRecord {
  id: string;
  item_id: string;
  active_title: string;
  active_content: string;
  active_metadata: any;
  active_updated_at: string;
  conflict_title: string;
  conflict_content: string;
  conflict_metadata: any;
  conflict_updated_at: string;
  device_name?: string;
  status: 'unresolved' | 'resolved';
  resolution?: 'keep_active' | 'use_conflict' | 'keep_both' | 'custom_merge';
  created_at: string;
  resolved_at?: string | null;
}

export type MutationType =
  | 'create_item'
  | 'update_item'
  | 'delete_item'
  | 'counter_adjust'
  | 'create_notebook'
  | 'update_notebook'
  | 'delete_notebook'
  | 'create_template'
  | 'update_template'
  | 'delete_template'
  | 'update_settings'
  | 'create_reminder'
  | 'update_reminder'
  | 'delete_reminder';

export interface SyncMutation {
  id: string;
  type: MutationType;
  data: any;
  client_timestamp: string;
  base_timestamp?: string;
}

export interface SyncRequestBody {
  device_name?: string;
  last_sync_timestamp?: string;
  mutations: SyncMutation[];
}

export interface SyncResponseBody {
  success: boolean;
  server_time: string;
  processed_mutation_ids: string[];
  conflicts: ConflictRecord[];
  server_changes: {
    items: Item[];
    notebooks: Notebook[];
    templates: FormTemplate[];
    reminders: Reminder[];
    settings?: Record<string, any>;
  };
}

export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Invite {
  code: string;
  created_by: string;
  creator_name?: string;
  role: UserRole;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface AuthStatusResponse {
  accounts_enabled: boolean;
  auth_required: boolean;
  needs_setup: boolean;
  authenticated: boolean;
  user?: User | null;
}
