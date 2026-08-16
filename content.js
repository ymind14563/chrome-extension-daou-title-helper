(function () {
  "use strict";
  if (window.__dthLoaded) return;   // 중복 주입 방지
  window.__dthLoaded = true;
  // console.log("[제목생성기] content script 로드됨", location.href);

  // ===== enum =====
  const TYPES = ["회의", "미팅", "출장", "작업", "점검", "인증", "행사", "교육", "면접", "방문", "발표", "확인", "마감"];
  const MEETING_ROOM_VALUE = "본사 회의실";

  const TITLE_SELECTOR    = 'input.ipt_tit[name="summary"]';
  const LOCATION_SELECTOR = '#form-field-location[name="location"]';
  const ROOT_ID  = "schedule-title-helper";
  const PANEL_ID = "dth-panel";
  const FAB_ID   = "dth-fab";

  // // 킬스위치: alive.json의 enabled 값으로 판단
  // const ALIVE_CHECK_URL = "https://raw.githubusercontent.com/ymind14563/chrome-extension-daou-title-helper/main/alive.json";

  // 상태
  // scope: "내부"|"외부"|null,  room: true|false|null (내부일 때만),  type: 문자열|null
  const state = { scope: null, room: null, placeName: "", dept: "", subject: "", type: null, region: "" };
  let panelOpen = false;

  function resolvePlace() {
    if (state.scope === "외부") return "외부";
    if (state.scope === "일정체크") return "일정체크";
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
    // if (!subj) return "";
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
    // state.room = true일 때만 회의실로 입력, 외부는 장소명(지역)으로 입력, 내부는 비워둠
    if (state.room === true) return MEETING_ROOM_VALUE;
    // if (place === "회의실") return MEETING_ROOM_VALUE;
    // if (place === "일정체크") return MEETING_ROOM_VALUE;

    const pn = state.placeName.trim();
    if (place === "외부") {
      const rg = state.region.trim();
      return pn + (rg ? `(${rg})` : "");
    }
    return pn; // 내부, 일정체크
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
    if (!state.dept.trim()) return { ok: false, reason: "사업명/부서명을 입력하세요" };
    const title = buildTitle();
    if (!title) return { ok: false, reason: "생성될 제목이 완성되지 않았습니다" };
    const t = fillInput(TITLE_SELECTOR, title);
    const locVal = locationFieldValue();
    if (locVal) fillInput(LOCATION_SELECTOR, locVal);
    return t ? { ok: true } : { ok: false, reason: "제목칸을 찾지 못했습니다" };
  }

  // ===== 구분별 공식/예시/툴팁 =====
  function formulaText() {
    const p = resolvePlace();
    if (p === "외부")  return "[외부] 장소명 + 사업명/부서명 + 주제 + 성격 (지역)";
    if (p === "회의실") return "[회의실] 사업명/부서명 + 주제 + 성격";
    if (p === "내부")  return "[내부] 사업명/부서명 + 주제 + 성격";
    if (p === "일정체크") return "[일정체크] 사업명/부서명 + 주제 + 성격";
    return "[구분] 사업명/부서명 + 주제 + 성격";
  }
  function exampleText() {
    const p = resolvePlace();
    if (p === "외부")  return "예: [외부] ○○본사 ○○구축사업 착수 미팅 (강남)";
    if (p === "회의실") return "예: [회의실] ○○구축사업 착수 회의";
    if (p === "내부")  return "예: [내부] ○○구축사업 착수 작업";
    if (p === "일정체크") return "예: [일정체크] ○○구축사업 서류 제출 마감";
    return "구분을 선택하세요";
  }
  function locTooltip() {
    const place = resolvePlace();
    if (place === "외부") {
      return "제목 앞에 [외부]가 붙고, 다우오피스 장소 필드에는 '장소(지역)' 형식으로 입력됩니다";
    }
    if (place === "회의실") {
      return "제목 앞에 [회의실]이 붙고, 다우오피스 장소 필드에는 '본사 회의실'이 입력됩니다";
    }
    if (place === "내부") {
      return "제목 앞에 [내부]가 붙고, 다우오피스 장소 필드에는 장소명이 입력됩니다";
    }
    if (place === "일정체크") {
      return "제목 앞에 [일정체크]가 붙고, 다우오피스 장소 필드에는 별도 값이 입력됩니다";
    }
    return "구분을 선택하면 제목과 장소 입력 방식이 표시됩니다";
  }

  // ===== 패널 템플릿 / 설정 =====
  const PANEL_COPY = {
    title: "제목 생성기",
    rows: {
      scope: { label: "구분" },
      room: { label: "회의실" },
      place: { label: "장소명" },
      region: { label: "지역" },
      dept: { label: "사업명/부서명", placeholder: "예: ○○구축사업, ○○부 (필수값)" },
      subject: { label: "주제", placeholder: "예: 착수, 정기점검 대응 (필수값 아님)" },
      type: { label: "성격" },
    },
    preview: "미리보기",
    apply: "적용",
    version: "v1.1.1",
    credit: "created by S",
    notes: {
      label: "패치노트 보기",
      // title: "패치노트",
      items: [
        {
          title: "v1.1.1",
          items: [
            "일정체크 기능 및 성격 칩 추가",
            "설명 툴팁 문구 전체 수정",
            "주제 필드 필수값 제외 처리",
            "적용 버튼 클릭 시 패널 닫도록 수정",
            "패치노트 패널 추가",
          ],
        },
        {
          title: "v1.0.1",
          items: [
            "예시 문장 내용 수정",
            "글자 색상 조정",
          ],
        },
        {
          title: "v1.0.0",
          items: [
            "초기 릴리즈",
          ],
        },
      ],
    },
  };

  function panelHeadHTML() {
    return `
      <div class="dth-head">
        <b>${PANEL_COPY.title}</b>
        <span class="dth-tag dth-formula">[구분] 주제 성격</span>
        <button type="button" class="dth-close" title="닫기">✕</button>
      </div>
    `;
  }

  function panelBodyHTML() {
    return `
      <div class="dth-body">
        ${panelRowHTML(PANEL_COPY.rows.scope.label, '<div class="dth-opts" data-group="scope"></div>')}
        ${panelRoomRowHTML()}
        ${panelPlaceRowHTML()}
        ${panelRegionRowHTML()}
        ${panelInputRowHTML(PANEL_COPY.rows.dept.label, 'dth-dept', PANEL_COPY.rows.dept.placeholder)}
        ${panelInputRowHTML(PANEL_COPY.rows.subject.label, 'dth-subject', PANEL_COPY.rows.subject.placeholder)}
        ${panelRowHTML(PANEL_COPY.rows.type.label, '<div class="dth-opts" data-group="type"></div>')}
        ${panelFooterHTML()}
      </div>
    `;
  }

  function panelRowHTML(label, content) {
    return `
      <div class="dth-row">
        <span class="dth-label">${label}</span>
        ${content}
      </div>
    `;
  }

  function panelRoomRowHTML() {
    return `
      <div class="dth-row dth-room-row">
        <span class="dth-label">${PANEL_COPY.rows.room.label} <span class="dth-info" tabindex="0">ℹ<span class="dth-tip dth-room-tip"></span></span></span>
        <div class="dth-opts" data-group="room"></div>
      </div>
    `;
  }

  function panelPlaceRowHTML() {
    return `
      <div class="dth-row dth-place-row">
        <span class="dth-label">${PANEL_COPY.rows.place.label} <span class="dth-info" tabindex="0">ℹ<span class="dth-tip dth-place-tip"></span></span></span>
        <input type="text" class="dth-input dth-placename" placeholder="예: ○○본사, ○○구청, ○○호텔">
      </div>
    `;
  }

  function panelRegionRowHTML() {
    return `
      <div class="dth-row dth-region-row">
        <span class="dth-label">${PANEL_COPY.rows.region.label}</span>
        <input type="text" class="dth-input dth-region" placeholder="예: 강남, 종로, 대전, 일본">
      </div>
    `;
  }

  function panelInputRowHTML(label, inputClass, placeholder) {
    return `
      <div class="dth-row">
        <span class="dth-label">${label}</span>
        <input type="text" class="dth-input ${inputClass}" placeholder="${placeholder}">
      </div>
    `;
  }

  function panelFooterHTML() {
    return `
      <div class="dth-foot-wrap">
        <div class="dth-preview-label">${PANEL_COPY.preview}</div>
        <div class="dth-foot">
          <div class="dth-preview dth-empty"></div>
          <button type="button" class="dth-apply" disabled>${PANEL_COPY.apply}</button>
        </div>
        <div class="dth-msg"></div>
      </div>
      <div class="dth-footer-meta">
        <div class="dth-credit">
          <div class="dth-version-wrap">
            <span>${PANEL_COPY.version}</span>
            <button type="button" class="dth-notes-toggle" aria-expanded="false">${PANEL_COPY.notes.label}</button>
          </div>
          <span>${PANEL_COPY.credit}</span>
        </div>
        <div class="dth-notes" hidden>
          <!-- <div class="dth-notes-title">${PANEL_COPY.notes.title}</div> -->
          <ul class="dth-notes-list">
            ${PANEL_COPY.notes.items.map((item) => {
              const title = typeof item === "string" ? item : item.title;
              const subItems = Array.isArray(item && item.items) ? item.items : [];
              return `
                <li class="dth-note-item">
                  <span class="dth-note-title">${title}</span>
                  ${subItems.length ? `
                    <ul class="dth-note-sublist">
                      ${subItems.map((sub) => `<li>${sub}</li>`).join("")}
                    </ul>
                  ` : ""}
                </li>
              `;
            }).join("")}
          </ul>
        </div>
      </div>
    `;
  }

  function panelInnerHTML() {
    return `
      ${panelHeadHTML()}
      ${panelBodyHTML()}
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
    scopeBox.append(
      makeChip("scope","내부","내부", state.scope==="내부"), 
      makeChip("scope","외부","외부", state.scope==="외부"),
      makeChip("scope","일정체크","일정체크", state.scope==="일정체크")
    );
    roomBox.append(
      makeChip("room","y","사용", state.room===true), 
      makeChip("room","n","미사용", state.room===false)
    );
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
    const roomInfo  = el(".dth-room-row .dth-info");
    const placeInput  = el(".dth-placename");
    const regionInput = el(".dth-region");

    // 표시 갱신 (핵심)
    function render() {
      const place = resolvePlace();
      const showRoom   = state.scope === "내부" || state.scope === "일정체크";
      const showPlace  = state.scope === "외부" || ((state.scope === "내부" || state.scope === "일정체크") && state.room === false);
      const showRegion = (place === "외부");
      const showRoomInfo = showRoom && state.room !== null;

      roomRow.style.display   = showRoom ? "flex" : "none";
      placeRow.style.display  = showPlace ? "flex" : "none";
      regionRow.style.display = showRegion ? "flex" : "none";
      if (roomInfo) roomInfo.style.display = showRoomInfo ? "inline-flex" : "none";

      // 안 보이는 필드 값 비우기
      if (!showPlace)  { state.placeName = ""; placeInput.value = ""; }
      if (!showRegion) { state.region = ""; regionInput.value = ""; }

      formula.textContent = formulaText();
      // 장소명 플레이스홀더: 내부/외부에 따라
      placeInput.placeholder = (place === "내부")
        ? "예: 근처 ○○카페, 휴게실, 창고, 옥상"
        : "예: ○○본사, ○○구청, ○○호텔";
      if (placeTip) placeTip.textContent = locTooltip();
      if (roomTip) {
        if (state.scope === "일정체크" && state.room === true) {
          roomTip.textContent = "제목은 [일정체크]로 표시되고, 다우오피스 장소 필드에는 '본사 회의실'이 입력됩니다";
        } else if (state.scope === "일정체크" && state.room === false) {
          roomTip.textContent = "제목은 [일정체크]로 표시되고, 다우오피스 장소 필드에는 별도 장소명이 입력됩니다";
        } else if (state.scope === "내부" && state.room === true) {
          roomTip.textContent = "제목은 [회의실]로 표시되고, 다우오피스 장소 필드에는 '본사 회의실'이 입력됩니다";
        } else if (state.scope === "내부" && state.room === false) {
          roomTip.textContent = "제목은 [내부]로 표시되고, 다우오피스 장소 필드에는 별도 장소명이 입력됩니다";
        } else {
          roomTip.textContent = "";
        }
      }
      if (!showRoomInfo && roomTip) roomTip.textContent = "";

      const title = buildTitle();
      const hasDept = !!state.dept.trim();
      if (title && hasDept) {
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
      if (r.ok) {
        togglePanel(false);
      } else {
        msg.style.color = "#c0392b";
        msg.textContent = r.reason;
      }
      // msg.style.color = r.ok ? "#1a7a3c" : "#c0392b";
      // msg.textContent = r.ok ? "입력 성공 (다우오피스에서 시간·참석자·내용 입력 후 확인버튼 클릭)" : r.reason;
    });
    el(".dth-close").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); togglePanel(false); });

    const notesToggle = el(".dth-notes-toggle");
    const notesBox = el(".dth-notes");
    if (notesToggle && notesBox) {
      notesToggle.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const open = notesBox.hidden;
        notesBox.hidden = !open;
        notesToggle.setAttribute("aria-expanded", String(open));
      });
    }

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
  // (async () => {
  //   try {
  //     const res = await fetch(ALIVE_CHECK_URL, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  //     if (!res.ok) return; // 파일 삭제/private → JSON 없음, 조용히 정지
  //     const data = await res.json();
  //     const alive = data && (data.enabled === true || data.enabled === "true");
  //     if (alive) { boot(); return; }
  //     if (data.message && !sessionStorage.getItem("dth-stop-shown")) {
  //       sessionStorage.setItem("dth-stop-shown", "1"); // 세션당 1번
  //       alert(data.message);                            // 문구는 전부 alive.json에서
  //     }
  //   } catch (e) {} // 네트워크 실패 → 조용히 정지
  // })();
  boot();
})();
