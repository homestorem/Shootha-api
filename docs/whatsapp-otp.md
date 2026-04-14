# OTP عبر واتساب (Meta WhatsApp Cloud API)

## أمان التوكن

- **لا تنشر التوكن في الدردشة أو GitHub.** إن تسرب، أعد إنشاءه من [Meta for Developers](https://developers.facebook.com/) → تطبيقك → واتساب → API Setup.
- ضع القيم في **بيئة السيرفر فقط** (ملف `.env` على الجهاز أو secrets في الاستضافة).

## متغيرات البيئة (السيرفر)

| المتغير | مطلوب | الوصف |
|---------|--------|--------|
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | نعم | توكن الوصول الطويل (يبدأ غالباً بـ `EAAS...`) |
| `WHATSAPP_PHONE_NUMBER_ID` | نعم | من لوحة API Setup — **Phone number ID** (أرقام فقط) |
| `WHATSAPP_API_VERSION` | لا | افتراضي `v21.0` |
| `WHATSAPP_OTP_TEMPLATE_NAME` | يُنصح به | اسم قالب معتمد في Meta (مثلاً `otp_shootha`) |
| `WHATSAPP_OTP_TEMPLATE_LANG` | لا | مثل `ar` أو `en` |
| `WHATSAPP_DEV_RETURN_OTP` | لا | ضع `1` لإرجاع الرمز في الـ API حتى في الإنتاج (للتجربة فقط) |

## قالب واتساب (مهم)

للمستخدمين الذين لم يراسلوا رقمك مسبقاً، **الرسالة النصية العادية غالباً تُرفض**. أنشئ في Meta قالباً (مثلاً فئة **Authentication** أو **Utility**) يحتوي متغيراً واحداً في النص = الرمز، ثم ضع اسمه في `WHATSAPP_OTP_TEMPLATE_NAME`.

مثال نص القالب: `رمز التحقق Shoot'ha: {{1}}`

## تشغيل السيرفر

```bash
# مثال (مع المتغيرات في .env نفس مجلد المشروع أو تصديرها يدوياً)
npm run server:dev
```

التطبيق يستدعي `/api/auth/send-otp` على `EXPO_PUBLIC_DOMAIN` — يجب أن يعمل السيرفر مع نفس الـ `.env`.
