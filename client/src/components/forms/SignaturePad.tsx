import React, { useRef, useState, useEffect } from 'react';
import { uploadBase64 } from '../../api/index.js';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  value?: string; // existing image URL
  onChange: (url: string) => void;
  label?: string;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  value,
  onChange,
  label = 'Signature',
  disabled = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string>(value || '');

  useEffect(() => {
    setSignatureUrl(value || '');
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#22c55e'; // Brand emerald ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [signatureUrl]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || signatureUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || signatureUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setSignatureUrl('');
    setError(null);
    onChange('');
  };

  const handleSaveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    try {
      setSaving(true);
      setError(null);
      const dataUrl = canvas.toDataURL('image/png');
      const uploaded = await uploadBase64(dataUrl, 'signature.png');
      setSignatureUrl(uploaded.url);
      onChange(uploaded.url);
    } catch (err) {
      console.error('Failed to save signature', err);
      setError('Failed to save signature. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-300">
        <label className="font-medium flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-brand-400" />
          <span>{label}</span>
        </label>
        {signatureUrl ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-red-400 hover:text-red-300 transition"
          >
            Clear & Re-sign
          </button>
        ) : (
          hasDrawn && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSaveSignature}
                disabled={saving}
                className="flex items-center gap-1 text-xs px-2 py-0.5 bg-brand-500 hover:bg-brand-600 text-white rounded font-medium transition"
              >
                <Check className="w-3 h-3" />
                <span>{saving ? 'Saving...' : 'Confirm'}</span>
              </button>
            </div>
          )
        )}
      </div>

      <div className="relative w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
        {signatureUrl ? (
          <div className="relative w-full h-full flex items-center justify-center p-2 bg-zinc-950/80">
            <img
              src={signatureUrl}
              alt="Signed signature"
              className="max-h-full max-w-full object-contain filter drop-shadow"
            />
            <div className="absolute bottom-1 right-2 text-[10px] text-brand-400 font-mono">
              ✓ Signed
            </div>
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-full cursor-crosshair touch-none"
            />
            {!hasDrawn && (
              <div className="absolute pointer-events-none text-xs text-zinc-600 flex items-center gap-1.5">
                <span>Sign here with finger or mouse</span>
              </div>
            )}
            <div className="absolute bottom-6 inset-x-8 border-b border-dashed border-zinc-800 pointer-events-none" />
          </>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
};
