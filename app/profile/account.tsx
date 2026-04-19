import React, { useEffect, useState } from "react";
import {
View,
Text,
StyleSheet,
TextInput,
Pressable,
Image,
ScrollView,
Platform,
Alert,
Modal,
} from "react-native";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/context/ThemeContext";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";

export default function AccountScreen(){

const { colors, isDark } = useTheme();const insets=useSafeAreaInsets()
const { user, updateProfile } = useAuth()
const { t } = useLang()
const [name,setName]=useState(user?.name ?? "")
const [position,setPosition]=useState("مهاجم")
const [image,setImage]=useState<string | null>(user?.profileImage ?? null)
const [birthDate,setBirthDate] = useState(
  user?.dateOfBirth ? new Date(user.dateOfBirth) : new Date()
)
const topPadding=Platform.OS==="web"?67:insets.top
const [showDate,setShowDate] = useState(false)
useEffect(()=>{
  if(!user) return;
  setName(user.name ?? "")
  setImage(user.profileImage ?? null)
  setBirthDate(user.dateOfBirth ? new Date(user.dateOfBirth) : new Date())
},[user])
const pickImage = async () => {
if (Platform.OS !== "web") {
const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
if (status !== "granted") {
Alert.alert(t("errors.permissionRequired"), t("errors.photoPermission"))
return
}
}

const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ImagePicker.MediaTypeOptions.Images,
allowsEditing: true,
aspect: [1,1],
quality: 0.7
})

if (!result.canceled) {
setImage(result.assets[0].uri)
}

}

return(

<View style={[styles.container,{backgroundColor:colors.background,paddingTop:topPadding}]}>

<ScrollView contentContainerStyle={{padding:20}}>

{/* AVATAR */}

<View style={styles.avatarContainer}>

<Pressable onPress={pickImage}>

{image?

<Image source={{uri:image}} style={styles.avatar}/>

:

<View style={[styles.avatar,{backgroundColor:colors.surface}]}>

<Ionicons name="person" size={40} color={colors.textSecondary}/>

</View>

}

<View style={styles.cameraIcon}>
<Ionicons name="camera" size={16} color="#fff"/>
</View>

</Pressable>

</View>

{/* NAME */}

<Text style={[styles.label,{color:colors.text}]}>
{t("account.name")}
</Text>

<TextInput
value={name}
onChangeText={setName}
style={[
styles.input,
{
backgroundColor:colors.card,
borderColor:colors.border,
color:colors.text
}
]}
/>
{user?.playerId ? (
  <>
    <Text style={[styles.label, { color: colors.text }]}>{t("account.playerId")}</Text>
    <View
      style={[
        styles.input,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          justifyContent: "center",
        },
      ]}
    >
      <Text
        selectable
        style={{
          color: colors.textSecondary,
          fontFamily: "Cairo_600SemiBold",
          letterSpacing: 1,
        }}
      >
        {user.playerId}
      </Text>
    </View>
    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12, marginTop: 4 }}>
      معرّف ثابت يربط حجوزاتك وإشعاراتك داخل التطبيق ولا يمكن تغييره.
    </Text>
  </>
) : null}
<Pressable
  onPress={() => setShowDate(true)}
  style={[
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
  ]}
>
  <Text style={{ color: colors.text, fontFamily: "Cairo_400Regular" }}>
    {`${birthDate.getFullYear()} / ${birthDate.getMonth() + 1} / ${birthDate.getDate()}`}
  </Text>
  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
</Pressable>
{Platform.OS === "android" && showDate ? (
  <DateTimePicker
    value={birthDate}
    mode="date"
    display="default"
    maximumDate={new Date()}
    onChange={(_e, date) => {
      setShowDate(false);
      if (date) setBirthDate(date);
    }}
  />
) : null}

{/* POSITION */}

<Text style={[styles.label,{color:colors.text}]}>
{t("account.position")}
</Text>

<View style={styles.positions}>

{[
  t("positions.forward"),
  t("positions.midfielder"),
  t("positions.defender"),
  t("positions.goalkeeper"),
].map(p=>(

<Pressable
key={p}
style={[
styles.positionBtn,
{
borderColor:position===p?Colors.primary:colors.border,
backgroundColor:position===p?"rgba(15,157,88,0.15)":colors.card
}
]}
onPress={()=>setPosition(p)}
>

<Text
style={[
styles.positionText,
{color:position===p?Colors.primary:colors.textSecondary}
]}
>
{p}
</Text>

</Pressable>

))}

</View>

{/* SAVE */}

<Pressable
  style={styles.saveBtn}
  onPress={async () => {
    try {
      if (!user) {
        Alert.alert(t("common.warningTitle"), t("account.loginFirst"));
        return;
      }
      const y = birthDate.getFullYear();
      const m = String(birthDate.getMonth() + 1).padStart(2, "0");
      const d = String(birthDate.getDate()).padStart(2, "0");
      const ymd = `${y}-${m}-${d}`;
      await updateProfile({
        name: name.trim() || user.name,
        dateOfBirth: ymd,
        profileImage: image ?? undefined,
      });
      Alert.alert(t("common.done"), t("account.saveSuccess"));
    } catch (e: any) {
      Alert.alert(t("common.errorTitle"), e?.message ?? t("errors.failedToSave"));
    }
  }}
>

<Text style={styles.saveText}>
{t("common.saveChanges")}
</Text>

</Pressable>
{/* DELETE ACCOUNT */}
<Pressable
style={styles.deleteBtn}
onPress={()=>router.push("/profile/delete-account")}
>

<Text style={styles.deleteText}>
{t("account.deleteAccount")}
</Text>

</Pressable>
</ScrollView>
{Platform.OS !== "android" ? (
  <Modal visible={showDate} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View
        style={[
          styles.modalBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          {t("account.pickBirthDate")}
        </Text>
        <DateTimePicker
          value={birthDate}
          mode="date"
          display="spinner"
          themeVariant={isDark ? "dark" : "light"}
          maximumDate={new Date()}
          onChange={(_event, date) => {
            if (date) setBirthDate(date);
          }}
        />
        <Pressable style={styles.doneBtn} onPress={() => setShowDate(false)}>
          <Text style={styles.doneText}>{t("common.done")}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
) : null}
</View>

)

}

const styles=StyleSheet.create({

container:{
flex:1
},

avatarContainer:{
alignItems:"center",
marginBottom:30
},

avatar:{
width:110,
height:110,
borderRadius:55,
alignItems:"center",
justifyContent:"center"
},

cameraIcon:{
position:"absolute",
bottom:0,
right:0,
backgroundColor:Colors.primary,
width:30,
height:30,
borderRadius:15,
alignItems:"center",
justifyContent:"center"
},

label:{
fontSize:14,
fontFamily:"Cairo_600SemiBold",
marginBottom:6
},

input:{
borderWidth:1,
borderRadius:12,
paddingHorizontal:14,
height:48,
marginBottom:20,
fontFamily:"Cairo_400Regular"
},

positions:{
flexDirection:"row",
flexWrap:"wrap",
gap:10,
marginBottom:30
},

positionBtn:{
paddingHorizontal:18,
paddingVertical:10,
borderRadius:20,
borderWidth:1
},

positionText:{
fontSize:13,
fontFamily:"Cairo_600SemiBold"
},

saveBtn:{
backgroundColor:Colors.primary,
height:50,
borderRadius:14,
alignItems:"center",
justifyContent:"center"
},

saveText:{
color:"#000",
fontSize:15,
fontFamily:"Cairo_700Bold"
},
deleteBtn:{
marginTop:20,
height:48,
borderRadius:12,
borderWidth:1,
borderColor:"rgba(255,59,48,0.4)",
alignItems:"center",
justifyContent:"center",
backgroundColor:"rgba(255,59,48,0.08)"
},

deleteText:{
color:"#FF3B30",
fontSize:14,
fontFamily:"Cairo_700Bold"
},
modalOverlay:{
flex:1,
backgroundColor:"rgba(0,0,0,0.35)",
alignItems:"center",
justifyContent:"center"
},

modalBox:{
width:"85%",
borderRadius:16,
padding:20,
borderWidth:1,
},

modalTitle:{
fontSize:16,
fontFamily:"Cairo_700Bold",
marginBottom:10,
textAlign:"center"
},

doneBtn:{
marginTop:10,
backgroundColor:Colors.primary,
height:44,
borderRadius:10,
alignItems:"center",
justifyContent:"center"
},

doneText:{
color:"#000",
fontFamily:"Cairo_700Bold"
},
})