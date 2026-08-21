import * as BABYLON from "@babylonjs/core";

type PlanetFeature = {
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    diameterKm: number;
    triggerDistance: number;
    worldPosition: BABYLON.Vector3;
};

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const infoPanel = document.getElementById("infoPanel") as HTMLDivElement;
const infoTitle = document.getElementById("infoTitle") as HTMLHeadingElement;
const infoText = document.getElementById("infoText") as HTMLParagraphElement;
const infoCoordinates = document.getElementById("infoCoordinates") as HTMLParagraphElement;
const infoDiameter = document.getElementById("infoDiameter") as HTMLParagraphElement;
const reticle = document.getElementById("reticle") as HTMLDivElement;

const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);

scene.clearColor = new BABYLON.Color4(0.02, 0.03, 0.08, 1);

// Lighting
new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(-1, 1, 0), scene);

// Planet
const planetRadius = 10;
const planet = BABYLON.MeshBuilder.CreateSphere(
    "planet",
    { diameter: planetRadius * 2 },
    scene
);

const planetMaterial = new BABYLON.StandardMaterial("planetMat", scene);
const diffuseTexture = new BABYLON.Texture("./moon_8k.jpg", scene);
const bumpTexture = new BABYLON.Texture("./moon_8k_n.jpg", scene);

// Mirror the source maps horizontally and vertically to match Babylon's sphere UVs.
diffuseTexture.uScale = -1; diffuseTexture.uOffset = 1;
diffuseTexture.vScale = -1; diffuseTexture.vOffset = 1;
bumpTexture.uScale = -1; bumpTexture.uOffset = 1;
bumpTexture.vScale = -1; bumpTexture.vOffset = 1;

planetMaterial.diffuseTexture = diffuseTexture;
planetMaterial.bumpTexture = bumpTexture;
planetMaterial.bumpTexture.level = 2;
planetMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
planetMaterial.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.08);
planet.material = planetMaterial;

// Camera - start with a simple, stable orbit camera so the planet is visible immediately.
const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 2.3,
    25,
    BABYLON.Vector3.Zero(),
    scene
);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 15;
camera.upperRadiusLimit = 40;
camera.wheelPrecision = 20;

const keys: Record<string, boolean> = {};
const targetLockAudio = new Audio("./target_lock.mp3");
targetLockAudio.preload = "auto";
targetLockAudio.volume = 0.7;

function playTargetLockSound() {
    targetLockAudio.currentTime = 0;
    void targetLockAudio.play().catch((error: unknown) => {
        console.warn("Target lock sound could not play.", error);
    });
}

window.addEventListener("keydown", (event) => {
    keys[event.code] = true;
});
window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
});

// Build feature markers
const features: PlanetFeature[] = [];

const surfaceGuide = new BABYLON.TransformNode("surfaceGuide", scene);
let surfaceGuideVisible = false;

function latLonToWorld(radius: number, latitudeDeg: number, longitudeDeg: number): BABYLON.Vector3 {
    const lat = BABYLON.Tools.ToRadians(latitudeDeg);
    const lon = BABYLON.Tools.ToRadians(180 - longitudeDeg);

    const x = radius * Math.cos(lat) * Math.cos(lon);
    const y = radius * Math.sin(lat);
    const z = radius * Math.cos(lat) * Math.sin(lon);

    return new BABYLON.Vector3(x, y, z);
}

function createSurfaceGuide() {
    const guideRadius = planetRadius + 0.08;
    const guideLines: BABYLON.Vector3[][] = [];

    for (let latitude = -90; latitude <= 90; latitude += 15) {
        const latitudeLine: BABYLON.Vector3[] = [];
        for (let longitude = 0; longitude <= 360; longitude += 5) {
            latitudeLine.push(latLonToWorld(guideRadius, latitude, longitude));
        }
        guideLines.push(latitudeLine);
    }

    for (let longitude = 0; longitude < 360; longitude += 15) {
        const longitudeLine: BABYLON.Vector3[] = [];
        for (let latitude = -90; latitude <= 90; latitude += 5) {
            longitudeLine.push(latLonToWorld(guideRadius, latitude, longitude));
        }
        guideLines.push(longitudeLine);
    }

    const guideMesh = BABYLON.MeshBuilder.CreateLineSystem("surfaceGuideLines", {
        lines: guideLines,
        updatable: false
    }, scene);
    guideMesh.color = new BABYLON.Color3(0.2, 0.85, 1);
    guideMesh.alpha = 0.28;
    guideMesh.parent = surfaceGuide;

    const guideMaterial = new BABYLON.StandardMaterial("surfaceGuideMarkers", scene);
    guideMaterial.diffuseColor = new BABYLON.Color3(1, 0.75, 0.15);
    guideMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.2, 0.02);

    for (const feature of features) {
        const marker = BABYLON.MeshBuilder.CreateSphere(`guide-${feature.name}`, {
            diameter: 0.18
        }, scene);
        marker.position = latLonToWorld(planetRadius + 0.16, feature.latitude, feature.longitude);
        marker.material = guideMaterial;
        marker.parent = surfaceGuide;
    }
}

function createFeature(name: string, description: string, lat: number, lon: number, diameterKm: number): PlanetFeature {
    const worldPosition = latLonToWorld(planetRadius + 0.5, lat, lon);

    return {
        name,
        description,
        latitude: lat,
        longitude: lon,
        diameterKm,
        triggerDistance: 10,
        worldPosition
    };
}

// Example features
features.push(createFeature("Tycho Crater", "A large impact basin with bright ejecta rays.", -43.3, 11.2, 85));
features.push(createFeature("Copernicus", "A massive, highly visible impact crater with terraced walls and a central peak, located in the eastern Mare Imbrium region.", 9.6, 20.1, 93));
features.push(createFeature("Kepler", "A classic rayed crater located between the Oceanus Procellarum and Mare Insularum, forming a well-known triad with Copernicus and Aristarchus.", 8.1, 38, 32));
features.push(createFeature("Clavius", "One of the largest and oldest crater formations on the near side, notable for its vast plain and smaller overlapping crater chains.", -58.4, 14.4, 231));
features.push(createFeature("Aristotoles", "a prominent, well-preserved lunar impact crater located in the northeastern quadrant of the Moon's near side along the southern edge of the Mare Frigoris (Sea of Cold).", 50.2, -17.4, 87));

createSurfaceGuide();
surfaceGuide.setEnabled(surfaceGuideVisible);

window.addEventListener("keydown", (event) => {
    if (event.code === "KeyG") {
        surfaceGuideVisible = !surfaceGuideVisible;
        surfaceGuide.setEnabled(surfaceGuideVisible);
    }
});

function showInfo(feature: PlanetFeature) {
    infoTitle.textContent = feature.name;
    infoText.textContent = feature.description;
    infoCoordinates.textContent = `Latitude ${formatCoordinate(feature.latitude, "N", "S")}, Longitude ${formatCoordinate(feature.longitude, "W", "E")}`;
    infoDiameter.textContent = `Diameter ${feature.diameterKm} km`;
    infoPanel.classList.add("visible");
}

function formatCoordinate(value: number, positiveDirection: string, negativeDirection: string): string {
    const direction = value < 0 ? negativeDirection : positiveDirection;
    return `${Math.abs(value).toFixed(1)}° ${direction}`;
}

function hideInfo() {
    infoPanel.classList.remove("visible");
}

// Debug-friendly camera: keep the scene visible while designing the planet explorer.
function updateSurfaceCamera() {
    camera.target = BABYLON.Vector3.Zero();
}

// Simple movement relative to the planet surface
function updateMovement() {
    // This is intentionally disabled for the stable debug pass.
    // The purpose is to ensure the scene is visible before we add the surface-walk controller.

    const lowerRadius = camera.lowerRadiusLimit ?? 15;
    const upperRadius = camera.upperRadiusLimit ?? 40;


    if (keys["KeyA"]) {
        camera.alpha -= 0.01;
    }
    if (keys["KeyD"]) {
        camera.alpha += 0.01;
    }
    if (keys["KeyW"]) {
        camera.beta = Math.min(Math.PI - 0.05, camera.beta + 0.01);
    }
    if (keys["KeyS"]) {
        camera.beta = Math.max(0.1, camera.beta - 0.01);
    }
    if (keys["KeyQ"]) {
        camera.radius = Math.max(lowerRadius, camera.radius + 0.2);
    }
    if (keys["KeyE"]) {
        camera.radius = Math.min(upperRadius, camera.radius - 0.2);
    }
}

function updateFeatureDetection() {
    let nearestFeature: PlanetFeature | null = null;
    let nearestDistance = Number.MAX_VALUE;
    let isTargetActive = false;
    let isTargetLocked = false;
    let lockedFeatureName: string | null = null;

    if (reticle.classList.contains("locked")) {
        lockedFeatureName = infoTitle.textContent;
    }

    for (const feature of features) {
        const toFeature = feature.worldPosition.subtract(camera.position);
        const d = toFeature.length();
        const cameraForward = camera.getTarget().subtract(camera.position).normalize();
        const viewFactor = BABYLON.Vector3.Dot(cameraForward, toFeature.normalize());

        // Reliable visibility check: feature must be in front of the camera and within range.
        const inRange = d < feature.triggerDistance && viewFactor > 0.98;
        const centered = viewFactor > 0.99 && d < feature.triggerDistance * 0.5;

        if (inRange) {
            isTargetActive = true;
            if (centered) {
                isTargetLocked = true;
            }

            if (d < nearestDistance) {
                nearestDistance = d;
                nearestFeature = feature;
            }
        }
    }

    if (isTargetActive && nearestFeature) {
        if (isTargetLocked && lockedFeatureName !== nearestFeature.name) {
            playTargetLockSound();
        }
        reticle.classList.add("active");
        reticle.classList.toggle("locked", isTargetLocked);
        reticle.style.opacity = isTargetLocked ? "1" : "0.7";
        reticle.style.transform = isTargetLocked ? "scale(1.35)" : "scale(1)";
        showInfo(nearestFeature);
    } else {
        reticle.classList.remove("active");
        reticle.classList.remove("locked");
        reticle.style.opacity = "0";
        reticle.style.transform = "scale(0.8)";
        hideInfo();
    }
}

// Main loop
scene.onBeforeRenderObservable.add(() => {
    updateMovement();
    updateSurfaceCamera();
    updateFeatureDetection();
});

engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener("resize", () => {
    engine.resize();
});