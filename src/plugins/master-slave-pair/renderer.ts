import { createRenderer } from '@/utils';

import { type MasterSlavePairConfig, InstanceRole } from './config';

import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

export const renderer = createRenderer<
  {
    config: MasterSlavePairConfig | null;
    playerApi: MusicPlayer | null;
    setupMasterControls: (ctx: RendererContext<MasterSlavePairConfig>) => void;
  },
  MasterSlavePairConfig
>({
  config: null,
  playerApi: null,

  async start(ctx: RendererContext<MasterSlavePairConfig>) {
    this.config = await ctx.getConfig();

    if (this.config.role === InstanceRole.MASTER) {
      this.setupMasterControls(ctx);
    }
  },

  onPlayerApiReady(
    api: MusicPlayer,
    ctx: RendererContext<MasterSlavePairConfig>,
  ) {
    this.playerApi = api;

    // If master, intercept player events and send to slave
    if (this.config?.role === InstanceRole.MASTER) {
      // Listen for state changes and sync to slave
      api.addEventListener('onStateChange', () => {
        const state = api.getPlayerState();
        if (state === 1) {
          // Playing
          ctx.ipc.invoke('master-slave-pair:send-command', 'play');
        } else if (state === 2) {
          // Paused
          ctx.ipc.invoke('master-slave-pair:send-command', 'pause');
        }
      });
    }
  },

  onConfigChange(newConfig) {
    this.config = newConfig;
  },

  setupMasterControls(ctx: RendererContext<MasterSlavePairConfig>) {
    // Override keyboard shortcuts to also send to slave
    document.addEventListener('keydown', (e) => {
      if (!this.config || this.config.role !== InstanceRole.MASTER) return;

      // Space bar - toggle play
      if (e.code === 'Space' && !e.repeat) {
        ctx.ipc.invoke('master-slave-pair:send-command', 'toggle-play');
      }
    });
  },
});
