# Moon Explorer

A small interactive Moon surface explorer built with Babylon.js and TypeScript. The application places a textured Moon at the centre of a 3D scene, lets the user orbit around it, and displays information when a lunar feature is approached and centred in the reticle.

## Features

- Moon surface diffuse texture and normal map
- Orbit camera with mouse and keyboard controls
- Feature detection based on camera distance and viewing direction
- Target reticle with active and locked states
- Lock sound using `target_lock.mp3`
- Information panel with feature description, coordinates, and diameter
- Optional latitude/longitude surface guide for positioning features
- GitHub Pages deployment through GitHub Actions

## Run Locally

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

Create a production build with:

```bash
npm run build
```

## Controls

- Mouse drag: orbit around the Moon
- Mouse wheel: zoom
- `A` / `D`: rotate horizontally
- `W` / `S`: adjust the vertical camera angle
- `Q`: zoom out
- `E`: zoom in
- `G`: show or hide the positioning guide

Interact with the page once before locking a target so the browser permits sound playback.

## Adding Features

Feature data is defined in `moongame.ts` using `createFeature()`:

```typescript
features.push(createFeature(
    "Example Crater",
    "A short description of the feature.",
    -12.5,
    42.3,
    35
));
```

The arguments are:

1. Feature name
2. Description
3. Latitude in degrees
4. Longitude in degrees
5. Diameter in kilometres

Latitude is displayed as `N` or `S`. Longitude is displayed using this project's convention: positive values are `W` and negative values are `E`.

The surface guide uses the same coordinate conversion as the feature markers, so it can be enabled with `G` while positioning new features.

## Replacing Assets

The current assets are stored in the project root:

- `moon_8k.jpg`: diffuse Moon texture
- `moon_8k_n.jpg`: Moon normal map
- `reticle.png`: transparent target reticle
- `target_lock.mp3`: sound played when a target becomes locked

Keep the filenames the same when replacing assets, or update the corresponding paths in `moongame.ts` and `index.html`.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. Pushes to `main` build the Vite application and deploy the `dist` directory to GitHub Pages.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Technology

- TypeScript
- Babylon.js
- Vite
- GitHub Actions
