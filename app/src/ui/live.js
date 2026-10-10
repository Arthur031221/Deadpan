// Camera session: draws the mirrored preview, measures every frame, and takes
// the picture once every rule has held for a moment.
import { analyze } from "../vision.js";
import { evaluate } from "../core/geometry.js";
import { centerCrop, drawFrame, drawGuide, sizeCanvas } from "./view.js";

const median = (values) => {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};

/** Median of the last few frames, so one noisy frame does not flip a rule. */
function smooth(history) {
  const pick = (key) => median(history.map((h) => h.m[key]));
  const last = history.at(-1);
  const recent = history.slice(-3);
  const expression = {};
  for (const key of Object.keys(last.expression ?? {})) {
    expression[key] = recent.reduce((s, h) => s + (h.expression?.[key] ?? 0), 0) / recent.length;
  }
  const nulls = history.filter((h) => h.m.crownY == null).length;
  return {
    m: {
      ...last.m,
      chinY: pick("chinY"),
      crownY: nulls > history.length / 2 ? null : pick("crownY"),
      centerX: pick("centerX"),
      rollDeg: pick("rollDeg"),
      yawDeg: pick("yawDeg"),
      pitchDeg: pick("pitchDeg"),
    },
    expression,
    background: last.background,
  };
}

export function createLive({ vision, video, canvas, stage, getSpec, onUpdate, onCapture, holdMs = 1000 }) {
  let running = false;
  let session = 0;
  let stream = null;
  let history = [];
  let state = { faces: 0, m: null, result: null };
  let readySince = null;

  const aspect = () => getSpec().photo.w / getSpec().photo.h;

  async function open() {
    const mine = ++session;
    const opened = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    stream = opened;
    video.srcObject = opened;
    await video.play();
    // Closed while the camera was still starting: leave it off.
    if (mine !== session) return opened.getTracks().forEach((track) => track.stop());
    running = true;
    draw();
    measure();
  }

  function close() {
    session++;
    running = false;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    history = [];
    readySince = null;
    stage.style.setProperty("--hold", 0);
    stage.dataset.ready = "false";
  }

  function draw() {
    if (!running) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw) {
      const { dpr } = sizeCanvas(canvas);
      const crop = centerCrop(vw, vh, aspect());
      drawFrame(canvas, video, crop, true);
      drawGuide(canvas, { crop, spec: getSpec(), m: state.m, headStatus: state.headStatus, mirrored: true, dpr });
    }
    requestAnimationFrame(draw);
  }

  async function measure() {
    while (running) {
      const vw = video.videoWidth;
      if (vw && video.readyState >= 2) {
        const raw = analyze(vision, video, vw, video.videoHeight, performance.now());
        update(raw, vw, video.videoHeight);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  function update(raw, vw, vh) {
    if (raw.faces !== 1) {
      history = [];
      readySince = null;
      state = { faces: raw.faces, m: null, result: null, headStatus: "idle" };
    } else {
      history.push(raw);
      if (history.length > 5) history.shift();
      const view = smooth(history);
      const crop = centerCrop(vw, vh, aspect());
      const result = evaluate(view.m, crop, getSpec(), { w: vw, h: vh }, view.expression);
      state = { faces: 1, m: view.m, result, background: view.background, headStatus: result.rules[0].status };
      const now = performance.now();
      if (result.ready) readySince ??= now;
      else readySince = null;
    }
    const hold = readySince == null ? 0 : Math.min(1, (performance.now() - readySince) / holdMs);
    stage.style.setProperty("--hold", hold);
    stage.dataset.ready = String(state.result?.ready ?? false);
    onUpdate({ ...state, hold });
    if (hold >= 1) capture();
  }

  function capture() {
    if (!running || !video.videoWidth) return;
    const frame = document.createElement("canvas");
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    frame.getContext("2d").drawImage(video, 0, 0);
    const crop = centerCrop(frame.width, frame.height, aspect());
    close();
    onCapture(frame, crop);
  }

  return {
    open,
    close,
    capture,
    get running() {
      return running;
    },
  };
}
