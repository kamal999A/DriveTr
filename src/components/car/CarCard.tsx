'use client';
// src/components/car/CarCard.tsx

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, MapPin, Gauge, Calendar, Fuel, Images, MoreVertical, EyeOff, Eye, Tag, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase/client';
import ConfirmModal from '@/components/layout/ConfirmModal';
import type { CarListing, ListingStatus } from '@/types';

interface Props {
  listing: CarListing;
  saved?: boolean;
  onSaveToggle?: (id: string, saved: boolean) => void;
  showOwnerActions?: boolean;
  onStatusChange?: (id: string, status: ListingStatus) => void;
}

export default function CarCard({ listing, saved = false, onSaveToggle, showOwnerActions = false, onStatusChange }: Props) {
  const { formatPrice, t } = useI18n();
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const supabase = createClient();

  const photo = listing.photos?.[0] || '/placeholder-car.jpg';
  const hasDamage = listing.damage_parts?.length > 0;
  const photoCount = listing.photos?.length || 0;

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { window.location.href = '/auth/login'; return; }
    if (saving) return;
    setSaving(true);
    if (isSaved) {
      const { error } = await supabase.from('saved_cars').delete()
        .eq('user_id', user.id).eq('listing_id', listing.id);
      if (!error) {
        setIsSaved(false);
        onSaveToggle?.(listing.id, false);
      }
    } else {
      const { error } = await supabase.from('saved_cars').insert({ user_id: user.id, listing_id: listing.id });
      // 23505 = already saved (e.g. double-click race) — treat as success
      if (!error || error.code === '23505') {
        setIsSaved(true);
        onSaveToggle?.(listing.id, true);
      }
    }
    setSaving(false);
  };

  const handleStatusChange = async (e: React.MouseEvent, status: ListingStatus) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || updating) return;
    setUpdating(true);
    const { error } = await supabase.from('car_listings')
      .update({ status })
      .eq('id', listing.id)
      .eq('user_id', user.id);
    setUpdating(false);
    setMenuOpen(false);
    if (!error) onStatusChange?.(listing.id, status);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    if (!user || updating) return;
    setUpdating(true);
    const { error } = await supabase.from('car_listings')
      .update({ status: 'deleted' })
      .eq('id', listing.id)
      .eq('user_id', user.id);
    setUpdating(false);
    if (!error) onStatusChange?.(listing.id, 'deleted');
  };

  return (
    <>
    <Link href={`/cars/${listing.id}`} className="car-card">
      <div className="card-img-wrap">
        <Image
          src={photo}
          alt={`${listing.make} ${listing.model}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="card-img"
          loading="lazy"
        />

        {/* Gradient overlay for readability of overlapping elements */}
        <div className="img-gradient" />

        {/* Top row badges */}
        <div className="card-top-row">
          {hasDamage && (
            <span className="badge-damage">⚠ {t.car.damaged}</span>
          )}
        </div>

        {/* Owner actions */}
        {showOwnerActions && (
          <div className="owner-menu">
            <button
              className="owner-menu-btn"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v); }}
              aria-label={t.profile.manageListing}
              disabled={updating}
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
              <>
              <div
                className="owner-menu-overlay"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); }}
              />
              <div className="owner-menu-dropdown" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                {listing.status === 'active' ? (
                  <button onClick={(e) => handleStatusChange(e, 'inactive')}>
                    <EyeOff size={13} /> {t.profile.markInactive}
                  </button>
                ) : (
                  <button onClick={(e) => handleStatusChange(e, 'active')}>
                    <Eye size={13} /> {t.profile.markActive}
                  </button>
                )}
                {listing.status !== 'sold' && (
                  <button onClick={(e) => handleStatusChange(e, 'sold')}>
                    <Tag size={13} /> {t.profile.markSold}
                  </button>
                )}
                <button
                  className="danger"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); setShowDeleteConfirm(true); }}
                >
                  <Trash2 size={13} /> {t.profile.deleteListing}
                </button>
              </div>
              </>
            )}
          </div>
        )}

        {/* Bottom row */}
        <div className="card-bottom-row">
          {photoCount > 0 && (
            <span className="badge-photos">
              <Images size={10} /> {photoCount}
            </span>
          )}
        </div>

        {/* Save button */}
        <button
          className={`save-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
          aria-label={isSaved ? t.car.saved : t.car.save}
        >
          <Heart size={15} fill={isSaved ? '#fff' : 'none'} stroke="#fff" strokeWidth={2} />
        </button>
      </div>

      <div className="card-body">
        <div className="card-make">{listing.make}</div>
        <h3 className="card-title">{listing.make} {listing.model}</h3>
        <div className="card-price">
          {formatPrice(listing.price, listing.currency)}
        </div>

        <div className="card-specs">
          <span className="spec">
            <Calendar size={11} />
            {listing.year}
          </span>
          <span className="spec-dot">·</span>
          <span className="spec">
            <Gauge size={11} />
            {listing.mileage.toLocaleString()} km
          </span>
          <span className="spec-dot">·</span>
          <span className="spec">
            <Fuel size={11} />
            {listing.fuel_type}
          </span>
        </div>

        <div className="card-location">
          <MapPin size={11} />
          {listing.city}
        </div>
      </div>

      <style jsx>{`
        .car-card {
          display: flex; flex-direction: column;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 8px rgba(0,0,0,0.04);
          transition: all 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          text-decoration: none; color: inherit;
          border: 1px solid #f0f0f0;
          position: relative;
        }
        .car-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08);
          transform: translateY(-3px);
          border-color: #e0e0e0;
        }

        /* Image */
        .card-img-wrap {
          position: relative;
          aspect-ratio: 16/10;
          overflow: hidden;
          background: #f2f2f2;
        }
        .card-img {
          width: 100%; height: 100%;
          object-fit: contain;
        }
        .img-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,0.0) 40%,
            rgba(0,0,0,0.35) 100%
          );
        }

        /* Overlays */
        .card-top-row {
          position: absolute; top: 9px; left: 9px;
          display: flex; gap: 5px; align-items: center;
        }
        .card-bottom-row {
          position: absolute; bottom: 9px; left: 9px;
          display: flex; gap: 5px; align-items: center;
        }
        .badge-damage {
          background: rgba(174,5,10,0.88);
          backdrop-filter: blur(4px);
          color: #fff; font-size: 10px; font-weight: 700;
          padding: 3px 8px; border-radius: 5px;
          letter-spacing: 0.3px;
        }
        .badge-photos {
          display: flex; align-items: center; gap: 4px;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          color: rgba(255,255,255,0.9);
          font-size: 10px; font-weight: 600;
          padding: 3px 8px; border-radius: 5px;
        }
        /* Owner actions menu */
        .owner-menu {
          position: absolute; top: 9px; left: 9px;
          z-index: 2;
        }
        .owner-menu-btn {
          width: 28px; height: 28px;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          border: none; border-radius: 50%;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.18s ease;
        }
        .owner-menu-btn:hover { background: rgba(0,0,0,0.65); }
        .owner-menu-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .owner-menu-overlay {
          position: fixed; inset: 0; z-index: 3; cursor: default;
        }
        .owner-menu-dropdown {
          z-index: 4;
          position: absolute; top: 34px; left: 0;
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
          border: 1px solid #f0f0f0;
          overflow: hidden;
          min-width: 170px;
          display: flex; flex-direction: column;
        }
        .owner-menu-dropdown button {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 9px 12px;
          background: none; border: none;
          font-size: 12.5px; font-weight: 600; color: #334155;
          text-align: left; cursor: pointer;
          transition: background 0.12s;
          font-family: 'Inter', sans-serif;
        }
        .owner-menu-dropdown button:hover { background: #f8fafc; }
        .owner-menu-dropdown button.danger { color: #ae050a; }
        .owner-menu-dropdown button.danger:hover { background: #fef2f2; }

        .save-btn {
          position: absolute; top: 9px; right: 9px;
          width: 32px; height: 32px;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          border: none; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .save-btn:hover { background: rgba(174,5,10,0.75); transform: scale(1.12); }
        .save-btn:active { transform: scale(0.92); }
        .save-btn.saved {
          background: rgba(174,5,10,0.85);
          animation: heartPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes heartPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.3); }
          100% { transform: scale(1); }
        }

        /* Body */
        .card-body { padding: 14px 14px 16px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .card-make {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 1px; color: #ae050a;
        }
        .card-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 14px; font-weight: 700; color: #1a1a1a;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 2px;
        }
        .card-price {
          font-family: 'Montserrat', sans-serif;
          font-size: 17px; font-weight: 800; color: #ae050a;
          margin-bottom: 8px;
        }
        .card-specs {
          display: flex; align-items: center; gap: 5px;
          flex-wrap: wrap; margin-bottom: 6px;
        }
        .spec {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 11px; color: #666; font-weight: 500;
        }
        .spec-dot { color: #ddd; font-size: 12px; }
        .card-location {
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; color: #999; font-weight: 500;
          margin-top: auto;
        }
      `}</style>
    </Link>

    <ConfirmModal
      open={showDeleteConfirm}
      title={t.profile.deleteListing}
      message={t.profile.deleteConfirm}
      onConfirm={confirmDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </>
  );
}
