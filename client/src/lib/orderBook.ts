/**
 * Synthetic order book for UI (not a real CLOB).
 * Spreads around the current mid derived from Yes price in cents.
 */

export type OrderRow = { price: number; size: number; total: number };

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildSyntheticOrderBook(
  yesCents: number,
  depth = 8
): { bids: OrderRow[]; asks: OrderRow[] } {
  const mid = Math.max(1, Math.min(99, yesCents));
  const spread = 0.5;
  const bids: OrderRow[] = [];
  const asks: OrderRow[] = [];
  let bidTot = 0;
  let askTot = 0;
  for (let i = 0; i < depth; i++) {
    const bidPx = roundCents(mid - spread - i * 0.4);
    const askPx = roundCents(mid + spread + i * 0.4);
    const sz = Math.round((4200 + i * 800 + (mid % 7) * 100) / 100) * 100;
    bidTot += sz;
    askTot += sz;
    if (bidPx >= 1) bids.push({ price: bidPx, size: sz, total: bidTot });
    if (askPx <= 99) asks.push({ price: askPx, size: sz, total: askTot });
  }
  return { bids, asks };
}
