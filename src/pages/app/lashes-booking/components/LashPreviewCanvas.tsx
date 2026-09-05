import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent as ReactSyntheticEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { cn } from "../../../../lib/cn";
import {
  getLashPreviewStickerSet,
  type LashPreviewSide,
} from "../lashPreviewStickers";
import "./LashPreviewCanvas.css";

/** Base width as % of photo — large enough for direct curve editing on mobile. */
const BASE_WIDTH_PCT = 18;
const MIN_SCALE = 0.55;
const MAX_SCALE = 2.4;
const DEFAULT_SCALE = 1;
/** Approximate height budget for clamping (relative to base width). */
const BASE_HEIGHT_PCT = 5;
const WARP_POINT_COUNT = 7;
const WARP_INFLUENCE_RADIUS_PCT = 22;
const MAX_WARP_X_DELTA_PCT = 28;
const MAX_WARP_Y_DELTA_PCT = 36;
const MAX_MOUSE_WARP_POINTER_DISTANCE_PX = 7;
const MAX_TOUCH_WARP_POINTER_DISTANCE_PX = 18;
const MIN_WARP_NEIGHBOR_GAP_PCT = 4;

type LashWarpPoint = {
  xPct: number;
  yPct: number;
  /** Compatibility with the previous vertical-offset draft. */
  yOffsetPct?: number;
};

type StickerId = "a" | "b";

type StickerState = {
  assetSide: LashPreviewSide;
  xPct: number;
  yPct: number;
  scale: number;
  rotationDeg: number;
  warpPoints?: LashWarpPoint[];
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

type ResizeSession = {
  mode: "resize";
  id: StickerId;
  pointerId: number;
  center: { x: number; y: number };
  startDistance: number;
  startScale: number;
};

type RotateSession = {
  mode: "rotate";
  id: StickerId;
  pointerId: number;
  center: { x: number; y: number };
  startAngle: number;
  startRotation: number;
};

type WarpSession = {
  mode: "warp";
  id: StickerId;
  pointIndex: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  stickerRect: DOMRect;
  startPoints: LashWarpPoint[];
  startRotation: number;
};

type GestureSession =
  | DragSession
  | PinchSession
  | ResizeSession
  | RotateSession
  | WarpSession;

const DEFAULT_WARP_POINTS: LashWarpPoint[] = [
  { xPct: 4, yPct: 54 },
  { xPct: 19, yPct: 48 },
  { xPct: 35, yPct: 43 },
  { xPct: 50, yPct: 41 },
  { xPct: 65, yPct: 43 },
  { xPct: 81, yPct: 48 },
  { xPct: 96, yPct: 54 },
];

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

function createDefaultWarpPoints(): LashWarpPoint[] {
  return DEFAULT_WARP_POINTS.map((point) => ({ ...point }));
}

function normalizeWarpPoints(
  points: unknown,
  fallbackPoints: LashWarpPoint[] = DEFAULT_WARP_POINTS,
): LashWarpPoint[] {
  if (!Array.isArray(points) || points.length !== WARP_POINT_COUNT) {
    return fallbackPoints.map((point) => ({ ...point }));
  }

  return fallbackPoints.map((fallback, index) => {
    const point = points[index] as Partial<LashWarpPoint> | undefined;
    const legacyYPct = Number.isFinite(point?.yOffsetPct)
      ? 50 + Number(point?.yOffsetPct)
      : fallback.yPct;
    return {
      xPct: clamp(
        Number.isFinite(point?.xPct) ? Number(point?.xPct) : fallback.xPct,
        0,
        100,
      ),
      yPct: clamp(
        Number.isFinite(point?.yPct) ? Number(point?.yPct) : legacyYPct,
        0,
        100,
      ),
    };
  });
}

function clampWarpPoint(
  index: number,
  point: LashWarpPoint,
  anchor: LashWarpPoint,
  points: LashWarpPoint[],
) {
  const previous = points[index - 1];
  const next = points[index + 1];
  const minX = Math.max(
    0,
    anchor.xPct - MAX_WARP_X_DELTA_PCT,
    previous ? previous.xPct + MIN_WARP_NEIGHBOR_GAP_PCT : 0,
  );
  const maxX = Math.min(
    100,
    anchor.xPct + MAX_WARP_X_DELTA_PCT,
    next ? next.xPct - MIN_WARP_NEIGHBOR_GAP_PCT : 100,
  );

  return {
    xPct: clamp(
      point.xPct,
      minX,
      Math.max(minX, maxX),
    ),
    yPct: clamp(
      point.yPct,
      Math.max(0, anchor.yPct - MAX_WARP_Y_DELTA_PCT),
      Math.min(100, anchor.yPct + MAX_WARP_Y_DELTA_PCT),
    ),
  };
}

function clientDeltaToStickerPct(
  rotationDeg: number,
  rect: DOMRect,
  deltaX: number,
  deltaY: number,
) {
  const radians = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localX = deltaX * cos - deltaY * sin;
  const localY = deltaX * sin + deltaY * cos;
  return {
    xPct: (localX / Math.max(rect.width, 1)) * 100,
    yPct: (localY / Math.max(rect.height, 1)) * 100,
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDeg(a: { x: number; y: number }, b: { x: number; y: number }) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function normalizeRotation(rotationDeg: number) {
  if (!Number.isFinite(rotationDeg)) return 0;
  return ((rotationDeg + 180) % 360 + 360) % 360 - 180;
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

type MeshPoint = {
  x: number;
  y: number;
};

function pointPctToPx(point: LashWarpPoint, width: number, height: number) {
  return {
    x: (point.xPct / 100) * width,
    y: (point.yPct / 100) * height,
  };
}

function detectLashControlPoints(image: HTMLImageElement): LashWarpPoint[] {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width <= 0 || height <= 0) return createDefaultWarpPoints();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return createDefaultWarpPoints();

  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  let minX = width - 1;
  let maxX = 0;
  let hasPixels = false;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 24) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      hasPixels = true;
      break;
    }
  }

  if (!hasPixels || maxX <= minX) return createDefaultWarpPoints();

  const pathPoints: MeshPoint[] = [];
  const step = Math.max(1, Math.floor((maxX - minX) / 90));
  const sampleWindow = Math.max(3, Math.floor(width / 80));

  for (let targetX = minX; targetX <= maxX; targetX += step) {
    const sampleMinX = Math.max(0, targetX - sampleWindow);
    const sampleMaxX = Math.min(width - 1, targetX + sampleWindow);
    let alphaTotal = 0;
    let weightedX = 0;
    let weightedY = 0;

    for (let x = sampleMinX; x <= sampleMaxX; x += 1) {
      for (let y = 0; y < height; y += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha < 24) continue;
        alphaTotal += alpha;
        weightedX += x * alpha;
        weightedY += y * alpha;
      }
    }

    if (alphaTotal <= 0) continue;
    pathPoints.push({
      x: weightedX / alphaTotal,
      y: weightedY / alphaTotal,
    });
  }

  if (pathPoints.length < 2) return createDefaultWarpPoints();

  const distances = [0];
  for (let index = 1; index < pathPoints.length; index += 1) {
    distances[index] =
      distances[index - 1] + distance(pathPoints[index - 1], pathPoints[index]);
  }
  const totalDistance = distances[distances.length - 1];
  if (totalDistance <= 0) return createDefaultWarpPoints();

  return Array.from({ length: WARP_POINT_COUNT }, (_, pointIndex) => {
    const targetDistance =
      (pointIndex / Math.max(WARP_POINT_COUNT - 1, 1)) * totalDistance;
    let segmentIndex = 1;
    while (
      segmentIndex < distances.length - 1 &&
      distances[segmentIndex] < targetDistance
    ) {
      segmentIndex += 1;
    }

    const start = pathPoints[segmentIndex - 1];
    const end = pathPoints[segmentIndex];
    const startDistance = distances[segmentIndex - 1];
    const segmentLength = Math.max(distances[segmentIndex] - startDistance, 1);
    const progress = clamp(
      (targetDistance - startDistance) / segmentLength,
      0,
      1,
    );
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;

    return {
      xPct: clamp((x / width) * 100, 0, 100),
      yPct: clamp((y / height) * 100, 0, 100),
    };
  });
}

function drawWarpedImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  anchors: LashWarpPoint[],
  controlPoints: LashWarpPoint[],
) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width <= 0 || height <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext("2d");
  if (!context) return;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!sourceContext) return;
  sourceContext.drawImage(image, 0, 0);

  const source = sourceContext.getImageData(0, 0, width, height);
  const output = context.createImageData(canvas.width, canvas.height);
  const maxSourceX = width - 1;
  const maxSourceY = height - 1;

  for (let destY = 0; destY < canvas.height; destY += 1) {
    for (let destX = 0; destX < canvas.width; destX += 1) {
      const logicalX = destX / dpr;
      const logicalY = destY / dpr;
      let inverseDx = 0;
      let inverseDy = 0;

      anchors.forEach((anchor, index) => {
        const control = controlPoints[index];
        if (!control) return;
        const anchorPx = pointPctToPx(anchor, width, height);
        const controlPx = pointPctToPx(control, width, height);
        const dx = controlPx.x - anchorPx.x;
        const dy = controlPx.y - anchorPx.y;
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

        const distancePct = Math.hypot(
          ((logicalX - controlPx.x) / width) * 100,
          ((logicalY - controlPx.y) / height) * 100,
        );
        const influence = Math.exp(
          -(distancePct * distancePct) /
            (2 * WARP_INFLUENCE_RADIUS_PCT * WARP_INFLUENCE_RADIUS_PCT),
        );
        inverseDx += dx * influence;
        inverseDy += dy * influence;
      });

      const sourceX = clamp(logicalX - inverseDx, 0, maxSourceX);
      const sourceY = clamp(logicalY - inverseDy, 0, maxSourceY);
      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      const x1 = Math.min(x0 + 1, maxSourceX);
      const y1 = Math.min(y0 + 1, maxSourceY);
      const tx = sourceX - x0;
      const ty = sourceY - y0;
      const destIndex = (destY * canvas.width + destX) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        const topLeft = source.data[(y0 * width + x0) * 4 + channel];
        const topRight = source.data[(y0 * width + x1) * 4 + channel];
        const bottomLeft = source.data[(y1 * width + x0) * 4 + channel];
        const bottomRight = source.data[(y1 * width + x1) * 4 + channel];
        const top = topLeft + (topRight - topLeft) * tx;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
        output.data[destIndex + channel] = top + (bottom - top) * ty;
      }
    }
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.putImageData(output, 0, 0);
}

function LashStickerMesh({
  src,
  anchors,
  controlPoints,
  onAnchorsChange,
}: {
  src: string;
  anchors: LashWarpPoint[];
  controlPoints: LashWarpPoint[];
  onAnchorsChange: (next: LashWarpPoint[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointsKey = controlPoints
    .map((point) => `${point.xPct.toFixed(2)},${point.yPct.toFixed(2)}`)
    .join("|");
  const anchorsKey = anchors
    .map((point) => `${point.xPct.toFixed(2)},${point.yPct.toFixed(2)}`)
    .join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !image.complete) return;
    drawWarpedImage(canvas, image, anchors, controlPoints);
  }, [src, pointsKey, anchorsKey, anchors, controlPoints]);

  const onImageLoad = (event: ReactSyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const nextAnchors = detectLashControlPoints(image);
    onAnchorsChange(nextAnchors);
    const canvas = canvasRef.current;
    if (canvas) {
      drawWarpedImage(
        canvas,
        image,
        nextAnchors,
        normalizeWarpPoints(controlPoints, nextAnchors),
      );
    }
  };

  return (
    <div className="lash-preview-sticker-mesh" aria-hidden="true">
      <img
        alt=""
        className="lash-preview-sticker-mesh-base"
        draggable={false}
        onLoad={onImageLoad}
        ref={imageRef}
        src={src}
      />
      <canvas className="lash-preview-sticker-canvas" ref={canvasRef} />
    </div>
  );
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
  const [stickerAnchors, setStickerAnchors] = useState<Record<StickerId, LashWarpPoint[]>>({
    a: createDefaultWarpPoints(),
    b: createDefaultWarpPoints(),
  });
  const [selectedId, setSelectedId] = useState<StickerId | null>(null);
  const [activeId, setActiveId] = useState<StickerId | null>(null);
  const stickerAnchorsRef = useRef(stickerAnchors);

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
    stickerAnchorsRef.current = stickerAnchors;
  }, [stickerAnchors]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const combo = `${style}::${variant}`;
    if (combo === lastCombo.current) return;
    lastCombo.current = combo;
    const next = createDefaultStickers();
    setStickerAnchors({
      a: createDefaultWarpPoints(),
      b: createDefaultWarpPoints(),
    });
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
    const current = stickersRef.current;
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
        warpPoints: current.b.warpPoints
          ? normalizeWarpPoints(current.b.warpPoints, stickerAnchorsRef.current.b)
          : undefined,
      },
      b: {
        assetSide: flip(current.b.assetSide),
        xPct: posB.xPct,
        yPct: posB.yPct,
        scale: current.a.scale,
        rotationDeg: -current.a.rotationDeg,
        warpPoints: current.a.warpPoints
          ? normalizeWarpPoints(current.a.warpPoints, stickerAnchorsRef.current.a)
          : undefined,
      },
    };
    stickersRef.current = next;
    setStickers(next);
    onStickersChangeRef.current?.(next);
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

  const persistCurrentStickers = () => {
    onStickersChangeRef.current?.(stickersRef.current);
  };

  const updateSticker = (id: StickerId, patch: Partial<StickerState>, options: { persist?: boolean } = {}) => {
    const shouldPersist = options.persist ?? true;
    const current = stickersRef.current;
    const merged = { ...current[id], ...patch };
    const clampedScale = clampScale(merged.scale);
    const clampedPos = clampCenter(merged.xPct, merged.yPct, clampedScale);
    const normalizedWarpPoints = merged.warpPoints
      ? normalizeWarpPoints(merged.warpPoints, stickerAnchorsRef.current[id])
      : undefined;
    const next: StickersState = {
      ...current,
      [id]: {
        ...merged,
        ...clampedPos,
        scale: clampedScale,
        rotationDeg: normalizeRotation(merged.rotationDeg),
        warpPoints: normalizedWarpPoints,
      },
    };
    stickersRef.current = next;
    setStickers(next);
    if (shouldPersist) onStickersChangeRef.current?.(next);
  };

  const beginDrag = (
    id: StickerId,
    event: ReactPointerEvent<HTMLElement>,
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
    event: ReactPointerEvent<HTMLElement>,
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

  const beginResize = (
    id: StickerId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sticker = stickersRef.current[id];
    const center = {
      x: rect.left + (sticker.xPct / 100) * rect.width,
      y: rect.top + (sticker.yPct / 100) * rect.height,
    };
    gestureRef.current = {
      mode: "resize",
      id,
      pointerId: event.pointerId,
      center,
      startDistance: Math.max(distance(center, { x: event.clientX, y: event.clientY }), 1),
      startScale: sticker.scale,
    };
    selectSticker(id);
    setActiveId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const beginRotate = (
    id: StickerId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sticker = stickersRef.current[id];
    const center = {
      x: rect.left + (sticker.xPct / 100) * rect.width,
      y: rect.top + (sticker.yPct / 100) * rect.height,
    };
    gestureRef.current = {
      mode: "rotate",
      id,
      pointerId: event.pointerId,
      center,
      startAngle: angleDeg(center, { x: event.clientX, y: event.clientY }),
      startRotation: sticker.rotationDeg,
    };
    selectSticker(id);
    setActiveId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const beginWarpPoint = (
    id: StickerId,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const stickerEl = event.currentTarget.closest(".lash-preview-sticker");
    if (!(stickerEl instanceof HTMLElement)) return;
    const state = stickersRef.current[id];
    const anchors = stickerAnchorsRef.current[id];
    const points = normalizeWarpPoints(state.warpPoints, anchors);
    const rect = stickerEl.getBoundingClientRect();
    const nearest = points.reduce(
      (best, point, index) => {
        const x = rect.left + (point.xPct / 100) * rect.width;
        const y = rect.top + (point.yPct / 100) * rect.height;
        const distanceFromPointer = Math.hypot(
          event.clientX - x,
          event.clientY - y,
        );
        return distanceFromPointer < best.distance
          ? { index, distance: distanceFromPointer }
          : best;
      },
      { index: -1, distance: Number.POSITIVE_INFINITY },
    );

    const maxPointerDistance =
      event.pointerType === "touch"
        ? MAX_TOUCH_WARP_POINTER_DISTANCE_PX
        : MAX_MOUSE_WARP_POINTER_DISTANCE_PX;

    if (nearest.index < 0 || nearest.distance > maxPointerDistance) {
      beginDrag(id, event);
      return;
    }

    gestureRef.current = {
      mode: "warp",
      id,
      pointIndex: nearest.index,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      stickerRect: rect,
      startPoints: points,
      startRotation: state.rotationDeg,
    };
    selectSticker(id);
    setActiveId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
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
      updateSticker(gesture.id, next, { persist: false });
      return;
    }

    if (gesture.mode === "resize") {
      if (gesture.pointerId !== event.pointerId) return;
      const nextDistance = Math.max(distance(gesture.center, { x: event.clientX, y: event.clientY }), 1);
      updateSticker(gesture.id, {
        scale: clampScale(gesture.startScale * (nextDistance / gesture.startDistance)),
      }, { persist: false });
      return;
    }

    if (gesture.mode === "rotate") {
      if (gesture.pointerId !== event.pointerId) return;
      const nextAngle = angleDeg(gesture.center, { x: event.clientX, y: event.clientY });
      updateSticker(gesture.id, {
        rotationDeg: normalizeRotation(gesture.startRotation + (nextAngle - gesture.startAngle)),
      }, { persist: false });
      return;
    }

    if (gesture.mode === "warp") {
      if (gesture.pointerId !== event.pointerId) return;
      const delta = clientDeltaToStickerPct(
        gesture.startRotation,
        gesture.stickerRect,
        event.clientX - gesture.startClientX,
        event.clientY - gesture.startClientY,
      );
      const anchors = stickerAnchorsRef.current[gesture.id];
      const nextPoints = gesture.startPoints.map((point, index) =>
        index === gesture.pointIndex
          ? clampWarpPoint(index, {
              xPct: point.xPct + delta.xPct,
              yPct: point.yPct + delta.yPct,
            }, anchors[index] ?? point, gesture.startPoints)
          : point,
      );
      updateSticker(gesture.id, { warpPoints: nextPoints }, { persist: false });
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
    }, { persist: false });
  };

  const endPointer = (event: ReactPointerEvent<HTMLElement>) => {
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
      persistCurrentStickers();
      return;
    }

    if (gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setActiveId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    persistCurrentStickers();
  };

  const onWheel = (
    id: StickerId,
    event: ReactWheelEvent<HTMLElement>,
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

  const rotateSticker = (id: StickerId, delta: number) => {
    updateSticker(id, {
      rotationDeg: normalizeRotation(stickersRef.current[id].rotationDeg + delta),
    });
  };

  const onStickerKeyDown = (id: StickerId, event: ReactKeyboardEvent<HTMLDivElement>) => {
    const smallStep = event.shiftKey ? 0.5 : 1.5;
    const scaleStep = event.shiftKey ? 0.03 : 0.08;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectSticker(id);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const state = stickersRef.current[id];
      updateSticker(id, { xPct: state.xPct - smallStep });
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      const state = stickersRef.current[id];
      updateSticker(id, { xPct: state.xPct + smallStep });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const state = stickersRef.current[id];
      updateSticker(id, { yPct: state.yPct - smallStep });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const state = stickersRef.current[id];
      updateSticker(id, { yPct: state.yPct + smallStep });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      nudgeScale(id, scaleStep);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      nudgeScale(id, -scaleStep);
    } else if (event.key === "[" || event.key === "{") {
      event.preventDefault();
      rotateSticker(id, -3);
    } else if (event.key === "]" || event.key === "}") {
      event.preventDefault();
      rotateSticker(id, 3);
    }
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
    }, { persist: false });
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
      persistCurrentStickers();
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
          const anchorPoints = stickerAnchors[id] ?? DEFAULT_WARP_POINTS;
          const warpPoints = normalizeWarpPoints(state.warpPoints, anchorPoints);
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
            <div
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
              onKeyDown={(event) => onStickerKeyDown(id, event)}
              onPointerCancel={endPointer}
              onPointerDown={(event) => onPointerDown(id, event)}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onWheel={(event) => onWheel(id, event)}
              role="button"
              style={{
                ...stylePos,
                background: "transparent",
                backgroundColor: "transparent",
                boxShadow: "none",
                WebkitAppearance: "none",
                appearance: "none",
              }}
              tabIndex={0}
            >
              <LashStickerMesh
                anchors={anchorPoints}
                controlPoints={warpPoints}
                onAnchorsChange={(nextAnchors) => {
                  setStickerAnchors((current) => ({
                    ...current,
                    [id]: nextAnchors,
                  }));
                }}
                src={assets[state.assetSide]}
              />
              {isSelected && (
                <>
                  <div
                    className="lash-preview-warp-points"
                    onPointerCancel={endPointer}
                    onPointerDown={(event) => beginWarpPoint(id, event)}
                    onPointerMove={onPointerMove}
                    onPointerUp={endPointer}
                  >
                    {warpPoints.map((point, pointIndex) => (
                      <span
                        className="lash-preview-warp-point"
                        key={pointIndex}
                        style={{
                          left: `${point.xPct}%`,
                          top: `${point.yPct}%`,
                        }}
                      />
                    ))}
                  </div>
                  <button
                    aria-label={`Resize ${state.assetSide} eye lash sticker`}
                    className="lash-preview-transform-handle lash-preview-resize-handle"
                    onPointerCancel={endPointer}
                    onPointerDown={(event) => beginResize(id, event)}
                    onPointerMove={onPointerMove}
                    onPointerUp={endPointer}
                    type="button"
                  />
                  <button
                    aria-label={`Rotate ${state.assetSide} eye lash sticker`}
                    className="lash-preview-transform-handle lash-preview-rotate-handle"
                    onPointerCancel={endPointer}
                    onPointerDown={(event) => beginRotate(id, event)}
                    onPointerMove={onPointerMove}
                    onPointerUp={endPointer}
                    type="button"
                  />
                </>
              )}
            </div>
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
            <button
              aria-label="Rotate lash counterclockwise"
              className="flex size-8 items-center justify-center rounded-full bg-white text-[15px] text-[#0c111d]"
              onClick={() => rotateSticker(selectedId, -5)}
              type="button"
            >
              ↺
            </button>
            <button
              aria-label="Rotate lash clockwise"
              className="flex size-8 items-center justify-center rounded-full bg-white text-[15px] text-[#0c111d]"
              onClick={() => rotateSticker(selectedId, 5)}
              type="button"
            >
              ↻
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
