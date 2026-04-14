import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { fetchBannerAds } from "@/lib/app-data";
import { AdsSlider, adsSliderLayout } from "@/components/AdsSlider";

export function PremiumAdsBanner() {
  const { data: adsRemote, isPending } = useQuery({
    queryKey: ["banner-ads"],
    queryFn: fetchBannerAds,
    staleTime: 60_000,
  });

  const displayAds = useMemo(() => adsRemote ?? [], [adsRemote]);

  useEffect(() => {
    if (adsRemote === undefined) return;
    console.log("[Ads] banner list count:", displayAds.length);
  }, [adsRemote, displayAds.length]);

  const wrapSize = adsSliderLayout.wrapSize;
  const cardWidth = wrapSize;
  const cardHeight = adsSliderLayout.cardHeight;

  const showEmpty = !isPending && displayAds.length === 0;
  if (showEmpty) return null;

  return (
    <View style={bannerStyles.wrapper}>
      {isPending ? (
        <ActivityIndicator color={Colors.primary} style={bannerStyles.loading} />
      ) : (
        <View style={{ width: wrapSize }}>
          <AdsSlider ads={displayAds} cardWidth={cardWidth} cardHeight={cardHeight} />
        </View>
      )}
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  loading: {
    marginBottom: 8,
  },
});
