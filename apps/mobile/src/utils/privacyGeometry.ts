/**
 * Privacy Mask Geometry & Clamping Utilities
 *
 * Provides pure mathematical functions for dragging, resizing, and drawing privacy masks
 * with bounds clamping and worklet support.
 */

export const MIN_MASK_SIZE = 28;

export interface MaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContainerBounds {
  width: number;
  height: number;
}

/**
 * Clamps a number between min and max.
 */
export function clamp(val: number, min: number, max: number): number {
  'worklet';
  if (min > max) return min;
  return Math.max(min, Math.min(val, max));
}

/**
 * Calculates new mask position during drag, strictly clamped within container boundaries.
 */
export function calculateMaskMove(
  initX: number,
  initY: number,
  maskW: number,
  maskH: number,
  dx: number,
  dy: number,
  containerW: number,
  containerH: number
): MaskRect {
  'worklet';
  const maxX = Math.max(0, containerW - maskW);
  const maxY = Math.max(0, containerH - maskH);

  const clampedX = clamp(initX + dx, 0, maxX);
  const clampedY = clamp(initY + dy, 0, maxY);

  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
    width: Math.round(maskW),
    height: Math.round(maskH),
  };
}

/**
 * Calculates new mask dimensions during bottom-right resize.
 * Enforces minSize (default 28px) and bounds clamping so mask cannot extend outside container.
 * Never inverts width or height.
 */
export function calculateMaskResizeBR(
  initW: number,
  initH: number,
  dx: number,
  dy: number,
  maskX: number,
  maskY: number,
  containerW: number,
  containerH: number,
  minSize = MIN_MASK_SIZE
): MaskRect {
  'worklet';
  const maxW = Math.max(minSize, containerW - maskX);
  const maxH = Math.max(minSize, containerH - maskY);

  const rawW = initW + dx;
  const rawH = initH + dy;

  const clampedW = clamp(rawW, minSize, maxW);
  const clampedH = clamp(rawH, minSize, maxH);

  return {
    x: Math.round(maskX),
    y: Math.round(maskY),
    width: Math.round(clampedW),
    height: Math.round(clampedH),
  };
}

/**
 * Calculates new mask rectangle during drawing gesture.
 * Clamps start and current points to container bounds and returns positive width/height.
 */
export function calculateMaskDraw(
  startX: number,
  startY: number,
  currX: number,
  currY: number,
  containerW: number,
  containerH: number
): MaskRect {
  'worklet';
  const clampedStartX = clamp(startX, 0, containerW);
  const clampedStartY = clamp(startY, 0, containerH);
  const clampedCurrX = clamp(currX, 0, containerW);
  const clampedCurrY = clamp(currY, 0, containerH);

  const x = Math.min(clampedStartX, clampedCurrX);
  const y = Math.min(clampedStartY, clampedCurrY);
  const width = Math.abs(clampedCurrX - clampedStartX);
  const height = Math.abs(clampedCurrY - clampedStartY);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Determines whether a given coordinate point is inside a mask rectangle.
 */
export function isPointInsideMask(px: number, py: number, mask: MaskRect): boolean {
  'worklet';
  return (
    px >= mask.x &&
    px <= mask.x + mask.width &&
    py >= mask.y &&
    py <= mask.y + mask.height
  );
}

/**
 * Determines whether a given coordinate point is inside the bottom-right resize handle zone of a mask.
 * Touch slop extends handleSize (default 36px) from bottom-right corner.
 */
export function isPointInsideResizeHandle(
  px: number,
  py: number,
  mask: MaskRect,
  handleSize = 36
): boolean {
  'worklet';
  const handleX = mask.x + mask.width - handleSize;
  const handleY = mask.y + mask.height - handleSize;

  return (
    px >= handleX &&
    px <= mask.x + mask.width + 12 &&
    py >= handleY &&
    py <= mask.y + mask.height + 12
  );
}
