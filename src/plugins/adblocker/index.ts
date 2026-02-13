import { createPlugin } from '@/utils';
import { t } from '@/i18n';

import { defaultAdBlockerConfig } from './config';

// Helper functions for ad blocking logic
function setupNetworkInterception() {
  console.log('[adblocker] Setting up network request interception');
  // Store original methods for restoration
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open;
  const originalFetch = window.fetch;

  // Intercept XMLHttpRequest and Fetch requests
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
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
      console.log('[adblocker] Blocked XMLHttpRequest to:', url);
      // Block the request by setting URL to empty
      return originalXMLHttpRequestOpen.call(
        this,
        method,
        '',
        async ?? true,
        username,
        password,
      );
    }
    return originalXMLHttpRequestOpen.call(
      this,
      method,
      url || '',
      async ?? true,
      username,
      password,
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
      console.log('[adblocker] Blocked fetch request to:', url);
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

  console.log('[adblocker] Network request interception setup complete');
}

function injectAdBlockingCSS() {
  console.log('[adblocker] Injecting CSS to hide ad elements');
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
  console.log(
    '[adblocker] CSS injection complete, ad elements should be hidden',
  );
}

function removeNetworkInterception() {
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
}

function removeAdBlockingCSS() {
  // Remove the injected CSS
  const adBlockerStyle = document.getElementById('adblocker-styles');
  if (adBlockerStyle) {
    adBlockerStyle.remove();
  }
}

export default createPlugin({
  name: () => t('plugins.adblocker.name'),
  description: () => t('plugins.adblocker.description'),
  restartNeeded: false,
  config: defaultAdBlockerConfig,
  renderer: {
    async start({ getConfig }) {
      console.log('[adblocker] Starting adblocker plugin');
      const config = await getConfig();
      console.log('[adblocker] Config loaded:', config);

      if (config.enabled) {
        console.log('[adblocker] Config enabled, enabling ad blocking');
        // Enable ad blocking
        setupNetworkInterception();
        injectAdBlockingCSS();
      } else {
        console.log('[adblocker] Config disabled, ad blocking not enabled');
      }
    },

    onConfigChange(newConfig) {
      console.log('[adblocker] Config change detected:', newConfig);

      if (newConfig.enabled) {
        console.log('[adblocker] Config enabled, enabling ad blocking');
        setupNetworkInterception();
        injectAdBlockingCSS();
      } else {
        console.log('[adblocker] Config disabled, disabling ad blocking');
        removeNetworkInterception();
        removeAdBlockingCSS();
      }
    },

    stop() {
      // Always disable ad blocking on stop for cleanup
      removeNetworkInterception();
      removeAdBlockingCSS();
    },
  },
});
