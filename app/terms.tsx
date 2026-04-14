import { Text, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "@/context/ThemeContext";

export default function Terms(){

const {colors}=useTheme()

return(

<ScrollView
style={[styles.container,{backgroundColor:colors.background}]}
contentContainerStyle={{padding:20}}
>

<Text style={[styles.title,{color:colors.text}]}>
الشروط والأحكام
</Text>

{/* Terms */}

<Text style={[styles.sectionTitle,{color:colors.text}]}>
سياسة شروط الاستخدام (Terms of Service)
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
يهدف تطبيق «شوتها» إلى تسهيل حجز ملاعب كرة القدم وتنظيم المباريات بين اللاعبين. باستخدامك التطبيق فإنك توافق على الشروط التالية:
</Text>

<Text style={[styles.subTitle,{color:colors.text}]}>
التسجيل والتوثيق (Authentication & Accounts)
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• يتم إنشاء الحسابات حصراً باستخدام رقم هاتف عراقي فعال.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• يتم التحقق من الحساب عبر رمز تحقق (OTP) يُرسل عبر WhatsApp.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• أي محاولة للتلاعب أو استخدام أرقام وهمية قد تؤدي إلى حظر الحساب ومعرف الجهاز (Device ID) بشكل دائم.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• يتحمل المستخدم المسؤولية الكاملة عن أي نشاط يتم عبر حسابه.
</Text>


<Text style={[styles.subTitle,{color:colors.text}]}>
سياسة الحجز والإلغاء (Booking & Cancellation)
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• الحجز يمثل اتفاقاً بين المستخدم وصاحب الملعب، ويعمل التطبيق كوسيط تقني فقط.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• لا يسمح بإلغاء الحجز قبل أقل من 6 ساعات من موعد المباراة.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• الإلغاء المتأخر يسجل نقطة إنذار (Strike) في الملف الشخصي للمستخدم.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• التخلف عن الحضور مرتين يؤدي إلى إدراج رقم الهاتف ومعرف الجهاز في القائمة السوداء للنظام.
</Text>


<Text style={[styles.subTitle,{color:colors.text}]}>
المدفوعات والتعاملات المالية (Payments)
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• العربون المدفوع للحجز غير قابل للاسترداد في حالة الإلغاء المتأخر أو عدم الحضور.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• ميزة تقسيم المبلغ (القطية) هي أداة حسابية فقط، ولا يتحمل التطبيق مسؤولية أي نزاعات مالية بين اللاعبين.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• عمليات شراء المنتجات أو التذاكر من المتجر تخضع لسياسات التاجر أو الجهة المنظمة.
</Text>


<Text style={[styles.subTitle,{color:colors.text}]}>
إخلاء المسؤولية (Liability Disclaimer)
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• التطبيق غير مسؤول عن الإصابات الرياضية أو فقدان الممتلكات داخل الملاعب.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• أي مطالبات أو تعويضات يجب أن توجه مباشرة إلى إدارة الملعب.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• روابط البث المباشر داخل التطبيق هي روابط خارجية ولا يتم استضافة أي محتوى على خوادم التطبيق.
</Text>


{/* Privacy */}

<Text style={[styles.sectionTitle,{color:colors.text}]}>
سياسة الخصوصية (Privacy Policy)
</Text>

<Text style={[styles.subTitle,{color:colors.text}]}>
البيانات التي يتم جمعها (Data Collection)
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• البيانات الشخصية: الاسم، رقم الهاتف، الجنس، والاهتمامات الرياضية.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• البيانات التقنية: الموقع الجغرافي (GPS)، معرف الجهاز (Device ID)، ونوع نظام التشغيل.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• البيانات السلوكية: سجل الحجوزات، التفاعل داخل التطبيق، وعمليات الشراء.
</Text>


<Text style={[styles.subTitle,{color:colors.text}]}>
استخدام البيانات (Data Usage)
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• يتم مشاركة اسم ورقم هاتف قائد الفريق فقط مع صاحب الملعب لتأكيد الحجز.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• يتم استخدام الموقع الجغرافي لعرض الملاعب القريبة وتنظيم الدعوات المحلية.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• قد تستخدم أرقام الهواتف لإنشاء جماهير مخصصة للحملات الإعلانية الخاصة بالتطبيق.
</Text>


<Text style={[styles.subTitle,{color:colors.text}]}>
صلاحيات الجهاز (Device Permissions)
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• الموقع: لعرض الملاعب القريبة.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• الإشعارات: لإرسال تأكيدات الحجز والتنبيهات.
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• الكاميرا والمعرض: لرفع صور الملاعب أو تحديث صورة الملف الشخصي.
</Text>


<Text style={[styles.subTitle,{color:colors.text}]}>
حماية البيانات (Data Protection)
</Text>

<Text style={[styles.paragraph,{color:colors.textSecondary}]}>
• لا يتم بيع بيانات المستخدمين لأي طرف ثالث خارج منظومة تشغيل التطبيق.
</Text>

</ScrollView>

)

}

const styles=StyleSheet.create({

container:{flex:1},

title:{
fontSize:24,
fontFamily:"Cairo_700Bold",
marginBottom:20
},

sectionTitle:{
fontSize:18,
fontFamily:"Cairo_700Bold",
marginTop:16,
marginBottom:10
},

subTitle:{
fontSize:15,
fontFamily:"Cairo_600SemiBold",
marginTop:12,
marginBottom:6
},

paragraph:{
fontSize:14,
lineHeight:24,
fontFamily:"Cairo_400Regular",
marginBottom:6
}

})