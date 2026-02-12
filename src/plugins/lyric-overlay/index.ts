import style from './style.css?inline';
import { createPlugin } from '@/utils';
import { t } from '@/i18n';

import { defaultLyricOverlayConfig } from './config';
import { onMenu } from './menu';
import { renderer } from './renderer';

export default createPlugin({
  name: () => t('plugins.lyric-overlay.name'),
  description: () => t('plugins.lyric-overlay.description'),
  restartNeeded: true,
  config: defaultLyricOverlayConfig,
  addedVersion: '3.7.X',
  stylesheets: [style],
  menu: onMenu,
  renderer,
});
