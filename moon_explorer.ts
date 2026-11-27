import * as BABYLON from "@babylonjs/core";

type PlanetFeature = {
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    diameterKm: number;
    depthKm: number;
    ageGa: number;
    tags: string[];
    worldPosition: BABYLON.Vector3;
};

type FeatureData = Omit<PlanetFeature, "worldPosition">;
type ThemeFilter = {
    diameterKm?: {
        min?: number;
        max?: number;
    };
    tags?: string[];
};
type ThemeDefinition = {
    id: string;
    name: string;
    file?: string;
    filter?: ThemeFilter;
};
type LunarMare = {
    name: string;
    alias: string;
    latitude: number;
    longitude: number;
    worldPosition: BABYLON.Vector3;
};
type LunarMareData = Omit<LunarMare, "worldPosition">;

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const infoPanel = document.getElementById("infoPanel") as HTMLDivElement;
const infoTitle = document.getElementById("infoTitle") as HTMLHeadingElement;
const infoText = document.getElementById("infoText") as HTMLParagraphElement;

const infoLatitude = document.getElementById("infoLatitude") as HTMLParagraphElement;
const infoLongitude = document.getElementById("infoLongitude") as HTMLParagraphElement;

const infoDiameter = document.getElementById("infoDiameter") as HTMLParagraphElement;
const infoDepth = document.getElementById("infoDepth") as HTMLParagraphElement;
const infoAge = document.getElementById("infoAge") as HTMLParagraphElement;
const reticle = document.getElementById("reticle") as HTMLDivElement;
const guideArrow = document.getElementById("guideArrow") as HTMLDivElement;
const targetStatus = document.getElementById("targetStatus") as HTMLDivElement;
const textureLoadingWarning = document.getElementById("textureLoadingWarning") as HTMLDivElement;
const craterLabel = document.getElementById("craterLabel") as HTMLDivElement | null;
const guideModeButton = document.getElementById("guideModeButton") as HTMLButtonElement;
const exploreModeButton = document.getElementById("exploreModeButton") as HTMLButtonElement;
const guideFeatureSelector = document.getElementById("guideFeatureSelector") as HTMLDivElement;
const guideFeatureList = document.getElementById("guideFeatureList") as HTMLUListElement;
const themeSelector = document.getElementById("themeSelector") as HTMLSelectElement;
const mareLabelContainer = document.getElementById("mareLabelContainer") as HTMLDivElement;
const showMareToggle = document.getElementById("showMareToggle") as HTMLInputElement;
const reticleLatitude = document.getElementById("reticleLatitude") as HTMLParagraphElement;
const reticleLongitude = document.getElementById("reticleLongitude") as HTMLParagraphElement;

const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);
const featureTriggerDistance = 10;

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
let loadedTextureCount = 0;
const requiredTextureCount = 2;

function markTextureLoaded() {
    loadedTextureCount += 1;
    if (loadedTextureCount === requiredTextureCount) {
        textureLoadingWarning.classList.add("hidden");
    }
}

function markTextureLoadFailed(textureName: string) {
    console.error(`${textureName} texture could not be loaded.`);
    textureLoadingWarning.textContent = "Texture failed to load";
    textureLoadingWarning.classList.add("error");
}

const diffuseTexture = new BABYLON.Texture(
    "./moon_8k.jpg",
    scene,
    undefined,
    undefined,
    undefined,
    markTextureLoaded,
    () => markTextureLoadFailed("Diffuse")
);
const bumpTexture = new BABYLON.Texture(
    "./moon_8k_n.jpg",
    scene,
    undefined,
    undefined,
    undefined,
    markTextureLoaded,
    () => markTextureLoadFailed("Normal map")
);

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
camera.viewport = new BABYLON.Viewport(0, 0, 6 / 5, 1);
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
let features: PlanetFeature[] = [];

let mares: LunarMare[] = [];
let mareLabelElements: Map<string, HTMLDivElement> = new Map();
let showMaresEnabled = false;

const surfaceGuide = new BABYLON.TransformNode("surfaceGuide", scene);
let surfaceGuideVisible = false;
let activeFeature: PlanetFeature | null = null;
let interactionMode: "explore" | "guide" = "explore";
let guideFeatureIndex = 0;
let guideFeatures: PlanetFeature[] = [];
let guideTargetLocked = false;
const reachedGuideFeatures = new Set<number>();
const craterLabelSurfaceOffset = 0.15;
const maxGuideFeatures = 10;
let surfaceGuideMaterial: BABYLON.StandardMaterial | null = null;

function latLonToWorld(radius: number, latitudeDeg: number, longitudeDeg: number): BABYLON.Vector3 {
    const lat = BABYLON.Tools.ToRadians(latitudeDeg);
    const lon = BABYLON.Tools.ToRadians(180 - longitudeDeg);

    const x = radius * Math.cos(lat) * Math.cos(lon);
    const y = radius * Math.sin(lat);
    const z = radius * Math.cos(lat) * Math.sin(lon);

    return new BABYLON.Vector3(x, y, z);
}

function worldToLatLon(radius: number, position: BABYLON.Vector3): { latitude: number; longitude: number } {
    const normalizedPos = position.normalize();

    const latRad = Math.asin(normalizedPos.y);
    const latitudeDeg = BABYLON.Tools.ToDegrees(latRad);

    const lonRad = Math.atan2(normalizedPos.z, normalizedPos.x);
    const longitudeDeg = 180 - BABYLON.Tools.ToDegrees(lonRad);

    // Normalize longitude to -180 to 180
    let normalizedLon = longitudeDeg;
    if (normalizedLon > 180) {
        normalizedLon -= 360;
    } else if (normalizedLon < -180) {
        normalizedLon += 360;
    }

    return {
        latitude: latitudeDeg,
        longitude: normalizedLon
    };
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

    surfaceGuideMaterial = new BABYLON.StandardMaterial("surfaceGuideMarkers", scene);
    surfaceGuideMaterial.diffuseColor = new BABYLON.Color3(1, 0.75, 0.15);
    surfaceGuideMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.2, 0.02);

    for (const feature of features) {
        const marker = BABYLON.MeshBuilder.CreateSphere(`guide-${feature.name}`, {
            diameter: 0.18
        }, scene);
        marker.position = latLonToWorld(planetRadius + 0.16, feature.latitude, feature.longitude);
        marker.material = surfaceGuideMaterial;
        marker.parent = surfaceGuide;
    }
}

function clearSurfaceGuide() {
    for (const mesh of surfaceGuide.getChildMeshes()) {
        mesh.dispose();
    }
    surfaceGuideMaterial?.dispose();
    surfaceGuideMaterial = null;
}

function createFeature(data: FeatureData): PlanetFeature {
    return {
        ...data,
        worldPosition: latLonToWorld(planetRadius + 0.5, data.latitude, data.longitude)
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyStringArray(value: unknown): value is string[] {
    return Array.isArray(value)
        && value.every((item) => typeof item === "string" && item.trim() !== "");
}

function readFiniteNumber(entry: Record<string, unknown>, field: string, label: string): number {
    const value = entry[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Feature${label} has an invalid ${field}.`);
    }
    return value;
}

function validateFeatureData(value: unknown): FeatureData[] {
    if (!Array.isArray(value)) {
        throw new Error("Feature data must be an array.");
    }

    return value.map((entry, index) => {
        const entryNumber = index + 1;
        if (!isRecord(entry)) {
            throw new Error(`Feature ${entryNumber} must be an object.`);
        }

        const name = entry.name;
        const label = typeof name === "string" && name.trim() !== ""
            ? ` "${name}"`
            : ` ${entryNumber}`;

        if (typeof name !== "string" || name.trim() === "") {
            throw new Error(`Feature ${entryNumber} must have a non-empty name.`);
        }

        const description = entry.description;
        if (typeof description !== "string" || description.trim() === "") {
            throw new Error(`Feature${label} must have a non-empty description.`);
        }

        const latitude = readFiniteNumber(entry, "latitude", label);
        if (latitude < -90 || latitude > 90) {
            throw new Error(`Feature${label} has an invalid latitude: ${latitude}.`);
        }

        const longitude = readFiniteNumber(entry, "longitude", label);
        if (longitude < -180 || longitude > 180) {
            throw new Error(`Feature${label} has an invalid longitude: ${longitude}.`);
        }

        const diameterKm = readFiniteNumber(entry, "diameterKm", label);
        const depthKm = readFiniteNumber(entry, "depthKm", label);
        const ageGa = readFiniteNumber(entry, "ageGa", label);
        for (const [field, numericValue] of [
            ["diameterKm", diameterKm],
            ["depthKm", depthKm],
            ["ageGa", ageGa]
        ] as const) {
            if (numericValue < 0) {
                throw new Error(`Feature${label} has a negative ${field}.`);
            }
        }

        const tags = entry.tags ?? [];
        if (!isNonEmptyStringArray(tags)) {
            throw new Error(`Feature${label} has invalid tags.`);
        }

        return {
            name,
            description,
            latitude,
            longitude,
            diameterKm,
            depthKm,
            ageGa,
            tags
        };
    });
}

function validateThemes(value: unknown): ThemeDefinition[] {
    if (!Array.isArray(value)) {
        throw new Error("Theme data must be an array.");
    }

    const themeIds = new Set<string>();
    return value.map((entry, index) => {
        const entryNumber = index + 1;
        if (!isRecord(entry)) {
            throw new Error(`Theme ${entryNumber} must be an object.`);
        }

        const id = entry.id;
        if (typeof id !== "string" || id.trim() === "") {
            throw new Error(`Theme ${entryNumber} must have a non-empty id.`);
        }
        if (themeIds.has(id)) {
            throw new Error(`Theme "${id}" is defined more than once.`);
        }
        themeIds.add(id);

        const name = entry.name;
        if (typeof name !== "string" || name.trim() === "") {
            throw new Error(`Theme "${id}" must have a non-empty name.`);
        }

        const file = entry.file;
        if (file !== undefined && (typeof file !== "string" || file.trim() === "")) {
            throw new Error(`Theme "${id}" has an invalid file.`);
        }

        const rawFilter = entry.filter;
        if (file !== undefined && rawFilter !== undefined) {
            throw new Error(`Theme "${id}" cannot define both file and filter.`);
        }

        let filter: ThemeFilter | undefined;
        if (rawFilter !== undefined) {
            if (!isRecord(rawFilter)) {
                throw new Error(`Theme "${id}" has an invalid filter.`);
            }

            const rawDiameter = rawFilter.diameterKm;
            if (rawDiameter !== undefined && !isRecord(rawDiameter)) {
                throw new Error(`Theme "${id}" has an invalid diameter filter.`);
            }

            const min = rawDiameter?.min;
            const max = rawDiameter?.max;
            if (min !== undefined && (typeof min !== "number" || !Number.isFinite(min))) {
                throw new Error(`Theme "${id}" has an invalid minimum diameter filter.`);
            }
            if (max !== undefined && (typeof max !== "number" || !Number.isFinite(max))) {
                throw new Error(`Theme "${id}" has an invalid maximum diameter filter.`);
            }
            if (min !== undefined && max !== undefined && min > max) {
                throw new Error(`Theme "${id}" has a diameter filter with min greater than max.`);
            }

            const tags = rawFilter.tags;
            if (tags !== undefined && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || tag.trim() === ""))) {
                throw new Error(`Theme "${id}" has invalid tag filters.`);
            }

            filter = {
                ...(rawDiameter === undefined ? {} : { diameterKm: { min, max } }),
                ...(tags === undefined ? {} : { tags })
            };
        }

        return {
            id,
            name,
            ...(file === undefined ? {} : { file }),
            ...(filter === undefined ? {} : { filter })
        };
    });
}

async function loadJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Data request for ${url} failed with status ${response.status}.`);
    }

    return response.json();
}

async function loadFeatureData(file: string): Promise<FeatureData[]> {
    return validateFeatureData(await loadJson(file));
}

function validateMareData(value: unknown): LunarMareData[] {
    if (!Array.isArray(value)) {
        throw new Error("Mare data must be an array.");
    }

    return value.map((entry, index) => {
        const entryNumber = index + 1;
        if (!isRecord(entry)) {
            throw new Error(`Mare ${entryNumber} must be an object.`);
        }

        const name = entry.name;
        if (typeof name !== "string" || name.trim() === "") {
            throw new Error(`Mare ${entryNumber} must have a non-empty name.`);
        }

        const alias = entry.alias;
        if (typeof alias !== "string" || alias.trim() === "") {
            throw new Error(`Mare "${name}" must have a non-empty alias.`);
        }

        const latitude = readFiniteNumber(entry, "latitude", ` "${name}"`);
        if (latitude < -90 || latitude > 90) {
            throw new Error(`Mare "${name}" has an invalid latitude: ${latitude}.`);
        }

        const longitude = readFiniteNumber(entry, "longitude", ` "${name}"`);
        if (longitude < -180 || longitude > 180) {
            throw new Error(`Mare "${name}" has an invalid longitude: ${longitude}.`);
        }

        return { name, alias, latitude, longitude };
    });
}

async function loadMareData(): Promise<LunarMareData[]> {
    return validateMareData(await loadJson("./mare.json"));
}

function createMareLabel(mare: LunarMare): HTMLDivElement {
    const label = document.createElement("div");
    label.className = "mare-label";
    label.innerHTML = `${mare.name}<br><span style="font-size: 0.9rem; font-weight: 400;">[${mare.alias}]</span>`;
    label.style.position = "absolute";
    label.style.color = "#3b82f6";
    label.style.fontSize = "1.0rem";
    label.style.fontWeight = "600";
    label.style.pointerEvents = "none";
    label.style.textShadow = "0 2px 8px rgba(0, 0, 0, 0.9)";
    label.style.whiteSpace = "nowrap";
    label.style.zIndex = "10";
    label.style.display = "none";
    label.style.textAlign = "center";
    mareLabelContainer.appendChild(label);
    return label;
}

function updateMareLabels() {
    if (!showMaresEnabled) {
        for (const label of mareLabelElements.values()) {
            label.style.display = "none";
        }
        return;
    }

    const viewport = camera.viewport.toGlobal(
        engine.getRenderWidth(),
        engine.getRenderHeight()
    );

    for (const mare of mares) {
        let label = mareLabelElements.get(mare.name);
        if (!label) {
            label = createMareLabel(mare);
            mareLabelElements.set(mare.name, label);
        }

        // Check if the mare is on the visible hemisphere of the moon
        // A point is visible if the dot product of its position with the camera direction is positive
        const mareToCamera = camera.position.subtract(mare.worldPosition);
        const mareNormal = mare.worldPosition.normalize();
        const isOnVisibleHemisphere = BABYLON.Vector3.Dot(mareNormal, mareToCamera) > 0;

        if (!isOnVisibleHemisphere) {
            label.style.display = "none";
            continue;
        }

        const labelWorldPos = mare.worldPosition
            .clone()
            .normalize()
            .scale(planetRadius + craterLabelSurfaceOffset);

        const cameraForward = camera.getTarget().subtract(camera.position).normalize();
        const toLabel = labelWorldPos.subtract(camera.position).normalize();
        const inFront = BABYLON.Vector3.Dot(cameraForward, toLabel) > 0;

        const projected = BABYLON.Vector3.Project(
            labelWorldPos,
            BABYLON.Matrix.Identity(),
            scene.getTransformMatrix(),
            viewport
        );

        if (!inFront || projected.z < 0 || projected.z > 1) {
            label.style.display = "none";
        } else {
            label.style.left = `${projected.x}px`;
            label.style.top = `${projected.y}px`;
            label.style.transform = "translate(-50%, -100%)";
            label.style.display = "block";
        }
    }
}

function filterFeatureData(featureData: FeatureData[], filter: ThemeFilter | undefined): FeatureData[] {
    if (!filter) {
        return featureData;
    }

    return featureData.filter((feature) => {
        const diameterFilter = filter.diameterKm;
        if (diameterFilter?.min !== undefined && feature.diameterKm < diameterFilter.min) {
            return false;
        }
        if (diameterFilter?.max !== undefined && feature.diameterKm > diameterFilter.max) {
            return false;
        }
        if (filter.tags && !filter.tags.some((tag) => feature.tags.includes(tag))) {
            return false;
        }
        return true;
    });
}

function getGuideFeature(): PlanetFeature | null {
    return guideFeatures[guideFeatureIndex] ?? null;
}

function selectGuideFeatures() {
    const shuffledFeatures = [...features];
    for (let index = shuffledFeatures.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffledFeatures[index], shuffledFeatures[randomIndex]] = [
            shuffledFeatures[randomIndex],
            shuffledFeatures[index]
        ];
    }

    guideFeatures = shuffledFeatures.slice(0, maxGuideFeatures);
    guideFeatureIndex = 0;
}

function updateGuideFeatureList() {
    guideFeatureList.replaceChildren();

    for (const [index, feature] of guideFeatures.entries()) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = feature.name;
        button.classList.toggle("selected", interactionMode === "guide" && index === guideFeatureIndex);
        button.classList.toggle("reached", interactionMode === "guide" && reachedGuideFeatures.has(index));
        button.addEventListener("click", () => {
            guideFeatureIndex = index;
            guideTargetLocked = false;
            activeFeature = null;
            targetStatus.textContent = "";
            hideInfo();
            updateGuideFeatureList();
        });
        item.appendChild(button);
        guideFeatureList.appendChild(item);
    }
}

function setInteractionMode(mode: "explore" | "guide") {
    const modeChanged = interactionMode !== mode;
    interactionMode = mode;
    if (mode === "guide" && modeChanged) {
        selectGuideFeatures();
        reachedGuideFeatures.clear();
    } else if (mode === "explore") {
        guideFeatures = [];
    }
    guideTargetLocked = false;
    targetStatus.textContent = "";
    activeFeature = null;

    guideArrow.style.display = mode === "guide" ? "block" : "none";
    guideFeatureSelector.classList.toggle("visible", mode === "guide");
    guideModeButton.classList.toggle("active", mode === "guide");
    exploreModeButton.classList.toggle("active", mode === "explore");
    updateGuideFeatureList();
    hideInfo();
}

guideModeButton.addEventListener("click", () => {
    setInteractionMode("guide");
});

exploreModeButton.addEventListener("click", () => {
    setInteractionMode("explore");
});

const featureDataCache = new Map<string, FeatureData[]>();
let themesById = new Map<string, ThemeDefinition>();
let activeThemeId: string | null = null;

async function switchTheme(theme: ThemeDefinition) {
    themeSelector.disabled = true;
    targetStatus.textContent = `Loading ${theme.name}...`;

    try {
        const sourceFile = theme.file ?? "./craters.json";
        let sourceData = featureDataCache.get(sourceFile);
        if (!sourceData) {
            sourceData = await loadFeatureData(sourceFile);
            featureDataCache.set(sourceFile, sourceData);
        }

        features = filterFeatureData(sourceData, theme.filter).map(createFeature);
        activeThemeId = theme.id;
        if (interactionMode === "guide") {
            selectGuideFeatures();
        } else {
            guideFeatures = [];
        }
        guideTargetLocked = false;
        reachedGuideFeatures.clear();
        activeFeature = null;
        reticle.classList.remove("active", "locked");
        reticle.style.opacity = "0.5";
        reticle.style.transform = "scale(1)";
        hideInfo();

        clearSurfaceGuide();
        createSurfaceGuide();
        surfaceGuide.setEnabled(surfaceGuideVisible);
        updateGuideFeatureList();
    } finally {
        themeSelector.disabled = false;
    }
}

async function initializeThemes() {
    const themes = validateThemes(await loadJson("./themes.json"));
    if (themes.length === 0) {
        throw new Error("Theme data must contain at least one theme.");
    }

    themesById = new Map(themes.map((theme) => [theme.id, theme]));
    themeSelector.replaceChildren();
    for (const theme of themes) {
        const option = document.createElement("option");
        option.value = theme.id;
        option.textContent = theme.name;
        themeSelector.appendChild(option);
    }

    themeSelector.disabled = false;
    await switchTheme(themes[0]);
}

themeSelector.addEventListener("change", () => {
    const theme = themesById.get(themeSelector.value);
    if (!theme) {
        return;
    }

    void switchTheme(theme).catch((error: unknown) => {
        console.error("Theme could not be loaded.", error);
        targetStatus.textContent = "Theme could not be loaded.";
        if (activeThemeId) {
            themeSelector.value = activeThemeId;
        }
    });
});

void initializeThemes().catch((error: unknown) => {
    console.error("Themes could not be loaded.", error);
    targetStatus.textContent = "Themes could not be loaded.";
});

async function initializeMares() {
    try {
        const mareDataList = await loadMareData();
        mares = mareDataList.map((data) => ({
            ...data,
            worldPosition: latLonToWorld(planetRadius + 0.5, data.latitude, data.longitude)
        }));
    } catch (error: unknown) {
        console.error("Mares could not be loaded.", error);
    }
}

void initializeMares();

showMareToggle.addEventListener("change", () => {
    showMaresEnabled = showMareToggle.checked;
});

window.addEventListener("keydown", (event) => {
    if (event.code === "KeyG") {
        surfaceGuideVisible = !surfaceGuideVisible;
        surfaceGuide.setEnabled(surfaceGuideVisible);
    }
});

function showInfo(feature: PlanetFeature) {
    infoTitle.textContent = feature.name;
    infoText.textContent = feature.description;
    infoLatitude.textContent = `Latitude: ${formatCoordinate(feature.latitude, "N", "S")}`;
    infoLongitude.textContent = `Longitude: ${formatCoordinate(feature.longitude, "W", "E")}`;
    infoDiameter.textContent = `Diameter: ${feature.diameterKm} km`;
    infoDepth.textContent = `Depth: ${feature.depthKm} km`;
    infoAge.textContent = `Age: ${feature.ageGa} billion years`;
    infoPanel.classList.add("visible");
}

function formatCoordinate(value: number, positiveDirection: string, negativeDirection: string): string {
    const direction = value < 0 ? negativeDirection : positiveDirection;
    return `${Math.abs(value).toFixed(1)}° ${direction}`;
}

function hideInfo() {
    infoTitle.textContent = "Crater";
    targetStatus.textContent = "";
    infoText.textContent = "Aim at craters to inspect.";
    infoLatitude.textContent = "Latitude : --";
    infoLongitude.textContent = "Longitude : --";
    infoDiameter.textContent = "Diameter : -- km";
    infoDepth.textContent = "Depth : -- km";
    infoAge.textContent = "Age : -- billion years";
}

function updateCraterLabel(feature: PlanetFeature | null) {
    if (!craterLabel) {
        return;
    }

    if (!feature) {
        craterLabel.style.display = "none";
        return;
    }

    const labelWorldPos = feature.worldPosition
        .clone()
        .normalize()
        .scale(planetRadius + craterLabelSurfaceOffset);

    const viewport = camera.viewport.toGlobal(
        engine.getRenderWidth(),
        engine.getRenderHeight()
    );

    const projected = BABYLON.Vector3.Project(
        labelWorldPos,
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
        viewport
    );

    const cameraForward = camera.getTarget().subtract(camera.position).normalize();
    const toLabel = labelWorldPos.subtract(camera.position).normalize();
    const inFront = BABYLON.Vector3.Dot(cameraForward, toLabel) > 0;

    if (!inFront || projected.z < 0 || projected.z > 1) {
        craterLabel.style.display = "none";
        return;
    }

    craterLabel.textContent = feature.name;
    craterLabel.style.left = `${projected.x}px`;
    craterLabel.style.top = `${projected.y}px`;
    craterLabel.style.display = "block";
}

function updateGuideArrow(feature: PlanetFeature | null) {
    if (interactionMode !== "guide" || !feature || guideTargetLocked) {
        guideArrow.style.display = "none";
        return;
    }

    const viewport = camera.viewport.toGlobal(
        engine.getRenderWidth(),
        engine.getRenderHeight()
    );
    const projected = BABYLON.Vector3.Project(
        feature.worldPosition,
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
        viewport
    );
    const reticleCenterX = engine.getRenderWidth() * 0.6;
    const reticleCenterY = engine.getRenderHeight() * 0.5;
    const directionX = projected.x - reticleCenterX;
    const directionY = projected.y - reticleCenterY;
    const directionLength = Math.hypot(directionX, directionY);

    if (directionLength < 1) {
        guideArrow.style.display = "none";
        return;
    }

    const offset = 84;
    const arrowX = reticleCenterX + (directionX / directionLength) * offset;
    const arrowY = reticleCenterY + (directionY / directionLength) * offset;
    const angle = Math.atan2(directionY, directionX) * 180 / Math.PI;

    guideArrow.style.left = `${arrowX}px`;
    guideArrow.style.top = `${arrowY}px`;
    guideArrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    guideArrow.style.display = "block";
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
        if (interactionMode === "guide" && feature !== getGuideFeature()) {
            continue;
        }

        const toFeature = feature.worldPosition.subtract(camera.position);
        const d = toFeature.length();
        const cameraForward = camera.getTarget().subtract(camera.position).normalize();
        const viewFactor = BABYLON.Vector3.Dot(cameraForward, toFeature.normalize());

        // Reliable visibility check: feature must be in front of the camera and within range.
        const inRange = d < featureTriggerDistance && viewFactor > 0.99;
        const centered = viewFactor > 0.995 && d < featureTriggerDistance * 0.5;

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
        targetStatus.textContent = isTargetLocked ? "" : "Move Closer";
        activeFeature = nearestFeature;

        if (interactionMode === "guide" && isTargetLocked && !guideTargetLocked) {
            guideTargetLocked = true;
            reachedGuideFeatures.add(guideFeatureIndex);
            updateGuideFeatureList();
        }
    } else {
        reticle.classList.remove("active");
        reticle.classList.remove("locked");
        reticle.style.opacity = "0.5";
        reticle.style.transform = "scale(1)";

        if (interactionMode === "guide" && getGuideFeature()) {
            targetStatus.textContent = guideTargetLocked ? "" : "Move Closer";
            activeFeature = null;
        } else {
            hideInfo();
            activeFeature = null;
        }
    }
}

function updateReticleCoordinates() {
    const pick = scene.pick(
        engine.getRenderWidth() * 0.6,
        engine.getRenderHeight() * 0.5,
        (mesh) => mesh === planet
    );

    if (pick?.hit && pick.pickedPoint) {
        const coords = worldToLatLon(planetRadius, pick.pickedPoint);
        reticleLatitude.textContent = `Latitude: ${formatCoordinate(coords.latitude, "N", "S")}`;
        reticleLongitude.textContent = `Longitude: ${formatCoordinate(coords.longitude, "W", "E")}`;
    } else {
        reticleLatitude.textContent = "Latitude: --";
        reticleLongitude.textContent = "Longitude: --";
    }
}

// Main loop
scene.onBeforeRenderObservable.add(() => {
    updateMovement();
    updateSurfaceCamera();
    updateFeatureDetection();
    updateCraterLabel(activeFeature);
    updateGuideArrow(getGuideFeature());
    updateMareLabels();
    updateReticleCoordinates();
});

engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener("resize", () => {
    engine.resize();
});