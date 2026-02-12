import { render } from 'solid-js/web';
import { createSignal, Show } from 'solid-js';

import { createRenderer } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import { type LyricOverlayConfig } from './config';

import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

// Component for the lyric overlay
function LyricOverlay(props: {
  text: () => string;
  config: () => LyricOverlayConfig | null;
  visible: () => boolean;
}) {
  const getPositionClass = () => {
    const position = props.config()?.position ?? 'bottom';
    return `position-${position}`;
  };

  const getStyleClass = () => {
    const style = props.config()?.style ?? 'default';
    return `style-${style}`;
  };

  const getTextStyle = () => {
    const config = props.config();
    if (!config) return {};

    return {
      'font-size': `${config.fontSize}px`,
      'color': config.fontColor,
      'background-color': `rgba(0, 0, 0, ${config.backgroundOpacity})`,
    };
  };

  return (
    <Show when={props.visible() && props.text()}>
      <div
        class={`${getPositionClass()} ${getStyleClass()}`}
        id="lyric-overlay-container"
      >
        <div class="fade-in" id="lyric-overlay-text" style={getTextStyle()}>
          {props.text()}
        </div>
      </div>
    </Show>
  );
}

export const renderer = createRenderer<
  {
    config: LyricOverlayConfig | null;
    playerApi: MusicPlayer | null;
    currentLyric: string;
    isVideoMode: boolean;
    overlayContainer: HTMLDivElement | null;
    cleanupRender: (() => void) | null;
    lyricObserver: MutationObserver | null;
    setCurrentLyric: ((text: string) => void) | null;
    setConfig: ((config: LyricOverlayConfig | null) => void) | null;
    setVisible: ((visible: boolean) => void) | null;
    setupLyricObserver: () => void;
    updateVisibility: () => void;
  },
  LyricOverlayConfig
>({
  config: null,
  playerApi: null,
  currentLyric: '',
  isVideoMode: false,
  overlayContainer: null,
  cleanupRender: null,
  lyricObserver: null,
  setCurrentLyric: null,
  setConfig: null,
  setVisible: null,

  async start(ctx: RendererContext<LyricOverlayConfig>) {
    this.config = await ctx.getConfig();

    // Wait for player element
    const playerElement = await waitForElement<HTMLElement>('#player');
    if (!playerElement) {
      console.error('[lyric-overlay] Player element not found');
      return;
    }

    // Create overlay container
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'lyric-overlay-root';

    // Insert into player
    const songVideo = playerElement.querySelector('#song-video');
    if (songVideo) {
      songVideo.appendChild(this.overlayContainer);
    } else {
      playerElement.appendChild(this.overlayContainer);
    }

    // Create signals for reactive updates
    const [currentLyric, setCurrentLyric] = createSignal('');
    const [config, setConfig] = createSignal<LyricOverlayConfig | null>(
      this.config,
    );
    const [visible, setVisible] = createSignal(true);

    this.setCurrentLyric = setCurrentLyric;
    this.setConfig = setConfig;
    this.setVisible = setVisible;

    // Render the overlay component
    this.cleanupRender = render(
      () => (
        <LyricOverlay config={config} text={currentLyric} visible={visible} />
      ),
      this.overlayContainer,
    );

    // Setup lyric observer to watch for changes from synced-lyrics plugin
    this.setupLyricObserver();

    // Watch for video mode changes
    const player = document.querySelector<HTMLElement>('ytmusic-player');
    if (player) {
      const playbackObserver = new MutationObserver(() => {
        const playbackMode = player.getAttribute('playback-mode');
        this.isVideoMode = playbackMode === 'OMV_PREFERRED';
        this.updateVisibility();
      });

      playbackObserver.observe(player, {
        attributes: true,
        attributeFilter: ['playback-mode'],
      });
    }
  },

  onPlayerApiReady(api: MusicPlayer) {
    this.playerApi = api;
  },

  onConfigChange(newConfig) {
    this.config = newConfig;
    this.setConfig?.(newConfig);
    this.updateVisibility();
  },

  setupLyricObserver() {
    // Watch for the synced-lyrics panel content changes
    const observeTarget = () => {
      const lyricsPanel = document.querySelector(
        'ytmusic-player-page #tab-renderer',
      );
      if (!lyricsPanel) {
        // Retry after a delay
        setTimeout(observeTarget, 1000);
        return;
      }

      this.lyricObserver = new MutationObserver(() => {
        // Find the current lyric line from synced-lyrics
        const currentLine = document.querySelector(
          '.synced-lyrics-container .line.current',
        );
        if (currentLine) {
          const text = currentLine.textContent?.trim() ?? '';
          if (text !== this.currentLyric) {
            this.currentLyric = text;
            this.setCurrentLyric?.(text);
          }
        } else {
          // Try alternative selectors for lyrics
          const activeLyric = document.querySelector(
            '[data-lyrics-current="true"]',
          );
          if (activeLyric) {
            const text = activeLyric.textContent?.trim() ?? '';
            if (text !== this.currentLyric) {
              this.currentLyric = text;
              this.setCurrentLyric?.(text);
            }
          }
        }
      });

      this.lyricObserver.observe(lyricsPanel, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };

    observeTarget();

    // Also listen for IPC events from synced-lyrics if available
    // This provides a more reliable way to get lyrics
    window.addEventListener('synced-lyrics:line-change', ((
      event: CustomEvent<{ text: string }>,
    ) => {
      const text = event.detail?.text ?? '';
      if (text !== this.currentLyric) {
        this.currentLyric = text;
        this.setCurrentLyric?.(text);
      }
    }) as EventListener);
  },

  updateVisibility() {
    if (!this.config) return;

    const shouldShow =
      !this.config.showOnVideoOnly ||
      (this.config.showOnVideoOnly && this.isVideoMode);

    this.setVisible?.(shouldShow);
  },

  stop() {
    if (this.cleanupRender) {
      this.cleanupRender();
      this.cleanupRender = null;
    }

    if (this.lyricObserver) {
      this.lyricObserver.disconnect();
      this.lyricObserver = null;
    }

    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }
  },
});
