/** The parts of the wholesaler's product download that the slim index uses. */

export interface RawText {
  value: string;
  language: string;
}

export interface RawMeasure {
  unit: string;
  value: number;
}

export interface RawUnitConversion {
  synkkaPackagingType?: string;
  volume?: RawMeasure;
  netWeight?: RawMeasure;
}

export interface RawClassification {
  type: string;
  name: string;
  values: { id: string; unit?: string; synkkaId?: string }[];
}

export interface RawProduct {
  id: string;
  salesUnitGtin?: string;
  salesUnit: string;
  baseUnit: string;
  category: string;
  allowedLotSize?: number;
  deleted?: boolean;
  temperatureCondition?: number;
  vendorName: string;
  countryOfOrigin?: string;
  units: { unitId: string; gtin?: string; sizeInBaseUnits: number }[];
  substitutions?: { product: string; substituteProduct: string }[];
  synkkaData: {
    gtin?: string;
    brand?: string;
    names: RawText[];
    classifications: RawClassification[];
    unitConversions?: RawUnitConversion[];
  };
}

export function classificationIds(raw: RawProduct, name: string): { id: string; unit?: string }[] {
  return raw.synkkaData.classifications.find((c) => c.name === name)?.values ?? [];
}

export function rawName(raw: RawProduct, language: string): string | undefined {
  return raw.synkkaData.names.find((n) => n.language === language)?.value?.trim() || undefined;
}
