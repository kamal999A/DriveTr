'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import {
  Heart, User, Plus, LogOut, Settings,
  Menu, X, Search, Bell, Trash2,
  MessageCircle, LayoutDashboard
} from 'lucide-react';
import type { Announcement } from '@/types';

const supabase = createClient();

export default function Navbar() {
  const { user, profile, signOut, isAdmin, loading: authLoading } = useAuth();
  const { lang, setLang, t, currency, setCurrency } = useI18n();
  const router   = useRouter();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen]       = useState(false);
  const [userOpen, setUserOpen]       = useState(false);
  const [searchVal, setSearchVal]     = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcement, setAnnouncement]   = useState<Announcement | null>(null);
  const [announcementNew, setAnnouncementNew] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setUserOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Unread message count — fetch once per login and keep it live via a
  // single realtime subscription (re-subscribing on every navigation was
  // causing a DB query + channel churn on each page change).
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel('navbar-unread')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => fetchUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Reset the badge while the user is on /messages
  useEffect(() => {
    if (pathname === '/messages') setUnreadCount(0);
  }, [pathname]);

  // Latest platform announcement — show a "new" badge until the user opens it,
  // and hide it entirely once dismissed.
  useEffect(() => {
    if (!user) { setAnnouncement(null); setAnnouncementNew(false); return; }

    (async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      if (localStorage.getItem('drivetr_dismissed_announcement') === data.id) return;
      setAnnouncement(data as Announcement);
      const seenId = localStorage.getItem('drivetr_seen_announcement');
      setAnnouncementNew(seenId !== data.id);
    })();
  }, [user]);

  const openAnnouncement = () => {
    setAnnouncementOpen(true);
    if (announcement) {
      localStorage.setItem('drivetr_seen_announcement', announcement.id);
      setAnnouncementNew(false);
    }
  };

  const dismissAnnouncement = () => {
    if (announcement) localStorage.setItem('drivetr_dismissed_announcement', announcement.id);
    setAnnouncementOpen(false);
    setAnnouncement(null);
  };

  // Subtle shadow once the page scrolls
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hide navbar entirely on auth pages.
  // NOTE: this must stay BELOW every hook call (Rules of Hooks).
  if (pathname?.startsWith('/auth')) return null;

  const handleSignOut = async () => { await signOut(); router.push('/'); };
  const handleSearch  = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) router.push(`/cars?q=${encodeURIComponent(searchVal.trim())}`);
  };

  const initials = (profile?.name || user?.email || 'U')[0].toUpperCase();

  return (
    <header className={`nb ${scrolled ? 'nb-scrolled' : ''}`}>
      <div className="nb-inner">

        {/* Logo */}
        <Link href="/" className="nb-logo">
          <Logo size={19} />
        </Link>

        {/* Center page links */}
        <nav className={`nb-text-links ${scrolled ? 'nb-text-links-hidden' : ''}`}>
          <Link href="/about" className="nb-text-link">{t.nav.about}</Link>
          <Link href="/contact" className="nb-text-link">{t.nav.contact}</Link>
        </nav>

        {/* Scroll search */}
        <form className={`nb-search-wrap ${scrolled ? 'nb-search-wrap-visible' : ''}`} onSubmit={handleSearch}>
          <Search size={15} className="nb-search-icon" />
          <input
            type="text"
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder={t.home.search}
            className="nb-search-input"
          />
        </form>

        {/* Right icons */}
        <div className="nb-right">

          {/* Lang pill */}
          <div className="nb-pill">
            <button className={`nb-pill-btn ${lang === 'tr' ? 'on' : ''}`} onClick={() => setLang('tr')}>TR</button>
            <span className="nb-pill-div" />
            <button className={`nb-pill-btn ${lang === 'en' ? 'on' : ''}`} onClick={() => setLang('en')}>EN</button>
          </div>

          <span className="nb-sep" />

          {/* Currency pill */}
          <div className="nb-pill">
            <button className={`nb-pill-btn ${currency === 'TL' ? 'on' : ''}`} onClick={() => setCurrency('TL')}>₺</button>
            <span className="nb-pill-div" />
            <button className={`nb-pill-btn ${currency === 'EUR' ? 'on' : ''}`} onClick={() => setCurrency('EUR')}>€</button>
          </div>

          <span className="nb-sep" />

          {/* Messages */}
          {!authLoading && user && (
            <Link href="/messages" className="nb-icon-link" title={t.nav.messages} style={{ position: 'relative' }}>
              <MessageCircle size={20} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="nb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </Link>
          )}

          {/* Saved */}
          <Link href="/saved" className="nb-icon-link" title={t.nav.saved}>
            <Heart size={20} strokeWidth={1.8} />
          </Link>

          {/* Admin */}
          {isAdmin && (
            <Link href="/admin" className="nb-icon-link nb-admin-icon" title={t.nav.admin}>
              <LayoutDashboard size={20} strokeWidth={1.8} />
            </Link>
          )}

          {/* Announcement bell */}
          {user && announcement && (
            <button className="nb-icon-link" title={t.nav.announcements} onClick={openAnnouncement} style={{ position: 'relative' }}>
              <Bell size={20} strokeWidth={1.8} />
              {announcementNew && <span className="nb-badge nb-badge-dot" />}
            </button>
          )}

          <span className="nb-sep" />

          {/* Post ad */}
          <Link href="/post-listing" className="nb-icon-link nb-post-icon" title={t.nav.postAd}>
            <Plus size={16} strokeWidth={2.5} />
          </Link>

          <span className="nb-sep" />

          {/* User avatar / login */}
          {authLoading ? (
            <span className="nb-avatar-btn nb-avatar-skeleton" aria-hidden="true" />
          ) : user ? (
            <div className="nb-user-wrap" ref={dropdownRef}>
              <button className="nb-avatar-btn" onClick={() => setUserOpen(v => !v)}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="nb-avatar-img" />
                  : <span className="nb-avatar-init">{initials}</span>
                }
              </button>

              {userOpen && (
                <div className="nb-dropdown">
                  <div className="nb-dd-head">
                    <div className="nb-dd-avatar">
                      {profile?.avatar_url
                        ? <img src={profile.avatar_url} alt="" className="nb-avatar-img" />
                        : <span className="nb-avatar-init nb-avatar-init-lg">{initials}</span>
                      }
                    </div>
                    <div>
                      <div className="nb-dd-name">{profile?.name} {profile?.surname}</div>
                      <div className="nb-dd-email">{user.email}</div>
                    </div>
                  </div>
                  <div className="nb-dd-sep" />
                  <Link href="/profile" className="nb-dd-item" onClick={() => setUserOpen(false)}>
                    <User size={14} /> {t.nav.profile}
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="nb-dd-item" onClick={() => setUserOpen(false)}>
                      <Settings size={14} /> {t.nav.admin}
                    </Link>
                  )}
                  <div className="nb-dd-sep" />
                  <button className="nb-dd-item nb-dd-out" onClick={handleSignOut}>
                    <LogOut size={14} /> {t.nav.logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth/login" className="nb-avatar-btn nb-login-btn" title={t.nav.login}>
              <User size={20} strokeWidth={1.8} />
            </Link>
          )}

          {/* Hamburger */}
          <button className="nb-burger" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="nb-mobile">
          {user && (
            <div className="nb-mob-user">
              <div className="nb-mob-avatar">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="nb-avatar-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span className="nb-avatar-init">{initials}</span>
                }
              </div>
              <div>
                <div className="nb-mob-name">{profile?.name} {profile?.surname}</div>
                <div className="nb-mob-email">{user.email}</div>
              </div>
            </div>
          )}

          {/* Mobile search */}
          <form className="nb-mob-search" onSubmit={handleSearch}>
            <Search size={14} style={{ color: '#999', flexShrink: 0 }} />
            <input
              type="text"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder={t.home.search}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'none', color: '#222' }}
            />
          </form>

          <div className="nb-mob-links">
            <Link href="/cars"         className="nb-mob-link">{t.nav.allListings}</Link>
            <Link href="/post-listing" className="nb-mob-link nb-mob-post">{t.nav.postAd}</Link>
            {user && <Link href="/saved"    className="nb-mob-link">{t.nav.saved}</Link>}
            {user && <Link href="/messages" className="nb-mob-link">{t.nav.messages}</Link>}
            {user && <Link href="/profile"  className="nb-mob-link">{t.nav.profile}</Link>}
            <Link href="/about"   className="nb-mob-link">{t.nav.about}</Link>
            <Link href="/contact" className="nb-mob-link">{t.nav.contact}</Link>
            {isAdmin && <Link href="/admin" className="nb-mob-link nb-mob-admin">{t.nav.adminPanel}</Link>}
            {!user && <Link href="/auth/login" className="nb-mob-link">{t.nav.login}</Link>}
            {user && (
              <button className="nb-mob-link nb-mob-out" onClick={handleSignOut}>{t.nav.logout}</button>
            )}
          </div>

          <div className="nb-mob-controls">
            <div className="nb-pill">
              <button className={`nb-pill-btn ${lang === 'tr' ? 'on' : ''}`} onClick={() => setLang('tr')}>TR</button>
              <span className="nb-pill-div" />
              <button className={`nb-pill-btn ${lang === 'en' ? 'on' : ''}`} onClick={() => setLang('en')}>EN</button>
            </div>
            <div className="nb-pill">
              <button className={`nb-pill-btn ${currency === 'TL' ? 'on' : ''}`} onClick={() => setCurrency('TL')}>₺ TL</button>
              <span className="nb-pill-div" />
              <button className={`nb-pill-btn ${currency === 'EUR' ? 'on' : ''}`} onClick={() => setCurrency('EUR')}>€ EUR</button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement popup */}
      {announcementOpen && announcement && (
        <>
          <div className="ann-overlay" onClick={() => setAnnouncementOpen(false)} />
          <div className="ann-modal">
            <div className="ann-modal-head">
              <span className="ann-modal-icon"><Bell size={18} strokeWidth={2} /></span>
              <h3 className="ann-modal-title">{announcement.title}</h3>
              <button className="ann-modal-close" onClick={() => setAnnouncementOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="ann-modal-body">{announcement.content}</p>
            <div className="ann-modal-actions">
              <button className="ann-modal-dismiss" onClick={dismissAnnouncement}>
                <Trash2 size={13} /> {t.nav.dismiss}
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        /* ── Shell ── */
        .nb {
          position: sticky; top: 0; z-index: 100;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(14px) saturate(1.6);
          -webkit-backdrop-filter: blur(14px) saturate(1.6);
          border-bottom: 1px solid rgba(15,23,42,0.06);
          transition: box-shadow 0.25s ease, background 0.25s ease, border-color 0.25s ease;
        }
        .nb-scrolled {
          background: rgba(255,255,255,0.96);
          border-color: rgba(15,23,42,0.08);
          box-shadow: 0 4px 24px rgba(15,23,42,0.06);
        }
        .nb-inner {
          width: 100%;
          max-width: 1800px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex; align-items: center;
          justify-content: space-between;
          height: 52px;
          position: relative;
          box-sizing: border-box;
        }

        /* Logo */
        .nb-logo {
          flex-shrink: 0; display: flex; align-items: center;
          text-decoration: none;
          transition: opacity 0.15s ease;
        }
        .nb-logo:hover { opacity: 0.82; }

        /* Center page links */
        .nb-text-links {
          position: absolute; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: 6px;
          opacity: 1; transition: opacity 0.2s ease, visibility 0.2s ease;
        }
        .nb-text-links-hidden {
          opacity: 0; visibility: hidden; pointer-events: none;
        }
        .nb-text-link {
          font-size: 13.5px; font-weight: 600;
          color: #5a6473; text-decoration: none;
          padding: 8px 16px; border-radius: 8px;
          transition: background 0.18s, color 0.18s;
        }
        .nb-text-link:hover { background: #f4f5f7; color: #ae050a; }

        /* Scroll search */
        .nb-search-wrap {
          position: absolute; left: 50%; transform: translateX(-50%) scale(0.96);
          display: flex; align-items: center; gap: 8px;
          width: 280px; max-width: 40vw;
          background: #f4f5f7; border-radius: 999px;
          padding: 8px 16px;
          opacity: 0; visibility: hidden;
          transition: opacity 0.22s ease, visibility 0.22s ease, transform 0.22s ease, background 0.18s ease;
        }
        .nb-search-wrap-visible {
          opacity: 1; visibility: visible; transform: translateX(-50%) scale(1);
        }
        .nb-search-wrap:focus-within { background: #ececf0; }
        .nb-search-icon { color: #94a0b3; flex-shrink: 0; }
        .nb-search-input {
          flex: 1; border: none; outline: none; background: none;
          font-size: 13.5px; color: #1a1a1a; font-family: 'Inter', sans-serif;
        }
        .nb-search-input::placeholder { color: #aab2c0; }

        /* Right */
        .nb-right {
          display: flex; align-items: center;
          gap: 6px; flex-shrink: 0;
        }

        /* Pills */
        .nb-pill {
          display: flex; align-items: center;
          border-radius: 999px; overflow: hidden;
          background: #f4f5f7;
          transition: background 0.2s;
          margin-right: 4px;
        }
        .nb-pill:hover { background: #ececf0; }
        .nb-pill-btn {
          background: none; border: none;
          font-size: 11.5px; font-weight: 700;
          color: #94a0b3; cursor: pointer;
          padding: 6px 11px;
          border-radius: 999px;
          transition: color 0.15s, background 0.15s;
          letter-spacing: 0.4px;
        }
        .nb-pill-btn.on { color: #fff; background: #ae050a; box-shadow: 0 2px 8px rgba(174,5,10,0.25); }
        .nb-pill-btn:hover:not(.on) { color: #1a1a1a; }
        .nb-pill-div { display: none; }

        /* Separator */
        .nb-sep {
          width: 1px; height: 20px;
          background: rgba(15,23,42,0.07);
          flex-shrink: 0;
          margin: 0 4px;
        }

        /* Unread badge */
        .nb-badge {
          position: absolute; top: 3px; right: 3px;
          background: #ae050a; color: #fff;
          font-size: 9px; font-weight: 800;
          min-width: 16px; height: 16px;
          border-radius: 8px; padding: 0 4px;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid #fff;
          line-height: 1;
          pointer-events: none;
          animation: badgePop 0.2s ease;
        }
        @keyframes badgePop {
          from { transform: scale(0); }
          to   { transform: scale(1); }
        }
        .nb-badge-dot {
          position: absolute; top: 7px; right: 7px;
          width: 9px; height: 9px; min-width: 0; height: 9px;
          padding: 0; border-radius: 50%;
          background: #ae050a;
          border: 1.5px solid #fff;
          animation: badgePop 0.2s ease, pulseDot 2s ease-in-out infinite;
        }
        @keyframes pulseDot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(174,5,10,0.5); }
          50% { box-shadow: 0 0 0 4px rgba(174,5,10,0); }
        }

        /* Icon links */
        :global(.nb-icon-link) {
          display: flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 50%;
          color: #5a6473; text-decoration: none;
          transition: background 0.18s, color 0.18s, transform 0.15s;
          position: relative;
          border: none; background: none; cursor: pointer; padding: 0;
          font-family: inherit;
        }
        :global(.nb-icon-link:hover) {
          background: #f4f5f7;
          color: #ae050a;
          transform: translateY(-1px);
        }
        :global(.nb-icon-link:active) {
          transform: translateY(0);
        }
        :global(.nb-post-icon) {
          width: 32px; height: 32px;
          color: #fff;
          background: #ae050a;
          box-shadow: 0 2px 8px rgba(174,5,10,0.25);
        }
        :global(.nb-post-icon:hover) {
          background: #8f0408;
          color: #fff;
          box-shadow: 0 4px 14px rgba(174,5,10,0.35);
        }
        :global(.nb-admin-icon) { color: #ae050a; }
        :global(.nb-admin-icon:hover) { background: #fff5f5; color: #ae050a; }

        /* Avatar btn */
        .nb-user-wrap { position: relative; }
        .nb-avatar-btn {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, #ae050a, #e0151b);
          border: none;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; cursor: pointer;
          transition: transform 0.18s, box-shadow 0.18s;
          color: #666;
          box-shadow: 0 2px 10px rgba(174,5,10,0.22);
        }
        .nb-avatar-btn:hover {
          transform: scale(1.06);
          box-shadow: 0 4px 16px rgba(174,5,10,0.34);
        }
        .nb-avatar-btn:active { transform: scale(1.0); }
        .nb-login-btn { background: #16181d; box-shadow: none; color: #fff; }
        .nb-login-btn:hover { background: #ae050a; box-shadow: 0 4px 16px rgba(174,5,10,0.3); }
        .nb-avatar-skeleton {
          background: #f0f1f3;
          box-shadow: none;
          border: none;
          animation: avatarPulse 1.3s ease-in-out infinite;
        }
        @keyframes avatarPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .nb-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .nb-avatar-init { color: #fff; font-size: 12px; font-weight: 700; }
        .nb-avatar-init-lg { font-size: 16px; }

        /* Dropdown */
        :global(.nb-dropdown) {
          position: absolute; top: calc(100% + 14px); right: -8px;
          background: #fff; border-radius: 14px;
          border: 1px solid rgba(174,5,10,0.12);
          box-shadow: 0 16px 44px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06);
          min-width: 240px; overflow: hidden; z-index: 200;
          animation: ddIn 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        :global(.nb-dropdown)::before {
          content: '';
          position: absolute; top: -6px; right: 22px;
          width: 12px; height: 12px;
          background: #fff;
          border-left: 1px solid rgba(174,5,10,0.12);
          border-top: 1px solid rgba(174,5,10,0.12);
          transform: rotate(45deg);
          border-radius: 2px 0 0 0;
        }
        @keyframes ddIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        :global(.nb-dd-head) {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          position: relative;
        }
        :global(.nb-dd-avatar) {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(255,255,255,0.18);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
        }
        :global(.nb-dd-name) { font-size: 13px; font-weight: 700; color: #fff; }
        :global(.nb-dd-email) { font-size: 11px; color: rgba(255,255,255,0.75); margin-top: 1px; }
        :global(.nb-dd-sep) { height: 1px; background: #f5f5f5; }
        :global(.nb-dd-item) {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 16px; font-size: 13.5px; color: #333;
          width: 100%; text-align: left; background: none; border: none;
          cursor: pointer; text-decoration: none; transition: background 0.12s, color 0.12s;
          box-sizing: border-box;
        }
        :global(.nb-dd-item:hover) { background: #fff5f5; color: #ae050a; }
        :global(.nb-dd-out) { color: #999; }
        :global(.nb-dd-out:hover) { background: #fff5f5; color: #ae050a; }

        /* Burger */
        .nb-burger {
          display: none; background: #ae050a;
          border: none;
          border-radius: 8px; padding: 8px;
          color: #fff; cursor: pointer;
          align-items: center; justify-content: center;
          transition: all 0.18s;
          box-shadow: 0 2px 8px rgba(174,5,10,0.3);
        }
        .nb-burger:hover { background: #8f0408; box-shadow: 0 4px 14px rgba(174,5,10,0.45); }

        /* Mobile menu */
        .nb-mobile {
          background: #fff;
          border-top: 2px solid #ae050a;
          box-shadow: 0 12px 40px rgba(0,0,0,0.13);
          padding-bottom: 8px;
          animation: menuSlide 0.22s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes menuSlide {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nb-mob-user {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 20px 14px;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
        }
        .nb-mob-avatar {
          width: 42px; height: 42px; border-radius: 50%;
          background: rgba(255,255,255,0.18);
          border: 2px solid rgba(255,255,255,0.3);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
        }
        .nb-mob-name { font-size: 14px; font-weight: 700; color: #fff; }
        .nb-mob-email { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 1px; }
        .nb-mob-search {
          display: flex; align-items: center; gap: 8px;
          margin: 12px 14px 8px; padding: 10px 14px;
          background: #f8f8f8; border: 1.5px solid #ececec;
          border-radius: 10px;
        }
        .nb-mob-links { display: flex; flex-direction: column; padding: 4px 0; }
        .nb-mob-link {
          display: flex; align-items: center;
          padding: 13px 20px; font-size: 14px; font-weight: 500;
          color: #1a1a1a; text-decoration: none;
          border: none; background: none; width: 100%;
          text-align: left; cursor: pointer;
          border-left: 3px solid transparent;
          transition: all 0.15s;
          letter-spacing: 0.1px;
        }
        .nb-mob-link:hover { color: #ae050a; background: #fff5f5; border-left-color: #ae050a; }
        .nb-mob-post {
          color: #ae050a; font-weight: 700;
          border-left-color: #ae050a;
          background: #fff5f5;
        }
        .nb-mob-admin { color: #ae050a; font-weight: 700; }
        .nb-mob-out { color: #999; }
        .nb-mob-out:hover { color: #ae050a; background: #fff5f5; border-left-color: #ae050a; }
        .nb-mob-controls {
          display: flex; gap: 10px; align-items: center;
          padding: 12px 20px 6px;
          border-top: 1px solid #f0f0f0;
          margin-top: 4px;
        }

        /* Announcement popup */
        .ann-overlay {
          position: fixed; inset: 0; z-index: 300;
          background: transparent;
        }
        .ann-modal {
          position: fixed; top: 72px; right: 20px; z-index: 301;
          width: 100%; max-width: 340px;
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.06);
          animation: annPopIn 0.22s ease;
        }
        @keyframes annPopIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ann-modal-head {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 18px;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
        }
        .ann-modal-icon {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(255,255,255,0.15);
          flex-shrink: 0;
        }
        .ann-modal-title {
          flex: 1;
          font-family: 'Montserrat', sans-serif;
          font-size: 15px; font-weight: 700;
          line-height: 1.3;
        }
        .ann-modal-close {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(255,255,255,0.12); border: none;
          color: #fff; cursor: pointer; flex-shrink: 0;
          transition: background 0.15s;
        }
        .ann-modal-close:hover { background: rgba(255,255,255,0.25); }
        .ann-modal-body {
          padding: 18px;
          font-size: 13.5px; line-height: 1.7;
          color: #444;
          white-space: pre-line;
        }
        .ann-modal-actions {
          display: flex; justify-content: flex-end;
          padding: 0 14px 14px;
        }
        .ann-modal-dismiss {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer;
          font-size: 12px; font-weight: 600; color: #999;
          padding: 6px 10px; border-radius: 6px;
          transition: background 0.15s, color 0.15s;
          font-family: 'Inter', sans-serif;
        }
        .ann-modal-dismiss:hover { background: #fff5f5; color: #ae050a; }
        @media (max-width: 1024px) {
          .nb-text-links, .nb-search-wrap { display: none; }
        }

        @media (max-width: 768px) {
          .nb-burger { display: flex; }
          .nb-icon-link { display: none; }
          .nb-user-wrap { display: none; }
          .nb-login-btn { display: none; }
          .nb-pill { display: none; }
          .nb-sep { display: none; }
          .nb-inner { height: 48px; padding: 0 14px; }
          .nb-mobile { padding-bottom: env(safe-area-inset-bottom, 12px); }
        }
        @media (max-width: 480px) {
          .ann-modal { left: 12px; right: 12px; max-width: none; top: 58px; }
          .nb-mob-search { margin: 10px 12px; }
          .nb-mob-link { padding: 13px 16px; font-size: 15px; }
          .nb-mob-controls { padding: 12px 16px 4px; }
        }
      `}</style>
    </header>
  );
}
