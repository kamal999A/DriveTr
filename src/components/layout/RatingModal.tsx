'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, CheckCircle, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
}

export default function RatingModal({ open, onClose, onSubmit }: Props) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const close = () => {
    onClose();
    setRating(0);
    setHover(0);
    setComment('');
    setSent(false);
  };

  const handleSubmit = async () => {
    if (!rating || sending) return;
    setSending(true);
    await onSubmit(rating, comment.trim());
    setSending(false);
    setSent(true);
  };

  return createPortal(
    <div className="rtm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="rtm-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="rtm-close" onClick={close}><X size={18} /></button>

        {sent ? (
          <>
            <div className="rtm-icon rtm-icon-success"><CheckCircle size={22} strokeWidth={2} /></div>
            <h3 className="rtm-title">{t.messages.ratingThanksTitle}</h3>
            <p className="rtm-message">{t.messages.ratingThanksBody}</p>
            <div className="rtm-actions">
              <button className="rtm-btn rtm-btn-confirm" onClick={close}>{t.car.close}</button>
            </div>
          </>
        ) : (
          <>
            <div className="rtm-icon"><Star size={20} strokeWidth={2} /></div>
            <h3 className="rtm-title">{t.messages.ratingTitle}</h3>
            <p className="rtm-message">{t.messages.ratingPrompt}</p>
            <div className="rtm-stars">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  className="rtm-star-btn"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  aria-label={`${n} star`}
                >
                  <Star
                    size={32}
                    strokeWidth={1.5}
                    fill={(hover || rating) >= n ? '#ae050a' : 'none'}
                    stroke={(hover || rating) >= n ? '#ae050a' : '#d4d4d8'}
                  />
                </button>
              ))}
            </div>
            <textarea
              className="rtm-textarea"
              placeholder={t.messages.ratingCommentPlaceholder}
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
            />
            <div className="rtm-actions">
              <button className="rtm-btn rtm-btn-cancel" onClick={close}>{t.car.cancel}</button>
              <button
                className="rtm-btn rtm-btn-confirm"
                onClick={handleSubmit}
                disabled={!rating || sending}
              >
                {sending ? <span className="rtm-spinner" /> : t.messages.ratingSubmit}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .rtm-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(15, 23, 42, 0.45);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: rtmFade 0.15s ease;
        }
        .rtm-modal {
          position: relative;
          background: #fff;
          border-radius: 16px;
          border: 1px solid rgba(174,5,10,0.12);
          box-shadow: 0 20px 60px rgba(15,23,42,0.25);
          width: 100%; max-width: 400px;
          padding: 28px 24px 20px;
          text-align: center;
          animation: rtmPop 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        .rtm-close {
          position: absolute; top: 12px; right: 12px;
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: #f4f5f7; border: none; color: #888;
          cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .rtm-close:hover { background: #fff5f5; color: #ae050a; }
        .rtm-icon {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
          box-shadow: 0 6px 18px rgba(174,5,10,0.3);
        }
        .rtm-icon-success {
          background: linear-gradient(135deg, #1a9c4a 0%, #0f7a36 100%);
          box-shadow: 0 6px 18px rgba(26,156,74,0.3);
        }
        .rtm-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 17px; font-weight: 700; color: #16181d;
          margin: 0 0 8px;
        }
        .rtm-message {
          font-size: 13.5px; line-height: 1.6; color: #666;
          margin: 0 0 18px;
        }
        .rtm-stars {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          margin-bottom: 18px;
        }
        .rtm-star-btn {
          background: none; border: none; cursor: pointer; padding: 2px;
          display: flex; transition: transform 0.12s;
        }
        .rtm-star-btn:hover { transform: scale(1.12); }
        .rtm-textarea {
          width: 100%;
          border: 1px solid #e4e4e7;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13.5px; font-family: inherit;
          resize: vertical;
          color: #16181d;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
          margin-bottom: 18px;
        }
        .rtm-textarea:focus {
          outline: none;
          border-color: #ae050a;
          box-shadow: 0 0 0 3px rgba(174,5,10,0.1);
        }
        .rtm-actions {
          display: flex; gap: 10px;
        }
        .rtm-btn {
          flex: 1;
          padding: 11px 16px;
          border-radius: 10px;
          font-size: 13.5px; font-weight: 600;
          cursor: pointer;
          border: none;
          transition: background 0.15s, color 0.15s, box-shadow 0.15s, opacity 0.15s;
          font-family: inherit;
          display: flex; align-items: center; justify-content: center;
        }
        .rtm-btn-cancel {
          background: #f4f5f7; color: #333;
        }
        .rtm-btn-cancel:hover { background: #e9eaed; }
        .rtm-btn-confirm {
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(174,5,10,0.3);
        }
        .rtm-btn-confirm:hover { box-shadow: 0 6px 18px rgba(174,5,10,0.4); }
        .rtm-btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        .rtm-spinner {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: rtmSpin 0.6s linear infinite;
        }

        @keyframes rtmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rtmPop {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rtmSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>,
    document.body
  );
}
