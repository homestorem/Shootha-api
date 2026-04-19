/**
 * موقع اللاعب لحظة الحجز — يُرفق تلقائياً مع طلب الحجز عند السماح بالموقع
 */
import { Platform } from "react-native";
import * as Location from "expo-location";
import { readSanitizedNativeCoordinates } from "@/lib/native-device-coords";

export async function requireLocationForBooking(): Promise<{ lat: number; lon: number }> {
  if (Platform.OS === "web") {
    throw new Error("الحجز يتطلب الوصول للموقع من تطبيق الجوال.");
  }

  const serviceEnabled = await Location.hasServicesEnabledAsync();
  if (!serviceEnabled) {
    throw new Error("خدمة الموقع متوقفة. فعّل GPS من إعدادات الجهاز ثم أعد المحاولة.");
  }

  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== "granted") {
    const asked = await Location.requestForegroundPermissionsAsync();
    status = asked.status;
  }
  if (status !== "granted") {
    throw new Error("لا يمكن إتمام الحجز بدون السماح للوصول إلى الموقع.");
  }

  try {
    const { latitude, longitude } = await readSanitizedNativeCoordinates();
    return { lat: latitude, lon: longitude };
  } catch {
    throw new Error("تعذر تحديد موقعك الحالي. تأكد من تشغيل GPS ثم أعد المحاولة.");
  }
}

export async function getLocationForBooking(): Promise<{ lat: number; lon: number } | null> {
  try {
    return await requireLocationForBooking();
  } catch {
    return null;
  }
}
