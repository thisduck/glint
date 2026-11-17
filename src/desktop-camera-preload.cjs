const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  const bubble = document.querySelector("main");
  const move = document.querySelector("#move");
  const resize = document.querySelector("#resize");
  const image = document.querySelector("img");

  bubble.onpointerdown = (event) => {
    if (event.button !== 0) return;
    bubble.setPointerCapture(event.pointerId);
    ipcRenderer.send(
      "desktopCameraDrag",
      event.target.closest("button") === resize ? "resize" : "move",
    );
  };

  bubble.onpointermove = (event) => {
    if (bubble.hasPointerCapture(event.pointerId))
      ipcRenderer.send("desktopCameraDrag", "drag");
  };
  bubble.onlostpointercapture = () =>
    ipcRenderer.send("desktopCameraDrag", "end");

  function nudge(event, action) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    ipcRenderer.send("desktopCameraDrag", action, event.key);
  }

  move.onkeydown = (event) => nudge(event, "moveKey");
  resize.onkeydown = (event) => nudge(event, "resizeKey");
  ipcRenderer.on("portrait", (_, frame) => (image.src = frame));
});
