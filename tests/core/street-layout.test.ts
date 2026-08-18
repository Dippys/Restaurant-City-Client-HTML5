import { describe, expect, it } from 'vitest';
import { BUILDING_GAP, PORTRAIT_Y, streetSceneBounds, streetSlots, streetWidth } from '../../src/core/street/layout';

describe('street slot layout (WorldStreet.init port)', () => {
  it('spaces buildings by BUILDING_GAP with every 5th slot filler', () => {
    const slots = streetSlots(8);
    // 8 users -> slots 0..9 (fillers at 0 and 5).
    expect(slots.map((s) => s.kind)).toEqual([
      'filler',
      'user',
      'user',
      'user',
      'user',
      'filler',
      'user',
      'user',
      'user',
      'user',
    ]);
    expect(slots[1]?.x).toBe(BUILDING_GAP);
    expect(slots[5]?.x).toBe(5 * BUILDING_GAP);
    const users = slots.filter((s) => s.kind === 'user');
    expect(users.map((s) => s.userIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('computes total width and scene bounds (WorldStreet L370)', () => {
    const slots = streetSlots(4); // filler + 4 users -> 5 slots
    expect(streetWidth(slots)).toBe(5 * BUILDING_GAP);
    const bounds = streetSceneBounds(slots);
    expect(bounds.min).toBe(BUILDING_GAP - 380);
    expect(bounds.viewWidth).toBe(760 - 2 * BUILDING_GAP);
  });

  it('exposes the portrait panel offset', () => {
    expect(PORTRAIT_Y).toBe(-310);
  });
});
