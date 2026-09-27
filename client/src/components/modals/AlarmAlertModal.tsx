import React from 'react';
import { useRealtime } from '../../context/RealtimeContext.js';
import { Bell, Clock, Check, BellOff, Volume2 } from 'lucide-react';
import { hapticTap, hapticHeavy, hapticSuccess } from '../../services/native.js';

export const AlarmAlertModal: React.FC = () => {
  const { ringingTimer, triggeredReminder, dismissTimer, dismissReminder, snoozeReminder, completeReminder } = useRealtime();

  if (!ringingTimer && !triggeredReminder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border-2 border-red-500 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-red-500/20 text-center animate-bounce-subtle">
        {/* Pulsing Alarm Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-5 animate-pulse">
          <Bell className="w-10 h-10 text-red-400 animate-wiggle" />
        </div>

        {/* Audio Indicator */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold mb-3">
          <Volume2 className="w-3.5 h-3.5 animate-pulse" />
          <span>Ringing all connected devices</span>
        </div>

        {/* Title & Info */}
        {ringingTimer && (
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Timer Finished!
            </h2>
            <p className="text-lg font-medium text-zinc-300">
              "{ringingTimer.title}"
            </p>
            <p className="text-xs text-zinc-500">
              Stopping the alarm on this device will silence all your other screens.
            </p>
          </div>
        )}

        {triggeredReminder && (
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Reminder Due!
            </h2>
            <p className="text-lg font-medium text-zinc-300">
              "{triggeredReminder.title}"
            </p>
            {triggeredReminder.notes && (
              <p className="text-sm text-zinc-400 max-h-20 overflow-y-auto px-2">
                {triggeredReminder.notes}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {ringingTimer && (
            <button
              type="button"
              onClick={() => {
                hapticHeavy();
                dismissTimer(ringingTimer.id);
              }}
              className="w-full min-h-[52px] bg-red-500 hover:bg-red-600 active:scale-98 text-white text-lg font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition touch-manipulation"
            >
              <BellOff className="w-6 h-6" />
              <span>STOP ALARM</span>
            </button>
          )}

          {triggeredReminder && (
            <>
              <button
                type="button"
                onClick={() => {
                  hapticSuccess();
                  completeReminder(triggeredReminder.id);
                }}
                className="w-full min-h-[52px] bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white text-base font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition touch-manipulation"
              >
                <Check className="w-5 h-5" />
                <span>Mark Completed</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    snoozeReminder(triggeredReminder.id, 5);
                  }}
                  className="flex-1 min-h-[44px] bg-zinc-800 hover:bg-zinc-700 active:scale-98 text-zinc-200 text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation"
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Snooze 5m</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    dismissReminder(triggeredReminder.id);
                  }}
                  className="flex-1 min-h-[44px] bg-zinc-800 hover:bg-zinc-700 active:scale-98 text-zinc-400 hover:text-zinc-200 text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation"
                >
                  <BellOff className="w-4 h-4" />
                  <span>Dismiss</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
