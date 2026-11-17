import React, {useState, useEffect} from "react";
import {ArrowLeft, Check, Copy, HardDrive, Cloud} from "lucide-react";

const api = window.desk;
export function RecordingPage({video,profile,onBack,refresh}) {
  const [details,setDetails] = useState(null);
  const [issue,setIssue] = useState("");
  const [lookupError,setLookupError] = useState("");
  const [checking,checkAgain] = useState(0);
  const [busy,setBusy] = useState("");
  const [copied,setCopied] = useState(false);
  useEffect(() => {
    if (!video.remote) return;
    let active = true, timer;
    let attempts = 0;
    async function check() {
      try {
        const info = await api.driveDetails(video.id);
        if (!active) return;
        setDetails(info);
        setLookupError("");
        if (!info.metadata && ++attempts < 12) timer = setTimeout(check,15000);
      } catch(error) {
        if (active) setLookupError(error.message);
      }
    }
    check();
    return () => {active=false;clearTimeout(timer);};
  },[video.remote,video.uploadState,checking]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false),2500);
    return () => clearTimeout(timer);
  },[copied]);
  async function run(label,fn) {
    setBusy(label);
    setIssue("");
    try {await fn();}
    catch(e) {setIssue(e.message);}
    finally {setBusy("");}
  }
  const pending = video.uploadState === "pending";
  const uploading = busy === "Upload" || pending;
  const failed = video.uploadState === "failed";
  const cloudStatus = video.remote ? "Uploaded" : uploading ? "Uploading…" : failed ? "Upload failed" : "Local copy only";
  return <section className="mt-6">
    <button className="quiet inline-flex items-center gap-2" onClick={onBack}><ArrowLeft size={15}/> Recording studio</button>
    <header className="my-5">
      <p className="text-sm text-muted">{profile.name} · {new Date(video.created).toLocaleString()}</p>
      <h2 className="mt-1 text-3xl font-medium tracking-tight">Recording saved</h2>
    </header>
    <video controls playsInline preload="metadata" aria-label="Local recording" src={"clip://library/"+video.id} className="aspect-video max-h-[48vh] w-full rounded-xl bg-deep"/>
    <div className="my-4 flex flex-wrap items-center gap-2">
      {video.remote && <button className="inline-flex items-center gap-2 bg-accent px-4 font-semibold text-white" disabled={!!busy} onClick={() => run("Copy",async()=>{await api.share(video.id,true);setCopied(true);})}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? "Copied" : "Copy link"}</button>}
      <button onClick={() => run("Finder",()=>api.reveal(video.id))}>Show in Finder</button>
      {video.remote && <button onClick={() => run("Drive",()=>api.share(video.id,false))}>Open in Drive</button>}
      {(!video.remote || failed) && (profile.folder || video.folder) && <button disabled={!!busy || pending} onClick={() => run("Upload",async()=>{try {await api.upload(video.id);} finally {await refresh();}})}>{uploading ? "Working…" : video.remote ? "Retry sharing" : failed ? "Retry upload" : "Upload to Drive"}</button>}
    </div>
    <dl className="destination divide-y divide-line px-5" aria-live="polite">
      <div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2"><HardDrive size={16}/> Local copy</dt><dd>Saved on this Mac</dd></div>
      <div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2"><Cloud size={16}/> Google Drive</dt><dd>{cloudStatus}</dd></div>
      {video.remote && <>
        <div className="flex justify-between gap-4 py-3"><dt>Link access</dt><dd>{pending ? "Applying sharing…" : lookupError ? "Access unavailable" : details?.access || "Checking…"}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt>Drive playback</dt><dd>{details?.metadata ? "Video metadata available" : "Readiness unconfirmed"}</dd></div>
      </>}
    </dl>
    {video.remote && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted"><p>Open in Drive to check playback.</p><button className="quiet" onClick={()=>checkAgain(n=>n+1)}>Refresh status</button></div>}
    {(issue || video.uploadError || lookupError) && <p role="alert" className="mt-3">{issue || video.uploadError || lookupError}</p>}
  </section>;
}
