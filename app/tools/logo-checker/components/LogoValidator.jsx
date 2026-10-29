'use client';

import React, { useState, useRef, useEffect, useMemo } from "react";
import { StepProgressBar } from "@/components/shared/StepProgressBar";

/* =========================================================================
   ロゴ検証ツール

   制作フローに沿った 5 ステップ構成：
     1 取り込み  アセットを揃え、画面を実寸に合わせる
     2 測定      版ごと・出力条件ごとに限界を見つける
     3 規定      測定値から使用ルールを導く
     4 検証      ルールを実際の使用シーンに当てる
     5 仕様      ガイドラインに書ける形で出力する

   最小サイズは「版 × 出力条件」の関数なので、条件は測定の内側に置く。
   クリアスペースは測って見つけるものではなく決めるものなので規定側に置く。
   ========================================================================= */

const CARD_MM = 85.6;
const DEFAULT_PPMM = 96 / 25.4;
const REG = "#E4007F";
const REG2 = "#00A0E9";
const ICON_MM = 15;
const CARD_W_MM = 91;
const CARD_H_MM = 55;
const ANDROID_SAFE = 0.667;

const SLOTS = [
  { key: "symbol",   label: "シンボルマーク", en: "Symbol",   hint: "図形部分の単体" },
  { key: "logotype", label: "ロゴタイプ",     en: "Wordmark", hint: "文字部分の単体" },
  { key: "lockupH",  label: "組み合わせ・横", en: "Lockup H", hint: "シンボル＋文字の横組み" },
  { key: "lockupV",  label: "組み合わせ・縦", en: "Lockup V", hint: "縦組みバージョン" },
];

const CONDITIONS = [
  { key: "color",    label: "フルカラー", hint: "通常の使用" },
  { key: "mono",     label: "モノクロ",   hint: "単色印刷" },
  { key: "knockout", label: "白抜き",     hint: "濃色地に載せる" },
  { key: "onebit",   label: "1bit",       hint: "FAX・箔押し・シルク" },
];

const STEPS = [
  { key: "intake",  label: "取り込み", sub: "アセットと実寸校正", desc: "画面を実寸に合わせてから、ロゴの各版（シンボル・ロゴタイプ・組み合わせ）を読み込みます。" },
  { key: "measure", label: "測定",     sub: "版 × 条件の限界",   desc: "版ごとに、出力条件を切り替えながら読める限界のサイズを決めます。" },
  { key: "rules",   label: "規定",     sub: "使用ルールの導出",   desc: "測定した最小サイズの一覧と、クリアスペース（余白）の規定を決めます。" },
  { key: "verify",  label: "検証",     sub: "使用シーンでの確認", desc: "アプリアイコン・ウェブヘッダー・ファビコン・名刺に当て、各シーンで収まる版を自動で選んで表示します。赤が出たら、規定か使い方のどちらかを見直す合図です。" },
  { key: "spec",    label: "仕様",     sub: "ガイドライン出力",   desc: "使用規定をまとめます。Markdown でコピーして、ブランドガイドラインに貼れます。" },
];

const LADDER_MM = [2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 25];

const FILTERS = {
  color: "none",
  gray: "grayscale(1)",
  mono: "brightness(0) saturate(100%)",
  knockout: "brightness(0) invert(1)",
};

/* ============================ 画像ユーティリティ ============================ */

function normalizeSvg(text) {
  const cleaned = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  const doc = new DOMParser().parseFromString(cleaned, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) return null;
  let w = parseFloat(svg.getAttribute("width"));
  let h = parseFloat(svg.getAttribute("height"));
  const vb = svg.getAttribute("viewBox");
  let aspect;
  if (vb) {
    const p = vb.split(/[\s,]+/).map(Number);
    aspect = p[2] / p[3];
    if (!w || !h) { svg.setAttribute("width", p[2]); svg.setAttribute("height", p[3]); }
  } else if (w && h) {
    aspect = w / h;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  } else {
    aspect = 1;
    svg.setAttribute("width", 100); svg.setAttribute("height", 100);
    svg.setAttribute("viewBox", "0 0 100 100");
  }
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const s = new XMLSerializer().serializeToString(svg);
  return { url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s), aspect, isRaster: false };
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
  });
}

function readAsset(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
      const r = new FileReader();
      r.onload = (e) => {
        const n = normalizeSvg(e.target.result);
        resolve(n ? { ...n, name: file.name } : null);
      };
      r.readAsText(file);
    } else if (file.type.startsWith("image/")) {
      const r = new FileReader();
      r.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve({ url: e.target.result, aspect: img.width / img.height, isRaster: true, name: file.name });
        img.src = e.target.result;
      };
      r.readAsDataURL(file);
    } else resolve(null);
  });
}

/* -------- 一体データの分割 -------- */
function analyzeSource(img) {
  const MAXW = 1600;
  const scale = Math.min(1, MAXW / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  let aSum = 0, r = 0, g = 0, b = 0;
  corners.forEach(([x, y]) => {
    const i = (y * w + x) * 4;
    aSum += d[i + 3]; r += d[i]; g += d[i + 1]; b += d[i + 2];
  });
  const transparentBg = aSum / 4 < 32;
  const bg = [r / 4, g / 4, b / 4];
  const mask = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    if (d[i + 3] < 32) { mask[p] = 0; continue; }
    if (transparentBg) { mask[p] = 1; continue; }
    const dist = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
    mask[p] = dist > 45 ? 1 : 0;
  }
  const bgCss = `rgb(${Math.round(bg[0])},${Math.round(bg[1])},${Math.round(bg[2])})`;
  return { w, h, mask, canvas, transparentBg, bgCss };
}

function profile(mask, w, h, axis) {
  const n = axis === "x" ? w : h, m = axis === "x" ? h : w;
  const out = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (let j = 0; j < m; j++) if (mask[axis === "x" ? j * w + i : i * w + j]) c++;
    out[i] = c;
  }
  return out;
}

function widestGap(prof) {
  const n = prof.length;
  let first = -1, last = -1;
  for (let i = 0; i < n; i++) if (prof[i] > 0) { if (first < 0) first = i; last = i; }
  if (first < 0) return null;
  let best = null, cur = null;
  for (let i = first; i <= last; i++) {
    if (prof[i] === 0) { cur = cur ? { s: cur.s, e: i } : { s: i, e: i }; }
    else if (cur) { if (!best || cur.e - cur.s > best.e - best.s) best = cur; cur = null; }
  }
  if (cur && (!best || cur.e - cur.s > best.e - best.s)) best = cur;
  return best ? { ...best, first, last } : { s: -1, e: -1, first, last };
}

function bboxIn(mask, w, h, x0, x1, y0, y1) {
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (mask[y * w + x]) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function cropUrl(canvas, box) {
  const c = document.createElement("canvas");
  c.width = box.w; c.height = box.h;
  c.getContext("2d").drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return c.toDataURL("image/png");
}

/* -------- 対向バージョンの合成 --------
   横組みから縦組み（またはその逆）を組み立てる。
   間隔と拡大率は元データの値を初期値にするが、正式な縦組みの設計とは別物なので
   あくまで検討用モックとして扱う。                                         */
async function composeLockup(urlSymbol, urlType, { vertical, gap, symScale, bgCss, transparent }) {
  const [is, it] = await Promise.all([loadImage(urlSymbol), loadImage(urlType)]);
  const sw = is.width * symScale, sh = is.height * symScale;
  const tw = it.width, th = it.height;
  let W, H, sx, sy, tx, ty;
  if (vertical) {
    W = Math.max(sw, tw); H = sh + gap + th;
    sx = (W - sw) / 2; sy = 0;
    tx = (W - tw) / 2; ty = sh + gap;
  } else {
    W = sw + gap + tw; H = Math.max(sh, th);
    sx = 0; sy = (H - sh) / 2;
    tx = sw + gap; ty = (H - th) / 2;
  }
  // 高倍率でキャンバスが肥大するのを防ぐ。比率を保ったまま全体を縮める
  const CAP = 4000;
  const k = Math.min(1, CAP / Math.max(W, H));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
  const ctx = c.getContext("2d");
  if (!transparent) { ctx.fillStyle = bgCss || "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(is, sx * k, sy * k, sw * k, sh * k);
  ctx.drawImage(it, tx * k, ty * k, tw * k, th * k);
  return { url: c.toDataURL("image/png"), aspect: W / H, px: { w: c.width, h: c.height } };
}

/* -------- パーツの属性計測と役割推定 --------
   文字は必ず複数の連結領域に分かれ、多くの場合は単色。
   シンボルは正方形に近く、連結領域が少なく、多色になりやすい。
   この差を数値で見せてから登録させる。                        */
function partStats(ana, box) {
  const { mask, w, canvas } = ana;
  const { x, y, w: bw, h: bh } = box;
  const lm = new Uint8Array(bw * bh);
  let ink = 0;
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const v = mask[(y + j) * w + (x + i)];
    lm[j * bw + i] = v; if (v) ink++;
  }

  // 連結領域の数（4近傍・反復フラッドフィル）
  const seen = new Uint8Array(bw * bh);
  const stack = new Int32Array(bw * bh);
  let comps = 0;
  for (let p = 0; p < bw * bh; p++) {
    if (!lm[p] || seen[p]) continue;
    comps++; let sp = 0; stack[sp++] = p; seen[p] = 1;
    while (sp > 0) {
      const q = stack[--sp];
      const qx = q % bw, qy = (q / bw) | 0;
      if (qx > 0)      { const n = q - 1;  if (lm[n] && !seen[n]) { seen[n] = 1; stack[sp++] = n; } }
      if (qx < bw - 1) { const n = q + 1;  if (lm[n] && !seen[n]) { seen[n] = 1; stack[sp++] = n; } }
      if (qy > 0)      { const n = q - bw; if (lm[n] && !seen[n]) { seen[n] = 1; stack[sp++] = n; } }
      if (qy < bh - 1) { const n = q + bw; if (lm[n] && !seen[n]) { seen[n] = 1; stack[sp++] = n; } }
    }
  }

  // 色数・彩度・半透明の有無
  const d = canvas.getContext("2d", { willReadFrequently: true }).getImageData(x, y, bw, bh).data;
  const set = new Set();
  let satSum = 0, n = 0, partialAlpha = 0;
  for (let p = 0, i = 0; p < bw * bh; p++, i += 4) {
    if (!lm[p]) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    if (a > 0 && a < 250) partialAlpha++;
    set.add(((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5));
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    satSum += mx === 0 ? 0 : (mx - mn) / mx;
    n++;
  }
  return {
    aspect: bw / bh, px: { w: bw, h: bh },
    components: comps, colors: set.size,
    sat: n ? satSum / n : 0,
    coverage: ink / (bw * bh),
    hasAlpha: partialAlpha > 0,
  };
}

function inferRole(st) {
  let sym = 0, typ = 0;
  const why = [];
  if (st.aspect < 1.8) { sym += 2; why.push(`比率 ${st.aspect.toFixed(2)}（正方形に近い）`); }
  else if (st.aspect > 2.5) { typ += 2; why.push(`比率 ${st.aspect.toFixed(2)}（横長）`); }
  if (st.components <= 4) { sym += 1.5; why.push(`連結領域 ${st.components}（少ない）`); }
  else if (st.components >= 6) { typ += 1.5; why.push(`連結領域 ${st.components}（文字数相当）`); }
  if (st.colors >= 8 && st.sat > 0.25) { sym += 1.5; why.push(`色数 ${st.colors}・彩度あり`); }
  if (st.sat < 0.12) { typ += 1; why.push("ほぼ無彩色"); }
  return { role: sym >= typ ? "symbol" : "logotype", why, confident: Math.abs(sym - typ) >= 2 };
}

/* -------- 形状保持スコア -------- */
function inkMask(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const m = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = d[i + 3] / 255;
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * a + 255 * (1 - a);
    m[p] = lum < 200 ? 1 : 0;
  }
  return m;
}

function iouOf(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) if (a[i] || b[i]) { uni++; if (a[i] && b[i]) inter++; }
  return uni === 0 ? 1 : inter / uni;
}

async function analyzeRetention(url, aspect, ppmm) {
  const img = await loadImage(url).catch(() => null);
  if (!img) return [];
  const RW = 480, RH = Math.max(1, Math.round(RW / aspect));
  const ref = document.createElement("canvas");
  ref.width = RW; ref.height = RH;
  const rctx = ref.getContext("2d", { willReadFrequently: true });
  rctx.drawImage(img, 0, 0, RW, RH);
  const refMask = inkMask(rctx, RW, RH);
  return LADDER_MM.map((mm) => {
    const sw = Math.max(2, Math.round(mm * ppmm));
    const sh = Math.max(2, Math.round(sw / aspect));
    const small = document.createElement("canvas");
    small.width = sw; small.height = sh;
    small.getContext("2d").drawImage(img, 0, 0, sw, sh);
    const up = document.createElement("canvas");
    up.width = RW; up.height = RH;
    const uctx = up.getContext("2d", { willReadFrequently: true });
    uctx.imageSmoothingEnabled = true;
    uctx.drawImage(small, 0, 0, RW, RH);
    return { mm, score: iouOf(refMask, inkMask(uctx, RW, RH)) };
  });
}

/* ============================ 共通パーツ ============================ */

function OneBit({ url, w, h, threshold = 128 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c || !url) return;
    const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const img = new Image();
    img.onload = () => {
      c.width = W; c.height = H;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      const id = ctx.getImageData(0, 0, W, H), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum < threshold) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 255; }
        else d[i + 3] = 0;
      }
      ctx.putImageData(id, 0, 0);
    };
    img.src = url;
  }, [url, w, h, threshold]);
  // 実体は整数px（ドット落ちの再現）だが、表示は端数のままにして縦横比を保つ
  return <canvas ref={ref} style={{ width: w, height: h, display: "block" }} />;
}

/* 出力条件つきレンダラ。条件が背景色も決めるので、地の色はここが持つ */
function Render({ asset, w, h, cond = "color", threshold = 128, blur = 0 }) {
  const style = {
    width: w, height: h, display: "block",
    filter: [FILTERS[cond] || "none", blur ? `blur(${blur}px)` : ""].filter((x) => x && x !== "none").join(" ") || "none",
  };
  if (cond === "onebit") return <OneBit url={asset.url} w={w} h={h} threshold={threshold} />;
  return <img src={asset.url} alt="" style={style} />;
}

const condBg = (cond) => (cond === "knockout" ? "#141414" : "#ffffff");

function Field({ label, children, hint }) {
  return (
    <div>
      {label ? <label className="text-xs font-bold text-foreground block mb-1.5">{label}</label> : null}
      {children}
      {hint && <div className="text-[10px] text-neutral-400 mt-1">{hint}</div>}
    </div>
  );
}

function Slider({ label, val, set, min, max, step, unit, sub, width = "w-40" }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={(e) => set(parseFloat(e.target.value))} className={width} />
        <span className="font-mono text-[11px] w-28 shrink-0 whitespace-nowrap">
          <span className="text-ds-app-accent font-semibold">{val}{unit}</span>
          {sub && <span className="text-neutral-400"> · {sub}</span>}
        </span>
      </div>
    </Field>
  );
}

function Panel({ title, desc, children, right }) {
  return (
    <section className="rounded-xl border bg-[hsl(0_0%_97%)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          {desc && <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed max-w-2xl">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Empty({ children, action }) {
  return (
    <div className="rounded-xl border border-dashed bg-[hsl(0_0%_97%)] px-8 py-14 text-center">
      <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{children}</p>
      {action}
    </div>
  );
}

/* ============================ メイン ============================ */

export default function LogoValidator() {
  const [step, setStep] = useState("intake");
  const [assets, setAssets] = useState({});
  // minima: { [slot]: mm } — 版につき 1 つの限界サイズ
  const [minima, setMinima] = useState({});
  // binding: { [slot]: condKey } — その限界を決めた出力条件
  const [binding, setBinding] = useState({});
  // viewed: { [slot]: { [cond]: true } } — 確認済みの条件
  const [viewed, setViewed] = useState({});
  const [ppmm, setPpmm] = useState(DEFAULT_PPMM);
  const [calibrated, setCalibrated] = useState(false);
  const [active, setActive] = useState("symbol");
  const [threshold, setThreshold] = useState(128);

  // composition: 組み合わせ全体の幅を 1 としたときの各版の幅比
  const [composition, setComposition] = useState({});
  // derived: { [slot]: true } — 比例配分による推定値か
  const [derived, setDerived] = useState({});
  const [clearRule, setClearRule] = useState({ basis: "height", ratio: 0.5 });
  const [scene, setScene] = useState({ iconInset: 18, iconBg: "#ffffff", headerH: 28, cardLogoMm: 18, cardSlot: "auto" });

  const setAsset = (k, obj, fraction) => {
    setAssets((a) => ({ ...a, [k]: obj }));
    setMinima((m) => { const n = { ...m }; delete n[k]; return n; });
    setBinding((b) => { const n = { ...b }; delete n[k]; return n; });
    setViewed((v) => { const n = { ...v }; delete n[k]; return n; });
    setDerived((d) => { const n = { ...d }; delete n[k]; return n; });
    if (fraction != null && isFinite(fraction)) setComposition((c) => ({ ...c, [k]: fraction }));
    setActive(k);
  };
  const clearSlot = (k) => {
    setAssets((a) => { const n = { ...a }; delete n[k]; return n; });
    setMinima((m) => { const n = { ...m }; delete n[k]; return n; });
    setBinding((b) => { const n = { ...b }; delete n[k]; return n; });
    setViewed((v) => { const n = { ...v }; delete n[k]; return n; });
    setDerived((d) => { const n = { ...d }; delete n[k]; return n; });
    setComposition((c) => { const n = { ...c }; delete n[k]; return n; });
  };

  const stepIndex = Math.max(0, STEPS.findIndex((x) => x.key === step));
  const goStep = (delta) => {
    const next = STEPS[stepIndex + delta];
    if (!next) return;
    setStep(next.key);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const hasAssets = Object.keys(assets).length > 0;
  const hasMinima = Object.values(minima).some((v) => v != null);
  const done = {
    intake: hasAssets && calibrated,
    measure: hasMinima,
    rules: hasMinima,
    verify: hasMinima,
    spec: false,
  };

  return (
    <div className="w-full text-foreground">
      <style>{`
        input[type=range]{
          accent-color:var(--ds-app-accent);
          height:20px;
          cursor:pointer;
        }
        input[type=range]:focus-visible{
          outline:2px solid var(--ds-app-accent);
          outline-offset:2px;
          border-radius:4px;
        }
        input[type=checkbox]{
          accent-color:var(--ds-app-accent);
          width:14px;
          height:14px;
          cursor:pointer;
        }
        input[type=color]{cursor:pointer}
      `}</style>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <StepProgressBar steps={STEPS.map((x) => ({ label: x.label }))} currentStep={stepIndex + 1} className="mb-8" />

        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-2xl font-bold text-foreground">{`Step ${stepIndex + 1}: ${STEPS[stepIndex].label}`}</h1>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              calibrated ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}>
              {calibrated ? `実寸校正済み ${ppmm.toFixed(2)}px/mm` : "実寸未校正"}
            </span>
            <span className="text-xs text-muted-foreground">取り込み済み {Object.keys(assets).length}/4 版</span>
          </div>
        </div>
        <p className="mb-5 text-[13px] text-muted-foreground">{STEPS[stepIndex].desc}</p>
        {step === "intake" && (
          <IntakeStep assets={assets} setAsset={setAsset} clearSlot={clearSlot}
            ppmm={ppmm} setPpmm={setPpmm} calibrated={calibrated} setCalibrated={setCalibrated}
            onNext={() => setStep("measure")} />
        )}
        {step === "measure" && (
          hasAssets ? (
            <MeasureStep assets={assets} active={active} setActive={setActive}
              minima={minima} setMinima={setMinima}
              binding={binding} setBinding={setBinding}
              viewed={viewed} setViewed={setViewed}
              ppmm={ppmm} threshold={threshold} setThreshold={setThreshold}
              calibrated={calibrated} composition={composition}
              derived={derived} setDerived={setDerived} />
          ) : (
            <Empty action={<button onClick={() => setStep("intake")}
              className="mt-3 inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">取り込みへ戻る</button>}>
              測定する版がありません。先にアセットを取り込んでください。
            </Empty>
          )
        )}
        {step === "rules" && (
          <RulesStep assets={assets} minima={minima} binding={binding}
            clearRule={clearRule} setClearRule={setClearRule} derived={derived} />
        )}
        {step === "verify" && (
          hasAssets ? (
            <VerifyStep assets={assets} governing={minima} ppmm={ppmm}
              scene={scene} setScene={setScene} clearRule={clearRule} />
          ) : (
            <Empty>検証する版がありません。</Empty>
          )
        )}
        {step === "spec" && (
          <SpecStep assets={assets} minima={minima} binding={binding}
            clearRule={clearRule} ppmm={ppmm} calibrated={calibrated} scene={scene}
            derived={derived} />
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          「ロゴマーク」は定義が揺れる語のため、本ツールでは シンボルマーク（Symbol）／ロゴタイプ（Wordmark）／組み合わせ（Lockup）で区別しています。
        </p>

        {/* ステップの移動（他の構築ツールと同じ下部固定のナビゲーション） */}
        <div className="sticky bottom-0 -mx-5 mt-6 flex items-center justify-between gap-3 border-t border-border bg-background/80 px-5 py-3 backdrop-blur">
          <button type="button" onClick={() => goStep(-1)} disabled={stepIndex === 0}
            className="inline-flex h-9 items-center justify-center rounded-full border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40">
            ← 戻る
          </button>
          {stepIndex < STEPS.length - 1 && (
            <button type="button" onClick={() => goStep(1)}
              className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
              次のステップへ →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ 1. 取り込み ============================ */

function IntakeStep({ assets, setAsset, clearSlot, ppmm, setPpmm, calibrated, setCalibrated, onNext }) {
  const [mode, setMode] = useState("split");
  const [dragSlot, setDragSlot] = useState(null);
  const count = Object.keys(assets).length;

  return (
    <div className="space-y-5">
      <Panel
        title="実寸校正"
        desc="以降のすべての mm 表記がこの値に依存します。最初に一度だけ合わせてください。"
        right={
          <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${
            calibrated ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}>{calibrated ? "完了" : "未実施"}</span>
        }>
        <p className="text-[11px] text-neutral-500 mb-3">
          下のバーの長さを、手元のカード（クレジットカード・運転免許証）の横幅に合わせてください。
        </p>
        <div className="h-9 rounded-lg border border-neutral-300 bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-400 mb-3"
          style={{ width: CARD_MM * ppmm }}>85.6 mm</div>
        <div className="flex items-center gap-4">
          <input type="range" min={2.5} max={6} step={0.001} value={ppmm}
            onChange={(e) => { setPpmm(parseFloat(e.target.value)); setCalibrated(true); }}
            className="w-72" />
          <span className="font-mono text-[11px] text-neutral-600">{ppmm.toFixed(3)} px/mm</span>
          <button onClick={() => { setPpmm(DEFAULT_PPMM); setCalibrated(true); }}
            className="text-[10px] text-neutral-500 underline">既定値（96dpi）を使う</button>
        </div>
      </Panel>

      <Panel title="版の取り込み"
        desc="最小サイズは階層ごとに異なります。シンボルと文字を別々に持つと、組み合わせの限界がどちらに引かれているかを根拠つきで出せます。"
        right={
          <div className="flex gap-1">
            {[["split", "一体データを分割"], ["individual", "個別に読み込む"]].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                  mode === k ? "bg-ds-app-accent text-white border-ds-app-accent" : "border-border bg-background text-foreground hover:bg-muted"
                }`}>{l}</button>
            ))}
          </div>
        }>
        {mode === "individual" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SLOTS.map((s) => {
              const a = assets[s.key];
              const over = dragSlot === s.key;
              return (
                <div key={s.key} className="rounded-lg bg-white border border-neutral-200 p-3">
                  <div className="text-[11px] font-medium text-neutral-800">{s.label}</div>
                  <div className="text-[11px] font-mono text-neutral-400 mb-2">{s.en}</div>
                  <div
                    onDragEnter={(e) => { e.preventDefault(); setDragSlot(s.key); }}
                    onDragOver={(e) => { e.preventDefault(); setDragSlot(s.key); }}
                    onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setDragSlot(null); }}
                    onDrop={async (e) => {
                      e.preventDefault(); setDragSlot(null);
                      const r = await readAsset(e.dataTransfer?.files?.[0]);
                      if (r) setAsset(s.key, r);
                    }}
                    className={`h-20 flex items-center justify-center rounded-lg border-2 border-dashed mb-2 p-2 transition-colors ${
                      over ? "border-ds-app-accent bg-blue-50" : "border-neutral-200 bg-neutral-50"
                    }`}>
                    {over
                      ? <span className="text-[10px] text-neutral-600">ここに落とす</span>
                      : a ? <img src={a.url} alt="" style={{ maxHeight: 60, maxWidth: "100%" }} />
                          : <span className="text-[11px] text-neutral-300 text-center leading-snug">{s.hint}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="flex-1 text-center cursor-pointer text-[10px] font-medium px-2 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700">
                      {a ? "差し替え" : "選択"}
                      <input type="file" accept=".svg,image/svg+xml,image/png,image/jpeg" className="hidden"
                        onChange={async (e) => {
                          const r = await readAsset(e.target.files[0]);
                          if (r) setAsset(s.key, r);
                        }} />
                    </label>
                    {a && <button onClick={() => clearSlot(s.key)}
                      className="text-[10px] text-neutral-400 hover:text-red-600 px-1">削除</button>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <SplitTool onAssign={setAsset} assets={assets} ppmm={ppmm} onNext={onNext} />
        )}
      </Panel>

      {count > 0 && (
        <div className="flex justify-end">
          <button onClick={onNext}
            className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
            測定へ進む
          </button>
        </div>
      )}
    </div>
  );
}

/* -------- 一体データ分割ツール -------- */function StatRow({ k, v, note }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[10px] text-neutral-400 shrink-0">{k}</span>
      <span className="flex-1 border-b border-dotted border-neutral-200" />
      <span className="text-[10px] font-mono text-neutral-700">{v}</span>
      {note && <span className="text-[11px] text-neutral-400">{note}</span>}
    </div>
  );
}

function SplitTool({ onAssign, assets, ppmm, onNext }) {
  const [src, setSrc] = useState(null);
  const [ana, setAna] = useState(null);
  const [axis, setAxis] = useState("x");
  const [pos, setPos] = useState(0.5);
  const [trim, setTrim] = useState(true);
  const [note, setNote] = useState("");
  const [roles, setRoles] = useState({ a: "symbol", b: "logotype" });
  const [touched, setTouched] = useState(false);   // 役割を手動変更したか
  const [justSaved, setJustSaved] = useState([]);
  const [drag, setDrag] = useState(false);
  const [dropErr, setDropErr] = useState("");
  const [gapPx, setGapPx] = useState(0);        // 元データで検出した余白帯の幅
  const [gen, setGen] = useState(null);         // 合成した対向バージョン
  const [genGap, setGenGap] = useState(0);
  const [symScale, setSymScale] = useState(1);
  const [includeGen, setIncludeGen] = useState(true);

  const accept = (file) => {
    if (!file) return false;
    const ok = file.type.startsWith("image/") || /\.(svg|png|jpe?g)$/i.test(file.name);
    if (!ok) { setDropErr(`「${file.name}」は読み込めません。SVG / PNG / JPG を渡してください。`); return false; }
    setDropErr("");
    return true;
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer?.files?.[0];
    if (accept(file)) load(file);
  };

  const dragProps = {
    onDragEnter: (e) => { e.preventDefault(); setDrag(true); },
    onDragOver: (e) => { e.preventDefault(); setDrag(true); },
    onDragLeave: (e) => {
      // 子要素をまたぐ移動では解除しない
      if (e.currentTarget.contains(e.relatedTarget)) return;
      setDrag(false);
    },
    onDrop,
  };

  const load = async (file) => {
    const a0 = await readAsset(file);
    if (!a0) return;
    const img = await loadImage(a0.url);
    const a = analyzeSource(img);
    const gx = widestGap(profile(a.mask, a.w, a.h, "x"));
    const gy = widestGap(profile(a.mask, a.w, a.h, "y"));
    const rx = gx && gx.s >= 0 ? (gx.e - gx.s) / a.w : 0;
    const ry = gy && gy.s >= 0 ? (gy.e - gy.s) / a.h : 0;
    const useAxis = ry > rx ? "y" : "x";
    const g = useAxis === "x" ? gx : gy;
    const len = useAxis === "x" ? a.w : a.h;
    setSrc(a0); setAna(a); setAxis(useAxis);
    setTouched(false); setJustSaved([]);
    setSymScale(1);
    if (g && g.s >= 0) {
      const gw = g.e - g.s + 1;
      setPos(((g.s + g.e) / 2) / len);
      setGapPx(gw); setGenGap(gw);
      setNote(`${useAxis === "x" ? "縦" : "横"}方向の余白帯を検出（幅 ${gw}px）。`);
    } else {
      setPos(0.5);
      const fallback = Math.round(a.w * 0.04);
      setGapPx(fallback); setGenGap(fallback);
      setNote("明確な余白帯が見つかりません。要素が重なっている可能性があります。分割位置を手動で調整してください。");
    }
  };

  /* 分割・属性計測・役割推定 */
  const parts = useMemo(() => {
    if (!ana) return null;
    const { mask, w, h, canvas } = ana;
    const cut = Math.round((axis === "x" ? w : h) * pos);
    const rA = axis === "x" ? [0, Math.max(0, cut - 1), 0, h - 1] : [0, w - 1, 0, Math.max(0, cut - 1)];
    const rB = axis === "x" ? [Math.min(w - 1, cut), w - 1, 0, h - 1] : [0, w - 1, Math.min(h - 1, cut), h - 1];
    const mk = (rg) => {
      const bb = bboxIn(mask, w, h, ...rg);
      if (!bb) return null;
      const box = trim ? bb : { x: rg[0], y: rg[2], w: rg[1] - rg[0] + 1, h: rg[3] - rg[2] + 1 };
      const st = partStats(ana, box);
      return { url: cropUrl(canvas, box), aspect: box.w / box.h, isRaster: true, stats: st, infer: inferRole(st) };
    };
    const bbAll = bboxIn(mask, w, h, 0, w - 1, 0, h - 1);
    const whole = bbAll
      ? { url: cropUrl(canvas, bbAll), aspect: bbAll.w / bbAll.h, isRaster: true, stats: partStats(ana, bbAll) }
      : null;
    return { a: mk(rA), b: mk(rB), whole };
  }, [ana, axis, pos, trim]);

  /* 推定結果を役割の初期値に反映（手動変更後は上書きしない） */
  useEffect(() => {
    if (!parts || touched) return;
    const ra = parts.a?.infer?.role;
    const rb = parts.b?.infer?.role;
    if (!ra && !rb) return;
    // 両方が同じ役割に倒れたら、比率が大きい側を文字に振り分ける
    let na = ra || "symbol", nb = rb || "logotype";
    if (na === nb && parts.a && parts.b) {
      if (parts.a.aspect >= parts.b.aspect) { na = "logotype"; nb = "symbol"; }
      else { na = "symbol"; nb = "logotype"; }
    }
    setRoles({ a: na, b: nb });
  }, [parts, touched]);

  const lockupSlot = axis === "y" ? "lockupV" : "lockupH";
  const genSlot = axis === "y" ? "lockupH" : "lockupV";   // 元と逆の向き

  /* 対向バージョンの合成。役割割り当てに従ってシンボル／文字を並べ替える */
  useEffect(() => {
    let alive = true;
    if (!parts || !parts.a || !parts.b || !ana) { setGen(null); return; }
    const symKey = roles.a === "symbol" ? "a" : roles.b === "symbol" ? "b" : "a";
    const typKey = symKey === "a" ? "b" : "a";
    composeLockup(parts[symKey].url, parts[typKey].url, {
      vertical: axis === "x",           // 横組みが元なら縦を作る
      gap: genGap, symScale,
      bgCss: ana.bgCss, transparent: ana.transparentBg,
    }).then((r) => { if (alive) setGen(r); }).catch(() => { if (alive) setGen(null); });
    return () => { alive = false; };
  }, [parts, ana, axis, genGap, symScale, roles.a, roles.b]);

  /* 一括登録で何がどこへ入るか */
  const plan = useMemo(() => {
    if (!parts) return [];
    const out = [];
    if (parts.a) out.push({ part: parts.a, slot: roles.a, from: axis === "x" ? "左側" : "上側" });
    if (parts.b && roles.b !== roles.a) out.push({ part: parts.b, slot: roles.b, from: axis === "x" ? "右側" : "下側" });
    if (parts.whole) out.push({ part: parts.whole, slot: lockupSlot, from: "全体" });
    if (gen && includeGen) out.push({ part: gen, slot: genSlot, from: "自動生成", generated: true });
    return out;
  }, [parts, roles, axis, lockupSlot, gen, includeGen, genSlot]);

  const allSaved = plan.length > 0 && plan.every((p) => assets[p.slot] && justSaved.includes(p.slot));

  const saveOne = (partKey, slotKey) => {
    const part = partKey === "whole" ? parts.whole : parts[partKey];
    if (!part) return;
    const label = SLOTS.find((s) => s.key === slotKey)?.en || slotKey;
    // 組み合わせ全体の幅を 1 としたときの構成比。比例配分の推定に使う
    const wholeW = parts.whole?.stats?.px?.w;
    const fraction = wholeW ? part.stats.px.w / wholeW : null;
    onAssign(slotKey, { url: part.url, aspect: part.aspect, isRaster: true, name: `${src.name} / ${label}` }, fraction);
    setJustSaved((j) => [...new Set([...j, slotKey])]);
  };

  const saveGenerated = () => {
    if (!gen) return;
    onAssign(genSlot, {
      url: gen.url, aspect: gen.aspect, isRaster: true, generated: true,
      name: `${src.name} / ${genSlot === "lockupV" ? "Lockup V" : "Lockup H"}（自動生成）`,
    }, null);
    setJustSaved((j) => [...new Set([...j, genSlot])]);
  };

  const saveAll = () => {
    const done = [];
    if (parts.a) { saveOne("a", roles.a); done.push(roles.a); }
    if (parts.b && roles.b !== roles.a) { saveOne("b", roles.b); done.push(roles.b); }
    if (parts.whole) { saveOne("whole", lockupSlot); done.push(lockupSlot); }
    if (gen && includeGen) { saveGenerated(); done.push(genSlot); }
    setJustSaved(done);
  };

  // 描画中に作るコンポーネントは描画ごとに作り直され状態が消えるため、関数として呼ぶ（中でフックは使っていない）
  const renderPartCard = ({ part, side, roleKey }) => {
    if (!part) return (
      <div className="rounded-lg bg-white border border-neutral-200 p-3 flex items-center justify-center h-56">
        <span className="text-[10px] text-neutral-300">この側に要素がありません</span>
      </div>
    );
    const st = part.stats;
    const role = roles[roleKey];
    const inferred = part.infer;
    const saved = justSaved.includes(role) && assets[role];
    return (
      <div className="rounded-lg bg-white border border-neutral-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-neutral-700">{side}</span>
          {inferred && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
              {inferred.confident ? "自動判定" : "推定（要確認）"}
            </span>
          )}
        </div>

        <div className="h-20 flex items-center justify-center bg-neutral-50 border border-neutral-100 rounded-lg mb-2 p-2">
          <img src={part.url} alt="" style={{ maxHeight: 68, maxWidth: "100%" }} />
        </div>

        <div className="mb-2">
          <StatRow k="寸法" v={`${st.px.w}×${st.px.h}px`} />
          <StatRow k="縦横比" v={st.aspect.toFixed(2)} />
          <StatRow k="連結領域" v={st.components} note={st.components >= 6 ? "文字状" : "図形状"} />
          <StatRow k="色数" v={st.colors} note={st.sat > 0.25 ? "多色" : "単色系"} />
          <StatRow k="占有率" v={`${(st.coverage * 100).toFixed(0)}%`} />
        </div>

        {inferred && (
          <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">
            {inferred.why.join(" / ")} → {SLOTS.find((s) => s.key === inferred.role)?.label}と推定
          </p>
        )}

        <div className="flex gap-1 mb-2">
          {SLOTS.map((s) => (
            <button key={s.key}
              onClick={() => { setTouched(true); setRoles((r) => ({ ...r, [roleKey]: s.key })); }}
              className={`flex-1 inline-flex h-8 items-center justify-center rounded-full border px-1 text-[11px] font-medium transition-colors ${
                role === s.key ? "bg-ds-app-accent text-white border-ds-app-accent" : "border-border bg-background text-foreground hover:bg-muted"
              }`}>{s.label.replace("組み合わせ・", "組")}</button>
          ))}
        </div>

        <button onClick={() => saveOne(roleKey, role)}
          className={`w-full inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors ${
            saved ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "border border-input bg-background text-foreground hover:bg-accent"
          }`}>
          {saved ? `✓ ${SLOTS.find((s) => s.key === role)?.label}に登録済` : `${SLOTS.find((s) => s.key === role)?.label}に登録`}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div {...dragProps}
        className={`rounded-lg border-2 border-dashed transition-colors ${
          drag ? "border-ds-app-accent bg-blue-50" : "border-neutral-300 bg-white"
        } ${src ? "px-4 py-3" : "px-6 py-10"}`}>
        {src ? (
          <div className="flex flex-wrap items-center gap-3">
            <img src={src.url} alt="" style={{ maxHeight: 34, maxWidth: 160 }} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-neutral-700 truncate">{src.name}</div>
              <div className="text-[10px] text-neutral-400">
                {drag ? "ここに落とすと差し替えます" : "別のファイルをここにドロップしても差し替えられます"}
              </div>
            </div>
            <label className="cursor-pointer text-[10px] font-medium px-2.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 shrink-0">
              ファイルを選択
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,.svg" className="hidden"
                onChange={(e) => { const f = e.target.files[0]; if (accept(f)) load(f); }} />
            </label>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-neutral-600 font-medium">
              {drag ? "ここに落としてください" : "一体データをドラッグ＆ドロップ"}
            </p>
            <p className="text-[10px] text-neutral-400 mt-1">SVG / PNG / JPG</p>
            <label className="inline-block mt-3 cursor-pointer text-[11px] font-medium px-3 py-1.5 rounded-full bg-ds-app-accent text-white hover:bg-ds-app-accent-hover">
              ファイルを選択
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,.svg" className="hidden"
                onChange={(e) => { const f = e.target.files[0]; if (accept(f)) load(f); }} />
            </label>
          </div>
        )}
      </div>
      {dropErr && <p className="text-[10px] text-red-600">{dropErr}</p>}
      {note && <p className="text-[10px] text-neutral-500">{note}</p>}

      {ana && parts && (
        <>
          {/* 分割の調整 */}
          <div className="flex flex-wrap items-end gap-5 pt-1">
            <Field label="分割の向き">
              <div className="flex gap-1">
                {[["x", "縦線で割る"], ["y", "横線で割る"]].map(([k, l]) => (
                  <button key={k} onClick={() => setAxis(k)}
                    className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                      axis === k ? "bg-ds-app-accent text-white border-ds-app-accent" : "border-border bg-background text-foreground hover:bg-muted"
                    }`}>{l}</button>
                ))}
              </div>
            </Field>
            <Slider label="分割位置" val={Math.round(pos * 1000) / 10} set={(v) => setPos(v / 100)}
              min={2} max={98} step={0.1} unit="%" width="w-52" />
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-600 pb-1">
              <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} />
              外接矩形でトリミング
            </label>
          </div>

          <div className="relative inline-block border border-neutral-200 rounded-lg bg-white overflow-hidden max-w-full">
            <img src={src.url} alt="" style={{ display: "block", maxWidth: "100%", height: "auto" }} />
            <div style={{
              position: "absolute",
              ...(axis === "x"
                ? { left: `${pos * 100}%`, top: 0, bottom: 0, borderLeft: `2px dashed ${REG}` }
                : { top: `${pos * 100}%`, left: 0, right: 0, borderTop: `2px dashed ${REG}` }),
            }} />
          </div>

          {/* 検出結果 */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-semibold text-neutral-800">検出結果</h3>
              <button onClick={saveAll}
                className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                この内容で 3 版まとめて登録
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mb-3 leading-relaxed">
              属性から役割を推定しています。違っていればボタンで割り当て先を変えてください。個別に登録するか、まとめて登録できます。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {renderPartCard({ part: parts.a, side: axis === "x" ? "左側" : "上側", roleKey: "a" })}
              {renderPartCard({ part: parts.b, side: axis === "x" ? "右側" : "下側", roleKey: "b" })}

              {/* 全体 */}
              {parts.whole && (
                <div className="rounded-lg bg-white border border-neutral-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-neutral-700">全体</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
                      {axis === "y" ? "縦組み" : "横組み"}
                    </span>
                  </div>
                  <div className="h-20 flex items-center justify-center bg-neutral-50 border border-neutral-100 rounded-lg mb-2 p-2">
                    <img src={parts.whole.url} alt="" style={{ maxHeight: 68, maxWidth: "100%" }} />
                  </div>
                  <div className="mb-2">
                    <StatRow k="寸法" v={`${parts.whole.stats.px.w}×${parts.whole.stats.px.h}px`} />
                    <StatRow k="縦横比" v={parts.whole.aspect.toFixed(2)} />
                    <StatRow k="連結領域" v={parts.whole.stats.components} />
                    <StatRow k="色数" v={parts.whole.stats.colors} />
                    <StatRow k="占有率" v={`${(parts.whole.stats.coverage * 100).toFixed(0)}%`} />
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">
                    余白を除いた外接矩形。組み合わせ版として登録します。
                  </p>
                  <div className="h-[26px] mb-2" />
                  <button onClick={() => saveOne("whole", lockupSlot)}
                    className={`w-full inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors ${
                      justSaved.includes(lockupSlot) && assets[lockupSlot]
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "border border-input bg-background text-foreground hover:bg-accent"
                    }`}>
                    {justSaved.includes(lockupSlot) && assets[lockupSlot]
                      ? `✓ ${SLOTS.find((s) => s.key === lockupSlot)?.label}に登録済`
                      : `${SLOTS.find((s) => s.key === lockupSlot)?.label}に登録`}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 対向バージョンの自動生成 */}
          {gen && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-800">
                    {axis === "x" ? "縦組み" : "横組み"}の自動生成
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed max-w-xl">
                    切り出した2つのパーツを組み直して、元と逆向きのロックアップを作ります。
                    間隔の初期値は元データで検出した余白（{gapPx}px）です。
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-neutral-600 shrink-0">
                  <input type="checkbox" checked={includeGen} onChange={(e) => setIncludeGen(e.target.checked)} />
                  一括登録に含める
                </label>
              </div>

              <div className="flex flex-wrap gap-5">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 flex items-center justify-center"
                  style={{ minWidth: 160, minHeight: 140 }}>
                  <img src={gen.url} alt="" style={{ maxHeight: 120, maxWidth: 200 }} />
                </div>

                <div className="flex-1 min-w-[240px] space-y-3">
                  <Slider label="シンボルと文字の間隔" val={genGap} set={setGenGap}
                    min={0} max={Math.max(40, gapPx * 4)} step={1} unit="px" width="w-52" />
                  <Slider label="シンボルの拡大率" val={symScale} set={setSymScale}
                    min={0.5} max={5} step={0.05} unit="×" width="w-52" />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={() => { setGenGap(gapPx); setSymScale(1); }}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors border-border bg-background text-foreground hover:bg-muted">
                      初期値に戻す
                    </button>
                    <button onClick={saveGenerated}
                      className={`inline-flex h-9 items-center justify-center rounded-full px-3.5 text-xs font-medium transition-colors ${
                        justSaved.includes(genSlot) && assets[genSlot]
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "border border-input bg-background text-foreground hover:bg-accent"
                      }`}>
                      {justSaved.includes(genSlot) && assets[genSlot]
                        ? `✓ ${SLOTS.find((s) => s.key === genSlot)?.label}に登録済`
                        : `${SLOTS.find((s) => s.key === genSlot)?.label}に登録`}
                    </button>
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400">
                    {gen.px.w}×{gen.px.h}px · 比率 {gen.aspect.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  これは<span className="font-semibold">検討用のモック</span>です。実際の{axis === "x" ? "縦組み" : "横組み"}は、
                  間隔や要素の相対サイズが元の向きと同じとは限らず、光学的な中心合わせも施されます。
                  そもそも用意しないブランドもあります。「作るとしたら最小サイズはどのくらいか」の見積もりとして使い、
                  正式データが用意できたら差し替えてください。
                </p>
              </div>
            </div>
          )}

          {/* 登録状況 */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] font-medium text-neutral-600 mb-2">登録状況</div>
            <div className="flex flex-wrap gap-2">
              {SLOTS.map((s) => {
                const on = !!assets[s.key];
                return (
                  <span key={s.key}
                    className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1.5 ${
                      on ? "bg-white border border-emerald-200 text-emerald-700" : "bg-white border border-neutral-200 text-neutral-400"
                    }`}>
                    {on && <img src={assets[s.key].url} alt="" style={{ maxHeight: 12, maxWidth: 44 }} />}
                    {on ? "✓" : "—"} {s.label}
                    {on && assets[s.key].generated && <span className="text-amber-600">（生成）</span>}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <ul className="text-[10px] text-amber-800 space-y-1 leading-relaxed list-disc pl-4">
              <li>測定精度は元画像の解像度（横 {ana.w}px）に縛られます。最終数値はベクターでの再測定を推奨します。</li>
              <li>{ana.transparentBg
                ? "透過データのため、白抜き条件の測定も有効です。"
                : "背景が不透明なため、シンボル内部の白抜き部分も背景と同色として扱われます。白抜き条件を正確に測るには透過データが必要です。"}</li>
              <li>要素が重なるデザインでは自動検出が働きません。分割位置を手動で調整してください。</li>
            </ul>
          </div>

          {/* 画面下部の一括登録 */}
          {plan.length > 0 && (
            <div className={`rounded-lg border-2 p-4 ${
              allSaved ? "border-emerald-300 bg-emerald-50" : "border-ds-app-accent bg-blue-50"
            }`}>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <h3 className={`text-sm font-semibold ${allSaved ? "text-emerald-800" : "text-blue-900"}`}>
                  {allSaved ? "登録が完了しました" : "この内容で登録します"}
                </h3>
                <span className="text-[10px] text-neutral-500">{plan.length} 版</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                {plan.map((p, i) => {
                  const saved = assets[p.slot] && justSaved.includes(p.slot);
                  return (
                    <div key={i} className="rounded-lg bg-white border border-neutral-200 p-2 flex items-center gap-2">
                      <div className="w-12 h-10 flex items-center justify-center bg-neutral-50 rounded-lg shrink-0">
                        <img src={p.part.url} alt="" style={{ maxHeight: 32, maxWidth: 44 }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[11px] ${p.generated ? "text-amber-600" : "text-neutral-400"}`}>{p.from}</div>
                        <div className="text-[10px] font-medium text-neutral-800 truncate">
                          {SLOTS.find((s) => s.key === p.slot)?.label}
                        </div>
                      </div>
                      {saved && <span className="text-[11px] text-emerald-600 shrink-0">✓</span>}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={saveAll}
                  className="flex-1 min-w-[200px] inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                  {allSaved ? "同じ内容で登録し直す" : `${plan.length} 版をまとめて登録`}
                </button>
                {allSaved && onNext && (
                  <button onClick={onNext}
                    className="flex-1 min-w-[160px] inline-flex h-11 items-center justify-center rounded-full border border-input bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
                    測定へ進む →
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================ 2. 測定 ============================ */

function MeasureStep({
  assets, active, setActive, minima, setMinima, binding, setBinding,
  viewed, setViewed, ppmm, threshold, setThreshold, calibrated,
  composition, derived, setDerived,
}) {
  const [cond, setCond] = useState("onebit");
  const [scores, setScores] = useState({});
  const [busy, setBusy] = useState(false);

  const asset = assets[active];
  const recorded = minima[active];

  useEffect(() => { setScores({}); }, [active]);

  // 表示した条件は「確認済み」として記録しておく（全条件を見たかの目安）
  useEffect(() => {
    setViewed((v) => ({ ...v, [active]: { ...(v[active] || {}), [cond]: true } }));
  }, [active, cond, setViewed]);

  const run = async () => {
    setBusy(true);
    const r = await analyzeRetention(asset.url, asset.aspect, ppmm);
    setScores((s) => ({ ...s, [active]: r }));
    setBusy(false);
  };

  const list = scores[active];
  const suggestion = useMemo(() => list?.find((s) => s.score >= 0.93)?.mm ?? null, [list]);
  const dims = (mm) => ({ w: mm * ppmm, h: (mm * ppmm) / asset.aspect });

  /* 記録は版につき 1 値。いま見ている条件を「限界を決めた条件」として一緒に残す。
     同じサイズをもう一度押すと取り消し。値を undefined で残すと、仕様のサイズ帯チャートの
     最大値が NaN になり「まだ結果がない」の判定も効かなくなるので、キーごと消す */
  const record = (mm) => {
    const undo = recorded === mm;
    const without = (o) => { const n = { ...o }; delete n[active]; return n; };
    setMinima((m) => (undo ? without(m) : { ...m, [active]: mm }));
    setBinding((b) => (undo ? without(b) : { ...b, [active]: cond }));
    setDerived((d) => ({ ...d, [active]: false }));
  };

  /* 組み合わせの測定値から構成比で他の版を推定（得られるのは上限値） */
  const lockKey = ["lockupH", "lockupV"].find((k) => assets[k] && minima[k] != null);
  const lockBase = lockKey ? (composition[lockKey] || 1) : null;
  const derivable = lockKey
    ? SLOTS.filter((s) => s.key !== lockKey && assets[s.key] && composition[s.key] != null)
    : [];

  const deriveFromLockup = () => {
    if (!lockKey) return;
    const L = minima[lockKey];
    const nextMin = { ...minima }, nextBind = { ...binding }, nextDer = { ...derived };
    derivable.forEach((s) => {
      if (nextMin[s.key] != null && !nextDer[s.key]) return;   // 実測値は上書きしない
      nextMin[s.key] = Math.round(L * (composition[s.key] / lockBase) * 10) / 10;
      nextBind[s.key] = binding[lockKey];
      nextDer[s.key] = true;
    });
    setMinima(nextMin); setBinding(nextBind); setDerived(nextDer);
  };

  const viewedConds = CONDITIONS.filter((c) => viewed[active]?.[c.key]);
  const unviewed = CONDITIONS.filter((c) => !viewed[active]?.[c.key]);
  const bindLabel = CONDITIONS.find((c) => c.key === binding[active])?.label;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[190px_1fr] gap-5">
      {/* 版の切り替え */}
      <aside className="space-y-2">
        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">測定する版</div>
        {SLOTS.filter((s) => assets[s.key]).map((s) => {
          const g = minima[s.key];
          const on = active === s.key;
          const der = !!derived[s.key];
          return (
            <button key={s.key} onClick={() => setActive(s.key)}
              className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                on ? "border-ds-app-accent ring-1 ring-ds-app-accent bg-white" : "border-border bg-white hover:border-neutral-400"
              }`}>
              <div className="h-10 flex items-center justify-center mb-1.5">
                <img src={assets[s.key].url} alt="" style={{ maxHeight: 34, maxWidth: "100%" }} />
              </div>
              <div className="text-[10px] font-medium text-neutral-700">
                {s.label}
                {assets[s.key].generated && <span className="text-amber-600 ml-1">生成</span>}
              </div>
              <div className="text-[10px] font-mono mt-0.5"
                style={{ color: g == null ? "#d4d4d4" : der ? "#b45309" : "#111" }}>
                {g != null ? `${g}mm${der ? "*" : ""}` : "未測定"}
              </div>
            </button>
          );
        })}
      </aside>

      <div className="space-y-5">
        {!calibrated && (
          <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
            実寸未校正です。表示サイズが実際の mm とずれている可能性があります。
          </div>
        )}

        {lockKey && derivable.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-semibold text-blue-900">組み合わせから他の版を推定</h3>
                <p className="text-[10px] text-blue-800 mt-1 leading-relaxed max-w-xl">
                  組み合わせの測定値を、分割時に得た構成比で各版に配分します。
                  得られるのは<span className="font-semibold">上限値</span>で、実測すればこれより小さくなる可能性があります。
                  小サイズ運用が重要な版は測り直してください。
                </p>
              </div>
              <button onClick={deriveFromLockup}
                className="shrink-0 inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                推定値を入れる
              </button>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {derivable.map((s) => (
                <div key={s.key} className="text-[10px] bg-white rounded-full border border-blue-100 px-2.5 py-1.5">
                  <span className="text-neutral-500">{s.label}</span>
                  <span className="font-mono text-ds-app-accent ml-2">
                    幅比 {((composition[s.key] / lockBase) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Panel
          title={`${SLOTS.find((s) => s.key === active)?.label} の限界を探す`}
          desc="条件を切り替えて、最も早く破綻する見え方を探してください。記録するのは版につき 1 つの限界サイズです。"
          right={
            <button onClick={run} disabled={busy}
              className="inline-flex h-9 items-center justify-center rounded-full border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-40">
              {busy ? "解析中…" : "自動アシスト"}
            </button>
          }>
          {/* 条件の切り替え（見方であって記録の単位ではない） */}
          <div className="flex flex-wrap items-center gap-1 mb-1">
            {CONDITIONS.map((c) => {
              const on = cond === c.key;
              const seen = !!viewed[active]?.[c.key];
              const isBind = binding[active] === c.key;
              return (
                <button key={c.key} onClick={() => setCond(c.key)}
                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                    on ? "bg-ds-app-accent text-white border-ds-app-accent" : "border-border bg-background text-foreground hover:bg-muted"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    seen ? (on ? "bg-white" : "bg-blue-400") : (on ? "bg-blue-300" : "bg-neutral-300")
                  }`} />
                  {c.label}
                  {isBind && <span className={on ? "text-blue-100" : "text-neutral-400"}>◀</span>}
                </button>
              );
            })}
            {cond === "onebit" && (
              <div className="ml-2">
                <Slider label="しきい値" val={threshold} set={setThreshold} min={40} max={220} step={2} unit="" width="w-24" />
              </div>
            )}
          </div>
          <p className="text-[10px] text-neutral-400 mb-3">
            {unviewed.length === 0
              ? "全条件を確認済み。"
              : `未確認：${unviewed.map((c) => c.label).join("、")}`}
            {binding[active] && `　◀ が現在の限界を決めた条件（${bindLabel}）。`}
          </p>

          {/* ラダー */}
          <div className="text-[10px] text-neutral-400 mb-2">
            縦横比 {asset.aspect.toFixed(2)}　数値は<span className="text-neutral-600">幅</span>の mm。
            この版は幅 10mm のとき高さ {(10 / asset.aspect).toFixed(2)}mm。
          </div>
          <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg" style={{ background: condBg(cond) }}>
            {LADDER_MM.map((mm) => {
              const d = dims(mm);
              const sc = list?.find((s) => s.mm === mm)?.score;
              const isRec = recorded === mm;
              const isSug = suggestion === mm && recorded == null;
              return (
                <button key={mm} onClick={() => record(mm)}
                  className="flex flex-col items-center"
                  style={{
                    padding: 6, borderRadius: 4, minHeight: 34, justifyContent: "flex-end",
                    outline: isRec ? `2px solid ${REG}` : isSug ? `1px dashed ${REG2}` : "none",
                  }}>
                  <Render asset={asset} w={d.w} h={d.h} cond={cond} threshold={threshold} />
                  <span className="mt-2 text-[10px] font-mono"
                    style={{ color: cond === "knockout" ? "#a3a3a3" : "#737373" }}>{mm}</span>
                  {sc != null && (
                    <span className="text-[11px] font-mono"
                      style={{ color: sc >= 0.93 ? "#059669" : "#dc2626" }}>{(sc * 100).toFixed(0)}</span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[10px] text-neutral-400 leading-relaxed">
            数値は幅の mm。細線が消える・抜き文字が埋まる・形が識別できなくなる直前をクリックすると記録します（もう一度押すと解除）。
            記録は上書き式なので、より厳しい条件で破綻を見つけたらその条件のまま押し直してください。
            {list && " 下段の数字は形状保持スコアで、高解像度の基準像との一致率です。"}
            {suggestion != null && recorded == null && ` 自動アシストの示唆は ${suggestion}mm。`}
          </p>
        </Panel>

        {/* この版の記録 */}
        <Panel title="この版の記録">
          {recorded == null ? (
            <p className="text-[11px] text-neutral-400">まだ記録がありません。上のラダーから限界サイズを選んでください。</p>
          ) : (
            <div className="flex flex-wrap items-stretch gap-4">
              <div className="rounded-lg bg-white border p-3 min-w-[150px]"
                style={{ borderColor: REG, background: `${REG}0a` }}>
                <div className="text-[10px] text-neutral-500">最小使用サイズ</div>
                <div className="text-2xl font-mono mt-0.5"
                  style={{ color: derived[active] ? "#b45309" : "#111" }}>
                  {recorded}mm{derived[active] ? "*" : ""}
                </div>
                {derived[active] && <div className="text-[11px] text-amber-700 mt-0.5">推定（上限）</div>}
              </div>

              <div className="rounded-lg bg-white border border-neutral-200 p-3 min-w-[150px]">
                <div className="text-[10px] text-neutral-500">限界を決めた条件</div>
                <div className="text-base font-medium mt-1 text-neutral-800">{bindLabel || "—"}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  {CONDITIONS.find((c) => c.key === binding[active])?.hint}
                </div>
              </div>

              <div className="rounded-lg bg-white border border-neutral-200 p-3 flex-1 min-w-[180px]">
                <div className="text-[10px] text-neutral-500 mb-1.5">確認した条件</div>
                <div className="flex flex-wrap gap-1.5">
                  {CONDITIONS.map((c) => {
                    const seen = !!viewed[active]?.[c.key];
                    return (
                      <span key={c.key}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          seen ? "bg-neutral-100 text-neutral-600" : "bg-white border border-dashed border-neutral-200 text-neutral-300"
                        }`}>{c.label}</span>
                    );
                  })}
                </div>
                {unviewed.length > 0 && (
                  <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
                    未確認の条件が残っています。より厳しい条件で先に破綻する可能性があります。
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-white border border-neutral-200 p-3">
                <div className="text-[10px] text-neutral-500 mb-1.5">実寸</div>
                <div className="bg-white flex items-center" style={{ minHeight: 24 }}>
                  <Render asset={asset} w={recorded * ppmm} h={(recorded * ppmm) / asset.aspect}
                    cond={binding[active] || "color"} threshold={threshold} />
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}


/* ============================ 3. 規定 ============================ */

const CLEAR_BASES = [
  { key: "height", label: "ロゴの高さ", sym: "H" },
  { key: "width", label: "ロゴの幅", sym: "W" },
  { key: "symbolH", label: "シンボルの高さ", sym: "S" },
];

function RulesStep({ assets, minima, binding, clearRule, setClearRule, derived }) {
  const governing = minima;
  const symbolMin = governing.symbol;
  const typeMin = governing.logotype;
  const pair = symbolMin != null && typeMin != null;
  const theoretical = pair ? Math.max(symbolMin, typeMin) : null;
  // どちらの要素が組み合わせの下限を決めているか（props の binding とは別物）
  const constraintSide = pair ? (typeMin >= symbolMin ? "logotype" : "symbol") : null;
  const lockupMin = governing.lockupH ?? governing.lockupV;

  const basis = CLEAR_BASES.find((b) => b.key === clearRule.basis) || CLEAR_BASES[0];
  const previewAsset = assets.lockupH || assets.lockupV || assets.symbol || assets.logotype;

  if (!Object.keys(governing).length) {
    return <Empty>まだ測定結果がありません。測定ステップで各版の限界を記録すると、ここにルールが導出されます。</Empty>;
  }

  return (
    <div className="space-y-5">
      <Panel title="最小サイズ規定" desc="測定値の一覧です。規定値は各版の条件別測定のうち最も大きい値を採ります。">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-neutral-400 text-[10px]">
                <th className="text-left font-medium py-2 pr-4">版</th>
                <th className="text-right font-medium py-2 px-4">最小使用サイズ</th>
                <th className="text-left font-medium py-2 px-4">限界を決めた条件</th>
                <th className="text-left font-medium py-2 pl-4">根拠</th>
              </tr>
            </thead>
            <tbody>
              {SLOTS.filter((s) => assets[s.key]).map((s) => {
                const v = governing[s.key];
                const der = !!derived?.[s.key];
                return (
                  <tr key={s.key} className="border-t border-neutral-100">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-16 h-6 flex items-center justify-start shrink-0">
                          <img src={assets[s.key].url} alt="" style={{ maxHeight: 24, maxWidth: 64 }} />
                        </span>
                        <span className="text-neutral-700">{s.label}</span>
                      </div>
                    </td>
                    <td className="text-right font-mono px-4 font-semibold"
                      style={{ color: v == null ? "#d4d4d4" : der ? "#b45309" : "#111" }}>
                      {v != null ? `${v}mm${der ? "*" : ""}` : "—"}
                    </td>
                    <td className="px-4 text-neutral-600">
                      {CONDITIONS.find((c) => c.key === binding?.[s.key])?.label || "—"}
                    </td>
                    <td className="pl-4">
                      <div className="flex flex-wrap gap-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          v == null ? "text-neutral-300"
                            : der ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-600"
                        }`}>{v == null ? "未測定" : der ? "推定（上限）" : "実測"}</span>
                        {assets[s.key].generated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">自動生成</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {SLOTS.some((s) => assets[s.key]?.generated) && (
          <p className="text-[10px] text-amber-700 mt-3 leading-relaxed">
            自動生成の版は切り出したパーツを組み直した検討用モックです。正式なデータに差し替えたうえで測り直してください。
          </p>
        )}
        {Object.values(derived || {}).some(Boolean) && (
          <p className="text-[10px] text-amber-700 mt-3 leading-relaxed">
            * は組み合わせの測定値から構成比で配分した推定値です。実力の<span className="font-semibold">上限</span>を示すもので、実測すればこれより小さくなる可能性があります。
          </p>
        )}
      </Panel>

      <Panel title="組み合わせの制約要因"
        desc="ロックアップの下限は構成要素のうち最も早く破綻する側で決まります。">
        {!pair ? (
          <p className="text-[11px] text-neutral-400">
            シンボルマークとロゴタイプの両方を測定すると、制約要因が判定されます。
          </p>
        ) : (
          <>
            <div className="flex gap-3 mb-4">
              {[["symbol", "シンボルマーク", symbolMin], ["logotype", "ロゴタイプ", typeMin]].map(([k, label, v]) => (
                <div key={k} className="flex-1 rounded-lg bg-white p-3 border"
                  style={{ borderColor: constraintSide === k ? REG : "#e5e5e5", background: constraintSide === k ? `${REG}0a` : "#fff" }}>
                  <div className="text-[10px] text-neutral-500">{label}</div>
                  <div className="text-lg font-mono mt-0.5">{v}mm</div>
                  {constraintSide === k && <div className="text-[10px] mt-1 font-medium" style={{ color: REG }}>← 制約側</div>}
                </div>
              ))}
            </div>
            {(derived?.symbol || derived?.logotype) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  {derived?.symbol && derived?.logotype
                    ? "両方とも推定値のため、制約要因の判定は構成比をなぞっているだけで根拠になりません。少なくとも一方を実測してください。"
                    : `${derived?.symbol ? "シンボルマーク" : "ロゴタイプ"}が推定値です。実測すると制約要因の判定が変わる可能性があります。`}
                </p>
              </div>
            )}
            <div className="rounded-lg bg-slate-900 text-white p-4">
              <div className="text-[10px] text-neutral-400">組み合わせの理論下限</div>
              <div className="text-2xl font-mono mt-1">{theoretical}mm</div>
              <p className="text-[11px] text-neutral-300 mt-2 leading-relaxed">
                {constraintSide === "logotype"
                  ? "ロゴタイプ側が先に破綻します。これを下回る場面ではシンボルマーク単体の使用を規定してください。"
                  : "シンボルマーク側が先に破綻します。図形の内部形状が文字より弱いケースで、アイコン用に簡略版を用意する価値があります。"}
              </p>
              {lockupMin != null && lockupMin !== theoretical && (
                <p className="text-[11px] mt-2 leading-relaxed"
                  style={{ color: lockupMin < theoretical ? "#fca5a5" : "#a7f3d0" }}>
                  実測した組み合わせの下限は {lockupMin}mm。
                  {lockupMin < theoretical ? "理論値を下回っています。測定条件を見直してください。" : "理論値より余裕を見た値です。"}
                </p>
              )}
            </div>
            {symbolMin < typeMin && (
              <div className="mt-3 rounded-lg bg-white border border-neutral-200 p-3">
                <div className="text-[11px] font-medium text-neutral-700 mb-1">小サイズ運用の切り替え帯</div>
                <p className="text-[10px] text-neutral-500 leading-relaxed">
                  {symbolMin}mm 〜 {typeMin}mm はシンボルマーク単体のみが使える領域です。
                  この帯での組み合わせ使用を禁止としてガイドラインに明記すると運用が安定します。
                </p>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel title="クリアスペース規定"
        desc="これは測定で見つかる限界ではなく、こちらが決める規定です。基準ユニットを何に取るかでガイドラインの読みやすさが変わります。">
        <div className="flex flex-wrap items-end gap-5 mb-4">
          <Field label="基準ユニット">
            <div className="flex gap-1">
              {CLEAR_BASES.map((b) => (
                <button key={b.key} onClick={() => setClearRule({ ...clearRule, basis: b.key })}
                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                    clearRule.basis === b.key ? "bg-ds-app-accent text-white border-ds-app-accent" : "border-border bg-background text-foreground hover:bg-muted"
                  }`}>{b.label}</button>
              ))}
            </div>
          </Field>
          <Slider label="余白の倍率" val={clearRule.ratio} set={(v) => setClearRule({ ...clearRule, ratio: v })}
            min={0} max={1.5} step={0.05} unit={` × ${basis.sym}`} width="w-52" />
        </div>

        {previewAsset && <ClearPreview asset={previewAsset} ratio={clearRule.ratio} sym={basis.sym} />}

        <p className="mt-3 text-[10px] text-neutral-400 leading-relaxed">
          シアンがロゴの外接、マゼンタがクリアスペース境界。規定文は「{basis.label}を {basis.sym} としたとき、周囲に {clearRule.ratio.toFixed(2)}{basis.sym} 以上の余白を確保する」となります。
        </p>
      </Panel>
    </div>
  );
}

function ClearPreview({ asset, ratio, sym }) {
  const logoH = 110;
  const logoW = logoH * asset.aspect;
  const pad = logoH * ratio;
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 flex justify-center overflow-x-auto">
      <div style={{ position: "relative", width: logoW + pad * 2, height: logoH + pad * 2, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: 0, border: `1px dashed ${REG}`, background: `${REG}0d` }} />
        <div style={{ position: "absolute", left: pad, top: pad, width: logoW, height: logoH, outline: `1px solid ${REG2}` }}>
          <img src={asset.url} alt="" style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
        {pad > 14 && (
          <div style={{ position: "absolute", left: 0, top: pad / 2 - 6, width: pad, textAlign: "center",
            fontSize: 10, fontFamily: "ui-monospace, monospace", color: REG }}>
            {ratio.toFixed(2)}{sym}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ 4. 検証 ============================ */

function fitSquare(aspect, size, insetPct) {
  const avail = size * (1 - insetPct / 100);
  return aspect >= 1 ? { w: avail, h: avail / aspect } : { w: avail * aspect, h: avail };
}

function AppIcon({ asset, size, inset, bg, radius = 0.2237, circle = false }) {
  const d = fitSquare(asset.aspect, size, inset);
  return (
    <div style={{
      width: size, height: size, background: bg,
      borderRadius: circle ? "50%" : size * radius,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.2)", flexShrink: 0,
    }}>
      <img src={asset.url} alt="" style={{ width: d.w, height: d.h, display: "block" }} />
    </div>
  );
}

function choose(assets, governing, availMm, order) {
  for (const k of order) {
    if (!assets[k]) continue;
    const m = governing[k];
    if (m == null) return { key: k, status: "unmeasured" };
    if (m <= availMm) return { key: k, status: "ok", min: m };
  }
  const fallback = order.find((k) => assets[k]);
  return { key: fallback || null, status: "none" };
}

/* 特定の版を強制したときの判定（choose と同じ rec 形）。
   自動選択ではなくユーザーが版を指定した場合に使う。収まらなければ status:"over"。 */
function evalSlot(assets, governing, availMm, k) {
  if (!k || !assets[k]) return { key: k || null, status: "none" };
  const m = governing[k];
  if (m == null) return { key: k, status: "unmeasured" };
  return { key: k, status: m <= availMm ? "ok" : "over", min: m };
}

function Verdict({ rec, availMm }) {
  const label = SLOTS.find((s) => s.key === rec.key)?.label;
  const base = "text-[10px] px-2 py-1 rounded-full whitespace-nowrap";
  if (rec.status === "none")
    return <span className={`${base} bg-red-50 text-red-700`}>実効 {availMm.toFixed(1)}mm — 収まる版なし</span>;
  if (rec.status === "unmeasured")
    return <span className={`${base} bg-amber-50 text-amber-700`}>{label} — 未測定</span>;
  if (rec.status === "over")
    return <span className={`${base} bg-red-50 text-red-700`}>{label} — 実効 {availMm.toFixed(1)}mm ＜ 規定 {rec.min}mm（小さすぎ）</span>;
  return <span className={`${base} bg-emerald-50 text-emerald-700`}>{label} — 実効 {availMm.toFixed(1)}mm ≥ 規定 {rec.min}mm</span>;
}

function VerifyStep({ assets, governing, ppmm, scene, setScene, clearRule }) {
  const set = (k, v) => setScene({ ...scene, [k]: v });
  const iconPx = Math.round(ICON_MM * ppmm);
  const iconAvail = ICON_MM * (1 - scene.iconInset / 100);
  const favAvail = 16 / ppmm;

  const recIcon = choose(assets, governing, iconAvail, ["symbol", "lockupV", "lockupH"]);
  const recFav = choose(assets, governing, favAvail, ["symbol", "lockupV", "lockupH"]);
  const hdrKey = ["lockupH", "logotype", "symbol"].find((k) => assets[k]);
  const hdrAspect = hdrKey ? assets[hdrKey].aspect : 1;
  const hdrAvail = (scene.headerH * hdrAspect) / ppmm;
  const recHdr = choose(assets, governing, hdrAvail, ["lockupH", "logotype", "symbol"]);
  // 名刺の版は「自動」か、ユーザーが指定した版。cardChoices はアップロード済みの版のみ。
  const cardSlot = scene.cardSlot || "auto";
  const cardChoices = SLOTS.filter((s) => assets[s.key]);
  const recCard = cardSlot === "auto"
    ? choose(assets, governing, scene.cardLogoMm, ["lockupH", "lockupV", "symbol"])
    : evalSlot(assets, governing, scene.cardLogoMm, cardSlot);

  const A = (rec) => (rec.key && assets[rec.key]) || null;
  const iconAsset = A(recIcon), favAsset = A(recFav), hdrAsset = A(recHdr), cardAsset = A(recCard);
  const SW = ["#ffffff", "#111111", "#1e3a5f", "#e8e4dc"];

  return (
    <div className="space-y-5">
      {/* スマホアイコン */}
      <Panel title="スマホアイコン" desc={`iOS ホーム画面の実寸 ${ICON_MM}mm 角を基準に表示しています。`}
        right={<Verdict rec={recIcon} availMm={iconAvail} />}>
        <div className="flex flex-wrap items-end gap-5 mb-4">
          <Slider label="アイコン内の余白" val={scene.iconInset} set={(v) => set("iconInset", v)} min={0} max={40} step={1} unit="%" />
          <Field label="地色">
            <div className="flex gap-1.5">
              {SW.map((c) => (
                <button key={c} onClick={() => set("iconBg", c)} aria-label={c} style={{ background: c }}
                  className={`w-8 h-8 rounded-full border ${scene.iconBg === c ? "ring-2 ring-ds-app-accent ring-offset-1" : "border-neutral-300"}`} />
              ))}
              <input type="color" value={scene.iconBg} onChange={(e) => set("iconBg", e.target.value)}
                className="w-6 h-6 rounded-lg bg-white border border-neutral-300 p-0 cursor-pointer" />
            </div>
          </Field>
        </div>

        {iconAsset && (
          <div className="flex flex-wrap gap-6">
            <div className="rounded-xl p-4" style={{ background: "linear-gradient(150deg,#5b6b8c,#2f3a52 60%,#1b2030)" }}>
              <div className="grid grid-cols-4 gap-3">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    {i === 5
                      ? <AppIcon asset={iconAsset} size={iconPx} inset={scene.iconInset} bg={scene.iconBg} />
                      : <div style={{ width: iconPx, height: iconPx, borderRadius: iconPx * 0.2237, background: "rgba(255,255,255,.16)" }} />}
                    <span className={`text-[8px] ${i === 5 ? "text-white/90" : "text-white/40"}`}>{i === 5 ? "検証中" : "アプリ"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-neutral-400 mb-2">サイズ展開</div>
                <div className="flex items-end gap-4">
                  {[[iconPx, "ホーム"], [40, "設定"], [29, "通知"], [20, "検索"]].map(([s, l]) => (
                    <div key={l} className="flex flex-col items-center gap-1.5">
                      <AppIcon asset={iconAsset} size={s} inset={scene.iconInset} bg={scene.iconBg} />
                      <span className="text-[11px] font-mono text-neutral-400">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-400 mb-2">
                  Android アダプティブ（セーフゾーン {Math.round(ANDROID_SAFE * 100)}%）
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex flex-col items-center gap-1.5">
                    <AppIcon asset={iconAsset} size={iconPx} inset={scene.iconInset} bg={scene.iconBg} circle />
                    <span className="text-[11px] font-mono text-neutral-400">円</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div style={{ position: "relative" }}>
                      <AppIcon asset={iconAsset} size={iconPx} inset={scene.iconInset} bg={scene.iconBg} radius={0.1} />
                      <div style={{
                        position: "absolute", left: "50%", top: "50%",
                        width: iconPx * ANDROID_SAFE, height: iconPx * ANDROID_SAFE,
                        transform: "translate(-50%,-50%)", border: `1px dashed ${REG}`, borderRadius: "50%",
                      }} />
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400">セーフゾーン</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* ウェブヘッダー */}
      <Panel title="ウェブヘッダー" right={<Verdict rec={recHdr} availMm={hdrAvail} />}>
        <div className="mb-4">
          <Slider label="ヘッダー内ロゴ高さ" val={scene.headerH} set={(v) => set("headerH", v)}
            min={14} max={64} step={1} unit="px" sub={`幅 ${hdrAvail.toFixed(1)}mm`} />
        </div>
        {hdrAsset && [false, true].map((dark) => (
          <div key={String(dark)} className="mb-2 rounded-lg bg-white overflow-hidden border border-neutral-200">
            <div className="flex items-center justify-between px-5"
              style={{ background: dark ? "#111" : "#fff", height: Math.max(56, scene.headerH + 28),
                borderBottom: `1px solid ${dark ? "#2a2a2a" : "#e5e5e5"}` }}>
              <img src={hdrAsset.url} alt=""
                style={{ height: scene.headerH, width: scene.headerH * hdrAsset.aspect, display: "block",
                  filter: dark ? FILTERS.knockout : "none" }} />
              <nav className="flex items-center gap-5">
                {["事業内容", "実績", "会社概要", "お問い合わせ"].map((t) => (
                  <span key={t} className="text-[11px]" style={{ color: dark ? "#d4d4d4" : "#404040" }}>{t}</span>
                ))}
              </nav>
            </div>
          </div>
        ))}
      </Panel>

      {/* ファビコン */}
      <Panel title="ファビコン" desc={`16px は実寸 ${favAvail.toFixed(1)}mm 相当。ここで判別できない場合は専用の切り出しが必要です。`}
        right={<Verdict rec={recFav} availMm={favAvail} />}>
        {favAsset && (
          <>
            <div className="rounded-t pt-2 px-2" style={{ background: "#dee1e6" }}>
              <div className="flex items-end gap-1">
                <div className="flex items-center gap-2 px-3 rounded-t-lg" style={{ background: "#fff", height: 32, minWidth: 190 }}>
                  <img src={favAsset.url} alt="" style={{ width: 16, height: 16 / favAsset.aspect }} />
                  <span className="text-[11px] text-neutral-700 truncate">コーポレートサイト</span>
                  <span className="text-neutral-400 text-[11px] ml-auto">×</span>
                </div>
                <div className="flex items-center gap-2 px-3 rounded-t-lg" style={{ background: "#c9cdd3", height: 28, minWidth: 140 }}>
                  <div className="w-4 h-4 rounded-sm bg-neutral-400/60" />
                  <span className="text-[11px] text-neutral-600">別のタブ</span>
                </div>
              </div>
            </div>
            <div className="border border-t-0 border-neutral-200 rounded-b p-4 flex items-end gap-5 flex-wrap">
              {[16, 24, 32, 48].map((s) => (
                <div key={s} className="flex flex-col items-center gap-1.5">
                  <div className="border border-neutral-200 p-1.5 bg-white">
                    <img src={favAsset.url} alt="" style={{ width: s, height: s / favAsset.aspect, display: "block" }} />
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">{s}px</span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-1.5">
                <div className="border border-neutral-200 p-1.5" style={{ background: "#111" }}>
                  <img src={favAsset.url} alt="" style={{ width: 16, height: 16 / favAsset.aspect, display: "block", filter: FILTERS.knockout }} />
                </div>
                <span className="text-[11px] font-mono text-neutral-400">16px 暗</span>
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* 名刺 */}
      <Panel title="名刺" desc={`${CARD_W_MM}×${CARD_H_MM}mm を実寸表示。ロゴが最も小さく印刷される代表例です。`}
        right={<Verdict rec={recCard} availMm={scene.cardLogoMm} />}>
        <div className="flex flex-wrap items-end gap-5 mb-4">
          <Field label="名刺に載せる版" hint={cardSlot === "auto" ? "収まる版を自動で選択中" : undefined}>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => set("cardSlot", "auto")}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                  cardSlot === "auto" ? "bg-ds-app-accent text-white border-ds-app-accent" : "border-border bg-background text-foreground hover:bg-muted"
                }`}>自動</button>
              {cardChoices.map((s) => (
                <button key={s.key} onClick={() => set("cardSlot", s.key)}
                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                    cardSlot === s.key ? "bg-ds-app-accent text-white border-ds-app-accent" : "border-border bg-background text-foreground hover:bg-muted"
                  }`}>{s.label.replace("組み合わせ・", "組")}</button>
              ))}
            </div>
          </Field>
          <Slider label="名刺上のロゴ幅" val={scene.cardLogoMm} set={(v) => set("cardLogoMm", v)}
            min={5} max={45} step={0.5} unit="mm" />
        </div>
        {cardAsset && (
          <div className="flex justify-center py-4 overflow-x-auto" style={{ background: "#f0efed" }}>
            <div style={{ width: CARD_W_MM * ppmm, height: CARD_H_MM * ppmm, background: "#fff",
              boxShadow: "0 1px 6px rgba(0,0,0,.15)", position: "relative", padding: 6 * ppmm,
              boxSizing: "border-box", flexShrink: 0 }}>
              <img src={cardAsset.url} alt=""
                style={{ width: scene.cardLogoMm * ppmm, height: (scene.cardLogoMm * ppmm) / cardAsset.aspect, display: "block" }} />
              <div style={{ position: "absolute", left: 6 * ppmm, bottom: 6 * ppmm }}>
                <div style={{ fontSize: 4 * ppmm, color: "#111" }}>山田 太郎</div>
                <div style={{ fontSize: 2.2 * ppmm, color: "#666", marginTop: 1.5 * ppmm, lineHeight: 1.6 }}>
                  ブランドデザイン部 / ディレクター<br />taro@example.com · 044-000-0000
                </div>
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ============================ 5. 仕様 ============================ */

/* 各シーンの実効サイズと推奨版 */
function buildSceneRows(assets, governing, ppmm, scene) {
  const iconAvail = ICON_MM * (1 - scene.iconInset / 100);
  const favAvail = 16 / ppmm;
  const hdrKey = ["lockupH", "logotype", "symbol"].find((k) => assets[k]);
  const hdrAvail = hdrKey ? (scene.headerH * assets[hdrKey].aspect) / ppmm : 0;
  const S = ["symbol", "lockupV", "lockupH"];
  const L = ["lockupH", "logotype", "symbol"];
  return [
    { key: "favicon", label: "ファビコン", detail: "16px", avail: favAvail, rec: choose(assets, governing, favAvail, S) },
    { key: "appicon", label: "アプリアイコン", detail: `${ICON_MM}mm角 / 内側 ${100 - scene.iconInset}%`, avail: iconAvail, rec: choose(assets, governing, iconAvail, S) },
    { key: "header", label: "ウェブヘッダー", detail: `高さ ${scene.headerH}px`, avail: hdrAvail, rec: choose(assets, governing, hdrAvail, L) },
    // 名刺は検証ステップで選んだ版に合わせる（自動のときだけ収まる版を選ぶ）。仕様と検証で推奨がずれないように
    { key: "card", label: "名刺", detail: `${CARD_W_MM}×${CARD_H_MM}mm`, avail: scene.cardLogoMm,
      rec: (scene.cardSlot || "auto") === "auto"
        ? choose(assets, governing, scene.cardLogoMm, ["lockupH", "lockupV", "symbol"])
        : evalSlot(assets, governing, scene.cardLogoMm, scene.cardSlot) },
  ];
}

/* サイズ帯チャート：どのサイズから、どの版が使えるか */
function SizeBandChart({ assets, governing, rows, maxMm }) {
  const items = SLOTS.filter((s) => assets[s.key] && governing[s.key] != null);
  if (!items.length) return null;
  const W = 700, padL = 104, padR = 16, padT = 30, padB = 38, rowH = 32;
  const H = padT + items.length * rowH + padB;
  const x = (mm) => padL + (mm / maxMm) * (W - padL - padR);
  const step = maxMm > 40 ? 10 : 5;
  const ticks = [];
  for (let m = 0; m <= maxMm; m += step) ticks.push(m);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ maxWidth: "100%", height: "auto" }}>
        {/* 目盛り */}
        {ticks.map((m) => (
          <g key={m}>
            <line x1={x(m)} y1={padT - 6} x2={x(m)} y2={H - padB + 4} stroke="#e5e5e5" strokeWidth="1" />
            <text x={x(m)} y={H - padB + 16} fontSize="9" fill="#a3a3a3" textAnchor="middle" fontFamily="ui-monospace, monospace">{m}</text>
          </g>
        ))}
        <text x={W - padR} y={H - padB + 30} fontSize="9" fill="#a3a3a3" textAnchor="end">幅 mm</text>

        {/* 版ごとの使用可否帯 */}
        {items.map((s, i) => {
          const min = governing[s.key];
          const y = padT + i * rowH;
          return (
            <g key={s.key}>
              <text x={padL - 8} y={y + 13} fontSize="10" fill="#404040" textAnchor="end">{s.label}</text>
              <rect x={x(0)} y={y} width={x(min) - x(0)} height={18} fill="#fee2e2" />
              <rect x={x(min)} y={y} width={x(maxMm) - x(min)} height={18} fill="#dbeafe" />
              <line x1={x(min)} y1={y - 3} x2={x(min)} y2={y + 21} stroke="#2563eb" strokeWidth="2" />
              <text x={x(min) + 5} y={y + 13} fontSize="10" fill="#1d4ed8" fontFamily="ui-monospace, monospace" fontWeight="600">{min}mm〜</text>
            </g>
          );
        })}

        {/* 使用シーンの実効サイズ */}
        {rows.filter((r) => r.avail > 0 && r.avail <= maxMm).map((r, i) => (
          <g key={r.label}>
            <line x1={x(r.avail)} y1={padT - 8} x2={x(r.avail)} y2={H - padB} stroke={REG} strokeWidth="1" strokeDasharray="3 2" />
            <text x={x(r.avail)} y={padT - 12} fontSize="9" fill={REG} textAnchor="middle">{r.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* 実寸見本用の mm ルーラー */
function MmRuler({ mm, ppmm }) {
  const w = mm * ppmm;
  const t = [];
  for (let i = 0; i <= mm; i++) {
    const major = i % 5 === 0;
    t.push(<line key={i} x1={i * ppmm} y1={major ? 2 : 6} x2={i * ppmm} y2={11} stroke="#a3a3a3" strokeWidth={major ? 1 : 0.5} />);
  }
  return (
    <svg width={w} height={13} style={{ display: "block", overflow: "visible" }}>
      <line x1="0" y1="11" x2={w} y2="11" stroke="#a3a3a3" strokeWidth="0.75" />
      {t}
      <text x={w + 4} y="11" fontSize="8" fill="#a3a3a3" fontFamily="ui-monospace, monospace">{mm}mm</text>
    </svg>
  );
}

/* ガイドライン掲載用のシーン図版（検証タブより簡潔に、図として成立する体裁で） */
function ScenePlate({ sceneKey, asset, ppmm, scene }) {
  if (!asset) return <div className="text-[10px] text-neutral-300 py-6 text-center">該当する版がありません</div>;

  if (sceneKey === "appicon") {
    const px = Math.round(ICON_MM * ppmm);
    return (
      <div className="flex items-end gap-4 justify-center py-3">
        {[
          { circle: false, cap: "iOS" },
          { circle: true, cap: "Android" },
        ].map((v) => (
          <div key={v.cap} className="flex flex-col items-center gap-1.5">
            <AppIcon asset={asset} size={px} inset={scene.iconInset} bg={scene.iconBg} circle={v.circle} />
            <span className="text-[11px] font-mono text-neutral-400">{v.cap}</span>
          </div>
        ))}
        <div className="flex flex-col items-center gap-1.5">
          <div style={{ position: "relative" }}>
            <AppIcon asset={asset} size={px} inset={scene.iconInset} bg={scene.iconBg} radius={0.1} />
            <div style={{
              position: "absolute", left: "50%", top: "50%",
              width: px * ANDROID_SAFE, height: px * ANDROID_SAFE,
              transform: "translate(-50%,-50%)", border: `1px dashed ${REG}`, borderRadius: "50%",
            }} />
          </div>
          <span className="text-[11px] font-mono text-neutral-400">セーフゾーン</span>
        </div>
      </div>
    );
  }

  if (sceneKey === "header") {
    return (
      <div className="space-y-1.5 py-2">
        {[false, true].map((dark) => (
          <div key={String(dark)} className="rounded-lg bg-white overflow-hidden border border-neutral-200">
            <div className="flex items-center justify-between px-4"
              style={{ background: dark ? "#111" : "#fff", height: Math.max(48, scene.headerH + 24) }}>
              <img src={asset.url} alt=""
                style={{ height: scene.headerH, width: scene.headerH * asset.aspect, display: "block",
                  filter: dark ? FILTERS.knockout : "none" }} />
              <nav className="flex items-center gap-4">
                {["事業内容", "実績", "会社概要"].map((t) => (
                  <span key={t} className="text-[10px]" style={{ color: dark ? "#d4d4d4" : "#404040" }}>{t}</span>
                ))}
              </nav>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sceneKey === "favicon") {
    return (
      <div className="py-2">
        <div className="rounded-t pt-1.5 px-1.5" style={{ background: "#dee1e6" }}>
          <div className="flex items-end gap-1">
            <div className="flex items-center gap-2 px-2.5 rounded-t-lg" style={{ background: "#fff", height: 28, minWidth: 170 }}>
              <img src={asset.url} alt="" style={{ width: 16, height: 16 / asset.aspect }} />
              <span className="text-[10px] text-neutral-700 truncate">コーポレートサイト</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 rounded-t-lg" style={{ background: "#c9cdd3", height: 24, minWidth: 110 }}>
              <div className="w-3.5 h-3.5 rounded-sm bg-neutral-400/60" />
              <span className="text-[10px] text-neutral-600">別のタブ</span>
            </div>
          </div>
        </div>
        <div className="border border-t-0 border-neutral-200 rounded-b p-3 flex items-end gap-4 flex-wrap bg-white">
          {[16, 32, 48].map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <img src={asset.url} alt="" style={{ width: s, height: s / asset.aspect, display: "block" }} />
              <span className="text-[11px] font-mono text-neutral-400">{s}px</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <div className="p-1" style={{ background: "#111" }}>
              <img src={asset.url} alt="" style={{ width: 16, height: 16 / asset.aspect, display: "block", filter: FILTERS.knockout }} />
            </div>
            <span className="text-[11px] font-mono text-neutral-400">16px 暗</span>
          </div>
        </div>
      </div>
    );
  }

  // 名刺（実寸）
  const w = CARD_W_MM * ppmm, h = CARD_H_MM * ppmm;
  return (
    <div className="flex justify-center py-3 overflow-x-auto">
      <div style={{ width: w, height: h, background: "#fff", border: "1px solid #e5e5e5",
        boxShadow: "0 1px 4px rgba(0,0,0,.1)", position: "relative", padding: 6 * ppmm,
        boxSizing: "border-box", flexShrink: 0 }}>
        <img src={asset.url} alt=""
          style={{ width: scene.cardLogoMm * ppmm, height: (scene.cardLogoMm * ppmm) / asset.aspect, display: "block" }} />
        <div style={{ position: "absolute", left: 6 * ppmm, bottom: 6 * ppmm }}>
          <div style={{ fontSize: 4 * ppmm, color: "#111" }}>山田 太郎</div>
          <div style={{ fontSize: 2.2 * ppmm, color: "#666", marginTop: 1.5 * ppmm, lineHeight: 1.6 }}>
            ブランドデザイン部 / ディレクター<br />taro@example.com · 044-000-0000
          </div>
        </div>
      </div>
    </div>
  );
}

/* 版一覧カード用の部品。他案（一覧行型・共通スケール型）へ差し替え可能なよう
   バッジ・実寸見本はカード内に直書きせず独立させる。 */
function VerBadges({ v, der, generated }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
        v == null ? "text-neutral-300" : der ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-600"
      }`}>{v == null ? "未測定" : der ? "推定（上限）" : "実測"}</span>
      {generated && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">自動生成</span>
      )}
    </div>
  );
}

function ActualSample({ asset, mm, ppmm }) {
  if (mm == null) return null;
  const w = mm * ppmm;                       // クランプしない（測定結果そのものを潰さない）
  return (
    <div className="flex flex-col gap-1">
      <div className="bg-white border border-neutral-200 px-2 py-1.5 flex items-center"
        style={{ minHeight: 26 }}>           {/* 高さの確保は親要素で */}
        <img src={asset.url} alt=""
          style={{ width: w, height: w / asset.aspect, display: "block" }} />
      </div>
      <MmRuler mm={mm} ppmm={ppmm} />
    </div>
  );
}

function VersionsCards({ items, assets, minima, binding, derived, usageBy, ppmm }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((s) => {
        const a = assets[s.key];
        const v = minima[s.key];
        const der = !!derived?.[s.key];
        const use = usageBy[s.key] || [];
        return (
          <div key={s.key} className="rounded-lg border border-neutral-200 overflow-hidden bg-white">
            {/* 図版（縦横比を壊さないため maxHeight/maxWidth の両 max 指定） */}
            <div className="bg-neutral-50 border-b border-neutral-100 flex items-center justify-center px-4"
              style={{ height: 96 }}>
              <img src={a.url} alt="" style={{ maxHeight: 64, maxWidth: "100%" }} />
            </div>
            <div className="p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-neutral-800">{s.label}</span>
                <span className="text-[11px] font-mono text-neutral-400">{s.en}</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
                使いどころ：{use.length ? use.join("、") : "この一覧の中では該当なし"}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-neutral-100 text-[10px]">
                <div className="flex justify-between">
                  <dt className="text-neutral-400">最小指定サイズ</dt>
                  <dd className="font-mono font-semibold"
                    style={{ color: v == null ? "#d4d4d4" : der ? "#b45309" : "#1d4ed8" }}>
                    {v != null ? `${v}mm${der ? "*" : ""}` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-400">限界条件</dt>
                  <dd className="text-neutral-700">
                    {CONDITIONS.find((c) => c.key === binding?.[s.key])?.label || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-400">縦横比</dt>
                  <dd className="font-mono text-neutral-700">{a.aspect.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-neutral-400">根拠</dt>
                  <dd><VerBadges v={v} der={der} generated={a.generated} /></dd>
                </div>
              </dl>
              {v != null && (
                <div className="mt-3 pt-3 border-t border-neutral-100">
                  <div className="text-[11px] text-neutral-400 mb-1.5">最小指定サイズでの実寸</div>
                  <ActualSample asset={a} mm={v} ppmm={ppmm} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpecStep({ assets, minima, binding, clearRule, ppmm, calibrated, scene, derived }) {
  const governing = minima;
  const [copied, setCopied] = useState(false);
  const basis = CLEAR_BASES.find((b) => b.key === clearRule.basis) || CLEAR_BASES[0];
  const items = SLOTS.filter((s) => assets[s.key]);
  const rows = useMemo(() => buildSceneRows(assets, governing, ppmm, scene), [assets, governing, ppmm, scene]);

  // 検証結果から「その版が推奨される使用シーン」を逆引きする（ok 判定のみ。
  // unmeasured / none を含めると規定未達なのに使いどころに出てしまう）
  const usageBy = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      if (r.rec.key && r.rec.status === "ok") {
        if (!m[r.rec.key]) m[r.rec.key] = [];
        m[r.rec.key].push(r.label);
      }
    });
    return m;
  }, [rows]);

  const maxMin = Math.max(0, ...Object.values(governing).filter((v) => typeof v === "number" && isFinite(v)));
  const maxMm = Math.max(30, Math.ceil((maxMin * 1.6) / 5) * 5);

  const symbolMin = governing.symbol, typeMin = governing.logotype;

  /* 禁止事項の自動導出 */
  const prohibitions = useMemo(() => {
    const out = [];
    items.forEach((s) => {
      if (governing[s.key] != null) out.push(`${s.label}を幅 ${governing[s.key]}mm 未満で使用しない。`);
    });
    if (symbolMin != null && typeMin != null && symbolMin < typeMin) {
      out.push(`幅 ${symbolMin}mm 以上 ${typeMin}mm 未満の領域では組み合わせ版を使用せず、シンボルマーク単体を使用する。`);
    }
    rows.forEach((r) => {
      if (r.rec.status === "none") out.push(`${r.label}（実効 ${r.avail.toFixed(1)}mm）は現行のどの版も規定を満たさない。専用の簡略版を用意する。`);
    });
    return out;
  }, [items, governing, symbolMin, typeMin, rows]);

  const md = useMemo(() => {
    const L = [];
    L.push("# ロゴ使用規定（検証結果）", "");
    L.push("## 1. 版の一覧と最小指定サイズ", "");
    L.push("| 版 | 使いどころ | 最小指定サイズ | 限界を決めた条件 | 縦横比 | 根拠 |");
    L.push("|---|---|---:|---|---:|---|");
    items.forEach((s) => {
      const v = governing[s.key];
      const der = !!derived?.[s.key];
      const bl = CONDITIONS.find((c) => c.key === binding?.[s.key])?.label || "—";
      const use = usageBy[s.key]?.length ? usageBy[s.key].join("、") : "—";
      const basisLabel = v == null ? "未測定" : der ? "推定（上限）" : "実測";
      const basisTxt = assets[s.key]?.generated ? `${basisLabel} / 自動生成` : basisLabel;
      L.push(`| ${s.label} | ${use} | ${v != null ? v + "mm" + (der ? "*" : "") : "—"} | ${bl} | ${assets[s.key].aspect.toFixed(2)} | ${basisTxt} |`);
    });
    L.push("", "※ 数値は幅（横方向）。各版はフルカラー・モノクロ・白抜き・1bit を確認したうえで、最も早く破綻する条件の値を採用。", "");
    const genList = items.filter((s) => assets[s.key]?.generated).map((s) => s.label);
    if (genList.length) L.push(`※ 自動生成（検討用モック・正式データではない）：${genList.join("、")}`, "");
    const derList = items.filter((s) => derived?.[s.key]).map((s) => s.label);
    if (derList.length) L.push(`※ * 付きは組み合わせからの比例配分による推定値（上限値）。対象：${derList.join("、")}`, "");

    if (symbolMin != null && typeMin != null) {
      L.push("## 2. サイズ帯による使い分け", "");
      L.push(`- 組み合わせ版の下限：**${Math.max(symbolMin, typeMin)}mm**（制約要因：${typeMin >= symbolMin ? "ロゴタイプ" : "シンボルマーク"}）`);
      if (symbolMin < typeMin) L.push(`- ${symbolMin}mm 〜 ${typeMin}mm：シンボルマーク単体のみ使用可`);
      L.push(`- ${Math.max(symbolMin, typeMin)}mm 以上：組み合わせ版を使用可`);
      L.push("");
    }

    L.push("## 3. クリアスペース", "");
    L.push(`${basis.label}を ${basis.sym} としたとき、ロゴの周囲に **${clearRule.ratio.toFixed(2)}${basis.sym}** 以上の余白を確保する。`, "");

    L.push("## 4. 使用シーン別の推奨", "");
    L.push("| シーン | 条件 | 実効サイズ | 推奨する版 | 判定 |");
    L.push("|---|---|---:|---|---|");
    rows.forEach((r) => {
      const label = SLOTS.find((s) => s.key === r.rec.key)?.label || "—";
      const verdict = r.rec.status === "ok" ? "適合" : r.rec.status === "unmeasured" ? "未測定" : "不適合";
      L.push(`| ${r.label} | ${r.detail} | ${r.avail.toFixed(1)}mm | ${label} | ${verdict} |`);
    });
    L.push("");

    if (prohibitions.length) {
      L.push("## 5. 禁止事項", "");
      prohibitions.forEach((p) => L.push(`- ${p}`));
      L.push("");
    }

    L.push("## 6. 測定条件", "");
    L.push(`- 画面校正：${calibrated ? `${ppmm.toFixed(3)} px/mm` : "未校正（数値は参考値）"}`);
    L.push(`- 測定条件：${CONDITIONS.map((c) => c.label).join("、")}`);
    const raster = items.filter((s) => assets[s.key]?.isRaster).map((s) => s.label);
    if (raster.length) L.push(`- ラスター画像から測定した版：${raster.join("、")}（最終数値はベクターでの再測定を推奨）`);
    L.push("");
    return L.join("\n");
  }, [items, assets, minima, governing, clearRule, ppmm, calibrated, basis, rows, prohibitions, symbolMin, typeMin, derived, binding, usageBy]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  if (!Object.keys(governing).length) {
    return <Empty>測定結果がまだありません。仕様は測定と規定の内容から生成されます。</Empty>;
  }

  return (
    <div className="space-y-5">
      {/* 1. 版の一覧と最小指定サイズ */}
      <Panel title="1. 版の一覧と最小指定サイズ"
        desc="登録した各版と、それぞれに定めた最小指定サイズ（幅）の一覧です。使いどころは検証ステップの判定から導いています。">
        <VersionsCards items={items} assets={assets} minima={governing} binding={binding}
          derived={derived} usageBy={usageBy} ppmm={ppmm} />
      </Panel>

      {/* 2. サイズ帯 */}
      <Panel title="2. サイズ帯による使い分け"
        desc="青が使用可、赤が使用不可の領域。マゼンタの破線は各使用シーンの実効サイズです。">
        <SizeBandChart assets={assets} governing={governing} rows={rows} maxMm={maxMm} />
        {symbolMin != null && typeMin != null && symbolMin < typeMin && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-[11px] font-medium text-blue-900 mb-1">切り替えルール</div>
            <ul className="text-[10px] text-blue-800 space-y-0.5 leading-relaxed">
              <li>幅 {symbolMin}mm 未満：使用不可</li>
              <li>幅 {symbolMin}mm 〜 {typeMin}mm：シンボルマーク単体のみ</li>
              <li>幅 {typeMin}mm 以上：組み合わせ版を使用可</li>
            </ul>
          </div>
        )}
      </Panel>

      {/* 3. クリアスペース */}
      <Panel title="3. クリアスペース">
        {items[0] && <ClearPreview asset={assets[items[0].key]} ratio={clearRule.ratio} sym={basis.sym} />}
        <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-700 leading-relaxed">
          {basis.label}を {basis.sym} としたとき、ロゴの周囲に <span className="font-mono font-semibold">{clearRule.ratio.toFixed(2)}{basis.sym}</span> 以上の余白を確保する。この領域には他の要素（文字・図版・罫線・版面の端）を配置しない。
        </div>
      </Panel>

      {/* 4. 使用シーン別 */}
      <Panel title="4. 使用シーン別の推奨" desc="各シーンでロゴが実際に占める幅を算出し、規定を満たす版を判定しています。">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-neutral-400 text-[10px]">
                <th className="text-left font-medium py-2 pr-4">シーン</th>
                <th className="text-left font-medium py-2 pr-4">条件</th>
                <th className="text-right font-medium py-2 px-3">実効サイズ</th>
                <th className="text-left font-medium py-2 px-3">推奨する版</th>
                <th className="text-left font-medium py-2 pl-3">判定</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const label = SLOTS.find((s) => s.key === r.rec.key)?.label || "—";
                const ok = r.rec.status === "ok";
                const un = r.rec.status === "unmeasured";
                return (
                  <tr key={r.label} className="border-t border-neutral-100">
                    <td className="py-2 pr-4 text-neutral-700">{r.label}</td>
                    <td className="py-2 pr-4 text-neutral-400 text-[10px]">{r.detail}</td>
                    <td className="text-right font-mono px-3 text-neutral-600">{r.avail.toFixed(1)}mm</td>
                    <td className="px-3 text-neutral-700">{label}</td>
                    <td className="pl-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        ok ? "bg-emerald-50 text-emerald-700" : un ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                      }`}>{ok ? "適合" : un ? "未測定" : "不適合"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 図版 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {rows.map((r) => {
            const a = r.rec.key ? assets[r.rec.key] : null;
            const label = SLOTS.find((s) => s.key === r.rec.key)?.label;
            const ok = r.rec.status === "ok";
            const bad = r.rec.status === "none";
            return (
              <div key={r.key}
                className={`rounded-lg border p-3 ${r.key === "header" ? "lg:col-span-2" : ""} ${
                  bad ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"
                }`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-neutral-800">{r.label}</span>
                  <span className="text-[11px] font-mono text-neutral-400">{r.detail}</span>
                </div>
                <div className="text-[10px] mb-2">
                  {bad ? (
                    <span className="text-red-700">実効 {r.avail.toFixed(1)}mm — 規定を満たす版がありません</span>
                  ) : (
                    <span className="text-neutral-500">
                      使用する版：<span className="text-neutral-800 font-medium">{label}</span>
                      {"　"}実効 {r.avail.toFixed(1)}mm
                      {ok && r.rec.min != null && <span className="text-emerald-600">（規定 {r.rec.min}mm）</span>}
                      {r.rec.status === "over" && r.rec.min != null && <span className="text-red-600">（規定 {r.rec.min}mm に足りません）</span>}
                    </span>
                  )}
                </div>
                <div className="rounded-lg bg-neutral-50 border border-neutral-100">
                  <ScenePlate sceneKey={r.key} asset={a} ppmm={ppmm} scene={scene} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* 5. 禁止事項 */}
      {prohibitions.length > 0 && (
        <Panel title="5. 禁止事項" desc="測定結果から自動導出しています。ガイドラインの禁則ページにそのまま使えます。">
          <ul className="space-y-2">
            {prohibitions.map((p, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-neutral-700 leading-relaxed">
                <span className="text-red-500 shrink-0">×</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* 6. 測定条件 */}
      <Panel title="6. 測定条件" desc="数値の前提です。第三者が結果を評価できるよう併記してください。">
        <dl className="text-[11px] space-y-1.5">
          <div className="flex gap-3">
            <dt className="text-neutral-400 w-28 shrink-0">画面校正</dt>
            <dd className={calibrated ? "text-neutral-700 font-mono" : "text-amber-700"}>
              {calibrated ? `${ppmm.toFixed(3)} px/mm` : "未校正（数値は参考値）"}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-neutral-400 w-28 shrink-0">確認した条件</dt>
            <dd className="text-neutral-700">{CONDITIONS.map((c) => c.label).join("、")}（各版につき最も厳しい条件の値を採用）</dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-neutral-400 w-28 shrink-0">計測方向</dt>
            <dd className="text-neutral-700">幅（横方向）</dd>
          </div>
          {items.some((s) => assets[s.key]?.generated) && (
            <div className="flex gap-3">
              <dt className="text-neutral-400 w-28 shrink-0">自動生成</dt>
              <dd className="text-amber-700 leading-relaxed">
                {items.filter((s) => assets[s.key]?.generated).map((s) => s.label).join("、")} は他バージョンのパーツを組み直した検討用モック。正式データではありません。
              </dd>
            </div>
          )}
          {items.some((s) => derived?.[s.key]) && (
            <div className="flex gap-3">
              <dt className="text-neutral-400 w-28 shrink-0">推定値</dt>
              <dd className="text-amber-700 leading-relaxed">
                {items.filter((s) => derived?.[s.key]).map((s) => s.label).join("、")} は組み合わせの測定値からの比例配分（上限値）。実測値ではありません。
              </dd>
            </div>
          )}
          {items.some((s) => assets[s.key]?.isRaster) && (
            <div className="flex gap-3">
              <dt className="text-neutral-400 w-28 shrink-0">データ形式</dt>
              <dd className="text-amber-700 leading-relaxed">
                {items.filter((s) => assets[s.key]?.isRaster).map((s) => s.label).join("、")} はラスター画像から測定。最終数値はベクターでの再測定を推奨します。
              </dd>
            </div>
          )}
        </dl>
      </Panel>

      {/* 出力 */}
      <Panel title="テキスト出力" desc="Markdown 形式。ドキュメントにそのまま貼り付けられます。"
        right={
          <button onClick={copy}
            className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
            {copied ? "コピーしました" : "クリップボードにコピー"}
          </button>
        }>
        <pre className="text-[10px] font-mono bg-neutral-50 border border-neutral-200 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed text-neutral-700 max-h-96">
          {md}
        </pre>
      </Panel>
    </div>
  );
}
