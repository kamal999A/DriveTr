'use client';
// src/components/layout/PageTransition.tsx
// Fades + gently lifts each page in on route change.

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Each time the route changes, reset visibility then fade in
    setVisible(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <>
      <div className={`page-transition ${visible ? 'pt-in' : ''}`}>
        {children}
      </div>
      <style jsx global>{`
        .page-transition {
          opacity: 0;
          transform: translateY(10px);
          transition:
            opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
          min-height: calc(100vh - 96px);
        }
        .page-transition.pt-in {
          opacity: 1;
          transform: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .page-transition { opacity: 1; transform: none; transition: none; }
        }
      `}</style>
    </>
  );
}
