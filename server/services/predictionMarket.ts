/**
 * CPMM-style price impact for demo prediction markets (not on-chain).
 * Prices stay on a 0–100¢ scale and sum to ~100.
 */

export function clampCents(value: number): number {
  const n = Math.round(value * 100) / 100;
  return Math.max(1, Math.min(99, n));
}

export function parseCents(raw: string | null | undefined, fallback = 50): number {
  const n = parseFloat(raw ?? String(fallback));
  if (Number.isNaN(n)) return fallback;
  return clampCents(n);
}

export function applyBuyImpact(
  yesCents: number,
  outcome: "yes" | "no",
  usdAmount: number
): { yes: number; no: number } {
  const yes = clampCents(yesCents);
  const no = 100 - yes;
  const delta = Math.min(8, Math.max(0.05, usdAmount / 120));
  if (outcome === "yes") {
    const nYes = clampCents(yes + delta);
    return { yes: nYes, no: clampCents(100 - nYes) };
  }
  const nNo = clampCents(no + delta);
  return { yes: clampCents(100 - nNo), no: nNo };
}

export function applySellImpact(
  yesCents: number,
  outcome: "yes" | "no",
  usdNotional: number
): { yes: number; no: number } {
  const yes = clampCents(yesCents);
  const no = 100 - yes;
  const delta = Math.min(8, Math.max(0.05, usdNotional / 120));
  if (outcome === "yes") {
    const nYes = clampCents(yes - delta);
    return { yes: nYes, no: clampCents(100 - nYes) };
  }
  const nNo = clampCents(no - delta);
  return { yes: clampCents(100 - nNo), no: nNo };
}

/** USDC spent → outcome shares at price in cents. */
export function sharesFromBuyUsd(usd: number, priceCents: number): number {
  const p = priceCents / 100;
  if (p <= 0) return 0;
  return usd / p;
}

export function proceedsFromSellShares(
  shares: number,
  priceCents: number
): number {
  return shares * (priceCents / 100);
}

/** Escape % and _ for safe LIKE patterns (basic hardening). */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_\\]/g, "").trim();
}
