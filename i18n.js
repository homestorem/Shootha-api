import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "@/locales/ar.json";
import en from "@/locales/en.json";
import ku from "@/locales/ku.json";

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
      ku: { translation: ku },
    },
    lng: "ar",
    fallbackLng: "ar",
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
  });
}

export default i18next;
