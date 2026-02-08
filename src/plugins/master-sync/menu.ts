import prompt from 'custom-electron-prompt';

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
          // Validate IP address format (basic)
          const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^localhost$|^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/;
          if (!ipRegex.test(result.trim())) {
            alert('Invalid IP address or hostname. Please try again.');
            return;
          }

          setConfig({ ...currentConfig, slaveHost: result.trim() });
        }
      },
    },
    {
      label: 'Configure SLAVE Port',
      type: 'normal',
      async click() {
        const currentConfig = await getConfig();
        const result =
          (await prompt(
            {
              title: 'Master Sync - Configure SLAVE Port',
              label: `Enter SLAVE API Server port (current: ${currentConfig.slavePort}):`,
              value: currentConfig.slavePort,
              type: 'counter',
              counterOptions: { minimum: 1, maximum: 65535 },
              width: 380,
              ...promptOptions(),
            },
            window,
          )) ?? currentConfig.slavePort;

        if (result && typeof result === 'number' && result >= 1 && result <= 65535) {
          setConfig({ ...currentConfig, slavePort: result });
        }
      },
    },
    {
      label: 'Configure Authorization Token',
      type: 'normal',
      async click() {
        const currentConfig = await getConfig();
        const result =
          (await prompt(
            {
              title: 'Master Sync - Configure Authorization Token',
              label: 'Paste your API Server authorization token:',
              value: currentConfig.slaveAuthToken ? '••••••••' : '',
              type: 'input',
              width: 380,
              ...promptOptions(),
            },
            window,
          )) ?? '';

        if (result && typeof result === 'string' && result.trim() && result !== '••••••••') {
          setConfig({ ...currentConfig, slaveAuthToken: result.trim() });
        }
      },
    },
    {
      label: 'Configure Sync Interval (ms)',
      type: 'normal',
      async click() {
        const currentConfig = await getConfig();
        const result =
          (await prompt(
            {
              title: 'Master Sync - Configure Sync Interval',
              label: `Enter sync interval in milliseconds (current: ${currentConfig.syncInterval}ms):`,
              value: currentConfig.syncInterval,
              type: 'counter',
              counterOptions: { minimum: 500, maximum: 60000 },
              width: 380,
              ...promptOptions(),
            },
            window,
          )) ?? currentConfig.syncInterval;

        if (result && typeof result === 'number' && result >= 500) {
          setConfig({ ...currentConfig, syncInterval: result });
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
      label: `Connection: ${config.slaveHost}:${config.slavePort}`,
      enabled: false,
    },
    {
      label: config.slaveAuthToken ? '✓ Authorization Token Set' : '✗ No Token Set',
      enabled: false,
    },
  ];
};
