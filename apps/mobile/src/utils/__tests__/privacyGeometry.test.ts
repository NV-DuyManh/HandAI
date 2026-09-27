import {
  calculateMaskMove,
  calculateMaskResizeBR,
  calculateMaskDraw,
  isPointInsideMask,
  isPointInsideResizeHandle,
  MIN_MASK_SIZE,
} from '../privacyGeometry';

describe('privacyGeometry - Clamping & Gesture Math', () => {
  const containerW = 400;
  const containerH = 600;

  describe('calculateMaskMove', () => {
    const initX = 100;
    const initY = 150;
    const maskW = 80;
    const maskH = 40;

    it('moves correctly within container bounds', () => {
      const res = calculateMaskMove(initX, initY, maskW, maskH, 20, 30, containerW, containerH);
      expect(res).toEqual({
        x: 120,
        y: 180,
        width: 80,
        height: 40,
      });
    });

    it('clamps left and top edges to 0 when dragged out of bounds', () => {
      const res = calculateMaskMove(initX, initY, maskW, maskH, -200, -300, containerW, containerH);
      expect(res.x).toBe(0);
      expect(res.y).toBe(0);
      expect(res.width).toBe(80);
      expect(res.height).toBe(40);
    });

    it('clamps right and bottom edges so mask never overflows container', () => {
      const res = calculateMaskMove(initX, initY, maskW, maskH, 500, 800, containerW, containerH);
      expect(res.x).toBe(containerW - maskW); // 320
      expect(res.y).toBe(containerH - maskH); // 560
      expect(res.x + res.width).toBe(containerW);
      expect(res.y + res.height).toBe(containerH);
    });

    it('preserves dimensions during move', () => {
      const res = calculateMaskMove(50, 50, 120, 60, -10, 15, containerW, containerH);
      expect(res.width).toBe(120);
      expect(res.height).toBe(60);
    });
  });

  describe('calculateMaskResizeBR', () => {
    const maskX = 50;
    const maskY = 60;
    const initW = 100;
    const initH = 80;

    it('expands mask dimensions on positive delta', () => {
      const res = calculateMaskResizeBR(initW, initH, 40, 50, maskX, maskY, containerW, containerH);
      expect(res).toEqual({
        x: 50,
        y: 60,
        width: 140,
        height: 130,
      });
    });

    it('enforces MIN_MASK_SIZE and prevents inverted dimensions on extreme shrink', () => {
      const res = calculateMaskResizeBR(initW, initH, -200, -300, maskX, maskY, containerW, containerH);
      expect(res.width).toBe(MIN_MASK_SIZE);
      expect(res.height).toBe(MIN_MASK_SIZE);
      expect(res.x).toBe(50);
      expect(res.y).toBe(60);
    });

    it('clamps resize to container boundaries so mask does not overflow', () => {
      const res = calculateMaskResizeBR(initW, initH, 1000, 1000, maskX, maskY, containerW, containerH);
      expect(res.width).toBe(containerW - maskX); // 350
      expect(res.height).toBe(containerH - maskY); // 540
      expect(res.x + res.width).toBe(containerW);
      expect(res.y + res.height).toBe(containerH);
    });
  });

  describe('calculateMaskDraw', () => {
    it('creates positive dimensions when dragging top-left to bottom-right', () => {
      const res = calculateMaskDraw(50, 50, 150, 120, containerW, containerH);
      expect(res).toEqual({
        x: 50,
        y: 50,
        width: 100,
        height: 70,
      });
    });

    it('handles inverted drag (bottom-right to top-left) producing valid positive rect', () => {
      const res = calculateMaskDraw(200, 180, 80, 90, containerW, containerH);
      expect(res).toEqual({
        x: 80,
        y: 90,
        width: 120,
        height: 90,
      });
    });

    it('clamps drawing coordinates when cursor extends beyond container bounds', () => {
      const res = calculateMaskDraw(50, 50, 600, 900, containerW, containerH);
      expect(res.x).toBe(50);
      expect(res.y).toBe(50);
      expect(res.width).toBe(containerW - 50); // 350
      expect(res.height).toBe(containerH - 50); // 550
      expect(res.x + res.width).toBe(containerW);
      expect(res.y + res.height).toBe(containerH);
    });
  });

  describe('Hit Testing: isPointInsideMask & isPointInsideResizeHandle', () => {
    const mask = { x: 100, y: 100, width: 100, height: 100 };

    it('detects point inside mask correctly', () => {
      expect(isPointInsideMask(150, 150, mask)).toBe(true);
      expect(isPointInsideMask(100, 100, mask)).toBe(true);
      expect(isPointInsideMask(200, 200, mask)).toBe(true);
      expect(isPointInsideMask(50, 50, mask)).toBe(false);
      expect(isPointInsideMask(250, 150, mask)).toBe(false);
    });

    it('detects point in bottom-right resize handle zone', () => {
      // Bottom-right corner is at (200, 200), handleSize 36 means x in [164, 212], y in [164, 212]
      expect(isPointInsideResizeHandle(190, 190, mask)).toBe(true);
      expect(isPointInsideResizeHandle(170, 170, mask)).toBe(true);
      expect(isPointInsideResizeHandle(120, 120, mask)).toBe(false); // Center is not resize handle
      expect(isPointInsideResizeHandle(105, 105, mask)).toBe(false); // Top-left is not resize handle
    });
  });
});
