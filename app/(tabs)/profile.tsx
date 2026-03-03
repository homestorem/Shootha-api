import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Platform,
  Alert,
  Modal,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useBookings } from "@/context/BookingsContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/context/LanguageContext";
import { GuestModal } from "@/components/GuestModal";
import * as Haptics from "expo-haptics";

function DeleteAccountModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLang();
  const { deleteAccount } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setError("");
    onClose();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError("");
    try {
      await deleteAccount();
      router.replace("/select-role");
    } catch (e: any) {
      setError(e?.message ?? "حدث خطأ");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.fadeOverlay}>
        <View style={[modalStyles.card, { backgroundColor: colors.card }]}>
          <View style={modalStyles.dangerIcon}>
            <Ionicons name="warning" size={36} color={Colors.destructive} />
          </View>
          <Text style={[modalStyles.cardTitle, { color: colors.text }]}>
            {t("deleteConfirmTitle")}
          </Text>
          <Text style={[modalStyles.cardMsg, { color: colors.textSecondary }]}>
            {t("deleteConfirmMsg")}
          </Text>
          {!!error && (
            <Text style={[modalStyles.errorText, { color: Colors.destructive }]}>{error}</Text>
          )}
          <View style={modalStyles.btnRow}>
            <Pressable
              style={[modalStyles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={handleClose}
            >
              <Text style={[modalStyles.cancelBtnText, { color: colors.text }]}>
                {t("cancel")}
              </Text>
            </Pressable>
            <Pressable
              style={[modalStyles.deleteBtn, isDeleting && { opacity: 0.5 }]}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              <Text style={modalStyles.deleteBtnText}>
                {isDeleting ? t("deleting") : t("delete")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AboutModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLang();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable
          style={[modalStyles.sheet, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <View style={[modalStyles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.aboutLogoRow}>
            <View style={styles.aboutLogoCircle}>
              <Ionicons name="football" size={28} color={Colors.primary} />
            </View>
            <Text style={[styles.aboutLogoTitle, { color: colors.text }]}>Shoot'ha</Text>
          </View>
          <Text style={[styles.aboutBody, { color: colors.textSecondary }]}>
            {t("aboutAppText")}
          </Text>
          <Text style={[styles.aboutVersion, { color: colors.textTertiary }]}>v1.0.0</Text>
          <Pressable
            style={[styles.aboutCloseBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.aboutCloseBtnText, { color: colors.text }]}>{t("cancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
  rightElement,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  rightElement?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingRow,
        { borderBottomColor: colors.border },
        pressed && onPress ? { opacity: 0.7, backgroundColor: "rgba(128,128,128,0.05)" } : {},
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.settingIcon,
          {
            backgroundColor: danger
              ? "rgba(255,59,48,0.12)"
              : colors.surface,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={danger ? Colors.destructive : colors.textSecondary}
        />
      </View>
      <Text
        style={[
          styles.settingLabel,
          { color: danger ? Colors.destructive : colors.text },
        ]}
      >
        {label}
      </Text>
      <View style={styles.settingRight}>
        {value && (
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
            {value}
          </Text>
        )}
        {rightElement}
        {onPress && !rightElement && (
          <Ionicons name="chevron-back" size={16} color={colors.textTertiary} />
        )}
      </View>
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { bookings } = useBookings();
  const { user, isGuest, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useLang();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const upcomingCount = bookings.filter((b) => b.status === "upcoming").length;

  const handleLogout = () => {
    Alert.alert(t("logoutConfirmTitle"), t("logoutConfirmMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("logout"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/select-role");
        },
      },
    ]);
  };

  const displayName = isGuest ? t("guestMode") : user?.name ?? "مستخدم";
  const displayPhone = isGuest ? "—" : user?.phone ?? "—";
  const roleLabel = isGuest
    ? t("guestMode")
    : user?.role === "owner"
    ? t("owner")
    : user?.role === "supervisor"
    ? t("supervisor")
    : t("player");
  const roleIcon: keyof typeof Ionicons.glyphMap = isGuest
    ? "eye-outline"
    : user?.role === "owner"
    ? "business"
    : user?.role === "supervisor"
    ? "shield-checkmark"
    : "football";

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t("myAccount")}</Text>
        </View>

        {isGuest ? (
          <Pressable
            style={[styles.guestBanner, { borderColor: "rgba(255,149,0,0.25)", backgroundColor: "rgba(255,149,0,0.08)" }]}
            onPress={() => setShowGuestModal(true)}
          >
            <Ionicons name="eye-outline" size={22} color={Colors.warning} />
            <View style={styles.guestBannerText}>
              <Text style={[styles.guestBannerTitle, { color: Colors.warning }]}>{t("guestMode")}</Text>
              <Text style={[styles.guestBannerSub, { color: colors.textSecondary }]}>{t("guestBannerSub")}</Text>
            </View>
            <Ionicons name="chevron-back" size={18} color={Colors.warning} />
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.avatarSection, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={!isGuest ? () => router.push("/profile/edit") : undefined}
        >
          <View
            style={[
              styles.avatarCircle,
              isGuest && { borderColor: Colors.warning },
            ]}
          >
            {user?.profileImage ? (
              <Image
                source={{ uri: user.profileImage }}
                style={styles.avatarImage}
              />
            ) : (
              <Text
                style={[
                  styles.avatarInitial,
                  isGuest && { color: Colors.warning },
                ]}
              >
                {displayName.charAt(0)}
              </Text>
            )}
          </View>
          <View style={styles.avatarInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>{displayName}</Text>
            <Text style={[styles.userPhone, { color: colors.textSecondary }]}>{displayPhone}</Text>
            <View style={styles.captainBadge}>
              <Ionicons
                name={roleIcon}
                size={12}
                color={isGuest ? Colors.warning : Colors.primary}
              />
              <Text
                style={[
                  styles.captainText,
                  isGuest && { color: Colors.warning },
                ]}
              >
                {roleLabel}
              </Text>
            </View>
          </View>
          {!isGuest && (
            <View style={[styles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="pencil" size={16} color={colors.textSecondary} />
            </View>
          )}
        </Pressable>

        {!isGuest && (
          <View style={styles.statsRow}>
            <StatCard label={t("games")} value={completedCount} icon="football" />
            <StatCard label={t("upcoming")} value={upcomingCount} icon="calendar" />
            <StatCard label={t("noShow")} value="0" icon="close-circle" />
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("settings")}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="notifications-outline"
            label={t("notifications")}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ true: Colors.primary, false: colors.disabled }}
                thumbColor="#fff"
                ios_backgroundColor={colors.disabled}
              />
            }
          />
          <SettingRow
            icon="moon-outline"
            label={t("darkMode")}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleTheme();
                }}
                trackColor={{ true: Colors.primary, false: colors.disabled }}
                thumbColor="#fff"
                ios_backgroundColor={colors.disabled}
              />
            }
          />
          <SettingRow icon="location-outline" label={t("city")} value={t("mosul")} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("payment")}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.comingSoonRow}>
            <View style={[styles.settingIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="card-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.text }]}>{t("paymentMethods")}</Text>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>قريباً</Text>
            </View>
          </View>
        </View>

        {!isGuest && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("helpSupport")}</Text>
            <View style={[styles.settingsGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SettingRow
                icon="logo-whatsapp"
                label={t("whatsapp")}
                onPress={() => router.push("/profile/support")}
              />
              <SettingRow
                icon="information-circle-outline"
                label={t("aboutApp")}
                onPress={() => setShowAbout(true)}
              />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("dangerZone")}</Text>
            <View style={[styles.settingsGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SettingRow
                icon="trash-outline"
                label={t("deleteAccount")}
                onPress={() => setShowDeleteModal(true)}
                danger
              />
            </View>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("session")}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="log-out-outline"
            label={isGuest ? t("createAccount") : t("logout")}
            onPress={isGuest ? () => setShowGuestModal(true) : handleLogout}
            danger={!isGuest}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>{t("footer")}</Text>
        </View>
      </ScrollView>

      <GuestModal visible={showGuestModal} onClose={() => setShowGuestModal(false)} />
      <DeleteAccountModal visible={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
      <AboutModal visible={showAbout} onClose={() => setShowAbout(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 0 },
  header: { paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontFamily: "Cairo_700Bold" },
  guestBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  guestBannerText: { flex: 1, gap: 2 },
  guestBannerTitle: { fontSize: 14, fontFamily: "Cairo_700Bold" },
  guestBannerSub: { fontSize: 12, fontFamily: "Cairo_400Regular" },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 14,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(46,204,113,0.15)",
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 58, height: 58, borderRadius: 29 },
  avatarInitial: { color: Colors.primary, fontSize: 24, fontFamily: "Cairo_700Bold" },
  avatarInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 17, fontFamily: "Cairo_700Bold" },
  userPhone: { fontSize: 13, fontFamily: "Cairo_400Regular" },
  captainBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  captainText: { color: Colors.primary, fontSize: 12, fontFamily: "Cairo_600SemiBold" },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  statValue: { fontSize: 18, fontFamily: "Cairo_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Cairo_400Regular", textAlign: "center" },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
    marginBottom: 8,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  settingsGroup: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: { flex: 1, fontSize: 14, fontFamily: "Cairo_400Regular" },
  settingRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingValue: { fontSize: 13, fontFamily: "Cairo_400Regular" },
  comingSoonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  comingSoonBadge: {
    backgroundColor: "rgba(46,204,113,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.25)",
  },
  comingSoonText: { color: Colors.primary, fontSize: 12, fontFamily: "Cairo_600SemiBold" },
  footer: { alignItems: "center", paddingVertical: 16 },
  footerText: { fontSize: 12, fontFamily: "Cairo_400Regular" },
  aboutLogoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16, justifyContent: "center" },
  aboutLogoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(46,204,113,0.12)",
    borderWidth: 2,
    borderColor: "rgba(46,204,113,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  aboutLogoTitle: { fontSize: 22, fontFamily: "Cairo_700Bold" },
  aboutBody: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    lineHeight: 24,
    textAlign: "right",
    marginBottom: 16,
  },
  aboutVersion: { fontSize: 12, fontFamily: "Cairo_400Regular", marginBottom: 20 },
  aboutCloseBtn: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  aboutCloseBtnText: { fontSize: 15, fontFamily: "Cairo_600SemiBold" },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  fadeOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    marginBottom: 16,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  dangerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,59,48,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  cardTitle: { fontSize: 18, fontFamily: "Cairo_700Bold", textAlign: "center" },
  cardMsg: { fontSize: 14, fontFamily: "Cairo_400Regular", textAlign: "center", lineHeight: 22 },
  inputLabel: { fontSize: 13, fontFamily: "Cairo_400Regular", alignSelf: "flex-start" },
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Cairo_400Regular",
  },
  errorText: { fontSize: 12, fontFamily: "Cairo_400Regular", alignSelf: "flex-start" },
  btnRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 15, fontFamily: "Cairo_600SemiBold" },
  deleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { color: "#fff", fontSize: 15, fontFamily: "Cairo_600SemiBold" },
});
