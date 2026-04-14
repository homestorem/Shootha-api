import React, { useState } from "react";
import { View, Text, Pressable, Modal, TextInput, StyleSheet, Platform } from "react-native";
import { useLang } from "@/context/LanguageContext";
import { Colors } from "@/constants/colors";

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function RegistrationShareCodePrompt({ value, onChange }: Props) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const openModal = () => {
    setDraft(value);
    setOpen(true);
  };

  const save = () => {
    onChange(draft.trim());
    setOpen(false);
  };

  const cancel = () => setOpen(false);

  return (
    <>
      <Pressable onPress={openModal} style={styles.linkWrap} hitSlop={8}>
        <Text style={styles.link}>{t("auth.register.shareCodeLink")}</Text>
      </Pressable>
      {value.trim() ? (
        <Text style={styles.savedHint}>{t("auth.register.shareCodeSavedHint")}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={cancel} accessibilityLabel={t("auth.register.shareCodeCancel")} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("auth.register.shareCodeModalTitle")}</Text>
            <Text style={styles.sheetHint}>{t("auth.register.shareCodeModalHint")}</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t("auth.register.shareCodePlaceholder")}
              placeholderTextColor="#8E8E93"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnSecondary]} onPress={cancel}>
                <Text style={styles.btnSecondaryText}>{t("auth.register.shareCodeCancel")}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={save}>
                <Text style={styles.btnPrimaryText}>{t("auth.register.shareCodeConfirm")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  linkWrap: {
    alignSelf: "center",
    marginBottom: 8,
    paddingVertical: 4,
  },
  link: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    textDecorationLine: "underline",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  savedHint: {
    alignSelf: "center",
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginBottom: 8,
    textAlign: "center",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
  },
  sheetHint: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
    fontFamily: "Cairo_400Regular",
    color: "#111827",
    backgroundColor: "#F9FAFB",
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  btn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    minWidth: 96,
    alignItems: "center",
  },
  btnSecondary: {
    backgroundColor: "#F3F4F6",
  },
  btnSecondaryText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: "#374151",
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnPrimaryText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: "#000",
  },
});
