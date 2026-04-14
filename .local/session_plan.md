# Objective
Build a fully separate Venue Owner interface — 4-tab bottom nav (Home, Bookings, Stats, Settings) accessed at `/owner`, disconnected from the player tabs. Owners are redirected to `/owner` post-login, players continue to `/(tabs)`. All owner bookings live on the server (in-memory) so both sides stay in sync.

# Tasks

### T001: Backend — Owner Booking Storage & Endpoints
- **Blocked By**: []
- **Details**:
  - Extend `server/storage.ts` with in-memory `ownerBookings` store and CRUD methods
  - Add to `server/routes.ts`:
    - `GET /api/owner/bookings?filter=today|month|year` — fetch owner bookings
    - `POST /api/owner/bookings` — create manual booking (owner only)
    - `PATCH /api/owner/bookings/:id` — update status / edit booking
    - `DELETE /api/owner/bookings/:id` — cancel booking (sets cancelled)
    - `GET /api/owner/stats` — revenue, count, occupancy, peak hours
    - `PATCH /api/owner/venue` — update venue info (venueName, areaName, fieldSize, bookingPrice, hasBathrooms, hasMarket)
  - Validate ownership on every request (booking.ownerId === req.userId)
  - Files: `server/storage.ts`, `server/routes.ts`
  - Acceptance: curl tests return correct data

### T002: Routing Separation
- **Blocked By**: []
- **Details**:
  - `app/_layout.tsx` — change AppNavigator to redirect owners to `/owner`, players/guests to `/(tabs)`
  - `app/auth/owner/verify-otp.tsx` — change `router.replace("/(tabs)")` to `router.replace("/owner")`
  - Create `app/owner/_layout.tsx` — Stack wrapper for owner section (protects against non-owner access)
  - Create `app/owner/(tabs)/_layout.tsx` — 4-tab navigator using ClassicTabLayout with useTheme + useLang
  - Files: `app/_layout.tsx`, `app/auth/owner/verify-otp.tsx`, `app/owner/_layout.tsx`, `app/owner/(tabs)/_layout.tsx`
  - Acceptance: Owner login redirects to /owner, player login goes to /(tabs)

### T003: Owner Home Screen
- **Blocked By**: [T001, T002]
- **Details**:
  - Ad banner (same style as player home, 3 rotating ads)
  - Active booking card: shows currently running booking with countdown timer, player name, field size
  - Today at a glance: count of today's bookings + revenue
  - Recent notifications: last 3 booking events (new/cancelled)
  - Quick alerts: empty time slots, upcoming bookings
  - File: `app/owner/(tabs)/index.tsx`
  - Acceptance: shows live data from /api/owner/bookings

### T004: Owner Bookings Management
- **Blocked By**: [T001, T002]
- **Details**:
  - 3 tabs inside screen: اليوم / هذا الشهر / هذه السنة
  - "اليوم" view: scrollable time-slot grid 08:00-23:00
    - Green slot = booked (app booking), Yellow = manual booking, Grey = empty
    - Tap slot to see booking details or add manual booking
  - "هذا الشهر" and "هذه السنة" views: card list of bookings
  - FAB "+" button opens AddBookingModal:
    - Player name, date, time, duration picker, price
    - POST /api/owner/bookings on save
  - Each booking card: cancel (DELETE) or edit status (PATCH)
  - File: `app/owner/(tabs)/bookings.tsx`

### T005: Owner Statistics
- **Blocked By**: [T001, T002]
- **Details**:
  - Summary cards (2x2 grid):
    - عدد الحجوزات عبر التطبيق (app bookings count)
    - مجموع الدخل الكلي (total revenue)
    - حجوزات اليوم (today's bookings)
    - نسبة الإشغال (occupancy rate %)
  - Bar chart (manual View-based, no library) for bookings per day (last 7 days)
  - Peak hours visualization (simple bar chart)
  - File: `app/owner/(tabs)/stats.tsx`

### T006: Owner Settings
- **Blocked By**: [T002]
- **Details**:
  - Venue Info card: edit venueName, areaName, fieldSize, bookingPrice, hasBathrooms, hasMarket
    - Save via PATCH /api/owner/venue
  - Appearance: dark/light mode toggle (shared ThemeContext)
  - Support: WhatsApp link + email + contact form (same as player support)
  - About: version number
  - Delete Account: check if upcoming bookings exist → warn → require password confirmation
  - Logout: clear token, redirect to /select-role
  - File: `app/owner/(tabs)/settings.tsx`
