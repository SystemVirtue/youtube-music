import { createPlugin, type PluginContext } from '@/utils';
import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

type SongInfo = {
  title: string;
  artist: string;
  albumArt: string;
};

type Config = {
  enabled: boolean;
  showAlbumArt: boolean;
  showTitle: boolean;
  showArtist: boolean;
  theme: 'light' | 'dark' | 'auto';
  position: { x: number; y: number };
};

type PlayerApi = {
  on: (event: string, callback: (data: any) => void) => void;
  getSongInfo: () => SongInfo;
};

type RendererContext = {
  config: Config;
  getConfig: () => Promise<Config>;
  setConfig: (config: Partial<Config>) => Promise<void>;
  getContext: () => any;
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => void;
    on: (channel: string, listener: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
};

// Simple overlay plugin that shows current track info
export default createPlugin({
  name: () => 'External Overlay',
  description: () => 'Display current track information in an external overlay window',
  restartNeeded: true,
  config: {
    enabled: false,
    showAlbumArt: true,
    showTitle: true,
    showArtist: true,
    theme: 'dark',
    position: { x: 20, y: 20 }
  },
  
  renderer: (ctx: RendererContext) => ({
    overlayWindow: null as BrowserWindow | null,
    currentSong: {
      title: '',
      artist: '',
      albumArt: ''
    } as SongInfo,
    
    config: null as Config | null,
    
    async start() {
      console.log('External Overlay plugin started');
      this.config = await ctx.getConfig();
      if (this.config.enabled) {
        this.createOverlayWindow();
      }
    },
    
    stop() {
      if (this.overlayWindow) {
        this.overlayWindow.close();
        this.overlayWindow = null;
      }
      console.log('External Overlay plugin stopped');
    },
    
    createOverlayWindow() {
      if (this.overlayWindow) {
        this.overlayWindow.focus();
        return;
      }
      
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      this.overlayWindow = new BrowserWindow({
        width: 400,
        height: 100,
        x: width - 420,  // 20px from right
        y: 20,           // 20px from top
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      // Load the overlay HTML
      this.overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
      
      // Handle window close
      this.overlayWindow.on('closed', () => {
        this.overlayWindow = null;
      });
      
      // Update with current song when window is ready
      this.overlayWindow.webContents.on('did-finish-load', () => {
        this.updateOverlayWindow();
      });
      
      return this.overlayWindow;
    },
    
    updateOverlayWindow() {
      if (!this.overlayWindow) return;
      
      this.overlayWindow.webContents.send('update-song', this.currentSong);
    },
    
    onPlayerApiReady(api: PlayerApi) {
      // Listen for song changes
      const songChangeHandler = (songInfo: Partial<SongInfo>) => {
        this.currentSong = {
          title: songInfo?.title || 'No track playing',
          artist: songInfo?.artist || '',
          albumArt: songInfo?.albumArt || ''
        };
        
        if (this.overlayWindow) {
          this.updateOverlayWindow();
        }
      };
      
      api.on('song:change', songChangeHandler);
      
      // Initial update
      try {
        const songInfo = api.getSongInfo();
        if (songInfo) {
          songChangeHandler(songInfo);
        }
      } catch (error) {
        console.error('Error getting initial song info:', error);
      }
      
      // Cleanup
      return () => {
        if (api.off) {
          api.off('song:change', songChangeHandler);
        }
      };
    },
    
    onConfigChange(config: Config) {
      this.config = config;
      if (config.enabled) {
        this.createOverlayWindow();
      } else if (this.overlayWindow) {
        this.overlayWindow.close();
        this.overlayWindow = null;
      }
    }
  }
});
