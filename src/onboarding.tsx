import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  Cloud,
  Mic,
  MonitorUp,
  RotateCw,
  Settings,
  Volume2,
} from "lucide-react";
import { Logo } from "./logo";
import { SetupSwitch } from "./components/ui/setup-switch";

const api = window.desk;
export const onboardedKey = "glint.onboarded";

type Access = "granted" | "denied" | "restricted" | "not-determined" | "unknown";
type Kind = "screen" | "microphone" | "camera";

const permissions: { kind: Kind; icon: React.ElementType; title: string; why: string; required?: boolean }[] = [
  { kind: "screen", icon: MonitorUp, title: "Screen Recording", why: "Capture your screen or a single app window.", required: true },
  { kind: "microphone", icon: Mic, title: "Microphone", why: "Record your voice over the video." },
  { kind: "camera", icon: Camera, title: "Camera", why: "Show yourself in the camera bubble." },
];

const steps = ["Welcome", "Access", "Defaults"];

export function Onboarding({ profile, refreshProfile, onDone }) {
  const [step, setStep] = useState(0);
  const finish = () => {
    localStorage.setItem(onboardedKey, "1");
    onDone();
  };
  return (
    <section aria-labelledby="onboarding-title" className="onboarding">
      <ol className="onboarding-steps" aria-label="Setup progress">
        {steps.map((name, i) => (
          <li key={name} aria-current={i === step ? "step" : undefined} data-done={i < step || undefined}>
            <span aria-hidden="true">{i < step ? <Check className="size-3" /> : i + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      <div className="onboarding-card">
        {step === 0 && <Welcome onNext={() => setStep(1)} onSkip={finish} />}
        {step === 1 && <Access onBack={() => setStep(0)} onNext={() => setStep(2)} />}
        {step === 2 && (
          <Defaults profile={profile} refreshProfile={refreshProfile} onBack={() => setStep(1)} onDone={finish} />
        )}
      </div>
    </section>
  );
}

function Welcome({ onNext, onSkip }) {
  return (
    <div className="onboarding-welcome">
      <div className="onboarding-hero" aria-hidden="true">
        <Logo />
      </div>
      <h2 id="onboarding-title" className="onboarding-title">Welcome to glint</h2>
      <p className="onboarding-lede">
        Record your screen, camera and voice from the menu bar, then share it from Google Drive. Setup takes about a minute.
      </p>
      <div className="onboarding-actions justify-center">
        <button type="button" className="studio-primary" onClick={onNext} autoFocus>
          Get started <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="onboarding-skip" onClick={onSkip}>
        I’ve used glint before, skip setup
      </button>
    </div>
  );
}

function Access({ onBack, onNext }) {
  const [access, setAccess] = useState<Record<Kind, Access> | null>(null);
  const [asking, setAsking] = useState<Kind | null>(null);
  const [askedScreen, setAskedScreen] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(() => api.permissions().then(setAccess).catch((e) => setError(e.message)), []);
  useEffect(() => {
    refresh();
    // People often flip a switch in System Settings and come back.
    const timer = setInterval(refresh, 1500);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  async function allow(kind: Kind) {
    setError("");
    setAsking(kind);
    try {
      if (kind === "screen") setAskedScreen(true);
      await api.requestPermission(kind);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setAsking(null);
    }
  }
  const screenReady = access?.screen === "granted";
  return (
    <div>
      <h2 id="onboarding-title" className="onboarding-title">Allow access</h2>
      <p className="onboarding-lede">
        macOS asks once for each. Choose <b>Allow</b> to open its permission prompt.
      </p>
      <ul className="onboarding-list">
        {permissions.map(({ kind, icon: Icon, title, why, required }) => {
          const state = access?.[kind];
          const blocked = state === "denied" || state === "restricted";
          return (
            <li key={kind} className="onboarding-row">
              <span className="onboarding-icon" aria-hidden="true">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {title}
                  {required && <span className="onboarding-tag">Required</span>}
                </p>
                <p className="text-sm text-muted">
                  {blocked ? "Turned off. Switch glint on in System Settings." : why}
                </p>
              </div>
              {state === "granted" ? (
                <span className="onboarding-granted">
                  <Check className="size-4" aria-hidden="true" /> Allowed
                </span>
              ) : blocked || (kind === "screen" && askedScreen) ? (
                <button type="button" className="onboarding-action" onClick={() => api.openPrivacySettings(kind)}>
                  <Settings className="size-4" aria-hidden="true" /> Open Settings
                </button>
              ) : (
                <button
                  type="button"
                  className="onboarding-action primary"
                  disabled={!access || asking !== null}
                  aria-busy={asking === kind}
                  onClick={() => allow(kind)}
                >
                  {asking === kind ? "Waiting…" : "Allow"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {askedScreen && !screenReady && (
        <div className="onboarding-note" role="status">
          <p>
            After you turn on glint under <b>Screen &amp; System Audio Recording</b>, macOS needs glint to reopen.
          </p>
          <button type="button" className="onboarding-action" onClick={() => api.relaunch()}>
            <RotateCw className="size-4" aria-hidden="true" /> Relaunch glint
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="onboarding-actions">
        <button type="button" className="onboarding-back" onClick={onBack}>Back</button>
        <span className="flex-1" />
        {!screenReady && (
          <button type="button" className="onboarding-back" onClick={onNext}>Skip for now</button>
        )}
        <button type="button" className="studio-primary" disabled={!screenReady} onClick={onNext}>
          Continue <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Defaults({ profile, refreshProfile, onBack, onDone }) {
  const audioKey = "glint.profile." + profile.id + ".systemAudio";
  const [systemAudio, setAudio] = useState(() => localStorage.getItem(audioKey) === "true");
  const [driveReady, setDriveReady] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api.driveConfigured().then(setDriveReady).catch(() => setDriveReady(false));
    api.accounts().then((rows) => setEmail(rows.find((a) => a.id === profile.account)?.email || "")).catch(() => {});
  }, [profile.account]);
  async function save(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await fn();
      await refreshProfile();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const connected = Boolean(profile.account && profile.folder);
  return (
    <div>
      <h2 id="onboarding-title" className="onboarding-title">Recording defaults</h2>
      <p className="onboarding-lede">
        For your <b>{profile.name}</b> profile. You can change these any time, and each profile keeps its own.
      </p>
      <ul className="onboarding-list">
        <li className="onboarding-row">
          <span className="onboarding-icon" aria-hidden="true"><Mic className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Microphone</p>
            <p className="text-sm text-muted">Narrate as you record.</p>
          </div>
          <SetupSwitch
            label="Microphone"
            checked={Boolean(profile.micEnabled)}
            disabled={!!busy}
            onChange={(on) => save("mic", () => api.setMicrophone(profile.id, profile.microphoneId || "default", on))}
          />
        </li>
        <li className="onboarding-row">
          <span className="onboarding-icon" aria-hidden="true"><Camera className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Camera bubble</p>
            <p className="text-sm text-muted">Put your face in the corner of the video.</p>
          </div>
          <SetupSwitch
            label="Camera bubble"
            checked={Boolean(profile.cameraEnabled)}
            disabled={!!busy}
            onChange={(on) => save("camera", () => api.setCaptureOption(profile.id, "cameraEnabled", on))}
          />
        </li>
        <li className="onboarding-row">
          <span className="onboarding-icon" aria-hidden="true"><Volume2 className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">System audio</p>
            <p className="text-sm text-muted">Include sound playing on your Mac.</p>
          </div>
          <SetupSwitch
            label="System audio"
            checked={systemAudio}
            disabled={!!busy}
            onChange={(on) => {
              localStorage.setItem(audioKey, String(on));
              setAudio(on);
            }}
          />
        </li>
        {driveReady && (
          <li className="onboarding-row">
            <span className="onboarding-icon" aria-hidden="true"><Cloud className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Google Drive <span className="onboarding-tag muted">Optional</span></p>
              <p className="truncate text-sm text-muted">
                {connected
                  ? `Saving to ${profile.folderName || "your glint folder"}${email ? " in " + email : ""}.`
                  : "Upload recordings automatically and share them with a link."}
              </p>
            </div>
            {connected ? (
              <span className="onboarding-granted"><Check className="size-4" aria-hidden="true" /> Connected</span>
            ) : (
              <button
                type="button"
                className="onboarding-action"
                disabled={!!busy}
                aria-busy={busy === "drive"}
                onClick={() =>
                  save("drive", async () => {
                    const id = await api.connect();
                    await api.recordingsFolder(profile.id, id);
                  })
                }
              >
                {busy === "drive" ? "Connecting…" : "Connect"}
              </button>
            )}
          </li>
        )}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="onboarding-actions">
        <button type="button" className="onboarding-back" onClick={onBack}>Back</button>
        <span className="flex-1" />
        <button type="button" className="studio-primary" disabled={!!busy} onClick={onDone}>
          Start recording <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
