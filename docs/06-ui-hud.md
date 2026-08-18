# 06 — UI & HUD

All screens derive from the original UI inventory (63 classes in
`cooking/ui/` plus world-screen classes at the package root). Every entry
below keeps its AS3 reference; implement with atlas art in `src/ui/`
(ADR-0007 governs canvas vs DOM).

## HUD (restaurant play view)

- Top bar: coins, gourmet points, PlayFish Cash, level bar (`LevelBar.as`).
- Controls: music toggle, menu buttons, zoom lever (`ZoomLever.as`).
- Stove/table status overlays, tip floats, dish-ready bubbles.

## Screens

| Screen | Rebuild module | Spec |
|---|---|---|
| Street | `screens/street` | `WorldStreet.as` |
| Restaurant play | `screens/restaurant-play` | `WorldRestaurantPlay.as` |
| Restaurant editor | `screens/restaurant-editor` | `WorldRestaurantEditor.as` |
| Recipe menu | `screens/recipe-menu` | `WorldRecipeMenu.as` |
| Hire staff | `screens/hire` | `WorldHire.as`, `ui/WorldHireEmployeePopUp.as` |
| Customize avatar | `screens/customize-avatar` | `WorldCustomiseAvatar.as` |
| Customize building | `screens/customize-building` | `WorldCustomiseBuilding.as` |
| Friends list | `screens/friends` | `ui/WorldFriendsList.as` |
| Music shop | `screens/music-shop` | `ui/WorldMusicShopPopUp.as` |

## Popup inventory (implement in this order, grouped by flow)

- **Info/confirm:** `WorldItemInfoPopUp`, `WorldInfoPopUp`,
  `PurchaseCashItemConfirmPopUp`, `ClearRoomConfirmPopUp`,
  `WorldSellItemPopUp`, `WorldRetryPopUp`, `WorldLoadingPopUp`.
- **Shops:** `WorldIngredientShopPopUp`, `WorldCashIngredientShop`,
  `ItemChooser`, `IngredientItemChooser`, `FolderButton`, `ScrollPanel`.
- **Employees:** `WorldEmployeePopUp`, `WorldHireEmployeePopUp`,
  `WorldSackEmployee`, `WorldHiredFriendsPanel`.
- **Progression/rewards:** `WorldAwards`, `WorldAwardPopUp`,
  `DailyBonusPopUp`, `WorldEarningPopUp`, `DishMaxLevelPopUp`,
  `BuyAndLevelUpDishPopup`.
- **Social:** `WorldFriendsList`, `WorldRatePopUp`, `WorldTradePanel`,
  `WorldIngredientRequest`, `GiftInviteFoodPopUp`, `WorldPhotoPreviewPopUp`,
  `WorldOptiInPopUp`, `WorldNetPromoter`, `EmailPermissionReminderPopUp`.
- **Mini-games:** `FoodKingPopUp`, `FoodKingRewardPopUp`.
- **Garden/expansion:** `GardenToolTip`, `BuyOutsideAreaExpansionPopUp`.
- **Generic:** `ToolTip`, `ToolTipBase`, `WorldPopUp` (popup base class —
  port its open/close/animate contract first; everything else extends it).

## Text & localization

- Spec: `TextHandler.as`, `TextGroup.as`, `FullScreenTextFieldHandler.as`.
- All strings load from the lang JSONs (`04-asset-pipeline.md`); no
  hardcoded user-facing text. Locale switch (en/fr at minimum) must be a
  data swap, not a code change.

## UX parity rules

- Popup z-order and dismissal (blocking vs non-blocking) match the original
  flow, including the button label states (`BaseObject` up/over/down).
- Editor drag-place affordances (valid-tile highlight, red invalid) match
  `WorldRestaurantEditor` visuals.
- Tooltips appear on hover with the original delay and content structure.
- Keep the original screen flow graph in `docs/specs/ui-flow.md` (to be
  extracted during M2) so later popups slot into verified transitions.

## Accessibility & inputs

Canvas-first for parity; DOM overlay only where a native control is
required (text entry, file picker). Keyboard: Escape closes the top popup;
arrows pan in street view — match AS3 key handling when present.
