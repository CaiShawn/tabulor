'use strict';

// Offscreen document: the only long-lived extension context that can observe
// prefers-color-scheme (MV3 service workers cannot use matchMedia). Reports
// the initial value and every change to the service worker via runtime
// messaging so the toolbar icon follows the browser theme even when no tab is
// open.
const mql = matchMedia('(prefers-color-scheme: dark)');

function reportTheme(source) {
  const theme = mql.matches ? 'dark' : 'light';
  console.log(`[tabulor-offscreen] report(${source}) prefers-dark=${mql.matches} theme=${theme}`);
  chrome.runtime.sendMessage({
    type: 'tabulor:theme-change',
    theme,
  }).then(
    () => console.log(`[tabulor-offscreen] report(${source}) delivered`),
    error => console.log(`[tabulor-offscreen] report(${source}) not delivered: ${error.message}`),
  );
}

mql.addEventListener('change', () => reportTheme('change'));
console.log(`[tabulor-offscreen] loaded, prefers-dark=${mql.matches}`);
reportTheme('initial');
