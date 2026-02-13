import prompt from 'custom-electron-prompt';

import { t } from '@/i18n';
import promptOptions from '@/providers/prompt-options';

import { type LyricOverlayConfig, defaultLyricOverlayConfig } from './config';

import type { MenuContext } from '@/types/contexts';
import type { MenuTemplate } from '@/menu';

export const onMenu = async ({
  getConfig,
  setConfig,
  window,
}: MenuContext<LyricOverlayConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();

  return [
    {
      label: t('plugins.lyric-overlay.menu.position.label'),
      type: 'submenu',
      submenu: [
        {
          label: t('plugins.lyric-overlay.menu.position.submenu.top'),
          type: 'radio',
          checked: config.position === 'top',
          click() {
            setConfig({ ...config, position: 'top' });
          },
        },
        {
          label: t('plugins.lyric-overlay.menu.position.submenu.center'),
          type: 'radio',
          checked: config.position === 'center',
          click() {
            setConfig({ ...config, position: 'center' });
          },
        },
        {
          label: t('plugins.lyric-overlay.menu.position.submenu.bottom'),
          type: 'radio',
          checked: config.position === 'bottom',
          click() {
            setConfig({ ...config, position: 'bottom' });
          },
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: t('plugins.lyric-overlay.menu.style.label'),
      type: 'submenu',
      submenu: [
        {
          label: t('plugins.lyric-overlay.menu.style.submenu.default'),
          type: 'radio',
          checked: config.style === 'default',
          click() {
            setConfig({ ...config, style: 'default' });
          },
        },
        {
          label: t('plugins.lyric-overlay.menu.style.submenu.karaoke'),
          type: 'radio',
          checked: config.style === 'karaoke',
          click() {
            setConfig({ ...config, style: 'karaoke' });
          },
        },
        {
          label: t('plugins.lyric-overlay.menu.style.submenu.minimal'),
          type: 'radio',
          checked: config.style === 'minimal',
          click() {
            setConfig({ ...config, style: 'minimal' });
          },
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: t('plugins.lyric-overlay.menu.font-size.label'),
      type: 'normal',
      async click() {
        const currentConfig = await getConfig();
        const newSize =
          (await prompt(
            {
              title: t('plugins.lyric-overlay.prompt.font-size.title'),
              label: t('plugins.lyric-overlay.prompt.font-size.label'),
              value: currentConfig.fontSize,
              type: 'counter',
              counterOptions: { minimum: 12, maximum: 72 },
              width: 380,
              ...promptOptions(),
            },
            window,
          )) ??
          currentConfig.fontSize ??
          defaultLyricOverlayConfig.fontSize;

        setConfig({ ...currentConfig, fontSize: newSize });
      },
    },
    {
      label: t('plugins.lyric-overlay.menu.font-color.label'),
      type: 'normal',
      async click() {
        const currentConfig = await getConfig();
        const newColor =
          (await prompt(
            {
              title: t('plugins.lyric-overlay.prompt.font-color.title'),
              label: t('plugins.lyric-overlay.prompt.font-color.label'),
              value: currentConfig.fontColor,
              type: 'input',
              inputAttrs: { type: 'color' },
              width: 380,
              ...promptOptions(),
            },
            window,
          )) ??
          currentConfig.fontColor ??
          defaultLyricOverlayConfig.fontColor;

        setConfig({ ...currentConfig, fontColor: newColor });
      },
    },
    {
      label: t('plugins.lyric-overlay.menu.background-opacity.label'),
      type: 'normal',
      async click() {
        const currentConfig = await getConfig();
        const newOpacity =
          (await prompt(
            {
              title: t('plugins.lyric-overlay.prompt.background-opacity.title'),
              label: t('plugins.lyric-overlay.prompt.background-opacity.label'),
              value: currentConfig.backgroundOpacity * 100,
              type: 'counter',
              counterOptions: { minimum: 0, maximum: 100 },
              width: 380,
              ...promptOptions(),
            },
            window,
          )) ?? currentConfig.backgroundOpacity * 100;

        setConfig({ ...currentConfig, backgroundOpacity: newOpacity / 100 });
      },
    },
    {
      type: 'separator',
    },
    {
      label: t('plugins.lyric-overlay.menu.show-on-video-only'),
      type: 'checkbox',
      checked: config.showOnVideoOnly,
      click(item) {
        setConfig({ ...config, showOnVideoOnly: item.checked });
      },
    },
  ];
};
