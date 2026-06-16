'use client';
// src/components/layout/NavigationProgress.tsx
// Thin red progress bar at top of the page during navigation.

import React, { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathRef = useRef(pathname);

  const stopTimers = () => {
    if (timerRef.current)    { clearInterval(timerRef.current);  timerRef.current = null; }
    if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null; }
  };

  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;

    // Route changed — complete the bar
    stopTimers();
    setProgress(100);
    const hide = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 400);
    return () => clearTimeout(hide);
  }, [pathname]);

  // Intercept link clicks to start the bar immediately
  useEffect(() => {
    const start = () => {
      stopTimers();
      setProgress(0);
      setVisible(true);
      let p = 0;
      timerRef.current = setInterval(() => {
        p += Math.random() * 12 + 5;
        if (p >= 88) {
          if (timerRef.current) clearInterval(timerRef.current);
          p = 88;
        }
        setProgress(p);
      }, 120);
      // Failsafe: if navigation never happens (cancelled, error, etc.)
      // don't leave the bar stuck at 88% forever.
      failsafeRef.current = setTimeout(() => {
        stopTimers();
        setVisible(false);
        setProgress(0);
      }, 8000);
    };

    const handleClick = (e: MouseEvent) => {
      // Modified clicks open new tabs — no in-app navigation happens.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = (e.target as HTMLElement).closest('a');
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return;

      const rawHref = a.getAttribute('href') || '';
      if (rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;

      const url = new URL(a.href);
      if (url.origin !== location.origin) return;

      // Same destination → Next.js won't navigate, so the bar would hang.
      if (url.pathname === location.pathname && url.search === location.search) return;

      start();
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
      stopTimers();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${progress}%`,
        height: '2.5px',
        background: 'linear-gradient(90deg, #ae050a, #ff4422)',
        zIndex: 9999,
        transition: progress === 100
          ? 'width 0.2s ease, opacity 0.35s ease 0.15s'
          : 'width 0.12s ease',
        opacity: progress >= 100 ? 0 : 1,
        boxShadow: '0 0 8px rgba(174,5,10,0.6)',
        borderRadius: '0 2px 2px 0',
        pointerEvents: 'none',
      }}
    />
  );
}
