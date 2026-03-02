import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LANG_KEY = "shootha_language";

export type Language = "ar" | "en" | "ku";

const T = {
  ar: {
    myAccount: "حسابي",
    settings: "الإعدادات",
    darkMode: "الوضع الداكن",
    language: "اللغة",
    city: "المدينة",
    notifications: "الإشعارات",
    editProfile: "تعديل الملف الشخصي",
    paymentMethods: "طرق الدفع",
    privacySecurity: "الخصوصية والأمان",
    helpSupport: "المساعدة والدعم",
    aboutApp: "عن التطبيق",
    deleteAccount: "حذف الحساب",
    session: "الجلسة",
    logout: "تسجيل الخروج",
    createAccount: "إنشاء حساب",
    accountSection: "الحساب",
    dangerZone: "منطقة الخطر",
    guestMode: "وضع الضيف",
    guestBannerSub: "اضغط لإنشاء حساب والاستمتاع بكل الميزات",
    mosul: "الموصل",
    arabic: "العربية",
    english: "English",
    kurdish: "کوردی",
    version: "الإصدار",
    footer: "Shoot'ha © 2026 – الموصل",
    player: "لاعب",
    owner: "صاحب ملعب",
    supervisor: "مشرف",
    games: "مباريات",
    upcoming: "قادمة",
    expenses: "مصاريف",
    noShow: "لا حضور",
    logoutConfirmTitle: "تسجيل الخروج",
    logoutConfirmMsg: "هل تريد تسجيل الخروج من حسابك؟",
    cancel: "تراجع",
    confirm: "تأكيد",
    on: "مفعّل",
    off: "مُعطّل",
    deleteConfirmTitle: "حذف الحساب",
    deleteConfirmMsg: "هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء",
    enterPassword: "أدخل كلمة المرور للتأكيد",
    passwordPlaceholder: "كلمة المرور",
    deleting: "جاري الحذف...",
    delete: "حذف الحساب",
    selectLanguage: "اختر اللغة",
    languageRestartNote: "قد يتطلب تغيير اللغة إعادة التشغيل للتأثير الكامل",
    save: "حفظ",
    saving: "جاري الحفظ...",
    editProfileTitle: "تعديل الملف الشخصي",
    fullName: "الاسم الكامل",
    dateOfBirth: "تاريخ الميلاد",
    profileImage: "صورة الملف الشخصي",
    changePhoto: "تغيير الصورة",
    phone: "رقم الهاتف",
    phoneLocked: "لتغيير الهاتف تواصل مع الدعم",
    savedSuccess: "تم الحفظ بنجاح",
    supportTitle: "المساعدة والدعم",
    whatsapp: "تواصل عبر واتساب",
    email: "راسلنا عبر الإيميل",
    contactForm: "نموذج التواصل",
    subject: "الموضوع",
    message: "الرسالة",
    subjectPlaceholder: "موضوع رسالتك",
    messagePlaceholder: "اكتب رسالتك هنا...",
    send: "إرسال",
    sending: "جاري الإرسال...",
    messageSent: "تم إرسال رسالتك، سنتواصل معك قريباً",
    fieldRequired: "هذا الحقل مطلوب",
    back: "رجوع",
  },
  en: {
    myAccount: "My Account",
    settings: "Settings",
    darkMode: "Dark Mode",
    language: "Language",
    city: "City",
    notifications: "Notifications",
    editProfile: "Edit Profile",
    paymentMethods: "Payment Methods",
    privacySecurity: "Privacy & Security",
    helpSupport: "Help & Support",
    aboutApp: "About",
    deleteAccount: "Delete Account",
    session: "Session",
    logout: "Log Out",
    createAccount: "Create Account",
    accountSection: "Account",
    dangerZone: "Danger Zone",
    guestMode: "Guest Mode",
    guestBannerSub: "Tap to create an account and enjoy all features",
    mosul: "Mosul",
    arabic: "العربية",
    english: "English",
    kurdish: "کوردی",
    version: "Version",
    footer: "Shoot'ha © 2026 – Mosul",
    player: "Player",
    owner: "Venue Owner",
    supervisor: "Supervisor",
    games: "Games",
    upcoming: "Upcoming",
    expenses: "Spent",
    noShow: "No-Show",
    logoutConfirmTitle: "Log Out",
    logoutConfirmMsg: "Are you sure you want to log out?",
    cancel: "Cancel",
    confirm: "Confirm",
    on: "On",
    off: "Off",
    deleteConfirmTitle: "Delete Account",
    deleteConfirmMsg: "Are you sure? This action cannot be undone",
    enterPassword: "Enter your password to confirm",
    passwordPlaceholder: "Password",
    deleting: "Deleting...",
    delete: "Delete Account",
    selectLanguage: "Select Language",
    languageRestartNote: "Language change may require restart for full effect",
    save: "Save",
    saving: "Saving...",
    editProfileTitle: "Edit Profile",
    fullName: "Full Name",
    dateOfBirth: "Date of Birth",
    profileImage: "Profile Image",
    changePhoto: "Change Photo",
    phone: "Phone Number",
    phoneLocked: "To change phone, contact support",
    savedSuccess: "Saved successfully",
    supportTitle: "Help & Support",
    whatsapp: "Contact via WhatsApp",
    email: "Email Us",
    contactForm: "Contact Form",
    subject: "Subject",
    message: "Message",
    subjectPlaceholder: "Subject of your message",
    messagePlaceholder: "Write your message here...",
    send: "Send",
    sending: "Sending...",
    messageSent: "Message sent! We'll get back to you soon",
    fieldRequired: "This field is required",
    back: "Back",
  },
  ku: {
    myAccount: "ئەکاونتەکەم",
    settings: "ڕێکخستنەکان",
    darkMode: "دۆخی تاریک",
    language: "زمان",
    city: "شار",
    notifications: "ئاگادارکردنەوەکان",
    editProfile: "دەستکاریکردنی پڕۆفایل",
    paymentMethods: "شێوازەکانی پارەدان",
    privacySecurity: "تایبەتمەندی و ئەمنیەت",
    helpSupport: "یارمەتی و پشتیوانی",
    aboutApp: "دەربارەی",
    deleteAccount: "سڕینەوەی ئەکاونت",
    session: "دانیشتن",
    logout: "دەرچوون",
    createAccount: "دروستکردنی ئەکاونت",
    accountSection: "ئەکاونت",
    dangerZone: "ناوچەی مەترسی",
    guestMode: "دۆخی میوان",
    guestBannerSub: "بزمژێ بۆ دروستکردنی ئەکاونت",
    mosul: "مووسڵ",
    arabic: "العربية",
    english: "English",
    kurdish: "کوردی",
    version: "وەشان",
    footer: "Shoot'ha © 2026 – مووسڵ",
    player: "یاریزان",
    owner: "خاوەنی زەوی",
    supervisor: "چاودێر",
    games: "یاریەکان",
    upcoming: "داهاتوو",
    expenses: "خەرجی",
    noShow: "نەهاتن",
    logoutConfirmTitle: "دەرچوون",
    logoutConfirmMsg: "دڵنیایت دەتەوێت دەربچیت؟",
    cancel: "هەڵوەشاندنەوە",
    confirm: "پشتڕاستکردنەوە",
    on: "چالاک",
    off: "ناچالاک",
    deleteConfirmTitle: "سڕینەوەی ئەکاونت",
    deleteConfirmMsg: "دڵنیایت؟ ئەم کارە ناگەڕێتەوە",
    enterPassword: "وشەی نهێنیت بنووسە بۆ پشتڕاستکردنەوە",
    passwordPlaceholder: "وشەی نهێنی",
    deleting: "دەسڕێتەوە...",
    delete: "سڕینەوەی ئەکاونت",
    selectLanguage: "زمان هەڵبژێرە",
    languageRestartNote: "گۆڕینی زمان دەبێت ریستارت بکرێت بۆ کاریگەری تەواو",
    save: "پاشەکەوت",
    saving: "پاشەکەوت دەکرێت...",
    editProfileTitle: "دەستکاریکردنی پڕۆفایل",
    fullName: "ناوی تەواو",
    dateOfBirth: "بەرواری لەدایکبوون",
    profileImage: "وێنەی پڕۆفایل",
    changePhoto: "گۆڕینی وێنە",
    phone: "ژمارەی مۆبایل",
    phoneLocked: "بۆ گۆڕینی مۆبایل، پەیوەندی بە پشتیوانی بکە",
    savedSuccess: "بەسەرکەوتوویی پاشەکەوتکرا",
    supportTitle: "یارمەتی و پشتیوانی",
    whatsapp: "پەیوەندی لە ڕێی واتساپ",
    email: "ئیمەیڵ بنێرە",
    contactForm: "فۆرمی پەیوەندی",
    subject: "بابەت",
    message: "نامە",
    subjectPlaceholder: "بابەتی نامەکەت",
    messagePlaceholder: "نامەکەت لێرە بنووسە...",
    send: "ناردن",
    sending: "دەنێردرێت...",
    messageSent: "نامەکەت نێردرا! زوو پەیوەندیت پێ دەکەین",
    fieldRequired: "ئەم خانەیە پێویستە",
    back: "گەڕانەوە",
  },
} as const;

export type TranslationKeys = keyof typeof T.ar;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: TranslationKeys) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((value) => {
      if (value === "ar" || value === "en" || value === "ku") {
        setLanguageState(value);
      }
    });
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(LANG_KEY, lang);
  };

  const t = (key: TranslationKeys): string => {
    return (T[language] as any)[key] ?? (T.ar as any)[key] ?? key;
  };

  const isRTL = language !== "en";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
