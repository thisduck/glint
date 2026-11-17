const {ipcRenderer}=require("electron");
window.addEventListener("DOMContentLoaded",()=>{
  const bubble=document.querySelector("main");
  bubble.onpointerdown=e=>{
    if(e.button!==0)return;
    bubble.setPointerCapture(e.pointerId);
    ipcRenderer.send("desktopCameraDrag",e.target.closest("button")?"resize":"move");
  };
  bubble.onpointermove=e=>{if(bubble.hasPointerCapture(e.pointerId))ipcRenderer.send("desktopCameraDrag","drag");};
  bubble.onlostpointercapture=()=>ipcRenderer.send("desktopCameraDrag","end");
  ipcRenderer.on("portrait",(_,frame)=>document.querySelector("img").src=frame);
});
