'use client';
// src/app/page.tsx

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase/client';
import CarCard from '@/components/car/CarCard';
import type { CarListing } from '@/types';

const MAKES = [
  { name: 'BMW',        emoji: '🔵' },
  { name: 'Mercedes',   emoji: '⭐' },
  { name: 'Toyota',     emoji: '🔴' },
  { name: 'Honda',      emoji: '🔴' },
  { name: 'Ford',       emoji: '🔵' },
  { name: 'Audi',       emoji: '⚪' },
  { name: 'Volkswagen', emoji: '🔵' },
  { name: 'Hyundai',    emoji: '🔷' },
  { name: 'Kia',        emoji: '🔴' },
  { name: 'Renault',    emoji: '💛' },
  { name: 'Fiat',       emoji: '🔵' },
  { name: 'Volvo',      emoji: '🔷' },
];

const BRAND_LOGOS = [
  { name: 'Tesla',      logo: 'https://www.carlogos.org/car-logos/tesla-logo.png' },
  { name: 'Mercedes',   logo: 'https://www.carlogos.org/car-logos/mercedes-benz-logo.png' },
  { name: 'Toyota',     logo: 'https://www.carlogos.org/car-logos/toyota-logo.png' },
  { name: 'Honda',      logo: 'https://www.carlogos.org/car-logos/honda-logo-2000.png' },
  { name: 'Ford',       logo: 'https://www.carlogos.org/car-logos/ford-logo-2017.png' },
  { name: 'Audi',       logo: 'https://www.carlogos.org/car-logos/audi-logo-2016.png' },
  { name: 'Volkswagen', logo: 'https://www.carlogos.org/car-logos/volkswagen-logo.png' },
  { name: 'Hyundai',    logo: 'https://www.carlogos.org/car-logos/hyundai-logo-2011.png' },
];

export default function HomePage() {
  const { t, formatPrice } = useI18n();
  const { user } = useAuth();
  const [listings, setListings] = useState<CarListing[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const supabase = createClient();

  // Cross-fade the hero video at its loop point.
  // (Previously this lived in an inline ref callback, which spawned a brand-new
  // requestAnimationFrame loop on every render — e.g. every search keystroke —
  // without ever cancelling the old one.)
  useEffect(() => {
    const el = heroVideoRef.current;
    if (!el) return;
    const FADE = 1.5;
    let raf = 0;
    let pastFirstPlay = false;
    const tick = () => {
      const ct = el.currentTime;
      const d = el.duration;
      if (d) {
        if (ct > FADE) pastFirstPlay = true;
        if (pastFirstPlay && ct < FADE) el.style.opacity = String(ct / FADE);
        else if (ct > d - FADE) el.style.opacity = String((d - ct) / FADE);
        else el.style.opacity = '1';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('car_listings')
        .select('*, seller:profiles(id,name,surname,avatar_url)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12);
      if (data) setListings(data as CarListing[]);

      if (user) {
        const { data: saved } = await supabase
          .from('saved_cars').select('listing_id').eq('user_id', user.id);
        if (saved) setSavedIds(new Set(saved.map((s: any) => s.listing_id)));
      }

      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="homepage">
      {/* ── Hero ── */}
      <section className="hero">
        {/* video background */}
        <video
          className="hero-video"
          src="/car.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          ref={heroVideoRef}
        />
        <div className="hero-bg" />

        {/* animated grid lines */}
        <div className="hero-grid" aria-hidden="true" />

        <div className="container hero-content">
          <h1 className="hero-title">
            <span className="title-line1">{t.home.heroLine1}</span>
            <span className="title-accent">{t.home.heroAccent}</span>
          </h1>

          <p className="hero-sub">{t.home.heroSub}</p>
        </div>

        {/* scroll cue → Popular Brands */}
        <div className="scroll-cue" aria-hidden="true">
          <ChevronDown size={36} strokeWidth={2.5} />
          <ChevronDown size={36} strokeWidth={2.5} className="scroll-cue-2" />
        </div>

      </section>

      {/* ── Popular Brands ── */}
      <section className="brands-section">
        <div className="container">
          <div className="brands-header" data-reveal>
            <span className="brands-label">{t.home.manufacturers}</span>
            <h2 className="brands-title">{t.home.browseByBrand}</h2>
          </div>
          <div className="brands-grid">
            {BRAND_LOGOS.map((b, i) => (
              <Link key={b.name} href={`/cars?make=${b.name}`} className="brand-card" style={{ animationDelay: `${i * 55}ms` }}>
                <span className="brand-logo-wrap">
                  <img src={b.logo} alt={b.name} className="brand-logo-img" />
                </span>
                <span className="brand-name">{b.name}</span>
              </Link>
            ))}
            <Link href="/cars" className="brand-card brand-card-all" style={{ animationDelay: `${BRAND_LOGOS.length * 55}ms` }}>
              <span className="brand-logo-wrap brand-logo-all">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </span>
              <span className="brand-name">{t.home.moreLink}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Latest Listings ── */}
      <section className="listings-section">
        <div className="container">
          <div className="section-header" data-reveal>
            <div className="section-header-left">
              <div className="section-tag"><Clock size={12} /> {t.home.latestListings}</div>
              <h2 className="section-title">{t.home.latestListings}</h2>
            </div>
            <Link href="/cars" className="see-all-btn">
              {t.home.browseAll} <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid-listings">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-img" />
                  <div className="skeleton-body">
                    <div className="skeleton-line w70" />
                    <div className="skeleton-line w50 mt8" />
                    <div className="skeleton-line w90 mt8" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-emoji">🚗</div>
              <h3>{t.home.noListings}</h3>
              <p>{t.home.noListingsSub}</p>
              <Link href="/post-listing" className="btn btn-primary btn-lg">{t.home.postFirst}</Link>
            </div>
          ) : (
            <div className="grid-listings">
              {listings.map(listing => (
                <CarCard
                  key={listing.id}
                  listing={listing}
                  saved={savedIds.has(listing.id)}
                  onSaveToggle={(id, s) => {
                    setSavedIds(prev => {
                      const next = new Set(prev);
                      if (s) next.add(id); else next.delete(id);
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>


      <style jsx>{`
        /* ── Hero ── */
        .hero {
          position: relative;
          padding: 130px 0 160px;
          min-height: 680px;
          overflow: hidden;
          background: #080c14;
        }
        /* video bg */
        .hero-video {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          object-position: center;
          z-index: 0;
          opacity: 1;
        }
        .hero-bg {
          position: absolute; inset: 0; z-index: 1;
          background:
            linear-gradient(to bottom, rgba(5,7,12,0.45) 0%, rgba(5,7,12,0.3) 50%, rgba(5,7,12,0.55) 100%),
            radial-gradient(ellipse 70% 90% at 100% 50%, rgba(174,5,10,0.18) 0%, transparent 55%),
            radial-gradient(ellipse 50% 60% at 0% 100%, rgba(174,5,10,0.1) 0%, transparent 50%);
        }

        /* animated perspective grid */
        .hero-grid {
          position: absolute; inset: 0; pointer-events: none; z-index: 2;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.4) 70%, transparent 100%);
          animation: gridSlide 20s linear infinite;
        }
        @keyframes gridSlide {
          from { background-position: 0 0; }
          to   { background-position: 0 60px; }
        }

        /* glowing orbs */
        .orb {
          position: absolute; border-radius: 50%; pointer-events: none;
          filter: blur(80px); opacity: 0.35; z-index: 2;
        }
        .orb1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(174,5,10,0.6), transparent 70%);
          top: -150px; right: -100px;
          animation: orbFloat 10s ease-in-out infinite;
        }
        .orb2 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(174,5,10,0.3), transparent 70%);
          bottom: -80px; left: -80px;
          animation: orbFloat 14s ease-in-out infinite reverse;
        }
        .orb3 {
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(255,80,80,0.2), transparent 70%);
          top: 40%; left: 30%;
          animation: orbFloat 8s ease-in-out infinite;
          animation-delay: -4s;
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(20px, -30px) scale(1.05); }
          66%       { transform: translate(-15px, 15px) scale(0.97); }
        }

        .hero-fade {
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 80px;
          background: linear-gradient(to bottom, transparent, #f8fafc);
          pointer-events: none;
        }

        .hero-content {
          position: relative; z-index: 3;
          text-align: center;
          animation: heroIn 0.8s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes heroIn {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .hero-title {
          font-family: 'Montserrat', sans-serif;
          font-size: clamp(48px, 9vw, 110px);
          font-weight: 800;
          color: #fff;
          margin-bottom: 24px;
          line-height: 1.04;
          letter-spacing: -2.5px;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          animation: heroIn 0.8s 0.15s cubic-bezier(0.22,1,0.36,1) both;
        }
        .title-line1 { display: block; }
        .title-accent {
          display: block;
          background: linear-gradient(100deg, #ff8a8a 0%, #ff4444 25%, #ae050a 50%, #ff4444 75%, #ff8a8a 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          position: relative;
          animation: titleShimmer 6s linear infinite;
          padding-bottom: 8px;
        }
        @keyframes titleShimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .title-accent::after {
          content: '';
          position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%);
          width: 0; height: 4px; border-radius: 2px;
          background: linear-gradient(90deg, transparent, #ae050a, #ff5b5b, #ae050a, transparent);
          animation: underlineGrow 1.2s 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes underlineGrow {
          to { width: 70%; }
        }

        .hero-sub {
          color: rgba(255,255,255,0.45);
          font-size: 17px;
          margin-bottom: 8px;
          line-height: 1.7;
          max-width: 480px;
          margin-left: auto; margin-right: auto;
          animation: heroIn 0.8s 0.2s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* ── Scroll cue ── */
        .scroll-cue {
          position: absolute;
          bottom: 28px; left: 50%; transform: translateX(-50%);
          z-index: 5;
          height: 56px; width: 56px;
          display: flex; align-items: center; justify-content: center;
          color: #ff5b5b;
          filter: drop-shadow(0 0 14px rgba(255,80,80,0.5));
          animation: heroIn 0.8s 0.35s cubic-bezier(0.22,1,0.36,1) both;
        }
        .scroll-cue :global(svg) {
          position: absolute;
          animation: cueDrop 1.6s ease-in-out infinite;
        }
        .scroll-cue :global(.scroll-cue-2) {
          animation-delay: 0.4s;
        }
        @keyframes cueDrop {
          0%   { opacity: 0; transform: translateY(-14px) scale(0.85); }
          40%  { opacity: 1; transform: translateY(0) scale(1); }
          75%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(22px) scale(1.05); }
        }
        @media (max-width: 768px) {
          .scroll-cue { bottom: 16px; height: 44px; width: 44px; }
          .scroll-cue :global(svg) { width: 28px; height: 28px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .scroll-cue :global(svg) { animation: none; opacity: 0.7; }
        }

        /* ── Popular Brands Section ── */
        .brands-section {
          background: #fff;
          padding: 20px 0 16px;
          border-top: 1px solid #ebebeb;
          border-bottom: 1px solid #ebebeb;
        }
        .brands-header {
          display: flex; align-items: baseline; justify-content: space-between;
          border-bottom: 1px solid #e8e8e8;
          padding-bottom: 10px;
          margin-bottom: 16px;
        }
        .brands-label {
          font-size: 11px; font-weight: 700;
          letter-spacing: 2.5px; text-transform: uppercase;
          color: #999;
        }
        .brands-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 13px; font-weight: 600;
          color: #1a1a1a; margin: 0;
          letter-spacing: -0.2px;
        }
        .brands-grid {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 4px;
          text-align: center;
        }
        :global(.brand-card) {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 0;
          padding: 16px 4px 14px;
          text-decoration: none;
          border-radius: 14px;
          position: relative;
          transition: background 0.2s;
          animation: brandFadeIn 0.5s ease both;
          text-align: center;
          width: 100%;
        }
        @keyframes brandFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        :global(.brand-card)::after {
          content: '';
          position: absolute; bottom: 4px; left: 50%; right: 50%;
          height: 2px; background: #ae050a; border-radius: 2px;
          transition: left 0.25s ease, right 0.25s ease;
        }
        :global(.brand-card:hover) { background: #fafafa; }
        :global(.brand-card:hover)::after { left: 30%; right: 30%; }
        .brand-logo-wrap {
          width: 68px; height: 68px;
          border-radius: 50%;
          border: 1px solid #e8e8e8;
          display: flex; align-items: center; justify-content: center;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1), border-radius 0.25s ease;
          flex-shrink: 0;
          padding: 14px;
          margin: 0 auto;
        }
        :global(.brand-card:hover) .brand-logo-wrap {
          border-color: #f3c9ca;
          border-radius: 18px;
          box-shadow: 0 10px 28px rgba(174,5,10,0.14), 0 2px 6px rgba(0,0,0,0.06);
          transform: translateY(-6px) scale(1.08);
        }
        :global(.brand-card:active) .brand-logo-wrap {
          transform: translateY(-2px) scale(1.02);
          transition-duration: 0.1s;
        }
        .brand-logo-img {
          width: 100%; height: 100%;
          object-fit: contain;
          display: block;
          transition: transform 0.25s ease;
        }
        :global(.brand-card:hover) .brand-logo-img {
          transform: scale(1.06);
        }
        .brand-logo-all {
          color: #bbb;
          padding: 20px;
          transition: color 0.22s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        :global(.brand-card-all:hover) .brand-logo-all {
          color: #ae050a;
          border-color: #ddd;
          transform: translateY(-6px) scale(1.08) rotate(0deg);
        }
        :global(.brand-card-all:hover) .brand-logo-all svg {
          animation: arrowNudge 0.6s ease;
        }
        @keyframes arrowNudge {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3px); }
        }
        .brand-name {
          font-size: 11.5px; font-weight: 600;
          color: #1a1a1a;
          letter-spacing: 0.2px;
          text-align: center;
          white-space: nowrap;
          width: 100%;
          display: block;
          margin-top: 8px;
          transition: color 0.2s ease;
        }
        :global(.brand-card:hover) .brand-name { color: #ae050a; }
        :global(.brand-card-all) .brand-name { color: #999; }
        :global(.brand-card-all:hover) .brand-name { color: #ae050a; }

        /* ── Listings Section ── */
        .listings-section { padding: 28px 0 40px; background: #f8fafc; margin-top: -1px; }
        .section-header {
          display: flex; align-items: flex-end; justify-content: space-between;
          margin-bottom: 28px;
        }
        .section-header-left { display: flex; flex-direction: column; gap: 4px; }
        .section-tag {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
          color: #ae050a; background: #fef2f2;
          padding: 4px 10px; border-radius: 4px;
          width: fit-content;
        }
        .section-tag.dark { color: #fff; background: rgba(255,255,255,0.1); }
        .section-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 22px; font-weight: 800; color: #1a1a1a;
          margin: 0;
        }
        :global(.see-all-btn) {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 18px;
          background: #fff; border: 1.5px solid #e0e0e0;
          border-radius: 8px; font-size: 13px; font-weight: 600; color: #333;
          text-decoration: none; transition: all 0.15s;
        }
        :global(.see-all-btn:hover) { border-color: #ae050a; color: #ae050a; background: #fef2f2; }

        /* ── Skeleton ── */
        .skeleton-card { background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .skeleton-img {
          height: 180px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        .skeleton-body { padding: 14px; }
        .skeleton-line {
          height: 12px; border-radius: 4px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        .w70 { width: 70%; }
        .w50 { width: 50%; }
        .w90 { width: 90%; }
        .mt8 { margin-top: 8px; }
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

        /* ── Empty ── */
        .empty-emoji { font-size: 52px; margin-bottom: 12px; }

        /* ── Why DriveTR ── */
        .why-section {
          padding: 72px 0 64px;
          background: linear-gradient(160deg, #0f172a 0%, #1a0507 100%);
        }
        .why-header { text-align: center; margin-bottom: 48px; }
        .why-title {
          font-family: 'Montserrat', sans-serif;
          font-size: clamp(24px, 3vw, 36px); font-weight: 800;
          color: #fff; margin: 12px 0 10px;
          letter-spacing: -0.5px;
        }
        .why-sub { font-size: 15px; color: rgba(255,255,255,0.4); max-width: 480px; margin: 0 auto; }
        .why-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .why-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 36px 28px;
          position: relative;
          overflow: hidden;
          transition: all 0.22s;
        }
        .why-card::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%);
        }
        .why-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-4px);
        }
        .why-card.featured {
          background: linear-gradient(135deg, rgba(174,5,10,0.15), rgba(174,5,10,0.05));
          border-color: rgba(174,5,10,0.3);
        }
        .why-card.featured:hover { background: linear-gradient(135deg, rgba(174,5,10,0.25), rgba(174,5,10,0.1)); }
        .why-icon-wrap {
          width: 52px; height: 52px;
          background: rgba(174,5,10,0.15);
          border: 1px solid rgba(174,5,10,0.3);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: #ff6666; margin-bottom: 20px;
        }
        .why-num {
          font-family: 'Montserrat', sans-serif;
          font-size: 11px; font-weight: 800; letter-spacing: 2px;
          color: rgba(174,5,10,0.5); margin-bottom: 10px;
        }
        .why-card h3 {
          font-family: 'Montserrat', sans-serif;
          font-size: 17px; font-weight: 700; color: #fff;
          margin-bottom: 10px;
        }
        .why-card p { font-size: 13.5px; color: rgba(255,255,255,0.45); line-height: 1.7; }

        /* ── CTA ── */
        .cta-section { padding: 0 0 56px; background: linear-gradient(160deg, #0f172a 0%, #1a0507 100%); }
        .cta-card {
          display: flex; align-items: center; justify-content: space-between;
          background: linear-gradient(135deg, rgba(174,5,10,0.12), rgba(174,5,10,0.04));
          border: 1px solid rgba(174,5,10,0.2);
          border-radius: 16px; padding: 36px 40px;
        }
        .cta-text h2 {
          font-family: 'Montserrat', sans-serif;
          font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px;
        }
        .cta-text p { font-size: 14px; color: rgba(255,255,255,0.45); }
        .cta-actions { display: flex; gap: 12px; flex-shrink: 0; }
        .cta-btn-primary {
          display: inline-flex; align-items: center;
          background: linear-gradient(135deg, #ae050a, #d40710);
          color: #fff; padding: 12px 24px; border-radius: 8px;
          font-size: 14px; font-weight: 700; text-decoration: none;
          transition: all 0.18s; box-shadow: 0 4px 16px rgba(174,5,10,0.4);
        }
        .cta-btn-primary:hover { box-shadow: 0 6px 24px rgba(174,5,10,0.55); transform: translateY(-1px); }
        .cta-btn-outline {
          display: inline-flex; align-items: center;
          border: 1.5px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.75);
          padding: 12px 24px; border-radius: 8px;
          font-size: 14px; font-weight: 600; text-decoration: none;
          transition: all 0.18s;
        }
        .cta-btn-outline:hover { border-color: rgba(255,255,255,0.4); color: #fff; background: rgba(255,255,255,0.05); }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .brands-grid { grid-template-columns: repeat(5, 1fr); }
        }
        @media (max-width: 900px) {
          .cta-card { flex-direction: column; gap: 24px; text-align: center; }
          .cta-actions { width: 100%; justify-content: center; }
        }
        @media (max-width: 768px) {
          .hero { padding: 80px 0 100px; min-height: 480px; }
          .hero-sub { font-size: 15px; max-width: 100%; padding: 0 8px; }
          .why-grid { grid-template-columns: 1fr; }
          .section-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .cta-card { padding: 24px 20px; }
          .cta-text h2 { font-size: 18px; }
          .cta-btn-primary, .cta-btn-outline { padding: 11px 18px; font-size: 13px; }
          .listings-section { padding: 20px 0 32px; }
          .brands-section { padding: 14px 0 10px; }
        }
        @media (max-width: 640px) {
          .brands-grid { grid-template-columns: repeat(3, 1fr); }
          .brands-header { flex-direction: column; gap: 4px; }
          .brand-logo-wrap { width: 52px; height: 52px; padding: 10px; }
          .brand-name { font-size: 10.5px; }
          .section-title { font-size: 18px; }
          .cta-actions { flex-direction: column; }
          .cta-btn-primary, .cta-btn-outline { width: 100%; justify-content: center; }
        }
        @media (max-width: 480px) {
          .hero { padding: 60px 0 80px; min-height: 400px; }
          .hero-title { letter-spacing: -1px; margin-bottom: 16px; }
          .hero-sub { font-size: 14px; }
          .brands-grid { grid-template-columns: repeat(3, 1fr); gap: 2px; }
          .brand-logo-wrap { width: 44px; height: 44px; padding: 8px; }
        }
      `}</style>
    </div>
  );
}
