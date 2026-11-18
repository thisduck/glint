// Position is normalized across the travel available to the circular inset.
export function bubbleBounds(width, height, position) {
  const size =
      Math.min(width, height) *
      Math.min(0.48, Math.max(0.1, position.scale ?? 0.23)),
    pad = Math.min(width, height) * 0.025;
  return {
    size,
    x: pad + (width - size - 2 * pad) * position.x,
    y: pad + (height - size - 2 * pad) * position.y,
  };
}

// The compositor owns the webcam for this preview. The caller owns the screen stream.
export async function cameraComposition(display, webcam, position, onEnded) {
  const screen = document.createElement("video"),
    camera = document.createElement("video"),
    canvas = document.createElement("canvas");
  let timer,
    output,
    available = true;
  function close() {
    clearInterval(timer);
    for (const t of webcam.getTracks()) {
      t.onended = null;
      t.stop();
    }
    output?.getTracks().forEach((t) => t.stop());
    screen.srcObject = null;
    camera.srcObject = null;
  }
  try {
    screen.muted = camera.muted = true;
    screen.srcObject = display;
    camera.srcObject = webcam;
    await Promise.all([screen.play(), camera.play()]);
    canvas.width = screen.videoWidth;
    canvas.height = screen.videoHeight;
    if (!canvas.width || !canvas.height)
      throw Error("The screen preview has no frames.");
    const ctx = canvas.getContext("2d", { alpha: false });
    function draw() {
      if (screen.readyState < 2) return;
      ctx.drawImage(screen, 0, 0, canvas.width, canvas.height);
      if (!available || camera.readyState < 2) return;
      const { size, x, y } = bubbleBounds(
        canvas.width,
        canvas.height,
        position.current,
      );
      const crop = Math.min(camera.videoWidth, camera.videoHeight);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, 2 * Math.PI);
      ctx.clip();
      ctx.drawImage(
        camera,
        (camera.videoWidth - crop) / 2,
        (camera.videoHeight - crop) / 2,
        crop,
        crop,
        x,
        y,
        size,
        size,
      );
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, size / 64);
      ctx.stroke();
      ctx.restore();
    }
    webcam.getVideoTracks()[0].onended = () => {
      available = false;
      onEnded();
    };
    draw();
    output = canvas.captureStream(30);
    timer = setInterval(draw, 1000 / 30);
    const preview = document.createElement("canvas");
    // The desktop overlay has its own preview budget. The recording uses the original camera frames.
    const previewContext = preview.getContext("2d");
    function portrait() {
      if (!available || camera.readyState < 2) return null;
      const crop = Math.min(camera.videoWidth, camera.videoHeight);
      const diameter = Math.round(Math.min(canvas.width, canvas.height) * (position.current.scale ?? 0.23));
      const size = Math.max(1, Math.min(640, crop, diameter));
      if (preview.width !== size || preview.height !== size)
        preview.width = preview.height = size;
      previewContext.drawImage(
        camera,
        (camera.videoWidth - crop) / 2,
        (camera.videoHeight - crop) / 2,
        crop,
        crop,
        0,
        0,
        size,
        size,
      );
      return preview.toDataURL("image/jpeg", 0.86);
    }
    return { stream: output, close, portrait };
  } catch (error) {
    close();
    throw error;
  }
}
