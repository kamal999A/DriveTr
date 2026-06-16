'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import {
  Heart, MapPin, Calendar, Gauge, Fuel, Settings2,
  MessageCircle, Flag, ChevronLeft, ChevronRight,
  User, Phone, Edit, Trash2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import ConfirmModal from '@/components/layout/ConfirmModal';
import ReportModal from '@/components/layout/ReportModal';
import type { CarListing, ChatMessage } from '@/types';

const supabase = createClient();

export default function CarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { formatPrice, t } = useI18n();

  const [listing, setListing]       = useState<CarListing | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saved, setSaved]           = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showChat, setShowChat]     = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg]         = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Direct ref to the scrollable messages div — NOT the end sentinel
  const msgsDivRef   = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Auth guard — redirect to login if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/login?next=/cars/${id}`);
    }
  }, [authLoading, user, id]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('car_listings')
        .select('*, seller:profiles(*)')
        .eq('id', id)
        .single();
      if (!data) { router.push('/cars'); return; }
      setListing(data as CarListing);
      if (user) {
        const { data: sv } = await supabase
          .from('saved_cars').select('id')
          .eq('user_id', user.id).eq('listing_id', id).maybeSingle();
        setSaved(!!sv);
      }
      setLoading(false);
    })();
  }, [id, user]);

  // Load messages when chat opens
  useEffect(() => {
    if (!showChat || !user || !listing) return;

    const fetchMsgs = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .eq('listing_id', id)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as ChatMessage[]);
    };

    fetchMsgs();

    const channel = supabase
      .channel(`chat-${id}-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'chat_messages', filter: `listing_id=eq.${id}`,
      }, (payload: any) => {
        const msg = payload.new as ChatMessage;
        // Only append messages from the other person — our own come from sendMessage
        if (msg.sender_id !== user.id && msg.receiver_id === user.id) {
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [showChat, user?.id, listing?.id]);

  // Scroll to bottom of chat — only the chat div, never the page
  useEffect(() => {
    if (!showChat) return;
    const div = msgsDivRef.current;
    if (div) div.scrollTop = div.scrollHeight;
  }, [messages, showChat]);

  // Focus input when chat opens
  useEffect(() => {
    if (showChat) setTimeout(() => chatInputRef.current?.focus(), 150);
  }, [showChat]);

  const toggleSave = async () => {
    if (!user) { router.push('/auth/login'); return; }
    if (saved) {
      await supabase.from('saved_cars').delete().eq('user_id', user.id).eq('listing_id', id);
      setSaved(false);
    } else {
      await supabase.from('saved_cars').insert({ user_id: user.id, listing_id: id });
      setSaved(true);
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !user || !listing || sendingMsg) return;
    const content = newMsg.trim();
    setNewMsg('');
    setSendingMsg(true);

    const { error, data: inserted } = await supabase
      .from('chat_messages')
      .insert({ listing_id: id, sender_id: user.id, receiver_id: listing.user_id, content })
      .select('id, sender_id, receiver_id, content, created_at')
      .single();

    if (error) {
      alert('Send failed: ' + error.message);
      setNewMsg(content);
    } else if (inserted) {
      setMessages(prev =>
        prev.find(m => m.id === (inserted as any).id) ? prev : [...prev, inserted as ChatMessage]
      );
    }
    setSendingMsg(false);
  };

  const submitReport = async (reason: string) => {
    if (!user) return;
    await supabase.from('reports').insert({ listing_id: id, reporter_id: user.id, reason });
  };

  const deleteListing = async () => {
    setShowDeleteConfirm(false);
    const { error } = await supabase
      .from('car_listings').update({ status: 'deleted' })
      .eq('id', id).eq('user_id', user!.id);
    if (error) { alert('Error: ' + error.message); return; }
    router.push('/profile');
  };

  if (authLoading || (!user && !authLoading)) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  );
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  );
  if (!listing) return null;

  const isOwner  = user?.id === listing.user_id;
  const photos   = listing.photos?.length > 0 ? listing.photos : ['/placeholder-car.jpg'];
  const hasDamage = listing.damage_parts?.length > 0;

  const specs = [
    { label: t.car.make,         value: listing.make },
    { label: t.car.model,        value: listing.model },
    { label: t.car.year,         value: String(listing.year) },
    { label: t.car.colour,       value: listing.colour },
    { label: t.car.mileage,      value: `${listing.mileage.toLocaleString()} km` },
    { label: t.car.engine,       value: listing.engine_size },
    { label: t.car.fuel,         value: listing.fuel_type },
    { label: t.car.transmission, value: listing.transmission },
    { label: t.car.city,         value: listing.city },
  ];

  // Chat modal rendered via Portal so it's outside the page scroll container
  const chatModal = showChat && user && !isOwner ? createPortal(
    <div
      className="chat-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) setShowChat(false); }}
    >
      <div className="chat-modal" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="chat-modal-header">
          <div className="chat-modal-avatar">
            {listing.seller?.avatar_url
              ? <img src={listing.seller.avatar_url} alt="" />
              : <span>{(listing.seller?.name || 'S')[0].toUpperCase()}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="chat-modal-name">{listing.seller?.name} {listing.seller?.surname}</div>
            <div className="chat-modal-sub">{listing.make} {listing.model} {listing.year}</div>
          </div>
          <button
            className="chat-modal-open-btn"
            title="Open in Messages"
            onClick={() => router.push(`/messages?listing=${id}&user=${listing.user_id}`)}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 3h6v6M10 14L21 3M9 21H3V15"/>
            </svg>
          </button>
          <button className="chat-modal-close" onClick={() => setShowChat(false)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="chat-modal-messages" ref={msgsDivRef}>
          {messages.length === 0 ? (
            <div className="chat-modal-empty">
              <MessageCircle size={28} strokeWidth={1} style={{ color: '#ddd', marginBottom: 8 }} />
              <span>{t.car.chatEmpty}</span>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`chat-row ${msg.sender_id === user.id ? 'mine' : 'theirs'}`}>
                <div className="chat-bubble">{msg.content}</div>
                <div className="chat-time">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="chat-modal-input-row">
          <input
            ref={chatInputRef}
            type="text"
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); sendMessage(); } }}
            placeholder={t.car.typeMessage}
            className="chat-modal-input"
          />
          <button
            className={`chat-modal-send${!newMsg.trim() || sendingMsg ? ' disabled' : ''}`}
            onClick={e => { e.preventDefault(); sendMessage(); }}
            disabled={!newMsg.trim() || sendingMsg}
            type="button"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        .chat-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.35);
          display: flex; align-items: flex-end; justify-content: flex-end;
          padding: 20px;
          animation: coFadeIn 0.18s ease;
        }
        @keyframes coFadeIn { from { opacity:0 } to { opacity:1 } }
        .chat-modal {
          width: 380px; max-width: calc(100vw - 40px);
          background: #fff; border-radius: 18px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.22);
          display: flex; flex-direction: column;
          overflow: hidden; height: 500px;
          animation: coSlideUp 0.22s ease;
        }
        @keyframes coSlideUp { from { transform:translateY(20px);opacity:0 } to { transform:translateY(0);opacity:1 } }
        .chat-modal-header {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px; border-bottom: 1px solid #f0f0f0;
          flex-shrink: 0;
        }
        .chat-modal-avatar {
          width: 38px; height: 38px; border-radius: 50%;
          background: linear-gradient(135deg,#ae050a,#d40710);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
          font-size: 14px; font-weight: 700; color: #fff;
        }
        .chat-modal-avatar img { width:100%; height:100%; object-fit:cover; }
        .chat-modal-name { font-size: 14px; font-weight: 700; color: #1a1a1a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .chat-modal-sub  { font-size: 11.5px; color: #ae050a; font-weight: 600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .chat-modal-open-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          color: #888; background: none; border: none; cursor: pointer;
          transition: all 0.15s;
        }
        .chat-modal-open-btn:hover { background:#f5f5f5; color:#ae050a; }
        .chat-modal-close {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          background: none; border: none; cursor: pointer; color: #888;
          transition: all 0.15s;
        }
        .chat-modal-close:hover { background:#f5f5f5; color:#333; }
        .chat-modal-messages {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          padding: 14px 16px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .chat-modal-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          color: #bbb; font-size: 13px; text-align: center; margin: auto;
        }
        .chat-row { display: flex; flex-direction: column; }
        .chat-row.mine   { align-items: flex-end; }
        .chat-row.theirs { align-items: flex-start; }
        .chat-bubble {
          max-width: 80%; padding: 9px 14px; border-radius: 18px;
          font-size: 14px; word-break: break-word; line-height: 1.4;
        }
        .chat-row.mine   .chat-bubble { background:#ae050a; color:#fff; border-bottom-right-radius:4px; }
        .chat-row.theirs .chat-bubble { background:#f2f2f2; color:#333; border-bottom-left-radius:4px; }
        .chat-time { font-size: 10.5px; color: #bbb; margin-top: 3px; padding: 0 4px; }
        .chat-modal-input-row {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border-top: 1px solid #f0f0f0; flex-shrink: 0;
        }
        .chat-modal-input {
          flex: 1; border: 1.5px solid #e8e8e8; outline: none;
          border-radius: 24px; padding: 9px 16px;
          font-size: 14px; color: #222; background: #fafafa;
          transition: border-color 0.15s;
        }
        .chat-modal-input:focus { border-color:#ae050a; background:#fff; }
        .chat-modal-input::placeholder { color:#bbb; }
        .chat-modal-send {
          width: 38px; height: 38px; border-radius: 50%;
          background: #ae050a; color: #fff;
          border: none; cursor: pointer; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .chat-modal-send:hover:not(.disabled) { background:#c0060c; transform:scale(1.06); }
        .chat-modal-send.disabled { opacity:0.4; cursor:not-allowed; }
        @media (max-width:600px) {
          .chat-overlay { padding:0; align-items:flex-end; }
          .chat-modal { width:100%; border-radius:18px 18px 0 0; height:70vh; max-width:100%; }
        }
      `}</style>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className="detail-page">
        <div className="container">
          {/* Breadcrumb */}
          <div className="breadcrumb">
            <button onClick={() => router.back()} className="back-btn">
              <ChevronLeft size={16} /> {t.car.back}
            </button>
            <span>{listing.make} {listing.model} {listing.year}</span>
          </div>

          <div className="detail-layout">
            {/* ── Left ── */}
            <div className="detail-main">
              {/* Gallery */}
              <div className="gallery">
                <div className="gallery-main">
                  <img src={photos[photoIndex]} alt="" className="gallery-img" />
                  {photos.length > 1 && (
                    <>
                      <button className="gallery-nav prev" onClick={() => setPhotoIndex(i => (i - 1 + photos.length) % photos.length)}>
                        <ChevronLeft size={20} />
                      </button>
                      <button className="gallery-nav next" onClick={() => setPhotoIndex(i => (i + 1) % photos.length)}>
                        <ChevronRight size={20} />
                      </button>
                      <div className="gallery-counter">{photoIndex + 1} / {photos.length}</div>
                    </>
                  )}
                </div>
                {photos.length > 1 && (
                  <div className="gallery-thumbs">
                    {photos.map((p, i) => (
                      <img key={i} src={p} alt=""
                        className={`gallery-thumb ${i === photoIndex ? 'active' : ''}`}
                        onClick={() => setPhotoIndex(i)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Title mobile */}
              <div className="detail-title-mobile">
                <h1 className="detail-title">{listing.make} {listing.model} {listing.year}</h1>
                <div className="price price-lg">{formatPrice(listing.price, listing.currency)}</div>
              </div>

              {/* Specs */}
              <div className="specs-card card" data-reveal>
                <h2 className="section-title">{t.car.specifications}</h2>
                <div className="specs-grid">
                  {specs.map(s => (
                    <div key={s.label} className="spec-item">
                      <div className="spec-label">{s.label}</div>
                      <div className="spec-value">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {listing.description && (
                <div className="desc-card card" data-reveal data-reveal-delay="80">
                  <h2 className="section-title">{t.car.description}</h2>
                  <p className="desc-text">{listing.description}</p>
                </div>
              )}

              {/* Damage */}
              <div className="specs-card card" data-reveal data-reveal-delay="120">
                <h2 className="section-title">{t.car.damage}</h2>
                {hasDamage ? (
                  <div className="damage-list">
                    {listing.damage_parts.map((p: any) => (
                      <div key={p.id} className="damage-item">
                        <span className="damage-dot" />{p.label}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-damage">{t.car.noDamage}</p>
                )}
              </div>
            </div>

            {/* ── Sidebar ── */}
            <div className="detail-sidebar">
              <div className="sidebar-card card" data-reveal="right">
                <div className="detail-title-desktop">
                  <h1 className="detail-title">{listing.make} {listing.model} {listing.year}</h1>
                </div>
                <div className="price price-lg sidebar-price">
                  {formatPrice(listing.price, listing.currency)}
                </div>
                <div className="car-tags">
                  <span className="tag"><Calendar size={12} />{listing.year}</span>
                  <span className="tag"><Gauge size={12} />{listing.mileage.toLocaleString()} km</span>
                  <span className="tag"><Fuel size={12} />{listing.fuel_type}</span>
                  <span className="tag"><Settings2 size={12} />{listing.transmission}</span>
                  <span className="tag"><MapPin size={12} />{listing.city}</span>
                  {hasDamage && <span className="tag tag-damage">⚠ {t.car.hasDamage}</span>}
                </div>

                <div className="sidebar-actions">
                  {!isOwner && user && (
                    <button className="btn-contact-seller" onClick={() => setShowChat(v => !v)}>
                      <MessageCircle size={18} strokeWidth={2} />
                      {t.car.contactSeller}
                    </button>
                  )}
                  {!user && (
                    <button className="btn-contact-seller" onClick={() => router.push('/auth/login')}>
                      <MessageCircle size={18} strokeWidth={2} />
                      {t.car.signInToContact}
                    </button>
                  )}
                  {!isOwner && (
                    <button
                      className={`btn btn-outline btn-lg w-full${saved ? ' saved-btn' : ''}`}
                      onClick={toggleSave}
                    >
                      <Heart size={16} fill={saved ? '#ae050a' : 'none'} />
                      {saved ? t.car.saved : t.car.save}
                    </button>
                  )}
                  {isOwner && (
                    <>
                      <button className="btn btn-ghost w-full" onClick={() => router.push(`/post-listing?edit=${id}`)}>
                        <Edit size={15} /> {t.car.edit}
                      </button>
                      <button className="btn btn-ghost w-full delete-btn" onClick={() => setShowDeleteConfirm(true)}>
                        <Trash2 size={15} /> {t.car.delete}
                      </button>
                    </>
                  )}
                  {!isOwner && user && (
                    <button className="btn btn-ghost w-full" onClick={() => setShowReport(true)}>
                      <Flag size={14} /> {t.car.report}
                    </button>
                  )}
                </div>
              </div>

              {listing.seller && (
                <div className="seller-card card" data-reveal="right" data-reveal-delay="100">
                  <h3 className="section-title">{t.car.seller}</h3>
                  <div className="seller-info">
                    <div className="seller-avatar">
                      {listing.seller.avatar_url
                        ? <img src={listing.seller.avatar_url} alt="" />
                        : <User size={22} />
                      }
                    </div>
                    <div>
                      <div className="seller-name">{listing.seller.name} {listing.seller.surname}</div>
                      {listing.seller.phone && (
                        <div className="seller-phone"><Phone size={12} />{listing.seller.phone}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Chat modal teleported to document.body — completely outside page scroll */}
      {chatModal}

      <ConfirmModal
        open={showDeleteConfirm}
        title={t.car.deleteListing}
        message={t.profile.deleteConfirm}
        onConfirm={deleteListing}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        onSubmit={submitReport}
      />

      <style jsx>{`
        .detail-page { padding: 24px 0 60px; }
        .breadcrumb { display:flex; align-items:center; gap:10px; font-size:13px; color:#888; margin-bottom:20px; }
        .back-btn { display:flex; align-items:center; gap:4px; background:none; border:none; cursor:pointer; color:#ae050a; font-weight:600; font-size:13px; }
        .detail-layout { display:grid; grid-template-columns:1fr 340px; gap:24px; align-items:start; }
        .detail-main { display:flex; flex-direction:column; gap:20px; }

        .gallery-main { position:relative; aspect-ratio:16/9; background:#f2f2f2; border-radius:10px; overflow:hidden; }
        .gallery-img { width:100%; height:100%; object-fit:cover; }
        .gallery-nav { position:absolute; z-index:2; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.45); border:none; border-radius:50%; width:38px; height:38px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#fff; transition:background 0.15s; }
        .gallery-nav:hover { background:rgba(0,0,0,0.7); }
        .gallery-nav.prev { left:10px; }
        .gallery-nav.next { right:10px; }
        .gallery-counter { position:absolute; z-index:2; bottom:10px; right:12px; background:rgba(0,0,0,0.5); color:#fff; font-size:12px; padding:3px 8px; border-radius:4px; }
        .gallery-thumbs { display:flex; gap:8px; margin-top:10px; overflow-x:auto; }
        .gallery-thumb { width:70px; height:50px; object-fit:cover; border-radius:5px; cursor:pointer; opacity:0.65; transition:opacity 0.15s; border:2px solid transparent; flex-shrink:0; }
        .gallery-thumb.active { opacity:1; border-color:#ae050a; }

        .specs-card, .desc-card, .sidebar-card, .seller-card, .report-card { padding:20px; border-radius:10px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.1); }
        .specs-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        .spec-label { font-size:11px; color:#888; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
        .spec-value { font-size:14px; font-weight:600; color:#1a1a1a; }
        .desc-text { font-size:14px; color:#444; line-height:1.7; }

        .detail-title-mobile { display:none; }
        .detail-title { font-family:'Montserrat',sans-serif; font-size:20px; font-weight:700; margin-bottom:8px; }
        .sidebar-price { display:block; margin-bottom:14px; }
        .car-tags { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; }
        .tag-damage { color:#ae050a; background:#ffeaea; }
        .sidebar-actions { display:flex; flex-direction:column; gap:10px; }
        .w-full { width:100%; justify-content:center; }
        .saved-btn { border-color:#ae050a; color:#ae050a; }
        .btn-contact-seller {
          display:flex; align-items:center; justify-content:center; gap:9px;
          width:100%; background:#ae050a; color:#fff; border:none; border-radius:12px;
          padding:14px 20px; font-size:15px; font-weight:700; cursor:pointer;
          transition:all 0.18s; box-shadow:0 4px 16px rgba(174,5,10,0.3);
        }
        .btn-contact-seller:hover { background:#c0060c; transform:translateY(-1px); box-shadow:0 6px 20px rgba(174,5,10,0.4); }
        .btn-contact-seller:active { transform:translateY(0); }
        .delete-btn:hover { border-color:#ae050a; color:#ae050a; background:#ffeaea; }
        .seller-info { display:flex; align-items:center; gap:12px; }
        .seller-avatar { width:44px; height:44px; border-radius:50%; background:#f2f2f2; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .seller-avatar img { width:100%; height:100%; object-fit:cover; }
        .seller-name { font-weight:600; font-size:15px; }
        .seller-phone { display:flex; align-items:center; gap:4px; font-size:12px; color:#888; margin-top:3px; }
        .damage-list { display:flex; flex-direction:column; gap:8px; margin-top:4px; }
        .damage-item { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:500; color:#1a1a1a; }
        .damage-dot { width:10px; height:10px; border-radius:50%; background:#ae050a; flex-shrink:0; }
        .no-damage { font-size:14px; color:#888; margin:4px 0 0; }

        @media (max-width:860px) {
          .detail-layout { grid-template-columns:1fr; }
          .detail-title-mobile { display:block; }
          .detail-title-desktop { display:none; }
          .specs-grid { grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width:600px) {
          .specs-grid { grid-template-columns:repeat(2,1fr); gap:10px; }
          .spec-item { padding:12px; }
          .spec-val { font-size:15px; }
          .gallery-thumbs { gap:6px; }
          .gallery-thumb { width:56px; height:42px; }
          .breadcrumb { font-size:11px; }
          .detail-price { font-size:26px; }
        }
        @media (max-width:400px) {
          .specs-grid { grid-template-columns:1fr 1fr; gap:8px; }
          .spec-item { padding:10px; }
        }
      `}</style>
    </>
  );
}
