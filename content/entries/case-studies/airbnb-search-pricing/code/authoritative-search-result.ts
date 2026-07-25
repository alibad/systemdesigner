type ListingId = string;

interface RankedCandidate {
  listingId: ListingId;
  score: number;
  estimatedNightlyPrice: number;
  featureTimestampMs: number;
}

interface InventoryDecision {
  listingId: ListingId;
  sellable: boolean;
  inventoryVersion: number;
}

interface PriceQuote {
  listingId: ListingId;
  total: number;
  currency: string;
  quoteVersion: string;
  expiresAtMs: number;
}

interface SearchResult {
  listingId: ListingId;
  rankScore: number;
  total: number;
  currency: string;
  quoteVersion: string;
  inventoryVersion: number;
}

export function assembleSearchResult(
  candidate: RankedCandidate,
  inventory: InventoryDecision,
  quote: PriceQuote,
  nowMs: number,
): SearchResult | null {
  if (candidate.listingId !== inventory.listingId || candidate.listingId !== quote.listingId) {
    throw new Error('Mismatched listing identities');
  }

  if (!inventory.sellable || quote.expiresAtMs <= nowMs) {
    return null;
  }

  // Ranking estimates influence order; only the current quote crosses the UI boundary.
  return {
    listingId: candidate.listingId,
    rankScore: candidate.score,
    total: quote.total,
    currency: quote.currency,
    quoteVersion: quote.quoteVersion,
    inventoryVersion: inventory.inventoryVersion,
  };
}
