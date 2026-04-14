import React, { useMemo } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { AdsSlider, adsSliderLayout } from "@/components/AdsSlider";
import { DEMO_ADS_WHEN_EMPTY } from "@/constants/fallbackBannerAds";
import { fetchStoreAds } from "@/lib/firestore-marketplace";

export function StoreAdsBanner() {
  const { data: adsRemote, isPending } = useQuery({
    queryKey: ["store-ads"],
    queryFn: fetchStoreAds,
    staleTime: 60_000,
  });

  const displayAds = useMemo(() => {
    const src = (adsRemote && adsRemote.length > 0 ? adsRemote : DEMO_ADS_WHEN_EMPTY).slice(0, 3);
    if (src.length >= 3) return src;
    const out = [...src];
    let i = 0;
    while (out.length < 3) {
      const base = src[i % src.length] ?? DEMO_ADS_WHEN_EMPTY[0];
      out.push({ ...base, id: `${base.id}-dup-${out.length}` });
      i += 1;
    }
    return out;
  }, [adsRemote]);

  if (!isPending && displayAds.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      {isPending ? (
        <ActivityIndicator color={Colors.primary} style={styles.loading} />
      ) : (
        <View style={{ width: adsSliderLayout.wrapSize }}>
          <AdsSlider
            ads={displayAds}
            cardWidth={adsSliderLayout.wrapSize}
            cardHeight={Math.round(adsSliderLayout.cardHeight * 0.5)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  loading: {
    marginBottom: 8,
  },
});
