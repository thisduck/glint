import React, { useEffect, useRef, useState } from "react";
import { Film } from "lucide-react";

export function RecordingThumbnail({video}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready,setReady] = useState(false);
  useEffect(() => {
    const target = canvas.current;
    const media = document.createElement("video");
    media.muted = true;
    const release = () => {
      media.onloadeddata = null;
      media.removeAttribute("src");
      media.load();
    };
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      observer.disconnect();
      media.onloadeddata = () => {
        if (media.videoWidth && target) {
          target.width = 288;
          target.height = Math.round(288 * media.videoHeight / media.videoWidth);
          target.getContext("2d")?.drawImage(media,0,0,target.width,target.height);
          setReady(true);
        }
        release();
      };
      media.src = "clip://library/" + video.id;
    },{rootMargin:"150px"});
    observer.observe(target);
    return () => { observer.disconnect(); release(); };
  },[video.id]);
  const seconds = Math.floor(video.durationMs/1000);
  return <span className="relative block aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-deep sm:w-32">
    {!ready && <Film aria-hidden="true" className="absolute inset-0 m-auto size-5 text-white/60"/>}
    <canvas ref={canvas} aria-hidden="true" className="relative h-full w-full object-cover"/>
    {video.durationMs > 0 && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[11px] font-medium tabular-nums text-white">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</span>}
  </span>;
}
