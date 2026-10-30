import { Timestamp } from 'firebase/firestore';

export interface AppSettingsData {
  id: string;
  // 1. App & Brand Identity
  appNameHi: string;
  appNameEn: string;
  companyName: string;
  companyNameHi: string;
  companyNameEn: string;
  taglineHi: string;
  taglineEn: string;
  logoUrl: string;
  bannerImageUrl: string;
  primaryColor: string;
  accentColor: string;

  // 2. Company Address & Contact Details
  contactAddress: string;
  companyAddressHi: string;
  companyAddressEn: string;
  contactPhone: string;
  contactEmail: string;
  whatsappNumber: string;
  contactWhatsapp: string;

  // 3. Home Banner, Announcements & Offers
  bannerTitleHi: string;
  bannerTitleEn: string;
  bannerSubtitleHi: string;
  bannerSubtitleEn: string;
  offerBannerHi: string;
  offerBannerEn: string;
  specialOfferBannerHi: string;
  specialOfferBannerEn: string;
  announcementHi: string;
  announcementEn: string;

  // 4. Customer Portal Texts, Headings & Buttons (Hindi & English)
  catalogTitleHi: string;
  catalogTitleEn: string;
  catalogHeadingHi: string;
  catalogHeadingEn: string;
  catalogSubtitleHi: string;
  catalogSubtitleEn: string;
  catalogSubheadingHi: string;
  catalogSubheadingEn: string;
  addToCartBtnHi: string;
  addToCartBtnEn: string;
  orderNowBtnHi: string;
  orderNowBtnEn: string;
  orderBtnHi: string;
  orderBtnEn: string;
  emptyCatalogMsgHi: string;
  emptyCatalogMsgEn: string;
  emptyCatalogTitleHi: string;
  emptyCatalogTitleEn: string;
  emptyCatalogSubtitleHi: string;
  emptyCatalogSubtitleEn: string;

  // 5. Delivery Charges, Minimum Order & Service Area
  deliveryChargeInr: number;
  freeDeliveryMinInr: number;
  minOrderAmountInr: number;
  deliveryAreasHi: string;
  deliveryAreasEn: string;

  // 6. Order Availability, Payment Options & Store Status
  allowCod: boolean;
  allowUpi: boolean;
  upiId: string;
  storeOpen: boolean;
  storeClosedMsgHi: string;
  storeClosedMsgEn: string;
  storeClosedMessageHi: string;
  storeClosedMessageEn: string;

  // 7. Help Page, Contact Info & Customer Messages
  helpTitleHi: string;
  helpTitleEn: string;
  helpContentHi: string;
  helpContentEn: string;
  helpMessageHi: string;
  helpMessageEn: string;
  supportHoursHi: string;
  supportHoursEn: string;
  orderSuccessMsgHi: string;
  orderSuccessMsgEn: string;
  orderSuccessMessageHi: string;
  orderSuccessMessageEn: string;
  footerTextHi: string;
  footerTextEn: string;

  // 8. Admin Custom Weight Options (comma-separated grams, e.g. "" by default so nothing is pre-selected)
  customWeightsCsv: string;

  updatedBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export const DEFAULT_ADMIN_WHATSAPP_DIGITS = '7507505064';
export const DEFAULT_WHATSAPP_AUTO_MESSAGE =
  'Hello Chai Ros Admin, मुझे अपने ऑर्डर और प्रोडक्ट के बारे में जानकारी चाहिए।';

export function normalizeAdminWhatsappDigits(raw?: string): string {
  const digitsOnly = String(raw || '').replace(/\D/g, '');
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const ten = digitsOnly.slice(2);
    if (/^[6-9]\d{9}$/.test(ten)) return ten;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    const ten = digitsOnly.slice(1);
    if (/^[6-9]\d{9}$/.test(ten)) return ten;
  }
  if (/^[6-9]\d{9}$/.test(digitsOnly)) {
    return digitsOnly;
  }
  return DEFAULT_ADMIN_WHATSAPP_DIGITS;
}

export function formatAdminWhatsappDisplay(raw?: string): string {
  return `+91 ${normalizeAdminWhatsappDigits(raw)}`;
}

export function buildAdminWhatsappChatUrl(
  rawNumber?: string,
  customMessage: string = DEFAULT_WHATSAPP_AUTO_MESSAGE
): string {
  const digits10 = normalizeAdminWhatsappDigits(rawNumber);
  return `https://api.whatsapp.com/send?phone=91${digits10}&text=${encodeURIComponent(
    customMessage
  )}`;
}

export function normalizeBrandToChaiRos(val?: string): string {
  const trimmed = (val || '').trim();
  if (
    !trimmed ||
    /^chai\s*ro[jz]$/i.test(trimmed) ||
    trimmed === 'चाय रोज़' ||
    trimmed === 'चाय रोज'
  ) {
    return 'CHAI ROS';
  }
  return trimmed;
}

export const INITIAL_APP_SETTINGS: AppSettingsData = {
  id: 'app_config',
  appNameHi: 'CHAI ROS',
  appNameEn: 'CHAI ROS',
  companyName: 'CHAI ROS',
  companyNameHi: 'CHAI ROS',
  companyNameEn: 'CHAI ROS',
  taglineHi: 'आपकी चाय, आपके घर तक',
  taglineEn: 'Your Tea, Delivered to Your Doorstep',
  logoUrl: '',
  bannerImageUrl: '',
  primaryColor: '#0B6829',
  accentColor: '#B45309',

  contactAddress: '',
  companyAddressHi: '',
  companyAddressEn: '',
  contactPhone: '+91 7507505064',
  contactEmail: '',
  whatsappNumber: '7507505064',
  contactWhatsapp: '7507505064',

  bannerTitleHi: '',
  bannerTitleEn: '',
  bannerSubtitleHi: '',
  bannerSubtitleEn: '',
  offerBannerHi: '',
  offerBannerEn: '',
  specialOfferBannerHi: '',
  specialOfferBannerEn: '',
  announcementHi: '',
  announcementEn: '',

  catalogTitleHi: 'चाय प्रोडक्ट कैटलॉग',
  catalogTitleEn: 'Tea Product Catalogue',
  catalogHeadingHi: 'चाय प्रोडक्ट कैटलॉग',
  catalogHeadingEn: 'Tea Product Catalogue',
  catalogSubtitleHi: '',
  catalogSubtitleEn: '',
  catalogSubheadingHi: '',
  catalogSubheadingEn: '',
  addToCartBtnHi: 'कार्ट में जोड़ें',
  addToCartBtnEn: 'Add to Cart',
  orderNowBtnHi: 'ऑर्डर पक्का करें',
  orderNowBtnEn: 'Confirm Order',
  orderBtnHi: 'ऑर्डर पक्का करें',
  orderBtnEn: 'Confirm Order',
  emptyCatalogMsgHi: 'अभी कैटलॉग में कोई प्रोडक्ट उपलब्ध नहीं है।',
  emptyCatalogMsgEn: 'No products are currently available in the catalogue.',
  emptyCatalogTitleHi: 'अभी कैटलॉग में कोई प्रोडक्ट उपलब्ध नहीं है।',
  emptyCatalogTitleEn: 'No products are currently available in the catalogue.',
  emptyCatalogSubtitleHi: '',
  emptyCatalogSubtitleEn: '',

  deliveryChargeInr: 0,
  freeDeliveryMinInr: 0,
  minOrderAmountInr: 0,
  deliveryAreasHi: '',
  deliveryAreasEn: '',

  allowCod: true,
  allowUpi: true,
  upiId: '',
  storeOpen: true,
  storeClosedMsgHi: 'अभी ऑर्डर बुकिंग अस्थायी रूप से बंद है।',
  storeClosedMsgEn: 'Order booking is temporarily closed right now.',
  storeClosedMessageHi: 'अभी ऑर्डर बुकिंग अस्थायी रूप से बंद है।',
  storeClosedMessageEn: 'Order booking is temporarily closed right now.',

  helpTitleHi: 'सहायता एवं संपर्क जानकारी',
  helpTitleEn: 'Help & Contact Information',
  helpContentHi: '',
  helpContentEn: '',
  helpMessageHi: '',
  helpMessageEn: '',
  supportHoursHi: '',
  supportHoursEn: '',
  orderSuccessMsgHi: 'आपका ऑर्डर सफलतापूर्वक दर्ज हो गया है!',
  orderSuccessMsgEn: 'Your order has been placed successfully!',
  orderSuccessMessageHi: 'आपका ऑर्डर सफलतापूर्वक दर्ज हो गया है!',
  orderSuccessMessageEn: 'Your order has been placed successfully!',
  footerTextHi: 'आपकी चाय, आपके घर तक',
  footerTextEn: 'Your Tea, Delivered to Your Doorstep',

  customWeightsCsv: '',
};
