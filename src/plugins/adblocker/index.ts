import { createPlugin } from '@/utils';
import { t } from '@/i18n';

import { defaultAdBlockerConfig, type AdBlockerConfig } from './config';

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

    async onConfigChange(newConfig) {
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
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string' && (
          url.includes('doubleclick.net') ||
          url.includes('googlesyndication.com') ||
          url.includes('googleadservices.com') ||
          url.includes('adsystem.') ||
          url.includes('amazon-adsystem.com') ||
          url.includes('facebook.com/tr') ||
          url.includes('analytics.google.com') ||
          url.includes('googletagmanager.com') ||
          url.includes('google-analytics.com')
        )) {
          // Block the request by setting URL to empty
          args[0] = false;
          return originalXMLHttpRequestOpen.call(this, method, '', ...args);
        }
        return originalXMLHttpRequestOpen.call(this, method, url, ...args);
      };

      // Override fetch for modern browsers
      window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

        if (url && (
          url.includes('doubleclick.net') ||
          url.includes('googlesyndication.com') ||
          url.includes('googleadservices.com') ||
          url.includes('adsystem.') ||
          url.includes('amazon-adsystem.com') ||
          url.includes('facebook.com/tr') ||
          url.includes('analytics.google.com') ||
          url.includes('googletagmanager.com') ||
          url.includes('google-analytics.com')
        )) {
          return Promise.reject(new Error('Ad request blocked'));
        }

        return originalFetch.call(this, input, init);
      };

      // Store references for cleanup
      (window as any).__adblocker_originalFetch = originalFetch;
      (window as any).__adblocker_originalXMLHttpRequestOpen = originalXMLHttpRequestOpen;
    },

    unblockAds() {
      // Restore original XMLHttpRequest
      const originalXMLHttpRequestOpen = (window as any).__adblocker_originalXMLHttpRequestOpen;
      if (originalXMLHttpRequestOpen) {
        XMLHttpRequest.prototype.open = originalXMLHttpRequestOpen;
      }

      // Restore fetch
      const originalFetch = (window as any).__adblocker_originalFetch;
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
  },
});
