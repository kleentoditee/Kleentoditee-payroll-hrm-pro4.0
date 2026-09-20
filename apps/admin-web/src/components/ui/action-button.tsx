"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useRef, useState } from "react";

type ActionVariant = "primary" | "secondary" | "ghost" | "danger";
type ActionSize = "sm" | "md";

const baseClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-bold transition-colors motion-reduce:transition-none outline-none ring-[#006D77] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

const variantClass: Record<ActionVariant, string> = {
  primary: "bg-[#063E4A] text-white shadow-sm hover:bg-[#006D77] active:bg-[#052F38]",
  secondary: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 active:bg-slate-100",
  ghost: "text-[#063E4A] hover:bg-[#EAF6F7] active:bg-[#D9F0F2]",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800"
};

const sizeClass: Record<ActionSize, string> = {
  sm: "min-h-9 px-3 py-2 text-sm",
  md: "min-h-10 px-4 py-2 text-sm"
};

export function actionButtonClass(variant: ActionVariant = "primary", size: ActionSize = "md", className = "") {
  return [baseClass, variantClass[variant], sizeClass[size], className].filter(Boolean).join(" ");
}

export function ActionButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionVariant;
  size?: ActionSize;
}) {
  return <button className={actionButtonClass(variant, size, className)} {...props} />;
}

export function ActionLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children
}: {
  href: string;
  variant?: ActionVariant;
  size?: ActionSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={actionButtonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className={actionButtonClass("ghost", "sm", `h-9 w-9 px-0 ${className}`)}
      {...props}
    >
      {children}
    </button>
  );
}

export type SplitActionItem = {
  label: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
};

export function SplitActionButton({
  label,
  href,
  items,
  className = ""
}: {
  label: string;
  href: string;
  items: SplitActionItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative inline-flex max-w-full ${className}`}>
      <Link href={href} className={actionButtonClass("primary", "md", "rounded-r-none border-r border-white/20")}>
        {label}
      </Link>
      <button
        type="button"
        aria-label={`More ${label} actions`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={actionButtonClass("primary", "md", "rounded-l-none px-3")}
      >
        <span aria-hidden="true">v</span>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`${label} actions`}
          className="absolute right-0 top-full z-20 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
        >
          {items.map((item) =>
            item.href && !item.disabled ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                className="block px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
              >
                {item.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
