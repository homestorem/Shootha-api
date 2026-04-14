const OTP_TTL_MS = 5 * 60 * 1000;

/** @type {Record<string, { code: string; expiresAt: number }>} */
const store = {};

function normalizePhone(phone) {
  return String(phone).trim();
}

/**
 * @param {string} phone
 * @param {string} code
 */
function saveOTP(phone, code) {
  const key = normalizePhone(phone);
  store[key] = {
    code: String(code),
    expiresAt: Date.now() + OTP_TTL_MS,
  };
}

/**
 * @param {string} phone
 * @param {string} code
 * @returns {boolean}
 */
function verifyOTP(phone, code) {
  const key = normalizePhone(phone);
  const entry = store[key];
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    delete store[key];
    return false;
  }
  if (entry.code !== String(code)) return false;
  delete store[key];
  return true;
}

module.exports = { saveOTP, verifyOTP };
