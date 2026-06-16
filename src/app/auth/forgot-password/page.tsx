'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import Logo from '@/components/layout/Logo';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const supabase = createClient();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="auth-root">

      {/* ── Left panel ── */}
      <div className="auth-left">
        <video className="auth-video" src="/login.mp4" autoPlay muted loop playsInline />
        <div className="auth-left-overlay" />
        <div className="auth-left-content">
          <div className="auth-brand-accent" />
          <div className="auth-brand"><Logo size={40} color="#fff" /></div>
          <p className="auth-brand-sub">{t.auth.tagline}</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-right">
        <div className="auth-form-wrap">

          {sent ? (
            <>
              <div className="auth-icon-circle">
                <MailCheck size={26} strokeWidth={1.8} />
              </div>
              <div className="auth-form-header">
                <h1 className="auth-title">{t.auth.checkInbox}</h1>
                <p className="auth-sub">
                  {t.auth.checkInboxSub.split('{email}')[0]}<strong>{email}</strong>{t.auth.checkInboxSub.split('{email}')[1]}
                </p>
              </div>
              <Link href="/auth/login" className="auth-back-link">
                <ArrowLeft size={15} /> {t.auth.backToSignIn}
              </Link>
            </>
          ) : (
            <>
              <div className="auth-form-header">
                <h1 className="auth-title">{t.auth.forgotTitle}</h1>
                <p className="auth-sub">{t.auth.forgotSub}</p>
              </div>

              {error && (
                <div className="auth-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="field-group">
                  <label className="field-label">{t.auth.email}</label>
                  <input
                    type="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="field-input"
                    placeholder="you@example.com"
                  />
                </div>

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading
                    ? <span className="auth-spinner" />
                    : <><span>{t.auth.sendResetLink}</span><ArrowRight size={16} /></>
                  }
                </button>
              </form>

              <p className="auth-switch">
                <Link href="/auth/login" className="auth-back-link">
                  <ArrowLeft size={15} /> {t.auth.backToSignIn}
                </Link>
              </p>
            </>
          )}

        </div>
      </div>

      <style jsx>{`
        .auth-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        /* ── Left ── */
        .auth-left {
          position: relative;
          overflow: hidden;
          background: #080c14;
        }
        .auth-video {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: 0.45;
        }
        .auth-left-overlay {
          position: absolute; inset: 0;
          background:
            linear-gradient(to bottom, rgba(5,7,12,0.3) 0%, rgba(5,7,12,0.55) 100%),
            linear-gradient(135deg, rgba(174,5,10,0.25) 0%, transparent 60%);
        }
        .auth-left-content {
          position: relative; z-index: 2;
          height: 100%;
          display: flex; flex-direction: column;
          justify-content: flex-end;
          padding: 44px 48px;
        }
        .auth-brand-accent {
          width: 36px; height: 3px;
          background: #ae050a;
          border-radius: 2px;
          margin-bottom: 16px;
        }
        .auth-brand {
          margin-bottom: 10px;
          filter: drop-shadow(0 2px 24px rgba(0,0,0,0.4));
        }
        .auth-brand-sub {
          font-size: 13px; color: rgba(255,255,255,0.38);
          font-weight: 400; letter-spacing: 0.3px;
        }

        /* ── Right ── */
        .auth-right {
          background: #fff;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 20px;
        }
        .auth-form-wrap {
          width: 100%; max-width: 380px;
        }
        .auth-form-header { margin-bottom: 32px; }
        .auth-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 26px; font-weight: 800;
          color: #0f172a; letter-spacing: -0.5px;
          margin-bottom: 6px;
        }
        .auth-sub { font-size: 14px; color: #94a3b8; line-height: 1.6; }

        .auth-icon-circle {
          width: 52px; height: 52px;
          border-radius: 50%;
          background: #fef2f2;
          color: #ae050a;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 20px;
        }

        .auth-error {
          display: flex; align-items: center; gap: 8px;
          background: #fef2f2; border: 1px solid #fecaca;
          color: #ae050a; border-radius: 8px;
          padding: 10px 14px; font-size: 13px;
          margin-bottom: 20px;
        }

        .auth-form { display: flex; flex-direction: column; gap: 18px; }

        .field-group { display: flex; flex-direction: column; gap: 6px; }
        .field-label {
          font-size: 12.5px; font-weight: 600;
          color: #475569; letter-spacing: 0.2px;
        }

        .field-input {
          width: 100%; padding: 11px 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px; font-family: 'Inter', sans-serif;
          color: #0f172a; background: #f8fafc;
          outline: none;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
        }
        .field-input:focus {
          border-color: #ae050a;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(174,5,10,0.08);
        }
        .field-input::placeholder { color: #cbd5e1; }

        .auth-submit {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #ae050a 0%, #c8060b 100%);
          color: #fff; border: none; border-radius: 8px;
          font-size: 14px; font-weight: 700;
          font-family: 'Inter', sans-serif;
          cursor: pointer; margin-top: 4px;
          box-shadow: 0 4px 16px rgba(174,5,10,0.35);
          transition: all 0.18s;
        }
        .auth-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #900408, #ae050a);
          box-shadow: 0 6px 24px rgba(174,5,10,0.5);
          transform: translateY(-1px);
        }
        .auth-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .auth-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .auth-switch {
          text-align: center; margin-top: 24px;
          font-size: 13.5px; color: #94a3b8;
        }
        .auth-back-link {
          display: inline-flex; align-items: center; gap: 6px;
          color: #ae050a; font-weight: 600; text-decoration: none;
          font-size: 13.5px;
        }
        .auth-back-link:hover { text-decoration: underline; }

        @media (max-width: 768px) {
          .auth-root { grid-template-columns: 1fr; }
          .auth-left { display: none; }
          .auth-right { min-height: 100vh; padding: 32px 16px; }
          .auth-title { font-size: 22px; }
        }
        @media (max-width: 480px) {
          .auth-form-wrap { max-width: 100%; }
          .field-input { padding: 13px 14px; font-size: 16px; }
          .auth-submit { padding: 14px; font-size: 15px; }
        }
      `}</style>
    </div>
  );
}
