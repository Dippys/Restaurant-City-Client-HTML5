import Phaser from 'phaser';
import { GameState } from '../../core/state/game-state';
import { bootSession } from '../../net/boot';
import { RpcClient } from '../../net/rpc-client';
import { fetchSession } from '../../net/session';
import { ItemCatalog } from '../catalog';

const CENTER = 380;

/**
 * Real boot flow (M2): session -> handshake -> main data batch -> world
 * assets -> street. Replaces the old proof scene (kept as ProofScene for
 * pipeline regression checks; reachable via ?proof=1).
 */
export class BootScene extends Phaser.Scene {
  private status: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Boot');
  }

  create(): void {
    const url = new URL(window.location.href);
    if (url.searchParams.get('proof') === '1') {
      this.scene.start('proof');
      return;
    }
    this.add
      .text(CENTER, 60, 'Restaurant City HTML5', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.status = this.add
      .text(CENTER, 300, 'checking session…', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#9fd8e8',
      })
      .setOrigin(0.5);
    void this.run();
  }

  private setStatus(text: string, color = '#9fd8e8'): void {
    this.status?.setText(text).setColor(color);
  }

  private async run(): Promise<void> {
    try {
      const session = await fetchSession();
      if (!session.loggedIn) {
        this.setStatus('not logged in — redirecting to /login', '#ffb74d');
        window.location.assign('/login?next=/');
        return;
      }
      this.setStatus(`logged in as ${session.account?.username ?? '?'} — handshaking…`);

      const state = new GameState();
      const rpc = new RpcClient();
      const boot = await bootSession(rpc, state);
      const catalog = await ItemCatalog.load();
      this.registry.set('gameState', state);
      this.registry.set('rpc', rpc);
      this.registry.set('catalog', catalog);

      this.setStatus(
        `profile loaded: ${state.profile?.restaurantName ?? '?'} (level ${state.level}, ` +
          `${state.profile?.gourmetPoint ?? 0} gourmet, ${state.profile?.credits ?? 0} coins), ` +
          `${boot.friendsCount} friends — loading world…`,
        '#7ddb8a',
      );

      this.load.multiatlas('outdoor', 'assets/generated/atlases/outdoor_asset.json');
      this.load.multiatlas('indoor', 'assets/generated/atlases/indoor_asset.json');
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.scene.start('street');
      });
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: unknown) => {
        const f = file as { url?: string };
        this.setStatus(`asset load FAILED: ${f.url ?? '?'}`, '#ff8a80');
      });
      this.load.start();
    } catch (err) {
      this.setStatus(`boot FAILED: ${err instanceof Error ? err.message : String(err)}`, '#ff8a80');
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        window.location.assign('/login?next=/');
      }
    }
  }
}
