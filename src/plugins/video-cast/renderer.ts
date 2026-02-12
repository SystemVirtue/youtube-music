import { createRenderer } from '@/utils';

import { type VideoCastConfig } from './config';

import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

export const renderer = createRenderer<
  {
    config: VideoCastConfig | null;
    playerApi: MusicPlayer | null;
    videoElement: HTMLVideoElement | null;
    canvas: HTMLCanvasElement | null;
    captureInterval: ReturnType<typeof setInterval> | null;
    ipc: RendererContext<VideoCastConfig>['ipc'] | null;
    startCapture: () => void;
    stopCapture: () => void;
    captureFrame: () => void;
  },
  VideoCastConfig
>({
  config: null,
  playerApi: null,
  videoElement: null,
  canvas: null,
  captureInterval: null,
  ipc: null,

  async start(ctx: RendererContext<VideoCastConfig>) {
    this.config = await ctx.getConfig();
    this.ipc = ctx.ipc;

    // Create offscreen canvas for frame capture
    this.canvas = document.createElement('canvas');
  },

  onPlayerApiReady(api: MusicPlayer) {
    this.playerApi = api;

    // Get video element
    this.videoElement = document.querySelector<HTMLVideoElement>('#video');

    if (this.config.castEnabled && this.videoElement) {
      this.startCapture();
    }
  },

  onConfigChange(newConfig) {
    const wasEnabled = this.config?.castEnabled;
    this.config = newConfig;

    if (newConfig.castEnabled && !wasEnabled) {
      this.startCapture();
    } else if (!newConfig.castEnabled && wasEnabled) {
      this.stopCapture();
    }
  },

  startCapture() {
    if (!this.videoElement || !this.canvas || !this.ipc) return;

    // Request cast window creation
    this.ipc.invoke('video-cast:create-window');

    // Start capturing frames at 30fps
    this.captureInterval = setInterval(() => {
      this.captureFrame();
    }, 1000 / 30);

    console.log('[video-cast] Started frame capture');
  },

  stopCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Close cast window
    this.ipc?.invoke('video-cast:close-window');

    console.log('[video-cast] Stopped frame capture');
  },

  captureFrame() {
    if (!this.videoElement || !this.canvas || !this.ipc) return;
    if (this.videoElement.paused || !this.videoElement.ended) return;

    // Set canvas size to match video
    this.canvas.width = this.videoElement.videoWidth || 1920;
    this.canvas.height = this.videoElement.videoHeight || 1080;

    // Draw video frame to canvas
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(this.videoElement, 0, 0);

    // Convert to data URL and send to backend
    const frameData = this.canvas.toDataURL('image/jpeg', 0.8);
    this.ipc.send('video-cast:frame-update', frameData);
  },

  stop() {
    this.stopCapture();
  },
});
