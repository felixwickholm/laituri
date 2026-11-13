/** Normalised answers from the wholesaler's price and availability systems. */
export interface UpstreamPrice {
  productId: string;
  found: boolean;
  net?: number;
  gross?: number;
  taxRate?: number;
  comparison?: { amount: number; per: "l" | "kg" };
  listNet?: number;
  contractPrice: boolean;
  validTo?: string;
}

export interface UpstreamAvailability {
  productId: string;
  deliverable: boolean;
  salesBlock: boolean;
  logisticModel?: "Stock" | "Terminal";
  /** Sales units available. Infinity when the wholesaler does not track a limit. */
  available: number;
  availableDate?: string;
  orderBy?: string;
  salesUnit?: string;
}

export interface UpstreamClient {
  price(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamPrice>>;
  availability(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamAvailability>>;
}
