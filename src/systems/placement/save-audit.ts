/**
 * Bridge from the editor's AuditSink to saveProfile audit changes
 * (docs/specs/editor.md §6, docs/specs/rpc-profile.md §8).
 */
import { packRotationData } from '../../core/items/types';
import type { OwnedItem } from '../../net/profile';
import { AUDIT, writeAuditPayload, type AuditChange } from '../../net/save-profile';
import type { AuditSink } from './editor-state';

export interface SaveAuditEntry {
  readonly change: AuditChange;
}

/** One concrete audit emitted by the editor. */
export class SaveProfileAuditSink implements AuditSink {
  readonly changes: AuditChange[] = [];

  addChangedItem(itemId: string, _fromInventory: boolean): void {
    // The payload needs the placed item's data; the scene calls
    // recordPlacedItem when placing so the sink has it.
    const item = this.placed.get(itemId);
    if (!item) return;
    this.changes.push({
      action: AUDIT.saveOwnedItem,
      newCredits: 0,
      creditsDelta: 0,
      payload: writeAuditPayload(AUDIT.saveOwnedItem, { item }),
    });
  }

  addSoldItem(itemId: string, count: number): void {
    const item = this.placed.get(itemId);
    if (!item) return;
    this.changes.push({
      action: AUDIT.sellOwnedItem,
      newCredits: 0,
      creditsDelta: 0,
      payload: writeAuditPayload(AUDIT.sellOwnedItem, { item, token: '' }),
    });
    void count;
  }

  addBoughtItem(itemId: string): void {
    const item = this.placed.get(itemId);
    if (!item) return;
    this.changes.push({
      action: AUDIT.purchaseOwnedItem,
      newCredits: 0,
      creditsDelta: 0,
      payload: writeAuditPayload(AUDIT.purchaseOwnedItem, { token: '', item }),
    });
  }

  saveFloor(_roomIndex: number): void {
    // Floor tiles ride saveFloors (action 50) in the full editor; M2 keeps
    // the starter floor and only audits item changes.
  }

  moveAllInGameItemsToInventory(_roomIndex: number): void {
    // Not part of the M2 slice (clear-room lands with the full editor).
  }

  hasItemsChanged(): boolean {
    return this.changes.length > 0;
  }

  private readonly placed = new Map<string, OwnedItem>();

  /** The scene records the wire shape of a placed item before auditing. */
  recordPlacedItem(id: string, item: Omit<OwnedItem, 'serverId' | 'employeeId'> & { serverId?: number }): void {
    this.placed.set(id, {
      serverId: item.serverId ?? 0,
      globalItemId: item.globalItemId,
      positionX: item.positionX,
      positionY: item.positionY,
      data: item.data,
      employeeId: { network: 0, networkUid: '', playfishUid: 0 },
      roomIndex: item.roomIndex,
    });
  }

  recordExistingItem(id: string, owned: OwnedItem): void {
    this.placed.set(id, owned);
  }

  rotationData(rotation: number, usageCount = 0): number {
    return packRotationData(rotation, usageCount);
  }
}
