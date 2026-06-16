'use client';

import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';
import {
  MessageCircle, Send, ArrowLeft, Car, Search,
  Check, CheckCheck, ChevronRight, Trash2, ShieldCheck, UserCircle, MessageSquareOff
} from 'lucide-react';
import RatingModal from '@/components/layout/RatingModal';

interface Conversation {
  listing_id: string | null;
  other_user_id: string;
  other_user_name: string;
  other_user_email?: string | null;
  other_user_avatar: string | null;
  car_title: string;
  car_photo: string | null;
  last_message: string;
  last_time: string;
  unread: number;
  isSupport?: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

const supabase = createClient();

// Inner component uses useSearchParams — must be wrapped in Suspense
function MessagesInner() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv]     = useState<Conversation | null>(null);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [newMsg, setNewMsg]                 = useState('');
  const [sending, setSending]               = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [convToDelete, setConvToDelete]       = useState<Conversation | null>(null);
  const [loadingConvs, setLoadingConvs]     = useState(true);
  const [loadingMsgs, setLoadingMsgs]       = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [chatEnded, setChatEnded]           = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [endingChat, setEndingChat]         = useState(false);

  const messagesDivRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const channelRef      = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const selectedConvRef = useRef<Conversation | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mt = (t as any).messages as Record<string, string>;

  // Lock body scroll while on this page so footer never causes page scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Redirect if not logged in, load convs, mark all as read
  useEffect(() => {
    if (authLoading) return; // don't redirect before the session resolves
    if (!user) { router.push('/auth/login'); return; }
    loadConversations();
    // Mark all received messages as read
    supabase
      .from('chat_messages')
      .update({ read: true })
      .eq('receiver_id', user.id)
      .eq('read', false)
      .then(() => {});
  }, [user, authLoading]);

  // Open conversation from query params (?listing=X&user=Y) — only once after convs load
  useEffect(() => {
    const listingId   = searchParams.get('listing');
    const otherUserId = searchParams.get('user');
    if (!listingId || !otherUserId || loadingConvs) return;

    const found = conversations.find(
      c => c.listing_id === listingId && c.other_user_id === otherUserId
    );
    if (found) {
      openConversation(found);
    } else {
      openNewConversation(listingId, otherUserId);
    }
  // Only run once after conversations finish loading
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingConvs]);

  const loadConversations = async () => {
    if (!user) return;
    setLoadingConvs(true);

    const { data: msgs, error } = await supabase
      .from('chat_messages')
      .select('id, listing_id, sender_id, receiver_id, content, created_at, deleted_for_sender, deleted_for_receiver')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error || !msgs) { setLoadingConvs(false); return; }

    // Collect unique other user IDs and listing IDs
    const userIds    = new Set<string>();
    const listingIds = new Set<string>();
    for (const m of msgs) {
      userIds.add(m.sender_id === user.id ? m.receiver_id : m.sender_id);
      if (m.listing_id) listingIds.add(m.listing_id);
    }

    // Batch-fetch profiles and listings
    const [{ data: profiles }, { data: listings }] = await Promise.all([
      supabase.from('profiles').select('id, name, surname, email, avatar_url').in('id', [...userIds]),
      supabase.from('car_listings').select('id, make, model, year, photos').in('id', [...listingIds]),
    ]);

    const profileMap  = new Map((profiles  || []).map((p: any) => [p.id, p]));
    const listingMap  = new Map((listings  || []).map((l: any) => [l.id, l]));

    const convMap = new Map<string, Conversation>();
    for (const msg of msgs) {
      const isSender   = msg.sender_id === user.id;
      // Skip messages this user has soft-deleted
      if (isSender && (msg as any).deleted_for_sender)   continue;
      if (!isSender && (msg as any).deleted_for_receiver) continue;
      const otherId    = isSender ? msg.receiver_id : msg.sender_id;
      const otherProf  = profileMap.get(otherId) as any;
      const listing    = msg.listing_id ? listingMap.get(msg.listing_id) as any : null;
      // "Support" framing only applies to non-admins (the listing-less thread
      // is their conversation with the DriveTR team). Admins see the real
      // user they're chatting with so they can identify and act on it.
      const isSupport  = !msg.listing_id && !isAdmin;
      const key        = !msg.listing_id ? `support__${otherId}` : `${msg.listing_id}__${otherId}`;

      if (!convMap.has(key)) {
        const fullName = otherProf
          ? `${otherProf.name || ''} ${otherProf.surname || ''}`.trim()
          : '';

        convMap.set(key, {
          listing_id:        msg.listing_id,
          other_user_id:     otherId,
          other_user_name:   isSupport
            ? mt.support
            : (fullName || otherProf?.email || 'User'),
          other_user_email:  otherProf?.email || null,
          other_user_avatar: otherProf?.avatar_url || null,
          car_title:         isSupport ? mt.supportSub : (listing ? `${listing.make} ${listing.model} ${listing.year}` : (!msg.listing_id ? mt.supportSub : 'Listing')),
          car_photo:         listing?.photos?.[0] || null,
          last_message:      isSender ? `${mt.you}: ${msg.content}` : msg.content,
          last_time:         msg.created_at,
          unread:            0,
          isSupport,
        });
      }
    }

    setConversations(Array.from(convMap.values()));
    setLoadingConvs(false);
  };

  const openNewConversation = async (listingId: string, otherUserId: string) => {
    const [{ data: listing }, { data: otherUser }] = await Promise.all([
      supabase.from('car_listings').select('make, model, year, photos').eq('id', listingId).single(),
      supabase.from('profiles').select('name, surname, email, avatar_url').eq('id', otherUserId).single(),
    ]);
    if (!listing || !otherUser) return;

    const fullName = `${(otherUser as any).name || ''} ${(otherUser as any).surname || ''}`.trim();

    const conv: Conversation = {
      listing_id:        listingId,
      other_user_id:     otherUserId,
      other_user_name:   fullName || (otherUser as any).email || 'User',
      other_user_email:  (otherUser as any).email || null,
      other_user_avatar: (otherUser as any).avatar_url || null,
      car_title:         `${(listing as any).make} ${(listing as any).model} ${(listing as any).year}`,
      car_photo:         (listing as any).photos?.[0] || null,
      last_message:      '',
      last_time:         new Date().toISOString(),
      unread:            0,
    };

    setConversations(prev => [
      conv,
      ...prev.filter(c => !(c.listing_id === listingId && c.other_user_id === otherUserId)),
    ]);
    openConversation(conv);
  };

  const fetchMessages = useCallback(async (conv: Conversation) => {
    if (!user) return;
    let query = supabase
      .from('chat_messages')
      .select('id, sender_id, receiver_id, content, created_at, read, deleted_for_sender, deleted_for_receiver');
    query = conv.listing_id ? query.eq('listing_id', conv.listing_id) : query.is('listing_id', null);
    const { data, error } = await query
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${conv.other_user_id}),` +
        `and(sender_id.eq.${conv.other_user_id},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });
    if (!error && data) {
      const visible = (data as any[]).filter(m =>
        !(m.sender_id === user.id && m.deleted_for_sender) &&
        !(m.receiver_id === user.id && m.deleted_for_receiver)
      );
      setMessages(visible as Message[]);
    }
    setLoadingMsgs(false);
  }, [user]);

  const openConversation = useCallback(async (conv: Conversation) => {
    selectedConvRef.current = conv;
    setSelectedConv(conv);
    setMobileShowChat(true);
    setLoadingMsgs(true);
    setMessages([]);
    setNewMsg('');
    setChatEnded(false);

    // Unsubscribe old channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // The "support thread owner" is the non-admin party — for a regular
    // user that's themselves, for an admin viewing a support thread it's
    // the other user.
    if (!conv.listing_id) {
      const ownerId = isAdmin ? conv.other_user_id : user!.id;
      const { data: status } = await supabase
        .from('support_chat_status')
        .select('ended')
        .eq('user_id', ownerId)
        .maybeSingle();
      setChatEnded(!!status?.ended);
    }

    await fetchMessages(conv);

    // Mark messages sent to us as read, then re-fetch so sender sees 2 ticks
    {
      let markQuery = supabase
        .from('chat_messages')
        .update({ read: true })
        .eq('receiver_id', user!.id)
        .eq('read', false);
      markQuery = conv.listing_id ? markQuery.eq('listing_id', conv.listing_id) : markQuery.is('listing_id', null);
      markQuery.then(() => fetchMessages(conv));
    }

    // Realtime subscription — unique name with timestamp prevents "already subscribed" error
    const channelName = `msgs-${conv.listing_id || 'support'}-${conv.other_user_id}-${Date.now()}`;
    const channel = supabase.channel(channelName);
    // New incoming message
    channel.on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
      }, (payload: any) => {
        const msg = payload.new as Message & { listing_id: string | null };
        const curr = selectedConvRef.current;
        if (!curr) return;
        const sameThread = (curr.listing_id || null) === (msg.listing_id || null);
        const relevant = sameThread &&
          ((msg.sender_id === user!.id && msg.receiver_id === curr.other_user_id) ||
           (msg.sender_id === curr.other_user_id && msg.receiver_id === user!.id));
        if (relevant && msg.sender_id !== user!.id) {
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        }
      });
    // Message read status updated (other person opened the chat → our sent msgs flip to read:true)
    channel.on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_messages',
      }, (payload: any) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, read: updated.read } : m));
      });
    // Support chat ended by either side — reflect instantly for both
    if (!conv.listing_id) {
      const ownerId = isAdmin ? conv.other_user_id : user!.id;
      channel.on('postgres_changes', {
          event: '*', schema: 'public', table: 'support_chat_status',
          filter: `user_id=eq.${ownerId}`,
        }, (payload: any) => {
          setChatEnded(!!payload.new?.ended);
        });
    }
    channel.subscribe();

    channelRef.current = channel;
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [user, isAdmin, fetchMessages]);

  useEffect(() => {
    const div = messagesDivRef.current;
    if (div) div.scrollTop = div.scrollHeight;
  }, [messages]);

  const confirmDelete = (conv: Conversation) => {
    setConvToDelete(conv);
    setShowDeleteModal(true);
  };

  const deleteConversation = async () => {
    const conv = convToDelete || selectedConv;
    if (!user || !conv) return;
    setShowDeleteModal(false);
    setDeleting(true);
    // Soft-delete: mark messages as deleted only for the current user
    let q1 = supabase
      .from('chat_messages')
      .update({ deleted_for_sender: true })
      .eq('sender_id', user.id)
      .eq('receiver_id', conv.other_user_id);
    q1 = conv.listing_id ? q1.eq('listing_id', conv.listing_id) : q1.is('listing_id', null);
    await q1;

    let q2 = supabase
      .from('chat_messages')
      .update({ deleted_for_receiver: true })
      .eq('sender_id', conv.other_user_id)
      .eq('receiver_id', user.id);
    q2 = conv.listing_id ? q2.eq('listing_id', conv.listing_id) : q2.is('listing_id', null);
    await q2;
    setConversations(prev => prev.filter(c =>
      !(c.listing_id === conv.listing_id && c.other_user_id === conv.other_user_id)
    ));
    setMessages([]);
    setSelectedConv(null);
    setMobileShowChat(false);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setDeleting(false);
  };

  const endChat = async () => {
    if (!user || !selectedConv || selectedConv.listing_id || endingChat) return;
    setEndingChat(true);
    const ownerId = isAdmin ? selectedConv.other_user_id : user.id;
    await supabase
      .from('support_chat_status')
      .upsert({ user_id: ownerId, ended: true, ended_at: new Date().toISOString() });
    setChatEnded(true);
    setEndingChat(false);
    if (!isAdmin) setShowRatingModal(true);
  };

  const submitRating = async (rating: number, comment: string) => {
    if (!user) return;
    await supabase.from('ratings').insert({
      user_id: user.id,
      rating,
      comment: comment || null,
    });
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !user || !selectedConv || sending) return;
    const content = newMsg.trim();
    setSending(true);
    setNewMsg('');

    const { error } = await supabase.from('chat_messages').insert({
      listing_id:  selectedConv.listing_id,
      sender_id:   user.id,
      receiver_id: selectedConv.other_user_id,
      content,
    });

    if (error) {
      setNewMsg(content);
    } else {
      // Re-fetch all messages — realtime dedup in the channel handler prevents doubles
      await fetchMessages(selectedConv);
      setConversations(prev => prev.map(c =>
        c.listing_id === selectedConv.listing_id && c.other_user_id === selectedConv.other_user_id
          ? { ...c, last_message: `${mt.you}: ${content}`, last_time: new Date().toISOString() }
          : c
      ));
    }
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d   = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return mt.yesterday;
    if (days < 7)  return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filtered = conversations.filter(c =>
    c.car_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.other_user_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) return null;

  return (
    <div className="msg-page">
      <div className="msg-layout">

        {/* ── Conversation list ── */}
        <aside className={`msg-sidebar ${mobileShowChat ? 'mobile-hidden' : ''}`}>
          <div className="msg-sidebar-header">
            <h1 className="msg-title">{mt.title}</h1>
          </div>

          <div className="msg-search-wrap">
            <Search size={14} style={{ color: '#aaa', flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="msg-search-input"
            />
          </div>

          <div className="conv-list">
            {loadingConvs ? (
              <div className="conv-loading">
                {[1,2,3].map(i => <div key={i} className="conv-skeleton" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="conv-empty">
                <MessageCircle size={40} strokeWidth={1} style={{ color: '#ddd', marginBottom: 16 }} />
                <p className="conv-empty-title">{mt.noConversations}</p>
                <p className="conv-empty-sub">{mt.noConversationsSub}</p>
                <Link href="/cars" className="conv-browse-btn">Browse Cars</Link>
              </div>
            ) : (
              filtered.map(conv => {
                const isActive = selectedConv?.listing_id === conv.listing_id &&
                                 selectedConv?.other_user_id === conv.other_user_id;
                return (
                  <div
                    key={`${conv.listing_id}-${conv.other_user_id}`}
                    className={`conv-item ${isActive ? 'selected' : ''}`}
                    onClick={() => openConversation(conv)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && openConversation(conv)}
                  >
                    <div className={`conv-avatar ${conv.isSupport ? 'support-avatar' : ''}`}>
                      {conv.isSupport
                        ? <ShieldCheck size={18} />
                        : conv.other_user_avatar
                          ? <img src={conv.other_user_avatar} alt="" />
                          : <span>{(conv.other_user_name || 'U')[0].toUpperCase()}</span>
                      }
                    </div>
                    <div className="conv-info">
                      <div className="conv-top">
                        <span className="conv-name">{conv.other_user_name || 'User'}</span>
                        <span className="conv-time">{formatTime(conv.last_time)}</span>
                      </div>
                      <div className="conv-car">{conv.car_title}</div>
                      <div className="conv-last">{conv.last_message}</div>
                    </div>
                    <button
                      className="conv-delete-btn"
                      title={mt.deleteConversation}
                      onClick={e => {
                        e.stopPropagation();
                        confirmDelete(conv);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Chat window ── */}
        <main className={`msg-main ${!mobileShowChat ? 'mobile-hidden' : ''}`}>
          {!selectedConv ? (
            <div className="chat-placeholder">
              <MessageCircle size={56} strokeWidth={1} style={{ color: '#e0e0e0', marginBottom: 20 }} />
              <h2>{mt.selectConversation}</h2>
              <p>{mt.selectConversationSub}</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="chat-header">
                <button className="chat-back" onClick={() => setMobileShowChat(false)}>
                  <ArrowLeft size={18} />
                </button>
                {(() => {
                  const avatar = (
                    <div className={`chat-header-avatar ${selectedConv.isSupport ? 'support-avatar' : ''}`}>
                      {selectedConv.isSupport
                        ? <ShieldCheck size={20} />
                        : selectedConv.other_user_avatar
                          ? <img src={selectedConv.other_user_avatar} alt="" />
                          : <span>{(selectedConv.other_user_name || 'U')[0].toUpperCase()}</span>
                      }
                    </div>
                  );
                  const info = (
                    <div className="chat-header-info">
                      <div className="chat-header-name">{selectedConv.other_user_name}</div>
                      <div className="chat-header-sub">{selectedConv.car_title}</div>
                    </div>
                  );
                  if (isAdmin && !selectedConv.isSupport) {
                    return (
                      <Link
                        href={`/admin?tab=users&user=${selectedConv.other_user_id}`}
                        className="chat-header-identity"
                        title={mt.viewProfile}
                      >
                        {avatar}
                        {info}
                        <UserCircle size={16} className="chat-header-profile-icon" />
                      </Link>
                    );
                  }
                  return (
                    <>
                      {avatar}
                      {info}
                    </>
                  );
                })()}
                {selectedConv.listing_id && (
                  <Link href={`/cars/${selectedConv.listing_id}`} className="chat-view-listing">
                    <Car size={14} /> {mt.viewListing}
                  </Link>
                )}
                {!selectedConv.listing_id && !chatEnded && (
                  <button
                    className="chat-end-btn"
                    onClick={endChat}
                    disabled={endingChat}
                    title={mt.endChat}
                  >
                    <MessageSquareOff size={15} />
                  </button>
                )}
                <button
                  className="chat-delete-btn"
                  onClick={() => selectedConv && confirmDelete(selectedConv)}
                  disabled={deleting}
                  title={mt.deleteConversation}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Car banner */}
              {selectedConv.listing_id && (
                <div className="chat-car-banner">
                  {selectedConv.car_photo && (
                    <img src={selectedConv.car_photo} alt="" className="chat-car-photo" />
                  )}
                  <div className="chat-car-info">
                    <span className="chat-car-label">{mt.about}</span>
                    <span className="chat-car-title">{selectedConv.car_title}</span>
                  </div>
                  <Link href={`/cars/${selectedConv.listing_id}`} className="chat-car-link">
                    <ChevronRight size={16} />
                  </Link>
                </div>
              )}

              {/* Messages */}
              <div className="chat-messages" ref={messagesDivRef}>
                {loadingMsgs ? (
                  <div className="msgs-loading">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`msg-skeleton ${i % 2 === 0 ? 'right' : 'left'}`} />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="msgs-empty">
                    <MessageCircle size={32} strokeWidth={1} style={{ color: '#ddd' }} />
                    <p>Start the conversation!</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => {
                      const isMine  = msg.sender_id === user.id;
                      const prevMsg = messages[idx - 1];
                      const showDate = !prevMsg ||
                        new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
                      return (
                        <React.Fragment key={msg.id}>
                          {showDate && (
                            <div className="msg-date-divider">
                              <span>
                                {new Date(msg.created_at).toLocaleDateString([], {
                                  weekday: 'long', month: 'long', day: 'numeric',
                                })}
                              </span>
                            </div>
                          )}
                          <div className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                            {!isMine && (
                              <div className="msg-avatar-sm">
                                {selectedConv.other_user_avatar
                                  ? <img src={selectedConv.other_user_avatar} alt="" />
                                  : <span>{(selectedConv.other_user_name || 'U')[0].toUpperCase()}</span>
                                }
                              </div>
                            )}
                            <div className="msg-content">
                              <div className="msg-bubble">{msg.content}</div>
                              <div className="msg-meta">
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: '2-digit', minute: '2-digit',
                                })}
                                {isMine && (
                                  msg.read
                                    ? <CheckCheck size={12} style={{ color: '#3b9ddd' }} />
                                    : <Check size={12} style={{ color: '#aaa' }} />
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Input */}
              {chatEnded && !selectedConv.listing_id ? (
                <div className="chat-ended-banner">
                  <div className="chat-ended-icon"><MessageSquareOff size={18} /></div>
                  <div className="chat-ended-text">
                    <strong>{mt.chatEndedTitle}</strong>
                    <span>{mt.chatEndedBody}</span>
                  </div>
                </div>
              ) : (
                <div className="chat-input-area">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={mt.typeMessage}
                    className="chat-input"
                  />
                  <button
                    className={`chat-send-btn ${!newMsg.trim() || sending ? 'disabled' : ''}`}
                    onClick={sendMessage}
                    disabled={!newMsg.trim() || sending}
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <RatingModal
        open={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onSubmit={submitRating}
      />

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && (
        <div className="del-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="del-modal" onClick={e => e.stopPropagation()}>
            <div className="del-icon"><Trash2 size={28} /></div>
            <h3 className="del-title">Delete Chat</h3>
            <p className="del-body">
              Do you want to delete this entire conversation?
              <br />This cannot be undone.
            </p>
            <div className="del-actions">
              <button className="del-btn del-cancel" onClick={() => setShowDeleteModal(false)}>
                No, Keep It
              </button>
              <button className="del-btn del-confirm" onClick={deleteConversation} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* Hide footer on messages page */
        :global(footer) { display: none !important; }

        .msg-page {
          height: calc(100dvh - 52px);
          display: flex; flex-direction: column;
          overflow: hidden; background: #f8f9fa;
        }
        .msg-layout {
          flex: 1; display: flex;
          max-width: 1200px; width: 100%;
          margin: 0 auto; padding: 20px;
          gap: 16px; overflow: hidden;
          box-sizing: border-box;
        }

        /* Sidebar */
        .msg-sidebar {
          width: 340px; flex-shrink: 0;
          background: #fff; border-radius: 16px;
          border: 1px solid #efefef;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .msg-sidebar-header { padding: 20px 20px 0; flex-shrink: 0; }
        .msg-title { font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0 0 14px; }
        .msg-search-wrap {
          display: flex; align-items: center; gap: 8px;
          background: #f8f9fa; border: 1.5px solid #efefef;
          border-radius: 10px; padding: 8px 13px;
          margin: 0 20px 12px; flex-shrink: 0;
        }
        .msg-search-input {
          border: none; outline: none; background: none;
          font-size: 13.5px; color: #333; width: 100%;
        }
        .msg-search-input::placeholder { color: #bbb; }

        .conv-list { flex: 1; overflow-y: auto; padding-bottom: 8px; }
        .conv-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 20px; width: 100%;
          text-align: left; background: none; border: none;
          cursor: pointer; border-bottom: 1px solid #f8f8f8;
          transition: background 0.12s; position: relative;
        }
        .conv-item:hover { background: #fafafa; }
        .conv-item.selected { background: #fff5f5; border-right: 3px solid #ae050a; }
        .conv-avatar {
          width: 46px; height: 46px; border-radius: 50%;
          background: linear-gradient(135deg, #ae050a, #d40710);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; overflow: hidden;
          font-size: 16px; font-weight: 700; color: #fff;
        }
        .conv-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .conv-info { flex: 1; min-width: 0; }
        .conv-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
        .conv-name { font-size: 14px; font-weight: 600; color: #1a1a1a; }
        .conv-time { font-size: 11px; color: #bbb; flex-shrink: 0; margin-left: 8px; }
        .conv-car { font-size: 11.5px; color: #ae050a; font-weight: 600; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .conv-last { font-size: 12.5px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .conv-delete-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
          background: none; border: none; cursor: pointer; color: #ccc;
          opacity: 0; transition: all 0.15s;
        }
        .conv-item:hover .conv-delete-btn { opacity: 1; }
        .conv-delete-btn:hover { background: #fff0f0; color: #ae050a; }

        .conv-empty { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; text-align: center; }
        .conv-empty-title { font-size: 15px; font-weight: 600; color: #333; margin: 0 0 6px; }
        .conv-empty-sub { font-size: 13px; color: #999; margin: 0 0 20px; line-height: 1.5; }
        .conv-browse-btn {
          background: #ae050a; color: #fff; font-size: 13px; font-weight: 600;
          padding: 9px 20px; border-radius: 9px; text-decoration: none;
        }
        .conv-loading { padding: 8px; }
        .conv-skeleton {
          height: 64px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 8px; margin-bottom: 6px;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* Chat main */
        .msg-main {
          flex: 1; background: #fff; border-radius: 16px;
          border: 1px solid #efefef;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          display: flex; flex-direction: column;
          overflow: hidden; min-width: 0;
        }
        .chat-placeholder {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; padding: 40px; color: #bbb;
        }
        .chat-placeholder h2 { font-size: 18px; font-weight: 600; color: #666; margin: 0 0 8px; }
        .chat-placeholder p { font-size: 14px; color: #bbb; margin: 0; }

        .chat-header {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 20px; border-bottom: 1px solid #f0f0f0;
          flex-shrink: 0;
        }
        .chat-back {
          display: none; background: none; border: none; cursor: pointer;
          color: #666; padding: 4px;
          align-items: center; justify-content: center;
        }
        .chat-header-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, #ae050a, #d40710);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
          font-size: 15px; font-weight: 700; color: #fff;
        }
        .chat-header-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .chat-header-info { flex: 1; min-width: 0; }
        .chat-header-name { font-size: 15px; font-weight: 700; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-header-sub { font-size: 12px; color: #999; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Clickable identity (admin → user profile link) */
        .chat-header-identity {
          display: flex; align-items: center; gap: 12px;
          flex: 1; min-width: 0; text-decoration: none;
          padding: 6px 10px; margin: -6px -10px;
          border-radius: 10px; transition: background 0.15s;
        }
        .chat-header-identity:hover { background: #fff5f5; }
        .chat-header-identity:hover .chat-header-name { color: #ae050a; }
        .chat-header-profile-icon {
          color: #ccc; flex-shrink: 0; transition: color 0.15s;
        }
        .chat-header-identity:hover .chat-header-profile-icon { color: #ae050a; }
        .chat-view-listing {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 600; color: #ae050a;
          text-decoration: none; padding: 6px 12px;
          background: #fff5f5; border-radius: 8px;
          transition: background 0.15s; flex-shrink: 0;
        }
        .chat-view-listing:hover { background: #ffe0e0; }
        .chat-delete-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
          background: none; border: none; cursor: pointer; color: #ccc;
          transition: all 0.15s;
        }
        .chat-delete-btn:hover { background: #fff0f0; color: #ae050a; }
        .chat-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .chat-end-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
          background: none; border: none; cursor: pointer; color: #ccc;
          transition: all 0.15s;
        }
        .chat-end-btn:hover { background: #fff0f0; color: #ae050a; }
        .chat-end-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .chat-car-banner {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 20px; background: #fafafa;
          border-bottom: 1px solid #f0f0f0; flex-shrink: 0;
        }
        .chat-car-photo { width: 48px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
        .chat-car-info { flex: 1; min-width: 0; }
        .chat-car-label { display: block; font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
        .chat-car-title { font-size: 13px; font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-car-link { color: #ccc; text-decoration: none; display: flex; align-items: center; transition: color 0.15s; }
        .chat-car-link:hover { color: #ae050a; }

        .chat-messages {
          flex: 1; overflow-y: auto;
          padding: 20px; display: flex;
          flex-direction: column; gap: 4px;
        }
        .msgs-loading { display: flex; flex-direction: column; gap: 10px; }
        .msg-skeleton {
          height: 36px; width: 55%; border-radius: 12px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
          background-size: 200% 100%; animation: shimmer 1.4s infinite;
        }
        .msg-skeleton.right { align-self: flex-end; }
        .msgs-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          color: #ccc; gap: 10px; text-align: center;
        }
        .msgs-empty p { font-size: 13px; color: #bbb; margin: 0; }

        .msg-date-divider {
          display: flex; align-items: center; justify-content: center;
          margin: 12px 0; position: relative;
        }
        .msg-date-divider span {
          font-size: 11px; color: #bbb;
          background: #fff; padding: 0 12px;
          position: relative; z-index: 1;
        }
        .msg-date-divider::before {
          content: ''; position: absolute;
          top: 50%; left: 0; right: 0;
          height: 1px; background: #f0f0f0;
        }

        .msg-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 2px; }
        .msg-row.mine { flex-direction: row-reverse; }
        .msg-avatar-sm {
          width: 28px; height: 28px; border-radius: 50%;
          background: linear-gradient(135deg, #ae050a, #d40710);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
          overflow: hidden; flex-shrink: 0;
        }
        .msg-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
        .msg-content { display: flex; flex-direction: column; max-width: 70%; }
        .msg-row.mine .msg-content { align-items: flex-end; }
        .msg-row.theirs .msg-content { align-items: flex-start; }
        .msg-bubble {
          padding: 10px 14px; border-radius: 18px;
          font-size: 14px; line-height: 1.4; word-break: break-word;
        }
        .msg-row.mine .msg-bubble { background: #ae050a; color: #fff; border-bottom-right-radius: 4px; }
        .msg-row.theirs .msg-bubble { background: #f2f2f2; color: #1a1a1a; border-bottom-left-radius: 4px; }
        .msg-meta {
          display: flex; align-items: center; gap: 4px;
          font-size: 10.5px; color: #bbb;
          margin-top: 3px; padding: 0 4px;
        }

        .chat-input-area {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 20px; border-top: 1px solid #f0f0f0;
          flex-shrink: 0; background: #fff;
        }
        .chat-ended-banner {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 20px; border-top: 1px solid #f0f0f0;
          flex-shrink: 0;
          background: linear-gradient(135deg, #fff5f5 0%, #fdf0f0 100%);
        }
        .chat-ended-icon {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          box-shadow: 0 4px 12px rgba(174,5,10,0.25);
        }
        .chat-ended-text {
          display: flex; flex-direction: column; gap: 2px;
        }
        .chat-ended-text strong {
          font-family: 'Montserrat', sans-serif;
          font-size: 13.5px; font-weight: 700; color: #16181d;
        }
        .chat-ended-text span {
          font-size: 12.5px; color: #888; line-height: 1.4;
        }
        .chat-input {
          flex: 1; border: 1.5px solid #e8e8e8; outline: none;
          border-radius: 24px; padding: 10px 18px;
          font-size: 14px; color: #222; background: #fafafa;
          transition: border-color 0.15s;
        }
        .chat-input:focus { border-color: #ae050a; background: #fff; }
        .chat-input::placeholder { color: #bbb; }
        .chat-send-btn {
          width: 42px; height: 42px; border-radius: 50%;
          background: #ae050a; color: #fff;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .chat-send-btn:hover:not(.disabled) { background: #c0060c; transform: scale(1.06); }
        .chat-send-btn.disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Delete modal ── */
        .del-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.15s ease;
        }
        .del-modal {
          background: #fff; border-radius: 16px;
          padding: 32px 28px 28px;
          width: 340px; max-width: calc(100vw - 32px);
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.18);
          animation: scaleIn 0.18s ease;
        }
        .del-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: #fff0f0; color: #ae050a;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
        }
        .del-title { font-size: 18px; font-weight: 700; color: #1a1a1a; margin: 0 0 10px; }
        .del-body { font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 24px; }
        .del-actions { display: flex; gap: 10px; }
        .del-btn {
          flex: 1; height: 44px; border-radius: 10px;
          font-size: 14px; font-weight: 600; cursor: pointer;
          border: none; transition: all 0.15s;
        }
        .del-cancel { background: #f1f1f1; color: #444; }
        .del-cancel:hover { background: #e5e5e5; }
        .del-confirm { background: #ae050a; color: #fff; }
        .del-confirm:hover:not(:disabled) { background: #c0060c; }
        .del-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }

        @media (max-width: 768px) {
          .msg-layout { padding: 0; gap: 0; }
          .msg-page { height: calc(100dvh - 48px); }
          .msg-sidebar { width: 100%; border-radius: 0; border: none; box-shadow: none; }
          .msg-main {
            position: absolute; top: 48px; left: 0; right: 0; bottom: 0;
            border-radius: 0; border: none; box-shadow: none; z-index: 10;
          }
          .mobile-hidden { display: none; }
          .chat-back { display: flex; }
        }
      `}</style>
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it in Next.js App Router
export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #ae050a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    }>
      <MessagesInner />
    </Suspense>
  );
}
