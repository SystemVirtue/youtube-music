import { screen } from 'electron';

import { t } from '@/i18n';

import { type VideoCastConfig } from './config';

import type { MenuContext } from '@/types/contexts';
import type { MenuTemplate } from '@/menu';

export const onMenu = async ({
  getConfig,
  setConfig,
}: MenuContext<VideoCastConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();
  const displays = screen.getAllDisplays();

  const displayMenuItems = displays.map((display, index) => ({
    label: `${t('plugins.video-cast.menu.display')} ${index + 1} (${display.size.width}x${display.size.height})`,
    type: 'radio' as const,
    checked: config.selectedDisplay === display.id.toString(),
    click() {
      setConfig({
        ...config,
        selectedDisplay: display.id.toString(),
        // Don't disable casting when selecting display - let window move or get created
      });
    },
  }));

  return [
    {
      label: t('plugins.video-cast.menu.enable-cast'),
      type: 'checkbox',
      checked: config.castEnabled,
      click(item) {
        setConfig({ ...config, castEnabled: item.checked });
      },
    },
    {
      type: 'separator',
    },
    {
      label: t('plugins.video-cast.menu.select-display'),
      type: 'submenu',
      submenu: [
        {
          label: t('plugins.video-cast.menu.no-display'),
          type: 'radio',
          checked: !config.selectedDisplay,
          click() {
            setConfig({
              ...config,
              selectedDisplay: '',
            });
          },
        },
        { type: 'separator' },
        ...displayMenuItems,
      ],
    },
    {
      type: 'separator',
    },
    {
      label: t('plugins.video-cast.menu.show-overlay'),
      type: 'checkbox',
      checked: config.showOverlay,
      click(item) {
        setConfig({ ...config, showOverlay: item.checked });
      },
    },
  ];
};
