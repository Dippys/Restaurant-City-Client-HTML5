/**
 * Street slot layout — port of WorldStreet.init (L280-368).
 *
 * Spec: client-html5/docs/specs/world.md §7; authoritative = AS3.
 *
 * Buildings are spaced every BUILDING_GAP px along x. Every 5th slot
 * (index % 5 == 0) is a filler (invite building or billboard); the rest
 * are user buildings. The portrait panel sits at PORTRAIT_Y above each
 * building.
 */
export const BUILDING_GAP = 420;
export const PORTRAIT_Y = -310;
export const NUM_RANDOM_STREET_USERS = 10;
export const NUM_GOURMET_STREET_USERS = 50;
export const STREET_TYPE_FRIENDS = 0;
export const STREET_TYPE_RANDOM = 1;
export const STREET_TYPE_GOURMET = 2;

export type SlotKind = 'user' | 'filler';

export interface StreetSlot {
  /** Sequential slot index (every 5th is filler). */
  readonly slotIndex: number;
  /** User index — only real user buildings advance it. */
  readonly userIndex: number | null;
  readonly kind: SlotKind;
  readonly x: number;
}

/** Builds the slot plan for a street with `userCount` buildings. */
export function streetSlots(userCount: number): StreetSlot[] {
  const slots: StreetSlot[] = [];
  let slotIndex = 0;
  let userIndex = 0;
  while (userIndex < userCount) {
    const kind: SlotKind = slotIndex % 5 === 0 ? 'filler' : 'user';
    slots.push({
      slotIndex,
      userIndex: kind === 'user' ? userIndex : null,
      kind,
      x: slotIndex * BUILDING_GAP,
    });
    if (kind === 'user') {
      userIndex += 1;
    }
    slotIndex += 1;
  }
  return slots;
}

/** Total street width for the given slot plan. */
export function streetWidth(slots: readonly StreetSlot[]): number {
  return slots.length * BUILDING_GAP;
}

/** Scene bounds from WorldStreet.init L370 (canvasWidth = 760). */
export function streetSceneBounds(slots: readonly StreetSlot[]): { min: number; max: number; viewWidth: number } {
  const totalX = streetWidth(slots);
  return {
    min: BUILDING_GAP - 380,
    max: BUILDING_GAP - 380 + totalX - BUILDING_GAP,
    viewWidth: 760 - 2 * BUILDING_GAP,
  };
}
