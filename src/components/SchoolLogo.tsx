'use client';

import React from 'react';

export type SchoolLogoSize = 'xs' | 'sm' | 'md' | 'lg';

const PIXELS: Record<SchoolLogoSize, number> = { xs: 20, sm: 28, md: 40, lg: 56 };

export interface SchoolLogoProps {
  code: string;
  name: string;
  logoUrl?: string | null;
  size?: SchoolLogoSize;
  className?: string;
}

/**
 * A school's crest, on a white tile.
 *
 * Fifteen crests arrive in fifteen colour schemes, so they get one consistent
 * stage: a white tile with the platform's asymmetric corner. That is what makes
 * a column of logos read as a set instead of a patchwork. Until a crest is
 * uploaded the tile stands in the same place carrying the school code, so
 * nothing shifts when a crest finally lands.
 */
export function SchoolLogo({ code, name, logoUrl, size = 'md', className = '' }: SchoolLogoProps) {
  const px = PIXELS[size];
  const radius = px >= 56 ? '14px 14px 14px 3px' : px >= 40 ? '10px 10px 10px 2px' : '7px 7px 7px 2px';

  if (logoUrl) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-[inset_0_0_0_1px_rgba(11,44,77,0.12)] ${className}`}
        style={{ width: px, height: px, borderRadius: radius }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`${name} crest`}
          className="h-full w-full object-contain"
          style={{ padding: Math.round(px * 0.12) }}
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap bg-white font-bold leading-none text-[#005FA3] shadow-[inset_0_0_0_1px_rgba(11,44,77,0.12)] ${className}`}
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        fontSize: px >= 56 ? 12 : px >= 40 ? 10 : Math.round(px * 0.34),
      }}
      aria-label={name}
      title={`${name} crest not uploaded yet`}
    >
      {/* At 20–28px the full code is illegible; the number still reads. */}
      {px <= 28 ? code.replace(/[^0-9]/g, '') || code : code}
    </span>
  );
}
