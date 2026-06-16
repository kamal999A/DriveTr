'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users, Car, Flag, Mail, Bell, Shield,
  Lock, Unlock, Trash2, Edit, Eye, Send,
  CheckCircle, XCircle, RefreshCw, Reply, Star
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Profile, CarListing, Report, ContactMessage } from '@/types';

type Tab = 'users' | 'listings' | 'reports' | 'messages' | 'announcements' | 'ratings' | 'email';

function AdminPageInner() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('users');

  const [users, setUsers] = useState<Profile[]>([]);
  const [listings, setListings] = useState<CarListing[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userListings, setUserListings] = useState<CarListing[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annSent, setAnnSent] = useState(false);
  const [emailTitle, setEmailTitle] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success?: string; error?: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [repliedIds, setRepliedIds] = useState<Set<string>>(new Set());
  const [listingToDelete, setListingToDelete] = useState<CarListing | null>(null);
  const [deletingListing, setDeletingListing] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/');
    }
  }, [user, isAdmin, authLoading]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [tab, isAdmin]);

  useEffect(() => {
    const queryTab = searchParams.get('tab');
    if (queryTab === 'users' || queryTab === 'listings' || queryTab === 'reports' || queryTab === 'messages' || queryTab === 'announcements' || queryTab === 'ratings') {
      setTab(queryTab as Tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const userId = searchParams.get('user');
    if (!userId || tab !== 'users' || users.length === 0) return;
    const target = users.find(u => u.id === userId);
    if (target) openUser(target);
  }, [searchParams, tab, users]);

  const fetchData = async () => {
    setLoading(true);
    if (tab === 'users') {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (data) setUsers(data as Profile[]);
    } else if (tab === 'listings') {
      const { data } = await supabase
        .from('car_listings')
        .select('*, seller:profiles(name,surname,email)')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });
      if (data) setListings(data as CarListing[]);
    } else if (tab === 'reports') {
      const { data } = await supabase
        .from('reports')
        .select('*, listing:car_listings(make,model,year), reporter:profiles(name,surname,email)')
        .order('created_at', { ascending: false });
      if (data) setReports(data);
    } else if (tab === 'messages') {
      const { data } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setMessages(data as ContactMessage[]);
    } else if (tab === 'ratings') {
      const { data } = await supabase
        .from('ratings')
        .select('*, user:profiles(name,surname,email)')
        .order('created_at', { ascending: false });
      if (data) setRatings(data);
    }
    setLoading(false);
  };

  const toggleBlock = async (u: Profile) => {
    await supabase.from('profiles').update({ is_blocked: !u.is_blocked }).eq('id', u.id);
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_blocked: !x.is_blocked } : x));
    if (selectedUser?.id === u.id) setSelectedUser({ ...u, is_blocked: !u.is_blocked });
  };

  const setListingStatus = async (id: string, status: string) => {
    await supabase.from('car_listings').update({ status }).eq('id', id);
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: status as any } : l));
  };

  const deleteListing = async () => {
    if (!listingToDelete || deletingListing) return;
    setDeletingListing(true);
    await supabase.from('car_listings').delete().eq('id', listingToDelete.id);
    setListings(prev => prev.filter(l => l.id !== listingToDelete.id));
    setUserListings(prev => prev.filter(l => l.id !== listingToDelete.id));
    setDeletingListing(false);
    setListingToDelete(null);
  };

  const markMessageRead = async (id: string) => {
    await supabase.from('contact_messages').update({ read: true }).eq('id', id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
  };

  const sendReply = async (msg: ContactMessage) => {
    if (!user || !msg.user_id || !replyText.trim() || replySending) return;
    setReplySending(true);
    const { error } = await supabase.from('chat_messages').insert({
      listing_id: null,
      sender_id: user.id,
      receiver_id: msg.user_id,
      content: replyText.trim(),
    });
    setReplySending(false);
    if (!error) {
      await supabase
        .from('support_chat_status')
        .upsert({ user_id: msg.user_id, ended: false, ended_at: null });
      setRepliedIds(prev => new Set(prev).add(msg.id));
      setReplyingTo(null);
      setReplyText('');
      if (!msg.read) markMessageRead(msg.id);
    }
  };

  const sendAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) return;
    await supabase.from('announcements').insert({ title: annTitle, content: annContent });
    setAnnTitle('');
    setAnnContent('');
    setAnnSent(true);
    setTimeout(() => setAnnSent(false), 3000);
  };

  const sendAnnouncementEmail = async () => {
    if (!emailTitle.trim() || !emailContent.trim() || emailSending) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/send-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: emailTitle, content: emailContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailResult({ error: data.error || 'Failed to send emails' });
      } else {
        setEmailResult({ success: `Email sent to ${data.count} users!` });
        setEmailTitle('');
        setEmailContent('');
      }
    } catch {
      setEmailResult({ error: 'Network error. Please try again.' });
    }
    setEmailSending(false);
  };

  const openUser = async (u: Profile) => {
    setSelectedUser(u);
    const { data } = await supabase
      .from('car_listings').select('*').eq('user_id', u.id).neq('status', 'deleted');
    if (data) setUserListings(data as CarListing[]);
  };

  if (authLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  );
  if (!isAdmin) return null;

  const unread = messages.filter(m => !m.read).length;

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title"><Shield size={22} /> Admin Panel</h1>
            <p className="admin-sub">DriveTR platform management</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="admin-tabs">
          {([
            { key: 'users',         label: 'Users',         icon: <Users size={15} />,   count: users.length },
            { key: 'listings',      label: 'Listings',      icon: <Car size={15} />,     count: listings.length },
            { key: 'reports',       label: 'Reports',       icon: <Flag size={15} />,    count: reports.length },
            { key: 'messages',      label: 'Messages',      icon: <Mail size={15} />,    count: unread || undefined },
            { key: 'ratings',       label: 'Ratings',       icon: <Star size={15} />,    count: ratings.length },
            { key: 'announcements', label: 'Announce',      icon: <Bell size={15} /> },
            { key: 'email',         label: 'Email Users',   icon: <Mail size={15} /> },
          ] as any[]).map(tb => (
            <button
              key={tb.key}
              className={`admin-tab ${tab === tb.key ? 'active' : ''}`}
              onClick={() => setTab(tb.key as Tab)}
            >
              {tb.icon} {tb.label}
              {tb.count !== undefined && tb.count > 0 && (
                <span className="tab-badge">{tb.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="admin-content">
          {loading && <div className="admin-loading"><span className="spinner" /></div>}

          {tab === 'users' && !loading && (
            <div className="admin-layout">
              <div className="admin-list">
                <div className="list-header">
                  <h2>{users.length} Registered Users</h2>
                </div>
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>User</th><th>Email</th><th>Phone</th><th>Listings</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr
                          key={u.id}
                          className={`${selectedUser?.id === u.id ? 'row-selected' : ''} ${u.is_blocked ? 'row-blocked' : ''}`}
                          onClick={() => openUser(u)}
                        >
                          <td>
                            <div className="user-cell">
                              <div className="user-initials">{u.name?.[0]}{u.surname?.[0]}</div>
                              <span>{u.name} {u.surname}</span>
                              {u.role === 'admin' && <span className="badge badge-red">Admin</span>}
                            </div>
                          </td>
                          <td className="muted">{u.email}</td>
                          <td className="muted">{u.phone || '—'}</td>
                          <td>—</td>
                          <td>
                            {u.is_blocked
                              ? <span className="badge badge-red">Blocked</span>
                              : <span className="badge badge-green">Active</span>
                            }
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="icon-btn"
                                onClick={() => router.push(`/profile?user=${u.id}`)}
                                title="View profile"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                className={`btn btn-sm ${u.is_blocked ? 'btn-outline' : 'btn-ghost'}`}
                                onClick={() => toggleBlock(u)}
                                title={u.is_blocked ? 'Unblock' : 'Block'}
                              >
                                {u.is_blocked ? <Unlock size={13} /> : <Lock size={13} />}
                                {u.is_blocked ? 'Unblock' : 'Block'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedUser && (
                <div className="user-detail card">
                  <div className="ud-header">
                    <div className="user-initials lg">{selectedUser.name?.[0]}{selectedUser.surname?.[0]}</div>
                    <div>
                      <h3>{selectedUser.name} {selectedUser.surname}</h3>
                      <p>{selectedUser.email}</p>
                    </div>
                    <button className="close-btn" onClick={() => setSelectedUser(null)}>×</button>
                  </div>
                  <div className="ud-info">
                    <div className="ud-row"><span>Phone</span><strong>{selectedUser.phone || '—'}</strong></div>
                    <div className="ud-row"><span>Role</span><strong>{selectedUser.role}</strong></div>
                    <div className="ud-row"><span>Status</span>
                      <strong style={{ color: selectedUser.is_blocked ? '#ae050a' : '#1a7a1a' }}>
                        {selectedUser.is_blocked ? 'Blocked' : 'Active'}
                      </strong>
                    </div>
                    <div className="ud-row"><span>Joined</span><strong>{new Date(selectedUser.created_at).toLocaleDateString()}</strong></div>
                  </div>
                  <button
                    className={`btn w-full ${selectedUser.is_blocked ? 'btn-outline' : 'btn-ghost'}`}
                    onClick={() => toggleBlock(selectedUser)}
                  >
                    {selectedUser.is_blocked ? <><Unlock size={14} /> Unblock User</> : <><Lock size={14} /> Block User</>}
                  </button>

                  <div className="ud-listings">
                    <h4>Listings ({userListings.length})</h4>
                    {userListings.length === 0
                      ? <p className="muted">No listings</p>
                      : userListings.map(l => (
                        <div key={l.id} className="ud-listing">
                          <span>{l.make} {l.model} {l.year}</span>
                          <div className="ud-listing-actions">
                            <span className={`badge ${l.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{l.status}</span>
                            <button className="icon-btn" onClick={() => router.push(`/cars/${l.id}`)}><Eye size={13} /></button>
                            <button className="icon-btn" onClick={() => router.push(`/post-listing?edit=${l.id}`)}><Edit size={13} /></button>
                            <button className="icon-btn red" onClick={() => setListingStatus(l.id, l.status === 'active' ? 'inactive' : 'active')}>
                              {l.status === 'active' ? <XCircle size={13} /> : <CheckCircle size={13} />}
                            </button>
                            <button className="icon-btn red" onClick={() => setListingToDelete(l)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'listings' && !loading && (
            <div>
              <div className="list-header">
                <h2>{listings.length} Listings</h2>
              </div>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Car</th><th>Seller</th><th>Price</th><th>City</th><th>Status</th><th>Date</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {listings.map(l => (
                      <tr key={l.id}>
                        <td><strong>{l.make} {l.model} {l.year}</strong></td>
                        <td className="muted">{(l as any).seller?.name} {(l as any).seller?.surname}</td>
                        <td>₺{l.price.toLocaleString()}</td>
                        <td className="muted">{l.city}</td>
                        <td>
                          <span className={`badge ${l.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{l.status}</span>
                        </td>
                        <td className="muted">{new Date(l.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="icon-btn" onClick={() => router.push(`/cars/${l.id}`)} title="View"><Eye size={14} /></button>
                            <button className="icon-btn" onClick={() => router.push(`/post-listing?edit=${l.id}`)} title="Edit"><Edit size={14} /></button>
                            <button className="icon-btn red" onClick={() => setListingStatus(l.id, l.status === 'active' ? 'inactive' : 'active')} title="Toggle status">
                              {l.status === 'active' ? <XCircle size={14} /> : <CheckCircle size={14} />}
                            </button>
                            <button className="icon-btn red" onClick={() => setListingToDelete(l)} title="Delete listing">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'reports' && !loading && (
            <div>
              <div className="list-header"><h2>{reports.length} Reports</h2></div>
              {reports.length === 0 ? (
                <div className="empty-state"><Flag size={36} /><h3>No reports yet</h3></div>
              ) : (
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Listing</th><th>Reported By</th><th>Reason</th><th>Date</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {reports.map(r => (
                        <tr key={r.id}>
                          <td><strong>{r.listing?.make} {r.listing?.model} {r.listing?.year}</strong></td>
                          <td className="muted">{r.reporter?.name} {r.reporter?.surname}</td>
                          <td style={{ maxWidth: 260, fontSize: 12 }}>{r.reason}</td>
                          <td className="muted">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td>
                            <button className="icon-btn" onClick={() => router.push(`/cars/${r.listing_id}`)}><Eye size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'messages' && !loading && (
            <div>
              <div className="list-header">
                <h2>{messages.length} Messages</h2>
                {unread > 0 && <span className="badge badge-red">{unread} unread</span>}
              </div>
              {messages.length === 0 ? (
                <div className="empty-state"><Mail size={36} /><h3>No messages</h3></div>
              ) : (
                <div className="messages-list">
                  {messages.map(m => (
                    <div key={m.id} className={`message-card card ${!m.read ? 'unread' : ''}`}>
                      <div className="msg-header">
                        <div>
                          <strong>{m.name}</strong>
                          <span className="muted"> · {m.email}</span>
                          {!m.read && <span className="badge badge-red" style={{ marginLeft: 8 }}>New</span>}
                          {repliedIds.has(m.id) && <span className="badge badge-green" style={{ marginLeft: 8 }}>Replied</span>}
                        </div>
                        <span className="muted">{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="msg-body">{m.message}</p>
                      <div className="msg-actions">
                        {!m.read && (
                          <button className="btn btn-ghost btn-sm" onClick={() => markMessageRead(m.id)}>
                            <CheckCircle size={13} /> Mark as Read
                          </button>
                        )}
                        {m.user_id && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setReplyingTo(replyingTo === m.id ? null : m.id); setReplyText(''); }}
                          >
                            <Reply size={13} /> Reply
                          </button>
                        )}
                      </div>
                      {replyingTo === m.id && (
                        <div className="reply-box">
                          <textarea
                            className="form-textarea"
                            placeholder="Write your reply..."
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            rows={3}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => sendReply(m)}
                              disabled={!replyText.trim() || replySending}
                            >
                              {replySending ? <span className="spinner" /> : <><Send size={13} /> Send Reply</>}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setReplyingTo(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'ratings' && !loading && (
            <div>
              <div className="list-header"><h2>{ratings.length} Support Ratings</h2></div>
              {ratings.length === 0 ? (
                <div className="empty-state"><Star size={36} /><h3>No ratings yet</h3></div>
              ) : (
                <div className="ratings-list">
                  {ratings.map(r => (
                    <div key={r.id} className="rating-card card">
                      <div className="rating-card-header">
                        <div className="user-cell">
                          <div className="user-initials">{r.user?.name?.[0]}{r.user?.surname?.[0]}</div>
                          <div>
                            <strong>{r.user?.name} {r.user?.surname}</strong>
                            <span className="muted"> · {r.user?.email}</span>
                          </div>
                        </div>
                        <span className="muted">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="rating-stars">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star
                            key={n}
                            size={16}
                            strokeWidth={1.5}
                            fill={r.rating >= n ? '#ae050a' : 'none'}
                            stroke={r.rating >= n ? '#ae050a' : '#d4d4d8'}
                          />
                        ))}
                        <span className="rating-value">{r.rating}/5</span>
                      </div>
                      {r.comment && <p className="rating-comment">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'announcements' && !loading && (
            <div className="announce-panel">
              <h2>Send Platform Announcement</h2>
              <p>This will appear as a banner on the homepage for all visitors.</p>

              {annSent && (
                <div className="success-toast">
                  <CheckCircle size={16} /> Announcement sent successfully!
                </div>
              )}

              <div className="card ann-form">
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input type="text" className="form-input" value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="e.g. New features available!" />
                </div>
                <div className="form-group">
                  <label className="form-label">Message *</label>
                  <textarea className="form-textarea" value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Write your announcement..." rows={4} />
                </div>
                <button className="btn btn-primary" onClick={sendAnnouncement} disabled={!annTitle.trim() || !annContent.trim()}>
                  <Send size={15} /> Send Announcement
                </button>
              </div>
            </div>
          )}

          {tab === 'email' && !loading && (
            <div className="announce-panel">
              <h2>Send Announcement Email</h2>
              <p>This will send a real email to every registered user on the platform.</p>

              {emailResult?.success && (
                <div className="success-toast">
                  <CheckCircle size={16} /> {emailResult.success}
                </div>
              )}
              {emailResult?.error && (
                <div className="error-toast">
                  <XCircle size={16} /> {emailResult.error}
                </div>
              )}

              <div className="card ann-form">
                <div className="form-group">
                  <label className="form-label">Subject *</label>
                  <input type="text" className="form-input" value={emailTitle} onChange={e => setEmailTitle(e.target.value)} placeholder="e.g. Important update from DriveTR" />
                </div>
                <div className="form-group">
                  <label className="form-label">Message *</label>
                  <textarea className="form-textarea" value={emailContent} onChange={e => setEmailContent(e.target.value)} placeholder="Write your email message..." rows={6} />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={sendAnnouncementEmail}
                  disabled={!emailTitle.trim() || !emailContent.trim() || emailSending}
                >
                  {emailSending ? <span className="spinner" /> : <><Mail size={15} /> Send Email to All Users</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {listingToDelete && (
        <div className="del-overlay" onClick={() => setListingToDelete(null)}>
          <div className="del-modal" onClick={e => e.stopPropagation()}>
            <div className="del-icon"><Trash2 size={28} /></div>
            <h3 className="del-title">Delete Listing</h3>
            <p className="del-body">
              Delete &ldquo;{listingToDelete.make} {listingToDelete.model} {listingToDelete.year}&rdquo;?
              <br />This cannot be undone.
            </p>
            <div className="del-actions">
              <button className="del-btn del-cancel" onClick={() => setListingToDelete(null)}>
                Cancel
              </button>
              <button className="del-btn del-confirm" onClick={deleteListing} disabled={deletingListing}>
                {deletingListing ? <span className="spinner" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-page { padding: 28px 0 60px; }
        .admin-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .admin-title { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .admin-sub { font-size: 13px; color: #888; margin-top: 3px; }

        .admin-tabs { display: flex; gap: 4px; border-bottom: 1px solid #e0e0e0; margin-bottom: 24px; overflow-x: auto; }
        .admin-tab { display: flex; align-items: center; gap: 7px; padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 13px; font-weight: 600; color: #666; white-space: nowrap; margin-bottom: -1px; transition: all 0.15s; }
        .admin-tab:hover { color: #ae050a; }
        .admin-tab.active { color: #ae050a; border-bottom-color: #ae050a; }
        .tab-badge { background: #ae050a; color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 99px; }

        .admin-content { min-height: 400px; }
        .admin-loading { display: flex; justify-content: center; padding: 60px; }
        .admin-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
        .list-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .list-header h2 { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 700; }

        .table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #e8e8e8; }
        .admin-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; }
        .admin-table th { padding: 10px 14px; text-align: left; background: #f7f7f7; font-weight: 600; color: #555; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e8e8e8; }
        .admin-table td { padding: 10px 14px; border-bottom: 1px solid #f5f5f5; vertical-align: middle; }
        .admin-table tr:last-child td { border-bottom: none; }
        .admin-table tbody tr { cursor: pointer; transition: background 0.12s; }
        .admin-table tbody tr:hover { background: #fafafa; }
        .row-selected { background: #fff5f5 !important; }
        .row-blocked { opacity: 0.6; }
        .muted { color: #888; font-size: 12px; }
        .user-cell { display: flex; align-items: center; gap: 8px; }
        .user-initials { width: 28px; height: 28px; border-radius: 50%; background: #ae050a; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
        .user-initials.lg { width: 44px; height: 44px; font-size: 16px; }

        .user-detail { padding: 20px; position: sticky; top: 80px; }
        .ud-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .ud-header h3 { font-size: 16px; font-weight: 700; }
        .ud-header p { font-size: 12px; color: #888; }
        .close-btn { margin-left: auto; background: none; border: none; font-size: 20px; cursor: pointer; color: #aaa; line-height: 1; }
        .ud-info { margin-bottom: 14px; }
        .ud-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
        .ud-row span { color: #888; }
        .w-full { width: 100%; justify-content: center; margin-bottom: 14px; }
        .ud-listings h4 { font-size: 13px; font-weight: 700; margin-bottom: 10px; margin-top: 14px; }
        .ud-listing { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 12px; }
        .ud-listing-actions { display: flex; align-items: center; gap: 6px; }
        .icon-btn { background: none; border: 1px solid #e0e0e0; border-radius: 4px; padding: 4px 7px; cursor: pointer; color: #555; display: flex; align-items: center; transition: all 0.12s; }
        .icon-btn:hover { border-color: #ae050a; color: #ae050a; }
        .icon-btn.red:hover { background: #ffeaea; }

        .messages-list { display: flex; flex-direction: column; gap: 12px; }
        .message-card { padding: 16px 20px; }
        .message-card.unread { border-left: 3px solid #ae050a; }
        .msg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; }
        .msg-body { font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 10px; }
        .msg-actions { display: flex; gap: 8px; }
        .reply-box { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f5f5f5; }

        .ratings-list { display: flex; flex-direction: column; gap: 12px; }
        .rating-card { padding: 16px 20px; border-left: 3px solid #ae050a; }
        .rating-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
        .rating-stars { display: flex; align-items: center; gap: 3px; margin-bottom: 8px; }
        .rating-value { margin-left: 6px; font-size: 12px; font-weight: 700; color: #ae050a; }
        .rating-comment { font-size: 13.5px; color: #444; line-height: 1.6; background: #fafafa; border-radius: 8px; padding: 10px 12px; margin: 0; }

        .announce-panel h2 { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 6px; }
        .announce-panel p { font-size: 13px; color: #888; margin-bottom: 20px; }
        .ann-form { padding: 24px; display: flex; flex-direction: column; gap: 16px; max-width: 580px; }
        .success-toast { background: #e9fbe9; border: 1px solid #a3d9a3; color: #1a7a1a; padding: 12px 16px; border-radius: 6px; display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 16px; max-width: 580px; }
        .error-toast { background: #fef2f2; border: 1px solid #fecaca; color: #ae050a; padding: 12px 16px; border-radius: 6px; display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 16px; max-width: 580px; }

        @media (max-width: 900px) { .admin-layout { grid-template-columns: 1fr; } }

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
        @keyframes scaleIn { from { transform: scale(0.94); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    }>
      <AdminPageInner />
    </Suspense>
  );
}
