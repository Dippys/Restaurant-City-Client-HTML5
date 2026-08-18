import Phaser from 'phaser';

/**
 * M0 placeholder scene.
 *
 * Replaced milestone by milestone (see docs/08-roadmap.md). The real boot flow
 * mirrors the Flash `GameInitLoader` sequence: handshake RPC -> profile batch
 * -> asset load -> world. This scene only proves the scaffold runs.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(380, 260, 'Restaurant City HTML5', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(380, 300, 'M0 scaffold — docs/08-roadmap.md', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#9fd8e8',
      })
      .setOrigin(0.5);
    this.add
      .text(380, 330, 'Start the backend first: cd ../server && npm start', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#6f8f99',
      })
      .setOrigin(0.5);
  }
}
