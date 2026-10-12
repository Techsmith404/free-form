import { z } from 'zod';

// ==========================================
// 1. Core Primitives & Enums
// ==========================================

export const ItemTypeSchema = z.enum(['note', 'counter', 'bookmark', 'poster', 'form_entry']);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const SortOptionSchema = z.enum(['updated', 'created', 'title', 'priority']);
export type SortOption = z.infer<typeof SortOptionSchema>;

export const ViewModeSchema = z.enum(['grid', 'list', 'board']);
export type ViewMode = z.infer<typeof ViewModeSchema>;

export const ThemeModeSchema = z.enum(['dark', 'light', 'system', 'oled']);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const AccentColorSchema = z.enum(['emerald', 'violet', 'cyan', 'rose', 'amber', 'blue']);
export type AccentColor = z.infer<typeof AccentColorSchema>;

export const NotePrioritySchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string()
});
export type NotePriority = z.infer<typeof NotePrioritySchema>;

// ==========================================
// 2. Notebooks
// ==========================================

export const NotebookSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  color: z.string().default('#22c55e'),
  icon: z.string().default('folder'),
  parent_id: z.string().nullable().default(null),
  default_template_id: z.string().nullable().default(null),
  default_template_name: z.string().nullable().optional(),
  view_mode: z.enum(['grid', 'list', 'split']).default('grid'),
  sort_order: z.number().default(0),
  hide_from_all: z.number().optional().default(0),
  created_at: z.string(),
  updated_at: z.string(),
  item_count: z.number().optional()
});
export type Notebook = z.infer<typeof NotebookSchema>;

// ==========================================
// 3. Form Templates & Field Definitions
// ==========================================

export const FormFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'select',
  'checkbox',
  'rating',
  'table',
  'signature',
  'image',
  'header'
]);
export type FormFieldType = z.infer<typeof FormFieldTypeSchema>;

export const FormFieldTableColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['text', 'number', 'date', 'checkbox'])
});
export type FormFieldTableColumn = z.infer<typeof FormFieldTableColumnSchema>;

export const FormFieldDefinitionSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: FormFieldTypeSchema,
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.any().optional(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(),
  columns: z.array(FormFieldTableColumnSchema).optional(),
  defaultRows: z.number().optional(),
  description: z.string().optional()
});
export type FormFieldDefinition = z.infer<typeof FormFieldDefinitionSchema>;

export const FormTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  icon: z.string().default('clipboard-list'),
  color: z.string().default('#22c55e'),
  default_notebook_id: z.string().nullable().default(null),
  fields_schema: z.array(FormFieldDefinitionSchema).default([]),
  enable_processed_tracking: z.boolean().optional().default(false),
  usage_count: z.number().optional(),
  created_at: z.string(),
  updated_at: z.string()
});
export type FormTemplate = z.infer<typeof FormTemplateSchema>;

// ==========================================
// 4. Item Metadatas
// ==========================================

export const CounterMetadataSchema = z.object({
  count: z.number().optional(),
  value: z.number().optional(),
  step: z.number().default(1),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  unit: z.string().optional(),
  resetValue: z.number().optional()
});
export type CounterMetadata = z.infer<typeof CounterMetadataSchema>;

export const BookmarkMetadataSchema = z.object({
  url: z.string(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
  favicon: z.string().optional(),
  siteName: z.string().optional()
});
export type BookmarkMetadata = z.infer<typeof BookmarkMetadataSchema>;

export const PosterImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  caption: z.string().optional(),
  size: z.number().optional()
});
export type PosterImage = z.infer<typeof PosterImageSchema>;

export const PosterMetadataSchema = z.object({
  images: z.array(PosterImageSchema).default([])
});
export type PosterMetadata = z.infer<typeof PosterMetadataSchema>;

export const FormEntryMetadataSchema = z.object({
  template_id: z.string(),
  template_name: z.string(),
  values: z.record(z.any()).default({}),
  is_processed: z.number().or(z.boolean()).optional(),
  processed_at: z.string().nullable().optional()
});
export type FormEntryMetadata = z.infer<typeof FormEntryMetadataSchema>;

// ==========================================
// 5. Tags & Items
// ==========================================

export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  count: z.number().optional()
});
export type Tag = z.infer<typeof TagSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  notebook_id: z.string().nullable().optional(),
  notebook_name: z.string().optional(),
  notebook_color: z.string().optional(),
  title: z.string().default(''),
  type: ItemTypeSchema.default('note'),
  content: z.string().default(''),
  metadata: z.any().optional(),
  is_favorite: z.number().default(0),
  is_pinned: z.number().default(0),
  is_archived: z.number().default(0),
  hide_from_all: z.number().default(0),
  priority: z.string().optional(),
  user_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  tags: z.array(TagSchema.or(z.string())).optional()
});
export type Item = z.infer<typeof ItemSchema>;

export const CounterHistorySchema = z.object({
  id: z.string(),
  item_id: z.string(),
  previous_value: z.number(),
  delta: z.number(),
  new_value: z.number(),
  note: z.string().default(''),
  created_at: z.string()
});
export type CounterHistory = z.infer<typeof CounterHistorySchema>;
export type CounterHistoryEntry = CounterHistory;
export const CounterHistoryEntrySchema = CounterHistorySchema;

// ==========================================
// 6. Timers & Reminders
// ==========================================

export const TimerStatusSchema = z.enum(['idle', 'running', 'paused', 'ringing', 'dismissed']);
export type TimerStatus = z.infer<typeof TimerStatusSchema>;

export const TimerSchema = z.object({
  id: z.string(),
  title: z.string().default('Timer'),
  duration_seconds: z.number(),
  remaining_seconds: z.number(),
  status: TimerStatusSchema,
  target_end_time: z.string().nullable().default(null),
  started_at: z.string().nullable().default(null),
  paused_at: z.string().nullable().default(null),
  completed_at: z.string().nullable().default(null),
  notebook_id: z.string().nullable().default(null),
  user_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string()
});
export type Timer = z.infer<typeof TimerSchema>;

export const ReminderStatusSchema = z.enum(['pending', 'triggered', 'completed', 'dismissed']);
export type ReminderStatus = z.infer<typeof ReminderStatusSchema>;

export const ReminderPrioritySchema = z.enum(['low', 'normal', 'high']);
export type ReminderPriority = z.infer<typeof ReminderPrioritySchema>;

export const ReminderSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().default(''),
  due_date: z.string(),
  status: ReminderStatusSchema.default('pending'),
  priority: ReminderPrioritySchema.default('normal'),
  notebook_id: z.string().nullable().default(null),
  user_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string()
});
export type Reminder = z.infer<typeof ReminderSchema>;

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

// ==========================================
// 7. Settings
// ==========================================

export const DensityModeSchema = z.enum(['compact', 'comfortable', 'cozy']);
export type DensityMode = z.infer<typeof DensityModeSchema>;

export const AppSettingsSchema = z.object({
  theme: ThemeModeSchema.default('system'),
  accent_color: AccentColorSchema.optional(),
  density: DensityModeSchema.default('cozy').optional(),
  priorities: z.array(NotePrioritySchema).default([]),
  default_sort_option: SortOptionSchema.optional()
}).passthrough();
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// ==========================================
// 8. Batch Operations Schemas
// ==========================================

export const BatchUpdateItemsSchema = z.object({
  ids: z.array(z.string()).min(1),
  updates: z.record(z.any())
});
export type BatchUpdateItemsPayload = z.infer<typeof BatchUpdateItemsSchema>;

export const BatchDeleteItemsSchema = z.object({
  ids: z.array(z.string()).min(1),
  permanent: z.boolean().optional().default(false)
});
export type BatchDeleteItemsPayload = z.infer<typeof BatchDeleteItemsSchema>;

export const BatchMoveItemsSchema = z.object({
  ids: z.array(z.string()).min(1),
  notebook_id: z.string().nullable()
});
export type BatchMoveItemsPayload = z.infer<typeof BatchMoveItemsSchema>;

export const BatchExportNotesSchema = z.object({
  ids: z.array(z.string()).min(1)
});
export type BatchExportNotesPayload = z.infer<typeof BatchExportNotesSchema>;

// ==========================================
// 9. Sync & Conflict Protocol
// ==========================================

export const ConflictRecordSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  active_title: z.string(),
  active_content: z.string(),
  active_metadata: z.any(),
  active_updated_at: z.string(),
  conflict_title: z.string(),
  conflict_content: z.string(),
  conflict_metadata: z.any(),
  conflict_updated_at: z.string(),
  device_name: z.string().optional(),
  status: z.enum(['unresolved', 'resolved']).default('unresolved'),
  resolution: z.enum(['keep_active', 'use_conflict', 'keep_both', 'custom_merge']).optional(),
  created_at: z.string(),
  resolved_at: z.string().nullable().optional()
});
export type ConflictRecord = z.infer<typeof ConflictRecordSchema>;

export const MutationTypeSchema = z.enum([
  'create_item',
  'update_item',
  'delete_item',
  'counter_adjust',
  'create_notebook',
  'update_notebook',
  'delete_notebook',
  'create_template',
  'update_template',
  'delete_template',
  'update_settings',
  'create_reminder',
  'update_reminder',
  'delete_reminder'
]);
export type MutationType = z.infer<typeof MutationTypeSchema>;

export const SyncMutationSchema = z.object({
  id: z.string(),
  type: MutationTypeSchema,
  data: z.any(),
  client_timestamp: z.string(),
  base_timestamp: z.string().optional()
});
export type SyncMutation = z.infer<typeof SyncMutationSchema>;

export const SyncRequestBodySchema = z.object({
  device_name: z.string().optional(),
  last_sync_timestamp: z.string().optional(),
  mutations: z.array(SyncMutationSchema).default([])
});
export type SyncRequestBody = z.infer<typeof SyncRequestBodySchema>;

export const SyncResponseBodySchema = z.object({
  success: z.boolean(),
  server_time: z.string(),
  processed_mutation_ids: z.array(z.string()),
  conflicts: z.array(ConflictRecordSchema),
  server_changes: z.object({
    items: z.array(ItemSchema).default([]),
    notebooks: z.array(NotebookSchema).default([]),
    templates: z.array(FormTemplateSchema).default([]),
    timers: z.array(TimerSchema).optional(),
    reminders: z.array(ReminderSchema).default([]),
    settings: z.record(z.any()).or(AppSettingsSchema).nullable().default(null)
  })
});
export type SyncResponseBody = z.infer<typeof SyncResponseBodySchema>;

// ==========================================
// 10. Auth & Users
// ==========================================

export const UserRoleSchema = z.enum(['owner', 'admin', 'member']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().optional(),
  role: UserRoleSchema,
  created_at: z.string(),
  updated_at: z.string()
});
export type User = z.infer<typeof UserSchema>;

export const UserWithPasswordSchema = UserSchema.extend({
  password_hash: z.string()
});
export type UserWithPassword = z.infer<typeof UserWithPasswordSchema>;

export const InviteSchema = z.object({
  code: z.string(),
  created_by: z.string(),
  creator_name: z.string().optional(),
  role: UserRoleSchema,
  max_uses: z.number().default(1),
  uses_count: z.number().default(0),
  expires_at: z.string().nullable(),
  created_at: z.string()
});
export type Invite = z.infer<typeof InviteSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  token_hash: z.string(),
  user_agent: z.string().optional(),
  ip_address: z.string().optional(),
  expires_at: z.string(),
  created_at: z.string()
});
export type Session = z.infer<typeof SessionSchema>;

export const AuthStatusResponseSchema = z.object({
  accounts_enabled: z.boolean(),
  auth_required: z.boolean(),
  needs_setup: z.boolean(),
  authenticated: z.boolean(),
  user: UserSchema.nullable().optional()
});
export type AuthStatusResponse = z.infer<typeof AuthStatusResponseSchema>;
