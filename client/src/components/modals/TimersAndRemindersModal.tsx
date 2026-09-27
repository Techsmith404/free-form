import React, { useState, useEffect } from 'react';
import { useRealtime } from '../../context/RealtimeContext.js';
import { Notebook, Timer, Reminder } from '../../types/index.js';
import { hapticTap, hapticMedium, hapticSuccess } from '../../services/native.js';
import {
  X,
  Clock,
  Bell,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Plus,
  Check,
  Calendar,
  AlertCircle,
  Wifi,
  Sparkles
} from 'lucide-react';



interface TimersAndRemindersModalProps {
  open: boolean;
  onClose: () => void;
  notebooks: Notebook[];
}

export const TimersAndRemindersModal: React.FC<TimersAndRemindersModalProps> = ({
  open,
  onClose,
  notebooks
}) => {
  const {
    timers,
    reminders,
    isConnected,
    createTimer,
    startTimer,
    pauseTimer,
    resetTimer,
    dismissTimer,
    deleteTimer,
    createReminder,
    completeReminder,
    snoozeReminder,
    deleteReminder
  } = useRealtime();

  const [activeTab, setActiveTab] = useState<'timers' | 'reminders'>('timers');

  // New Timer Form State
  const [timerTitle, setTimerTitle] = useState('');
  const [timerMinutes, setTimerMinutes] = useState<number>(10);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerNotebookId, setTimerNotebookId] = useState<string>('');

  // New Reminder Form State
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [reminderDueDate, setReminderDueDate] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
    return d.toISOString().slice(0, 16);
  });
  const [reminderPriority, setReminderPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [reminderNotebookId, setReminderNotebookId] = useState<string>('');

  // Local ticker to re-render countdowns every second
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  const presets = [
    { label: '1 min', seconds: 60 },
    { label: '5 min', seconds: 300 },
    { label: '10 min', seconds: 600 },
    { label: '15 min', seconds: 900 },
    { label: '25 min (Pomodoro)', seconds: 1500 },
    { label: '30 min', seconds: 1800 },
    { label: '45 min', seconds: 2700 },
    { label: '1 hour', seconds: 3600 }
  ];

  const handleStartPreset = async (preset: { label: string; seconds: number }) => {
    hapticMedium();
    await createTimer({
      title: timerTitle.trim() || preset.label,
      duration_seconds: preset.seconds,
      notebook_id: timerNotebookId || null,
      auto_start: true
    });
    setTimerTitle('');
  };

  const handleCreateCustomTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalSeconds = timerMinutes * 60 + timerSeconds;
    if (totalSeconds <= 0) return;

    hapticSuccess();
    await createTimer({
      title: timerTitle.trim() || `${timerMinutes}m Timer`,
      duration_seconds: totalSeconds,
      notebook_id: timerNotebookId || null,
      auto_start: true
    });

    setTimerTitle('');
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderDueDate) return;

    hapticSuccess();
    await createReminder({
      title: reminderTitle.trim(),
      notes: reminderNotes.trim(),
      due_date: new Date(reminderDueDate).toISOString(),
      priority: reminderPriority,
      notebook_id: reminderNotebookId || null
    });

    setReminderTitle('');
    setReminderNotes('');
  };

  // Helper to format remaining time accurately
  const getRemainingTime = (timer: Timer) => {
    if (timer.status === 'running' && timer.target_end_time) {
      const remainingMs = new Date(timer.target_end_time).getTime() - Date.now();
      return Math.max(0, Math.round(remainingMs / 1000));
    }
    return timer.remaining_seconds;
  };

  const formatSeconds = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-zinc-950 border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                Universal Synced Timers & Reminders
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'} inline-block`} />
                <span>{isConnected ? 'Real-time cross-device sync active' : 'Connecting to sync service...'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 transition min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-zinc-800/80 bg-zinc-900/50 px-5 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              hapticTap();
              setActiveTab('timers');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition min-h-[44px] touch-manipulation ${
              activeTab === 'timers'
                ? 'border-brand-500 text-brand-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Timers ({timers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              hapticTap();
              setActiveTab('reminders');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition min-h-[44px] touch-manipulation ${
              activeTab === 'reminders'
                ? 'border-brand-500 text-brand-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Reminders ({reminders.filter((r) => r.status !== 'completed').length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* ======================= TIMERS TAB ======================= */}
          {activeTab === 'timers' && (
            <div className="space-y-6">
              {/* Quick Presets */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Quick Start Presets
                </label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleStartPreset(preset)}
                      className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200 transition active:scale-95 min-h-[40px] touch-manipulation flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Timer Form */}
              <form onSubmit={handleCreateCustomTimer} className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs text-zinc-400 mb-1">Timer Title</label>
                    <input
                      type="text"
                      value={timerTitle}
                      onChange={(e) => setTimerTitle(e.target.value)}
                      placeholder="e.g. Pasta, Laundry, Break"
                      className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      value={timerMinutes}
                      onChange={(e) => setTimerMinutes(parseInt(e.target.value) || 0)}
                      className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Seconds</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timerSeconds}
                      onChange={(e) => setTimerSeconds(parseInt(e.target.value) || 0)}
                      className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <select
                    value={timerNotebookId}
                    onChange={(e) => setTimerNotebookId(e.target.value)}
                    className="h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-brand-500 max-w-xs"
                  >
                    <option value="">No Notebook</option>
                    {notebooks.map((nb) => (
                      <option key={nb.id} value={nb.id}>
                        {nb.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    className="h-11 px-5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-md shadow-brand-500/20 transition touch-manipulation shrink-0"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Timer</span>
                  </button>
                </div>
              </form>



              {/* Active Timers List */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Active & Recent Timers
                </label>

                {timers.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-zinc-800 rounded-2xl text-zinc-500 text-sm">
                    No timers yet. Pick a preset above or start a custom timer.
                  </div>
                ) : (
                  timers.map((timer) => {
                    const remaining = getRemainingTime(timer);
                    const progressPercent = Math.min(100, Math.max(0, ((timer.duration_seconds - remaining) / timer.duration_seconds) * 100));
                    const isRinging = timer.status === 'ringing';
                    const isRunning = timer.status === 'running';

                    return (
                      <div
                        key={timer.id}
                        className={`p-4 rounded-2xl border transition ${
                          isRinging
                            ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-500/20 animate-pulse'
                            : isRunning
                            ? 'bg-zinc-900 border-zinc-800 shadow-sm'
                            : 'bg-zinc-900/60 border-zinc-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-white truncate">
                              {timer.title}
                            </h3>
                            <span className="text-xs text-zinc-400">
                              Duration: {formatSeconds(timer.duration_seconds)}
                            </span>
                          </div>

                          <div className={`text-2xl sm:text-3xl font-mono font-black ${
                            isRinging ? 'text-red-400' : isRunning ? 'text-emerald-400' : 'text-zinc-300'
                          }`}>
                            {formatSeconds(remaining)}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isRinging ? 'bg-red-500' : isRunning ? 'bg-emerald-500' : 'bg-zinc-600'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5">
                            {isRunning ? (
                              <button
                                type="button"
                                onClick={() => {
                                  hapticTap();
                                  pauseTimer(timer.id);
                                }}
                                className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition active:scale-95 touch-manipulation"
                              >
                                <Pause className="w-3.5 h-3.5" />
                                <span>Pause</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  hapticMedium();
                                  startTimer(timer.id);
                                }}
                                className="h-9 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition active:scale-95 touch-manipulation"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>{timer.status === 'paused' ? 'Resume' : 'Start'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                hapticTap();
                                resetTimer(timer.id);
                              }}
                              className="h-9 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition active:scale-95 touch-manipulation"
                              title="Reset"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>

                            {isRinging && (
                              <button
                                type="button"
                                onClick={() => {
                                  hapticTap();
                                  dismissTimer(timer.id);
                                }}
                                className="h-9 px-3 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-red-500/30 touch-manipulation"
                              >
                                <span>Stop Ringing</span>
                              </button>
                            )}


                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              hapticTap();
                              deleteTimer(timer.id);
                            }}
                            className="h-9 w-9 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg flex items-center justify-center transition active:scale-95 touch-manipulation"
                            title="Delete Timer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ======================= REMINDERS TAB ======================= */}
          {activeTab === 'reminders' && (
            <div className="space-y-6">
              {/* Add Reminder Form */}
              <form onSubmit={handleCreateReminder} className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Reminder Title</label>
                  <input
                    type="text"
                    required
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    placeholder="e.g. Check roast in the oven, Pay bill, Call Alex"
                    className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Due Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={reminderDueDate}
                      onChange={(e) => setReminderDueDate(e.target.value)}
                      className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Priority</label>
                    <select
                      value={reminderPriority}
                      onChange={(e) => setReminderPriority(e.target.value as any)}
                      className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="low">Low Priority</option>
                      <option value="normal">Normal Priority</option>
                      <option value="high">High Priority 🚨</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Notebook</label>
                    <select
                      value={reminderNotebookId}
                      onChange={(e) => setReminderNotebookId(e.target.value)}
                      className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="">No Notebook</option>
                      {notebooks.map((nb) => (
                        <option key={nb.id} value={nb.id}>
                          {nb.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={reminderNotes}
                    onChange={(e) => setReminderNotes(e.target.value)}
                    placeholder="Additional context or instructions..."
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-500 resize-none"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="h-11 px-5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-md shadow-brand-500/20 transition touch-manipulation"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Set Reminder</span>
                  </button>
                </div>
              </form>

              {/* Reminders List */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Scheduled Reminders
                </label>

                {reminders.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-zinc-800 rounded-2xl text-zinc-500 text-sm">
                    No reminders scheduled. Add one above!
                  </div>
                ) : (
                  reminders.map((reminder) => {
                    const isCompleted = reminder.status === 'completed';
                    const isTriggered = reminder.status === 'triggered';
                    const dueDate = new Date(reminder.due_date);

                    return (
                      <div
                        key={reminder.id}
                        className={`p-4 rounded-2xl border transition flex items-start gap-3.5 ${
                          isTriggered
                            ? 'bg-red-950/40 border-red-500/80 shadow-md shadow-red-500/20'
                            : isCompleted
                            ? 'bg-zinc-900/40 border-zinc-800/40 opacity-60'
                            : 'bg-zinc-900 border-zinc-800'
                        }`}
                      >
                        {/* Checkbox button */}
                        <button
                          type="button"
                          onClick={() => {
                            hapticTap();
                            completeReminder(reminder.id);
                          }}
                          className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-zinc-700 hover:border-emerald-500 text-transparent hover:text-emerald-400'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`text-sm font-bold ${isCompleted ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                              {reminder.title}
                            </h4>
                            {reminder.priority === 'high' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30">
                                High
                              </span>
                            )}
                          </div>

                          {reminder.notes && (
                            <p className="text-xs text-zinc-400 mt-1">
                              {reminder.notes}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{dueDate.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() => {
                                hapticTap();
                                snoozeReminder(reminder.id, 10);
                              }}
                              className="h-8 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold rounded-lg transition active:scale-95 touch-manipulation"
                              title="Snooze 10m"
                            >
                              +10m
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              hapticTap();
                              deleteReminder(reminder.id);
                            }}
                            className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg flex items-center justify-center transition active:scale-95 touch-manipulation"
                            title="Delete Reminder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
