'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  MousePointer2,
  Pencil,
  Minus,
  Square,
  Circle,
  MoveRight,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Check,
  X,
  Plus,
} from 'lucide-react';

type Tool = 'select' | 'draw' | 'line' | 'rect' | 'circle' | 'arrow' | 'text';

interface Point {
  x: number;
  y: number;
}

interface Annotation {
  id: string;
  tool: Tool;
  color: string;
  strokeWidth: number;
  points?: Point[];
  start?: Point;
  end?: Point;
  text?: string;
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#ffffff', '#000000'];
const HIT_MARGIN = 10;

// Dual-stroke pencil cursor so it stays visible on both light and dark screenshots.
const PENCIL_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' fill='none' stroke='black' stroke-width='3'/%3E%3Cpath d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' fill='none' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 2 22, crosshair`;

const CURSOR_MAP: Record<Tool, string> = {
  select: 'default',
  draw: PENCIL_CURSOR,
  line: 'crosshair',
  rect: 'crosshair',
  circle: 'crosshair',
  arrow: 'crosshair',
  text: 'text',
};

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

interface ScreenshotAnnotatorProps {
  imageData: string;
  onSave: (annotatedBase64: string) => void;
  onCancel: () => void;
}

export default function ScreenshotAnnotator({
  imageData,
  onSave,
  onCancel,
}: ScreenshotAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  // Inline text editor (NEVER prompt())
  const [textInput, setTextInput] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);
  const [textValue, setTextValue] = useState('');

  const isCustomColor = !COLORS.includes(color);

  const fitCanvas = useCallback((img: HTMLImageElement) => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const maxW = container.clientWidth - 32;
    const maxH = container.clientHeight - 32;
    const s = Math.min(maxW / img.width, maxH / img.height, 1);
    setScale(s);

    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.width = `${img.width * s}px`;
    canvas.style.height = `${img.height * s}px`;
    setOffset({
      x: (maxW - img.width * s) / 2 + 16,
      y: (maxH - img.height * s) / 2 + 16,
    });
  }, []);

  // Load image and set canvas dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      fitCanvas(img);
    };
    img.src = imageData;
  }, [fitCanvas, imageData]);

  useEffect(() => {
    if (image) {
      const handleResize = () => fitCanvas(image);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [image, fitCanvas]);

  const getAnnotationBounds = (
    ann: Annotation
  ): { x: number; y: number; w: number; h: number } | null => {
    if (ann.tool === 'draw' && ann.points && ann.points.length) {
      const xs = ann.points.map((p) => p.x);
      const ys = ann.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    }
    if (ann.tool === 'text' && ann.start) {
      const fontSize = ann.strokeWidth * 6;
      const w = (ann.text?.length || 1) * fontSize * 0.6;
      return { x: ann.start.x, y: ann.start.y - fontSize, w, h: fontSize * 1.3 };
    }
    if (ann.start && ann.end) {
      const x = Math.min(ann.start.x, ann.end.x);
      const y = Math.min(ann.start.y, ann.end.y);
      return { x, y, w: Math.abs(ann.end.x - ann.start.x), h: Math.abs(ann.end.y - ann.start.y) };
    }
    return null;
  };

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    const allAnnotations = currentAnnotation
      ? [...annotations, currentAnnotation]
      : annotations;

    for (const ann of allAnnotations) {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = ann.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (ann.tool) {
        case 'draw':
          if (ann.points && ann.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(ann.points[0].x, ann.points[0].y);
            for (let i = 1; i < ann.points.length; i++) {
              ctx.lineTo(ann.points[i].x, ann.points[i].y);
            }
            ctx.stroke();
          }
          break;
        case 'line':
          if (ann.start && ann.end) {
            ctx.beginPath();
            ctx.moveTo(ann.start.x, ann.start.y);
            ctx.lineTo(ann.end.x, ann.end.y);
            ctx.stroke();
          }
          break;
        case 'rect':
          if (ann.start && ann.end) {
            ctx.beginPath();
            ctx.rect(ann.start.x, ann.start.y, ann.end.x - ann.start.x, ann.end.y - ann.start.y);
            ctx.stroke();
          }
          break;
        case 'circle':
          if (ann.start && ann.end) {
            const rx = Math.abs(ann.end.x - ann.start.x) / 2;
            const ry = Math.abs(ann.end.y - ann.start.y) / 2;
            const cx = ann.start.x + (ann.end.x - ann.start.x) / 2;
            const cy = ann.start.y + (ann.end.y - ann.start.y) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        case 'arrow':
          if (ann.start && ann.end) {
            const dx = ann.end.x - ann.start.x;
            const dy = ann.end.y - ann.start.y;
            const angle = Math.atan2(dy, dx);
            const headLen = Math.max(15, ann.strokeWidth * 5);

            ctx.beginPath();
            ctx.moveTo(ann.start.x, ann.start.y);
            ctx.lineTo(ann.end.x, ann.end.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(ann.end.x, ann.end.y);
            ctx.lineTo(
              ann.end.x - headLen * Math.cos(angle - Math.PI / 6),
              ann.end.y - headLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(ann.end.x, ann.end.y);
            ctx.lineTo(
              ann.end.x - headLen * Math.cos(angle + Math.PI / 6),
              ann.end.y - headLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
          break;
        case 'text':
          if (ann.start && ann.text) {
            const fontSize = ann.strokeWidth * 6;
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillText(ann.text, ann.start.x, ann.start.y);
          }
          break;
      }

      // Dashed blue selection indicator
      if (ann.id === selectedId) {
        const bounds = getAnnotationBounds(ann);
        if (bounds) {
          ctx.save();
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
          ctx.restore();
        }
      }
    }
  }, [annotations, currentAnnotation, image, selectedId]);

  const canvasCoords = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev, annotations.map((a) => ({ ...a }))]);
    setRedoStack([]);
  }, [annotations]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, annotations.map((a) => ({ ...a }))]);
    setAnnotations(prev);
    setUndoStack((u) => u.slice(0, -1));
    setSelectedId(null);
  }, [annotations, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, annotations.map((a) => ({ ...a }))]);
    setAnnotations(next);
    setRedoStack((r) => r.slice(0, -1));
    setSelectedId(null);
  }, [annotations, redoStack]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushUndo();
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }, [pushUndo, selectedId]);

  const hitTest = (p: Point): string | null => {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      if (ann.tool === 'draw' && ann.points) {
        for (const pt of ann.points) {
          if (Math.hypot(pt.x - p.x, pt.y - p.y) < HIT_MARGIN) return ann.id;
        }
      } else if (ann.start && ann.end) {
        const minX = Math.min(ann.start.x, ann.end.x) - HIT_MARGIN;
        const maxX = Math.max(ann.start.x, ann.end.x) + HIT_MARGIN;
        const minY = Math.min(ann.start.y, ann.end.y) - HIT_MARGIN;
        const maxY = Math.max(ann.start.y, ann.end.y) + HIT_MARGIN;
        if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) return ann.id;
      } else if (ann.tool === 'text' && ann.start) {
        if (Math.hypot(ann.start.x - p.x, ann.start.y - p.y) < 50) return ann.id;
      }
    }
    return null;
  };

  const commitTextInput = () => {
    if (textInput && textValue.trim()) {
      pushUndo();
      setAnnotations((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          tool: 'text',
          color,
          strokeWidth,
          start: { x: textInput.x, y: textInput.y },
          text: textValue.trim(),
        },
      ]);
    }
    setTextInput(null);
    setTextValue('');
  };

  // Focus the inline text input reliably (autoFocus is unreliable)
  useEffect(() => {
    if (textInput) {
      requestAnimationFrame(() => textInputRef.current?.focus());
    }
  }, [textInput]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // A pending text input commits when clicking elsewhere on the canvas
    if (textInput) {
      commitTextInput();
      return;
    }

    const p = canvasCoords(e);

    if (tool === 'select') {
      const hit = hitTest(p);
      setSelectedId(hit);
      if (hit) {
        const ann = annotations.find((a) => a.id === hit);
        if (ann) {
          const anchor = ann.start || (ann.points && ann.points[0]) || { x: 0, y: 0 };
          setDragOffset({ x: p.x - anchor.x, y: p.y - anchor.y });
          setIsDragging(true);
        }
      }
      return;
    }

    if (tool === 'text') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      const containerRect = canvas.parentElement!.getBoundingClientRect();
      setTextInput({
        x: p.x,
        y: p.y,
        canvasX: canvasRect.left - containerRect.left + p.x * scale,
        canvasY: canvasRect.top - containerRect.top + p.y * scale,
      });
      setTextValue('');
      return;
    }

    const id = crypto.randomUUID();
    if (tool === 'draw') {
      setCurrentAnnotation({ id, tool, color, strokeWidth, points: [p] });
    } else {
      setCurrentAnnotation({ id, tool, color, strokeWidth, start: p, end: p });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const p = canvasCoords(e);

    if (isDragging && selectedId && dragOffset) {
      const dx = p.x - dragOffset.x;
      const dy = p.y - dragOffset.y;
      setAnnotations((prev) =>
        prev.map((ann) => {
          if (ann.id !== selectedId) return ann;
          const anchor = ann.start || (ann.points && ann.points[0]) || { x: 0, y: 0 };
          const offX = dx - anchor.x;
          const offY = dy - anchor.y;

          if (ann.points) {
            return { ...ann, points: ann.points.map((pt) => ({ x: pt.x + offX, y: pt.y + offY })) };
          }
          if (ann.start && ann.end) {
            return {
              ...ann,
              start: { x: ann.start.x + offX, y: ann.start.y + offY },
              end: { x: ann.end.x + offX, y: ann.end.y + offY },
            };
          }
          if (ann.start) {
            return { ...ann, start: { x: ann.start.x + offX, y: ann.start.y + offY } };
          }
          return ann;
        })
      );
      return;
    }

    if (!currentAnnotation) return;

    if (currentAnnotation.tool === 'draw') {
      setCurrentAnnotation((prev) =>
        prev ? { ...prev, points: [...(prev.points || []), p] } : null
      );
    } else {
      setCurrentAnnotation((prev) => (prev ? { ...prev, end: p } : null));
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      pushUndo();
      setIsDragging(false);
      setDragOffset(null);
      return;
    }

    if (currentAnnotation) {
      pushUndo();
      setAnnotations((prev) => [...prev, currentAnnotation]);
      setCurrentAnnotation(null);
    }
  };

  const handleSave = () => {
    if (textInput) commitTextInput();
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Canvas is at the image's natural resolution → export is already full-res.
    onSave(canvas.toDataURL('image/png'));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (textInput) return; // let the text input handle its own keys
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && tool === 'select') {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, onCancel, redo, selectedId, textInput, tool, undo]);

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select' },
    { id: 'draw', icon: <Pencil className="w-4 h-4" />, label: 'Draw' },
    { id: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
    { id: 'rect', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
    { id: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
    { id: 'arrow', icon: <MoveRight className="w-4 h-4" />, label: 'Arrow' },
    { id: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
  ];

  const fontSize = strokeWidth * 6;

  return (
    <div className="fixed inset-0 z-[100000] bg-black flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 bg-neutral-900 border-b border-neutral-700 flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-1 border-r border-neutral-700 pr-2">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTool(t.id);
                setSelectedId(null);
              }}
              className={`p-2 rounded transition-colors ${
                tool === t.id ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-700'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1 border-r border-neutral-700 pr-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c ? 'border-white scale-125' : 'border-neutral-600'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          {/* Custom color swatch — opacity-0 input so the picker anchors here */}
          <div className="relative w-6 h-6">
            <button
              className="absolute inset-0 rounded-full border-2 border-dashed border-neutral-500 hover:border-neutral-300 flex items-center justify-center z-10"
              style={{ backgroundColor: isCustomColor ? color : 'transparent' }}
              onClick={() => colorInputRef.current?.click()}
              title="Custom color"
            >
              <Plus className="w-3 h-3 text-neutral-300" />
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              style={{ width: '24px', height: '24px' }}
            />
          </div>
        </div>

        {/* Stroke width */}
        <div className="flex items-center gap-2 border-r border-neutral-700 pr-2">
          <span className="text-xs text-neutral-400">Width:</span>
          <input
            type="range"
            min={1}
            max={12}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-20 accent-blue-500"
          />
          <span className="text-xs text-neutral-300 w-4">{strokeWidth}</span>
        </div>

        {/* Undo/Redo/Delete */}
        <div className="flex items-center gap-1 border-r border-neutral-700 pr-2">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-2 rounded text-neutral-300 hover:bg-neutral-700 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-2 rounded text-neutral-300 hover:bg-neutral-700 disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={deleteSelected}
            disabled={!selectedId}
            className="p-2 rounded text-neutral-300 hover:bg-neutral-700 disabled:opacity-30"
            title="Delete selected"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Save/Cancel */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-neutral-300 hover:text-white"
          >
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Check className="w-4 h-4 mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="absolute"
          style={{ left: offset.x, top: offset.y, cursor: CURSOR_MAP[tool] }}
        />

        {/* Inline text editor (NEVER prompt()) */}
        {textInput && (
          <input
            ref={textInputRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitTextInput();
              if (e.key === 'Escape') {
                setTextInput(null);
                setTextValue('');
              }
            }}
            placeholder="Type, then Enter"
            className="absolute bg-transparent outline-none border-b border-dashed"
            style={{
              left: textInput.canvasX,
              top: textInput.canvasY - fontSize * scale,
              color,
              borderColor: color,
              fontWeight: 'bold',
              fontSize: `${fontSize * scale}px`,
              fontFamily: 'sans-serif',
              minWidth: '120px',
              textShadow: isLightColor(color)
                ? '0 0 2px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.5)'
                : '0 0 2px rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        )}
      </div>
    </div>
  );
}
