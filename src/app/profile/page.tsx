'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Camera, Edit2, Save, X, LogOut, Car, Phone, Mail, Calendar, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import CarCard from '@/components/car/CarCard';
import type { CarListing, Profile as ProfileType } from '@/types';

function ProfilePageInner() {
  const { user, profile: ownProfile, isAdmin, loading, refreshProfile } = useAuth();
  const { t } = useI18n();
  const router  = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fileRef  = useRef<HTMLInputElement>(null);

  const viewUserId = searchParams.get('user');
  const viewingOther = !!viewUserId && viewUserId !== user?.id;

  const [editing, setEditing]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [listings, setListings]           = useState<CarListing[]>([]);
  const [form, setForm]                   = useState({ name: '', surname: '', phone: '' });
  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [tab, setTab]                     = useState<'active' | 'inactive'>('active');
  const [viewedProfile, setViewedProfile] = useState<ProfileType | null>(null);
  const [viewedLoading, setViewedLoading] = useState(false);

  const profile = viewingOther ? viewedProfile : ownProfile;

  // Sync form when own profile loads
  useEffect(() => {
    if (ownProfile && !viewingOther) {
      setForm({ name: ownProfile.name || '', surname: ownProfile.surname || '', phone: ownProfile.phone || '' });
    }
  }, [ownProfile, viewingOther]);

  // Redirect if not logged in (only after auth resolves)
  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [loading, user]);

  // Redirect non-admins away from viewing someone else's profile
  useEffect(() => {
    if (!loading && viewingOther && !isAdmin) router.push('/profile');
  }, [loading, viewingOther, isAdmin]);

  // Fetch the target user's profile when viewing someone else
  useEffect(() => {
    if (!viewingOther || !isAdmin || !viewUserId) return;
    setViewedLoading(true);
    supabase.from('profiles').select('*').eq('id', viewUserId).single()
      .then(({ data }) => { setViewedProfile(data as ProfileType); setViewedLoading(false); });
  }, [viewingOther, isAdmin, viewUserId]);

  // Fetch listings for whichever profile is being shown
  useEffect(() => {
    const targetId = viewingOther ? viewUserId : user?.id;
    if (!targetId) return;
    if (viewingOther && !isAdmin) return;
    supabase
      .from('car_listings')
      .select('*')
      .eq('user_id', targetId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setListings(data as CarListing[]); });
  }, [user, viewingOther, viewUserId, isAdmin]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);
    let avatarUrl = profile.avatar_url;
    if (avatarFile) {
      const ext  = avatarFile.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      avatarUrl = data.publicUrl + `?t=${Date.now()}`;
    }
    await supabase.from('profiles').update({
      name:       form.name,
      surname:    form.surname,
      phone:      form.phone || null,
      avatar_url: avatarUrl,
    }).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Still resolving auth
  if (loading || (viewingOther && viewedLoading)) {
    return (
      <div className="pf-loading">
        <div className="pf-spinner" />
        <p>Loading…</p>
        <style jsx>{`
          .pf-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; min-height:60vh; color:#888; }
          .pf-spinner { width:36px; height:36px; border-radius:50%; border:3px solid #e0e0e0; border-top-color:#ae050a; animation:spin 0.8s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Auth resolved but no user — redirect handled by useEffect
  if (!user || !profile) return null;

  const activeListing   = listings.filter(l => l.status === 'active');
  const inactiveListing = listings.filter(l => l.status !== 'active');
  const shown           = tab === 'active' ? activeListing : inactiveListing;
  const initials        = `${(profile.name || '?')[0]}${(profile.surname || '')[0] || ''}`.toUpperCase();

  return (
    <div className="pf-page">
      {/* ── Hero banner ── */}
      <div className="pf-hero">
        <div className="pf-hero-glow" />
        <div className="container pf-hero-inner">
          {/* Avatar */}
          <div className="pf-avatar-ring">
            {(avatarPreview || profile.avatar_url)
              ? <img src={avatarPreview || profile.avatar_url!} alt="" className="pf-avatar-img" />
              : <div className="pf-avatar-initials">{initials}</div>
            }
            {editing && (
              <button className="pf-avatar-cam" onClick={() => fileRef.current?.click()} title={t.profile.changePhoto}>
                <Camera size={14} />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          {/* Name + meta */}
          <div className="pf-hero-info">
            <h1 className="pf-hero-name">{profile.name} {profile.surname}</h1>
            <div className="pf-hero-meta">
              <span><Mail size={12} />{profile.email}</span>
              {profile.phone && <span><Phone size={12} />{profile.phone}</span>}
              <span>
                <Calendar size={12} />
                {t.profile.memberSince} {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </span>
              {profile.role === 'admin' && (
                <span className="pf-admin-badge"><Shield size={10} />Admin</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pf-hero-actions">
            {viewingOther ? (
              <button className="pf-btn pf-btn-edit" onClick={() => router.push('/admin?tab=users')}>
                <X size={14} /> Back to Admin
              </button>
            ) : (
              <>
                {!editing && (
                  <button className="pf-btn pf-btn-edit" onClick={() => setEditing(true)}>
                    <Edit2 size={14} /> {t.profile.editProfile}
                  </button>
                )}
                <button className="pf-btn pf-btn-out" onClick={handleSignOut}>
                  <LogOut size={14} /> {t.profile.signOut}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {viewingOther && (
        <div className="container">
          <div className="pf-admin-banner">
            <Shield size={14} /> Viewing as Admin — read-only
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="container pf-body">
        <div className="pf-grid">

          {/* Sidebar */}
          <aside className="pf-sidebar">

            {/* Edit form */}
            {editing && (
              <div className="pf-card pf-edit-card">
                <div className="pf-card-title"><Edit2 size={14} />{t.profile.editProfile}</div>
                {[
                  { label: t.profile.firstName, key: 'name',    type: 'text', placeholder: t.profile.firstName },
                  { label: t.profile.lastName,  key: 'surname', type: 'text', placeholder: t.profile.lastName  },
                  { label: t.profile.phone,     key: 'phone',   type: 'tel',  placeholder: '+90 5xx...' },
                ].map(f => (
                  <div className="pf-field" key={f.key}>
                    <label>{f.label}</label>
                    <input
                      type={f.type}
                      value={(form as Record<string, string>)[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
                <div className="pf-field pf-field-locked">
                  <label><Mail size={11} /> {t.profile.emailLocked}</label>
                  <input type="email" value={profile.email} disabled />
                </div>
                <div className="pf-edit-btns">
                  <button className="pf-save" onClick={handleSave} disabled={saving}>
                    {saving
                      ? <span className="pf-spin-sm" />
                      : <><Save size={13} />{t.profile.save}</>
                    }
                  </button>
                  <button className="pf-cancel" onClick={() => { setEditing(false); setAvatarFile(null); setAvatarPreview(null); }}>
                    <X size={13} />{t.profile.cancel}
                  </button>
                </div>
              </div>
            )}

            {/* Account info card */}
            <div className="pf-card">
              <div className="pf-card-title"><User size={14} />{t.profile.accountDetails}</div>
              {[
                { label: t.profile.fullName, value: `${profile.name} ${profile.surname}` },
                { label: t.profile.email,    value: profile.email },
                { label: t.profile.phone,    value: profile.phone || '—' },
                { label: t.profile.member,   value: new Date(profile.created_at).toLocaleDateString() },
                { label: t.profile.role,     value: profile.role || 'user', accent: true },
              ].map(row => (
                <div className="pf-info-row" key={row.label}>
                  <span className="pf-info-key">{row.label}</span>
                  <span className={`pf-info-val${row.accent ? ' pf-role' : ''}`}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Stats card */}
            <div className="pf-card">
              <div className="pf-card-title"><Car size={14} />{t.profile.myListings}</div>
              {[
                { label: t.profile.active,   val: activeListing.length },
                { label: t.profile.inactive, val: inactiveListing.length },
                { label: t.car.total,        val: listings.length },
              ].map(s => (
                <div className="pf-stat-row" key={s.label}>
                  <span className="pf-stat-lbl">{s.label}</span>
                  <span className="pf-stat-num">{s.val}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Main */}
          <main className="pf-main">
            <div className="pf-main-hdr">
              <h2 className="pf-main-title">{t.profile.myListings}</h2>
              {!viewingOther && (
                <button className="pf-post-btn" onClick={() => router.push('/post-listing')}>
                  {t.profile.postNewAd}
                </button>
              )}
            </div>

            <div className="pf-tabs">
              <button className={`pf-tab ${tab === 'active' ? 'on' : ''}`} onClick={() => setTab('active')}>
                {t.profile.active} <span className="pf-tab-pill">{activeListing.length}</span>
              </button>
              <button className={`pf-tab ${tab === 'inactive' ? 'on' : ''}`} onClick={() => setTab('inactive')}>
                {t.profile.inactive} <span className="pf-tab-pill">{inactiveListing.length}</span>
              </button>
            </div>

            {shown.length === 0 ? (
              <div className="pf-empty">
                <Car size={52} strokeWidth={1} />
                <h3>{tab === 'active' ? t.profile.noActive : t.profile.noInactive}</h3>
                {tab === 'active' && !viewingOther && <p>{t.profile.postFirstCar}</p>}
                {tab === 'active' && !viewingOther && (
                  <button className="pf-post-btn" onClick={() => router.push('/post-listing')}>{t.profile.postAd}</button>
                )}
              </div>
            ) : (
              <div className="grid-listings">
                {shown.map(l => (
                  <CarCard
                    key={l.id}
                    listing={l}
                    showOwnerActions={!viewingOther}
                    onStatusChange={(id, status) => {
                      if (status === 'deleted') {
                        setListings(prev => prev.filter(x => x.id !== id));
                      } else {
                        setListings(prev => prev.map(x => x.id === id ? { ...x, status } : x));
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <style jsx>{`
        /* Page shell */
        .pf-page { min-height: 100vh; background: #f0f4f8; }

        /* Hero */
        .pf-hero {
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #0c1220 0%, #1a2540 55%, #1c0205 100%);
          padding: 44px 0 36px;
        }
        .pf-hero-glow {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 60% 80% at 75% 50%, rgba(174,5,10,0.2) 0%, transparent 70%);
        }
        .pf-hero-inner {
          position: relative; display: flex; align-items: center;
          gap: 24px; flex-wrap: wrap;
        }
        .pf-avatar-ring {
          position: relative; flex-shrink: 0;
          width: 96px; height: 96px; border-radius: 50%;
          border: 3px solid #ae050a;
          box-shadow: 0 0 0 5px rgba(174,5,10,0.15), 0 8px 30px rgba(0,0,0,0.5);
        }
        .pf-avatar-img { width:100%; height:100%; border-radius:50%; object-fit:cover; display:block; }
        .pf-avatar-initials {
          width:100%; height:100%; border-radius:50%;
          background: linear-gradient(135deg,#1a3a60,#0c1a30);
          display:flex; align-items:center; justify-content:center;
          font-size:30px; font-weight:800; color:#fff;
          font-family:'Montserrat',sans-serif; letter-spacing:-1px;
        }
        .pf-avatar-cam {
          position:absolute; bottom:2px; right:2px;
          width:28px; height:28px; border-radius:50%;
          background:#ae050a; border:2px solid #0c1220;
          color:#fff; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:transform 0.15s;
        }
        .pf-avatar-cam:hover { transform:scale(1.12); }

        .pf-hero-info { flex:1; min-width:0; }
        .pf-hero-name {
          font-family:'Montserrat',sans-serif;
          font-size:24px; font-weight:800; color:#fff;
          margin:0 0 10px;
        }
        .pf-hero-meta {
          display:flex; flex-wrap:wrap; gap:14px;
          font-size:13px; color:#94a3b8;
        }
        .pf-hero-meta span { display:flex; align-items:center; gap:5px; }
        .pf-admin-badge {
          display:flex; align-items:center; gap:4px;
          background:rgba(174,5,10,0.25); color:#ff9090;
          border:1px solid rgba(174,5,10,0.45); border-radius:99px;
          padding:2px 10px; font-size:11px; font-weight:700;
        }

        .pf-hero-actions { display:flex; gap:10px; flex-shrink:0; }
        .pf-btn {
          display:flex; align-items:center; gap:6px;
          padding:9px 18px; border-radius:8px;
          font-size:13px; font-weight:600; cursor:pointer;
          border:none; transition:all 0.18s;
        }
        .pf-btn-edit {
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14);
          color:#e2e8f0;
        }
        .pf-btn-edit:hover { background:rgba(255,255,255,0.15); }
        .pf-btn-out {
          background:rgba(174,5,10,0.2); border:1px solid rgba(174,5,10,0.4);
          color:#ff9090;
        }
        .pf-btn-out:hover { background:rgba(174,5,10,0.35); }

        .pf-admin-banner {
          display:flex; align-items:center; gap:8px;
          margin-top:16px;
          padding:10px 16px; border-radius:8px;
          background:#fff5f5; border:1px solid rgba(174,5,10,0.15);
          color:#ae050a; font-size:13px; font-weight:600;
        }

        /* Body */
        .pf-body { padding:28px 0 64px; }
        .pf-grid { display:grid; grid-template-columns:280px 1fr; gap:22px; align-items:start; }

        /* Cards */
        .pf-card {
          background:#fff; border-radius:12px;
          box-shadow:0 2px 10px rgba(0,0,0,0.07);
          margin-bottom:16px; overflow:hidden;
          animation:fadeUp 0.35s ease both;
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .pf-card-title {
          display:flex; align-items:center; gap:7px;
          padding:12px 16px; font-size:11px; font-weight:700;
          text-transform:uppercase; letter-spacing:0.8px;
          color:#64748b; border-bottom:1px solid #f1f5f9; background:#fafbfc;
        }

        /* Edit form */
        .pf-edit-card { padding-bottom:0; }
        .pf-field { padding:8px 16px; }
        .pf-field label {
          display:flex; align-items:center; gap:4px;
          font-size:11px; font-weight:600; color:#94a3b8;
          text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px;
        }
        .pf-field input {
          width:100%; padding:8px 11px; border-radius:7px;
          border:1.5px solid #e2e8f0; font-size:14px; color:#1e293b;
          background:#f8fafc; outline:none; box-sizing:border-box;
          transition:border-color 0.15s;
        }
        .pf-field input:focus { border-color:#ae050a; background:#fff; }
        .pf-field-locked input { opacity:0.5; cursor:not-allowed; background:#f1f5f9; }
        .pf-edit-btns { display:flex; gap:8px; padding:10px 16px 14px; }
        .pf-save {
          flex:1; display:flex; align-items:center; justify-content:center; gap:5px;
          padding:9px; border-radius:7px;
          background:#ae050a; color:#fff; font-size:13px; font-weight:700;
          border:none; cursor:pointer; transition:background 0.15s;
        }
        .pf-save:hover:not(:disabled) { background:#c4060c; }
        .pf-save:disabled { opacity:0.65; cursor:not-allowed; }
        .pf-cancel {
          display:flex; align-items:center; gap:5px;
          padding:9px 14px; border-radius:7px;
          background:#f1f5f9; color:#64748b; font-size:13px; font-weight:600;
          border:none; cursor:pointer; transition:background 0.15s;
        }
        .pf-cancel:hover { background:#e2e8f0; }
        .pf-spin-sm {
          display:inline-block; width:14px; height:14px; border-radius:50%;
          border:2px solid rgba(255,255,255,0.35); border-top-color:#fff;
          animation:spin 0.8s linear infinite; vertical-align:middle;
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* Info rows */
        .pf-info-row {
          display:flex; justify-content:space-between; align-items:center;
          padding:9px 16px; border-bottom:1px solid #f1f5f9; gap:12px;
        }
        .pf-info-row:last-child { border-bottom:none; }
        .pf-info-key { font-size:12px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.4px; flex-shrink:0; }
        .pf-info-val { font-size:13px; color:#334155; font-weight:500; text-align:right; word-break:break-all; }
        .pf-role { font-weight:700; color:#ae050a; text-transform:capitalize; }

        /* Stats */
        .pf-stat-row {
          display:flex; justify-content:space-between; align-items:center;
          padding:10px 16px; border-bottom:1px solid #f1f5f9;
        }
        .pf-stat-row:last-child { border-bottom:none; }
        .pf-stat-lbl { font-size:14px; color:#475569; }
        .pf-stat-num { font-family:'Montserrat',sans-serif; font-size:22px; font-weight:800; color:#ae050a; }

        /* Main area */
        .pf-main-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
        .pf-main-title { font-family:'Montserrat',sans-serif; font-size:22px; font-weight:800; color:#0f172a; margin:0; }
        .pf-post-btn {
          display:inline-flex; align-items:center; gap:6px;
          padding:9px 18px; border-radius:8px;
          background:#ae050a; color:#fff; font-size:13px; font-weight:700;
          border:none; cursor:pointer; transition:background 0.15s;
        }
        .pf-post-btn:hover { background:#c4060c; }

        /* Tabs */
        .pf-tabs { display:flex; margin-bottom:20px; border-bottom:2px solid #e2e8f0; }
        .pf-tab {
          display:flex; align-items:center; gap:7px;
          padding:10px 18px; background:none; border:none;
          border-bottom:2px solid transparent; margin-bottom:-2px;
          font-size:14px; font-weight:600; color:#64748b; cursor:pointer; transition:all 0.15s;
        }
        .pf-tab.on { color:#ae050a; border-bottom-color:#ae050a; }
        .pf-tab-pill {
          min-width:20px; height:20px; border-radius:99px;
          background:#f1f5f9; color:#64748b;
          font-size:11px; font-weight:700; padding:0 6px;
          display:flex; align-items:center; justify-content:center;
        }
        .pf-tab.on .pf-tab-pill { background:rgba(174,5,10,0.1); color:#ae050a; }

        /* Empty state */
        .pf-empty {
          display:flex; flex-direction:column; align-items:center;
          gap:12px; padding:64px 20px; color:#94a3b8; text-align:center;
          background:#fff; border-radius:12px;
          box-shadow:0 2px 10px rgba(0,0,0,0.06);
        }
        .pf-empty h3 { font-size:18px; font-weight:700; color:#334155; margin:0; }
        .pf-empty p  { font-size:14px; margin:0; }

        @media (max-width:880px) {
          .pf-grid { grid-template-columns:1fr; }
          .pf-hero-inner { flex-direction:column; align-items:flex-start; }
        }
        @media (max-width:560px) {
          .pf-hero-actions { flex-direction:column; width:100%; }
          .pf-hero { padding: 28px 0 24px; }
          .pf-hero-inner { gap: 16px; }
          .pf-name { font-size: 20px; }
          .pf-tabs { overflow-x: auto; gap: 4px; }
          .pf-tab { font-size: 13px; padding: 8px 12px; white-space: nowrap; }
        }
        @media (max-width:400px) {
          .pf-avatar-ring { width: 72px; height: 72px; }
          .pf-post-btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    }>
      <ProfilePageInner />
    </Suspense>
  );
}
