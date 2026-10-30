import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Save,
  Upload,
  CheckCircle2,
  AlertCircle,
  Globe,
  Phone,
  MapPin,
  Truck,
  Palette,
  Megaphone,
  HelpCircle,
  Scale,
  Store,
  Trash2,
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  AppSettingsData,
  INITIAL_APP_SETTINGS,
  normalizeAdminWhatsappDigits,
} from '../data/appSettings';

interface AdminAppSettingsPanelProps {
  settings: AppSettingsData;
  isHindi: boolean;
}

export const AdminAppSettingsPanel: React.FC<AdminAppSettingsPanelProps> = ({
  settings,
  isHindi,
}) => {
  const [formData, setFormData] = useState<AppSettingsData>(settings || INITIAL_APP_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({
      ...INITIAL_APP_SETTINGS,
      ...settings,
    });
  }, [settings]);

  const handleChange = <K extends keyof AppSettingsData>(
    key: K,
    value: AppSettingsData[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const compressImageFile = (file: File, maxWidth = 800, quality = 0.78): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = String(event.target?.result || '');
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 400, 0.85);
      handleChange('logoUrl', dataUrl);
    } catch {
      setStatusMessage({
        type: 'error',
        text: isHindi ? 'लोगो अपलोड करने में समस्या आई।' : 'Failed to process logo image.',
      });
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 1100, 0.8);
      handleChange('bannerImageUrl', dataUrl);
    } catch {
      setStatusMessage({
        type: 'error',
        text: isHindi ? 'बैनर फोटो अपलोड करने में समस्या आई।' : 'Failed to process banner image.',
      });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const compName = (
        formData.companyName ||
        formData.companyNameEn ||
        formData.companyNameHi ||
        'CHAI ROS'
      ).trim();

      const cleanPayload = {
        id: 'app_config',
        appNameEn: (formData.appNameEn || 'CHAI ROS').trim(),
        appNameHi: (formData.appNameHi || 'CHAI ROS').trim(),
        companyName: compName,
        companyNameEn: (formData.companyNameEn || compName).trim(),
        companyNameHi: (formData.companyNameHi || compName).trim(),
        taglineEn: (formData.taglineEn || '').trim(),
        taglineHi: (formData.taglineHi || '').trim(),
        logoUrl: (formData.logoUrl || '').trim(),
        primaryColor: (formData.primaryColor || '#14281D').trim(),
        accentColor: (formData.accentColor || '#B45309').trim(),
        contactPhone: `+91 ${normalizeAdminWhatsappDigits(
          formData.contactWhatsapp || formData.whatsappNumber || formData.contactPhone
        )}`,
        contactWhatsapp: normalizeAdminWhatsappDigits(
          formData.contactWhatsapp || formData.whatsappNumber
        ),
        whatsappNumber: normalizeAdminWhatsappDigits(
          formData.whatsappNumber || formData.contactWhatsapp
        ),
        contactEmail: (formData.contactEmail || '').trim(),
        contactAddress: (
          formData.contactAddress ||
          formData.companyAddressHi ||
          formData.companyAddressEn ||
          ''
        ).trim(),
        companyAddressEn: (formData.companyAddressEn || formData.contactAddress || '').trim(),
        companyAddressHi: (formData.companyAddressHi || formData.contactAddress || '').trim(),
        bannerTitleEn: (formData.bannerTitleEn || '').trim(),
        bannerTitleHi: (formData.bannerTitleHi || '').trim(),
        bannerSubtitleEn: (formData.bannerSubtitleEn || '').trim(),
        bannerSubtitleHi: (formData.bannerSubtitleHi || '').trim(),
        bannerImageUrl: (formData.bannerImageUrl || '').trim(),
        announcementEn: (formData.announcementEn || '').trim(),
        announcementHi: (formData.announcementHi || '').trim(),
        specialOfferBannerEn: (formData.specialOfferBannerEn || formData.offerBannerEn || '').trim(),
        specialOfferBannerHi: (formData.specialOfferBannerHi || formData.offerBannerHi || '').trim(),
        offerBannerEn: (formData.specialOfferBannerEn || formData.offerBannerEn || '').trim(),
        offerBannerHi: (formData.specialOfferBannerHi || formData.offerBannerHi || '').trim(),
        catalogHeadingEn: (formData.catalogHeadingEn || formData.catalogTitleEn || '').trim(),
        catalogHeadingHi: (formData.catalogHeadingHi || formData.catalogTitleHi || '').trim(),
        catalogTitleEn: (formData.catalogHeadingEn || formData.catalogTitleEn || '').trim(),
        catalogTitleHi: (formData.catalogHeadingHi || formData.catalogTitleHi || '').trim(),
        catalogSubheadingEn: (
          formData.catalogSubheadingEn ||
          formData.catalogSubtitleEn ||
          ''
        ).trim(),
        catalogSubheadingHi: (
          formData.catalogSubheadingHi ||
          formData.catalogSubtitleHi ||
          ''
        ).trim(),
        catalogSubtitleEn: (
          formData.catalogSubheadingEn ||
          formData.catalogSubtitleEn ||
          ''
        ).trim(),
        catalogSubtitleHi: (
          formData.catalogSubheadingHi ||
          formData.catalogSubtitleHi ||
          ''
        ).trim(),
        emptyCatalogTitleEn: (
          formData.emptyCatalogTitleEn ||
          formData.emptyCatalogMsgEn ||
          ''
        ).trim(),
        emptyCatalogTitleHi: (
          formData.emptyCatalogTitleHi ||
          formData.emptyCatalogMsgHi ||
          ''
        ).trim(),
        emptyCatalogMsgEn: (
          formData.emptyCatalogTitleEn ||
          formData.emptyCatalogMsgEn ||
          ''
        ).trim(),
        emptyCatalogMsgHi: (
          formData.emptyCatalogTitleHi ||
          formData.emptyCatalogMsgHi ||
          ''
        ).trim(),
        emptyCatalogSubtitleEn: (formData.emptyCatalogSubtitleEn || '').trim(),
        emptyCatalogSubtitleHi: (formData.emptyCatalogSubtitleHi || '').trim(),
        addToCartBtnEn: (formData.addToCartBtnEn || '').trim(),
        addToCartBtnHi: (formData.addToCartBtnHi || '').trim(),
        orderBtnEn: (formData.orderBtnEn || formData.orderNowBtnEn || '').trim(),
        orderBtnHi: (formData.orderBtnHi || formData.orderNowBtnHi || '').trim(),
        orderNowBtnEn: (formData.orderBtnEn || formData.orderNowBtnEn || '').trim(),
        orderNowBtnHi: (formData.orderBtnHi || formData.orderNowBtnHi || '').trim(),
        deliveryChargeInr: Math.max(0, Math.round(Number(formData.deliveryChargeInr) || 0)),
        freeDeliveryMinInr: Math.max(0, Math.round(Number(formData.freeDeliveryMinInr) || 0)),
        minOrderAmountInr: Math.max(0, Math.round(Number(formData.minOrderAmountInr) || 0)),
        deliveryAreasEn: (formData.deliveryAreasEn || '').trim(),
        deliveryAreasHi: (formData.deliveryAreasHi || '').trim(),
        storeOpen: Boolean(formData.storeOpen),
        storeClosedMessageEn: (
          formData.storeClosedMessageEn ||
          formData.storeClosedMsgEn ||
          ''
        ).trim(),
        storeClosedMessageHi: (
          formData.storeClosedMessageHi ||
          formData.storeClosedMsgHi ||
          ''
        ).trim(),
        storeClosedMsgEn: (
          formData.storeClosedMessageEn ||
          formData.storeClosedMsgEn ||
          ''
        ).trim(),
        storeClosedMsgHi: (
          formData.storeClosedMessageHi ||
          formData.storeClosedMsgHi ||
          ''
        ).trim(),
        allowCod: Boolean(formData.allowCod),
        allowUpi: Boolean(formData.allowUpi),
        upiId: (formData.upiId || '').trim(),
        helpTitleEn: (formData.helpTitleEn || '').trim(),
        helpTitleHi: (formData.helpTitleHi || '').trim(),
        helpMessageEn: (formData.helpMessageEn || formData.helpContentEn || '').trim(),
        helpMessageHi: (formData.helpMessageHi || formData.helpContentHi || '').trim(),
        helpContentEn: (formData.helpMessageEn || formData.helpContentEn || '').trim(),
        helpContentHi: (formData.helpMessageHi || formData.helpContentHi || '').trim(),
        supportHoursEn: (formData.supportHoursEn || '').trim(),
        supportHoursHi: (formData.supportHoursHi || '').trim(),
        orderSuccessMsgEn: (
          formData.orderSuccessMsgEn ||
          formData.orderSuccessMessageEn ||
          ''
        ).trim(),
        orderSuccessMsgHi: (
          formData.orderSuccessMsgHi ||
          formData.orderSuccessMessageHi ||
          ''
        ).trim(),
        orderSuccessMessageEn: (
          formData.orderSuccessMsgEn ||
          formData.orderSuccessMessageEn ||
          ''
        ).trim(),
        orderSuccessMessageHi: (
          formData.orderSuccessMsgHi ||
          formData.orderSuccessMessageHi ||
          ''
        ).trim(),
        footerTextEn: (formData.footerTextEn || '').trim(),
        footerTextHi: (formData.footerTextHi || '').trim(),
        customWeightsCsv: (formData.customWeightsCsv || '').trim(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || auth.currentUser?.uid || 'admin',
      };

      const settingsRef = doc(db, 'settings', 'app_config');
      const existingSnap = await getDoc(settingsRef);
      if (existingSnap.exists()) {
        await updateDoc(settingsRef, cleanPayload);
      } else {
        await setDoc(settingsRef, {
          ...cleanPayload,
          createdAt: serverTimestamp(),
        });
      }
      setStatusMessage({
        type: 'success',
        text: isHindi
          ? 'सभी ऐप सेटिंग्स सफलतापूर्वक सेव हो गईं और सभी ग्राहकों के लिए लाइव हैं!'
          : 'All App Settings saved to Firestore and live across all customer devices!',
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, 'settings/app_config');
      } catch {
        // Handled below
      }
      setStatusMessage({
        type: 'error',
        text: isHindi
          ? 'सेटिंग्स सेव करने में त्रुटि आई। कृपया अपना एडमिन लॉगिन जांचें।'
          : 'Failed to save App Settings. Please verify your Admin permissions.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSaveSettings}
      className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
            <Settings className="w-3.5 h-3.5" />
            {isHindi ? 'संपूर्ण ऐप एडमिन कंट्रोल' : 'Full App Admin Control'}
          </span>
          <h3 className="font-serif text-xl font-bold text-stone-900 mt-1.5">
            {isHindi
              ? 'ऐप सेटिंग्स, ब्रांडिंग, डिलीवरी और टेक्स्ट नियंत्रण'
              : 'App Branding, Company Info, Delivery, Banners & Portal Texts'}
          </h3>
          <p className="text-xs text-stone-600 mt-0.5">
            {isHindi
              ? 'यहाँ किए गए सभी बदलाव तुरंत सभी ग्राहकों के मोबाइल और कंप्यूटर पर दिखाई देंगे।'
              : 'Every field below is controlled by Admin and synced live to all devices via Firestore.'}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer shrink-0"
        >
          <Save className="w-4 h-4" />
          {saving
            ? isHindi
              ? 'सेव हो रहा है...'
              : 'Saving Settings...'
            : isHindi
              ? 'सभी सेटिंग्स सेव करें'
              : 'Save All Settings'}
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs sm:text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 1. Store Status & Payment Methods */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
          <Store className="w-4 h-4 text-emerald-800" />
          {isHindi ? '1. स्टोर स्थिति और भुगतान विकल्प' : '1. Store Availability & Payment Options'}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-200 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-stone-900">
                {isHindi ? 'स्टोर खुला है (Accept Orders)' : 'Store Open (Accepting Orders)'}
              </p>
              <p className="text-[11px] text-stone-500">
                {formData.storeOpen
                  ? isHindi
                    ? 'ग्राहक ऑर्डर कर सकते हैं'
                    : 'Customers can place orders'
                  : isHindi
                    ? 'ऑर्डर अभी बंद हैं'
                    : 'Ordering is paused'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.storeOpen}
              onChange={(e) => handleChange('storeOpen', e.target.checked)}
              className="w-4 h-4 accent-emerald-800"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-200 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-stone-900">
                {isHindi ? 'कैश ऑन डिलीवरी (COD)' : 'Cash on Delivery (COD)'}
              </p>
              <p className="text-[11px] text-stone-500">
                {isHindi ? 'डिलीवरी पर नकद भुगतान' : 'Allow cash payment on delivery'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.allowCod}
              onChange={(e) => handleChange('allowCod', e.target.checked)}
              className="w-4 h-4 accent-emerald-800"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-200 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-stone-900">
                {isHindi ? 'UPI / ऑनलाइन पेमेंट' : 'UPI / Online Payment'}
              </p>
              <p className="text-[11px] text-stone-500">
                {isHindi ? 'UPI भुगतान विकल्प दिखाएं' : 'Allow UPI payment option'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.allowUpi}
              onChange={(e) => handleChange('allowUpi', e.target.checked)}
              className="w-4 h-4 accent-emerald-800"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'एडमिन UPI ID (वैकल्पिक)' : 'Merchant UPI ID (Optional)'}
            </label>
            <input
              type="text"
              value={formData.upiId}
              onChange={(e) => handleChange('upiId', e.target.value)}
              placeholder={isHindi ? 'उदा. chairoj@upi' : 'e.g. chairoj@upi'}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'स्टोर बंद होने का संदेश (English)' : 'Store Closed Message (English)'}
            </label>
            <input
              type="text"
              value={formData.storeClosedMessageEn}
              onChange={(e) => handleChange('storeClosedMessageEn', e.target.value)}
              placeholder="e.g. We are currently closed. Orders resume at 9 AM."
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'स्टोर बंद होने का संदेश (हिंदी)' : 'Store Closed Message (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.storeClosedMessageHi}
              onChange={(e) => handleChange('storeClosedMessageHi', e.target.value)}
              placeholder="उदा. अभी स्टोर बंद है। सुबह 9 बजे से ऑर्डर चालू होंगे।"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 2. App Name, Company Name, Logo & Theme Color */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
          <Palette className="w-4 h-4 text-emerald-800" />
          {isHindi ? '2. ऐप का नाम, कंपनी का नाम, लोगो और रंग' : '2. App Name, Company Name, Logo & Theme Colors'}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'कंपनी का नाम (Company Name)' : 'Company Name'}
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              placeholder="CHAI ROS"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'ऐप का नाम (English)' : 'App Name (English)'}
            </label>
            <input
              type="text"
              value={formData.appNameEn}
              onChange={(e) => handleChange('appNameEn', e.target.value)}
              placeholder="CHAI ROS"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'ऐप का नाम (हिंदी)' : 'App Name (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.appNameHi}
              onChange={(e) => handleChange('appNameHi', e.target.value)}
              placeholder="CHAI ROS"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'टैगलाइन / उपशीर्षक (English)' : 'Brand Tagline (English)'}
            </label>
            <input
              type="text"
              value={formData.taglineEn}
              onChange={(e) => handleChange('taglineEn', e.target.value)}
              placeholder="Enter tagline in English (optional)"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'टैगलाइन / उपशीर्षक (हिंदी)' : 'Brand Tagline (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.taglineHi}
              onChange={(e) => handleChange('taglineHi', e.target.value)}
              placeholder="हिंदी में टैगलाइन दर्ज करें (वैकल्पिक)"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pt-1">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'ऐप लोगो (Logo Upload / URL)' : 'App Logo (Upload or URL)'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formData.logoUrl}
                onChange={(e) => handleChange('logoUrl', e.target.value)}
                placeholder={isHindi ? 'लोगो URL या अपलोड करें' : 'Paste Logo URL or Upload'}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {isHindi ? 'अपलोड' : 'Upload'}
              </button>
              {formData.logoUrl && (
                <button
                  type="button"
                  onClick={() => handleChange('logoUrl', '')}
                  className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                  title="Remove Logo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'मुख्य थीम रंग (Primary Color)' : 'Primary Brand Color'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.primaryColor || '#14281D'}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="w-9 h-9 rounded-lg border border-stone-300 cursor-pointer"
              />
              <input
                type="text"
                value={formData.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                placeholder="#14281D"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'हाइलाइट रंग (Accent Color)' : 'Accent / Button Color'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.accentColor || '#B45309'}
                onChange={(e) => handleChange('accentColor', e.target.value)}
                className="w-9 h-9 rounded-lg border border-stone-300 cursor-pointer"
              />
              <input
                type="text"
                value={formData.accentColor}
                onChange={(e) => handleChange('accentColor', e.target.value)}
                placeholder="#B45309"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Company Contact Details & Address */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
          <Phone className="w-4 h-4 text-emerald-800" />
          {isHindi ? '3. कंपनी का पता, मोबाइल नंबर और संपर्क विवरण' : '3. Company Address, Mobile Number & Contact Info'}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'संपर्क मोबाइल नंबर' : 'Contact Mobile Number'}
            </label>
            <input
              type="text"
              value={formData.contactPhone}
              onChange={(e) => handleChange('contactPhone', e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi
                ? 'Admin WhatsApp Help नंबर (+91)'
                : 'Admin WhatsApp Help Number (+91)'}
            </label>
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-mono font-bold text-emerald-900">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={normalizeAdminWhatsappDigits(
                  formData.contactWhatsapp || formData.whatsappNumber
                )}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  handleChange('contactWhatsapp', digits);
                  handleChange('whatsappNumber', digits);
                  handleChange('contactPhone', digits ? `+91 ${digits}` : '');
                }}
                placeholder="7507505064"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono font-bold"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'संपर्क ईमेल (Email)' : 'Official Contact Email'}
            </label>
            <input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => handleChange('contactEmail', e.target.value)}
              placeholder="support@chairoj.com"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              {isHindi ? 'कंपनी का पता (English)' : 'Company Full Address (English)'}
            </label>
            <textarea
              rows={2}
              value={formData.companyAddressEn}
              onChange={(e) => handleChange('companyAddressEn', e.target.value)}
              placeholder="Enter company address in English"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              {isHindi ? 'कंपनी का पता (हिंदी)' : 'Company Full Address (Hindi)'}
            </label>
            <textarea
              rows={2}
              value={formData.companyAddressHi}
              onChange={(e) => handleChange('companyAddressHi', e.target.value)}
              placeholder="हिंदी में कंपनी का पता दर्ज करें"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 4. Delivery Charge, Min Order & Delivery Areas */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
          <Truck className="w-4 h-4 text-emerald-800" />
          {isHindi
            ? '4. डिलीवरी चार्ज, न्यूनतम ऑर्डर राशि और डिलीवरी क्षेत्र'
            : '4. Delivery Charge, Minimum Order Amount & Delivery Areas'}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'डिलीवरी चार्ज (₹)' : 'Delivery Charge (₹)'}
            </label>
            <input
              type="number"
              min={0}
              value={formData.deliveryChargeInr}
              onChange={(e) => handleChange('deliveryChargeInr', Number(e.target.value))}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            />
            <p className="text-[11px] text-stone-500 mt-0.5">
              {isHindi ? '0 रखने पर डिलीवरी निःशुल्क रहेगी' : 'Set 0 for free delivery on all orders'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'फ्री डिलीवरी न्यूनतम ऑर्डर (₹)' : 'Free Delivery Above (₹)'}
            </label>
            <input
              type="number"
              min={0}
              value={formData.freeDeliveryMinInr}
              onChange={(e) => handleChange('freeDeliveryMinInr', Number(e.target.value))}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            />
            <p className="text-[11px] text-stone-500 mt-0.5">
              {isHindi
                ? 'इस राशि से अधिक के ऑर्डर पर डिलीवरी चार्ज ₹0 होगा'
                : 'Orders at or above this amount get free delivery (0 = disabled)'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'न्यूनतम ऑर्डर राशि (₹)' : 'Minimum Order Amount (₹)'}
            </label>
            <input
              type="number"
              min={0}
              value={formData.minOrderAmountInr}
              onChange={(e) => handleChange('minOrderAmountInr', Number(e.target.value))}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            />
            <p className="text-[11px] text-stone-500 mt-0.5">
              {isHindi
                ? 'इससे कम राशि होने पर ऑर्डर सबमिट नहीं होगा'
                : 'Customer cart must reach this subtotal to place order'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'डिलीवरी क्षेत्र (English)' : 'Serviceable Delivery Areas (English)'}
            </label>
            <input
              type="text"
              value={formData.deliveryAreasEn}
              onChange={(e) => handleChange('deliveryAreasEn', e.target.value)}
              placeholder="e.g. All India Delivery / Local City Pin Codes"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'डिलीवरी क्षेत्र (हिंदी)' : 'Serviceable Delivery Areas (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.deliveryAreasHi}
              onChange={(e) => handleChange('deliveryAreasHi', e.target.value)}
              placeholder="उदा. पूरे भारत में होम डिलीवरी उपलब्ध"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 5. Home Page Banner, Announcements & Offers */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
          <Megaphone className="w-4 h-4 text-emerald-800" />
          {isHindi
            ? '5. होम पेज बैनर, सूचना (Announcement) और ऑफर'
            : '5. Home Page Banners, Announcements & Special Offers'}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'सूचना पट्टी / Announcement (English)' : 'Top Announcement Bar (English)'}
            </label>
            <input
              type="text"
              value={formData.announcementEn}
              onChange={(e) => handleChange('announcementEn', e.target.value)}
              placeholder="Leave blank to hide announcement bar"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'सूचना पट्टी / Announcement (हिंदी)' : 'Top Announcement Bar (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.announcementHi}
              onChange={(e) => handleChange('announcementHi', e.target.value)}
              placeholder="खाली छोड़ने पर सूचना पट्टी नहीं दिखेगी"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'स्पेशल ऑफर बैनर (English)' : 'Special Offer Strip (English)'}
            </label>
            <input
              type="text"
              value={formData.specialOfferBannerEn}
              onChange={(e) => handleChange('specialOfferBannerEn', e.target.value)}
              placeholder="e.g. Festive Offer: 10% OFF on 1kg Packs!"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'स्पेशल ऑफर बैनर (हिंदी)' : 'Special Offer Strip (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.specialOfferBannerHi}
              onChange={(e) => handleChange('specialOfferBannerHi', e.target.value)}
              placeholder="उदा. विशेष ऑफर: 1kg पैक पर विशेष छूट!"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'मुख्य बैनर शीर्षक (English)' : 'Hero Banner Title (English)'}
            </label>
            <input
              type="text"
              value={formData.bannerTitleEn}
              onChange={(e) => handleChange('bannerTitleEn', e.target.value)}
              placeholder="Leave blank if no hero banner needed"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'मुख्य बैनर शीर्षक (हिंदी)' : 'Hero Banner Title (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.bannerTitleHi}
              onChange={(e) => handleChange('bannerTitleHi', e.target.value)}
              placeholder="मुख्य बैनर शीर्षक (वैकल्पिक)"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'बैनर विवरण (English)' : 'Hero Banner Subtitle (English)'}
            </label>
            <input
              type="text"
              value={formData.bannerSubtitleEn}
              onChange={(e) => handleChange('bannerSubtitleEn', e.target.value)}
              placeholder="Optional subtitle"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'बैनर विवरण (हिंदी)' : 'Hero Banner Subtitle (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.bannerSubtitleHi}
              onChange={(e) => handleChange('bannerSubtitleHi', e.target.value)}
              placeholder="वैकल्पिक उपशीर्षक"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            {isHindi ? 'होम बैनर फोटो (Upload / URL)' : 'Hero Banner Image (Upload or URL)'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={formData.bannerImageUrl}
              onChange={(e) => handleChange('bannerImageUrl', e.target.value)}
              placeholder={isHindi ? 'बैनर फोटो URL या अपलोड करें' : 'Banner Image URL or Upload'}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {isHindi ? 'फोटो चुनें' : 'Upload Banner'}
            </button>
            {formData.bannerImageUrl && (
              <button
                type="button"
                onClick={() => handleChange('bannerImageUrl', '')}
                className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6. Customer Portal Texts, Headings & Buttons (Hindi & English) */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
          <Globe className="w-4 h-4 text-emerald-800" />
          {isHindi
            ? '6. कस्टमर पोर्टल के शीर्षक, बटन और हिंदी/English टेक्स्ट'
            : '6. Customer Portal Headings, Buttons & Hindi/English Texts'}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'कैटलॉग शीर्षक (English)' : 'Catalogue Heading (English)'}
            </label>
            <input
              type="text"
              value={formData.catalogHeadingEn}
              onChange={(e) => handleChange('catalogHeadingEn', e.target.value)}
              placeholder="Tea Product Catalogue"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'कैटलॉग शीर्षक (हिंदी)' : 'Catalogue Heading (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.catalogHeadingHi}
              onChange={(e) => handleChange('catalogHeadingHi', e.target.value)}
              placeholder="चाय प्रोडक्ट कैटलॉग"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'कैटलॉग उपशीर्षक (English)' : 'Catalogue Subheading (English)'}
            </label>
            <input
              type="text"
              value={formData.catalogSubheadingEn}
              onChange={(e) => handleChange('catalogSubheadingEn', e.target.value)}
              placeholder="Optional subheading below catalogue title"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'कैटलॉग उपशीर्षक (हिंदी)' : 'Catalogue Subheading (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.catalogSubheadingHi}
              onChange={(e) => handleChange('catalogSubheadingHi', e.target.value)}
              placeholder="कैटलॉग शीर्षक के नीचे का विवरण"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'Add to Cart बटन (English)' : 'Add to Cart Button (EN)'}
            </label>
            <input
              type="text"
              value={formData.addToCartBtnEn}
              onChange={(e) => handleChange('addToCartBtnEn', e.target.value)}
              placeholder="Add to Cart"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'Add to Cart बटन (हिंदी)' : 'Add to Cart Button (HI)'}
            </label>
            <input
              type="text"
              value={formData.addToCartBtnHi}
              onChange={(e) => handleChange('addToCartBtnHi', e.target.value)}
              placeholder="कार्ट में जोड़ें"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'Order बटन (English)' : 'Place Order Button (EN)'}
            </label>
            <input
              type="text"
              value={formData.orderBtnEn}
              onChange={(e) => handleChange('orderBtnEn', e.target.value)}
              placeholder="Confirm & Place Order"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'Order बटन (हिंदी)' : 'Place Order Button (HI)'}
            </label>
            <input
              type="text"
              value={formData.orderBtnHi}
              onChange={(e) => handleChange('orderBtnHi', e.target.value)}
              placeholder="ऑर्डर कन्फर्म करें"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 7. Custom Weight Quick-Select Options for Admin Product Form */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
          <Scale className="w-4 h-4 text-emerald-800" />
          {isHindi
            ? '7. एडमिन के लिए कस्टम वजन विकल्प (वैकल्पिक)'
            : '7. Custom Weight Quick-Buttons for Product Form (Optional)'}
        </div>
        <p className="text-xs text-stone-600">
          {isHindi
            ? 'प्रोडक्ट जोड़ते समय कोई भी वजन अपने आप चयनित नहीं होगा। यदि आप चाहें तो यहाँ अपने कस्टम वजन विकल्प (ग्राम में, कॉमा से अलग करके) लिख सकते हैं, जैसे: 50, 100, 250, 500, 1000'
            : 'No weight option is ever pre-selected automatically. Optionally define comma-separated gram values here to show quick-fill buttons in the Admin Product form (leave empty for manual entry only).'}
        </p>
        <input
          type="text"
          value={formData.customWeightsCsv}
          onChange={(e) => handleChange('customWeightsCsv', e.target.value)}
          placeholder={
            isHindi
              ? 'खाली छोड़ें या ग्राम में विकल्प लिखें (उदा. 100, 250, 500)'
              : 'Leave blank for manual weight entry, or enter comma-separated grams (e.g. 100, 250, 500)'
          }
          className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
        />
      </div>

      {/* 8. Help Page, Order Confirmation & Footer Messages */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
          <HelpCircle className="w-4 h-4 text-emerald-800" />
          {isHindi
            ? '8. Help पेज, ग्राहक सहायता समय और फुटर संदेश'
            : '8. Help Page, Support Hours & Customer Messages'}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'Help पेज शीर्षक (English)' : 'Help Modal Title (English)'}
            </label>
            <input
              type="text"
              value={formData.helpTitleEn}
              onChange={(e) => handleChange('helpTitleEn', e.target.value)}
              placeholder="Help & Customer Support"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'Help पेज शीर्षक (हिंदी)' : 'Help Modal Title (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.helpTitleHi}
              onChange={(e) => handleChange('helpTitleHi', e.target.value)}
              placeholder="सहायता और ग्राहक सेवा"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'ग्राहक सहायता संदेश / नियम (English)' : 'Help Page Content / Instructions (English)'}
            </label>
            <textarea
              rows={3}
              value={formData.helpMessageEn}
              onChange={(e) => handleChange('helpMessageEn', e.target.value)}
              placeholder="Write help instructions, return policy, or ordering guide for customers..."
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'ग्राहक सहायता संदेश / नियम (हिंदी)' : 'Help Page Content / Instructions (Hindi)'}
            </label>
            <textarea
              rows={3}
              value={formData.helpMessageHi}
              onChange={(e) => handleChange('helpMessageHi', e.target.value)}
              placeholder="ग्राहकों के लिए सहायता संदेश, ऑर्डर नियम या जानकारी यहाँ लिखें..."
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'सहायता समय (English)' : 'Support Timings (English)'}
            </label>
            <input
              type="text"
              value={formData.supportHoursEn}
              onChange={(e) => handleChange('supportHoursEn', e.target.value)}
              placeholder="e.g. Mon - Sat: 9:00 AM to 8:00 PM"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'सहायता समय (हिंदी)' : 'Support Timings (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.supportHoursHi}
              onChange={(e) => handleChange('supportHoursHi', e.target.value)}
              placeholder="उदा. सोमवार - शनिवार: सुबह 9:00 से रात 8:00 बजे तक"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'फुटर टेक्स्ट (English)' : 'Footer Copyright / Text (English)'}
            </label>
            <input
              type="text"
              value={formData.footerTextEn}
              onChange={(e) => handleChange('footerTextEn', e.target.value)}
              placeholder="Optional custom footer line"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {isHindi ? 'फुटर टेक्स्ट (हिंदी)' : 'Footer Copyright / Text (Hindi)'}
            </label>
            <input
              type="text"
              value={formData.footerTextHi}
              onChange={(e) => handleChange('footerTextHi', e.target.value)}
              placeholder="वैकल्पिक फुटर टेक्स्ट"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-900 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-bold shadow-sm transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving
            ? isHindi
              ? 'सेव हो रहा है...'
              : 'Saving Settings...'
            : isHindi
              ? 'सभी सेटिंग्स सेव करें'
              : 'Save All Settings'}
        </button>
      </div>
    </form>
  );
};
