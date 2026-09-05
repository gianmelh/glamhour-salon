import { cn } from "../../../../lib/cn";
import { lashesBookingAssets } from "../assets";
import { lashLengthOptions, lashMapPositions } from "../lashesDetailsSpec";
import { getLashEyeProgress } from "../lashesDetailsValidation";
import type { LashEyeName } from "../types";
import { LashesSectionTitle } from "./lashesUi";

/**
 * Separator coordinates match the visible lash-map artwork in percent space.
 * Labels are calculated from each line midpoint, then offset to the visual left
 * so text/circles never inherit the mirrored geometry transform.
 */
/**
 * Coordinates of each visible separator line.
 *
 * Every hotspot belongs 1:1 to one separator.
 * The hotspot is anchored to the separator midpoint and moved
 * a fixed number of pixels to the SCREEN-LEFT.
 *
 * IMPORTANT:
 * Do not use a percentage for the horizontal gap.
 * The circles have a fixed pixel size, so their gap should also
 * be expressed in pixels.
 */
const lashMapSeparatorCenters = [
  { position: 8, x: 13.5, y: 59, offsetX: 17 },

  // 9: higher
  { position: 9, x: 21.5, y: 44, offsetX: 17 },

  { position: 10, x: 32.5, y: 35, offsetX: 28 },

  { position: 11, x: 44.5, y: 26, offsetX: 30 },

  { position: 12, x: 54.0, y: 25, offsetX: 18 },

  { position: 13, x: 69.5, y: 37, offsetX: -6 },

  // 14: slightly lower
  { position: 14, x: 84.5, y: 57, offsetX: -6 },
] as const;

const leftLashMapSeparatorCenters = [
  // 8: un poco más arriba y un poco más a la derecha
  { position: 8, x: 6.5, y: 51, offsetX: 4 },

  // 9: ligeramente más a la derecha
  { position: 9, x: 10.5, y: 40, offsetX: 10 },

  // 10: MUCHO más a la derecha para separarlo del 11
  { position: 10, x: 29.5, y: 30, offsetX: -18 },

  // 11: mantener a la derecha de la línea central,
  // pero más cerca de ella
  { position: 11, x: 42.5, y: 24, offsetX: -8 },

  // 12: está bien; solo bajar mínimamente
  { position: 12, x: 54.0, y: 27, offsetX: -8 },

  // 13: casi bien; acercarlo apenas a su línea
  { position: 13, x: 69.5, y: 37, offsetX: 0 },

  // 14: acercarlo un poco más y bajar apenas
  { position: 14, x: 84.5, y: 53, offsetX: -2 },
] as const;

type LashMapSeparator = {
  position: number;
  x: number;
  y: number;
  offsetX: number;
};

function hotspotFromSeparator(separator: LashMapSeparator, mirror = false) {
  const centerX = mirror ? 100 - separator.x : separator.x;

  return {
    position: separator.position,
    left: `calc(${centerX}% - ${separator.offsetX}px)`,
    top: `${separator.y}%`,
  };
}
const rightLashMapHotspots = lashMapSeparatorCenters.map((separator) =>
  hotspotFromSeparator(separator),
);

const leftLashMapHotspots = leftLashMapSeparatorCenters.map((separator) =>
  hotspotFromSeparator(separator, true),
);

function hotspotsForEye(eye: LashEyeName) {
  return eye === "rightEye" ? rightLashMapHotspots : leftLashMapHotspots;
}

type LashMapState = Partial<
  Record<LashEyeName, Array<{ position: number; length: number }>>
>;

function readLashMapEditorState(details: Record<string, unknown>) {
  const eye = (details.activeLashEye as LashEyeName | undefined) ?? "rightEye";
  const map = { ...((details.lashMap as LashMapState | undefined) ?? {}) };
  const length = Number(details.lashMapLength ?? details.defaultLength ?? 10);
  return { eye, map, length, current: map[eye] ?? [] };
}

function sideTotal(
  entries: Array<{ position: number; length: number }> | undefined,
) {
  return (entries ?? []).reduce(
    (total, entry) => total + (Number(entry.length) || 0),
    0,
  );
}

export function LashMapEditor({
  details,
  onChange,
}: {
  details: Record<string, unknown>;
  onChange: (
    next:
      | Record<string, unknown>
      | ((current: Record<string, unknown>) => Record<string, unknown>),
  ) => void;
}) {
  const { eye, map, length, current } = readLashMapEditorState(details);
  const eyeLabel = eye === "rightEye" ? "Right side" : "Left side";
  const activeHotspots = hotspotsForEye(eye);
  const progress = getLashEyeProgress(map);
  const rightCompleted =
    progress.find((item) => item.eye === "rightEye")?.completed ?? 0;
  const leftCompleted =
    progress.find((item) => item.eye === "leftEye")?.completed ?? 0;
  const rightComplete = rightCompleted >= lashMapPositions;
  const leftComplete = leftCompleted >= lashMapPositions;

  const assign = (position: number) => {
    onChange((currentDetails) => {
      const {
        eye: activeEye,
        map: lashMap,
        length: zoneLength,
        current: eyeEntries,
      } = readLashMapEditorState(currentDetails);
      const next = [
        ...eyeEntries.filter((item) => item.position !== position),
        { position, length: zoneLength },
      ].sort((a, b) => a.position - b.position);
      const nextMap = { ...lashMap, [activeEye]: next };
      return {
        ...currentDetails,
        lashMap: nextMap,
        activeLashEye: activeEye,
        lashMapLength: zoneLength,
        rightSide: sideTotal(nextMap.rightEye),
        leftSide: sideTotal(nextMap.leftEye),
      };
    });
  };

  const selectLength = (value: string) => {
    const nextLength = Number(value);
    onChange((currentDetails) => ({
      ...currentDetails,
      defaultLength: value,
      lashMapLength: Number.isFinite(nextLength) ? nextLength : undefined,
    }));
  };

  /** Switch which eye is being edited — same as Nails HandEditor, does not move map data. */
  const swapSides = () => {
    onChange((currentDetails) => {
      const activeEye =
        (currentDetails.activeLashEye as LashEyeName | undefined) ?? "rightEye";
      return {
        ...currentDetails,
        activeLashEye: activeEye === "rightEye" ? "leftEye" : "rightEye",
      };
    });
  };

  return (
    <section className="flex w-full min-w-0 flex-col" style={{ gap: 24 }}>
      <div className="flex w-full min-w-0 flex-col" style={{ gap: 16 }}>
        <LashesSectionTitle>Lash map</LashesSectionTitle>
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 text-[12px] font-normal leading-[1.4] tracking-[0.24px] text-black">
            {eyeLabel} ·{" "}
            {progress.find((item) => item.eye === eye)?.completed ?? 0}/
            {lashMapPositions} zones
          </p>
          <button
            className="inline-flex shrink-0 items-center gap-2.5 rounded-full bg-[#ebe7ff] px-3 py-1.5"
            onClick={swapSides}
            type="button"
          >
            <img
              alt=""
              className="size-6 shrink-0 object-contain"
              src={lashesBookingAssets.swap}
            />
            <span className="whitespace-nowrap text-[12px] font-normal leading-[1.4] tracking-[0.24px] text-[#0c111d]">
              Swap sides
            </span>
          </button>
        </div>
        {rightComplete && !leftComplete && eye === "rightEye" && (
          <p className="text-[12px] font-normal leading-[1.44] text-[#475467]">
            Right eye complete. Tap Swap sides to map the left eye.
          </p>
        )}
        {rightComplete && !leftComplete && eye === "leftEye" && (
          <p className="text-[12px] font-normal leading-[1.44] text-[#475467]">
            Tap each zone on the map to finish the left eye ({leftCompleted}/
            {lashMapPositions}).
          </p>
        )}
        {leftComplete && !rightComplete && eye === "leftEye" && (
          <p className="text-[12px] font-normal leading-[1.44] text-[#475467]">
            Left eye complete. Tap Swap sides to map the right eye.
          </p>
        )}
        {leftComplete && !rightComplete && eye === "rightEye" && (
          <p className="text-[12px] font-normal leading-[1.44] text-[#475467]">
            Tap each zone on the map to finish the right eye ({rightCompleted}/
            {lashMapPositions}).
          </p>
        )}
      </div>

      <div className="flex w-full min-w-0 flex-col gap-3">
        <p className="text-[13px] font-semibold text-[#0c111d]">Length (mm)</p>
        <div className="grid grid-cols-5 gap-2">
          {lashLengthOptions.map((option) => {
            const active = String(length).padStart(2, "0") === option;
            return (
              <button
                className={cn(
                  "min-h-10 rounded-[12px] border px-2 text-[14px] font-semibold transition",
                  active
                    ? "border-[#7344cd] bg-[#ebe7ff] text-[#0c111d]"
                    : "border-[#d0d5dd] bg-white text-[#475467]",
                )}
                key={option}
                onClick={() => selectLength(option)}
                type="button"
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative aspect-[361/179] w-full min-w-0 overflow-hidden">
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 bg-no-repeat",
            eye === "leftEye" && "-scale-x-100",
          )}
          style={{
            backgroundImage: `url("${
              String(details.style ?? "")
                .toLowerCase()
                .includes("cat")
                ? lashesBookingAssets.lashMap.catEye
                : lashesBookingAssets.lashMap.clean
            }")`,
            backgroundPosition: "50% 58%",
            backgroundSize: "148% auto",
          }}
        />
        {activeHotspots.map(({ position, left, top }) => {
          const assigned = current.find((item) => item.position === position);
          return (
            <button
              aria-label={`Lash map position ${position}${assigned ? `, length ${assigned.length}` : ""}`}
              className={cn(
                "absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition",
                assigned
                  ? "size-7 border-0 bg-transparent text-center text-[15px] font-semibold leading-none text-[#7444cf] shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7444cf]/65"
                  : "size-7 border border-dashed border-[#7444cf]/55 bg-white/45 text-[#7444cf]/70",
              )}
              key={position}
              onClick={() => assign(position)}
              style={{ left, top }}
              type="button"
            >
              {assigned ? (
                assigned.length
              ) : (
                <span className="text-[11px] font-semibold">{position}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
