import { createPlugin } from '@/utils';

interface MasterSyncConfig {
  enabled: boolean;
  slaveHost: string;
  slavePort: number;
  slaveAuthToken: string;
  syncInterval: number;
  syncPlayPause: boolean;
  logDebug: boolean;
}

export default createPlugin({
  name: 'Master Sync',
  restartNeeded: false,
  config: {
    enabled: false,
    slaveHost: '192.168.1.100',
    slavePort: 26538,
    slaveAuthToken: '',
    syncInterval: 2000,
    syncPlayPause: true,
    logDebug: false,
  } as MasterSyncConfig,
  
  menu: async ({ getConfig, setConfig }) => {
    const config = await getConfig();
    
    return [
      {
        label: 'Master Sync',
        submenu: [
          {
            label: config.enabled ? '✓ Enabled' : 'Disabled',
            type: 'checkbox',
            checked: config.enabled,
            click: () => {
              setConfig({ enabled: !config.enabled });
            },
          },
          {
            type: 'separator',
          },
          {
            label: 'Sync Play/Pause',
            type: 'checkbox',
            checked: config.syncPlayPause,
            click: () => {
              setConfig({ syncPlayPause: !config.syncPlayPause });
            },
          },
          {
            label: 'Debug Logging',
            type: 'checkbox',
            checked: config.logDebug,
            click: () => {
              setConfig({ logDebug: !config.logDebug });
            },
          },
          {
            type: 'separator',
          },
          {
            label: `Slave: ${config.slaveHost}:${config.slavePort}`,
            enabled: false,
          },
        ],
      },
    ];
  },

  backend: {
    start({ getConfig, ipc }) {
      let syncIntervalId: NodeJS.Timeout | null = null;
      let lastSongId: string | null = null;
      let lastPausedState: boolean | null = null;
      let lastQueueHash: string | null = null;

      const log = async (message: string, ...args: any[]) => {
        const config = await getConfig();
        if (config.logDebug) {
          console.log(`[Master Sync] ${message}`, ...args);
        }
      };

      // Validate configuration
      const validateConfig = (config: MasterSyncConfig): string | null => {
        if (!config.slaveHost || !config.slaveHost.trim()) {
          return 'SLAVE host is required';
        }
        if (config.slavePort < 1 || config.slavePort > 65535) {
          return 'SLAVE port must be between 1 and 65535';
        }
        if (!config.slaveAuthToken || !config.slaveAuthToken.trim()) {
          return 'Authorization token is required';
        }
        if (config.syncInterval < 500) {
          return 'Sync interval must be at least 500ms';
        }
        return null;
      };

      // Helper to call slave API with retry logic
      const callSlaveAPI = async (
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
        body?: any,
        retries: number = 3
      ): Promise<{ success: boolean; error?: string; data?: any }> => {
        const config = await getConfig();
        
        // Validate configuration
        const validationError = validateConfig(config);
        if (validationError) {
          await log(`Configuration error: ${validationError}`);
          return { success: false, error: validationError };
        }

        const url = `http://${config.slaveHost}:${config.slavePort}${endpoint}`;
        
        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            const options: RequestInit = {
              method,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.slaveAuthToken}`,
              },
              timeout: 5000,
            };

            if (body !== undefined) {
              options.body = JSON.stringify(body);
            }

            await log(`API ${method} ${endpoint}`, body);
            const response = await fetch(url, options);
            
            if (!response.ok) {
              const errorText = await response.text().catch(() => '');
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return { success: true, data };
          } catch (error: any) {
            const isLastAttempt = attempt === retries - 1;
            const errorMsg = error.message || 'Unknown error';
            
            if (isLastAttempt) {
              await log(`API call failed after ${retries} attempts: ${errorMsg}`);
              return { success: false, error: errorMsg };
            } else {
              const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
              await log(`API call failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms: ${errorMsg}`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        return { success: false, error: 'Max retries reached' };
      };

      // IPC handler to get current song from renderer
      ipc.handle('master-sync:get-state', async () => {
        return { lastSongId, lastPausedState, lastQueueHash };
      });

      // IPC handler to receive state updates from renderer
      ipc.handle('master-sync:update-state', async (_event, state) => {
        try {
          const config = await getConfig();
          if (!config.enabled) return { success: false, error: 'Plugin disabled' };

          const { songId, isPaused, queueHash, videoId } = state;

          await log('State update received:', state);

          // Sync song change
          if (songId && songId !== lastSongId && videoId) {
            await log(`Song changed to: ${songId} (${videoId})`);
            
            const result = await callSlaveAPI('/api/v1/play', 'POST', { videoId });
            if (!result.success) {
              await log(`Failed to play song: ${result.error}`);
            } else {
              lastSongId = songId;
              await log('Song synced successfully');
            }
          }

          // Sync play/pause state
          if (config.syncPlayPause && isPaused !== null && isPaused !== lastPausedState) {
            await log(`Playback state changed to: ${isPaused ? 'paused' : 'playing'}`);
            
            const endpoint = isPaused ? '/api/v1/pause' : '/api/v1/play';
            const result = await callSlaveAPI(endpoint, 'POST');
            if (!result.success) {
              await log(`Failed to sync playback state: ${result.error}`);
            } else {
              lastPausedState = isPaused;
              await log('Playback state synced successfully');
            }
          }

          // Sync queue changes
          if (queueHash && queueHash !== lastQueueHash) {
            await log('Queue changed');
            lastQueueHash = queueHash;
            
            // Queue sync would require the full queue data
            // This is handled in the renderer
          }

          return { success: true };
        } catch (error: any) {
          await log(`Error in update-state handler: ${error.message}`);
          return { success: false, error: error.message };
        }
      });

      // IPC handler to sync queue
      ipc.handle('master-sync:sync-queue', async (_event, queue) => {
        try {
          const config = await getConfig();
          if (!config.enabled) {
            return { success: false, error: 'Plugin disabled' };
          }

          await log('Syncing queue with', queue.length, 'items');

          // Clear existing queue on slave
          const clearResult = await callSlaveAPI('/api/v1/queue/clear', 'POST');
          if (!clearResult.success) {
            await log(`Failed to clear queue: ${clearResult.error}`);
            return clearResult;
          }

          // Add songs to queue
          let successCount = 0;
          for (const item of queue) {
            if (item.videoId) {
              const addResult = await callSlaveAPI('/api/v1/queue/add', 'POST', {
                videoId: item.videoId,
              });
              if (addResult.success) {
                successCount++;
              }
            }
          }

          await log(`Queue synced: ${successCount}/${queue.length} items added`);
          return { success: true, synced: successCount };
        } catch (error: any) {
          await log(`Error in sync-queue handler: ${error.message}`);
          return { success: false, error: error.message };
        }
      });

      // Periodic sync check (as backup)
      const startPeriodicSync = async () => {
        const config = await getConfig();
        
        // Clear existing interval
        if (syncIntervalId) {
          clearInterval(syncIntervalId);
          syncIntervalId = null;
        }

        if (config.enabled) {
          // Validate config before starting
          const validationError = validateConfig(config);
          if (validationError) {
            await log(`Cannot start sync: ${validationError}`);
            return;
          }

          await log(`Starting periodic sync every ${config.syncInterval}ms`);
          
          // Trigger renderer to send current state immediately
          try {
            ipc.send('master-sync:request-state');
          } catch (error: any) {
            await log(`Failed to request state from renderer: ${error.message}`);
          }
          
          // Set up periodic checks
          syncIntervalId = setInterval(() => {
            try {
              ipc.send('master-sync:request-state');
            } catch (error: any) {
              console.error('[Master Sync] Failed to send state request:', error);
            }
          }, config.syncInterval);
        }
      };

      // Start sync after a short delay to ensure renderer is ready
      setTimeout(() => {
        startPeriodicSync().catch(error => {
          console.error('[Master Sync] Failed to start periodic sync:', error);
        });
      }, 1000);

      // Handle config changes
      getConfig().then((config) => {
        if (config.enabled) {
          log('Master Sync plugin started');
        }
      });
    },

    async onConfigChange(newConfig: MasterSyncConfig) {
      console.log('[Master Sync] Config updated:', newConfig);
      // Config changes are handled by the monitoring system
    },

    stop() {
      console.log('[Master Sync] Plugin stopped');
      // Clean up intervals on stop
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
      }
    },
  },

  renderer: {
    async start({ ipc, getConfig }) {
      const log = async (message: string, ...args: any[]) => {
        const config = await getConfig();
        if (config.logDebug) {
          console.log(`[Master Sync Renderer] ${message}`, ...args);
        }
      };

      await log('Renderer started');

      let currentSongId: string | null = null;
      let currentPausedState: boolean | null = null;
      let currentQueue: any[] = [];
      let domObserver: MutationObserver | null = null;
      let pollCheckInterval: NodeJS.Timeout | null = null;

      // Function to compute queue hash
      const computeQueueHash = (queue: any[]) => {
        return JSON.stringify(queue.map(item => item.videoId || item.id));
      };

      // Function to send state to backend
      const sendStateToBackend = async () => {
        const config = await getConfig();
        if (!config.enabled) return;

        try {
          await ipc.invoke('master-sync:update-state', {
            songId: currentSongId,
            isPaused: currentPausedState,
            queueHash: computeQueueHash(currentQueue),
            videoId: currentSongId, // Assuming songId is the videoId
          });
        } catch (error: any) {
          await log(`Failed to send state to backend: ${error.message}`);
        }
      };

      // Listen for state requests from backend
      ipc.on('master-sync:request-state', async () => {
        try {
          await sendStateToBackend();
        } catch (error: any) {
          await log(`Error sending state: ${error.message}`);
        }
      });

      // Monitor player state changes
      const observePlayer = async () => {
        // Try to access the player API
        let checkAttempts = 0;
        const maxCheckAttempts = 30; // 30 seconds (1 per second)

        pollCheckInterval = setInterval(async () => {
          checkAttempts++;
          const videoElement = document.querySelector<HTMLVideoElement>('video');
          const playerBar = document.querySelector('.player-bar');
          
          if (videoElement && playerBar) {
            if (pollCheckInterval) {
              clearInterval(pollCheckInterval);
              pollCheckInterval = null;
            }
            
            await log('Found player elements after ' + checkAttempts + ' attempts');

            // Monitor play/pause
            const playHandler = async () => {
              currentPausedState = false;
              await sendStateToBackend();
            };

            const pauseHandler = async () => {
              currentPausedState = true;
              await sendStateToBackend();
            };

            videoElement.addEventListener('play', playHandler);
            videoElement.addEventListener('pause', pauseHandler);

            // Monitor song changes with more specific selector
            domObserver = new MutationObserver(async () => {
              const titleElement = document.querySelector('[role="heading"][title]');
              const newSongId = titleElement?.textContent?.trim() || '';
              
              if (newSongId && newSongId !== currentSongId) {
                await log('Song changed:', newSongId);
                currentSongId = newSongId;
                
                // Try to get video ID from URL
                const videoId = new URLSearchParams(window.location.search).get('v');
                if (videoId) {
                  currentSongId = videoId;
                }
                
                await sendStateToBackend();
              }
            });

            // Watch a smaller target for better performance
            const playerContainer = document.querySelector('[role="main"]') || document.body;
            domObserver.observe(playerContainer, {
              childList: true,
              subtree: true,
              attributeFilter: ['title'],
            });

            // Initial state
            currentPausedState = videoElement.paused;
            await sendStateToBackend();
          } else if (checkAttempts >= maxCheckAttempts) {
            await log('Player elements not found after maximum attempts');
            if (pollCheckInterval) {
              clearInterval(pollCheckInterval);
              pollCheckInterval = null;
            }
          }
        }, 1000);
      };

      observePlayer();
    },

    onPlayerApiReady(api: any, { ipc, getConfig }: any) {
      const log = async (message: string) => {
        const config = await getConfig();
        if (config.logDebug) {
          console.log(`[Master Sync] ${message}`);
        }
      };

      log('Player API ready, setting up listeners');

      try {
        // Listen to state changes
        api.addEventListener('onStateChange', async (state: any) => {
          try {
            await log('Player state changed: ' + state);
            
            const playerResponse = api.getPlayerResponse?.();
            const currentSong = playerResponse?.videoDetails;
            
            if (currentSong) {
              const result = await ipc.invoke('master-sync:update-state', {
                songId: currentSong.videoId,
                videoId: currentSong.videoId,
                isPaused: state === 2, // YouTube player states: 2 = paused
                queueHash: null,
              });
              if (!result?.success) {
                await log(`Failed to update state: ${result?.error}`);
              }
            }
          } catch (error: any) {
            await log(`Error in onStateChange handler: ${error.message}`);
          }
        });

        // Get initial state
        const playerResponse = api.getPlayerResponse?.();
        const initialSong = playerResponse?.videoDetails;
        if (initialSong) {
          ipc.invoke('master-sync:update-state', {
            songId: initialSong.videoId,
            videoId: initialSong.videoId,
            isPaused: api.getPlayerState?.() === 2,
            queueHash: null,
          }).catch((error: any) => {
            console.error('[Master Sync] Failed to send initial state:', error);
          });
        }
      } catch (error: any) {
        console.error('[Master Sync] Error in onPlayerApiReady:', error);
      }
    },

    stop() {
      console.log('[Master Sync] Renderer stopped');
      // Note: Observers and intervals are cleaned up by the system on plugin stop
    },
  },
});
