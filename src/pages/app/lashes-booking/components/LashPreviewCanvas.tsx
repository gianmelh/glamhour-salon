import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { cn } from "../../../../lib/cn";
import {
  getLashPreviewStickerSet,
  type LashPreviewSide,
} from "../lashPreviewStickers";
import "./LashPreviewCanvas.css";

/** Base width as % of photo — eye-sized, much smaller than prior 22.8%. */
const BASE_WIDTH_PCT = 12;
const MIN_SCALE = 0.55;
const MAX_SCALE = 2.4;
const DEFAULT_SCALE = 1;
/** Approximate height budget for clamping (relative to base width). */
const BASE_HEIGHT_PCT = 5;

type StickerId = "a" | "b";

type StickerState = {
  assetSide: LashPreviewSide;
  xPct: number;
  yPct: number;
  scale: number;
  rotationDeg: number;
};

type StickersState = Record<StickerId, StickerState>;

type DragSession = {
  mode: "drag";
  id: StickerId;
  pointerId: number;
  offsetXPct: number;
  offsetYPct: number;
};

type PinchSession = {
  mode: "pinch";
  id: StickerId;
  pointers: Map<number, { x: number; y: number }>;
  startDistance: number;
  startAngle: number;
  startScale: number;
  startRotation: number;
};

type GestureSession = DragSession | PinchSession;

const DEFAULT_STICKERS: StickersState = {
  a: {
    assetSide: "left",
    xPct: 30,
    yPct: 32,
    scale: DEFAULT_SCALE,
    rotationDeg: 0,
  },
  b: {
    assetSide: "right",
    xPct: 66,
    yPct: 32,
    scale: DEFAULT_SCALE,
    rotationDeg: 0,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampScale(scale: number) {
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

function clampCenter(xPct: number, yPct: number, scale: number) {
  const halfW = (BASE_WIDTH_PCT * scale) / 2;
  const halfH = (BASE_HEIGHT_PCT * scale) / 2;
  return {
    xPct: clamp(xPct, halfW, 100 - halfW),
    yPct: clamp(yPct, halfH, 100 - halfH),
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDeg(a: { x: number; y: number }, b: { x: number; y: number }) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function createDefaultStickers(): StickersState {
  return {
    a: { ...DEFAULT_STICKERS.a },
    b: { ...DEFAULT_STICKERS.b },
  };
}

function isStickersState(value: unknown): value is StickersState {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(record.a && record.b);
}

export function LashPreviewCanvas({
  photoUrl,
  style,
  variant,
  swapNonce = 0,
  deselectNonce = 0,
  initialStickers,
  onStickersChange,
}: {
  photoUrl: string;
  style: string;
  variant: string;
  swapNonce?: number;
  /** Bump from parent (Styles / Variant / Swap) to clear edit selection. */
  deselectNonce?: number;
  initialStickers?: StickersState | null;
  onStickersChange?: (next: StickersState) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<GestureSession | null>(null);
  const canvasPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const canvasPinchRef = useRef<PinchSession | null>(null);
  const stickersRef = useRef<StickersState>(
    isStickersState(initialStickers) ? initialStickers : createDefaultStickers(),
  );
  const onStickersChangeRef = useRef(onStickersChange);
  const selectedIdRef = useRef<StickerId | null>(null);
  const lastSwapNonce = useRef(swapNonce);
  const lastDeselectNonce = useRef(deselectNonce);
  const lastCombo = useRef(`${style}::${variant}`);
  const [stickers, setStickers] = useState<StickersState>(() =>
    isStickersState(initialStickers) ? initialStickers : createDefaultStickers(),
  );
  const [selectedId, setSelectedId] = useState<StickerId | null>(null);
  const [activeId, setActiveId] = useState<StickerId | null>(null);

  const assets = getLashPreviewStickerSet(style, variant);

  const clearSelection = () => {
    gestureRef.current = null;
    canvasPinchRef.current = null;
    canvasPointersRef.current.clear();
    selectedIdRef.current = null;
    setSelectedId(null);
    setActiveId(null);
  };

  const selectSticker = (id: StickerId | null) => {
    selectedIdRef.current = id;
    setSelectedId(id);
  };

  const commitStickers = (next: StickersState) => {
    stickersRef.current = next;
    setStickers(next);
    onStickersChangeRef.current?.(next);
  };

  useEffect(() => {
    onStickersChangeRef.current = onStickersChange;
  }, [onStickersChange]);

  useEffect(() => {
    stickersRef.current = stickers;
  }, [stickers]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const combo = `${style}::${variant}`;
    if (combo === lastCombo.current) return;
    lastCombo.current = combo;
    const next = createDefaultStickers();
    commitStickers(next);
    clearSelection();
  }, [style, variant]);

  useEffect(() => {
    if (deselectNonce === lastDeselectNonce.current) return;
    lastDeselectNonce.current = deselectNonce;
    clearSelection();
  }, [deselectNonce]);

  useEffect(() => {
    if (swapNonce === lastSwapNonce.current) return;
    lastSwapNonce.current = swapNonce;
    clearSelection();
    setStickers((current) => {
      const flip = (side: LashPreviewSide): LashPreviewSide =>
        side === "left" ? "right" : "left";
      // Mirror across the photo and exchange left↔right assets, scales, and
      // rotations without resetting to the default layout.
      const posA = clampCenter(100 - current.a.xPct, current.a.yPct, current.b.scale);
      const posB = clampCenter(100 - current.b.xPct, current.b.yPct, current.a.scale);
      const next: StickersState = {
        a: {
          assetSide: flip(current.a.assetSide),
          xPct: posA.xPct,
          yPct: posA.yPct,
          scale: current.b.scale,
          rotationDeg: -current.b.rotationDeg,
        },
        b: {
          assetSide: flip(current.b.assetSide),
          xPct: posB.xPct,
          yPct: posB.yPct,
          scale: current.a.scale,
          rotationDeg: -current.a.rotationDeg,
        },
      };
      stickersRef.current = next;
      onStickersChangeRef.current?.(next);
      return next;
    });
  }, [swapNonce]);

  // Tap/click outside the preview editor (photo + size controls) clears selection.
  useEffect(() => {
    if (!selectedId) return;
    const onPointerDownCapture = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (root.contains(target)) return;
      clearSelection();
    };
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  }, [selectedId]);

  const clientToPct = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      xPct: ((clientX - rect.left) / rect.width) * 100,
      yPct: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const updateSticker = (id: StickerId, patch: Partial<StickerState>) => {
    setStickers((current) => {
      const merged = { ...current[id], ...patch };
      const clampedPos = clampCenter(merged.xPct, merged.yPct, merged.scale);
      const next = {
        ...current,
        [id]: {
          ...merged,
          ...clampedPos,
          scale: clampScale(merged.scale),
        },
      };
      stickersRef.current = next;
      onStickersChangeRef.current?.(next);
      return next;
    });
  };

  const beginDrag = (
    id: StickerId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const point = clientToPct(event.clientX, event.clientY);
    if (!point) return;
    const current = stickersRef.current[id];
    gestureRef.current = {
      mode: "drag",
      id,
      pointerId: event.pointerId,
      offsetXPct: point.xPct - current.xPct,
      offsetYPct: point.yPct - current.yPct,
    };
    selectSticker(id);
    setActiveId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerDown = (
    id: StickerId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (canvasPinchRef.current) return;
    const gesture = gestureRef.current;

    // Second finger on the same sticker → pinch/rotate.
    if (
      gesture &&
      gesture.mode === "drag" &&
      gesture.id === id &&
      gesture.pointerId !== event.pointerId
    ) {
      const first = {
        x: event.clientX,
        y: event.clientY,
      };
      // Recover first pointer from last known drag point approximately.
      const pointers = new Map<number, { x: number; y: number }>([
        [gesture.pointerId, first],
        [event.pointerId, { x: event.clientX, y: event.clientY }],
      ]);
      // Use current event as second; first pointer position estimated from sticker center.
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const sticker = stickersRef.current[id];
        pointers.set(gesture.pointerId, {
          x: rect.left + (sticker.xPct / 100) * rect.width,
          y: rect.top + (sticker.yPct / 100) * rect.height,
        });
      }
      const pts = [...pointers.values()];
      gestureRef.current = {
        mode: "pinch",
        id,
        pointers,
        startDistance: Math.max(distance(pts[0], pts[1]), 1),
        startAngle: angleDeg(pts[0], pts[1]),
        startScale: stickersRef.current[id].scale,
        startRotation: stickersRef.current[id].rotationDeg,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    beginDrag(id, event);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (canvasPinchRef.current) return;
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.mode === "drag") {
      if (gesture.pointerId !== event.pointerId) return;
      const point = clientToPct(event.clientX, event.clientY);
      if (!point) return;
      const scale = stickersRef.current[gesture.id].scale;
      const next = clampCenter(
        point.xPct - gesture.offsetXPct,
        point.yPct - gesture.offsetYPct,
        scale,
      );
      updateSticker(gesture.id, next);
      return;
    }

    if (!gesture.pointers.has(event.pointerId)) return;
    gesture.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (gesture.pointers.size < 2) return;
    const pts = [...gesture.pointers.values()];
    const dist = Math.max(distance(pts[0], pts[1]), 1);
    const ang = angleDeg(pts[0], pts[1]);
    const nextScale = clampScale(
      gesture.startScale * (dist / gesture.startDistance),
    );
    const nextRotation = gesture.startRotation + (ang - gesture.startAngle);
    updateSticker(gesture.id, {
      scale: nextScale,
      rotationDeg: nextRotation,
    });
  };

  const endPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (canvasPinchRef.current) return;
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.mode === "pinch") {
      gesture.pointers.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (gesture.pointers.size >= 2) return;
      if (gesture.pointers.size === 1) {
        const [remainingId] = gesture.pointers.keys();
        const point = clientToPct(event.clientX, event.clientY);
        const sticker = stickersRef.current[gesture.id];
        gestureRef.current = {
          mode: "drag",
          id: gesture.id,
          pointerId: remainingId,
          offsetXPct: point ? point.xPct - sticker.xPct : 0,
          offsetYPct: point ? point.yPct - sticker.yPct : 0,
        };
        return;
      }
      gestureRef.current = null;
      setActiveId(null);
      return;
    }

    if (gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setActiveId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (
    id: StickerId,
    event: ReactWheelEvent<HTMLButtonElement>,
  ) => {
    if (selectedId !== id) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    updateSticker(id, {
      scale: clampScale(stickersRef.current[id].scale + delta),
    });
  };

  const nudgeScale = (id: StickerId, delta: number) => {
    updateSticker(id, {
      scale: clampScale(stickersRef.current[id].scale + delta),
    });
  };

  const beginCanvasPinch = () => {
    const id = selectedIdRef.current;
    if (!id) return;
    const pts = [...canvasPointersRef.current.values()];
    if (pts.length < 2) return;
    gestureRef.current = null;
    canvasPinchRef.current = {
      mode: "pinch",
      id,
      pointers: new Map(canvasPointersRef.current),
      startDistance: Math.max(distance(pts[0], pts[1]), 1),
      startAngle: angleDeg(pts[0], pts[1]),
      startScale: stickersRef.current[id].scale,
      startRotation: stickersRef.current[id].rotationDeg,
    };
    setActiveId(id);
  };

  const updateCanvasPinch = () => {
    const gesture = canvasPinchRef.current;
    if (!gesture) return;
    gesture.pointers = new Map(canvasPointersRef.current);
    const pts = [...gesture.pointers.values()];
    if (pts.length < 2) return;
    const dist = Math.max(distance(pts[0], pts[1]), 1);
    const ang = angleDeg(pts[0], pts[1]);
    updateSticker(gesture.id, {
      scale: clampScale(gesture.startScale * (dist / gesture.startDistance)),
      rotationDeg: gesture.startRotation + (ang - gesture.startAngle),
    });
  };

  const onCanvasPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    canvasPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (canvasPointersRef.current.size >= 2) {
      event.preventDefault();
      beginCanvasPinch();
    }
  };

  const onCanvasPointerMoveCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canvasPointersRef.current.has(event.pointerId)) return;
    canvasPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (canvasPinchRef.current) {
      event.preventDefault();
      updateCanvasPinch();
    }
  };

  const onCanvasPointerEndCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    canvasPointersRef.current.delete(event.pointerId);
    if (canvasPointersRef.current.size < 2) {
      canvasPinchRef.current = null;
      setActiveId(null);
    }
  };

  if (!assets) {
    return (
      <div className="relative flex h-[431px] w-full items-center justify-center overflow-hidden rounded-[16px] bg-[#f2f5ff]">
        <img
          alt="Lash style preview"
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-40"
          draggable={false}
          src={photoUrl}
        />
        <p className="relative z-10 rounded-full bg-white/90 px-4 py-2 text-[13px] font-medium text-[#475467]">
          This combination is not available
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2" ref={rootRef}>
      <div
        className="relative h-[431px] w-full touch-none overflow-hidden rounded-[16px]"
        onPointerCancelCapture={onCanvasPointerEndCapture}
        onPointerDown={(event) => {
          // Empty photo area only — sticker handlers stopPropagation.
          if (event.defaultPrevented || canvasPointersRef.current.size >= 2) return;
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          clearSelection();
        }}
        onPointerDownCapture={onCanvasPointerDownCapture}
        onPointerMoveCapture={onCanvasPointerMoveCapture}
        onPointerUpCapture={onCanvasPointerEndCapture}
        ref={containerRef}
      >
        <img
          alt="Lash style preview"
          className="pointer-events-none absolute inset-0 size-full object-cover"
          draggable={false}
          src={photoUrl}
        />
        {(["a", "b"] as const).map((id) => {
          const state = stickers[id];
          const widthPct = BASE_WIDTH_PCT * state.scale;
          const isSelected = selectedId === id;
          const stylePos: CSSProperties = {
            left: `${state.xPct}%`,
            top: `${state.yPct}%`,
            width: `${widthPct}%`,
            transform: `translate(-50%, -50%) rotate(${state.rotationDeg}deg)`,
            zIndex: activeId === id || isSelected ? 4 : 2,
          };
          return (
            <button
              aria-label={`${state.assetSide} eye lash sticker`}
              className={cn(
                // Reset UA button face + avoid Tailwind ring-offset (defaults to white fill).
                "lash-preview-sticker absolute appearance-none border-0 bg-transparent p-0 shadow-none outline-none",
                "cursor-grab touch-none [-webkit-tap-highlight-color:transparent] active:cursor-grabbing",
                "focus:outline-none focus-visible:outline-none",
                isSelected &&
                  "outline outline-2 outline-[#7344cd]/70 outline-offset-2",
              )}
              key={id}
              onPointerCancel={endPointer}
              onPointerDown={(event) => onPointerDown(id, event)}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onWheel={(event) => onWheel(id, event)}
              style={{
                ...stylePos,
                background: "transparent",
                backgroundColor: "transparent",
                boxShadow: "none",
                WebkitAppearance: "none",
                appearance: "none",
              }}
              type="button"
            >
              <img
                alt=""
                className="pointer-events-none h-auto w-full select-none bg-transparent object-contain"
                draggable={false}
                src={assets[state.assetSide]}
                style={{
                  background: "transparent",
                  backgroundColor: "transparent",
                  boxShadow: "none",
                }}
              />
            </button>
          );
        })}
      </div>

      {selectedId && (
        <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#f2f5ff] px-3 py-2">
          <p className="text-[12px] font-normal tracking-[0.24px] text-[#475467]">
            {stickers[selectedId].assetSide === "left" ? "Left" : "Right"} lash
            size
          </p>
          <div className="flex items-center gap-2">
            <button
              aria-label="Decrease lash size"
              className="flex size-8 items-center justify-center rounded-full bg-white text-[18px] text-[#0c111d]"
              onClick={() => nudgeScale(selectedId, -0.1)}
              type="button"
            >
              −
            </button>
            <span className="min-w-10 text-center text-[12px] tabular-nums text-[#0c111d]">
              {Math.round(stickers[selectedId].scale * 100)}%
            </span>
            <button
              aria-label="Increase lash size"
              className="flex size-8 items-center justify-center rounded-full bg-white text-[18px] text-[#0c111d]"
              onClick={() => nudgeScale(selectedId, 0.1)}
              type="button"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
