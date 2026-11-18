# Pelican Post / 鹈鹕海岸邮局

A procedural Three.js r160 coastal miniature, built entirely from local resources.

## Open

Serve this directory using any static server, for example:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Deploy this directory unchanged to GitHub Pages. No build step, package install, CDN, fonts, model downloads, or API keys are needed. JavaScript modules require HTTP(S); opening index.html with a `file://` URL is not supported.

## Interactions

- Drag with one finger / mouse to orbit; pinch or scroll to zoom.
- Pause/resume and adjust cycling speed between 4 and 24 km/h.
- Ring the bicycle bell (sound starts only after tapping the button).
- Switch between daylight and a starlit lighthouse scene.
- Reset the camera; download a 1600 × 1200 PNG postcard.
- With the scene focused: Space pauses/resumes, B rings, R resets.
- Reduced-motion preference pauses the initial ride and scenic movement. Starting the ride explicitly enables animation.

`index.html` contains the local import map. `app.js` handles rendering and interaction, `cyclist.js` builds the bicycle and pelican, `world.js` builds the island, and `forms.js` provides shared procedural forms. All illustrations, geometry, textures, and bell audio are generated locally. The supplied `vendor/` files are unchanged.

The distance counter is a playful simulation calculated from the selected speed; the miniature uses a stationary rider and moving road markings for its continuous ride.
