import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import {
  MAX_MOODS, HOURS, SLOTS_PER_HOUR, WEATHER, addMood, slotIndex, paintRange, minutesByLabel, durationText, shortDuration,
  draftKey, readDraft, searchEntries, monthlyReport, ymd, parseDay, addDays, isDay, monthCells, safeColor,
  kstParts, yearMark, clockText, clockOffset, plainText,
} from "./diary.js";
import { richEditor, toHtml } from "./richtext.js";

const BUCKET = "diary-photos";
const app = document.getElementById("app");
let sb = null;
const state = { user: null, profile: null, isAdmin: false, labels: [], month: null };
// 화면을 떠날 때(다른 날짜, 다른 메뉴, 탭 닫기) 임시저장을 마무리하는 함수
let leaveHook = null;
window.addEventListener("pagehide", () => leaveHook?.());
// 타임테이블 칠하기는 손가락/마우스를 떼면 끝남
let endPaint = null;
window.addEventListener("pointerup", () => endPaint?.());
window.addEventListener("pointercancel", () => endPaint?.());

/* ---------- 도우미 ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const longDate = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`;
const stamp = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 2800);
}

const ICON = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  sunny: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloudy: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>',
  rainy: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M16 14v6M8 14v6M12 16v6"/>',
  snowy: '<path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>',
  windy: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  eraser: '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 21"/><path d="M22 21H7M5 11l9 9"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

/* ---------- 주소(#/경로?값) ---------- */
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path, params: new URLSearchParams(query) };
}
const go = (hash, replace = false) => {
  if (replace) history.replaceState(null, "", hash); else history.pushState(null, "", hash);
  route();
};

/* ---------- 데이터 ---------- */
async function loadMe() {
  const uid = state.user.id;
  const [p, r] = await Promise.all([
    sb.from("profiles").select("nickname, approved").eq("id", uid).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin"),
  ]);
  state.profile = p.data;
  state.isAdmin = (r.data ?? []).length > 0;
}

async function loadLabels() {
  const { data } = await sb.from("labels").select("id, kind, name, color").order("created_at");
  state.labels = (data ?? []).map((l) => ({ ...l, color: safeColor(l.color) }));
  return state.labels;
}

async function loadEntries() {
  const { data, error } = await sb.from("entries").select("id, entry_date, title, content, moods, timetable, photos, weather")
    .eq("user_id", state.user.id).order("entry_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => ({ ...e, moods: e.moods ?? [], timetable: e.timetable ?? {}, photos: e.photos ?? [] }));
}

/* ---------- 공통 틀 ---------- */
const TABS = [
  { path: "/calendar", label: "달력", icon: "calendar" },
  { path: "/reports", label: "월간 리포트", icon: "chart" },
  { path: "/search", label: "검색", icon: "search" },
  { path: "/timeline", label: "타임라인", icon: "list" },
];

function shell(current, inner, { wide = true, headExtra = "" } = {}) {
  const name = state.profile?.nickname || state.user.email;
  return `<main class="wrap ${wide ? "" : "narrow"}">
    <header class="top">
      <div class="brand"><h1><a href="#/" aria-label="첫 화면으로">${brandMark()}</a></h1><time class="brand-clock" data-clock>${clockText(nowMs())}</time></div>
      ${headExtra}
      <div class="who">
        <span>${esc(name)}</span>
        ${state.isAdmin ? '<a class="btn ghost sm" href="#/admin">가입 승인</a>' : ""}
        ${themeButton()}
        <button class="btn ghost sm" type="button" data-act="logout">로그아웃</button>
      </div>
    </header>
    <nav class="tabs" aria-label="일기 메뉴">${TABS.map((t) => `<a href="#${t.path}" ${t.path === current ? 'aria-current="page"' : ""}>${icon(t.icon)}${t.label}</a>`).join("")}</nav>
    ${inner}
  </main>`;
}

function bindShell() {
  $('[data-act="logout"]')?.addEventListener("click", async () => {
    await sb.auth.signOut();
    go("#/auth", true);
  });
}

// 라이트/다크 전환. 선택은 meiro.kr 전체가 같이 씀. 라이트에선 달, 다크에선 해 아이콘
const themeButton = (extra = "") => `<button class="btn ghost sm theme-btn ${extra}" type="button" data-act="theme" aria-label="라이트/다크 모드 바꾸기" title="라이트/다크 모드 바꾸기"><span class="moon">${icon("moon")}</span><span class="sun">${icon("sun")}</span></button>`;
document.addEventListener("click", (e) => {
  if (!e.target.closest('[data-act="theme"]')) return;
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("meiro-theme", root.dataset.theme); } catch { /* 테마 기억은 선택 사항 */ }
});

const waiting = () => `<div class="paper notice"><h2>승인을 기다리고 있어요</h2><p>관리자가 가입을 승인하면 일기를 쓸 수 있어요.</p></div>`;

/* ---------- 첫 화면 ---------- */
// 화면 곳곳의 STDL ’26, 현재 시각을 1초마다 함께 갱신 (data-year, data-clock, data-clock-src)
const nowMs = () => Date.now() + (clock?.offset ?? 0);
const brandMark = () => `STDL <span data-year>${yearMark(kstParts(nowMs()).y)}</span>`;
function tickClocks() {
  const t = nowMs();
  $$("[data-clock]").forEach((el) => { el.textContent = clockText(t); });
  $$("[data-year]").forEach((el) => { el.textContent = yearMark(kstParts(t).y); });
  $$("[data-clock-src]").forEach((el) => {
    el.textContent = !clock ? "한국 표준시" : clock.error === null ? "기기 시계 기준" : `표준시 서버 기준 · 오차 ±${(clock.error / 1000).toFixed(2)}초`;
  });
}
function startClocks() {
  const loop = () => { tickClocks(); setTimeout(loop, 1000 - (nowMs() % 1000) + 5); }; // 초가 바뀌는 순간에 맞춤
  loop();
  syncClock().then(tickClocks);
}

// 서버(표준시에 맞춰진 Supabase) 시각과 기기 시계의 차이. 한 번 맞추면 다시 쓰지 않음
let clock = null;
async function syncClock() {
  if (clock) return clock;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const sent = Date.now();
    const { data, error } = await sb.rpc("server_time");
    const received = Date.now();
    if (error) break;
    samples.push({ sent, received, server: Date.parse(data) });
  }
  clock = clockOffset(samples) ?? { offset: 0, error: null };
  return clock;
}

function renderHome() {
  document.title = "STDL — 나의 하루를 적어요";
  app.innerHTML = `${themeButton("corner")}<main class="hero">
    <p class="eyebrow">MY DIARY</p>
    <h1 class="mark">${brandMark()}</h1>
    <p class="clock"><time data-clock></time><span data-clock-src>한국 표준시</span></p>
    <p>오늘 하루는 어땠나요?</p>
    <a class="btn primary lg" href="#/calendar">적으러 가기</a>
  </main>`;
  tickClocks();
}

/* ---------- 로그인 / 가입 ---------- */
function renderAuth() {
  document.title = "로그인 — 일기장";
  let mode = "in";
  const draw = () => {
    app.innerHTML = `${themeButton("corner")}<main class="auth"><div class="paper">
      <h1><a href="#/">일기장</a></h1>
      <p class="muted small" style="text-align:center;margin:8px 0 0">${mode === "in" ? "다시 오신 걸 환영해요" : "새 일기장을 만들어요"}</p>
      <form id="auth-form">
        ${mode === "up" ? '<label class="field">닉네임<input class="input" id="nick" required autocomplete="nickname"></label>' : ""}
        <label class="field">이메일<input class="input" id="email" type="email" required autocomplete="email"></label>
        <label class="field">비밀번호<input class="input" id="pw" type="password" minlength="6" required autocomplete="${mode === "in" ? "current-password" : "new-password"}"></label>
        <button class="btn primary" type="submit">${mode === "in" ? "로그인" : "가입하기"}</button>
      </form>
      <button class="switch" type="button" id="switch">${mode === "in" ? "계정이 없나요? 가입하기" : "이미 계정이 있나요? 로그인"}</button>
    </div></main>`;
    $("#switch").onclick = () => { mode = mode === "in" ? "up" : "in"; draw(); };
    $("#auth-form").onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("#auth-form button");
      btn.disabled = true;
      const email = $("#email").value.trim(), password = $("#pw").value;
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) toast("로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.", "error");
      } else {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { emailRedirectTo: location.origin + location.pathname, data: { nickname: $("#nick").value.trim() } },
        });
        if (error) toast(error.message, "error");
        else if (!data.session) toast("확인 메일을 보냈어요. 메일의 링크를 누르면 가입이 완료돼요.");
      }
      btn.disabled = false;
    };
  };
  draw();
}

/* ---------- 달력 ---------- */
async function renderCalendar(params) {
  document.title = "달력 — 일기장";
  const day = isDay(params.get("date")) ? params.get("date") : ymd(new Date());
  const selected = parseDay(day);
  if (!state.month || params.get("date")) state.month = new Date(selected.getFullYear(), selected.getMonth(), 1);

  if (state.profile && !state.profile.approved) {
    app.innerHTML = shell("/calendar", waiting());
    bindShell();
    return;
  }
  app.innerHTML = shell("/calendar", `<div class="cal-layout">
      <div class="paper cal" id="cal"></div>
      <div style="min-width:0">
        <div class="daynav">
          <a class="btn outline sm" href="#/calendar?date=${ymd(addDays(selected, -1))}">${icon("left")}어제</a>
          <a class="btn ghost sm" href="#/calendar?date=${ymd(new Date())}">오늘</a>
          <a class="btn outline sm" href="#/calendar?date=${ymd(addDays(selected, 1))}">내일${icon("right")}</a>
        </div>
        <section class="paper entry" id="entry"><p class="date">${longDate(selected)}</p></section>
      </div>
    </div>`);
  bindShell();

  const { data: rows } = await sb.from("entries").select("entry_date");
  const written = new Set((rows ?? []).map((r) => r.entry_date));
  const drawCal = () => {
    const m = state.month, today = ymd(new Date());
    $("#cal").innerHTML = `<div class="cal-head">
        <button class="btn ghost sm" type="button" data-m="-1" aria-label="이전 달">${icon("left")}</button>
        <span>${m.getFullYear()}년 ${m.getMonth() + 1}월</span>
        <button class="btn ghost sm" type="button" data-m="1" aria-label="다음 달">${icon("right")}</button>
      </div>
      <div class="cal-grid">${DOW.map((d) => `<span class="dow">${d}</span>`).join("")}
        ${monthCells(m.getFullYear(), m.getMonth()).map((d) => {
          if (!d) return "<span></span>";
          const s = ymd(d);
          const cls = [written.has(s) ? "written" : "", s === today ? "today" : ""].join(" ");
          return `<button type="button" class="${cls}" data-day="${s}" aria-pressed="${s === day}" aria-label="${longDate(d)}${written.has(s) ? ", 일기 있음" : ""}">${d.getDate()}</button>`;
        }).join("")}
      </div>
      <p class="cal-note">밑줄 친 날은 일기를 쓴 날이에요</p>`;
    $$("[data-m]", $("#cal")).forEach((b) => b.onclick = () => {
      state.month = new Date(m.getFullYear(), m.getMonth() + Number(b.dataset.m), 1);
      drawCal();
    });
    $$("[data-day]", $("#cal")).forEach((b) => b.onclick = () => go(`#/calendar?date=${b.dataset.day}`, true));
  };
  drawCal();
  await loadLabels();
  await entryPanel($("#entry"), day, selected, (has) => { has ? written.add(day) : written.delete(day); drawCal(); });
}

/* ---------- 하루 일기 ---------- */
async function entryPanel(root, day, date, onWrittenChange) {
  const uid = state.user.id;
  const { data: entry, error } = await sb.from("entries").select("*").eq("entry_date", day).eq("user_id", uid).maybeSingle();
  if (error) { root.insertAdjacentHTML("beforeend", '<p class="empty-hint">일기를 불러오지 못했어요. 새로고침해 주세요.</p>'); return; }

  const fromEntry = () => ({
    title: entry?.title ?? "", content: entry?.content ?? "", moods: entry?.moods ?? [],
    timetable: entry?.timetable ?? {}, photos: entry?.photos ?? [], weather: entry?.weather ?? null,
  });
  let f = fromEntry();
  let restored = false;
  let draft = null;
  try { draft = readDraft(localStorage.getItem(draftKey(uid, day)), entry?.updated_at); } catch { /* 임시저장은 선택 사항 */ }
  if (draft) { f = draft; restored = true; }
  let editing = !!draft || !entry;

  // 임시저장: 입력이 멈추고 0.6초 뒤 이 기기에 저장
  const key = draftKey(uid, day);
  let timer = null, dirty = false;
  const flush = () => {
    if (!dirty) return;
    try { localStorage.setItem(key, JSON.stringify({ updatedAt: Date.now(), fields: f })); dirty = false; setStatus("이 기기에 임시저장됨"); }
    catch { setStatus("임시저장을 사용할 수 없어요. 저장 버튼으로 저장해 주세요."); }
  };
  const changed = () => { dirty = true; setStatus("임시저장 중…"); clearTimeout(timer); timer = setTimeout(flush, 600); };
  const clearDraft = () => { clearTimeout(timer); dirty = false; try { localStorage.removeItem(key); } catch { /* 없어도 됨 */ } };
  const setStatus = (t) => { const el = $("#draft-status", root); if (el) { el.textContent = t; el.hidden = false; } };
  leaveHook = flush;

  const draw = () => {
    if (editing) drawEdit(); else drawRead();
  };

  function drawEdit() {
    root.innerHTML = `<p class="date">${longDate(date)}</p>
      <div class="stack">
        <p class="status" id="draft-status" ${restored ? "" : "hidden"}>${restored ? "임시저장한 내용을 불러왔어요" : ""}</p>
        <input class="input title-input" id="title" placeholder="제목 (선택)" value="${esc(f.title)}" aria-label="제목">
        <div id="weather"></div>
        <div id="moods"></div>
        <div id="photos"></div>
        <div id="content"></div>
        <div class="tt-box" id="timetable"></div>
        <div class="actions">
          ${entry ? '<button class="btn ghost" type="button" id="cancel">취소</button>' : ""}
          <button class="btn primary" type="button" id="save">저장</button>
        </div>
      </div>`;
    $("#title", root).oninput = (e) => { f.title = e.target.value; changed(); };
    richEditor($("#content", root), f.content, (v) => { f.content = v; changed(); });
    weatherEditor($("#weather", root));
    moodEditor($("#moods", root));
    photosBlock($("#photos", root), true);
    timetableBlock($("#timetable", root), true);
    $("#cancel", root)?.addEventListener("click", () => { clearDraft(); restored = false; f = fromEntry(); editing = false; draw(); });
    $("#save", root).onclick = save;
  }

  function drawRead() {
    const w = WEATHER.find((x) => x.id === f.weather);
    root.innerHTML = `<p class="date">${longDate(date)}</p>
      ${w ? `<p style="margin:12px 0 0"><span class="weather">${icon(w.id)}${w.name}</span></p>` : ""}
      <div class="read-head">
        <h2>${esc(entry.title || "제목 없음")}</h2>
        <div style="display:flex;gap:8px">
          <button class="btn outline sm" type="button" id="edit">수정</button>
          <button class="btn ghost sm danger" type="button" id="del">삭제</button>
        </div>
      </div>
      ${f.moods.length ? '<div id="moods" style="margin-top:24px"></div>' : ""}
      <div id="photos" style="margin-top:24px"></div>
      <div class="content lined">${toHtml(entry.content)}</div>
      ${Object.keys(f.timetable).length ? '<details class="tt-box" id="timetable"></details>' : ""}
      <div class="comments" id="comments"></div>`;
    $("#edit", root).onclick = () => { editing = true; draw(); };
    $("#del", root).onclick = removeEntry;
    if (f.moods.length) moodView($("#moods", root));
    photosBlock($("#photos", root), false);
    if (Object.keys(f.timetable).length) timetableBlock($("#timetable", root), false);
    commentsBlock($("#comments", root));
  }

  async function save() {
    if (!plainText(f.content).trim()) { toast("내용을 적어 주세요.", "error"); return; }
    const btn = $("#save", root);
    btn.disabled = true; btn.textContent = "저장 중…";
    const fields = { title: f.title, content: f.content, moods: f.moods, timetable: f.timetable, photos: f.photos, weather: f.weather };
    const res = entry
      ? await sb.from("entries").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", entry.id).select().single()
      : await sb.from("entries").insert({ ...fields, entry_date: day, user_id: uid }).select().single();
    if (res.error) { btn.disabled = false; btn.textContent = "저장"; toast("저장하지 못했어요.", "error"); return; }
    toast("저장했어요");
    clearDraft();
    onWrittenChange(true);
    entryPanel(root, day, date, onWrittenChange);
  }

  async function removeEntry() {
    if (!confirm("이 날의 일기를 삭제할까요? 댓글과 사진도 함께 지워져요.")) return;
    const { error: e } = await sb.from("entries").delete().eq("id", entry.id);
    if (e) { toast("삭제하지 못했어요.", "error"); return; }
    if (entry.photos?.length) await sb.storage.from(BUCKET).remove(entry.photos);
    toast("삭제했어요");
    clearDraft();
    onWrittenChange(false);
    entryPanel(root, day, date, onWrittenChange);
  }

  /* 날씨 */
  function weatherEditor(el) {
    el.innerHTML = `<div class="section-head"><h3>오늘의 날씨</h3></div><div class="chips">${WEATHER.map((w) =>
      `<button class="btn outline sm" type="button" data-w="${w.id}" aria-pressed="${f.weather === w.id}">${icon(w.id)}${w.name}</button>`).join("")}</div>`;
    $$("[data-w]", el).forEach((b) => b.onclick = () => { f.weather = f.weather === b.dataset.w ? null : b.dataset.w; changed(); weatherEditor(el); });
  }

  /* 기분 */
  function moodEditor(el) {
    const moodLabels = state.labels.filter((l) => l.kind === "mood");
    const byId = new Map(state.labels.map((l) => [l.id, l]));
    el.innerHTML = `<div class="section-head"><h3>오늘의 기분 <span class="muted small" style="font-weight:400">(${f.moods.length}/${MAX_MOODS})</span></h3>
        <button class="btn ghost sm" type="button" id="mood-manage">기분 태그 관리</button></div>
      <div class="chips">${moodLabels.length ? moodLabels.map((l) => {
        const on = f.moods.some((m) => m.label_id === l.id);
        return `<button class="chip" type="button" data-l="${l.id}" aria-pressed="${on}" ${!on && f.moods.length >= MAX_MOODS ? "disabled" : ""}
          style="border-color:${l.color};${on ? `background:${l.color};color:#fff` : ""}">${esc(l.name)}</button>`;
      }).join("") : `<p class="empty-hint">'기분 태그 관리'에서 기분 태그를 만들어 보세요.</p>`}</div>
      <ul class="moods">${f.moods.filter((m) => byId.has(m.label_id)).map((m) => {
        const l = byId.get(m.label_id);
        return `<li><span class="name" style="color:${l.color}">${esc(l.name)}</span>
          <input type="range" min="0" max="100" step="1" value="${m.score}" data-score="${l.id}" aria-label="${esc(l.name)} 점수" style="accent-color:${l.color}">
          <span class="score">${m.score}</span></li>`;
      }).join("")}</ul>`;
    $$("[data-l]", el).forEach((b) => b.onclick = () => {
      const id = b.dataset.l;
      f.moods = f.moods.some((m) => m.label_id === id) ? f.moods.filter((m) => m.label_id !== id) : addMood(f.moods, id);
      changed(); moodEditor(el);
    });
    $$("[data-score]", el).forEach((r) => r.oninput = () => {
      f.moods = f.moods.map((m) => (m.label_id === r.dataset.score ? { ...m, score: Number(r.value) } : m));
      r.nextElementSibling.textContent = r.value;
      changed();
    });
    $("#mood-manage", el).onclick = () => labelManager("mood", () => moodEditor(el));
  }

  function moodView(el) {
    const byId = new Map(state.labels.map((l) => [l.id, l]));
    el.innerHTML = `<div class="section-head"><h3>오늘의 기분</h3></div><ul class="moods">${f.moods.filter((m) => byId.has(m.label_id)).map((m) => {
      const l = byId.get(m.label_id);
      return `<li><span class="name" style="color:${l.color}">${esc(l.name)}</span><span class="bar"><span style="width:${m.score}%;background:${l.color}"></span></span><span class="score">${m.score}</span></li>`;
    }).join("")}</ul>`;
  }

  /* 사진 */
  async function photosBlock(el, editable) {
    if (!editable && !f.photos.length) { el.hidden = true; return; }
    el.innerHTML = `${editable ? '<div class="section-head"><h3>사진</h3><input type="file" accept="image/*" multiple hidden id="file"><button class="btn outline sm" type="button" id="add-photo">사진 추가</button></div>' : ""}
      <div class="photos">${f.photos.map((p) => `<div class="photo" data-p="${esc(p)}">${editable ? '<button class="btn sm danger" type="button">삭제</button>' : ""}</div>`).join("")}</div>`;
    if (editable) {
      const input = $("#file", el), btn = $("#add-photo", el);
      btn.onclick = () => input.click();
      input.onchange = async () => {
        btn.disabled = true; btn.textContent = "올리는 중…";
        for (const file of input.files) {
          const path = `${uid}/${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
          const { error: e } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type });
          if (e) toast(`${file.name}을(를) 올리지 못했어요.`, "error"); else f.photos = [...f.photos, path];
        }
        changed(); photosBlock(el, true);
      };
      $$(".photo .btn", el).forEach((b) => b.onclick = async () => {
        const p = b.parentElement.dataset.p;
        await sb.storage.from(BUCKET).remove([p]);
        f.photos = f.photos.filter((x) => x !== p);
        changed(); photosBlock(el, true);
      });
    }
    if (!f.photos.length) return;
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(f.photos, 3600);
    for (const d of data ?? []) {
      const box = $$(".photo", el).find((x) => x.dataset.p === d.path);
      if (box && d.signedUrl) box.insertAdjacentHTML("afterbegin", `<a href="${esc(d.signedUrl)}" target="_blank" rel="noreferrer"><img src="${esc(d.signedUrl)}" alt="첨부 사진" loading="lazy"></a>`);
    }
  }

  /* 타임테이블 */
  function timetableBlock(el, editable) {
    const acts = state.labels.filter((l) => l.kind === "activity");
    const byId = new Map(state.labels.map((l) => [l.id, l]));
    if (editable && el.dataset.brush === undefined) el.dataset.brush = acts[0]?.id ?? "";
    const brush = () => el.dataset.brush || null;
    const summary = () => Object.entries(minutesByLabel(f.timetable)).map(([id, min]) => byId.get(id) ? `${esc(byId.get(id).name)} ${shortDuration(min)}` : "").filter(Boolean).join(" · ");
    el.innerHTML = `${editable ? '<div class="section-head"><h3>타임테이블</h3><button class="btn ghost sm" type="button" id="act-manage">한 일 태그 관리</button></div>'
      : `<summary><span class="tt-title">타임테이블</span><span class="tt-sum">${summary()}</span></summary>`}
      ${editable ? `<div class="chips" style="margin-bottom:12px">${acts.length ? acts.map((l) =>
        `<button class="btn outline sm" type="button" data-b="${l.id}" aria-pressed="${brush() === l.id}"><span class="swatch" style="background:${l.color}"></span>${esc(l.name)}</button>`).join("")
        : `<p class="empty-hint">'한 일 태그 관리'에서 태그를 만들어 보세요.</p>`}
        <button class="btn outline sm" type="button" data-b="" aria-pressed="${brush() === null}">${icon("eraser")}지우개</button></div>` : ""}
      <div class="tt">${HOURS.map((h) => `<div class="tt-row"><span class="h">${String(h).padStart(2, "0")}</span><div class="tt-cells">${
        Array.from({ length: SLOTS_PER_HOUR }, (_, p) => {
          const s = slotIndex(h, p), l = byId.get(f.timetable[s]);
          return `<button type="button" data-slot="${s}" ${editable ? "" : 'aria-disabled="true" tabindex="-1"'} aria-label="${h}시 ${p * 10}분${l ? ` ${esc(l.name)}` : ""}" style="${l ? `background:${l.color}` : ""}"></button>`;
        }).join("")}</div></div>`).join("")}</div>
      ${editable ? '<ul class="totals"></ul>' : ""}`;
    const drawTotals = () => {
      if (!editable) return;
      $(".totals", el).innerHTML = Object.entries(minutesByLabel(f.timetable)).map(([id, min]) => {
        const l = byId.get(id);
        return l ? `<li><span class="swatch" style="background:${l.color}"></span>${esc(l.name)} ${shortDuration(min)}</li>` : "";
      }).join("");
    };
    const paintCells = () => $$("[data-slot]", el).forEach((c) => {
      const l = byId.get(f.timetable[c.dataset.slot]);
      c.style.background = l ? l.color : "";
    });
    drawTotals();
    if (!editable) return;

    $$("[data-b]", el).forEach((b) => b.onclick = () => { el.dataset.brush = b.dataset.b; timetableBlock(el, true); });
    $("#act-manage", el).onclick = () => labelManager("activity", () => { el.dataset.brush = el.dataset.brush || (state.labels.find((l) => l.kind === "activity")?.id ?? ""); timetableBlock(el, true); });

    // 누른 채 끌면 지나간 칸을 모두 칠함. 이미 같은 색인 칸에서 시작하면 지움
    let painting, last = null;
    const apply = (slot) => {
      f.timetable = paintRange(f.timetable, last ?? slot, slot, painting);
      last = slot;
      paintCells(); drawTotals(); changed();
    };
    const grid = $(".tt", el);
    grid.addEventListener("pointerdown", (e) => {
      const s = e.target.dataset?.slot;
      if (s === undefined || e.button !== 0) return;
      e.preventDefault();
      painting = f.timetable[s] === brush() ? null : brush();
      last = Number(s);
      apply(Number(s));
    });
    grid.addEventListener("pointermove", (e) => {
      if (painting === undefined) return;
      const s = document.elementFromPoint(e.clientX, e.clientY)?.dataset?.slot;
      if (s !== undefined && Number(s) !== last) apply(Number(s));
    });
    endPaint = () => { painting = undefined; last = null; };
    grid.addEventListener("keydown", (e) => {
      const s = e.target.dataset?.slot;
      if (s === undefined || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      f.timetable = paintRange(f.timetable, Number(s), Number(s), f.timetable[s] === brush() ? null : brush());
      paintCells(); drawTotals(); changed();
    });
  }

  /* 댓글 */
  async function commentsBlock(el) {
    const { data } = await sb.from("comments").select("*").eq("entry_id", entry.id).order("created_at");
    const list = data ?? [];
    const who = state.profile?.nickname || "나";
    el.innerHTML = `<h3>댓글 ${list.length}</h3>
      <ul>${list.map((c) => `<li><div class="meta"><span>${esc(who)} · ${stamp(c.created_at)}</span><button type="button" data-c="${c.id}">삭제</button></div><p>${esc(c.content)}</p></li>`).join("")}</ul>
      <form id="comment-form"><input class="input" id="comment" placeholder="댓글 달기" aria-label="댓글"><button class="btn primary" type="submit">등록</button></form>`;
    $$("[data-c]", el).forEach((b) => b.onclick = async () => { await sb.from("comments").delete().eq("id", b.dataset.c); commentsBlock(el); });
    $("#comment-form", el).onsubmit = async (e) => {
      e.preventDefault();
      const text = $("#comment", el).value;
      if (!text.trim()) return;
      const { error: err } = await sb.from("comments").insert({ entry_id: entry.id, content: text, user_id: uid });
      if (err) { toast("댓글을 달지 못했어요.", "error"); return; }
      commentsBlock(el);
    };
  }

  draw();
}

/* ---------- 태그 관리 창 ---------- */
function labelManager(kind, onDone) {
  const dlg = document.createElement("dialog");
  dlg.innerHTML = `<h2>${kind === "mood" ? "기분 태그 관리" : "한 일 태그 관리"}</h2>
    <button class="btn ghost sm dialog-close" type="button" aria-label="닫기">닫기</button>
    <ul class="label-list"></ul>
    <form class="label-add"><input type="color" value="#0031b0" aria-label="새 색상"><input class="input" placeholder="${kind === "mood" ? "예: 행복" : "예: 공부"}" aria-label="새 태그 이름"><button class="btn primary" type="submit">추가</button></form>`;
  document.body.append(dlg);
  const list = $(".label-list", dlg);
  const draw = () => {
    const mine = state.labels.filter((l) => l.kind === kind);
    list.innerHTML = mine.length ? mine.map((l) => `<li data-id="${l.id}">
        <input type="color" value="${l.color}" aria-label="${esc(l.name)} 색상">
        <input class="input" value="${esc(l.name)}" aria-label="태그 이름">
        <button class="btn ghost sm danger" type="button">삭제</button></li>`).join("")
      : '<li class="empty-hint">아직 태그가 없어요.</li>';
    $$("li[data-id]", list).forEach((li) => {
      const id = li.dataset.id, l = state.labels.find((x) => x.id === id);
      const [color, name] = $$("input", li);
      color.onchange = () => update(id, { color: color.value });
      name.onblur = () => { const v = name.value.trim(); if (v && v !== l.name) update(id, { name: v }); };
      $("button", li).onclick = async () => { await sb.from("labels").delete().eq("id", id); await loadLabels(); draw(); };
    });
  };
  const update = async (id, patch) => { await sb.from("labels").update(patch).eq("id", id); await loadLabels(); draw(); };
  $(".label-add", dlg).onsubmit = async (e) => {
    e.preventDefault();
    const [color, name] = $$(".label-add input", dlg);
    if (!name.value.trim()) return;
    const { error } = await sb.from("labels").insert({ kind, name: name.value.trim(), color: color.value });
    if (error) { toast("추가하지 못했어요.", "error"); return; }
    name.value = "";
    await loadLabels(); draw();
  };
  $(".dialog-close", dlg).onclick = () => dlg.close();
  dlg.addEventListener("close", () => { dlg.remove(); onDone(); });
  draw();
  dlg.showModal();
}

/* ---------- 목록 (검색, 타임라인 공용) ---------- */
function entryList(entries, { thumbs = false } = {}) {
  if (!entries.length) return '<p class="empty">일기가 없어요.</p>';
  const byId = new Map(state.labels.map((l) => [l.id, l]));
  return `<ol class="list">${entries.map((e) => {
    const w = WEATHER.find((x) => x.id === e.weather);
    const total = Object.values(minutesByLabel(e.timetable)).reduce((a, b) => a + b, 0);
    const first = thumbs ? e.photos[0] : null;
    return `<li class="${first ? "has-thumb" : ""}">
      ${first ? `<a class="thumb" href="#/calendar?date=${e.entry_date}" data-p="${esc(first)}" aria-label="${e.entry_date} 일기 열기"></a>` : ""}
      <div class="row"><time>${e.entry_date.replaceAll("-", ".")}</time>${w ? `<span class="weather">${icon(w.id)}${w.name}</span>` : ""}</div>
      <a class="t" href="#/calendar?date=${e.entry_date}">${esc(e.title || "제목 없음")}</a>
      <p class="excerpt">${esc(plainText(e.content))}</p>
      <div class="tags">${e.moods.map((m) => { const l = byId.get(m.label_id); return l ? `<span><i class="dot" style="background:${l.color}"></i>${esc(l.name)} ${m.score}</span>` : ""; }).join("")}
        ${total ? `<span class="muted">활동 ${durationText(total)}</span>` : ""}</div>
    </li>`;
  }).join("")}</ol>`;
}

async function guardedPage(path, heading, build) {
  if (state.profile && !state.profile.approved) { app.innerHTML = shell(path, waiting()); bindShell(); return; }
  app.innerHTML = shell(path, '<p class="muted">불러오는 중…</p>', { wide: path === "/reports" });
  bindShell();
  const [entries] = await Promise.all([loadEntries(), loadLabels()]);
  build(entries);
}

/* ---------- 월간 리포트 ---------- */
function renderReports() {
  document.title = "월간 리포트 — 일기장";
  return guardedPage("/reports", "월간 리포트", (entries) => {
    let month = ymd(new Date()).slice(0, 7);
    const main = $("main");
    const draw = () => {
      const r = monthlyReport(entries, month, state.labels);
      $(".report", main).innerHTML = `
        <div class="stats"><div><span class="muted small">기록한 날</span><b>${r.days.length}<small>일</small></b></div>
          <div><span class="muted small">총 활동 시간</span><b style="font-size:24px">${durationText(r.totalMinutes)}</b></div></div>
        <section class="report-section"><h2 style="font-size:20px">감정 리포트</h2>
          ${r.moods.length ? `${moodChart(r)}<ul class="rows">${r.moods.map((m) => `<li><span style="display:inline-flex;align-items:center;gap:8px"><span class="swatch" style="background:${m.color}"></span>${esc(m.name)}</span><span class="muted">${m.count}일 · 평균 ${m.average}점</span></li>`).join("")}</ul>`
            : '<p class="empty">이 달의 기분 기록이 없어요.</p>'}</section>
        <section class="report-section"><h2 style="font-size:20px">활동 통계</h2>
          ${r.activity.length ? `<ul class="bars">${r.activity.map((a) => `<li><div class="lab"><span style="font-weight:600">${esc(a.name)}</span><span class="muted">${durationText(a.minutes)} · ${Math.round(a.minutes / r.totalMinutes * 100)}%</span></div>
            <div class="track"><span style="width:${a.minutes / r.totalMinutes * 100}%;background:${a.color}"></span></div></li>`).join("")}</ul>`
            : '<p class="empty">이 달의 활동 기록이 없어요.</p>'}</section>`;
    };
    $("main > p.muted")?.remove();
    main.insertAdjacentHTML("beforeend", `<div class="page-head"><label class="field">리포트 월<input class="input" type="month" id="month" value="${month}"></label></div><div class="report"></div>`);
    $("#month").onchange = (e) => { if (e.target.value) { month = e.target.value; draw(); } };
    draw();
  });
}

/** 날짜별 기분 점수 꺾은선 (0~100) */
function moodChart(r) {
  const W = 640, H = 260, L = 32, R = 12, T = 12, B = 28;
  const n = r.trend.length;
  const x = (i) => (n === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1));
  const y = (v) => T + (100 - v) * (H - T - B) / 100;
  const ticks = [0, 25, 50, 75, 100];
  const step = Math.ceil(n / 12);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="일별 기분 점수 그래프">
    ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join("")}
    ${r.trend.map((p, i) => (i % step === 0 || i === n - 1) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${Number(p.day)}일</text>` : "").join("")}
    ${r.moods.map((m) => {
      const pts = r.trend.map((p, i) => (p[m.id] === undefined ? null : [x(i), y(p[m.id])]));
      const segs = []; let cur = [];
      for (const pt of pts) { if (pt) cur.push(pt); else if (cur.length) { segs.push(cur); cur = []; } }
      if (cur.length) segs.push(cur);
      return segs.map((s) => `<polyline fill="none" stroke="${m.color}" stroke-width="2" points="${s.map((p) => p.join(",")).join(" ")}"/>`).join("") +
        pts.filter(Boolean).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${m.color}"><title>${esc(m.name)}</title></circle>`).join("");
    }).join("")}
  </svg>`;
}

/* ---------- 검색 ---------- */
function renderSearch() {
  document.title = "검색 — 일기장";
  return guardedPage("/search", "검색", (entries) => {
    const main = $("main");
    $("main > p.muted")?.remove();
    main.insertAdjacentHTML("beforeend", `
      <input class="input" id="q" type="search" placeholder="제목 또는 내용 검색" aria-label="일기 검색">
      <div class="filters">
        <label class="field">시작일<input class="input" type="date" id="from"></label>
        <label class="field">종료일<input class="input" type="date" id="to"></label>
        <label class="field">태그<select class="input" id="label"><option value="">모든 태그</option>${state.labels.map((l) => `<option value="${l.id}">${l.kind === "mood" ? "기분" : "활동"} · ${esc(l.name)}</option>`).join("")}</select></label>
      </div>
      <p class="muted small" id="count" style="margin-top:24px"></p><div id="results"></div>`);
    const draw = () => {
      const found = searchEntries(entries, $("#q").value, $("#label").value, $("#from").value, $("#to").value);
      $("#count").textContent = `검색 결과 ${found.length}개`;
      $("#results").innerHTML = entryList(found);
    };
    ["q", "from", "to", "label"].forEach((id) => $(`#${id}`).addEventListener("input", draw));
    draw();
  });
}

/* ---------- 타임라인 ---------- */
function renderTimeline() {
  document.title = "타임라인 — 일기장";
  return guardedPage("/timeline", "타임라인", (entries) => {
    $("main > p.muted")?.remove();
    const months = [...new Set(entries.map((e) => e.entry_date.slice(0, 7)))];
    $("main").insertAdjacentHTML("beforeend", months.length
      ? months.map((m) => `<section><h2 class="month-head">${m.replace("-", "년 ")}월</h2>${entryList(entries.filter((e) => e.entry_date.startsWith(m)), { thumbs: true })}</section>`).join("")
      : entryList([]));
    loadThumbs();
  });
}

/** 목록의 첫 사진 자리에 실제 사진을 채움 (한 번에 주소 발급) */
async function loadThumbs() {
  const boxes = $$(".thumb[data-p]");
  if (!boxes.length) return;
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(boxes.map((b) => b.dataset.p), 3600);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  for (const b of boxes) {
    const url = urls.get(b.dataset.p);
    if (url) b.innerHTML = `<img src="${esc(url)}" alt="" loading="lazy">`;
  }
}

/* ---------- 가입 승인 ---------- */
async function renderAdmin() {
  document.title = "가입 승인 — 일기장";
  app.innerHTML = `<main class="wrap narrow"><header class="top"><div class="brand"><h1><a href="#/" aria-label="첫 화면으로">${brandMark()}</a></h1><time class="brand-clock" data-clock>${clockText(nowMs())}</time></div><a class="btn ghost sm" href="#/calendar">달력으로</a></header>
    <h2 class="page-title">가입 승인</h2><ul class="paper people" id="people"></ul></main>`;
  const draw = async () => {
    const { data } = await sb.from("profiles").select("id, nickname, email, approved, created_at").order("created_at", { ascending: false });
    const people = data ?? [];
    $("#people").innerHTML = !state.isAdmin || !people.length ? '<li class="muted" style="justify-content:center">관리자만 볼 수 있는 화면이에요.</li>'
      : people.map((p) => `<li><div><p style="font-weight:600">${esc(p.nickname || "이름 없음")}</p><p class="muted small">${esc(p.email)}</p></div>
        ${p.id === state.user.id ? '<span class="muted small">관리자</span>'
          : p.approved ? `<button class="btn outline sm" type="button" data-id="${p.id}" data-v="false">승인 취소</button>`
          : `<button class="btn primary sm" type="button" data-id="${p.id}" data-v="true">승인</button>`}</li>`).join("");
    $$("[data-id]").forEach((b) => b.onclick = async () => {
      const approved = b.dataset.v === "true";
      const { error } = await sb.rpc("approve_user", { _user_id: b.dataset.id, _approved: approved });
      if (error) { toast("관리자만 승인할 수 있어요.", "error"); return; }
      toast(approved ? "승인했어요" : "승인을 취소했어요");
      draw();
    });
  };
  draw();
}

/* ---------- 라우터 ---------- */
const PRIVATE = { "/calendar": renderCalendar, "/reports": renderReports, "/search": renderSearch, "/timeline": renderTimeline, "/admin": renderAdmin };

async function route() {
  leaveHook?.();
  leaveHook = null;
  const { path, params } = parseHash();
  if (path === "/" || !(path in PRIVATE || path === "/auth")) return renderHome();
  if (path === "/auth") {
    if (state.user) return go("#/calendar", true);
    return renderAuth();
  }
  if (!state.user) return go("#/auth", true);
  if (!state.profile) await loadMe();
  return PRIVATE[path](params);
}

async function start() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (!window.__DIARY_TEST_CLIENT__) {
      app.innerHTML = `<main class="auth"><div class="paper notice"><h2>연결 준비 중</h2><p>js/config.js에 Supabase 주소와 키를 넣으면 일기장이 열려요.</p></div></main>`;
      return;
    }
  }
  sb = window.__DIARY_TEST_CLIENT__ ?? (await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm"))
    .createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true } });

  const { data } = await sb.auth.getSession();
  state.user = data.session?.user ?? null;
  // 가입 확인 메일 링크로 돌아오면 ?code= 를 지우고 달력으로
  if (new URLSearchParams(location.search).has("code")) history.replaceState(null, "", location.pathname + (state.user ? "#/calendar" : "#/auth"));

  sb.auth.onAuthStateChange((event, session) => {
    const before = state.user?.id;
    state.user = session?.user ?? null;
    if (state.user?.id === before) return;
    state.profile = null; state.isAdmin = false; state.labels = [];
    if (event === "SIGNED_IN" && parseHash().path === "/auth") go("#/calendar", true);
    else if (!state.user && parseHash().path in PRIVATE) go("#/auth", true);
  });
  window.addEventListener("hashchange", route);
  route();
  startClocks();
}

start();
