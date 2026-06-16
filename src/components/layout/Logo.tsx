// src/components/layout/Logo.tsx
// Text-based "DRIVE TR" wordmark — replaces the old logo.png raster image.

import React from 'react';

interface Props {
  className?: string;
  size?: number; // controls font-size in px; badge scales with it
  color?: string; // color of the "DRIVE" text — defaults to dark
}

export default function Logo({ className = '', size = 18, color = '#0f172a' }: Props) {
  return (
    <span className={`logo-mark ${className}`} style={{ fontSize: size }}>
      <span className="logo-drive" style={{ color }}>DRIVE</span>
      <span className="logo-tr">TR</span>
      <style jsx>{`
        .logo-mark {
          display: inline-flex;
          align-items: center;
          gap: 0.18em;
          font-family: 'Montserrat', sans-serif;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
        }
        .logo-drive {
          letter-spacing: 0.02em;
        }
        .logo-tr {
          background: #ae050a;
          color: #fff;
          padding: 0.22em 0.32em;
          border-radius: 0.18em;
          letter-spacing: 0.02em;
        }
      `}</style>
    </span>
  );
}
