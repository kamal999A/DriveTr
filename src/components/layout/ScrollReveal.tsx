'use client';

import { useEffect } from 'react';

export default function ScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;

          if (el.classList.contains('grid-listings')) {
            // Staggered card grid: mark revealed so CSS delays kick in, then mark cards-in
            el.classList.add('revealed');
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                el.classList.add('cards-in');
              });
            });
          } else {
            const delay = el.dataset.revealDelay || '0';
            el.style.transitionDelay = `${delay}ms`;
            el.classList.add('revealed');
          }

          observer.unobserve(el);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
    );

    const observe = () => {
      document.querySelectorAll('[data-reveal], .grid-listings').forEach((el) => {
        if (!el.classList.contains('revealed')) observer.observe(el);
      });
    };

    observe();

    // Coalesce bursts of DOM mutations (e.g. chat messages streaming in)
    // into a single re-scan per animation frame instead of one per mutation.
    let scheduled = false;
    const scheduleObserve = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        observe();
      });
    };

    const mutation = new MutationObserver(scheduleObserve);
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);

  return null;
}
