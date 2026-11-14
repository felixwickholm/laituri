/** Wire shapes of the wholesaler's price and availability endpoints, as received. */

export interface RawPriceValue {
  value: number;
  valueWithTax?: number;
  validFrom?: string;
  validTo?: string;
  currency?: string;
}

export interface RawProductPrice {
  productId: string;
  quantity?: number;
  catalogPrice?: RawPriceValue | null;
  priceWithTax?: RawPriceValue | null;
  comparisonPrice?: RawPriceValue | null;
  comparisonUnit?: string | null;
  tax?: { taxRate: number; taxValue: number } | null;
  listPrice?: RawPriceValue | null;
  netPriceFound: boolean;
  error: boolean;
}

export interface RawScheduleLine {
  salesBlock: boolean;
  availableAmount: number;
  availableDate?: string | null;
  salesUnit: string;
}

export interface RawProductAvailability {
  productId: string;
  closingTime?: string | null;
  salesBlock: boolean;
  logisticModel?: string | null;
  scheduleLines: RawScheduleLine[];
}

export interface RawPriceResponse {
  products: RawProductPrice[];
}

export interface RawAvailabilityResponse {
  timeNow?: string;
  products: RawProductAvailability[];
}

/** What the live API answers for a product code it does not know. */
export function unknownPrice(productId: string): RawProductPrice {
  return { productId, quantity: 1, netPriceFound: false, error: true };
}

export function unknownAvailability(productId: string): RawProductAvailability {
  return { productId, salesBlock: false, scheduleLines: [] };
}
