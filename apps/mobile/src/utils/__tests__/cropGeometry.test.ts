import { displayRectToSourceRect } from '../cropGeometry';

describe('cropGeometry - displayRectToSourceRect', () => {
  const bMinX = 10, bMinY = 20;
  const actualW = 1000, actualH = 2000;

  it('CROP-01/02: portrait/landscape clean mapping', () => {
    const res = displayRectToSourceRect(110, 120, 100, 100, bMinX, bMinY, 2.0, actualW, actualH);
    expect(res).toEqual({ x: 200, y: 200, w: 200, h: 200 });
  });

  it('CROP-04/06: clamps left/top edge (negative values)', () => {
    const res = displayRectToSourceRect(0, 0, 100, 100, bMinX, bMinY, 2.0, actualW, actualH);
    expect(res.x).toBe(0);
    expect(res.y).toBe(0);
  });

  it('CROP-05/07: clamps right/bottom edge (overflow values)', () => {
    const res = displayRectToSourceRect(510, 1020, 100, 100, bMinX, bMinY, 2.0, actualW, actualH);
    expect(res.x).toBeLessThan(actualW);
    expect(res.y).toBeLessThan(actualH);
    expect(res.x + res.w).toBeLessThanOrEqual(actualW);
    expect(res.y + res.h).toBeLessThanOrEqual(actualH);
  });

  it('CROP-08: all-four-edge clamp (box much larger than image)', () => {
    const res = displayRectToSourceRect(0, 0, 1000, 2000, bMinX, bMinY, 2.0, actualW, actualH);
    expect(res.x).toBe(0);
    expect(res.y).toBe(0);
    expect(res.w).toBe(actualW);
    expect(res.h).toBe(actualH);
  });

  it('CROP-09: fractional coordinates correctly clamped', () => {
    const res = displayRectToSourceRect(500.5, 1000.7, 50, 50, bMinX, bMinY, 2.0, actualW, actualH);
    expect(res.x + res.w).toBeLessThanOrEqual(actualW);
    expect(res.y + res.h).toBeLessThanOrEqual(actualH);
    expect(Number.isInteger(res.x)).toBe(true);
    expect(Number.isInteger(res.y)).toBe(true);
    expect(Number.isInteger(res.w)).toBe(true);
    expect(Number.isInteger(res.h)).toBe(true);
  });

  it('CROP-10: minimum-size rectangle enforced', () => {
    const res = displayRectToSourceRect(100, 100, 0.1, 0.2, bMinX, bMinY, 2.0, actualW, actualH);
    expect(res.w).toBe(1);
    expect(res.h).toBe(1);
  });

  it('CROP-11: stale/out-of-range input corrected deterministically', () => {
    const res = displayRectToSourceRect(2000, 3000, 100, 100, bMinX, bMinY, 2.0, actualW, actualH);
    // Origin clamped to actualW - 1
    expect(res.x).toBe(actualW - 1);
    expect(res.y).toBe(actualH - 1);
    expect(res.w).toBe(1);
    expect(res.h).toBe(1);
    expect(res.x + res.w).toBe(actualW);
    expect(res.y + res.h).toBe(actualH);
  });
});
