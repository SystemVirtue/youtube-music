import prompt from 'custom-electron-prompt';

import { t } from '@/i18n';
import promptOptions from '@/providers/prompt-options';

import { type MasterSlavePairConfig, InstanceRole } from './config';

import type { MenuContext } from '@/types/contexts';
import type { MenuTemplate } from '@/menu';

export const onMenu = async ({
  getConfig,
  setConfig,
  window,
}: MenuContext<MasterSlavePairConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();

  return [
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
            inputAttrs: { type: 'text' },
            width: 380,
            ...promptOptions(),
          },
          window,
        );

        if (newHost) {
          setConfig({ ...config, masterHost: newHost });
        }
      },
    },
    {
      label: t('plugins.master-slave-pair.prompt.master-port.label'),
      type: 'normal',
      async click() {
        const newPort = await prompt(
          {
            title: t('plugins.master-slave-pair.prompt.master-port.title'),
            label: t('plugins.master-slave-pair.prompt.master-port.label'),
            value: config.masterPort,
            type: 'counter',
            counterOptions: { minimum: 1, maximum: 65535 },
            width: 380,
            ...promptOptions(),
          },
          window,
        );

        if (newPort) {
          setConfig({ ...config, masterPort: newPort });
        }
      },
    },
    {
      type: 'separator',
    },
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
            inputAttrs: { type: 'text' },
            width: 380,
            ...promptOptions(),
          },
          window,
        );

        if (newHost) {
          setConfig({ ...config, slaveHost: newHost });
        }
      },
    },
    {
      label: t('plugins.master-slave-pair.menu.slave-port.label'),
      type: 'normal',
      async click() {
        const newPort = await prompt(
          {
            title: t('plugins.master-slave-pair.prompt.slave-port.title'),
            label: t('plugins.master-slave-pair.prompt.slave-port.label'),
            value: config.slavePort,
            type: 'counter',
            counterOptions: { minimum: 1, maximum: 65535 },
            width: 380,
            ...promptOptions(),
          },
          window,
        );

        if (newPort) {
          setConfig({ ...config, slavePort: newPort });
        }
      },
    },
  ];
};
