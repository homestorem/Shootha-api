import React from "react";

/** حاوية reCAPTCHA فقط — لا يُنشَأ RecaptchaVerifier هنا (يُستدعى عند الضغط على إرسال OTP) */
export default function RecaptchaWebMount() {
  return (
    <div
      id="recaptcha-container"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden
    />
  );
}
