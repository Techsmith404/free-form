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
  Check
} from 'lucide-react';
import { ThemeMode, NotePriority, AppSettings } from '../../types/index.js';
import { useRealtime } from '../../context/RealtimeContext.js';
import { getExportUrl, getServerUrl, setServerUrl, apiUrl } from '../../api/index.js';
import { isNative } from '../../services/native.js';
import { syncService, SyncState } from '../../services/syncService.js';
import { GitMerge, Database, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  priorities,
  onPrioritiesChange
}) => {
  const { isConnected, isConnecting, reconnectAttempt, manualReconnect, conflicts, setConflictModalOpen } = useRealtime();
  const [localPriorities, setLocalPriorities] = useState<NotePriority[]>(priorities);
  const [activeTab, setActiveTab] = useState<'appearance' | 'priorities' | 'system'>('appearance');
  const [savedToast, setSavedToast] = useState(false);
  const [serverUrl, setServerUrlInput] = useState(getServerUrl());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(syncService.getState());

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
              <h2 className="text-lg font-bold text-zinc-100">Settings</h2>
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3.5">
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
                      <span className="font-bold text-sm block">Light Mode</span>
                      <span className="text-[11px] text-zinc-400">Clean, crisp high contrast</span>
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
                      <span className="font-bold text-sm block">Dark Mode</span>
                      <span className="text-[11px] text-zinc-400">Deep obsidian dark aesthetic</span>
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
                      <span className="font-bold text-sm block">Follow System</span>
                      <span className="text-[11px] text-zinc-400">Sync with device schedule</span>
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
                          await setServerUrl(serverUrl);
                          const res = await fetch(apiUrl('/settings'));
                          if (res.ok) {
                            setConnectionTestResult({ success: true, message: 'Server reached successfully!' });
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
        </div>
      </div>
    </div>
  );
};
