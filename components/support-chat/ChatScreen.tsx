import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  ensureSupportChatForUser,
  subscribeSupportMessages,
  subscribeUserSupportChatByUserId,
  markSupportChatReadByUser,
  sendUserSupportMessage,
  type SupportChatDoc,
  type SupportMessage,
} from "@/lib/firestore-support-chat";
import { ensureFirebaseAuthForSupportChat } from "@/lib/firebaseSupportAuth";
import { normalizeIqPhoneToE164, isValidIqMobileE164 } from "@/lib/phoneE164";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";

type Props = {
  title: string;
  emptyTitle: string;
  emptySubtitle: string;
  loadError: string;
  sendError: string;
  inputPlaceholder: string;
  sendLabel: string;
  statusOpen: string;
  statusClosed: string;
  guestMessage: string;
};

export function ChatScreen({
  title,
  emptyTitle,
  emptySubtitle,
  loadError,
  sendError,
  inputPlaceholder,
  sendLabel,
  statusOpen,
  statusClosed,
  guestMessage,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user, isGuest, isAuthenticated } = useAuth();

  const [chatId, setChatId] = useState<string | null>(null);
  const [chatMeta, setChatMeta] = useState<SupportChatDoc | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [initLoading, setInitLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const listRef = useRef<FlatList<SupportMessage>>(null);
  /** يبقى متزامناً مع شارة «حسابي» ويُعاد ربط الرسائل عند تغيّر المحادثة المفضّلة */
  const subscribedChatIdRef = useRef<string | null>(null);
  const msgUnsubRef = useRef<(() => void) | undefined>(undefined);
  const ensureOnceRef = useRef(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!isAuthenticated || isGuest || !user?.id) {
      setInitLoading(false);
      setMessagesLoading(false);
      return;
    }

    let cancelled = false;
    ensureOnceRef.current = false;

    const clearMessagesSub = () => {
      msgUnsubRef.current?.();
      msgUnsubRef.current = undefined;
    };

    let unsubChats: (() => void) | undefined;

    void (async () => {
      const phone = normalizeIqPhoneToE164(user.phone ?? user.id);
      if (!isValidIqMobileE164(phone)) {
        if (!cancelled) {
          setInitLoading(false);
          setMessagesLoading(false);
        }
        return;
      }
      await ensureFirebaseAuthForSupportChat(phone);
      if (cancelled) return;

      unsubChats = subscribeUserSupportChatByUserId(
        user.id,
        (chat) => {
          if (cancelled) return;

          if (!chat) {
            setChatId(null);
            setChatMeta(null);
            setMessages([]);
            setMessagesLoading(false);
            setInitLoading(false);
            clearMessagesSub();
            subscribedChatIdRef.current = null;
            if (!ensureOnceRef.current) {
              ensureOnceRef.current = true;
              void ensureSupportChatForUser(user.id).catch(() => {
                ensureOnceRef.current = false;
              });
            }
            return;
          }

          ensureOnceRef.current = false;
          setChatMeta(chat);

          if (subscribedChatIdRef.current !== chat.id) {
            clearMessagesSub();
            subscribedChatIdRef.current = chat.id;
            setChatId(chat.id);
            setMessages([]);
            setMessagesLoading(true);
            msgUnsubRef.current = subscribeSupportMessages(
              chat.id,
              (items) => {
                if (cancelled) return;
                setMessages(items);
                setMessagesLoading(false);
              },
              () => {
                if (cancelled) return;
                setMessagesLoading(false);
                Alert.alert("", loadError);
              },
            );
            void markSupportChatReadByUser(chat.id).catch(() => {});
          }

          setInitLoading(false);
        },
        () => {
          if (!cancelled) {
            setInitLoading(false);
            setMessagesLoading(false);
            Alert.alert("", loadError);
          }
        },
      );

      if (cancelled) {
        unsubChats();
        unsubChats = undefined;
      }
    })();

    return () => {
      cancelled = true;
      unsubChats?.();
      clearMessagesSub();
      subscribedChatIdRef.current = null;
    };
  }, [isAuthenticated, isGuest, user?.id, user?.phone, loadError]);

  useFocusEffect(
    useCallback(() => {
      if (!chatId) return;
      void markSupportChatReadByUser(chatId).catch(() => {});
    }, [chatId]),
  );

  useEffect(() => {
    if (!chatId || messages.length === 0) return;
    const t = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(t);
  }, [messages.length, chatId]);

  const onSend = useCallback(
    async (text: string) => {
      if (!user?.id || !chatId) return;
      try {
        await sendUserSupportMessage(chatId, user.id, text);
      } catch {
        Alert.alert("", sendError);
      }
    },
    [chatId, user?.id, sendError],
  );

  const statusLabel =
    chatMeta?.status === "closed" ? statusClosed : statusOpen;

  if (!isAuthenticated || isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: topPadding,
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.guestText, { color: colors.textSecondary }]}>
            {guestMessage}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? topPadding : 0}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          {!initLoading && (
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      chatMeta?.status === "closed" ? colors.textTertiary : colors.primary,
                  },
                ]}
              />
              <Text style={[styles.statusText, { color: colors.textTertiary }]}>
                {statusLabel}
              </Text>
            </View>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {initLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isUser={item.senderType === "user"}
                colors={colors}
                isDark={isDark}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              messages.length === 0 && styles.listEmptyGrow,
            ]}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              messagesLoading ? (
                <View style={styles.emptyLoader}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <View
                    style={[
                      styles.emptyIcon,
                      { backgroundColor: isDark ? "rgba(15,157,88,0.12)" : "rgba(15,157,88,0.1)" },
                    ]}
                  >
                    <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>{emptyTitle}</Text>
                  <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                    {emptySubtitle}
                  </Text>
                </View>
              )
            }
            ListFooterComponent={<View style={{ height: 8 }} />}
          />
          <ChatInput
            onSend={onSend}
            colors={colors}
            placeholder={inputPlaceholder}
            sendLabel={sendLabel}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Cairo_700Bold" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: "Cairo_400Regular" },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingTop: 12, paddingBottom: 8 },
  listEmptyGrow: { flexGrow: 1 },
  emptyLoader: { paddingTop: 48, alignItems: "center" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Cairo_700Bold", textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Cairo_400Regular", textAlign: "center", marginTop: 8 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  guestText: { fontSize: 15, fontFamily: "Cairo_400Regular", textAlign: "center" },
});
