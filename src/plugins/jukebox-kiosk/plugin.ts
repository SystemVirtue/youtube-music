// Jukebox-kiosk plugin definition
// Renderer plugin for full-screen kiosk UI
import { createPlugin } from '../../utils';

export interface JukeboxKioskConfig {
  enabled: boolean;
  removeAfterPlaying: boolean;
  addToJukeboxRequests: boolean;
}

const defaultConfig: JukeboxKioskConfig = {
  enabled: false,
  removeAfterPlaying: true,
  addToJukeboxRequests: false,
};

export default createPlugin({
  name: () => 'Jukebox-kiosk',
  description: () => 'Full-screen kiosk for music requests and queue management',
  config: defaultConfig,
  renderer: {
    onPlayerApiReady(api, ctx) {
      // Inject kiosk overlay if not present
      if (!document.getElementById('jukebox-kiosk-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'jukebox-kiosk-overlay';
  overlay.style.position = 'fixed';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.background = 'hsl(0, 0%, 3.9%)';
  overlay.style.pointerEvents = 'auto';

        // Respect in-app menu bar height via CSS var (--menu-bar-height) defaulting to 36px
        const menuBarHeight = getComputedStyle(document.documentElement)
          .getPropertyValue('--menu-bar-height') || '36px';
        overlay.style.top = menuBarHeight.trim();
        overlay.style.height = `calc(100vh - ${menuBarHeight.trim()})`;
        // Ensure below TitleBar (which uses very high z-index 10000000)
        overlay.style.zIndex = '9999';

        // Ensure menu bar is always above kiosk overlay
  const menuBar = document.querySelector('.in-app-menu, #in-app-menu, .titlebar, #ytmd-title-bar-main-panel');
        if (menuBar) {
          (menuBar as HTMLElement).style.zIndex = '99999';
          (menuBar as HTMLElement).style.position = 'relative';
        }

        // Always allow pointer events for menu bar area
        overlay.addEventListener('pointerdown', (e) => {
          const menuBar = document.querySelector('.in-app-menu, #in-app-menu, .titlebar, #ytmd-title-bar-main-panel');
          if (menuBar && e.clientY < menuBar.getBoundingClientRect().bottom) {
            overlay.style.pointerEvents = 'none';
            setTimeout(() => { overlay.style.pointerEvents = 'auto'; }, 500);
          }
        });
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.fontFamily = 'Inter, sans-serif';
        overlay.innerHTML = `
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            .jukebox-title { color: hsl(0,0%,98%); font-size:3em; font-weight:700; margin-bottom:0.5em; letter-spacing:0.02em; }
            .jukebox-section { background: hsl(0,0%,14.9%); color: hsl(0,0%,98%); border-radius:1em; box-shadow:0 4px 24px rgba(0,0,0,0.2); padding:1.5em 2em; margin-bottom:1.5em; min-width:400px; }
            .jukebox-label { font-size:1.2em; font-weight:600; margin-bottom:0.5em; color:hsl(43,74%,66%); }
            .jukebox-nowplaying-title { font-size:2em; font-weight:600; margin-bottom:0.2em; white-space:nowrap; overflow:hidden; }
            .jukebox-marquee { display:inline-block; animation: marquee 18s linear infinite; }
            @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
            .jukebox-comingup-list { font-size:1.1em; color:hsl(0,0%,98%); margin-top:0.5em; }
            .jukebox-search-btn { font-size:1.5em; font-weight:600; background:hsl(43,74%,66%); color:hsl(0,0%,9%); border:none; border-radius:0.5em; padding:0.7em 2.5em; margin-bottom:2em; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.12); transition:background 0.2s; }
            .jukebox-search-btn:hover { background:hsl(27,87%,67%); }
            .jukebox-modal { display:none; position:fixed; top:10%; left:50%; transform:translateX(-50%); background:hsl(0,0%,14.9%); color:hsl(0,0%,98%); padding:2em 2.5em; border-radius:1em; z-index:100000; box-shadow:0 8px 32px rgba(0,0,0,0.25); min-width:480px; }
            .jukebox-modal input { font-size:1.2em; width:80%; margin-bottom:1em; border-radius:0.5em; border:1px solid hsl(0,0%,89.8%); padding:0.5em; background:hsl(0,0%,3.9%); color:hsl(0,0%,98%); }
            .jukebox-modal button { font-size:1.1em; font-weight:500; background:hsl(43,74%,66%); color:hsl(0,0%,9%); border:none; border-radius:0.5em; padding:0.5em 1.5em; margin-right:1em; cursor:pointer; margin-bottom:1em; }
            .jukebox-modal button:hover { background:hsl(27,87%,67%); }
            .jukebox-search-results { margin-top:2em; }
            .jukebox-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5em; }
            .jukebox-result-card { background:hsl(0,0%,3.9%); border-radius:0.7em; box-shadow:0 2px 12px rgba(0,0,0,0.18); text-align:center; padding:1em; transition:transform 0.15s; }
            .jukebox-result-card:hover { transform:scale(1.04); }
            .jukebox-result-thumb { width:100%; border-radius:0.5em; box-shadow:0 1px 6px rgba(0,0,0,0.12); }
            .jukebox-result-title { margin-top:0.7em; font-size:1.1em; font-weight:600; color:hsl(43,74%,66%); line-height:1.2; }
            .jukebox-result-channel { font-size:0.95em; color:hsl(0,0%,63.9%); margin-bottom:0.5em; }
            .jukebox-result-duration { font-size:0.9em; color:hsl(0,0%,45.1%); margin-bottom:0.5em; }
            .jukebox-result-add { margin-top:0.5em; font-size:1em; font-weight:600; background:hsl(43,74%,66%); color:hsl(0,0%,9%); border:none; border-radius:0.5em; padding:0.4em 1.2em; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.10); }
            .jukebox-result-add:disabled { background:hsl(0,0%,89.8%); color:hsl(0,0%,45.1%); cursor:not-allowed; }
          </style>
          <div class="jukebox-title">Music Video Jukebox</div>
          <div class="jukebox-section">
            <div class="jukebox-label">Now Playing</div>
            <div id="jukebox-nowplaying" class="jukebox-nowplaying-title"></div>
          </div>
          <div class="jukebox-section">
            <div class="jukebox-label">Coming Up</div>
            <div id="jukebox-comingup" class="jukebox-comingup-list"></div>
          </div>
          <button id="jukebox-search-btn" class="jukebox-search-btn">Music Search</button>
          <div id="jukebox-search-modal" class="jukebox-modal">
            <div style="margin-bottom:1em; font-size:1.3em; font-weight:600;">Search for music videos</div>
            <input id="jukebox-search-input" type="text" placeholder="Type song or artist..." />
            <button id="jukebox-search-go">Search</button>
            <button id="jukebox-search-close">Close</button>
            <div id="jukebox-search-results" class="jukebox-search-results"></div>
          </div>
        `;
        document.body.appendChild(overlay);

        // Show Now Playing and Coming Up
        function updateNowPlaying() {
          const now = api.getVideoData ? api.getVideoData() : null;
          const el = document.getElementById('jukebox-nowplaying');
          if (el) {
            el.textContent = now && now.title ? `Now Playing: ${now.title}${now.author ? ' - ' + now.author : ''}` : 'Now Playing: (none)';
          }
        }
        function updateComingUp() {
          const playlist = api.getPlaylist ? api.getPlaylist() : [];
          const upcoming = Array.isArray(playlist) ? playlist.slice(1, 6) : [];
          const el = document.getElementById('jukebox-comingup');
          if (el) {
            el.textContent = upcoming.length
              ? `Coming Up: ${upcoming.map(s => typeof s === 'object' && s && 'title' in s ? (s as any).title : '').join(', ')}`
              : 'Coming Up: (none)';
          }
        }
        updateNowPlaying();
        updateComingUp();
        if (api.addEventListener) {
          api.addEventListener('videodatachange', () => {
            updateNowPlaying();
            updateComingUp();
          });
        }

        // Music Search button logic
        const searchBtn = document.getElementById('jukebox-search-btn');
        if (searchBtn) {
          searchBtn.onclick = () => {
            const modal = document.getElementById('jukebox-search-modal');
            if (modal) modal.style.display = 'block';
          };
        }
        const searchClose = document.getElementById('jukebox-search-close');
        if (searchClose) {
          searchClose.onclick = () => {
            const modal = document.getElementById('jukebox-search-modal');
            if (modal) modal.style.display = 'none';
          };
        }
        // YouTube search logic
        const searchGo = document.getElementById('jukebox-search-go');
        if (searchGo) {
          searchGo.onclick = async () => {
            const input = document.getElementById('jukebox-search-input');
            const resultsDiv = document.getElementById('jukebox-search-results');
            if (!input || !resultsDiv) return;
            const term = (input as HTMLInputElement).value.trim();
            if (!term) return;
            resultsDiv.innerHTML = 'Searching...';
            // Use YouTube Data API v3 (public endpoint for demo)
            const apiKey = 'AIzaSyD...'; // TODO: Replace with your API key
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(term)}&key=${apiKey}`;
            try {
              const resp = await fetch(url);
              const data = (await resp.json()) as {
                items?: Array<{ id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } } }>;
              };
              if (!data.items || !Array.isArray(data.items)) {
                resultsDiv.innerHTML = 'No results.';
                return;
              }
              resultsDiv.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1em;">' +
                data.items.map((item) => `
                  <div style="background:#333;padding:1em;border-radius:0.5em;text-align:center;">
                    <img src="${item.snippet.thumbnails.medium.url}" style="width:100%;border-radius:0.5em;" />
                    <div style="margin-top:0.5em;font-size:1em;">${item.snippet.title}</div>
                    <div style="font-size:0.9em;color:#aaa;">${item.snippet.channelTitle}</div>
                    <button data-videoid="${item.id.videoId}" style="margin-top:0.5em;">Add to Queue</button>
                  </div>
                `).join('') + '</div>';
              // Add event listeners for Add to Queue buttons
              Array.from(resultsDiv.querySelectorAll('button[data-videoid]')).forEach(btn => {
                btn.addEventListener('click', () => {
                  const videoId = (btn as HTMLButtonElement).getAttribute('data-videoid') || '';
                  const title = (btn.parentElement?.querySelector('div:nth-child(2)') as HTMLElement)?.textContent || '';
                  const artist = (btn.parentElement?.querySelector('div:nth-child(3)') as HTMLElement)?.textContent || '';
                  addToPriorityQueue({ videoId, title, artist });
                  btn.textContent = 'Added!';
                  btn.setAttribute('disabled', 'true');
                });
              });
            } catch (e) {
              resultsDiv.innerHTML = 'Error fetching results.';
            }
          };
        }

        // Priority queue management
        const priorityQueue: Array<{ videoId: string; title: string; artist: string }> = [];
        let lastPrioritySongId: string | null = null;

        function addToPriorityQueue(song: { videoId: string; title: string; artist: string }) {
          priorityQueue.push(song);
          // Insert into playlist in order
          insertPrioritySong(song);
          lastPrioritySongId = song.videoId;
        }

        function insertPrioritySong(song: { videoId: string; title: string; artist: string }) {
          const playlist = api.getPlaylist ? api.getPlaylist() : [];
          let insertIndex = 0;
          if (lastPrioritySongId) {
            // Find last priority song in playlist
            const idx = playlist.findIndex((s: any) => s.video_id === lastPrioritySongId);
            if (idx !== -1) {
              insertIndex = idx + 1;
            } else {
              // Last priority song has played, reset
              lastPrioritySongId = null;
              insertIndex = (api.getPlaylistIndex ? api.getPlaylistIndex() : 0) + 1;
            }
          } else {
            insertIndex = (api.getPlaylistIndex ? api.getPlaylistIndex() : 0) + 1;
          }
          // Insert song at calculated index
          const newPlaylist = [
            ...playlist.slice(0, insertIndex),
            song,
            ...playlist.slice(insertIndex),
          ];
          if (api.updatePlaylist) {
            api.updatePlaylist(newPlaylist);
          }
        }

        // Remove requests after playing if enabled, and update lastPrioritySongId
        if (api.addEventListener) {
          api.addEventListener('videodatachange', () => {
            if (priorityQueue.length) {
              const now = api.getVideoData ? api.getVideoData() : null;
              if (now) {
                // Remove from queue if just played
                const idx = priorityQueue.findIndex(q => q.videoId === now.video_id);
                if (idx !== -1 && defaultConfig.removeAfterPlaying) {
                  priorityQueue.splice(idx, 1);
                }
                // If lastPrioritySongId is no longer in playlist, clear it
                const playlist = api.getPlaylist ? api.getPlaylist() : [];
                if (lastPrioritySongId && playlist.findIndex((s: any) => s.video_id === lastPrioritySongId) === -1) {
                  lastPrioritySongId = null;
                }
              }
            }
          });
        }
      }
    },
    onConfigChange(newConfig) {
      // TODO: React to config changes (removeAfterPlaying, addToJukeboxRequests)
    },
  },
  backend: {
    // TODO: Manage priority queue and playlist
  },
  preload: {
    // TODO: Preload logic if needed
  },
});
