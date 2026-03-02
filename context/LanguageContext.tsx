import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LANG_KEY = "shootha_language";

export type Language = "ar" | "en";

const T = {
  ar: {
    homeTab: "الرئيسية",
    searchTab: "استكشاف",
    storeTab: "المتجر",
    bookingsTab: "حجوزاتي",
    profileTab: "حسابي",
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
    save: "حفظ",
    saving: "جاري الحفظ...",
    editProfileTitle: "تعديل الملف الشخصي",
    fullName: "الاسم الكامل",
    dateOfBirth: "تاريخ الميلاد",
    profileImage: "صورة الملف الشخصي",
    changePhoto: "تغيير الصورة",
    phone: "رقم الهاتف",
    phoneLocked: "لتغيير الهاتف تواصل مع الدعم",
    sendOtp: "إرسال رمز التحقق",
    sendingOtp: "جاري الإرسال...",
    verifyPhone: "التحقق من الرقم",
    otpPlaceholder: "أدخل الرمز المكون من 6 أرقام",
    verifyOtp: "تحقق وحدّث",
    verifying: "جاري التحقق...",
    phoneUpdated: "تم تحديث رقم الهاتف",
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
    bookNow: "احجز الآن",
    venues: "الملاعب",
    upcomingBookings: "القادمة",
    completedBookings: "المكتملة",
    cancelledBookings: "الملغاة",
    cancelBookingTitle: "إلغاء الحجز",
    cancelBookingMsg: "هل تريد إلغاء هذا الحجز؟",
    comingSoon: "قريباً...",
    storeDesc: "سيتم إطلاق متجر المنتجات الرياضية قريباً داخل تطبيق Shoot'ha",
    searchPlaceholder: "ابحث عن ملعب...",
    sortByRating: "الأعلى تقييمًا",
    sortLow: "الأقل سعرًا",
    sortHigh: "الأعلى سعرًا",
    available: "متاح الآن",
    allFilter: "الكل",
    noBookings: "لا توجد حجوزات",
    noBookingsDesc: "سيظهر هنا سجل حجوزاتك",
    forgotPassword: "نسيت كلمة المرور؟",
    resetPassword: "إعادة تعيين كلمة المرور",
    newPasswordPlaceholder: "كلمة مرور جديدة",
    confirmPasswordPlaceholder: "تأكيد كلمة المرور",
    passwordsDoNotMatch: "كلمتا المرور غير متطابقتين",
    passwordTooShort: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
    passwordChanged: "تم تغيير كلمة المرور بنجاح",
    payment: "الدفع",
    aboutAppText: "تطبيق Shoot'ha هو منصة ذكية لحجز الملاعب الرياضية بسهولة وسرعة.\nيتيح التطبيق للاعبين البحث عن أقرب الملاعب، معرفة الأوقات المتاحة، والحجز مباشرة بدون اتصالات أو انتظار.\n\nكما يساعد أصحاب الملاعب على إدارة الحجوزات وتنظيم الأوقات ومعرفة الدخل والإشغال بشكل واضح ومنظم، ليجعل عملية الحجز أسهل للجميع ويوفر الوقت والجهد.\n\nهدفنا هو تبسيط تجربة حجز الملاعب وربط اللاعبين بالملاعب القريبة منهم بضغطة واحدة.",
  },
  en: {
    homeTab: "Home",
    searchTab: "Explore",
    storeTab: "Store",
    bookingsTab: "Bookings",
    profileTab: "Account",
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
    save: "Save",
    saving: "Saving...",
    editProfileTitle: "Edit Profile",
    fullName: "Full Name",
    dateOfBirth: "Date of Birth",
    profileImage: "Profile Image",
    changePhoto: "Change Photo",
    phone: "Phone Number",
    phoneLocked: "To change phone, contact support",
    sendOtp: "Send OTP",
    sendingOtp: "Sending...",
    verifyPhone: "Verify Number",
    otpPlaceholder: "Enter 6-digit code",
    verifyOtp: "Verify & Update",
    verifying: "Verifying...",
    phoneUpdated: "Phone number updated",
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
    bookNow: "Book Now",
    venues: "Venues",
    upcomingBookings: "Upcoming",
    completedBookings: "Completed",
    cancelledBookings: "Cancelled",
    cancelBookingTitle: "Cancel Booking",
    cancelBookingMsg: "Do you want to cancel this booking?",
    comingSoon: "Coming Soon...",
    storeDesc: "The sports products store is coming soon inside Shoot'ha",
    searchPlaceholder: "Search for a venue...",
    sortByRating: "Highest Rated",
    sortLow: "Lowest Price",
    sortHigh: "Highest Price",
    available: "Available Now",
    allFilter: "All",
    noBookings: "No Bookings",
    noBookingsDesc: "Your booking history will appear here",
    forgotPassword: "Forgot Password?",
    resetPassword: "Reset Password",
    newPasswordPlaceholder: "New Password",
    confirmPasswordPlaceholder: "Confirm Password",
    passwordsDoNotMatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 6 characters",
    passwordChanged: "Password changed successfully",
    payment: "Payment",
    aboutAppText: "Shoot'ha is a smart platform for booking sports fields quickly and easily.\nIt lets players find nearby venues, check availability, and book directly—no calls, no waiting.\n\nIt also helps venue owners manage bookings, organize schedules, and track revenue clearly.\n\nOur goal is to simplify the field booking experience and connect players with nearby venues in one tap.",
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
      if (value === "ar" || value === "en") {
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

  const isRTL = language === "ar";

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
