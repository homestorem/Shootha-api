import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { router, type Href } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";
import { GuestModal } from "@/components/GuestModal";

type GuestPromptContextValue = {
  /** ضيف بلا صلاحيات كاملة — يُطلب منه تسجيل الدخول للإجراءات */
  guestRestricted: boolean;
  /** يفتح نافذة تسجيل الدخول */
  promptLogin: () => void;
  /** ينفّذ الإجراء فقط إذا كان المستخدم مسجّلاً، وإلا يعرض النافذة */
  runIfLoggedIn: (fn: () => void) => void;
  /** يمرّ للمسار فقط إذا كان مسجّلاً */
  pushIfLoggedIn: (href: Href) => void;
};

const GuestPromptContext = createContext<GuestPromptContextValue | null>(null);

export function GuestPromptProvider({ children }: { children: ReactNode }) {
  const { isGuest } = useAuth();
  const [visible, setVisible] = useState(false);

  const guestRestricted = isGuest && !GUEST_FULL_ACCESS;

  const promptLogin = useCallback(() => {
    setVisible(true);
  }, []);

  const runIfLoggedIn = useCallback(
    (fn: () => void) => {
      if (guestRestricted) {
        setVisible(true);
        return;
      }
      fn();
    },
    [guestRestricted],
  );

  const pushIfLoggedIn = useCallback(
    (href: Href) => {
      runIfLoggedIn(() => router.push(href));
    },
    [runIfLoggedIn],
  );

  const value = useMemo(
    () => ({
      guestRestricted,
      promptLogin,
      runIfLoggedIn,
      pushIfLoggedIn,
    }),
    [guestRestricted, promptLogin, runIfLoggedIn, pushIfLoggedIn],
  );

  return (
    <GuestPromptContext.Provider value={value}>
      {children}
      <GuestModal visible={visible} onClose={() => setVisible(false)} />
    </GuestPromptContext.Provider>
  );
}

export function useGuestPrompt(): GuestPromptContextValue {
  const ctx = useContext(GuestPromptContext);
  if (!ctx) {
    throw new Error("useGuestPrompt must be used within GuestPromptProvider");
  }
  return ctx;
}
