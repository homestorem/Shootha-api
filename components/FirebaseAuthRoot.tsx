import React from "react";

type Props = { children: React.ReactNode };

/** كان يضم reCAPTCHA لـ Firebase Phone Auth؛ المصادقة الآن عبر خادم OTP. */
export default function FirebaseAuthRoot({ children }: Props) {
  return <>{children}</>;
}
