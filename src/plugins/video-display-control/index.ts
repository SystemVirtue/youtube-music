import { createPlugin } from '@/utils';
import { screen } from 'electron';
import { BrowserWindow } from 'electron';

declare module '@/types/plugins' {
  interface PluginConfig {
    selectedDisplayId?: number;
  }
}

export default createPlugin({
  name: 'Video Display Controller',
  restartNeeded: false,
  config: {
    enabled: true,
    selectedDisplayId: 0,
  },
  
  // Backend logic to handle moving the video window
  backend: {
    start({ window, ipc }) {
      // IPC handler to receive the command from the renderer process
      // to move the video window to the selected display and go fullscreen.
      ipc.handle('move-video-to-display', async (_, displayId: number) => {
        // Find the target display from the list of all available displays
        const displays = screen.getAllDisplays();
        const targetDisplay = displays.find(d => d.id === displayId);

        // Check if the window is a pop-out video player before proceeding
        if (targetDisplay && window.isPopout()) {
          const { x, y } = targetDisplay.bounds;
          
          // Move the window to the position of the target display
          window.setBounds({ x, y, width: 800, height: 600 });
          
          // Set the window to fullscreen
          window.setFullScreen(true);
        }
      });
    },
    // The following hooks are available but not required for this plugin's functionality
    onConfigChange(newConfig) { /* ... */ },
    stop(_context) { /* ... */ },
  },

  // Menu logic to create a user-selectable list of displays
  menu: async ({ getConfig, setConfig, ipc }) => {
    // Get the list of all available displays
    const displays = screen.getAllDisplays();
    const config = await getConfig();

    return [
      {
        label: 'Select Video Display',
        submenu: displays.map((display) => ({
          label: `Display ${display.id} (${display.bounds.width}x${display.bounds.height})`,
          type: 'radio',
          checked: config.selectedDisplayId === display.id,
          click() {
            // Save the selected display ID to the plugin's configuration
            setConfig({ selectedDisplayId: display.id });
            
            // Invoke the backend handler to move the video window
            ipc.invoke('move-video-to-display', display.id);
          },
        })),
      },
    ];
  },

  // Renderer and preload hooks are not required for this plugin's core functionality,
  // as the logic is handled entirely by the backend and menu.
  renderer: {
    start(_context) { /* ... */ },
    onPlayerApiReady(api, _context) { /* ... */ },
    onConfigChange(newConfig) { /* ... */ },
    stop(_context) { /* ... */ },
  },
  preload: {
    start(_context) { /* ... */ },
    onConfigChange(newConfig) { /* ... */ },
    stop(_context) { /* ... */ },
  },
});
