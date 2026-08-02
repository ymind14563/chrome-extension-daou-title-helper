// ===== 툴바 아이콘 클릭 → content script에 토글 신호 =====
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" }).catch(() => {});
});

// ===== 강제 주입: 크롬 첫 시작/탭 복원 시 content script가 안 붙는 문제 해결 =====
const CAL_URL = "https://*.daouoffice.com/gw/app/calendar";

// 해당 탭에 content script가 이미 있는지 확인 후 없으면 주입
async function ensureInjected(tabId, url) {
  if (!url || !url.startsWith(CAL_URL)) return;
  try {
    // 이미 로드됐는지 확인 (전역 플래그 체크)
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__dthLoaded,
    });
    if (res && res.result) return; // 이미 있음
  } catch (e) { return; } // 접근 불가 페이지면 중단

  // 없으면 CSS + JS 주입
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["panel.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (e) {}
}

// 탭 업데이트(로딩 완료) 시마다 체크
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") ensureInjected(tabId, tab.url);
});

// 크롬 시작 시 이미 열려있는 모든 캘린더 탭에 주입
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ url: CAL_URL + "*" }, (tabs) => {
    tabs.forEach((t) => t.id && ensureInjected(t.id, t.url));
  });
});

// 확장 설치/업데이트 직후에도 주입
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: CAL_URL + "*" }, (tabs) => {
    tabs.forEach((t) => t.id && ensureInjected(t.id, t.url));
  });
});
