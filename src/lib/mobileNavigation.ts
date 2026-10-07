export type MobileItem<T extends string = string> = { id: T; label: string; icon: string };

// Input is the existing permission-filtered menu, never an independent role map.
export function mobileTabs<T extends string>(items: MobileItem<T>[], role: string | null) {
  const preferred = role === 'member'
    ? ['overview', 'bookings', 'clinics', 'conversations']
    : ['overview', 'calendar', 'bookings', 'conversations'];
  return preferred.flatMap(id => items.filter(item => item.id === id));
}
export function mobileLabel(id: string, fallback: string, role: string | null) {
  if (id === 'overview') return 'Home';
  if (id === 'bookings') return role === 'member' ? 'My bookings' : 'Requests';
  if (id === 'conversations') return 'Conversations';
  return fallback;
}
