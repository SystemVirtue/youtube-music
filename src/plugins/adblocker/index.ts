import { createPlugin } from '@/utils';
import { t } from '@/i18n';

import { defaultAdBlockerConfig, type AdBlockerConfig } from './config';

interface AdBlockerRenderer {
  config: AdBlockerConfig | null;
  start: (ctx: { getConfig: () => Promise<AdBlockerConfig> }) => Promise<void>;
  onConfigChange: (newConfig: AdBlockerConfig) => void;
  enableAdBlocking: () => void;
  disableAdBlocking: () => void;
  blockAds: () => void;
  unblockAds: () => void;
  hideAdElements: () => void;
  showAdElements: () => void;
  stop: () => void;
}

export default createPlugin({
  name: () => t('plugins.adblocker.name'),
  description: () => t('plugins.adblocker.description'),
  restartNeeded: false,
  config: defaultAdBlockerConfig,
  renderer: {
    config: null as AdBlockerConfig | null,

    async start({ getConfig }) {
      const config = await getConfig();
      this.config = config;

      if (config.enabled) {
        this.enableAdBlocking();
      }
    },

    onConfigChange(newConfig) {
      this.config = newConfig;

      if (newConfig.enabled) {
        this.enableAdBlocking();
      } else {
        this.disableAdBlocking();
      }
    },

    enableAdBlocking() {
      // Block ads by intercepting network requests
      this.blockAds();

      // Hide ad elements
      this.hideAdElements();

      console.log('[adblocker] Ad blocking enabled');
    },

    disableAdBlocking() {
      // Remove ad blocking
      this.unblockAds();

      // Show ad elements (if any were hidden)
      this.showAdElements();

      console.log('[adblocker] Ad blocking disabled');
    },

    blockAds() {
      // Store original methods for restoration
      const originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open;
      const originalFetch = window.fetch;

      // Intercept XMLHttpRequest and Fetch requests
      XMLHttpRequest.prototype.open = function (
        method: string,
        url: string | URL | null,
        async?: boolean,
        username?: string | null,
        password?: string | null,
      ) {
        if (
          typeof url === 'string' &&
          (url.includes('doubleclick.net') ||
            url.includes('googlesyndication.com') ||
            url.includes('googleadservices.com') ||
            url.includes('adsystem.') ||
            url.includes('amazon-adsystem.com') ||
            url.includes('facebook.com/tr') ||
            url.includes('analytics.google.com') ||
            url.includes('googletagmanager.com') ||
            url.includes('google-analytics.com'))
        ) {
          // Block the request by setting URL to empty
          return originalXMLHttpRequestOpen.call(
            this,
            method,
            '',
            async ?? true,
            username,
            password
          );
        }
        return originalXMLHttpRequestOpen.call(
          this,
          method,
          url || '',
          async,
          username,
          password
        );
      };

      // Override fetch for modern browsers
      window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
            ? input.href
            : input instanceof Request
            ? input.url
            : '';

        if (
          url &&
          (url.includes('doubleclick.net') ||
            url.includes('googlesyndication.com') ||
            url.includes('googleadservices.com') ||
            url.includes('adsystem.') ||
            url.includes('amazon-adsystem.com') ||
            url.includes('facebook.com/tr') ||
            url.includes('analytics.google.com') ||
            url.includes('googletagmanager.com') ||
            url.includes('google-analytics.com'))
        ) {
          return Promise.reject(new Error('Ad request blocked'));
        }

        return originalFetch.call(this, input, init);
      };

      // Store references for cleanup
      (
        window as unknown as {
          __adblocker_originalFetch?: typeof fetch;
        }
      ).__adblocker_originalFetch = originalFetch;

      (
        window as unknown as {
          __adblocker_originalXMLHttpRequestOpen?: typeof XMLHttpRequest.prototype.open;
        }
      ).__adblocker_originalXMLHttpRequestOpen = originalXMLHttpRequestOpen;
    },

    unblockAds() {
      // Restore original XMLHttpRequest
      const originalXMLHttpRequestOpen = (
        window as unknown as {
          __adblocker_originalXMLHttpRequestOpen?: typeof XMLHttpRequest.prototype.open;
        }
      ).__adblocker_originalXMLHttpRequestOpen;

      if (originalXMLHttpRequestOpen) {
        XMLHttpRequest.prototype.open = originalXMLHttpRequestOpen;
      }

      // Restore fetch
      const originalFetch = (
        window as unknown as {
          __adblocker_originalFetch?: typeof fetch;
        }
      ).__adblocker_originalFetch;

      if (originalFetch) {
        window.fetch = originalFetch;
      }
    },

    hideAdElements() {
      // Create and inject CSS to hide ad elements
      const adBlockerStyle = document.createElement('style');
      adBlockerStyle.id = 'adblocker-styles';
      adBlockerStyle.textContent = `
        /* Hide YouTube Music ads */
        .ytmusic-player-page[ad-showing] {
          display: none !important;
        }

        /* Hide ad containers */
        ytmusic-mealbar-promo-renderer,
        ytmusic-ad-chip-cloud-renderer,
        ytmusic-unlimited-promo-renderer,
        .ad-container,
        [data-ad-type],
        .ytp-ad-overlay-container {
          display: none !important;
        }

        /* Hide ad-related elements */
        .ytp-ad-text,
        .ytp-ad-skip-button,
        .ytp-ad-preview-container {
          display: none !important;
        }

        /* Hide tracking pixels */
        img[width="1"][height="1"],
        img[src*="pixel"],
        img[src*="tracking"] {
          display: none !important;
        }
      `;
      document.head.appendChild(adBlockerStyle);
    },

    showAdElements() {
      // Remove the injected CSS
      const adBlockerStyle = document.getElementById('adblocker-styles');
      if (adBlockerStyle) {
        adBlockerStyle.remove();
      }
    },

    stop() {
      if (this.config?.enabled) {
        this.disableAdBlocking();
      }
    },
  } as AdBlockerRenderer,
});
