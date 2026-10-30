export interface TeaProductItem {
  id: string;
  nameHi: string;
  nameEn: string;
  companyName?: string;
  categoryHi: string;
  descriptionHi: string;
  originHi: string;
  tastingNotesHi?: string;
  offerTextHi?: string;
  weightGrams: number;
  weightLabel?: string;
  priceInr: number;
  stockCount?: number;
  photoUrl?: string;
  inStock: boolean;
  isPublished?: boolean;
  illustrationVariant?:
    | 'assam_kadak'
    | 'elaichi'
    | 'adrak_tulsi'
    | 'kesar_badam'
    | 'masala_cutting'
    | 'darjeeling_gold';
}

export function formatProductWeight(product: {
  weightLabel?: string;
  weightGrams?: number;
}): string {
  if (product.weightLabel && product.weightLabel.trim().length > 0) {
    return product.weightLabel.trim();
  }
  const grams = Number(product.weightGrams) || 0;
  if (grams >= 1000 && grams % 1000 === 0) {
    return `${grams / 1000} Kg`;
  }
  return `${grams}g`;
}

// No products are auto-populated; all products are 100% Admin-controlled.
export const INITIAL_GTC_PRODUCTS: TeaProductItem[] = [];
export const DEFAULT_TEA_CATALOG: TeaProductItem[] = [];
export const LEGACY_DEMO_PRODUCT_IDS: string[] = [];

