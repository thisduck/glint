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

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !setup.hidden) {
      event.preventDefault();
      ipcRenderer.send("toolbarCommand", "cancel");
    }
  });

  let current = { x: 1, y: 1 };
  scale.oninput = () => {
    paint({ ...current, scale: Number(scale.value) / 100 });
    ipcRenderer.send("toolbarCommand", "scale", current.scale);
  };

  ipcRenderer.on("portrait", (_, frame) => {
    dot.style.backgroundImage = "url(" + frame + ")";
  });

  function paint(point) {
    current = point;
    const ratio = point.scale ?? 0.23;
    const size = Math.max(5, map.clientHeight * ratio);
    dot.style.width = dot.style.height = size + "px";
    dot.style.left = point.x * (map.clientWidth - size) + "px";
    dot.style.top = point.y * (map.clientHeight - size) + "px";
    scale.value = String(Math.round(ratio * 100));
    const percent = scale.value + "%";
    sizeLabel.textContent = percent;
    scale.setAttribute("aria-valuetext", percent);

    const vertical = point.y < 1 / 3 ? "top" : point.y > 2 / 3 ? "bottom" : "middle";
    const horizontal = point.x < 1 / 3 ? "left" : point.x > 2 / 3 ? "right" : "center";
    map.setAttribute("aria-label", "Camera position, " + vertical + " " + horizontal);
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
      (event.clientX - bounds.left - map.clientLeft - radius) / (map.clientWidth - radius * 2),
      (event.clientY - bounds.top - map.clientTop - radius) / (map.clientHeight - radius * 2),
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

  function toggleLabel(button, name, enabled) {
    button.textContent = name + (enabled ? " on" : " off");
    button.setAttribute("aria-pressed", String(Boolean(enabled)));
  }

  ipcRenderer.on("toolbarState", (_, state) => {
    const preview = state.phase === "preview";
    setup.hidden = !preview;
    transport.hidden = restoreHelp.hidden = preview;
    document.body.classList.toggle("preview", preview);
    if (preview) {
      source.textContent = state.sourceName || "";
      source.title = source.textContent;
      start.disabled = mic.disabled = cameraToggle.disabled = Boolean(state.busy);
      start.textContent = state.busy ? "Please wait…" : "Start recording";
      toggleLabel(mic, "Microphone", state.micOn);
      toggleLabel(cameraToggle, "Camera", state.cameraOn);
    }
    camera.hidden = cameraHelp.hidden = !state.position;
    cameraHelp.textContent = preview
      ? "Drag the camera on screen to move it, or use the position control."
      : "Drag the position control or move it with the arrow keys.";
    if (state.position) paint(state.position);
    if (preview) return;
    clock.textContent = state.clock;
    const label = state.paused ? "Paused" : "Recording";
    if (status.textContent !== label) status.textContent = label;
    pause.textContent = state.paused ? "Resume" : "Pause";
    document.body.classList.toggle("paused", state.paused);
  });
});
