const {ipcRenderer}=require("electron");
window.addEventListener("DOMContentLoaded",()=>{
  for(const button of document.querySelectorAll("[data-command]"))
    button.onclick=()=>ipcRenderer.send("toolbarCommand",button.dataset.command);
  ipcRenderer.on("toolbarState",(_,state)=>{
    document.querySelector("time").textContent=state.clock;
    document.querySelector("#pause").textContent=state.paused?"Resume":"Pause";
    document.body.classList.toggle("paused",state.paused);
  });
});
