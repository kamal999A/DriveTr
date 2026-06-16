'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ open, title, message, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  if (!open) return null;

  return createPortal(
    <div className="cm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="cm-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="cm-icon"><AlertTriangle size={22} strokeWidth={2} /></div>
        <h3 className="cm-title">{title}</h3>
        <p className="cm-message">{message}</p>
        <div className="cm-actions">
          <button className="cm-btn cm-btn-cancel" onClick={onCancel}>{t.car.cancel}</button>
          <button className="cm-btn cm-btn-confirm" onClick={onConfirm}>{t.car.delete}</button>
        </div>
      </div>

      <style jsx>{`
        .cm-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(15, 23, 42, 0.45);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: cmFade 0.15s ease;
        }
        .cm-modal {
          background: #fff;
          border-radius: 16px;
          border: 1px solid rgba(174,5,10,0.12);
          box-shadow: 0 20px 60px rgba(15,23,42,0.25);
          width: 100%; max-width: 380px;
          padding: 28px 24px 20px;
          text-align: center;
          animation: cmPop 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        .cm-icon {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
          box-shadow: 0 6px 18px rgba(174,5,10,0.3);
        }
        .cm-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 17px; font-weight: 700; color: #16181d;
          margin: 0 0 8px;
        }
        .cm-message {
          font-size: 13.5px; line-height: 1.6; color: #666;
          margin: 0 0 22px;
        }
        .cm-actions {
          display: flex; gap: 10px;
        }
        .cm-btn {
          flex: 1;
          padding: 11px 16px;
          border-radius: 10px;
          font-size: 13.5px; font-weight: 600;
          cursor: pointer;
          border: none;
          transition: background 0.15s, color 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        .cm-btn-cancel {
          background: #f4f5f7; color: #333;
        }
        .cm-btn-cancel:hover { background: #e9eaed; }
        .cm-btn-confirm {
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(174,5,10,0.3);
        }
        .cm-btn-confirm:hover { box-shadow: 0 6px 18px rgba(174,5,10,0.4); }

        @keyframes cmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmPop {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}
