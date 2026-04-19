/**
 * لقطة مستخدم عند استرداد قسيمة — تُكتب في walletTransactions وحقول usedBy* على vouchers.
 */
export type VoucherRedeemerProfile = {
  userId: string;
  phone?: string | null;
  name?: string | null;
  email?: string | null;
  playerId?: string | null;
  role?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  position?: string | null;
  profileImage?: string | null;
  inviteCode?: string | null;
  venueName?: string | null;
  areaName?: string | null;
  deviceId?: string | null;
  expoPushToken?: string | null;
};

function str(v: unknown, max: number): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/** دمج بيانات السيرفر (Mem) مع مستند users في Firestore */
export function mergeRedeemerProfiles(
  userId: string,
  mem: {
    phone?: string | null;
    name?: string | null;
    role?: string | null;
    dateOfBirth?: string | null;
    profileImage?: string | null;
    gender?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    venueName?: string | null;
    areaName?: string | null;
    deviceId?: string | null;
    expoPublicToken?: string | null;
  } | null | undefined,
  fs: VoucherRedeemerProfile,
): VoucherRedeemerProfile {
  const latM = num(mem?.latitude);
  const lonM = num(mem?.longitude);
  return {
    userId,
    phone: str(mem?.phone ?? fs.phone, 32) ?? str(fs.phone, 32),
    name: str(mem?.name ?? fs.name, 200) ?? str(fs.name, 200),
    email: str(fs.email, 320),
    playerId: str(fs.playerId, 64),
    role: str(mem?.role ?? fs.role, 32) ?? str(fs.role, 32),
    latitude: latM ?? fs.latitude ?? undefined,
    longitude: lonM ?? fs.longitude ?? undefined,
    dateOfBirth: str(mem?.dateOfBirth ?? fs.dateOfBirth, 32),
    gender: str(mem?.gender ?? fs.gender, 32),
    position: str(fs.position, 64),
    profileImage: str(mem?.profileImage ?? fs.profileImage, 2000),
    inviteCode: str(fs.inviteCode, 64),
    venueName: str(mem?.venueName, 200) ?? str(fs.venueName, 200),
    areaName: str(mem?.areaName, 200) ?? str(fs.areaName, 200),
    deviceId: str(mem?.deviceId, 128) ?? str(fs.deviceId, 128),
    expoPushToken: str(mem?.expoPublicToken, 500) ?? str(fs.expoPushToken, 500),
  };
}

/** حقول إضافية على مستند القسيمة (إلى جانب usedBy = uid) */
export function buildVoucherRedeemerFields(p: VoucherRedeemerProfile): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v === "") return;
    o[k] = v;
  };
  set("usedByPhone", str(p.phone, 32));
  set("usedByName", str(p.name, 200));
  set("usedByEmail", str(p.email, 320));
  set("usedByPlayerId", str(p.playerId, 64));
  set("usedByRole", str(p.role, 32));
  set("usedByLatitude", p.latitude ?? undefined);
  set("usedByLongitude", p.longitude ?? undefined);
  set("usedByDateOfBirth", str(p.dateOfBirth, 32));
  set("usedByGender", str(p.gender, 32));
  set("usedByPosition", str(p.position, 64));
  set("usedByProfileImage", str(p.profileImage, 2000));
  set("usedByInviteCode", str(p.inviteCode, 64));
  set("usedByVenueName", str(p.venueName, 200));
  set("usedByAreaName", str(p.areaName, 200));
  set("usedByDeviceId", str(p.deviceId, 128));
  set("usedByExpoPushToken", str(p.expoPushToken, 500));
  return o;
}

/** حقول إضافية على سجل حركة المحفظة */
export function buildLedgerRedeemerFields(p: VoucherRedeemerProfile): Record<string, unknown> {
  const o: Record<string, unknown> = { redeemerUserId: String(p.userId ?? "").trim() };
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v === "") return;
    o[k] = v;
  };
  set("redeemerPhone", str(p.phone, 32));
  set("redeemerName", str(p.name, 200));
  set("redeemerEmail", str(p.email, 320));
  set("redeemerPlayerId", str(p.playerId, 64));
  set("redeemerRole", str(p.role, 32));
  set("redeemerLatitude", p.latitude ?? undefined);
  set("redeemerLongitude", p.longitude ?? undefined);
  set("redeemerDateOfBirth", str(p.dateOfBirth, 32));
  set("redeemerGender", str(p.gender, 32));
  set("redeemerPosition", str(p.position, 64));
  set("redeemerProfileImage", str(p.profileImage, 2000));
  set("redeemerInviteCode", str(p.inviteCode, 64));
  set("redeemerVenueName", str(p.venueName, 200));
  set("redeemerAreaName", str(p.areaName, 200));
  set("redeemerDeviceId", str(p.deviceId, 128));
  set("redeemerExpoPushToken", str(p.expoPushToken, 500));
  return o;
}
