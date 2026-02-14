import prompt from 'custom-electron-prompt';
import { networkInterfaces } from 'node:os';

import { t } from '@/i18n';
import promptOptions from '@/providers/prompt-options';

import { type MasterSlavePairConfig, InstanceRole } from './config';

import type { MenuContext } from '@/types/contexts';
import type { MenuTemplate } from '@/menu';

// Get the local IP address
function getLocalIPAddress(): string {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    
    for (const address of iface) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return '127.0.0.1'; // fallback
}

export const onMenu = async ({
  getConfig,
  setConfig,
  window,
}: MenuContext<MasterSlavePairConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();
  const localIP = getLocalIPAddress();

  // Determine sync status (simplified for now)
  const getSyncStatus = () => {
    if (config.role === InstanceRole.NONE) return 'disconnected';
    if (config.role === InstanceRole.MASTER) {
      return config.slaveHost !== '127.0.0.1' ? 'connected' : 'disconnected';
    }
    if (config.role === InstanceRole.SLAVE) {
      return config.masterHost !== '127.0.0.1' ? 'connected' : 'disconnected';
    }
    return 'disconnected';
  };

  const syncStatus = getSyncStatus();

  return [
    {
      label: `This Device IP: ${localIP}`,
      type: 'normal',
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: t('plugins.master-slave-pair.menu.enabled'),
      type: 'checkbox',
      checked: config.enabled,
      click(item) {
        setConfig({ ...config, enabled: item.checked });
      },
    },
    {
      label: t('plugins.master-slave-pair.menu.role.label'),
      type: 'submenu',
      submenu: [
        {
          label: t('plugins.master-slave-pair.menu.role.submenu.none'),
          type: 'radio',
          checked: config.role === InstanceRole.NONE,
          click() {
            setConfig({ ...config, role: InstanceRole.NONE });
          },
        },
        {
          label: t('plugins.master-slave-pair.menu.role.submenu.master'),
          type: 'radio',
          checked: config.role === InstanceRole.MASTER,
          click() {
            setConfig({ ...config, role: InstanceRole.MASTER });
          },
        },
        {
          label: t('plugins.master-slave-pair.menu.role.submenu.slave'),
          type: 'radio',
          checked: config.role === InstanceRole.SLAVE,
          click() {
            setConfig({ ...config, role: InstanceRole.SLAVE });
          },
        },
      ],
    },
    {
      type: 'separator',
    },
    // Only show slave host config when in Master mode
    ...(config.role === InstanceRole.MASTER ? [
      {
        label: t('plugins.master-slave-pair.menu.slave-host.label'),
        type: 'normal',
        async click() {
          const newHost = await prompt(
            {
              title: t('plugins.master-slave-pair.prompt.slave-host.title'),
              label: t('plugins.master-slave-pair.prompt.slave-host.label'),
              value: config.slaveHost,
              type: 'input',
              inputAttrs: { type: 'text', placeholder: 'e.g., 192.168.1.100' },
              width: 380,
              ...promptOptions(),
            },
            window,
          );

          if (newHost && newHost !== config.slaveHost) {
            setConfig({ ...config, slaveHost: newHost });
          }
        },
      }
    ] : []),
    // Only show master host config when in Slave mode
    ...(config.role === InstanceRole.SLAVE ? [
      {
        label: t('plugins.master-slave-pair.menu.master-host.label'),
        type: 'normal',
        async click() {
          const newHost = await prompt(
            {
              title: t('plugins.master-slave-pair.prompt.master-host.title'),
              label: t('plugins.master-slave-pair.prompt.master-host.label'),
              value: config.masterHost,
              type: 'input',
              inputAttrs: { type: 'text', placeholder: 'e.g., 192.168.1.100' },
              width: 380,
              ...promptOptions(),
            },
            window,
          );

          if (newHost && newHost !== config.masterHost) {
            setConfig({ ...config, masterHost: newHost });
          }
        },
      }
    ] : []),
    {
      type: 'separator',
    },
    {
      label: `${t('plugins.master-slave-pair.menu.status')}: ${t(`plugins.master-slave-pair.status.${syncStatus}`)}`,
      type: 'normal',
      enabled: false,
    },
    ...(config.role !== InstanceRole.NONE ? [
      {
        label: t('plugins.master-slave-pair.menu.test-connection'),
        type: 'normal',
        async click() {
          try {
            console.log('[master-slave-pair] Testing connection...');
            const result = await window.electronAPI.invoke('master-slave-pair:test-connection');
            if (result.success) {
              console.log('[master-slave-pair] Connection test successful!');
              // Could show a toast notification here
            } else {
              console.error('[master-slave-pair] Connection test failed:', result.error);
              // Could show an error toast here
            }
          } catch (err) {
            console.error('[master-slave-pair] Test connection error:', err);
          }
        },
      }
    ] : []),
  ];
};
