'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, CheckCircle, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export default function ReportModal({ open, onClose, onSubmit }: Props) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const close = () => {
    onClose();
    setReason('');
    setSent(false);
  };

  const handleSubmit = async () => {
    if (!reason.trim() || sending) return;
    setSending(true);
    await onSubmit(reason.trim());
    setSending(false);
    setSent(true);
    setReason('');
  };

  return createPortal(
    <div className="rm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="rm-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="rm-close" onClick={close}><X size={18} /></button>

        {sent ? (
          <>
            <div className="rm-icon rm-icon-success"><CheckCircle size={22} strokeWidth={2} /></div>
            <h3 className="rm-title">{t.car.reportSentTitle}</h3>
            <p className="rm-message">{t.car.reportSentBody}</p>
            <div className="rm-actions">
              <button className="rm-btn rm-btn-confirm" onClick={close}>{t.car.close}</button>
            </div>
          </>
        ) : (
          <>
            <div className="rm-icon"><Flag size={20} strokeWidth={2} /></div>
            <h3 className="rm-title">{t.car.reportListing}</h3>
            <p className="rm-message">{t.car.reportPrompt}</p>
            <textarea
              className="rm-textarea"
              placeholder={t.car.describeIssue}
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="rm-actions">
              <button className="rm-btn rm-btn-cancel" onClick={close}>{t.car.cancel}</button>
              <button
                className="rm-btn rm-btn-confirm"
                onClick={handleSubmit}
                disabled={!reason.trim() || sending}
              >
                {sending ? <span className="rm-spinner" /> : t.car.submit}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .rm-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(15, 23, 42, 0.45);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: rmFade 0.15s ease;
        }
        .rm-modal {
          position: relative;
          background: #fff;
          border-radius: 16px;
          border: 1px solid rgba(174,5,10,0.12);
          box-shadow: 0 20px 60px rgba(15,23,42,0.25);
          width: 100%; max-width: 400px;
          padding: 28px 24px 20px;
          text-align: center;
          animation: rmPop 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        .rm-close {
          position: absolute; top: 12px; right: 12px;
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: #f4f5f7; border: none; color: #888;
          cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .rm-close:hover { background: #fff5f5; color: #ae050a; }
        .rm-icon {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
          box-shadow: 0 6px 18px rgba(174,5,10,0.3);
        }
        .rm-icon-success {
          background: linear-gradient(135deg, #1a9c4a 0%, #0f7a36 100%);
          box-shadow: 0 6px 18px rgba(26,156,74,0.3);
        }
        .rm-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 17px; font-weight: 700; color: #16181d;
          margin: 0 0 8px;
        }
        .rm-message {
          font-size: 13.5px; line-height: 1.6; color: #666;
          margin: 0 0 16px;
        }
        .rm-textarea {
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
        .rm-textarea:focus {
          outline: none;
          border-color: #ae050a;
          box-shadow: 0 0 0 3px rgba(174,5,10,0.1);
        }
        .rm-actions {
          display: flex; gap: 10px;
        }
        .rm-btn {
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
        .rm-btn-cancel {
          background: #f4f5f7; color: #333;
        }
        .rm-btn-cancel:hover { background: #e9eaed; }
        .rm-btn-confirm {
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(174,5,10,0.3);
        }
        .rm-btn-confirm:hover { box-shadow: 0 6px 18px rgba(174,5,10,0.4); }
        .rm-btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        .rm-spinner {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: rmSpin 0.6s linear infinite;
        }

        @keyframes rmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rmPop {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rmSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>,
    document.body
  );
}
