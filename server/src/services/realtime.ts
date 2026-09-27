import WebSocket, { WebSocket as WSClient } from 'ws';
import { db } from '../db/index.js';
import { Timer, Reminder, RealtimeEvent } from '../types/index.js';

// Connected active clients
const clients = new Set<WSClient>();

export function addClient(ws: WSClient) {
  clients.add(ws);
  // Send current state on connection
  try {
    const timers = getAllTimers();
    const reminders = getAllReminders();
    const conflictRows = db.prepare("SELECT * FROM conflicts WHERE status = 'unresolved' ORDER BY created_at DESC").all() as any[];
    const conflicts = conflictRows.map(r => ({
      ...r,
      active_metadata: JSON.parse(r.active_metadata || '{}'),
      conflict_metadata: JSON.parse(r.conflict_metadata || '{}'),
    }));

    ws.send(JSON.stringify({
      type: 'SYNC_STATE',
      payload: { timers, reminders, conflicts }
    } as RealtimeEvent));
  } catch (err) {
    console.error('Failed to send initial sync state:', err);
  }

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });

  ws.on('message', (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());
      handleClientMessage(msg);
    } catch {}
  });
}

export function broadcast(event: RealtimeEvent) {
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch {
        clients.delete(client);
      }
    }
  }
}

function handleClientMessage(msg: any) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'DISMISS_TIMER':
      if (msg.timerId) dismissTimer(msg.timerId);
      break;
    case 'START_TIMER':
      if (msg.timerId) startTimer(msg.timerId);
      break;
    case 'PAUSE_TIMER':
      if (msg.timerId) pauseTimer(msg.timerId);
      break;
    case 'RESET_TIMER':
      if (msg.timerId) resetTimer(msg.timerId);
      break;
    case 'DISMISS_REMINDER':
      if (msg.reminderId) dismissReminder(msg.reminderId);
      break;
    case 'COMPLETE_REMINDER':
      if (msg.reminderId) completeReminder(msg.reminderId);
      break;
    case 'PING':
      // Heartbeat
      break;
  }
}

// -----------------------------------------------------------------------------
// TIMER DATABASE OPERATIONS
// -----------------------------------------------------------------------------

export function getAllTimers(): Timer[] {
  return db.prepare(`
    SELECT * FROM timers 
    ORDER BY 
      CASE status 
        WHEN 'ringing' THEN 1 
        WHEN 'running' THEN 2 
        WHEN 'paused' THEN 3 
        WHEN 'idle' THEN 4 
        ELSE 5 
      END,
      created_at DESC
  `).all() as Timer[];
}

export function getTimerById(id: string): Timer | undefined {
  return db.prepare('SELECT * FROM timers WHERE id = ?').get(id) as Timer | undefined;
}

export function createTimer(params: {
  title: string;
  duration_seconds: number;
  notebook_id?: string | null;
  auto_start?: boolean;
}): Timer {
  const id = 'tm-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const duration = Math.max(1, params.duration_seconds);
  const autoStart = Boolean(params.auto_start);

  const status = autoStart ? 'running' : 'idle';
  const targetEndTime = autoStart ? new Date(Date.now() + duration * 1000).toISOString() : null;
  const startedAt = autoStart ? now : null;

  db.prepare(`
    INSERT INTO timers (
      id, title, duration_seconds, remaining_seconds, status, 
      target_end_time, started_at, paused_at, completed_at, 
      notebook_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.title || 'Timer',
    duration,
    duration,
    status,
    targetEndTime,
    startedAt,
    null,
    null,
    params.notebook_id || null,
    now,
    now
  );

  const timer = getTimerById(id)!;
  broadcast({ type: 'TIMER_UPDATED', payload: { timer } });
  return timer;
}

export function startTimer(id: string): Timer | null {
  const timer = getTimerById(id);
  if (!timer) return null;

  const now = new Date().toISOString();
  const remaining = timer.remaining_seconds > 0 ? timer.remaining_seconds : timer.duration_seconds;
  const targetEndTime = new Date(Date.now() + remaining * 1000).toISOString();

  db.prepare(`
    UPDATE timers SET
      status = 'running',
      remaining_seconds = ?,
      target_end_time = ?,
      started_at = COALESCE(started_at, ?),
      paused_at = null,
      updated_at = ?
    WHERE id = ?
  `).run(remaining, targetEndTime, now, now, id);

  const updated = getTimerById(id)!;
  broadcast({ type: 'TIMER_UPDATED', payload: { timer: updated } });
  return updated;
}

export function pauseTimer(id: string): Timer | null {
  const timer = getTimerById(id);
  if (!timer || timer.status !== 'running') return timer || null;

  const now = new Date().toISOString();
  let remaining = timer.remaining_seconds;
  if (timer.target_end_time) {
    const diff = Math.max(0, Math.round((new Date(timer.target_end_time).getTime() - Date.now()) / 1000));
    remaining = diff;
  }

  db.prepare(`
    UPDATE timers SET
      status = 'paused',
      remaining_seconds = ?,
      target_end_time = null,
      paused_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(remaining, now, now, id);

  const updated = getTimerById(id)!;
  broadcast({ type: 'TIMER_UPDATED', payload: { timer: updated } });
  return updated;
}

export function resetTimer(id: string): Timer | null {
  const timer = getTimerById(id);
  if (!timer) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE timers SET
      status = 'idle',
      remaining_seconds = duration_seconds,
      target_end_time = null,
      started_at = null,
      paused_at = null,
      completed_at = null,
      updated_at = ?
    WHERE id = ?
  `).run(now, id);

  const updated = getTimerById(id)!;
  broadcast({ type: 'TIMER_UPDATED', payload: { timer: updated } });
  return updated;
}

export function dismissTimer(id: string): Timer | null {
  const timer = getTimerById(id);
  if (!timer) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE timers SET
      status = 'dismissed',
      target_end_time = null,
      updated_at = ?
    WHERE id = ?
  `).run(now, id);

  const updated = getTimerById(id)!;
  // Broadcast dismissal event so all connected devices stop playing audio immediately
  broadcast({ type: 'TIMER_DISMISSED', payload: { timerId: id } });
  broadcast({ type: 'TIMER_UPDATED', payload: { timer: updated } });
  return updated;
}

export function deleteTimer(id: string): boolean {
  const res = db.prepare('DELETE FROM timers WHERE id = ?').run(id);
  if (res.changes > 0) {
    broadcast({ type: 'TIMER_DELETED', payload: { timerId: id } });
    return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// REMINDER DATABASE OPERATIONS
// -----------------------------------------------------------------------------

export function getAllReminders(): Reminder[] {
  return db.prepare(`
    SELECT * FROM reminders 
    ORDER BY 
      CASE status 
        WHEN 'triggered' THEN 1 
        WHEN 'pending' THEN 2 
        WHEN 'dismissed' THEN 3 
        ELSE 4 
      END,
      due_date ASC
  `).all() as Reminder[];
}

export function getReminderById(id: string): Reminder | undefined {
  return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as Reminder | undefined;
}

export function createReminder(params: {
  title: string;
  notes?: string;
  due_date: string;
  priority?: 'low' | 'normal' | 'high';
  notebook_id?: string | null;
}): Reminder {
  const id = 'rm-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO reminders (
      id, title, notes, due_date, status, priority, notebook_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.title,
    params.notes || '',
    params.due_date,
    'pending',
    params.priority || 'normal',
    params.notebook_id || null,
    now,
    now
  );

  const reminder = getReminderById(id)!;
  broadcast({ type: 'REMINDER_UPDATED', payload: { reminder } });
  return reminder;
}

export function updateReminder(id: string, updates: Partial<Reminder>): Reminder | null {
  const existing = getReminderById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE reminders SET
      title = COALESCE(?, title),
      notes = COALESCE(?, notes),
      due_date = COALESCE(?, due_date),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      notebook_id = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    updates.title !== undefined ? updates.title : null,
    updates.notes !== undefined ? updates.notes : null,
    updates.due_date !== undefined ? updates.due_date : null,
    updates.status !== undefined ? updates.status : null,
    updates.priority !== undefined ? updates.priority : null,
    updates.notebook_id !== undefined ? updates.notebook_id : existing.notebook_id,
    now,
    id
  );

  const updated = getReminderById(id)!;
  broadcast({ type: 'REMINDER_UPDATED', payload: { reminder: updated } });
  return updated;
}

export function completeReminder(id: string): Reminder | null {
  return updateReminder(id, { status: 'completed' });
}

export function dismissReminder(id: string): Reminder | null {
  const reminder = updateReminder(id, { status: 'dismissed' });
  if (reminder) {
    broadcast({ type: 'REMINDER_DISMISSED', payload: { reminderId: id } });
  }
  return reminder;
}

export function snoozeReminder(id: string, minutes: number = 5): Reminder | null {
  const existing = getReminderById(id);
  if (!existing) return null;

  const baseTime = Math.max(Date.now(), new Date(existing.due_date).getTime());
  const newDue = new Date(baseTime + Math.max(1, minutes) * 60 * 1000).toISOString();
  const reminder = updateReminder(id, { due_date: newDue, status: 'pending' });
  if (reminder) {
    broadcast({ type: 'REMINDER_DISMISSED', payload: { reminderId: id } });
  }
  return reminder;
}

export function deleteReminder(id: string): boolean {
  const res = db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  if (res.changes > 0) {
    broadcast({ type: 'REMINDER_DELETED', payload: { reminderId: id } });
    return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// REALTIME BACKGROUND TICKER
// -----------------------------------------------------------------------------

let tickerInterval: NodeJS.Timeout | null = null;

export function startRealtimeTicker() {
  if (tickerInterval) return;

  tickerInterval = setInterval(() => {
    try {
      const now = Date.now();
      const nowIso = new Date().toISOString();

      // 1. Check running timers
      const runningTimers = db.prepare(`
        SELECT * FROM timers WHERE status = 'running'
      `).all() as Timer[];

      for (const timer of runningTimers) {
        if (timer.target_end_time) {
          const endTime = new Date(timer.target_end_time).getTime();
          if (now >= endTime) {
            // Timer expired! Transition to ringing
            db.prepare(`
              UPDATE timers SET
                status = 'ringing',
                remaining_seconds = 0,
                completed_at = ?,
                updated_at = ?
              WHERE id = ?
            `).run(nowIso, nowIso, timer.id);

            const updated = getTimerById(timer.id)!;
            broadcast({ type: 'TIMER_RING', payload: { timer: updated } });
            broadcast({ type: 'TIMER_UPDATED', payload: { timer: updated } });
          }
        }
      }

      // 2. Check pending reminders
      const pendingReminders = db.prepare(`
        SELECT * FROM reminders WHERE status = 'pending'
      `).all() as Reminder[];

      for (const reminder of pendingReminders) {
        const dueTime = new Date(reminder.due_date).getTime();
        if (now >= dueTime) {
          // Reminder triggered!
          db.prepare(`
            UPDATE reminders SET
              status = 'triggered',
              updated_at = ?
            WHERE id = ?
          `).run(nowIso, reminder.id);

          const updated = getReminderById(reminder.id)!;
          broadcast({ type: 'REMINDER_TRIGGER', payload: { reminder: updated } });
          broadcast({ type: 'REMINDER_UPDATED', payload: { reminder: updated } });
        }
      }
    } catch (err) {
      console.error('Error in realtime ticker:', err);
    }
  }, 1000);
}

export function stopRealtimeTicker() {
  if (tickerInterval) {
    clearInterval(tickerInterval);
    tickerInterval = null;
  }
}
