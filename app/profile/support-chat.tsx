import React from "react";
import { ChatScreen } from "@/components/support-chat/ChatScreen";
import { useLang } from "@/context/LanguageContext";

export default function SupportChatRoute() {
  const { t } = useLang();

  return (
    <ChatScreen
      title={t("supportChatTitle")}
      emptyTitle={t("supportChatEmptyTitle")}
      emptySubtitle={t("supportChatEmptySubtitle")}
      loadError={t("supportChatLoadError")}
      sendError={t("supportChatSendError")}
      inputPlaceholder={t("supportChatInputPlaceholder")}
      sendLabel={t("send")}
      statusOpen={t("supportChatStatusOpen")}
      statusClosed={t("supportChatStatusClosed")}
      guestMessage={t("supportChatGuestMessage")}
    />
  );
}
