import { CHECKED, CUSTOM_ID, SPECS, customSpec, findSpec } from "./core/specs.js";
import { evaluate, fitCrop } from "./core/geometry.js";
import { PAPERS } from "./core/sheet.js";
import { download, renderPhoto, renderSheet, toJpeg, toJpegUnder } from "./core/render.js";
import { LANGS, initialLang, setLang, t } from "./i18n.js";
import { analyze, loadVision } from "./vision.js";
import { createAdjust } from "./ui/adjust.js";
import { createLive } from "./ui/live.js";
import { renderRules } from "./ui/rules.js";
import { centerCrop, drawFrame, drawGuide, sizeCanvas } from "./ui/view.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const view = $("view");
// Safari only decodes frames for a video that is in the page, so it stays there, invisible.
const video = Object.assign(document.createElement("video"), { playsInline: true, muted: true, className: "sr-only" });
document.body.append(video);

const app = {
  spec: findSpec(localStorage.getItem("deadpan-spec")),
  paper: "4x6",
  vision: null,
  loading: null,
  step: "idle",
  source: null,
  measure: null,
  crop: null,
  live: null,
  adjust: null,
  hud: "",
};

const aspect = () => app.spec.photo.w / app.spec.photo.h;

/* Language and theme */

function applyText() {
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  const options = SPECS.map((s) => new Option(s.name, s.id));
  options.push(new Option(t("customSize"), CUSTOM_ID));
  $("spec").replaceChildren(...options);
  $("spec").value = app.spec.id;
  $("paper").replaceChildren(...Object.entries(PAPERS).map(([id, p]) => new Option(p.name, id)));
  $("paper").value = app.paper;
  renderSpecCard();
  renderControls();
  showHud();
  refreshRules();
}

function initTheme() {
  const icons = { auto: "Auto", light: "Light", dark: "Dark" };
  const set = (mode) => {
    document.documentElement.dataset.theme = mode;
    localStorage.setItem("deadpan-theme", mode);
    $("theme").textContent = icons[mode];
    $("theme").title = `${t("theme")}: ${mode}`;
  };
  set(localStorage.getItem("deadpan-theme") ?? "auto");
  $("theme").addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    set(order[(order.indexOf(document.documentElement.dataset.theme) + 1) % 3]);
  });
}

/* Spec */

function renderSpecCard() {
  const { spec } = app;
  const card = $("specCard");
  card.replaceChildren();
  const line = document.createElement("p");
  line.innerHTML = `<strong>${spec.photo.w} x ${spec.photo.h} mm</strong>, head <strong>${spec.head.min} to ${spec.head.max} mm</strong>`;
  card.append(line);
  for (const note of spec.notes) card.append(Object.assign(document.createElement("p"), { textContent: note }));
  if (spec.source) {
    const p = document.createElement("p");
    const a = Object.assign(document.createElement("a"), {
      href: spec.source.url,
      textContent: spec.source.label,
      target: "_blank",
      rel: "noopener",
    });
    p.append(`${t("source")}: `, a, ` (${t("checked")} ${CHECKED})`);
    card.append(p);
  }
}

function setSpec(spec) {
  app.spec = spec;
  if (spec.id !== CUSTOM_ID) localStorage.setItem("deadpan-spec", spec.id);
  $("custom").hidden = spec.id !== CUSTOM_ID;
  stage.style.aspectRatio = `${spec.photo.w} / ${spec.photo.h}`;
  renderSpecCard();
  if (app.step === "adjust") {
    app.crop = bestCrop();
    app.adjust.set(app.source, app.crop, aspect());
  }
  refreshRules();
  $("result").hidden = true;
}

function readCustom() {
  const f = Object.fromEntries(new FormData($("custom")).entries());
  const n = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v)]));
  const ok = n.w > 10 && n.h > 10 && n.min > 0 && n.max > n.min && n.max < n.h;
  if (ok) setSpec(customSpec(n));
}

/* Stage state and rules */

function showHud(text = app.hud) {
  app.hud = text;
  $("hud").hidden = !text;
  $("hud").replaceChildren(Object.assign(document.createElement("span"), { textContent: text }));
}

function evaluateNow(crop) {
  const { m, expression } = app.measure;
  return evaluate(m, crop, app.spec, { w: app.source.width, h: app.source.height }, expression);
}

function refreshRules(live = null) {
  const list = $("rules");
  if (live?.result) return renderRules(list, live.result.rules, live.background, null);
  if (app.step === "adjust" && app.measure?.m) {
    const result = evaluateNow(app.crop);
    return renderRules(
      list,
      result.rules,
      app.measure.background,
      app.measure.m.crownY == null ? t("headTouches") : null,
    );
  }
  const blank = ["head", "centered", "inFrame", "level", "facing", "expression", "eyes", "pixels"].map((id) => ({
    id,
    status: "unknown",
    value: null,
    unit: id === "head" ? "mm" : "",
    need: id === "head" ? [app.spec.head.min, app.spec.head.max] : [null, null],
    basis: id === "head" ? "spec" : "guide",
  }));
  renderRules(list, blank, null, null);
}

function bestCrop() {
  const { m } = app.measure;
  const source = { w: app.source.width, h: app.source.height };
  if (m?.crownY != null) return fitCrop({ crownY: m.crownY, chinY: m.chinY, centerX: m.centerX }, app.spec, source);
  return centerCrop(source.w, source.h, aspect());
}

function drawAdjust(crop) {
  app.crop = crop;
  $("result").hidden = true;
  const { dpr } = sizeCanvas(view);
  drawFrame(view, app.source, crop, false);
  const { m } = app.measure;
  const result = m ? evaluateNow(crop) : null;
  drawGuide(view, { crop, spec: app.spec, m, headStatus: result?.rules[0].status, mirrored: false, dpr });
  stage.dataset.ready = String(result?.ready ?? false);
  refreshRules();
  if (result) showHud(result.ready ? t("allGreen") : "");
}

/* Controls */

function button(label, kind, handler, disabled = false) {
  const b = Object.assign(document.createElement("button"), {
    type: "button",
    className: kind,
    textContent: label,
    disabled,
  });
  b.addEventListener("click", handler);
  return b;
}

function renderControls() {
  const box = $("controls");
  if (app.step === "idle") {
    box.replaceChildren(
      button(t("startCamera"), "primary", startCamera),
      button(t("usePhoto"), "ghost", () => $("file").click()),
    );
  } else if (app.step === "live") {
    box.replaceChildren(
      button(t("capture"), "primary", () => app.live.capture()),
      button(t("usePhoto"), "ghost", () => {
        app.live.close();
        $("file").click();
      }),
    );
  } else if (app.step === "adjust") {
    box.replaceChildren(
      button(t("retake"), "ghost", reset),
      button(t("autoFit"), "ghost", () => app.adjust.set(app.source, bestCrop(), aspect())),
      button(t("makeSheet"), "primary", makeSheet),
    );
  } else box.replaceChildren();
}

function setStep(step) {
  app.step = step;
  stage.dataset.state = step === "idle" ? "idle" : step;
  stage.tabIndex = step === "adjust" ? 0 : -1;
  if (step !== "live") stage.dataset.ready = "false";
  renderControls();
}

function reset() {
  app.live?.close();
  app.source = app.measure = app.crop = null;
  stage.style.setProperty("--hold", 0);
  $("result").hidden = true;
  showHud("");
  setStep("idle");
  refreshRules();
}

/* Camera and photo flows */

async function ensureVision() {
  if (app.vision) return true;
  showHud(t("loading"));
  try {
    app.loading ??= loadVision();
    app.vision = await app.loading;
    showHud("");
    return true;
  } catch (err) {
    app.loading = null;
    showHud(String(err.message ?? err));
    return false;
  }
}

function liveStatus(state) {
  if (state.faces === 0) return t("noFace");
  if (state.faces > 1) return t("manyFaces");
  if (state.result?.ready) return t("holdStill");
  return "";
}

async function startCamera() {
  if (!(await ensureVision())) return;
  app.live ??= createLive({
    vision: app.vision,
    video,
    canvas: view,
    stage,
    getSpec: () => app.spec,
    onUpdate: (state) => {
      showHud(liveStatus(state));
      refreshRules(state);
    },
    onCapture: (frame, crop) => finishCapture(frame, crop),
  });
  setStep("live");
  try {
    await app.live.open();
    showHud(t("noFace"));
  } catch {
    showHud(t("noCamera"));
    setStep("idle");
  }
}

function measureStill(canvas) {
  try {
    return analyze(app.vision, canvas, canvas.width, canvas.height);
  } catch {
    return { faces: 0, m: null, expression: null, background: null };
  }
}

function finishCapture(frame, crop) {
  app.source = frame;
  app.measure = measureStill(frame);
  app.crop = app.measure.m ? crop : centerCrop(frame.width, frame.height, aspect());
  enterAdjust(crop);
}

function enterAdjust(initial) {
  setStep("adjust");
  app.adjust ??= createAdjust({ stage, canvas: view, onChange: drawAdjust });
  const raw = app.measure;
  if (raw.faces !== 1) showHud(raw.faces === 0 ? t("noFace") : t("manyFaces"));
  app.adjust.set({ w: app.source.width, h: app.source.height }, initial ?? bestCrop(), aspect());
}

let loadToken = 0;

async function loadFile(file) {
  if (!file || !(await ensureVision())) return;
  const token = ++loadToken;
  app.live?.close();
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() =>
      createImageBitmap(file),
    );
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement("canvas"), {
      width: Math.round(bitmap.width * scale),
      height: Math.round(bitmap.height * scale),
    });
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (token !== loadToken) return;
    app.source = canvas;
    app.measure = measureStill(canvas);
    enterAdjust(null);
  } catch {
    if (token !== loadToken) return;
    reset();
    showHud(t("imageError"));
  }
}

/* Export */

let exported = null;

async function makeSheet() {
  const photo = renderPhoto(app.source, app.crop, app.spec);
  const { canvas, pack } = renderSheet(photo, PAPERS[app.paper], app.spec);
  exported = { photo, sheet: canvas };
  const preview = $("sheetView");
  preview.width = canvas.width;
  preview.height = canvas.height;
  preview.getContext("2d").drawImage(canvas, 0, 0);
  $("sheetNote").textContent = t("sheetNote", { n: pack.count, paper: PAPERS[app.paper].name });
  const digital = app.spec.digital;
  $("dlDigital").hidden = $("digitalNote").hidden = !digital;
  if (digital) $("digitalNote").textContent = t("digitalNote", { px: digitalPx(digital), kb: digital.maxKB });
  const result = $("result");
  result.hidden = false;
  result.classList.remove("show");
  void result.offsetWidth;
  result.classList.add("show");
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

const digitalPx = (d) => Math.min(d.maxPx, Math.max(d.minPx, 1000));

async function downloadDigital() {
  const d = app.spec.digital;
  const px = digitalPx(d);
  for (const size of [px, 800, 600]) {
    const sizeDpi = size / (app.spec.photo.w / 25.4);
    const bytes = await toJpegUnder(renderPhoto(app.source, app.crop, app.spec, sizeDpi), d.maxKB * 1000, sizeDpi);
    if (bytes) return download(`deadpan-${app.spec.id}-${size}px.jpg`, bytes);
  }
  showHud(t("tooBig"));
}

/* Wiring */

function init() {
  setLang(initialLang());
  initTheme();
  $("lang").replaceChildren(...Object.entries(LANGS).map(([code, l]) => new Option(l.name, code)));
  $("lang").value = initialLang();
  $("lang").addEventListener("change", (e) => {
    setLang(e.target.value);
    applyText();
  });
  $("spec").addEventListener("change", (e) =>
    e.target.value === CUSTOM_ID ? readCustom() : setSpec(findSpec(e.target.value)),
  );
  $("custom").addEventListener("input", readCustom);
  $("paper").addEventListener("change", (e) => {
    app.paper = e.target.value;
    if (app.step === "adjust") makeSheet();
  });
  $("file").addEventListener("change", (e) => {
    loadFile(e.target.files[0]);
    e.target.value = "";
  });
  $("dlSheet").addEventListener("click", async () =>
    download(`deadpan-${app.spec.id}-sheet.jpg`, await toJpeg(exported.sheet)),
  );
  $("dlPhoto").addEventListener("click", async () =>
    download(`deadpan-${app.spec.id}.jpg`, await toJpeg(exported.photo)),
  );
  $("dlDigital").addEventListener("click", downloadDigital);
  stage.style.aspectRatio = `${app.spec.photo.w} / ${app.spec.photo.h}`;
  setStep("idle");
  applyText();
}

init();
