// ====================================================================
// ADDP COMMERCE INTELLIGENCE - BACKGROUND SERVICE WORKER
// File: public/extension/background.js
// Target: Zero-tab architecture service worker & keep-alive monitor
// ====================================================================

let keepAliveTimer = null;

function startKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 10000);
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ADDP Background] Extension installed/updated successfully. Zero-Tab mode active.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'PONG', zero_tab: true });
    return true;
  }
  return false;
});
