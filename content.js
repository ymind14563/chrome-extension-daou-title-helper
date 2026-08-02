(function () {
  "use strict";
  if (window.__dthLoaded) return;   // 중복 주입 방지
  window.__dthLoaded = true;
  console.log("[제목생성기] content script 로드됨", location.href);

  // ===== enum =====
  const TYPES = ["회의", "미팅", "출장", "작업", "점검", "인증", "행사", "교육", "면접", "기타"];
  const MEETING_ROOM_VALUE = "본사회의실";

  const TITLE_SELECTOR    = 'input.ipt_tit[name="summary"]';
  const LOCATION_SELECTOR = '#form-field-location[name="location"]';
  const ROOT_ID  = "schedule-title-helper";
  const PANEL_ID = "dth-panel";
  const FAB_ID   = "dth-fab";

  // 상태
  // scope: "내부"|"외부"|null,  room: true|false|null (내부일 때만),  type: 문자열|null
  const state = { scope: null, room: null, placeName: "", dept: "", subject: "", type: "회의", region: "" };
  let panelOpen = false;

  function resolvePlace() {
    if (state.scope === "외부") return "외부";
    if (state.scope === "내부") {
      if (state.room === true) return "회의실";
      if (state.room === false) return "내부";
    }
    return null;
  }

  // ===== 제목 조합 =====
  function buildTitle() {
    const place = resolvePlace();
    if (!place) return "";
    const subj = state.subject.trim();
    if (!subj) return "";
    const type = state.type || "";
    const dept = state.dept.trim();
    if (place === "외부") {
      const pn = state.placeName.trim();
      const rg = state.region.trim();
      let t = `[외부] ${pn ? pn + " " : ""}${dept ? dept + " " : ""}${subj}${type ? " " + type : ""}`.replace(/\s+/g, " ").trim();
      if (rg) t += ` (${rg})`;
      return t;
    }
    return `[${place}] ${dept ? dept + " " : ""}${subj}${type ? " " + type : ""}`.replace(/\s+/g, " ").trim();
  }

  function locationFieldValue() {
    const place = resolvePlace();
    if (place === "회의실") return MEETING_ROOM_VALUE;
    const pn = state.placeName.trim();
    if (place === "외부") {
      const rg = state.region.trim();
      return pn + (rg ? `(${rg})` : "");
    }
    return pn; // 내부
  }

  function fillInput(selector, value) {
    const el = document.querySelector(selector);
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function applyToForm() {
    if (!document.querySelector(TITLE_SELECTOR)) return { ok: false, reason: "일정 등록 폼에서 사용하세요" };
    if (!resolvePlace()) return { ok: false, reason: "구분을 선택하세요" };
    const title = buildTitle();
    if (!title) return { ok: false, reason: "주제를 입력하세요" };
    const t = fillInput(TITLE_SELECTOR, title);
    const locVal = locationFieldValue();
    if (locVal) fillInput(LOCATION_SELECTOR, locVal);
    return t ? { ok: true } : { ok: false, reason: "제목칸을 찾지 못했습니다" };
  }

  // ===== 구분별 공식/예시/툴팁 =====
  function formulaText() {
    const p = resolvePlace();
    if (p === "외부")  return "[외부] 장소명 + 사업/부서명 + 주제 + 성격 (지역)";
    if (p === "회의실") return "[회의실] 사업/부서명 + 주제 + 성격";
    if (p === "내부")  return "[내부] 사업/부서명 + 주제 + 성격";
    return "[구분] 사업/부서명 + 주제 + 성격";
  }
  function exampleText() {
    const p = resolvePlace();
    if (p === "외부")  return "예: [외부] ○○본사 ○○구축사업 착수 미팅 (강남)";
    if (p === "회의실") return "예: [회의실] ○○구축사업 착수 회의";
    if (p === "내부")  return "예: [내부] ○○구축사업 착수 작업";
    return "구분을 선택하세요";
  }
  function locTooltip() {
    return resolvePlace() === "외부"
      ? "제목과 다우오피스 장소 필드에 '장소(지역)' 형태로 입력됩니다"
      : "다우오피스 장소 필드에만 입력됩니다 (제목 미표시)";
  }

  // ===== 패널 HTML =====
  function panelInnerHTML() {
    return `
      <div class="dth-head">
        <b>제목 생성기</b>
        <span class="dth-tag dth-formula">[구분] 주제 성격</span>
        <button type="button" class="dth-close" title="닫기">✕</button>
      </div>
      <div class="dth-body">
        <div class="dth-row">
          <span class="dth-label">구분</span>
          <div class="dth-opts" data-group="scope"></div>
        </div>
        <div class="dth-row dth-room-row">
          <span class="dth-label">회의실 <span class="dth-info" tabindex="0">ⓘ<span class="dth-tip dth-room-tip"></span></span></span>
          <div class="dth-opts" data-group="room"></div>
        </div>
        <div class="dth-row dth-place-row">
          <span class="dth-label">장소명 <span class="dth-info" tabindex="0">ⓘ<span class="dth-tip dth-place-tip"></span></span></span>
          <input type="text" class="dth-input dth-placename" placeholder="예: ○○본사, ○○구청, ○○호텔">
        </div>
        <div class="dth-row dth-region-row">
          <span class="dth-label">지역</span>
          <input type="text" class="dth-input dth-region" placeholder="예: 강남, 종로, 대전, 일본">
        </div>
        <div class="dth-row">
          <span class="dth-label">사업/부서명</span>
          <input type="text" class="dth-input dth-dept" placeholder="예: ○○구축사업, ○○부">
        </div>
        <div class="dth-row">
          <span class="dth-label">주제</span>
          <input type="text" class="dth-input dth-subject" placeholder="예: 착수, 정기점검 대응">
        </div>
        <div class="dth-row">
          <span class="dth-label">성격</span>
          <div class="dth-opts" data-group="type"></div>
        </div>
        <div class="dth-foot-wrap">
          <div class="dth-preview-label">미리보기</div>
          <div class="dth-foot">
            <div class="dth-preview dth-empty"></div>
            <button type="button" class="dth-apply" disabled>적용</button>
          </div>
          <div class="dth-msg"></div>
        </div>
          <div class="dth-credit">
            <span>v1.0.0</span>
            <span>created by S</span>
          </div>
      </div>
    `;
  }

  // 칩 하나 생성: <button class="dth-chip" data-val="..">라벨</button>  (input 안 씀 → 클릭 확실)
  function makeChip(group, val, label, active) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dth-chip" + (active ? " dth-on" : "");
    b.setAttribute("data-group", group);
    b.setAttribute("data-val", val);
    b.textContent = label;
    return b;
  }

  function wirePanel(panel) {
    const el = (s) => panel.querySelector(s);

    const scopeBox = panel.querySelector('.dth-opts[data-group="scope"]');
    const roomBox  = panel.querySelector('.dth-opts[data-group="room"]');
    const typeBox  = panel.querySelector('.dth-opts[data-group="type"]');

    // 칩 채우기
    scopeBox.append(makeChip("scope","내부","내부", state.scope==="내부"), makeChip("scope","외부","외부", state.scope==="외부"));
    roomBox.append(makeChip("room","y","사용", state.room===true), makeChip("room","n","미사용", state.room===false));
    TYPES.forEach(t => typeBox.append(makeChip("type", t, t, state.type===t)));

    const roomRow   = el(".dth-room-row");
    const placeRow  = el(".dth-place-row");
    const regionRow = el(".dth-region-row");
    const formula   = el(".dth-formula");
    const preview   = el(".dth-preview");
    const applyBtn  = el(".dth-apply");
    const msg       = el(".dth-msg");
    const placeTip  = el(".dth-place-tip");
    const roomTip   = el(".dth-room-tip");
    const placeInput  = el(".dth-placename");
    const regionInput = el(".dth-region");

    // 표시 갱신 (핵심)
    function render() {
      const place = resolvePlace();
      const showRoom   = state.scope === "내부";
      const showPlace  = (place === "내부" || place === "외부");
      const showRegion = (place === "외부");

      roomRow.style.display   = showRoom ? "flex" : "none";
      placeRow.style.display  = showPlace ? "flex" : "none";
      regionRow.style.display = showRegion ? "flex" : "none";

      // 안 보이는 필드 값 비우기
      if (!showPlace)  { state.placeName = ""; placeInput.value = ""; }
      if (!showRegion) { state.region = ""; regionInput.value = ""; }

      formula.textContent = formulaText();
      // 장소명 플레이스홀더: 내부/외부에 따라
      placeInput.placeholder = (place === "내부")
        ? "예: 근처 ○○카페, 휴게실, 창고, 옥상"
        : "예: ○○본사, ○○구청, ○○호텔";
      if (placeTip) placeTip.textContent = locTooltip();
      if (roomTip)  roomTip.textContent  = "다우오피스 장소 필드에 '본사회의실'로 입력됩니다";

      const title = buildTitle();
      if (title) {
        preview.textContent = title;
        preview.classList.remove("dth-empty");
        applyBtn.disabled = false;
      } else {
        preview.textContent = exampleText();
        preview.classList.add("dth-empty");
        applyBtn.disabled = true;
      }
      msg.textContent = "";
    }

    // 칩 활성표시 갱신
    function syncChipUI(group) {
      panel.querySelectorAll(`.dth-chip[data-group="${group}"]`).forEach(c => {
        let on = false;
        const v = c.getAttribute("data-val");
        if (group === "scope") on = (state.scope === v);
        else if (group === "room") on = (state.room === (v === "y"));
        else if (group === "type") on = (state.type === v);
        c.classList.toggle("dth-on", on);
      });
    }

    // === 칩 클릭 (이벤트 위임: 박스에 한 번만) ===
    function onChipClick(group, e) {
      const chip = e.target.closest(".dth-chip");
      if (!chip) return;
      e.preventDefault(); e.stopPropagation();
      const v = chip.getAttribute("data-val");

      if (group === "scope") {
        if (state.scope === v) { state.scope = null; state.room = null; }
        else { state.scope = v; if (v === "외부") state.room = null; }
        syncChipUI("scope"); syncChipUI("room");
      } else if (group === "room") {
        const bool = (v === "y");
        state.room = (state.room === bool) ? null : bool;
        syncChipUI("room");
      } else if (group === "type") {
        state.type = (state.type === v) ? null : v;
        syncChipUI("type");
      }
      render();
    }
    scopeBox.addEventListener("click", (e) => onChipClick("scope", e));
    roomBox.addEventListener("click", (e) => onChipClick("room", e));
    typeBox.addEventListener("click", (e) => onChipClick("type", e));

    // 텍스트 입력
    const bind = (input, key) => input.addEventListener("input", (e) => { state[key] = e.target.value; render(); });
    bind(placeInput, "placeName");
    bind(regionInput, "region");
    bind(el(".dth-dept"), "dept");
    bind(el(".dth-subject"), "subject");

    el(".dth-subject").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); applyBtn.click(); }
    });
    applyBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const r = applyToForm();
      msg.style.color = r.ok ? "#1a7a3c" : "#c0392b";
      msg.textContent = r.ok ? "입력 성공 (다우오피스에서 시간·참석자·내용 입력 후 확인버튼 클릭)" : r.reason;
    });
    el(".dth-close").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); togglePanel(false); });

    // 값 복원
    placeInput.value = state.placeName;
    regionInput.value = state.region;
    el(".dth-dept").value = state.dept;
    el(".dth-subject").value = state.subject;

    render();
  }

  // ===== FAB + 패널 =====
  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = ROOT_ID;
    const fab = document.createElement("button");
    fab.id = FAB_ID; fab.type = "button"; fab.title = "제목 생성기";
    fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h2"/><path d="M17 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2"/></svg>`;
    fab.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); togglePanel(); });
    root.appendChild(fab);
    if (document.body) document.body.appendChild(root);
    return root;
  }

  function togglePanel(force) {
    const root = ensureRoot();
    panelOpen = (typeof force === "boolean") ? force : !panelOpen;
    let panel = document.getElementById(PANEL_ID);
    if (panelOpen) {
      if (!panel) {
        panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.innerHTML = panelInnerHTML();
        root.appendChild(panel);
        wirePanel(panel);
      }
      panel.style.display = "block";
    } else if (panel) {
      panel.style.display = "none";
    }
  }

  try {
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((req) => {
        if (req && req.type === "TOGGLE_PANEL") togglePanel();
        return false;
      });
    }
  } catch (e) {}

  // ===== 등록 화면에서만 노출 =====
  function isRegistPage() {
    return location.href.includes("/calendar/regist") || !!document.querySelector(TITLE_SELECTOR);
  }
  function updateVisibility() {
    ensureRoot();
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    if (isRegistPage()) {
      root.style.display = "block";
    } else {
      root.style.display = "none";
      panelOpen = false;
      const panel = document.getElementById(PANEL_ID);
      if (panel) panel.style.display = "none";
    }
  }
  function hookUrlChange(cb) {
    ["pushState", "replaceState"].forEach((fn) => {
      const orig = history[fn];
      history[fn] = function () { const r = orig.apply(this, arguments); setTimeout(cb, 50); return r; };
    });
    window.addEventListener("popstate", () => setTimeout(cb, 50));
  }
  let started = false;
  function start() {
    if (started) return; if (!document.body) return; started = true;
    hookUrlChange(updateVisibility);
    const obs = new MutationObserver(updateVisibility);
    obs.observe(document.body, { childList: true, subtree: true });
    let n = 0;
    const t = setInterval(() => { updateVisibility(); if (++n > 20) clearInterval(t); }, 200);
    setInterval(updateVisibility, 1000);
  }
  function boot() {
    start();
    document.addEventListener("DOMContentLoaded", start, { once: true });
    window.addEventListener("load", start, { once: true });
    if (!document.body) {
      const bo = new MutationObserver(() => { if (document.body) { bo.disconnect(); start(); } });
      bo.observe(document.documentElement, { childList: true });
    }
  }
  boot();
})();
