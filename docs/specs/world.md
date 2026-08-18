# world.md — isometric math, grids, depth sort, street, rendering

Derived from the decompiled AS3 (`decompiled/game/scripts/com/playfish/games/cooking/`).
AS3 is authoritative; this note is derived. Numbers are copied with their
AS3 constant names.

## 1. Canvas and stage

- `Engine.STAGE_WIDTH = 760`, `Engine.STAGE_HEIGHT = 600` — `Engine.as L38-40`.
- `GameWorld.CANVAS_WIDTH = 760`, `CANVAS_HEIGHT = 600`, `CANVAS_CENTER_X = CANVAS_WIDTH / 2` (=380), `CANVAS_CENTER_Y = CANVAS_HEIGHT / 2` (=300) — `GameWorld.as L109-115`.
- Fullscreen uses a best-fit `fullScreenSourceRect` (letterbox, `StageScaleMode.SHOW_ALL`) — `Engine.setFullScreen` `Engine.as L362-385`.

## 2. Isometric tile math

All in `WorldRestaurant.as` (static members, mutable `var` except where noted):

- `public static var ratio:int = 2` — `WorldRestaurant.as L160`.
- `public static var tileWidth:int = 80` — `L162`.
- `tileHeight = tileWidth / ratio` = **40** — `L164`.
- `tileWidthHalf = tileWidth / 2` = **40** — `L166`.
- `tileHeightHalf = tileHeight / 2` = **20** — `L168`.

World → screen (tile `(x,y)` to display pixel, relative to the room origin):

- `getScreenX(x,y) = (x - y) * tileWidthHalf` = `(x-y)*40` — `L292-295`.
- `getScreenY(x,y) = (x + y) * tileHeightHalf` = `(x+y)*20` — `L380-383`.

Screen → tile (used by the editor cursor and debug; `x`,`y` are local to `room`):

- `getTileIndexX(x,y) = (x + 2*y) / tileWidth` = `(x+2y)/80` — `L307-310`.
- `getTileIndexY(x,y) = (2*y - x) / (2*tileHeight)` = `(2y-x)/80` — `L365-368`.

Tile index / priority helpers:

- `MAX_NUM_TILES_X = 20`, `MAX_NUM_TILES_Y = 40` — `L128-130`. (Note: these are
  the *indexing stride*, not the live room size; the live room is `numTilesX × numTilesY`.)
- `getTileIndex(x,y) = y * MAX_NUM_TILES_X + x` = `y*20 + x` — `L302-305`.
- `getTileDrawPriority(x,y) = getTileIndex(x,y) << 8` (= `tileIndex * 256`) — `L297-300`.
- `getTileXFromTileIndex(i) = i % MAX_NUM_TILES_X` — `L355-358`.
- `getTileYFromTileIndex(i) = floor(i / MAX_NUM_TILES_X)` — `L360-363`.

Tile `(0,0)` is the **top-left (north-west) corner** of the room. The default
walls run along the top edge (`y == 0`) and left edge (`x == 0`); a wall-corner
occupies `(0,0)` — `addDefaultWalls` `WorldRestaurant.as L979-1021`. Interior
(non-wall) items must be at `x >= 1 && y >= 1` — `isItemOutOfBound` `L1809-1811`.

## 3. Floor grid and room dimensions

- Live room size comes from the level table: `GameWorld.LEVEL_THRESHOLDS[level].roomSizeX / roomSizeY`
  (`WorldRestaurant.init` `L493-495`, `setRoomSize` `L1843-1895`). Starts at **8×8** (level 0)
  and grows to **19×19** — `GameWorld.as L231-825`.
- `setRoomSize` recreates the floor bitmap sized `(w+h)*tileWidthHalf × (w+h)*tileHeightHalf`
  (`createFloorTileLayer` `L1285-1293`) and places it at `floor.x = -numTilesY * tileWidthHalf`
  (= `-numTilesY * 40`) — `L1857-1859`.
- `room.x = canvasWidth / 2` (=380), `room.y = tileHeight * 2` (=80) — `L520-521`.
- Main floor is filled with colour `15132390` over the diamond
  `(1,1)..(w,h)` — `fillBaseArea` `L1244-1252`, `L1860-1861`.
- **Outside area** (extension): `ROOM_INDEX_MAIN = 0`, `ROOM_INDEX_OUTSIDE_AREA = 1` — `L142-144`.
  `isTileInOutsideArea(x,y) = (y >= numTilesY) && (x < numOutsideTilesX)` — `L874-877`.
  Outside floor is placed at `x = getScreenX(0,numTilesY) - numOutsideTilesY*tileWidthHalf`,
  `y = getScreenY(0,numTilesY)` — `L730-731`. Outside area size is set from
  `OutsideAreaSizeItem.sizeX/sizeY` (item type `390`, data `3900000..3900005`, sizes 7×6 → 17×16)
  — `WorldRestaurant.init L514-517`, `GameUser.as L75-81`.
- **Garden**: `GARDEN_TILE_X = 3`, `GARDEN_TILE_Y = -9` (a fixed plot block left of the room) — `L138-140`.
  9 plots are laid out at `(GARDEN_TILE_X + floor(i/3)*2, GARDEN_TILE_Y + 4 - (i%3)*2)` for `i in 0..8`
  — `WorldRestaurant.init L503-510`. Each plot is 2×2 tiles apart.
- `focus(x,y)` centers the room on a screen point: `room.x = -x*scale + canvasWidth/2`,
  `room.y = -y*scale + canvasHeight/2` — `L1546-1550`.

## 4. Camera / pan bounds

Constants — `WorldRestaurant.as L146-158`:

- `RESTAURANT_BOUND = { top:-550, bottom:1200, left:-1450, right:1100 }` (soft/eased bound).
- `MAX_RESTAURANT_BOUND = { top:-750, bottom:1400, left:-1650, right:1300 }` (hard clamp).

Pan is drag-based (`onWorldMouseDown/Move/Up` `L769-777, L961-977, L1238-1242`) plus keyboard
arrow-key inertia (`tick` `L1055-1131`):

- Scroll speed is clamped to `±0.8` px/ms; arrow keys add `±0.4`; friction decays by
  `-0.25*cos(angle)` (x) / `0.25*sin(angle)` (y) per tick — `L967-968, L1107-1125`.
- A drag becomes a "move gesture" once it moves `>= 4px` on either axis — `L973-976`.
- Soft bound (eased toward it by `+= (target - x)/4`): `room.x ∈ [canvasWidth - right*scale, -left*scale]`
  = `[760 - 1100*scale, 1450*scale]`; `room.y ∈ [600 - 1200*scale, 550*scale]` — `L1132-1154`.
- Hard clamp (applied immediately): `room.x ∈ [760 - 1300*scale, 1650*scale]`,
  `room.y ∈ [600 - 1400*scale, 750*scale]` — `L1155-1170`.

## 5. Depth sorting (painter's order)

The display list is a 2D `Sprite` tree; "depth" is an explicit integer
`drawPriority`, and `BaseObject.addObject` inserts children in ascending
`drawPriority` order (stable insertion); changing `drawPriority` reinserts —
`BaseObject.as L49-86, L150-159, L286-315`.

For placed room items the priority is assigned in `placeRoomItem` — `WorldRestaurant.as L1353-1375`:

- Floor-tile item → `FLOOR_DRAW_PRIORITY` (= `-1000002`) — `L1355-1356` (constant `L134`).
- Door (rotation 0) → `getTileDrawPriority(tileX+1, tileY) - 1`; door (other rotation) →
  `getTileDrawPriority(tileX-1, tileY+1)` — `L1357-1367`.
- Wall decoration → `getTileDrawPriority(tileX + fullGridSizeX - 1, tileY)` — `L1368-1371`.
- Everything else → `getTileDrawPriority(tileX, tileY) + curHeight` — `L1372-1374`.

`getTileDrawPriority = (y*20 + x) * 256`, so the effective sort key is:
**(tile row `y`) → (tile column `x`) → (stack height `curHeight`, 0..255)**.
Height (`curHeight`) is the number of stacked items underneath a surface item
(`setHeight` `RoomItem.as L386-408`). Sub-items get
`parent.drawPriority + getTileDrawPriority(subOffsetX, subOffsetY) + curHeight`
— `WorldRestaurant.rotateRoomItem` `L434-443`.

Other fixed priorities — `WorldRestaurant.as L132-136`:

- `SHADOW_DRAW_PRIORITY = -1000000`.
- `FLOOR_DRAW_PRIORITY = -1000002`.
- `SCORE_POPUP_PRIORITY = 1000000`.

Moving actors sort by their occupied tile: `RestaurantActor.setTilePosition`
sets `drawPriority = getTileDrawPriority(tileX, tileY)` —
`actors/RestaurantActor.as L172-178`. 3D avatars add a fine offset:
`getTileDrawPriority(tileX,tileY) + y % tileHeight` — `actors/AvatarActor.as L162`.

The "base point" (anchor) for sorting and screen placement is the item's
**origin tile `(tileX, tileY)`**: `RoomItem.setTilePosition` sets
`x = getScreenX(tileX,tileY)`, `y = getScreenY(tileX,tileY) - curHeight`
— `RoomItem.as L544-560`.

## 6. Rendering rules

- `room` is a `BaseObject` with a background fill `0xB3E5B4`-ish `11788396` over
  `(-2000,-2000,4000,4000)` — `WorldRestaurant.init L457-461`.
- Layers inside `room`: `Road` MovieClip, `floorLayer` (`baseFloor` + `baseOutsideAreaFloor`),
  road `RoadTrees` (each tree is a `RestaurantTreeObject`), `Billboard`, garden plots, then
  placed items added via `addObject` (priority-sorted) — `L462-510`.
- `Billboard` is placed at tile `(-4, numTilesY)` (left of the room) — `setRoomSize` `L1869`.
- Trees get a tile-based priority `getTileDrawPriority(getTileIndexX(x,y), getTileIndexY(x,y))`
  and are hidden when they overlap the floor (`onFloorSizeChanged` `L1508-1526`).
- Floor tiles are painted per-tile by blitting the tile MovieClip at
  `getScreenX/Y(tile)` — `paintFloorTile` `L625-628`, `paintFloorMap` `L663-694`.
- Item visual flags (drive rendering and behavior) are set from the item config's
  `group.types` and item `types` arrays — every string becomes `this[flag] = true`
  (`RoomItem` constructor `RoomItem.as L154-171`). See `editor.md` §1 for the flag list.
- Editor grid preview: `RoomItem.setGrid` draws `WorldRestaurant.paintGrid` (green
  `10551200` fill / `5308240` line when valid, red `16744576` fill / `16711680` line when
  invalid) — `RoomItem.as L685-720`; `paintGrid` `WorldRestaurant.as L252-290`.

## 7. Street layout

Constants — `WorldStreet.as`:

- `BUILDING_GAP = 420` (px between building slots) — `L70`.
- `PORTRAIT_Y = -310` (y of the score/portrait panel above each building) — `L72`.
- `STREET_ROAD_COLOUR = [8684672, 10065807, 10065807]` (one per street type) — `L34`.
- `STREET_TYPE_FRIENDS = 0`, `STREET_TYPE_RANDOM = 1`, `STREET_TYPE_GOURMET = 2` — `L26-32`.
- `NUM_RANDOM_STREET_USERS = 10`, `NUM_GOURMET_STREET_USERS = 50`,
  `NUM_BUILDINGS_TO_LOAD_IN_A_BATCH = 50` — `L64-68`.

Slot layout (`WorldStreet.init` `L280-368`):

- Buildings are spaced every `BUILDING_GAP` px along x. Slot index `_loc4` increments every
  building; the user index `_loc6` only increments when a *real* user building is placed.
- A slot is a real user building when `_loc4 % 5 != 0` (slots 1-4, 6-9, …); every 5th slot
  (`_loc4 % 5 == 0`) is a **filler** building — either an invite building
  (`itemDatabase.getItems("InviteBuilding")`, shown on even `_loc4/5` blocks) or a
  billboard (`BECOME_A_FAN_ITEM_ID=2090000`, `LOOKING_FOR_ARTISTS_ITEM_ID=2090001`,
  `WALLGREENS_ITEM_ID=2090002`, `UK_CASH_CARD_ITEM_ID=2090003`, `FOODKING_BILLBOARD_ITEM_ID=2090004`
  — `L36-44`, chosen by country) — `L292-328`.
- Friends street is sorted ascending by gourmet points (`compareUserPointAscending`) — `L268-271`.
- Portrait panel shows rank (`curUsers.length - index`), name, level, gourmet points, and
  star rating; stars hidden when `!userInfo.isInStreet` — `L334-355`.
- `sceneLayer.setBounds(BUILDING_GAP - canvasWidth/2, BUILDING_GAP - canvasWidth/2 + totalX - BUILDING_GAP, canvasWidth - 2*BUILDING_GAP)` — `L370`.
  With `canvasWidth=760`, `BUILDING_GAP=420` this is min `40`, max `totalX - 380`, view width `-80`.

Building selection / visit (`onBuildingClick` `L708-747`):

- If the clicked user has `offlineShard` → "UserMaintenance" popup.
- If it is `GameWorld.gameUser` → `WorldRestaurantPlay(gameUser, false)`.
- Else if the friend's restaurant context is already loaded and already visited today →
  `WorldRestaurantPlay` directly.
- Else load context: `getFriendsDetails([targetUser], ITEM_CONTEXT_RESTAURANT)` (+
  `firstTimeVisitFriend` on first visit), then `WorldRestaurantPlay(targetUser, visitMode=true, enableRating=streetType==RANDOM)`.

Zoom transitions (`WorldStreet.tick` `L827-911`):

- Pan-to-building eases `buildingLayer.x` toward `-targetBuilding.x` by `/4` per tick.
- Zoom into building designer: `sceneLayer.scaleX/Y += 0.05` up to
  `WorldCustomiseBuilding.ZOOM_SCALE` (**1.2**), then `WorldCustomiseBuilding` — `L853-868`;
  `ZOOM_SCALE = 1.2` — `WorldCustomiseBuilding.as L73`.
- Zoom into restaurant: `+= 0.1` up to scale **4**, then `WorldRestaurantPlay` — `L884-894`;
  zooming out from restaurant: `-= 0.4` back to 1 — `L896-906`.
- `setZoomingTransparency` fades the 2 neighbours of the target building:
  `alpha = 1 - (scale-1)/0.4` — `L644-656`.

### StreetBuilding rendering

- A `StreetBuilding` is composed of up to four `BuildingItem`s keyed by flags
  `roof`, `body`, `wallTile`, `banner` — `StreetBuilding.as L133-221`.
- `BuildingItem.drawPriority = itemConfig.group.drawPriority` — `BuildingItem.as L54`
  (front.json group drawPriority: Body `0`, Tile `1`, Roof/Window/Door `2`,
  Wall Decoration / Street Decoration / Functional / Banner `3`).
- Roof is positioned at `body.y - body.height` and scaled to the body's `mc_rect`
  width — `StreetBuilding.positionRoof` `L233-249`.
- Wall tile is a repeating `BitmapData` fill masked by the body clip — `setWallTile` `L113-131`.
- Banner text: `tf_name` text field, `maxChars = 16`, edit button "ButtonEditBannerName" —
  `addBannerTextEditor` `L361-375`.
- Building item x/y are clamped to `y ∈ [-240, 0]`, `x ∈ [-200, 200]` — `addItem` `L196-211`.
- Default (unfurnished) building picks a random `Body`, `Roof`, `Door`, `Banner` (at `y=-100`)
  and `Tile` — `StreetBuilding.load` `L293-306`.
- The player's default building is `DEFAULT_BUILDING_ITEMS` (11 items: base `2060000`,
  roof `2020001`, door `2010012`, banner `2070000`, windows `2000014`, tiles `2050008`,
  flower beds `2040002`, menu board `2040017`, trashcan `2040011`) — `WorldCustomiseBuilding.as L16-71`.
