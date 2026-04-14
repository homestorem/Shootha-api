# حل مشاكل شائعة

## 0) الهاتف لا يتصل بـ Metro / لا يفتح المشروع

- **نفس الشبكة (واي فاي):** على الكمبيوتر شغّل:
  ```bash
  npm run start:lan
  ```
  ثم امسح QR من تطبيق Expo Go — لا تستخدم `localhost` من الهاتف.
- **جدار نار / شبكة معقّدة:** جرّب نفقاً:
  ```bash
  npm run start:tunnel
  ```
  (أبطأ قليلاً لكنه يعمل عبر الإنترنت.)
- **مسح كاش:** `npx expo start -c`

## 1) Expo: `out of memory` أو تعطل عند فتح Web

- جرّب **بدون ويب**: `npx expo start` ثم اضغط **a** (أندرويد) أو امسح QR — لا تفتح **w**.
- أو زيادة الذاكرة:
  ```bash
  npm run start:mem
  ```
  (PowerShell بديل: `$env:NODE_OPTIONS="--max-old-space-size=8192"; npx expo start`)

## 2) OTP / تسجيل الدخول لا يعمل

- لازم **سيرفر Express شغّال**: `npm run server:dev` (على Windows إذا فشل، شغّل: `npx tsx server/index.ts`).
- في `.env` للتطبيق:
  - **`EXPO_PUBLIC_API_URL=http://IP_جهازك:5000`**  
    مثال: الهاتف على نفس الواي فاي → IP الكمبيوتر مثل `192.168.1.10` وليس `localhost`.
- إذا كان العنوان `https://` على جهاز محلي، الطلبات تفشل — استخدم `EXPO_PUBLIC_API_URL` مع **http**.

## 3) واتساب OTP لا يصل

- بدون **قالب معتمد** في Meta، الرسائل النصية لأرقام جديدة غالباً تُرفض.
- إذا واتساب فشل: في وضع **غير الإنتاج** السيرفر يعيد **`devOtp`** تلقائياً حتى تكمل التسجيل.
- للإنتاج: عيّن قالب `WHATSAPP_OTP_TEMPLATE_NAME` (انظر `docs/whatsapp-otp.md`).
- لإجبار فشل واتساب بدون رمز في الاستجابة: `WHATSAPP_FALLBACK_TO_DEV_OTP=0` و `NODE_ENV=production`.
