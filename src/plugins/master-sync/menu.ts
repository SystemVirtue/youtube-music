import prompt from 'custom-electron-prompt';
import { dialog } from 'electron';

import promptOptions from '@/providers/prompt-options';

import type { MenuContext } from '@/types/contexts';
import type { MenuTemplate } from '@/menu';
import type { MasterSyncConfig } from './index';

export const onMenu = async ({
  getConfig,
  setConfig,
  window,
}: MenuContext<MasterSyncConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();

  return [
    {
      label: `Enabled: ${config.enabled ? 'Yes' : 'No'}`,
      enabled: false,
    },
    {
      label: 'Role',
      submenu: [
        {
          label: 'MASTER',
          type: 'radio',
          checked: config.role === 'MASTER',
          click() {
            setConfig({ role: 'MASTER' });
          },
        },
        {
          label: 'SLAVE',
          type: 'radio',
          checked: config.role === 'SLAVE',
          click() {
            setConfig({ role: 'SLAVE' });
          },
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: 'Configure SLAVE Host',
      type: 'normal',
      async click() {
        const currentConfig = await getConfig();
        const result =
          (await prompt(
            {
              title: 'Master Sync - Configure SLAVE Host',
              label: `Enter SLAVE computer IP address (current: ${currentConfig.slaveHost}):`,
              value: currentConfig.slaveHost,
              type: 'input',
              width: 380,
              ...promptOptions(),
            },
            window,
          )) ?? currentConfig.slaveHost;

        if (result && typeof result === 'string' && result.trim()) {
          const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^localhost$|^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/;
          if (!ipRegex.test(result.trim())) {
            alert('Invalid IP address or hostname. Please try again.');
            return;
          }

          setConfig({ slaveHost: result.trim() });
        }
      },
    },
    {
      label: `Device IP: ${config.slaveHost}`,
      enabled: false,
    },
    {
      label: 'Test Connection',
      type: 'normal',
      enabled: config.enabled,
      async click() {
        const currentConfig = await getConfig();
        const targetHost = currentConfig.role === 'SLAVE' ? '127.0.0.1' : currentConfig.slaveHost;
        const port = currentConfig.slavePort || 26538;
        const url = `http://${targetHost}:${port}/api/v1/song`;

        const timeoutMs = 3000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          // First attempt without explicit auth header
          let res = await fetch(url, { signal: controller.signal } as any);

          // If we get 401 or 403 and have a stored token, retry with it
          if ((res.status === 403 || res.status === 401) && currentConfig.slaveAuthToken) {
            res = await fetch(url, { signal: controller.signal, headers: { Authorization: `Bearer ${currentConfig.slaveAuthToken}` } } as any);
          }

          clearTimeout(timeout);

          if (res.ok) {
            const json = (await res.json().catch(() => null)) as any;
            const title = json?.title || json?.videoDetails?.title || json?.name || (json && JSON.stringify(json).slice(0, 200));
            await dialog.showMessageBox(window, {
              message: `Connection successful to ${targetHost}:${port}` + (title ? `\nSong info: ${title}` : ''),
            });
          } else if (res.status === 403) {
            await dialog.showMessageBox(window, { type: 'error', message: `Unauthorized (403). Consider requesting an authorization token from the SLAVE (Plugins → Master Sync → Authorization → Request Authorization Token).` });
          } else {
            const text = await res.text().catch(() => '');
            await dialog.showMessageBox(window, { type: 'error', message: `Connection failed: HTTP ${res.status} ${res.statusText}\n${text}` });
          }
        } catch (err: any) {
          clearTimeout(timeout);
          if (err && err.name === 'AbortError') {
            await dialog.showMessageBox(window, { type: 'error', message: `Connection timed out after ${timeoutMs}ms` });
          } else {
            await dialog.showMessageBox(window, { type: 'error', message: `Connection error: ${err?.message ?? String(err)}` });
          }
        } finally {
          clearTimeout(timeout);
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Sync Play/Pause',
      type: 'checkbox',
      checked: config.syncPlayPause,
      click() {
        setConfig({ syncPlayPause: !config.syncPlayPause });
      },
    },
    {
      label: 'Debug Logging',
      type: 'checkbox',
      checked: config.logDebug,
      click() {
        setConfig({ logDebug: !config.logDebug });
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Authorization',
      submenu: [
        {
          label: 'Request Authorization Token',
          type: 'normal',
          async click() {
            const currentConfig = await getConfig();
            const url = `http://${currentConfig.slaveHost}:${currentConfig.slavePort}/auth/master-sync`;
            try {
              const res = await fetch(url, { method: 'POST' });
              if (!res.ok) {
                await dialog.showMessageBox(window, { type: 'error', message: `Token request failed: ${res.status} ${res.statusText}` });
                return;
              }
              const json = (await res.json()) as { accessToken?: string };
              const token = json.accessToken;
              if (token) {
                setConfig({ slaveAuthToken: token });
                await dialog.showMessageBox(window, { message: 'Authorization token received and saved.' });
              } else {
                await dialog.showMessageBox(window, { type: 'error', message: 'No token received from SLAVE.' });
              }
            } catch (err: any) {
              await dialog.showMessageBox(window, { type: 'error', message: `Failed to request token: ${err.message}` });
            }
          },
        },
        {
          label: 'Clear Authorization Token',
          type: 'normal',
          click() {
            setConfig({ slaveAuthToken: '' });
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Auto-request token on 403',
          type: 'checkbox',
          checked: config.autoRequestToken,
          click() {
            setConfig({ autoRequestToken: !config.autoRequestToken });
          },
        },
        {
          label: `Auth token: ${config.slaveAuthToken ? 'Set' : 'Not set'}`,
          enabled: false,
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: `Role: ${config.role} — Device IP: ${config.slaveHost}`,
      enabled: false,
    },
  ];
};
