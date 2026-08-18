import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { ProofScene } from './game/scenes/ProofScene';
import { RestaurantScene } from './game/scenes/RestaurantScene';
import { StreetScene } from './game/scenes/StreetScene';

/**
 * Application entrypoint.
 *
 * The original Flash client ran at 760x600 @ 25fps (`game.swf` header). The
 * rebuild keeps that logical resolution and scales to fit the window; all game
 * layout coordinates are authored against 760x600.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 760,
  height: 600,
  backgroundColor: '#1c2b33',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, ProofScene, StreetScene, RestaurantScene],
});

export default game;
