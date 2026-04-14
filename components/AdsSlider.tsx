import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  I18nManager,
  Platform,
  Pressable,
  Linking,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import type { BannerAd } from "@/constants/fallbackBannerAds";
import { sanitizeBannerLinkUrl } from "@/lib/banner-ad-utils";

const FALLBACK_LOCAL = require("../assets/images/icon.png");

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CARD_RADIUS = 28;

const TEXT_SHADOW = Platform.select({
  ios: {
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  android: {
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  default: {},
});

type AdSlideProps = {
  item: BannerAd;
  width: number;
  height: number;
  flipBack?: boolean;
};

const AdSlide = React.memo(function AdSlide({ item, width, height, flipBack }: AdSlideProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const uri = (item.image ?? "").trim();
  const titleText = (item.title ?? "").trim();
  const subtitleText = (item.subtitle ?? "").trim();
  const linkUrl = sanitizeBannerLinkUrl(item.linkUrl);

  useEffect(() => {
    setImageFailed(false);
  }, [item.id, uri]);

  useEffect(() => {
    console.log("[Ads] image URL (slide):", { id: item.id, uri });
  }, [item.id, uri]);

  const openLink = useCallback(() => {
    if (!linkUrl) return;
    Linking.openURL(linkUrl).catch((err) => {
      console.warn("[Ads] open URL failed:", linkUrl, err);
    });
  }, [linkUrl]);

  const overlays = (
    <>
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.12)", "rgba(0,0,0,0.38)"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={slideStyles.bottomFade}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.08)", "transparent"]}
        locations={[0, 0.5]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.35 }}
        style={slideStyles.topHighlight}
        pointerEvents="none"
      />
      <View style={slideStyles.textOverlay} pointerEvents="none">
        <Text style={slideStyles.title} numberOfLines={2}>
          {titleText}
        </Text>
        <Text style={slideStyles.subtitle} numberOfLines={2}>
          {subtitleText}
        </Text>
      </View>
      <LinearGradient
        colors={[`${Colors.primary}99`, `${Colors.primary}33`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={slideStyles.bottomAccent}
        pointerEvents="none"
      />
    </>
  );

  const cardBody = (
    <View
      style={[
        slideStyles.cardWrap,
        { width, height, borderRadius: CARD_RADIUS },
        flipBack && { transform: [{ scaleX: -1 }] },
      ]}
    >
      <View style={[slideStyles.imageBox, { borderRadius: CARD_RADIUS }]}>
        <Image
          source={imageFailed || !uri ? FALLBACK_LOCAL : { uri }}
          style={slideStyles.imageFill}
          resizeMode="cover"
          onError={() => {
            console.warn("[Ads] image load failure:", item.id, uri);
            setImageFailed(true);
          }}
        />
        {overlays}
      </View>
    </View>
  );

  if (linkUrl) {
    return (
      <Pressable
        onPress={openLink}
        accessibilityRole="link"
        accessibilityLabel={titleText || subtitleText || "محتوى ترويجي"}
        style={({ pressed }) => [pressed && { opacity: 0.94 }]}
      >
        {cardBody}
      </Pressable>
    );
  }

  return cardBody;
});

const slideStyles = StyleSheet.create({
  cardWrap: {
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  imageBox: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#1F2937",
  },
  imageFill: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "46%",
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
  },
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "38%",
  },
  textOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: 22,
    paddingTop: 8,
    gap: 6,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Cairo_700Bold",
    lineHeight: 32,
    letterSpacing: -0.3,
    ...TEXT_SHADOW,
  },
  subtitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    lineHeight: 22,
    maxWidth: "100%",
    ...TEXT_SHADOW,
  },
  bottomAccent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
  },
});

export type AdsSliderProps = {
  ads: BannerAd[];
  cardWidth: number;
  cardHeight: number;
};

export function AdsSlider({ ads, cardWidth, cardHeight }: AdsSliderProps) {
  const flatRef = useRef<FlatList<BannerAd>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isRTL = I18nManager.isRTL;
  const snap = cardWidth;

  const listKey = useMemo(() => ads.map((a) => a.id).join("|"), [ads]);

  useEffect(() => {
    setActiveIndex(0);
  }, [listKey]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / snap);
      const clamped = Math.max(0, Math.min(ads.length - 1, idx));
      setActiveIndex(clamped);
    },
    [ads.length, snap],
  );

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % ads.length;
        requestAnimationFrame(() => {
          try {
            flatRef.current?.scrollToIndex({
              index: next,
              animated: true,
              viewPosition: 0.5,
            });
          } catch {
            flatRef.current?.scrollToOffset({ offset: next * snap, animated: true });
          }
        });
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [ads.length, snap]);

  const renderItem = useCallback(
    ({ item }: { item: BannerAd }) => (
      <AdSlide item={item} width={cardWidth} height={cardHeight} flipBack={isRTL} />
    ),
    [cardWidth, cardHeight, isRTL],
  );

  return (
    <View style={styles.carousel}>
      <FlatList
        key={listKey}
        ref={flatRef}
        data={ads}
        horizontal
        style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        snapToAlignment="center"
        decelerationRate="fast"
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: snap,
          offset: index * snap,
          index,
        })}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={({ index }) => {
          requestAnimationFrame(() => {
            flatRef.current?.scrollToOffset({ offset: index * snap, animated: false });
          });
        }}
      />
      {ads.length > 1 ? (
        <View style={styles.dots}>
          {ads.map((ad, i) => (
            <View
              key={ad.id}
              style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    position: "relative",
    overflow: "visible",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotInactive: {
    width: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  dotActive: {
    width: 22,
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
      },
      default: {},
    }),
  },
});

export const adsSliderLayout = {
  screenWidth: SCREEN_WIDTH,
  horizontalPadding: 20,
  get wrapSize() {
    return Math.round(SCREEN_WIDTH - this.horizontalPadding * 2);
  },
  get cardHeight() {
    return Math.round(this.wrapSize * 0.68);
  },
};
