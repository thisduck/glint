// Screen and camera settings describe the inputs independently of the output encoder.
export const qualityPresets = {
  high: { longEdge: 3840, cameraWidth: 1920, cameraHeight: 1080, bitsPerPixel: 0.22 },
  balanced: { longEdge: 1920, cameraWidth: 1280, cameraHeight: 720, bitsPerPixel: 0.15 },
  compact: { longEdge: 1280, cameraWidth: 640, cameraHeight: 480, bitsPerPixel: 0.11 },
};

function valid(value) {
  return Object.hasOwn(qualityPresets, value) ? value : "high";
}

export function readCaptureQuality(storage, profileId) {
  let saved;
  try {
    saved = JSON.parse(storage.getItem("glint.profile." + profileId + ".quality"));
  } catch {}
  return { screen: valid(saved?.screen), camera: valid(saved?.camera) };
}

export function saveCaptureQuality(storage, profileId, quality) {
  storage.setItem("glint.profile." + profileId + ".quality", JSON.stringify({
    screen: valid(quality.screen),
    camera: valid(quality.camera),
  }));
}

export function screenConstraints(quality) {
  const { longEdge } = qualityPresets[valid(quality)];
  return {
    width: { ideal: longEdge, max: longEdge },
    height: { ideal: longEdge, max: longEdge },
    frameRate: { ideal: 30, max: 30 },
  };
}

export function cameraConstraints(quality) {
  const { cameraWidth, cameraHeight } = qualityPresets[valid(quality)];
  return {
    width: { ideal: cameraWidth },
    height: { ideal: cameraHeight },
    frameRate: { ideal: 30 },
  };
}

export function recorderOptions(quality, settings) {
  const preset = qualityPresets[valid(quality)];
  const pixels = (settings.width || 1920) * (settings.height || 1080);
  const fps = Math.min(30, settings.frameRate || 30);
  return {
    mimeType: "video/webm",
    videoBitsPerSecond: Math.round(Math.max(1_000_000, Math.min(60_000_000, pixels * fps * preset.bitsPerPixel))),
    audioBitsPerSecond: 160_000,
  };
}
