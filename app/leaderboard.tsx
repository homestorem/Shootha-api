import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { AppBackground } from "@/components/AppBackground";
import { useGuestPrompt } from "@/context/GuestPromptContext";

type LeaderboardPlayer = {
  id: string;
  name: string;
  points: number;
  matches: number;
  image?: string;
};

/** TODO: replace with real API data. */
const PLAYERS: LeaderboardPlayer[] = [];

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { guestRestricted, promptLogin } = useGuestPrompt();

  const tint = isDark ? "dark" : "light";
  const blurIntensity = Platform.OS === "ios" ? (isDark ? 40 : 32) : 24;

  useFocusEffect(
    useCallback(() => {
      if (!guestRestricted) return;
      promptLogin();
      router.replace("/(tabs)");
    }, [guestRestricted, promptLogin]),
  );

  if (guestRestricted) {
    return null;
  }

  const topPlayers = PLAYERS.slice(0, 3);

  return (
    <AppBackground>
      <View
        style={[
          styles.container,
          { paddingTop: topPadding, backgroundColor: "transparent" },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
          >
            <Ionicons name="chevron-forward" size={22} color={colors.headerIcon} />
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.titleRow}>
              <LinearGradient
                colors={[Colors.primary, "#0d7a47"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.trophyIconBg}
              >
                <Ionicons name="trophy" size={22} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>أفضل اللاعبين</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  تصنيف الأسبوع — نقاط ومشاركات
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPad + 24 },
          ]}
        >
          <View
            style={[
              styles.heroBanner,
              {
                borderColor: colors.border,
                backgroundColor: isDark ? "rgba(28, 28, 34, 0.92)" : "rgba(255, 255, 255, 0.94)",
              },
            ]}
          >
            <View style={[styles.heroIconWrap, { backgroundColor: `${Colors.primary}22` }]}>
              <Ionicons name="sparkles" size={18} color={Colors.primary} />
            </View>
            <Text style={[styles.heroText, { color: colors.text }]}>
              تنافس على الصدارة واحجز أكثر لتصعد في القائمة
            </Text>
          </View>

          {topPlayers.length >= 3 ? (
            <>
              <Text style={[styles.sectionLabel, { color: isDark ? colors.textSecondary : colors.text, opacity: isDark ? 1 : 0.72 }]}>
                المنصة
              </Text>

              <View style={styles.podiumRow}>
                <PodiumCard
                  rank={2}
                  name={topPlayers[1].name}
                  points={topPlayers[1].points}
                  height={148}
                  variant="silver"
                  icon="medal-outline"
                  colors={colors}
                  isDark={isDark}
                />
                <PodiumCard
                  rank={1}
                  name={topPlayers[0].name}
                  points={topPlayers[0].points}
                  height={178}
                  variant="gold"
                  icon="trophy"
                  colors={colors}
                  isDark={isDark}
                  highlight
                />
                <PodiumCard
                  rank={3}
                  name={topPlayers[2].name}
                  points={topPlayers[2].points}
                  height={138}
                  variant="bronze"
                  icon="ribbon-outline"
                  colors={colors}
                  isDark={isDark}
                />
              </View>

              <Text style={[styles.sectionLabel, { color: isDark ? colors.textSecondary : colors.text, opacity: isDark ? 1 : 0.72, marginTop: 8 }]}>
                الترتيب الكامل
              </Text>
            </>
          ) : (
            <View style={[styles.emptyWrap, { borderColor: colors.border, backgroundColor: isDark ? "rgba(22, 22, 28, 0.94)" : "rgba(255, 255, 255, 0.92)" }]}>
              <Ionicons name="hourglass-outline" size={22} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد بيانات حالياً</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                سيتم عرض أفضل اللاعبين عند توفر نتائج فعلية.
              </Text>
            </View>
          )}

          <View style={styles.list}>
            {PLAYERS.slice(3).map((player, index) => (
              <View
                key={player.id}
                style={[
                  styles.rowWrap,
                  { borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.rowFallback,
                    {
                      backgroundColor: isDark ? "rgba(22, 22, 28, 0.94)" : "rgba(255, 255, 255, 0.92)",
                    },
                  ]}
                />
                {Platform.OS === "web" ? null : (
                  <BlurView
                    intensity={blurIntensity}
                    tint={tint}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <LinearGradient
                  colors={
                    isDark
                      ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.02)"]
                      : ["rgba(255,255,255,0.65)", "rgba(255,255,255,0.12)"]
                  }
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.rowInner}>
                  <LinearGradient
                    colors={[`${Colors.primary}33`, `${Colors.primary}08`]}
                    style={styles.rankCircle}
                  >
                    <Text style={styles.rankNumber}>{index + 4}</Text>
                  </LinearGradient>

                  {player.image ? (
                    <Image source={{ uri: player.image }} style={styles.playerAvatar} />
                  ) : (
                    <View style={[styles.playerAvatarFallback, { backgroundColor: `${Colors.primary}22` }]}>
                      <Text style={styles.playerAvatarInitial}>{player.name.charAt(0)}</Text>
                    </View>
                  )}

                  <View style={styles.rowText}>
                    <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <Text style={[styles.matches, { color: colors.textTertiary }]}>
                      {player.matches} مباراة
                    </Text>
                  </View>

                  <View style={[styles.pointsBadge, { backgroundColor: Colors.primary }]}>
                    <Ionicons name="football" size={15} color="#000" />
                    <Text style={styles.pointsText}>{player.points}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </AppBackground>
  );
}

const PODIUM_ACCENTS = {
  gold: {
    bar: ["#FDE68A", "#F59E0B", "#D97706"] as const,
    ring: ["#FDE047", "#F59E0B"] as const,
    icon: "#F59E0B",
  },
  silver: {
    bar: ["#F1F5F9", "#94A3B8", "#64748B"] as const,
    ring: ["#E2E8F0", "#94A3B8"] as const,
    icon: "#64748B",
  },
  bronze: {
    bar: ["#FDBA74", "#EA580C", "#C2410C"] as const,
    ring: ["#FB923C", "#EA580C"] as const,
    icon: "#EA580C",
  },
} as const;

type PodiumVariant = keyof typeof PODIUM_ACCENTS;

function PodiumCard({
  rank,
  name,
  points,
  height,
  variant,
  icon,
  colors,
  isDark,
  highlight,
}: {
  rank: number;
  name: string;
  points: number;
  height: number;
  variant: PodiumVariant;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  colors: { text: string; textSecondary: string; border: string };
  isDark: boolean;
  highlight?: boolean;
}) {
  const a = PODIUM_ACCENTS[variant];
  const cardBg = isDark ? "rgba(22, 22, 28, 0.96)" : "#FFFFFF";
  const nameColor = colors.text;
  const subColor = colors.textSecondary;

  return (
    <View style={[styles.podiumCol, { height }]}>
      <View
        style={[
          styles.podiumShell,
          {
            backgroundColor: cardBg,
            borderColor: colors.border,
            ...Platform.select({
              ios: {
                shadowColor: highlight ? "#F59E0B" : "#000",
                shadowOffset: { width: 0, height: highlight ? 10 : 6 },
                shadowOpacity: highlight ? 0.22 : isDark ? 0.45 : 0.12,
                shadowRadius: highlight ? 18 : 12,
              },
              android: { elevation: highlight ? 10 : 6 },
              default: {},
            }),
          },
          highlight && styles.podiumShellHighlight,
        ]}
      >
        <LinearGradient
          colors={[...a.bar]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.podiumAccentBar}
        />

        <View style={styles.podiumInner}>
          <LinearGradient colors={a.ring} style={styles.podiumRankRing}>
            <Text style={[styles.podiumRankNum, { color: isDark ? "#0C0C0E" : "#1C1C1E" }]}>{rank}</Text>
          </LinearGradient>

          <Ionicons name={icon} size={highlight ? 26 : 22} color={a.icon} />

          <Text style={[styles.podiumName, { color: nameColor }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[styles.podiumPoints, { color: subColor }]}>{points} نقطة</Text>
        </View>
      </View>

      <LinearGradient
        colors={[...a.bar]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.podiumPedestal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
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
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trophyIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#0f9d58",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  title: {
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    marginTop: 2,
    textAlign: "right",
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  heroText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    lineHeight: 20,
    textAlign: "right",
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
    letterSpacing: 0.3,
    marginBottom: 10,
    textAlign: "right",
  },
  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  podiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 28,
    paddingHorizontal: 2,
  },
  podiumCol: {
    flex: 1,
    maxWidth: 120,
    justifyContent: "flex-end",
  },
  podiumShell: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  podiumShellHighlight: {
    transform: [{ scale: 1.03 }],
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.55)",
  },
  podiumAccentBar: {
    width: "100%",
    height: 4,
  },
  podiumInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 4,
  },
  podiumRankRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    overflow: "hidden",
  },
  podiumRankNum: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  podiumName: {
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    lineHeight: 17,
    width: "100%",
  },
  podiumPoints: {
    fontSize: 11,
    fontFamily: "Cairo_600SemiBold",
    marginTop: 2,
  },
  podiumPedestal: {
    height: 7,
    marginHorizontal: 10,
    marginTop: 3,
    borderRadius: 4,
    opacity: 0.95,
  },
  list: {
    gap: 12,
  },
  rowWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  rowFallback: {
    ...StyleSheet.absoluteFillObject,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rankCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15,157,88,0.35)",
  },
  rankNumber: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  playerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  playerAvatarInitial: {
    color: Colors.primary,
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  rowText: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
    textAlign: "right",
  },
  matches: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginTop: 2,
    textAlign: "right",
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pointsText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  emptyWrap: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  emptySub: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
  },
});
