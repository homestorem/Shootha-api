import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  InteractionManager,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, type Href } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/context/ThemeContext";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { sendPhoneOtp } from "@/lib/firebasePhoneAuth";
import { normalizePhoneFromOtpRouteParam } from "@/lib/phoneE164";
import {
  PROFILE_EDIT_PENDING_KEY,
  profileEditUsedStorageKey,
  type ProfileEditPendingPayload,
} from "@/lib/profile-edit-pending";

export default function AccountScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLang();

  const positionOptions = useMemo(
    () => [
      t("positions.forward"),
      t("positions.midfielder"),
      t("positions.defender"),
      t("positions.goalkeeper"),
    ],
    [t],
  );

  const resolvePosition = useCallback(
    (stored: string | null | undefined) => {
      const p = (stored ?? "").trim();
      if (positionOptions.includes(p)) return p;
      return t("positions.forward");
    },
    [positionOptions, t],
  );

  const [name, setName] = useState(user?.name ?? "");
  const [position, setPosition] = useState(() => resolvePosition(user?.position));
  const [image, setImage] = useState<string | null>(user?.profileImage ?? null);
  const [birthDate, setBirthDate] = useState(
    user?.dateOfBirth ? new Date(user.dateOfBirth) : new Date(),
  );
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const [showDate, setShowDate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editsLocked, setEditsLocked] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setImage(user.profileImage ?? null);
    setBirthDate(user.dateOfBirth ? new Date(user.dateOfBirth) : new Date());
    setPosition(resolvePosition(user.position));
  }, [user, resolvePosition]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!user?.id || user.id === "guest") {
          if (!cancelled) setEditsLocked(false);
          return;
        }
        const v = await AsyncStorage.getItem(profileEditUsedStorageKey(user.id));
        if (!cancelled) setEditsLocked(v === "1");
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id]),
  );

  const pickImage = async () => {
    if (editsLocked) return;
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("errors.permissionRequired"), t("errors.photoPermission"));
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const saveDisabled = editsLocked || isSaving || !user || user.id === "guest";

  const handleSave = async () => {
    if (saveDisabled) return;
    if (!user?.phone?.trim()) {
      Alert.alert(t("common.errorTitle"), t("errors.invalidPhone"));
      return;
    }
    setIsSaving(true);
    try {
      const y = birthDate.getFullYear();
      const m = String(birthDate.getMonth() + 1).padStart(2, "0");
      const d = String(birthDate.getDate()).padStart(2, "0");
      const ymd = `${y}-${m}-${d}`;
      const payload: ProfileEditPendingPayload = {
        name: name.trim() || user.name,
        dateOfBirth: ymd,
        position,
        profileImage: image,
      };
      await AsyncStorage.setItem(PROFILE_EDIT_PENDING_KEY, JSON.stringify(payload));
      const e164 = normalizePhoneFromOtpRouteParam(user.phone.replace(/^\+/, ""));
      await sendPhoneOtp(e164);
      const phoneParam = e164.replace(/^\+/, "");
      const go = () =>
        router.push({
          pathname: "/auth/player/verify-otp",
          params: {
            phone: phoneParam,
            mode: "profile_edit",
            returnTo: "/profile/account",
          },
        } as Href);
      InteractionManager.runAfterInteractions(() => {
        setTimeout(go, 0);
      });
    } catch (e: unknown) {
      await AsyncStorage.removeItem(PROFILE_EDIT_PENDING_KEY);
      const msg = e instanceof Error ? e.message : t("errors.failedToSave");
      Alert.alert(t("common.errorTitle"), msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {editsLocked ? (
          <View style={[styles.noticeBanner, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              {t("account.oneEditUsed")}
            </Text>
          </View>
        ) : (
          <Text style={[styles.noticeText, { color: colors.textSecondary, marginBottom: 16 }]}>
            {t("account.oneEditNotice")}
          </Text>
        )}

        <View style={styles.avatarContainer}>
          <Pressable onPress={pickImage} disabled={editsLocked}>
            {image ? (
              <Image source={{ uri: image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                <Ionicons name="person" size={40} color={colors.textSecondary} />
              </View>
            )}
            <View style={[styles.cameraIcon, editsLocked && { opacity: 0.4 }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: colors.text }]}>{t("account.name")}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          editable={!editsLocked}
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.text,
              opacity: editsLocked ? 0.65 : 1,
            },
          ]}
        />

        {user?.playerId ? (
          <>
            <Text style={[styles.label, { color: colors.text }]}>{t("account.playerId")}</Text>
            <View
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  justifyContent: "center",
                },
              ]}
            >
              <Text
                selectable
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Cairo_600SemiBold",
                  letterSpacing: 1,
                }}
              >
                {user.playerId}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12, marginTop: 4 }}>
              معرّف ثابت يربط حجوزاتك وإشعاراتك داخل التطبيق ولا يمكن تغييره.
            </Text>
          </>
        ) : null}

        <Pressable
          onPress={() => !editsLocked && setShowDate(true)}
          disabled={editsLocked}
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: editsLocked ? 0.65 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.text, fontFamily: "Cairo_400Regular" }}>
            {`${birthDate.getFullYear()} / ${birthDate.getMonth() + 1} / ${birthDate.getDate()}`}
          </Text>
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </Pressable>
        {Platform.OS === "android" && showDate ? (
          <DateTimePicker
            value={birthDate}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(_e, date) => {
              setShowDate(false);
              if (date) {
                setBirthDate(date);
              }
            }}
          />
        ) : null}

        <Text style={[styles.label, { color: colors.text }]}>{t("account.position")}</Text>
        <View style={styles.positions}>
          {positionOptions.map((p) => (
            <Pressable
              key={p}
              disabled={editsLocked}
              style={[
                styles.positionBtn,
                {
                  borderColor: position === p ? Colors.primary : colors.border,
                  backgroundColor: position === p ? "rgba(15,157,88,0.15)" : colors.card,
                  opacity: editsLocked ? 0.65 : 1,
                },
              ]}
              onPress={() => {
                setPosition(p);
              }}
            >
              <Text
                style={[
                  styles.positionText,
                  { color: position === p ? Colors.primary : colors.textSecondary },
                ]}
              >
                {p}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.saveBtn, saveDisabled && { opacity: 0.55 }]}
          disabled={saveDisabled}
          onPress={() => void handleSave()}
        >
          {isSaving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveText}>{t("common.saveChanges")}</Text>
          )}
        </Pressable>

        <Pressable style={styles.deleteBtn} onPress={() => router.push("/profile/delete-account")}>
          <Text style={styles.deleteText}>{t("account.deleteAccount")}</Text>
        </Pressable>
      </ScrollView>

      {Platform.OS !== "android" ? (
        <Modal visible={showDate} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("account.pickBirthDate")}
              </Text>
              <DateTimePicker
                value={birthDate}
                mode="date"
                display="spinner"
                themeVariant={isDark ? "dark" : "light"}
                maximumDate={new Date()}
                onChange={(_event, date) => {
                  if (date) {
                    setBirthDate(date);
                  }
                }}
              />
              <Pressable style={styles.doneBtn} onPress={() => setShowDate(false)}>
                <Text style={styles.doneText}>{t("common.done")}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  noticeText: { fontSize: 13, fontFamily: "Cairo_400Regular", flex: 1, lineHeight: 20 },
  avatarContainer: { alignItems: "center", marginBottom: 30 },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontFamily: "Cairo_600SemiBold", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 20,
    fontFamily: "Cairo_400Regular",
  },
  positions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  positionBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  positionText: { fontSize: 13, fontFamily: "Cairo_600SemiBold" },
  saveBtn: {
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#000", fontSize: 15, fontFamily: "Cairo_700Bold" },
  deleteBtn: {
    marginTop: 20,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,59,48,0.08)",
  },
  deleteText: { color: "#FF3B30", fontSize: 14, fontFamily: "Cairo_700Bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBox: { width: "85%", borderRadius: 16, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 16, fontFamily: "Cairo_700Bold", marginBottom: 10, textAlign: "center" },
  doneBtn: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { color: "#000", fontFamily: "Cairo_700Bold" },
});
