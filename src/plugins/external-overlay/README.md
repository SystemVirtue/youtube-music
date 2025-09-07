# DJAMMS External Overlay Plugin

A customizable overlay plugin for DJAMMS that displays the currently playing track information. This plugin creates a floating window that shows the current track's title, artist, and album art, which can be used for streaming or screen recording.

## Features

- Displays current track information (title, artist, album art)
- Customizable appearance through CSS
- Draggable overlay window
- Auto-updates when the track changes
- Works with OBS, Streamlabs, and other streaming software
- Responsive design that works at different sizes

## Installation

1. Place the `external-overlay` folder in the `src/plugins/` directory of your DJAMMS installation.
2. Enable the plugin in DJAMMS settings.
3. The overlay window will appear automatically when a track starts playing.

## Usage

- **Drag and Drop**: Click and drag the overlay to position it anywhere on your screen.
- **Resize**: The overlay is responsive and will adjust its size based on the window dimensions.
- **Right-Click**: Right-click on the overlay for additional options (customizable in the code).

## Customization

You can customize the appearance by modifying the CSS in `public/overlay.css`. The overlay uses a semi-transparent dark theme by default.

### Available CSS Variables

- `--bg-color`: Background color of the overlay (default: rgba(0, 0, 0, 0.7))
- `--text-color`: Main text color (default: #ffffff)
- `--accent-color`: Accent color for the "Now Playing" text (default: #1DB954)
- `--secondary-text`: Secondary text color for artist name (default: #b3b3b3)

## Integration with Streaming Software

### OBS/Streamlabs

1. Add a new "Browser Source" in OBS/Streamlabs.
2. Check "Local file" and browse to the overlay HTML file in the plugin directory.
3. Set the width and height (e.g., 400x150).
4. Check "Shutdown source when not visible" for better performance.
5. Click OK to add the source to your scene.

### Browser Source URL

You can also access the overlay directly in a browser or as a browser source using:

```
http://localhost:<port>/overlay.html
```

Replace `<port>` with the port number shown in the DJAMMS console when the plugin loads.

## Development

### Building

Make sure you have Node.js and npm installed. Then run:

```bash
npm install
npm run build
```

### File Structure

- `index.ts` - Main plugin file that handles the Electron window and communication
- `public/overlay.html` - HTML structure of the overlay
- `public/overlay.css` - Styles for the overlay
- `public/overlay.js` - Client-side JavaScript for the overlay

## License

MIT

## Credits

Based on the design of Mrhuma's Music Overlay, adapted for DJAMMS.
