import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

interface GuestModalProps {
  visible: boolean;
  onClose: () => void;
}

export function GuestModal({ visible, onClose }: GuestModalProps) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- قيم Animated من useRef ثابتة
  }, [visible]);
  const handleLogin = () => {
  onClose();
  setTimeout(() => {
    router.push("/auth/player/login");
  }, 200);
};

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slideAnim }],
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={28} color={Colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>سجّل حسابك للحجز</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            المتابعة كضيف تتيح لك التصفح فقط.{"\n"}
            سجّل دخولك لتحجز ملعبك وتستمتع بالمباريات.
          </Text>

          <View style={styles.features}>
            {[
              { icon: "football", text: "حجز الملاعب مباشرةً" },
              { icon: "people", text: "دعوة اللاعبين وتقسيم الفاتورة" },
              { icon: "refresh", text: "إعادة الحجز بنقرة واحدة" },
              { icon: "star", text: "تقييم وتعليق على الملاعب" },
            ].map((f) => (
              <View key={f.text} style={styles.featureRow}>
                <Ionicons name={f.icon as any} size={16} color={Colors.primary} />
                <Text style={[styles.featureText, { color: colors.text }]}>{f.text}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleLogin}
          >
            <Ionicons name="person" size={18} color="#000" />
            <Text style={styles.loginBtnText}>تسجيل الدخول / إنشاء حساب</Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>متابعة كضيف</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
    gap: 16,
    borderTopWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(15,157,88,0.12)",
    borderWidth: 2,
    borderColor: "rgba(15,157,88,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: "Cairo_700Bold", textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Cairo_400Regular", textAlign: "center", lineHeight: 22 },
  features: { width: "100%", gap: 10, paddingHorizontal: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14, fontFamily: "Cairo_400Regular" },
  loginBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  loginBtnText: { color: "#000", fontSize: 15, fontFamily: "Cairo_700Bold" },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 14, fontFamily: "Cairo_400Regular" },
});
