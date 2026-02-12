import { createPlugin } from '@/utils';
import { t } from '@/i18n';

import { defaultMasterSlavePairConfig } from './config';
import { onMenu } from './menu';
import { backend } from './backend';
import { renderer } from './renderer';

export default createPlugin({
  name: () => t('plugins.master-slave-pair.name'),
  description: () => t('plugins.master-slave-pair.description'),
  restartNeeded: true,
  config: defaultMasterSlavePairConfig,
  addedVersion: '3.7.X',
  menu: onMenu,
  backend,
  renderer,
});
