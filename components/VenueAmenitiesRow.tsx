import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { SERVICE_ICONS } from "@/constants/experimentalVenues";

type Props = {
  amenities: string[];
  /** عدد الشارات المعروضة قبل +المزيد */
  max?: number;
  /** بطاقات قائمة ضيقة */
  compact?: boolean;
};

export function VenueAmenitiesRow({ amenities, max = 4, compact }: Props) {
  const { colors } = useTheme();
  if (!amenities?.length) return null;

  const shown = amenities.slice(0, max);
  const more = amenities.length - shown.length;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, { color: colors.textTertiary }]}>الخدمات</Text>
      <View style={styles.chips}>
        {shown.map((a) => {
          const iconName = SERVICE_ICONS[a] ?? "checkmark-circle-outline";
          return (
            <View
              key={a}
              style={[
                styles.chip,
                compact && styles.chipCompact,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name={iconName as never} size={compact ? 11 : 13} color={colors.primary} />
              <Text style={[styles.chipText, { color: colors.textSecondary }]} numberOfLines={1}>
                {a}
              </Text>
            </View>
          );
        })}
        {more > 0 && (
          <Text style={[styles.more, { color: colors.textTertiary }]}>+{more}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 6 },
  wrapCompact: { marginTop: 6 },
  label: {
    fontSize: 10,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "right",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: "100%",
  },
  chipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
    flexShrink: 1,
  },
  more: {
    fontSize: 11,
    fontFamily: "Cairo_600SemiBold",
  },
});
