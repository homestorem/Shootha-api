const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isValidToken(token: string): boolean {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
  );
}

/** حقول Expo Push API — أولوية عالية + قناة `default` لظهور الإشعار في شريط أندرويد خارج التطبيق */
type PushMessage = {
  to: string;
  title: string;
  body: string;
  /** أندرويد: ضروري لعدم تأخير التسليم في Doze ولفتح اتصال الشبكة */
  priority: "high" | "default" | "normal";
  /** أندرويد 8+: يجب أن تطابق قناة أنشأها التطبيق (`expo-notifications` + `ensureAndroidDefaultChannel`) */
  channelId: string;
  sound: "default" | null;
  data?: Record<string, unknown>;
  image?: string;
};

export async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  image?: string
): Promise<void> {
  const validTokens = tokens.filter(isValidToken);
  if (validTokens.length === 0) return;

  const CHUNK = 100;
  for (let i = 0; i < validTokens.length; i += CHUNK) {
    const chunk = validTokens.slice(i, i + CHUNK);
    const messages: PushMessage[] = chunk.map((to) => {
      const msg: PushMessage = {
        to,
        title,
        body,
        priority: "high",
        channelId: "default",
        sound: "default",
      };
      if (data != null) msg.data = data;
      if (image) msg.image = image;
      return msg;
    });
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        console.error("[PUSH] Expo API error:", res.status, await res.text().catch(() => ""));
      }
    } catch (e) {
      console.error("[PUSH] Network error:", e);
    }
  }
}

export async function sendPushToUser(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!token) return;
  await sendPushNotifications([token], title, body, data);
}
