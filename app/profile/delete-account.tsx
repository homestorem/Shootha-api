import React,{useState} from "react";
import {
View,
Text,
TextInput,
StyleSheet,
Pressable,
Alert,
Platform
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { router } from "expo-router";

export default function DeleteAccount(){

const {colors}=useTheme()
const insets=useSafeAreaInsets()

const [otp,setOtp]=useState("")

const topPadding=Platform.OS==="web"?67:insets.top

const verifyOtp=()=>{

if(otp.length!==6){

Alert.alert("خطأ","أدخل رمز التحقق الصحيح")

return
}

Alert.alert(
"تم حذف الحساب",
"تم حذف حسابك بنجاح"
)

router.replace("/auth/player/login")

}

return(

<View style={[
styles.container,
{backgroundColor:colors.background,paddingTop:topPadding}
]}>

<View style={styles.content}>

<Text style={[styles.title,{color:colors.text}]}>
تأكيد حذف الحساب
</Text>

<Text style={[styles.text,{color:colors.textSecondary}]}>
أدخل رمز التحقق المرسل إلى رقم هاتفك لتأكيد حذف الحساب
</Text>

<TextInput
value={otp}
onChangeText={setOtp}
keyboardType="number-pad"
maxLength={6}
style={[
styles.input,
{
backgroundColor:colors.card,
borderColor:colors.border,
color:colors.text
}
]}
/>

<Pressable
style={styles.deleteBtn}
onPress={verifyOtp}
>

<Text style={styles.deleteText}>
تأكيد الحذف
</Text>

</Pressable>

</View>

</View>

)

}

const styles=StyleSheet.create({

container:{
flex:1
},

content:{
padding:20
},

title:{
fontSize:22,
fontFamily:"Cairo_700Bold",
marginBottom:10
},

text:{
fontSize:14,
lineHeight:22,
fontFamily:"Cairo_400Regular",
marginBottom:20
},

input:{
borderWidth:1,
borderRadius:12,
height:50,
paddingHorizontal:16,
fontSize:18,
letterSpacing:10,
textAlign:"center",
marginBottom:20
},

deleteBtn:{
backgroundColor:"#FF3B30",
height:50,
borderRadius:12,
alignItems:"center",
justifyContent:"center"
},

deleteText:{
color:"#fff",
fontSize:15,
fontFamily:"Cairo_700Bold"
}

})