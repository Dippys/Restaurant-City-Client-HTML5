# 10 — Glossary

Domain vocabulary used across docs, code, and tickets. Where the meaning is
a game rule, the authoritative definition lives in the AS3/data — this page
is orientation, not a balance table.

| Term | Meaning |
|---|---|
| Coins | Earned currency from served dishes; spent in shops. |
| Gourmet Points | Experience points; drive player level. |
| PlayFish Cash (PF Cash) | Premium local currency (no real money here). |
| Level | Player progression tier; gates items, dishes, areas. |
| Dish level | 1-10 per dish; higher level = better stats, unlockable by leveling the dish. |
| Ingredient | Raw goods (apple, tomato, fish, ...) stocked in the pantry; consumed by cooking and tradable. |
| Stove / station | Cooking appliance where dishes are prepared (`itemfunctions`). |
| Waiter | Employee who carries finished dishes to customers and clears tables. |
| Cook | Employee who staffs stoves. |
| Employee energy | Staff stamina that depletes and needs rest/management. |
| Popularity / hearts | Restaurant attractiveness driving customer demand; decoration-dependent. |
| Demand | Customer spawn pressure metric in the profile (`demand` scalar). |
| Trash | Profile counter tied to cleanup interactions (`trash` scalar). |
| Garden plot | Outdoor tile growing ingredients over time. |
| Outside area | Expandable exterior zone around the building (`OutsideAreaSizeItem`). |
| Floor | Interior layout level (ground/upper) in the profile model. |
| Bookmark | Social counter (`readBookmarkCount`/`writeBookmarkCount`). |
| Street | Social neighborhood view of your + friends'/strangers' restaurants. |
| Visit credit | Per-friend visit state; first visits grant rewards. |
| Rank / rating | Player-to-restaurant ratings (`rankRestaurant`). |
| Trade | Player ingredient exchanges (`swapIngredient`, `WorldTradePanel`). |
| Quiz | Daily trivia (`quizzReply`) granting credits. |
| Challenge / usertask | Goal tracking systems (`challenge/`, `usertask/`). |
| Mystery box | Random reward purchase (`buyMystryBox`). |
| Perk | Power-up item (icons in `perk_asset.swf`). |
| Food King | Arcade mini-game launched from the restaurant. |
| Award | Achievement badge (`GameAwards`/`WorldAwards`). |
| Consecution | Award progress field in the profile (wire name; verify in AS3). |
| Audit / save audit | Delta change records in `saveProfile` payloads. |
| 760x600 @ 25fps | Original stage size and frame rate — the logical frame we author against. |
| `[1]` suffix | Browser download artifact in data filenames (`lang_en[1].bin`); the backend's fuzzy matcher strips it. |

Domain references: [Restaurant City Fandom wiki](https://restaurantcity.fandom.com/wiki/Restaurant_City),
[Gamezebo walkthrough](https://www.gamezebo.com/walkthroughs/restaurant-city-walkthrough/).
