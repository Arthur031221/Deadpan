// Drag, wheel and pinch on the stage move and resize the crop.
import { clampCrop } from "../core/geometry.js";

export function createAdjust({ stage, canvas, onChange }) {
  let source = null;
  let crop = null;
  let aspect = 1;
  const pointers = new Map();
  let lastDist = 0;

  const bounds = () => {
    const maxW = Math.min(source.w, source.h * aspect);
    return { minW: Math.max(120 * aspect, maxW * 0.08), maxW };
  };

  function set(nextSource, nextCrop, nextAspect) {
    source = nextSource;
    crop = nextCrop;
    aspect = nextAspect;
    onChange(crop);
  }

  function commit(next) {
    crop = clampCrop(next, source);
    onChange(crop);
  }

  function zoomAt(factor, fx, fy) {
    const { minW, maxW } = bounds();
    const w = Math.min(maxW, Math.max(minW, crop.w * factor));
    const h = w / aspect;
    commit({ x: crop.x + fx * crop.w - fx * w, y: crop.y + fy * crop.h - fy * h, w, h });
  }

  const rect = () => canvas.getBoundingClientRect();
  const frac = (e) => {
    const r = rect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  stage.addEventListener("pointerdown", (e) => {
    if (stage.dataset.state !== "adjust") return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastDist = 0;
  });
  stage.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev || stage.dataset.state !== "adjust") return;
    const r = rect();
    const now = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      commit({
        ...crop,
        x: crop.x - ((now.x - prev.x) * crop.w) / r.width,
        y: crop.y - ((now.y - prev.y) * crop.h) / r.height,
      });
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, now);
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist) zoomAt(lastDist / dist, ((a.x + b.x) / 2 - r.left) / r.width, ((a.y + b.y) / 2 - r.top) / r.height);
      lastDist = dist;
    }
    pointers.set(e.pointerId, now);
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    lastDist = 0;
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener(
    "wheel",
    (e) => {
      if (stage.dataset.state !== "adjust") return;
      e.preventDefault();
      const [fx, fy] = frac(e);
      zoomAt(Math.exp(e.deltaY * 0.0012), fx, fy);
    },
    { passive: false },
  );
  stage.addEventListener("keydown", (e) => {
    if (stage.dataset.state !== "adjust") return;
    const step = crop.w * 0.01;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) commit({ ...crop, x: crop.x + moves[e.key][0], y: crop.y + moves[e.key][1] });
    else if (e.key === "+" || e.key === "=") zoomAt(0.97, 0.5, 0.5);
    else if (e.key === "-") zoomAt(1.03, 0.5, 0.5);
    else return;
    e.preventDefault();
  });

  return {
    set,
    get crop() {
      return crop;
    },
  };
}
