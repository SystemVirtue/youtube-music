import is from 'electron-is';
import {
  app,
  type BrowserWindow,
  clipboard,
  dialog,
  Menu,
  type MenuItem,
  shell,
} from 'electron';
import prompt from 'custom-electron-prompt';
import { satisfies } from 'semver';

import { allPlugins } from 'virtual:plugins';

import { languageResources } from 'virtual:i18n';

import config from './config';

import { restart } from './providers/app-controls';
import { startingPages } from './providers/extracted-data';
import promptOptions from './providers/prompt-options';

import { getAllMenuTemplate, loadAllMenuPlugins } from './loader/menu';
import { setLanguage, t } from '@/i18n';

import packageJson from '../package.json';

export type MenuTemplate = Electron.MenuItemConstructorOptions[];

// True only if in-app-menu was loaded on launch
const inAppMenuActive = await config.plugins.isEnabled('in-app-menu');

const pluginEnabledMenu = async (
  plugin: string,
  label = '',
  description: string | undefined = undefined,
  isNew = false,
  hasSubmenu = false,
  refreshMenu: (() => void) | undefined = undefined,
): Promise<Electron.MenuItemConstructorOptions> => ({
  label: label || plugin,
  sublabel: isNew ? t('main.menu.plugins.new') : undefined,
  toolTip: description,
  type: 'checkbox',
  checked: await config.plugins.isEnabled(plugin),
  click(item: Electron.MenuItem) {
    if (item.checked) {
      config.plugins.enable(plugin);
    } else {
      config.plugins.disable(plugin);
    }

    if (hasSubmenu) {
      refreshMenu?.();
    }
  },
});

export const refreshMenu = async (win: BrowserWindow) => {
  await setApplicationMenu(win);
  if (inAppMenuActive) {
    win.webContents.send('refresh-in-app-menu');
  }
};

export const mainMenuTemplate = async (
  win: BrowserWindow,
): Promise<MenuTemplate> => {
  try {
    console.log('DEBUG: Starting mainMenuTemplate generation');
    const innerRefreshMenu = () => refreshMenu(win);
    const { navigationHistory } = win.webContents;
    
    console.log('DEBUG: Loading menu plugins');
    await loadAllMenuPlugins(win);

    console.log('DEBUG: Getting all plugins');
    const allPluginsStubs = await allPlugins();
    console.log('DEBUG: Found plugins:', Object.keys(allPluginsStubs).length);

    console.log('DEBUG: Getting menu templates from plugins');
    const menuTemplates = getAllMenuTemplate();
    console.log('DEBUG: Menu templates found:', Object.keys(menuTemplates).length);

    const menuResult = await Promise.all(
      Object.entries(menuTemplates).map(async ([id, template]) => {
        try {
          console.log('DEBUG: Processing plugin menu:', id);
          const plugin = allPluginsStubs[id];
          const pluginLabel = plugin?.name?.() ?? id;
          const pluginDescription = plugin?.description?.() ?? undefined;
          const isNew = plugin?.addedVersion
            ? satisfies(packageJson.version, plugin.addedVersion)
            : false;

      if (!(await config.plugins.isEnabled(id))) {
        return [
          id,
          await pluginEnabledMenu(
            id,
            pluginLabel,
            pluginDescription,
            isNew,
            true,
            innerRefreshMenu,
          ),
        ] as const;
      }

      return [
        id,
        {
          label: pluginLabel,
          sublabel: isNew ? t('main.menu.plugins.new') : undefined,
          toolTip: pluginDescription,
          submenu: [
            await pluginEnabledMenu(
              id,
              t('main.menu.plugins.enabled'),
              undefined,
              false,
              true,
              innerRefreshMenu,
            ),
            { type: 'separator' },
            ...template,
          ],
        } satisfies Electron.MenuItemConstructorOptions,
      ] as const;
        } catch (error) {
          console.error('DEBUG: Error processing plugin menu:', id, error);
          // Return a basic menu item for this plugin
          return [
            id,
            await pluginEnabledMenu(
              id,
              id,
              undefined,
              false,
              true,
              innerRefreshMenu,
            ),
          ] as const;
        }
      }),
    );

  const availablePlugins = Object.keys(await allPlugins());
  const pluginMenus = await Promise.all(
    availablePlugins
      .sort((a, b) => {
        const aPluginLabel = allPluginsStubs[a]?.name?.() ?? a;
        const bPluginLabel = allPluginsStubs[b]?.name?.() ?? b;

        return aPluginLabel.localeCompare(bPluginLabel);
      })
      .map(async (id) => {
        try {
          console.log('DEBUG: Processing available plugin:', id);
          const predefinedTemplate = menuResult.find((it) => it[0] === id);
          if (predefinedTemplate) return predefinedTemplate[1];

          const plugin = allPluginsStubs[id];
          const pluginLabel = plugin?.name?.() ?? id;
          const pluginDescription = plugin?.description?.() ?? undefined;
          const isNew = plugin?.addedVersion
            ? satisfies(packageJson.version, plugin.addedVersion)
            : false;

          return await pluginEnabledMenu(
            id,
            pluginLabel,
            pluginDescription,
            isNew,
            true,
            innerRefreshMenu,
          );
        } catch (error) {
          console.error('DEBUG: Error processing available plugin:', id, error);
          return await pluginEnabledMenu(
            id,
            id,
            undefined,
            false,
            true,
            innerRefreshMenu,
          );
        }
      }),
  );

    console.log('DEBUG: Plugin menus processed:', pluginMenus.length);

    console.log('DEBUG: Getting language resources');
    const langResources = await languageResources();
    const availableLanguages = Object.keys(langResources);
    console.log('DEBUG: Available languages:', availableLanguages.length);

    console.log('DEBUG: Building final menu template');
    const finalMenu = [
    {
      label: t('main.menu.plugins.label'),
      submenu: pluginMenus,
    },
    {
      label: t('main.menu.options.label'),
      submenu: [
        {
          label: t('main.menu.options.submenu.auto-update'),
          type: 'checkbox',
          checked: config.get('options.autoUpdates'),
          click(item: MenuItem) {
            config.setMenuOption('options.autoUpdates', item.checked);
          },
        },
        {
          label: t('main.menu.options.submenu.resume-on-start'),
          type: 'checkbox',
          checked: config.get('options.resumeOnStart'),
          click(item: MenuItem) {
            config.setMenuOption('options.resumeOnStart', item.checked);
          },
        },
        {
          label: t('main.menu.options.submenu.starting-page.label'),
          submenu: (() => {
            const subMenuArray: Electron.MenuItemConstructorOptions[] =
              Object.keys(startingPages).map((name) => ({
                label: name,
                type: 'radio',
                checked: config.get('options.startingPage') === name,
                click() {
                  config.set('options.startingPage', name);
                },
              }));
            subMenuArray.unshift({
              label: t('main.menu.options.submenu.starting-page.unset'),
              type: 'radio',
              checked: config.get('options.startingPage') === '',
              click() {
                config.set('options.startingPage', '');
              },
            });
            return subMenuArray;
          })(),
        },
        {
          label: t('main.menu.options.submenu.visual-tweaks.label'),
          submenu: [
            {
              label: t(
                'main.menu.options.submenu.visual-tweaks.submenu.remove-upgrade-button',
              ),
              type: 'checkbox',
              checked: config.get('options.removeUpgradeButton'),
              click(item: MenuItem) {
                config.setMenuOption(
                  'options.removeUpgradeButton',
                  item.checked,
                );
              },
            },
            {
              label: t(
                'main.menu.options.submenu.visual-tweaks.submenu.custom-window-title.label',
              ),
              async click() {
                const output = await prompt(
                  {
                    title: t(
                      'main.menu.options.submenu.visual-tweaks.submenu.custom-window-title.label',
                    ),
                    label: t(
                      'main.menu.options.submenu.visual-tweaks.submenu.custom-window-title.prompt.label',
                    ),
                    value: config.get('options.customWindowTitle') || '',
                    type: 'input',
                    inputAttrs: {
                      type: 'text',
                      placeholder: t(
                        'main.menu.options.submenu.visual-tweaks.submenu.custom-window-title.prompt.placeholder',
                      ),
                    },
                    width: 500,
                    ...promptOptions(),
                  },
                  win,
                );
                if (typeof output === 'string') {
                  config.setMenuOption('options.customWindowTitle', output);
                }
              },
            },
            {
              label: t(
                'main.menu.options.submenu.visual-tweaks.submenu.like-buttons.label',
              ),
              submenu: [
                {
                  label: t(
                    'main.menu.options.submenu.visual-tweaks.submenu.like-buttons.default',
                  ),
                  type: 'radio',
                  checked: !config.get('options.likeButtons'),
                  click() {
                    config.set('options.likeButtons', '');
                  },
                },
                {
                  label: t(
                    'main.menu.options.submenu.visual-tweaks.submenu.like-buttons.force-show',
                  ),
                  type: 'radio',
                  checked: config.get('options.likeButtons') === 'force',
                  click() {
                    config.set('options.likeButtons', 'force');
                  },
                },
                {
                  label: t(
                    'main.menu.options.submenu.visual-tweaks.submenu.like-buttons.hide',
                  ),
                  type: 'radio',
                  checked: config.get('options.likeButtons') === 'hide',
                  click() {
                    config.set('options.likeButtons', 'hide');
                  },
                },
              ],
            },
            {
              label: t(
                'main.menu.options.submenu.visual-tweaks.submenu.theme.label',
              ),
              submenu: [
                ...((config.get('options.themes')?.length ?? 0) === 0
                  ? [
                      {
                        label: t(
                          'main.menu.options.submenu.visual-tweaks.submenu.theme.submenu.no-theme',
                        ),
                      },
                    ]
                  : []),
                ...(config.get('options.themes')?.map((theme: string) => ({
                  type: 'normal' as const,
                  label: theme,
                  async click() {
                    const { response } = await dialog.showMessageBox(win, {
                      type: 'question',
                      defaultId: 1,
                      title: t(
                        'main.menu.options.submenu.visual-tweaks.submenu.theme.dialog.remove-theme',
                      ),
                      message: t(
                        'main.menu.options.submenu.visual-tweaks.submenu.theme.dialog.remove-theme-message',
                        { theme },
                      ),
                      buttons: [
                        t(
                          'main.menu.options.submenu.visual-tweaks.submenu.theme.dialog.button.cancel',
                        ),
                        t(
                          'main.menu.options.submenu.visual-tweaks.submenu.theme.dialog.button.remove',
                        ),
                      ],
                    });

                    if (response === 1) {
                      config.set(
                        'options.themes',
                        config
                          .get('options.themes')
                          ?.filter((t) => t !== theme) ?? [],
                      );
                      innerRefreshMenu();
                    }
                  },
                })) ?? []),
                { type: 'separator' },
                {
                  label: t(
                    'main.menu.options.submenu.visual-tweaks.submenu.theme.submenu.import-css-file',
                  ),
                  type: 'normal',
                  async click() {
                    const { filePaths } = await dialog.showOpenDialog({
                      filters: [{ name: 'CSS Files', extensions: ['css'] }],
                      properties: ['openFile', 'multiSelections'],
                    });
                    if (filePaths) {
                      config.set('options.themes', filePaths);
                      innerRefreshMenu();
                    }
                  },
                },
              ],
            },
          ],
        },
        {
          label: t('main.menu.options.submenu.single-instance-lock'),
          type: 'checkbox',
          checked: true,
          click(item: MenuItem) {
            if (!item.checked && app.hasSingleInstanceLock()) {
              app.releaseSingleInstanceLock();
            } else if (item.checked && !app.hasSingleInstanceLock()) {
              app.requestSingleInstanceLock();
            }
          },
        },
        {
          label: t('main.menu.options.submenu.always-on-top'),
          type: 'checkbox',
          checked: config.get('options.alwaysOnTop'),
          click(item: MenuItem) {
            config.setMenuOption('options.alwaysOnTop', item.checked);
            win.setAlwaysOnTop(item.checked);
          },
        },
        ...((is.windows() || is.linux()
          ? [
              {
                label: t('main.menu.options.submenu.hide-menu.label'),
                type: 'checkbox',
                checked: config.get('options.hideMenu'),
                click(item) {
                  config.setMenuOption('options.hideMenu', item.checked);
                  if (item.checked && !config.get('options.hideMenuWarned')) {
                    dialog.showMessageBox(win, {
                      type: 'info',
                      title: t(
                        'main.menu.options.submenu.hide-menu.dialog.title',
                      ),
                      message: t(
                        'main.menu.options.submenu.hide-menu.dialog.message',
                      ),
                    });
                  }
                },
              },
            ]
          : []) satisfies Electron.MenuItemConstructorOptions[]),
        ...((is.windows() || is.macOS()
          ? // Only works on Win/Mac
            // https://www.electronjs.org/docs/api/app#appsetloginitemsettingssettings-macos-windows
            [
              {
                label: t('main.menu.options.submenu.start-at-login'),
                type: 'checkbox',
                checked: config.get('options.startAtLogin'),
                click(item) {
                  config.setMenuOption('options.startAtLogin', item.checked);
                },
              },
            ]
          : []) satisfies Electron.MenuItemConstructorOptions[]),
        {
          label: t('main.menu.options.submenu.tray.label'),
          submenu: [
            {
              label: t('main.menu.options.submenu.tray.submenu.disabled'),
              type: 'radio',
              checked: !config.get('options.tray'),
              click() {
                config.setMenuOption('options.tray', false);
                config.setMenuOption('options.appVisible', true);
              },
            },
            {
              label: t(
                'main.menu.options.submenu.tray.submenu.enabled-and-show-app',
              ),
              type: 'radio',
              checked:
                config.get('options.tray') && config.get('options.appVisible'),
              click() {
                config.setMenuOption('options.tray', true);
                config.setMenuOption('options.appVisible', true);
              },
            },
            {
              label: t(
                'main.menu.options.submenu.tray.submenu.enabled-and-hide-app',
              ),
              type: 'radio',
              checked:
                config.get('options.tray') && !config.get('options.appVisible'),
              click() {
                config.setMenuOption('options.tray', true);
                config.setMenuOption('options.appVisible', false);
              },
            },
            { type: 'separator' },
            {
              label: t(
                'main.menu.options.submenu.tray.submenu.play-pause-on-click',
              ),
              type: 'checkbox',
              checked: config.get('options.trayClickPlayPause'),
              click(item: MenuItem) {
                config.setMenuOption(
                  'options.trayClickPlayPause',
                  item.checked,
                );
              },
            },
          ],
        },
        {
          label: t('main.menu.options.submenu.language.label') + ' (Language)',
          submenu: [
            {
              label: t(
                'main.menu.options.submenu.language.submenu.to-help-translate',
              ),
              type: 'normal',
              click() {
                const url = 'https://hosted.weblate.org/engage/youtube-music/';
                shell.openExternal(url);
              },
            } as Electron.MenuItemConstructorOptions,
          ].concat(
            availableLanguages
              .map(
                (lang): Electron.MenuItemConstructorOptions => ({
                  label: `${langResources[lang].translation.language?.name ?? 'Unknown'} (${langResources[lang].translation.language?.['local-name'] ?? 'Unknown'})`,
                  type: 'checkbox',
                  checked: (config.get('options.language') ?? 'en') === lang,
                  click() {
                    config.setMenuOption('options.language', lang);
                    refreshMenu(win);
                    setLanguage(lang);
                    dialog.showMessageBox(win, {
                      title: t(
                        'main.menu.options.submenu.language.dialog.title',
                      ),
                      message: t(
                        'main.menu.options.submenu.language.dialog.message',
                      ),
                    });
                  },
                }),
              )
              .sort((a, b) => a.label!.localeCompare(b.label!)),
          ),
        },
        { type: 'separator' },
        {
          label: t('main.menu.options.submenu.advanced-options.label'),
          submenu: [
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.set-proxy.label',
              ),
              type: 'normal',
              async click(item: MenuItem) {
                await setProxy(item, win);
              },
            },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.override-user-agent',
              ),
              type: 'checkbox',
              checked: config.get('options.overrideUserAgent'),
              click(item: MenuItem) {
                config.setMenuOption('options.overrideUserAgent', item.checked);
              },
            },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.disable-hardware-acceleration',
              ),
              type: 'checkbox',
              checked: config.get('options.disableHardwareAcceleration'),
              click(item: MenuItem) {
                config.setMenuOption(
                  'options.disableHardwareAcceleration',
                  item.checked,
                );
              },
            },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.restart-on-config-changes',
              ),
              type: 'checkbox',
              checked: config.get('options.restartOnConfigChanges'),
              click(item: MenuItem) {
                config.setMenuOption(
                  'options.restartOnConfigChanges',
                  item.checked,
                );
              },
            },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.auto-reset-app-cache',
              ),
              type: 'checkbox',
              checked: config.get('options.autoResetAppCache'),
              click(item: MenuItem) {
                config.setMenuOption('options.autoResetAppCache', item.checked);
              },
            },
            { type: 'separator' },
            is.macOS()
              ? {
                  label: t(
                    'main.menu.options.submenu.advanced-options.submenu.toggle-dev-tools',
                  ),
                  // Cannot use "toggleDevTools" role in macOS
                  click() {
                    const { webContents } = win;
                    if (webContents.isDevToolsOpened()) {
                      webContents.closeDevTools();
                    } else {
                      webContents.openDevTools();
                    }
                  },
                }
              : {
                  label: t(
                    'main.menu.options.submenu.advanced-options.submenu.toggle-dev-tools',
                  ),
                  role: 'toggleDevTools',
                },
            {
              label: t(
                'main.menu.options.submenu.advanced-options.submenu.edit-config-json',
              ),
              click() {
                config.edit();
              },
            },
          ],
        },
      ],
    },
    {
      label: t('main.menu.view.label'),
      submenu: [
        {
          label: t('main.menu.view.submenu.reload'),
          role: 'reload',
        },
        {
          label: t('main.menu.view.submenu.force-reload'),
          role: 'forceReload',
        },
        { type: 'separator' },
        {
          label: t('main.menu.view.submenu.zoom-in'),
          role: 'zoomIn',
          accelerator: 'CmdOrCtrl+=',
          visible: false,
        },
        {
          label: t('main.menu.view.submenu.zoom-in'),
          role: 'zoomIn',
          accelerator: 'CmdOrCtrl+Plus',
        },
        {
          label: t('main.menu.view.submenu.zoom-out'),
          role: 'zoomOut',
          accelerator: 'CmdOrCtrl+-',
        },
        {
          label: t('main.menu.view.submenu.zoom-out'),
          role: 'zoomOut',
          accelerator: 'CmdOrCtrl+Shift+-',
          visible: false,
        },
        {
          label: t('main.menu.view.submenu.reset-zoom'),
          role: 'resetZoom',
        },
        { type: 'separator' },
        {
          label: t('main.menu.view.submenu.toggle-fullscreen'),
          role: 'togglefullscreen',
        },
      ],
    },
    {
      label: t('main.menu.navigation.label'),
      submenu: [
        {
          label: t('main.menu.navigation.submenu.go-back'),
          click() {
            if (navigationHistory.canGoBack()) {
              navigationHistory.goBack();
            }
          },
        },
        {
          label: t('main.menu.navigation.submenu.go-forward'),
          click() {
            if (navigationHistory.canGoForward()) {
              navigationHistory.goForward();
            }
          },
        },
        {
          label: t('main.menu.navigation.submenu.copy-current-url'),
          click() {
            const currentURL = win.webContents.getURL();
            clipboard.writeText(currentURL);
          },
        },
        {
          label: t('main.menu.navigation.submenu.restart'),
          click: restart,
        },
        {
          label: t('main.menu.navigation.submenu.quit'),
          role: 'quit',
        },
      ],
    },
    {
      label: t('main.menu.about'),
      submenu: [{ role: 'about' }],
    },
  ];
    
    console.log('DEBUG: Menu template generated successfully with', finalMenu.length, 'top-level items');
    return finalMenu as MenuTemplate;
    
  } catch (error) {
    console.error('ERROR: mainMenuTemplate failed:', error);
    console.trace(error);
    
    // The main menu generation is failing, so let's build a basic working menu
    console.log('DEBUG: Building basic working menu due to main generation failure');
    
    // Get basic plugin list without complex processing
    let basicPluginMenus = [];
    try {
      console.log('DEBUG: Loading plugins for fallback menu');
      const basicPlugins = await allPlugins();
      console.log('DEBUG: Found basic plugins:', Object.keys(basicPlugins));
      
      if (Object.keys(basicPlugins).length === 0) {
        console.log('DEBUG: No plugins found, using fallback message');
        basicPluginMenus = [{
          label: 'No plugins available',
          enabled: false,
          type: 'normal' as const,
        }];
      } else {
        basicPluginMenus = await Promise.all(
          Object.keys(basicPlugins).map(async (id) => {
            try {
              console.log('DEBUG: Processing fallback plugin:', id);
              const plugin = basicPlugins[id];
              const pluginName = plugin?.name?.() ?? id;
              console.log('DEBUG: Plugin name:', pluginName);
              
              return await pluginEnabledMenu(
                id,
                pluginName,
                plugin?.description?.() ?? undefined,
                false,
                false,
                () => refreshMenu(win),
              );
            } catch (pluginProcessError) {
              console.error('DEBUG: Error processing plugin:', id, pluginProcessError);
              // Return a basic menu item for this plugin
              return {
                label: id,
                type: 'checkbox' as const,
                checked: await config.plugins.isEnabled(id),
                click(item: MenuItem) {
                  if (item.checked) {
                    config.plugins.enable(id);
                  } else {
                    config.plugins.disable(id);
                  }
                },
              };
            }
          })
        );
        console.log('DEBUG: Processed', basicPluginMenus.length, 'plugins for fallback menu');
      }
    } catch (pluginError) {
      console.error('DEBUG: Failed to load basic plugins:', pluginError);
      basicPluginMenus = [{
        label: 'No plugins available - error loading',
        enabled: false,
        type: 'normal' as const,
      }];
    }
    
    return [
      {
        label: t('main.menu.plugins.label'),
        submenu: basicPluginMenus,
      },
      {
        label: t('main.menu.options.label'),
        submenu: [
          {
            label: t('main.menu.options.submenu.auto-update'),
            type: 'checkbox',
            checked: config.get('options.autoUpdates'),
            click(item: MenuItem) {
              config.setMenuOption('options.autoUpdates', item.checked);
            },
          },
          {
            label: t('main.menu.options.submenu.resume-on-start'),
            type: 'checkbox',
            checked: config.get('options.resumeOnStart'),
            click(item: MenuItem) {
              config.setMenuOption('options.resumeOnStart', item.checked);
            },
          },
          {
            label: t('main.menu.options.submenu.always-on-top'),
            type: 'checkbox',
            checked: config.get('options.alwaysOnTop'),
            click(item: MenuItem) {
              config.setMenuOption('options.alwaysOnTop', item.checked);
              win.setAlwaysOnTop(item.checked);
            },
          },
          {
            label: t('main.menu.options.submenu.start-at-login'),
            type: 'checkbox',
            checked: config.get('options.startAtLogin'),
            click(item: MenuItem) {
              config.setMenuOption('options.startAtLogin', item.checked);
            },
          },
          {
            label: t('main.menu.options.submenu.start-minimized'),
            type: 'checkbox',
            checked: config.get('options.startMinimized'),
            click(item: MenuItem) {
              // Note: startMinimized is not in the config type definition, but exists in defaults
              config.set('options.startMinimized', item.checked);
            },
          },
          { type: 'separator' },
          {
            label: t('main.menu.options.submenu.advanced-options.label'),
            submenu: [
              {
                label: t('main.menu.options.submenu.advanced-options.submenu.override-user-agent'),
                type: 'checkbox',
                checked: config.get('options.overrideUserAgent'),
                click(item: MenuItem) {
                  config.setMenuOption('options.overrideUserAgent', item.checked);
                },
              },
              {
                label: t('main.menu.options.submenu.advanced-options.submenu.disable-hardware-acceleration'),
                type: 'checkbox',
                checked: config.get('options.disableHardwareAcceleration'),
                click(item: MenuItem) {
                  config.setMenuOption('options.disableHardwareAcceleration', item.checked);
                },
              },
              {
                label: t('main.menu.options.submenu.advanced-options.submenu.restart-on-config-changes'),
                type: 'checkbox',
                checked: config.get('options.restartOnConfigChanges'),
                click(item: MenuItem) {
                  config.setMenuOption('options.restartOnConfigChanges', item.checked);
                },
              },
              { type: 'separator' },
              {
                label: t('main.menu.options.submenu.advanced-options.submenu.toggle-dev-tools'),
                click() {
                  const { webContents } = win;
                  if (webContents.isDevToolsOpened()) {
                    webContents.closeDevTools();
                  } else {
                    webContents.openDevTools();
                  }
                },
              },
              {
                label: t('main.menu.options.submenu.advanced-options.submenu.edit-config-json'),
                click() {
                  config.edit();
                },
              },
            ],
          },
        ],
      },
      {
        label: t('main.menu.view.label'),
        submenu: [
          {
            label: t('main.menu.view.submenu.reload'),
            role: 'reload',
          },
          {
            label: t('main.menu.view.submenu.force-reload'),
            role: 'forceReload',
          },
          { type: 'separator' },
          {
            label: t('main.menu.view.submenu.zoom-in'),
            role: 'zoomIn',
            accelerator: 'CmdOrCtrl+Plus',
          },
          {
            label: t('main.menu.view.submenu.zoom-out'),
            role: 'zoomOut',
            accelerator: 'CmdOrCtrl+-',
          },
          {
            label: t('main.menu.view.submenu.reset-zoom'),
            role: 'resetZoom',
          },
          { type: 'separator' },
          {
            label: t('main.menu.view.submenu.toggle-fullscreen'),
            role: 'togglefullscreen',
          },
        ],
      },
      {
        label: t('main.menu.navigation.label'),
        submenu: [
          {
            label: t('main.menu.navigation.submenu.go-back'),
            accelerator: 'CmdOrCtrl+Left',
            click() {
              if (win.webContents.navigationHistory.canGoBack()) {
                win.webContents.navigationHistory.goBack();
              }
            },
          },
          {
            label: t('main.menu.navigation.submenu.go-forward'),
            accelerator: 'CmdOrCtrl+Right',
            click() {
              if (win.webContents.navigationHistory.canGoForward()) {
                win.webContents.navigationHistory.goForward();
              }
            },
          },
          { type: 'separator' },
          {
            label: t('main.menu.navigation.submenu.copy-current-url'),
            accelerator: 'CmdOrCtrl+L',
            click() {
              const currentURL = win.webContents.getURL();
              clipboard.writeText(currentURL);
            },
          },
          { type: 'separator' },
          {
            label: t('main.menu.navigation.submenu.restart'),
            click: restart,
          },
          {
            label: t('main.menu.navigation.submenu.quit'),
            accelerator: 'CmdOrCtrl+Q',
            role: 'quit',
          },
        ],
      },
      {
        label: t('main.menu.about'),
        submenu: [{ role: 'about' }],
      },
    ] as MenuTemplate;
  }
};
export const setApplicationMenu = async (win: Electron.BrowserWindow) => {
  const menuTemplate: MenuTemplate = [...(await mainMenuTemplate(win))];
  if (process.platform === 'darwin') {
    const { name } = app;
    menuTemplate.unshift({
      label: name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'selectAll' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'close' },
        { role: 'quit' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

async function setProxy(item: Electron.MenuItem, win: BrowserWindow) {
  const output = await prompt(
    {
      title: t(
        'main.menu.options.submenu.advanced-options.submenu.set-proxy.prompt.title',
      ),
      label: t(
        'main.menu.options.submenu.advanced-options.submenu.set-proxy.prompt.label',
      ),
      value: config.get('options.proxy'),
      type: 'input',
      inputAttrs: {
        type: 'url',
        placeholder: t(
          'main.menu.options.submenu.advanced-options.submenu.set-proxy.prompt.placeholder',
        ),
      },
      width: 450,
      ...promptOptions(),
    },
    win,
  );

  if (typeof output === 'string') {
    config.setMenuOption('options.proxy', output);
    item.checked = output !== '';
  } else {
    // User pressed cancel
    item.checked = !item.checked; // Reset checkbox
  }
}
