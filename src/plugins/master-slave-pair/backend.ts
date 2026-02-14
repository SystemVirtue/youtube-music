import { type Server } from 'node:http';

import express from 'express';

import { createBackend } from '@/utils';

import { InstanceRole, type MasterSlavePairConfig } from './config';

import type { BackendContext } from '@/types/contexts';

interface TransferData {
  server: Server | null;
  ws: WebSocket | null;
}

interface MasterSlaveBackend {
  server: Server | null;
  ws: WebSocket | null;
  serverData: TransferData;
  clientData: TransferData;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastCommandTime: number;
}

interface ConnectParams {
  host: string;
  port: number;
}

interface SetupParams {
  host: string;
  port: number;
}

async function setupServer(ctx: BackendContext<MasterSlavePairConfig>) {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.post('/controlPanel', async (req, res) => {
    const config = await ctx.getConfig();
    const { action } = req.body;

    console.log('[master-slave-pair] Received command:', action);

    if (action === 'play') {
      ctx.ipc.send('play');
    } else if (action === 'pause') {
      ctx.ipc.send('pause');
    }

    res.json({ success: true, timestamp: Date.now() });
  });

  const port = await ctx.getConfig().then((c) => c.masterPort);
  const server = app.listen(port, () => {
    console.log(`[master-slave-pair] Server started on port ${port}`);
  });

  return server;
}

async function connectToMaster(ctx: BackendContext<MasterSlavePairConfig>) {
  const config = await ctx.getConfig();
  const url = `http://${config.masterHost}:${config.masterPort}`;

  console.log('[master-slave-pair] Attempting to connect to master at:', url);
  
  // Simple polling for master connection
  const checkConnection = setInterval(async () => {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) {
        console.log('[master-slave-pair] Connected to master');
        clearInterval(checkConnection);
        // Update connection status via IPC if possible
        ctx.ipc.send('master-slave-pair:status-change', 'connected');
      }
    } catch (err) {
      console.error('[master-slave-pair] Connection error:', err);
      ctx.ipc.send('master-slave-pair:status-change', 'error');
    }
  }, 5000);
  
  // Set initial connecting status
  ctx.ipc.send('master-slave-pair:status-change', 'connecting');
}

export const backend = createBackend<MasterSlaveBackend, MasterSlavePairConfig>({
  server: null,
  ws: null,
  serverData: { server: null, ws: null },
  clientData: { server: null, ws: null },
  connectionStatus: 'disconnected',
  lastCommandTime: 0,

  async start(ctx: BackendContext<MasterSlavePairConfig>) {
    const config = await ctx.getConfig();

    if (config.role === InstanceRole.MASTER) {
      this.server = await setupServer(ctx);
      this.connectionStatus = 'connected';
      ctx.ipc.send('master-slave-pair:status-change', 'connected');
    } else if (config.role === InstanceRole.SLAVE && config.autoConnect) {
      this.connectionStatus = 'connecting';
      await connectToMaster(ctx);
    }

    // Control endpoints that return JWT Server
    // IPC for sending data to master or responding from slave
    ctx.ipc.handle('master-slave-pair:send-command', async (command: string, payload?: object) => {
      const config = await ctx.getConfig();
      
      if (config.role === InstanceRole.MASTER) {
        const url = `http://${config.slaveHost}:${config.slavePort}/controlPanel`;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, payload }),
          });
          this.lastCommandTime = Date.now();
          if (res.ok) {
            ctx.ipc.send('master-slave-pair:status-change', 'connected');
          } else {
            ctx.ipc.send('master-slave-pair:status-change', 'error');
          }
          return { success: res.ok };
        } catch (err) {
          console.error('[master-slave-pair] Send command error:', err);
          ctx.ipc.send('master-slave-pair:status-change', 'error');
          return { success: false };
        }
      }
    });

    // Test connection endpoint
    ctx.ipc.handle('master-slave-pair:test-connection', async () => {
      const config = await ctx.getConfig();
      
      if (config.role === InstanceRole.MASTER) {
        // Test if we can reach slave
        const url = `http://${config.slaveHost}:${config.slavePort}/health`;
        try {
          const res = await fetch(url, { method: 'GET' });
          return { success: res.ok, status: res.status };
        } catch (err) {
          return { success: false, error: err.message };
        }
      } else if (config.role === InstanceRole.SLAVE) {
        // Test if we can reach master
        const url = `http://${config.masterHost}:${config.masterPort}/health`;
        try {
          const res = await fetch(url, { method: 'GET' });
          return { success: res.ok, status: res.status };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
      
      return { success: false, error: 'Invalid role' };
    });

    // Start new server/client based on the role
    // or reinstall/restart to get in sync with instance role & ports
    ctx.ipc.handle('master-slave-pair:restart', async () => {
      await this.stop?.();
      await this.start?.(ctx);
      return { success: true };
    });
  },

  async stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('[master-slave-pair] Server stopped');
    }
  },

  async onConfigChange(config: MasterSlavePairConfig, ctx: BackendContext<MasterSlavePairConfig>) {
    // Only restart if role actually changed, not just connection settings
    const currentRole = this.connectionStatus === 'disconnected' ? InstanceRole.NONE : config.role;
    if (config.role !== currentRole) {
      console.log('[master-slave-pair] Role changed, restarting...');
      await this.stop?.();
      await this.start?.(ctx);
    } else {
      console.log('[master-slave-pair] Configuration updated, no restart needed');
    }
  },
});
