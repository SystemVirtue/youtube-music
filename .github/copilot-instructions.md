# Pear Desktop AI Coding Instructions

Pear Desktop is an Electron-based YouTube Music desktop client with a **plugin-driven architecture**. Success depends on understanding this plugin system and the three-tier process architecture.

## Core Architecture

### Three-Process Model

- **Main Process**: Node.js backend running Electron. Loads plugins' `backend` sections. Manages app lifecycle, window control, shortcuts, config persistence.
- **Preload Script**: Bridge with restricted access between main and renderer. Loads plugins' `preload` sections. Exposes safe IPC interfaces.
- **Renderer Process**: Browser context embedding YouTube Music. Loads plugins' `renderer` sections via DOM manipulation and Web APIs.

Files: [src/index.ts](src/index.ts) (main), [src/preload.ts](src/preload.ts), [src/renderer.ts](src/renderer.ts)

### Plugin System

Plugins extend all three processes via a unified interface defined in [src/types/plugins.ts](src/types/plugins.ts):

```typescript
PluginDef<BackendProperties, PreloadProperties, RendererProperties, Config>
```

Each plugin can implement:
- `backend`: IPC handlers, file I/O, external APIs, menu items
- `preload`: Safe globals exposed to renderer (e.g., `window.ipcRenderer`)
- `renderer`: DOM manipulation, event listeners, player API integration
- `config`: User-configurable options (persisted via [src/config/store.ts](src/config/store.ts))
- `menu`: Application menu items (platform-specific in menu context)
- `stylesheets`: Injected CSS for DOM modifications
- Lifecycle: `start`, `stop`, `onConfigChange`, `onPlayerApiReady` (renderer-only)

Example patterns: [src/plugins/audio-compressor.ts](src/plugins/audio-compressor.ts) (simple renderer plugin), [src/plugins/discord/index.ts](src/plugins/discord/index.ts) (full-featured multi-process plugin)

### Vite Plugin Loaders

Two custom Vite plugins auto-discover and generate boilerplate:

1. **Plugin Importer** ([vite-plugins/plugin-importer.mts](vite-plugins/plugin-importer.mts)): Generates `virtual:plugins` module listing all plugins per process (dynamic for main, static for preload/renderer). Converts kebab-case plugin names to camelCase.

2. **Plugin Loader** ([vite-plugins/plugin-loader.mts](vite-plugins/plugin-loader.mts)): Parses plugin exports using ts-morph to extract and validate plugin definitions and stubs.

**Key insight**: Plugins discovered via glob `src/plugins/*/index.{js,ts,jsx,tsx}` or `src/plugins/*.{js,ts,jsx,tsx}`. Single-file plugins work directly; directory plugins require an `index` file.

## Development Workflows

### Build & Run

- **Dev mode**: `pnpm dev` (main + renderer with source maps, Electron window)
- **Debug**: `pnpm dev:debug` (logs Electron internals)
- **Preview**: `pnpm start` (production build preview)
- **Type check**: `pnpm typecheck`
- **Lint**: `pnpm lint` (ESLint + Prettier; see [eslint.config.mjs](eslint.config.mjs))

### Testing

- **Unit tests**: `pnpm test` (Playwright-based, see [tests/index.test.js](tests/index.test.js))
- **Debug tests**: `pnpm test:debug` (verbose output)

### Distribution

- **All platforms**: `pnpm dist`
- **Platform-specific**: `pnpm dist:mac`, `pnpm dist:win`, `pnpm dist:linux`
- **Release builds**: `pnpm release:mac` (requires code signing on macOS)

## Project Conventions

### Code Style

- **ESLint config**: TypeScript strict mode, consistent imports, Prettier formatting (2 spaces, single quotes, trailing commas)
- **Type checking**: `@typescript-eslint/consistent-type-imports` enforces inline type imports
- **Naming**: Kebab-case for files/plugins, camelCase for variables/functions, PascalCase for classes/interfaces

### Plugin Development Patterns

1. **Always use helper factories**: `createPlugin()`, `createBackend()`, `createPreload()`, `createRenderer()` for type safety (see [src/utils/index.ts](src/utils/index.ts))

2. **IPC communication**: Main → Renderer via `window.ipcRenderer.invoke/send`. Renderer → Main via same channel. Example: Discord plugin uses `window.ipcRenderer.on('discord:update-presence', ...)`

3. **Configuration**: Define typed `PluginConfig` interface, use `setMenuOptions()` to persist + optionally restart app

4. **Platform-specific code**: Use `Platform` enum bitmask; check `electron-is` lib (e.g., `window.electronIs.windows()`)

5. **DOM targeting**: YouTube Music embeds custom Web Components (e.g., `ytmusic-player-bar`, `#movie_player`). Use `waitForElement()` utility before manipulation

6. **Player API access**: Only in renderer's `onPlayerApiReady` lifecycle. API is `Element & MusicPlayer` with methods like `playVideo()`, `pauseVideo()`, `getPlayerState()`

### Configuration Management

- Config stored in [src/config/store.ts](src/config/store.ts) (Electron store with persistent JSON)
- Use `config.setMenuOptions()` to auto-restart if `options.restartOnConfigChanges` enabled
- Per-plugin options via `config.plugins.setMenuOptions(pluginName, {...})`

### i18n Pattern

Translation resources in [src/i18n/resources/](src/i18n/resources/). Use `t('plugins.discord.name')` for plugin text. Language switching via `setLanguage()`

## File Structure Summary

```
src/
  index.ts              # Main process entry
  renderer.ts           # Renderer process setup
  preload.ts            # Bridge script
  config/               # Config, plugins, store management
  loader/               # Plugin lifecycle loaders (main/preload/renderer)
  plugins/              # ~40 plugins; some single-file, some multi-file
  providers/            # Cross-process helpers (song-info, app-controls, protocol-handler)
  types/                # Shared TypeScript definitions
  utils/                # createPlugin factory, logging, helpers
vite-plugins/          # Custom loaders for plugin discovery
```

## Critical Integration Points

- **Song info**: [src/providers/song-info.ts](src/providers/song-info.ts) (main process DOM scraping via message passing)
- **Player API**: Exposed in renderer via `window.api` after `onPlayerApiReady` fires
- **Menu generation**: Plugins provide `menu()` function returning Electron menu items per platform
- **Protocol handling**: [src/providers/protocol-handler.ts](src/providers/protocol-handler.ts) for custom `peard://` URLs
- **Restart trigger**: `providers/app-controls.ts` provides `restart()` function for config-induced restarts

## When Adding Features

1. **New plugin**: Use `createPlugin()` factory, implement only needed process sections, export default
2. **Modifying main**: Check if feature should be in a plugin instead (plugins are easier to test/disable)
3. **DOM changes**: Inject CSS via plugin's `stylesheets` array or inline via `injectCSS()` utility
4. **New IPC channel**: Document sender/receiver processes; preload must expose safe wrapper
5. **Config option**: Add to plugin config interface, use typed `getOptions<T>()` / `setMenuOptions()`

## Known Gotchas

- **Patches applied**: Several dependencies patched (vudio, kuromoji, mdui, etc.) - see [patches/](patches/)
- **Virtual modules**: `virtual:plugins` and `virtual:i18n` are generated at build time; don't import directly from disk
- **ts-morph parsing**: Plugin loader is strict about format (must be valid TypeScript export default)
- **Unicode obfuscation**: Some strings use Unicode escapes for YouTube branding (preserved for legal reasons)
- **Electron version**: Currently using modern Electron with ESM support; Node >=22, pnpm >=10 required
