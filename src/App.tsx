import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  updateProfile,
  signOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  ShoppingBag,
  LogOut,
  Mail,
  Lock,
  User as UserIcon,
  UserPlus,
  MapPin,
  Package,
  Plus,
  Minus,
  Trash2,
  ShieldAlert,
  BookOpen,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Info,
  KeyRound,
  Edit3,
  Scale,
  IndianRupee,
  Sparkles,
  Globe,
  ImagePlus,
  Phone,
  RefreshCw,
  X,
  Calendar,
  Clock,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  OperationType,
  handleFirestoreError,
  translateFirebaseAuthError,
  verifyFirestoreConnection,
  ADMIN_EMAIL,
  isAuthorizedAdminEmail,
} from './firebase';
import {
  TeaProductItem,
  formatProductWeight,
} from './data/teaCatalog';
import {
  AppSettingsData,
  INITIAL_APP_SETTINGS,
  normalizeBrandToChaiRos,
  normalizeAdminWhatsappDigits,
  formatAdminWhatsappDisplay,
  buildAdminWhatsappChatUrl,
} from './data/appSettings';
import { TeaIllustration } from './components/TeaIllustration';
import { SetupGuideModal } from './components/SetupGuideModal';
import { AdminAppSettingsPanel } from './components/AdminAppSettingsPanel';
import {
  ChaiRozHeaderLogo,
  TeaGardenBackdrop,
} from './components/ChaiRozBrandArtwork';

interface CustomerProfileData {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: 'customer' | 'admin';
  authMethod: 'email_password' | 'google' | 'mobile_password' | 'phone_otp';
  defaultAddress?: string;
  defaultPinCode?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracyMeters?: number;
  gpsSavedAt?: Timestamp | null;
  adminNoteHi?: string;
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface TeaOrderRecord {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  itemsSummary: string;
  totalItemsCount: number;
  totalAmountInr: number;
  deliveryAddress: string;
  pinCode: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAddress?: string;
  paymentMethod: 'COD' | 'UPI';
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  adminNoteHi?: string;
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
  whatsappNotificationStatus?: 'pending' | 'sending' | 'sent' | 'failed' | 'not_configured';
  whatsappNotificationError?: string;
  whatsappMessageId?: string;
  whatsappNotifiedAt?: Timestamp | null;
  customerWhatsappStatus?: 'pending' | 'sending' | 'sent' | 'failed' | 'not_configured';
  customerWhatsappError?: string;
  customerWhatsappMessageId?: string;
  customerWhatsappLastEvent?: string;
  deliveredAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

interface GpsMapViewConfig {
  titleHi: string;
  titleEn: string;
  customerName: string;
  mobileNumber?: string;
  customerPhone?: string;
  address: string;
  pinCode?: string;
  lat: number;
  lng: number;
  orderId?: string;
}

interface AdminConfirmModalConfig {
  titleHi: string;
  titleEn: string;
  messageHi: string;
  messageEn: string;
  confirmLabelHi: string;
  confirmLabelEn: string;
  onConfirm: () => Promise<void> | void;
}

interface OrderWhatsappDispatchModalConfig {
  orderId: string;
  shortOrderId: string;
  customerName: string;
  customerPhoneDisplay: string;
  adminPhoneDisplay: string;
  totalAmountInr: number;
  orderStatus: TeaOrderRecord['status'];
  eventType: 'order_placed' | 'status_updated' | 'admin_new_order_alert';
  adminWhatsappUrl: string;
  customerWhatsappUrl: string;
  adminMessagePreview: string;
  customerMessagePreview: string;
  autoOpenedTarget: 'admin' | 'customer';
}

interface CartItem {
  product: TeaProductItem;
  quantity: number;
}

type AppLanguage = 'hi' | 'en';
type TopLoginRoleTab = 'customer' | 'admin';
type CustomerAuthView = 'login' | 'register' | 'forgot_password';
type ActiveSection = 'catalog' | 'my_orders' | 'admin';
type AdminDashboardTab = 'products' | 'new_orders' | 'complete_orders' | 'customers' | 'backup';

interface ParsedOrderItem {
  productName: string;
  companyName: string;
  weight: string;
  priceDisplay: string;
  quantity: string;
}

const STATUS_LABELS_HI: Record<TeaOrderRecord['status'], string> = {
  pending: 'Pending (प्रतीक्षारत)',
  confirmed: 'Confirmed (कन्फ़र्म)',
  shipped: 'Shipped (रवाना)',
  delivered: 'Complete (पूरा हुआ)',
  cancelled: 'Cancelled (रद्द)',
};

const STATUS_LABELS_EN: Record<TeaOrderRecord['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Complete',
  cancelled: 'Cancelled',
};

function splitProductAndCompanyName(rawTitle: string): {
  productName: string;
  companyName: string;
} {
  const cleaned = (rawTitle || '').trim();
  const dashIdx = cleaned.lastIndexOf(' - ');
  if (dashIdx > 0) {
    const pName = cleaned.slice(0, dashIdx).trim();
    const cName = cleaned.slice(dashIdx + 3).trim();
    return {
      productName: pName || cleaned,
      companyName: cName || 'CHAI ROS',
    };
  }
  return {
    productName: cleaned || 'Chai Product',
    companyName: 'CHAI ROS',
  };
}

// Helper: Parse itemsSummary into structured items with Product Name, Company, Weight, Price, and Quantity
function parseOrderItemsSummary(
  itemsSummary: string,
  fallbackTotalCount: number,
  fallbackTotalAmountInr: number
): ParsedOrderItem[] {
  const rawSummary = (itemsSummary || '').trim();
  if (!rawSummary) {
    return [
      {
        productName: 'Chai Product',
        companyName: 'CHAI ROS',
        weight: '—',
        priceDisplay: `₹${fallbackTotalAmountInr}`,
        quantity: String(fallbackTotalCount || 1),
      },
    ];
  }

  const segments = rawSummary
    .split(/\s*,\s*(?=[^)]*(?:\(|$))/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    const split = splitProductAndCompanyName(rawSummary);
    return [
      {
        productName: split.productName,
        companyName: split.companyName,
        weight: '—',
        priceDisplay: `₹${fallbackTotalAmountInr}`,
        quantity: String(fallbackTotalCount || 1),
      },
    ];
  }

  return segments.map((seg) => {
    // Format 1: "Product Name - Company (250g | ₹120 × 2)"
    const detailedMatch = seg.match(
      /^(.*?)\s*\(([^|)]+)\s*\|\s*₹?(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+)\)\s*$/
    );
    if (detailedMatch) {
      const split = splitProductAndCompanyName(detailedMatch[1].trim());
      return {
        productName: split.productName,
        companyName: split.companyName,
        weight: detailedMatch[2].trim(),
        priceDisplay: `₹${detailedMatch[3]}`,
        quantity: detailedMatch[4].trim(),
      };
    }

    // Format 2: Legacy "Product Name - Company (250g) × 2"
    const legacyMatch = seg.match(/^(.*?)\s*\(([^)]+)\)\s*[×xX*]\s*(\d+)\s*$/);
    if (legacyMatch) {
      const qtyNum = Math.max(1, parseInt(legacyMatch[3], 10) || 1);
      const estimatedUnitPrice =
        segments.length === 1
          ? Math.round(fallbackTotalAmountInr / Math.max(1, fallbackTotalCount || qtyNum))
          : null;
      const split = splitProductAndCompanyName(legacyMatch[1].trim());
      return {
        productName: split.productName,
        companyName: split.companyName,
        weight: legacyMatch[2].trim(),
        priceDisplay: estimatedUnitPrice ? `₹${estimatedUnitPrice}` : `₹${fallbackTotalAmountInr}`,
        quantity: String(qtyNum),
      };
    }

    const split = splitProductAndCompanyName(seg);
    return {
      productName: split.productName,
      companyName: split.companyName,
      weight: '—',
      priceDisplay: `₹${fallbackTotalAmountInr}`,
      quantity: String(fallbackTotalCount || 1),
    };
  });
}

// Helper: Format full Indian Date, Day, Time, and Relative Time for Orders
function formatOrderFullDateTime(
  timestamp?: Timestamp | null,
  lang: 'hi' | 'en' = 'hi'
): {
  dateDisplay: string;
  timeDisplay: string;
  fullDisplay: string;
  relativeDisplay: string;
} {
  if (!timestamp || !timestamp.toDate) {
    return {
      dateDisplay: lang === 'hi' ? 'आज (Today)' : 'Today',
      timeDisplay: '—',
      fullDisplay: lang === 'hi' ? 'हाल ही में (Just now)' : 'Just now',
      relativeDisplay: lang === 'hi' ? 'अभी' : 'Just now',
    };
  }

  const date = timestamp.toDate();
  const dateFormattedHi = date.toLocaleDateString('hi-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });
  const dateFormattedEn = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  });
  const timeFormatted = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative = '';
  if (diffMins < 1) {
    relative = lang === 'hi' ? 'अभी-अभी' : 'Just now';
  } else if (diffMins < 60) {
    relative = lang === 'hi' ? `${diffMins} मिनट पहले` : `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relative = lang === 'hi' ? `${diffHours} घंटे पहले` : `${diffHours}h ago`;
  } else {
    relative = lang === 'hi' ? `${diffDays} दिन पहले` : `${diffDays}d ago`;
  }

  const fullDisplay =
    lang === 'hi'
      ? `${dateFormattedHi} · ${timeFormatted}`
      : `${dateFormattedEn} at ${timeFormatted}`;

  return {
    dateDisplay: lang === 'hi' ? dateFormattedHi : dateFormattedEn,
    timeDisplay: timeFormatted,
    fullDisplay,
    relativeDisplay: relative,
  };
}

// Helper: Calculate and format total duration between Order Placed and Order Completed
function formatOrderDuration(
  createdAt?: Timestamp | null,
  completedAt?: Timestamp | null,
  lang: 'hi' | 'en' = 'hi'
): string | null {
  if (!createdAt || !completedAt || !createdAt.toDate || !completedAt.toDate) {
    return null;
  }
  const start = createdAt.toDate().getTime();
  const end = completedAt.toDate().getTime();
  const diffMs = Math.max(0, end - start);
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const remainMins = diffMins % 60;

  if (diffMins < 1) {
    return lang === 'hi' ? '1 मिनट के अंदर पूरा हुआ' : 'Completed in < 1 min';
  }
  if (diffHours < 1) {
    return lang === 'hi'
      ? `कुल ${diffMins} मिनट में पूरा हुआ`
      : `Completed in ${diffMins} mins`;
  }
  if (diffHours < 24) {
    return lang === 'hi'
      ? `कुल ${diffHours} घंटे ${remainMins > 0 ? `${remainMins} मिनट ` : ''}में पूरा हुआ`
      : `Completed in ${diffHours}h ${remainMins > 0 ? `${remainMins}m` : ''}`;
  }
  const days = Math.floor(diffHours / 24);
  return lang === 'hi' ? `${days} दिन में पूरा हुआ` : `Completed in ${days} days`;
}

// Helper: Build structured WhatsApp Order Notification message for Admin (+91 7507505064)
// Includes: Order ID, Order Placed Date & Time, Customer Name, Product Name, Quantity, Price, Total Amount, Delivery Address, and Order Status
function buildOrderWhatsAppNotificationText(
  ord: TeaOrderRecord,
  parsedItems: ParsedOrderItem[],
  mobileDisplay: string,
  gpsCoords: { lat: number; lng: number } | null
): string {
  const shortOrderId = `#${ord.id.slice(0, 8).toUpperCase()}`;
  const statusLabel = STATUS_LABELS_HI[ord.status] || ord.status;
  const timing = formatOrderFullDateTime(ord.createdAt, 'hi');
  const productLines = parsedItems
    .map(
      (item, idx) =>
        `${idx + 1}. Product Name: ${item.productName} (${item.companyName} · ${
          item.weight
        }) | Quantity: ${item.quantity} | Price: ${item.priceDisplay}`
    )
    .join('\n');
  const fullAddress = `${ord.gpsAddress || ord.deliveryAddress} (PIN: ${ord.pinCode})`;

  return [
    '🌿 *CHAI ROS | GTC Tea — नया ऑर्डर (Admin Order Notification)* 🌿',
    `📦 *Order ID:* ${shortOrderId} (${ord.id})`,
    `📅 *Order Date (तारीख):* ${timing.dateDisplay}`,
    `⏱️ *Order Time (समय):* ${timing.timeDisplay} (IST)`,
    `👤 *Customer Name:* ${ord.customerName}`,
    `📞 *Mobile Number:* ${mobileDisplay}`,
    `📌 *Order Status:* ${statusLabel}`,
    '────────────────────',
    '🫖 *Product Details (Product Name, Quantity, Price):*',
    productLines,
    '────────────────────',
    `💰 *Total Amount:* ₹${ord.totalAmountInr} (${ord.paymentMethod})`,
    `📍 *Delivery Address:* ${fullAddress}`,
    ...(gpsCoords
      ? [
          `🧭 *GPS:* ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)}`,
          `🗺️ *Google Maps:* https://www.google.com/maps?q=${gpsCoords.lat.toFixed(
            6
          )},${gpsCoords.lng.toFixed(6)}`,
        ]
      : []),
  ].join('\n');
}

// Helper: Build structured WhatsApp Order Confirmation / Status Update message for Customer
// Includes: Order ID, Order Placed Date & Time, Customer Name, Product Name, Quantity, Price, Total Amount, Delivery Address, and Order Status
function buildCustomerWhatsAppNotificationText(
  ord: TeaOrderRecord,
  parsedItems: ParsedOrderItem[],
  statusOverride?: TeaOrderRecord['status']
): string {
  const shortOrderId = `#${ord.id.slice(0, 8).toUpperCase()}`;
  const targetStatus = statusOverride || ord.status;
  const statusLabel = STATUS_LABELS_HI[targetStatus] || targetStatus;
  const timing = formatOrderFullDateTime(ord.createdAt, 'hi');
  const productLines = parsedItems
    .map(
      (item, idx) =>
        `${idx + 1}. Product Name: ${item.productName} (${item.companyName} · ${
          item.weight
        }) | Quantity: ${item.quantity} | Price: ${item.priceDisplay}`
    )
    .join('\n');
  const fullAddress = `${ord.gpsAddress || ord.deliveryAddress} (PIN: ${ord.pinCode})`;

  const headingLine =
    targetStatus === 'confirmed'
      ? '✅ *CHAI ROS | GTC Tea — आपका ऑर्डर Confirmed हो गया है!*'
      : targetStatus === 'delivered'
      ? '🎉 *CHAI ROS | GTC Tea — आपका ऑर्डर Complete (पूरा) हो गया है!*'
      : targetStatus === 'cancelled'
      ? '⚠️ *CHAI ROS | GTC Tea — आपका ऑर्डर Cancelled (रद्द) कर दिया गया है।*'
      : '🌿 *CHAI ROS | GTC Tea — ऑर्डर कन्फ़र्मेशन (Order Confirmation)* 🌿';

  return [
    headingLine,
    `📦 *Order ID:* ${shortOrderId} (${ord.id})`,
    `📅 *Order Date (तारीख):* ${timing.dateDisplay}`,
    `⏱️ *Order Time (समय):* ${timing.timeDisplay} (IST)`,
    ...(targetStatus === 'delivered'
      ? [
          `🎉 *Order Completed (पूरा हुआ):* ${formatOrderFullDateTime(ord.deliveredAt || ord.completedAt || ord.updatedAt, 'hi').fullDisplay}`,
        ]
      : []),
    `👤 *Customer Name:* ${ord.customerName}`,
    `📌 *Order Status:* ${statusLabel}`,
    '────────────────────',
    '🫖 *Product Details (Product Name, Quantity, Price):*',
    productLines,
    '────────────────────',
    `💰 *Total Amount:* ₹${ord.totalAmountInr} (${ord.paymentMethod})`,
    `📍 *Delivery Address:* ${fullAddress}`,
    '📞 *CHAI ROS Help WhatsApp:* +91 7507505064',
  ].join('\n');
}

function buildCustomerDirectWhatsappUrl(rawCustomerPhone: string, messageText: string): string {
  const digits = (rawCustomerPhone || '').replace(/\D/g, '');
  const tenDigits =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  const recipient = /^[6-9]\d{9}$/.test(tenDigits) ? `91${tenDigits}` : '917507505064';
  return `https://api.whatsapp.com/send?phone=${recipient}&text=${encodeURIComponent(
    messageText
  )}`;
}

// Launch WhatsApp Chat URL via a DOM anchor element (avoids window.open popup blocking inside iframes & mobile browsers)
function launchWhatsappChatUrl(whatsappUrl: string): void {
  if (typeof document === 'undefined' || !whatsappUrl) return;
  try {
    const link = document.createElement('a');
    link.href = whatsappUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) link.parentNode.removeChild(link);
      } catch {
        // Ignore cleanup error
      }
    }, 400);
  } catch {
    // Ignore anchor click error
  }
}

// Helper: Resolve Customer Mobile Number (10 digits) OR Email ID into Firebase Auth credentials
function resolveCustomerIdentifier(rawInput: string): {
  valid: boolean;
  isMobile: boolean;
  authEmail: string;
  phone: string;
  displayLabel: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, isMobile: false, authEmail: '', phone: '', displayLabel: '' };
  }

  // If input does not contain '@', treat as phone number candidate
  if (!trimmed.includes('@')) {
    const digitsOnly = trimmed.replace(/\D/g, '');
    let normalized10 = digitsOnly;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      normalized10 = digitsOnly.slice(2);
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      normalized10 = digitsOnly.slice(1);
    }
    if (/^[6-9][0-9]{9}$/.test(normalized10)) {
      return {
        valid: true,
        isMobile: true,
        authEmail: `${normalized10}@mobile.chairoz.in`,
        phone: normalized10,
        displayLabel: normalized10,
      };
    }
    return { valid: false, isMobile: true, authEmail: '', phone: '', displayLabel: trimmed };
  }

  const cleanEmail = trimmed.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      valid: true,
      isMobile: false,
      authEmail: cleanEmail,
      phone: '',
      displayLabel: cleanEmail,
    };
  }

  return { valid: false, isMobile: false, authEmail: '', phone: '', displayLabel: trimmed };
}

function formatCustomerContactDisplay(email?: string, phone?: string): string {
  if (phone && phone.trim().length >= 10) {
    return phone.trim();
  }
  if (email && email.endsWith('@mobile.chairoz.in')) {
    return email.split('@')[0];
  }
  return email || '—';
}

function formatOrderMobileDisplay(
  ord: TeaOrderRecord,
  customers: CustomerProfileData[]
): string {
  if (ord.customerPhone && ord.customerPhone.trim().length >= 10) {
    return ord.customerPhone.trim();
  }
  if (ord.customerEmail && ord.customerEmail.endsWith('@mobile.chairoz.in')) {
    return ord.customerEmail.split('@')[0];
  }
  const matchedCust = customers.find((c) => c.uid === ord.customerId);
  if (matchedCust?.phone && matchedCust.phone.trim().length >= 10) {
    return matchedCust.phone.trim();
  }
  return ord.customerPhone || ord.customerEmail || '—';
}

// Helper: Extract GPS Latitude & Longitude from an Order snapshot (or fallback to Customer Profile / embedded GPS tag)
function resolveOrderGpsCoordinates(
  ord: TeaOrderRecord,
  customers: CustomerProfileData[]
): { lat: number; lng: number } | null {
  if (
    typeof ord.gpsLat === 'number' &&
    typeof ord.gpsLng === 'number' &&
    Number.isFinite(ord.gpsLat) &&
    Number.isFinite(ord.gpsLng)
  ) {
    return { lat: Number(ord.gpsLat.toFixed(6)), lng: Number(ord.gpsLng.toFixed(6)) };
  }

  // Check if address text contains [GPS: lat, lng] or (lat, lng)
  const textToScan = `${ord.gpsAddress || ''} ${ord.deliveryAddress || ''}`;
  const gpsBracketMatch = textToScan.match(
    /GPS:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i
  );
  if (gpsBracketMatch) {
    const parsedLat = parseFloat(gpsBracketMatch[1]);
    const parsedLng = parseFloat(gpsBracketMatch[2]);
    if (
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLng >= -180 &&
      parsedLng <= 180
    ) {
      return { lat: Number(parsedLat.toFixed(6)), lng: Number(parsedLng.toFixed(6)) };
    }
  }

  const matchedCust = customers.find((c) => c.uid === ord.customerId);
  if (
    matchedCust &&
    typeof matchedCust.gpsLat === 'number' &&
    typeof matchedCust.gpsLng === 'number' &&
    Number.isFinite(matchedCust.gpsLat) &&
    Number.isFinite(matchedCust.gpsLng)
  ) {
    return {
      lat: Number(matchedCust.gpsLat.toFixed(6)),
      lng: Number(matchedCust.gpsLng.toFixed(6)),
    };
  }

  return null;
}

function buildOpenStreetMapEmbedUrl(lat: number, lng: number): string {
  const delta = 0.008;
  const minLon = (lng - delta).toFixed(6);
  const minLat = (lat - delta).toFixed(6);
  const maxLon = (lng + delta).toFixed(6);
  const maxLat = (lat + delta).toFixed(6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat.toFixed(
    6
  )}%2C${lng.toFixed(6)}`;
}

function buildExternalMapUrl(
  lat: number | null,
  lng: number | null,
  address: string = '',
  pinCode?: string
): string {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${lat.toFixed(6)},${lng.toFixed(6)}`
    )}`;
  }
  const cleanAddress = address.replace(/\[GPS:[^\]]+\]/gi, '').trim();
  const queryStr = `${cleanAddress} ${pinCode || ''}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    queryStr || 'India'
  )}`;
}



export default function App() {
  // Language state ('hi' = हिंदी, 'en' = English) persisted in localStorage
  const [lang, setLang] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem('chairoz_lang');
      return saved === 'en' ? 'en' : 'hi';
    } catch {
      return 'hi';
    }
  });

  const handleLanguageChange = (nextLang: AppLanguage) => {
    setLang(nextLang);
    try {
      localStorage.setItem('chairoz_lang', nextLang);
    } catch {
      // Ignore storage error
    }
  };

  // Helper for inline bilingual text selection
  const t = (hiText: string, enText: string) => (lang === 'en' ? enText : hiText);

  const getOrderStatusLabel = (status: TeaOrderRecord['status']) =>
    lang === 'en' ? STATUS_LABELS_EN[status] : STATUS_LABELS_HI[status];

  // Global Admin-Controlled App Settings synced from Firestore (/settings/app_config)
  const [appSettings, setAppSettings] = useState<AppSettingsData>(INITIAL_APP_SETTINGS);

  // Firebase Auth & Connection state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [, setFirebaseConnected] = useState<boolean | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Navigation & Modals
  const [activeSection, setActiveSection] = useState<ActiveSection>('catalog');
  const [adminActiveTab, setAdminActiveTab] = useState<AdminDashboardTab>('products');
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [highlightProviderWarning, setHighlightProviderWarning] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Product Detail Modal State (opens when customer clicks a product card)
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<TeaProductItem | null>(
    null
  );
  const [detailQuantity, setDetailQuantity] = useState<number>(1);
  const [, setDetailAddedFeedback] = useState<boolean>(false);

  // Separate Login Pages: 'customer' (Customer Login Page) vs 'admin' (Admin Login Page)
  const [loginRoleTab, setLoginRoleTab] = useState<TopLoginRoleTab>(() => {
    try {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (
        path.includes('/admin') ||
        hash.includes('admin') ||
        search.includes('admin')
      ) {
        return 'admin';
      }
      const savedPage = sessionStorage.getItem('chairoz_last_login_page');
      if (savedPage === 'admin') return 'admin';
    } catch {
      // Ignore storage error
    }
    return 'customer';
  });
  const [customerAuthView, setCustomerAuthView] = useState<CustomerAuthView>('login');
  const [adminForgotMode, setAdminForgotMode] = useState(false);

  // Switch between Separate Customer Login Page and Separate Admin Login Page
  const switchLoginPage = (targetPage: TopLoginRoleTab) => {
    setLoginRoleTab(targetPage);
    setCustomerAuthView('login');
    setAdminForgotMode(false);
    setAuthErrorHi(null);
    setAuthSuccessHi(null);
    try {
      sessionStorage.setItem('chairoz_last_login_page', targetPage);
      window.history.replaceState(
        null,
        '',
        targetPage === 'admin' ? '/#admin-login' : '/'
      );
    } catch {
      // Ignore history error
    }
  };

  // Auth Form Inputs (Mobile/Email + Password + Forgot Password)
  const [fullNameInput, setFullNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authErrorHi, setAuthErrorHi] = useState<string | null>(null);
  const [authSuccessHi, setAuthSuccessHi] = useState<string | null>(null);

  // Live Products from Firestore (Real-time sync across all mobile & desktop devices)
  const [catalogProducts, setCatalogProducts] = useState<TeaProductItem[]>([]);
  const [adminAllProducts, setAdminAllProducts] = useState<TeaProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem('chairoz_cart_v1');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });

  // Persist cart in localStorage so page refresh keeps customer's cart intact
  useEffect(() => {
    try {
      localStorage.setItem('chairoz_cart_v1', JSON.stringify(cart));
    } catch {
      // Ignore storage error
    }
  }, [cart]);

  // Admin Product Upload / Edit Form State — Strictly 5 fields, 100% Empty by default (No auto-fill or pre-selection)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [adminProdName, setAdminProdName] = useState('');
  const [adminProdCompanyName, setAdminProdCompanyName] = useState('');
  const [adminProdPhotoUrl, setAdminProdPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [adminProdWeightInput, setAdminProdWeightInput] = useState('');
  const [adminProdPrice, setAdminProdPrice] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProducts, setDeletingProducts] = useState(false);
  const [adminProductStatusHi, setAdminProductStatusHi] = useState<string | null>(null);
  const [adminProductErrorHi, setAdminProductErrorHi] = useState<string | null>(null);

  const resetAdminProductForm = () => {
    setEditingProductId(null);
    setAdminProdName('');
    setAdminProdCompanyName('');
    setAdminProdPhotoUrl('');
    setAdminProdWeightInput('');
    setAdminProdPrice('');
  };

  // Checkout / Order Form State & Automatic GPS Permanent Address State
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [customerGpsLat, setCustomerGpsLat] = useState<number | null>(null);
  const [customerGpsLng, setCustomerGpsLng] = useState<number | null>(null);
  const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);
  const [gpsModalMode, setGpsModalMode] = useState<'gps' | 'map_pin' | 'edit'>('gps');
  const [gpsPermissionState, setGpsPermissionState] = useState<
    'idle' | 'requesting' | 'geocoding' | 'denied' | 'success'
  >('idle');
  const [gpsErrorHi, setGpsErrorHi] = useState<string | null>(null);
  const [gpsStatusHi, setGpsStatusHi] = useState<string | null>(null);
  const [mapPinLat, setMapPinLat] = useState<number>(26.9124);
  const [mapPinLng, setMapPinLng] = useState<number>(75.7873);
  const [manualEditAddress, setManualEditAddress] = useState('');
  const [manualEditPinCode, setManualEditPinCode] = useState('');
  const [savingPermanentAddress, setSavingPermanentAddress] = useState(false);
  const [activeMapViewModal, setActiveMapViewModal] = useState<GpsMapViewConfig | null>(null);
  const hasAutoPromptedGpsRef = useRef<Record<string, boolean>>({});
  const [, setPinRegionInfo] = useState<{
    stateHi: string;
    deliveryDaysHi: string;
  } | null>(null);
  const [, setPinLookupError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UPI'>('COD');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderErrorHi, setOrderErrorHi] = useState<string | null>(null);
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(null);

  // Orders & Customers Data (Real-time sync between Customer & Admin)
  const [myOrders, setMyOrders] = useState<TeaOrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [adminOrders, setAdminOrders] = useState<TeaOrderRecord[]>([]);
  const [adminOrdersLoading, setAdminOrdersLoading] = useState(false);
  const [adminActionLoadingId, setAdminActionLoadingId] = useState<string | null>(null);
  const [orderAdminNoteDrafts, setOrderAdminNoteDrafts] = useState<Record<string, string>>({});

  // Registered Customers Directory in Admin Panel (/users collection)
  const [adminCustomers, setAdminCustomers] = useState<CustomerProfileData[]>([]);
  const [adminCustomersLoading, setAdminCustomersLoading] = useState(false);
  const [editingCustomerUid, setEditingCustomerUid] = useState<string | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustEmail, setEditCustEmail] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustPin, setEditCustPin] = useState('');
  const [editCustAdminNote, setEditCustAdminNote] = useState('');
  const [savingCustomerUpdate, setSavingCustomerUpdate] = useState(false);
  const [adminCustomerStatusHi, setAdminCustomerStatusHi] = useState<string | null>(null);
  const [expandedCustomerHistoryUid, setExpandedCustomerHistoryUid] = useState<string | null>(
    null
  );
  const [adminConfirmModal, setAdminConfirmModal] = useState<AdminConfirmModalConfig | null>(
    null
  );
  const [confirmActionLoading, setConfirmActionLoading] = useState(false);

  // Server-Side Automatic WhatsApp Notification State (Built-in Multi-Device Bridge + Meta Cloud API)
  const [whatsappCloudConfig, setWhatsappCloudConfig] = useState<{
    configured: boolean;
    cloudConfigured?: boolean;
    bridgeConnected?: boolean;
    bridgeState?: 'disconnected' | 'connecting' | 'qr_ready' | 'pairing_code_ready' | 'connected';
    connectedWhatsAppPhone?: string | null;
    qrDataUrl?: string | null;
    pairingCode?: string | null;
    pairingPhone?: string | null;
    pendingQueueCount?: number;
    lastError?: string | null;
    hasAccessToken: boolean;
    hasPhoneNumberId: boolean;
    apiVersion: string;
    targetAdminNumber: string;
  } | null>(null);
  const [adminConnectPhoneInput, setAdminConnectPhoneInput] = useState('7507505064');
  const [whatsappBridgeActionLoading, setWhatsappBridgeActionLoading] = useState(false);
  const [whatsappBridgeFeedbackHi, setWhatsappBridgeFeedbackHi] = useState<string | null>(null);
  const [retryingWhatsappOrderId, setRetryingWhatsappOrderId] = useState<string | null>(null);
  const [activeOrderWhatsappModal, setActiveOrderWhatsappModal] =
    useState<OrderWhatsappDispatchModalConfig | null>(null);
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());
  const initialAdminOrdersLoadedRef = useRef<boolean>(false);
  const alertedAdminNewOrderIdsRef = useRef<Set<string>>(new Set());

  // Derived Real-Time Admin Dashboard Lists (100% live from Firestore — no demo data)
  const adminNewOrders = useMemo(
    () =>
      adminOrders.filter(
        (o) => !o.isDeleted && o.status !== 'delivered' && o.status !== 'cancelled'
      ),
    [adminOrders]
  );

  const adminCompleteOrders = useMemo(
    () => adminOrders.filter((o) => !o.isDeleted && o.status === 'delivered'),
    [adminOrders]
  );

  const adminActiveCustomers = useMemo(
    () => adminCustomers.filter((c) => !c.isDeleted),
    [adminCustomers]
  );

  const adminDeletedOrders = useMemo(
    () => adminOrders.filter((o) => o.isDeleted === true),
    [adminOrders]
  );

  const adminDeletedCustomers = useMemo(
    () => adminCustomers.filter((c) => c.isDeleted === true),
    [adminCustomers]
  );

  // Check Firestore connection on mount & listen to global App Settings (/settings/app_config)
  useEffect(() => {
    verifyFirestoreConnection().then((res) => {
      setFirebaseConnected(res.connected);
    });

    const settingsDocRef = doc(db, 'settings', 'app_config');
    const unsubSettings = onSnapshot(
      settingsDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<AppSettingsData>;
          const resolvedWaDigits = normalizeAdminWhatsappDigits(
            data.whatsappNumber || data.contactWhatsapp || data.contactPhone
          );
          setAppSettings({
            ...INITIAL_APP_SETTINGS,
            ...data,
            companyName: normalizeBrandToChaiRos(data.companyName),
            companyNameEn: normalizeBrandToChaiRos(data.companyNameEn || data.companyName),
            companyNameHi: normalizeBrandToChaiRos(data.companyNameHi || data.companyName),
            appNameEn: normalizeBrandToChaiRos(data.appNameEn),
            appNameHi: normalizeBrandToChaiRos(data.appNameHi),
            whatsappNumber: resolvedWaDigits,
            contactWhatsapp: resolvedWaDigits,
            contactPhone: `+91 ${resolvedWaDigits}`,
          });
        } else {
          setAppSettings(INITIAL_APP_SETTINGS);
        }
      },
      (err) => {
        console.warn('App settings listener info:', err);
      }
    );

    // Check Server-Side Meta WhatsApp Cloud API Configuration Status on mount for both Customer & Admin
    fetch('/api/whatsapp/config-status')
      .then((r) => r.json())
      .then((statusData) => {
        if (statusData && statusData.ok) {
          setWhatsappCloudConfig({
            configured: Boolean(statusData.configured),
            hasAccessToken: Boolean(statusData.hasAccessToken),
            hasPhoneNumberId: Boolean(statusData.hasPhoneNumberId),
            apiVersion: String(statusData.apiVersion || 'v20.0'),
            targetAdminNumber: String(statusData.targetAdminNumber || '+91 7507505064'),
          });
        }
      })
      .catch(() => {
        // Ignore status check error
      });

    return () => unsubSettings();
  }, []);

  // Refs to prevent race conditions between handleCustomerRegister and onAuthStateChanged
  const pendingRegistrationNameRef = useRef<string>('');
  const profileSyncLocksRef = useRef<
    Record<string, Promise<CustomerProfileData> | undefined>
  >({});

  // Serialized helper to fetch or create /users/{uid} without duplicate concurrent setDoc calls
  const ensureAndSyncUserProfile = async (
    user: User,
    preferredName?: string
  ): Promise<CustomerProfileData> => {
    const cleanUserEmail = (user.email || emailInput || 'customer@chairoz.in')
      .trim()
      .toLowerCase()
      .slice(0, 120);
    const isEmailAdmin = isAuthorizedAdminEmail(cleanUserEmail);
    const userDocRef = doc(db, 'users', user.uid);
    const userPath = `users/${user.uid}`;

    const existingPromise = profileSyncLocksRef.current[user.uid];
    if (existingPromise) {
      const result = await existingPromise;
      const desiredName = (
        preferredName?.trim() ||
        pendingRegistrationNameRef.current.trim() ||
        ''
      ).slice(0, 80);
      if (desiredName.length >= 2 && result.name !== desiredName) {
        try {
          await updateDoc(userDocRef, {
            name: desiredName,
            updatedAt: serverTimestamp(),
          });
          return { ...result, name: desiredName };
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, userPath);
        }
      }
      return result;
    }

    const syncTask = (async (): Promise<CustomerProfileData> => {
      const userSnap = await getDoc(userDocRef);
      const desiredName = (
        preferredName?.trim() ||
        pendingRegistrationNameRef.current.trim() ||
        ''
      ).slice(0, 80);

      if (userSnap.exists()) {
        const rawData = userSnap.data() as CustomerProfileData;
        const existingRoleIsAdmin = rawData.role === 'admin';
        const resolvedEmail = (rawData.email || cleanUserEmail)
          .trim()
          .toLowerCase()
          .slice(0, 120);
        let resolvedName = (rawData.name || '').trim().slice(0, 80);

        if (desiredName.length >= 2 && resolvedName !== desiredName) {
          try {
            await updateDoc(userDocRef, {
              name: desiredName,
              updatedAt: serverTimestamp(),
            });
            resolvedName = desiredName;
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, userPath);
          }
        }

        if (pendingRegistrationNameRef.current) {
          pendingRegistrationNameRef.current = '';
        }

        return {
          ...rawData,
          name: resolvedName.length >= 2 ? resolvedName : 'CHAI ROS Customer',
          email: resolvedEmail,
          role: isEmailAdmin || existingRoleIsAdmin ? 'admin' : rawData.role,
        };
      }

      const isMobileSyntheticEmail = cleanUserEmail.endsWith('@mobile.chairoz.in');
      const mobileDigitsFromEmail = isMobileSyntheticEmail
        ? cleanUserEmail.split('@')[0]
        : '';
      const fallbackNameFromEmail = isMobileSyntheticEmail
        ? `Customer ${mobileDigitsFromEmail.slice(-4)}`
        : cleanUserEmail.split('@')[0] || 'CHAI ROS Customer';
      const candidateName = (
        desiredName ||
        user.displayName?.trim() ||
        fullNameInput.trim() ||
        fallbackNameFromEmail
      ).slice(0, 80);
      const isGoogleUser = user.providerData.some(
        (p) => p.providerId === 'google.com'
      );
      const resolvedMethod: CustomerProfileData['authMethod'] = isGoogleUser
        ? 'google'
        : isMobileSyntheticEmail
        ? 'mobile_password'
        : 'email_password';

      const newProfile: CustomerProfileData = {
        uid: user.uid,
        name: candidateName.length >= 2 ? candidateName : 'CHAI ROS Customer',
        email: cleanUserEmail,
        ...(mobileDigitsFromEmail ? { phone: mobileDigitsFromEmail } : {}),
        role: 'customer',
        authMethod: resolvedMethod,
      };

      try {
        await setDoc(userDocRef, {
          ...newProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.CREATE, userPath);
      }

      if (pendingRegistrationNameRef.current) {
        pendingRegistrationNameRef.current = '';
      }

      return newProfile;
    })();

    profileSyncLocksRef.current[user.uid] = syncTask;
    try {
      return await syncTask;
    } finally {
      delete profileSyncLocksRef.current[user.uid];
    }
  };

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthErrorHi(null);

      if (!user) {
        setCustomerProfile(null);
        setIsAdminUser(false);
        setMyOrders([]);
        setAdminOrders([]);
        setAdminCustomers([]);
        setCatalogProducts([]);
        setAdminAllProducts([]);
        setAuthReady(true);
        return;
      }

      setProfileLoading(true);
      try {
        const cleanUserEmail = (user.email || emailInput || 'customer@chairoz.in')
          .trim()
          .toLowerCase()
          .slice(0, 120);
        const isEmailAdmin = isAuthorizedAdminEmail(cleanUserEmail);

        // Step 1: Fetch or create CustomerProfile in /users/{uid} FIRST (serialized)
        const userDocRef = doc(db, 'users', user.uid);
        const syncedProfile = await ensureAndSyncUserProfile(user);
        const existingRoleIsAdmin = syncedProfile.role === 'admin';

        setCustomerProfile(syncedProfile);
        setCheckoutName(syncedProfile.name || '');
        const initialPhone =
          syncedProfile.phone ||
          (cleanUserEmail.endsWith('@mobile.chairoz.in')
            ? cleanUserEmail.split('@')[0]
            : '');
        if (initialPhone) setCheckoutPhone(initialPhone);
        setCheckoutEmail(syncedProfile.email || cleanUserEmail);
        if (syncedProfile.defaultAddress) setDeliveryAddress(syncedProfile.defaultAddress);
        if (syncedProfile.defaultPinCode) setPinCode(syncedProfile.defaultPinCode);
        if (typeof syncedProfile.gpsLat === 'number') {
          setCustomerGpsLat(syncedProfile.gpsLat);
          setMapPinLat(syncedProfile.gpsLat);
        }
        if (typeof syncedProfile.gpsLng === 'number') {
          setCustomerGpsLng(syncedProfile.gpsLng);
          setMapPinLng(syncedProfile.gpsLng);
        }

        // Step 2: Check or bootstrap /admins/{uid} document for authorized Admin
        let hasAdminDoc = false;
        try {
          const adminDocRef = doc(db, 'admins', user.uid);
          const adminSnap = await getDoc(adminDocRef);
          if (adminSnap.exists()) {
            hasAdminDoc = true;
          } else if (isEmailAdmin) {
            await setDoc(adminDocRef, {
              uid: user.uid,
              email: cleanUserEmail,
              createdAt: serverTimestamp(),
            });
            hasAdminDoc = true;
          }
        } catch (adminErr) {
          console.warn('Admin doc check:', adminErr);
        }

        const resolvedIsAdmin = Boolean(isEmailAdmin || hasAdminDoc || existingRoleIsAdmin);
        setIsAdminUser(resolvedIsAdmin);

        // Ensure /users/{uid}.role is 'admin' if resolvedIsAdmin is true
        if (resolvedIsAdmin && !existingRoleIsAdmin) {
          try {
            await updateDoc(userDocRef, {
              role: 'admin',
              updatedAt: serverTimestamp(),
            });
            setCustomerProfile((prev) => (prev ? { ...prev, role: 'admin' } : prev));
          } catch {
            // Non-blocking
          }
        }

        if (resolvedIsAdmin) {
          setLoginRoleTab('admin');
          setActiveSection('admin');
          try {
            sessionStorage.setItem('chairoz_last_login_page', 'admin');
            window.history.replaceState(null, '', '/#admin-portal');
          } catch {
            // Ignore
          }
        } else {
          setLoginRoleTab('customer');
          setActiveSection('catalog');
          try {
            sessionStorage.setItem('chairoz_last_login_page', 'customer');
            window.history.replaceState(null, '', '/');
          } catch {
            // Ignore
          }
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      } finally {
        setProfileLoading(false);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Strict Route & Portal Guard: Prevent Customers from accessing Admin Portal via URL or state manipulation
  useEffect(() => {
    const enforceRouteSecurity = () => {
      if (!authReady) return;
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const urlHasAdmin =
        path.includes('/admin') || hash.includes('admin') || search.includes('admin');

      if (!currentUser) {
        if (urlHasAdmin && loginRoleTab !== 'admin') {
          setLoginRoleTab('admin');
        }
        return;
      }

      // Logged-in Customer MUST NEVER access Admin section or Admin URLs
      if (!isAdminUser) {
        if (activeSection === 'admin') {
          setActiveSection('catalog');
        }
        if (urlHasAdmin) {
          try {
            window.history.replaceState(null, '', '/');
          } catch {
            // Ignore
          }
          setActiveSection('catalog');
        }
      }
    };

    enforceRouteSecurity();
    window.addEventListener('hashchange', enforceRouteSecurity);
    window.addEventListener('popstate', enforceRouteSecurity);
    return () => {
      window.removeEventListener('hashchange', enforceRouteSecurity);
      window.removeEventListener('popstate', enforceRouteSecurity);
    };
  }, [authReady, currentUser, isAdminUser, activeSection, loginRoleTab]);

  // Real-time listener on Customer's own profile document (/users/{currentUser.uid})
  // Ensures any update made by Admin to the customer's profile or adminNoteHi reflects immediately
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const userPath = `users/${currentUser.uid}`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as CustomerProfileData;
          const resolvedEmail = data.email || currentUser.email || 'customer@chairoz.in';
          setCustomerProfile({
            ...data,
            email: resolvedEmail,
          });
          if (data.role === 'admin') {
            setIsAdminUser(true);
          }
          setCheckoutName((prev) => (data.name && !prev ? data.name : prev));
          const detectedPhone =
            data.phone ||
            (resolvedEmail.endsWith('@mobile.chairoz.in')
              ? resolvedEmail.split('@')[0]
              : '');
          if (detectedPhone) {
            setCheckoutPhone((prev) => (!prev ? detectedPhone : prev));
          }
          setCheckoutEmail((prev) =>
            data.phone && !prev ? data.phone : resolvedEmail && !prev ? resolvedEmail : prev
          );
          setDeliveryAddress((prev) =>
            data.defaultAddress && (!prev || prev !== data.defaultAddress)
              ? data.defaultAddress
              : prev
          );
          setPinCode((prev) =>
            data.defaultPinCode && (!prev || prev !== data.defaultPinCode)
              ? data.defaultPinCode
              : prev
          );
          if (typeof data.gpsLat === 'number') {
            setCustomerGpsLat(data.gpsLat);
          }
          if (typeof data.gpsLng === 'number') {
            setCustomerGpsLng(data.gpsLng);
          }
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, userPath);
        } catch (handledErr) {
          console.error(handledErr);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, currentUser]);

  // Listen to Firestore /products collection in real time for both Customer Catalogue & Admin Panel
  // Strictly isolated to /products collection — excludes any Order data so Orders NEVER appear in Product Management or Catalogue
  useEffect(() => {
    if (!authReady || !currentUser || !customerProfile) {
      setCatalogProducts([]);
      setAdminAllProducts([]);
      return;
    }

    setProductsLoading(true);
    const productsPath = 'products';
    const productsQuery = query(
      collection(db, productsPath),
      where('inStock', 'in', [true, false])
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const items: TeaProductItem[] = snapshot.docs
          .map((docSnap): TeaProductItem | null => {
            const rawRecord = docSnap.data() as Record<string, unknown>;
            // Strict schema guard: Never allow any Order document or non-product document into Products
            if (
              'customerId' in rawRecord ||
              'itemsSummary' in rawRecord ||
              'deliveryAddress' in rawRecord ||
              'totalAmountInr' in rawRecord ||
              typeof rawRecord.nameHi !== 'string' ||
              typeof rawRecord.priceInr !== 'number'
            ) {
              return null;
            }
            const raw = rawRecord as unknown as TeaProductItem;
            return {
              ...raw,
              id: docSnap.id,
              companyName: raw.companyName || raw.categoryHi || '',
              weightLabel: raw.weightLabel || (raw.weightGrams ? `${raw.weightGrams}g` : ''),
              photoUrl: raw.photoUrl || '',
              inStock: true,
              isPublished: true,
            };
          })
          .filter((item): item is TeaProductItem => item !== null);

        items.sort((a, b) => a.weightGrams - b.weightGrams);

        setCatalogProducts(items);
        setAdminAllProducts(items);
        setProductsLoading(false);

        // Keep Product Detail Modal synchronized if open
        setSelectedDetailProduct((prevDetail) => {
          if (!prevDetail) return null;
          const updated = items.find((p) => p.id === prevDetail.id);
          return updated || null;
        });

        // Keep Cart synchronized with latest Admin product price/weight/name/company/photo updates
        setCart((prevCart) =>
          prevCart
            .map((cartItem) => {
              const latestProd = items.find((p) => p.id === cartItem.product.id);
              if (!latestProd) {
                return null;
              }
              return {
                ...cartItem,
                product: latestProd,
                quantity: Math.min(cartItem.quantity, 20),
              };
            })
            .filter((item): item is CartItem => item !== null)
        );
      },
      (error) => {
        setProductsLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, productsPath);
        } catch (handledErr) {
          console.error(handledErr);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, currentUser, customerProfile]);

  // Attach real-time listener for Customer's OWN orders (/orders where customerId == currentUser.uid)
  useEffect(() => {
    if (!authReady || !currentUser || !customerProfile) {
      setMyOrders([]);
      return;
    }

    setOrdersLoading(true);
    const ordersPath = 'orders';
    const customerOrdersQuery = query(
      collection(db, ordersPath),
      where('customerId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      customerOrdersQuery,
      (snapshot) => {
        const loaded: TeaOrderRecord[] = snapshot.docs
          .map((docSnap): TeaOrderRecord | null => {
            const rawRecord = docSnap.data() as Record<string, unknown>;
            if (
              typeof rawRecord.customerId !== 'string' ||
              typeof rawRecord.itemsSummary !== 'string'
            ) {
              return null;
            }
            return {
              id: docSnap.id,
              ...(rawRecord as unknown as Omit<TeaOrderRecord, 'id'>),
            };
          })
          .filter((ord): ord is TeaOrderRecord => ord !== null && !ord.isDeleted);
        loaded.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setMyOrders(loaded);
        setOrdersLoading(false);
      },
      (error) => {
        setOrdersLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, ordersPath);
        } catch (handledErr) {
          console.error(handledErr);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, currentUser, customerProfile]);

  // Attach real-time listener for ALL Customer Orders (/orders) whenever Admin is signed in
  useEffect(() => {
    if (!authReady || !currentUser || !isAdminUser) {
      setAdminOrders([]);
      return;
    }

    setAdminOrdersLoading(true);
    const ordersPath = 'orders';
    const allOrdersRef = collection(db, ordersPath);

    const unsubscribe = onSnapshot(
      allOrdersRef,
      (snapshot) => {
        const loaded: TeaOrderRecord[] = snapshot.docs
          .map((docSnap): TeaOrderRecord | null => {
            const rawRecord = docSnap.data() as Record<string, unknown>;
            if (
              typeof rawRecord.customerId !== 'string' ||
              typeof rawRecord.itemsSummary !== 'string'
            ) {
              return null;
            }
            return {
              id: docSnap.id,
              ...(rawRecord as unknown as Omit<TeaOrderRecord, 'id'>),
            };
          })
          .filter((ord): ord is TeaOrderRecord => ord !== null);
        loaded.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });

        // Track seen order IDs when Admin is logged in; if a brand-new pending order arrives, trigger server-side automatic notification if not yet sent
        if (!initialAdminOrdersLoadedRef.current) {
          initialAdminOrdersLoadedRef.current = true;
          loaded.forEach((o) => alertedAdminNewOrderIdsRef.current.add(o.id));
        } else {
          for (const ord of loaded) {
            if (
              !alertedAdminNewOrderIdsRef.current.has(ord.id) &&
              !ord.isDeleted &&
              ord.status === 'pending' &&
              ord.whatsappNotificationStatus !== 'sent'
            ) {
              alertedAdminNewOrderIdsRef.current.add(ord.id);
              const parsedItems = parseOrderItemsSummary(
                ord.itemsSummary,
                ord.totalItemsCount,
                ord.totalAmountInr
              );
              const mobileDisplay = formatOrderMobileDisplay(ord, adminCustomers);
              const gpsCoords = resolveOrderGpsCoordinates(ord, adminCustomers);
              void triggerServerWhatsAppOrderNotification({
                orderId: ord.id,
                customerName: ord.customerName,
                customerPhone: mobileDisplay,
                itemsSummary: ord.itemsSummary,
                items: parsedItems.map((it) => ({
                  productName: it.productName,
                  companyName: it.companyName,
                  weight: it.weight,
                  priceInr: it.priceDisplay.replace(/[^\d.]/g, '') || ord.totalAmountInr,
                  quantity: it.quantity,
                })),
                totalAmountInr: ord.totalAmountInr,
                deliveryAddress: ord.gpsAddress || ord.deliveryAddress,
                pinCode: ord.pinCode,
                gpsLat: gpsCoords?.lat,
                gpsLng: gpsCoords?.lng,
                paymentMethod: ord.paymentMethod,
                orderStatus: ord.status,
                forceRetry: true,
              });
              break;
            }
          }
        }

        setAdminOrders(loaded);
        setAdminOrdersLoading(false);
      },
      (error) => {
        setAdminOrdersLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, ordersPath);
        } catch (handledErr) {
          console.error(handledErr);
        }
      }
    );

    const fetchWhatsappServerStatus = () => {
      fetch('/api/whatsapp/config-status')
        .then((r) => r.json())
        .then((statusData) => {
          if (statusData && statusData.ok) {
            setWhatsappCloudConfig({
              configured: Boolean(statusData.configured),
              cloudConfigured: Boolean(statusData.cloudConfigured),
              bridgeConnected: Boolean(statusData.bridgeConnected),
              bridgeState: statusData.bridgeState || 'disconnected',
              connectedWhatsAppPhone: statusData.connectedWhatsAppPhone || null,
              qrDataUrl: statusData.qrDataUrl || null,
              pairingCode: statusData.pairingCode || null,
              pairingPhone: statusData.pairingPhone || null,
              pendingQueueCount: Number(statusData.pendingQueueCount || 0),
              lastError: statusData.lastError || null,
              hasAccessToken: Boolean(statusData.hasAccessToken),
              hasPhoneNumberId: Boolean(statusData.hasPhoneNumberId),
              apiVersion: String(statusData.apiVersion || 'v20.0'),
              targetAdminNumber: String(statusData.targetAdminNumber || '+91 7507505064'),
            });
          }
        })
        .catch(() => {
          // Ignore status check error
        });
    };

    fetchWhatsappServerStatus();
    const statusPollTimer = window.setInterval(fetchWhatsappServerStatus, 4000);

    return () => {
      unsubscribe();
      window.clearInterval(statusPollTimer);
    };
  }, [authReady, currentUser, isAdminUser]);

  // Whenever Automatic Server WhatsApp becomes active, automatically dispatch any unsent orders in adminNewOrders so Admin receives them without any manual action
  useEffect(() => {
    if (!isAdminUser || !whatsappCloudConfig?.configured || adminNewOrders.length === 0) {
      return;
    }
    const unsentOrders = adminNewOrders.filter(
      (o) =>
        (o.whatsappNotificationStatus !== 'sent' || !o.whatsappMessageId) &&
        !notifiedOrderIdsRef.current.has(`${o.id}:auto_sync_when_connected`)
    );
    if (unsentOrders.length === 0) return;

    unsentOrders.slice(0, 5).forEach((ord) => {
      notifiedOrderIdsRef.current.add(`${ord.id}:auto_sync_when_connected`);
      const parsedItems = parseOrderItemsSummary(
        ord.itemsSummary,
        ord.totalItemsCount,
        ord.totalAmountInr
      );
      const mobileDisplay = formatOrderMobileDisplay(ord, adminCustomers);
      const orderGpsCoords = resolveOrderGpsCoordinates(ord, adminCustomers);
      void triggerServerWhatsAppOrderNotification({
        orderId: ord.id,
        customerName: ord.customerName,
        customerPhone: mobileDisplay,
        itemsSummary: ord.itemsSummary,
        items: parsedItems.map((it) => ({
          productName: it.productName,
          companyName: it.companyName,
          weight: it.weight,
          priceInr: it.priceDisplay.replace(/[^\d.]/g, '') || ord.totalAmountInr,
          quantity: it.quantity,
        })),
        totalAmountInr: ord.totalAmountInr,
        deliveryAddress: ord.gpsAddress || ord.deliveryAddress,
        pinCode: ord.pinCode,
        gpsLat: orderGpsCoords?.lat,
        gpsLng: orderGpsCoords?.lng,
        paymentMethod: ord.paymentMethod,
        orderStatus: ord.status,
        forceRetry: true,
      });
    });
  }, [isAdminUser, whatsappCloudConfig?.configured, adminNewOrders, adminCustomers]);

  // Attach real-time listener for ALL Registered Customers (/users) whenever Admin is signed in
  useEffect(() => {
    if (!authReady || !currentUser || !isAdminUser) {
      setAdminCustomers([]);
      return;
    }

    setAdminCustomersLoading(true);
    const usersPath = 'users';
    const allUsersRef = collection(db, usersPath);

    const unsubscribe = onSnapshot(
      allUsersRef,
      (snapshot) => {
        const loaded: CustomerProfileData[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data() as CustomerProfileData;
          return {
            ...d,
            uid: docSnap.id,
            email: d.email || '—',
          };
        });
        loaded.sort((a, b) => {
          const tA = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
          const tB = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setAdminCustomers(loaded);
        setAdminCustomersLoading(false);
      },
      (error) => {
        setAdminCustomersLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, usersPath);
        } catch (handledErr) {
          console.error(handledErr);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, currentUser, isAdminUser]);

  // Real-time PIN Code lookup when user enters 6 digits
  useEffect(() => {
    const cleanPin = pinCode.trim();
    if (cleanPin.length !== 6) {
      setPinRegionInfo(null);
      setPinLookupError(null);
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      setPinRegionInfo(null);
      setPinLookupError(
        t(
          'पिन कोड का पहला अंक 0 नहीं हो सकता। कृपया सही 6-अंकों का पिन कोड लिखें।',
          'PIN Code cannot start with 0. Please enter a valid 6-digit Indian PIN Code.'
        )
      );
      return;
    }

    let cancelled = false;
    fetch(`/api/pincode/${cleanPin}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) {
          setPinRegionInfo({
            stateHi: data.stateHi,
            deliveryDaysHi: data.deliveryDaysHi,
          });
          setPinLookupError(null);
        } else {
          setPinRegionInfo(null);
          setPinLookupError(data.errorHi || t('अमान्य पिन कोड', 'Invalid PIN Code'));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPinRegionInfo({
            stateHi: t('भारतीय डाक वितरण क्षेत्र', 'India Post Delivery Zone'),
            deliveryDaysHi: t('3–5 कार्य दिवस', '3–5 Business Days'),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pinCode, lang]);

  // 1. Handle Customer Registration with Name + (Mobile Number OR Email ID) + Password
  const handleCustomerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorHi(null);
    setAuthSuccessHi(null);

    const trimmedName = fullNameInput.trim();
    const resolvedId = resolveCustomerIdentifier(emailInput);

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setAuthErrorHi(
        t(
          'कृपया अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।',
          'Please enter your full name (at least 2 characters).'
        )
      );
      return;
    }
    if (!resolvedId.valid) {
      setAuthErrorHi(
        t(
          'कृपया अपना 10-अंकों का मोबाइल नंबर (जैसे 9876543210) या सही ईमेल आईडी (जैसे name@gmail.com) दर्ज करें।',
          'Please enter a valid 10-digit Mobile Number (e.g. 9876543210) or Email ID (e.g. name@gmail.com).'
        )
      );
      return;
    }
    if (isAuthorizedAdminEmail(resolvedId.authEmail)) {
      setAuthErrorHi(
        t(
          'यह अधिकृत एडमिन ईमेल है। एडमिन लॉगिन के लिए कृपया अलग Admin Login पेज का उपयोग करें।',
          'This is an authorized Admin email. Please use the separate Admin Login page.'
        )
      );
      return;
    }
    if (passwordInput.length < 6) {
      setAuthErrorHi(
        t(
          'सुरक्षा के लिए पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।',
          'Password must be at least 6 characters long.'
        )
      );
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setAuthErrorHi(
        t(
          'दोनों पासवर्ड मेल नहीं खा रहे हैं। कृपया समान पासवर्ड दर्ज करें।',
          'Passwords do not match. Please enter the same password.'
        )
      );
      return;
    }

    setAuthLoading(true);
    pendingRegistrationNameRef.current = trimmedName;
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        resolvedId.authEmail,
        passwordInput
      );

      await updateProfile(userCredential.user, {
        displayName: trimmedName,
      });

      const syncedProfile = await ensureAndSyncUserProfile(
        userCredential.user,
        trimmedName
      );

      setCustomerProfile(syncedProfile);
      setCheckoutName(syncedProfile.name);
      setCheckoutEmail(syncedProfile.email);
      setPasswordInput('');
      setConfirmPasswordInput('');
      setActiveSection('catalog');
      setAuthSuccessHi(
        t('आपका ग्राहक अकाउंट सफलतापूर्वक बन गया है!', 'Your customer account has been created successfully!')
      );
    } catch (err) {
      pendingRegistrationNameRef.current = '';
      const translated = translateFirebaseAuthError(err);
      setAuthErrorHi(lang === 'en' ? translated.messageEn : translated.messageHi);
      if (translated.requiresConsoleProviderSetup) {
        setHighlightProviderWarning(true);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. Handle Customer Login with (Mobile Number OR Email ID) + Password
  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorHi(null);
    setAuthSuccessHi(null);

    const resolvedId = resolveCustomerIdentifier(emailInput);
    if (!resolvedId.valid) {
      setAuthErrorHi(
        t(
          'कृपया अपना 10-अंकों का मोबाइल नंबर (जैसे 9876543210) या सही ईमेल आईडी डालें।',
          'Please enter a valid 10-digit Mobile Number (e.g. 9876543210) or Email ID.'
        )
      );
      return;
    }
    if (isAuthorizedAdminEmail(resolvedId.authEmail)) {
      setAuthErrorHi(
        t(
          'यह अधिकृत एडमिन ईमेल है। एडमिन पोर्टल खोलने के लिए कृपया अलग Admin Login पेज से लॉगिन करें।',
          'This is an authorized Admin email. Please use the separate Admin Login page to access the Admin Portal.'
        )
      );
      return;
    }
    if (passwordInput.length < 6) {
      setAuthErrorHi(
        t(
          'कृपया अपना सही पासवर्ड डालें (कम से कम 6 अक्षर)।',
          'Please enter your password (at least 6 characters).'
        )
      );
      return;
    }

    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, resolvedId.authEmail, passwordInput);
      setPasswordInput('');
      setActiveSection('catalog');
      setAuthSuccessHi(t('ग्राहक लॉगिन सफल रहा!', 'Customer login successful!'));
    } catch (err) {
      const translated = translateFirebaseAuthError(err);
      setAuthErrorHi(lang === 'en' ? translated.messageEn : translated.messageHi);
      if (translated.requiresConsoleProviderSetup) {
        setHighlightProviderWarning(true);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // 3. Handle Forgot Password via Firebase Email Password Reset
  const handleForgotPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorHi(null);
    setAuthSuccessHi(null);

    const targetEmail = (resetEmailInput || emailInput || adminEmailInput)
      .trim()
      .toLowerCase();

    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setAuthErrorHi(
        t(
          'पासवर्ड रीसेट लिंक प्राप्त करने के लिए कृपया अपनी सही ईमेल आईडी दर्ज करें।',
          'Please enter your registered Email ID to receive the password reset link.'
        )
      );
      return;
    }

    setAuthLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setAuthSuccessHi(
        t(
          `आपकी ईमेल आईडी (${targetEmail}) पर पासवर्ड रीसेट लिंक भेज दिया गया है! कृपया अपना ईमेल (Inbox या Spam फ़ोल्डर) चेक करें और नया पासवर्ड बनाएं।`,
          `A password reset link has been sent to your email (${targetEmail})! Please check your Inbox or Spam folder to set a new password.`
        )
      );
    } catch (err) {
      const translated = translateFirebaseAuthError(err);
      setAuthErrorHi(lang === 'en' ? translated.messageEn : translated.messageHi);
    } finally {
      setAuthLoading(false);
    }
  };

  // 4. Handle Customer Google Sign-In (Strictly for Customer Login Page)
  const handleGoogleSignIn = async () => {
    setAuthErrorHi(null);
    setAuthSuccessHi(null);
    setAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (isAuthorizedAdminEmail(cred.user.email)) {
        await signOut(auth);
        setAuthErrorHi(
          t(
            'एडमिन खाते के लिए कृपया अलग Admin Login पेज पर एडमिन ईमेल और पासवर्ड से लॉगिन करें।',
            'For Admin accounts, please log in on the separate Admin Login page using Admin Email and Password.'
          )
        );
        return;
      }
      setActiveSection('catalog');
    } catch (err) {
      const translated = translateFirebaseAuthError(err);
      setAuthErrorHi(lang === 'en' ? translated.messageEn : translated.messageHi);
    } finally {
      setAuthLoading(false);
    }
  };

  // 5. Handle Separate Admin Login (Strictly Admin Email + Password ONLY)
  const handleAdminEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorHi(null);
    setAuthSuccessHi(null);

    const cleanEmail = adminEmailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthErrorHi(
        t('कृपया वैध एडमिन ईमेल आईडी दर्ज करें।', 'Please enter a valid Admin Email ID.')
      );
      return;
    }
    if (!isAuthorizedAdminEmail(cleanEmail)) {
      setAuthErrorHi(
        t(
          'एक्सेस अस्वीकृत: केवल अधिकृत एडमिन (Authorized Admin Email) ही Admin Login पेज से प्रवेश कर सकते हैं। ग्राहक कृपया अलग Customer Login पेज का उपयोग करें।',
          'Access Denied: Only authorized Admin emails can log in here. Customers must use the separate Customer Login page.'
        )
      );
      return;
    }
    if (adminPasswordInput.length < 6) {
      setAuthErrorHi(
        t('कृपया अपना एडमिन पासवर्ड दर्ज करें।', 'Please enter your Admin Password.')
      );
      return;
    }

    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, adminPasswordInput);
      setAdminPasswordInput('');
      setActiveSection('admin');
      try {
        sessionStorage.setItem('chairoz_last_login_page', 'admin');
        window.history.replaceState(null, '', '/#admin-portal');
      } catch {
        // Ignore
      }
    } catch (err) {
      const translated = translateFirebaseAuthError(err);
      setAuthErrorHi(lang === 'en' ? translated.messageEn : translated.messageHi);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Logout — Returns Admin to Admin Login Page, and Customer to Customer Login Page
  const handleLogout = async () => {
    const wasAdminSession = isAdminUser || activeSection === 'admin';
    const returnLoginTab: TopLoginRoleTab = wasAdminSession ? 'admin' : 'customer';
    setLoginRoleTab(returnLoginTab);
    setCustomerAuthView('login');
    setAdminForgotMode(false);
    setAuthErrorHi(null);
    setAuthSuccessHi(null);
    try {
      sessionStorage.setItem('chairoz_last_login_page', returnLoginTab);
      window.history.replaceState(
        null,
        '',
        returnLoginTab === 'admin' ? '/#admin-login' : '/'
      );
    } catch {
      // Ignore
    }
    await signOut(auth);
    setActiveSection('catalog');
    setLastCreatedOrderId(null);
  };

  // Cart Operations
  const addToCart = (product: TeaProductItem, qtyToAdd: number = 1) => {
    const maxAllowed = 20;
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          product,
          quantity: Math.min(updated[existingIndex].quantity + qtyToAdd, maxAllowed),
        };
        return updated;
      }
      return [...prev, { product, quantity: Math.min(Math.max(qtyToAdd, 1), maxAllowed) }];
    });
  };

  const openProductDetail = (product: TeaProductItem) => {
    const existingCartItem = cart.find((c) => c.product.id === product.id);
    setSelectedDetailProduct(product);
    setDetailQuantity(existingCartItem ? existingCartItem.quantity : 1);
    setDetailAddedFeedback(false);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.min(Math.max(item.quantity + delta, 0), 20) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const totalCartItems = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const subtotalInr = useMemo(
    () => cart.reduce((acc, item) => acc + item.product.priceInr * item.quantity, 0),
    [cart]
  );

  const deliveryFeeInr = useMemo(() => {
    if (subtotalInr === 0) return 0;
    const baseDelivery = Math.max(0, Number(appSettings.deliveryChargeInr) || 0);
    const freeThreshold = Math.max(0, Number(appSettings.freeDeliveryMinInr) || 0);
    if (freeThreshold > 0 && subtotalInr >= freeThreshold) {
      return 0;
    }
    return baseDelivery;
  }, [subtotalInr, appSettings.deliveryChargeInr, appSettings.freeDeliveryMinInr]);

  const grandTotalInr = subtotalInr + deliveryFeeInr;

  // =========================================================================
  // AUTOMATIC GPS LOCATION & PERMANENT SAVED ADDRESS SYSTEM
  // =========================================================================

  // Reverse geocode (lat, lng) -> Full Address & PIN Code, and save permanently to /users/{uid}
  const reverseGeocodeAndSavePermanentAddress = async (
    rawLat: number,
    rawLng: number,
    accuracyMeters: number = 0,
    autoCloseModal: boolean = true
  ): Promise<boolean> => {
    if (!currentUser) return false;
    const lat = Number(rawLat.toFixed(6));
    const lng = Number(rawLng.toFixed(6));

    setGpsPermissionState('geocoding');
    setGpsErrorHi(null);
    setGpsStatusHi(
      t(
        'GPS निर्देशांक प्राप्त हो गए! Reverse Geocoding से आपका पूरा पता निकाला जा रहा है...',
        'GPS coordinates acquired! Extracting your full address via Reverse Geocoding...'
      )
    );

    try {
      const res = await fetch(
        `/api/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(
          String(lng)
        )}&lang=${lang}`
      );
      const data = await res.json();

      const resolvedAddress = (
        data?.formattedAddress ||
        `GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`
      )
        .trim()
        .slice(0, 300);
      const resolvedPin =
        data?.pinCode && /^[1-9][0-9]{5}$/.test(String(data.pinCode).trim())
          ? String(data.pinCode).trim()
          : pinCode && /^[1-9][0-9]{5}$/.test(pinCode.trim())
          ? pinCode.trim()
          : '302001';

      const userPath = `users/${currentUser.uid}`;
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          defaultAddress: resolvedAddress,
          defaultPinCode: resolvedPin,
          gpsLat: lat,
          gpsLng: lng,
          gpsAccuracyMeters: Math.max(0, Math.round(accuracyMeters || 0)),
          gpsSavedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }

      setDeliveryAddress(resolvedAddress);
      setPinCode(resolvedPin);
      setCustomerGpsLat(lat);
      setCustomerGpsLng(lng);
      setMapPinLat(lat);
      setMapPinLng(lng);
      setManualEditAddress(resolvedAddress);
      setManualEditPinCode(resolvedPin);
      setCustomerProfile((prev) =>
        prev
          ? {
              ...prev,
              defaultAddress: resolvedAddress,
              defaultPinCode: resolvedPin,
              gpsLat: lat,
              gpsLng: lng,
            }
          : prev
      );

      setGpsPermissionState('success');
      setGpsStatusHi(
        t(
          'आपका पूरा GPS पता सफलतापूर्वक आपके प्रोफाइल में स्थायी रूप से (Permanent Saved Address) सेव हो गया है! अब हर नए ऑर्डर में यह अपने आप जुड़ जाएगा।',
          'Your full GPS address has been permanently saved to your profile! It will now automatically attach to every new order.'
        )
      );

      if (autoCloseModal) {
        setTimeout(() => {
          setIsGpsModalOpen(false);
        }, 1200);
      }
      return true;
    } catch (err) {
      console.error('Reverse geocoding save error:', err);
      setGpsPermissionState('denied');
      setGpsErrorHi(
        t(
          'पता सेव करने में समस्या आई। कृपया नीचे दिए गए बॉक्स में अपना पता जांचकर सेव करें।',
          'Could not save GPS address automatically. Please verify and save below.'
        )
      );
      return false;
    }
  };

  // Request one-shot GPS location ONLY with customer permission (NO background tracking)
  const requestCustomerGpsLocation = (autoCloseModal: boolean = true) => {
    if (!currentUser) return;
    setGpsErrorHi(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsPermissionState('denied');
      setGpsErrorHi(
        t(
          'आपके ब्राउज़र या डिवाइस में GPS उपलब्ध नहीं है। कृपया नीचे मैप पिन (Map Pin) चुनें या पता सुधारकर सेव करें।',
          'GPS is not supported on this browser/device. Please select a Map Pin below or enter/correct your address.'
        )
      );
      return;
    }

    setGpsPermissionState('requesting');
    setGpsStatusHi(
      t(
        'कृपया अपने मोबाइल/ब्राउज़र के पॉपअप में "Allow / अनुमति दें" पर क्लिक करें...',
        'Please click "Allow" on your mobile/browser GPS location prompt...'
      )
    );

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        reverseGeocodeAndSavePermanentAddress(
          latitude,
          longitude,
          accuracy || 0,
          autoCloseModal
        );
      },
      (geoErr) => {
        setGpsPermissionState('denied');
        setGpsStatusHi(null);
        if (geoErr.code === 1) {
          setGpsErrorHi(
            t(
              'GPS Location की अनुमति नहीं मिली (Permission Denied)। चिंता न करें — आप नीचे दिए गए "Map Pin चुनें" विकल्प से अपनी लोकेशन पिन कर सकते हैं या पता सुधारकर स्थायी रूप से सेव कर सकते हैं।',
              'GPS Location permission was denied. You can use the "Select Map Pin" option below to pin your location or enter/correct your address to save permanently.'
            )
          );
        } else {
          setGpsErrorHi(
            t(
              'मोबाइल GPS सिग्नल प्राप्त नहीं हो सका। कृपया पुनः GPS प्रयास करें या नीचे Map Pin चुनें।',
              'Could not acquire GPS signal. Please retry GPS or select a Map Pin below.'
            )
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // Automatically trigger GPS Location Permission ONCE after Customer's First Login
  // NEVER triggers again once customerProfile.defaultAddress is saved in Firebase!
  useEffect(() => {
    if (!authReady || !currentUser || !customerProfile || isAdminUser) return;

    const hasPermanentSavedAddress = Boolean(
      customerProfile.defaultAddress && customerProfile.defaultAddress.trim().length >= 10
    );

    if (hasPermanentSavedAddress) {
      // Customer already has a Permanent Saved Address in Firebase — never prompt again!
      hasAutoPromptedGpsRef.current[currentUser.uid] = true;
      return;
    }

    // First-time login without a saved address: prompt GPS once automatically
    if (!hasAutoPromptedGpsRef.current[currentUser.uid]) {
      hasAutoPromptedGpsRef.current[currentUser.uid] = true;
      setGpsModalMode('gps');
      setManualEditAddress('');
      setManualEditPinCode('');
      setIsGpsModalOpen(true);
      requestCustomerGpsLocation(true);
    }
  }, [authReady, currentUser, customerProfile, isAdminUser]);

  // Open Change / Correct Address Modal when Customer clicks "Change Address"
  const handleOpenChangeAddressModal = (mode: 'gps' | 'map_pin' | 'edit' = 'gps') => {
    setGpsModalMode(mode);
    setGpsErrorHi(null);
    setGpsStatusHi(null);
    setGpsPermissionState('idle');
    setManualEditAddress(
      deliveryAddress || customerProfile?.defaultAddress || ''
    );
    setManualEditPinCode(
      pinCode || customerProfile?.defaultPinCode || ''
    );
    if (typeof customerGpsLat === 'number' && typeof customerGpsLng === 'number') {
      setMapPinLat(customerGpsLat);
      setMapPinLng(customerGpsLng);
    }
    setIsGpsModalOpen(true);
  };

  // Save corrected address or Map Pin address permanently to /users/{uid}
  const handleSaveManualOrPinPermanentAddress = async (
    e?: React.FormEvent | React.MouseEvent
  ) => {
    e?.preventDefault?.();
    if (!currentUser) return;
    setGpsErrorHi(null);

    const cleanAddr = manualEditAddress.trim().slice(0, 300);
    const cleanPin = manualEditPinCode.replace(/\D/g, '').slice(0, 6);

    if (cleanAddr.length < 10) {
      setGpsErrorHi(
        t(
          'कृपया कम से कम 10 अक्षरों का पूरा पता दर्ज करें या ऊपर "GPS से अपने आप पता निकालें" / "Map Pin से पता निकालें" बटन दबाएं।',
          'Please enter a complete address (at least 10 characters) or click "Auto-Detect GPS" / "Fetch from Map Pin" above.'
        )
      );
      return;
    }

    const finalPin = /^[1-9][0-9]{5}$/.test(cleanPin) ? cleanPin : '302001';
    const finalLat = Number((customerGpsLat ?? mapPinLat).toFixed(6));
    const finalLng = Number((customerGpsLng ?? mapPinLng).toFixed(6));
    const addressWithGpsTag = cleanAddr.includes('[GPS:')
      ? cleanAddr
      : `${cleanAddr.slice(0, 240)} [GPS: ${finalLat.toFixed(5)}, ${finalLng.toFixed(5)}]`.slice(
          0,
          300
        );

    setSavingPermanentAddress(true);
    const userPath = `users/${currentUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        defaultAddress: addressWithGpsTag,
        defaultPinCode: finalPin,
        gpsLat: finalLat,
        gpsLng: finalLng,
        gpsSavedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDeliveryAddress(addressWithGpsTag);
      setPinCode(finalPin);
      setCustomerGpsLat(finalLat);
      setCustomerGpsLng(finalLng);
      setCustomerProfile((prev) =>
        prev
          ? {
              ...prev,
              defaultAddress: addressWithGpsTag,
              defaultPinCode: finalPin,
              gpsLat: finalLat,
              gpsLng: finalLng,
            }
          : prev
      );
      setIsGpsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    } finally {
      setSavingPermanentAddress(false);
    }
  };

  // Create Tea Order in Firestore (/orders/{orderId})
  // Automatically attaches Customer's Permanent Saved GPS Address as an independent Order Snapshot
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !customerProfile) return;
    setOrderErrorHi(null);

    if (!appSettings.storeOpen) {
      setOrderErrorHi(
        t(
          appSettings.storeClosedMessageHi ||
            'अभी स्टोर पर नए ऑर्डर बंद हैं। कृपया कुछ समय बाद प्रयास करें।',
          appSettings.storeClosedMessageEn ||
            'The store is currently paused for new orders. Please try again later.'
        )
      );
      return;
    }

    if (cart.length === 0 || totalCartItems < 1) {
      setOrderErrorHi(
        t(
          'कृपया ऑर्डर करने के लिए कम से कम 1 उत्पाद चुनें।',
          'Please add at least 1 product to your order.'
        )
      );
      return;
    }

    const minOrderReq = Math.max(0, Number(appSettings.minOrderAmountInr) || 0);
    if (minOrderReq > 0 && subtotalInr < minOrderReq) {
      setOrderErrorHi(
        t(
          `न्यूनतम ऑर्डर राशि ₹${minOrderReq} है। कृपया अपने कार्ट में कम से कम ₹${minOrderReq} के प्रोडक्ट जोड़ें।`,
          `Minimum order amount is ₹${minOrderReq}. Please add items worth at least ₹${minOrderReq}.`
        )
      );
      return;
    }

    const cleanCustomerName = (checkoutName || customerProfile.name || '')
      .trim()
      .slice(0, 80);
    const rawCheckoutContact = (
      checkoutEmail ||
      customerProfile.phone ||
      customerProfile.email ||
      currentUser.email ||
      ''
    ).trim();
    const resolvedCheckoutContact = resolveCustomerIdentifier(rawCheckoutContact);
    const cleanCustomerEmail = (
      resolvedCheckoutContact.valid
        ? resolvedCheckoutContact.authEmail
        : (customerProfile.email || currentUser.email || '').trim().toLowerCase()
    ).slice(0, 120);

    const rawPhoneCandidate = (
      checkoutPhone ||
      resolvedCheckoutContact.phone ||
      customerProfile.phone ||
      (cleanCustomerEmail.endsWith('@mobile.chairoz.in')
        ? cleanCustomerEmail.split('@')[0]
        : '')
    )
      .replace(/\D/g, '')
      .slice(-10);
    const cleanCustomerPhone = /^[6-9][0-9]{9}$/.test(rawPhoneCandidate)
      ? rawPhoneCandidate
      : '';

    // Automatically use Customer's Permanent Saved GPS Address
    const savedOrCurrentAddress = (
      customerProfile.defaultAddress ||
      deliveryAddress ||
      ''
    ).trim();
    const savedOrCurrentPin = (
      customerProfile.defaultPinCode ||
      pinCode ||
      ''
    ).trim();

    if (savedOrCurrentAddress.length < 10) {
      setOrderErrorHi(
        t(
          'कृपया पहले GPS की अनुमति देकर अपना डिलीवरी पता सेव करें।',
          'Please allow GPS to save your delivery address first.'
        )
      );
      handleOpenChangeAddressModal();
      return;
    }

    const cleanAddress = savedOrCurrentAddress.slice(0, 300);
    const cleanPin = /^[1-9][0-9]{5}$/.test(savedOrCurrentPin)
      ? savedOrCurrentPin
      : '302001';

    if (cleanCustomerName.length < 2) {
      setOrderErrorHi(
        t(
          'कृपया अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।',
          'Please enter your full name (at least 2 characters).'
        )
      );
      return;
    }

    if (!cleanCustomerPhone) {
      setOrderErrorHi(
        t(
          'कृपया डिलीवरी संपर्क के लिए अपना 10-अंकों का मोबाइल नंबर दर्ज करें।',
          'Please enter your valid 10-digit Mobile Number for delivery contact.'
        )
      );
      return;
    }

    if (cleanCustomerEmail.length < 3 || !cleanCustomerEmail.includes('@')) {
      setOrderErrorHi(
        t(
          'कृपया अपना 10-अंकों का मोबाइल नंबर या सही ईमेल आईडी दर्ज करें।',
          'Please enter your 10-digit Mobile Number or valid Email ID.'
        )
      );
      return;
    }

    // Format itemsSummary with Product Name, Company, Weight, Price (₹), and Quantity
    const itemsSummary = cart
      .map(
        (item) =>
          `${item.product.nameHi}${item.product.companyName ? ` - ${item.product.companyName}` : ''} (${formatProductWeight(item.product)} | ₹${item.product.priceInr} × ${item.quantity})`
      )
      .join(', ')
      .slice(0, 1000);

    // Independent GPS Address Snapshot for this specific order (never mutates if customer changes address later)
    const snapshotLat =
      typeof customerProfile.gpsLat === 'number'
        ? Number(customerProfile.gpsLat.toFixed(6))
        : typeof customerGpsLat === 'number'
        ? Number(customerGpsLat.toFixed(6))
        : undefined;
    const snapshotLng =
      typeof customerProfile.gpsLng === 'number'
        ? Number(customerProfile.gpsLng.toFixed(6))
        : typeof customerGpsLng === 'number'
        ? Number(customerGpsLng.toFixed(6))
        : undefined;

    setOrderSubmitting(true);
    try {
      const orderPayload = {
        customerId: currentUser.uid,
        customerName: cleanCustomerName,
        customerEmail: cleanCustomerEmail,
        customerPhone: cleanCustomerPhone,
        itemsSummary,
        totalItemsCount: Math.min(totalCartItems, 50),
        totalAmountInr: grandTotalInr,
        deliveryAddress: cleanAddress,
        pinCode: cleanPin,
        ...(snapshotLat !== undefined && snapshotLng !== undefined
          ? {
              gpsLat: snapshotLat,
              gpsLng: snapshotLng,
              gpsAddress: cleanAddress,
            }
          : {
              gpsAddress: cleanAddress,
            }),
        paymentMethod,
        status: 'pending' as const,
        whatsappNotificationStatus: 'sending' as const,
        customerWhatsappStatus: 'sending' as const,
        customerWhatsappLastEvent: 'order_placed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ordersPath = 'orders';
      // Pre-generate Firestore Order ID synchronously so WhatsApp URL is ready within the user click gesture
      const newOrderDocRef = doc(collection(db, ordersPath));
      const createdDocId = newOrderDocRef.id;

      const structuredItems = cart.map((item) => ({
        productName: item.product.nameHi,
        companyName: item.product.companyName || item.product.categoryHi || 'CHAI ROS',
        weight: formatProductWeight(item.product),
        priceInr: item.product.priceInr,
        quantity: item.quantity,
      }));

      const parsedItemsForWa: ParsedOrderItem[] = structuredItems.map((it) => ({
        productName: it.productName,
        companyName: it.companyName,
        weight: it.weight,
        priceDisplay: `₹${it.priceInr}`,
        quantity: String(it.quantity),
      }));

      const syntheticOrderForWa: TeaOrderRecord = {
        id: createdDocId,
        customerId: currentUser.uid,
        customerName: cleanCustomerName,
        customerEmail: cleanCustomerEmail,
        customerPhone: cleanCustomerPhone,
        itemsSummary,
        totalItemsCount: Math.min(totalCartItems, 50),
        totalAmountInr: grandTotalInr,
        deliveryAddress: cleanAddress,
        pinCode: cleanPin,
        ...(snapshotLat !== undefined && snapshotLng !== undefined
          ? { gpsLat: snapshotLat, gpsLng: snapshotLng, gpsAddress: cleanAddress }
          : { gpsAddress: cleanAddress }),
        paymentMethod,
        status: 'pending',
      };

      const adminWaDigits = normalizeAdminWhatsappDigits(
        appSettings.whatsappNumber || appSettings.contactWhatsapp || '7507505064'
      );
      const adminOrderWaText = buildOrderWhatsAppNotificationText(
        syntheticOrderForWa,
        parsedItemsForWa,
        cleanCustomerPhone,
        snapshotLat !== undefined && snapshotLng !== undefined
          ? { lat: snapshotLat, lng: snapshotLng }
          : null
      );
      const customerOrderWaText = buildCustomerWhatsAppNotificationText(
        syntheticOrderForWa,
        parsedItemsForWa,
        'pending'
      );
      const adminOrderWaUrl = buildAdminWhatsappChatUrl(adminWaDigits, adminOrderWaText);
      const customerOrderWaUrl = buildCustomerDirectWhatsappUrl(
        cleanCustomerPhone,
        customerOrderWaText
      );


      try {
        await setDoc(newOrderDocRef, orderPayload);
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.CREATE, `${ordersPath}/${createdDocId}`);
      }

      // Trigger Automatic Server-Side Meta WhatsApp Business Cloud API Notification:
      // 1. Admin Order Notification (+91 7507505064)
      // 2. Customer Order Confirmation (Customer's WhatsApp Number)
      // Fault-tolerant & Non-blocking: Order is already safely saved in Firebase even if WhatsApp API errors
      if (createdDocId) {
        void triggerServerWhatsAppOrderNotification({
          orderId: createdDocId,
          customerName: cleanCustomerName,
          customerPhone: cleanCustomerPhone,
          itemsSummary,
          items: structuredItems,
          totalAmountInr: grandTotalInr,
          deliveryAddress: cleanAddress,
          pinCode: cleanPin,
          gpsLat: snapshotLat,
          gpsLng: snapshotLng,
          paymentMethod,
          orderStatus: 'pending',
          forceRetry: false,
        });
      }

      // Sync customer name/phone on profile without touching past orders
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          name: cleanCustomerName,
          email: cleanCustomerEmail,
          phone: cleanCustomerPhone,
          ...(!customerProfile.defaultAddress
            ? { defaultAddress: cleanAddress, defaultPinCode: cleanPin }
            : {}),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking
      }

      setLastCreatedOrderId(createdDocId);
      setCart([]);
      setIsCartDrawerOpen(false);
      setActiveSection('my_orders');
    } catch (err) {
      setOrderErrorHi(
        err instanceof Error
          ? t(
              'ऑर्डर सहेजने में समस्या आई। कृपया पुनः प्रयास करें।',
              'Could not place order. Please try again.'
            )
          : t('ऑर्डर सहेजने में त्रुटि हुई।', 'Error placing order.')
      );
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Automatic Server-Side Meta WhatsApp Business Cloud API Order Notification Helper
  // Sends BOTH:
  //   1. Admin Order Notification to +91 7507505064
  //   2. Customer Order Confirmation to Customer's WhatsApp Number
  // Enforces strict deduplication and never marks 'sent' unless genuinely delivered via Meta Cloud API.
  const triggerServerWhatsAppOrderNotification = async (params: {
    orderId: string;
    customerName: string;
    customerPhone: string;
    itemsSummary: string;
    items?: Array<{
      productName: string;
      companyName: string;
      weight: string;
      priceInr: number | string;
      quantity: number | string;
    }>;
    totalAmountInr: number;
    deliveryAddress: string;
    pinCode: string;
    gpsLat?: number;
    gpsLng?: number;
    paymentMethod: string;
    orderStatus?: string;
    forceRetry?: boolean;
  }) => {
    const cleanOrderId = (params.orderId || '').trim();
    if (!cleanOrderId) return;

    const dedupKey = `${cleanOrderId}:new_order`;
    if (!params.forceRetry && notifiedOrderIdsRef.current.has(dedupKey)) {
      return;
    }
    notifiedOrderIdsRef.current.add(dedupKey);

    try {
      const adminWaDigits = normalizeAdminWhatsappDigits(
        appSettings.whatsappNumber || appSettings.contactWhatsapp || '7507505064'
      );
      const response = await fetch('/api/whatsapp/order-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          adminWhatsappNumber: adminWaDigits,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: 'sent' | 'failed' | 'not_configured';
        messageId?: string;
        errorHi?: string;
        errorEn?: string;
        adminNotification?: {
          ok?: boolean;
          status?: 'sent' | 'failed' | 'not_configured';
          messageId?: string;
          errorHi?: string;
          errorEn?: string;
        };
        customerNotification?: {
          ok?: boolean;
          status?: 'sent' | 'failed' | 'not_configured';
          messageId?: string;
          errorHi?: string;
          errorEn?: string;
        };
      };

      const adminBlock = result.adminNotification || result;
      const custBlock = result.customerNotification || result;

      // Admin Notification Status (+91 7507505064)
      const adminGenuinelySent = Boolean(
        response.ok &&
          adminBlock.ok &&
          adminBlock.status === 'sent' &&
          adminBlock.messageId
      );
      const adminResolvedStatus: 'sent' | 'failed' | 'not_configured' = adminGenuinelySent
        ? 'sent'
        : adminBlock.status === 'not_configured'
        ? 'not_configured'
        : 'failed';
      const adminResolvedError = adminGenuinelySent
        ? ''
        : (
            adminBlock.errorHi ||
            adminBlock.errorEn ||
            'Admin WhatsApp Cloud API notification was not sent. Order is safely saved in Firebase.'
          ).slice(0, 490);

      // Customer Order Confirmation Status
      const custGenuinelySent = Boolean(
        response.ok &&
          custBlock.ok &&
          custBlock.status === 'sent' &&
          custBlock.messageId
      );
      const custResolvedStatus: 'sent' | 'failed' | 'not_configured' = custGenuinelySent
        ? 'sent'
        : custBlock.status === 'not_configured'
        ? 'not_configured'
        : 'failed';
      const custResolvedError = custGenuinelySent
        ? ''
        : (
            custBlock.errorHi ||
            custBlock.errorEn ||
            'Customer WhatsApp Order Confirmation was not sent. Order is safely saved in Firebase.'
          ).slice(0, 490);

      await updateDoc(doc(db, 'orders', cleanOrderId), {
        whatsappNotificationStatus: adminResolvedStatus,
        whatsappNotificationError: adminResolvedError,
        ...(adminGenuinelySent && adminBlock.messageId
          ? { whatsappMessageId: String(adminBlock.messageId).slice(0, 140) }
          : {}),
        customerWhatsappStatus: custResolvedStatus,
        customerWhatsappError: custResolvedError,
        ...(custGenuinelySent && custBlock.messageId
          ? { customerWhatsappMessageId: String(custBlock.messageId).slice(0, 140) }
          : {}),
        customerWhatsappLastEvent: 'order_placed',
        whatsappNotifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message.slice(0, 450)
          : 'Network error while contacting WhatsApp notification server';
      try {
        await updateDoc(doc(db, 'orders', cleanOrderId), {
          whatsappNotificationStatus: 'failed',
          whatsappNotificationError: `${errMsg} (ऑर्डर Firebase में पूरी तरह सुरक्षित है)`,
          customerWhatsappStatus: 'failed',
          customerWhatsappError: `${errMsg} (ऑर्डर Firebase में पूरी तरह सुरक्षित है)`,
          customerWhatsappLastEvent: 'order_placed',
          whatsappNotifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking: Order remains safely saved in Firestore
      }
    }
  };

  // Automatic Server-Side Customer WhatsApp Status Update Helper (when Admin marks Confirm, Complete, or Cancel)
  const triggerServerCustomerStatusWhatsApp = async (
    ord: TeaOrderRecord,
    nextStatus: TeaOrderRecord['status'],
    forceRetry = false
  ) => {
    const cleanOrderId = (ord.id || '').trim();
    if (!cleanOrderId) return;

    const statusDedupKey = `${cleanOrderId}:status:${nextStatus}`;
    if (!forceRetry && notifiedOrderIdsRef.current.has(statusDedupKey)) {
      return;
    }
    notifiedOrderIdsRef.current.add(statusDedupKey);

    const parsedItems = parseOrderItemsSummary(
      ord.itemsSummary,
      ord.totalItemsCount,
      ord.totalAmountInr
    );
    const mobileDisplay = formatOrderMobileDisplay(ord, adminCustomers);

    try {
      const response = await fetch('/api/whatsapp/order-status-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: cleanOrderId,
          orderStatus: nextStatus,
          customerName: ord.customerName,
          customerPhone: mobileDisplay,
          itemsSummary: ord.itemsSummary,
          items: parsedItems.map((it) => ({
            productName: it.productName,
            companyName: it.companyName,
            weight: it.weight,
            priceInr: it.priceDisplay.replace(/[^\d.]/g, '') || ord.totalAmountInr,
            quantity: it.quantity,
          })),
          totalAmountInr: ord.totalAmountInr,
          deliveryAddress: ord.gpsAddress || ord.deliveryAddress,
          pinCode: ord.pinCode,
          paymentMethod: ord.paymentMethod,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: 'sent' | 'failed' | 'not_configured';
        messageId?: string;
        errorHi?: string;
        errorEn?: string;
      };

      const genuinelySent = Boolean(
        response.ok && result.ok && result.status === 'sent' && result.messageId
      );
      const resolvedStatus: 'sent' | 'failed' | 'not_configured' = genuinelySent
        ? 'sent'
        : result.status === 'not_configured'
        ? 'not_configured'
        : 'failed';
      const resolvedError = genuinelySent
        ? ''
        : (
            result.errorHi ||
            result.errorEn ||
            `Customer WhatsApp status update (${nextStatus}) could not be sent via Cloud API.`
          ).slice(0, 490);

      await updateDoc(doc(db, 'orders', cleanOrderId), {
        customerWhatsappStatus: resolvedStatus,
        customerWhatsappError: resolvedError,
        ...(genuinelySent && result.messageId
          ? { customerWhatsappMessageId: String(result.messageId).slice(0, 140) }
          : {}),
        customerWhatsappLastEvent: nextStatus,
        whatsappNotifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message.slice(0, 450) : 'Network error sending status update';
      try {
        await updateDoc(doc(db, 'orders', cleanOrderId), {
          customerWhatsappStatus: 'failed',
          customerWhatsappError: `${errMsg} (ऑर्डर स्टेटस Firebase में सुरक्षित अपडेट है)`,
          customerWhatsappLastEvent: nextStatus,
          whatsappNotifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking
      }
    }
  };

  // Admin manually retries Server-Side WhatsApp Cloud API Notification (Admin + Customer) for an order
  const handleAdminRetryOrderWhatsApp = async (ord: TeaOrderRecord) => {
    if (!isAdminUser) return;
    const bothAlreadySent =
      ord.whatsappNotificationStatus === 'sent' &&
      Boolean(ord.whatsappMessageId) &&
      ord.customerWhatsappStatus === 'sent' &&
      Boolean(ord.customerWhatsappMessageId);

    if (bothAlreadySent) {
      setAdminCustomerStatusHi(
        t(
          `ऑर्डर #${ord.id.slice(0, 8).toUpperCase()} का Admin और Customer दोनों WhatsApp नोटिफिकेशन पहले ही भेजा जा चुका है (Duplicate Notification रोक दिया गया है)।`,
          `Both Admin and Customer WhatsApp notifications for Order #${ord.id
            .slice(0, 8)
            .toUpperCase()} were already sent (duplicate notifications are blocked).`
        )
      );
      return;
    }

    setRetryingWhatsappOrderId(ord.id);
    const parsedItems = parseOrderItemsSummary(
      ord.itemsSummary,
      ord.totalItemsCount,
      ord.totalAmountInr
    );
    const mobileDisplay = formatOrderMobileDisplay(ord, adminCustomers);
    const orderGpsCoords = resolveOrderGpsCoordinates(ord, adminCustomers);
    const adminWaDigits = normalizeAdminWhatsappDigits(
      appSettings.whatsappNumber || appSettings.contactWhatsapp || '7507505064'
    );
    const adminOrderMsg = buildOrderWhatsAppNotificationText(
      ord,
      parsedItems,
      mobileDisplay,
      orderGpsCoords
    );
    const customerOrderMsg = buildCustomerWhatsAppNotificationText(
      ord,
      parsedItems,
      ord.status
    );
    const adminWaUrl = buildAdminWhatsappChatUrl(adminWaDigits, adminOrderMsg);
    const customerWaUrl = buildCustomerDirectWhatsappUrl(mobileDisplay, customerOrderMsg);

    if (!whatsappCloudConfig?.configured) {
      setActiveOrderWhatsappModal({
        orderId: ord.id,
        shortOrderId: `#${ord.id.slice(0, 8).toUpperCase()}`,
        customerName: ord.customerName,
        customerPhoneDisplay: mobileDisplay,
        adminPhoneDisplay: formatAdminWhatsappDisplay(adminWaDigits),
        totalAmountInr: ord.totalAmountInr,
        orderStatus: ord.status,
        eventType: 'admin_new_order_alert',
        adminWhatsappUrl: adminWaUrl,
        customerWhatsappUrl: customerWaUrl,
        adminMessagePreview: adminOrderMsg,
        customerMessagePreview: customerOrderMsg,
        autoOpenedTarget: 'admin',
      });
    }

    try {
      await triggerServerWhatsAppOrderNotification({
        orderId: ord.id,
        customerName: ord.customerName,
        customerPhone: mobileDisplay,
        itemsSummary: ord.itemsSummary,
        items: parsedItems.map((it) => ({
          productName: it.productName,
          companyName: it.companyName,
          weight: it.weight,
          priceInr: it.priceDisplay.replace(/[^\d.]/g, '') || ord.totalAmountInr,
          quantity: it.quantity,
        })),
        totalAmountInr: ord.totalAmountInr,
        deliveryAddress: ord.gpsAddress || ord.deliveryAddress,
        pinCode: ord.pinCode,
        gpsLat: orderGpsCoords?.lat,
        gpsLng: orderGpsCoords?.lng,
        paymentMethod: ord.paymentMethod,
        orderStatus: ord.status,
        forceRetry: true,
      });

      if (ord.status !== 'pending') {
        await triggerServerCustomerStatusWhatsApp(ord, ord.status, true);
      }
    } finally {
      setRetryingWhatsappOrderId(null);
    }
  };

  // Admin requests an 8-digit Mobile Pairing Code to connect +91 7507505064 for 100% Automatic Server WhatsApp delivery
  const handleAdminRequestPairingCode = async (overridePhone?: string) => {
    if (!isAdminUser) return;
    setWhatsappBridgeActionLoading(true);
    setWhatsappBridgeFeedbackHi(null);
    try {
      const candidatePhone =
        overridePhone ||
        adminConnectPhoneInput ||
        appSettings.whatsappNumber ||
        appSettings.contactWhatsapp ||
        '7507505064';
      const adminWaDigits = normalizeAdminWhatsappDigits(candidatePhone);
      const res = await fetch('/api/whatsapp/request-pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: adminWaDigits }),
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.ok) {
        setWhatsappCloudConfig((prev) =>
          prev
            ? {
                ...prev,
                configured: Boolean(data.bridgeConnected || prev.cloudConfigured),
                bridgeConnected: Boolean(data.bridgeConnected),
                bridgeState: data.bridgeState || 'pairing_code_ready',
                pairingCode: data.pairingCode || prev.pairingCode,
                pairingPhone: data.pairingPhone || `+91 ${adminWaDigits}`,
                qrDataUrl: data.qrDataUrl || prev.qrDataUrl,
              }
            : prev
        );
        if (data.pairingCode) {
          setWhatsappBridgeFeedbackHi(
            t(
              `8-अक्षरों का पेयरिंग कोड तैयार है: ${data.pairingCode} — इसे अपने WhatsApp (+91 ${adminWaDigits}) के Linked Devices में डालें।`,
              `8-Letter Pairing Code ready: ${data.pairingCode} — Enter this in WhatsApp (+91 ${adminWaDigits}) -> Linked Devices.`
            )
          );
        }
      } else {
        setWhatsappBridgeFeedbackHi(
          data.errorHi ||
            data.error ||
            t(
              'पेयरिंग कोड प्राप्त करने में समस्या आई। कृपया पुनः प्रयास करें।',
              'Could not generate pairing code. Please try again.'
            )
        );
      }
    } catch {
      setWhatsappBridgeFeedbackHi(
        t(
          'सर्वर से संपर्क करने में त्रुटि हुई। कृपया पुनः प्रयास करें।',
          'Error contacting server. Please try again.'
        )
      );
    } finally {
      setWhatsappBridgeActionLoading(false);
    }
  };

  // Admin refreshes QR code for Server WhatsApp Multi-Device Bridge
  const handleAdminRefreshWhatsappQr = async () => {
    if (!isAdminUser) return;
    setWhatsappBridgeActionLoading(true);
    setWhatsappBridgeFeedbackHi(null);
    try {
      const res = await fetch('/api/whatsapp/refresh-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.ok) {
        setWhatsappCloudConfig((prev) =>
          prev
            ? {
                ...prev,
                configured: Boolean(data.bridgeConnected || prev.cloudConfigured),
                bridgeConnected: Boolean(data.bridgeConnected),
                bridgeState: data.bridgeState || 'qr_ready',
                qrDataUrl: data.qrDataUrl || null,
                pairingCode: data.pairingCode || prev.pairingCode || null,
                pairingPhone: data.pairingPhone || prev.pairingPhone,
              }
            : prev
        );
        setWhatsappBridgeFeedbackHi(
          t(
            'नया WhatsApp QR कोड जनरेट हो गया है। अपने फोन से स्कैन करें या 8-अंकों का पेयरिंग कोड उपयोग करें।',
            'Fresh WhatsApp QR code generated. Scan with your phone or use the 8-digit pairing code.'
          )
        );
      }
    } catch {
      // Ignore
    } finally {
      setWhatsappBridgeActionLoading(false);
    }
  };

  // Admin sends an instant Test Automatic WhatsApp Message from server to +91 7507505064
  const handleAdminSendTestWhatsapp = async () => {
    if (!isAdminUser) return;
    setWhatsappBridgeActionLoading(true);
    setWhatsappBridgeFeedbackHi(null);
    try {
      const adminWaDigits = normalizeAdminWhatsappDigits(
        appSettings.whatsappNumber || appSettings.contactWhatsapp || '7507505064'
      );
      const res = await fetch('/api/whatsapp/test-admin-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminWhatsappNumber: adminWaDigits }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setWhatsappBridgeFeedbackHi(
          t(
            `✓ सफल! सर्वर से +91 ${adminWaDigits} पर ऑटोमैटिक टेस्ट WhatsApp मैसेज भेज दिया गया है (Message ID: ${data.messageId})।`,
            `✓ Success! Automatic test WhatsApp message sent from server to +91 ${adminWaDigits} (Message ID: ${data.messageId}).`
          )
        );
      } else {
        setWhatsappBridgeFeedbackHi(
          data.errorHi ||
            t(
              'टेस्ट मैसेज नहीं भेजा जा सका — कृपया पहले +91 7507505064 को 8-अंकों के कोड या QR से लिंक करें।',
              'Could not send test message — please link +91 7507505064 via 8-digit code or QR first.'
            )
        );
      }
    } catch {
      setWhatsappBridgeFeedbackHi(
        t('टेस्ट मैसेज भेजने में नेटवर्क त्रुटि हुई।', 'Network error sending test message.')
      );
    } finally {
      setWhatsappBridgeActionLoading(false);
    }
  };

  // Admin disconnects the linked WhatsApp session if needed
  const handleAdminDisconnectWhatsappBridge = async () => {
    if (!isAdminUser) return;
    setWhatsappBridgeActionLoading(true);
    setWhatsappBridgeFeedbackHi(null);
    try {
      await fetch('/api/whatsapp/disconnect-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const statusRes = await fetch('/api/whatsapp/config-status').then((r) => r.json());
      if (statusRes && statusRes.ok) {
        setWhatsappCloudConfig({
          configured: Boolean(statusRes.configured),
          cloudConfigured: Boolean(statusRes.cloudConfigured),
          bridgeConnected: Boolean(statusRes.bridgeConnected),
          bridgeState: statusRes.bridgeState || 'qr_ready',
          connectedWhatsAppPhone: statusRes.connectedWhatsAppPhone || null,
          qrDataUrl: statusRes.qrDataUrl || null,
          pairingCode: statusRes.pairingCode || null,
          pairingPhone: statusRes.pairingPhone || null,
          pendingQueueCount: Number(statusRes.pendingQueueCount || 0),
          lastError: statusRes.lastError || null,
          hasAccessToken: Boolean(statusRes.hasAccessToken),
          hasPhoneNumberId: Boolean(statusRes.hasPhoneNumberId),
          apiVersion: String(statusRes.apiVersion || 'v20.0'),
          targetAdminNumber: String(statusRes.targetAdminNumber || '+91 7507505064'),
        });
      }
    } catch {
      // Ignore
    } finally {
      setWhatsappBridgeActionLoading(false);
    }
  };

  // Auto-request pairing code when Admin views new_orders tab if not yet connected
  useEffect(() => {
    if (
      isAdminUser &&
      adminActiveTab === 'new_orders' &&
      !whatsappCloudConfig?.bridgeConnected &&
      !whatsappCloudConfig?.pairingCode &&
      !whatsappBridgeActionLoading
    ) {
      void handleAdminRequestPairingCode();
    }
  }, [
    isAdminUser,
    adminActiveTab,
    whatsappCloudConfig?.bridgeConnected,
    whatsappCloudConfig?.pairingCode,
    whatsappBridgeActionLoading,
  ]);

  // Customer cancels their own pending order
  const handleCustomerCancelOrder = async (order: TeaOrderRecord) => {
    if (!currentUser || order.status !== 'pending') return;
    const orderPath = `orders/${order.id}`;
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, orderPath);
    }
  };

  // Admin updates any order status (Confirm, Shipped, Cancel, etc.) + sends Customer WhatsApp Status Update
  const handleAdminUpdateOrderStatus = async (
    orderId: string,
    nextStatus: TeaOrderRecord['status']
  ) => {
    if (!isAdminUser) return;
    setAdminActionLoadingId(orderId);
    const orderPath = `orders/${orderId}`;
    const targetOrder = adminOrders.find((o) => o.id === orderId);

    // Synchronously prepare and launch Customer WhatsApp Status Update inside the Admin's click gesture if Cloud API is not configured
    if (targetOrder) {
      const updatedOrd: TeaOrderRecord = { ...targetOrder, status: nextStatus };
      const parsedItems = parseOrderItemsSummary(
        updatedOrd.itemsSummary,
        updatedOrd.totalItemsCount,
        updatedOrd.totalAmountInr
      );
      const mobileDisplay = formatOrderMobileDisplay(updatedOrd, adminCustomers);
      const gpsCoords = resolveOrderGpsCoordinates(updatedOrd, adminCustomers);
      const adminWaDigits = normalizeAdminWhatsappDigits(
        appSettings.whatsappNumber || appSettings.contactWhatsapp || '7507505064'
      );
      const customerStatusMsg = buildCustomerWhatsAppNotificationText(
        updatedOrd,
        parsedItems,
        nextStatus
      );
      const adminStatusMsg = buildOrderWhatsAppNotificationText(
        updatedOrd,
        parsedItems,
        mobileDisplay,
        gpsCoords
      );
      const customerWaUrl = buildCustomerDirectWhatsappUrl(mobileDisplay, customerStatusMsg);
      const adminWaUrl = buildAdminWhatsappChatUrl(adminWaDigits, adminStatusMsg);

      if (!whatsappCloudConfig?.configured) {
        setActiveOrderWhatsappModal({
          orderId: updatedOrd.id,
          shortOrderId: `#${updatedOrd.id.slice(0, 8).toUpperCase()}`,
          customerName: updatedOrd.customerName,
          customerPhoneDisplay: mobileDisplay,
          adminPhoneDisplay: formatAdminWhatsappDisplay(adminWaDigits),
          totalAmountInr: updatedOrd.totalAmountInr,
          orderStatus: nextStatus,
          eventType: 'status_updated',
          adminWhatsappUrl: adminWaUrl,
          customerWhatsappUrl: customerWaUrl,
          adminMessagePreview: adminStatusMsg,
          customerMessagePreview: customerStatusMsg,
          autoOpenedTarget: 'customer',
        });
      }
    }

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus,
        ...(nextStatus === 'delivered'
          ? { deliveredAt: serverTimestamp(), completedAt: serverTimestamp() }
          : {}),
        customerWhatsappStatus: 'sending',
        customerWhatsappLastEvent: nextStatus,
        updatedAt: serverTimestamp(),
      });

      if (targetOrder) {
        void triggerServerCustomerStatusWhatsApp(
          { ...targetOrder, status: nextStatus },
          nextStatus,
          false
        );
      }

      setAdminCustomerStatusHi(
        t(
          `ऑर्डर #${orderId.slice(0, 8).toUpperCase()} का स्टेटस "${getOrderStatusLabel(
            nextStatus
          )}" अपडेट कर दिया गया है और कस्टमर WhatsApp स्टेटस अपडेट खोल दिया गया है।`,
          `Order #${orderId.slice(0, 8).toUpperCase()} status updated to "${getOrderStatusLabel(
            nextStatus
          )}" and Customer WhatsApp status update triggered.`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, orderPath);
    } finally {
      setAdminActionLoadingId(null);
    }
  };

  // Admin saves/updates a live note on a Customer's order (immediately visible to Customer)
  const handleAdminSaveOrderNote = async (orderId: string) => {
    if (!isAdminUser) return;
    const draftNote = (orderAdminNoteDrafts[orderId] ?? '').trim().slice(0, 300);
    setAdminActionLoadingId(orderId);
    const orderPath = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        adminNoteHi: draftNote,
        updatedAt: serverTimestamp(),
      });
      setAdminCustomerStatusHi(
        t(
          'ग्राहक के ऑर्डर पर एडमिन अपडेट संदेश भेज दिया गया है!',
          'Admin note sent to the customer order in real time!'
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, orderPath);
    } finally {
      setAdminActionLoadingId(null);
    }
  };

  // Admin marks a New Order as Complete (status -> 'delivered') + sends Customer WhatsApp Status Update
  const handleAdminMarkOrderComplete = async (orderId: string) => {
    if (!isAdminUser) return;
    setAdminActionLoadingId(orderId);
    const orderPath = `orders/${orderId}`;
    const targetOrder = adminOrders.find((o) => o.id === orderId);

    // Synchronously prepare and launch Customer WhatsApp Status Update (Complete) inside Admin's click gesture if Cloud API is not configured
    if (targetOrder) {
      const updatedOrd: TeaOrderRecord = { ...targetOrder, status: 'delivered' };
      const parsedItems = parseOrderItemsSummary(
        updatedOrd.itemsSummary,
        updatedOrd.totalItemsCount,
        updatedOrd.totalAmountInr
      );
      const mobileDisplay = formatOrderMobileDisplay(updatedOrd, adminCustomers);
      const gpsCoords = resolveOrderGpsCoordinates(updatedOrd, adminCustomers);
      const adminWaDigits = normalizeAdminWhatsappDigits(
        appSettings.whatsappNumber || appSettings.contactWhatsapp || '7507505064'
      );
      const customerStatusMsg = buildCustomerWhatsAppNotificationText(
        updatedOrd,
        parsedItems,
        'delivered'
      );
      const adminStatusMsg = buildOrderWhatsAppNotificationText(
        updatedOrd,
        parsedItems,
        mobileDisplay,
        gpsCoords
      );
      const customerWaUrl = buildCustomerDirectWhatsappUrl(mobileDisplay, customerStatusMsg);
      const adminWaUrl = buildAdminWhatsappChatUrl(adminWaDigits, adminStatusMsg);

      if (!whatsappCloudConfig?.configured) {
        setActiveOrderWhatsappModal({
          orderId: updatedOrd.id,
          shortOrderId: `#${updatedOrd.id.slice(0, 8).toUpperCase()}`,
          customerName: updatedOrd.customerName,
          customerPhoneDisplay: mobileDisplay,
          adminPhoneDisplay: formatAdminWhatsappDisplay(adminWaDigits),
          totalAmountInr: updatedOrd.totalAmountInr,
          orderStatus: 'delivered',
          eventType: 'status_updated',
          adminWhatsappUrl: adminWaUrl,
          customerWhatsappUrl: customerWaUrl,
          adminMessagePreview: adminStatusMsg,
          customerMessagePreview: customerStatusMsg,
          autoOpenedTarget: 'customer',
        });
      }
    }

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'delivered',
        deliveredAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        customerWhatsappStatus: 'sending',
        customerWhatsappLastEvent: 'delivered',
        updatedAt: serverTimestamp(),
      });

      if (targetOrder) {
        void triggerServerCustomerStatusWhatsApp(
          { ...targetOrder, status: 'delivered' },
          'delivered',
          false
        );
      }

      setAdminCustomerStatusHi(
        t(
          `ऑर्डर #${orderId.slice(0, 8).toUpperCase()} को सफलतापूर्वक Complete (डिलीवर) मार्क कर दिया गया है और कस्टमर को WhatsApp स्टेटस अपडेट भेजने के लिए खोल दिया गया है!`,
          `Order #${orderId.slice(0, 8).toUpperCase()} marked as Complete and Customer WhatsApp status update triggered!`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, orderPath);
    } finally {
      setAdminActionLoadingId(null);
    }
  };

  // Admin requests deleting an Order (New Order or Complete Order — with Confirmation Popup & Backup/Recovery)
  const handleRequestDeleteCompleteOrder = (ord: TeaOrderRecord) => {
    if (!isAdminUser) return;
    const isComplete = ord.status === 'delivered';
    setAdminConfirmModal({
      titleHi: isComplete
        ? 'Complete Order डिलीट करने की पुष्टि करें'
        : 'ऑर्डर (Order) डिलीट करने की पुष्टि करें',
      titleEn: isComplete ? 'Confirm Delete Complete Order' : 'Confirm Delete Order',
      messageHi: `क्या आप वाकई ग्राहक "${ord.customerName}" का ऑर्डर #${ord.id
        .slice(0, 8)
        .toUpperCase()} (₹${ord.totalAmountInr}) डिलीट करना चाहते हैं? गलत डिलीट से बचाने के लिए इसे बैकअप/रिकवरी बिन में सुरक्षित रखा जाएगा।`,
      messageEn: `Are you sure you want to delete Order #${ord.id
        .slice(0, 8)
        .toUpperCase()} (₹${ord.totalAmountInr}) for "${
        ord.customerName
      }"? It will be safely moved to the Backup/Recovery bin so it can be restored if needed.`,
      confirmLabelHi: 'हाँ, ऑर्डर डिलीट करें',
      confirmLabelEn: 'Yes, Delete Order',
      onConfirm: async () => {
        setAdminActionLoadingId(ord.id);
        const orderPath = `orders/${ord.id}`;
        try {
          await updateDoc(doc(db, 'orders', ord.id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setAdminCustomerStatusHi(
            t(
              `ऑर्डर #${ord.id.slice(0, 8).toUpperCase()} डिलीट कर दिया गया है (बैकअप/रिकवरी में उपलब्ध)।`,
              `Order #${ord.id.slice(0, 8).toUpperCase()} deleted (available in Backup/Recovery).`
            )
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, orderPath);
        } finally {
          setAdminActionLoadingId(null);
        }
      },
    });
  };

  // Admin restores a deleted Order from Backup/Recovery
  const handleAdminRestoreOrder = async (ord: TeaOrderRecord) => {
    if (!isAdminUser) return;
    setAdminActionLoadingId(ord.id);
    const orderPath = `orders/${ord.id}`;
    try {
      await updateDoc(doc(db, 'orders', ord.id), {
        isDeleted: false,
        updatedAt: serverTimestamp(),
      });
      setAdminCustomerStatusHi(
        t(
          `ऑर्डर #${ord.id.slice(0, 8)} को सफलतापूर्वक रिकवर (Restore) कर लिया गया है!`,
          `Order #${ord.id.slice(0, 8)} restored successfully!`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, orderPath);
    } finally {
      setAdminActionLoadingId(null);
    }
  };

  // Admin permanently deletes an Order from Backup/Recovery (with Confirmation Popup)
  const handleRequestPermanentDeleteOrder = (ord: TeaOrderRecord) => {
    if (!isAdminUser) return;
    setAdminConfirmModal({
      titleHi: 'ऑर्डर स्थायी रूप से (Permanently) डिलीट करें',
      titleEn: 'Confirm Permanent Order Deletion',
      messageHi: `क्या आप वाकई बैकअप से ऑर्डर #${ord.id.slice(
        0,
        8
      )} को हमेशा के लिए डिलीट करना चाहते हैं? इसके बाद इसे रिकवर नहीं किया जा सकेगा।`,
      messageEn: `Are you sure you want to permanently delete Order #${ord.id.slice(
        0,
        8
      )} from the Backup bin? This action cannot be undone.`,
      confirmLabelHi: 'हाँ, हमेशा के लिए हटाएं',
      confirmLabelEn: 'Yes, Delete Permanently',
      onConfirm: async () => {
        setAdminActionLoadingId(ord.id);
        const orderPath = `orders/${ord.id}`;
        try {
          await deleteDoc(doc(db, 'orders', ord.id));
          setAdminCustomerStatusHi(
            t(
              `ऑर्डर #${ord.id.slice(0, 8)} स्थायी रूप से डिलीट कर दिया गया है।`,
              `Order #${ord.id.slice(0, 8)} permanently deleted.`
            )
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, orderPath);
        } finally {
          setAdminActionLoadingId(null);
        }
      },
    });
  };

  // Admin requests deleting a Customer (with Confirmation Popup & Backup/Recovery)
  const handleRequestDeleteCustomer = (cust: CustomerProfileData) => {
    if (!isAdminUser) return;
    setAdminConfirmModal({
      titleHi: 'ग्राहक (Customer) डिलीट करने की पुष्टि करें',
      titleEn: 'Confirm Customer Deletion',
      messageHi: `क्या आप वाकई ग्राहक "${cust.name}" (${formatCustomerContactDisplay(
        cust.email,
        cust.phone
      )}) को डिलीट करना चाहते हैं? गलत डिलीट से बचाने के लिए ग्राहक का डेटा बैकअप/रिकवरी में सुरक्षित रहेगा।`,
      messageEn: `Are you sure you want to delete customer "${
        cust.name
      }" (${formatCustomerContactDisplay(
        cust.email,
        cust.phone
      )})? Their record will be moved to Backup/Recovery so it can be restored if needed.`,
      confirmLabelHi: 'हाँ, ग्राहक डिलीट करें',
      confirmLabelEn: 'Yes, Delete Customer',
      onConfirm: async () => {
        setAdminActionLoadingId(cust.uid);
        const userPath = `users/${cust.uid}`;
        try {
          await updateDoc(doc(db, 'users', cust.uid), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (editingCustomerUid === cust.uid) {
            setEditingCustomerUid(null);
          }
          setAdminCustomerStatusHi(
            t(
              `ग्राहक "${cust.name}" को डिलीट कर दिया गया है (बैकअप/रिकवरी में उपलब्ध)।`,
              `Customer "${cust.name}" moved to Backup/Recovery.`
            )
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, userPath);
        } finally {
          setAdminActionLoadingId(null);
        }
      },
    });
  };

  // Admin restores a deleted Customer from Backup/Recovery
  const handleAdminRestoreCustomer = async (cust: CustomerProfileData) => {
    if (!isAdminUser) return;
    setAdminActionLoadingId(cust.uid);
    const userPath = `users/${cust.uid}`;
    try {
      await updateDoc(doc(db, 'users', cust.uid), {
        isDeleted: false,
        updatedAt: serverTimestamp(),
      });
      setAdminCustomerStatusHi(
        t(
          `ग्राहक "${cust.name}" को सफलतापूर्वक रिकवर (Restore) कर लिया गया है!`,
          `Customer "${cust.name}" restored successfully!`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    } finally {
      setAdminActionLoadingId(null);
    }
  };

  // Admin permanently deletes a Customer from Backup/Recovery (with Confirmation Popup)
  const handleRequestPermanentDeleteCustomer = (cust: CustomerProfileData) => {
    if (!isAdminUser) return;
    setAdminConfirmModal({
      titleHi: 'ग्राहक स्थायी रूप से (Permanently) डिलीट करें',
      titleEn: 'Confirm Permanent Customer Deletion',
      messageHi: `क्या आप वाकई बैकअप से ग्राहक "${cust.name}" को हमेशा के लिए डिलीट करना चाहते हैं? इसके बाद इसे रिकवर नहीं किया जा सकेगा।`,
      messageEn: `Are you sure you want to permanently delete customer "${cust.name}" from the Backup bin? This action cannot be undone.`,
      confirmLabelHi: 'हाँ, हमेशा के लिए हटाएं',
      confirmLabelEn: 'Yes, Delete Permanently',
      onConfirm: async () => {
        setAdminActionLoadingId(cust.uid);
        const userPath = `users/${cust.uid}`;
        try {
          await deleteDoc(doc(db, 'users', cust.uid));
          setAdminCustomerStatusHi(
            t(
              `ग्राहक "${cust.name}" स्थायी रूप से डिलीट कर दिया गया है।`,
              `Customer "${cust.name}" permanently deleted.`
            )
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, userPath);
        } finally {
          setAdminActionLoadingId(null);
        }
      },
    });
  };

  // Admin starts editing a Customer's profile & live message
  const handleAdminStartEditCustomer = (cust: CustomerProfileData) => {
    setAdminActiveTab('customers');
    setEditingCustomerUid(cust.uid);
    setEditCustName(cust.name || '');
    setEditCustEmail(cust.email && cust.email !== '—' ? cust.email : '');
    setEditCustAddress(cust.defaultAddress || '');
    setEditCustPin(cust.defaultPinCode || '');
    setEditCustAdminNote(cust.adminNoteHi || '');
    setAdminCustomerStatusHi(null);
  };

  // Admin saves updates to a Customer's profile & live message (/users/{uid})
  const handleAdminSaveCustomerUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminUser || !editingCustomerUid) return;
    setAdminCustomerStatusHi(null);

    const cleanName = editCustName.trim().slice(0, 80);
    const cleanEmail = (editCustEmail.trim() || 'customer@chairoz.in').slice(0, 120);
    const cleanAddress = editCustAddress.trim().slice(0, 300);
    const cleanPin = editCustPin.replace(/\D/g, '').slice(0, 6);
    const cleanNote = editCustAdminNote.trim().slice(0, 300);

    if (cleanName.length < 2) {
      setAdminProductErrorHi(
        t(
          'ग्राहक का नाम कम से कम 2 अक्षर का होना चाहिए।',
          'Customer name must be at least 2 characters.'
        )
      );
      return;
    }
    if (cleanEmail.length < 3 || !cleanEmail.includes('@')) {
      setAdminProductErrorHi(
        t('कृपया वैध ईमेल आईडी डालें।', 'Please enter a valid Email ID.')
      );
      return;
    }
    if (cleanPin.length > 0 && !/^[1-9][0-9]{5}$/.test(cleanPin)) {
      setAdminProductErrorHi(
        t('कृपया सही 6-अंकों का पिन कोड डालें।', 'Please enter a valid 6-digit PIN Code.')
      );
      return;
    }

    setSavingCustomerUpdate(true);
    const userPath = `users/${editingCustomerUid}`;
    try {
      await updateDoc(doc(db, 'users', editingCustomerUid), {
        name: cleanName,
        email: cleanEmail,
        defaultAddress: cleanAddress,
        defaultPinCode: cleanPin,
        adminNoteHi: cleanNote,
        updatedAt: serverTimestamp(),
      });
      setAdminCustomerStatusHi(
        t(
          `ग्राहक "${cleanName}" का डेटा और संदेश सफलतापूर्वक अपडेट हो गया! यह ग्राहक को तुरंत दिखेगा।`,
          `Customer "${cleanName}" data and message updated! Visible to the customer immediately.`
        )
      );
      setEditingCustomerUid(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    } finally {
      setSavingCustomerUpdate(false);
    }
  };

  // =========================================================================
  // ADMIN PRODUCT LAUNCH, PHOTO UPLOAD, EDIT, PUBLISH/UNPUBLISH & DELETE
  // =========================================================================

  // Compress & resize uploaded product image so it stores cleanly in Firestore
  const handleAdminPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdminProductErrorHi(null);

    if (!file.type.startsWith('image/')) {
      setAdminProductErrorHi(
        t('कृपया केवल फोटो फ़ाइल (JPG, PNG, WEBP) चुनें।', 'Please select a valid image file (JPG, PNG, WEBP).')
      );
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 640;
        const maxHeight = 480;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
          if (compressedDataUrl.length <= 240000) {
            setAdminProdPhotoUrl(compressedDataUrl);
          } else {
            const smallerDataUrl = canvas.toDataURL('image/jpeg', 0.5);
            setAdminProdPhotoUrl(smallerDataUrl.slice(0, 240000));
          }
        }
        setUploadingPhoto(false);
      };
      img.onerror = () => {
        setUploadingPhoto(false);
        setAdminProductErrorHi(
          t('फोटो प्रोसेस करने में समस्या आई। कृपया दूसरी फोटो चुनें।', 'Could not process image. Please try another file.')
        );
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.onerror = () => {
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAdminSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminUser) return;
    setAdminProductErrorHi(null);
    setAdminProductStatusHi(null);

    const trimmedName = adminProdName.trim();
    const trimmedCompany = adminProdCompanyName.trim();
    const cleanPhotoUrl = adminProdPhotoUrl.trim().slice(0, 240000);
    const rawWeight = adminProdWeightInput.trim();
    const parsedPrice = parseInt(adminProdPrice.replace(/\D/g, ''), 10);

    // Parse weight (supports Grams or Kg, e.g. "250g", "500 Grams", "1 Kg", "1.5 Kg", or "250")
    const numMatch = rawWeight.match(/(\d+(\.\d+)?)/);
    const numericWeight = numMatch ? parseFloat(numMatch[1]) : NaN;
    const isKgUnit = /(kg|kilo|kilogram|किलो|किग्रा)/i.test(rawWeight);
    const parsedWeightGrams = !isNaN(numericWeight)
      ? Math.round(isKgUnit ? numericWeight * 1000 : numericWeight)
      : NaN;
    const formattedWeightLabel = /^\d+(\.\d+)?$/.test(rawWeight)
      ? `${parsedWeightGrams}g`
      : rawWeight.slice(0, 40);

    if (trimmedName.length < 1 || trimmedName.length > 100) {
      setAdminProductErrorHi(
        t(
          'कृपया 1. Product Name (प्रोडक्ट का नाम) दर्ज करें।',
          'Please enter 1. Product Name.'
        )
      );
      return;
    }
    if (trimmedCompany.length < 1 || trimmedCompany.length > 120) {
      setAdminProductErrorHi(
        t(
          'कृपया 2. Product Company Name (कंपनी का नाम) दर्ज करें।',
          'Please enter 2. Product Company Name.'
        )
      );
      return;
    }
    if (!cleanPhotoUrl) {
      setAdminProductErrorHi(
        t(
          'कृपया 3. Product Photo (प्रोडक्ट की फोटो) अपलोड करें।',
          'Please upload 3. Product Photo.'
        )
      );
      return;
    }
    if (
      !rawWeight ||
      isNaN(parsedWeightGrams) ||
      parsedWeightGrams < 1 ||
      parsedWeightGrams > 50000
    ) {
      setAdminProductErrorHi(
        t(
          'कृपया 4. Product Weight (वज़न — Grams या Kg में, जैसे 250g या 1 Kg) दर्ज करें।',
          'Please enter 4. Product Weight (in Grams or Kg, e.g. 250g or 1 Kg).'
        )
      );
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice < 1 || parsedPrice > 100000) {
      setAdminProductErrorHi(
        t(
          'कृपया 5. Product Price (कीमत ₹1 से ₹1,00,000) दर्ज करें।',
          'Please enter 5. Product Price (₹1 to ₹1,00,000).'
        )
      );
      return;
    }

    setSavingProduct(true);
    try {
      const targetId = editingProductId || `prod_${Date.now()}`;
      const productPath = `products/${targetId}`;

      const productPayload = {
        nameHi: trimmedName,
        nameEn: trimmedName,
        companyName: trimmedCompany,
        categoryHi: trimmedCompany.slice(0, 60),
        descriptionHi: '',
        originHi: 'भारत',
        weightGrams: parsedWeightGrams,
        weightLabel: formattedWeightLabel,
        priceInr: parsedPrice,
        photoUrl: cleanPhotoUrl,
        inStock: true,
        isPublished: true,
        updatedAt: serverTimestamp(),
      };

      if (editingProductId) {
        try {
          await updateDoc(doc(db, 'products', targetId), productPayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, productPath);
        }
        setAdminProductStatusHi(
          t(
            `प्रोडक्ट "${trimmedName}" (${trimmedCompany} · ${formattedWeightLabel} · ₹${parsedPrice}) सफलतापूर्वक अपडेट हो गया!`,
            `Product "${trimmedName}" (${trimmedCompany} · ${formattedWeightLabel} · ₹${parsedPrice}) updated successfully!`
          )
        );
      } else {
        try {
          await setDoc(doc(db, 'products', targetId), {
            id: targetId,
            ...productPayload,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, productPath);
        }
        setAdminProductStatusHi(
          t(
            `नया प्रोडक्ट "${trimmedName}" (${trimmedCompany} · ${formattedWeightLabel} · ₹${parsedPrice}) सफलतापूर्वक जोड़ दिया गया!`,
            `New Product "${trimmedName}" (${trimmedCompany} · ${formattedWeightLabel} · ₹${parsedPrice}) added successfully!`
          )
        );
      }

      // Reset all 5 product form inputs back to completely empty state
      resetAdminProductForm();
    } catch (err) {
      console.error(err);
      setAdminProductErrorHi(
        t('प्रोडक्ट सहेजने में त्रुटि हुई। कृपया पुनः प्रयास करें।', 'Failed to save product. Please try again.')
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const handleStartEditProduct = (prod: TeaProductItem) => {
    setAdminActiveTab('products');
    setEditingProductId(prod.id);
    setAdminProdName(prod.nameHi || '');
    setAdminProdCompanyName(prod.companyName || prod.categoryHi || '');
    setAdminProdPhotoUrl(prod.photoUrl || '');
    setAdminProdWeightInput(formatProductWeight(prod));
    setAdminProdPrice(String(prod.priceInr ?? ''));
    setAdminProductErrorHi(null);
    setAdminProductStatusHi(null);
  };

  const handleAdminDeleteAllProducts = () => {
    if (!isAdminUser) return;
    setAdminConfirmModal({
      titleHi: 'सभी प्रोडक्ट्स डिलीट करने की पुष्टि करें',
      titleEn: 'Confirm Delete All Products',
      messageHi: `क्या आप वाकई कैटलॉग के सभी ${adminAllProducts.length} प्रोडक्ट्स को डिलीट करना चाहते हैं?`,
      messageEn: `Are you sure you want to delete all ${adminAllProducts.length} products from the catalogue?`,
      confirmLabelHi: 'हाँ, सभी प्रोडक्ट्स डिलीट करें',
      confirmLabelEn: 'Yes, Delete All Products',
      onConfirm: async () => {
        setDeletingProducts(true);
        setAdminProductStatusHi(null);
        try {
          const idsToDelete = new Set<string>(adminAllProducts.map((p) => p.id));

          for (const prodId of idsToDelete) {
            const productPath = `products/${prodId}`;
            try {
              await deleteDoc(doc(db, 'products', prodId));
            } catch (err) {
              handleFirestoreError(err, OperationType.DELETE, productPath);
            }
          }
          setCatalogProducts([]);
          setAdminAllProducts([]);
          setCart([]);
          setAdminProductStatusHi(
            t(
              'कस्टमर और एडमिन पैनल से सभी प्रोडक्ट्स डिलीट कर दिए गए हैं।',
              'All products have been deleted from Customer and Admin panels.'
            )
          );
        } catch (err) {
          console.error(err);
          setAdminProductStatusHi(
            t('प्रोडक्ट्स डिलीट करने में त्रुटि हुई।', 'Error deleting products.')
          );
        } finally {
          setDeletingProducts(false);
        }
      },
    });
  };

  const handleAdminDeleteSingleProduct = (productId: string, productName?: string) => {
    if (!isAdminUser) return;
    setAdminConfirmModal({
      titleHi: 'प्रोडक्ट डिलीट करने की पुष्टि करें',
      titleEn: 'Confirm Product Deletion',
      messageHi: `क्या आप वाकई प्रोडक्ट "${productName || productId}" को कैटलॉग से डिलीट करना चाहते हैं?`,
      messageEn: `Are you sure you want to delete product "${
        productName || productId
      }" from the catalogue?`,
      confirmLabelHi: 'हाँ, प्रोडक्ट डिलीट करें',
      confirmLabelEn: 'Yes, Delete Product',
      onConfirm: async () => {
        const productPath = `products/${productId}`;
        try {
          await deleteDoc(doc(db, 'products', productId));
          if (editingProductId === productId) {
            resetAdminProductForm();
          }
          setAdminProductStatusHi(t('प्रोडक्ट डिलीट कर दिया गया है।', 'Product deleted.'));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, productPath);
        }
      },
    });
  };

  // Reusable Segmented Language Switcher (हिंदी | English)
  const renderLanguageSelector = () => (
    <div
      className="inline-flex items-center gap-1 rounded-xl bg-white/95 border border-[#62B37A] p-1 shadow-xs"
      role="group"
      aria-label="Language Selector / भाषा चुनें"
    >
      <Globe className="w-4 h-4 text-[#0B6829] ml-1.5 mr-0.5 shrink-0" />
      <button
        type="button"
        onClick={() => handleLanguageChange('hi')}
        className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
          lang === 'hi'
            ? 'bg-[#0B6829] text-white shadow-2xs'
            : 'text-[#1D3526] hover:bg-[#EAF4EC]'
        }`}
      >
        हिंदी
      </button>
      <button
        type="button"
        onClick={() => handleLanguageChange('en')}
        className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
          lang === 'en'
            ? 'bg-[#0B6829] text-white shadow-2xs'
            : 'text-[#1D3526] hover:bg-[#EAF4EC]'
        }`}
      >
        English
      </button>
    </div>
  );

  /* =========================================================================
     VIEW 1: UNAUTHENTICATED LOGIN, REGISTRATION & FORGOT PASSWORD SCREEN
     (Matches the uploaded GTC Chai Roz™ reference design with Language Switcher)
  ========================================================================= */
  if (!authReady || profileLoading) {
    return (
      <TeaGardenBackdrop>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <ChaiRozHeaderLogo
            lang={lang}
            appName={t(appSettings.appNameHi || 'चाय रोज़', appSettings.appNameEn || 'Chai Roj')}
            companyName={appSettings.companyName || 'Chai Roj'}
            tagline={t(appSettings.taglineHi, appSettings.taglineEn)}
            logoUrl={appSettings.logoUrl}
            primaryColor={appSettings.primaryColor}
          />
          <div className="mt-8 bg-white/95 rounded-3xl px-8 py-6 shadow-xl flex items-center gap-3 text-[#095C24]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-base font-bold">
              {t('आपका सुरक्षित सत्र जांचा जा रहा है...', 'Verifying your secure session...')}
            </span>
          </div>
        </div>
      </TeaGardenBackdrop>
    );
  }

  if (!currentUser || !customerProfile) {
    return (
      <TeaGardenBackdrop>
        <div className="flex-1 w-full max-w-lg mx-auto px-4 pt-3 pb-6 flex flex-col items-center justify-center">
          {/* Top Language Switcher Bar (भाषा / Language: हिंदी | English) */}
          <div className="w-full flex items-center justify-between mb-1">
            <span className="px-3 py-1 rounded-full bg-white/90 border border-[#62B37A] text-[11px] font-bold text-[#0B6829] shadow-2xs">
              {loginRoleTab === 'admin'
                ? t('🔒 अलग एडमिन लॉगिन पेज', '🔒 Separate Admin Login Page')
                : t('👤 ग्राहक लॉगिन पेज', '👤 Customer Login Page')}
            </span>
            {renderLanguageSelector()}
          </div>

          {/* 1. Top CHAI ROS Logo + Title + Tagline (Admin-Controlled) */}
          <ChaiRozHeaderLogo
            lang={lang}
            appName={t(appSettings.appNameHi || 'CHAI ROS', appSettings.appNameEn || 'CHAI ROS')}
            companyName={appSettings.companyName || 'CHAI ROS'}
            tagline={t(appSettings.taglineHi, appSettings.taglineEn)}
            logoUrl={appSettings.logoUrl}
            primaryColor={appSettings.primaryColor}
          />

          {/* ===============================================================
              SEPARATE PAGE 1: DEDICATED CUSTOMER LOGIN PAGE
              (Customer logs in with Mobile Number OR Email ID + Password)
          =============================================================== */}
          {loginRoleTab === 'customer' ? (
            <div className="w-full mt-4 space-y-4">
              <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white p-5 sm:p-7">
                {/* Error & Success Alerts */}
                {authErrorHi && (
                  <div
                    role="alert"
                    className="mb-4 p-3.5 rounded-2xl bg-[#FDF2EC] border border-[#E07A52] text-[#7A2710] text-xs sm:text-sm space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#9E3B1B] shrink-0 mt-0.5" />
                      <p className="font-semibold leading-relaxed">{authErrorHi}</p>
                    </div>
                    {highlightProviderWarning && (
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsSetupModalOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-[#0B6829] text-white text-xs font-bold hover:bg-[#07521F] transition-colors whitespace-nowrap shrink-0"
                        >
                          {t('Firebase सेटअप गाइड खोलें', 'Open Firebase Setup Guide')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {authSuccessHi && (
                  <div
                    role="status"
                    className="mb-4 p-3.5 rounded-2xl bg-[#EEF7F0] border border-[#4EA868] text-[#0A5220] text-xs sm:text-sm flex items-start gap-2 font-semibold"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#0B6829] shrink-0 mt-0.5" />
                    <p>{authSuccessHi}</p>
                  </div>
                )}

                {/* SUB-VIEW 1: CUSTOMER LOGIN (Mobile Number OR Email ID + Password) */}
                {customerAuthView === 'login' && (
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E8F6EC] border border-[#8FD1A4] text-xs font-bold text-[#0B6829] mb-2">
                      <UserIcon className="w-3.5 h-3.5" />
                      <span>{t('ग्राहक लॉगिन पोर्टल', 'Customer Login Portal')}</span>
                    </div>
                    <h1 className="text-2xl sm:text-[28px] font-bold text-[#0D682B] tracking-tight leading-tight">
                      Customer Login
                    </h1>
                    <p className="text-sm sm:text-base font-bold text-[#1B2620] mt-1">
                      {t(
                        'अपने मोबाइल नंबर या ईमेल आईडी और पासवर्ड से लॉगिन करें।',
                        'Log in with your Mobile Number or Email ID and Password.'
                      )}
                    </p>

                    <form
                      onSubmit={handleCustomerLogin}
                      className="mt-4 space-y-3.5"
                      noValidate
                    >
                      {/* Box 1: मोबाइल नंबर या ईमेल आईडी */}
                      <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2.5 flex items-center gap-3.5 focus-within:ring-2 focus-within:ring-[#0B6829] transition-shadow">
                        <Phone className="w-6 h-6 text-[#0B6829] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="customer-login-identifier"
                            className="block text-sm font-bold text-[#0B6829] leading-snug"
                          >
                            {t(
                              'मोबाइल नंबर या ईमेल आईडी (Mobile Number or Email)',
                              'Mobile Number or Email ID'
                            )}
                          </label>
                          <input
                            id="customer-login-identifier"
                            type="text"
                            autoComplete="username"
                            maxLength={120}
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder={t(
                              '10-अंकों का मोबाइल नंबर या ईमेल डालें',
                              'Enter 10-digit Mobile Number or Email ID'
                            )}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] placeholder:text-[#5F6F65] focus:outline-none mt-0.5"
                            required
                          />
                        </div>
                      </div>

                      {/* Box 2: पासवर्ड */}
                      <div className="rounded-2xl border border-[#C5D0CA] bg-[#F8FAFC] px-4 py-2.5 flex items-center gap-3.5 focus-within:border-[#0B6829] focus-within:ring-2 focus-within:ring-[#0B6829] transition-shadow">
                        <Lock className="w-6 h-6 text-[#2C3A35] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="customer-login-password"
                            className="block text-sm font-bold text-[#0B6829] leading-snug"
                          >
                            {t('पासवर्ड (Password)', 'Password')}
                          </label>
                          <input
                            id="customer-login-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder={t('अपना पासवर्ड डालें', 'Enter your password')}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] placeholder:text-[#5F6F65] focus:outline-none mt-0.5"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="min-h-[42px] min-w-[42px] flex items-center justify-center text-[#46564F] hover:text-[#0B6829] rounded-lg"
                          aria-label={
                            showPassword
                              ? t('पासवर्ड छिपाएं', 'Hide password')
                              : t('पासवर्ड दिखाएं', 'Show password')
                          }
                        >
                          {showPassword ? (
                            <Eye className="w-5 h-5" />
                          ) : (
                            <EyeOff className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full min-h-[52px] rounded-xl bg-gradient-to-b from-[#0E742F] to-[#075820] hover:from-[#0B6528] hover:to-[#054518] disabled:opacity-60 text-white text-lg font-bold shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                      >
                        {authLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{t('लॉगिन हो रहा है...', 'Logging in...')}</span>
                          </>
                        ) : (
                          <>
                            <span>{t('ग्राहक लॉगिन करें (Customer Login)', 'Customer Login')}</span>
                            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="flex items-center gap-3 my-3.5">
                      <span className="h-[1px] flex-1 bg-[#D5DFD9]" />
                      <span className="text-sm font-bold text-[#384840]">{t('या', 'OR')}</span>
                      <span className="h-[1px] flex-1 bg-[#D5DFD9]" />
                    </div>

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerAuthView('register');
                          setAuthErrorHi(null);
                          setAuthSuccessHi(null);
                        }}
                        className="w-full min-h-[50px] rounded-xl bg-white hover:bg-[#F1F9F3] border-[1.5px] border-[#267A42] text-[#0B6829] text-base sm:text-lg font-bold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-5 h-5 stroke-[2.4]" />
                        <span>{t('नया ग्राहक अकाउंट बनाएं', 'Create New Customer Account')}</span>
                      </button>
                    </div>

                    <div className="mt-4 pt-2 flex items-center justify-between gap-2 text-xs sm:text-sm font-bold text-[#0B6829]">
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmailInput(emailInput.includes('@') ? emailInput : '');
                          setCustomerAuthView('forgot_password');
                          setAuthErrorHi(null);
                          setAuthSuccessHi(null);
                        }}
                        className="min-h-[40px] inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                      >
                        <Lock className="w-4 h-4 fill-[#0B6829] text-[#0B6829]" />
                        <span>{t('पासवर्ड भूल गए?', 'Forgot Password?')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setHighlightProviderWarning(false);
                          setIsSetupModalOpen(true);
                        }}
                        className="min-h-[40px] inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                      >
                        <Info className="w-4 h-4 text-[#0B6829]" />
                        <span>{t('सहायता / संपर्क', 'Help / Contact')}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* SUB-VIEW 2: CUSTOMER REGISTRATION (Name + Mobile Number or Email + Password) */}
                {customerAuthView === 'register' && (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h1 className="text-2xl sm:text-[26px] font-bold text-[#0D682B]">
                        {t('नया ग्राहक अकाउंट बनाएं', 'Create Customer Account')}
                      </h1>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerAuthView('login');
                          setAuthErrorHi(null);
                          setAuthSuccessHi(null);
                        }}
                        className="text-xs font-bold text-[#0B6829] inline-flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{t('वापस लॉगिन पर', 'Back to Login')}</span>
                      </button>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-[#1B2620] mt-1">
                      {t(
                        'अपना नाम, मोबाइल नंबर (या ईमेल) और पासवर्ड दर्ज करें।',
                        'Enter your full name, Mobile Number (or Email), and password.'
                      )}
                    </p>

                    <form
                      onSubmit={handleCustomerRegister}
                      className="mt-4 space-y-3"
                      noValidate
                    >
                      <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2 flex items-center gap-3.5 focus-within:ring-2 focus-within:ring-[#0B6829]">
                        <UserIcon className="w-6 h-6 text-[#0B6829] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="reg-fullname"
                            className="block text-xs sm:text-sm font-bold text-[#0B6829]"
                          >
                            {t('आपका पूरा नाम', 'Your Full Name')}
                          </label>
                          <input
                            id="reg-fullname"
                            type="text"
                            maxLength={80}
                            value={fullNameInput}
                            onChange={(e) => setFullNameInput(e.target.value)}
                            placeholder={t(
                              'अपना पूरा नाम डालें (उदा. राजेश शर्मा)',
                              'Enter your full name'
                            )}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] placeholder:text-[#5F6F65] focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2 flex items-center gap-3.5 focus-within:ring-2 focus-within:ring-[#0B6829]">
                        <Phone className="w-6 h-6 text-[#0B6829] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="reg-identifier"
                            className="block text-xs sm:text-sm font-bold text-[#0B6829]"
                          >
                            {t(
                              'मोबाइल नंबर या ईमेल आईडी (Mobile Number or Email)',
                              'Mobile Number or Email ID'
                            )}
                          </label>
                          <input
                            id="reg-identifier"
                            type="text"
                            maxLength={120}
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder={t(
                              '10-अंकों का मोबाइल नंबर या ईमेल आईडी',
                              '10-digit Mobile Number or Email ID'
                            )}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] placeholder:text-[#5F6F65] focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#C5D0CA] bg-[#F8FAFC] px-4 py-2 flex items-center gap-3.5 focus-within:border-[#0B6829] focus-within:ring-2 focus-within:ring-[#0B6829]">
                        <Lock className="w-6 h-6 text-[#2C3A35] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="reg-pass"
                            className="block text-xs sm:text-sm font-bold text-[#0B6829]"
                          >
                            {t('नया पासवर्ड बनाएं', 'Create Password')}
                          </label>
                          <input
                            id="reg-pass"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder={t(
                              'कम से कम 6 अक्षरों का पासवर्ड डालें',
                              'At least 6 characters'
                            )}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] placeholder:text-[#5F6F65] focus:outline-none"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#46564F]"
                          aria-label={t('पासवर्ड दिखाएं/छिपाएं', 'Toggle password visibility')}
                        >
                          {showPassword ? (
                            <Eye className="w-5 h-5" />
                          ) : (
                            <EyeOff className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      <div className="rounded-2xl border border-[#C5D0CA] bg-[#F8FAFC] px-4 py-2 flex items-center gap-3.5 focus-within:border-[#0B6829] focus-within:ring-2 focus-within:ring-[#0B6829]">
                        <KeyRound className="w-6 h-6 text-[#2C3A35] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="reg-pass-confirm"
                            className="block text-xs sm:text-sm font-bold text-[#0B6829]"
                          >
                            {t('पासवर्ड की पुष्टि करें', 'Confirm Password')}
                          </label>
                          <input
                            id="reg-pass-confirm"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={confirmPasswordInput}
                            onChange={(e) => setConfirmPasswordInput(e.target.value)}
                            placeholder={t(
                              'अपना पासवर्ड दोबारा डालें',
                              'Re-enter your password'
                            )}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] placeholder:text-[#5F6F65] focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full min-h-[52px] rounded-xl bg-gradient-to-b from-[#0E742F] to-[#075820] hover:from-[#0B6528] hover:to-[#054518] disabled:opacity-60 text-white text-lg font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        {authLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{t('अकाउंट बन रहा है...', 'Creating Account...')}</span>
                          </>
                        ) : (
                          <>
                            <span>
                              {t('रजिस्टर करें और लॉगिन करें', 'Register & Login')}
                            </span>
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="flex items-center gap-3 my-3">
                      <span className="h-[1px] flex-1 bg-[#D5DFD9]" />
                      <span className="text-xs font-bold text-[#384840]">{t('या', 'OR')}</span>
                      <span className="h-[1px] flex-1 bg-[#D5DFD9]" />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCustomerAuthView('login');
                        setAuthErrorHi(null);
                        setAuthSuccessHi(null);
                      }}
                      className="w-full min-h-[46px] rounded-xl bg-white hover:bg-[#F1F9F3] border-[1.5px] border-[#267A42] text-[#0B6829] text-sm sm:text-base font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>
                        {t('पहले से अकाउंट है? ग्राहक लॉगिन करें', 'Already have an account? Customer Login')}
                      </span>
                    </button>
                  </div>
                )}

                {/* SUB-VIEW 3: FORGOT PASSWORD */}
                {customerAuthView === 'forgot_password' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h1 className="text-xl sm:text-2xl font-bold text-[#0D682B]">
                        {t('पासवर्ड भूल गए?', 'Forgot Password?')}
                      </h1>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerAuthView('login');
                          setAuthErrorHi(null);
                          setAuthSuccessHi(null);
                        }}
                        className="text-xs font-bold text-[#0B6829] inline-flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{t('वापस लॉगिन पर', 'Back to Login')}</span>
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-[#1B2620] leading-relaxed">
                      {t(
                        'अपनी पंजीकृत ईमेल आईडी दर्ज करें। हम आपकी ईमेल पर नया पासवर्ड बनाने के लिए रीसेट लिंक भेजेंगे।',
                        'Enter your registered Email ID. We will send a Password Reset Link to your email.'
                      )}
                    </p>

                    <form onSubmit={handleForgotPasswordReset} className="space-y-3.5" noValidate>
                      <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2.5 flex items-center gap-3.5 focus-within:ring-2 focus-within:ring-[#0B6829]">
                        <Mail className="w-6 h-6 text-[#0B6829] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="forgot-password-email"
                            className="block text-sm font-bold text-[#0B6829]"
                          >
                            {t('आपकी ईमेल आईडी', 'Your Email ID')}
                          </label>
                          <input
                            id="forgot-password-email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            maxLength={120}
                            value={resetEmailInput}
                            onChange={(e) => setResetEmailInput(e.target.value)}
                            placeholder={t(
                              'अपनी ईमेल आईडी डालें (उदा. name@gmail.com)',
                              'Enter your Email ID (e.g. name@gmail.com)'
                            )}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] placeholder:text-[#5F6F65] focus:outline-none mt-0.5"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full min-h-[50px] rounded-xl bg-gradient-to-b from-[#0E742F] to-[#075820] hover:from-[#0B6528] hover:to-[#054518] disabled:opacity-60 text-white text-base font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
                      >
                        {authLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>
                              {t('रीसेट लिंक भेजा जा रहा है...', 'Sending Reset Link...')}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              {t('पासवर्ड रीसेट लिंक भेजें', 'Send Password Reset Link')}
                            </span>
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Separate Portal Link at Bottom: Switch to Dedicated Admin Login Page */}
              <div className="w-full text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchLoginPage('admin')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/45 hover:bg-black/60 text-white text-xs font-bold backdrop-blur-xs transition-colors cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-300" />
                  <span>
                    {t(
                      'अधिकृत एडमिन हैं? अलग Admin Login पेज खोलें →',
                      'Authorized Admin? Open Separate Admin Login Page →'
                    )}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* ===============================================================
                SEPARATE PAGE 2: DEDICATED ADMIN LOGIN PAGE
                (Strictly Admin Email + Password ONLY)
            =============================================================== */
            <div className="w-full mt-4 space-y-4">
              <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border-2 border-[#064E1E] p-5 sm:p-7">
                {authErrorHi && (
                  <div
                    role="alert"
                    className="mb-4 p-3.5 rounded-2xl bg-[#FDF2EC] border border-[#E07A52] text-[#7A2710] text-xs sm:text-sm space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#9E3B1B] shrink-0 mt-0.5" />
                      <p className="font-semibold leading-relaxed">{authErrorHi}</p>
                    </div>
                  </div>
                )}

                {authSuccessHi && (
                  <div
                    role="status"
                    className="mb-4 p-3.5 rounded-2xl bg-[#EEF7F0] border border-[#4EA868] text-[#0A5220] text-xs sm:text-sm flex items-start gap-2 font-semibold"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#0B6829] shrink-0 mt-0.5" />
                    <p>{authSuccessHi}</p>
                  </div>
                )}

                {!adminForgotMode ? (
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#064E1E] text-white text-xs font-bold mb-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                      <span>
                        {t('केवल अधिकृत एडमिन पोर्टल', 'Authorized Admin Portal Only')}
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-[28px] font-bold text-[#064E1E] tracking-tight leading-tight">
                      Admin Login
                    </h1>
                    <p className="text-xs sm:text-sm font-bold text-[#1B2620] mt-1">
                      {t(
                        'केवल अधिकृत एडमिन ईमेल और पासवर्ड से लॉगिन करें (सभी ग्राहक, ऑर्डर, प्रोडक्ट और सेटिंग्स प्रबंधन)।',
                        'Log in strictly with your authorized Admin Email and Password (manage all customers, orders, products & settings).'
                      )}
                    </p>

                    <form
                      onSubmit={handleAdminEmailLogin}
                      className="mt-4 space-y-3.5"
                      noValidate
                    >
                      <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2.5 flex items-center gap-3.5 focus-within:ring-2 focus-within:ring-[#0B6829]">
                        <Mail className="w-6 h-6 text-[#0B6829] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="admin-email"
                            className="block text-sm font-bold text-[#0B6829]"
                          >
                            {t('एडमिन ईमेल आईडी (Admin Email)', 'Admin Email ID')}
                          </label>
                          <input
                            id="admin-email"
                            type="email"
                            autoComplete="username"
                            value={adminEmailInput}
                            onChange={(e) => setAdminEmailInput(e.target.value)}
                            placeholder={t('एडमिन ईमेल दर्ज करें', 'Enter Admin Email')}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] placeholder:text-[#5F6F65] focus:outline-none mt-0.5"
                            required
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#C5D0CA] bg-[#F8FAFC] px-4 py-2.5 flex items-center gap-3.5 focus-within:border-[#0B6829] focus-within:ring-2 focus-within:ring-[#0B6829]">
                        <Lock className="w-6 h-6 text-[#2C3A35] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="admin-password"
                            className="block text-sm font-bold text-[#0B6829]"
                          >
                            {t('एडमिन पासवर्ड (Admin Password)', 'Admin Password')}
                          </label>
                          <input
                            id="admin-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={adminPasswordInput}
                            onChange={(e) => setAdminPasswordInput(e.target.value)}
                            placeholder={t('अपना एडमिन पासवर्ड डालें', 'Enter your Admin password')}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] placeholder:text-[#5F6F65] focus:outline-none mt-0.5"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="min-h-[42px] min-w-[42px] flex items-center justify-center text-[#46564F]"
                          aria-label={t('पासवर्ड दिखाएं/छिपाएं', 'Toggle password visibility')}
                        >
                          {showPassword ? (
                            <Eye className="w-5 h-5" />
                          ) : (
                            <EyeOff className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full min-h-[52px] rounded-xl bg-gradient-to-b from-[#064E1E] to-[#043815] hover:from-[#0B6829] hover:to-[#064E1E] disabled:opacity-60 text-white text-lg font-bold shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                      >
                        {authLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <span>{t('एडमिन लॉगिन करें (Admin Login)', 'Admin Login')}</span>
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="mt-4 pt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#0B6829]">
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmailInput(adminEmailInput || ADMIN_EMAIL);
                          setAdminForgotMode(true);
                          setAuthErrorHi(null);
                          setAuthSuccessHi(null);
                        }}
                        className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{t('एडमिन पासवर्ड भूल गए?', 'Forgot Admin Password?')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSetupModalOpen(true)}
                        className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Info className="w-4 h-4" />
                        <span>{t('सहायता / संपर्क', 'Help / Contact')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xl font-bold text-[#064E1E]">
                        {t('एडमिन पासवर्ड रीसेट', 'Reset Admin Password')}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminForgotMode(false);
                          setAuthErrorHi(null);
                          setAuthSuccessHi(null);
                        }}
                        className="text-xs font-bold text-[#0B6829] inline-flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{t('वापस Admin Login पर', 'Back to Admin Login')}</span>
                      </button>
                    </div>

                    <form onSubmit={handleForgotPasswordReset} className="space-y-3.5" noValidate>
                      <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2.5 flex items-center gap-3.5">
                        <Mail className="w-6 h-6 text-[#0B6829] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="admin-forgot-email"
                            className="block text-sm font-bold text-[#0B6829]"
                          >
                            {t('एडमिन ईमेल आईडी', 'Admin Email ID')}
                          </label>
                          <input
                            id="admin-forgot-email"
                            type="email"
                            value={resetEmailInput}
                            onChange={(e) => setResetEmailInput(e.target.value)}
                            placeholder={ADMIN_EMAIL}
                            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#1A241E] focus:outline-none mt-0.5"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full min-h-[48px] rounded-xl bg-[#064E1E] hover:bg-[#043815] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {authLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span>
                            {t('रीसेट लिंक भेजें', 'Send Password Reset Link')}
                          </span>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Separate Portal Link at Bottom: Switch to Dedicated Customer Login Page */}
              <div className="w-full text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchLoginPage('customer')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/45 hover:bg-black/60 text-white text-xs font-bold backdrop-blur-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>
                    {t(
                      'ग्राहक हैं? अलग Customer Login पेज पर जाएं',
                      'Are you a Customer? Go to Customer Login Page'
                    )}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Customer Help & Contact Modal (Admin-Controlled) */}
        <SetupGuideModal
          isOpen={isSetupModalOpen}
          onClose={() => setIsSetupModalOpen(false)}
          highlightProviderWarning={highlightProviderWarning}
          settings={appSettings}
          lang={lang}
          isAdmin={isAdminUser}
        />
      </TeaGardenBackdrop>
    );
  }

  /* =========================================================================
     VIEW 2: AUTHENTICATED CUSTOMER & ADMIN PORTAL
  ========================================================================= */
  const announcementBannerText = t(
    appSettings.announcementHi || appSettings.announcementEn,
    appSettings.announcementEn || appSettings.announcementHi
  );
  const specialOfferStripText = t(
    appSettings.specialOfferBannerHi || appSettings.specialOfferBannerEn,
    appSettings.specialOfferBannerEn || appSettings.specialOfferBannerHi
  );
  const heroBannerTitle = t(
    appSettings.bannerTitleHi || appSettings.bannerTitleEn,
    appSettings.bannerTitleEn || appSettings.bannerTitleHi
  );
  const heroBannerSubtitle = t(
    appSettings.bannerSubtitleHi || appSettings.bannerSubtitleEn,
    appSettings.bannerSubtitleEn || appSettings.bannerSubtitleHi
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F6FAF5] text-[#16261C]">
      {/* Optional Admin-Controlled Top Announcement Bar */}
      {announcementBannerText && (
        <div
          style={{ backgroundColor: appSettings.primaryColor || '#14281D' }}
          className="w-full text-white px-4 py-2 text-center text-xs sm:text-sm font-bold tracking-wide"
        >
          {announcementBannerText}
        </div>
      )}

      {/* Optional Admin-Controlled Special Offer Strip */}
      {specialOfferStripText && (
        <div
          style={{ backgroundColor: appSettings.accentColor || '#B45309' }}
          className="w-full text-white px-4 py-1.5 text-center text-xs font-bold"
        >
          {specialOfferStripText}
        </div>
      )}

      {/* =====================================================================
          TOP BAR CONTRACT (3 Zones separated by gap-4/gap-8)
      ===================================================================== */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-8 h-16 bg-white/95 backdrop-blur-md border-b border-[#D4E4D8] shadow-xs">
        {/* Zone 1: Brand Logo & Wordmark (Admin-Controlled) */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('catalog');
          }}
          className="inline-flex items-center gap-2.5 font-display text-lg sm:text-2xl font-black italic tracking-tight text-[#064E1E] whitespace-nowrap shrink-0"
        >
          {appSettings.logoUrl && (
            <img
              src={appSettings.logoUrl}
              alt={appSettings.companyName || 'CHAI ROS'}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-[#62B37A]"
            />
          )}
          <span style={{ color: appSettings.primaryColor || '#064E1E' }}>
            {t(
              appSettings.appNameHi || 'CHAI ROS',
              appSettings.appNameEn || 'CHAI ROS'
            )}
          </span>
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-[#35523F]">
          <button
            type="button"
            onClick={() => setActiveSection('catalog')}
            className={`hover:text-[#064E1E] transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeSection === 'catalog'
                ? 'text-[#0B6829] underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            {t('उत्पाद कैटलॉग', 'Catalogue')}
          </button>
          <button
            type="button"
            onClick={() => setIsCartDrawerOpen(true)}
            className="hover:text-[#064E1E] transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer"
          >
            {t(`कार्ट (${totalCartItems})`, `Cart (${totalCartItems})`)}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('my_orders')}
            className={`hover:text-[#064E1E] transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeSection === 'my_orders'
                ? 'text-[#0B6829] underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            {t(`मेरे ऑर्डर (${myOrders.length})`, `My Orders (${myOrders.length})`)}
          </button>
          {isAdminUser && (
            <button
              type="button"
              onClick={() => setActiveSection('admin')}
              className={`hover:text-[#064E1E] transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                activeSection === 'admin'
                  ? 'text-[#0B6829] underline underline-offset-8 decoration-2'
                  : ''
              }`}
            >
              {t('एडमिन पैनल (Admin Control)', 'Admin Panel')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setHighlightProviderWarning(false);
              setIsSetupModalOpen(true);
            }}
            className="hover:text-[#064E1E] transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer"
          >
            {t(
              appSettings.helpTitleHi || 'सहायता व संपर्क',
              appSettings.helpTitleEn || 'Help & Contact'
            )}
          </button>
        </nav>

        {/* Zone 3: Language Switcher + Logout */}
        <div className="flex items-center gap-2.5 shrink-0">
          {renderLanguageSelector()}

          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[40px] px-3.5 py-2 text-xs font-bold text-white bg-[#0B6829] hover:bg-[#074F1E] rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>
              {t(
                `लॉगआउट (${customerProfile.name.split(' ')[0]})`,
                `Logout (${customerProfile.name.split(' ')[0]})`
              )}
            </span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          MAIN AUTHENTICATED VIEWPORT CONTENT
      ===================================================================== */}
      <main id="top" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10 pb-24 md:pb-12">
        <div className="space-y-8">
          {/* Store Closed Notice if Admin paused orders */}
          {!appSettings.storeOpen && (
            <div className="p-4 rounded-2xl bg-[#FDF2EC] border border-[#E07A52] text-[#7A2710] text-xs sm:text-sm font-bold flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-[#9E3B1B]" />
              <span>
                {t(
                  appSettings.storeClosedMessageHi ||
                    'अभी स्टोर पर नए ऑर्डर बंद हैं। कृपया कुछ समय बाद प्रयास करें।',
                  appSettings.storeClosedMessageEn ||
                    'The store is currently closed for new orders. Please check back soon.'
                )}
              </span>
            </div>
          )}

          {/* Optional Admin-Controlled Hero Banner on Catalogue Page */}
          {activeSection === 'catalog' &&
            (heroBannerTitle || heroBannerSubtitle || appSettings.bannerImageUrl) && (
              <div
                style={{ backgroundColor: appSettings.primaryColor || '#14281D' }}
                className="rounded-3xl overflow-hidden text-white shadow-md grid grid-cols-1 md:grid-cols-12"
              >
                <div
                  className={`p-6 sm:p-8 flex flex-col justify-center space-y-2 ${
                    appSettings.bannerImageUrl ? 'md:col-span-7' : 'md:col-span-12'
                  }`}
                >
                  {appSettings.companyName && (
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                      {appSettings.companyName}
                    </span>
                  )}
                  {heroBannerTitle && (
                    <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
                      {heroBannerTitle}
                    </h2>
                  )}
                  {heroBannerSubtitle && (
                    <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed max-w-2xl">
                      {heroBannerSubtitle}
                    </p>
                  )}
                </div>
                {appSettings.bannerImageUrl && (
                  <div className="md:col-span-5 max-h-64 md:max-h-none overflow-hidden">
                    <img
                      src={appSettings.bannerImageUrl}
                      alt={heroBannerTitle || appSettings.companyName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            )}

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D4E4D8]">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#064E1E]">
                {activeSection === 'catalog' &&
                  t(
                    appSettings.catalogHeadingHi || 'चाय प्रोडक्ट कैटलॉग',
                    appSettings.catalogHeadingEn || 'Tea Product Catalogue'
                  )}
                {activeSection === 'my_orders' &&
                  t('मेरे ऑर्डर (My Orders)', 'My Orders')}
                {activeSection === 'admin' &&
                  t(
                    'एडमिन कंट्रोल पैनल — संपूर्ण ऐप सेटिंग्स, प्रोडक्ट और ऑर्डर प्रबंधन',
                    'Admin Control Panel — Full App Settings, Products & Orders'
                  )}
              </h1>
              {activeSection === 'catalog' &&
                (appSettings.catalogSubheadingHi || appSettings.catalogSubheadingEn) && (
                  <p className="text-xs sm:text-sm text-[#4B6B56] mt-1">
                    {t(
                      appSettings.catalogSubheadingHi || appSettings.catalogSubheadingEn,
                      appSettings.catalogSubheadingEn || appSettings.catalogSubheadingHi
                    )}
                  </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isAdminUser && (
                <button
                  type="button"
                  onClick={() => {
                    resetAdminProductForm();
                    setAdminActiveTab('products');
                    setActiveSection('admin');
                    setTimeout(() => {
                      document.getElementById('admin-prod-name')?.focus();
                    }, 80);
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {t(
                      '+ Product Launch / नया प्रोडक्ट जोड़ें',
                      '+ Product Launch / Add New Product'
                    )}
                  </span>
                </button>
              )}

              {isAdminUser && activeSection !== 'admin' && (
                <button
                  type="button"
                  onClick={() => setActiveSection('admin')}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#064E1E] hover:bg-[#043815] text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>
                    {t(
                      `Admin Dashboard (${adminNewOrders.length} नए ऑर्डर · ${adminActiveCustomers.length} ग्राहक)`,
                      `Admin Dashboard (${adminNewOrders.length} New Orders · ${adminActiveCustomers.length} Customers)`
                    )}
                  </span>
                </button>
              )}

              {activeSection !== 'admin' && (
                <a
                  href={buildAdminWhatsappChatUrl(
                    appSettings.whatsappNumber || appSettings.contactWhatsapp
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 fill-current shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.83-.11-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.24-5.01-4.44-.15-.2-1.2-1.59-1.2-3.04 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37.2 0 .4.01.57.01.18 0 .43-.07.67.51.24.59.82 2.01.89 2.16.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.49.22.57.35.07.12.07.72-.17 1.4z" />
                  </svg>
                  <span>WhatsApp Help</span>
                  <span className="font-mono text-[11px] bg-white/20 px-2 py-0.5 rounded-md">
                    {formatAdminWhatsappDisplay(
                      appSettings.whatsappNumber || appSettings.contactWhatsapp
                    )}
                  </span>
                </a>
              )}

              {activeSection === 'catalog' && (
                <button
                  type="button"
                  onClick={() => setIsCartDrawerOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border-2 border-[#0B6829] hover:bg-[#E8F6EC] text-[#064E1E] text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-[#0B6829]" />
                  <span className="tabular-nums">
                    {t(
                      `कार्ट / ऑर्डर थैला (${totalCartItems}) · ₹${grandTotalInr}`,
                      `Cart (${totalCartItems}) · ₹${grandTotalInr}`
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* =================================================================
              CUSTOMER PERMANENT SAVED GPS ADDRESS BAR (AUTO-ATTACHED TO ORDERS)
          ================================================================= */}
          {activeSection !== 'admin' && !isAdminUser && (
            <div className="bg-white border-2 border-[#0B6829] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E8F6EC] border border-[#8FD1A4] text-xs font-bold text-[#064E1E]">
                    <MapPin className="w-3.5 h-3.5 text-[#0B6829]" />
                    {t(
                      'आपका स्थायी GPS डिलीवरी पता (Permanent Saved GPS Address)',
                      'Your Permanent Saved GPS Delivery Address'
                    )}
                  </span>
                  {(customerProfile.defaultAddress || deliveryAddress.trim()) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#ECFDF3] text-[11px] font-bold text-[#085D3A]">
                      <CheckCircle2 className="w-3 h-3" />
                      {t(
                        'हर नए ऑर्डर में अपने आप जुड़ेगा',
                        'Auto-attached to every new order'
                      )}
                    </span>
                  )}
                </div>

                {customerProfile.defaultAddress || deliveryAddress.trim() ? (
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-[#16261C]">
                      {customerProfile.defaultAddress || deliveryAddress}
                      {(customerProfile.defaultPinCode || pinCode) && (
                        <span className="ml-2 font-mono text-xs text-[#0B6829]">
                          (PIN: {customerProfile.defaultPinCode || pinCode})
                        </span>
                      )}
                    </p>
                    {typeof (customerProfile.gpsLat ?? customerGpsLat) === 'number' &&
                      typeof (customerProfile.gpsLng ?? customerGpsLng) === 'number' && (
                        <p className="text-[11px] font-mono text-[#3C5A46]">
                          GPS Coordinates: Lat{' '}
                          {(customerProfile.gpsLat ?? customerGpsLat)?.toFixed(6)}, Lng{' '}
                          {(customerProfile.gpsLng ?? customerGpsLng)?.toFixed(6)}
                        </p>
                      )}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-[#3C5A46]">
                    {t(
                      'पहली बार लॉगिन: कृपया GPS अनुमति दें ताकि आपका डिलीवरी पता अपने आप सेव हो जाए और आपको बार-बार पता फॉर्म न भरना पड़े।',
                      'First-time login: Allow GPS permission so your delivery address is saved automatically and you never have to fill out an address form.'
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {typeof (customerProfile.gpsLat ?? customerGpsLat) === 'number' &&
                  typeof (customerProfile.gpsLng ?? customerGpsLng) === 'number' && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMapViewModal({
                          titleHi: 'मेरा सेव किया गया GPS डिलीवरी पता',
                          titleEn: 'My Saved GPS Delivery Address',
                          customerName:
                            customerProfile.name || checkoutName || t('ग्राहक', 'Customer'),
                          mobileNumber: formatCustomerContactDisplay(
                            customerProfile.email || checkoutEmail,
                            customerProfile.phone || checkoutPhone
                          ),
                          address: `${customerProfile.defaultAddress || deliveryAddress} (PIN: ${
                            customerProfile.defaultPinCode || pinCode || '—'
                          })`,
                          lat: (customerProfile.gpsLat ?? customerGpsLat) as number,
                          lng: (customerProfile.gpsLng ?? customerGpsLng) as number,
                        })
                      }
                      className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#EAF4EC] hover:bg-[#D4E4D8] border border-[#8FD1A4] text-[#064E1E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#0B6829]" />
                      <span>{t('मैप पर देखें (View on Map)', 'View on Map')}</span>
                    </button>
                  )}

                {customerProfile.defaultAddress || deliveryAddress.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleOpenChangeAddressModal('gps')}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{t('Change Address (पता बदलें)', 'Change Address')}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => requestCustomerGpsLocation(false)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>
                        {t('GPS से पता अपने आप जोड़ें', 'Auto-Detect GPS Address')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenChangeAddressModal('map_pin')}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EAF4EC] hover:bg-[#D4E4D8] border border-[#8FD1A4] text-[#064E1E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{t('मैप पिन / पता सुधारें', 'Map Pin / Edit Address')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* LIVE ADMIN-TO-CUSTOMER UPDATE BANNER */}
          {activeSection !== 'admin' && (customerProfile.adminNoteHi || myOrders.length > 0) && (
            <div className="bg-white border-2 border-[#58A972] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#0B6829]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {t(
                      'एडमिन पैनल से लाइव अपडेट (Real-Time Admin Update)',
                      'Live Update from Admin Panel'
                    )}
                  </span>
                </div>
                {myOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSection('my_orders')}
                    className="text-xs font-bold text-[#0B6829] underline underline-offset-4 cursor-pointer"
                  >
                    {t(
                      `सभी ऑर्डर देखें (${myOrders.length}) →`,
                      `View All Orders (${myOrders.length}) →`
                    )}
                  </button>
                )}
              </div>

              {customerProfile.adminNoteHi && (
                <div className="p-3 rounded-xl bg-[#E8F6EC] border border-[#8FD1A4] text-xs sm:text-sm text-[#064E1E]">
                  <span className="font-bold">
                    {t('एडमिन का संदेश आपके लिए: ', 'Message from Admin: ')}
                  </span>
                  <span>{customerProfile.adminNoteHi}</span>
                </div>
              )}

              {myOrders.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs sm:text-sm text-[#16261C]">
                  <div className="space-y-0.5">
                    <p className="font-bold">
                      {t('ताज़ा ऑर्डर', 'Latest Order')} #{myOrders[0].id.slice(0, 8)}:{' '}
                      {myOrders[0].itemsSummary} (₹{myOrders[0].totalAmountInr})
                    </p>
                    {myOrders[0].adminNoteHi && (
                      <p className="text-xs font-semibold text-[#0B6829]">
                        {t('ऑर्डर अपडेट नोट:', 'Order Note:')} {myOrders[0].adminNoteHi}
                      </p>
                    )}
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-[#0B6829] text-white text-xs font-bold whitespace-nowrap shrink-0 self-start sm:self-center">
                    {t('स्थिति:', 'Status:')} {getOrderStatusLabel(myOrders[0].status)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SECTION 1: CUSTOMER CATALOGUE */}
          {activeSection === 'catalog' && (
            <div className="w-full space-y-6">
              {productsLoading ? (
                <div className="bg-white border border-[#D4E4D8] rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-[#3C5A46]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0B6829]" />
                  <p className="text-sm font-semibold">
                    {t('चाय कैटलॉग लोड हो रहा है...', 'Loading tea catalogue...')}
                  </p>
                </div>
              ) : catalogProducts.length === 0 ? (
                <div className="bg-white border border-[#D4E4D8] rounded-3xl p-10 text-center space-y-4 shadow-xs">
                  <ShoppingBag className="w-10 h-10 text-[#0B6829] mx-auto opacity-75" />
                  <h2 className="text-lg font-bold text-[#16261C]">
                    {t(
                      appSettings.emptyCatalogTitleHi ||
                        'अभी कैटलॉग में कोई प्रोडक्ट प्रकाशित नहीं है',
                      appSettings.emptyCatalogTitleEn ||
                        'No products are currently published in the catalogue'
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#4B6B56] max-w-md mx-auto leading-relaxed">
                    {t(
                      appSettings.emptyCatalogSubtitleHi ||
                        'एडमिन द्वारा जोड़े और Publish किए गए सभी चाय प्रोडक्ट्स यहां ग्राहकों को कार्ड के रूप में दिखाई देंगे।',
                      appSettings.emptyCatalogSubtitleEn ||
                        'Products added and published by the Admin will appear here for customers.'
                    )}
                  </p>
                  {isAdminUser && (
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          resetAdminProductForm();
                          setAdminActiveTab('products');
                          setActiveSection('admin');
                        }}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B6829] text-white text-xs sm:text-sm font-bold hover:bg-[#074F1E] inline-flex items-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>
                          {t('+ नया प्रोडक्ट जोड़ें (Add Product)', '+ Add New Product')}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catalogProducts.map((product) => {
                    const inCartItem = cart.find((c) => c.product.id === product.id);
                    const displayName =
                      lang === 'en' && product.nameEn ? product.nameEn : product.nameHi;
                    const displayCompany = product.companyName || product.categoryHi || '';
                    const displayWeight = formatProductWeight(product);

                    return (
                      <article
                        key={product.id}
                        className="bg-white border border-[#D4E4D8] hover:border-[#62B37A] rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs transition-all"
                      >
                        <div>
                          {/* 1. Product Photo */}
                          <div
                            onClick={() => openProductDetail(product)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openProductDetail(product);
                              }
                            }}
                            className="aspect-4/3 w-full border-b border-[#E6F0E8] bg-[#F4FAF6] relative overflow-hidden cursor-pointer group"
                          >
                            {product.photoUrl ? (
                              <img
                                src={product.photoUrl}
                                alt={displayName}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-[#EAF4EC] text-[#3C5A46] p-4 text-center">
                                <ShoppingBag className="w-10 h-10 text-[#0B6829] opacity-60 mb-1.5" />
                                <span className="text-xs font-bold">{displayName}</span>
                              </div>
                            )}
                          </div>

                          {/* 2. Product Name, 3. Company Name, 4. Weight */}
                          <div className="p-5 space-y-2">
                            {displayCompany && (
                              <p className="text-xs font-bold uppercase tracking-wider text-[#0B6829]">
                                {t('कंपनी:', 'Company:')} {displayCompany}
                              </p>
                            )}

                            <button
                              type="button"
                              onClick={() => openProductDetail(product)}
                              className="text-left w-full group cursor-pointer"
                            >
                              <h2 className="text-lg font-bold text-[#16261C] group-hover:text-[#0B6829] transition-colors">
                                {displayName}
                              </h2>
                            </button>

                            <div className="pt-1">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EAF4EC] border border-[#B8D4C0] text-xs font-mono font-bold text-[#064E1E]">
                                <Scale className="w-3.5 h-3.5 text-[#0B6829]" />
                                <span>
                                  {t(`वज़न: ${displayWeight}`, `Weight: ${displayWeight}`)}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 5. Price (₹) & Add to Cart */}
                        <div className="border-t border-[#E0EDE3] bg-[#F2F9F4]">
                          <div className="px-5 py-4 flex items-center justify-between gap-4">
                            <div
                              onClick={() => openProductDetail(product)}
                              className="cursor-pointer"
                            >
                              <span className="text-xs text-[#4B6B56] block">
                                {t(`कीमत (${displayWeight})`, `Price (${displayWeight})`)}
                              </span>
                              <span className="text-xl font-bold font-mono tabular-nums text-[#064E1E]">
                                ₹{product.priceInr}
                              </span>
                            </div>

                            {inCartItem ? (
                              <div className="inline-flex items-center gap-2 bg-white border border-[#62B37A] rounded-xl p-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(product.id, -1)}
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-[#E6F4EA] text-[#064E1E] cursor-pointer"
                                  aria-label={t('मात्रा घटाएं', 'Decrease quantity')}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-2 text-sm font-mono font-bold tabular-nums text-[#064E1E]">
                                  {inCartItem.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(product.id, 1)}
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-[#E6F4EA] text-[#064E1E] cursor-pointer"
                                  aria-label={t('मात्रा बढ़ाएं', 'Increase quantity')}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  addToCart(product, 1);
                                  setIsCartDrawerOpen(true);
                                }}
                                className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-b from-[#0E742F] to-[#075820] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>
                                  {t(
                                    appSettings.addToCartBtnHi || 'कार्ट में जोड़ें (Add to Cart)',
                                    appSettings.addToCartBtnEn || 'Add to Cart'
                                  )}
                                </span>
                              </button>
                            )}
                          </div>

                          {/* Quick Admin Controls directly on Catalogue Card */}
                          {isAdminUser && (
                            <div className="px-5 py-2.5 bg-[#E6F4EA] border-t border-[#C6DEC9] flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-[#064E1E]">
                                {t('एडमिन विकल्प:', 'Admin Actions:')}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleStartEditProduct(product);
                                    setActiveSection('admin');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-[#62B37A] text-[#0B6829] font-bold inline-flex items-center gap-1 hover:bg-[#F2F9F4] cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{t('एडिट (Edit)', 'Edit')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAdminDeleteSingleProduct(product.id, product.nameHi)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-[#9E3B1B] text-white font-bold inline-flex items-center gap-1 hover:bg-[#7D2C12] cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{t('डिलीट (Delete)', 'Delete')}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: CUSTOMER'S OWN ORDERS (/orders where customerId == currentUser.uid) */}
          {activeSection === 'my_orders' && (
            <div className="space-y-6">
              {lastCreatedOrderId && (
                <div className="p-5 rounded-2xl bg-[#E8F6EC] border border-[#4EA868] text-[#084B1D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide">
                      {t('ऑर्डर सफलतापूर्वक बुक हो गया', 'Order Booked Successfully')}
                    </p>
                    <p className="text-base font-bold">
                      {t(
                        `धन्यवाद ${customerProfile.name}! आपका ऑर्डर एडमिन पैनल में भेज दिया गया है।`,
                        `Thank you ${customerProfile.name}! Your order has been sent to the Admin Panel.`
                      )}
                    </p>
                    <p className="text-xs font-mono">
                      {t('ऑर्डर संदर्भ ID:', 'Order Reference ID:')} #{lastCreatedOrderId}
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#E8F3EB] border border-[#C6DEC9] text-xs font-semibold text-[#23452E] flex items-center justify-between">
                <span>
                  {t(
                    'रियल-टाइम सिंक: एडमिन पैनल से आपके ऑर्डर की स्थिति या संदेश अपडेट होते ही यहां तुरंत दिखाई देगा।',
                    'Real-Time Sync: Any status or note updated by the Admin appears here immediately.'
                  )}
                </span>
                <span className="font-mono font-bold tabular-nums shrink-0">
                  {t(`कुल ऑर्डर: ${myOrders.length}`, `Total Orders: ${myOrders.length}`)}
                </span>
              </div>

              {ordersLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-[#23452E]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0B6829]" />
                  <span className="text-xs font-semibold">
                    {t('आपके ऑर्डर लोड हो रहे हैं...', 'Loading your orders...')}
                  </span>
                </div>
              ) : myOrders.length === 0 ? (
                <div className="bg-white border border-[#D4E4D8] rounded-2xl p-10 text-center space-y-4">
                  <Package className="w-10 h-10 text-[#0B6829] mx-auto opacity-80" />
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-[#16261C]">
                      {t(
                        'अभी तक कोई ऑर्डर नहीं किया गया है',
                        'No orders have been placed yet'
                      )}
                    </h2>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {myOrders.map((order) => {
                    const parsedCustItems = parseOrderItemsSummary(
                      order.itemsSummary,
                      order.totalItemsCount,
                      order.totalAmountInr
                    );
                    const custMobile = formatCustomerContactDisplay(
                      order.customerEmail,
                      order.customerPhone
                    );
                    const custGps =
                      typeof order.gpsLat === 'number' && typeof order.gpsLng === 'number'
                        ? { lat: order.gpsLat, lng: order.gpsLng }
                        : null;
                    const adminWaDigits = normalizeAdminWhatsappDigits(
                      appSettings.whatsappNumber || appSettings.contactWhatsapp || '7507505064'
                    );
                    const orderAdminWaText = buildOrderWhatsAppNotificationText(
                      order,
                      parsedCustItems,
                      custMobile,
                      custGps
                    );
                    const orderCustomerWaText = buildCustomerWhatsAppNotificationText(
                      order,
                      parsedCustItems,
                      order.status
                    );
                    const orderAdminWaUrl = buildAdminWhatsappChatUrl(
                      adminWaDigits,
                      orderAdminWaText
                    );
                    const orderCustomerWaUrl = buildCustomerDirectWhatsappUrl(
                      custMobile,
                      orderCustomerWaText
                    );

                    const custPlacedTiming = formatOrderFullDateTime(order.createdAt, lang);
                    const isOrderDelivered = order.status === 'delivered';
                    const custCompletedTiming = isOrderDelivered
                      ? formatOrderFullDateTime(
                          order.deliveredAt || order.completedAt || order.updatedAt,
                          lang
                        )
                      : null;
                    const custDuration = isOrderDelivered
                      ? formatOrderDuration(
                          order.createdAt,
                          order.deliveredAt || order.completedAt || order.updatedAt,
                          lang
                        )
                      : null;

                    return (
                      <div
                        key={order.id}
                        className="bg-white border border-[#D4E4D8] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="space-y-2.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B6B56]">
                            <span className="font-mono font-bold text-[#16261C]">
                              {t('ऑर्डर', 'Order')} #{order.id.slice(0, 8).toUpperCase()}
                            </span>
                            <span>·</span>
                            <span className="font-bold text-[#0B6829]">
                              {t('स्थिति:', 'Status:')} {getOrderStatusLabel(order.status)}
                            </span>
                            <span>·</span>
                            <span>
                              {t('भुगतान:', 'Payment:')} {order.paymentMethod}
                            </span>
                          </div>

                          {/* Order Placed Date & Time Banner */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 p-2.5 rounded-xl bg-[#F7FBF8] border border-[#C6DEC9] text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-[#23452E]">
                              <Calendar className="w-3.5 h-3.5 text-[#0B6829]" />
                              <span>{t('ऑर्डर मिलने की तारीख:', 'Order Date:')}</span>
                              <span className="font-semibold text-[#16261C]">{custPlacedTiming.dateDisplay}</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-bold text-[#23452E]">
                              <Clock className="w-3.5 h-3.5 text-[#0B6829]" />
                              <span>{t('समय:', 'Time:')}</span>
                              <span className="font-semibold text-[#16261C]">{custPlacedTiming.timeDisplay} (IST)</span>
                            </div>
                            {custPlacedTiming.relativeDisplay && (
                              <span className="text-[11px] text-[#4B6B56] font-medium">
                                ({custPlacedTiming.relativeDisplay})
                              </span>
                            )}
                          </div>

                          {/* Completed / Delivered Date & Time Banner */}
                          {isOrderDelivered && custCompletedTiming && (
                            <div className="p-2.5 rounded-xl bg-[#E8F6EC] border border-[#62B37A] text-xs space-y-1">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-[#064E1E]">
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0B6829]" />
                                  {t('ऑर्डर पूरा होने की तारीख व समय:', 'Delivered Date & Time:')}
                                </span>
                                <span className="font-semibold">
                                  {custCompletedTiming.dateDisplay} · {custCompletedTiming.timeDisplay} (IST)
                                </span>
                              </div>
                              {custDuration && (
                                <p className="text-[11px] text-[#064E1E] font-medium">
                                  ⏱️ {custDuration}
                                </p>
                              )}
                            </div>
                          )}

                          <p className="text-sm sm:text-base font-bold text-[#16261C]">
                            {order.itemsSummary}
                          </p>

                          <div className="text-xs text-[#3C5A46] space-y-1">
                            <p>
                              <strong>{t('ग्राहक:', 'Customer:')}</strong> {order.customerName} (
                              <span className="font-mono">{custMobile}</span>)
                            </p>
                            <p>
                              <strong>{t('डिलीवरी पता:', 'Delivery Address:')}</strong>{' '}
                              {order.deliveryAddress} —{' '}
                              <span className="font-mono font-bold">
                                {t('पिन कोड:', 'PIN Code:')} {order.pinCode}
                              </span>
                            </p>
                            {order.adminNoteHi && (
                              <div className="mt-1.5 p-2.5 rounded-xl bg-[#E8F6EC] border border-[#62B37A] text-xs font-bold text-[#064E1E]">
                                {t('एडमिन अपडेट:', 'Admin Update:')} {order.adminNoteHi}
                              </div>
                            )}
                          </div>

                          {/* Instant WhatsApp Order Notification & Confirmation Links for Customer */}
                          <div className="flex flex-wrap items-center gap-2 pt-1.5">
                            <a
                              href={orderAdminWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white text-xs font-bold inline-flex items-center gap-1.5 no-underline shadow-2xs cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>
                                {t(
                                  `Admin WhatsApp पर ऑर्डर भेजें (${formatAdminWhatsappDisplay(
                                    adminWaDigits
                                  )})`,
                                  `Send Order to Admin WhatsApp (${formatAdminWhatsappDisplay(
                                    adminWaDigits
                                  )})`
                                )}
                              </span>
                            </a>

                            <a
                              href={orderCustomerWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#0B6829] hover:bg-[#064E1E] text-white text-xs font-bold inline-flex items-center gap-1.5 no-underline shadow-2xs cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>
                                {t(
                                  'WhatsApp पर Order Confirmation प्राप्त करें',
                                  'Get Order Confirmation on WhatsApp'
                                )}
                              </span>
                            </a>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-[#E6F0E8] shrink-0">
                          <div className="text-left sm:text-right">
                            <span className="text-xs text-[#4B6B56] block">
                              {t('कुल राशि', 'Total Amount')}
                            </span>
                            <span className="text-lg font-bold font-mono tabular-nums text-[#064E1E]">
                              ₹{order.totalAmountInr}
                            </span>
                          </div>

                          {order.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleCustomerCancelOrder(order)}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#D5C7B8] hover:border-[#9E3B1B] text-xs font-bold text-[#9E3B1B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {t('ऑर्डर रद्द करें', 'Cancel Order')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              SECTION 3: COMPLETE ADMIN DASHBOARD
              (1. Product Management, 2. New Orders, 3. Complete Orders,
               4. Customer Management, 5. Backup & Recovery + Security)
          ================================================================= */}
          {activeSection === 'admin' && (
            <div className="space-y-8">
              {!isAdminUser ? (
                <div className="bg-white border border-[#D4E4D8] rounded-2xl p-8 max-w-2xl mx-auto space-y-4 shadow-xs">
                  <div className="flex items-center gap-3 text-[#9E3B1B]">
                    <ShieldAlert className="w-6 h-6 shrink-0" />
                    <h2 className="text-lg font-bold">
                      {t(
                        'एडमिन एक्सेस अलग और प्रतिबंधित है (Separate Admin Access)',
                        'Separate & Restricted Admin Access'
                      )}
                    </h2>
                  </div>
                  <p className="text-sm text-[#2C4735] leading-relaxed">
                    {t(
                      `ग्राहकों का डेटा देखने, नया प्रोडक्ट जोड़ने/बदलने/डिलीट करने और ऑर्डर अपडेट करने का पूरा अधिकार केवल अधिकृत एडमिन के पास है।`,
                      `Full access to view customer data, add/edit/delete products, and update orders is restricted to authorized Admins.`
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection('catalog')}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B6829] text-white text-xs font-bold hover:bg-[#074F1E]"
                    >
                      {t('ग्राहक कैटलॉग पर वापस जाएं', 'Back to Customer Catalogue')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* LIVE REAL-TIME ADMIN DASHBOARD KPI SUMMARY & SECTION SWITCHER (5 Isolated Sections) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                    {/* KPI 1: Product Management (Strictly /products only) */}
                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('products')}
                      className={`text-left rounded-2xl p-4 shadow-xs flex items-center justify-between transition-all cursor-pointer ${
                        adminActiveTab === 'products'
                          ? 'bg-[#E8F6EC] border-2 border-[#0B6829] ring-2 ring-[#0B6829]/20'
                          : 'bg-white border border-[#D4E4D8] hover:border-[#0B6829]'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-[#064E1E]">
                          {t('1. Product Management', '1. Product Management')}
                        </p>
                        <p className="text-2xl font-mono font-bold text-[#064E1E] mt-0.5 tabular-nums">
                          {adminAllProducts.length}
                        </p>
                        <p className="text-[11px] font-semibold text-[#3C5A46] mt-0.5">
                          {t('केवल लॉन्च प्रोडक्ट्स', 'Launched Products Only')}
                        </p>
                      </div>
                      <ShoppingBag className="w-7 h-7 text-[#0B6829] shrink-0" />
                    </button>

                    {/* KPI 2: New Orders (Live Count — Strictly /orders only) */}
                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('new_orders')}
                      className={`text-left rounded-2xl p-4 shadow-xs flex items-center justify-between transition-all cursor-pointer ${
                        adminActiveTab === 'new_orders'
                          ? 'bg-[#FEF3C7] border-2 border-[#D97706] ring-2 ring-[#D97706]/25'
                          : 'bg-[#FFFBEB] border-2 border-[#F59E0B] hover:border-[#D97706]'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-[#92400E]">
                          {t('2. New Orders (नए ऑर्डर)', '2. New Orders')}
                        </p>
                        <p className="text-2xl font-mono font-bold text-[#B45309] mt-0.5 tabular-nums">
                          {adminNewOrders.length}
                        </p>
                        <p className="text-[11px] font-semibold text-[#92400E] mt-0.5">
                          {t('लाइव नए ग्राहक ऑर्डर', 'Live Customer Orders')}
                        </p>
                      </div>
                      <Package className="w-7 h-7 text-[#D97706] shrink-0" />
                    </button>

                    {/* KPI 3: Complete Orders (Live Count) */}
                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('complete_orders')}
                      className={`text-left rounded-2xl p-4 shadow-xs flex items-center justify-between transition-all cursor-pointer ${
                        adminActiveTab === 'complete_orders'
                          ? 'bg-[#E8F6EC] border-2 border-[#0B6829] ring-2 ring-[#0B6829]/20'
                          : 'bg-white border border-[#D4E4D8] hover:border-[#0B6829]'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-[#064E1E]">
                          {t('3. Complete Orders', '3. Complete Orders')}
                        </p>
                        <p className="text-2xl font-mono font-bold text-[#0B6829] mt-0.5 tabular-nums">
                          {adminCompleteOrders.length}
                        </p>
                        <p className="text-[11px] font-semibold text-[#3C5A46] mt-0.5">
                          {t('पूरे किए गए ऑर्डर', 'Completed Orders')}
                        </p>
                      </div>
                      <CheckCircle2 className="w-7 h-7 text-[#0B6829] shrink-0" />
                    </button>

                    {/* KPI 4: Total Registered Customers (Live Count) */}
                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('customers')}
                      className={`text-left rounded-2xl p-4 shadow-xs flex items-center justify-between transition-all cursor-pointer ${
                        adminActiveTab === 'customers'
                          ? 'bg-[#E8F6EC] border-2 border-[#0B6829] ring-2 ring-[#0B6829]/20'
                          : 'bg-white border border-[#D4E4D8] hover:border-[#0B6829]'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-[#4B6B56]">
                          {t('4. कुल ग्राहक (Customers)', '4. Customers')}
                        </p>
                        <p className="text-2xl font-mono font-bold text-[#064E1E] mt-0.5 tabular-nums">
                          {adminActiveCustomers.length}
                        </p>
                        <p className="text-[11px] font-semibold text-[#3C5A46] mt-0.5">
                          {t('ग्राहक सूची व हिस्ट्री', 'Customer List & History')}
                        </p>
                      </div>
                      <UserIcon className="w-7 h-7 text-[#0B6829] opacity-80 shrink-0" />
                    </button>

                    {/* KPI 5: Backup & Recovery Count */}
                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('backup')}
                      className={`text-left rounded-2xl p-4 shadow-xs flex items-center justify-between transition-all col-span-2 sm:col-span-1 cursor-pointer ${
                        adminActiveTab === 'backup'
                          ? 'bg-[#FDF2EC] border-2 border-[#9E3B1B] ring-2 ring-[#9E3B1B]/20'
                          : 'bg-white border border-[#D4E4D8] hover:border-[#9E3B1B]'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-[#4B6B56]">
                          {t('5. बैकअप / रिकवरी', '5. Backup / Recovery')}
                        </p>
                        <p className="text-2xl font-mono font-bold text-[#9E3B1B] mt-0.5 tabular-nums">
                          {adminDeletedOrders.length + adminDeletedCustomers.length}
                        </p>
                        <p className="text-[11px] font-semibold text-[#9E3B1B] mt-0.5">
                          {t('डिलीट रिकवरी बिन', 'Deleted Items Recovery')}
                        </p>
                      </div>
                      <ShieldAlert className="w-7 h-7 text-[#9E3B1B] opacity-80 shrink-0" />
                    </button>
                  </div>

                  {/* DEDICATED ADMIN NAVIGATION TAB BAR — Keeps Products and Customer Orders 100% Separate */}
                  <div className="bg-white border border-[#D4E4D8] rounded-2xl p-2 flex flex-wrap items-center gap-2 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('products')}
                      className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                        adminActiveTab === 'products'
                          ? 'bg-[#0B6829] text-white shadow-xs'
                          : 'bg-[#F2F9F4] text-[#16261C] hover:bg-[#E2F2E6]'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4 shrink-0" />
                      <span>
                        {t(
                          `1. Product Management (${adminAllProducts.length})`,
                          `1. Product Management (${adminAllProducts.length})`
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('new_orders')}
                      className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                        adminActiveTab === 'new_orders'
                          ? 'bg-[#D97706] text-white shadow-xs'
                          : 'bg-[#FFFBEB] text-[#92400E] border border-[#FCD34D] hover:bg-[#FEF3C7]'
                      }`}
                    >
                      <Package className="w-4 h-4 shrink-0" />
                      <span>
                        {t(
                          `2. New Orders — लाइव नए ऑर्डर (${adminNewOrders.length})`,
                          `2. New Orders — Live (${adminNewOrders.length})`
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('complete_orders')}
                      className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                        adminActiveTab === 'complete_orders'
                          ? 'bg-[#0B6829] text-white shadow-xs'
                          : 'bg-[#F2F9F4] text-[#16261C] hover:bg-[#E2F2E6]'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {t(
                          `3. Complete Orders (${adminCompleteOrders.length})`,
                          `3. Complete Orders (${adminCompleteOrders.length})`
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('customers')}
                      className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                        adminActiveTab === 'customers'
                          ? 'bg-[#0B6829] text-white shadow-xs'
                          : 'bg-[#F2F9F4] text-[#16261C] hover:bg-[#E2F2E6]'
                      }`}
                    >
                      <UserIcon className="w-4 h-4 shrink-0" />
                      <span>
                        {t(
                          `4. Customer Management (${adminActiveCustomers.length})`,
                          `4. Customer Management (${adminActiveCustomers.length})`
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminActiveTab('backup')}
                      className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                        adminActiveTab === 'backup'
                          ? 'bg-[#9E3B1B] text-white shadow-xs'
                          : 'bg-[#FDF2EC] text-[#9E3B1B] hover:bg-[#FCE7DB]'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>
                        {t(
                          `5. Backup & Recovery (${
                            adminDeletedOrders.length + adminDeletedCustomers.length
                          })`,
                          `5. Backup & Recovery (${
                            adminDeletedOrders.length + adminDeletedCustomers.length
                          })`
                        )}
                      </span>
                    </button>
                  </div>

                  {adminCustomerStatusHi && (
                    <div className="p-4 rounded-2xl bg-[#E8F6EC] border border-[#4EA868] text-[#084B1D] text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0B6829]" />
                        <span>{adminCustomerStatusHi}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdminCustomerStatusHi(null)}
                        className="text-xs underline cursor-pointer"
                      >
                        {t('बंद करें', 'Close')}
                      </button>
                    </div>
                  )}

                  {/* =========================================================
                      TAB 1: 1. PRODUCT MANAGEMENT (STRICTLY ADMIN PRODUCTS ONLY)
                      Zero Customer Orders are rendered here.
                      Collection: /products
                  ========================================================= */}
                  {adminActiveTab === 'products' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* Left 5 Columns: Add / Edit Product Form (5 Fields Only) */}
                      <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white border border-[#D4E4D8] rounded-3xl p-6 shadow-sm space-y-5">
                          <div className="border-b border-[#E6F0E8] pb-4 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-[#0B6829]">
                                {t(
                                  `1. Product Management · कलेक्शन: /products`,
                                  `1. Product Management · Collection: /products`
                                )}
                              </p>
                              <h2 className="text-xl font-bold text-[#064E1E] mt-0.5">
                                {editingProductId
                                  ? t('प्रोडक्ट एडिट करें (Edit Product)', 'Edit Product')
                                  : t(
                                      'Add Product (नया प्रोडक्ट लॉन्च करें)',
                                      'Add Product / Launch New Product'
                                    )}
                              </h2>
                              <p className="text-xs text-[#4B6B56] mt-1">
                                {t(
                                  '1. Product Name, 2. Company, 3. Photo, 4. Weight (Grams/Kg), 5. Price (₹)',
                                  '1. Product Name, 2. Company, 3. Photo, 4. Weight (Grams/Kg), 5. Price (₹)'
                                )}
                              </p>
                            </div>
                            {editingProductId && (
                              <button
                                type="button"
                                onClick={resetAdminProductForm}
                                className="px-3 py-1.5 rounded-xl bg-[#E8F6EC] border border-[#62B37A] text-[#0B6829] text-xs font-bold shrink-0 cursor-pointer"
                              >
                                {t('+ नया प्रोडक्ट', '+ Add New')}
                              </button>
                            )}
                          </div>

                          {adminProductErrorHi && (
                            <div className="p-3.5 rounded-2xl bg-[#FDF2EC] border border-[#E07A52] text-[#7A2710] text-xs font-semibold flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#9E3B1B]" />
                              <span>{adminProductErrorHi}</span>
                            </div>
                          )}

                          {adminProductStatusHi && (
                            <div className="p-3.5 rounded-2xl bg-[#E8F6EC] border border-[#4EA868] text-[#084B1D] text-xs font-bold flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0B6829]" />
                              <span>{adminProductStatusHi}</span>
                            </div>
                          )}

                          <form onSubmit={handleAdminSaveProduct} className="space-y-4" noValidate>
                            {/* 1. Product Name */}
                            <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2.5 focus-within:ring-2 focus-within:ring-[#0B6829]">
                              <label
                                htmlFor="admin-prod-name"
                                className="block text-xs sm:text-sm font-bold text-[#0B6829]"
                              >
                                {t('1. Product Name (प्रोडक्ट का नाम) *', '1. Product Name *')}
                              </label>
                              <input
                                id="admin-prod-name"
                                type="text"
                                maxLength={100}
                                value={adminProdName}
                                onChange={(e) => setAdminProdName(e.target.value)}
                                placeholder={t(
                                  'प्रोडक्ट का नाम लिखें',
                                  'Enter product name'
                                )}
                                className="w-full bg-transparent text-sm sm:text-base font-semibold text-[#16261C] placeholder:text-[#5F6F65] focus:outline-none mt-1"
                                required
                              />
                            </div>

                            {/* 2. Product Company Name */}
                            <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2.5 focus-within:ring-2 focus-within:ring-[#0B6829]">
                              <label
                                htmlFor="admin-prod-company"
                                className="block text-xs sm:text-sm font-bold text-[#0B6829]"
                              >
                                {t(
                                  '2. Company (कंपनी का नाम) *',
                                  '2. Company Name *'
                                )}
                              </label>
                              <input
                                id="admin-prod-company"
                                type="text"
                                maxLength={120}
                                value={adminProdCompanyName}
                                onChange={(e) => setAdminProdCompanyName(e.target.value)}
                                placeholder={t(
                                  'कंपनी का नाम लिखें',
                                  'Enter company name'
                                )}
                                className="w-full bg-transparent text-sm sm:text-base font-semibold text-[#16261C] placeholder:text-[#5F6F65] focus:outline-none mt-1"
                                required
                              />
                            </div>

                            {/* 3. Product Photo Upload */}
                            <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-3 space-y-2.5">
                              <label
                                htmlFor="admin-prod-photo"
                                className="block text-xs sm:text-sm font-bold text-[#0B6829]"
                              >
                                {t(
                                  '3. Photo (प्रोडक्ट फोटो अपलोड) *',
                                  '3. Product Photo *'
                                )}
                              </label>

                              {adminProdPhotoUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-[#8FD1A4] bg-white aspect-4/3 max-h-44">
                                  <img
                                    src={adminProdPhotoUrl}
                                    alt="Preview"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setAdminProdPhotoUrl('')}
                                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-[#9E3B1B] text-white text-xs font-bold shadow-xs cursor-pointer"
                                  >
                                    {t('फोटो हटाएं ✕', 'Remove Photo ✕')}
                                  </button>
                                </div>
                              ) : null}

                              <div className="flex flex-wrap items-center gap-2">
                                <label
                                  htmlFor="admin-prod-photo"
                                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#62B37A] hover:bg-[#E6F4EA] text-[#0B6829] text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                                >
                                  {uploadingPhoto ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <ImagePlus className="w-4 h-4" />
                                  )}
                                  <span>
                                    {adminProdPhotoUrl
                                      ? t('दूसरी फोटो अपलोड करें', 'Upload Another Photo')
                                      : t('मोबाइल / गैलरी से फोटो अपलोड करें', 'Upload Product Photo')}
                                  </span>
                                </label>
                                <input
                                  id="admin-prod-photo"
                                  type="file"
                                  accept="image/*"
                                  onChange={handleAdminPhotoUpload}
                                  className="hidden"
                                />
                              </div>
                            </div>

                            {/* 4. Product Weight (Grams/Kg) */}
                            <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2.5 focus-within:ring-2 focus-within:ring-[#0B6829]">
                              <label
                                htmlFor="admin-prod-weight"
                                className="block text-xs sm:text-sm font-bold text-[#0B6829]"
                              >
                                {t(
                                  '4. Weight (Grams/Kg) (प्रोडक्ट वज़न — ग्राम/किलो) *',
                                  '4. Weight (Grams/Kg) *'
                                )}
                              </label>
                              <div className="flex items-center gap-2 mt-1">
                                <Scale className="w-4 h-4 text-[#0B6829] shrink-0" />
                                <input
                                  id="admin-prod-weight"
                                  type="text"
                                  maxLength={40}
                                  value={adminProdWeightInput}
                                  onChange={(e) => setAdminProdWeightInput(e.target.value)}
                                  placeholder={t(
                                    'वज़न लिखें (Grams या Kg)',
                                    'Enter weight (Grams or Kg)'
                                  )}
                                  className="w-full bg-transparent text-sm sm:text-base font-mono font-bold text-[#16261C] placeholder:text-[#5F6F65] focus:outline-none"
                                  required
                                />
                              </div>
                            </div>

                            {/* 5. Product Price (₹) */}
                            <div className="rounded-2xl border border-[#62B37A] bg-[#F1F9F3] px-4 py-2.5 focus-within:ring-2 focus-within:ring-[#0B6829]">
                              <label
                                htmlFor="admin-prod-price"
                                className="block text-xs sm:text-sm font-bold text-[#0B6829]"
                              >
                                {t(
                                  '5. Price (₹) (प्रोडक्ट कीमत — ₹) *',
                                  '5. Price (₹) *'
                                )}
                              </label>
                              <div className="flex items-center gap-1.5 mt-1">
                                <IndianRupee className="w-4 h-4 text-[#0B6829] shrink-0" />
                                <input
                                  id="admin-prod-price"
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={100000}
                                  value={adminProdPrice}
                                  onChange={(e) => setAdminProdPrice(e.target.value)}
                                  placeholder={t('कीमत दर्ज करें (₹)', 'Enter price in ₹')}
                                  className="w-full bg-transparent text-base font-mono font-bold tabular-nums text-[#16261C] placeholder:text-[#5F6F65] focus:outline-none"
                                  required
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="submit"
                                disabled={savingProduct}
                                className="flex-1 min-h-[50px] px-5 py-3 rounded-xl bg-gradient-to-b from-[#0E742F] to-[#075820] hover:from-[#0B6528] hover:to-[#054518] text-white text-base font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                              >
                                {savingProduct ? (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>{t('सहेजा जा रहा है...', 'Saving...')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-5 h-5" />
                                    <span>
                                      {editingProductId
                                        ? t('प्रोडक्ट अपडेट करें (Update Product)', 'Update Product')
                                        : t('Add Product (प्रोडक्ट लॉन्च करें)', 'Add Product')}
                                    </span>
                                  </>
                                )}
                              </button>

                              {editingProductId && (
                                <button
                                  type="button"
                                  onClick={resetAdminProductForm}
                                  className="min-h-[50px] px-4 py-3 rounded-xl bg-[#E3EFE6] text-[#16261C] text-xs font-bold hover:bg-[#D2E5D7]"
                                >
                                  {t('रद्द करें', 'Cancel')}
                                </button>
                              )}
                            </div>
                          </form>
                        </div>
                      </div>

                      {/* Right 7 Columns: Strictly Admin Launched Products List ONLY (Zero Customer Orders) */}
                      <div className="lg:col-span-7 space-y-6">
                        <div
                          id="admin-section-products"
                          className="bg-white border border-[#D4E4D8] rounded-3xl p-6 shadow-sm space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6F0E8] pb-4">
                            <div>
                              <h3 className="text-lg font-bold text-[#064E1E]">
                                {t(
                                  `1. Product Management — लॉन्च किए गए प्रोडक्ट्स (${adminAllProducts.length})`,
                                  `1. Product Management — Launched Products (${adminAllProducts.length})`
                                )}
                              </h3>
                              <p className="text-xs text-[#4B6B56]">
                                {t(
                                  'केवल Admin द्वारा लॉन्च किए गए Products यहाँ और Customer Catalogue में दिखते हैं (कोई Customer Order यहाँ नहीं दिखता)',
                                  'Only Admin-launched Products appear here and in Customer Catalogue (Customer Orders never appear here)'
                                )}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  resetAdminProductForm();
                                  document.getElementById('admin-prod-name')?.focus();
                                }}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{t('+ Add Product', '+ Add Product')}</span>
                              </button>

                              {adminAllProducts.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleAdminDeleteAllProducts}
                                  disabled={deletingProducts}
                                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#9E3B1B] hover:bg-[#7D2C12] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  {deletingProducts ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                  <span>{t('सभी डिलीट करें', 'Delete All')}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {adminAllProducts.length === 0 ? (
                            <div className="py-10 text-center text-xs sm:text-sm text-[#4B6B56] space-y-2">
                              <p className="font-bold text-[#16261C]">
                                {t(
                                  'अभी कोई प्रोडक्ट लॉन्च नहीं किया गया है (0 प्रोडक्ट्स)।',
                                  'No products launched yet (0 Products).'
                                )}
                              </p>
                              <p>
                                {t(
                                  'बाईं ओर दिए गए 5 फील्ड भरकर "Add Product" पर क्लिक करें।',
                                  'Fill in the 5 fields on the left and click "Add Product".'
                                )}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {adminAllProducts.map((prod) => {
                                const companyLabel = prod.companyName || prod.categoryHi || '';
                                const weightDisplay = formatProductWeight(prod);
                                return (
                                  <div
                                    key={prod.id}
                                    className="p-4 rounded-2xl bg-[#F2F9F4] border border-[#C6DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                  >
                                    <div className="flex items-center gap-3.5">
                                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#B8D4C0] bg-white shrink-0 flex items-center justify-center">
                                        {prod.photoUrl ? (
                                          <img
                                            src={prod.photoUrl}
                                            alt={prod.nameHi}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <ShoppingBag className="w-6 h-6 text-[#0B6829] opacity-60" />
                                        )}
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          <span className="px-2 py-0.5 rounded-md bg-white border border-[#8FD1A4] font-bold text-[#0B6829]">
                                            {t('कंपनी:', 'Company:')} {companyLabel || '—'}
                                          </span>
                                          <span className="px-2 py-0.5 rounded-md bg-white border border-[#C6DEC9] font-mono font-bold text-[#064E1E]">
                                            {t('वज़न:', 'Weight:')} {weightDisplay}
                                          </span>
                                          <span className="px-2 py-0.5 rounded-md bg-[#E8F6EC] border border-[#62B37A] font-mono font-bold text-[#064E1E]">
                                            {t('कीमत:', 'Price:')} ₹{prod.priceInr}
                                          </span>
                                        </div>
                                        <p className="text-base font-bold text-[#16261C]">
                                          {prod.nameHi}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditProduct(prod)}
                                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-[#62B37A] text-[#0B6829] text-xs font-bold inline-flex items-center gap-1 hover:bg-[#E6F4EA] cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>{t('एडिट (Edit)', 'Edit')}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAdminDeleteSingleProduct(prod.id, prod.nameHi)
                                        }
                                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#9E3B1B] hover:bg-[#7D2C12] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>{t('डिलीट (Delete)', 'Delete')}</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                      TAB 2: 2. NEW ORDERS SECTION (STRICTLY CUSTOMER NEW ORDERS ONLY)
                      Shows: Order ID, Customer Name, Mobile Number, Product Name,
                      Company, Weight, Price, Quantity, Total Amount, GPS Delivery Address,
                      WhatsApp Notification Status & Error, and Confirm / Complete / Delete
                      Collection: /orders
                  ========================================================= */}
                  {adminActiveTab === 'new_orders' && (
                    <div
                      id="admin-section-new-orders"
                      className="bg-white border-2 border-[#D97706] rounded-3xl p-6 shadow-sm space-y-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FDE68A] pb-4">
                        <div>
                          <p className="text-xs font-bold text-[#B45309]">
                            {t(
                              '2. New Orders · कलेक्शन: /orders (केवल नए ग्राहक ऑर्डर)',
                              '2. New Orders · Collection: /orders (Incoming Customer Orders Only)'
                            )}
                          </p>
                          <h3 className="text-xl font-bold text-[#92400E] mt-0.5">
                            {t(
                              `2. New Orders — नए ग्राहक ऑर्डर (${adminNewOrders.length})`,
                              `2. New Orders — Customer Orders (${adminNewOrders.length})`
                            )}
                          </h3>
                          <p className="text-xs text-[#78350F] mt-0.5">
                            {t(
                              'Customer Name, Mobile Number, Product Name, Company, Weight, Price, Quantity, Total Amount, GPS Delivery Address और WhatsApp Notification Status देखें',
                              'View Customer Name, Mobile Number, Product Name, Company, Weight, Price, Quantity, Total Amount, GPS Delivery Address & WhatsApp Notification Status'
                            )}
                          </p>
                        </div>
                        <span className="px-4 py-2 rounded-xl bg-[#FEF3C7] border-2 border-[#F59E0B] font-mono text-sm font-bold text-[#92400E] tabular-nums">
                          {t(
                            `लाइव नए ऑर्डर (Live Count): ${adminNewOrders.length}`,
                            `Live New Orders Count: ${adminNewOrders.length}`
                          )}
                        </span>
                      </div>

                      {/* Server-Side Automatic WhatsApp Notification Engine (Zero Customer Action Required) */}
                      <div
                        className={`rounded-2xl p-5 border-2 space-y-4 text-xs ${
                          whatsappCloudConfig?.configured
                            ? 'bg-[#E8F6EC] border-[#0B6829] text-[#064E1E]'
                            : 'bg-[#FFF8EB] border-[#F59E0B] text-[#78350F]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm sm:text-base text-[#16261C]">
                                {t(
                                  'Automatic Server WhatsApp System (कस्टमर के भेजे बिना ऑटोमैटिक मैसेज)',
                                  'Automatic Server WhatsApp System (Zero Customer Action Required)'
                                )}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-md bg-white border border-[#8FD1A4] font-mono font-bold text-[#0B6829]">
                                {t('Admin WhatsApp:', 'Admin WhatsApp:')}{' '}
                                {formatAdminWhatsappDisplay(
                                  appSettings.whatsappNumber ||
                                    appSettings.contactWhatsapp ||
                                    '7507505064'
                                )}
                              </span>
                              {whatsappCloudConfig?.bridgeConnected ? (
                                <span className="px-3 py-1 rounded-lg bg-[#0B6829] text-white font-bold inline-flex items-center gap-1.5 shadow-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>
                                    {t(
                                      `✓ Admin WhatsApp (+91 7507505064) लिंक है — ऑटोमैटिक चालू`,
                                      `✓ Admin WhatsApp (+91 7507505064) Linked — Automatic Active`
                                    )}
                                  </span>
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-lg bg-[#D97706] text-white font-bold">
                                  {t(
                                    '⚡ Admin WhatsApp (+91 7507505064) लिंक करें (8-अक्षर कोड या QR से)',
                                    '⚡ Link Admin WhatsApp (+91 7507505064) with 8-Letter Code or QR'
                                  )}
                                </span>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed">
                              {whatsappCloudConfig?.configured
                                ? t(
                                    'ऑटोमैटिक सर्वर WhatsApp चालू है! अब कस्टमर केवल ऐप में ऑर्डर प्लेस करेगा — कस्टमर के WhatsApp खोले या सेंड दबाए बिना सर्वर अपने-आप +91 7507505064 (Admin) और कस्टमर दोनों के WhatsApp पर तुरंत ऑर्डर मैसेज भेज देगा।',
                                    'Automatic Server WhatsApp is active! Now whenever a customer places an order in the app — even without the customer opening WhatsApp or pressing send — the server automatically sends the WhatsApp message to +91 7507505064 (Admin) and the Customer.'
                                  )
                                : t(
                                    'कस्टमर के भेजे बिना अपने WhatsApp (+91 7507505064) पर अपने-आप ऑर्डर मैसेज पाने के लिए नीचे दिए गए 8-अंकों के पेयरिंग कोड (Pairing Code) या QR कोड से अपना Admin WhatsApp केवल एक बार सर्वर से जोड़ें।',
                                    'To receive order messages automatically on +91 7507505064 without the customer manually sending them, link your Admin WhatsApp once using the 8-Digit Pairing Code or QR Code below.'
                                  )}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {whatsappCloudConfig?.configured ? (
                              <>
                                <button
                                  type="button"
                                  disabled={whatsappBridgeActionLoading}
                                  onClick={handleAdminSendTestWhatsapp}
                                  className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                                >
                                  {whatsappBridgeActionLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Phone className="w-4 h-4" />
                                  )}
                                  <span>
                                    {t(
                                      '+91 7507505064 पर टेस्ट मैसेज भेजें',
                                      'Send Test Message to +91 7507505064'
                                    )}
                                  </span>
                                </button>
                                {whatsappCloudConfig.bridgeConnected && (
                                  <button
                                    type="button"
                                    disabled={whatsappBridgeActionLoading}
                                    onClick={handleAdminDisconnectWhatsappBridge}
                                    className="min-h-[38px] px-3 py-2 rounded-xl bg-white border border-[#9E3B1B] text-[#9E3B1B] hover:bg-[#FEF2F2] text-xs font-bold cursor-pointer"
                                  >
                                    {t('डिस्कनेक्ट करें', 'Disconnect')}
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={whatsappBridgeActionLoading}
                                onClick={() => handleAdminRequestPairingCode()}
                                className="min-h-[42px] px-4 py-2.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                              >
                                {whatsappBridgeActionLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Phone className="w-4 h-4" />
                                )}
                                <span>
                                  {t(
                                    'मोबाइल नंबर (+91 7507505064) से जोड़ें — 8-Digit Code लें',
                                    'Link with Phone (+91 7507505064) — Get 8-Digit Code'
                                  )}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {whatsappBridgeFeedbackHi && (
                          <div className="p-3 rounded-xl bg-white border border-[#62B37A] text-xs font-bold text-[#064E1E]">
                            {whatsappBridgeFeedbackHi}
                          </div>
                        )}

                        {!whatsappCloudConfig?.bridgeConnected && (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-3 border-t border-[#FDE68A]">
                            {/* Left 7 cols: 8-Letter Mobile Pairing Code (Clean boxes, no hyphen paste issue!) */}
                            <div className="lg:col-span-7 bg-white border-2 border-[#0B6829] rounded-2xl p-5 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6F0E8] pb-3">
                                <div>
                                  <span className="text-sm sm:text-base font-bold text-[#064E1E] block">
                                    {t(
                                      'तरीका 1: 8-अक्षरों के कोड से जोड़ें (फोन पर सबसे आसान)',
                                      'Option 1: Link with 8-Letter Pairing Code (Easiest on phone)'
                                    )}
                                  </span>
                                  <span className="text-xs text-[#4B6B56]">
                                    {t(
                                      'WhatsApp -> Linked Devices -> Link with phone number instead में डालें',
                                      'Enter in WhatsApp -> Linked Devices -> Link with phone number instead'
                                    )}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="flex items-center border border-[#8FD1A4] rounded-xl px-2 py-1 bg-[#F8FBF9] text-xs font-mono font-bold">
                                    <span className="text-[#0B6829] mr-1">+91</span>
                                    <input
                                      type="tel"
                                      maxLength={10}
                                      value={adminConnectPhoneInput}
                                      onChange={(e) =>
                                        setAdminConnectPhoneInput(
                                          e.target.value.replace(/\D/g, '').slice(0, 10)
                                        )
                                      }
                                      className="w-24 bg-transparent outline-none text-[#16261C] font-bold"
                                      placeholder="7507505064"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    disabled={whatsappBridgeActionLoading}
                                    onClick={() => handleAdminRequestPairingCode()}
                                    className="px-3 py-1.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                                  >
                                    <RefreshCw
                                      className={`w-3.5 h-3.5 ${
                                        whatsappBridgeActionLoading ? 'animate-spin' : ''
                                      }`}
                                    />
                                    <span>{t('नया कोड लें', 'Get Fresh Code')}</span>
                                  </button>
                                </div>
                              </div>

                              {whatsappCloudConfig?.pairingCode ? (
                                <div className="p-4 rounded-2xl bg-[#F1F9F3] border-2 border-[#0B6829] space-y-3">
                                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-bold text-[#4B6B56] block">
                                        {t(
                                          `आपका 8-अक्षरों का कोड (+91 ${
                                            adminConnectPhoneInput || '7507505064'
                                          } के लिए):`,
                                          `Your 8-Letter Code (for +91 ${
                                            adminConnectPhoneInput || '7507505064'
                                          }):`
                                        )}
                                      </span>
                                      {/* Individual 8 letter boxes so user can easily read and type into WhatsApp's 8 boxes */}
                                      <div className="flex items-center gap-1.5">
                                        {whatsappCloudConfig.pairingCode
                                          .replace(/[^A-Za-z0-9]/g, '')
                                          .slice(0, 8)
                                          .split('')
                                          .map((ch, idx) => (
                                            <React.Fragment key={idx}>
                                              {idx === 4 && (
                                                <span className="text-xl font-bold text-[#0B6829] px-1">
                                                  –
                                                </span>
                                              )}
                                              <span className="w-8 h-10 sm:w-10 sm:h-12 rounded-lg bg-white border-2 border-[#0B6829] flex items-center justify-center font-mono text-xl sm:text-2xl font-black text-[#064E1E] shadow-xs">
                                                {ch}
                                              </span>
                                            </React.Fragment>
                                          ))}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cleanCode = (
                                          whatsappCloudConfig.pairingCode || ''
                                        ).replace(/[^A-Za-z0-9]/g, '');
                                        if (cleanCode) {
                                          navigator.clipboard?.writeText(cleanCode);
                                          setWhatsappBridgeFeedbackHi(
                                            t(
                                              `✓ 8-अक्षरों का कोड (${cleanCode}) कॉपी हो गया! अपने WhatsApp -> Linked Devices -> Link with phone number में पेस्ट करें।`,
                                              `✓ 8-Letter Code (${cleanCode}) copied! Paste it in WhatsApp -> Linked Devices -> Link with phone number.`
                                            )
                                          );
                                        }
                                      }}
                                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs sm:text-sm font-bold shadow-md cursor-pointer shrink-0 inline-flex items-center gap-2"
                                    >
                                      <Phone className="w-4 h-4" />
                                      <span>
                                        {t('कोड कॉपी करें (Copy Code)', 'Copy Code')}
                                      </span>
                                    </button>
                                  </div>

                                  <p className="text-[11px] text-[#064E1E] bg-white rounded-lg p-2 border border-[#8FD1A4]">
                                    {t(
                                      '📌 ध्यान दें: WhatsApp में 8 अलग-अलग बॉक्स होते हैं। "Copy Code" दबाने पर केवल 8 अक्षर कॉपी होते हैं (बिना किसी डैश के), ताकि पेस्ट करने पर सभी 8 बॉक्स सही से भर जाएँ।',
                                      '📌 Note: WhatsApp has 8 individual boxes. Clicking "Copy Code" copies only the 8 letters (without any dash) so all 8 boxes fill accurately on paste.'
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <div className="p-4 rounded-xl bg-[#F8FBF9] border border-[#CBE4D2] text-xs text-[#23452E] flex items-center justify-between gap-3">
                                  <span>
                                    {t(
                                      'कोड तैयार करने के लिए "नया कोड लें" बटन दबाएं।',
                                      'Click "Get Fresh Code" to generate your code.'
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleAdminRequestPairingCode()}
                                    className="px-3 py-1.5 rounded-lg bg-[#0B6829] text-white text-xs font-bold"
                                  >
                                    {t('कोड जनरेट करें', 'Generate Code')}
                                  </button>
                                </div>
                              )}

                              <div className="space-y-1.5 bg-[#FFFBEB] rounded-xl p-3 border border-[#FDE68A] text-[11px] sm:text-xs text-[#78350F]">
                                <span className="font-bold block text-[#92400E]">
                                  {t('3 सरल स्टेप्स में जोड़ें:', 'Link in 3 Simple Steps:')}
                                </span>
                                <ol className="list-decimal list-inside space-y-1 font-medium text-[#16261C]">
                                  <li>
                                    {t(
                                      'अपने मोबाइल में WhatsApp खोलें ➔ ऊपर तीन डॉट्स (⋮) ➔ Linked devices पर टैप करें।',
                                      'Open WhatsApp on phone ➔ Three dots (⋮) ➔ Linked devices.'
                                    )}
                                  </li>
                                  <li>
                                    {t(
                                      '"Link a device" दबाएं ➔ नीचे नीले रंग में "Link with phone number instead" चुनें।',
                                      'Tap "Link a device" ➔ Choose "Link with phone number instead" at the bottom.'
                                    )}
                                  </li>
                                  <li>
                                    {t(
                                      'ऊपर दिया गया 8-अक्षरों का कोड डालें। लिंक होते ही सभी 6 पेंडिंग ऑर्डर अपने-आप आपके WhatsApp पर आ जाएंगे!',
                                      'Enter the 8-letter code above. Once linked, all 6 pending orders will arrive automatically on your WhatsApp!'
                                    )}
                                  </li>
                                </ol>
                              </div>
                            </div>

                            {/* Right 5 cols: Live Instant QR Code Option */}
                            <div className="lg:col-span-5 bg-white border-2 border-[#F59E0B] rounded-2xl p-5 flex flex-col items-center justify-between gap-3 text-center">
                              <div className="w-full flex items-center justify-between gap-2 border-b border-[#FDE68A] pb-2">
                                <span className="text-xs sm:text-sm font-bold text-[#78350F]">
                                  {t('तरीका 2: सीधे QR कोड स्कैन करें', 'Option 2: Scan QR Code')}
                                </span>
                                <button
                                  type="button"
                                  disabled={whatsappBridgeActionLoading}
                                  onClick={handleAdminRefreshWhatsappQr}
                                  className="px-2.5 py-1 rounded-lg bg-[#FFFBEB] border border-[#F59E0B] text-[#92400E] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw
                                    className={`w-3 h-3 ${
                                      whatsappBridgeActionLoading ? 'animate-spin' : ''
                                    }`}
                                  />
                                  <span>{t('नया QR', 'Refresh QR')}</span>
                                </button>
                              </div>

                              {whatsappCloudConfig?.qrDataUrl ? (
                                <div className="p-2 rounded-2xl bg-white border-2 border-[#0B6829] shadow-sm">
                                  <img
                                    src={whatsappCloudConfig.qrDataUrl}
                                    alt="WhatsApp Server QR"
                                    className="w-48 h-48 rounded-xl object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-[#F59E0B] flex flex-col items-center justify-center p-3 text-xs text-[#78350F] gap-2">
                                  <Loader2 className="w-6 h-6 animate-spin text-[#0B6829]" />
                                  <span>
                                    {t('QR कोड तैयार किया जा रहा है...', 'Generating QR Code...')}
                                  </span>
                                </div>
                              )}

                              <div className="space-y-1">
                                <p className="text-[11px] font-bold text-[#064E1E]">
                                  {t(
                                    'कैमरा से स्कैन करने के लिए: WhatsApp ➔ Linked devices ➔ Link a device खोलकर सीधे इस QR को स्कैन करें।',
                                    'To scan: WhatsApp ➔ Linked devices ➔ Link a device and scan this QR code.'
                                  )}
                                </p>
                                {whatsappCloudConfig?.pendingQueueCount ? (
                                  <span className="px-2.5 py-1 rounded-md bg-[#FEF3C7] text-[#92400E] font-bold text-xs inline-block">
                                    ⚡ {whatsappCloudConfig.pendingQueueCount} ऑर्डर कतार में हैं
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {adminOrdersLoading ? (
                        <div className="py-12 flex items-center justify-center gap-2 text-xs text-[#23452E]">
                          <Loader2 className="w-5 h-5 animate-spin text-[#0B6829]" />
                          <span>
                            {t('नए ऑर्डर लोड किए जा रहे हैं...', 'Loading new orders...')}
                          </span>
                        </div>
                      ) : adminNewOrders.length === 0 ? (
                        <div className="py-10 text-center text-xs sm:text-sm text-[#4B6B56]">
                          {t(
                            'अभी कोई नया (Pending / Confirmed / Shipped) ऑर्डर नहीं है।',
                            'No new (Pending / Confirmed / Shipped) orders at the moment.'
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {adminNewOrders.map((ord) => {
                            const currentNoteValue =
                              orderAdminNoteDrafts[ord.id] !== undefined
                                ? orderAdminNoteDrafts[ord.id]
                                : ord.adminNoteHi || '';
                            const parsedItems = parseOrderItemsSummary(
                              ord.itemsSummary,
                              ord.totalItemsCount,
                              ord.totalAmountInr
                            );
                            const mobileDisplay = formatOrderMobileDisplay(ord, adminCustomers);
                            const orderGpsCoords = resolveOrderGpsCoordinates(ord, adminCustomers);
                            const isGenuinelySentOnWhatsApp = Boolean(
                              ord.whatsappNotificationStatus === 'sent' && ord.whatsappMessageId
                            );
                            const isCustomerGenuinelySentOnWhatsApp = Boolean(
                              ord.customerWhatsappStatus === 'sent' && ord.customerWhatsappMessageId
                            );
                            const formattedWhatsappOrderText = buildOrderWhatsAppNotificationText(
                              ord,
                              parsedItems,
                              mobileDisplay,
                              orderGpsCoords
                            );
                            const formattedCustomerWhatsappText =
                              buildCustomerWhatsAppNotificationText(ord, parsedItems);
                            const directAdminOrderWhatsappUrl = buildAdminWhatsappChatUrl(
                              appSettings.whatsappNumber ||
                                appSettings.contactWhatsapp ||
                                '7507505064',
                              formattedWhatsappOrderText
                            );
                            const directCustomerOrderWhatsappUrl = buildCustomerDirectWhatsappUrl(
                              mobileDisplay,
                              formattedCustomerWhatsappText
                            );
                            const placedTiming = formatOrderFullDateTime(ord.createdAt, lang);

                            return (
                              <div
                                key={ord.id}
                                className="bg-[#FFFBEB] border-2 border-[#FCD34D] rounded-2xl p-5 flex flex-col gap-4"
                              >
                                {/* Top Row: Order ID, Status, Payment & Total Amount */}
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#FDE68A] pb-3">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#78350F]">
                                      <span className="px-2.5 py-1 rounded-lg bg-white border border-[#F59E0B] font-mono font-bold text-[#16261C]">
                                        {t('Order ID:', 'Order ID:')} #{ord.id.slice(0, 8).toUpperCase()}
                                      </span>
                                      <span className="px-2.5 py-1 rounded-lg bg-[#FEF3C7] font-bold text-[#92400E]">
                                        {t('स्थिति:', 'Status:')} {getOrderStatusLabel(ord.status)}
                                      </span>
                                      <span>·</span>
                                      <span className="font-bold text-[#92400E]">
                                        {t('भुगतान:', 'Payment:')} {ord.paymentMethod}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0 bg-white border border-[#F59E0B] rounded-xl px-3.5 py-2">
                                    <span className="text-[11px] font-bold text-[#78350F] block">
                                      {t('Total Amount (कुल राशि)', 'Total Amount')}
                                    </span>
                                    <span className="text-xl font-mono font-bold text-[#064E1E] tabular-nums">
                                      ₹{ord.totalAmountInr}
                                    </span>
                                  </div>
                                </div>

                                {/* Prominent Order Date & Time Banner */}
                                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white border border-[#FCD34D] text-xs">
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[#78350F]">
                                    <div className="flex items-center gap-1.5 font-bold">
                                      <Calendar className="w-4 h-4 text-[#D97706]" />
                                      <span>{t('ऑर्डर मिलने की तारीख:', 'Order Date:')}</span>
                                      <span className="font-semibold text-[#16261C]">{placedTiming.dateDisplay}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-bold">
                                      <Clock className="w-4 h-4 text-[#D97706]" />
                                      <span>{t('समय:', 'Time:')}</span>
                                      <span className="font-semibold text-[#16261C]">{placedTiming.timeDisplay} (IST)</span>
                                    </div>
                                  </div>
                                  {placedTiming.relativeDisplay && (
                                    <span className="px-2.5 py-1 rounded-lg bg-[#FEF3C7] text-[#92400E] font-bold text-[11px] shrink-0">
                                      ⏱️ {placedTiming.relativeDisplay}
                                    </span>
                                  )}
                                </div>

                                {/* Customer Info Grid: Customer Name, Mobile Number, Full Saved GPS Address + Lat/Lng + View on Map */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-[#FDE68A] rounded-xl p-3.5 text-xs">
                                  <div>
                                    <span className="font-bold text-[#78350F] block">
                                      {t('Customer Name (ग्राहक का नाम):', 'Customer Name:')}
                                    </span>
                                    <span className="text-sm font-bold text-[#16261C]">
                                      {ord.customerName}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="font-bold text-[#78350F] block">
                                      {t('Mobile Number (मोबाइल नंबर):', 'Mobile Number:')}
                                    </span>
                                    <span className="text-sm font-mono font-bold text-[#0B6829]">
                                      {mobileDisplay}
                                    </span>
                                  </div>

                                  <div className="space-y-1.5">
                                    <span className="font-bold text-[#78350F] block">
                                      {t(
                                        'GPS Delivery Address (डिलीवरी पता):',
                                        'GPS Delivery Address:'
                                      )}
                                    </span>
                                    <span className="text-xs sm:text-sm font-semibold text-[#16261C] block">
                                      {ord.gpsAddress || ord.deliveryAddress} —{' '}
                                      <span className="font-mono font-bold">
                                        PIN: {ord.pinCode}
                                      </span>
                                    </span>
                                    {orderGpsCoords ? (
                                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                        <span className="font-mono text-[11px] font-bold text-[#064E1E] bg-[#E8F6EC] px-2 py-0.5 rounded-md border border-[#8FD1A4]">
                                          Lat: {orderGpsCoords.lat.toFixed(6)}, Lng:{' '}
                                          {orderGpsCoords.lng.toFixed(6)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setActiveMapViewModal({
                                              titleHi: `ऑर्डर #${ord.id
                                                .slice(0, 8)
                                                .toUpperCase()} — ग्राहक की GPS लोकेशन`,
                                              titleEn: `Order #${ord.id
                                                .slice(0, 8)
                                                .toUpperCase()} — Customer GPS Location`,
                                              customerName: ord.customerName,
                                              mobileNumber: mobileDisplay,
                                              address: `${ord.gpsAddress || ord.deliveryAddress} (PIN: ${
                                                ord.pinCode
                                              })`,
                                              lat: orderGpsCoords.lat,
                                              lng: orderGpsCoords.lng,
                                              orderId: ord.id,
                                            })
                                          }
                                          className="min-h-[32px] px-3 py-1 rounded-lg bg-[#0B6829] hover:bg-[#074F1E] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          <MapPin className="w-3.5 h-3.5" />
                                          <span>{t('View on Map (मैप पर देखें)', 'View on Map')}</span>
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-[#78350F] block">
                                        {t(
                                          'स्थायी डिलीवरी पता ऑर्डर में सुरक्षित है',
                                          'Permanent delivery address snapshot saved with order'
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Ordered Products Breakdown: Product Name, Company, Weight, Price, Quantity */}
                                <div className="bg-white border border-[#FDE68A] rounded-xl p-3.5 space-y-2">
                                  <p className="text-xs font-bold text-[#92400E]">
                                    {t(
                                      'ऑर्डर किए गए प्रोडक्ट्स (Product Name, Company, Weight, Price, Quantity):',
                                      'Ordered Products (Product Name, Company, Weight, Price, Quantity):'
                                    )}
                                  </p>
                                  <div className="space-y-2">
                                    {parsedItems.map((pItem, idx) => (
                                      <div
                                        key={`${ord.id}_item_${idx}`}
                                        className="p-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs"
                                      >
                                        <div>
                                          <span className="text-[11px] font-bold text-[#78350F] block">
                                            {t('Product Name:', 'Product Name:')}
                                          </span>
                                          <span className="font-bold text-[#16261C]">
                                            {pItem.productName}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-bold text-[#78350F] block">
                                            {t('Company (कंपनी):', 'Company:')}
                                          </span>
                                          <span className="font-bold text-[#0B6829]">
                                            {pItem.companyName}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-bold text-[#78350F] block">
                                            {t('Weight (वज़न):', 'Weight:')}
                                          </span>
                                          <span className="font-mono font-bold text-[#0B6829]">
                                            {pItem.weight}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-bold text-[#78350F] block">
                                            {t('Price (कीमत):', 'Price:')}
                                          </span>
                                          <span className="font-mono font-bold text-[#064E1E]">
                                            {pItem.priceDisplay}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-bold text-[#78350F] block">
                                            {t('Quantity (मात्रा):', 'Quantity:')}
                                          </span>
                                          <span className="font-mono font-bold text-[#064E1E]">
                                            {pItem.quantity}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Dual WhatsApp Notification Status & Error Panel (1. Admin Notification + 2. Customer Confirmation & Status Updates) */}
                                <div className="rounded-xl p-3.5 border border-[#F59E0B] bg-white text-xs space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#FDE68A] pb-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-[#16261C]">
                                        {t(
                                          'Automatic WhatsApp Notification Status (Admin & Customer):',
                                          'Automatic WhatsApp Notification Status (Admin & Customer):'
                                        )}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-[#E8F6EC] border border-[#8FD1A4] font-bold text-[#064E1E]">
                                        {t(
                                          '✓ ऑर्डर Firebase में सुरक्षित',
                                          '✓ Order Safe in Firebase'
                                        )}
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      {(!isGenuinelySentOnWhatsApp ||
                                        !isCustomerGenuinelySentOnWhatsApp) && (
                                        <button
                                          type="button"
                                          disabled={retryingWhatsappOrderId === ord.id}
                                          onClick={() => handleAdminRetryOrderWhatsApp(ord)}
                                          className="min-h-[32px] px-3 py-1 rounded-lg bg-white border border-[#0B6829] text-[#0B6829] hover:bg-[#E8F6EC] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          <RefreshCw
                                            className={`w-3.5 h-3.5 ${
                                              retryingWhatsappOrderId === ord.id
                                                ? 'animate-spin'
                                                : ''
                                            }`}
                                          />
                                          <span>
                                            {t(
                                              'Cloud API पुनः प्रयास (Retry)',
                                              'Retry Cloud API'
                                            )}
                                          </span>
                                        </button>
                                      )}

                                      <a
                                        href={directAdminOrderWhatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-h-[32px] px-3 py-1 rounded-lg bg-[#128C7E] hover:bg-[#075E54] text-white text-[11px] font-bold inline-flex items-center gap-1 no-underline cursor-pointer"
                                      >
                                        <Phone className="w-3.5 h-3.5" />
                                        <span>
                                          {t(
                                            'Admin WhatsApp (+91 7507505064)',
                                            'Admin WhatsApp (+91 7507505064)'
                                          )}
                                        </span>
                                      </a>

                                      <a
                                        href={directCustomerOrderWhatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-h-[32px] px-3 py-1 rounded-lg bg-[#0B6829] hover:bg-[#064E1E] text-white text-[11px] font-bold inline-flex items-center gap-1 no-underline cursor-pointer"
                                      >
                                        <Phone className="w-3.5 h-3.5" />
                                        <span>
                                          {t(
                                            `Customer WhatsApp (${mobileDisplay})`,
                                            `Customer WhatsApp (${mobileDisplay})`
                                          )}
                                        </span>
                                      </a>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* 1. Admin WhatsApp Notification Status (+91 7507505064) */}
                                    <div
                                      className={`p-2.5 rounded-lg border space-y-1 ${
                                        isGenuinelySentOnWhatsApp
                                          ? 'bg-[#E8F6EC] border-[#62B37A] text-[#064E1E]'
                                          : ord.whatsappNotificationStatus === 'sending' ||
                                            ord.whatsappNotificationStatus === 'pending'
                                          ? 'bg-[#FFFBEB] border-[#F59E0B] text-[#78350F]'
                                          : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#7F1D1D]'
                                      }`}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <span className="font-bold text-[#16261C]">
                                          {t(
                                            '1. Admin Notification (+91 7507505064):',
                                            '1. Admin Notification (+91 7507505064):'
                                          )}
                                        </span>
                                        {isGenuinelySentOnWhatsApp ? (
                                          <span className="px-2 py-0.5 rounded bg-[#0B6829] text-white font-bold text-[11px]">
                                            {t('✓ Sent', '✓ Sent')}
                                          </span>
                                        ) : ord.whatsappNotificationStatus === 'sending' ||
                                          ord.whatsappNotificationStatus === 'pending' ? (
                                          <span className="px-2 py-0.5 rounded bg-[#D97706] text-white font-bold text-[11px]">
                                            {t('Sending...', 'Sending...')}
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded bg-[#9E3B1B] text-white font-bold text-[11px]">
                                            {t('Not Sent / Error', 'Not Sent / Error')}
                                          </span>
                                        )}
                                      </div>
                                      {isGenuinelySentOnWhatsApp ? (
                                        <p className="text-[11px] font-mono text-[#064E1E]">
                                          ID: {ord.whatsappMessageId}
                                        </p>
                                      ) : (
                                        <p className="text-[11px] leading-snug">
                                          {ord.whatsappNotificationError ||
                                            t(
                                              'सर्वर पर Meta WhatsApp Cloud API क्रेडेंशियल्स कॉन्फ़िगर नहीं हैं (Not Sent)।',
                                              'Meta WhatsApp Cloud API credentials are not configured on server (Not Sent).'
                                            )}
                                        </p>
                                      )}
                                    </div>

                                    {/* 2. Customer WhatsApp Confirmation & Status Update */}
                                    <div
                                      className={`p-2.5 rounded-lg border space-y-1 ${
                                        isCustomerGenuinelySentOnWhatsApp
                                          ? 'bg-[#E8F6EC] border-[#62B37A] text-[#064E1E]'
                                          : ord.customerWhatsappStatus === 'sending' ||
                                            ord.customerWhatsappStatus === 'pending'
                                          ? 'bg-[#FFFBEB] border-[#F59E0B] text-[#78350F]'
                                          : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#7F1D1D]'
                                      }`}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <span className="font-bold text-[#16261C]">
                                          {t(
                                            `2. Customer WhatsApp (${mobileDisplay}):`,
                                            `2. Customer WhatsApp (${mobileDisplay}):`
                                          )}
                                        </span>
                                        {isCustomerGenuinelySentOnWhatsApp ? (
                                          <span className="px-2 py-0.5 rounded bg-[#0B6829] text-white font-bold text-[11px]">
                                            {t('✓ Sent', '✓ Sent')}
                                          </span>
                                        ) : ord.customerWhatsappStatus === 'sending' ||
                                          ord.customerWhatsappStatus === 'pending' ? (
                                          <span className="px-2 py-0.5 rounded bg-[#D97706] text-white font-bold text-[11px]">
                                            {t('Sending...', 'Sending...')}
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded bg-[#9E3B1B] text-white font-bold text-[11px]">
                                            {t('Not Sent / Error', 'Not Sent / Error')}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] font-semibold text-[#16261C]">
                                        {t('Event:', 'Event:')}{' '}
                                        {ord.customerWhatsappLastEvent === 'confirmed'
                                          ? t('Order Confirmed Update', 'Order Confirmed Update')
                                          : ord.customerWhatsappLastEvent === 'delivered'
                                          ? t('Order Complete Update', 'Order Complete Update')
                                          : ord.customerWhatsappLastEvent === 'cancelled'
                                          ? t('Order Cancelled Update', 'Order Cancelled Update')
                                          : t('Order Confirmation', 'Order Confirmation')}
                                      </p>
                                      {isCustomerGenuinelySentOnWhatsApp ? (
                                        <p className="text-[11px] font-mono text-[#064E1E]">
                                          ID: {ord.customerWhatsappMessageId}
                                        </p>
                                      ) : (
                                        <p className="text-[11px] leading-snug">
                                          {ord.customerWhatsappError ||
                                            ord.whatsappNotificationError ||
                                            t(
                                              'सर्वर पर Meta WhatsApp Cloud API क्रेडेंशियल्स कॉन्फ़िगर नहीं हैं (Not Sent)।',
                                              'Meta WhatsApp Cloud API credentials are not configured on server (Not Sent).'
                                            )}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Live Order Note for Customer */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                                  <input
                                    type="text"
                                    maxLength={300}
                                    value={currentNoteValue}
                                    onChange={(e) =>
                                      setOrderAdminNoteDrafts((prev) => ({
                                        ...prev,
                                        [ord.id]: e.target.value,
                                      }))
                                    }
                                    placeholder={t(
                                      'ग्राहक के लिए ऑर्डर/डिलीवरी संदेश लिखें...',
                                      'Write an order/delivery update note for the customer...'
                                    )}
                                    className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#D4E4D8] text-xs text-[#16261C] focus:outline-none focus:border-[#0B6829]"
                                  />
                                  <button
                                    type="button"
                                    disabled={adminActionLoadingId === ord.id}
                                    onClick={() => handleAdminSaveOrderNote(ord.id)}
                                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white border border-[#0B6829] text-[#0B6829] hover:bg-[#E8F6EC] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    {t('संदेश भेजें', 'Send Note')}
                                  </button>
                                </div>

                                {/* Order Action Controls: Pending, Confirm, Shipped, Complete, Cancel & Delete */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#FDE68A]">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-[#78350F]">
                                      {t('Order Status:', 'Order Status:')}
                                    </span>
                                    {(['pending', 'confirmed', 'shipped'] as const).map((st) => (
                                      <button
                                        key={st}
                                        type="button"
                                        disabled={
                                          ord.status === st || adminActionLoadingId === ord.id
                                        }
                                        onClick={() => handleAdminUpdateOrderStatus(ord.id, st)}
                                        className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                          ord.status === st
                                            ? 'bg-[#92400E] text-white shadow-2xs'
                                            : 'bg-white border border-[#D4E4D8] text-[#2C4735] hover:border-[#92400E]'
                                        }`}
                                      >
                                        {getOrderStatusLabel(st)}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {ord.status !== 'confirmed' && (
                                      <button
                                        type="button"
                                        disabled={adminActionLoadingId === ord.id}
                                        onClick={() =>
                                          handleAdminUpdateOrderStatus(ord.id, 'confirmed')
                                        }
                                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>
                                          {t('Confirm (ऑर्डर कन्फ़र्म करें)', 'Confirm Order')}
                                        </span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      disabled={adminActionLoadingId === ord.id}
                                      onClick={() => handleAdminMarkOrderComplete(ord.id)}
                                      className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-b from-[#0E742F] to-[#075820] hover:from-[#0B6528] hover:to-[#054518] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>
                                        {t(
                                          'Complete (ऑर्डर Complete करें)',
                                          'Complete (Mark as Complete)'
                                        )}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={adminActionLoadingId === ord.id}
                                      onClick={() =>
                                        handleAdminUpdateOrderStatus(ord.id, 'cancelled')
                                      }
                                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      <X className="w-4 h-4" />
                                      <span>{t('Cancel (ऑर्डर रद्द करें)', 'Cancel Order')}</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={adminActionLoadingId === ord.id}
                                      onClick={() => handleRequestDeleteCompleteOrder(ord)}
                                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#9E3B1B] hover:bg-[#7D2C12] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      <span>{t('Delete (डिलीट करें)', 'Delete Order')}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* =========================================================
                      TAB 3: 3. COMPLETE ORDERS SECTION (STRICTLY COMPLETED ORDERS ONLY)
                      Shows: Full details of completed orders + Delete with Confirmation
                      Collection: /orders (status === 'delivered')
                  ========================================================= */}
                  {adminActiveTab === 'complete_orders' && (
                    <div
                      id="admin-section-complete-orders"
                      className="bg-white border-2 border-[#0B6829] rounded-3xl p-6 shadow-sm space-y-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6F0E8] pb-4">
                        <div>
                          <p className="text-xs font-bold text-[#0B6829]">
                            {t(
                              '3. Complete Orders · कलेक्शन: /orders (केवल पूरे किए गए ऑर्डर)',
                              '3. Complete Orders · Collection: /orders (Completed Orders Only)'
                            )}
                          </p>
                          <h3 className="text-xl font-bold text-[#064E1E] mt-0.5">
                            {t(
                              `3. Complete Orders — पूरे हुए ऑर्डर (${adminCompleteOrders.length})`,
                              `3. Complete Orders (${adminCompleteOrders.length})`
                            )}
                          </h3>
                          <p className="text-xs text-[#4B6B56] mt-0.5">
                            {t(
                              'सभी पुराने Complete किए गए Orders की पूरी जानकारी देखें या Confirmation के साथ Delete करें',
                              'View full details of all completed orders or delete with confirmation popup'
                            )}
                          </p>
                        </div>
                        <span className="px-4 py-2 rounded-xl bg-[#E8F6EC] border border-[#62B37A] font-mono text-sm font-bold text-[#064E1E] tabular-nums">
                          {t(
                            `कुल Complete Orders: ${adminCompleteOrders.length}`,
                            `Total Complete Orders: ${adminCompleteOrders.length}`
                          )}
                        </span>
                      </div>

                      {adminOrdersLoading ? (
                        <div className="py-10 flex items-center justify-center gap-2 text-xs text-[#23452E]">
                          <Loader2 className="w-5 h-5 animate-spin text-[#0B6829]" />
                          <span>
                            {t(
                              'Complete Orders लोड हो रहे हैं...',
                              'Loading completed orders...'
                            )}
                          </span>
                        </div>
                      ) : adminCompleteOrders.length === 0 ? (
                        <div className="py-10 text-center text-xs sm:text-sm text-[#4B6B56]">
                          {t(
                            'अभी तक कोई ऑर्डर Complete मार्क नहीं किया गया है।',
                            'No completed orders yet.'
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {adminCompleteOrders.map((ord) => {
                            const parsedItems = parseOrderItemsSummary(
                              ord.itemsSummary,
                              ord.totalItemsCount,
                              ord.totalAmountInr
                            );
                            const mobileDisplay = formatOrderMobileDisplay(ord, adminCustomers);
                            const isGenuinelySentOnWhatsApp = Boolean(
                              ord.whatsappNotificationStatus === 'sent' && ord.whatsappMessageId
                            );
                            const isCustomerGenuinelySentOnWhatsApp = Boolean(
                              ord.customerWhatsappStatus === 'sent' && ord.customerWhatsappMessageId
                            );
                            const placedTiming = formatOrderFullDateTime(ord.createdAt, lang);
                            const completedTimestamp =
                              ord.deliveredAt || ord.completedAt || ord.updatedAt || ord.createdAt;
                            const completedTiming = formatOrderFullDateTime(completedTimestamp, lang);
                            const completionDuration = formatOrderDuration(
                              ord.createdAt,
                              completedTimestamp,
                              lang
                            );

                            return (
                              <div
                                key={ord.id}
                                className="p-5 rounded-2xl bg-[#F2F9F4] border border-[#8FD1A4] flex flex-col gap-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#C6DEC9] pb-3">
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#3C5A46]">
                                    <span className="px-2.5 py-1 rounded-lg bg-[#0B6829] text-white font-bold">
                                      {t('✓ Complete', '✓ Complete')}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#8FD1A4] font-mono font-bold text-[#16261C]">
                                      {t('Order ID:', 'Order ID:')} #{ord.id.slice(0, 8).toUpperCase()}
                                    </span>
                                    <span>·</span>
                                    <span className="font-bold text-[#064E1E]">
                                      {t('भुगतान:', 'Payment:')} {ord.paymentMethod}
                                    </span>
                                    <span>·</span>
                                    <span
                                      className={`px-2 py-0.5 rounded-md font-bold ${
                                        isGenuinelySentOnWhatsApp
                                          ? 'bg-[#0B6829] text-white'
                                          : 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]'
                                      }`}
                                    >
                                      {isGenuinelySentOnWhatsApp
                                        ? t('Admin WA: ✓ Sent', 'Admin WA: ✓ Sent')
                                        : t('Admin WA: Not Sent', 'Admin WA: Not Sent')}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-md font-bold ${
                                        isCustomerGenuinelySentOnWhatsApp
                                          ? 'bg-[#0B6829] text-white'
                                          : 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]'
                                      }`}
                                    >
                                      {isCustomerGenuinelySentOnWhatsApp
                                        ? t('Customer WA: ✓ Sent', 'Customer WA: ✓ Sent')
                                        : t('Customer WA: Not Sent', 'Customer WA: Not Sent')}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="text-right bg-white border border-[#8FD1A4] rounded-xl px-3.5 py-1.5">
                                      <span className="text-[10px] font-bold text-[#4B6B56] block">
                                        {t('Total Amount', 'Total Amount')}
                                      </span>
                                      <span className="text-lg font-mono font-bold text-[#064E1E] tabular-nums">
                                        ₹{ord.totalAmountInr}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      disabled={adminActionLoadingId === ord.id}
                                      onClick={() => handleRequestDeleteCompleteOrder(ord)}
                                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#9E3B1B] hover:bg-[#7D2C12] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>
                                        {t('Complete Order डिलीट करें', 'Delete Complete Order')}
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                {/* Prominent Dual Date & Time: When Order Was Received, When Completed, and Total Duration */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-white border border-[#8FD1A4] text-xs">
                                  {/* Box 1: Order Placed / Received */}
                                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#F7FBF8] border border-[#C6DEC9]">
                                    <Calendar className="w-4 h-4 text-[#0B6829] shrink-0 mt-0.5" />
                                    <div className="space-y-0.5 min-w-0">
                                      <span className="text-[11px] font-bold text-[#4B6B56] block">
                                        {t('1. ऑर्डर मिलने की तारीख व समय (Placed)', '1. Order Received Date & Time')}
                                      </span>
                                      <p className="font-bold text-[#16261C] leading-tight">
                                        {placedTiming.dateDisplay}
                                      </p>
                                      <p className="text-[11px] text-[#4B6B56]">
                                        ⏱️ <span className="font-semibold">{placedTiming.timeDisplay} (IST)</span>
                                      </p>
                                    </div>
                                  </div>

                                  {/* Box 2: Order Completed / Delivered */}
                                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#E8F6EC] border border-[#62B37A]">
                                    <CheckCircle2 className="w-4 h-4 text-[#0B6829] shrink-0 mt-0.5" />
                                    <div className="space-y-0.5 min-w-0">
                                      <span className="text-[11px] font-bold text-[#064E1E] block">
                                        {t('2. पूरा होने की तारीख व समय (Completed)', '2. Order Completed Date & Time')}
                                      </span>
                                      <p className="font-bold text-[#064E1E] leading-tight">
                                        {completedTiming.dateDisplay}
                                      </p>
                                      <p className="text-[11px] text-[#064E1E]">
                                        ⏱️ <span className="font-semibold">{completedTiming.timeDisplay} (IST)</span>
                                      </p>
                                    </div>
                                  </div>

                                  {/* Box 3: Total Duration Taken */}
                                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#FEF3C7] border border-[#FCD34D]">
                                    <Clock className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                                    <div className="space-y-0.5 min-w-0">
                                      <span className="text-[11px] font-bold text-[#92400E] block">
                                        {t('3. कुल समय लगा (Duration Taken)', '3. Total Processing Time')}
                                      </span>
                                      <p className="font-bold text-[#78350F] leading-tight text-sm">
                                        {completionDuration || (lang === 'hi' ? 'सफलतापूर्वक पूरा हुआ' : 'Completed successfully')}
                                      </p>
                                      <p className="text-[10px] text-[#92400E]">
                                        {t('ऑर्डर मिलने से पूरा होने तक', 'From receipt to delivery')}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Customer Details + GPS Coordinates + View on Map */}
                                {(() => {
                                  const compGpsCoords = resolveOrderGpsCoordinates(
                                    ord,
                                    adminCustomers
                                  );
                                  return (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-[#C6DEC9] rounded-xl p-3.5 text-xs">
                                      <div>
                                        <span className="font-bold text-[#4B6B56] block">
                                          {t('Customer Name (ग्राहक का नाम):', 'Customer Name:')}
                                        </span>
                                        <span className="text-sm font-bold text-[#16261C]">
                                          {ord.customerName}
                                        </span>
                                      </div>

                                      <div>
                                        <span className="font-bold text-[#4B6B56] block">
                                          {t('Mobile Number (मोबाइल नंबर):', 'Mobile Number:')}
                                        </span>
                                        <span className="text-sm font-mono font-bold text-[#0B6829]">
                                          {mobileDisplay}
                                        </span>
                                      </div>

                                      <div className="space-y-1.5">
                                        <span className="font-bold text-[#4B6B56] block">
                                          {t(
                                            'Saved GPS Address (डिलीवरी पता व पिन):',
                                            'Saved GPS Delivery Address:'
                                          )}
                                        </span>
                                        <span className="text-xs sm:text-sm font-semibold text-[#16261C] block">
                                          {ord.gpsAddress || ord.deliveryAddress} —{' '}
                                          <span className="font-mono font-bold">
                                            PIN: {ord.pinCode}
                                          </span>
                                        </span>
                                        {compGpsCoords && (
                                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                            <span className="font-mono text-[11px] font-bold text-[#064E1E] bg-[#E8F6EC] px-2 py-0.5 rounded-md border border-[#8FD1A4]">
                                              Lat: {compGpsCoords.lat.toFixed(6)}, Lng:{' '}
                                              {compGpsCoords.lng.toFixed(6)}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setActiveMapViewModal({
                                                  titleHi: `पूर्ण ऑर्डर #${ord.id
                                                    .slice(0, 8)
                                                    .toUpperCase()} — ग्राहक की GPS लोकेशन`,
                                                  titleEn: `Completed Order #${ord.id
                                                    .slice(0, 8)
                                                    .toUpperCase()} — Customer GPS Location`,
                                                  customerName: ord.customerName,
                                                  mobileNumber: mobileDisplay,
                                                  address: `${
                                                    ord.gpsAddress || ord.deliveryAddress
                                                  } (PIN: ${ord.pinCode})`,
                                                  lat: compGpsCoords.lat,
                                                  lng: compGpsCoords.lng,
                                                  orderId: ord.id,
                                                })
                                              }
                                              className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#0B6829] hover:bg-[#074F1E] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                            >
                                              <MapPin className="w-3 h-3" />
                                              <span>
                                                {t('View on Map (मैप पर देखें)', 'View on Map')}
                                              </span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Ordered Items Breakdown: Product Name, Company, Weight, Price, Quantity */}
                                <div className="bg-white border border-[#C6DEC9] rounded-xl p-3.5 space-y-2">
                                  <p className="text-xs font-bold text-[#064E1E]">
                                    {t(
                                      'ऑर्डर किए गए प्रोडक्ट्स (Product Name, Company, Weight, Price, Quantity):',
                                      'Completed Order Products (Product Name, Company, Weight, Price, Quantity):'
                                    )}
                                  </p>
                                  <div className="space-y-2">
                                    {parsedItems.map((pItem, idx) => (
                                      <div
                                        key={`${ord.id}_comp_${idx}`}
                                        className="p-2.5 rounded-lg bg-[#F2F9F4] border border-[#C6DEC9] grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs"
                                      >
                                        <div>
                                          <span className="text-[11px] font-bold text-[#4B6B56] block">
                                            {t('Product Name:', 'Product Name:')}
                                          </span>
                                          <span className="font-bold text-[#16261C]">
                                            {pItem.productName}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-bold text-[#4B6B56] block">
                                            {t('Company (कंपनी):', 'Company:')}
                                          </span>
                                          <span className="font-bold text-[#0B6829]">
                                            {pItem.companyName}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-bold text-[#4B6B56] block">
                                            {t('Weight (वज़न):', 'Weight:')}
                                          </span>
                                          <span className="font-mono font-bold text-[#0B6829]">
                                            {pItem.weight}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-bold text-[#4B6B56] block">
                                            {t('Price (कीमत):', 'Price:')}
                                          </span>
                                          <span className="font-mono font-bold text-[#064E1E]">
                                            {pItem.priceDisplay}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-bold text-[#4B6B56] block">
                                            {t('Quantity (मात्रा):', 'Quantity:')}
                                          </span>
                                          <span className="font-mono font-bold text-[#064E1E]">
                                            {pItem.quantity}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* =========================================================
                      TAB 4: 4. CUSTOMER MANAGEMENT SECTION
                      Collection: /users
                  ========================================================= */}
                  {adminActiveTab === 'customers' && (
                    <div className="space-y-6">
                      {/* Admin Customer Profile & Live Message Editor */}
                      {editingCustomerUid && (
                        <div className="bg-white border-2 border-[#0B6829] rounded-3xl p-6 shadow-md space-y-4 max-w-2xl">
                          <div className="flex items-center justify-between border-b border-[#E6F0E8] pb-3">
                            <div>
                              <p className="text-xs font-bold text-[#0B6829]">
                                {t(
                                  'ग्राहक डेटा और लाइव संदेश अपडेट',
                                  'Update Customer Data & Live Note'
                                )}
                              </p>
                              <h3 className="text-lg font-bold text-[#064E1E]">
                                {t('ग्राहक:', 'Customer:')} {editCustName}
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingCustomerUid(null)}
                              className="text-xs font-bold text-[#4B6B56] hover:text-[#16261C]"
                            >
                              {t('बंद करें ✕', 'Close ✕')}
                            </button>
                          </div>

                          <form
                            onSubmit={handleAdminSaveCustomerUpdate}
                            className="space-y-3"
                            noValidate
                          >
                            <div>
                              <label className="block text-xs font-bold text-[#0B6829] mb-1">
                                {t('ग्राहक का नाम', 'Customer Name')}
                              </label>
                              <input
                                type="text"
                                maxLength={80}
                                value={editCustName}
                                onChange={(e) => setEditCustName(e.target.value)}
                                className="w-full p-2.5 rounded-xl bg-[#F2F9F4] border border-[#62B37A] text-sm font-semibold text-[#16261C]"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-[#0B6829] mb-1">
                                {t('ईमेल आईडी (Email ID)', 'Email ID')}
                              </label>
                              <input
                                type="email"
                                maxLength={120}
                                value={editCustEmail}
                                onChange={(e) => setEditCustEmail(e.target.value)}
                                className="w-full p-2.5 rounded-xl bg-[#F2F9F4] border border-[#62B37A] text-sm font-mono font-bold text-[#16261C]"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-[#0B6829] mb-1">
                                {t('डिलीवरी पता', 'Delivery Address')}
                              </label>
                              <input
                                type="text"
                                maxLength={300}
                                value={editCustAddress}
                                onChange={(e) => setEditCustAddress(e.target.value)}
                                placeholder={t(
                                  'ग्राहक का डिलीवरी पता',
                                  'Customer delivery address'
                                )}
                                className="w-full p-2.5 rounded-xl bg-[#F2F9F4] border border-[#62B37A] text-xs sm:text-sm text-[#16261C]"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-[#0B6829] mb-1">
                                {t('पिन कोड (6 अंक)', 'PIN Code (6 Digits)')}
                              </label>
                              <input
                                type="text"
                                maxLength={6}
                                value={editCustPin}
                                onChange={(e) =>
                                  setEditCustPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                                }
                                placeholder="302015"
                                className="w-full p-2.5 rounded-xl bg-[#F2F9F4] border border-[#62B37A] text-sm font-mono text-[#16261C]"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-[#0B6829] mb-1">
                                {t(
                                  'ग्राहक के लिए लाइव एडमिन संदेश (ग्राहक के स्क्रीन पर तुरंत दिखेगा)',
                                  'Live Admin Message for Customer (Visible immediately)'
                                )}
                              </label>
                              <input
                                type="text"
                                maxLength={300}
                                value={editCustAdminNote}
                                onChange={(e) => setEditCustAdminNote(e.target.value)}
                                placeholder={t(
                                  'उदा. आपका ऑर्डर आज शाम 5 बजे तक डिलीवर होगा',
                                  'e.g. Your order will be delivered by 5 PM today'
                                )}
                                className="w-full p-2.5 rounded-xl bg-[#E8F6EC] border border-[#0B6829] text-xs sm:text-sm font-semibold text-[#064E1E]"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={savingCustomerUpdate}
                              className="w-full min-h-[44px] rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                            >
                              {savingCustomerUpdate ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <span>
                                  {t(
                                    'ग्राहक डेटा अपडेट करें (ग्राहक को तुरंत दिखेगा)',
                                    'Update Customer Data (Syncs Immediately)'
                                  )}
                                </span>
                              )}
                            </button>
                          </form>
                        </div>
                      )}

                      <div
                        id="admin-section-customers"
                        className="bg-white border border-[#D4E4D8] rounded-3xl p-6 shadow-sm space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6F0E8] pb-4">
                          <div>
                            <h3 className="text-lg font-bold text-[#064E1E]">
                              {t(
                                `4. Customer Management — सभी ग्राहक (${adminActiveCustomers.length})`,
                                `4. Customer Management — All Customers (${adminActiveCustomers.length})`
                              )}
                            </h3>
                            <p className="text-xs text-[#4B6B56]">
                              {t(
                                'प्रत्येक ग्राहक का नाम, Email/मोबाइल, पूरी Order History देखें या Confirmation के साथ डिलीट करें',
                                'View each customer name, Email/Mobile, complete Order History, or delete with confirmation'
                              )}
                            </p>
                          </div>
                          <span className="px-3.5 py-1.5 rounded-xl bg-[#F2F9F4] border border-[#62B37A] font-mono text-sm font-bold text-[#064E1E] tabular-nums">
                            {t(
                              `कुल ग्राहक: ${adminActiveCustomers.length}`,
                              `Total Customers: ${adminActiveCustomers.length}`
                            )}
                          </span>
                        </div>

                        {adminCustomersLoading ? (
                          <div className="py-10 flex items-center justify-center gap-2 text-xs text-[#23452E]">
                            <Loader2 className="w-5 h-5 animate-spin text-[#0B6829]" />
                            <span>
                              {t(
                                'ग्राहकों की सूची लोड की जा रही है...',
                                'Loading customer directory...'
                              )}
                            </span>
                          </div>
                        ) : adminActiveCustomers.length === 0 ? (
                          <p className="text-xs sm:text-sm text-[#4B6B56] py-4">
                            {t(
                              'अभी तक कोई ग्राहक पंजीकृत नहीं हुआ है।',
                              'No customers registered yet.'
                            )}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {adminActiveCustomers.map((cust) => {
                              const custOrders = adminOrders.filter(
                                (o) => o.customerId === cust.uid && !o.isDeleted
                              );
                              const custTotalSpend = custOrders.reduce(
                                (sum, o) =>
                                  o.status !== 'cancelled' ? sum + o.totalAmountInr : sum,
                                0
                              );
                              const isHistoryOpen = expandedCustomerHistoryUid === cust.uid;

                              return (
                                <div
                                  key={cust.uid}
                                  className="p-4 rounded-2xl bg-[#F6FAF5] border border-[#C6DEC9] space-y-3"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-base font-bold text-[#16261C]">
                                          {cust.name}
                                        </span>
                                        <span className="text-xs font-mono font-bold text-[#0B6829]">
                                          · {formatCustomerContactDisplay(cust.email, cust.phone)}
                                        </span>
                                        <span className="text-xs text-[#4B6B56]">
                                          · (
                                          {cust.role === 'admin'
                                            ? t('एडमिन', 'Admin')
                                            : t('ग्राहक', 'Customer')}
                                          )
                                        </span>
                                      </div>

                                      <p className="text-xs text-[#3C5A46]">
                                        <strong>
                                          {t('Permanent GPS पता:', 'Permanent GPS Address:')}
                                        </strong>{' '}
                                        {cust.defaultAddress
                                          ? `${cust.defaultAddress} (${t('पिन:', 'PIN:')} ${
                                              cust.defaultPinCode || '—'
                                            })`
                                          : t('अभी पता दर्ज नहीं किया गया', 'No address saved yet')}
                                      </p>

                                      {typeof cust.gpsLat === 'number' &&
                                        typeof cust.gpsLng === 'number' && (
                                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                            <span className="text-[11px] font-mono font-bold text-[#064E1E] bg-[#E8F6EC] px-2 py-0.5 rounded-md border border-[#8FD1A4]">
                                              Lat: {cust.gpsLat.toFixed(6)}, Lng:{' '}
                                              {cust.gpsLng.toFixed(6)}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setActiveMapViewModal({
                                                  titleHi: `${cust.name} — स्थायी GPS लोकेशन`,
                                                  titleEn: `${cust.name} — Permanent GPS Location`,
                                                  customerName: cust.name,
                                                  mobileNumber: formatCustomerContactDisplay(
                                                    cust.email,
                                                    cust.phone
                                                  ),
                                                  address: `${cust.defaultAddress || '—'} (PIN: ${
                                                    cust.defaultPinCode || '—'
                                                  })`,
                                                  lat: cust.gpsLat as number,
                                                  lng: cust.gpsLng as number,
                                                })
                                              }
                                              className="min-h-[28px] px-2.5 py-0.5 rounded-lg bg-[#0B6829] hover:bg-[#074F1E] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                            >
                                              <MapPin className="w-3 h-3" />
                                              <span>
                                                {t('View on Map (मैप पर देखें)', 'View on Map')}
                                              </span>
                                            </button>
                                          </div>
                                        )}

                                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#064E1E] pt-0.5">
                                        <span>
                                          {t('कुल ऑर्डर:', 'Total Orders:')} {custOrders.length}
                                        </span>
                                        <span>·</span>
                                        <span>
                                          {t('कुल खरीद:', 'Total Spend:')} ₹{custTotalSpend}
                                        </span>
                                      </div>

                                      {cust.adminNoteHi && (
                                        <p className="text-xs font-bold text-[#0B6829] pt-0.5">
                                          {t('भेजा गया संदेश:', 'Sent Note:')} "{cust.adminNoteHi}"
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedCustomerHistoryUid((prev) =>
                                            prev === cust.uid ? null : cust.uid
                                          )
                                        }
                                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#E8F6EC] border border-[#0B6829] text-[#064E1E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                      >
                                        <Package className="w-3.5 h-3.5 text-[#0B6829]" />
                                        <span>
                                          {isHistoryOpen
                                            ? t('Order History छुपाएं ▲', 'Hide Order History ▲')
                                            : t(
                                                `Order History देखें (${custOrders.length}) ▼`,
                                                `Order History (${custOrders.length}) ▼`
                                              )}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleAdminStartEditCustomer(cust)}
                                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-[#62B37A] hover:bg-[#E6F4EA] text-[#0B6829] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>{t('एडिट', 'Edit')}</span>
                                      </button>

                                      {cust.role !== 'admin' && (
                                        <button
                                          type="button"
                                          disabled={adminActionLoadingId === cust.uid}
                                          onClick={() => handleRequestDeleteCustomer(cust)}
                                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#9E3B1B] hover:bg-[#7D2C12] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>{t('डिलीट (Delete)', 'Delete')}</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Expandable Customer Order History Panel */}
                                  {isHistoryOpen && (
                                    <div className="pt-3 border-t border-[#D4E4D8] space-y-2">
                                      <p className="text-xs font-bold text-[#064E1E]">
                                        {t(
                                          `${cust.name} की पूरी Order History (${custOrders.length} ऑर्डर):`,
                                          `Complete Order History for ${cust.name} (${custOrders.length} Orders):`
                                        )}
                                      </p>
                                      {custOrders.length === 0 ? (
                                        <p className="text-xs text-[#4B6B56] py-1">
                                          {t(
                                            'इस ग्राहक ने अभी तक कोई ऑर्डर नहीं किया है।',
                                            'This customer has not placed any orders yet.'
                                          )}
                                        </p>
                                      ) : (
                                        <div className="space-y-2">
                                          {custOrders.map((co) => (
                                            <div
                                              key={co.id}
                                              className="p-3 rounded-xl bg-white border border-[#D4E4D8] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                            >
                                              <div className="space-y-0.5">
                                                <div className="flex flex-wrap items-center gap-2 text-[#4B6B56]">
                                                  <span className="font-mono font-bold text-[#16261C]">
                                                    #{co.id.slice(0, 8)}
                                                  </span>
                                                  <span>·</span>
                                                  <span>
                                                    {co.createdAt?.toDate
                                                      ? co.createdAt
                                                          .toDate()
                                                          .toLocaleDateString(
                                                            lang === 'en' ? 'en-IN' : 'hi-IN',
                                                            { dateStyle: 'medium' }
                                                          )
                                                      : ''}
                                                  </span>
                                                  <span>·</span>
                                                  <span className="font-bold text-[#0B6829]">
                                                    {getOrderStatusLabel(co.status)}
                                                  </span>
                                                </div>
                                                <p className="font-bold text-[#16261C]">
                                                  {co.itemsSummary}
                                                </p>
                                              </div>
                                              <span className="font-mono font-bold text-sm text-[#064E1E] shrink-0">
                                                ₹{co.totalAmountInr}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                      TAB 5: 5. BACKUP & RECOVERY SECTION (DELETED ORDERS & CUSTOMERS RECOVERY)
                  ========================================================= */}
                  {adminActiveTab === 'backup' && (
                    <div
                      id="admin-section-backup"
                      className="bg-white border border-[#D4E4D8] rounded-3xl p-6 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6F0E8] pb-4">
                        <div>
                          <h3 className="text-lg font-bold text-[#064E1E]">
                            {t(
                              `5. Backup & Recovery — डिलीट किए गए ऑर्डर और ग्राहक रिकवरी (${
                                adminDeletedOrders.length + adminDeletedCustomers.length
                              })`,
                              `5. Backup & Recovery — Deleted Orders & Customers (${
                                adminDeletedOrders.length + adminDeletedCustomers.length
                              })`
                            )}
                          </h3>
                          <p className="text-xs text-[#4B6B56]">
                            {t(
                              'गलत डिलीट से सुरक्षा: एडमिन किसी भी डिलीट किए गए ऑर्डर या ग्राहक को यहाँ से 1 क्लिक में वापस ला (Restore) सकता है',
                              'Accidental delete protection: Admin can restore any deleted Order or Customer with 1 click'
                            )}
                          </p>
                        </div>
                      </div>

                      {adminDeletedOrders.length === 0 && adminDeletedCustomers.length === 0 ? (
                        <p className="text-xs sm:text-sm text-[#4B6B56] py-3">
                          {t(
                            'बैकअप / रिकवरी बिन खाली है। कोई भी डिलीट किया गया ऑर्डर या ग्राहक यहाँ सुरक्षित दिखाई देगा।',
                            'Backup / Recovery bin is empty. Any deleted order or customer will appear here safely for recovery.'
                          )}
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {adminDeletedOrders.length > 0 && (
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#9E3B1B]">
                                {t(
                                  `डिलीट किए गए ऑर्डर (${adminDeletedOrders.length})`,
                                  `Deleted Orders (${adminDeletedOrders.length})`
                                )}
                              </h4>
                              {adminDeletedOrders.map((dOrd) => (
                                <div
                                  key={dOrd.id}
                                  className="p-3.5 rounded-2xl bg-[#FDF2EC] border border-[#E07A52] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                >
                                  <div className="space-y-0.5 text-xs">
                                    <p className="font-bold text-[#16261C]">
                                      #{dOrd.id.slice(0, 8)} · {dOrd.customerName} (₹
                                      {dOrd.totalAmountInr})
                                    </p>
                                    <p className="text-[#3C5A46]">{dOrd.itemsSummary}</p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      disabled={adminActionLoadingId === dOrd.id}
                                      onClick={() => handleAdminRestoreOrder(dOrd)}
                                      className="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs font-bold cursor-pointer"
                                    >
                                      {t('रिकवर करें (Restore)', 'Restore Order')}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={adminActionLoadingId === dOrd.id}
                                      onClick={() => handleRequestPermanentDeleteOrder(dOrd)}
                                      className="min-h-[34px] px-3 py-1.5 rounded-xl bg-white border border-[#9E3B1B] text-[#9E3B1B] hover:bg-[#FDF2EC] text-xs font-bold cursor-pointer"
                                    >
                                      {t('स्थायी डिलीट', 'Permanent Delete')}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {adminDeletedCustomers.length > 0 && (
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#9E3B1B]">
                                {t(
                                  `डिलीट किए गए ग्राहक (${adminDeletedCustomers.length})`,
                                  `Deleted Customers (${adminDeletedCustomers.length})`
                                )}
                              </h4>
                              {adminDeletedCustomers.map((dCust) => (
                                <div
                                  key={dCust.uid}
                                  className="p-3.5 rounded-2xl bg-[#FDF2EC] border border-[#E07A52] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                >
                                  <div className="space-y-0.5 text-xs">
                                    <p className="font-bold text-[#16261C]">
                                      {dCust.name} ·{' '}
                                      <span className="font-mono">
                                        {formatCustomerContactDisplay(dCust.email, dCust.phone)}
                                      </span>
                                    </p>
                                    {dCust.defaultAddress && (
                                      <p className="text-[#3C5A46]">{dCust.defaultAddress}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      disabled={adminActionLoadingId === dCust.uid}
                                      onClick={() => handleAdminRestoreCustomer(dCust)}
                                      className="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs font-bold cursor-pointer"
                                    >
                                      {t('रिकवर करें (Restore)', 'Restore Customer')}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={adminActionLoadingId === dCust.uid}
                                      onClick={() => handleRequestPermanentDeleteCustomer(dCust)}
                                      className="min-h-[34px] px-3 py-1.5 rounded-xl bg-white border border-[#9E3B1B] text-[#9E3B1B] hover:bg-[#FDF2EC] text-xs font-bold cursor-pointer"
                                    >
                                      {t('स्थायी डिलीट', 'Permanent Delete')}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* =========================================================
                      ADMIN PORTAL SETTINGS (CHANGE WHATSAPP HELP NUMBER & APP CONFIG)
                  ========================================================= */}
                  <div className="pt-4">
                    <AdminAppSettingsPanel settings={appSettings} isHindi={lang !== 'en'} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* =====================================================================
          CUSTOMER PORTAL FLOATING ANDROID-READY "WHATSAPP HELP" BUTTON
      ===================================================================== */}
      {activeSection !== 'admin' && (
        <a
          href={buildAdminWhatsappChatUrl(
            appSettings.whatsappNumber || appSettings.contactWhatsapp
          )}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp Help"
          className="fixed bottom-16 md:bottom-6 right-4 z-40 min-h-[48px] px-4 py-2.5 rounded-full bg-[#25D366] hover:bg-[#1DA851] text-white text-xs sm:text-sm font-bold shadow-lg border-2 border-white inline-flex items-center gap-2 transition-transform hover:scale-105"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 fill-current shrink-0"
            aria-hidden="true"
          >
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.83-.11-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.24-5.01-4.44-.15-.2-1.2-1.59-1.2-3.04 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37.2 0 .4.01.57.01.18 0 .43-.07.67.51.24.59.82 2.01.89 2.16.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.49.22.57.35.07.12.07.72-.17 1.4z" />
          </svg>
          <span>WhatsApp Help</span>
        </a>
      )}

      {/* =====================================================================
          MOBILE FIXED BOTTOM NAVIGATION BAR (Thumb-Zone Ergonomics)
      ===================================================================== */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-white/95 backdrop-blur-md border-t border-[#D4E4D8] grid grid-cols-3 items-center px-2"
        aria-label="मोबाइल नेविगेशन"
      >
        <button
          type="button"
          onClick={() => setActiveSection('catalog')}
          className={`min-h-[44px] flex flex-col items-center justify-center text-[11px] font-bold ${
            activeSection === 'catalog' ? 'text-[#0B6829]' : 'text-[#4B6B56]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="mt-0.5">{t('कैटलॉग', 'Catalogue')}</span>
        </button>
        <button
          type="button"
          onClick={() => setIsCartDrawerOpen(true)}
          className="min-h-[44px] flex flex-col items-center justify-center text-[11px] font-bold text-[#4B6B56]"
        >
          <ShoppingBag className="w-4 h-4 text-[#0B6829]" />
          <span className="mt-0.5 tabular-nums">
            {t(`कार्ट (${totalCartItems})`, `Cart (${totalCartItems})`)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('my_orders')}
          className={`min-h-[44px] flex flex-col items-center justify-center text-[11px] font-bold ${
            activeSection === 'my_orders' ? 'text-[#0B6829]' : 'text-[#4B6B56]'
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="mt-0.5 tabular-nums">
            {t(`मेरे ऑर्डर (${myOrders.length})`, `Orders (${myOrders.length})`)}
          </span>
        </button>
      </nav>

      {/* =====================================================================
          PRODUCT DETAIL MODAL (FULL DETAILS, LARGE PHOTO, QUANTITY & ORDER)
      ===================================================================== */}
      {selectedDetailProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={selectedDetailProduct.nameHi}
          onClick={() => setSelectedDetailProduct(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white border border-[#D4E4D8] rounded-3xl overflow-hidden shadow-xl my-auto"
          >
            {/* Modal Top Header */}
            <div className="px-6 py-4 bg-[#EAF4EC] border-b border-[#D4E4D8] flex items-center justify-between gap-3">
              <div>
                {(selectedDetailProduct.companyName || selectedDetailProduct.categoryHi) && (
                  <p className="text-xs font-bold text-[#0B6829]">
                    {selectedDetailProduct.companyName || selectedDetailProduct.categoryHi}
                  </p>
                )}
                <h2 className="text-lg sm:text-xl font-bold text-[#064E1E] mt-0.5">
                  {lang === 'en' && selectedDetailProduct.nameEn
                    ? selectedDetailProduct.nameEn
                    : selectedDetailProduct.nameHi}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailProduct(null)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white border border-[#8FD1A4] text-xs font-bold text-[#064E1E] hover:bg-[#F2F9F4] cursor-pointer shrink-0"
              >
                {t('बंद करें ✕', 'Close ✕')}
              </button>
            </div>

            {/* Large Photo + 5 Core Details */}
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-6 bg-[#F4FAF6] border-b md:border-b-0 md:border-r border-[#E6F0E8] flex items-center justify-center p-4">
                <div className="w-full aspect-4/3 rounded-2xl overflow-hidden border border-[#D4E4D8] bg-white">
                  {selectedDetailProduct.photoUrl ? (
                    <img
                      src={selectedDetailProduct.photoUrl}
                      alt={selectedDetailProduct.nameHi}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <TeaIllustration
                      variant={selectedDetailProduct.illustrationVariant || 'assam_kadak'}
                      className="w-full h-full"
                    />
                  )}
                </div>
              </div>

              <div className="md:col-span-6 p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  {/* Company Name & Weight */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    {(selectedDetailProduct.companyName || selectedDetailProduct.categoryHi) && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#E8F6EC] border border-[#62B37A] text-[#0B6829] font-bold">
                        {t('कंपनी:', 'Company:')}{' '}
                        {selectedDetailProduct.companyName || selectedDetailProduct.categoryHi}
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-lg bg-[#F2F9F4] border border-[#C6DEC9] font-mono font-bold text-[#064E1E]">
                      {t(
                        `वज़न: ${formatProductWeight(selectedDetailProduct)}`,
                        `Weight: ${formatProductWeight(selectedDetailProduct)}`
                      )}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="p-3.5 rounded-2xl bg-[#F2F9F4] border border-[#C6DEC9] flex items-baseline justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#4B6B56] block">
                        {t(
                          `कीमत (${formatProductWeight(selectedDetailProduct)})`,
                          `Price (${formatProductWeight(selectedDetailProduct)})`
                        )}
                      </span>
                      <span className="text-2xl sm:text-3xl font-mono font-bold text-[#064E1E]">
                        ₹{selectedDetailProduct.priceInr}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quantity Selector & Add to Cart / Order Now */}
                <div className="space-y-3 pt-2 border-t border-[#E6F0E8]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs sm:text-sm font-bold text-[#16261C]">
                      {t('मात्रा चुनें (Select Quantity):', 'Select Quantity:')}
                    </span>
                    <div className="inline-flex items-center gap-2 bg-[#F2F9F4] border border-[#62B37A] rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDetailQuantity((prev) => Math.max(1, prev - 1))
                        }
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white hover:bg-[#E6F4EA] text-[#064E1E] font-bold cursor-pointer"
                        aria-label={t('मात्रा घटाएं', 'Decrease quantity')}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-3 text-base font-mono font-bold tabular-nums text-[#064E1E]">
                        {detailQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDetailQuantity((prev) => Math.min(20, prev + 1))
                        }
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white hover:bg-[#E6F4EA] text-[#064E1E] font-bold cursor-pointer"
                        aria-label={t('मात्रा बढ़ाएं', 'Increase quantity')}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-[#3C5A46]">
                    <span>
                      {t('कुल मूल्य:', 'Total Price:')} ₹{selectedDetailProduct.priceInr} ×{' '}
                      {detailQuantity}
                    </span>
                    <span className="text-base font-bold text-[#064E1E]">
                      ₹{selectedDetailProduct.priceInr * detailQuantity}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(selectedDetailProduct, detailQuantity);
                        setSelectedDetailProduct(null);
                        setIsCartDrawerOpen(true);
                      }}
                      className="min-h-[46px] px-4 py-2.5 rounded-xl bg-gradient-to-b from-[#0E742F] to-[#075820] hover:from-[#0B6528] hover:to-[#054518] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        {t(
                          `${appSettings.orderBtnHi || 'ऑर्डर करें'} (₹${
                            selectedDetailProduct.priceInr * detailQuantity
                          })`,
                          `${appSettings.orderBtnEn || 'Order Now'} (₹${
                            selectedDetailProduct.priceInr * detailQuantity
                          })`
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        addToCart(selectedDetailProduct, detailQuantity);
                        setSelectedDetailProduct(null);
                      }}
                      className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white border-2 border-[#0B6829] hover:bg-[#E8F6EC] text-[#064E1E] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-[#0B6829]" />
                      <span>
                        {t(
                          appSettings.addToCartBtnHi || 'कार्ट में जोड़ें',
                          appSettings.addToCartBtnEn || 'Add to Cart'
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                {isAdminUser && (
                  <div className="pt-2 border-t border-[#E6F0E8] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const prodToEdit = selectedDetailProduct;
                        setSelectedDetailProduct(null);
                        handleStartEditProduct(prodToEdit);
                        setActiveSection('admin');
                      }}
                      className="text-xs font-bold text-[#0B6829] underline underline-offset-4 cursor-pointer"
                    >
                      {t('एडमिन: इस प्रोडक्ट को एडिट करें →', 'Admin: Edit this product →')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MOBILE SLIDE-OVER CART DRAWER
      ===================================================================== */}
      {isCartDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="ऑर्डर थैला"
        >
          <div className="w-full max-w-md bg-[#F6FAF5] h-full p-6 overflow-y-auto flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#D4E4D8] pb-4">
                <h2 className="text-lg font-bold text-[#064E1E]">
                  {t('आपका ऑर्डर थैला और चेकआउट', 'Your Order Bag & Checkout')}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="min-h-[44px] px-3 text-xs font-bold text-[#0B6829] cursor-pointer"
                >
                  {t('बंद करें ✕', 'Close ✕')}
                </button>
              </div>

              {/* Admin-Controlled Delivery Areas Notice */}
              {(appSettings.deliveryAreasHi || appSettings.deliveryAreasEn) && (
                <div className="p-3 rounded-xl bg-[#EAF4EC] border border-[#C6DEC9] text-xs text-[#064E1E]">
                  <span className="font-bold">
                    {t('डिलीवरी क्षेत्र:', 'Delivery Areas:')}{' '}
                  </span>
                  <span>
                    {t(
                      appSettings.deliveryAreasHi || appSettings.deliveryAreasEn,
                      appSettings.deliveryAreasEn || appSettings.deliveryAreasHi
                    )}
                  </span>
                </div>
              )}

              {cart.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#4B6B56]">
                  {t('आपका थैला खाली है।', 'Your order bag is empty.')}
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 py-2.5 border-b border-[#D4E4D8] text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#16261C] truncate">
                          {lang === 'en' && product.nameEn ? product.nameEn : product.nameHi}
                        </p>
                        {(product.companyName || product.categoryHi) && (
                          <p className="text-[11px] font-bold text-[#0B6829] truncate">
                            {product.companyName || product.categoryHi}
                          </p>
                        )}
                        <p className="text-xs text-[#4B6B56] font-mono">
                          {formatProductWeight(product)} · ₹{product.priceInr} × {quantity}
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 bg-white border border-[#8FD1A4] rounded-lg p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(product.id, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#E6F4EA] text-[#064E1E] cursor-pointer"
                          aria-label={t('मात्रा घटाएं', 'Decrease')}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-1.5 text-xs font-mono font-bold tabular-nums text-[#064E1E]">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(product.id, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#E6F4EA] text-[#064E1E] cursor-pointer"
                          aria-label={t('मात्रा बढ़ाएं', 'Increase')}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-mono font-bold text-[#064E1E] shrink-0">
                        ₹{product.priceInr * quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handlePlaceOrder} className="space-y-3.5 pt-2" noValidate>
                <div>
                  <label
                    htmlFor="drawer-customer-name"
                    className="block text-xs font-bold uppercase tracking-wider text-[#0B6829] mb-1"
                  >
                    {t('ग्राहक का पूरा नाम (Your Name)', 'Customer Full Name')}
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#0B6829] absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      id="drawer-customer-name"
                      type="text"
                      maxLength={80}
                      value={checkoutName}
                      onChange={(e) => setCheckoutName(e.target.value)}
                      placeholder={t('अपना पूरा नाम लिखें', 'Enter your full name')}
                      className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-xl bg-white border border-[#8FD1A4] text-sm font-semibold text-[#16261C] placeholder:text-[#66806E] focus:outline-none focus:border-[#0B6829]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="drawer-customer-phone"
                    className="block text-xs font-bold uppercase tracking-wider text-[#0B6829] mb-1"
                  >
                    {t(
                      'मोबाइल नंबर — 10 अंक (Mobile Number)',
                      'Mobile Number (10 Digits)'
                    )}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#0B6829] absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      id="drawer-customer-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={checkoutPhone}
                      onChange={(e) =>
                        setCheckoutPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                      }
                      placeholder="9876543210"
                      className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-xl bg-white border border-[#8FD1A4] font-mono text-sm font-bold text-[#16261C] placeholder:text-[#66806E] focus:outline-none focus:border-[#0B6829]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="drawer-customer-email"
                    className="block text-xs font-bold uppercase tracking-wider text-[#0B6829] mb-1"
                  >
                    {t(
                      'ईमेल आईडी या लॉगिन आईडी (Email or Login ID)',
                      'Email Address or Login ID'
                    )}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#0B6829] absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      id="drawer-customer-email"
                      type="text"
                      maxLength={120}
                      value={checkoutEmail}
                      onChange={(e) => setCheckoutEmail(e.target.value)}
                      placeholder={t('9876543210 या name@gmail.com', '9876543210 or name@gmail.com')}
                      className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-xl bg-white border border-[#8FD1A4] font-mono text-sm text-[#16261C] placeholder:text-[#66806E] focus:outline-none focus:border-[#0B6829]"
                      required
                    />
                  </div>
                </div>

                {/* AUTOMATIC PERMANENT SAVED GPS ADDRESS SNAPSHOT (NO REPEATED ADDRESS FORM) */}
                <div className="p-3.5 rounded-2xl bg-white border-2 border-[#0B6829] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0B6829] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#0B6829]" />
                      {t(
                        'स्थायी GPS डिलीवरी पता (Auto-Attached)',
                        'Permanent Saved GPS Address (Auto-Attached)'
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenChangeAddressModal('gps')}
                      className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#EAF4EC] hover:bg-[#D4E4D8] border border-[#8FD1A4] text-[#064E1E] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{t('Change Address (पता बदलें)', 'Change Address')}</span>
                    </button>
                  </div>

                  {(customerProfile.defaultAddress || deliveryAddress).trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-[#16261C] leading-snug">
                        {customerProfile.defaultAddress || deliveryAddress}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#064E1E]">
                        <span className="px-2 py-0.5 rounded-md bg-[#E8F6EC] border border-[#8FD1A4] font-bold">
                          PIN: {customerProfile.defaultPinCode || pinCode || '302001'}
                        </span>
                        {typeof (customerProfile.gpsLat ?? customerGpsLat) === 'number' &&
                          typeof (customerProfile.gpsLng ?? customerGpsLng) === 'number' && (
                            <span className="px-2 py-0.5 rounded-md bg-[#E8F6EC] border border-[#8FD1A4]">
                              GPS: {(customerProfile.gpsLat ?? customerGpsLat)?.toFixed(5)},{' '}
                              {(customerProfile.gpsLng ?? customerGpsLng)?.toFixed(5)}
                            </span>
                          )}
                      </div>
                      <p className="text-[11px] text-[#3C5A46]">
                        {t(
                          'यह पता आपके इस ऑर्डर में अपने आप जुड़ गया है। आपको पता फॉर्म भरने की आवश्यकता नहीं है।',
                          'This permanent address is automatically attached to your order. No address form needed.'
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-[#9E3B1B] font-semibold">
                        {t(
                          'अभी आपका GPS डिलीवरी पता सेव नहीं है। कृपया नीचे बटन दबाकर 1-क्लिक में GPS से पता जोड़ें:',
                          'Your GPS delivery address is not saved yet. Click below to auto-detect your GPS address in 1 click:'
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => requestCustomerGpsLocation(false)}
                          className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>
                            {t('GPS से पता अपने आप निकालें', 'Auto-Detect GPS Address')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenChangeAddressModal('map_pin')}
                          className="min-h-[38px] px-3 py-2 rounded-xl bg-[#EAF4EC] hover:bg-[#D4E4D8] border border-[#8FD1A4] text-[#064E1E] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{t('मैप पिन चुनें / पता लिखें', 'Map Pin / Edit Address')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="drawer-payment-method"
                    className="block text-xs font-bold uppercase tracking-wider text-[#0B6829] mb-1.5"
                  >
                    {t('भुगतान माध्यम', 'Payment Mode')}
                  </label>
                  <select
                    id="drawer-payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'COD' | 'UPI')}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white border border-[#8FD1A4] text-xs font-bold text-[#16261C] focus:outline-none focus:border-[#0B6829]"
                  >
                    {appSettings.allowCod !== false && (
                      <option value="COD">
                        {t('कैश ऑन डिलीवरी (COD)', 'Cash on Delivery (COD)')}
                      </option>
                    )}
                    {appSettings.allowUpi !== false && (
                      <option value="UPI">
                        {t('UPI / ऑनलाइन पेमेंट', 'UPI / Online Payment')}
                      </option>
                    )}
                  </select>
                </div>

                {paymentMethod === 'UPI' && appSettings.upiId && (
                  <div className="p-2.5 rounded-xl bg-[#EAF4EC] border border-[#8FD1A4] text-xs text-[#064E1E] font-mono">
                    <strong>{t('कंपनी UPI ID:', 'Company UPI ID:')}</strong> {appSettings.upiId}
                  </div>
                )}

                <div className="pt-3 border-t border-[#D4E4D8] space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#3C5A46]">
                    <span>{t('चाय का कुल मूल्य', 'Subtotal')}</span>
                    <span className="font-mono font-semibold">₹{subtotalInr}</span>
                  </div>
                  <div className="flex justify-between text-[#3C5A46]">
                    <span>
                      {(appSettings.freeDeliveryMinInr ?? 0) > 0
                        ? t(
                            `डिलीवरी शुल्क (₹${appSettings.freeDeliveryMinInr}+ पर मुफ़्त)`,
                            `Delivery (Free over ₹${appSettings.freeDeliveryMinInr})`
                          )
                        : t('डिलीवरी शुल्क', 'Delivery Charge')}
                    </span>
                    <span className="font-mono font-semibold">
                      {deliveryFeeInr === 0 ? t('मुफ़्त (₹0)', 'FREE (₹0)') : `₹${deliveryFeeInr}`}
                    </span>
                  </div>
                  {(appSettings.minOrderAmountInr ?? 0) > 0 && (
                    <div className="flex justify-between text-[#4B6B56]">
                      <span>{t('न्यूनतम ऑर्डर राशि', 'Minimum Order Amount')}</span>
                      <span className="font-mono font-semibold">
                        ₹{appSettings.minOrderAmountInr}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-[#064E1E] pt-2 border-t border-[#D4E4D8]">
                    <span>{t('कुल देय राशि', 'Grand Total')}</span>
                    <span className="font-mono">₹{grandTotalInr}</span>
                  </div>
                </div>

                {orderErrorHi && (
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] font-medium flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{orderErrorHi}</span>
                  </div>
                )}

                {lastCreatedOrderId && (
                  <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5] text-xs text-[#085D3A] font-semibold flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {t(
                        appSettings.orderSuccessMessageHi ||
                          `ऑर्डर #${lastCreatedOrderId.slice(0, 8)} सफलतापूर्वक दर्ज हो गया!`,
                        appSettings.orderSuccessMessageEn ||
                          `Order #${lastCreatedOrderId.slice(0, 8)} placed successfully!`
                      )}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={orderSubmitting || cart.length === 0 || !appSettings.storeOpen}
                  className="w-full min-h-[48px] rounded-xl bg-[#0B6829] hover:bg-[#074F1E] disabled:opacity-55 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {orderSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('ऑर्डर दर्ज हो रहा है...', 'Placing Order...')}</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      <span>
                        {t(
                          `${appSettings.orderBtnHi || 'ऑर्डर पक्का करें'} (₹${grandTotalInr})`,
                          `${appSettings.orderBtnEn || 'Confirm Order'} (₹${grandTotalInr})`
                        )}
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          QUIET EDITORIAL FOOTER (ADMIN-CONTROLLED)
      ===================================================================== */}
      <footer className="border-t border-[#D4E4D8] bg-[#EAF4EC] py-6 px-4 sm:px-8 text-xs text-[#3C5A46]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <p className="font-semibold text-[#16261C]">
              © {new Date().getFullYear()} {appSettings.companyName || 'CHAI ROS'}
              {(appSettings.footerTextHi || appSettings.footerTextEn) && (
                <>
                  {' · '}
                  {t(
                    appSettings.footerTextHi || appSettings.footerTextEn,
                    appSettings.footerTextEn || appSettings.footerTextHi
                  )}
                </>
              )}
            </p>
            <p className="text-[11px] text-[#4B6B56]">
              <span>
                WhatsApp Help:{' '}
                <strong className="font-mono text-[#064E1E]">
                  {formatAdminWhatsappDisplay(
                    appSettings.whatsappNumber || appSettings.contactWhatsapp
                  )}
                </strong>
              </span>
              {appSettings.contactAddress && <span> · 📍 {appSettings.contactAddress}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={buildAdminWhatsappChatUrl(
                appSettings.whatsappNumber || appSettings.contactWhatsapp
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 fill-current shrink-0"
                aria-hidden="true"
              >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.83-.11-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.24-5.01-4.44-.15-.2-1.2-1.59-1.2-3.04 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37.2 0 .4.01.57.01.18 0 .43-.07.67.51.24.59.82 2.01.89 2.16.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.49.22.57.35.07.12.07.72-.17 1.4z" />
              </svg>
              <span>WhatsApp Help</span>
            </a>
            <button
              type="button"
              onClick={() => setIsSetupModalOpen(true)}
              className="hover:text-[#064E1E] font-semibold underline underline-offset-4 cursor-pointer"
            >
              {t(
                appSettings.helpTitleHi || 'सहायता व संपर्क जानकारी',
                appSettings.helpTitleEn || 'Help & Contact Information'
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Admin Delete Confirmation Popup Modal */}
      {adminConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!confirmActionLoading) setAdminConfirmModal(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border-2 border-[#9E3B1B] rounded-3xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-start gap-3 text-[#9E3B1B]">
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-[#16261C]">
                  {t(adminConfirmModal.titleHi, adminConfirmModal.titleEn)}
                </h3>
                <p className="text-xs sm:text-sm text-[#3C5A46] leading-relaxed">
                  {t(adminConfirmModal.messageHi, adminConfirmModal.messageEn)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6F0E8]">
              <button
                type="button"
                disabled={confirmActionLoading}
                onClick={() => setAdminConfirmModal(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF4EC] text-[#16261C] text-xs sm:text-sm font-bold hover:bg-[#D4E4D8] cursor-pointer"
              >
                {t('रद्द करें (Cancel)', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={confirmActionLoading}
                onClick={async () => {
                  setConfirmActionLoading(true);
                  try {
                    await adminConfirmModal.onConfirm();
                    setAdminConfirmModal(null);
                  } finally {
                    setConfirmActionLoading(false);
                  }
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#9E3B1B] hover:bg-[#7D2C12] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {confirmActionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>
                  {t(adminConfirmModal.confirmLabelHi, adminConfirmModal.confirmLabelEn)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          AUTOMATIC GPS LOCATION PERMISSION / MAP PIN SELECTOR / EDIT MODAL
      ===================================================================== */}
      {isGpsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white border-2 border-[#0B6829] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#D4E4D8] pb-3">
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E8F6EC] border border-[#8FD1A4] flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-[#0B6829]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#064E1E]">
                    {t(
                      'Automatic GPS Address System (स्थायी डिलीवरी पता)',
                      'Automatic GPS Address System (Permanent Delivery Address)'
                    )}
                  </h3>
                  <p className="text-xs text-[#3C5A46]">
                    {t(
                      'केवल आपकी अनुमति से लोकेशन ली जाती है। बैकग्राउंड में कभी ट्रैक नहीं किया जाता।',
                      'Location is accessed only with your permission and never tracked in the background.'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGpsModalOpen(false)}
                className="min-h-[36px] px-3 py-1 rounded-xl bg-[#EAF4EC] hover:bg-[#D4E4D8] text-xs font-bold text-[#16261C] cursor-pointer"
              >
                {t('बंद करें ✕', 'Close ✕')}
              </button>
            </div>

            {/* Mode Switcher Tabs: 1. Automatic GPS, 2. Map Pin Selector, 3. Edit Address */}
            <div className="grid grid-cols-3 gap-2 bg-[#F2F9F4] p-1.5 rounded-2xl border border-[#C6DEC9]">
              <button
                type="button"
                onClick={() => setGpsModalMode('gps')}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  gpsModalMode === 'gps'
                    ? 'bg-[#0B6829] text-white shadow-xs'
                    : 'text-[#16261C] hover:bg-[#E8F6EC]'
                }`}
              >
                {t('1. Auto GPS लोकेशन', '1. Auto GPS')}
              </button>
              <button
                type="button"
                onClick={() => setGpsModalMode('map_pin')}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  gpsModalMode === 'map_pin'
                    ? 'bg-[#0B6829] text-white shadow-xs'
                    : 'text-[#16261C] hover:bg-[#E8F6EC]'
                }`}
              >
                {t('2. मैप पिन चुनें', '2. Map Pin Selector')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualEditAddress(customerProfile.defaultAddress || deliveryAddress || '');
                  setManualEditPinCode(customerProfile.defaultPinCode || pinCode || '');
                  setGpsModalMode('edit');
                }}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  gpsModalMode === 'edit'
                    ? 'bg-[#0B6829] text-white shadow-xs'
                    : 'text-[#16261C] hover:bg-[#E8F6EC]'
                }`}
              >
                {t('3. पता सुधारें (Edit)', '3. Correct Address')}
              </button>
            </div>

            {/* Status & Error Banners */}
            {gpsStatusHi && (
              <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5] text-xs font-semibold text-[#085D3A] flex items-start gap-2">
                {gpsPermissionState === 'requesting' || savingPermanentAddress ? (
                  <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{gpsStatusHi}</span>
              </div>
            )}

            {gpsErrorHi && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-semibold text-[#991B1B] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{gpsErrorHi}</span>
              </div>
            )}

            {/* TAB 1: AUTOMATIC MOBILE GPS */}
            {gpsModalMode === 'gps' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#F2F9F4] border border-[#C6DEC9] space-y-2 text-xs text-[#16261C]">
                  <p className="font-bold text-sm text-[#064E1E]">
                    {t(
                      'मोबाइल GPS से पूरा पता अपने आप प्राप्त करें (Reverse Geocoding)',
                      'Automatically Fetch Full Address from Mobile GPS'
                    )}
                  </p>
                  <p className="text-[#3C5A46] leading-relaxed">
                    {t(
                      'नीचे बटन दबाने पर आपके मोबाइल GPS से वास्तविक Latitude और Longitude लेकर पूरा पता अपने आप निकाला जाएगा और आपके प्रोफाइल में स्थायी रूप से सेव हो जाएगा। इसके बाद हर ऑर्डर में यही पता अपने आप जुड़ जाएगा।',
                      'Clicking below fetches your real Latitude & Longitude via Mobile GPS, extracts your full address via Reverse Geocoding, and saves it permanently to your profile for all future orders.'
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={gpsPermissionState === 'requesting' || savingPermanentAddress}
                    onClick={() => requestCustomerGpsLocation(false)}
                    className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] disabled:opacity-55 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {gpsPermissionState === 'requesting' || savingPermanentAddress ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          {t('GPS से पता निकाला जा रहा है...', 'Detecting GPS Address...')}
                        </span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        <span>
                          {t(
                            'GPS अनुमति दें और पता अपने आप सेव करें',
                            'Allow GPS & Save Address Automatically'
                          )}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: MAP PIN SELECTOR (FALLBACK WHEN GPS IS DENIED OR UNAVAILABLE) */}
            {gpsModalMode === 'map_pin' && (
              <div className="space-y-3">
                <p className="text-xs text-[#3C5A46]">
                  {t(
                    'यदि GPS उपलब्ध नहीं है, तो नीचे मैप पिन के Latitude / Longitude को चुनें या तीर बटनों से पिन खिसकाएं और "इस पिन से पता सेव करें" दबाएं:',
                    'If GPS is unavailable, adjust the Map Pin coordinates below or nudge the pin and click "Save Address from Pin":'
                  )}
                </p>

                <div className="rounded-2xl overflow-hidden border-2 border-[#8FD1A4] bg-[#EAF4EC] h-52">
                  <iframe
                    title="GPS Map Pin Selector"
                    src={buildOpenStreetMapEmbedUrl(mapPinLat, mapPinLng)}
                    className="w-full h-full border-0"
                    loading="lazy"
                  />
                </div>

                {/* Quick Pin Nudge Controls & Coordinate Inputs */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F2F9F4] p-2.5 rounded-xl border border-[#C6DEC9]">
                  <span className="text-xs font-mono font-bold text-[#064E1E]">
                    Pin: {mapPinLat.toFixed(5)}, {mapPinLng.toFixed(5)}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMapPinLat((p) => Number((p + 0.002).toFixed(6)))}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#8FD1A4] text-xs font-bold text-[#064E1E] hover:bg-[#E8F6EC] cursor-pointer"
                    >
                      ↑ North
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapPinLat((p) => Number((p - 0.002).toFixed(6)))}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#8FD1A4] text-xs font-bold text-[#064E1E] hover:bg-[#E8F6EC] cursor-pointer"
                    >
                      ↓ South
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapPinLng((p) => Number((p - 0.002).toFixed(6)))}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#8FD1A4] text-xs font-bold text-[#064E1E] hover:bg-[#E8F6EC] cursor-pointer"
                    >
                      ← West
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapPinLng((p) => Number((p + 0.002).toFixed(6)))}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#8FD1A4] text-xs font-bold text-[#064E1E] hover:bg-[#E8F6EC] cursor-pointer"
                    >
                      → East
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#0B6829] mb-1">
                      Latitude (अक्षांश)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={mapPinLat}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!Number.isNaN(val) && val >= -90 && val <= 90) setMapPinLat(val);
                      }}
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#8FD1A4] font-mono text-xs text-[#16261C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#0B6829] mb-1">
                      Longitude (देशांतर)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={mapPinLng}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!Number.isNaN(val) && val >= -180 && val <= 180) setMapPinLng(val);
                      }}
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#8FD1A4] font-mono text-xs text-[#16261C]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={savingPermanentAddress}
                  onClick={async () => {
                    setSavingPermanentAddress(true);
                    setGpsErrorHi('');
                    setGpsStatusHi(
                      t(
                        'मैप पिन लोकेशन से पूरा पता निकाला जा रहा है...',
                        'Extracting full address from Map Pin coordinates...'
                      )
                    );
                    const ok = await reverseGeocodeAndSavePermanentAddress(mapPinLat, mapPinLng);
                    setSavingPermanentAddress(false);
                    if (ok) {
                      setIsGpsModalOpen(false);
                    }
                  }}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] disabled:opacity-55 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingPermanentAddress ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span>
                    {t(
                      'इस मैप पिन से पूरा पता निकालें और स्थायी सेव करें',
                      'Extract & Save Permanent Address from Map Pin'
                    )}
                  </span>
                </button>
              </div>
            )}

            {/* TAB 3: EDIT / CORRECT INACCURATE GPS ADDRESS */}
            {gpsModalMode === 'edit' && (
              <div className="space-y-3">
                <p className="text-xs text-[#3C5A46]">
                  {t(
                    'यदि GPS द्वारा निकाला गया पता थोड़ा अलग है, तो आप नीचे उसे सुधार कर स्थायी रूप से सेव कर सकते हैं:',
                    'If the GPS-detected address needs a house/landmark correction, refine it below and save permanently:'
                  )}
                </p>

                <div>
                  <label className="block text-xs font-bold text-[#0B6829] mb-1">
                    {t('पूरा स्थायी डिलीवरी पता (Full Permanent Address)', 'Full Permanent Address')}
                  </label>
                  <textarea
                    rows={3}
                    value={manualEditAddress}
                    onChange={(e) => setManualEditAddress(e.target.value)}
                    placeholder={t(
                      'मकान नंबर, गली/मोहल्ला, लैंडमार्क, शहर, राज्य...',
                      'House No, Street/Locality, Landmark, City, State...'
                    )}
                    className="w-full p-3 rounded-xl bg-white border border-[#8FD1A4] text-xs sm:text-sm text-[#16261C] focus:outline-none focus:border-[#0B6829]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0B6829] mb-1">
                    {t('पिन कोड (6 अंक)', 'PIN Code (6 Digits)')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={manualEditPinCode}
                    onChange={(e) =>
                      setManualEditPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="302001"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#8FD1A4] font-mono text-sm text-[#16261C] focus:outline-none focus:border-[#0B6829]"
                  />
                </div>

                <button
                  type="button"
                  disabled={savingPermanentAddress}
                  onClick={handleSaveManualOrPinPermanentAddress}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] disabled:opacity-55 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingPermanentAddress ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {t(
                      'स्थायी पता प्रोफाइल में सेव करें (Save Permanent Address)',
                      'Save Permanent Address to Profile'
                    )}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ADMIN & CUSTOMER "VIEW ON MAP" GPS MODAL
      ===================================================================== */}
      {activeMapViewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveMapViewModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white border-2 border-[#0B6829] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#D4E4D8] pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#064E1E] flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#0B6829] shrink-0" />
                  <span>{t(activeMapViewModal.titleHi, activeMapViewModal.titleEn)}</span>
                </h3>
                <p className="text-xs text-[#3C5A46] mt-0.5">
                  {activeMapViewModal.customerName} ·{' '}
                  <span className="font-mono font-bold text-[#0B6829]">
                    {activeMapViewModal.mobileNumber || activeMapViewModal.customerPhone || '—'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMapViewModal(null)}
                className="min-h-[36px] px-3 py-1 rounded-xl bg-[#EAF4EC] hover:bg-[#D4E4D8] text-xs font-bold text-[#16261C] cursor-pointer"
              >
                {t('बंद करें ✕', 'Close ✕')}
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F2F9F4] border border-[#C6DEC9] space-y-1.5 text-xs">
              <p className="font-bold text-[#16261C]">
                {t('पूरा GPS डिलीवरी पता:', 'Full GPS Delivery Address:')}{' '}
                <span className="font-semibold">{activeMapViewModal.address}</span>
              </p>
              <p className="font-mono font-bold text-[#064E1E]">
                Latitude: {activeMapViewModal.lat.toFixed(6)} | Longitude:{' '}
                {activeMapViewModal.lng.toFixed(6)}
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden border-2 border-[#8FD1A4] bg-[#EAF4EC] h-72 sm:h-80">
              <iframe
                title="Customer Order GPS Map View"
                src={buildOpenStreetMapEmbedUrl(activeMapViewModal.lat, activeMapViewModal.lng)}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <a
                href={buildExternalMapUrl(
                  activeMapViewModal.lat,
                  activeMapViewModal.lng,
                  activeMapViewModal.address
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B6829] hover:bg-[#074F1E] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                <span>
                  {t('Google Maps में खोलें (Open in Google Maps)', 'Open in Google Maps')}
                </span>
              </a>

              <button
                type="button"
                onClick={() => setActiveMapViewModal(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF4EC] hover:bg-[#D4E4D8] text-[#16261C] text-xs sm:text-sm font-bold cursor-pointer"
              >
                {t('बंद करें', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          INSTANT WHATSAPP ORDER NOTIFICATION & CONFIRMATION DISPATCH MODAL
      ===================================================================== */}
      {activeOrderWhatsappModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveOrderWhatsappModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white border-2 border-[#25D366] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#D4E4D8] pb-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#E8F6EC] border border-[#8FD1A4] text-[11px] font-bold text-[#064E1E]">
                    {activeOrderWhatsappModal.eventType === 'order_placed'
                      ? t(
                          'ऑर्डर दर्ज हो गया — तुरंत WhatsApp नोटिफिकेशन भेजें',
                          'Order Placed — Instant WhatsApp Notification'
                        )
                      : activeOrderWhatsappModal.eventType === 'admin_new_order_alert'
                      ? t(
                          'नया ऑर्डर आया है — तुरंत WhatsApp भेजें',
                          'New Order Received — Send WhatsApp Now'
                        )
                      : t(
                          'ऑर्डर स्टेटस अपडेट — कस्टमर को WhatsApp भेजें',
                          'Order Status Updated — Send Customer WhatsApp'
                        )}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[#064E1E] mt-1">
                    {t(
                      `ऑर्डर ${activeOrderWhatsappModal.shortOrderId} · ₹${activeOrderWhatsappModal.totalAmountInr} (${getOrderStatusLabel(
                        activeOrderWhatsappModal.orderStatus
                      )})`,
                      `Order ${activeOrderWhatsappModal.shortOrderId} · ₹${activeOrderWhatsappModal.totalAmountInr} (${getOrderStatusLabel(
                        activeOrderWhatsappModal.orderStatus
                      )})`
                    )}
                  </h3>
                  <p className="text-xs text-[#3C5A46] mt-0.5">
                    {t(
                      `ग्राहक: ${activeOrderWhatsappModal.customerName} (${activeOrderWhatsappModal.customerPhoneDisplay}) · एडमिन: ${activeOrderWhatsappModal.adminPhoneDisplay}`,
                      `Customer: ${activeOrderWhatsappModal.customerName} (${activeOrderWhatsappModal.customerPhoneDisplay}) · Admin: ${activeOrderWhatsappModal.adminPhoneDisplay}`
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveOrderWhatsappModal(null)}
                className="min-h-[36px] px-3 py-1 rounded-xl bg-[#EAF4EC] hover:bg-[#D4E4D8] text-xs font-bold text-[#16261C] cursor-pointer"
              >
                {t('बंद करें ✕', 'Close ✕')}
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#E8F6EC] border border-[#62B37A] text-xs text-[#064E1E] space-y-1">
              <p className="font-bold">
                {activeOrderWhatsappModal.eventType === 'order_placed'
                  ? t(
                      '✓ आपका ऑर्डर Firebase में सुरक्षित सेव हो गया है! नीचे दिए गए हरे WhatsApp बटन पर क्लिक करके Admin (+91 7507505064) और अपने WhatsApp नंबर पर तुरंत ऑर्डर मैसेज भेजें:',
                      '✓ Your order is safely saved in Firebase! Click the green WhatsApp buttons below to immediately send the order message to Admin (+91 7507505064) and receive your Order Confirmation:'
                    )
                  : t(
                      '✓ ऑर्डर स्टेटस Firebase में अपडेट हो गया है! नीचे दिए गए बटन पर क्लिक करके Customer और Admin के WhatsApp पर तुरंत मैसेज भेजें:',
                      '✓ Order status is updated in Firebase! Click below to send the WhatsApp message immediately to Customer and Admin:'
                    )}
              </p>
            </div>

            {/* Dual 1-Tap Direct WhatsApp Dispatch Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={activeOrderWhatsappModal.adminWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[50px] px-4 py-3 rounded-2xl bg-[#25D366] hover:bg-[#1DA851] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md no-underline text-center cursor-pointer"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span>
                  {t(
                    `1. Admin WhatsApp पर ऑर्डर भेजें (${activeOrderWhatsappModal.adminPhoneDisplay})`,
                    `1. Send to Admin WhatsApp (${activeOrderWhatsappModal.adminPhoneDisplay})`
                  )}
                </span>
              </a>

              <a
                href={activeOrderWhatsappModal.customerWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[50px] px-4 py-3 rounded-2xl bg-[#0B6829] hover:bg-[#064E1E] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md no-underline text-center cursor-pointer"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span>
                  {activeOrderWhatsappModal.eventType === 'status_updated'
                    ? t(
                        `2. Customer को Status Update भेजें (${activeOrderWhatsappModal.customerPhoneDisplay})`,
                        `2. Send Status Update to Customer (${activeOrderWhatsappModal.customerPhoneDisplay})`
                      )
                    : t(
                        `2. Customer WhatsApp Confirmation (${activeOrderWhatsappModal.customerPhoneDisplay})`,
                        `2. Customer WhatsApp Confirmation (${activeOrderWhatsappModal.customerPhoneDisplay})`
                      )}
                </span>
              </a>
            </div>

            {/* Message Preview */}
            <div className="rounded-2xl bg-[#F2F9F4] border border-[#C6DEC9] p-3.5 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0B6829]">
                {activeOrderWhatsappModal.autoOpenedTarget === 'customer'
                  ? t(
                      'WhatsApp मैसेज प्रीव्यू (Customer Order Confirmation / Status Update):',
                      'WhatsApp Message Preview (Customer Order Confirmation / Status Update):'
                    )
                  : t(
                      'WhatsApp मैसेज प्रीव्यू (Admin Order Notification +91 7507505064):',
                      'WhatsApp Message Preview (Admin Order Notification +91 7507505064):'
                    )}
              </p>
              <pre className="text-[11px] font-mono text-[#16261C] whitespace-pre-wrap break-words max-h-48 overflow-y-auto leading-relaxed">
                {activeOrderWhatsappModal.autoOpenedTarget === 'customer'
                  ? activeOrderWhatsappModal.customerMessagePreview
                  : activeOrderWhatsappModal.adminMessagePreview}
              </pre>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setActiveOrderWhatsappModal(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#EAF4EC] hover:bg-[#D4E4D8] text-[#16261C] text-xs font-bold cursor-pointer"
              >
                {t('ठीक है, बंद करें', 'Done, Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Help & Contact Modal (Admin-Controlled) */}
      <SetupGuideModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        highlightProviderWarning={highlightProviderWarning}
        settings={appSettings}
        lang={lang}
        isAdmin={isAdminUser}
        onOpenAdminSettings={() => setActiveSection('admin')}
      />
    </div>
  );
}

