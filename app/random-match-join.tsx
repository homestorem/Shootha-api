import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useRandomMatch } from "@/context/RandomMatchContext";
import { formatDate } from "@/context/BookingsContext";
import { AppBackground } from "@/components/AppBackground";
import { Colors } from "@/constants/colors";

/** قائمة المباريات العشوائية المنشأة من مسار «إنشاء مباراة عشوائية» فقط */
export default function RandomMatchJoinScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { matches } = useRandomMatch();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

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
            مباريات عشوائية
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {matches.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="people-outline"
                size={56}
                color={colors.textTertiary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد مباريات بعد</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                ادخل من «إنشاء مباراة عشوائية»، اختر ملعباً، وأكمل الحجز بالبطاقة أو المحفظة لتظهر مباراتك هنا للآخرين.
              </Text>
              <Pressable
                style={[styles.cta, { backgroundColor: Colors.primary }]}
                onPress={() => router.replace("/random-match-create")}
              >
                <Text style={styles.ctaText}>الذهاب لإنشاء مباراة عشوائية</Text>
              </Pressable>
            </View>
          ) : (
            matches.map((match) => (
              <Pressable
                key={match.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() =>
                  router.push({ pathname: "/random-match/[id]", params: { id: match.id } })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.venueName, { color: colors.text }]}>{match.venueName}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {match.players} لاعبين
                  </Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {match.time}
                    {match.date ? ` · ${formatDate(match.date)}` : ""}
                  </Text>
                </View>
                <View style={styles.cardChevron}>
                  <Text style={[styles.detailHint, { color: Colors.primary }]}>التفاصيل</Text>
                  <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 16,
    gap: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  cta: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  ctaText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardChevron: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailHint: {
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  venueName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Cairo_400Regular",
  },
});
