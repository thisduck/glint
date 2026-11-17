const { ipcRenderer } = require("electron");
window.addEventListener("DOMContentLoaded", () => {
  for (const button of document.querySelectorAll("[data-command]"))
    button.onclick = () =>
      ipcRenderer.send("toolbarCommand", button.dataset.command);
  const map = document.querySelector("#position"),
    dot = map.querySelector("b");
  let current = { x: 1, y: 1 };
  const scale=document.querySelector("#scale");
  scale.oninput=()=>ipcRenderer.send("toolbarCommand","scale",Number(scale.value)/100);
  ipcRenderer.on("portrait",(_,frame)=>{dot.style.backgroundImage="url("+frame+")";});
  function paint(point) {
    current = point;
    const size=map.clientHeight*(point.scale??0.23);
    dot.style.width=dot.style.height=size+"px";
    dot.style.left = point.x * (map.clientWidth - size) + "px";
    dot.style.top = point.y * (map.clientHeight - size) + "px";
  }
  const clamp = (n) => Math.min(1, Math.max(0, n));
  function move(x, y) {
    const point = { ...current,x: clamp(x), y: clamp(y) };
    paint(point);
    ipcRenderer.send("toolbarCommand", "position", point);
  }
  function pointer(e) {
    const r = map.getBoundingClientRect();
    move((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }
  map.onpointerdown = (e) => {
    map.setPointerCapture(e.pointerId);
    pointer(e);
  };
  map.onpointermove = (e) => {
    if (map.hasPointerCapture(e.pointerId)) pointer(e);
  };
  map.onkeydown = (e) => {
    const offsets = {
      ArrowLeft: [-0.1, 0],
      ArrowRight: [0.1, 0],
      ArrowUp: [0, -0.1],
      ArrowDown: [0, 0.1],
    };
    const offset = offsets[e.key];
    if (offset) {
      e.preventDefault();
      move(current.x + offset[0], current.y + offset[1]);
    }
  };
  ipcRenderer.on("toolbarState", (_, state) => {
    scale.hidden=map.hidden = !state.position;
    if(state.position)scale.value=String(Math.round((state.position.scale??0.23)*100));
    if (state.position) paint(state.position);
    document.querySelector("time").textContent = state.clock;
    document.querySelector("#pause").textContent = state.paused
      ? "Resume"
      : "Pause";
    document.body.classList.toggle("paused", state.paused);
  });
});
