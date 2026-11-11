export const DEMO_COOKIE = 'sooty_demo_consent';

export function consentAllowed(cookieText, cookiesEnabled = true) {
  return cookiesEnabled && cookieText.split(';').some(part => part.trim() === DEMO_COOKIE + '=enabled');
}

export function hasDemoConsent() {
  try { return consentAllowed(document.cookie, navigator.cookieEnabled); }
  catch { return false; }
}

export function setDemoConsent(enabled, startTour = false) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  try {
    document.cookie = DEMO_COOKIE + '=' + (enabled ? 'enabled' : '') +
      '; Path=/; SameSite=Lax; Max-Age=' + (enabled ? 2592000 : 0) + secure;
  } catch { /* Readback below keeps a blocked browser locked. */ }
  const allowed = hasDemoConsent();
  window.dispatchEvent(new CustomEvent('suiteconsentchange', {detail: {allowed, startTour}}));
  return enabled ? allowed : !allowed;
}
