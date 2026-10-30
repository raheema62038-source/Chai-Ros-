import React from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Clock,
  HelpCircle,
  Edit3,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { FIREBASE_PROJECT_ID } from '../firebase';
import {
  AppSettingsData,
  formatAdminWhatsappDisplay,
  buildAdminWhatsappChatUrl,
} from '../data/appSettings';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlightProviderWarning?: boolean;
  lang?: 'hi' | 'en';
  settings?: AppSettingsData;
  appSettings?: AppSettingsData;
  isAdmin?: boolean;
  isAdminUser?: boolean;
  onOpenAdminSettings?: () => void;
  onAdminEditHelpSettings?: () => void;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  isOpen,
  onClose,
  highlightProviderWarning = false,
  lang = 'hi',
  settings,
  appSettings: appSettingsProp,
  isAdmin = false,
  isAdminUser: isAdminUserProp = false,
  onOpenAdminSettings,
  onAdminEditHelpSettings,
}) => {
  if (!isOpen) return null;

  const appSettings = settings || appSettingsProp;
  const isAdminUser = isAdmin || isAdminUserProp;
  const handleEditSettings = onOpenAdminSettings || onAdminEditHelpSettings;

  const t = (hi: string, en: string) => (lang === 'en' ? en : hi);

  const companyName =
    appSettings?.companyName ||
    (lang === 'en' ? appSettings?.companyNameEn : appSettings?.companyNameHi) ||
    appSettings?.companyNameHi ||
    appSettings?.appNameHi ||
    'CHAI ROS';

  const helpTitle =
    (lang === 'en' ? appSettings?.helpTitleEn : appSettings?.helpTitleHi) ||
    t('सहायता एवं संपर्क जानकारी', 'Help & Contact Information');

  const helpContent =
    (lang === 'en'
      ? appSettings?.helpMessageEn || appSettings?.helpContentEn
      : appSettings?.helpMessageHi || appSettings?.helpContentHi) ||
    appSettings?.helpMessageHi ||
    appSettings?.helpContentHi ||
    '';

  const companyAddress =
    appSettings?.contactAddress ||
    (lang === 'en' ? appSettings?.companyAddressEn : appSettings?.companyAddressHi) ||
    appSettings?.companyAddressHi ||
    '';

  const supportHours =
    (lang === 'en' ? appSettings?.supportHoursEn : appSettings?.supportHoursHi) ||
    appSettings?.supportHoursHi ||
    '';

  const deliveryAreas =
    (lang === 'en' ? appSettings?.deliveryAreasEn : appSettings?.deliveryAreasHi) ||
    appSettings?.deliveryAreasHi ||
    '';

  const primaryColor = appSettings?.primaryColor || '#0B6829';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white border border-[#D4E4D8] rounded-3xl shadow-xl my-8 max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-xs font-semibold opacity-90">{companyName}</p>
              <h2 id="help-modal-title" className="text-base sm:text-lg font-bold">
                {helpTitle}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-white/90 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            aria-label={t('बंद करें', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm leading-relaxed text-[#16261C]">
          {/* Admin Quick Edit Shortcut */}
          {isAdminUser && handleEditSettings && (
            <div className="p-3.5 rounded-2xl bg-[#E8F6EC] border border-[#62B37A] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-[#064E1E]">
                {t(
                  'एडमिन कंट्रोल: आप सहायता पेज, कंपनी का नाम, पता और मोबाइल नंबर एडमिन सेटिंग्स से बदल सकते हैं।',
                  'Admin Control: You can edit Help content, Company Name, Address, and Contact Numbers from Admin Settings.'
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  handleEditSettings();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#0B6829] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{t('Help व संपर्क एडिट करें', 'Edit Help & Contact')}</span>
              </button>
            </div>
          )}

          {/* Help Content / Instructions configured by Admin */}
          {helpContent ? (
            <div className="p-4 rounded-2xl bg-[#F4FAF6] border border-[#D4E4D8] space-y-1.5">
              <h3 className="text-xs font-bold text-[#0B6829]">
                {t('ग्राहक सहायता संदेश', 'Customer Help Information')}
              </h3>
              <p className="text-sm text-[#16261C] whitespace-pre-line">{helpContent}</p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#F4FAF6] border border-[#D4E4D8] text-xs sm:text-sm text-[#3C5A46]">
              {t(
                'ऑर्डर करने के लिए कैटलॉग से अपना पसंदीदा प्रोडक्ट चुनें, मात्रा चुनें और अपना पूरा डिलीवरी पता व 6-अंकों का पिन कोड दर्ज करें।',
                'To place an order, select your preferred product from the catalogue, choose the quantity, and enter your full delivery address and 6-digit PIN code.'
              )}
            </div>
          )}

          {/* Direct Admin WhatsApp Help Card (Single Official Number: +91 7507505064) */}
          <div className="p-4 rounded-2xl bg-[#ECFDF3] border-2 border-[#25D366] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#075E54] block">
                {t('Admin WhatsApp Help नंबर', 'Admin WhatsApp Help Number')}
              </span>
              <p className="text-base font-mono font-bold text-[#064E1E]">
                {formatAdminWhatsappDisplay(
                  appSettings?.whatsappNumber || appSettings?.contactWhatsapp
                )}
              </p>
              <p className="text-[11px] text-[#3C5A46]">
                {t(
                  'ऑर्डर और प्रोडक्ट की जानकारी के लिए सीधे WhatsApp पर संपर्क करें।',
                  'Chat directly on WhatsApp for order and product assistance.'
                )}
              </p>
            </div>
            <a
              href={buildAdminWhatsappChatUrl(
                appSettings?.whatsappNumber || appSettings?.contactWhatsapp
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0"
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
          </div>

          {/* Company & Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-white border border-[#D4E4D8] space-y-1">
              <span className="text-xs font-bold text-[#4B6B56] block">
                {t('कंपनी का नाम', 'Company Name')}
              </span>
              <p className="text-sm font-bold text-[#16261C]">{companyName}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#D4E4D8] space-y-1">
              <span className="text-xs font-bold text-[#4B6B56] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#0B6829]" />
                <span>{t('Admin WhatsApp नंबर', 'Admin WhatsApp Number')}</span>
              </span>
              <p className="text-sm font-mono font-bold text-[#064E1E]">
                {formatAdminWhatsappDisplay(
                  appSettings?.whatsappNumber || appSettings?.contactWhatsapp
                )}
              </p>
            </div>

            {appSettings?.contactEmail && (
              <div className="p-4 rounded-2xl bg-white border border-[#D4E4D8] space-y-1">
                <span className="text-xs font-bold text-[#4B6B56] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#0B6829]" />
                  <span>{t('संपर्क ईमेल', 'Contact Email')}</span>
                </span>
                <p className="text-sm font-mono font-bold text-[#064E1E] break-all">
                  {appSettings.contactEmail}
                </p>
              </div>
            )}

            {companyAddress && (
              <div className="p-4 rounded-2xl bg-white border border-[#D4E4D8] space-y-1 sm:col-span-2">
                <span className="text-xs font-bold text-[#4B6B56] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#0B6829]" />
                  <span>{t('कंपनी का पता', 'Company Address')}</span>
                </span>
                <p className="text-sm font-semibold text-[#16261C]">{companyAddress}</p>
              </div>
            )}

            {supportHours && (
              <div className="p-4 rounded-2xl bg-white border border-[#D4E4D8] space-y-1">
                <span className="text-xs font-bold text-[#4B6B56] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0B6829]" />
                  <span>{t('सहायता समय', 'Support Hours')}</span>
                </span>
                <p className="text-sm font-semibold text-[#16261C]">{supportHours}</p>
              </div>
            )}

            {deliveryAreas && (
              <div className="p-4 rounded-2xl bg-white border border-[#D4E4D8] space-y-1">
                <span className="text-xs font-bold text-[#4B6B56] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#0B6829]" />
                  <span>{t('डिलीवरी क्षेत्र', 'Delivery Areas')}</span>
                </span>
                <p className="text-sm font-semibold text-[#16261C]">{deliveryAreas}</p>
              </div>
            )}
          </div>

          {/* Only show Firebase Auth Provider link when explicitly triggered or for Admin */}
          {(highlightProviderWarning || isAdminUser) && (
            <div className="p-4 rounded-2xl bg-[#FDF2EC] border border-[#E07A52] text-[#7A2710] space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  {t(
                    'Firebase Authentication साइन-इन सेटिंग्स',
                    'Firebase Authentication Sign-In Settings'
                  )}
                </span>
              </div>
              <p className="text-xs">
                {t(
                  'यदि ईमेल/पासवर्ड लॉगिन सक्षम नहीं है, तो आप Google Sign-In का उपयोग कर सकते हैं या Firebase Console में Email/Password प्रोवाइडर चालू कर सकते हैं।',
                  'If Email/Password sign-in is not yet enabled, you can use Google Sign-In or enable the Email/Password provider in Firebase Console.'
                )}
              </p>
              {isAdminUser && (
                <a
                  href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9E3B1B] text-white text-xs font-bold hover:bg-[#822E13] transition-colors"
                >
                  <span>Firebase Auth Providers</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#F4FAF6] border-t border-[#D4E4D8] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: primaryColor }}
            className="px-5 py-2 rounded-xl text-white text-xs font-bold hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t('बंद करें', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
