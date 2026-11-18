// Keep a single output track in MediaRecorder when an input disappears.
export async function openMicrophone(
  devices,
  preferred,
  onFallback,
  onFailure,
  { context = new AudioContext(), playback } = {},
) {
  const output = context.createMediaStreamDestination();
  let active = true;
  let input, source, systemSource;
  function releaseInput() {
    source?.disconnect();
    for (const track of input?.getTracks() || []) {
      track.onended = null;
      track.stop();
    }
  }
  function close() {
    if (!active) return;
    active = false;
    releaseInput();
    systemSource?.disconnect();
    output.stream.getTracks().forEach((track) => track.stop());
    context.close().catch(() => {});
  }
  async function attach(audio) {
    const stream = await devices.getUserMedia({ audio });
    if (!active) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    releaseInput();
    input = stream;
    const track = stream.getAudioTracks()[0];
    if (track?.readyState !== "live") throw Error("Microphone unavailable.");
    source = context.createMediaStreamSource(stream);
    source.connect(output);
    track.onended = async () => {
      try {
        await attach(true);
        if (active) onFallback();
      } catch {
        if (active)
          onFailure(
            Error(
              "Recording stopped because the system microphone is unavailable.",
            ),
          );
      }
    };
  }
  try {
    await context.resume();
    if (playback) {
      systemSource = context.createMediaStreamSource(playback);
      systemSource.connect(output);
    }
    if (preferred === "default") await attach(true);
    else {
      try {
        await attach({ deviceId: { exact: preferred } });
      } catch {
        await attach(true);
        onFallback();
      }
    }
    return { track: output.stream.getAudioTracks()[0], close };
  } catch (error) {
    close();
    throw Error(
      "Could not open a microphone. Check microphone access or turn the microphone off. " +
        error.message,
    );
  }
}
