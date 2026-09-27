import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, RotateCcw, Info, X, Loader2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'warning' | 'reset' | 'info';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  icon,
  isLoading = false,
  onConfirm,
  onClose
}) => {
  // Listen for Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  // Determine icon to render
  const resolvedIcon = icon || (confirmVariant === 'danger' ? 'trash' : confirmVariant === 'warning' ? 'warning' : 'info');

  const renderIcon = () => {
    switch (resolvedIcon) {
      case 'trash':
        return (
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
        );
      case 'reset':
        return (
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
            <Info className="w-6 h-6" />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-lg shadow-red-950/40 border border-red-500/30';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white shadow-lg shadow-amber-950/40 border border-amber-500/30';
      case 'primary':
      default:
        return 'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-lg shadow-brand-950/40 border border-brand-400/30';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-md bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle indicator */}
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mt-3 sm:hidden" />

        <div className="p-5 sm:p-6 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {renderIcon()}
              <div>
                <h3 className="text-lg font-bold text-zinc-100 leading-snug">
                  {title}
                </h3>
                <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition p-1 rounded-lg touch-manipulation"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row items-center gap-2.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 font-medium text-sm transition touch-manipulation disabled:opacity-40"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`w-full sm:flex-1 min-h-[44px] py-2.5 px-4 rounded-xl font-medium text-sm transition active:scale-95 flex items-center justify-center gap-2 touch-manipulation disabled:opacity-50 ${getConfirmButtonClasses()}`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
