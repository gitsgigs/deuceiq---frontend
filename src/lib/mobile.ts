import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as NativeApp } from '@capacitor/app';

export const isNativeApp = Capacitor.isNativePlatform();
export const usesMobileShell = isNativeApp || (import.meta.env.DEV && new URLSearchParams(location.search).get('mobile_preview') === '1');

// Auth emails must target the public website, never the native WebView origin.
export function publicWebOrigin() {
  return isNativeApp ? 'https://app.deuceiq.com' : window.location.origin;
}

export async function openStripePage(address: string) {
  const url = new URL(address);
  if (url.protocol !== 'https:' || url.username || url.password ||
      !['checkout.stripe.com', 'connect.stripe.com', 'accounts.stripe.com'].includes(url.hostname)) {
    throw new Error('Stripe address could not be verified.');
  }
  if (isNativeApp) await Browser.open({ url: url.href });
  else window.location.assign(url.href);
}

export async function initializeMobile() {
  if (usesMobileShell) document.documentElement.classList.add('native-app');
  if (!isNativeApp) return;
  const refresh = () => window.dispatchEvent(new Event('focus'));
  await NativeApp.addListener('appStateChange', ({ isActive }) => { if (isActive) refresh(); });
  await Browser.addListener('browserFinished', refresh);
}
