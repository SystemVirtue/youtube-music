import { createPlugin } from '@/utils';
import { t } from '@/i18n';

import { defaultVideoCastConfig } from './config';
import { onMenu } from './menu';
import { backend } from './backend';
import { renderer } from './renderer';

export default createPlugin({
  name: () => t('plugins.video-cast.name'),
  description: () => t('plugins.video-cast.description'),
  restartNeeded: true,
  config: defaultVideoCastConfig,
  addedVersion: '3.7.X',
  menu: onMenu,
  backend,
  renderer,
});
