'use client';

import { useEffect } from 'react';

/**
 * Records one activity ping per tab every 15 minutes. Feeds the admin console's
 * "last seen" and hours-on-platform figures. Fire-and-forget: failures are
 * ignored so telemetry can never break a page.
 */
export function ActivityHeartbeat() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const KEY = 'i2i_last_ping';
    const WINDOW_MS = 15 * 60 * 1000;

    const ping = () => {
      const last = Number(window.sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last < WINDOW_MS) return;
      window.sessionStorage.setItem(KEY, String(Date.now()));
      fetch('/api/activity/heartbeat', { method: 'POST' }).catch(() => {});
    };

    ping();

    const onVisible = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return null;
}
