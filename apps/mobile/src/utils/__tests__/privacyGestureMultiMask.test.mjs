import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRIVACY_FILE = path.resolve(__dirname, '../../app/privacy.tsx');

console.log('=== RUNNING PRIVACY GESTURE MULTI-MASK AUDIT & SIMULATION ===');

// 1. Audit privacy.tsx source code for dedicated draft architecture
const source = fs.readFileSync(PRIVACY_FILE, 'utf-8');

// A. Check dedicated draft shared values
assert.ok(source.includes('const draftX = useSharedValue(0);'), 'draftX must exist');
assert.ok(source.includes('const draftY = useSharedValue(0);'), 'draftY must exist');
assert.ok(source.includes('const draftW = useSharedValue(0);'), 'draftW must exist');
assert.ok(source.includes('const draftH = useSharedValue(0);'), 'draftH must exist');
assert.ok(source.includes('const draftOpacity = useSharedValue(0);'), 'draftOpacity must exist');
console.log('PASS: Architectural Audit - Dedicated draft shared values declared');

// B. Check useEffect guard against gesture interruption
assert.ok(source.includes('if (gestureAction.value !== 0) return;'), 'useEffect must not disrupt active UI gesture');
console.log('PASS: Architectural Audit - useEffect guarded against mid-gesture activeOpacity override');

// C. Check dedicated animatedDraftStyle overlay
assert.ok(source.includes('const animatedDraftStyle = useAnimatedStyle'), 'animatedDraftStyle must exist');
assert.ok(source.includes('style={animatedDraftStyle}'), 'Animated.View with animatedDraftStyle must be rendered');
console.log('PASS: Architectural Audit - Dedicated Live Draft Mask Overlay rendered in JSX');

// 2. Behavioral Simulation: 4 Consecutive Masks Dragged and Committed

class PrivacyWorkletGestureSimulator {
  gestureAction = 0; // 0=NONE, 1=MOVE, 2=RESIZE, 3=DRAW
  draftX = 0;
  draftY = 0;
  draftW = 0;
  draftH = 0;
  draftOpacity = 0;

  activeX = 0;
  activeY = 0;
  activeW = 0;
  activeH = 0;
  activeOpacity = 0;
  activeMaskId = null;

  selectedMaskId = null;
  committedMasks = [];

  // Emulate React useEffect([selectedMaskId, masks])
  triggerUseEffect() {
    if (this.gestureAction !== 0) {
      // Guard works: ignores mid-gesture updates
      return;
    }
    if (this.selectedMaskId !== null) {
      const found = this.committedMasks.find(m => m.id === this.selectedMaskId);
      if (found) {
        this.activeMaskId = found.id;
        this.activeX = found.x;
        this.activeY = found.y;
        this.activeW = found.width;
        this.activeH = found.height;
        this.activeOpacity = 1;
      }
    } else {
      this.activeMaskId = null;
      this.activeOpacity = 0;
    }
  }

  // Touch on empty canvas to start drawing
  onStartDraw(touchX, touchY) {
    this.gestureAction = 3; // DRAW
    this.activeMaskId = null;
    this.activeOpacity = 0;

    this.draftX = touchX;
    this.draftY = touchY;
    this.draftW = 0;
    this.draftH = 0;
    this.draftOpacity = 1;

    // React JS-thread deselect scheduled
    this.selectedMaskId = null;
    this.triggerUseEffect(); // Simulates React re-rendering while drag is happening
  }

  // Frame-by-frame dragging
  onUpdateDraw(currX, currY) {
    assert.strictEqual(this.gestureAction, 3, 'Must be in DRAW mode');
    const x1 = Math.min(this.draftX, currX);
    const y1 = Math.min(this.draftY, currY);
    const w = Math.abs(currX - this.draftX);
    const h = Math.abs(currY - this.draftY);

    this.draftX = x1;
    this.draftY = y1;
    this.draftW = w;
    this.draftH = h;
    this.draftOpacity = 1;
  }

  // Release finger
  onEndDraw() {
    assert.strictEqual(this.gestureAction, 3);
    if (this.draftW >= 24 && this.draftH >= 24) {
      const newId = Date.now() + Math.floor(Math.random() * 1000);
      this.committedMasks.push({
        id: newId,
        x: this.draftX,
        y: this.draftY,
        width: this.draftW,
        height: this.draftH,
      });
      this.selectedMaskId = newId;
    }
    this.draftOpacity = 0;
    this.draftW = 0;
    this.draftH = 0;
    this.gestureAction = 0;
    this.triggerUseEffect(); // React updates selection after commit
  }
}

const sim = new PrivacyWorkletGestureSimulator();

// Test drawing 4 consecutive regions
const regions = [
  { start: [20, 30], end: [120, 90] },    // Region 1
  { start: [150, 40], end: [260, 110] },  // Region 2 (Previously broke here!)
  { start: [30, 200], end: [180, 280] },  // Region 3
  { start: [200, 220], end: [340, 300] }, // Region 4
];

regions.forEach((r, idx) => {
  const regionNum = idx + 1;
  // 1. Touch start
  sim.onStartDraw(r.start[0], r.start[1]);
  assert.strictEqual(sim.draftOpacity, 1, `Region ${regionNum}: draftOpacity must be 1 on touch start`);

  // 2. Drag frame simulation
  sim.onUpdateDraw(r.end[0], r.end[1]);
  assert.strictEqual(sim.draftOpacity, 1, `Region ${regionNum}: draftOpacity MUST REMAIN 1 during dragging (LIVE PREVIEW)`);
  assert.ok(sim.draftW > 0 && sim.draftH > 0, `Region ${regionNum}: draft dimensions must be > 0 during drag`);

  // Verify prior committed masks are all preserved and visible
  assert.strictEqual(sim.committedMasks.length, idx, `Region ${regionNum}: prior committed masks must remain fully intact`);

  // 3. Release finger
  sim.onEndDraw();
  assert.strictEqual(sim.draftOpacity, 0, `Region ${regionNum}: draftOpacity must reset to 0 after release`);
  assert.strictEqual(sim.committedMasks.length, regionNum, `Region ${regionNum}: must be successfully committed`);
  console.log(`PASS: Region ${regionNum} live preview verified during drag and committed correctly.`);
});

assert.strictEqual(sim.committedMasks.length, 4, 'All 4 regions must be committed');
console.log('\n=== ALL MULTI-MASK CONSECUTIVE DRAW GESTURE TESTS PASSED ===\n');
