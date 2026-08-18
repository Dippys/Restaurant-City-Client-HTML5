# 03 — Game systems

One section per system. Every section names the AS3 spec classes
(paths relative to `../decompiled/game/scripts/com/playfish/games/cooking/`)
and the rebuild target module. Agents implement a system only from these
sources; balance numbers are read from the AS3/data, never guessed.

Package census (file counts): root ~60 classes, `actors/` 16, `arcadegame/`
12, `challenge/` 3, `debug/` 23, `events/` 4, `extension/` 3, `foodking/` 2,
`itemfunctions/` 33, `rpc/` 27, `tutorials/` 11, `ui/` 63, `usertask/` 6,
`utils/` 7, `visitactivities/` 10. Plus `com/playfish/coretech/` (engine 31,
platform 84, billing 12) and `com/playfish/rpc/` for the protocol.

## 1. Boot & init

- Spec: `Engine.as`, `GameInitLoader.as`, `ResourceHandler.as`, `Debug.as`.
- Rebuild: `src/game/` bootstrap + `src/net` (see doc 05). Flow: handshake ->
  main profile batch -> asset load -> first world. Error handling mirrors
  `onInitError` (friendly retry dialog).

## 2. Data layer (items, recipes, ingredients)

- Spec: `ItemDatabase.as`, `Recipe.as`, `IngredientItem.as`,
  `PerkItem.as`, `AvatarItem.as`, `GameUserEmployee.as`, plus the `bin-xml`
  readers (see doc 11).
- Rebuild: `src/core/` data models parsed by `src/net/data/`. Item taxonomy:
  ingredients, recipes/dishes (with per-level stats and upgrade levels),
  interior items, building parts, outdoor items, perks, avatar parts,
  employee types.

## 3. World & placement

- Spec: `BaseWorld.as`, `GameWorld.as`, `WorldRestaurant.as`,
  `WorldRestaurantPlay.as`, `WorldRestaurantEditor.as`, `WorldStreet.as`,
  `GameObject.as`, `GameItemObject.as`, `AnimatedObject.as`, `BaseObject.as`,
  `RoomItem.as`, `BuildingItem.as`, `OutsideAreaSizeItem.as`,
  `RestaurantTreeObject.as`, `StreetBuilding.as`, `GlowEffect.as`,
  `BitmapBatch.as`, `ZoomLever.as`.
- Rebuild: `src/systems/placement/` + world scenes. Editor loop: buy from
  shop -> place on valid tiles -> move/sell -> persist via audit.
  Footprints, occupancy, and floor/outside area expansion
  (`OutsideAreaSizeItem`, `BuyOutsideAreaExpansionPopUp`) must match tile
  rules exactly.

## 4. Cooking & dishes

- Spec: `DishOrder.as`, `Recipe.as`, `itemfunctions/` (33 functional item
  classes: stoves, counters, cleaning, repairs...).
- Rebuild: `src/core/cooking/` + `src/systems/cooking/`. Rules: dishes have
  levels 1-10; cooking consumes ingredients and cook time; stoves have
  capacity/timers; prepared dishes serve customers; per-dish coin/gourmet
  rewards and level-up curves come from data/AS3.

## 5. Customers & employees

- Spec: `actors/` (16 classes: customer, waiter, cook, seating/queue
  behavior), `GameUser.as`, `GameUserEmployee.as`, `WorldHire.as`,
  `ui/WorldHireEmployeePopUp.as`, `ui/WorldSackEmployee.as`,
  `ui/WorldHiredFriendsPanel.as`, `ui/WorldEmployeePopUp.as`.
- Rebuild: `src/systems/customers/`, `src/systems/employees/`. Customer
  lifecycle: spawn (demand/popularity driven) -> seat -> order -> wait ->
  eat -> pay -> leave; tips/hearts from satisfaction. Waiters carry food and
  clear tables; cooks staff stoves. Employee management: hire/fire, energy,
  hiring friends as staff.

## 6. Economy & progression

- Spec: `LevelBar.as`, `GameAwards.as`, `ui/WorldAwards.as`,
  `ShopTransactionHandler.as`, `SkuHandler.as`, `CashPanel.as`,
  `ui/DailyBonusPopUp.as`, `ui/WorldEarningPopUp.as`.
- Rebuild: `src/core/economy/`. Currencies: coins, gourmet points (XP),
  PlayFish Cash (local). Level ups unlock items/dishes (gate list from
  data). Awards/badges (`GameAwards`), daily bonus, and earnings recap
  popup.

## 7. Shops & purchasing

- Spec: `ui/WorldIngredientShopPopUp.as`, `ui/WorldCashIngredientShop.as`,
  `ui/WorldMusicShopPopUp.as`, `ui/PurchaseCashItemConfirmPopUp.as`,
  `ui/WorldSellItemPopUp.as`, `ui/WorldItemInfoPopUp.as`,
  `ui/ItemChooser.as`, `ui/IngredientItemChooser.as`, `ui/FolderButton.as`,
  `ui/ScrollPanel.as`.
- Rebuild: `src/ui/` shop flows over `src/net` purchase calls
  (`purchaseCoinsWithPfCash`, `purchaseCashItem`,
  `purchaseCashItemIngredients`, `swapIngredient`) already implemented
  server-side.

## 8. Recipe menu & dish upgrades

- Spec: `WorldRecipeMenu.as`, `ui/BuyAndLevelUpDishPopup.as`,
  `ui/DishMaxLevelPopUp.as`.
- Rebuild: dish selection per stove, ingredient requirement display,
  buy/level-up flows.

## 9. Garden

- Spec: `GardenPlot.as`, `ui/GardenToolTip.as`, `waterFriendGarden` RPC.
- Rebuild: `src/systems/garden/` — plots on outdoor tiles, growth timers,
  harvest to inventory, friend-watering.

## 10. Street, friends & social

- Spec: `WorldStreet.as`, `StreetBuilding.as`, `ui/WorldFriendsList.as`,
  `ui/WorldRatePopUp.as`, `visitactivities/` (10), `ui/WorldTradePanel.as`,
  `ui/WorldIngredientRequest.as`, `MailItem.as`, `FacebookHandler.as`.
- Rebuild: street view of own + friends' restaurants (backend provides
  `getRandomStreetUsers`/`getGourmetStreetUsers`), visits with first-visit
  bonus, rating, trade/swap ingredients, mail.

## 11. Quiz, challenges, tasks & tutorials

- Spec: `challenge/` (3), `usertask/` (6), `tutorials/` (11),
  `ui/WorldAwardPopUp.as`, `quizzReply` RPC.
- Rebuild: daily quiz (credits reward), challenge/goal tracking, guided
  first-session tutorial, task log.

## 12. Mini-games & events

- Spec: `arcadegame/` (12), `foodking/` (2), `ui/FoodKingPopUp.as`,
  `ui/FoodKingRewardPopUp.as`, `events/` (4), `extension/` (3).
- Rebuild: the Food King arcade game and event popups, driven from the
  restaurant. Port logic, render with the game atlases.

## 13. Avatar & customization

- Spec: `Avatar3D.as`, `CachedAvatar3D.as`, `WorldCustomiseAvatar.as`,
  `AvatarItem.as`, `CacheAvatarPortraitQueueItem.as`.
- Rebuild: layered 2D composite portraits (ADR-0003), avatar editor with
  the original parts catalog from `avatar_asset.swf`.

## 14. Building customization

- Spec: `WorldCustomiseBuilding.as`, `BuildingItem.as`,
  `ui/RestaurantLayoutChooser.as`, `ui/BuyOutsideAreaExpansionPopUp.as`.
- Rebuild: exterior style/layout selection, expansion purchase.

## 15. Sound & music

- Spec: `GameSound.as`, `OverlaySetting.as`, `GameSettings.as`.
- Rebuild: `src/core/`-adjacent audio policy + Phaser audio glue; tracks
  from `sound_asset.swf`.

## 16. Save & audit

- Spec: `cooking/rpc/RpcSaveProfile.as` and the backend
  `server/src/rpc/save-profile-parser.ts` (already proven).
- Rebuild: `src/systems/save/` — audit-diff builder producing the exact
  change records the backend parses. Round-trip tests replay captured
  payloads.

## 17. Diagnostics

- Spec: `DebugPanel.as`, `debug/` (23 classes).
- Rebuild: dev-only overlay behind `?debug=1`: add coins/cash/gourmet, show
  all shop items, toggle level gates, reset flags — matching the original
  debug entry points.
