import React, { useState } from 'react';
import {
  X,
  Sun,
  Moon,
  Laptop,
  Plus,
  Trash2,
  RotateCcw,
  Palette,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Settings,
  ShieldCheck,
  Check,
  MoonStar,
  Minimize2,
  LayoutGrid,
  Maximize2,
  Key,
  Webhook as WebhookIcon,
  Upload,
  Terminal,
  Copy,
  ExternalLink
} from 'lucide-react';
import { ThemeMode, AccentColor, NotePriority, AppSettings, DensityMode, ApiToken, Webhook } from '../../types/index.js';
import { useRealtime } from '../../context/RealtimeContext.js';
import {
  getExportUrl,
  getServerUrl,
  setServerUrl,
  apiUrl,
  importObsidianVault,
  importGoogleKeep,
  fetchApiTokens,
  createApiToken,
  deleteApiToken,
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook
} from '../../api/index.js';
import { isNative, hapticTap } from '../../services/native.js';
import { syncService, SyncState } from '../../services/syncService.js';
import { GitMerge, Database, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  currentAccent?: AccentColor;
  onAccentChange?: (accent: AccentColor) => void;
  currentDensity?: DensityMode;
  onDensityChange?: (density: DensityMode) => void;
  priorities: NotePriority[];
  onPrioritiesChange: (priorities: NotePriority[]) => void;
}

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#64748b'  // Slate
];

const DEFAULT_PRIORITIES: NotePriority[] = [
  { id: 'low', label: 'Low', color: '#3b82f6' },
  { id: 'medium', label: 'Medium', color: '#22c55e' },
  { id: 'high', label: 'High', color: '#f59e0b' },
  { id: 'urgent', label: 'Urgent', color: '#ef4444' }
];

const ACCENT_COLORS: { id: AccentColor; label: string; color: string }[] = [
  { id: 'emerald', label: 'Emerald', color: '#22c55e' },
  { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  { id: 'cyan', label: 'Neon Cyan', color: '#06b6d4' },
  { id: 'rose', label: 'Rose', color: '#f43f5e' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
  { id: 'blue', label: 'Electric Blue', color: '#3b82f6' }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  currentAccent = 'emerald',
  onAccentChange,
  currentDensity = 'cozy',
  onDensityChange,
  priorities,
  onPrioritiesChange
}) => {
  const { isConnected, isConnecting, reconnectAttempt, manualReconnect, conflicts, setConflictModalOpen } = useRealtime();
  const [localPriorities, setLocalPriorities] = useState<NotePriority[]>(priorities);
  const [activeTab, setActiveTab] = useState<'appearance' | 'priorities' | 'system' | 'integrations' | 'import'>('appearance');
  const [savedToast, setSavedToast] = useState(false);
  const [serverUrl, setServerUrlInput] = useState(getServerUrl());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(syncService.getState());

  // Section 6 Automation & PAT States
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdTokenRaw, setCreatedTokenRaw] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState('*');
  const [webhookTestStatus, setWebhookTestStatus] = useState<Record<string, string>>({});
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const obsidianInputRef = React.useRef<HTMLInputElement>(null);
  const keepInputRef = React.useRef<HTMLInputElement>(null);

  // Load Tokens & Webhooks when opening integrations tab
  React.useEffect(() => {
    if (isOpen && activeTab === 'integrations') {
      fetchApiTokens().then(setTokens).catch(() => {});
      fetchWebhooks().then(setWebhooks).catch(() => {});
    }
  }, [isOpen, activeTab]);

  React.useEffect(() => {
    return syncService.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  // Sync priorities when prop changes
  React.useEffect(() => {
    setLocalPriorities(priorities);
  }, [priorities]);

  if (!isOpen) return null;

  const handleUpdatePriority = (id: string, field: 'label' | 'color', val: string) => {
    const updated = localPriorities.map((p) => {
      if (p.id === id) {
        return { ...p, [field]: val };
      }
      return p;
    });
    setLocalPriorities(updated);
    onPrioritiesChange(updated);
    showSavedNotification();
  };

  const handleAddPriority = () => {
    const newId = `p_${Date.now()}`;
    const newPriority: NotePriority = {
      id: newId,
      label: 'New Priority',
      color: PRESET_COLORS[localPriorities.length % PRESET_COLORS.length]
    };
    const updated = [...localPriorities, newPriority];
    setLocalPriorities(updated);
    onPrioritiesChange(updated);
    showSavedNotification();
  };

  const handleDeletePriority = (id: string) => {
    const updated = localPriorities.filter((p) => p.id !== id);
    setLocalPriorities(updated);
    onPrioritiesChange(updated);
    showSavedNotification();
  };

  const handleResetPriorities = () => {
    setLocalPriorities(DEFAULT_PRIORITIES);
    onPrioritiesChange(DEFAULT_PRIORITIES);
    showSavedNotification();
  };

  const showSavedNotification = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="w-full sm:max-w-2xl bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col h-[90dvh] sm:h-[85vh] sm:max-h-[750px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mt-3 sm:hidden" />

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-lg font-bold text-zinc-100">Settings</h2>
              <p className="text-xs text-zinc-400">Preferences, color coding & server sync</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedToast && (
              <span className="flex items-center gap-1 text-xs text-brand-400 bg-brand-500/15 px-2.5 py-1 rounded-full animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 transition touch-manipulation"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-zinc-800 bg-zinc-950/60 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition touch-manipulation whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'bg-zinc-800 text-brand-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Theme & Appearance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('priorities')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition touch-manipulation whitespace-nowrap ${
              activeTab === 'priorities'
                ? 'bg-zinc-800 text-brand-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Note Priorities ({localPriorities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition touch-manipulation whitespace-nowrap ${
              activeTab === 'system'
                ? 'bg-zinc-800 text-brand-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Server & Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('integrations')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition touch-manipulation whitespace-nowrap ${
              activeTab === 'integrations'
                ? 'bg-zinc-800 text-brand-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <WebhookIcon className="w-3.5 h-3.5" />
            <span>API & Webhooks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition touch-manipulation whitespace-nowrap ${
              activeTab === 'import'
                ? 'bg-zinc-800 text-brand-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Vault Importers</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: THEME & APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                  Color Theme
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Choose your interface theme or let Free Form automatically match your device.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3.5">
                  {/* Light Theme */}
                  <button
                    type="button"
                    onClick={() => onThemeChange('light')}
                    className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border text-center transition touch-manipulation ${
                      currentTheme === 'light'
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="p-2.5 rounded-full bg-zinc-800 text-amber-400">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm block">Light</span>
                      <span className="text-[11px] text-zinc-400">Crisp high contrast</span>
                    </div>
                  </button>

                  {/* Dark Theme */}
                  <button
                    type="button"
                    onClick={() => onThemeChange('dark')}
                    className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border text-center transition touch-manipulation ${
                      currentTheme === 'dark'
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="p-2.5 rounded-full bg-zinc-800 text-indigo-400">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm block">Dark</span>
                      <span className="text-[11px] text-zinc-400">Obsidian surface</span>
                    </div>
                  </button>

                  {/* OLED Black Theme */}
                  <button
                    type="button"
                    onClick={() => onThemeChange('oled')}
                    className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border text-center transition touch-manipulation ${
                      currentTheme === 'oled'
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                        : 'bg-black border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="p-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-purple-400">
                      <MoonStar className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm block text-zinc-100">OLED Black</span>
                      <span className="text-[11px] text-zinc-400">Pure #000000 pixel off</span>
                    </div>
                  </button>

                  {/* System Theme */}
                  <button
                    type="button"
                    onClick={() => onThemeChange('system')}
                    className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border text-center transition touch-manipulation ${
                      currentTheme === 'system'
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="p-2.5 rounded-full bg-zinc-800 text-brand-400">
                      <Laptop className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm block">System</span>
                      <span className="text-[11px] text-zinc-400">Match device mode</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Brand Accent Matrix */}
              <div className="pt-5 border-t border-zinc-800/80">
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                  Brand Accent Color
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Personalize the interface accent color across buttons, active badges, and highlights.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mt-3.5">
                  {ACCENT_COLORS.map((acc) => {
                    const isSelected = (currentAccent || 'emerald') === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => onAccentChange?.(acc.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition touch-manipulation ${
                          isSelected
                            ? 'bg-zinc-800/90 border-brand-500 ring-1 ring-brand-500/40 shadow-sm'
                            : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm ring-1 ring-white/10"
                          style={{ backgroundColor: acc.color }}
                        />
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                          {acc.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card & Feed Density */}
              <div className="pt-5 border-t border-zinc-800/80">
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                    Card & Feed Density
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Controls spacing, font size, and preview line heights across the dashboard.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Compact */}
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      onDensityChange?.('compact');
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-center transition touch-manipulation ${
                      (currentDensity || 'cozy') === 'compact'
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="p-2 rounded-full bg-zinc-800 text-brand-400">
                      <Minimize2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm block">Compact</span>
                      <span className="text-[11px] text-zinc-400">Tight spacing, 2-line clamp</span>
                    </div>
                  </button>

                  {/* Comfortable */}
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      onDensityChange?.('comfortable');
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-center transition touch-manipulation ${
                      currentDensity === 'comfortable'
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="p-2 rounded-full bg-zinc-800 text-brand-400">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm block">Comfortable</span>
                      <span className="text-[11px] text-zinc-400">Balanced, 4-line clamp</span>
                    </div>
                  </button>

                  {/* Cozy (Default) */}
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      onDensityChange?.('cozy');
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-center transition touch-manipulation ${
                      (currentDensity || 'cozy') === 'cozy'
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="p-2 rounded-full bg-zinc-800 text-brand-400">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm block">Cozy (Default)</span>
                      <span className="text-[11px] text-zinc-400">Spacious, 6-line clamp</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NOTE PRIORITIES & COLOR CODING */}
          {activeTab === 'priorities' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                    Custom Note Priorities
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Define labels and set custom colors to color-code your notes in feed and list views.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetPriorities}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition"
                  title="Reset to default priorities"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset Defaults</span>
                </button>
              </div>

              {/* Priorities List */}
              <div className="space-y-2.5">
                {localPriorities.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{ borderLeftColor: p.color, borderLeftWidth: '4px' }}
                  >
                    {/* Left: Input & Preview */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Color Picker / Swatch */}
                      <div className="relative group shrink-0">
                        <input
                          type="color"
                          value={p.color}
                          onChange={(e) => handleUpdatePriority(p.id, 'color', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 opacity-0 absolute inset-0 z-10"
                        />
                        <div
                          className="w-8 h-8 rounded-lg border border-zinc-700/80 shadow-sm flex items-center justify-center transition group-hover:scale-105"
                          style={{ backgroundColor: p.color }}
                        />
                      </div>

                      {/* Label Input */}
                      <input
                        type="text"
                        value={p.label}
                        onChange={(e) => handleUpdatePriority(p.id, 'label', e.target.value)}
                        placeholder="Priority label..."
                        className="flex-1 min-w-0 bg-transparent text-sm font-bold text-zinc-100 focus:outline-none focus:border-b border-brand-500 py-1"
                      />

                      {/* Live Badge Preview */}
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border shrink-0"
                        style={{
                          backgroundColor: `${p.color}15`,
                          color: p.color,
                          borderColor: `${p.color}35`
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span>{p.label || 'Preview'}</span>
                      </span>
                    </div>

                    {/* Right: Quick Palette & Delete */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {PRESET_COLORS.slice(0, 5).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleUpdatePriority(p.id, 'color', color)}
                          className={`w-5 h-5 rounded-full border transition touch-manipulation ${
                            p.color === color ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: color, borderColor: 'rgba(255,255,255,0.2)' }}
                          title={color}
                        />
                      ))}

                      <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

                      <button
                        type="button"
                        onClick={() => handleDeletePriority(p.id)}
                        disabled={localPriorities.length <= 1}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-850 disabled:opacity-20 transition"
                        title="Delete priority"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Priority Button */}
              <button
                type="button"
                onClick={handleAddPriority}
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-zinc-700 hover:border-brand-500/60 bg-zinc-950/60 hover:bg-zinc-950 text-zinc-300 hover:text-brand-400 text-xs font-bold flex items-center justify-center gap-2 transition touch-manipulation active:scale-[0.99]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Priority Level</span>
              </button>
            </div>
          )}

          {/* TAB 3: SERVER & REALTIME SYNC */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                  Server Connection
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Universal WebSocket bi-directional state synchronization status.
                </p>

                <div className="mt-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        isConnected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                          : 'bg-red-500/10 text-red-400 border-red-500/25'
                      }`}
                    >
                      {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-100">
                          {isConnected ? 'Connected & Synced' : isConnecting ? 'Connecting...' : 'Disconnected'}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                          }`}
                        />
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {isConnected
                          ? 'Real-time WebSocket heartbeat active'
                          : reconnectAttempt > 0
                          ? `Attempting reconnects (attempt #${reconnectAttempt})...`
                          : 'Server connection offline'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={manualReconnect}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition active:scale-95 touch-manipulation disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                    <span>{isConnecting ? 'Connecting' : 'Reconnect'}</span>
                  </button>
                </div>

                {/* Server URL Configuration for Native APK & Custom Domains */}
                <div className="mt-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Server Backend URL</span>
                      {isNative && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-mono">
                          Android App
                        </span>
                      )}
                    </label>
                    {getServerUrl() && (
                      <button
                        type="button"
                        onClick={async () => {
                          await setServerUrl('');
                          setServerUrlInput('');
                          setConnectionTestResult({ success: true, message: 'Reset to default origin.' });
                          manualReconnect();
                        }}
                        className="text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={serverUrl}
                      onChange={(e) => {
                        setServerUrlInput(e.target.value);
                        setConnectionTestResult(null);
                      }}
                      placeholder={isNative ? "http://192.168.1.100:3000" : "Default (same-origin / relative)"}
                      className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-brand-500 font-mono placeholder:text-zinc-600"
                    />
                    <button
                      type="button"
                      disabled={testingConnection}
                      onClick={async () => {
                        try {
                          setTestingConnection(true);
                          setConnectionTestResult(null);
                          const saved = await setServerUrl(serverUrl);
                          setServerUrlInput(saved);
                          const res = await fetch(apiUrl('/health'));
                          if (res.ok) {
                            setConnectionTestResult({ success: true, message: `Connected! Target: ${saved || 'default'}` });
                            manualReconnect();
                          } else {
                            setConnectionTestResult({ success: false, message: `Server error: HTTP ${res.status}` });
                          }
                        } catch (err: any) {
                          setConnectionTestResult({ success: false, message: err.message || 'Could not reach server' });
                        } finally {
                          setTestingConnection(false);
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 touch-manipulation shrink-0 shadow-lg shadow-brand-500/20"
                    >
                      {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Save & Test</span>
                    </button>
                  </div>
                  {connectionTestResult && (
                    <p className={`text-xs ${connectionTestResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {connectionTestResult.message}
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    On Android, point to your Free Form server (e.g. local LAN <code className="text-zinc-400">http://192.168.1.x:3000</code> or Tailscale / public domain).
                  </p>
                </div>
                {/* Offline Storage & Bi-Directional Sync Status */}
                <div className="mt-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                          Offline Storage & Sync
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Persistent local IndexedDB with automatic delta merging.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={syncState.isSyncing}
                      onClick={async () => {
                        await syncService.performSync();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition active:scale-95 touch-manipulation disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                      <span>{syncState.isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px]">
                      <span className="text-zinc-500 block">Pending Offline Outbox:</span>
                      <span className="font-mono font-bold text-zinc-200">
                        {syncState.pendingCount === 0 ? '0 changes (in sync)' : `${syncState.pendingCount} queued change(s)`}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px]">
                      <span className="text-zinc-500 block">Last Synced:</span>
                      <span className="font-mono font-bold text-zinc-200 truncate block">
                        {syncState.lastSyncTime
                          ? new Date(syncState.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : 'Never synced'}
                      </span>
                    </div>
                  </div>

                  {conflicts.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-amber-300">
                        <GitMerge className="w-4 h-4 text-amber-400 shrink-0" />
                        <span><strong>{conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}</strong> need attention</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          setConflictModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition shadow-sm shrink-0"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Data Export & Backup */}
              <div className="pt-4 border-t border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                  Data Backup & Export
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Download a full offline archive of your notebooks, markdown files, and JSON database.
                </p>

                <div className="mt-3">
                  <a
                    href={getExportUrl()}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-800 transition shadow-sm touch-manipulation"
                  >
                    <Download className="w-4 h-4 text-brand-400" />
                    <span>Download Complete Workspace (ZIP)</span>
                  </a>
                </div>
              </div>

              {/* App Meta */}
              <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 text-xs text-zinc-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-300">Free Form Platform</span>
                  <span className="font-mono text-brand-400">v1.3.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Architecture</span>
                  <span>Fastify v5 + SQLite WAL + Vite PWA</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Storage Mode</span>
                  <span>Self-Hosted Local-First</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: API TOKENS & OUTBOUND WEBHOOKS */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* Personal Access Tokens */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide flex items-center gap-2">
                      <Key className="w-4 h-4 text-brand-400" />
                      <span>Personal Access Tokens (PATs)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Bearer tokens for CLI capture, Alfred/Raycast scripts, iOS Shortcuts, and automation.
                    </p>
                  </div>
                </div>

                {createdTokenRaw && (
                  <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">Token Generated (Copy Now — Won't Be Shown Again):</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(createdTokenRaw);
                          hapticTap();
                          showSavedNotification();
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-white px-2 py-1 rounded bg-emerald-500/20"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                    <code className="block text-xs font-mono text-zinc-200 bg-zinc-950 p-2 rounded border border-zinc-800 break-all select-all">
                      {createdTokenRaw}
                    </code>
                  </div>
                )}

                {/* Create token bar */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Token label (e.g. My Laptop CLI, Raycast)"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    disabled={!newTokenName.trim()}
                    onClick={async () => {
                      try {
                        const res = await createApiToken(newTokenName.trim(), 'read,write', 90);
                        setCreatedTokenRaw(res.token);
                        setNewTokenName('');
                        const updated = await fetchApiTokens();
                        setTokens(updated);
                        hapticTap();
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-bold text-xs transition"
                  >
                    Generate
                  </button>
                </div>

                {/* Tokens List */}
                <div className="mt-3 space-y-2">
                  {tokens.length === 0 ? (
                    <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 text-center text-xs text-zinc-500">
                      No API tokens active. Generate one above for headless terminal capture.
                    </div>
                  ) : (
                    tokens.map((tok) => (
                      <div
                        key={tok.id}
                        className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-200 truncate">{tok.name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                            <span>{tok.token_prefix}...</span>
                            <span>•</span>
                            <span>Scopes: {tok.scopes}</span>
                            <span>•</span>
                            <span>Created: {new Date(tok.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteApiToken(tok.id);
                            const updated = await fetchApiTokens();
                            setTokens(updated);
                            hapticTap();
                          }}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition"
                          title="Revoke Token"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Outbound Webhooks */}
              <div className="pt-4 border-t border-zinc-800 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide flex items-center gap-2">
                    <WebhookIcon className="w-4 h-4 text-brand-400" />
                    <span>Outbound Automation Webhooks</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Push JSON payloads to n8n, Zapier, Home Assistant, Slack with HMAC-SHA256 signatures.
                  </p>
                </div>

                {/* Create webhook form */}
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Webhook name (e.g. Home Assistant Kitchen)"
                      value={newWebhookName}
                      onChange={(e) => setNewWebhookName(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-500"
                    />
                    <input
                      type="url"
                      placeholder="Payload URL (https://...)"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Events filter: item.created,form_entry.submitted,counter.threshold,timer.completed or *"
                      value={newWebhookEvents}
                      onChange={(e) => setNewWebhookEvents(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      disabled={!newWebhookName.trim() || !newWebhookUrl.trim()}
                      onClick={async () => {
                        try {
                          await createWebhook({
                            name: newWebhookName.trim(),
                            url: newWebhookUrl.trim(),
                            events: newWebhookEvents.trim() || '*'
                          });
                          setNewWebhookName('');
                          setNewWebhookUrl('');
                          const updated = await fetchWebhooks();
                          setWebhooks(updated);
                          hapticTap();
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-bold text-xs transition shrink-0"
                    >
                      Add Hook
                    </button>
                  </div>
                </div>

                {/* Webhooks list */}
                <div className="space-y-2">
                  {webhooks.length === 0 ? (
                    <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 text-center text-xs text-zinc-500">
                      No webhooks configured. Add a destination URL above.
                    </div>
                  ) : (
                    webhooks.map((hook) => (
                      <div
                        key={hook.id}
                        className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-200">{hook.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                hook.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              {hook.is_active ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                setWebhookTestStatus((s) => ({ ...s, [hook.id]: 'Testing...' }));
                                try {
                                  const res = await testWebhook(hook.id);
                                  setWebhookTestStatus((s) => ({
                                    ...s,
                                    [hook.id]: res.success ? '200 OK' : `HTTP ${res.status}`
                                  }));
                                } catch (e: any) {
                                  setWebhookTestStatus((s) => ({ ...s, [hook.id]: 'Error' }));
                                }
                              }}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold transition"
                            >
                              {webhookTestStatus[hook.id] || 'Test Ping'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await updateWebhook(hook.id, { is_active: hook.is_active ? 0 : 1 });
                                const updated = await fetchWebhooks();
                                setWebhooks(updated);
                              }}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] transition"
                            >
                              {hook.is_active ? 'Pause' : 'Resume'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteWebhook(hook.id);
                                const updated = await fetchWebhooks();
                                setWebhooks(updated);
                              }}
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="font-mono text-[11px] text-zinc-400 truncate">{hook.url}</div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                          <span>Events: {hook.events}</span>
                          <span>•</span>
                          <span>Secret: {hook.secret.substring(0, 8)}...</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: VAULT IMPORTERS (OBSIDIAN & GOOGLE KEEP) */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide flex items-center gap-2">
                  <Upload className="w-4 h-4 text-brand-400" />
                  <span>Universal Vault & Note Importers</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Migrate seamlessly to Free Form from Obsidian or Google Takeout with zero data loss.
                </p>
              </div>

              {importStatus && (
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-brand-500/40 text-xs text-zinc-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>{importStatus}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Obsidian Importer Card */}
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                      O
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100">Obsidian Vault (ZIP)</h4>
                      <p className="text-[11px] text-zinc-400">Folders to notebooks, YAML tags, [[wikilinks]].</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Zip your Obsidian vault folder and upload it here. Free Form preserves nested hierarchy, aliases, tags, and bi-directional graph connections.
                  </p>
                  <input
                    ref={obsidianInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsImporting(true);
                      setImportStatus('Extracting vault and importing notes...');
                      try {
                        const res = await importObsidianVault(file);
                        setImportStatus(res.message);
                        hapticTap();
                      } catch (err: any) {
                        setImportStatus(`Import failed: ${err.message}`);
                      } finally {
                        setIsImporting(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => obsidianInputRef.current?.click()}
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Obsidian Vault (.zip)</span>
                  </button>
                </div>

                {/* Google Keep Importer Card */}
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                      K
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100">Google Keep (JSON)</h4>
                      <p className="text-[11px] text-zinc-400">Takeout JSON notes, checklists, and labels.</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Upload your Google Takeout Keep JSON files. Checklist items are automatically converted to GFM checkboxes and labels become tags.
                  </p>
                  <input
                    ref={keepInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsImporting(true);
                      setImportStatus('Parsing Google Keep JSON notes...');
                      try {
                        const text = await file.text();
                        const json = JSON.parse(text);
                        const res = await importGoogleKeep(json);
                        setImportStatus(res.message);
                        hapticTap();
                      } catch (err: any) {
                        setImportStatus(`Import failed: ${err.message}`);
                      } finally {
                        setIsImporting(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => keepInputRef.current?.click()}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Google Keep (.json)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
