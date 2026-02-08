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
