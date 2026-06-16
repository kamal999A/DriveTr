'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import Logo from './Logo';

const S = {
  footer: {
    background: '#0b0f18',
    marginTop: 80,
    fontFamily: "'Inter', sans-serif",
  } as React.CSSProperties,

  inner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 16px',
  } as React.CSSProperties,


  brand: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  } as React.CSSProperties,


  desc: {
    fontSize: 13,
    lineHeight: 1.75,
    color: '#64748b',
    margin: 0,
  } as React.CSSProperties,

  contactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#475569',
  } as React.CSSProperties,

  dot: {
    width: 3,
    height: 3,
    borderRadius: '50%',
    background: '#334155',
    flexShrink: 0,
    display: 'inline-block',
  } as React.CSSProperties,


  col: {
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,

  colHd: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '2.5px',
    textTransform: 'uppercase',
    color: '#fff',
    margin: '0 0 10px',
  } as React.CSSProperties,

  link: {
    fontSize: 12.5,
    color: '#64748b',
    textDecoration: 'none',
    marginBottom: 7,
    display: 'block',
    transition: 'color 0.15s',
  } as React.CSSProperties,


  copy: {
    fontSize: 11.5,
    color: '#334155',
  } as React.CSSProperties,

  bottomLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  bottomLink: {
    fontSize: 11.5,
    color: '#334155',
    textDecoration: 'none',
  } as React.CSSProperties,
};

function FLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hov, setHov] = React.useState(false);
  return (
    <Link
      href={href}
      style={{ ...S.link, color: hov ? '#cbd5e1' : '#64748b' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </Link>
  );
}

function BLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hov, setHov] = React.useState(false);
  return (
    <a
      href={href}
      style={{ ...S.bottomLink, color: hov ? '#64748b' : '#334155' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </a>
  );
}

export default function Footer() {
  const { t } = useI18n();
  const pathname = usePathname();
  const ft = t.footer;

  if (pathname?.startsWith('/auth')) return null;
  const year = new Date().getFullYear();

  return (
    <footer style={S.footer}>
      <div style={S.inner}>

        {/* Main */}
        <div className="ft-main">

          {/* Brand */}
          <div style={S.brand}>
            <Link href="/" style={{ opacity: 0.9 }}>
              <Logo size={20} color="#fff" />
            </Link>
            <p style={S.desc}>Turkey's trusted car marketplace.<br />Buy and sell with confidence.</p>
            <div style={S.contactRow}>
              <span>Istanbul, Turkey</span>
              <span style={S.dot} />
              <a href="mailto:support@drivetr.com" style={{ color: '#64748b', textDecoration: 'none' }}>
                support@drivetr.com
              </a>
            </div>
          </div>

          {/* Columns */}
          <div className="ft-cols">
            <div style={S.col}>
              <p style={S.colHd}>{ft.platform}</p>
              <FLink href="/cars">{ft.allListings}</FLink>
              <FLink href="/post-listing">{ft.postAd}</FLink>
              <FLink href="/about">{ft.about}</FLink>
              <FLink href="/contact">{ft.contact}</FLink>
            </div>
            <div style={S.col}>
              <p style={S.colHd}>{ft.account}</p>
              <FLink href="/auth/login">{ft.signIn}</FLink>
              <FLink href="/auth/register">{ft.register}</FLink>
              <FLink href="/profile">{t.nav.profile}</FLink>
              <FLink href="/saved">{t.nav.saved}</FLink>
            </div>
            <div style={S.col}>
              <p style={S.colHd}>{ft.support}</p>
              <FLink href="/contact">{ft.helpCenter}</FLink>
              <FLink href="#">{ft.privacy}</FLink>
              <FLink href="#">{ft.terms}</FLink>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="ft-bottom">
          <span style={S.copy}>© {year} DriveTR — {ft.rights}</span>
          <div style={S.bottomLinks}>
            <BLink href="#">{ft.privacy}</BLink>
            <span style={S.dot} />
            <BLink href="#">{ft.terms}</BLink>
          </div>
        </div>

      </div>

      <style jsx>{`
        .ft-main {
          display: grid;
          grid-template-columns: 1.1fr 1.6fr;
          gap: 64px;
          padding: 28px 0 24px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .ft-cols {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          padding-top: 4px;
        }
        .ft-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
        }
        @media (max-width: 860px) {
          .ft-main { grid-template-columns: 1fr; gap: 28px; padding: 24px 0 20px; }
        }
        @media (max-width: 560px) {
          .ft-cols { grid-template-columns: repeat(2, 1fr); row-gap: 20px; gap: 16px; }
          .ft-bottom { flex-direction: column; gap: 8px; padding: 14px 0 20px; text-align: center; }
        }
        @media (max-width: 400px) {
          .ft-cols { grid-template-columns: 1fr; gap: 16px; }
        }
      `}</style>
    </footer>
  );
}
