const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  for (const button of document.querySelectorAll("[data-command]"))
    button.onclick = () =>
      ipcRenderer.send("toolbarCommand", button.dataset.command);

  const camera = document.querySelector(".camera");
  const cameraHelp = document.querySelector("#camera-help");
  const map = document.querySelector("#position");
  const dot = map.querySelector("b");
  const scale = document.querySelector("#scale");
  const sizeLabel = document.querySelector("output");
  const status = document.querySelector("#status");
  const clock = document.querySelector("time");
  const pause = document.querySelector("#pause span");
  const setup = document.querySelector("#preview-controls");
  const transport = document.querySelector("#recording-controls");
  const restoreHelp = document.querySelector("#restore-help");
  const source = document.querySelector("#source-name");
  const start = document.querySelector("#start");
  const mic = document.querySelector("#mic");
  const cameraToggle = document.querySelector("#camera-toggle");

  const toolsButtons = document.querySelectorAll(".tools");
  const pauseButton = document.querySelector("#pause");
  const systemAudio = document.querySelector("#system-audio");
  let toolsOpen = false;
  let hasPosition = false;
  function syncTools() {
    camera.hidden = cameraHelp.hidden = !(hasPosition && toolsOpen);
    for (const button of toolsButtons) {
      button.hidden = !hasPosition;
      button.setAttribute("aria-expanded", String(toolsOpen && hasPosition));
      const label = (toolsOpen ? "Hide" : "Show") + " camera position and size";
      button.title = label;
      button.setAttribute("aria-label", label);
    }
  }
  for (const button of toolsButtons)
    button.onclick = () => {
      toolsOpen = !toolsOpen;
      syncTools();
      ipcRenderer.send("toolbarCommand", "cameraTools", toolsOpen);
    };

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !setup.hidden) {
      event.preventDefault();
      ipcRenderer.send("toolbarCommand", "cancel");
    }
  });

  let current = { x: 1, y: 1 };
  let frameSize;
  // Continuous input: datalist ticks (15/23/36) are passive hints only, so
  // arrow keys step freely and never get trapped at a stop.
  scale.oninput = () => {
    const value = Number(scale.value);
    paint({ ...current, scale: value / 100 });
    ipcRenderer.send("toolbarCommand", "scale", current.scale);
  };

  ipcRenderer.on("portrait", (_, frame) => {
    dot.style.backgroundImage = "url(" + frame + ")";
  });

  function paint(point) {
    current = point;
    const ratio = point.scale ?? 0.23;
    const size = Math.min(map.clientWidth, map.clientHeight) * ratio;
    dot.style.width = dot.style.height = size + "px";
    dot.style.left = point.x * (map.clientWidth - size) + "px";
    dot.style.top = point.y * (map.clientHeight - size) + "px";
    scale.value = String(Math.round(ratio * 100));
    const value = Number(scale.value);
    const name = value <= 19 ? "Small" : value <= 29 ? "Medium" : "Large";
    const pixels = Math.round(Math.min(frameSize?.width, frameSize?.height) * ratio);
    const inVideo = pixels ? "≈ " + pixels + " px in video" : value + "%";
    sizeLabel.textContent = name[0] + " · " + inVideo;
    scale.setAttribute("aria-valuetext", name + ", " + inVideo);

    const vertical =
      point.y < 1 / 3 ? "top" : point.y > 2 / 3 ? "bottom" : "middle";
    const horizontal =
      point.x < 1 / 3 ? "left" : point.x > 2 / 3 ? "right" : "center";
    map.setAttribute(
      "aria-label",
      "Camera position, " + vertical + " " + horizontal,
    );
  }

  const clamp = (value) => Math.min(1, Math.max(0, value));
  function move(x, y) {
    const point = { ...current, x: clamp(x), y: clamp(y) };
    paint(point);
    ipcRenderer.send("toolbarCommand", "position", point);
  }

  function pointer(event) {
    const bounds = map.getBoundingClientRect();
    const radius = dot.offsetWidth / 2;
    move(
      (event.clientX - bounds.left - map.clientLeft - radius) /
        (map.clientWidth - radius * 2),
      (event.clientY - bounds.top - map.clientTop - radius) /
        (map.clientHeight - radius * 2),
    );
  }

  map.onpointerdown = (event) => {
    if (event.button !== 0) return;
    map.setPointerCapture(event.pointerId);
    pointer(event);
  };

  map.onpointermove = (event) => {
    if (map.hasPointerCapture(event.pointerId)) pointer(event);
  };

  map.onkeydown = (event) => {
    const offsets = {
      ArrowLeft: [-0.1, 0],
      ArrowRight: [0.1, 0],
      ArrowUp: [0, -0.1],
      ArrowDown: [0, 0.1],
    };
    const offset = offsets[event.key];
    if (offset) {
      event.preventDefault();
      move(current.x + offset[0], current.y + offset[1]);
    }
  };

  const icons = {
    Microphone:
      '<path d="M8 2a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V4a2 2 0 0 0-2-2zM4 7.5a4 4 0 0 0 8 0M8 11.5V14"/>',
    Camera:
      '<rect x="2" y="4.5" width="8.5" height="7" rx="1.5"/><path d="M10.5 7l3.5-2v6l-3.5-2"/>',
  };
  function toggleLabel(button, name, enabled) {
    button.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">' +
      icons[name] +
      (enabled ? "" : '<path d="M2 2l12 12"/>') +
      '</svg><span class="sr">' +
      name +
      (enabled ? " on" : " off") +
      "</span>";
    const label = name + (enabled ? " on — click to turn off" : " off — click to turn on");
    button.title = label;
    button.setAttribute("aria-label", name + (enabled ? " on" : " off"));
    button.setAttribute("aria-pressed", String(Boolean(enabled)));
  }

  ipcRenderer.on("toolbarState", (_, state) => {
    const preview = state.phase === "preview";
    setup.hidden = !preview;
    transport.hidden = restoreHelp.hidden = preview;
    document.body.classList.toggle("preview", preview);
    frameSize = state.frameSize;
    if (frameSize?.width && frameSize?.height) {
      const ratio = frameSize.width / frameSize.height;
      map.style.width = Math.min(98, 32 * ratio) + "px";
      map.style.height = Math.min(32, 98 / ratio) + "px";
    }
    if (preview) {
      const audioLabel = state.systemAudio
        ? "System sound will be recorded"
        : "System sound off — not captured for this source";
      systemAudio.className = "tip" + (state.systemAudio ? " on" : "");
      systemAudio.title = audioLabel;
      systemAudio.setAttribute("aria-label", audioLabel);
      systemAudio.innerHTML =
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z"/>' +
        (state.systemAudio
          ? '<path d="M11 5.5a3.5 3.5 0 0 1 0 5"/>'
          : '<path d="M11 6l3 4M14 6l-3 4"/>') +
        "</svg>";
      source.textContent = state.sourceName || "";
      source.title = "Recording: " + source.textContent;
      start.disabled =
        mic.disabled =
        cameraToggle.disabled =
          Boolean(state.busy);
      start.textContent = state.busy ? "…" : "Start";
      start.title = state.busy ? "Preparing…" : "Start recording";
      start.setAttribute("aria-label", start.title);
      toggleLabel(mic, "Microphone", state.micOn);
      toggleLabel(cameraToggle, "Camera", state.cameraOn);
    }
    hasPosition = Boolean(state.position);
    if (typeof state.cameraTools === "boolean") toolsOpen = state.cameraTools;
    syncTools();
    cameraHelp.textContent = preview
      ? "Drag the camera on screen to move it, or use the position control."
      : "Drag the position control or move it with the arrow keys.";
    if (state.position) paint(state.position);
    if (preview) return;
    clock.textContent = state.clock;
    const label = state.notice || (state.paused ? "Paused" : "Recording");
    if (status.textContent !== label) status.textContent = label;
    pause.textContent = state.paused ? "Resume" : "Pause";
    pauseButton.title = pause.textContent;
    pauseButton.setAttribute("aria-label", pause.textContent);
    document.body.classList.toggle("paused", state.paused);
  });
});
