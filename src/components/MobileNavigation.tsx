import { useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { isNativeApp, usesMobileShell } from '../lib/mobile';
import { mobileTabs, mobileLabel } from '../lib/mobileNavigation';
import type { MobileItem } from '../lib/mobileNavigation';

export function MobileNavigation<T extends string>(p: {
  items: MobileItem<T>[]; selected: T; role: string | null; email?: string;
  onNavigate: (id: T) => void; onSignOut: () => Promise<void>;
}) {
  const [more, setMore] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { setMore(false); }, [p.selected, p.role, p.email, p.items]);
  useEffect(() => {
    if (more) dialog.current?.showModal();
    else dialog.current?.close();
  }, [more]);
  useEffect(() => {
    if (!isNativeApp) return;
    let cancelled = false;
    const listener = NativeApp.addListener('backButton', () => {
      // Native dialogs own cancellation; do not bypass an active booking dialog.
      const open = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (open) { open.dispatchEvent(new Event('cancel', { cancelable: true })); return; }
      const home = p.items.find(item => item.id === 'overview');
      if (home && p.selected !== home.id) p.onNavigate(home.id);
      else void NativeApp.minimizeApp();
    });
    void listener.then(handle => { if (cancelled) void handle.remove(); });
    return () => { cancelled = true; void listener.then(handle => handle.remove()); };
  }, [p.items, p.selected, p.onNavigate]);
  if (!usesMobileShell) return null;
  const tabs = mobileTabs(p.items, p.role);
  return <>
    <nav className="mobile-tabs" aria-label="App navigation">
      {tabs.map(item => <button type="button" key={item.id} aria-current={p.selected === item.id ? 'page' : undefined}
        onClick={() => { p.onNavigate(item.id); window.scrollTo({ top: 0 }); }}>
        <span aria-hidden="true">{item.id === 'conversations' ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z"/></svg> : item.icon}</span>
        {mobileLabel(item.id, item.label, p.role)}
      </button>)}
      <button type="button" aria-haspopup="dialog" aria-expanded={more} onClick={() => setMore(true)}><span aria-hidden="true">•••</span>More</button>
    </nav>
    <dialog ref={dialog} className="mobile-menu" aria-label="All app screens" onCancel={() => setMore(false)} onClose={() => setMore(false)}>
      <header><div><h2>DeuceIQ</h2><p>{(p.role ?? 'Account').replaceAll('_', ' ')} · {p.email}</p></div><button type="button" onClick={() => setMore(false)} aria-label="Close menu">×</button></header>
      <nav aria-label="All permitted screens">{p.items.map(item => <button type="button" key={item.id} aria-current={p.selected === item.id ? 'page' : undefined}
        onClick={() => { setMore(false); p.onNavigate(item.id); window.scrollTo({ top: 0 }); }}>{mobileLabel(item.id, item.label, p.role)}</button>)}</nav>
      <button type="button" className="mobile-sign-out" onClick={() => { setMore(false); void p.onSignOut(); }}>Sign out</button>
    </dialog>
  </>;
}
