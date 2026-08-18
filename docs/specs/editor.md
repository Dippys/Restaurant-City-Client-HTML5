# editor.md — placement, shop/sell flow, zoom, save triggers

Derived from the decompiled AS3 (`decompiled/game/scripts/com/playfish/games/cooking/`).
AS3 is authoritative; this note is derived. Numbers are copied with their
AS3 constant names. Iso math / grids / depth sort / street live in `world.md`.

## 1. Item databases and categories

Databases are XML parsed into `ItemDatabase` (`ItemDatabase.as L24-129`): a root
`<group>` list, each group with `name`, optional `type` (comma list → `group.types`),
and `<item>` children. Each item keeps `group`, defaults `cash = 0`, `cost = 0`
(`L73-74`), and every other attribute typed (`true`/`false` → Boolean, `null` → null,
else string) — `L76-99`. The generated JS ports of the same data are
`client-html5/public/assets/generated/data/restaurants.json` (interior),
`front.json` (building facade), `ingredients.json`.

Item id → type: `getItemType(id) = id / 1000000` (integer) — `GameWorld.as L1401-1404`,
compared to `GameUser.ITEM_TYPE_AVATAR=1, BUILDING=2, RESTAURANT=3, INGREDIENT=4,
RECIPE=5, PERK=6` — `GameUser.as L63-73`. So building ids are `20xxxxx`, interior
`30xxxxx` (also `35xxxxx`, `39xxxxx`), ingredients `40xxxxx`.

Interior sub-types (special-cased in `GameUser.addOwnedItem` via `id/10000`,
`GameUser.as L1095-1115`): `RESTAURANT_ITEM_TYPE_MUSIC=360`,
`RESTAURANT_ITEM_TYPE_OUTSIDE_AREA_SIZE=390`, `RESTAURANT_ITEM_TYPE_DELIVERY_BIKE=391`
— `GameUser.as L75-81`.

Interior groups and their `types` flags (from `restaurants.json`, consumed as flags in
`RoomItem` constructor `RoomItem.as L154-171`):

| Group | group `types` flags |
|---|---|
| Wall Decoration | `wallDecorationItem` |
| Door | `doorItem, wallDecorationItem` |
| Decoration | `decorItem` |
| Table | `tableItem, surface` |
| Chair | `chairItem` |
| Functional | (item-level types, e.g. toilet → `chairItem, toilet`; arcade → `interactive`) |
| Floor Tile | `floorTileItem` |
| Wallpaper | `wallpaperItem` |
| Kitchen Appliance | (item-level, e.g. `kitchen`, `sink`, `drink`) |
| Outdoor Only | `outdoor` |
| Wall | `wallItem` |
| Award | `notSellable, notGiftable, unique` |
| Music / CoinsToPfCash / Visit / OutsideAreaSize / DeliveryBike | (special sub-types) |

Facade groups and flags (from `front.json`, consumed in `BuildingItem` constructor
`BuildingItem.as L44-48`, with `drawPriority` from `group.drawPriority` `L54`):

| Group | `types` | `drawPriority` |
|---|---|---|
| Body | `body` | 0 |
| InviteBuilding / Misc | `body` | 0 |
| Tile | `wallTile` | 1 |
| Window | `wallAttach, draggable` | 2 |
| Door | `wallAttach, onFloor, draggable` | 2 |
| Roof | `roof` | 2 |
| Wall Decoration | `wallAttach, draggable` | 3 |
| Street Decoration | `onFloor, draggable` | 3 |
| Functional | `onFloor, draggable` | 3 |
| Banner | `banner, draggable` | 3 |

Item `functions` attribute (comma list) is resolved to behavior classes via
`RoomItemFunction.create(name, item)` — `RoomItem.initFunctions` `RoomItem.as L509-537`
(classes in `itemfunctions/`, e.g. `ClockArms`, `BubbleGeyser`, `AddCustomerWaitTime`,
`AddMaxDemand1/2`, `SnowGenerator`, `BunnyCustomers`, …) and
`StreetItemFunction.create` for facade items — `BuildingItem.initFunctions`
`BuildingItem.as L138-166`.

## 2. Item → tile mapping (footprint & anchor)

Computed in `RoomItem` constructor — `RoomItem.as L180-199`:

- `numTilesX = max(1, round(bounds.right / tileWidthHalf))`; `numTilesY = max(1,
  round(bounds.bottom / tileHeightHalf) - numTilesX)` (from the art's bounding box).
- If the config has `sizeX` / `sizeY`, those override: `numTilesX = sizeX`,
  `numTilesY = sizeY` — `L183-190` (data e.g. `sizeX:"1", sizeY:"2"` on Large Shield;
  outside-area sizes `7..17 × 6..16`). These are the footprint attributes; there is **no**
  `tileW`/`tileH`/`width`/`height` attribute in the item data — only `sizeX`/`sizeY`.
- `fullGridSizeX/Y` start equal to `numTilesX/Y` and grow to cover sub-items —
  `L192-193, L246-247`.
- `itemHeight = -bounds.top + (tileHeight * numTilesY - bounds.bottom)` — `L194`.

Anchor/origin: `(tileX, tileY)` is the **origin tile**; screen position is
`x = getScreenX(tileX,tileY)`, `y = getScreenY(tileX,tileY) - curHeight` —
`RoomItem.setTilePosition` `L544-560`. Multi-tile items occupy the rectangle
`(tileX..tileX+numTilesX-1) × (tileY..tileY+numTilesY-1)` (see `addToItemMap`
`WorldRestaurant.as L1437-1455`).

Rotation — `RoomItem.rotate` `RoomItem.as L425-500`: swaps `numTilesX ↔ numTilesY` and
`fullGridSizeX ↔ fullGridSizeY`; `rotationCount` advances mod `getMaxRotationCount()`
(=`content.totalFrames`, or 4 for explicit sub-item items) — `L602-609`.
`isRotatable()` = false for wall/wall-decoration items, else `maxRotationCount > 1`
— `L634-641`. Rotation is serialized in the low nibble of `UserItem.data`, with
`usageCount` in the high nibble: `rotation = data & 0x0F`, `usageCount = (data & 0xF0)>>4`
— `setUserItem` `L338-348`; `getUserItem` packs `rotation | usageCount<<4` — `L763-771`.
Actor facing is remapped via `ITEM_ROTATION_TO_ACTOR_DIRECTION_MAP = [1,7,5,3]`
(`WorldRestaurant.as L170`, `L375-378`).

## 3. Placement validity (zones & rules)

Zones — `WorldRestaurant.as`:

- Interior room = `activeRoomIndex` (0); outside area = `activeOutsideAreaRoomIndex` (1) —
  `ROOM_INDEX_MAIN / ROOM_INDEX_OUTSIDE_AREA` `L142-144`.
- `isTileInOutsideArea(x,y) = (y >= numTilesY) && (x < numOutsideTilesX)` — `L874-877`.
- `updateItemRoomPosition` records `roomIndex` and, for the outside area, subtracts
  `numTilesY` from the tile Y (`roomTileY -= numTilesY`) — `L1486-1495`.

`isValid(item, x, y)` — `WorldRestaurant.as L1691-1799`:

- `numTilesX==0 && numTilesY==0` → true (decoration-only grid) — `L1699-1701`.
- `isItemOutOfBound` → false — `L1703-1705`.
- `outdoor` item must be inside the outside area — `L1707-1713`.
- `floorTileItem`: invalid on `x==0 || y==0` (walls), else true — `L1715-1721`.
- `wallDecorationItem`: every covered tile must be a wall (`wallMap` non-null) with
  `itemMap.length == 1` (only the wall itself) — `L1723-1740`.
- On a wall tile (`wallMap[..] != null`): only `wallDecorationItem`/`wallpaperItem`
  allowed; wall decoration also requires `itemMap.length == 1` — `L1742-1752`.
- On an open tile: `wallDecorationItem`/`wallpaperItem` are rejected; otherwise each
  covered tile may hold at most **5** items (`_loc10_ = 5`), and a new item must be
  `stackable` onto a `surface` (or the tile empty); the stack limit is `length <= 5`
  (6 when the item itself is the top of the stack) — `L1753-1785`.
- Sub-items must each validate at their offset — `L1786-1797`.

`isItemOutOfBound(item, x, y)` — `L1801-1827`:

- Wall/wall-decoration/wallpaper: must satisfy `0 <= x < numTilesX && 0 <= y < numTilesY`.
- Others: `x<1 || y<1` → true (can't place on the top/left wall rows).
- Bottom row beyond the room (`y+numTilesY-1 >= numTilesY`) must be within the outside
  area (`x+numTilesX-1 < numOutsideTilesX` and `< numTilesY+numOutsideTilesY`); otherwise
  the interior bound is `x+numTilesX-1 < numTilesX`.

Walkability (used by play, not placement): `isWalkable(x,y)` = tile in bounds, no wall,
and `itemMap[tile].length == 0` (a `doorItem` on a wall tile is walkable) —
`WorldRestaurant.as L1667-1689`.

## 4. Editor flow (WorldRestaurantEditor)

Entered from `WorldRestaurantPlay.onButtonDecorateClick` (the "Decorate" button) —
`WorldRestaurantPlay.as L268-276`.

Init — `WorldRestaurantEditor.init` `L211-254`:

- Adds grid layers, then `ItemChooser(GameWorld.interiorItemDatabase, gameUser, "ItemChooserScene2")`
  (`drawPriority = 100`), initial group **"Table"**; cursor layer `drawPriority = 200`;
  UI scene `"RoomEditorUi"` with zoom lever (`uiButton.mc_zoom`), OK/Play button
  (`okButton`), and `RestaurantLayoutChooser` (`uiButton.mc_layout`).
- `canvasHeight = STAGE_HEIGHT - itemChooser.height` — `L237`.
- Calls `GameWorld.stopGlobalRpcs()` (suspends autosave) — `L253`.

### Buy (from shop data)

`onNewItem` — `L1091-1116`: a press in the ItemChooser starts a drag. If the player owns
one in inventory, `curItem` = a `RoomItem` from the inventory `UserItem` with
`owned=true, fromInventory=true`, and the inventory item is removed; otherwise a fresh
`RoomItem` from `new UserItem(itemConfig)` with `owned=false`. The chosen item becomes the
cursor item (`cursorItemLayer`).

Purchase is validated in `placeCurrentItem` — `L472-601`:

- Guard: `owned || (isItemAffordable && isItemLevelReached)` — `L487`.
- Coin items: `GameWorld.cashPanel.addCoins(-cost)`, award `AWARD_SPEND_COIN`,
  gourmet points `getPurchaseItemGourmetPoint` — `L498-514`.
- Cash (Playfish Cash) items: show `PurchaseCashItemConfirmPopUp` (confirm/cancel) —
  `L575-580`; success/cancel handlers `L265-298`.
- Newly bought interior item → `shopTransactionHandler.addBoughtItem` + award
  `AWARD_BUY_INDOOR_ITEM` — `L581-584`.

### Place (drag/tap state machine)

- `mouseMoveListener` (`L1015-1089`): while `curItem` is held, tile under the mouse is
  `(getTileIndexX(room.mouseX), getTileIndexY(room.mouseY))`. Wall decoration / wallpaper
  snap to a hovered wall tile; out-of-bounds positions show the item free-floating with no
  grid and height 0; otherwise the item snaps to the tile, shows a green/red grid, and gets
  `setHeight(getItemHeightAtTile(...))` (stack height). Chairs auto-rotate toward an
  adjacent table (`rotateChairTowardTable` `L148-166`).
- `mouseUpListener` (`L1123-1144`): if `isValid` → `placeCurrentItem()`; else
  `revertCurrentItem()` (restore prior tile/rotation/height) or `putItemInInventory`.
- Floor tile placement is special: paints/replaces the floor tile and calls
  `shopTransactionHandler.saveFloor(roomIndex)` — `L516-549`.
- Wallpaper placement replaces any existing wallpaper on that wall — `L552-562`.

### Move

`onItemClicked` (`L413-443`): clicking an editable item removes it from the room,
remembers `itemPrevTileX/Y/Rotation/Height`, removes the used item, and makes it the
cursor item for re-placement.

### Rotate

Hovering a rotatable item shows `"DirectionWheel"`; `directionButtonClicked` rotates it
and records `shopTransactionHandler.addChangedItem` — `L300-341, L919-936`.

### Sell

`onSellItem` (`L124-146`): moves the item to inventory, opens `WorldSellItemPopUp`
(quantity 1..owned count, +/– wrap) → `onItemSellOK` (`L1006-1013`) credits
`GameWorld.getItemSellPrice(cfg) * count`, adds `GOURMET_POINTS_SELL_ITEM * count`
(=2), and `shopTransactionHandler.addSoldItem`. Sell price rule — `GameWorld.as
L2604-2611`: `cash>0 ? cash*330 : floor(cost/3)`.

### Clear room

`mc_removeAll` → `ClearRoomConfirmPopUp` → `removeAllItemsToInventory`
(`L651-655, L811-880`): every used item → inventory, wallpaper cleared, floor tiles →
inventory, and `saveProfileHandler.moveAllInGameItemsToInventory(roomIndex, ITEM_TYPE_RESTAURANT)`
+ `saveRestaurantFloor(roomIndex)` for both rooms.

### Layouts (floors)

`setLayout(i)` sets `activeFloorIndex = i*2`, loads room `(i*2, i*2+1)` — `L674-680`.
Play button records `GAME_EVENT_BUTTON_CLICK "layout_<activeFloorIndex/2>"` — `L682-707`.

## 5. Zoom levels

`ZoomLever` (`ui/ZoomLever.as`):

- `LEVER_ZOOM_SCALE = [1.4, 1, 0.6]` — `L14`.
- `LEVER_POSITION = [-20, 0, 20]` — `L18`.
- `zoomLevel` defaults to **1** (scale 1.0); clamped to `0..2` — `L10, L43-48`.
- `setZoomLevel` snaps the lever and calls `restaurant.zoom(scale, instant)`; wheel input
  steps `zoomLevel ∓ 1` — `WorldRestaurantEditor.onMouseWheel L1118-1121`,
  `WorldRestaurantPlay.onMouseWheel L1509-1512`.
- `WorldRestaurant.zoom` sets `targetZoomScale`; `tick` animates `room.scaleX` by `±0.1`
  per tick toward it — `WorldRestaurant.as L1537-1544, L1171-1190`.

Street / building transitions (see `world.md` §7): building designer zoom target `1.2`
(`WorldCustomiseBuilding.ZOOM_SCALE`), restaurant enter/exit zoom target `4`.

## 6. Save flow & autosave triggers

### Autosave (the global "audit" commit)

`GameWorld.tick` — `GameWorld.as L2750-2767`:

- `inactiveTimer` accumulates and is reset to 0 on any stage `MOUSE_MOVE`
  (`onStageMouseMove` `L1579-1582`).
- While `globalRpcsTimer >= 0`:
  - inactive (`inactiveTimer >= INACTIVE_TIME` = 60 s): `forceAutoSave()` when
    `globalRpcsTimer >= GLOBAL_RPC_COMMIT_INTERVAL_INACTIVE` (= **300 000 ms**).
  - active: `forceAutoSave()` when `globalRpcsTimer >= GLOBAL_RPC_COMMIT_INTERVAL`
    (= **60 000 ms**).
- Constants `GLOBAL_RPC_COMMIT_INTERVAL=60000`, `GLOBAL_RPC_COMMIT_INTERVAL_INACTIVE=300000`,
  `INACTIVE_TIME=60000` — `L833-837`.

`forceAutoSave` (`L1172-1182`) → `commitGlobalRpcs` (`L929-944`), which: calls
`tickOfflineTime()`, adds `addUpdatedEmployees` for every employee, then
`getServerTime()` + `addRequest(saveProfileHandler)` + `commit()`, and rebuilds a fresh
`globalRpcs` / `SaveProfileHandler`.

Pause/resume:

- `stopGlobalRpcs()` sets `globalRpcsTimer = -2` — `L1938-1942` (editor and tutorials
  call this; `WorldRestaurantEditor.init L253`, `WorldCustomiseBuilding.as L172`,
  `WorldCustomiseAvatar.as L374`, `Tutorial1/2`).
- `startGlobalRpcs()` resets `-2 → 0` — `L2595-2602` (editor commit success
  `WorldRestaurantEditor.onCommitSuccess L408`, building/avatar editors).

### Editor commit

`WorldRestaurantEditor.playClicked` → `ShopTransactionHandler.commit()` (only when
`isRestaurantChanged()` = `hasChanges() || activeRoomIndex != prevActiveRoomIndex`)
— `L682-707`, `L646-649`. `ShopTransactionHandler.commit` shows a `"Saving..."`
`WorldLoadingPopUp` and calls `GameWorld.commitGlobalRpcs()` — `ShopTransactionHandler.as L18-30`.
On success → `GameWorld.startGlobalRpcs()` + `WorldRestaurantPlay` — `WorldRestaurantEditor.onCommitSuccess L399-411`.

`ShopTransactionHandler` audit mapping — `ShopTransactionHandler.as`:

- `addChangedItem` → `saveProfileHandler.moveItem(item, fromInventory)` (move/replace) `L32-35`.
- `addSoldItem` → `saveProfileHandler.sellItem(item, count, ...)` `L37-40`.
- `addBoughtItem` → `saveProfileHandler.purchaseItem(item)` `L74-77`.
- `saveFloor` → `saveProfileHandler.saveRestaurantFloor(roomIndex)` `L79-82`.
- `hasChanges` → `saveProfileHandler.hasItemsChanged()` `L42-45`.

### Full list of `saveProfileHandler` audit actions (grep of callers)

`GameWorld.saveProfileHandler.*` mutation sites (each is an audit delta that rides the
next autosave/commit):

- Economy/meals: `addPaidMeal` (`WorldRestaurantPlay L748`, offline `GameWorld L2634`),
  `addPaidFunctional` (`WorldRestaurantPlay L1423`), `addOffLineMoney` (`GameWorld L1284`).
- Inventory/layout: `moveItem` (`ShopTransactionHandler L34`, `GameWorld L2584/L2798`,
  `WorldSackEmployee L91`), `sellItem` (`ShopTransactionHandler L39`), `purchaseItem`
  (`ShopTransactionHandler L76`), `saveRestaurantFloor` (`ShopTransactionHandler L81`,
  `WorldRestaurantEditor L859/L877`), `moveAllInGameItemsToInventory`
  (`WorldRestaurantEditor L841-842`).
- Garden: `plantSeed` / `waterPlant` / `harvestPlant` (`GardenPlot L130/L93/L73`).
- Visitors: `completedActivityFor` (`WorldRestaurantPlay L264`), `addShakenTree`
  (`WorldRestaurantPlay L2337`), `addTrash` (`WorldRestaurantPlay L2537`).
- Mail: `addDeletedMail`, `addOpenedMail` (many `ui/mail/*` callers).
- Employees: `addHiredEmployees` (`GameWorld L1761`), `addUpdatedEmployees`
  (`GameWorld.commitGlobalRpcs L935`), `addFiredEmployees` (`WorldSackEmployee L70`).
- Recipes/ingredients: `addRecipe` (`WorldRecipeMenu L867`), `addLockedIngredient` /
  `addUnlockedIngredient` (`IngredientItemChooser L88/L93`).

### Explicit force-saves

`GameWorld.forceAutoSave()` is also called directly on: bank payment agreement
(`ui/bank/WorldBankPaymentAgreement L132`), ingredient shop buy (`WorldIngredientShopPopUp L123`),
music shop (`WorldMusicShopPopUp L88`), opt-in (`WorldOptiInPopUp L67`), sack employee
(`WorldSackEmployee L101`), trade panel (`WorldTradePanel L141`). Startup
(`GameWorld.start`) calls `forceAutoSave()` after profile repair on a returning player —
`GameWorld.as L1307`.
