'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import translations from './translations.json';

type Language = 'en' | 'tr';
type Translations = typeof translations.en;

interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: Translations;
  currency: 'TL' | 'EUR';
  setCurrency: (c: 'TL' | 'EUR') => void;
  // listingCurrency = the currency the seller used when posting
  formatPrice: (price: number, listingCurrency?: 'TL' | 'EUR') => string;
  eurTryRate: number;
}

const I18nContext = createContext<I18nContextType | null>(null);

const FALLBACK_RATE = 38; // fallback EUR/TRY rate if fetch fails

interface I18nProviderProps {
  children: ReactNode;
  initialLang?: Language;
  initialCurrency?: 'TL' | 'EUR';
}

export function I18nProvider({ children, initialLang = 'tr', initialCurrency = 'TL' }: I18nProviderProps) {
  const [lang, setLangState]         = useState<Language>(initialLang);
  const [currency, setCurrencyState] = useState<'TL' | 'EUR'>(initialCurrency);
  const [eurTryRate, setEurTryRate]  = useState<number>(FALLBACK_RATE);

  // Fetch real EUR/TRY exchange rate on mount
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/EUR')
      .then(r => r.json())
      .then(data => {
        const rate = data?.rates?.TRY;
        if (rate && typeof rate === 'number' && rate > 1) {
          setEurTryRate(rate);
        }
      })
      .catch(() => {}); // keep fallback on network error
  }, []);

  // One-time migration: if a returning user has a localStorage preference
  // from before cookies were used for SSR, but no cookie yet, copy it over
  // and apply it. This fixes itself after the first load — afterwards the
  // server already renders in the right language, no flash needed.
  useEffect(() => {
    const hasLangCookie = document.cookie.includes('drivetr_lang=');
    const hasCurrencyCookie = document.cookie.includes('drivetr_currency=');
    const savedLang     = localStorage.getItem('drivetr_lang') as Language | null;
    const savedCurrency = localStorage.getItem('drivetr_currency') as 'TL' | 'EUR' | null;

    if (!hasLangCookie && (savedLang === 'en' || savedLang === 'tr')) {
      document.cookie = `drivetr_lang=${savedLang}; path=/; max-age=31536000; SameSite=Lax`;
      if (savedLang !== lang) setLangState(savedLang);
    }
    if (!hasCurrencyCookie && (savedCurrency === 'TL' || savedCurrency === 'EUR')) {
      document.cookie = `drivetr_currency=${savedCurrency}; path=/; max-age=31536000; SameSite=Lax`;
      if (savedCurrency !== currency) setCurrencyState(savedCurrency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withTextAnim = (fn: () => void) => {
    const main = document.querySelector('main');
    if (!main) { fn(); return; }

    // Fire the state change (React will re-render async)
    fn();

    // Wait two frames: first for React to commit, second to trigger animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const TEXT_TAGS = new Set(['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','LABEL','LI','TD','TH']);
        const els: HTMLElement[] = [];

        main.querySelectorAll<HTMLElement>(
          'h1,h2,h3,h4,h5,h6,p,span,a,button,label,li,td,th'
        ).forEach(el => {
          if (el.closest('nav') || el.closest('footer') || el.closest('header')) return;
          // Only animate leaf text nodes (no block children)
          const hasBlockChild = Array.from(el.children).some(c => TEXT_TAGS.has(c.tagName));
          if (hasBlockChild) return;
          if (!el.textContent?.trim()) return;
          els.push(el);
        });

        els.forEach((el, i) => {
          el.classList.remove('text-swap-anim');
          void el.offsetWidth;
          el.style.animationDelay = `${Math.min(i * 15, 220)}ms`;
          el.classList.add('text-swap-anim');
        });

        setTimeout(() => {
          els.forEach(el => {
            el.classList.remove('text-swap-anim');
            el.style.animationDelay = '';
          });
        }, 700);
      });
    });
  };

  const setLang = (l: Language) => {
    if (l === lang) return;
    withTextAnim(() => {
      setLangState(l);
      localStorage.setItem('drivetr_lang', l);
      document.cookie = `drivetr_lang=${l}; path=/; max-age=31536000; SameSite=Lax`;
    });
  };

  const setCurrency = (c: 'TL' | 'EUR') => {
    if (c === currency) return;
    withTextAnim(() => {
      setCurrencyState(c);
      localStorage.setItem('drivetr_currency', c);
      document.cookie = `drivetr_currency=${c}; path=/; max-age=31536000; SameSite=Lax`;
    });
  };

  // price        = the raw number stored in DB
  // listingCurrency = what currency the seller used ('TL' or 'EUR')
  // currency     = what the user wants to see ('TL' or 'EUR')
  const formatPrice = (price: number, listingCurrency: 'TL' | 'EUR' = 'TL'): string => {
    let amountInTL: number;

    // First convert to TL
    if (listingCurrency === 'EUR') {
      amountInTL = price * eurTryRate;
    } else {
      amountInTL = price;
    }

    // Then convert to user's preferred display currency
    if (currency === 'EUR') {
      const amountInEUR = amountInTL / eurTryRate;
      return new Intl.NumberFormat('de-DE', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
      }).format(amountInEUR);
    } else {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency', currency: 'TRY', maximumFractionDigits: 0,
      }).format(amountInTL);
    }
  };

  const t = translations[lang] as Translations;

  return (
    <I18nContext.Provider value={{ lang, setLang, t, currency, setCurrency, formatPrice, eurTryRate }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
