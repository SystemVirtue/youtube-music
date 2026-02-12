import { t } from '@/i18n';

import { type AdBlockerConfig } from './config';

import type { MenuContext } from '@/types/contexts';
import type { MenuTemplate } from '@/menu';

export const onMenu = async ({
  getConfig,
  setConfig,
}: MenuContext<AdBlockerConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();

  return [
    {
      label: t('plugins.adblocker.menu.blocker'),
      type: 'checkbox',
      checked: config.enabled,
      click(item) {
        setConfig({ ...config, enabled: item.checked });
      },
    },
  ];
};
