const path=require("node:path");
const execFile=require("node:util").promisify(require("node:child_process").execFile);
async function captureBounds(source,displays,readWindow=async id=>{
  const {stdout}=await execFile(path.join(__dirname,"..","dist","window-bounds"),[id],{timeout:3000});
  return JSON.parse(stdout);
}){
  if(source?.id.startsWith("screen:")){
    const display=displays.find(d=>String(d.id)===(source.display_id || source.id.split(":")[1]));
    if(display)return display.bounds;
  }
  const match=/^window:(\d+):/.exec(source?.id || "");
  if(match){
    try {
      const bounds=await readWindow(match[1]);
      if([bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite) && bounds.width>0 && bounds.height>0)return bounds;
    } catch {}
  }
  throw Error("The capture source could not be located. Choose the screen or window again.");
}

function countdownBounds(target,displays){
  // If a window straddles displays, put the countdown on its largest visible portion.
  const intersections=displays.map(({bounds:b})=>{
    const x=Math.max(b.x,target.x),y=Math.max(b.y,target.y);
    return {x,y,width:Math.min(b.x+b.width,target.x+target.width)-x,height:Math.min(b.y+b.height,target.y+target.height)-y};
  }).filter(r=>r.width>0 && r.height>0).sort((a,b)=>b.width*b.height-a.width*a.height);
  const r=intersections[0];
  if(!r)throw Error("Bring the selected capture source onto a visible screen and try again.");
  const width=Math.min(158,r.width),height=Math.min(132,r.height);
  return {width,height,x:Math.round(r.x+(r.width-width)/2),y:Math.round(r.y+(r.height-height)/2)};
}
module.exports={captureBounds,countdownBounds};
