import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useBookings } from "@/context/BookingsContext";

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  rightElement?: React.ReactNode;
}

function SettingRow({ icon, label, value, onPress, danger, rightElement }: SettingRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingRow,
        pressed && onPress ? { opacity: 0.7, backgroundColor: "rgba(255,255,255,0.03)" } : {},
      ]}
      onPress={onPress}
    >
      <View style={[styles.settingIcon, danger && { backgroundColor: "rgba(255,59,48,0.12)" }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.destructive : Colors.textSecondary} />
      </View>
      <Text style={[styles.settingLabel, danger && { color: Colors.destructive }]}>{label}</Text>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {rightElement}
        {onPress && !rightElement && (
          <Ionicons name="chevron-back" size={16} color={Colors.textTertiary} />
        )}
      </View>
    </Pressable>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { bookings } = useBookings();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode] = useState(true);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const completedCount = bookings.filter(b => b.status === "completed").length;
  const upcomingCount = bookings.filter(b => b.status === "upcoming").length;
  const totalSpent = bookings
    .filter(b => b.status === "completed")
    .reduce((sum, b) => sum + b.price, 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>حسابي</Text>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>أ</Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={styles.userName}>أحمد محمد</Text>
            <Text style={styles.userPhone}>+964 770 123 4567</Text>
            <View style={styles.captainBadge}>
              <Ionicons name="shield-checkmark" size={12} color={Colors.primary} />
              <Text style={styles.captainText}>قائد الفريق</Text>
            </View>
          </View>
          <Pressable style={styles.editBtn}>
            <Ionicons name="pencil" size={16} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="مباريات" value={completedCount} icon="football" />
          <StatCard label="قادمة" value={upcomingCount} icon="calendar" />
          <StatCard label="مصاريف" value={`${(totalSpent / 1000).toFixed(0)}k`} icon="wallet" />
          <StatCard label="لا حضور" value="0" icon="close-circle" />
        </View>

        <Text style={styles.sectionTitle}>الإعدادات</Text>
        <View style={styles.settingsGroup}>
          <SettingRow
            icon="notifications-outline"
            label="الإشعارات"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ true: Colors.primary, false: Colors.disabled }}
                thumbColor="#fff"
                ios_backgroundColor={Colors.disabled}
              />
            }
          />
          <SettingRow
            icon="moon-outline"
            label="الوضع الداكن"
            value="دائمًا"
          />
          <SettingRow
            icon="language-outline"
            label="اللغة"
            value="العربية"
            onPress={() => {}}
          />
          <SettingRow
            icon="location-outline"
            label="المدينة"
            value="الموصل"
            onPress={() => {}}
          />
        </View>

        <Text style={styles.sectionTitle}>الحساب</Text>
        <View style={styles.settingsGroup}>
          <SettingRow
            icon="card-outline"
            label="طرق الدفع"
            onPress={() => {}}
          />
          <SettingRow
            icon="shield-outline"
            label="الخصوصية والأمان"
            onPress={() => {}}
          />
          <SettingRow
            icon="help-circle-outline"
            label="المساعدة والدعم"
            onPress={() => {}}
          />
          <SettingRow
            icon="information-circle-outline"
            label="عن التطبيق"
            value="v1.0.0"
          />
        </View>

        <Text style={styles.sectionTitle}>منطقة الخطر</Text>
        <View style={styles.settingsGroup}>
          <SettingRow
            icon="log-out-outline"
            label="تسجيل الخروج"
            onPress={() => {}}
            danger
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Shoot'ha © 2026 – الموصل</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 0,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontFamily: "Cairo_700Bold",
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
  },
  avatarInitial: {
    color: Colors.primary,
    fontSize: 24,
    fontFamily: "Cairo_700Bold",
  },
  avatarInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
  },
  userPhone: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
  captainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  captainText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
    marginBottom: 8,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  settingsGroup: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingValue: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  footerText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
});
