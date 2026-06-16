'use client';
// src/app/chat/page.tsx  ── Chat history (all conversations)

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Circle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

interface Conversation {
  listing_id: string;
  listing_make: string;
  listing_model: string;
  listing_year: number;
  listing_photo: string | null;
  other_user_name: string;
  last_message: string;
  last_time: string;
  unread_count: number;
}

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // don't redirect before the session resolves
    if (!user) { router.push('/auth/login'); return; }
    fetchConversations();
  }, [user, authLoading]);

  const fetchConversations = async () => {
    if (!user) return;
    // Get all messages where user is participant
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select(`
        listing_id, content, created_at, read, sender_id,
        listing:car_listings(make, model, year, photos),
        sender:profiles!chat_messages_sender_id_fkey(name, surname),
        receiver:profiles!chat_messages_receiver_id_fkey(name, surname)
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!msgs) { setLoading(false); return; }

    // Group by listing_id and get latest per listing
    const seen = new Set<string>();
    const convs: Conversation[] = [];
    for (const m of msgs as any[]) {
      if (seen.has(m.listing_id)) continue;
      seen.add(m.listing_id);
      const otherName = m.sender_id === user.id
        ? `${m.receiver?.name} ${m.receiver?.surname}`
        : `${m.sender?.name} ${m.sender?.surname}`;
      convs.push({
        listing_id: m.listing_id,
        listing_make: m.listing?.make || '',
        listing_model: m.listing?.model || '',
        listing_year: m.listing?.year || 0,
        listing_photo: m.listing?.photos?.[0] || null,
        other_user_name: otherName.trim(),
        last_message: m.content,
        last_time: m.created_at,
        unread_count: msgs.filter((x: any) =>
          x.listing_id === m.listing_id && !x.read && x.sender_id !== user.id
        ).length,
      });
    }
    setConversations(convs);
    setLoading(false);
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 680 }}>
        <h1 className="page-title"><MessageCircle size={22} style={{ display: 'inline', marginRight: 8, color: '#ae050a' }} />Messages</h1>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={44} />
            <h3>No conversations yet</h3>
            <p>When you message a seller, conversations will appear here.</p>
            <button className="btn btn-primary" onClick={() => router.push('/cars')}>Browse Cars</button>
          </div>
        ) : (
          <div className="conv-list">
            {conversations.map(c => (
              <div
                key={c.listing_id}
                className={`conv-item card ${c.unread_count > 0 ? 'unread' : ''}`}
                onClick={() => router.push(`/cars/${c.listing_id}`)}
              >
                <div className="conv-photo">
                  {c.listing_photo
                    ? <img src={c.listing_photo} alt="" />
                    : <div className="conv-photo-placeholder"><MessageCircle size={20} /></div>
                  }
                </div>
                <div className="conv-body">
                  <div className="conv-title">
                    <strong>{c.listing_make} {c.listing_model} {c.listing_year}</strong>
                    <span className="conv-time">{new Date(c.last_time).toLocaleDateString()}</span>
                  </div>
                  <div className="conv-sub">with {c.other_user_name}</div>
                  <div className="conv-preview">{c.last_message}</div>
                </div>
                {c.unread_count > 0 && (
                  <div className="unread-badge">{c.unread_count}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .conv-list { display: flex; flex-direction: column; gap: 10px; }
        .conv-item { display: flex; align-items: center; gap: 14px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
        .conv-item:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-1px); }
        .conv-item.unread { border-left: 3px solid #ae050a; }
        .conv-photo { width: 60px; height: 50px; border-radius: 6px; overflow: hidden; flex-shrink: 0; background: #f2f2f2; }
        .conv-photo img { width: 100%; height: 100%; object-fit: cover; }
        .conv-photo-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #ccc; }
        .conv-body { flex: 1; min-width: 0; }
        .conv-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
        .conv-title strong { font-size: 14px; font-weight: 600; }
        .conv-time { font-size: 11px; color: #aaa; }
        .conv-sub { font-size: 12px; color: #888; margin-bottom: 3px; }
        .conv-preview { font-size: 13px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .unread-badge { background: #ae050a; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
      `}</style>
    </div>
  );
}
