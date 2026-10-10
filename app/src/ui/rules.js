import { t } from "../i18n.js";

const fmt = (v, unit) => {
  if (v == null || Number.isNaN(v)) return "-";
  if (unit === "dpi") return `${Math.round(v)} dpi`;
  if (unit === "") return v.toFixed(2);
  return `${(Math.abs(v) < 0.05 ? 0 : v).toFixed(1)} ${unit}`;
};

const needText = ([lo, hi], unit) => {
  if (lo == null && hi == null) return "";
  const f = (v) => (unit === "" ? v.toFixed(2) : v.toFixed(unit === "mm" ? 1 : 0));
  if (lo != null && hi != null) return `${t("needs")} ${f(lo)} to ${f(hi)} ${unit}`.trim();
  if (hi != null) return `${t("needs")} <= ${f(hi)} ${unit}`.trim();
  return `${t("needs")} >= ${f(lo)} ${unit}`.trim();
};

/** Rewrites the rule list. Rows are reused so the dot color can transition. */
export function renderRules(list, rules, background, issue) {
  const rows = [...rules, { id: "background", background: true }];
  if (list.children.length !== rows.length) {
    list.replaceChildren(...rows.map(() => makeRow()));
  }
  rows.forEach((rule, i) => {
    const row = list.children[i];
    if (rule.background) return fillBackground(row, background);
    const unknownHead = rule.id === "head" && issue;
    row.dataset.status = rule.status;
    row.querySelector(".status").textContent = rule.status === "unknown" ? "" : ` ${t(rule.status)}`;
    row.querySelector(".label").firstChild.textContent = t(`r_${rule.id}`);
    const tag = row.querySelector(".tag");
    tag.textContent = rule.basis === "spec" ? t("spec") : t("guide");
    tag.title = rule.basis === "spec" ? t("specTip") : t("guideTip");
    tag.className = `tag ${rule.basis}`;
    row.querySelector(".val").textContent = rule.status === "unknown" ? t("unknown") : fmt(rule.value, rule.unit);
    row.querySelector(".need").textContent = unknownHead ? issue : needText(rule.need, rule.unit);
  });
}

function makeRow() {
  const li = document.createElement("li");
  li.className = "rule";
  li.innerHTML =
    '<span class="dot"></span><span class="label"><span></span><span class="tag"></span><span class="sr-only status"></span></span><span class="val"></span><span class="need"></span>';
  return li;
}

function fillBackground(row, bg) {
  row.dataset.status = "unknown";
  row.querySelector(".label").firstChild.textContent = t("r_background");
  const tag = row.querySelector(".tag");
  tag.textContent = "";
  tag.className = "tag";
  tag.hidden = true;
  row.querySelector(".val").textContent = "";
  row.querySelector(".need").textContent = bg
    ? t("bgLine", { mean: Math.round(bg.mean), spread: bg.spread.toFixed(1) })
    : t("bgNone");
}
