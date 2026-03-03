import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetch } from "expo/fetch";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { getApiUrl } from "@/lib/query-client";
import { VenueOwner, FIELD_SIZE_OPTIONS } from "@/constants/owner";

export default function OwnerSettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token, logout, deleteAccount } = useAuth();
  const queryClient = useQueryClient();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [form, setForm] = useState({
    venueName: "",
    areaName: "",
    fieldSize: "5×5",
    bookingPrice: "",
    hasBathrooms: false,
    hasMarket: false,
  });
  const [isSavingVenue, setIsSavingVenue] = useState(false);
  const [venueSuccess, setVenueSuccess] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const authFetch = useCallback(
    async (method: string, route: string, data?: unknown) => {
      const url = new URL(route, getApiUrl()).toString();
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || res.statusText);
      }
      return res.json();
    },
    [token]
  );

  const { data: venueData, isLoading: venueLoading } = useQuery<VenueOwner>({
    queryKey: ["/api/owner/venue", token],
    queryFn: () => authFetch("GET", "/api/owner/venue"),
    enabled: !!token,
  });

  useEffect(() => {
    if (venueData) {
      setForm({
        venueName: venueData.venueName ?? "",
        areaName: venueData.areaName ?? "",
        fieldSize: venueData.fieldSize ?? "5×5",
        bookingPrice: venueData.bookingPrice ?? "",
        hasBathrooms: venueData.hasBathrooms ?? false,
        hasMarket: venueData.hasMarket ?? false,
      });
    }
  }, [venueData]);

  const saveVenueInfo = async () => {
    if (!form.venueName.trim() || !form.areaName.trim()) {
      Alert.alert("خطأ", "اسم الملعب والمنطقة مطلوبان");
      return;
    }
    setIsSavingVenue(true);
    setVenueSuccess(false);
    try {
      await authFetch("PATCH", "/api/owner/venue", {
        venueName: form.venueName.trim(),
        areaName: form.areaName.trim(),
        fieldSize: form.fieldSize,
        bookingPrice: form.bookingPrice.trim(),
        hasBathrooms: form.hasBathrooms,
        hasMarket: form.hasMarket,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/venue"] });
      setVenueSuccess(true);
      setTimeout(() => setVenueSuccess(false), 3000);
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setIsSavingVenue(false);
    }
  };

  const sendSupport = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      Alert.alert("خطأ", "الموضوع والرسالة مطلوبان");
      return;
    }
    setIsSendingSupport(true);
    try {
      await authFetch("POST", "/api/support/message", {
        subject: supportSubject.trim(),
        message: supportMessage.trim(),
      });
      Alert.alert("تم الإرسال", "سنتواصل معك قريباً");
      setSupportSubject("");
      setSupportMessage("");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setIsSendingSupport(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل أنت متأكد من تسجيل الخروج؟", [
      { text: "تراجع", style: "cancel" },
      {
        text: "خروج",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/select-role");
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      router.replace("/select-role");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad + 8,
        paddingBottom: bottomPad + 100,
        paddingHorizontal: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.screenTitle, { color: colors.text }]}>الإعدادات</Text>

      <View style={[s.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[s.avatarCircle, { backgroundColor: colors.primary + "22" }]}>
          <Ionicons name="business" size={28} color={colors.primary} />
        </View>
        <View>
          <Text style={[s.profileName, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[s.profilePhone, { color: colors.textSecondary }]}>{user?.phone}</Text>
          <Text style={[s.profileRole, { color: colors.primary }]}>صاحب ملعب</Text>
        </View>
      </View>

      <SectionHeader title="معلومات الملعب" icon="football" colors={colors} />
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {venueLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <FieldLabel label="اسم الملعب" colors={colors} />
            <TextInput
              value={form.venueName}
              onChangeText={(t) => setForm((f) => ({ ...f, venueName: t }))}
              placeholder="اسم الملعب"
              placeholderTextColor={colors.textTertiary}
              style={[s.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              textAlign="right"
            />

            <FieldLabel label="المنطقة" colors={colors} />
            <TextInput
              value={form.areaName}
              onChangeText={(t) => setForm((f) => ({ ...f, areaName: t }))}
              placeholder="المنطقة أو الحي"
              placeholderTextColor={colors.textTertiary}
              style={[s.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              textAlign="right"
            />

            <FieldLabel label="حجم الملعب" colors={colors} />
            <View style={s.chipRow}>
              {FIELD_SIZE_OPTIONS.map((size) => (
                <Pressable
                  key={size}
                  onPress={() => setForm((f) => ({ ...f, fieldSize: size }))}
                  style={[
                    s.chip,
                    {
                      backgroundColor: form.fieldSize === size ? colors.primary : colors.inputBg,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[s.chipText, { color: form.fieldSize === size ? "#000" : colors.text }]}>
                    {size}
                  </Text>
                </Pressable>
              ))}
            </View>

            <FieldLabel label="سعر الساعة (د.ع)" colors={colors} />
            <TextInput
              value={form.bookingPrice}
              onChangeText={(t) => setForm((f) => ({ ...f, bookingPrice: t.replace(/[^0-9]/g, "") }))}
              placeholder="مثال: 15000"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              style={[s.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              textAlign="right"
            />

            <View style={s.toggleRow}>
              <View>
                <Text style={[s.toggleLabel, { color: colors.text }]}>دورات مياه</Text>
              </View>
              <Switch
                value={form.hasBathrooms}
                onValueChange={(v) => setForm((f) => ({ ...f, hasBathrooms: v }))}
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={form.hasBathrooms ? colors.primary : colors.textTertiary}
              />
            </View>

            <View style={s.toggleRow}>
              <View>
                <Text style={[s.toggleLabel, { color: colors.text }]}>بقالة / كانتين</Text>
              </View>
              <Switch
                value={form.hasMarket}
                onValueChange={(v) => setForm((f) => ({ ...f, hasMarket: v }))}
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={form.hasMarket ? colors.primary : colors.textTertiary}
              />
            </View>

            {venueSuccess && (
              <View style={[s.successBanner, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={[s.successText, { color: colors.primary }]}>تم حفظ معلومات الملعب</Text>
              </View>
            )}

            <Pressable
              onPress={saveVenueInfo}
              disabled={isSavingVenue}
              style={[s.saveBtn, { backgroundColor: colors.primary }]}
            >
              {isSavingVenue ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.saveBtnText}>حفظ التغييرات</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      <SectionHeader title="المظهر" icon="color-palette" colors={colors} />
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.toggleRow}>
          <View>
            <Text style={[s.toggleLabel, { color: colors.text }]}>الوضع المظلم</Text>
            <Text style={[s.toggleSub, { color: colors.textSecondary }]}>
              {isDark ? "مفعّل" : "معطّل"}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary + "88" }}
            thumbColor={isDark ? colors.primary : colors.textTertiary}
          />
        </View>
      </View>

      <SectionHeader title="الدعم الفني" icon="headset" colors={colors} />
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          onPress={() => Linking.openURL("https://wa.me/9647701234567")}
          style={[s.supportBtn, { borderColor: "#25D366" + "44" }]}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          <Text style={[s.supportBtnText, { color: "#25D366" }]}>تواصل عبر واتساب</Text>
        </Pressable>

        <Text style={[s.formTitle, { color: colors.textSecondary }]}>أو أرسل رسالة</Text>
        <TextInput
          value={supportSubject}
          onChangeText={setSupportSubject}
          placeholder="الموضوع"
          placeholderTextColor={colors.textTertiary}
          style={[s.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          textAlign="right"
        />
        <TextInput
          value={supportMessage}
          onChangeText={setSupportMessage}
          placeholder="رسالتك..."
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
          style={[
            s.input,
            s.multilineInput,
            { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
          ]}
          textAlign="right"
          textAlignVertical="top"
        />
        <Pressable
          onPress={sendSupport}
          disabled={isSendingSupport}
          style={[s.saveBtn, { backgroundColor: colors.primary }]}
        >
          {isSendingSupport ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={s.saveBtnText}>إرسال</Text>
          )}
        </Pressable>
      </View>

      <SectionHeader title="عن التطبيق" icon="information-circle" colors={colors} />
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.infoRow}>
          <Text style={[s.infoLabel, { color: colors.textSecondary }]}>التطبيق</Text>
          <Text style={[s.infoValue, { color: colors.text }]}>شوطها للملاك</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={[s.infoLabel, { color: colors.textSecondary }]}>الإصدار</Text>
          <Text style={[s.infoValue, { color: colors.text }]}>1.0.0</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={[s.infoLabel, { color: colors.textSecondary }]}>المطوّر</Text>
          <Text style={[s.infoValue, { color: colors.text }]}>فريق شوطها • الموصل</Text>
        </View>
      </View>

      <SectionHeader title="الحساب" icon="person-circle" colors={colors} />
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {!showDeleteConfirm ? (
          <Pressable
            onPress={() => setShowDeleteConfirm(true)}
            style={[s.dangerBtn, { borderColor: "#E74C3C44" }]}
          >
            <Ionicons name="trash-outline" size={18} color="#E74C3C" />
            <Text style={s.dangerBtnText}>حذف الحساب</Text>
          </Pressable>
        ) : (
          <View>
            <Text style={[s.deleteWarning, { color: "#E74C3C" }]}>
              سيتم حذف حسابك نهائياً. لن تتمكن من استعادته.
            </Text>
            <View style={s.deleteRow}>
              <Pressable
                onPress={() => setShowDeleteConfirm(false)}
                style={[s.cancelDeleteBtn, { borderColor: colors.border }]}
              >
                <Text style={[s.cancelDeleteText, { color: colors.textSecondary }]}>إلغاء</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
                style={s.confirmDeleteBtn}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.confirmDeleteText}>تأكيد الحذف</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <Pressable onPress={handleLogout} style={[s.logoutBtn, { borderColor: colors.border }]}>
        <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
        <Text style={s.logoutText}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );
}

function SectionHeader({ title, icon, colors }: { title: string; icon: string; colors: any }) {
  return (
    <View style={headerStyles.row}>
      <Ionicons name={icon as any} size={18} color={colors.primary} />
      <Text style={[headerStyles.title, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

function FieldLabel({ label, colors }: { label: string; colors: any }) {
  return <Text style={[labelStyles.label, { color: colors.textSecondary }]}>{label}</Text>;
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    screenTitle: { fontFamily: "Cairo_700Bold", fontSize: 22, marginBottom: 16 },
    profileCard: {
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 20,
    },
    avatarCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
    profileName: { fontFamily: "Cairo_700Bold", fontSize: 17 },
    profilePhone: { fontFamily: "Cairo_400Regular", fontSize: 13 },
    profileRole: { fontFamily: "Cairo_600SemiBold", fontSize: 12, marginTop: 2 },
    card: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 20 },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      fontSize: 14,
      fontFamily: "Cairo_400Regular",
      marginBottom: 12,
    },
    multilineInput: { minHeight: 80 },
    chipRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
    chip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
    chipText: { fontFamily: "Cairo_600SemiBold", fontSize: 13 },
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    toggleLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
    toggleSub: { fontFamily: "Cairo_400Regular", fontSize: 12 },
    successBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
    },
    successText: { fontFamily: "Cairo_600SemiBold", fontSize: 13 },
    saveBtn: { borderRadius: 14, padding: 14, alignItems: "center" },
    saveBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#000" },
    supportBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 16,
    },
    supportBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
    formTitle: { fontFamily: "Cairo_400Regular", fontSize: 13, marginBottom: 8, textAlign: "center" },
    infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
    infoLabel: { fontFamily: "Cairo_400Regular", fontSize: 13 },
    infoValue: { fontFamily: "Cairo_600SemiBold", fontSize: 13 },
    dangerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    dangerBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#E74C3C" },
    deleteWarning: { fontFamily: "Cairo_600SemiBold", fontSize: 13, marginBottom: 12, textAlign: "center" },
    deleteRow: { flexDirection: "row", gap: 10, marginTop: 4 },
    cancelDeleteBtn: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center" },
    cancelDeleteText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
    confirmDeleteBtn: { flex: 1, borderRadius: 12, backgroundColor: "#E74C3C", padding: 12, alignItems: "center" },
    confirmDeleteText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#fff" },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      padding: 16,
      marginTop: 4,
    },
    logoutText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#E74C3C" },
  });
}

const headerStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 4 },
  title: { fontFamily: "Cairo_700Bold", fontSize: 16 },
});

const labelStyles = StyleSheet.create({
  label: { fontFamily: "Cairo_600SemiBold", fontSize: 13, marginBottom: 6 },
});
