import { BrowserWindow, screen } from 'electron';

import { createBackend } from '@/utils';

import { type VideoCastConfig } from './config';

import type { BackendContext } from '@/types/contexts';

export const backend = createBackend<
  {
    castWindow: BrowserWindow | null;
    oldConfig: VideoCastConfig | undefined;
    createCastWindow: (
      ctx: BackendContext<VideoCastConfig>,
      config: VideoCastConfig,
    ) => void;
    closeCastWindow: () => void;
    updateCastWindow: (config: VideoCastConfig) => void;
  },
  VideoCastConfig
>({
  castWindow: null,
  oldConfig: undefined,

  async start(ctx) {
    const config = await ctx.getConfig();
    this.oldConfig = config;

    // Handle video frame updates from renderer
    ctx.ipc.on('video-cast:frame-update', (frameData: string) => {
      if (this.castWindow && !this.castWindow.isDestroyed()) {
        this.castWindow.webContents.send('video-cast:display-frame', frameData);
      }
    });

    // Handle cast window creation request
    ctx.ipc.handle('video-cast:create-window', async () => {
      const currentConfig = await ctx.getConfig();
      this.createCastWindow(ctx, currentConfig);
      return true;
    });

    // Handle cast window close request
    ctx.ipc.handle('video-cast:close-window', () => {
      this.closeCastWindow();
      return true;
    });

    if (config.castEnabled && config.selectedDisplay) {
      this.createCastWindow(ctx, config);
    }
  },

  stop() {
    this.closeCastWindow();
  },

  onConfigChange(newConfig) {
    const old = this.oldConfig;

    if (newConfig.castEnabled && newConfig.selectedDisplay) {
      if (!old?.castEnabled || old.selectedDisplay !== newConfig.selectedDisplay) {
        this.closeCastWindow();
      }
      // Window will be created by renderer when ready
    } else {
      this.closeCastWindow();
    }

    // Move window if display changed and window is already open
    if (newConfig.selectedDisplay !== old?.selectedDisplay && this.castWindow && !this.castWindow.isDestroyed()) {
      this.moveCastWindowToDisplay(newConfig.selectedDisplay);
    }

    this.oldConfig = newConfig;
  },

  createCastWindow(ctx, config) {
    if (this.castWindow && !this.castWindow.isDestroyed()) {
      return;
    }

    const displays = screen.getAllDisplays();
    const targetDisplay = displays.find(
      (d) => d.id.toString() === config.selectedDisplay,
    );

    if (!targetDisplay) {
      console.warn('[video-cast] Target display not found');
      return;
    }

    this.castWindow = new BrowserWindow({
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      width: targetDisplay.bounds.width,
      height: targetDisplay.bounds.height,
      fullscreen: true,
      frame: false,
      backgroundColor: '#000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: undefined,
      },
    });

    // Load a simple HTML page for displaying the video
    this.castWindow.loadURL(
      `data:text/html,
<!DOCTYPE html>
<html>
  <head>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #000;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        overflow: hidden;
      }
      #video-container {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      #cast-video {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      #overlay {
        position: absolute;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        font-size: 24px;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        max-width: 80%;
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="video-container">
      <img id="cast-video" src="" alt="Cast Video" />
    </div>
    <div id="overlay"></div>
    <script>
      const { ipcRenderer } = require('electron');
      const video = document.getElementById('cast-video');
      const overlay = document.getElementById('overlay');

      ipcRenderer.on('video-cast:display-frame', (event, frameData) => {
        video.src = frameData;
      });

      ipcRenderer.on('video-cast:update-overlay', (event, text, show) => {
        overlay.textContent = text;
        overlay.style.display = show ? 'block' : 'none';
      });
    </script>
  </body>
</html>`,
    );

    this.castWindow.on('closed', () => {
      this.castWindow = null;
    });

    console.log(`[video-cast] Cast window created on display ${config.selectedDisplay}`);
  },

  closeCastWindow() {
    if (this.castWindow && !this.castWindow.isDestroyed()) {
      this.castWindow.close();
      this.castWindow = null;
      console.log('[video-cast] Cast window closed');
    }
  },

  updateCastWindow(config) {
    if (this.castWindow && !this.castWindow.isDestroyed()) {
      // Update overlay visibility
      this.castWindow.webContents.send(
        'video-cast:update-overlay',
        '',
        config.showOverlay,
      );
    }
  },

  moveCastWindowToDisplay(displayId: string) {
    if (!this.castWindow || this.castWindow.isDestroyed()) {
      return;
    }

    const displays = screen.getAllDisplays();
    const targetDisplay = displays.find(
      (d) => d.id.toString() === displayId,
    );

    if (!targetDisplay) {
      console.warn('[video-cast] Target display not found for moving window');
      return;
    }

    // Move window to new display position
    this.castWindow.setPosition(targetDisplay.bounds.x, targetDisplay.bounds.y);
    this.castWindow.setSize(targetDisplay.bounds.width, targetDisplay.bounds.height, false);

    console.log(`[video-cast] Window moved to display ${displayId}`);
  },
});
