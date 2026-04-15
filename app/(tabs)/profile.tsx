import React, { useEffect, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
Pressable,
Switch,
Alert,
Platform,
Share,
Image,
Dimensions,
Modal,
ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useSegments } from "expo-router";
import { fetchWallet } from "@/lib/wallet-api";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLang, type Language } from "@/context/LanguageContext";
import * as Haptics from "expo-haptics";
import { NotificationsButton } from "@/components/NotificationsButton";
import { AppBackground } from "@/components/AppBackground";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import {
  subscribeUserSupportChatByUserId,
  computeUnreadSupportHint,
} from "@/lib/firestore-support-chat";
import { APP_DOWNLOAD_PAGE_URL } from "@/lib/app-invite-links";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const H_PADDING = Math.max(16, Math.min(22, SCREEN_WIDTH * 0.05));
const CARD_RADIUS = 20;

const PROFILE_TOKENS = {
  dark: {
    bg: "#0D0D0D",
    card: "#1A1A1A",
    cardElevated: "#202020",
    border: "rgba(255,255,255,0.08)",
    textPrimary: "#FFFFFF",
    textSecondary: "#FFFFFF",
    accent: "#00E676",
    accentSoft: "rgba(0,230,118,0.18)",
    headerFade: "rgba(13,13,13,0.72)",
    rowOverlay: "rgba(255,255,255,0.03)",
  },
  light: {
    bg: "#F7F7F7",
    card: "#FFFFFF",
    cardElevated: "#FFFFFF",
    border: "rgba(17,17,17,0.08)",
    textPrimary: "#111111",
    textSecondary: "#111111",
    accent: "#00C853",
    accentSoft: "rgba(0,200,83,0.13)",
    headerFade: "rgba(247,247,247,0.84)",
    rowOverlay: "rgba(0,0,0,0.025)",
  },
} as const;

const PLAYER_TYPE_LABELS: Record<string, string> = {
  gk: "profile.playerTypes.gk",
  def: "profile.playerTypes.def",
  mid: "profile.playerTypes.mid",
  atk: "profile.playerTypes.atk",
};

function playerTypeLabel(
  p: string | null | undefined,
  tr: (key: string) => string,
): string {
  if (!p) return tr("profile.viewProfile");
  const key = PLAYER_TYPE_LABELS[p];
  return key ? tr(key) : p;
}

function SettingRow({
icon,
label,
onPress,
rightElement,
palette,
}:{
icon:keyof typeof Ionicons.glyphMap
label:string
onPress?:()=>void
rightElement?:React.ReactNode
palette: (typeof PROFILE_TOKENS)["dark"] | (typeof PROFILE_TOKENS)["light"]
}){
const t = palette;

return(

<Pressable
style={({pressed})=>[
styles.row,
{borderBottomColor:t.border, backgroundColor: pressed ? t.rowOverlay : "transparent"},
pressed && styles.rowPressed
]}
onPress={onPress}
>

<View style={[styles.icon,{backgroundColor:t.accentSoft, borderColor: t.border}]}>
<Ionicons name={icon} size={18} color={t.accent}/>
</View>

<Text style={[styles.label,{color:t.textPrimary}]}>
{label}
</Text>

<View style={styles.right}>
{rightElement}
{onPress && !rightElement &&
<Ionicons name="chevron-back" size={16} color={t.textSecondary}/>
}
</View>

</Pressable>

)

}

export default function ProfileScreen(){

const insets=useSafeAreaInsets()
const {isDark,toggleTheme}=useTheme()
const { language, setLanguageForUser, t: tl } = useLang()
const t = isDark ? PROFILE_TOKENS.dark : PROFILE_TOKENS.light
const { user, logout, token, isGuest, refreshPlayerFromFirestore } = useAuth()
const { pushIfLoggedIn, runIfLoggedIn } = useGuestPrompt()
const segments = useSegments()
const [walletLine, setWalletLine] = useState("…")
const [profileRow, setProfileRow] = useState<{
  full_name: string | null;
  avatar_url: string | null;
  player_type: string | null;
} | null>(null)
const [supportChatUnread, setSupportChatUnread] = useState(false)
const [showLanguageModal, setShowLanguageModal] = useState(false)
const [showInviteModal, setShowInviteModal] = useState(false)
const segmentsKey = useMemo(() => segments.join("/"), [segments])

useEffect(() => {
  let cancelled = false
  if (!user?.id || isGuest || user.id === "guest") {
    setProfileRow(null)
    return
  }
  ;(async () => {
    if (!cancelled) {
      setProfileRow({
        full_name: user?.name ?? null,
        avatar_url: user?.profileImage ?? null,
        player_type: user?.position ?? null,
      })
    }
  })()
  return () => {
    cancelled = true
  }
}, [user?.id, user?.name, user?.profileImage, user?.position, isGuest])

useEffect(() => {
  if (!user?.id || isGuest || user.id === "guest") {
    setSupportChatUnread(false)
    return
  }
  let unsub: (() => void) | undefined
  try {
    unsub = subscribeUserSupportChatByUserId(user.id, (chat) => {
      setSupportChatUnread(computeUnreadSupportHint(chat))
    })
  } catch {
    setSupportChatUnread(false)
  }
  return () => {
    unsub?.()
  }
}, [user?.id, isGuest])

useEffect(() => {
  if (isGuest || !user?.phone?.trim() || user?.inviteCode?.trim()) return
  void refreshPlayerFromFirestore()
}, [isGuest, user?.phone, user?.inviteCode, refreshPlayerFromFirestore])

useEffect(() => {
  let cancelled = false
  const allowWallet =
    (!!user && !isGuest) || (GUEST_FULL_ACCESS && isGuest)
  if (!allowWallet) {
    setWalletLine("—")
    return
  }
  const walletToken = isGuest ? null : token
  setWalletLine("…")
  fetchWallet(walletToken, 1, {
    userId: !isGuest && user?.id && user.id !== "guest" ? user.id : undefined,
  })
    .then((d) => {
      if (!cancelled) {
        setWalletLine(`IQD ${d.balance.toLocaleString("en-US")}`)
      }
    })
    .catch(() => {
      if (!cancelled) setWalletLine("—")
    })
  return () => {
    cancelled = true
  }
}, [user, token, isGuest, segmentsKey])

const topPadding=Platform.OS==="web"?67:insets.top
const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom

const openInviteModal = () => {
  runIfLoggedIn(() => {
    setShowInviteModal(true)
    if (!user?.inviteCode?.trim()) {
      void refreshPlayerFromFirestore()
    }
  })
}

const inviteCodeDisplay = (user?.inviteCode ?? "").trim()

const buildInviteShareMessage = () =>
  tl("profile.inviteShareFullMessage", {
    code: inviteCodeDisplay || "—",
    link: APP_DOWNLOAD_PAGE_URL,
  })

const copyInvite = async () => {
  if (!inviteCodeDisplay) {
    Alert.alert(tl("common.warningTitle"), tl("profile.inviteCodeLoading"))
    return
  }
  try {
    const payload = `${tl("profile.inviteRewardHeadline")}\n\n${tl("profile.inviteCodeLabel")}: ${inviteCodeDisplay}\n${APP_DOWNLOAD_PAGE_URL}`
    await Clipboard.setStringAsync(payload)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert(tl("profile.inviteCopiedTitle"), tl("profile.inviteCopiedBody"))
  } catch {
    Alert.alert(tl("common.errorTitle"), tl("profile.inviteCopyFailed"))
  }
}

const shareInvite = () => {
  if (!inviteCodeDisplay) {
    Alert.alert(tl("common.warningTitle"), tl("profile.inviteCodeLoading"))
    return
  }
  void Share.share({
    title: tl("profile.inviteShareTitle"),
    message: buildInviteShareMessage(),
  }).catch(() => {})
}

const logoutConfirm=()=>{

Alert.alert(
tl("profile.logoutTitle"),
tl("profile.logoutConfirm"),
[
{ text:tl("common.no"),style:"cancel"},
{
text:tl("common.yes"),
style:"destructive",
onPress:async()=>{
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
await logout()
router.replace("/auth/player/login")
}
}
]
)

}

return (
<AppBackground>
<View style={[styles.container,{backgroundColor:"transparent",paddingTop:topPadding}]}>

<ScrollView
showsVerticalScrollIndicator={false}
contentContainerStyle={{ paddingBottom: bottomPadding + 120 }}
keyboardShouldPersistTaps="handled"
>

{/* HEADER */}

<View style={styles.header}>

<View style={styles.headerTextWrap}>
  <Text style={[styles.title,{color:t.textPrimary}]}>
  {tl("profile.title")}
  </Text>
  <Text style={[styles.headerSubTitle, { color: t.textSecondary }]}>
    {tl("profile.subtitle")}
  </Text>
</View>

<NotificationsButton showDot={false} />

</View>

{/* ACCOUNT */}

{/* PROFILE CARD */}

<Pressable
style={[
styles.profileCard,
{
  backgroundColor: t.cardElevated,
  borderColor: t.border,
},
isDark ? styles.darkGlow : styles.lightShadow
]}
onPress={()=>pushIfLoggedIn("/profile/account")}
>

<View style={styles.profileLeft}>

{profileRow?.avatar_url && /^https?:\/\//i.test(profileRow.avatar_url) ? (
<Image
source={{ uri: profileRow.avatar_url }}
style={[styles.avatar, { overflow: "hidden", borderColor: t.accentSoft }]}
resizeMode="cover"
/>
) : (
<View style={[styles.avatar,{backgroundColor:t.accentSoft, borderColor: t.border}]}>
<Ionicons name="person" size={28} color={t.accent}/>
</View>
)}

<View>

<Text style={[styles.profileName,{color:t.textPrimary}]}>
{profileRow?.full_name?.trim()
  ? profileRow.full_name
  : user?.name?.trim()
    ? user.name
    : tl("profile.guestName")}
</Text>

<Text style={[styles.profileSub,{color:t.textSecondary}]}>
{playerTypeLabel(profileRow?.player_type, tl)}
</Text>

</View>

</View>

<Ionicons name="chevron-back" size={18} color={t.textSecondary}/>

</Pressable>
{/* WALLET */}

<Pressable
style={[
styles.walletCard,
{
  backgroundColor: t.cardElevated,
  borderColor: t.border,
},
isDark ? styles.walletGlowDark : styles.walletGlowLight
]}
onPress={()=>pushIfLoggedIn("/wallet")}
>

<View style={styles.walletLeft}>

<View style={[styles.walletIcon,{backgroundColor:t.accentSoft, borderColor: t.border}]}>
<Ionicons name="wallet-outline" size={22} color={t.accent}/>
</View>

<View>

<Text style={[styles.walletTitle,{color:t.textPrimary}]}>
{tl("profile.wallet")}
</Text>

<Text style={[styles.walletSub,{color:t.textSecondary}]}>
{tl("profile.availableBalance")}
</Text>

</View>

</View>

<Text style={[styles.walletBalance,{color:t.accent}]}>
{walletLine}
</Text>

</Pressable>
{/* SETTINGS */}

<View style={[styles.group,{backgroundColor:t.card,borderColor:t.border}, isDark ? styles.darkGlow : styles.lightShadow]}>

<SettingRow
icon="moon-outline"
label={tl("profile.darkMode")}
palette={t}
rightElement={
<Switch
value={isDark}
onValueChange={()=>{
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
toggleTheme()
}}
trackColor={{true:t.accent,false:"rgba(128,128,128,0.45)"}}
thumbColor="#fff"
ios_backgroundColor="rgba(128,128,128,0.35)"
/>
}
/>
<SettingRow
icon="language-outline"
label={tl("language.title")}
palette={t}
onPress={() => setShowLanguageModal(true)}
rightElement={
  <Text style={[styles.langValue, { color: t.textSecondary }]}>
    {language === "ar" ? `🇮🇶 ${tl("language.ar")}` : language === "ku" ? `🇮🇶 ${tl("language.ku")}` : `🇺🇸 ${tl("language.en")}`}
  </Text>
}
/>

</View>

{/* TERMS */}

<View style={[styles.group,{backgroundColor:t.card,borderColor:t.border}, isDark ? styles.darkGlow : styles.lightShadow]}>

<SettingRow
icon="document-text-outline"
label={tl("profile.terms")}
palette={t}
onPress={()=>router.push("/terms")}
/>

</View>

{/* SUPPORT */}

<View style={[styles.group,{backgroundColor:t.card,borderColor:t.border}, isDark ? styles.darkGlow : styles.lightShadow]}>

<SettingRow
icon="help-circle-outline"
label={tl("profile.support")}
palette={t}
onPress={()=>router.push("/profile/support")}
/>

<SettingRow
icon="chatbubble-ellipses-outline"
label={tl("profile.liveSupportChat")}
palette={t}
onPress={()=>router.push("/profile/support-chat")}
rightElement={
<View style={styles.supportRowRight}>
{supportChatUnread ? (
<View style={[styles.supportBadge, { backgroundColor: t.accent }]}>
<Text style={styles.supportBadgeText}>{tl("common.new")}</Text>
</View>
) : null}
<Ionicons name="chevron-back" size={16} color={t.textSecondary}/>
</View>
}
/>

</View>

{/* RATE APP */}

<View style={[styles.group,{backgroundColor:t.card,borderColor:t.border}, isDark ? styles.darkGlow : styles.lightShadow]}>

<SettingRow
icon="star-outline"
label={tl("profile.rateApp")}
palette={t}
/>

</View>

{/* UPDATE */}

<View style={[styles.group,{backgroundColor:t.card,borderColor:t.border}, isDark ? styles.darkGlow : styles.lightShadow]}>

<SettingRow
icon="refresh-outline"
label={tl("profile.updateApp")}
palette={t}
/>

<SettingRow
icon="grid-outline"
label={tl("profile.shoothaPlatforms")}
palette={t}
onPress={() => router.push("/profile/shootah-platforms")}
/>

</View>

{/* INVITE */}

<View style={[styles.group,{backgroundColor:t.card,borderColor:t.border}, isDark ? styles.darkGlow : styles.lightShadow]}>

<SettingRow
icon="share-social-outline"
label={tl("profile.inviteFriend")}
palette={t}
onPress={openInviteModal}
/>

</View>

{/* LOGOUT */}

<View style={[styles.group,{backgroundColor:t.card,borderColor:t.border}, isDark ? styles.darkGlow : styles.lightShadow]}>

<SettingRow
icon="log-out-outline"
label={tl("profile.logout")}
palette={t}
onPress={logoutConfirm}
/>

</View>

 </ScrollView>

  <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
    <Pressable style={styles.modalOverlay} onPress={() => setShowInviteModal(false)}>
      <Pressable
        style={[styles.inviteModalBox, { backgroundColor: t.card, borderColor: t.border }]}
        onPress={(e) => e.stopPropagation()}
      >
        <Text style={[styles.inviteModalTitle, { color: t.textPrimary }]}>{tl("profile.inviteFriend")}</Text>
        <Text style={[styles.inviteRewardText, { color: t.textSecondary }]}>{tl("profile.inviteRewardHeadline")}</Text>
        <Text style={[styles.inviteCodeLabel, { color: t.textSecondary }]}>{tl("profile.inviteCodeLabel")}</Text>
        {inviteCodeDisplay ? (
          <View style={[styles.inviteCodePill, { borderColor: t.accent, backgroundColor: t.accentSoft }]}>
            <Text style={[styles.inviteCodeText, { color: t.textPrimary }]} selectable>
              {inviteCodeDisplay}
            </Text>
          </View>
        ) : (
          <View style={styles.inviteLoadingRow}>
            <ActivityIndicator color={t.accent} />
            <Text style={[styles.inviteLoadingText, { color: t.textSecondary }]}>{tl("profile.inviteCodeLoading")}</Text>
          </View>
        )}
        <Text style={[styles.inviteLinkHint, { color: t.textSecondary }]} numberOfLines={2}>
          {APP_DOWNLOAD_PAGE_URL}
        </Text>
        <View style={styles.inviteActions}>
          <Pressable
            style={[styles.inviteActionBtn, { backgroundColor: t.rowOverlay, borderColor: t.border }]}
            onPress={copyInvite}
          >
            <Ionicons name="copy-outline" size={18} color={t.accent} />
            <Text style={[styles.inviteActionBtnText, { color: t.textPrimary }]}>{tl("profile.inviteCopy")}</Text>
          </Pressable>
          <Pressable style={[styles.inviteActionBtn, styles.inviteActionPrimary, { backgroundColor: t.accent }]} onPress={shareInvite}>
            <Ionicons name="share-social-outline" size={18} color="#000" />
            <Text style={[styles.inviteActionBtnText, { color: "#000" }]}>{tl("profile.inviteShare")}</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.modalDone, { backgroundColor: t.rowOverlay, marginTop: 8 }]} onPress={() => setShowInviteModal(false)}>
          <Text style={[styles.modalDoneText, { color: t.textPrimary }]}>{tl("common.done")}</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  </Modal>

 <Modal visible={showLanguageModal} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.modalTitle, { color: t.textPrimary }]}>{tl("language.select")}</Text>
      {(
        [
          { id: "ar", label: `🇮🇶 ${tl("language.ar")}` },
          { id: "ku", label: `🇮🇶 ${tl("language.ku")}` },
          { id: "en", label: `🇺🇸 ${tl("language.en")}` },
        ] as { id: Language; label: string }[]
      ).map((opt) => (
        <Pressable
          key={opt.id}
          style={[
            styles.modalOption,
            { borderColor: t.border, backgroundColor: language === opt.id ? t.accentSoft : t.card },
          ]}
          onPress={async () => {
            await setLanguageForUser(opt.id, user?.id);
            setShowLanguageModal(false);
          }}
        >
          <Text style={{ color: language === opt.id ? t.accent : t.textPrimary, fontFamily: "Cairo_600SemiBold" }}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
      <Pressable style={[styles.modalDone, { backgroundColor: t.accent }]} onPress={() => setShowLanguageModal(false)}>
        <Text style={styles.modalDoneText}>{tl("common.done")}</Text>
      </Pressable>
    </View>
  </View>
 </Modal>

</View>
</AppBackground>
);

}

const styles=StyleSheet.create({

container:{
flex:1
},

header:{
flexDirection:"row",
alignItems:"center",
justifyContent:"space-between",
paddingHorizontal:H_PADDING,
paddingBottom:16
},
headerTextWrap: {
  gap: 2,
},

title:{
fontSize:28,
fontFamily:"Cairo_700Bold",
letterSpacing:0.2,
lineHeight:38,
},
headerSubTitle: {
  fontSize: 13,
  fontFamily: "Cairo_400Regular",
  lineHeight: 18,
},


group:{
borderRadius:CARD_RADIUS,
borderWidth:1,
marginHorizontal:H_PADDING,
marginBottom:14,
overflow:"hidden"
},

row:{
flexDirection:"row",
alignItems:"center",
paddingHorizontal:16,
paddingVertical:15,
borderBottomWidth:1,
gap:12
},
rowPressed: {
  transform: [{ scale: 0.97 }],
},

icon:{
width:34,
height:34,
borderRadius:10,
alignItems:"center",
justifyContent:"center",
borderWidth: 1,
},

label:{
flex:1,
fontSize:15,
fontFamily:"Cairo_600SemiBold"
},

right:{
flexDirection:"row",
alignItems:"center",
gap:6
},
profileCard:{
flexDirection:"row",
alignItems:"center",
justifyContent:"space-between",
borderWidth:1,
borderRadius:CARD_RADIUS,
marginHorizontal:H_PADDING,
paddingVertical:18,
paddingHorizontal:16,
marginBottom:16
},

profileLeft:{
flexDirection:"row",
alignItems:"center",
gap:14
},

avatar:{
width:64,
height:64,
borderRadius:32,
alignItems:"center",
justifyContent:"center",
borderWidth: 1,
},

profileName:{
fontSize:17,
fontFamily:"Cairo_700Bold",
lineHeight: 24,
},

profileSub:{
fontSize:13,
fontFamily:"Cairo_400Regular",
marginTop:2,
lineHeight: 19,
},
walletCard:{
flexDirection:"row",
alignItems:"center",
justifyContent:"space-between",
borderWidth:1,
borderRadius:CARD_RADIUS,
marginHorizontal:H_PADDING,
paddingVertical:18,
paddingHorizontal:16,
marginBottom:16
},

walletLeft:{
flexDirection:"row",
alignItems:"center",
gap:14
},

walletIcon:{
width:50,
height:50,
borderRadius:14,
alignItems:"center",
justifyContent:"center",
borderWidth: 1,
},

walletTitle:{
fontSize:16,
fontFamily:"Cairo_700Bold",
lineHeight: 23,
},

walletSub:{
fontSize:12,
fontFamily:"Cairo_400Regular",
lineHeight: 18,
},

walletBalance:{
fontSize:20,
fontFamily:"Cairo_700Bold",
letterSpacing:0.2,
lineHeight: 28,
},
darkGlow: {
  shadowColor: "#00E676",
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 0,
},
walletGlowDark: {
  shadowColor: "#00E676",
  shadowOpacity: 0.2,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 0,
},
walletGlowLight: {
  shadowColor: "#0A0A0A",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
},
lightShadow: {
  shadowColor: "#0A0A0A",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
},
supportRowRight: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
},
supportBadge: {
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 8,
},
supportBadgeText: {
  fontSize: 11,
  fontFamily: "Cairo_700Bold",
  color: "#0D0D0D",
},
langValue: {
  fontSize: 13,
  fontFamily: "Cairo_600SemiBold",
},
modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.38)",
  alignItems: "center",
  justifyContent: "center",
},
modalBox: {
  width: "84%",
  borderRadius: 16,
  borderWidth: 1,
  padding: 14,
},
modalTitle: {
  fontSize: 16,
  fontFamily: "Cairo_700Bold",
  textAlign: "center",
  marginBottom: 10,
},
modalOption: {
  borderWidth: 1,
  borderRadius: 12,
  height: 46,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 8,
},
modalDone: {
  marginTop: 4,
  borderRadius: 12,
  height: 44,
  alignItems: "center",
  justifyContent: "center",
},
modalDoneText: {
  color: "#0D0D0D",
  fontFamily: "Cairo_700Bold",
},
inviteModalBox: {
  width: "88%",
  maxWidth: 400,
  borderRadius: 18,
  borderWidth: 1,
  padding: 18,
},
inviteModalTitle: {
  fontSize: 17,
  fontFamily: "Cairo_700Bold",
  textAlign: "center",
  marginBottom: 10,
},
inviteRewardText: {
  fontSize: 14,
  fontFamily: "Cairo_600SemiBold",
  textAlign: "center",
  lineHeight: 22,
  marginBottom: 16,
},
inviteCodeLabel: {
  fontSize: 12,
  fontFamily: "Cairo_600SemiBold",
  textAlign: "center",
  marginBottom: 6,
},
inviteCodePill: {
  borderWidth: 2,
  borderRadius: 14,
  paddingVertical: 14,
  paddingHorizontal: 16,
  alignSelf: "stretch",
  alignItems: "center",
},
inviteCodeText: {
  fontSize: 22,
  fontFamily: "Cairo_700Bold",
  letterSpacing: 3,
},
inviteLoadingRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  paddingVertical: 16,
},
inviteLoadingText: {
  fontSize: 13,
  fontFamily: "Cairo_400Regular",
},
inviteLinkHint: {
  fontSize: 11,
  fontFamily: "Cairo_400Regular",
  textAlign: "center",
  marginTop: 10,
  marginBottom: 4,
},
inviteActions: {
  flexDirection: "row",
  gap: 10,
  marginTop: 14,
},
inviteActionBtn: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: 12,
  borderWidth: 1,
  paddingVertical: 12,
},
inviteActionPrimary: {
  borderWidth: 0,
},
inviteActionBtnText: {
  fontSize: 13,
  fontFamily: "Cairo_700Bold",
},
})