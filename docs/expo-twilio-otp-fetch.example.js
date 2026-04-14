/**
 * Expo: replace YOUR_LOCAL_IP with your machine LAN IP (same Wi‑Fi as the device/emulator).
 * JSON body for both requests.
 */

// POST http://YOUR_LOCAL_IP:4000/send-otp
fetch("http://YOUR_LOCAL_IP:4000/send-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "+9647XXXXXXXX" }),
});

// POST http://YOUR_LOCAL_IP:4000/verify-otp
fetch("http://YOUR_LOCAL_IP:4000/verify-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "+9647XXXXXXXX", code: "123456" }),
});
