"use client";

import { authenticatedFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type Props = {
  employeeId: string;
  hasPhoto: boolean;
  name: string;
  sizeClassName?: string;
  profilePhotoViewUrl: string;
};

function initials(n: string): string {
  const p = n.trim().split(/\s+/);
  if (p.length === 0) {
    return "?";
  }
  if (p.length === 1) {
    return p[0].slice(0, 2).toUpperCase();
  }
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * Fetches the profile image with the admin JWT. Falls back to initials when missing or on error.
 */
export function EmployeeAvatar({ employeeId, hasPhoto, name, sizeClassName, profilePhotoViewUrl }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto) {
      setSrc(null);
      return;
    }
    let alive = true;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const res = await authenticatedFetch(profilePhotoViewUrl);
        if (!res.ok || !alive) {
          return;
        }
        const b = await res.blob();
        if (!alive) {
          return;
        }
        objectUrl = URL.createObjectURL(b);
        setSrc(objectUrl);
      } catch {
        setSrc(null);
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [employeeId, hasPhoto, profilePhotoViewUrl]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200/90 bg-slate-100 text-sm font-bold text-slate-600 ${
        sizeClassName ?? "h-12 w-12"
      }`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: URL from authed fetch; not a static asset
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="select-none">{initials(name)}</span>
      )}
    </div>
  );
}
