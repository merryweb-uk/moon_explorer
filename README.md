# Moon Explorer

A small interactive Moon surface explorer built with Babylon.js and TypeScript. The application places a textured Moon at the centre of a 3D scene, lets the user orbit around it, and displays information when a lunar feature is approached and centred in the reticle.

## Features

- Moon surface diffuse texture and normal map
- Orbit camera with mouse and keyboard controls
- Feature detection based on camera distance and viewing direction
- Target reticle with active and locked states
- Lock sound using `target_lock.mp3`
- Information panel with feature description, coordinates, diameter, depth, and age
- JSON-backed crater catalogue with runtime validation
- Switchable filter-based and file-backed themes
- Pulsating texture-loading indicator with an explicit failure state
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

Guide Mode randomly selects up to 10 craters from the active theme to find. If the theme contains fewer than 10 craters, all of them are included.

Interact with the page once before locking a target so the browser permits sound playback.

## Adding Features

Crater data is defined in `public/craters.json`:

```json
[
    {
        "name": "Example Crater",
        "description": "A short description of the feature.",
        "latitude": -12.5,
        "longitude": 42.3,
        "diameterKm": 35,
        "depthKm": 2.5,
        "ageGa": 1.2,
        "tags": ["example"]
    }
]
```

The fields are:

1. Feature name
2. Description
3. Latitude in degrees
4. Longitude in degrees
5. Diameter in kilometres
6. Depth in kilometres
7. Age in billions of years
8. Optional tags used by filter-based themes

Latitude is displayed as `N` or `S`. Longitude is displayed using this project's convention: positive values are `W` and negative values are `E`.

The surface guide uses the same coordinate conversion as the feature markers, so it can be enabled with `G` while positioning new features.

Feature data is validated when the application loads. The complete file is rejected if a feature has missing or invalid text, non-numeric measurements, invalid tags, coordinates outside the valid latitude/longitude ranges, or negative diameter, depth, or age values. The specific validation error is written to the browser console and the application displays a feature-data loading error instead of using a partially invalid catalogue.

## Themes

Themes are listed in `public/themes.json`. A theme can filter the canonical `public/craters.json` dataset or load a separate crater file:

```json
{
    "id": "large-craters",
    "name": "Craters over 100 km",
    "filter": {
        "diameterKm": {
            "min": 100
        }
    }
}
```

Filter themes can use `diameterKm.min`, `diameterKm.max`, and `tags`. A feature matches a theme if it has at least one of the requested tags. File-backed themes use a `file` property instead:

```json
{
    "id": "featured-craters",
    "name": "Featured Craters",
    "file": "./themes/featured-craters.json"
}
```

The theme selector is displayed in the top-right of the application. The default theme is **All Craters**. New themes can be added to `themes.json` or removed from it without changing the TypeScript code. Theme data uses the same validation rules as the canonical crater dataset. When a theme fails to load, the previously active theme remains selected.

## Replacing Assets

The current assets are stored in `public/`:

- `public/moon_8k.jpg`: diffuse Moon texture
- `public/moon_8k_n.jpg`: Moon normal map
- `public/reticle.png`: transparent target reticle
- `public/target_lock.mp3`: sound played when a target becomes locked

Keep the filenames the same when replacing assets, or update the corresponding paths in `moon_explorer.ts` and `index.html`.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. Pushes to `main` build the Vite application and deploy the `dist` directory to GitHub Pages.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Technology

- TypeScript
- Babylon.js
- Vite
- GitHub Actions
