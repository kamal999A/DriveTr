'use client';
// src/app/about/page.tsx

import React from 'react';
import { Shield, Zap, Globe, Users, Car, MapPin, Mail } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function AboutPage() {
  const { t } = useI18n();

  const features = [
    { icon: <Shield size={24} />, title: t.about.feature1Title, desc: t.about.feature1Desc },
    { icon: <Zap size={24} />, title: t.about.feature2Title, desc: t.about.feature2Desc },
    { icon: <Globe size={24} />, title: t.about.feature3Title, desc: t.about.feature3Desc },
    { icon: <Users size={24} />, title: t.about.feature4Title, desc: t.about.feature4Desc },
    { icon: <Car size={24} />, title: t.about.feature5Title, desc: t.about.feature5Desc },
    { icon: <MapPin size={24} />, title: t.about.feature6Title, desc: t.about.feature6Desc },
  ];

  return (
    <div className="about-page">
      {/* ── Hero ── */}
      <section className="about-hero">
        <div className="hero-bg" />
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="container hero-content">
          <h1 className="about-title">{t.about.title}</h1>
        </div>
      </section>

      <div className="container">
        {/* Mission */}
        <section className="about-section">
          <div className="about-mission card" data-reveal>
            <span className="section-tag">{t.about.missionTitle}</span>
            <h2>{t.about.missionTitle}</h2>
            <p>{t.about.missionP1}</p>
            <p>{t.about.missionP2}</p>
          </div>
        </section>

        {/* Features */}
        <section className="about-section">
          <h2 className="section-title" data-reveal>{t.about.differentTitle}</h2>
          <div className="feature-grid">
            {features.map((f, i) => (
              <div key={f.title} className="feature-card" data-reveal data-reveal-delay={i * 80}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="about-section about-section-last">
          <h2 className="section-title" data-reveal>{t.about.builtBy}</h2>
          <div className="team-card" data-reveal data-reveal-delay="100">
            <div className="team-avatar">KH</div>
            <div className="team-info">
              <h3>Kamal Huseynov</h3>
              <p className="team-role">{t.about.teamRole}</p>
              <a href="mailto:kamal1.huseynov@epitech.eu" className="team-email">
                <Mail size={14} /> kamal1.huseynov@epitech.eu
              </a>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .about-page { padding-bottom: 60px; }

        /* ── Hero ── */
        .about-hero {
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
        .about-title {
          font-family: 'Montserrat', sans-serif;
          font-size: clamp(30px, 5vw, 44px); font-weight: 800;
          color: #fff; letter-spacing: -0.5px;
        }

        /* ── Sections ── */
        .about-section { padding: 40px 0 0; }
        .about-section-last { padding-bottom: 8px; }
        .section-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 22px; font-weight: 800; color: #1a1a1a;
          margin: 0 0 16px;
        }
        .section-tag {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
          color: #ae050a; background: #fef2f2;
          padding: 4px 10px; border-radius: 4px;
          width: fit-content; margin-bottom: 14px;
        }

        /* ── Mission ── */
        .about-mission {
          padding: 32px;
          border-radius: 16px;
          background: #fff;
          border: 1px solid #f0f0f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .about-mission h2 {
          font-family: 'Montserrat', sans-serif;
          font-size: 22px; font-weight: 800; margin-bottom: 14px; color: #1a1a1a;
        }
        .about-mission p { font-size: 15px; color: #555; line-height: 1.8; margin-bottom: 12px; }
        .about-mission p:last-child { margin-bottom: 0; }

        /* ── Feature grid ── */
        .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .feature-card {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 16px;
          padding: 26px 24px;
          position: relative;
          overflow: hidden;
          transition: all 0.22s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .feature-card:hover {
          border-color: #f3c9ca;
          box-shadow: 0 10px 28px rgba(174,5,10,0.1), 0 2px 6px rgba(0,0,0,0.04);
          transform: translateY(-4px);
        }
        .feature-icon {
          width: 52px; height: 52px;
          background: #fef2f2;
          border: 1px solid #fadcdc;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: #ae050a; margin-bottom: 18px;
          transition: all 0.22s;
        }
        .feature-card:hover .feature-icon {
          background: linear-gradient(135deg, #ae050a, #d40710);
          border-color: transparent;
          color: #fff;
          transform: scale(1.08);
        }
        .feature-card h3 {
          font-family: 'Montserrat', sans-serif;
          font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #1a1a1a;
        }
        .feature-card p { font-size: 13.5px; color: #777; line-height: 1.7; }

        /* ── Team ── */
        .team-card {
          display: flex; align-items: center; gap: 22px;
          padding: 28px 32px;
          border-radius: 16px;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          position: relative; overflow: hidden;
        }
        .team-card::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 60% 100% at 100% 0%, rgba(255,255,255,0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .team-avatar {
          position: relative; z-index: 1;
          width: 64px; height: 64px; border-radius: 50%;
          background: rgba(255,255,255,0.15);
          border: 1.5px solid rgba(255,255,255,0.3);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 22px;
          flex-shrink: 0;
        }
        .team-info { position: relative; z-index: 1; }
        .team-info h3 {
          font-family: 'Montserrat', sans-serif;
          font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 4px;
        }
        .team-role { font-size: 13.5px; color: rgba(255,255,255,0.8); margin-bottom: 8px; }
        .team-email {
          display: inline-flex; align-items: center; gap: 6px;
          color: #fff; font-size: 13px; font-weight: 600;
          text-decoration: none; transition: opacity 0.15s;
          opacity: 0.9;
        }
        .team-email:hover { opacity: 1; text-decoration: underline; }

        @media (max-width: 768px) {
          .feature-grid { grid-template-columns: 1fr; }
          .team-card { flex-direction: column; text-align: center; padding: 28px 20px; }
        }
      `}</style>
    </div>
  );
}
