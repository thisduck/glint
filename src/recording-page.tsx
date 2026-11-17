import React, {useState, useEffect} from "react";
import {ArrowLeft, Check, Copy, HardDrive, Cloud} from "lucide-react";

const api = window.desk;
export function RecordingPage({video,profile,onOpen,onBack,refresh}) {
  const [details,setDetails] = useState(null);
  const [issue,setIssue] = useState("");
  const [lookupError,setLookupError] = useState("");
  const [checking,checkAgain] = useState(0);
  const [busy,setBusy] = useState("");
  const [start,setStart] = useState("0");
  const [end,setEnd] = useState(video.durationMs ? String(video.durationMs/1000) : "");
  const [editing,setEditing] = useState(false);
  const [title,setTitle] = useState("");
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
      {editing ? <form className="mt-2 flex flex-wrap gap-2" onSubmit={e => {
        e.preventDefault(); run("Rename",async()=>{await api.renameRecording(video.id,title);await refresh();setEditing(false);});
      }}><input aria-label="Title in glint" placeholder="Recording title" autoFocus maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/><button disabled={!!busy || !title.trim()}>Save title</button><button type="button" onClick={()=>setEditing(false)}>Cancel</button></form> :
      <div className="mt-1 flex items-center gap-3"><h2 className="break-words text-3xl font-medium tracking-tight">{video.title || "Recording saved"}</h2><button className="quiet" onClick={()=>{setTitle(video.title || "");setEditing(true);}}>{video.title ? "Edit title" : "Add title"}</button></div>}
      {video.durationMs > 0 && <p className="mt-1 text-sm text-muted">{Math.floor(video.durationMs/60000)}m {Math.floor(video.durationMs/1000)%60}s</p>}
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
    <details className="destination p-4">
      <summary className="cursor-pointer font-medium">Trim recording</summary>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={e => {
        e.preventDefault();
        run("Trim",async()=>{const id=await api.trimRecording(video.id,Number(start),Number(end)); await refresh(); onOpen(id);});
      }}>
        <label>Start (seconds)<input className="mt-1 block w-28" required type="number" min="0" step="any" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label>End (seconds)<input className="mt-1 block w-28" required type="number" min="0" step="any" value={end} onChange={e=>setEnd(e.target.value)}/></label>
        <button disabled={!!busy || Number(end)<=Number(start)}>{busy === "Trim" ? "Creating copy…" : "Save trimmed copy"}</button>
      </form>
      <p className="mt-2 text-sm text-muted">Saves a new local recording in {profile.name}.</p>
    </details>
    {(issue || video.uploadError || lookupError) && <p role="alert" className="mt-3">{issue || video.uploadError || lookupError}</p>}
  </section>;
}
