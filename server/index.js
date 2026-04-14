require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const API_KEY = process.env.OTP_IQ_API_KEY;
if (!API_KEY || !String(API_KEY).trim()) {
  console.error(
    "FATAL: OTP_IQ_API_KEY is missing. Set it in .env and restart the server."
  );
  process.exit(1);
}

const PORT = process.env.PORT || 4000;

/** @type {Record<string, { code: string; expires: number }>} */
const otpStore = {};

/** @type {Record<string, number[]>} أوقات إرسال OTP لكل رقم — نافذة 5 دقائق */
const sendTimestampsByPhone = {};

/** @type {Record<string, { failures: number; blockedUntil?: number }>} */
const verifySecurityByPhone = {};

const OTP_IQ_SMS_URL = "https://api.otpiq.com/api/sms";

const SEND_WINDOW_MS = 5 * 60 * 1000;
const MAX_SENDS_PER_PHONE = 3;
const OTP_TTL_MS = 60 * 1000;
const MAX_WRONG_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 10 * 60 * 1000;

/** العراق: +964 ثم 10 أرقام (نفس isValidIqMobileE164 في التطبيق) */
const IQ_E164_PHONE = /^\+964\d{10}$/;
const OTP_4 = /^\d{4}$/;

function normalizePhone(phone) {
  return String(phone).trim();
}

function maskPhoneLog(p) {
  const s = String(p);
  if (s.length < 8) return "***";
  return `${s.slice(0, 4)}…${s.slice(-2)}`;
}

function logEvent(event, payload) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...payload,
    })
  );
}

function isVerifyBlocked(p) {
  const sec = verifySecurityByPhone[p];
  if (!sec?.blockedUntil) return false;
  if (Date.now() < sec.blockedUntil) return true;
  sec.blockedUntil = undefined;
  sec.failures = 0;
  return false;
}

function recordVerifyFailure(p, reason) {
  const sec = verifySecurityByPhone[p] || { failures: 0 };
  sec.failures = (sec.failures || 0) + 1;
  verifySecurityByPhone[p] = sec;
  logEvent("verify_failure", {
    phone: maskPhoneLog(p),
    reason,
    failures: sec.failures,
  });
  if (sec.failures >= MAX_WRONG_ATTEMPTS) {
    sec.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    sec.failures = 0;
    logEvent("phone_blocked", {
      phone: maskPhoneLog(p),
      minutes: BLOCK_DURATION_MS / 60000,
    });
  }
}

function clearVerifySecurity(p) {
  delete verifySecurityByPhone[p];
}

function canSendForPhone(p) {
  const now = Date.now();
  const arr = (sendTimestampsByPhone[p] || []).filter(
    (t) => now - t < SEND_WINDOW_MS
  );
  sendTimestampsByPhone[p] = arr;
  return arr.length < MAX_SENDS_PER_PHONE;
}

function recordSendForPhone(p) {
  const now = Date.now();
  const arr = sendTimestampsByPhone[p] || [];
  arr.push(now);
  sendTimestampsByPhone[p] = arr.filter((t) => now - t < SEND_WINDOW_MS);
}

/**
 * @param {number} windowMs
 * @param {number} max
 */
function createRateLimiter(windowMs, max) {
  /** @type {Map<string, number[]>} */
  const buckets = new Map();
  return function rateLimit(req, res, next) {
    const raw =
      (req.headers["x-forwarded-for"] &&
        String(req.headers["x-forwarded-for"]).split(",")[0].trim()) ||
      req.socket.remoteAddress ||
      "unknown";
    const ip = raw;
    const now = Date.now();
    let arr = buckets.get(ip) || [];
    arr = arr.filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      console.error(`Rate limit exceeded: ip=${ip}`);
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please wait and try again.",
      });
    }
    arr.push(now);
    buckets.set(ip, arr);
    next();
  };
}

const sendOtpRateLimit = createRateLimiter(60 * 1000, 5);
const verifyOtpRateLimit = createRateLimiter(60 * 1000, 30);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.post("/send-otp", sendOtpRateLimit, async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (phone == null || phone === "") {
      return res.status(400).json({
        success: false,
        error: "Phone is required",
      });
    }
    const p = normalizePhone(phone);
    if (!IQ_E164_PHONE.test(p)) {
      logEvent("send_rejected", { phone: maskPhoneLog(p), reason: "invalid_format" });
      return res.status(400).json({
        success: false,
        error: "Invalid phone. Use Iraqi E.164 format: +9647XXXXXXXXX (10 digits after +964)",
      });
    }

    if (isVerifyBlocked(p)) {
      logEvent("send_rejected", { phone: maskPhoneLog(p), reason: "phone_blocked" });
      return res.status(429).json({
        success: false,
        error: "Too many failed attempts. Try again in 10 minutes.",
      });
    }

    if (!canSendForPhone(p)) {
      logEvent("send_rejected", { phone: maskPhoneLog(p), reason: "phone_rate_limit" });
      return res.status(429).json({
        success: false,
        error: "Too many code requests. Wait 5 minutes before trying again.",
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);
    otpStore[p] = {
      code: String(otp),
      expires: Date.now() + OTP_TTL_MS,
    };

    try {
      const response = await axios.post(
        OTP_IQ_SMS_URL,
        {
          phoneNumber: p,
          smsType: "verification",
          provider: "sms",
          verificationCode: otp.toString(),
        },
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
          validateStatus: () => true,
        }
      );
      const ok = response.status >= 200 && response.status < 300;
      if (!ok) {
        delete otpStore[p];
        console.error(
          "OTP IQ API error:",
          response.status,
          response.data
        );
        logEvent("sms_provider_error", {
          phone: maskPhoneLog(p),
          status: response.status,
        });
        return res.status(502).json({
          success: false,
          error:
            (response.data &&
              typeof response.data.error === "string" &&
              response.data.error) ||
            "Failed to send SMS. Please try again later.",
        });
      }
    } catch (smsErr) {
      delete otpStore[p];
      console.error("SMS send failed:", smsErr.message || smsErr);
      if (smsErr.response) {
        console.error("OTP IQ response:", smsErr.response.status, smsErr.response.data);
      }
      logEvent("sms_send_exception", { phone: maskPhoneLog(p) });
      return res.status(502).json({
        success: false,
        error: "Failed to send SMS. Please try again later.",
      });
    }

    recordSendForPhone(p);
    logEvent("otp_sent", { phone: maskPhoneLog(p) });

    return res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    console.error("send-otp error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
});

app.post("/verify-otp", verifyOtpRateLimit, async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (phone == null || phone === "") {
      return res.status(400).json({
        success: false,
        error: "Phone is required",
      });
    }
    const p = normalizePhone(phone);
    if (!IQ_E164_PHONE.test(p)) {
      logEvent("verify_rejected", { phone: maskPhoneLog(p), reason: "invalid_format" });
      return res.status(400).json({
        success: false,
        error: "Invalid phone. Use Iraqi E.164 format: +9647XXXXXXXXX (10 digits after +964)",
      });
    }

    if (isVerifyBlocked(p)) {
      logEvent("verify_rejected", { phone: maskPhoneLog(p), reason: "phone_blocked" });
      return res.status(429).json({
        success: false,
        error: "Too many failed attempts. Try again in 10 minutes.",
      });
    }

    if (code == null || code === "") {
      return res.status(400).json({
        success: false,
        error: "Code is required",
      });
    }
    const c = String(code).trim();
    if (!OTP_4.test(c)) {
      return res.status(400).json({
        success: false,
        error: "Invalid code. Expected 4 digits",
      });
    }

    const row = otpStore[p];
    if (!row) {
      logEvent("verify_failure", {
        phone: maskPhoneLog(p),
        reason: "no_otp",
      });
      return res.status(400).json({
        success: false,
        error: "No OTP found for this number. Request a new code.",
      });
    }

    if (Date.now() > row.expires) {
      delete otpStore[p];
      logEvent("verify_failure", {
        phone: maskPhoneLog(p),
        reason: "expired",
      });
      return res.status(400).json({
        success: false,
        error: "OTP has expired. Request a new code.",
      });
    }

    if (row.code !== c) {
      recordVerifyFailure(p, "wrong_code");
      return res.status(400).json({
        success: false,
        error: "Wrong verification code",
      });
    }

    delete otpStore[p];
    clearVerifySecurity(p);
    logEvent("verify_success", { phone: maskPhoneLog(p) });

    return res.json({ success: true, message: "Verified" });
  } catch (err) {
    console.error("verify-otp error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Verification failed",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OTP server listening on http://0.0.0.0:${PORT}`);
});
