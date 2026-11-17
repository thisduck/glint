const {captureBounds}=require("./capture-bounds.cjs");
const {captureOutline}=require("./capture-outline.cjs");
const {recordingToolbar}=require("./toolbar.cjs");
const {screen}=require("electron");

// All overlays in this session are dismissed together before the countdown.
function prepareSource(target, settings, send, onLost) {
  let outline, toolbar, followTimer, closed=false, state={...settings};
  function publish(){toolbar?.update({phase:"preview",sourceName:target.name,...state,position:state.cameraOn?state.position:null});}
  function close(){
    closed=true;
    clearTimeout(followTimer);
    if(outline && !outline.isDestroyed())outline.destroy();
    toolbar?.close();
  }
  const ready=(async()=>{
    const readBounds=()=>captureBounds(target,screen.getAllDisplays());
    let area=await readBounds();
    if(closed)return;
    outline=await captureOutline(area);
    if(closed){outline.destroy();return;}
    toolbar=recordingToolbar({
      phase:"preview",captureArea:area,initialPosition:state.position,
      portraitOptions:{desktop:true,area,request:()=>send("portraitRequest")},
      position:point=>{
        state.position={...state.position,...point};publish();
        send("cameraPosition",state.position);
      },
      ...Object.fromEntries(["start","cancel","toggleCamera","toggleMic"].map(action=>[action,()=>{
        if(closed || (state.busy && action!=="cancel"))return;
        if(action!=="cancel"){state.busy=true;publish();}
        send("setupCommand",action);
      }])),
    });
    publish();
    await toolbar.ready;
    if(closed)return;
    toolbar.show();
    if(target.id.startsWith("window:")){
      async function follow(){
        try {
          const next=await readBounds();
          if(closed)return;
          if(["x","y","width","height"].some(k=>next[k]!==area[k])){
            area=next;outline.setBounds(next);toolbar.setArea(next);
          }
          followTimer=setTimeout(follow,1000);
        } catch {if(!closed)onLost();}
      }
      followTimer=setTimeout(follow,1000);
    }
  })();
  return {ready,close,portrait(frame){toolbar?.portrait(frame);},update(changes){state={...state,...changes};publish();}};
}
module.exports={prepareSource};
