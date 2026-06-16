'use client';
// src/app/contact/page.tsx

import React, { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';

export default function ContactPage() {
  const { t } = useI18n();
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        name: prev.name || `${profile?.name || ''} ${profile?.surname || ''}`.trim(),
        email: prev.email || user.email || '',
      }));
    }
  }, [user, profile]);

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.from('contact_messages').insert({
      user_id: user?.id ?? null,
      name: form.name,
      email: form.email,
      message: form.message,
    });
    if (err) { setError(err.message); setLoading(false); return; }

    // Reopen the support chat thread in case it was previously marked as
    // ended — a new contact message means the conversation continues.
    if (user) {
      await supabase
        .from('support_chat_status')
        .upsert({ user_id: user.id, ended: false, ended_at: null });
    }

    setSent(true);
    setLoading(false);
  };

  const infoItems = [
    { icon: <Mail size={20} />, label: 'support@drivetr.com' },
    { icon: <Phone size={20} />, label: '+90 (212) 555 0100' },
    { icon: <MapPin size={20} />, label: t.contact.address },
  ];

  return (
    <div className="contact-page">
      {/* ── Hero ── */}
      <section className="contact-hero">
        <div className="hero-bg" />
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="container hero-content">
          <h1 className="contact-title">{t.contact.title}</h1>
        </div>
      </section>

      <div className="container contact-body">
        <div className="contact-info" data-reveal="left">
          <span className="section-tag">{t.contact.getInTouch}</span>
          <h2>{t.contact.getInTouch}</h2>
          <p>{t.contact.intro}</p>
          <div className="info-items">
            {infoItems.map((item, i) => (
              <div key={i} className="info-item">
                <div className="info-icon">{item.icon}</div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="contact-form-card" data-reveal="right">
          {authLoading ? (
            <div className="sent-state">
              <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
            </div>
          ) : sent ? (
            <div className="sent-state">
              <div className="sent-icon"><CheckCircle size={36} /></div>
              <h3>{t.contact.messageSent}</h3>
              <p>{t.contact.messageSentSub}</p>
              <button className="btn btn-outline" onClick={() => { setSent(false); setForm(prev => ({ ...prev, message: '' })); }}>
                {t.contact.sendAnother}
              </button>
            </div>
          ) : (
            <>
              <h2>{t.contact.sendMessage}</h2>
              {user && <p className="reply-notice">{t.contact.replyNotice}</p>}
              {error && <div className="form-error">{error}</div>}
              <form onSubmit={handleSubmit} className="contact-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t.contact.yourName}</label>
                    <input type="text" required className="form-input" value={form.name} onChange={set('name')} placeholder={t.contact.namePlaceholder} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.contact.emailAddress}</label>
                    <input type="email" required className="form-input" value={form.email} onChange={set('email')} placeholder="you@example.com" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.contact.message}</label>
                  <textarea required className="form-textarea" value={form.message} onChange={set('message')} placeholder={t.contact.messagePlaceholder} rows={5} />
                </div>
                <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                  {loading ? <span className="spinner" /> : <><Send size={16} /> {t.contact.send}</>}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .contact-page { padding-bottom: 60px; }

        /* ── Hero ── */
        .contact-hero {
          position: relative;
          overflow: hidden;
          padding: 32px 0;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
        }
        .hero-bg {
          position: absolute; inset: 0; z-index: 0;
          background:
            radial-gradient(ellipse 70% 90% at 100% 0%, rgba(255,255,255,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 50% 60% at 0% 100%, rgba(0,0,0,0.15) 0%, transparent 50%);
        }
        .orb {
          position: absolute; border-radius: 50%; pointer-events: none;
          filter: blur(80px); opacity: 0.25; z-index: 0;
        }
        .orb1 {
          width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%);
          top: -160px; right: -100px;
        }
        .orb2 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(0,0,0,0.4), transparent 70%);
          bottom: -120px; left: -80px;
        }
        .hero-content { position: relative; z-index: 1; }
        .contact-title {
          font-family: 'Montserrat', sans-serif;
          font-size: clamp(30px, 5vw, 44px); font-weight: 800;
          color: #fff; letter-spacing: -0.5px;
        }

        /* ── Body ── */
        .contact-body { display: grid; grid-template-columns: 1fr 1.6fr; gap: 32px; padding-top: 40px; align-items: start; }

        .section-tag {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
          color: #ae050a; background: #fef2f2;
          padding: 4px 10px; border-radius: 4px;
          width: fit-content; margin-bottom: 14px;
        }

        .contact-info {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .contact-info h2 {
          font-family: 'Montserrat', sans-serif;
          font-size: 22px; font-weight: 800; margin-bottom: 12px; color: #1a1a1a;
        }
        .contact-info > p { font-size: 14.5px; color: #777; line-height: 1.75; margin-bottom: 26px; }
        .info-items { display: flex; flex-direction: column; gap: 14px; }
        .info-item {
          display: flex; align-items: center; gap: 14px;
          font-size: 14px; color: #333; font-weight: 600;
          padding: 12px 14px;
          border-radius: 12px;
          background: #fafafa;
          border: 1px solid #f0f0f0;
          transition: all 0.2s;
        }
        .info-item:hover {
          border-color: #f3c9ca;
          background: #fef7f7;
          transform: translateX(2px);
        }
        .info-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: #fef2f2; border: 1px solid #fadcdc;
          color: #ae050a;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .contact-form-card {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .contact-form-card h2 {
          font-family: 'Montserrat', sans-serif;
          font-size: 22px; font-weight: 800; margin-bottom: 6px; color: #1a1a1a;
        }
        .form-error { background: #ffeaea; border: 1px solid #ffb3b3; color: #ae050a; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
        .contact-form { display: flex; flex-direction: column; gap: 16px; margin-top: 18px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .reply-notice { font-size: 12.5px; color: #999; margin: 0; }

        /* ── Sent / Sign-in states ── */
        .sent-state, .signin-state {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          text-align: center; padding: 48px 20px;
        }
        .sent-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: linear-gradient(135deg, #16a34a 0%, #0f7a36 100%);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 4px;
          box-shadow: 0 8px 24px rgba(22,163,74,0.3);
        }
        .sent-state h3, .signin-state h3 { font-family: 'Montserrat', sans-serif; font-size: 19px; font-weight: 700; color: #1a1a1a; }
        .sent-state p, .signin-state p { color: #777; font-size: 14px; line-height: 1.6; margin: 0 0 6px; }
        .signin-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 4px;
          box-shadow: 0 8px 24px rgba(174,5,10,0.3);
        }

        @media (max-width: 768px) {
          .contact-body { grid-template-columns: 1fr; }
          .form-row { grid-template-columns: 1fr; }
          .contact-info, .contact-form-card { padding: 24px; }
        }
      `}</style>
    </div>
  );
}
