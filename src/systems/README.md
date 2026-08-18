# src/systems

Gameplay systems that operate on the core `GameState` and produce the scene
objects the Phaser layer renders.

Rules:

- Each system mirrors a family of original classes. Map to the spec before
  writing code, e.g. customers/waiters/cooks mirror `cooking/actors/*`,
  placement mirrors `WorldRestaurantEditor`, cooking mirrors
  `DishOrder`/`Recipe`.
- Systems are plain TypeScript with explicit update(dtMs) entry points; the
  fixed-timestep loop lives in the game layer.

Planned contents (M2+):

- `customers/`, `employees/` — actor state machines (arrive, seat, order,
  eat, pay, leave)
- `cooking/` — stoves, dish progress, ingredient consumption
- `placement/` — buy/move/sell, occupancy, floor/outside areas
- `garden/` — plots, growth, watering
- `save/` — profile audit-diff builder for `saveProfile`
