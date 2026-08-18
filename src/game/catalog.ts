/**
 * Runtime item catalog: generated data JSONs -> per-item art/behavior
 * lookup (M2). Loads front.json (building) + restaurants.json (interior)
 * + ingredients.json and indexes items by numeric id.
 *
 * Art linkage (verified M2): item `className` matches the SWF symbol
 * names (interior -> indoor_asset, buildings -> outdoor_asset).
 * Flags: the AS3 turns every group/item `types` string into an item flag
 * (RoomItem constructor L154-171).
 */
import { loadItemDatabase } from '../net/data/loader';
import type { ItemConfig, ItemGroup } from '../net/data/types';

export interface ItemFlags {
  readonly surface: boolean;
  readonly stackable: boolean;
  readonly wallDecorationItem: boolean;
  readonly wallpaperItem: boolean;
  readonly floorTileItem: boolean;
  readonly outdoor: boolean;
  readonly wallItem: boolean;
  readonly doorItem: boolean;
  readonly tableItem: boolean;
  readonly chairItem: boolean;
  readonly decorItem: boolean;
  readonly interactive: boolean;
  [flag: string]: boolean;
}

export interface CatalogItem {
  readonly id: number;
  readonly className: string;
  readonly groupName: string;
  readonly groupDrawPriority: number;
  readonly flags: ItemFlags;
  readonly config: ItemConfig;
}

export class ItemCatalog {
  private readonly byId = new Map<number, CatalogItem>();
  private readonly groupNames: string[] = [];

  private constructor() {}

  static async load(): Promise<ItemCatalog> {
    const catalog = new ItemCatalog();
    const front = await loadItemDatabase('front');
    catalog.index(front.groups);
    const restaurants = await loadItemDatabase('restaurants');
    catalog.index(restaurants.groups);
    return catalog;
  }

  private index(groups: ItemGroup[]): void {
    for (const group of groups) {
      if (group.name && !this.groupNames.includes(group.name)) {
        this.groupNames.push(group.name);
      }
      const groupTypes = group.types ?? [];
      for (const item of group.items) {
        const id = Number(item.id);
        if (!Number.isFinite(id)) continue;
        const className = typeof item.className === 'string' ? item.className : '';
        const flags: ItemFlags = {
          surface: false,
          stackable: false,
          wallDecorationItem: false,
          wallpaperItem: false,
          floorTileItem: false,
          outdoor: false,
          wallItem: false,
          doorItem: false,
          tableItem: false,
          chairItem: false,
          decorItem: false,
          interactive: false,
        };
        for (const t of [...groupTypes, ...(item.types ?? [])]) {
          flags[t] = true;
        }
        this.byId.set(id, {
          id,
          className,
          groupName: group.name ?? '',
          groupDrawPriority: Number(group.drawPriority ?? 0),
          flags,
          config: item,
        });
      }
    }
  }

  get(id: number | string): CatalogItem | undefined {
    return this.byId.get(Number(id));
  }

  classNameOf(id: number | string): string {
    return this.get(id)?.className ?? '';
  }

  /** Interior/building group names in data order (for shop tabs). */
  groups(): readonly string[] {
    return this.groupNames;
  }

  /** Items of a group, by id. */
  itemsOfGroup(groupName: string): readonly CatalogItem[] {
    return [...this.byId.values()].filter((i) => i.groupName === groupName);
  }
}
