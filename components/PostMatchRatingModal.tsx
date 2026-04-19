import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import type { Booking } from "@/context/BookingsContext";
import { submitPostMatchRating } from "@/lib/post-match-rating-api";

type PlayerRow = { key: string; name: string; stars: number; goals: string };

function newRow(): PlayerRow {
  return {
    key: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    stars: 5,
    goals: "0",
  };
}

function StarPick({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(n);
          }}
          hitSlop={6}
        >
          <Ionicons
            name={n <= value ? "star" : "star-outline"}
            size={size}
            color={n <= value ? Colors.primary : colors.textTertiary}
          />
        </Pressable>
      ))}
    </View>
  );
}

type Props = {
  visible: boolean;
  booking: Booking;
  raterUserId: string;
  onRemindLater: () => void;
  onSkipForever: () => void;
  onSubmitted: () => void;
};

export function PostMatchRatingModal({
  visible,
  booking,
  raterUserId,
  onRemindLater,
  onSkipForever,
  onSubmitted,
}: Props) {
  const { colors, isDark } = useTheme();
  const [venueStars, setVenueStars] = useState(5);
  const [venueFeedback, setVenueFeedback] = useState("");
  const [players, setPlayers] = useState<PlayerRow[]>(() => [newRow(), newRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVenueStars(5);
    setVenueFeedback("");
    setPlayers([newRow(), newRow()]);
    setError(null);
    setSubmitting(false);
  }, [booking.id]);

  const addPlayer = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayers((p) => (p.length >= 20 ? p : [...p, newRow()]));
  }, []);

  const removePlayer = useCallback((key: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayers((p) => (p.length <= 1 ? p : p.filter((x) => x.key !== key)));
  }, []);

  const updatePlayer = useCallback((key: string, patch: Partial<PlayerRow>) => {
    setPlayers((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }, []);

  const submit = useCallback(async () => {
    setError(null);
    const cleaned = players
      .map((r) => ({
        name: r.name.trim(),
        stars: r.stars,
        goals: Math.min(99, Math.max(0, parseInt(r.goals.replace(/\D/g, ""), 10) || 0)),
      }))
      .filter((r) => r.name.length > 0);
    if (venueStars < 1 || venueStars > 5) {
      setError("اختر تقييماً للملعب بين 1 و 5");
      return;
    }
    setSubmitting(true);
    try {
      await submitPostMatchRating({
        bookingId: booking.id,
        raterUserId,
        venueId: booking.venueId,
        venueName: booking.venueName,
        venueStars,
        venueFeedback: venueFeedback.trim(),
        players: cleaned,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الإرسال";
      setError(msg);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  }, [
    booking.id,
    booking.venueId,
    booking.venueName,
    onSubmitted,
    players,
    raterUserId,
    venueFeedback,
    venueStars,
  ]);

  const cardBg = isDark ? "rgba(28, 28, 34, 0.98)" : "#fff";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRemindLater}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onRemindLater} accessibilityLabel="إغلاق" />
        <View style={[styles.sheet, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>كيف كانت تجربتك؟</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={2}>
            {booking.venueName} — انتهى وقت الحجز. يمكنك تقييم الملعب واللاعبين.
          </Text>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollPad}
          >
            <Text style={[styles.label, { color: colors.text }]}>تقييم الملعب</Text>
            <StarPick value={venueStars} onChange={setVenueStars} />

            <Text style={[styles.label, { color: colors.text, marginTop: 14 }]}>ملاحظات عن الملعب (اختياري)</Text>
            <TextInput
              value={venueFeedback}
              onChangeText={setVenueFeedback}
              placeholder="مثال: أرضية ممتازة، إضاءة جيدة…"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[
                styles.feedback,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
              ]}
            />

            <View style={styles.playersHeader}>
              <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>اللاعبون</Text>
              <Pressable onPress={addPlayer} style={styles.addBtn}>
                <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                <Text style={styles.addBtnText}>إضافة</Text>
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              أسماء تقييمها وأهدافهم — يُحدَّث ترتيب «أفضل اللاعبين».
            </Text>

            {players.map((row, idx) => (
              <View
                key={row.key}
                style={[styles.playerCard, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <View style={styles.playerTop}>
                  <Text style={[styles.playerIdx, { color: colors.textSecondary }]}>#{idx + 1}</Text>
                  {players.length > 1 ? (
                    <Pressable onPress={() => removePlayer(row.key)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  value={row.name}
                  onChangeText={(t) => updatePlayer(row.key, { name: t })}
                  placeholder="اسم اللاعب"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.nameIn, { color: colors.text, borderColor: colors.border }]}
                />
                <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>تقييم الأداء</Text>
                <StarPick value={row.stars} onChange={(n) => updatePlayer(row.key, { stars: n })} size={22} />
                <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>الأهداف</Text>
                <TextInput
                  value={row.goals}
                  onChangeText={(t) => updatePlayer(row.key, { goals: t.replace(/\D/g, "").slice(0, 2) })}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.goalsIn, { color: colors.text, borderColor: colors.border }]}
                />
              </View>
            ))}

            {error ? <Text style={styles.err}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={[styles.primary, { opacity: submitting ? 0.7 : 1 }]}
              onPress={() => void submit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#000" />
                  <Text style={styles.primaryText}>إرسال التقييم</Text>
                </>
              )}
            </Pressable>
            <View style={styles.row2}>
              <Pressable style={styles.secondary} onPress={onRemindLater} disabled={submitting}>
                <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>لاحقاً</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={onSkipForever} disabled={submitting}>
                <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>تخطي</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  sub: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 6,
  },
  scrollPad: { paddingHorizontal: 16, paddingBottom: 12 },
  label: {
    fontSize: 15,
    fontFamily: "Cairo_600SemiBold",
    marginTop: 10,
  },
  starRow: { flexDirection: "row", gap: 6, marginTop: 6, justifyContent: "center" },
  feedback: {
    marginTop: 8,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: "top",
    fontFamily: "Cairo_400Regular",
  },
  playersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addBtnText: { color: Colors.primary, fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  hint: { fontSize: 12, fontFamily: "Cairo_400Regular", marginTop: 4 },
  playerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  playerTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  playerIdx: { fontFamily: "Cairo_600SemiBold" },
  nameIn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Cairo_400Regular",
  },
  miniLabel: { fontSize: 12, marginTop: 8, fontFamily: "Cairo_400Regular" },
  goalsIn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 88,
    marginTop: 4,
    fontFamily: "Cairo_600SemiBold",
  },
  err: { color: "#c62828", marginTop: 12, textAlign: "center", fontFamily: "Cairo_400Regular" },
  actions: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryText: { color: "#000", fontFamily: "Cairo_700Bold", fontSize: 16 },
  row2: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  secondary: { flex: 1, paddingVertical: 12, alignItems: "center" },
  secondaryText: { fontFamily: "Cairo_600SemiBold", fontSize: 15 },
});
