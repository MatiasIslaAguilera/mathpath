// Best-effort in-app reminder: while the app is open (or its tab is in the background), show a
// notification at the chosen time if today's practice hasn't happened yet. It cannot fire when
// the app is closed; the calendar event (ics.ts) covers that.

import { parseTime } from './ics';

/** Milliseconds until today's reminder, or null if it already passed or today is done. */
export function msUntilReminder(time: string, practicedToday: boolean, now = new Date()): number | null {
  if (practicedToday) return null;
  const { h, m } = parseTime(time);
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0).getTime();
  const ms = at - now.getTime();
  return ms > 0 ? ms : null;
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** Show the reminder through the service worker if there is one (works on Android), else directly. */
export async function showReminder(): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const title = "Time for today's MathPath session";
  const options: NotificationOptions = { body: 'About 10 minutes. Even 3 problems keeps your streak going.', tag: 'mathpath-daily', icon: '/pwa-192x192.png' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification(title, options);
  } catch {
    /* fall through to a page notification */
  }
  try {
    new Notification(title, options);
  } catch {
    /* some mobile browsers only allow service-worker notifications */
  }
}
