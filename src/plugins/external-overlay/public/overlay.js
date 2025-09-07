// Get the port from the URL
const urlParams = new URLSearchParams(window.location.search);
const port = urlParams.get('port');
const apiUrl = `http://127.0.0.1:${port}/api/now-playing`;

// DOM elements
const albumArt = document.getElementById('album-art');
const titleElement = document.getElementById('title');
const artistElement = document.getElementById('artist');
const nowPlayingElement = document.getElementById('now-playing');

// Default album art when none is available
const defaultAlbumArt = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1tdXNpYyI+PHBhdGggZD0iTTkgMThWNWw4IDZoLTR2N2gtNHoiLz48Y2lyY2xlIGN4PSI5IiBjeT0iMTgiIHI9IjMiLz48cGF0aCBkPSJNMTggNnYxMiIvPjxwYXRoIGQ9Im0yMSA5LTMtM2wtMyAzIi8+PC9zdmc+';

// Function to update the overlay with new song data
function updateOverlay(data) {
  // Update album art or use default
  if (data.albumArt) {
    albumArt.src = data.albumArt;
    albumArt.style.display = 'block';
  } else {
    albumArt.src = defaultAlbumArt;
    albumArt.style.display = 'block';
  }
  
  // Update title and artist with marquee effect if needed
  updateMarqueeText(titleElement, data.title || 'No track playing');
  updateMarqueeText(artistElement, data.artist || '-');
  
  // Update now playing indicator
  nowPlayingElement.textContent = data.isPlaying ? 'NOW PLAYING' : 'PAUSED';
  nowPlayingElement.style.color = data.isPlaying ? '#1DB954' : '#ff4d4d';
}

// Function to update text with marquee effect if needed
function updateMarqueeText(element, text) {
  // Remove any existing marquee spans
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  
  // Create a text node or a marquee span if the text is too long
  if (text.length > 25) {
    // Create a marquee effect by duplicating the text
    const span = document.createElement('span');
    span.textContent = text + ' • ' + text; // Duplicate text with separator
    element.appendChild(span);
  } else {
    // Just set the text if it's short enough
    element.textContent = text;
  }
}

// Function to fetch current song data
async function fetchCurrentSong() {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    updateOverlay(data);
  } catch (error) {
    console.error('Error fetching song data:', error);
    // Show error state
    albumArt.src = defaultAlbumArt;
    titleElement.textContent = 'Error connecting to DJAMMS';
    artistElement.textContent = 'Please ensure DJAMMS is running';
  }
}

// Set up periodic updates
setInterval(fetchCurrentSong, 1000); // Update every second

// Initial fetch
fetchCurrentSong();

// Make the overlay draggable
let isDragging = false;
let offsetX, offsetY;
const overlay = document.getElementById('overlay-container');

overlay.addEventListener('mousedown', (e) => {
  // Only start dragging if not clicking on interactive elements
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
    isDragging = true;
    offsetX = e.clientX - overlay.getBoundingClientRect().left;
    offsetY = e.clientY - overlay.getBoundingClientRect().top;
    overlay.style.cursor = 'grabbing';
  }
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    overlay.style.left = `${e.clientX - offsetX}px`;
    overlay.style.top = `${e.clientY - offsetY}px`;
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  overlay.style.cursor = 'grab';
});

// Make the overlay draggable on touch devices
overlay.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  isDragging = true;
  offsetX = touch.clientX - overlay.getBoundingClientRect().left;
  offsetY = touch.clientY - overlay.getBoundingClientRect().top;
  e.preventDefault();
});

document.addEventListener('touchmove', (e) => {
  if (isDragging) {
    const touch = e.touches[0];
    overlay.style.left = `${touch.clientX - offsetX}px`;
    overlay.style.top = `${touch.clientY - offsetY}px`;
    e.preventDefault();
  }
});

document.addEventListener('touchend', () => {
  isDragging = false;
});

// Add right-click context menu for additional options
overlay.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  // You can add a custom context menu here if needed
});
