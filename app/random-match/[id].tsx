import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useRandomMatch } from "@/context/RandomMatchContext";
import { formatDate, formatPrice } from "@/context/BookingsContext";
import { useAuth } from "@/context/AuthContext";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import { AppBackground } from "@/components/AppBackground";
import { Colors } from "@/constants/colors";
export default function RandomMatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { matches, joinMatch } = useRandomMatch();
  const { user } = useAuth();
  const { guestRestricted, promptLogin } = useGuestPrompt();

  const match = useMemo(() => matches.find((m) => m.id === id), [matches, id]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  /** الاسم من الحساب فقط — لا يُعدَّل هنا */
  const displayName = (user?.name?.trim() || "").trim();
  const alreadyJoined = useMemo(() => {
    if (!match || !displayName) return false;
    return match.playerNames.some(
      (n) => n.trim().toLowerCase() === displayName.toLowerCase(),
    );
  }, [match, displayName]);

  const canJoin =
    match &&
    match.currentCount < match.maxPlayers &&
    !alreadyJoined &&
    displayName.length > 0;

  if (!match) {
    return (
      <AppBackground>
        <View style={[styles.center, { paddingTop: topPadding, backgroundColor: "transparent" }]}>
          <Pressable
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.missTitle, { color: colors.text }]}>المباراة غير متوفرة</Text>
          <Text style={[styles.missSub, { color: colors.textSecondary }]}>
            ربما أُغلقت القائمة أو انتهت الجلسة.
          </Text>
        </View>
      </AppBackground>
    );
  }

  const fullDate = match.date ? formatDate(match.date) : "—";
  const splitLabel =
    match.pricingMode === "split" && match.pricePerPlayer > 0
      ? formatPrice(match.pricePerPlayer)
      : "—";

  const runJoinFree = () => {
    if (!joinMatch(match.id, displayName)) {
      Alert.alert("تعذر الانضمام", "المباراة مكتملة أو أنت مُدرَج مسبقاً.");
      return;
    }
    Alert.alert("تم الانضمام", "أُضِفتَ إلى قائمة اللاعبين.", [
      { text: "حسناً", onPress: () => router.back() },
    ]);
  };

  const onConfirmJoinFree = () => {
    if (guestRestricted) {
      promptLogin();
      return;
    }
    Alert.alert(
      "تأكيد الانضمام",
      `هل تريد الانضمام إلى مباراة ${match.venueName} باسم «${displayName}»؟`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "تأكيد", onPress: runJoinFree },
      ],
    );
  };

  const onConfirmJoinPaid = () => {
    if (guestRestricted) {
      promptLogin();
      return;
    }
    Alert.alert(
      "تأكيد الانضمام",
      `سيتم توجيهك لدفع حصتك (${splitLabel}) باسم «${displayName}» ثم إضافتك للمباراة.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "متابعة",
          onPress: () =>
            router.push({
              pathname: "/random-match/join-pay",
              params: {
                matchId: match.id,
                amount: String(match.pricePerPlayer),
                venueName: match.venueName,
              },
            }),
        },
      ],
    );
  };

  return (
    <AppBackground>
      <View style={[styles.container, { paddingTop: topPadding, backgroundColor: "transparent" }]}>
        <View style={styles.header}>
          <Pressable
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            تفاصيل المباراة
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 130 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* حالة الحجز والدفع */}
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: isDark ? "rgba(15,157,88,0.14)" : "rgba(15,157,88,0.1)",
                borderColor: Colors.primary,
              },
            ]}
          >
            <View style={styles.statusHeaderRow}>
              <Ionicons name="shield-checkmark" size={22} color={Colors.primary} />
              <Text style={[styles.statusMainTitle, { color: colors.text }]}>حالة الحجز والدفع</Text>
            </View>

            <View style={styles.statusSection}>
              <Text style={[styles.statusLabelStrong, { color: colors.text }]}>حجز الملعب</Text>
              <View style={styles.statusLine}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                <Text style={[styles.statusBodyStrong, { color: colors.text }]}>
                  مؤكد — المبلغ المحجوز:{" "}
                  <Text style={{ fontFamily: "Cairo_700Bold", color: colors.primary }}>
                    {formatPrice(match.totalPrice)}
                  </Text>
                </Text>
              </View>
            </View>

            {match.hostPaidFull ? (
              <>
                <View style={[styles.statusSection, styles.statusSectionDivider, { borderTopColor: colors.border }]}>
                  <Text style={[styles.statusLabelStrong, { color: colors.text }]}>دفع الملعب</Text>
                  <View style={[styles.paidFullBanner, { backgroundColor: isDark ? colors.surface : "#FFFFFF" }]}>
                    <Text style={[styles.paidFullHeadline, { color: colors.primary }]}>تم دفع المبلغ بالكامل</Text>
                    <Text style={[styles.paidFullSub, { color: colors.text }]}>
                      المنظم سدّد إجمالي الإيجار عند إنشاء المباراة.
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusSection, styles.statusSectionDivider, { borderTopColor: colors.border }]}>
                  <Text style={[styles.statusLabelStrong, { color: colors.text }]}>للمنضمين</Text>
                  <View style={[styles.freeMatchBanner, { borderColor: Colors.primary }]}>
                    <Ionicons name="gift" size={24} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.freeMatchTitle, { color: colors.text }]}>المباراة مجانية</Text>
                      <Text style={[styles.freeMatchBody, { color: colors.textSecondary }]}>
                        لا يُطلب منك دفع حصة للملعب — انضمامك بدون تكلفة إضافية.
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.statusSection, styles.statusSectionDivider, { borderTopColor: colors.border }]}>
                  <Text style={[styles.statusLabelStrong, { color: colors.text }]}>تقسيم المبلغ (عند الإنشاء)</Text>
                  <Text style={[styles.splitIntro, { color: colors.textSecondary }]}>
                    يُقسَّم إجمالي الحجز بالتساوي على عدد اللاعبين المحدد. كل شخص يدفع حصته عند الانضمام.
                  </Text>
                  <View style={[styles.splitTable, { backgroundColor: isDark ? colors.surface : "rgba(0,0,0,0.06)", borderColor: colors.border }]}>
                    <View style={styles.splitRow}>
                      <Text style={[styles.splitCellLabel, { color: colors.textSecondary }]}>
                        إجمالي الحجز
                      </Text>
                      <Text style={[styles.splitCellValue, { color: colors.primary }]}>{formatPrice(match.totalPrice)}</Text>
                    </View>
                    <View style={[styles.splitRowDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.splitRow}>
                      <Text style={[styles.splitCellLabel, { color: colors.textSecondary }]}>
                        يُقسَّم على
                      </Text>
                      <Text style={[styles.splitCellValue, { color: colors.text }]}>
                        {match.maxPlayers} لاعباً
                      </Text>
                    </View>
                    <View style={[styles.splitRowDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.splitRow}>
                      <Text style={[styles.splitCellLabel, { color: colors.text }]}>
                        كل شخص يدفع
                      </Text>
                      <Text style={[styles.splitCellHighlight, { color: colors.primary }]}>
                        {match.pricePerPlayer > 0 ? formatPrice(match.pricePerPlayer) : "—"}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.splitFootnote, { color: colors.textTertiary }]}>
                    نفس المبلغ لكل منضم جديد (حصة متساوية).
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.venueTitle, { color: colors.text }]}>{match.venueName}</Text>
            <View style={styles.row}>
              <Ionicons name="calendar-outline" size={18} color={colors.text} style={{ opacity: 0.85 }} />
              <Text style={[styles.metaStrong, { color: colors.text }]}>
                {fullDate} · {match.time}
              </Text>
            </View>
            {match.durationHours != null && (
              <Text style={[styles.metaStrong, { color: colors.text, opacity: 0.92 }]}>
                المدة: {match.durationHours} ساعة
                {match.fieldSize ? ` · ${match.fieldSize}` : ""}
              </Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>ملخص السعر</Text>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabelStrong, { color: colors.textSecondary }]}>
                إجمالي حجز الملعب
              </Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>{formatPrice(match.totalPrice)}</Text>
            </View>
            {match.hostPaidFull ? (
              <View style={[styles.badgeFree, { backgroundColor: isDark ? "rgba(15,157,88,0.22)" : "rgba(15,157,88,0.14)" }]}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                <Text style={[styles.badgeFreeText, { color: colors.text }]}>
                  تم دفع المبلغ بالكامل — المباراة مجانية للمنضمين.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabelStrong, { color: colors.textSecondary }]}>
                    حصة كل شخص
                  </Text>
                  <Text style={[styles.priceValue, { color: colors.primary }]}>{splitLabel}</Text>
                </View>
                <Text style={[styles.hintStrong, { color: colors.textSecondary }]}>
                  تقسيم عند الإنشاء: {match.maxPlayers} لاعباً × {splitLabel} = إجمالي {formatPrice(match.totalPrice)} (تقريباً).
                </Text>
              </>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              اللاعبون ({match.currentCount}/{match.maxPlayers})
            </Text>
            {match.playerNames.map((name, i) => (
              <View key={`${name}-${i}`} style={styles.playerRow}>
                <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {(name.slice(0, 1) || "?").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.playerName, { color: colors.text }]}>
                    {name}
                    {i === 0 ? " · المنظم" : ""}
                  </Text>
                  {!match.hostPaidFull && match.pricePerPlayer > 0 && (
                    <Text style={[styles.playerShare, { color: colors.primary }]}>
                      يدفع: {formatPrice(match.pricePerPlayer)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>اسمك في المباراة</Text>
            <Text style={[styles.nameFromAccount, { color: colors.textSecondary }]}>
              يُؤخذ من حسابك مباشرة ولا يمكن تغييره هنا.
            </Text>
            {displayName.length > 0 ? (
              <View style={[styles.nameReadonly, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
                <Text style={[styles.nameReadonlyText, { color: colors.text }]}>{displayName}</Text>
              </View>
            ) : (
              <Text style={[styles.nameHint, { color: colors.textTertiary }]}>
                لا يوجد اسم في حسابك. حدّث الملف الشخصي أو سجّل الدخول ليظهر اسمك ولتتمكن من الانضمام.
              </Text>
            )}
          </View>

        </ScrollView>

        {/* شريط ثابت — زر تأكيد الانضمام هو العنصر الأبرز */}
        <View
          style={[
            styles.ctaDock,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          {alreadyJoined ? (
            <View style={[styles.joinedDock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="checkmark-done" size={26} color={Colors.primary} />
              <Text style={[styles.joinedDockText, { color: colors.text }]}>أنت مُدرَج في هذه المباراة</Text>
            </View>
          ) : match.hostPaidFull ? (
            <Pressable
              style={[
                styles.ctaPrimary,
                styles.ctaPrimaryShadow,
                { backgroundColor: Colors.primary, opacity: canJoin ? 1 : 0.5 },
              ]}
              onPress={onConfirmJoinFree}
              disabled={!canJoin}
            >
              <View style={styles.ctaPrimaryInner}>
                <Ionicons name="enter-outline" size={32} color="#000" />
                <View style={styles.ctaPrimaryTextCol}>
                  <Text style={styles.ctaPrimaryTitle}>تأكيد الانضمام</Text>
                  <Text style={styles.ctaPrimarySub}>انضمام مجاني — لا دفع مطلوب</Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.ctaPrimary,
                styles.ctaPrimaryShadow,
                {
                  backgroundColor: Colors.primary,
                  opacity: canJoin && match.pricePerPlayer > 0 ? 1 : 0.5,
                },
              ]}
              onPress={onConfirmJoinPaid}
              disabled={!canJoin || match.pricePerPlayer <= 0}
            >
              <View style={styles.ctaPrimaryInner}>
                <Ionicons name="card-outline" size={32} color="#000" />
                <View style={styles.ctaPrimaryTextCol}>
                  <Text style={styles.ctaPrimaryTitle}>تأكيد الانضمام</Text>
                  <Text style={styles.ctaPrimarySub}>الخطوة التالية: دفع حصتك {splitLabel}</Text>
                </View>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, paddingHorizontal: 24, justifyContent: "center", alignItems: "center", gap: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    marginHorizontal: 8,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 14 },
  statusCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  statusHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  statusMainTitle: {
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
  },
  statusSection: {
    gap: 8,
    paddingTop: 4,
  },
  statusSectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 4,
  },
  statusLabelStrong: {
    fontSize: 13,
    fontFamily: "Cairo_700Bold",
    marginBottom: 8,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  statusBodyStrong: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Cairo_600SemiBold",
    lineHeight: 24,
  },
  paidFullBanner: {
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  paidFullHeadline: {
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
    marginBottom: 6,
  },
  paidFullSub: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    lineHeight: 22,
  },
  freeMatchBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "rgba(15,157,88,0.08)",
  },
  freeMatchTitle: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
    marginBottom: 6,
  },
  freeMatchBody: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    lineHeight: 22,
  },
  splitIntro: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    lineHeight: 22,
    marginBottom: 12,
  },
  splitTable: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    marginTop: 4,
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  splitRowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  splitCellLabel: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    flex: 1,
    paddingLeft: 8,
  },
  splitCellValue: {
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  splitCellHighlight: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  splitFootnote: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginTop: 10,
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  venueTitle: { fontSize: 18, fontFamily: "Cairo_700Bold" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  meta: { fontSize: 13, fontFamily: "Cairo_400Regular" },
  metaStrong: { fontSize: 14, fontFamily: "Cairo_600SemiBold", lineHeight: 22 },
  sectionTitle: { fontSize: 15, fontFamily: "Cairo_700Bold", marginBottom: 4 },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  priceLabel: { fontSize: 14, fontFamily: "Cairo_400Regular" },
  priceLabelStrong: { fontSize: 14, fontFamily: "Cairo_700Bold" },
  priceValue: { fontSize: 18, fontFamily: "Cairo_700Bold" },
  badgeFree: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  badgeFreeText: { flex: 1, fontSize: 14, fontFamily: "Cairo_700Bold", lineHeight: 22 },
  hint: { fontSize: 12, fontFamily: "Cairo_400Regular", marginTop: 6, lineHeight: 18 },
  hintStrong: {
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    marginTop: 10,
    lineHeight: 20,
  },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontFamily: "Cairo_700Bold" },
  playerName: { fontSize: 15, fontFamily: "Cairo_600SemiBold" },
  playerShare: { fontSize: 13, fontFamily: "Cairo_700Bold", marginTop: 4 },
  nameFromAccount: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    lineHeight: 18,
    marginBottom: 8,
  },
  nameReadonly: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  nameReadonlyText: {
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
    flex: 1,
  },
  nameHint: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginTop: 8,
    lineHeight: 18,
  },
  ctaDock: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaPrimary: {
    borderRadius: 18,
    overflow: "hidden",
    minHeight: 92,
  },
  ctaPrimaryInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  ctaPrimaryTextCol: {
    flex: 1,
    gap: 4,
  },
  ctaPrimaryShadow: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
    },
    android: {
      elevation: 10,
    },
    default: {},
  }),
  ctaPrimaryTitle: {
    color: "#000",
    fontSize: 21,
    fontFamily: "Cairo_700Bold",
    letterSpacing: 0.2,
    textAlign: "right",
  },
  ctaPrimarySub: {
    color: "#1C1C1E",
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "right",
    lineHeight: 18,
  },
  joinedDock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  joinedDockText: { fontSize: 16, fontFamily: "Cairo_700Bold", flex: 1 },
  missTitle: { fontSize: 18, fontFamily: "Cairo_700Bold", marginTop: 16 },
  missSub: { fontSize: 14, textAlign: "center", lineHeight: 22 },
});
