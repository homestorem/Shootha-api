import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

function PulseText({ text }: { text: string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.Text style={[styles.comingSoon, { transform: [{ scale: pulse }] }]}>
      {text}
    </Animated.Text>
  );
}

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="bag-handle" size={52} color={Colors.primary} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>المتجر</Text>
          <View style={styles.underline} />
        </View>

        <PulseText text="قريباً..." />

        <Text style={styles.description}>
          سيتم إطلاق متجر المنتجات الرياضية قريباً داخل تطبيق Shoot'ha
        </Text>

        <View style={styles.placeholders}>
          <View style={styles.placeholderRow}>
            <Ionicons name="shirt-outline" size={20} color={Colors.textTertiary} />
            <Text style={styles.placeholderText}>منتجات رياضية</Text>
          </View>
          <View style={styles.placeholderRow}>
            <Ionicons name="cart-outline" size={20} color={Colors.textTertiary} />
            <Text style={styles.placeholderText}>سلة التسوق</Text>
          </View>
          <View style={styles.placeholderRow}>
            <Ionicons name="pricetag-outline" size={20} color={Colors.textTertiary} />
            <Text style={styles.placeholderText}>عروض وخصومات</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 36,
    gap: 20,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: "rgba(46,204,113,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(46,204,113,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  titleBlock: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    color: Colors.text,
    fontSize: 36,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
  },
  underline: {
    height: 3,
    width: 60,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  comingSoon: {
    color: Colors.primary,
    fontSize: 24,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  placeholders: {
    marginTop: 12,
    gap: 12,
    alignSelf: "stretch",
  },
  placeholderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: "flex-end",
  },
  placeholderText: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
});
