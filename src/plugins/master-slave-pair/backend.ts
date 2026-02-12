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

  app.post('/controlPanel', async (req, res) => {
    const config = await ctx.getConfig();
    const { action } = req.body;

    if (action === 'play') {
      ctx.ipc.send('play');
    } else if (action === 'pause') {
      ctx.ipc.send('pause');
    }

    res.json({ success: true });
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

  // Simple polling for master connection
  const checkConnection = setInterval(async () => {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) {
        console.log('[master-slave-pair] Connected to master');
        clearInterval(checkConnection);
      }
    } catch (err) {
      console.error('[master-slave-pair] Connection error:', err);
    }
  }, 5000);
}

export const backend = createBackend<MasterSlaveBackend, MasterSlavePairConfig>({
  server: null,
  ws: null,
  serverData: { server: null, ws: null },
  clientData: { server: null, ws: null },

  async start(ctx: BackendContext<MasterSlavePairConfig>) {
    const config = await ctx.getConfig();

    if (config.role === InstanceRole.MASTER) {
      this.server = await setupServer(ctx);
    } else if (config.role === InstanceRole.SLAVE && config.autoConnect) {
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
          return { success: res.ok };
        } catch (err) {
          console.error('[master-slave-pair] Send command error:', err);
          return { success: false };
        }
      }
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
    // Restart on role or connection settings changed
    if (config.role !== this.serverData.server?.constructor) {
      await this.stop?.();
      await this.start?.(ctx);
    }
  },
});
