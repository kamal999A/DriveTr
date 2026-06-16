'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Ban } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BlockedModal({ open, onClose }: Props) {
  const { t } = useI18n();
  if (!open) return null;

  return createPortal(
    <div className="bm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bm-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="bm-icon"><Ban size={22} strokeWidth={2} /></div>
        <h3 className="bm-title">{t.auth.blockedTitle}</h3>
        <p className="bm-message">{t.auth.blockedMessage}</p>
        <div className="bm-actions">
          <Link href="/contact" className="bm-btn bm-btn-contact" onClick={onClose}>
            {t.auth.blockedButton}
          </Link>
        </div>
      </div>

      <style jsx>{`
        .bm-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(15, 23, 42, 0.45);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: bmFade 0.15s ease;
        }
        .bm-modal {
          background: #fff;
          border-radius: 16px;
          border: 1px solid rgba(174,5,10,0.12);
          box-shadow: 0 20px 60px rgba(15,23,42,0.25);
          width: 100%; max-width: 380px;
          padding: 28px 24px 20px;
          text-align: center;
          animation: bmPop 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        .bm-icon {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
          box-shadow: 0 6px 18px rgba(174,5,10,0.3);
        }
        .bm-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 17px; font-weight: 700; color: #16181d;
          margin: 0 0 8px;
        }
        .bm-message {
          font-size: 13.5px; line-height: 1.6; color: #666;
          margin: 0 0 22px;
        }
        .bm-actions {
          display: flex; gap: 10px;
        }
        .bm-btn {
          flex: 1;
          padding: 11px 16px;
          border-radius: 10px;
          font-size: 13.5px; font-weight: 600;
          cursor: pointer;
          border: none;
          text-decoration: none;
          display: flex; align-items: center; justify-content: center;
          text-align: center;
          transition: background 0.15s, color 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        .bm-actions :global(a.bm-btn) {
          display: flex; align-items: center; justify-content: center;
          width: 100%;
        }
        .bm-btn-contact {
          background: linear-gradient(135deg, #ae050a 0%, #7f0206 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(174,5,10,0.3);
        }
        .bm-btn-contact:hover { box-shadow: 0 6px 18px rgba(174,5,10,0.4); }

        @keyframes bmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bmPop {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}
