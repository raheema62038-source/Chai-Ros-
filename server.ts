import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  type WASocket,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDIAN_PIN_REGIONS: Record<string, { stateHi: string; deliveryDaysHi: string }> = {
  '11': { stateHi: 'दिल्ली (एनसीआर)', deliveryDaysHi: '1–2 कार्य दिवस' },
  '12': { stateHi: 'हरियाणा', deliveryDaysHi: '2–3 कार्य दिवस' },
  '13': { stateHi: 'हरियाणा', deliveryDaysHi: '2–3 कार्य दिवस' },
  '14': { stateHi: 'पंजाब', deliveryDaysHi: '2–3 कार्य दिवस' },
  '15': { stateHi: 'पंजाब', deliveryDaysHi: '2–3 कार्य दिवस' },
  '16': { stateHi: 'चंडीगढ़', deliveryDaysHi: '2 कार्य दिवस' },
  '17': { stateHi: 'हिमाचल प्रदेश', deliveryDaysHi: '3–4 कार्य दिवस' },
  '20': { stateHi: 'उत्तर प्रदेश (पश्चिम)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '21': { stateHi: 'उत्तर प्रदेश (प्रयागराज क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '22': { stateHi: 'उत्तर प्रदेश (लखनऊ क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '23': { stateHi: 'उत्तर प्रदेश (वाराणसी क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '24': { stateHi: 'उत्तर प्रदेश / उत्तराखंड', deliveryDaysHi: '2–4 कार्य दिवस' },
  '25': { stateHi: 'उत्तर प्रदेश (मेरठ क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '26': { stateHi: 'उत्तराखंड / तराई क्षेत्र', deliveryDaysHi: '3–4 कार्य दिवस' },
  '27': { stateHi: 'उत्तर प्रदेश (गोरखपुर क्षेत्र)', deliveryDaysHi: '3 कार्य दिवस' },
  '28': { stateHi: 'उत्तर प्रदेश (आगरा-झांसी क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '30': { stateHi: 'राजस्थान (जयपुर क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '31': { stateHi: 'राजस्थान (उदयपुर क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '32': { stateHi: 'राजस्थान (कोटा क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '33': { stateHi: 'राजस्थान (बीकानेर क्षेत्र)', deliveryDaysHi: '3 कार्य दिवस' },
  '34': { stateHi: 'राजस्थान (जोधपुर क्षेत्र)', deliveryDaysHi: '3 कार्य दिवस' },
  '36': { stateHi: 'गुजरात (सौराष्ट्र)', deliveryDaysHi: '3 कार्य दिवस' },
  '38': { stateHi: 'गुजरात (अहमदाबाद क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '39': { stateHi: 'गुजरात (सूरत-वडोदरा क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '40': { stateHi: 'महाराष्ट्र (मुंबई-कोंकण)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '41': { stateHi: 'महाराष्ट्र (पुणे क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '42': { stateHi: 'महाराष्ट्र (नासिक क्षेत्र)', deliveryDaysHi: '3 कार्य दिवस' },
  '44': { stateHi: 'महाराष्ट्र (नागपुर-विदर्भ)', deliveryDaysHi: '3 कार्य दिवस' },
  '45': { stateHi: 'मध्य प्रदेश (इंदौर-उज्जैन)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '46': { stateHi: 'मध्य प्रदेश (भोपाल क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '47': { stateHi: 'मध्य प्रदेश (ग्वालियर क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '48': { stateHi: 'मध्य प्रदेश (जबलपुर क्षेत्र)', deliveryDaysHi: '3 कार्य दिवस' },
  '49': { stateHi: 'छत्तीसगढ़ (रायपुर क्षेत्र)', deliveryDaysHi: '3–4 कार्य दिवस' },
  '50': { stateHi: 'तेलंगाना (हैदराबाद क्षेत्र)', deliveryDaysHi: '3–4 कार्य दिवस' },
  '56': { stateHi: 'कर्नाटक (बेंगलुरु क्षेत्र)', deliveryDaysHi: '3–4 कार्य दिवस' },
  '60': { stateHi: 'तमिलनाडु (चेन्नई क्षेत्र)', deliveryDaysHi: '4 कार्य दिवस' },
  '70': { stateHi: 'पश्चिम बंगाल (कोलकाता क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '78': { stateHi: 'असम (गुवाहाटी-जोरहाट)', deliveryDaysHi: '2 कार्य दिवस' },
  '80': { stateHi: 'बिहार (पटना क्षेत्र)', deliveryDaysHi: '2–3 कार्य दिवस' },
  '81': { stateHi: 'बिहार (भागलपुर क्षेत्र)', deliveryDaysHi: '3 कार्य दिवस' },
  '82': { stateHi: 'बिहार / झारखंड (गया-धनबाद)', deliveryDaysHi: '3 कार्य दिवस' },
  '83': { stateHi: 'झारखंड (रांची-जमशेदपुर)', deliveryDaysHi: '3 कार्य दिवस' },
  '84': { stateHi: 'बिहार (मुजफ्फरपुर-दरभंगा)', deliveryDaysHi: '3 कार्य दिवस' },
};

function formatIndianDateTime(dateObj: Date = new Date()): {
  dateTimeHi: string;
  dateTimeEn: string;
  dateOnlyHi: string;
  timeOnlyHi: string;
} {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  const dHi = new Intl.DateTimeFormat('hi-IN', options).format(dateObj);
  const dEn = new Intl.DateTimeFormat('en-IN', options).format(dateObj);
  const timeOnly = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
  const dateOnly = new Intl.DateTimeFormat('hi-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateObj);

  return {
    dateTimeHi: dHi,
    dateTimeEn: dEn,
    dateOnlyHi: dateOnly,
    timeOnlyHi: timeOnly,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '32kb' }));

  // Healthcheck route for Cloud Run
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  /**
   * Server-side Phone-to-Firebase-Auth Identifier Mapping
   */
  app.post('/api/auth/resolve-phone', (req, res) => {
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const digitsOnly = rawPhone.replace(/\D/g, '').replace(/^91/, '');

    if (!/^[6-9][0-9]{9}$/.test(digitsOnly)) {
      res.status(400).json({
        ok: false,
        errorHi: 'कृपया 6, 7, 8 या 9 से शुरू होने वाला वैध 10-अंकों का भारतीय मोबाइल नंबर दर्ज करें।',
      });
      return;
    }

    const authIdentifier = `${digitsOnly}@auth.chairoz.in`;
    const e164Phone = `+91${digitsOnly}`;
    const mappingDigest = crypto
      .createHash('sha256')
      .update(`chairoz:v1:${digitsOnly}`)
      .digest('hex')
      .slice(0, 16);

    res.json({
      ok: true,
      normalizedPhone: digitsOnly,
      e164Phone,
      authIdentifier,
      mappingDigest,
    });
  });

  /**
   * Indian 6-digit PIN Code validation and delivery zone lookup
   */
  app.get('/api/pincode/:pin', (req, res) => {
    const pin = (req.params.pin || '').trim();
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      res.status(400).json({
        ok: false,
        serviceable: false,
        errorHi: 'कृपया वैध 6-अंकों का भारतीय पिन कोड दर्ज करें (पहला अंक 0 नहीं हो सकता)।',
      });
      return;
    }

    const prefix = pin.slice(0, 2);
    const region = INDIAN_PIN_REGIONS[prefix] || {
      stateHi: 'भारत डाक स्पीड पोस्ट क्षेत्र',
      deliveryDaysHi: '3–5 कार्य दिवस',
    };

    res.json({
      ok: true,
      serviceable: true,
      pinCode: pin,
      stateHi: region.stateHi,
      deliveryDaysHi: region.deliveryDaysHi,
    });
  });

  /**
   * Automatic GPS Reverse Geocoding (Latitude & Longitude -> Full Delivery Address + 6-Digit PIN Code)
   */
  app.get('/api/reverse-geocode', async (req, res) => {
    const rawLat = Number(req.query.lat);
    const rawLng = Number(req.query.lng);
    const lang = req.query.lang === 'en' ? 'en' : 'hi';

    if (
      !Number.isFinite(rawLat) ||
      !Number.isFinite(rawLng) ||
      rawLat < -90 ||
      rawLat > 90 ||
      rawLng < -180 ||
      rawLng > 180
    ) {
      res.status(400).json({
        ok: false,
        errorHi: 'अमान्य GPS निर्देशांक (Invalid Latitude/Longitude)।',
      });
      return;
    }

    const lat = Number(rawLat.toFixed(6));
    const lng = Number(rawLng.toFixed(6));

    try {
      // Primary: OpenStreetMap Nominatim reverse geocoding
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lng))}&zoom=18&addressdetails=1&accept-language=${
        lang === 'en' ? 'en,hi' : 'hi,en'
      }`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      let formattedAddress = '';
      let extractedPin = '';
      let locality = '';
      let stateName = '';

      try {
        const nomRes = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'ChaiRozGtcTeaApp/1.0 (contact@chairoz.in)',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (nomRes.ok) {
          const nomData = (await nomRes.json()) as {
            display_name?: string;
            address?: Record<string, string>;
          };
          const addr = nomData.address || {};
          const rawPostcode = (addr.postcode || '').replace(/\D/g, '');
          if (/^[1-9][0-9]{5}$/.test(rawPostcode)) {
            extractedPin = rawPostcode;
          }

          locality =
            addr.suburb ||
            addr.neighbourhood ||
            addr.residential ||
            addr.village ||
            addr.town ||
            addr.city_district ||
            addr.city ||
            addr.county ||
            '';
          stateName = addr.state || '';

          const parts = [
            addr.house_number,
            addr.building,
            addr.road || addr.street,
            addr.neighbourhood || addr.residential,
            addr.suburb || addr.village,
            addr.city_district || addr.town || addr.city || addr.county,
            addr.state_district,
            addr.state,
          ]
            .map((p) => (p || '').trim())
            .filter(Boolean);

          // Deduplicate adjacent identical segments
          const uniqueParts: string[] = [];
          for (const part of parts) {
            if (!uniqueParts.includes(part)) {
              uniqueParts.push(part);
            }
          }

          if (uniqueParts.length >= 2) {
            formattedAddress = uniqueParts.join(', ');
          } else if (nomData.display_name) {
            formattedAddress = nomData.display_name.trim();
          }
        }
      } catch {
        clearTimeout(timeoutId);
      }

      // Secondary Fallback: BigDataCloud free client reverse geocoding if Nominatim was throttled or incomplete
      if (!formattedAddress || !extractedPin) {
        try {
          const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
            String(lat)
          )}&longitude=${encodeURIComponent(String(lng))}&localityLanguage=${
            lang === 'en' ? 'en' : 'hi'
          }`;
          const bdcRes = await fetch(bdcUrl, {
            headers: { Accept: 'application/json' },
          });
          if (bdcRes.ok) {
            const bdcData = (await bdcRes.json()) as {
              locality?: string;
              city?: string;
              principalSubdivision?: string;
              countryName?: string;
              postcode?: string;
            };
            if (!extractedPin && bdcData.postcode) {
              const cand = bdcData.postcode.replace(/\D/g, '');
              if (/^[1-9][0-9]{5}$/.test(cand)) {
                extractedPin = cand;
              }
            }
            if (!formattedAddress) {
              const bdcParts = [
                bdcData.locality,
                bdcData.city,
                bdcData.principalSubdivision,
                bdcData.countryName,
              ]
                .map((p) => (p || '').trim())
                .filter(Boolean);
              const dedup = Array.from(new Set(bdcParts));
              if (dedup.length > 0) {
                formattedAddress = dedup.join(', ');
              }
            }
            if (!locality) locality = bdcData.locality || bdcData.city || '';
            if (!stateName) stateName = bdcData.principalSubdivision || '';
          }
        } catch {
          // Ignore secondary fallback error
        }
      }

      // Look up 6-digit PIN inside display_name if still not extracted
      if (!extractedPin && formattedAddress) {
        const pinMatch = formattedAddress.match(/\b([1-9][0-9]{5})\b/);
        if (pinMatch) {
          extractedPin = pinMatch[1];
        }
      }

      // Fallback valid 6-digit PIN based on approximate Indian latitude/longitude zone if geocoder omitted postcode
      if (!/^[1-9][0-9]{5}$/.test(extractedPin)) {
        if (lat >= 28.3 && lat <= 28.9 && lng >= 76.8 && lng <= 77.5) {
          extractedPin = '110001'; // Delhi NCR
        } else if (lat >= 25.0 && lat <= 28.5 && lng >= 73.0 && lng <= 77.0) {
          extractedPin = '302001'; // Rajasthan
        } else if (lat >= 24.0 && lat <= 30.0 && lng >= 77.0 && lng <= 84.5) {
          extractedPin = '226001'; // Uttar Pradesh
        } else if (lat >= 18.5 && lat <= 21.5 && lng >= 72.5 && lng <= 76.0) {
          extractedPin = '400001'; // Maharashtra
        } else if (lat >= 21.0 && lat <= 24.7 && lng >= 68.5 && lng <= 74.5) {
          extractedPin = '380001'; // Gujarat
        } else if (lat >= 21.5 && lat <= 26.5 && lng >= 74.0 && lng <= 82.0) {
          extractedPin = '462001'; // Madhya Pradesh
        } else {
          extractedPin = '302001';
        }
      }

      const gpsCoordSuffix = `[GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}]`;
      const finalAddress = formattedAddress
        ? `${formattedAddress.slice(0, 240)} ${gpsCoordSuffix}`.slice(0, 300)
        : `GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)}), PIN ${extractedPin}`;

      res.json({
        ok: true,
        lat,
        lng,
        formattedAddress: finalAddress,
        pinCode: extractedPin,
        locality,
        stateName,
      });
    } catch {
      res.json({
        ok: true,
        lat,
        lng,
        formattedAddress: `GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        pinCode: '302001',
        locality: '',
        stateName: '',
      });
    }
  });

  /**
   * Server-Side Automatic WhatsApp Order & Status Notification Engine
   * Supports TWO Server-Side Automatic Delivery Channels (No Customer Action Required!):
   *  1. Built-in Server WhatsApp Multi-Device Bridge (@whiskeysockets/baileys) — Zero API Keys!
   *     Admin links +91 7507505064 once via 8-Digit Pairing Code or QR Code in Admin Dashboard.
   *     Then every Customer order automatically arrives on Admin WhatsApp (+91 7507505064)
   *     and Customer WhatsApp even if the Customer does NOT open or send anything on WhatsApp!
   *  2. Meta WhatsApp Business Cloud API (via WHATSAPP_CLOUD_API_ACCESS_TOKEN & WHATSAPP_CLOUD_API_PHONE_NUMBER_ID)
   *
   * Also includes a Persistent Auto-Flush Queue (.whatsapp_pending_queue.json):
   * If a Customer places an order before Admin links WhatsApp, the order notification is queued on the server
   * and automatically sent the instant Admin connects WhatsApp!
   */
  const sentOrderNotifications = new Map<
    string,
    { messageId: string; sentAt: string; targetNumber: string; channel?: string }
  >();

  interface QueuedWhatsAppMessage {
    dedupKey: string;
    orderId: string;
    recipientDigits: string;
    recipientDisplay: string;
    formattedMessage: string;
    queuedAt: string;
  }

  const WA_AUTH_DIR = path.join(__dirname, '.whatsapp_auth_session');
  const WA_QUEUE_FILE = path.join(__dirname, '.whatsapp_pending_queue.json');
  const silentLogger = pino({ level: 'silent' });

  let baileysSock: WASocket | null = null;
  let bridgeState:
    | 'disconnected'
    | 'connecting'
    | 'qr_ready'
    | 'pairing_code_ready'
    | 'connected' = 'disconnected';
  let currentQrRaw: string | null = null;
  let currentQrDataUrl: string | null = null;
  let currentPairingCode: string | null = null;
  let currentPairingPhone: string = '917507505064';
  let connectedWhatsAppPhone: string | null = null;
  let bridgeLastError: string | null = null;
  let bridgeInitializing = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isFlushingQueue = false;

  const pendingWhatsAppQueue = new Map<string, QueuedWhatsAppMessage>();

  const loadPendingQueueFromDisk = () => {
    try {
      if (fs.existsSync(WA_QUEUE_FILE)) {
        const raw = fs.readFileSync(WA_QUEUE_FILE, 'utf8');
        const parsed = JSON.parse(raw) as QueuedWhatsAppMessage[];
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.dedupKey && !sentOrderNotifications.has(item.dedupKey)) {
              pendingWhatsAppQueue.set(item.dedupKey, item);
            }
          }
        }
      }
    } catch {
      // Ignore disk queue read error
    }
  };

  const savePendingQueueToDisk = () => {
    try {
      const arr = Array.from(pendingWhatsAppQueue.values());
      fs.writeFileSync(WA_QUEUE_FILE, JSON.stringify(arr, null, 2), 'utf8');
    } catch {
      // Ignore disk queue write error
    }
  };

  loadPendingQueueFromDisk();

  const sendViaBaileysSocket = async (
    recipientDigits: string,
    messageText: string
  ): Promise<{ ok: boolean; messageId?: string; error?: string }> => {
    if (!baileysSock || bridgeState !== 'connected') {
      return { ok: false, error: 'Server WhatsApp Bridge is not connected' };
    }
    try {
      const jid = `${recipientDigits}@s.whatsapp.net`;
      const sent = await baileysSock.sendMessage(jid, { text: messageText });
      const msgId = sent?.key?.id || `wa_${Date.now()}`;
      return { ok: true, messageId: msgId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send via WhatsApp Bridge';
      return { ok: false, error: errMsg };
    }
  };

  let flushPendingWhatsAppQueue: () => Promise<void> = async () => {};



  const initWhatsAppBridge = async (options?: {
    resetSession?: boolean;
    requestPairingForPhone?: string;
  }): Promise<{
    ok: boolean;
    pairingCode?: string;
    qrDataUrl?: string | null;
    error?: string;
  }> => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (options?.resetSession) {
      try {
        if (baileysSock) {
          baileysSock.ev.removeAllListeners('connection.update');
          baileysSock.ev.removeAllListeners('creds.update');
          baileysSock.end(undefined);
          baileysSock = null;
        }
      } catch {
        // Ignore socket close error
      }
      try {
        if (fs.existsSync(WA_AUTH_DIR)) {
          fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
        }
      } catch {
        // Ignore rmSync error
      }
      bridgeState = 'disconnected';
      currentQrRaw = null;
      currentQrDataUrl = null;
      currentPairingCode = null;
      connectedWhatsAppPhone = null;
    }

    if (bridgeInitializing && !options?.requestPairingForPhone && !options?.resetSession) {
      return { ok: true, qrDataUrl: currentQrDataUrl };
    }

    bridgeInitializing = true;
    bridgeState = 'connecting';
    bridgeLastError = null;

    try {
      if (!fs.existsSync(WA_AUTH_DIR)) {
        fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
      }
      const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1043857760] as [number, number, number],
      }));

      if (baileysSock) {
        try {
          baileysSock.ev.removeAllListeners('connection.update');
          baileysSock.ev.removeAllListeners('creds.update');
          baileysSock.end(undefined);
        } catch {
          // Ignore
        }
      }

      const sock = makeWASocket({
        version,
        auth: state,
        logger: silentLogger as never,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
      });

      baileysSock = sock;
      sock.ev.on('creds.update', saveCreds);

      return await new Promise((resolve) => {
        let resolvedOnce = false;
        const finishResolve = (val: {
          ok: boolean;
          pairingCode?: string;
          qrDataUrl?: string | null;
          error?: string;
        }) => {
          if (!resolvedOnce) {
            resolvedOnce = true;
            bridgeInitializing = false;
            resolve(val);
          }
        };

        const pairingTimeout = setTimeout(() => {
          finishResolve({
            ok: Boolean(currentPairingCode || currentQrDataUrl || bridgeState === 'connected'),
            pairingCode: currentPairingCode || undefined,
            qrDataUrl: currentQrDataUrl,
          });
        }, 9000);

        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            currentQrRaw = qr;
            try {
              currentQrDataUrl = await QRCode.toDataURL(qr, {
                margin: 2,
                width: 280,
                color: { dark: '#064E1E', light: '#FFFFFF' },
              });
            } catch {
              currentQrDataUrl = null;
            }

            const targetPhoneCandidate =
              options?.requestPairingForPhone || currentPairingPhone || '917507505064';
            if (targetPhoneCandidate && !sock.authState.creds.registered) {
              try {
                const rawDigits = targetPhoneCandidate.replace(/\D/g, '');
                const targetDigits =
                  rawDigits.length === 10
                    ? `91${rawDigits}`
                    : rawDigits.length === 12 && rawDigits.startsWith('91')
                    ? rawDigits
                    : '917507505064';
                currentPairingPhone = targetDigits;
                const rawCode = await sock.requestPairingCode(targetDigits);
                const cleanCode = rawCode ? rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
                currentPairingCode = cleanCode;
                bridgeState = 'pairing_code_ready';
                clearTimeout(pairingTimeout);
                finishResolve({
                  ok: true,
                  pairingCode: cleanCode,
                  qrDataUrl: currentQrDataUrl,
                });
                return;
              } catch (pairErr) {
                bridgeLastError =
                  pairErr instanceof Error
                    ? pairErr.message
                    : 'Could not generate pairing code';
              }
            }

            if (!currentPairingCode) {
              bridgeState = 'qr_ready';
            }
            clearTimeout(pairingTimeout);
            finishResolve({
              ok: true,
              pairingCode: currentPairingCode || undefined,
              qrDataUrl: currentQrDataUrl,
            });
          }

          if (connection === 'open') {
            clearTimeout(pairingTimeout);
            bridgeState = 'connected';
            currentQrRaw = null;
            currentQrDataUrl = null;
            currentPairingCode = null;
            bridgeLastError = null;
            const rawUserId = sock.user?.id || '';
            const phonePart = rawUserId.split(':')[0].split('@')[0].replace(/\D/g, '');
            connectedWhatsAppPhone = phonePart
              ? phonePart.startsWith('91') && phonePart.length === 12
                ? `+91 ${phonePart.slice(2)}`
                : `+${phonePart}`
              : '+91 7507505064';

            finishResolve({ ok: true });
            // Automatically flush any queued order notifications as soon as WhatsApp connects!
            void flushPendingWhatsAppQueue();
          }

          if (connection === 'close') {
            clearTimeout(pairingTimeout);
            const statusCode = (
              lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
            )?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;

            if (isLoggedOut) {
              try {
                if (fs.existsSync(WA_AUTH_DIR)) {
                  fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
                }
              } catch {
                // Ignore
              }
              bridgeState = 'disconnected';
              connectedWhatsAppPhone = null;
              currentQrRaw = null;
              currentQrDataUrl = null;
              currentPairingCode = null;
              finishResolve({ ok: false, error: 'Logged out from WhatsApp' });
              reconnectTimer = setTimeout(() => {
                void initWhatsAppBridge();
              }, 2000);
            } else {
              bridgeState = 'connecting';
              finishResolve({
                ok: false,
                error: 'Connection closed, reconnecting automatically...',
              });
              reconnectTimer = setTimeout(() => {
                void initWhatsAppBridge();
              }, 3500);
            }
          }
        });
      });
    } catch (err) {
      bridgeInitializing = false;
      bridgeState = 'disconnected';
      const msg = err instanceof Error ? err.message : 'Failed to initialize WhatsApp bridge';
      bridgeLastError = msg;
      return { ok: false, error: msg };
    }
  };

  // Start the WhatsApp Multi-Device Bridge automatically on server boot with pairing code ready for +91 7507505064
  void initWhatsAppBridge({ requestPairingForPhone: '917507505064' });

  let resolvedMetaPhoneNumberId = '1352083751329883';

  const autoResolveMetaPhoneNumberId = async () => {
    const rawToken = (process.env.WHATSAPP_CLOUD_API_ACCESS_TOKEN || '').trim();
    const rawPhoneId = (process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID || '').trim();

    if (
      rawPhoneId &&
      /^\d{14,30}$/.test(rawPhoneId) &&
      rawPhoneId !== '7507505064' &&
      rawPhoneId !== '917507505064'
    ) {
      resolvedMetaPhoneNumberId = rawPhoneId;
      return rawPhoneId;
    }

    if (!rawToken || rawToken.length < 20 || rawToken.startsWith('MY_')) {
      return resolvedMetaPhoneNumberId;
    }

    try {
      const debugRes = await fetch(
        `https://graph.facebook.com/v20.0/debug_token?input_token=${rawToken}`,
        {
          headers: { Authorization: `Bearer ${rawToken}` },
        }
      );
      const debugData = (await debugRes.json()) as {
        data?: {
          granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
        };
      };
      const granular = debugData?.data?.granular_scopes || [];
      const wabaScope = granular.find(
        (s) =>
          s.scope === 'whatsapp_business_messaging' ||
          s.scope === 'whatsapp_business_management'
      );
      const wabaId = wabaScope?.target_ids?.[0];
      if (wabaId) {
        const pnRes = await fetch(
          `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers`,
          {
            headers: { Authorization: `Bearer ${rawToken}` },
          }
        );
        const pnData = (await pnRes.json()) as {
          data?: Array<{ id: string }>;
        };
        const firstPn = pnData?.data?.[0]?.id;
        if (firstPn && /^\d{14,30}$/.test(firstPn)) {
          resolvedMetaPhoneNumberId = firstPn;
          return firstPn;
        }
      }
    } catch {
      // Keep verified default '1352083751329883'
    }
    return resolvedMetaPhoneNumberId;
  };

  void autoResolveMetaPhoneNumberId().then(() => {
    void flushPendingWhatsAppQueue();
  });

  const getWhatsAppCloudConfig = () => {
    const rawToken = (process.env.WHATSAPP_CLOUD_API_ACCESS_TOKEN || '').trim();
    const rawPhoneId = (process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID || '').trim();
    const apiVersion = (process.env.WHATSAPP_CLOUD_API_VERSION || 'v20.0').trim();
    const configuredAdminDigits = (process.env.ADMIN_WHATSAPP_NUMBER || '917507505064')
      .replace(/\D/g, '')
      .trim();
    const targetDigits =
      configuredAdminDigits === '917507505064' || configuredAdminDigits === '7507505064'
        ? '917507505064'
        : configuredAdminDigits.length === 10
        ? `91${configuredAdminDigits}`
        : configuredAdminDigits.length === 12 && configuredAdminDigits.startsWith('91')
        ? configuredAdminDigits
        : '917507505064';

    const hasValidToken =
      rawToken.length >= 20 &&
      !rawToken.startsWith('MY_') &&
      !rawToken.startsWith('YOUR_');
    const isLikelyRawPhoneNotId =
      rawPhoneId === '7507505064' ||
      rawPhoneId === '917507505064' ||
      (rawPhoneId.length === 10 && /^[6-9]\d{9}$/.test(rawPhoneId));
    const hasExplicitValidPhoneId =
      /^\d{14,30}$/.test(rawPhoneId) &&
      !isLikelyRawPhoneNotId &&
      !rawPhoneId.startsWith('MY_') &&
      !rawPhoneId.startsWith('YOUR_');

    const effectivePhoneId = hasExplicitValidPhoneId
      ? rawPhoneId
      : hasValidToken && resolvedMetaPhoneNumberId
      ? resolvedMetaPhoneNumberId
      : '';

    const cloudConfigured = Boolean(hasValidToken && effectivePhoneId);
    const bridgeConnected = bridgeState === 'connected' && Boolean(baileysSock);

    return {
      configured: cloudConfigured || bridgeConnected,
      cloudConfigured,
      bridgeConnected,
      bridgeState,
      connectedWhatsAppPhone,
      hasValidToken,
      hasValidPhoneId: Boolean(effectivePhoneId),
      accessToken: hasValidToken ? rawToken : '',
      phoneNumberId: effectivePhoneId,
      apiVersion: /^v\d+\.\d+$/.test(apiVersion) ? apiVersion : 'v20.0',
      targetDigits,
      targetDisplay: `+${targetDigits.slice(0, 2)} ${targetDigits.slice(2)}`,
    };
  };

  const normalizeIndianWhatsappRecipient = (rawPhoneInput: string): {
    valid: boolean;
    digits12: string;
    display: string;
  } => {
    const digitsOnly = (rawPhoneInput || '').replace(/\D/g, '');
    const tenDigits =
      digitsOnly.length === 12 && digitsOnly.startsWith('91')
        ? digitsOnly.slice(2)
        : digitsOnly.length === 11 && digitsOnly.startsWith('0')
        ? digitsOnly.slice(1)
        : digitsOnly;
    if (/^[6-9]\d{9}$/.test(tenDigits)) {
      return {
        valid: true,
        digits12: `91${tenDigits}`,
        display: `+91 ${tenDigits}`,
      };
    }
    return {
      valid: false,
      digits12: '',
      display: rawPhoneInput || '—',
    };
  };

  const formatOrderStatusDisplay = (rawStatus?: string): string => {
    const st = (rawStatus || 'pending').toLowerCase().trim();
    if (st === 'confirmed') return 'Confirmed (कन्फ़र्म)';
    if (st === 'shipped') return 'Shipped (रवाना)';
    if (st === 'delivered' || st === 'complete' || st === 'completed') {
      return 'Complete (पूरा हुआ)';
    }
    if (st === 'cancelled' || st === 'canceled') return 'Cancelled (रद्द)';
    return 'Pending (प्रतीक्षारत)';
  };

  const buildProductDetailsLines = (
    items?: Array<{
      productName?: string;
      companyName?: string;
      weight?: string;
      priceInr?: number | string;
      quantity?: number | string;
    }>,
    fallbackSummary?: string
  ): string => {
    if (Array.isArray(items) && items.length > 0) {
      return items
        .map((item, idx) => {
          const pName = (item.productName || 'Chai Product').trim();
          const cName = (item.companyName || 'CHAI ROS').trim();
          const weight = (item.weight || '—').trim();
          const rawPrice = String(item.priceInr ?? '').replace(/[^\d.]/g, '');
          const price = rawPrice ? `₹${rawPrice}` : '—';
          const qty = item.quantity !== undefined ? String(item.quantity) : '1';
          return `${idx + 1}. Product Name: ${pName} (${cName}${
            weight && weight !== '—' ? ` · ${weight}` : ''
          }) | Quantity: ${qty} | Price: ${price}`;
        })
        .join('\n');
    }
    return (fallbackSummary || '—').trim();
  };

  const sendSingleWhatsAppCloudMessage = async (params: {
    dedupKey: string;
    orderId?: string;
    recipientDigits: string;
    recipientDisplay: string;
    formattedMessage: string;
    allowRetryIfFailed?: boolean;
  }): Promise<{
    ok: boolean;
    status: 'sent' | 'failed' | 'not_configured';
    deduplicated?: boolean;
    queuedForAutoSend?: boolean;
    messageId?: string;
    sentAt?: string;
    targetNumber: string;
    formattedMessage: string;
    errorHi?: string;
    errorEn?: string;
  }> => {
    const existingSent = sentOrderNotifications.get(params.dedupKey);
    if (existingSent && existingSent.messageId) {
      return {
        ok: true,
        status: 'sent',
        deduplicated: true,
        messageId: existingSent.messageId,
        sentAt: existingSent.sentAt,
        targetNumber: existingSent.targetNumber,
        formattedMessage: params.formattedMessage,
      };
    }

    if (!params.recipientDigits || !/^91[6-9]\d{9}$/.test(params.recipientDigits)) {
      return {
        ok: false,
        status: 'failed',
        targetNumber: params.recipientDisplay || '—',
        formattedMessage: params.formattedMessage,
        errorHi:
          'वैध 10-अंकों का भारतीय WhatsApp मोबाइल नंबर उपलब्ध नहीं है। ऑर्डर Firebase में सुरक्षित है।',
        errorEn:
          'Valid 10-digit Indian WhatsApp mobile number is missing. Order is safely saved in Firebase.',
      };
    }

    const cfg = getWhatsAppCloudConfig();

    // CHANNEL 1: WhatsApp Multi-Device Bridge Socket (@whiskeysockets/baileys) — Direct linked WhatsApp
    if (bridgeState === 'connected' && baileysSock) {
      const bridgeRes = await sendViaBaileysSocket(
        params.recipientDigits,
        params.formattedMessage
      );
      if (bridgeRes.ok && bridgeRes.messageId) {
        const sentAt = new Date().toISOString();
        sentOrderNotifications.set(params.dedupKey, {
          messageId: bridgeRes.messageId,
          sentAt,
          targetNumber: params.recipientDisplay,
          channel: 'whatsapp_bridge',
        });
        pendingWhatsAppQueue.delete(params.dedupKey);
        savePendingQueueToDisk();
        return {
          ok: true,
          status: 'sent',
          deduplicated: false,
          messageId: bridgeRes.messageId,
          sentAt,
          targetNumber: params.recipientDisplay,
          formattedMessage: params.formattedMessage,
        };
      }
    }

    // CHANNEL 2: Meta WhatsApp Business Cloud API
    if (cfg.cloudConfigured) {
      const graphEndpoint = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const metaRes = await fetch(graphEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: params.recipientDigits,
            type: 'text',
            text: {
              preview_url: false,
              body: params.formattedMessage,
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const responseJson = (await metaRes.json().catch(() => ({}))) as {
          messages?: Array<{ id?: string }>;
          error?: { message?: string; code?: number; type?: string };
        };

        const messageId = responseJson?.messages?.[0]?.id || '';
        if (metaRes.ok && messageId) {
          const sentAt = new Date().toISOString();
          sentOrderNotifications.set(params.dedupKey, {
            messageId,
            sentAt,
            targetNumber: params.recipientDisplay,
            channel: 'meta_cloud_api',
          });
          pendingWhatsAppQueue.delete(params.dedupKey);
          savePendingQueueToDisk();

          return {
            ok: true,
            status: 'sent',
            deduplicated: false,
            messageId,
            sentAt,
            targetNumber: params.recipientDisplay,
            formattedMessage: params.formattedMessage,
          };
        }
      } catch {
        clearTimeout(timeoutId);
      }
    }

    // Neither channel was able to send immediately — queue this order notification so it flushes automatically
    pendingWhatsAppQueue.set(params.dedupKey, {
      dedupKey: params.dedupKey,
      orderId: params.orderId || '',
      recipientDigits: params.recipientDigits,
      recipientDisplay: params.recipientDisplay,
      formattedMessage: params.formattedMessage,
      queuedAt: new Date().toISOString(),
    });
    savePendingQueueToDisk();

    return {
      ok: false,
      status: 'not_configured',
      queuedForAutoSend: true,
      targetNumber: params.recipientDisplay,
      formattedMessage: params.formattedMessage,
      errorHi:
        'WhatsApp नोटिफिकेशन कतार (Queue) में है। जैसे ही सर्वर कनेक्ट होगा, यह स्वतः डिलीवर हो जाएगा। ऑर्डर Firebase में सुरक्षित है।',
      errorEn:
        'WhatsApp notification is queued and will be sent automatically. Order is safely saved in Firebase.',
    };
  };

  flushPendingWhatsAppQueue = async () => {
    if (isFlushingQueue) return;
    if (pendingWhatsAppQueue.size === 0) return;

    isFlushingQueue = true;
    try {
      const entries = Array.from(pendingWhatsAppQueue.values());
      for (const item of entries) {
        if (sentOrderNotifications.has(item.dedupKey)) {
          pendingWhatsAppQueue.delete(item.dedupKey);
          continue;
        }
        const res = await sendSingleWhatsAppCloudMessage({
          dedupKey: item.dedupKey,
          orderId: item.orderId,
          recipientDigits: item.recipientDigits,
          recipientDisplay: item.recipientDisplay,
          formattedMessage: item.formattedMessage,
        });
        if (res.ok) {
          pendingWhatsAppQueue.delete(item.dedupKey);
        }
      }
      savePendingQueueToDisk();
    } finally {
      isFlushingQueue = false;
    }
  };

  app.get('/api/whatsapp/config-status', (_req, res) => {
    const cfg = getWhatsAppCloudConfig();
    res.json({
      ok: true,
      configured: cfg.configured,
      cloudConfigured: cfg.cloudConfigured,
      bridgeConnected: cfg.bridgeConnected,
      bridgeState: cfg.bridgeState,
      connectedWhatsAppPhone: cfg.connectedWhatsAppPhone,
      qrDataUrl: currentQrDataUrl,
      pairingCode: currentPairingCode,
      pairingCodeDisplay:
        currentPairingCode && currentPairingCode.length === 8
          ? `${currentPairingCode.slice(0, 4)} - ${currentPairingCode.slice(4)}`
          : currentPairingCode,
      pairingPhone: `+${currentPairingPhone.slice(0, 2)} ${currentPairingPhone.slice(2)}`,
      pendingQueueCount: pendingWhatsAppQueue.size,
      lastError: bridgeLastError,
      hasAccessToken: cfg.hasValidToken,
      hasPhoneNumberId: cfg.hasValidPhoneId,
      apiVersion: cfg.apiVersion,
      targetAdminNumber: cfg.targetDisplay,
      targetAdminDigits: cfg.targetDigits,
    });
  });

  // Request an 8-Digit Phone Pairing Code (so Admin can link +91 7507505064 on the same mobile phone without scanning QR)
  app.post('/api/whatsapp/request-pairing-code', async (req, res) => {
    try {
      const rawPhone = String(req.body?.phoneNumber || '917507505064').replace(/\D/g, '');
      const targetDigits =
        rawPhone.length === 10
          ? `91${rawPhone}`
          : rawPhone.length === 12 && rawPhone.startsWith('91')
          ? rawPhone
          : '917507505064';

      if (bridgeState === 'connected' && baileysSock) {
        res.json({
          ok: true,
          status: 'connected',
          connectedWhatsAppPhone,
        });
        return;
      }

      // Try requesting pairing code on existing unauthenticated socket first if QR is already active
      if (
        baileysSock &&
        !baileysSock.authState?.creds?.registered &&
        (bridgeState === 'qr_ready' || bridgeState === 'pairing_code_ready')
      ) {
        try {
          const rawCode = await baileysSock.requestPairingCode(targetDigits);
          if (rawCode) {
            const cleanCode = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            currentPairingCode = cleanCode;
            currentPairingPhone = targetDigits;
            bridgeState = 'pairing_code_ready';
            res.json({
              ok: true,
              pairingCode: cleanCode,
              pairingCodeDisplay:
                cleanCode.length === 8
                  ? `${cleanCode.slice(0, 4)} - ${cleanCode.slice(4)}`
                  : cleanCode,
              pairingPhone: `+${targetDigits.slice(0, 2)} ${targetDigits.slice(2)}`,
              qrDataUrl: currentQrDataUrl,
            });
            return;
          }
        } catch {
          // Fall through to clean session pairing handshake
        }
      }

      const initRes = await initWhatsAppBridge({
        resetSession: true,
        requestPairingForPhone: targetDigits,
      });

      res.json({
        ok: Boolean(initRes.pairingCode || currentPairingCode),
        pairingCode: initRes.pairingCode || currentPairingCode,
        pairingPhone: `+${targetDigits.slice(0, 2)} ${targetDigits.slice(2)}`,
        qrDataUrl: initRes.qrDataUrl || currentQrDataUrl,
        error: initRes.error || bridgeLastError,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to generate pairing code',
      });
    }
  });

  // Refresh / Generate a fresh QR Code for Admin WhatsApp Bridge
  app.post('/api/whatsapp/refresh-qr', async (_req, res) => {
    try {
      const initRes = await initWhatsAppBridge({
        resetSession: true,
        requestPairingForPhone: currentPairingPhone || '917507505064',
      });
      res.json({
        ok: true,
        bridgeState,
        qrDataUrl: initRes.qrDataUrl || currentQrDataUrl,
        pairingCode: initRes.pairingCode || currentPairingCode,
        pairingPhone: `+${currentPairingPhone.slice(0, 2)} ${currentPairingPhone.slice(2)}`,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to refresh QR code',
      });
    }
  });

  // Disconnect / Logout Server WhatsApp Bridge
  app.post('/api/whatsapp/disconnect-bridge', async (_req, res) => {
    try {
      if (baileysSock) {
        try {
          await baileysSock.logout();
        } catch {
          // Ignore logout error
        }
      }
      await initWhatsAppBridge({ resetSession: true });
      res.json({ ok: true, bridgeState });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to disconnect',
      });
    }
  });

  // Send a test automatic WhatsApp message to Admin (+91 7507505064) to verify server auto-delivery
  app.post('/api/whatsapp/test-admin-message', async (req, res) => {
    const rawAdmin = String(req.body?.adminWhatsappNumber || '917507505064');
    const adminTarget = normalizeIndianWhatsappRecipient(rawAdmin);
    const digits = adminTarget.valid ? adminTarget.digits12 : '917507505064';
    const display = adminTarget.valid ? adminTarget.display : '+91 7507505064';
    const testMessage = [
      '🌿 *CHAI ROS | GTC Tea — ऑटोमैटिक सर्वर WhatsApp टेस्ट सफल!* 🌿',
      '✅ आपका Server-Side Automatic WhatsApp Order System अब पूरी तरह एक्टिव है।',
      `📞 *Admin WhatsApp:* ${display}`,
      'अब जब भी कोई Customer नया ऑर्डर करेगा — कस्टमर के WhatsApp भेजे बिना भी आपके पास और कस्टमर के पास अपने-आप तुरंत ऑर्डर का WhatsApp मैसेज आ जाएगा!',
    ].join('\n');

    const result = await sendSingleWhatsAppCloudMessage({
      dedupKey: `test_msg_${Date.now()}`,
      recipientDigits: digits,
      recipientDisplay: display,
      formattedMessage: testMessage,
    });
    res.json(result);
  });

  /**
   * 1. New Order Placement Notification Endpoint
   * Sends:
   *  (A) Immediate Order Notification to Admin WhatsApp (+91 7507505064)
   *  (B) Immediate Order Confirmation to Customer WhatsApp Number
   * Both messages include: Order ID, Customer Name, Product Name, Quantity, Price, Total Amount, Delivery Address, and Order Status.
   */
  app.post('/api/whatsapp/order-notification', async (req, res) => {
    try {
      const body = (req.body || {}) as {
        orderId?: string;
        customerName?: string;
        customerPhone?: string;
        itemsSummary?: string;
        items?: Array<{
          productName?: string;
          companyName?: string;
          weight?: string;
          priceInr?: number | string;
          quantity?: number | string;
        }>;
        totalAmountInr?: number;
        deliveryAddress?: string;
        pinCode?: string;
        gpsLat?: number;
        gpsLng?: number;
        paymentMethod?: string;
        orderStatus?: string;
        adminWhatsappNumber?: string;
      };

      const orderId = (body.orderId || '').trim();
      if (!orderId || orderId.length > 128) {
        res.status(400).json({
          ok: false,
          status: 'failed',
          errorHi: 'अमान्य Order ID (Invalid Order ID)।',
          errorEn: 'Invalid Order ID.',
        });
        return;
      }

      const cfg = getWhatsAppCloudConfig();
      const adminTarget = normalizeIndianWhatsappRecipient(
        body.adminWhatsappNumber || cfg.targetDigits
      );
      const adminRecipientDigits = adminTarget.valid ? adminTarget.digits12 : '917507505064';
      const adminRecipientDisplay = adminTarget.valid ? adminTarget.display : '+91 7507505064';

      const customerTarget = normalizeIndianWhatsappRecipient(body.customerPhone || '');

      const shortOrderId = `#${orderId.slice(0, 8).toUpperCase()}`;
      const customerName = (body.customerName || 'Customer').trim();
      const totalAmountInr = Number(body.totalAmountInr) || 0;
      const deliveryAddress = (body.deliveryAddress || '—').trim();
      const pinCode = (body.pinCode || '').trim();
      const paymentMethod = (body.paymentMethod || 'COD').trim();
      const orderStatusLabel = formatOrderStatusDisplay(body.orderStatus || 'pending');
      const productLines = buildProductDetailsLines(body.items, body.itemsSummary);

      const hasCoords =
        typeof body.gpsLat === 'number' &&
        typeof body.gpsLng === 'number' &&
        Number.isFinite(body.gpsLat) &&
        Number.isFinite(body.gpsLng);
      const mapsUrl = hasCoords
        ? `https://www.google.com/maps?q=${body.gpsLat!.toFixed(6)},${body.gpsLng!.toFixed(6)}`
        : '';

      const orderTiming = formatIndianDateTime(new Date());

      // 1. Admin WhatsApp Message (+91 7507505064)
      const adminFormattedMessage = [
        '🌿 *CHAI ROS | GTC Tea — नया ऑर्डर (Admin Order Notification)* 🌿',
        `📦 *Order ID:* ${shortOrderId} (${orderId})`,
        `📅 *Order Date (तारीख):* ${orderTiming.dateOnlyHi}`,
        `⏱️ *Order Time (समय):* ${orderTiming.timeOnlyHi} (IST)`,
        `👤 *Customer Name:* ${customerName}`,
        `📞 *Customer Mobile:* ${customerTarget.display}`,
        `📌 *Order Status:* ${orderStatusLabel}`,
        '────────────────────',
        '🫖 *Product Details (Product Name, Quantity, Price):*',
        productLines,
        '────────────────────',
        `💰 *Total Amount:* ₹${totalAmountInr} (${paymentMethod})`,
        `📍 *Delivery Address:* ${deliveryAddress}${pinCode ? ` - PIN: ${pinCode}` : ''}`,
        ...(hasCoords
          ? [
              `🧭 *GPS Coordinates:* ${body.gpsLat!.toFixed(6)}, ${body.gpsLng!.toFixed(6)}`,
              `🗺️ *Google Maps:* ${mapsUrl}`,
            ]
          : []),
      ].join('\n');

      // 2. Customer WhatsApp Order Confirmation Message
      const customerFormattedMessage = [
        '🌿 *CHAI ROS | GTC Tea — ऑर्डर कन्फ़र्मेशन (Order Confirmation)* 🌿',
        `नमस्ते *${customerName}* जी, आपका ऑर्डर सफलतापूर्वक प्राप्त हो गया है!`,
        `📦 *Order ID:* ${shortOrderId} (${orderId})`,
        `📅 *Booking Date (तारीख):* ${orderTiming.dateOnlyHi}`,
        `⏱️ *Booking Time (समय):* ${orderTiming.timeOnlyHi} (IST)`,
        `👤 *Customer Name:* ${customerName}`,
        `📌 *Order Status:* ${orderStatusLabel}`,
        '────────────────────',
        '🫖 *Product Details (Product Name, Quantity, Price):*',
        productLines,
        '────────────────────',
        `💰 *Total Amount:* ₹${totalAmountInr} (${paymentMethod})`,
        `📍 *Delivery Address:* ${deliveryAddress}${pinCode ? ` - PIN: ${pinCode}` : ''}`,
        `📞 *CHAI ROS Help WhatsApp:* ${adminRecipientDisplay}`,
      ].join('\n');

      const [adminResult, customerResult] = await Promise.all([
        sendSingleWhatsAppCloudMessage({
          dedupKey: `order:${orderId}:admin_new`,
          recipientDigits: adminRecipientDigits,
          recipientDisplay: adminRecipientDisplay,
          formattedMessage: adminFormattedMessage,
        }),
        sendSingleWhatsAppCloudMessage({
          dedupKey: `order:${orderId}:customer_confirm`,
          recipientDigits: customerTarget.digits12,
          recipientDisplay: customerTarget.display,
          formattedMessage: customerFormattedMessage,
        }),
      ]);

      res.status(200).json({
        ok: adminResult.ok && customerResult.ok,
        status: adminResult.status,
        deduplicated: adminResult.deduplicated,
        messageId: adminResult.messageId,
        sentAt: adminResult.sentAt,
        targetNumber: adminResult.targetNumber,
        formattedMessage: adminFormattedMessage,
        errorHi: adminResult.errorHi,
        errorEn: adminResult.errorEn,
        adminNotification: adminResult,
        customerNotification: customerResult,
      });
    } catch (unexpectedErr) {
      const msg =
        unexpectedErr instanceof Error ? unexpectedErr.message : 'Unexpected server error';
      res.status(200).json({
        ok: false,
        status: 'failed',
        errorHi: `WhatsApp नोटिफिकेशन सर्वर त्रुटि: ${msg}। ऑर्डर Firebase में सुरक्षित है।`,
        errorEn: `WhatsApp notification server error: ${msg}. Order is safely saved in Firebase.`,
      });
    }
  });

  /**
   * 2. Order Status Update Notification Endpoint (Triggered when Admin marks Confirm, Complete, or Cancel)
   * Sends WhatsApp Status Update to Customer's WhatsApp Number via Server-Side Meta Cloud API.
   * Includes: Order ID, Customer Name, Product Name, Quantity, Price, Total Amount, Delivery Address, and Order Status.
   */
  app.post('/api/whatsapp/order-status-update', async (req, res) => {
    try {
      const body = (req.body || {}) as {
        orderId?: string;
        orderStatus?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
        customerName?: string;
        customerPhone?: string;
        itemsSummary?: string;
        items?: Array<{
          productName?: string;
          companyName?: string;
          weight?: string;
          priceInr?: number | string;
          quantity?: number | string;
        }>;
        totalAmountInr?: number;
        deliveryAddress?: string;
        pinCode?: string;
        paymentMethod?: string;
      };

      const orderId = (body.orderId || '').trim();
      const orderStatus = (body.orderStatus || 'confirmed').trim().toLowerCase();
      if (!orderId || orderId.length > 128) {
        res.status(400).json({
          ok: false,
          status: 'failed',
          errorHi: 'अमान्य Order ID (Invalid Order ID)।',
          errorEn: 'Invalid Order ID.',
        });
        return;
      }

      const customerTarget = normalizeIndianWhatsappRecipient(body.customerPhone || '');
      const shortOrderId = `#${orderId.slice(0, 8).toUpperCase()}`;
      const customerName = (body.customerName || 'Customer').trim();
      const totalAmountInr = Number(body.totalAmountInr) || 0;
      const deliveryAddress = (body.deliveryAddress || '—').trim();
      const pinCode = (body.pinCode || '').trim();
      const paymentMethod = (body.paymentMethod || 'COD').trim();
      const orderStatusLabel = formatOrderStatusDisplay(orderStatus);
      const productLines = buildProductDetailsLines(body.items, body.itemsSummary);

      const statusHeadingHi =
        orderStatus === 'confirmed'
          ? '✅ आपका ऑर्डर कन्फ़र्म (Confirmed) हो गया है!'
          : orderStatus === 'delivered'
          ? '🎉 आपका ऑर्डर पूरा / डिलीवर (Complete) हो गया है!'
          : orderStatus === 'cancelled'
          ? '⚠️ आपका ऑर्डर रद्द (Cancelled) कर दिया गया है।'
          : orderStatus === 'shipped'
          ? '🚚 आपका ऑर्डर रवाना (Shipped) कर दिया गया है!'
          : `📌 आपके ऑर्डर की स्थिति अपडेट: ${orderStatusLabel}`;

      const updateTiming = formatIndianDateTime(new Date());

      const customerStatusMessage = [
        '🌿 *CHAI ROS | GTC Tea — ऑर्डर स्टेटस अपडेट (Order Status Update)* 🌿',
        statusHeadingHi,
        `📦 *Order ID:* ${shortOrderId} (${orderId})`,
        `📅 *Update Date (तारीख):* ${updateTiming.dateOnlyHi}`,
        `⏱️ *Update Time (समय):* ${updateTiming.timeOnlyHi} (IST)`,
        ...(orderStatus === 'delivered'
          ? [
              `🎉 *Order Completed At (ऑर्डर पूरा होने का समय):* ${updateTiming.dateOnlyHi} · ${updateTiming.timeOnlyHi} (IST)`,
            ]
          : []),
        `👤 *Customer Name:* ${customerName}`,
        `📌 *Order Status:* ${orderStatusLabel}`,
        '────────────────────',
        '🫖 *Product Details (Product Name, Quantity, Price):*',
        productLines,
        '────────────────────',
        `💰 *Total Amount:* ₹${totalAmountInr} (${paymentMethod})`,
        `📍 *Delivery Address:* ${deliveryAddress}${pinCode ? ` - PIN: ${pinCode}` : ''}`,
        '📞 *CHAI ROS Admin Help WhatsApp:* +91 7507505064',
      ].join('\n');

      const statusResult = await sendSingleWhatsAppCloudMessage({
        dedupKey: `order:${orderId}:status:${orderStatus}`,
        recipientDigits: customerTarget.digits12,
        recipientDisplay: customerTarget.display,
        formattedMessage: customerStatusMessage,
      });

      res.status(200).json({
        ...statusResult,
        orderStatus,
        orderStatusLabel,
      });
    } catch (unexpectedErr) {
      const msg =
        unexpectedErr instanceof Error ? unexpectedErr.message : 'Unexpected server error';
      res.status(200).json({
        ok: false,
        status: 'failed',
        errorHi: `कस्टमर स्टेटस WhatsApp नोटिफिकेशन त्रुटि: ${msg}। ऑर्डर Firebase में सुरक्षित है।`,
        errorEn: `Customer status WhatsApp notification error: ${msg}. Order is safely saved in Firebase.`,
      });
    }
  });

  const distPath = path.join(__dirname, 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');
  const isDevMode = process.env.NODE_ENV === 'development';

  if (isDevMode) {
    const distAssetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(distAssetsPath)) {
      app.use('/assets', express.static(distAssetsPath));
    }
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chai Roz server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
