"use client";

import { FinanceBreadcrumbs, type BreadcrumbItem } from "@/components/finance/breadcrumbs";
import { getActiveFinanceItem, getFinanceBreadcrumbs } from "@/lib/finance-nav";
import { usePathname } from "next/navigation";

/**
 * Page-specific breadcrumb trail for finance detail and creation pages, e.g.
 * Finance / Sales / Invoices / INV-1004 or Finance / Purchases / Bills / New bill.
 *
 * The base trail (Finance / Section / Item) is derived from the pathname, so it
 * renders immediately while the record loads; the record segment is appended
 * once `recordLabel` is known. The list crumb becomes a link because it is no
 * longer the current page.
 */
export function FinanceRecordBreadcrumbs({ recordLabel }: { recordLabel?: string | null }) {
  const pathname = usePathname();
  const base = getFinanceBreadcrumbs(pathname);
  const item = getActiveFinanceItem(pathname);
  const items: BreadcrumbItem[] = base.map((crumb, index) =>
    index === base.length - 1 && !crumb.href && item ? { ...crumb, href: item.href } : crumb
  );
  const label = recordLabel?.trim();
  if (label) {
    items.push({ label });
  }
  return <FinanceBreadcrumbs items={items} />;
}
