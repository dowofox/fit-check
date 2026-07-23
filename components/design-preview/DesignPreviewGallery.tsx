import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import {
  Image,
  type ImageStyle,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  DESIGN_PREVIEW_CONCEPTS,
  DESIGN_PREVIEW_ITEMS,
  DESIGN_PREVIEW_OUTFIT_ITEMS,
  DESIGN_PREVIEW_READINESS,
  DESIGN_PREVIEW_READY,
  DESIGN_PREVIEW_SCREENS,
  getDesignPreviewConcept,
  getDesignPreviewScreen,
  type DesignPreviewConceptId,
  type DesignPreviewItem,
  type DesignPreviewScreenId,
  type DesignPreviewTokens,
} from "@/components/design-preview/designPreviewData";
import { AlternativePreviewApp } from "@/components/design-preview/AlternativeDesignPreviews";
import { ExperimentalPreviewApp } from "@/components/design-preview/ExperimentalDesignPreviews";

type NavigateToScreen = (screen: DesignPreviewScreenId) => void;

function PreviewButton({
  theme,
  label,
  icon = "arrow-right",
  secondary = false,
  compact = false,
  inline = false,
  onPress,
}: {
  theme: DesignPreviewTokens;
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  secondary?: boolean;
  compact?: boolean;
  inline?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[
        styles.button,
        inline ? styles.buttonInline : styles.buttonBlock,
        {
          minHeight: compact ? 44 : 50,
          borderRadius: theme.radius,
          backgroundColor: secondary ? theme.surfaceAlt : theme.accent,
          borderColor: secondary ? theme.border : theme.accent,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.buttonText,
          { color: secondary ? theme.text : theme.accentText },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Feather
        name={icon}
        size={15}
        color={secondary ? theme.text : theme.accentText}
      />
    </Pressable>
  );
}

function PreviewTag({
  theme,
  children,
  active = false,
}: {
  theme: DesignPreviewTokens;
  children: string;
  active?: boolean;
}) {
  return (
    <View
      style={[
        styles.tag,
        {
          borderRadius: theme.code === "B" ? 4 : 999,
          backgroundColor: active ? theme.accent : theme.surfaceAlt,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <Text
        style={[
          styles.tagText,
          { color: active ? theme.accentText : theme.muted },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

function ProgressBar({
  theme,
  value,
}: {
  theme: DesignPreviewTokens;
  value: number;
}) {
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.surfaceAlt }]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.max(0, Math.min(value, 1)) * 100}%`,
            backgroundColor: theme.accent,
          },
        ]}
      />
    </View>
  );
}

function ProductImage({
  source,
  radius,
  style,
}: {
  source: ImageSourcePropType;
  radius: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={source}
      resizeMode="cover"
      style={[styles.productImage, { borderRadius: radius }, style]}
    />
  );
}

function ProductTile({
  item,
  theme,
  dense = false,
  showMeta = true,
}: {
  item: DesignPreviewItem;
  theme: DesignPreviewTokens;
  dense?: boolean;
  showMeta?: boolean;
}) {
  return (
    <View style={styles.productTile}>
      <ProductImage
        source={item.image}
        radius={theme.imageRadius}
        style={{ aspectRatio: dense ? 0.92 : 1 }}
      />
      <Text
        style={[styles.productName, { color: theme.text }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
      {showMeta ? (
        <Text style={[styles.productMeta, { color: theme.muted }]} numberOfLines={1}>
          {item.meta}
        </Text>
      ) : null}
    </View>
  );
}

function SectionHeading({
  theme,
  title,
  action,
}: {
  theme: DesignPreviewTokens;
  title: string;
  action?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {action ? (
        <Text style={[styles.sectionAction, { color: theme.accent }]}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

function ScreenHeader({
  theme,
  title,
  subtitle,
}: {
  theme: DesignPreviewTokens;
  title: string;
  subtitle?: string;
}) {
  if (theme.code === "A") {
    return (
      <View style={styles.editorialHeader}>
        <Text style={[styles.previewLogo, { color: theme.text }]}>NAES</Text>
        <View style={styles.headerTextRow}>
          <View style={styles.flexOne}>
            <Text style={[styles.editorialTitle, { color: theme.text }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Feather name="menu" size={20} color={theme.text} />
        </View>
      </View>
    );
  }

  if (theme.code === "B") {
    return (
      <View
        style={[styles.minimalHeader, { borderBottomColor: theme.border }]}
      >
        <View>
          <Text style={[styles.minimalTitle, { color: theme.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.minimalSubtitle, { color: theme.muted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerIcons}>
          <Feather name="search" size={19} color={theme.text} />
          <Feather name="more-horizontal" size={20} color={theme.text} />
        </View>
      </View>
    );
  }

  if (theme.code === "C") {
    return (
      <View style={styles.utilityHeader}>
        <View style={styles.flexOne}>
          <Text style={[styles.utilityEyebrow, { color: theme.accent }]}>
            오늘의 NAES
          </Text>
          <Text style={[styles.utilityTitle, { color: theme.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.utilityAvatar,
            { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.utilityAvatarText, { color: theme.accent }]}>D</Text>
        </View>
      </View>
    );
  }

  if (theme.code === "E") {
    return (
      <View style={styles.hybridHeader}>
        <View style={styles.hybridHeaderTop}>
          <View style={[styles.hybridEdition, { backgroundColor: theme.accent }]}>
            <Text style={[styles.hybridEditionText, { color: theme.accentText }]}>
              NAES / EDITION 05
            </Text>
          </View>
          <Feather name="menu" size={19} color={theme.text} />
        </View>
        <Text style={[styles.hybridTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.darkHeader}>
      <Text style={[styles.darkLogo, { color: theme.accent }]}>NAES / 06</Text>
      <Text style={[styles.darkTitle, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.darkSubtitle, { color: theme.muted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function AnalysisStatus({
  theme,
  compact = false,
}: {
  theme: DesignPreviewTokens;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.analysisStatus,
        {
          backgroundColor:
            theme.code === "D" ? theme.surfaceAlt : theme.surface,
          borderColor: theme.border,
          borderRadius: theme.code === "B" ? 4 : 14,
          paddingVertical: compact ? 8 : 10,
        },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
      <Text style={[styles.analysisStatusText, { color: theme.text }]}>
        옷장 분석 최신화 중 · 5/12
      </Text>
      <Feather name="chevron-right" size={15} color={theme.muted} />
    </View>
  );
}

function PreviewBottomNav({
  theme,
  active,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  active: "home" | "closet" | "outfit" | "profile" | "add";
  onNavigate: NavigateToScreen;
}) {
  const items: {
    id: typeof active;
    label: string;
    icon: keyof typeof Feather.glyphMap;
    screen: DesignPreviewScreenId;
  }[] = [
    { id: "home", label: "홈", icon: "home", screen: "home" },
    { id: "closet", label: "옷장", icon: "grid", screen: "closet" },
    { id: "add", label: "추가", icon: "plus", screen: "add" },
    { id: "outfit", label: "코디", icon: "star", screen: "ready" },
    { id: "profile", label: "마이", icon: "user", screen: "profile" },
  ];

  return (
    <View
      style={[
        styles.previewBottomNav,
        {
          backgroundColor:
            theme.code === "D" ? "rgba(23,25,28,0.98)" : theme.surface,
          borderTopColor: theme.border,
          borderTopLeftRadius: theme.code === "C" ? 24 : 0,
          borderTopRightRadius: theme.code === "C" ? 24 : 0,
        },
      ]}
    >
      {items.map((item) => {
        const selected = item.id === active;
        const isCenter = item.id === "add";
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            style={styles.previewNavItem}
            onPress={() => onNavigate(item.screen)}
          >
            <View
              style={[
                styles.previewNavIcon,
                isCenter && {
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: theme.accent,
                  marginTop: -12,
                },
                selected &&
                  !isCenter &&
                  theme.code === "C" && {
                    backgroundColor: theme.surfaceAlt,
                  },
              ]}
            >
              <Feather
                name={item.icon}
                size={isCenter ? 20 : 17}
                color={
                  isCenter
                    ? theme.accentText
                    : selected
                      ? theme.accent
                      : theme.muted
                }
              />
            </View>
            {!isCenter || theme.code !== "D" ? (
              <Text
                style={[
                  styles.previewNavLabel,
                  { color: selected ? theme.accent : theme.muted },
                ]}
              >
                {item.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function ScreenFrame({
  theme,
  active,
  children,
  onNavigate,
  noPadding = false,
}: {
  theme: DesignPreviewTokens;
  active: "home" | "closet" | "outfit" | "profile" | "add";
  children: ReactNode;
  onNavigate: NavigateToScreen;
  noPadding?: boolean;
}) {
  return (
    <View style={[styles.screenFrame, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={[
          styles.screenContent,
          noPadding && styles.screenContentNoPadding,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <PreviewBottomNav
        theme={theme}
        active={active}
        onNavigate={onNavigate}
      />
    </View>
  );
}

function ReadinessMetric({
  theme,
  label,
  current,
  required,
  recommended = false,
}: {
  theme: DesignPreviewTokens;
  label: string;
  current: number;
  required: number;
  recommended?: boolean;
}) {
  const complete = current >= required;
  return (
    <View style={styles.readinessMetric}>
      <View style={styles.metricLabelRow}>
        <Text style={[styles.metricLabel, { color: theme.text }]}>{label}</Text>
        <Text
          style={[
            styles.metricValue,
            { color: complete ? theme.success : theme.warning },
          ]}
        >
          {current} / {required}
          {recommended ? " 권장" : ""}
        </Text>
      </View>
      <ProgressBar theme={theme} value={current / required} />
    </View>
  );
}

function OutfitMosaic({
  theme,
  compact = false,
}: {
  theme: DesignPreviewTokens;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.outfitMosaic,
        {
          backgroundColor: theme.surfaceAlt,
          borderRadius: theme.imageRadius,
          height: compact ? 164 : 238,
        },
      ]}
    >
      {DESIGN_PREVIEW_OUTFIT_ITEMS.map((item, index) => (
        <ProductImage
          key={item.id}
          source={item.image}
          radius={theme.code === "B" ? 3 : 10}
          style={[
            styles.outfitMosaicImage,
            compact
              ? {
                  width: "44%",
                  height: "44%",
                  left: index % 2 === 0 ? "4%" : "52%",
                  top: index < 2 ? "4%" : "52%",
                }
              : {
                  width: index === 0 || index === 1 ? "44%" : "34%",
                  height: index === 0 || index === 1 ? "58%" : "34%",
                  left:
                    index === 0
                      ? "4%"
                      : index === 1
                        ? "52%"
                        : index === 2
                          ? "14%"
                          : "54%",
                  top: index < 2 ? "4%" : "64%",
                },
          ]}
        />
      ))}
    </View>
  );
}

function HomeScreen({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  if (theme.code === "A") {
    return (
      <ScreenFrame theme={theme} active="home" onNavigate={onNavigate}>
        <ScreenHeader
          theme={theme}
          title="좋은 아침이에요, 도현님"
          subtitle="오늘 서울 24° · 가볍고 단정한 옷차림이 좋아요"
        />
        <AnalysisStatus theme={theme} compact />
        <View style={styles.editorialHero}>
          <Image
            source={require("@/assets/images/hero-fashion-wide.png")}
            resizeMode="cover"
            style={styles.editorialHeroImage}
          />
          <View style={styles.editorialHeroOverlay}>
            <Text style={styles.editorialHeroKicker}>TODAY&apos;S EDIT</Text>
            <Text style={styles.editorialHeroTitle}>내 옷으로{"\n"}완성하는 오늘</Text>
            <Pressable
              style={styles.editorialHeroButton}
              onPress={() => onNavigate("ready")}
            >
              <Text style={styles.editorialHeroButtonText}>추천 받기</Text>
              <Feather name="arrow-up-right" size={15} color="#FFFDF9" />
            </Pressable>
          </View>
        </View>
        <View style={styles.editorialReadinessRow}>
          <View>
            <Text style={[styles.smallEyebrow, { color: theme.accent }]}>
              WARDROBE READY
            </Text>
            <Text style={[styles.readinessHeadline, { color: theme.text }]}>
              추천 준비 완료
            </Text>
          </View>
          <Text style={[styles.readinessScore, { color: theme.text }]}>12</Text>
          <Text style={[styles.readinessScoreUnit, { color: theme.muted }]}>
            조합
          </Text>
        </View>
        <SectionHeading theme={theme} title="오늘의 코디" action="더 보기 ↗" />
        <View
          style={[
            styles.editorialOutfitCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <OutfitMosaic theme={theme} compact />
          <Text style={[styles.outfitTitle, { color: theme.text }]}>
            담백한 니트와 차콜 슬랙스
          </Text>
          <Text style={[styles.outfitReason, { color: theme.muted }]}>
            가벼운 니트와 긴 실루엣이 오늘 기온에 자연스러워요.
          </Text>
        </View>
        <SectionHeading theme={theme} title="최근 저장 코디" action="3개" />
        <View style={styles.horizontalProducts}>
          {DESIGN_PREVIEW_ITEMS.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.horizontalProduct}>
              <ProductImage source={item.image} radius={theme.imageRadius} />
            </View>
          ))}
        </View>
      </ScreenFrame>
    );
  }

  if (theme.code === "B") {
    return (
      <ScreenFrame theme={theme} active="home" onNavigate={onNavigate}>
        <ScreenHeader
          theme={theme}
          title="홈"
          subtitle="7월 23일 목요일 · 서울 24°"
        />
        <AnalysisStatus theme={theme} compact />
        <View style={styles.minimalActionRow}>
          <PreviewButton
            theme={theme}
            label="코디 추천"
            icon="star"
            inline
            onPress={() => onNavigate("ready")}
          />
          <PreviewButton
            theme={theme}
            label="옷 추가"
            icon="plus"
            secondary
            inline
            onPress={() => onNavigate("add")}
          />
        </View>
        <View
          style={[
            styles.minimalSummary,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          {[
            ["상의", "4"],
            ["하의", "4"],
            ["신발", "2"],
            ["조합", "12"],
          ].map(([label, value]) => (
            <View key={label} style={styles.minimalSummaryItem}>
              <Text style={[styles.minimalSummaryValue, { color: theme.text }]}>
                {value}
              </Text>
              <Text style={[styles.minimalSummaryLabel, { color: theme.muted }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <SectionHeading theme={theme} title="오늘의 추천" action="전체 보기" />
        <Pressable
          style={[
            styles.minimalRecommendation,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
          onPress={() => onNavigate("result")}
        >
          <View style={styles.minimalRecommendationVisual}>
            <OutfitMosaic theme={theme} compact />
          </View>
          <View style={styles.minimalRecommendationText}>
            <Text style={[styles.smallEyebrow, { color: theme.accent }]}>
              좋은 조합
            </Text>
            <Text style={[styles.outfitTitle, { color: theme.text }]}>
              미니멀 출근 코디
            </Text>
            <Text
              style={[styles.outfitReason, { color: theme.muted }]}
              numberOfLines={3}
            >
              니트와 슬랙스의 선이 깔끔하고 흰 스니커즈가 무게를 덜어줘요.
            </Text>
            <Text style={[styles.textLink, { color: theme.accent }]}>
              추천 확인 →
            </Text>
          </View>
        </Pressable>
        <SectionHeading theme={theme} title="최근 저장" action="3개" />
        {["출근용 미니멀", "주말 데일리"].map((label, index) => (
          <View
            key={label}
            style={[styles.minimalListRow, { borderBottomColor: theme.border }]}
          >
            <ProductImage
              source={DESIGN_PREVIEW_ITEMS[index].image}
              radius={theme.imageRadius}
              style={styles.minimalListThumb}
            />
            <View style={styles.flexOne}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{label}</Text>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>
                4개 아이템 · 2일 전 저장
              </Text>
            </View>
            <Feather name="chevron-right" size={17} color={theme.muted} />
          </View>
        ))}
      </ScreenFrame>
    );
  }

  if (theme.code === "C") {
    return (
      <ScreenFrame theme={theme} active="home" onNavigate={onNavigate}>
        <ScreenHeader
          theme={theme}
          title="오늘 무엇을 입을까요?"
          subtitle="옷장 준비가 끝났어요. 지금 추천을 받을 수 있어요."
        />
        <AnalysisStatus theme={theme} compact />
        <View
          style={[
            styles.utilityReadinessCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.utilityReadinessTop}>
            <View
              style={[
                styles.utilityGauge,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <Text style={[styles.utilityGaugeValue, { color: theme.accent }]}>
                100%
              </Text>
              <Text style={[styles.utilityGaugeLabel, { color: theme.muted }]}>
                준비도
              </Text>
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.utilityCardTitle, { color: theme.text }]}>
                추천 준비 완료
              </Text>
              <Text style={[styles.utilityCardText, { color: theme.muted }]}>
                오늘 날씨에 맞는 핵심 조합을 12개 만들 수 있어요.
              </Text>
            </View>
          </View>
          <PreviewButton
            theme={theme}
            label="오늘의 코디 추천받기"
            icon="arrow-right"
            onPress={() => onNavigate("ready")}
          />
        </View>
        <View style={styles.utilityActionGrid}>
          {[
            ["plus-circle", "옷 추가", "링크·사진·직접 등록", "add"],
            ["grid", "옷장 보기", "18개 아이템", "closet"],
          ].map(([icon, title, meta, screen]) => (
            <Pressable
              key={title}
              style={[
                styles.utilityActionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={() => onNavigate(screen as DesignPreviewScreenId)}
            >
              <View
                style={[
                  styles.utilityActionIcon,
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                <Feather
                  name={icon as keyof typeof Feather.glyphMap}
                  size={18}
                  color={theme.accent}
                />
              </View>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>{meta}</Text>
            </Pressable>
          ))}
        </View>
        <SectionHeading theme={theme} title="오늘의 추천 미리보기" />
        <View
          style={[
            styles.utilityOutfitCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <OutfitMosaic theme={theme} compact />
          <View style={styles.utilityOutfitFooter}>
            <View style={styles.flexOne}>
              <Text style={[styles.outfitTitle, { color: theme.text }]}>
                가볍고 단정한 데일리
              </Text>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>
                미니멀 · 출근 · 24°
              </Text>
            </View>
            <Feather name="arrow-up-right" size={20} color={theme.accent} />
          </View>
        </View>
      </ScreenFrame>
    );
  }

  if (theme.code === "E") {
    return (
      <ScreenFrame theme={theme} active="home" onNavigate={onNavigate}>
        <ScreenHeader
          theme={theme}
          title="오늘을 입는 방식"
          subtitle="서울 24° · 가볍고 단정한 레이어가 좋아요"
        />
        <View style={styles.hybridHero}>
          <Image
            source={require("@/assets/images/hero-fashion-wide.png")}
            resizeMode="cover"
            style={styles.hybridHeroImage}
          />
          <View style={styles.hybridHeroShade} />
          <View style={styles.hybridHeroCopy}>
            <Text style={styles.hybridHeroKicker}>TODAY&apos;S WARDROBE</Text>
            <Text style={styles.hybridHeroTitle}>
              DRESS WITH{"\n"}INTENTION.
            </Text>
            <Text style={styles.hybridHeroText}>
              내 옷장 안에서 오늘 가장 선명한 조합을 골랐어요.
            </Text>
          </View>
        </View>
        <View style={styles.hybridActionRow}>
          <PreviewButton
            theme={theme}
            label="오늘의 룩 보기"
            icon="arrow-up-right"
            inline
            onPress={() => onNavigate("result")}
          />
          <PreviewButton
            theme={theme}
            label="옷 추가"
            icon="plus"
            secondary
            inline
            onPress={() => onNavigate("add")}
          />
        </View>
        <AnalysisStatus theme={theme} compact />
        <View style={styles.hybridReadiness}>
          <View style={styles.flexOne}>
            <Text style={[styles.smallEyebrow, { color: "#9A7040" }]}>
              WARDROBE READY
            </Text>
            <Text style={[styles.outfitTitle, { color: theme.text }]}>
              서로 다른 오늘을 만들 준비 완료
            </Text>
          </View>
          <Text style={[styles.hybridReadinessNumber, { color: theme.text }]}>
            12
          </Text>
          <Text style={[styles.readinessScoreUnit, { color: theme.muted }]}>
            조합
          </Text>
        </View>
        <SectionHeading theme={theme} title="오늘의 에디트" action="전체 보기" />
        <View
          style={[
            styles.hybridOutfitCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.hybridOutfitVisual}>
            <OutfitMosaic theme={theme} compact />
          </View>
          <View style={styles.flexOne}>
            <Text style={[styles.smallEyebrow, { color: "#9A7040" }]}>
              LOOK 01
            </Text>
            <Text style={[styles.outfitTitle, { color: theme.text }]}>
              아이보리와 차콜의 선
            </Text>
            <Text
              style={[styles.outfitReason, { color: theme.muted }]}
              numberOfLines={3}
            >
              부드러운 니트와 긴 슬랙스가 차분한 대비를 만들어요.
            </Text>
          </View>
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      theme={theme}
      active="home"
      onNavigate={onNavigate}
      noPadding
    >
      <View style={styles.darkHomeHeader}>
        <Text style={[styles.darkLogo, { color: theme.accent }]}>NAES / HOME</Text>
        <Feather name="bell" size={19} color={theme.text} />
      </View>
      <View style={styles.darkHero}>
        <Image
          source={require("@/assets/design-preview/catalog-sheet.png")}
          resizeMode="cover"
          style={styles.darkHeroImage}
        />
        <View style={styles.darkHeroShade} />
        <View style={styles.darkHeroCopy}>
          <Text style={[styles.darkHeroEyebrow, { color: theme.accent }]}>
            TODAY 24° / CLEAR
          </Text>
          <Text style={styles.darkHeroTitle}>DRESS THE{"\n"}DAY YOU WANT.</Text>
          <Text style={[styles.darkHeroText, { color: "#DFDAD2" }]}>
            내 옷장 안에서 오늘 가장 좋은 조합을 찾았어요.
          </Text>
          <PreviewButton
            theme={theme}
            label="LOOK 01 보기"
            icon="arrow-up-right"
            onPress={() => onNavigate("result")}
          />
        </View>
      </View>
      <View style={styles.darkBody}>
        <AnalysisStatus theme={theme} compact />
        <View style={styles.darkStats}>
          {[
            ["18", "ITEMS"],
            ["12", "LOOKS"],
            ["04", "SAVED"],
          ].map(([value, label]) => (
            <View key={label} style={styles.darkStat}>
              <Text style={[styles.darkStatValue, { color: theme.text }]}>
                {value}
              </Text>
              <Text style={[styles.darkStatLabel, { color: theme.muted }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <SectionHeading theme={theme} title="RECENT WARDROBE" action="VIEW ALL" />
        <View style={styles.horizontalProducts}>
          {DESIGN_PREVIEW_ITEMS.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.horizontalProduct}>
              <ProductImage source={item.image} radius={theme.imageRadius} />
            </View>
          ))}
        </View>
      </View>
    </ScreenFrame>
  );
}

function ClosetScreen({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const dense = theme.code === "B";
  const visibleItems = dense
    ? DESIGN_PREVIEW_ITEMS
    : DESIGN_PREVIEW_ITEMS.slice(0, 6);
  const columns = dense ? 3 : 2;

  return (
    <ScreenFrame theme={theme} active="closet" onNavigate={onNavigate}>
      <ScreenHeader
        theme={theme}
        title={theme.code === "D" ? "WARDROBE / 18" : "내 옷장"}
        subtitle={
          theme.code === "C"
            ? "추천에 사용할 수 있는 옷 18개"
            : "상의 6 · 하의 5 · 신발 3 · 아우터 4"
        }
      />
      <View
        style={[
          styles.searchField,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: theme.radius,
          },
        ]}
      >
        <Feather name="search" size={17} color={theme.muted} />
        <Text style={[styles.searchPlaceholder, { color: theme.muted }]}>
          종류, 상품명, 브랜드, 색상 검색
        </Text>
        <Feather name="sliders" size={16} color={theme.text} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {["전체", "상의", "하의", "신발", "아우터", "액세서리"].map(
          (label, index) => (
            <PreviewTag key={label} theme={theme} active={index === 0}>
              {label}
            </PreviewTag>
          )
        )}
      </ScrollView>
      <View style={styles.closetToolbar}>
        <Text style={[styles.toolbarText, { color: theme.text }]}>
          전체 18개
        </Text>
        <View style={styles.toolbarActions}>
          <Text style={[styles.toolbarAction, { color: theme.muted }]}>
            최근 등록순
          </Text>
          <Feather name="check-square" size={17} color={theme.muted} />
        </View>
      </View>
      {theme.code === "C" ? (
        <AnalysisStatus theme={theme} compact />
      ) : theme.code === "A" || theme.code === "E" ? (
        <View
          style={[
            styles.editorialAnalysisLine,
            { borderColor: theme.border },
          ]}
        >
          <Text style={[styles.rowTitle, { color: theme.text }]}>
            분석 최신화
          </Text>
          <Text style={[styles.rowMeta, { color: theme.muted }]}>
            5/12 진행 중
          </Text>
          <ProgressBar theme={theme} value={5 / 12} />
        </View>
      ) : null}
      <View style={[styles.productGrid, { gap: dense ? 8 : 14 }]}>
        {visibleItems.map((item) => (
          <View
            key={item.id}
            style={{ width: `${100 / columns - (dense ? 2 : 3)}%` }}
          >
            <ProductTile item={item} theme={theme} dense={dense} />
          </View>
        ))}
      </View>
      <PreviewButton
        theme={theme}
        label="옷 추가하기"
        icon="plus"
        onPress={() => onNavigate("add")}
      />
    </ScreenFrame>
  );
}

function ReadinessScreen({
  theme,
  ready,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  ready: boolean;
  onNavigate: NavigateToScreen;
}) {
  const data = ready ? DESIGN_PREVIEW_READY : DESIGN_PREVIEW_READINESS;
  const content = (
    <>
      <ReadinessMetric
        theme={theme}
        label="상의"
        current={data.tops}
        required={3}
      />
      <ReadinessMetric
        theme={theme}
        label="하의"
        current={data.bottoms}
        required={3}
      />
      <ReadinessMetric
        theme={theme}
        label="핵심 조합"
        current={data.coreCombinations}
        required={6}
      />
      <ReadinessMetric
        theme={theme}
        label="신발"
        current={data.shoes}
        required={2}
        recommended
      />
      <ReadinessMetric
        theme={theme}
        label="아우터"
        current={data.outers}
        required={1}
        recommended
      />
    </>
  );

  if (theme.code === "A") {
    return (
      <ScreenFrame theme={theme} active="outfit" onNavigate={onNavigate}>
        <ScreenHeader
          theme={theme}
          title={ready ? "이제 추천할 수 있어요" : "조금만 더 채워볼까요?"}
          subtitle={
            ready
              ? "현재 계절에 맞는 핵심 조합이 충분해요."
              : "좋은 추천을 위해 반복되는 조합은 아직 보여주지 않을게요."
          }
        />
        <View style={styles.editorialReadinessHero}>
          <Text style={[styles.smallEyebrow, { color: theme.accent }]}>
            {ready ? "READY TO STYLE" : "WARDROBE PROGRESS"}
          </Text>
          <Text style={[styles.editorialBigNumber, { color: theme.text }]}>
            {data.coreCombinations}
            <Text style={[styles.editorialBigUnit, { color: theme.muted }]}>
              {" "}
              / 6
            </Text>
          </Text>
          <Text style={[styles.outfitReason, { color: theme.muted }]}>
            {ready
              ? "상의 4벌과 하의 4벌로 서로 다른 분위기의 조합을 만들 수 있어요."
              : "상의 2벌과 하의 1벌을 더 추가하면 반복 없이 추천할 수 있어요."}
          </Text>
        </View>
        <View style={styles.readinessList}>{content}</View>
        <PreviewButton
          theme={theme}
          label={ready ? "상황을 고르고 추천받기" : "상의 2벌 추가하기"}
          icon={ready ? "arrow-right" : "plus"}
          onPress={() => onNavigate(ready ? "result" : "add")}
        />
        {!ready ? (
          <PreviewButton
            theme={theme}
            label="옷장 보기"
            icon="grid"
            secondary
            onPress={() => onNavigate("closet")}
          />
        ) : null}
      </ScreenFrame>
    );
  }

  if (theme.code === "B") {
    return (
      <ScreenFrame theme={theme} active="outfit" onNavigate={onNavigate}>
        <ScreenHeader
          theme={theme}
          title="코디 추천"
          subtitle={ready ? "추천 준비 완료" : "추천 준비 확인"}
        />
        <View
          style={[
            styles.minimalNotice,
            {
              borderColor: ready ? theme.success : theme.warning,
              backgroundColor: theme.surface,
            },
          ]}
        >
          <Feather
            name={ready ? "check-circle" : "info"}
            size={20}
            color={ready ? theme.success : theme.warning}
          />
          <View style={styles.flexOne}>
            <Text style={[styles.noticeTitle, { color: theme.text }]}>
              {ready
                ? "추천할 준비가 끝났습니다"
                : "추천할 만한 조합이 아직 부족합니다"}
            </Text>
            <Text style={[styles.noticeText, { color: theme.muted }]}>
              {ready
                ? "현재 계절에 맞는 핵심 조합 12개를 확인했습니다."
                : "비슷한 코디가 반복되지 않도록 상의와 하의를 더 등록해주세요."}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.minimalChecklist,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          {[
            ["상의", data.tops, 3, false],
            ["하의", data.bottoms, 3, false],
            ["핵심 조합", data.coreCombinations, 6, false],
            ["신발", data.shoes, 2, true],
            ["아우터", data.outers, 1, true],
          ].map(([label, current, required, recommended]) => (
            <View
              key={String(label)}
              style={[styles.checklistRow, { borderBottomColor: theme.border }]}
            >
              <Feather
                name={Number(current) >= Number(required) ? "check" : "minus"}
                size={16}
                color={
                  Number(current) >= Number(required)
                    ? theme.success
                    : theme.warning
                }
              />
              <Text style={[styles.checklistLabel, { color: theme.text }]}>
                {String(label)}
              </Text>
              <Text style={[styles.checklistValue, { color: theme.muted }]}>
                {String(current)} / {String(required)}
                {recommended ? " 권장" : ""}
              </Text>
            </View>
          ))}
        </View>
        <PreviewButton
          theme={theme}
          label={ready ? "추천 시작" : "부족한 옷 추가"}
          onPress={() => onNavigate(ready ? "result" : "add")}
        />
      </ScreenFrame>
    );
  }

  if (theme.code === "C") {
    return (
      <ScreenFrame theme={theme} active="outfit" onNavigate={onNavigate}>
        <ScreenHeader
          theme={theme}
          title={ready ? "추천 준비가 끝났어요" : "추천 준비까지 조금 남았어요"}
          subtitle="반복 없는 추천을 위해 실제 사용 가능한 옷만 계산했어요."
        />
        <View
          style={[
            styles.utilityProgressCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              styles.utilityLargeGauge,
              { backgroundColor: theme.surfaceAlt },
            ]}
          >
            <Text style={[styles.utilityLargeGaugeValue, { color: theme.accent }]}>
              {ready ? "완료" : "42%"}
            </Text>
            <Text style={[styles.utilityGaugeLabel, { color: theme.muted }]}>
              추천 준비도
            </Text>
          </View>
          <Text style={[styles.utilityCardTitle, { color: theme.text }]}>
            {ready ? "서로 다른 조합 12개" : "서로 다른 조합 2개"}
          </Text>
          <Text style={[styles.utilityCardText, { color: theme.muted }]}>
            {ready
              ? "날씨와 상황을 고르면 지금 입기 좋은 조합을 보여드릴게요."
              : "상의 2벌, 하의 1벌을 추가하면 추천을 시작할 수 있어요."}
          </Text>
        </View>
        <View
          style={[
            styles.utilityMetricsCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {content}
        </View>
        <PreviewButton
          theme={theme}
          label={ready ? "오늘의 추천 시작" : "추천에 필요한 옷 추가"}
          icon={ready ? "star" : "plus"}
          onPress={() => onNavigate(ready ? "result" : "add")}
        />
      </ScreenFrame>
    );
  }

  if (theme.code === "E") {
    return (
      <ScreenFrame theme={theme} active="outfit" onNavigate={onNavigate}>
        <ScreenHeader
          theme={theme}
          title={ready ? "오늘의 룩을 고를 시간" : "조금 더 모은 뒤, 제대로 추천할게요"}
          subtitle={
            ready
              ? "현재 계절에 맞는 서로 다른 핵심 조합이 충분해요."
              : "비슷한 옷차림을 반복해서 보여주지 않기 위한 기준이에요."
          }
        />
        <View style={styles.hybridReadinessHero}>
          <Text style={styles.hybridReadinessKicker}>
            {ready ? "READY TO DRESS" : "WARDROBE IN PROGRESS"}
          </Text>
          <View style={styles.hybridReadinessValueRow}>
            <Text style={styles.hybridReadinessValue}>
              {data.coreCombinations}
            </Text>
            <Text style={styles.hybridReadinessGoal}>/ 06</Text>
          </View>
          <Text style={styles.hybridReadinessCopy}>
            {ready
              ? "서로 다른 분위기의 룩을 자신 있게 추천할 수 있어요."
              : "상의 2벌과 하의 1벌이 더 있으면 선택지가 선명해져요."}
          </Text>
        </View>
        <View
          style={[
            styles.hybridMetricsCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {content}
        </View>
        <PreviewButton
          theme={theme}
          label={ready ? "오늘의 룩 시작" : "추천에 필요한 옷 추가"}
          icon={ready ? "arrow-up-right" : "plus"}
          onPress={() => onNavigate(ready ? "result" : "add")}
        />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame theme={theme} active="outfit" onNavigate={onNavigate}>
      <ScreenHeader
        theme={theme}
        title={ready ? "READY." : "NOT YET."}
        subtitle={
          ready
            ? "12 DISTINCT LOOKS AVAILABLE"
            : "WE WON'T REPEAT THE SAME LOOK."
        }
      />
      <View style={styles.darkReadinessCenter}>
        <Text style={[styles.darkReadinessValue, { color: theme.text }]}>
          {data.coreCombinations}
        </Text>
        <Text style={[styles.darkReadinessUnit, { color: theme.accent }]}>
          / 06 CORE LOOKS
        </Text>
        <Text style={[styles.darkReadinessCopy, { color: theme.muted }]}>
          {ready
            ? "현재 옷장으로 충분히 다른 분위기를 만들 수 있습니다."
            : "상의 02 · 하의 01이 더 필요합니다."}
        </Text>
      </View>
      <View style={styles.darkReadinessList}>{content}</View>
      <PreviewButton
        theme={theme}
        label={ready ? "START STYLING" : "ADD THE MISSING PIECES"}
        onPress={() => onNavigate(ready ? "result" : "add")}
      />
    </ScreenFrame>
  );
}

function ResultScreen({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const detailContent = (
    <>
      <View
        style={[
          styles.reasonCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.reasonHeader}>
          <Text style={[styles.reasonTitle, { color: theme.text }]}>
            이 조합이 좋은 이유
          </Text>
          <Feather name="chevron-down" size={17} color={theme.muted} />
        </View>
        <Text style={[styles.reasonText, { color: theme.text }]}>
          • 반팔 니트의 단정한 인상과 와이드 슬랙스의 긴 선이 잘 이어져요.
        </Text>
        <Text style={[styles.reasonText, { color: theme.text }]}>
          • 아이보리와 차콜 중심이라 오늘처럼 맑은 날 안정적이에요.
        </Text>
      </View>
      <View
        style={[
          styles.cautionRow,
          { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
        ]}
      >
        <Feather name="info" size={16} color={theme.warning} />
        <Text style={[styles.cautionText, { color: theme.muted }]}>
          저녁에는 쌀쌀할 수 있어 트렌치코트를 함께 준비했어요.
        </Text>
      </View>
      <View style={styles.feedbackRow}>
        <PreviewButton
          theme={theme}
          label="마음에 들어요"
          icon="thumbs-up"
          secondary
          compact
          inline
        />
        <PreviewButton
          theme={theme}
          label="별로예요"
          icon="thumbs-down"
          secondary
          compact
          inline
        />
      </View>
      <PreviewButton theme={theme} label="이 코디 저장하기" icon="bookmark" />
      <SectionHeading theme={theme} title="다른 조합" action="3개" />
      <View style={styles.alternativeRow}>
        {DESIGN_PREVIEW_ITEMS.slice(0, 3).map((item) => (
          <View
            key={item.id}
            style={[
              styles.alternativeCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <ProductImage source={item.image} radius={theme.imageRadius} />
            <Text
              style={[styles.alternativeText, { color: theme.text }]}
              numberOfLines={1}
            >
              {item.category} 바꾸기
            </Text>
          </View>
        ))}
      </View>
    </>
  );

  if (theme.code === "D") {
    return (
      <ScreenFrame
        theme={theme}
        active="outfit"
        onNavigate={onNavigate}
        noPadding
      >
        <View style={styles.darkResultHero}>
          <OutfitMosaic theme={theme} />
          <View style={styles.darkResultTop}>
            <Text style={[styles.darkLogo, { color: theme.accent }]}>
              LOOK 01 / 03
            </Text>
            <View
              style={[
                styles.qualityBadge,
                { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
            >
              <Text style={{ color: theme.accentText, fontWeight: "800" }}>
                좋은 조합
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.darkBody}>
          <Text style={[styles.darkResultTitle, { color: theme.text }]}>
            SOFT KNIT,{"\n"}SHARP LINE.
          </Text>
          <View style={styles.tagRow}>
            {["#미니멀", "#출근", "#맑음"].map((tag) => (
              <PreviewTag key={tag} theme={theme}>
                {tag}
              </PreviewTag>
            ))}
          </View>
          {detailContent}
        </View>
      </ScreenFrame>
    );
  }

  if (theme.code === "E") {
    return (
      <ScreenFrame
        theme={theme}
        active="outfit"
        onNavigate={onNavigate}
        noPadding
      >
        <View style={styles.hybridResultHero}>
          <OutfitMosaic theme={theme} />
          <View style={styles.hybridResultHeroTop}>
            <Text style={styles.hybridResultKicker}>LOOK 01 / TODAY</Text>
            <View style={styles.hybridGoldBadge}>
              <Text style={styles.hybridGoldBadgeText}>좋은 조합</Text>
            </View>
          </View>
        </View>
        <View style={styles.hybridResultBody}>
          <ScreenHeader
            theme={theme}
            title="부드러운 니트, 선명한 차콜"
            subtitle="서울 24° · 맑음 · 깔끔한"
          />
          <View style={styles.tagRow}>
            {["#미니멀", "#출근", "#가벼움"].map((tag) => (
              <PreviewTag key={tag} theme={theme}>
                {tag}
              </PreviewTag>
            ))}
          </View>
          {detailContent}
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame theme={theme} active="outfit" onNavigate={onNavigate}>
      <ScreenHeader
        theme={theme}
        title={theme.code === "A" ? "오늘의 스타일 셀렉션" : "코디 추천"}
        subtitle="서울 24° · 맑음 · 깔끔한"
      />
      <View style={styles.resultTitleRow}>
        <View style={styles.flexOne}>
          <Text
            style={[
              theme.code === "A" ? styles.editorialTitle : styles.outfitTitle,
              { color: theme.text },
            ]}
          >
            {theme.code === "A"
              ? "아이보리 니트와\n차콜 슬랙스"
              : "아이보리 니트와 차콜 슬랙스"}
          </Text>
          <View style={styles.tagRow}>
            {["미니멀", "데일리", "가벼움"].map((tag) => (
              <PreviewTag key={tag} theme={theme}>
                {`#${tag}`}
              </PreviewTag>
            ))}
          </View>
        </View>
        <View
          style={[
            styles.qualityBadge,
            { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.qualityBadgeText, { color: theme.accent }]}>
            좋은 조합
          </Text>
        </View>
      </View>
      <OutfitMosaic theme={theme} />
      {detailContent}
    </ScreenFrame>
  );
}

function AddScreen({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const methods: {
    icon: keyof typeof Feather.glyphMap;
    title: string;
    description: string;
    meta: string;
  }[] = [
    {
      icon: "link",
      title: "상품 링크로 추가",
      description: "공식 상품 정보와 소재, 실측을 가져와요.",
      meta: "가장 정확함",
    },
    {
      icon: "camera",
      title: "사진으로 빠르게 추가",
      description: "앨범이나 카메라 사진을 최대 10장까지 분석해요.",
      meta: "여러 장 가능",
    },
    {
      icon: "edit-3",
      title: "직접 입력",
      description: "종류와 색상, 계절을 직접 골라 저장해요.",
      meta: "사진 없이 가능",
    },
  ];

  return (
    <ScreenFrame theme={theme} active="add" onNavigate={onNavigate}>
      <ScreenHeader
        theme={theme}
        title={theme.code === "D" ? "ADD NEW PIECE" : "옷 추가"}
        subtitle="등록 방법을 고르면 필요한 정보만 보여드릴게요."
      />
      {theme.code === "C" ? (
        <View style={styles.utilityStepRow}>
          {["방법", "정보 가져오기", "확인", "저장"].map((label, index) => (
            <View key={label} style={styles.utilityStep}>
              <View
                style={[
                  styles.utilityStepDot,
                  {
                    backgroundColor:
                      index === 0 ? theme.accent : theme.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={{
                    color: index === 0 ? theme.accentText : theme.muted,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[styles.utilityStepLabel, { color: theme.muted }]}
                numberOfLines={2}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.addMethodList}>
        {methods.map((method, index) => (
          <Pressable
            key={method.title}
            style={[
              styles.addMethodCard,
              {
                backgroundColor:
                  (theme.code === "A" || theme.code === "E") && index === 0
                    ? theme.accent
                    : theme.surface,
                borderColor:
                  (theme.code === "A" || theme.code === "E") && index === 0
                    ? theme.accent
                    : theme.border,
                borderRadius: theme.cardRadius,
                minHeight:
                  theme.code === "D" ? 146 : theme.code === "B" ? 96 : 118,
              },
            ]}
          >
            <View
              style={[
                styles.addMethodIcon,
                {
                  backgroundColor:
                    (theme.code === "A" || theme.code === "E") && index === 0
                      ? "rgba(255,255,255,0.16)"
                      : theme.surfaceAlt,
                },
              ]}
            >
              <Feather
                name={method.icon}
                size={20}
                color={
                  (theme.code === "A" || theme.code === "E") && index === 0
                    ? theme.accentText
                    : theme.accent
                }
              />
            </View>
            <View style={styles.flexOne}>
              <Text
                style={[
                  styles.addMethodTitle,
                  {
                    color:
                      (theme.code === "A" || theme.code === "E") && index === 0
                        ? theme.accentText
                        : theme.text,
                  },
                ]}
              >
                {method.title}
              </Text>
              <Text
                style={[
                  styles.addMethodText,
                  {
                    color:
                      (theme.code === "A" || theme.code === "E") && index === 0
                        ? "#EEE3D9"
                        : theme.muted,
                  },
                ]}
              >
                {method.description}
              </Text>
            </View>
            <View style={styles.addMethodMeta}>
              <Text
                style={[
                  styles.addMethodMetaText,
                  {
                    color:
                      (theme.code === "A" || theme.code === "E") && index === 0
                        ? theme.accentText
                        : theme.accent,
                  },
                ]}
              >
                {method.meta}
              </Text>
              <Feather
                name="chevron-right"
                size={18}
                color={
                  (theme.code === "A" || theme.code === "E") && index === 0
                    ? theme.accentText
                    : theme.muted
                }
              />
            </View>
          </Pressable>
        ))}
      </View>
      <View
        style={[
          styles.mockAnalysisCard,
          {
            backgroundColor: theme.surfaceAlt,
            borderColor: theme.border,
            borderRadius: theme.cardRadius,
          },
        ]}
      >
        <View style={styles.mockAnalysisHeader}>
          <Feather name="check-circle" size={18} color={theme.success} />
          <Text style={[styles.noticeTitle, { color: theme.text }]}>
            상품 정보 가져오기 완료
          </Text>
        </View>
        <Text style={[styles.noticeText, { color: theme.muted }]}>
          반팔 니트 · 아이보리 · 봄/여름
        </Text>
        <View style={styles.mockReviewRow}>
          <PreviewTag theme={theme} active>
            종류 확인됨
          </PreviewTag>
          <PreviewTag theme={theme}>계절 검토 필요</PreviewTag>
        </View>
      </View>
    </ScreenFrame>
  );
}

function DetailRows({ theme }: { theme: DesignPreviewTokens }) {
  return (
    <View style={styles.detailRows}>
      {[
        ["상세 품목", "반팔 니트"],
        ["색상", "아이보리"],
        ["공식 소재", "면 62%, 레이온 38%"],
        ["계절", "봄 · 여름"],
        ["핏", "세미 오버핏"],
        ["선택 사이즈", "L"],
      ].map(([label, value]) => (
        <View
          key={label}
          style={[styles.detailRow, { borderBottomColor: theme.border }]}
        >
          <Text style={[styles.detailLabel, { color: theme.muted }]}>
            {label}
          </Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DetailScreen({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const item = DESIGN_PREVIEW_ITEMS[1];

  if (theme.code === "B") {
    return (
      <ScreenFrame theme={theme} active="closet" onNavigate={onNavigate}>
        <ScreenHeader theme={theme} title="옷 상세" subtitle="최근 분석 · 오늘" />
        <View style={styles.minimalDetailIntro}>
          <ProductImage
            source={item.image}
            radius={theme.imageRadius}
            style={styles.minimalDetailImage}
          />
          <View style={styles.flexOne}>
            <Text style={[styles.smallEyebrow, { color: theme.accent }]}>
              MAISON SAMPLE
            </Text>
            <Text style={[styles.detailTitle, { color: theme.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.rowMeta, { color: theme.muted }]}>
              상품 링크로 등록 · 사용자 확인 완료
            </Text>
          </View>
        </View>
        <DetailRows theme={theme} />
        <View style={styles.minimalActionRow}>
          <PreviewButton theme={theme} label="정보 수정" icon="edit-3" inline />
          <PreviewButton
            theme={theme}
            label="분석 최신화"
            icon="refresh-cw"
            secondary
            inline
          />
        </View>
        <View
          style={[
            styles.measurementCard,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          <Text style={[styles.reasonTitle, { color: theme.text }]}>
            내 사이즈 적합도
          </Text>
          <Text style={[styles.noticeTitle, { color: theme.success }]}>
            L 사이즈가 가장 자연스러워요
          </Text>
          <Text style={[styles.noticeText, { color: theme.muted }]}>
            어깨는 잘 맞고 가슴 품은 약 4cm 여유가 있어요.
          </Text>
        </View>
        <Text style={[styles.deleteText, { color: theme.warning }]}>옷 삭제</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame theme={theme} active="closet" onNavigate={onNavigate}>
      <ScreenHeader
        theme={theme}
        title={theme.code === "D" ? "PIECE / 014" : "옷 상세"}
        subtitle="상품 링크로 등록 · 사용자 확인 완료"
      />
      <ProductImage
        source={item.image}
        radius={theme.imageRadius}
        style={{
          width: "100%",
          aspectRatio: theme.code === "D" ? 0.95 : 1.08,
        }}
      />
      <View style={styles.detailTitleBlock}>
        <Text style={[styles.smallEyebrow, { color: theme.accent }]}>
          MAISON SAMPLE
        </Text>
        <Text
          style={[
            theme.code === "D" ? styles.darkResultTitle : styles.detailTitle,
            { color: theme.text },
          ]}
        >
          {item.name}
        </Text>
        <Text style={[styles.outfitReason, { color: theme.muted }]}>
          단정한 조직감과 여유 있는 품이 특징인 봄·여름 상의예요.
        </Text>
      </View>
      <View
        style={[
          styles.detailInfoCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: theme.cardRadius,
          },
        ]}
      >
        <DetailRows theme={theme} />
      </View>
      <View
        style={[
          styles.measurementCard,
          {
            backgroundColor: theme.code === "C" ? theme.surfaceAlt : theme.surface,
            borderColor: theme.border,
            borderRadius: theme.cardRadius,
          },
        ]}
      >
        <View style={styles.reasonHeader}>
          <Text style={[styles.reasonTitle, { color: theme.text }]}>
            내 체형 기준 추천 사이즈
          </Text>
          <PreviewTag theme={theme} active>
            L 추천
          </PreviewTag>
        </View>
        <Text style={[styles.noticeText, { color: theme.muted }]}>
          총장과 가슴 품이 평소 잘 맞는 기준 옷과 가장 비슷해요.
        </Text>
        <Text style={[styles.textLink, { color: theme.accent }]}>
          상품 실측 보기 →
        </Text>
      </View>
      <View style={styles.minimalActionRow}>
        <PreviewButton theme={theme} label="정보 수정" icon="edit-3" inline />
        <PreviewButton
          theme={theme}
          label="분석 최신화"
          icon="refresh-cw"
          secondary
          inline
        />
      </View>
      <Pressable
        style={[styles.dangerButton, { borderColor: theme.warning }]}
      >
        <Feather name="trash-2" size={15} color={theme.warning} />
        <Text style={[styles.dangerButtonText, { color: theme.warning }]}>
          이 옷 삭제
        </Text>
      </Pressable>
    </ScreenFrame>
  );
}

function ProfileScreen({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const groups = [
    {
      title: "체형과 사이즈",
      icon: "user",
      text: "상의 L · 하의 32 · 신발 270",
    },
    {
      title: "선호 스타일",
      icon: "heart",
      text: "미니멀 · 데일리 · 깔끔함",
    },
    {
      title: "내 기준 옷",
      icon: "bookmark",
      text: "상의·하의 기준 옷 설정 완료",
    },
    {
      title: "데이터 백업",
      icon: "shield",
      text: "마지막 백업 7월 20일",
    },
    {
      title: "분석 상태",
      icon: "refresh-cw",
      text: "12개 중 5개 최신화 중",
    },
    {
      title: "앱 설정",
      icon: "settings",
      text: "알림 · 접근성 · 개인정보",
    },
  ];

  return (
    <ScreenFrame theme={theme} active="profile" onNavigate={onNavigate}>
      <ScreenHeader
        theme={theme}
        title={theme.code === "D" ? "PROFILE / DOHYEON" : "마이"}
        subtitle="추천이 내 몸과 취향에 맞도록 기준을 관리해요."
      />
      <View
        style={[
          styles.profileHero,
          {
            backgroundColor:
              theme.code === "D" ? theme.surfaceAlt : theme.surface,
            borderColor: theme.border,
            borderRadius: theme.cardRadius,
          },
        ]}
      >
        <View
          style={[
            styles.profileAvatar,
            { backgroundColor: theme.accent, borderColor: theme.accent },
          ]}
        >
          <Text style={{ color: theme.accentText, fontSize: 22, fontWeight: "800" }}>
            D
          </Text>
        </View>
        <View style={styles.flexOne}>
          <Text style={[styles.detailTitle, { color: theme.text }]}>도현</Text>
          <Text style={[styles.rowMeta, { color: theme.muted }]}>
            내 기준 4개 · 상세 치수 7개 입력
          </Text>
        </View>
        <Feather name="edit-2" size={18} color={theme.accent} />
      </View>
      <View
        style={[
          styles.profileGroups,
          {
            backgroundColor:
              theme.code === "B" ? theme.surface : "transparent",
            borderColor: theme.border,
          },
        ]}
      >
        {groups.map((group) => (
          <Pressable
            key={group.title}
            style={[
              styles.profileRow,
              {
                backgroundColor:
                  theme.code === "B" ? "transparent" : theme.surface,
                borderBottomColor: theme.border,
                borderRadius: theme.code === "B" ? 0 : theme.cardRadius,
              },
            ]}
          >
            <View
              style={[
                styles.profileRowIcon,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <Feather
                name={group.icon as keyof typeof Feather.glyphMap}
                size={17}
                color={theme.accent}
              />
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                {group.title}
              </Text>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>
                {group.text}
              </Text>
            </View>
            <Feather name="chevron-right" size={17} color={theme.muted} />
          </Pressable>
        ))}
      </View>
      <View
        style={[
          styles.privacyNote,
          { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
        ]}
      >
        <Feather name="lock" size={16} color={theme.accent} />
        <Text style={[styles.noticeText, { color: theme.muted }]}>
          신체 정보와 옷장 데이터는 내 기기에 저장됩니다.
        </Text>
      </View>
    </ScreenFrame>
  );
}

function PreviewApp({
  theme,
  screen,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  screen: DesignPreviewScreenId;
  onNavigate: NavigateToScreen;
}) {
  if (theme.code === "F" || theme.code === "G" || theme.code === "H") {
    return (
      <AlternativePreviewApp
        theme={theme}
        screen={screen}
        onNavigate={onNavigate}
      />
    );
  }

  if (
    theme.code === "I" ||
    theme.code === "J" ||
    theme.code === "K" ||
    theme.code === "L"
  ) {
    return (
      <ExperimentalPreviewApp
        theme={theme}
        screen={screen}
        onNavigate={onNavigate}
      />
    );
  }

  switch (screen) {
    case "closet":
      return <ClosetScreen theme={theme} onNavigate={onNavigate} />;
    case "readiness":
      return (
        <ReadinessScreen theme={theme} ready={false} onNavigate={onNavigate} />
      );
    case "ready":
      return (
        <ReadinessScreen theme={theme} ready onNavigate={onNavigate} />
      );
    case "result":
      return <ResultScreen theme={theme} onNavigate={onNavigate} />;
    case "add":
      return <AddScreen theme={theme} onNavigate={onNavigate} />;
    case "detail":
      return <DetailScreen theme={theme} onNavigate={onNavigate} />;
    case "profile":
      return <ProfileScreen theme={theme} onNavigate={onNavigate} />;
    default:
      return <HomeScreen theme={theme} onNavigate={onNavigate} />;
  }
}

export default function DesignPreviewGallery() {
  const params = useLocalSearchParams<{
    concept?: string;
    screen?: string;
    standalone?: string;
  }>();
  const { width, height } = useWindowDimensions();
  const conceptValue = Array.isArray(params.concept)
    ? params.concept[0]
    : params.concept;
  const screenValue = Array.isArray(params.screen)
    ? params.screen[0]
    : params.screen;
  const standaloneValue = Array.isArray(params.standalone)
    ? params.standalone[0]
    : params.standalone;
  const theme = getDesignPreviewConcept(conceptValue);
  const screen = getDesignPreviewScreen(screenValue);
  const standalone = standaloneValue === "1";

  function replaceRoute(
    concept: DesignPreviewConceptId,
    nextScreen: DesignPreviewScreenId
  ) {
    router.replace({
      pathname: "/design-preview/[concept]",
      params: {
        concept,
        screen: nextScreen,
        ...(standalone ? { standalone: "1" } : {}),
      },
    });
  }

  if (standalone) {
    return (
      <PreviewApp
        theme={theme}
        screen={screen}
        onNavigate={(nextScreen) => replaceRoute(theme.id, nextScreen)}
      />
    );
  }

  const isDesktop = width >= 760;
  const phoneHeight = Math.min(Math.max(height - 40, 660), 844);

  return (
    <View style={styles.galleryPage}>
      <View
        style={[
          styles.galleryLayout,
          isDesktop ? styles.galleryLayoutDesktop : styles.galleryLayoutMobile,
        ]}
      >
        <View
          style={[
            styles.galleryPanel,
            isDesktop ? styles.galleryPanelDesktop : styles.galleryPanelMobile,
          ]}
        >
          <View style={styles.galleryHeader}>
            <View>
              <Text style={styles.galleryEyebrow}>NAES DESIGN STUDY</Text>
              <Text style={styles.galleryTitle}>UI 방향 비교</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.fullscreenButton}
              onPress={() =>
                router.push({
                  pathname: "/design-preview/[concept]",
                  params: {
                    concept: theme.id,
                    screen,
                    standalone: "1",
                  },
                })
              }
            >
              <Feather name="maximize-2" size={17} color="#111111" />
            </Pressable>
          </View>
          <Text style={styles.galleryDescription}>{theme.summary}</Text>
          <View style={styles.conceptGrid}>
            {DESIGN_PREVIEW_CONCEPTS.map((concept) => {
              const active = concept.id === theme.id;
              return (
                <Pressable
                  key={concept.id}
                  style={[
                    styles.conceptButton,
                    active && styles.conceptButtonActive,
                  ]}
                  onPress={() => replaceRoute(concept.id, screen)}
                >
                  <Text
                    style={[
                      styles.conceptCode,
                      active && styles.conceptCodeActive,
                    ]}
                  >
                    {concept.code}
                  </Text>
                  <Text
                    style={[
                      styles.conceptName,
                      active && styles.conceptNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {concept.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ScrollView
            horizontal={!isDesktop}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.screenSelector,
              isDesktop && styles.screenSelectorDesktop,
            ]}
          >
            {DESIGN_PREVIEW_SCREENS.map((previewScreen) => {
              const active = previewScreen.id === screen;
              return (
                <Pressable
                  key={previewScreen.id}
                  style={[
                    styles.screenButton,
                    active && styles.screenButtonActive,
                  ]}
                  onPress={() => replaceRoute(theme.id, previewScreen.id)}
                >
                  <Text
                    style={[
                      styles.screenButtonText,
                      active && styles.screenButtonTextActive,
                    ]}
                  >
                    {previewScreen.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {isDesktop ? (
            <View style={styles.galleryNotes}>
              <Text style={styles.galleryNotesTitle}>비교 기준</Text>
              <Text style={styles.galleryNotesText}>
                동일한 옷장 데이터와 이미지로 레이아웃, 정보 밀도, 상태 표현,
                내비게이션의 차이만 비교합니다.
              </Text>
              <Text style={styles.galleryNotesText}>
                이 프리뷰는 AsyncStorage를 읽거나 변경하지 않습니다.
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.phoneFrame,
            isDesktop && { height: phoneHeight },
            !isDesktop && styles.phoneFrameMobile,
          ]}
        >
          <PreviewApp
            theme={theme}
            screen={screen}
            onNavigate={(nextScreen) => replaceRoute(theme.id, nextScreen)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1, minWidth: 0 },
  galleryPage: {
    flex: 1,
    backgroundColor: "#EAE8E4",
  },
  galleryLayout: {
    flex: 1,
  },
  galleryLayoutDesktop: {
    flexDirection: "row",
    gap: 28,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  galleryLayoutMobile: {
    flexDirection: "column",
  },
  galleryPanel: {
    backgroundColor: "#FFFFFF",
  },
  galleryPanelDesktop: {
    width: 320,
    alignSelf: "stretch",
    maxHeight: 844,
    padding: 24,
    borderRadius: 20,
  },
  galleryPanelMobile: {
    paddingTop: 18,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D9D5D0",
  },
  galleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  galleryEyebrow: {
    color: "#7A6A5B",
    fontSize: 10,
    fontWeight: "800",
  },
  galleryTitle: {
    color: "#111111",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 3,
  },
  galleryDescription: {
    color: "#6D6862",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  fullscreenButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F1EEE9",
  },
  conceptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
  },
  conceptButton: {
    width: "48%",
    minHeight: 54,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#F2F0ED",
    borderWidth: 1,
    borderColor: "#E2DED8",
  },
  conceptButtonActive: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  conceptCode: {
    color: "#7A6A5B",
    fontSize: 10,
    fontWeight: "800",
  },
  conceptCodeActive: { color: "#D7AE76" },
  conceptName: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  conceptNameActive: { color: "#FFFFFF" },
  screenSelector: {
    gap: 7,
    marginTop: 14,
    paddingRight: 14,
  },
  screenSelectorDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingRight: 0,
  },
  screenButton: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD8D1",
    alignItems: "center",
    justifyContent: "center",
  },
  screenButtonActive: {
    backgroundColor: "#8C6F47",
    borderColor: "#8C6F47",
  },
  screenButtonText: {
    color: "#615B55",
    fontSize: 12,
    fontWeight: "700",
  },
  screenButtonTextActive: { color: "#FFFFFF" },
  galleryNotes: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#E5E0D9",
    gap: 8,
  },
  galleryNotesTitle: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "800",
  },
  galleryNotesText: {
    color: "#77716A",
    fontSize: 12,
    lineHeight: 18,
  },
  phoneFrame: {
    width: 390,
    maxWidth: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D7D3CE",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
  },
  phoneFrameMobile: {
    flex: 1,
    width: "100%",
    borderRadius: 0,
    borderWidth: 0,
  },
  screenFrame: {
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingTop: 26,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 16,
  },
  screenContentNoPadding: {
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  button: {
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonBlock: {
    width: "100%",
    alignSelf: "stretch",
  },
  buttonInline: {
    flex: 1,
    minWidth: 0,
  },
  buttonText: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  tag: {
    minHeight: 30,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  productImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#F1EFEC",
  },
  productTile: { gap: 5 },
  productName: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 3,
  },
  productMeta: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  sectionHeading: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionAction: {
    fontSize: 11,
    fontWeight: "700",
  },
  editorialHeader: { gap: 14 },
  previewLogo: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  headerTextRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  editorialTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 4,
  },
  minimalHeader: {
    minHeight: 66,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  minimalTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  minimalSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  utilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  utilityEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 3,
  },
  utilityTitle: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "800",
  },
  utilityAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityAvatarText: { fontSize: 17, fontWeight: "900" },
  darkHeader: { gap: 5, paddingTop: 4 },
  darkLogo: {
    fontSize: 10,
    fontWeight: "900",
  },
  darkTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },
  darkSubtitle: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  analysisStatus: {
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  analysisStatusText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  previewBottomNav: {
    minHeight: 74,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  previewNavItem: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  previewNavIcon: {
    width: 30,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  previewNavLabel: {
    fontSize: 9,
    fontWeight: "700",
  },
  readinessMetric: { gap: 7 },
  metricLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  metricLabel: { fontSize: 13, fontWeight: "700" },
  metricValue: { fontSize: 12, fontWeight: "800" },
  outfitMosaic: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  outfitMosaicImage: {
    position: "absolute",
  },
  editorialHero: {
    height: 246,
    borderRadius: 22,
    overflow: "hidden",
    position: "relative",
  },
  editorialHeroImage: {
    width: "100%",
    height: "100%",
  },
  editorialHeroOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "62%",
    padding: 20,
    justifyContent: "center",
    backgroundColor: "rgba(53,38,26,0.44)",
  },
  editorialHeroKicker: {
    color: "#F1D9BA",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 7,
  },
  editorialHeroTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
  },
  editorialHeroButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    marginTop: 18,
    paddingHorizontal: 14,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#271E18",
  },
  editorialHeroButtonText: {
    color: "#FFFDF9",
    fontSize: 12,
    fontWeight: "800",
  },
  editorialReadinessRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: 8,
    gap: 5,
  },
  smallEyebrow: {
    fontSize: 9,
    fontWeight: "900",
  },
  readinessHeadline: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 3,
  },
  readinessScore: {
    marginLeft: "auto",
    fontSize: 34,
    fontWeight: "800",
  },
  readinessScoreUnit: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  editorialOutfitCard: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 22,
    gap: 8,
  },
  outfitTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  outfitReason: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  horizontalProducts: {
    flexDirection: "row",
    gap: 9,
  },
  horizontalProduct: {
    flex: 1,
  },
  minimalActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  minimalSummary: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
  },
  minimalSummaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  minimalSummaryValue: { fontSize: 20, fontWeight: "800" },
  minimalSummaryLabel: { fontSize: 10, fontWeight: "600" },
  minimalRecommendation: {
    minHeight: 170,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    gap: 14,
  },
  minimalRecommendationVisual: {
    width: "46%",
    flexShrink: 0,
  },
  minimalRecommendationText: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 6,
  },
  textLink: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 6,
  },
  minimalListRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  minimalListThumb: { width: 52, height: 52 },
  rowTitle: { fontSize: 13, lineHeight: 18, fontWeight: "800" },
  rowMeta: { fontSize: 10, lineHeight: 15, fontWeight: "500" },
  utilityReadinessCard: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 22,
    gap: 14,
  },
  utilityReadinessTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  utilityGauge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityGaugeValue: { fontSize: 18, fontWeight: "900" },
  utilityGaugeLabel: { fontSize: 9, fontWeight: "700", marginTop: 2 },
  utilityCardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  utilityCardText: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "500",
    marginTop: 4,
  },
  utilityActionGrid: { flexDirection: "row", gap: 10 },
  utilityActionCard: {
    flex: 1,
    minHeight: 132,
    padding: 13,
    borderWidth: 1,
    borderRadius: 18,
    gap: 8,
  },
  utilityActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityOutfitCard: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 22,
    gap: 10,
  },
  utilityOutfitFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 3,
    paddingBottom: 3,
  },
  darkHomeHeader: {
    minHeight: 66,
    paddingTop: 28,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  darkHero: {
    height: 410,
    position: "relative",
    overflow: "hidden",
  },
  darkHeroImage: { width: "100%", height: "100%" },
  darkHeroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.46)",
  },
  darkHeroCopy: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 24,
    gap: 8,
  },
  darkHeroEyebrow: { fontSize: 10, fontWeight: "900" },
  darkHeroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 37,
    fontWeight: "900",
  },
  darkHeroText: { fontSize: 11, lineHeight: 17, fontWeight: "600" },
  darkBody: { padding: 18, gap: 16 },
  darkStats: {
    minHeight: 74,
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#33363B",
  },
  darkStat: { flex: 1, alignItems: "center", justifyContent: "center" },
  darkStatValue: { fontSize: 22, fontWeight: "900" },
  darkStatLabel: { fontSize: 8, fontWeight: "800", marginTop: 2 },
  searchField: {
    minHeight: 46,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchPlaceholder: { flex: 1, fontSize: 12, fontWeight: "500" },
  filterRow: { gap: 7, paddingRight: 12 },
  closetToolbar: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toolbarText: { fontSize: 13, fontWeight: "800" },
  toolbarActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  toolbarAction: { fontSize: 11, fontWeight: "600" },
  editorialAnalysisLine: {
    paddingBottom: 13,
    borderBottomWidth: 1,
    gap: 7,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  editorialReadinessHero: {
    minHeight: 184,
    justifyContent: "flex-end",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#D8C9BB",
  },
  editorialBigNumber: { fontSize: 68, lineHeight: 76, fontWeight: "800" },
  editorialBigUnit: { fontSize: 24, fontWeight: "600" },
  readinessList: { gap: 15 },
  minimalNotice: {
    padding: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeTitle: { fontSize: 13, lineHeight: 18, fontWeight: "800" },
  noticeText: { fontSize: 11, lineHeight: 17, fontWeight: "500" },
  minimalChecklist: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  checklistRow: {
    minHeight: 52,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
  },
  checklistLabel: { flex: 1, fontSize: 12, fontWeight: "700" },
  checklistValue: { fontSize: 11, fontWeight: "700" },
  utilityProgressCard: {
    padding: 18,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: "center",
    gap: 8,
  },
  utilityLargeGauge: {
    width: 122,
    height: 122,
    borderRadius: 61,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  utilityLargeGaugeValue: { fontSize: 25, fontWeight: "900" },
  utilityMetricsCard: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 22,
    gap: 15,
  },
  darkReadinessCenter: {
    minHeight: 245,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#33363B",
  },
  darkReadinessValue: { fontSize: 96, lineHeight: 102, fontWeight: "900" },
  darkReadinessUnit: { fontSize: 11, fontWeight: "900" },
  darkReadinessCopy: {
    maxWidth: 250,
    marginTop: 14,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  darkReadinessList: { gap: 15, paddingVertical: 6 },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  qualityBadge: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qualityBadgeText: { fontSize: 11, fontWeight: "800" },
  reasonCard: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 14,
    gap: 9,
  },
  reasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reasonTitle: { fontSize: 14, fontWeight: "800" },
  reasonText: { fontSize: 11, lineHeight: 18, fontWeight: "500" },
  cautionRow: {
    minHeight: 56,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  cautionText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "500",
  },
  feedbackRow: { flexDirection: "row", gap: 9 },
  alternativeRow: { flexDirection: "row", gap: 8 },
  alternativeCard: {
    flex: 1,
    padding: 6,
    borderWidth: 1,
    borderRadius: 12,
    gap: 5,
  },
  alternativeText: { fontSize: 9, fontWeight: "700" },
  darkResultHero: { height: 238, position: "relative" },
  darkResultTop: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  darkResultTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
  },
  addMethodList: { gap: 10 },
  addMethodCard: {
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  addMethodIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  addMethodTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  addMethodText: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "500",
    marginTop: 4,
  },
  addMethodMeta: { alignItems: "flex-end", gap: 7 },
  addMethodMetaText: { fontSize: 9, fontWeight: "800" },
  utilityStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  utilityStep: { width: "23%", alignItems: "center", gap: 5 },
  utilityStepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityStepLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  mockAnalysisCard: { padding: 14, borderWidth: 1, gap: 8 },
  mockAnalysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mockReviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  minimalDetailIntro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  minimalDetailImage: { width: 126, height: 126 },
  detailTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  detailRows: { gap: 0 },
  detailRow: {
    minHeight: 48,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderBottomWidth: 1,
  },
  detailLabel: { width: 82, fontSize: 11, lineHeight: 17, fontWeight: "600" },
  detailValue: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  detailTitleBlock: { gap: 5 },
  detailInfoCard: { paddingHorizontal: 14, borderWidth: 1 },
  measurementCard: { padding: 15, borderWidth: 1, gap: 8 },
  deleteText: {
    minHeight: 44,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 12,
    fontWeight: "800",
  },
  dangerButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  dangerButtonText: { fontSize: 12, fontWeight: "800" },
  profileHero: {
    minHeight: 100,
    padding: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileGroups: { gap: 8, borderWidth: 0 },
  profileRow: {
    minHeight: 72,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: 1,
  },
  profileRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyNote: {
    padding: 13,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  hybridHeader: {
    gap: 7,
  },
  hybridHeaderTop: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hybridEdition: {
    minHeight: 25,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  hybridEditionText: {
    fontSize: 9,
    fontWeight: "900",
  },
  hybridTitle: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
  },
  hybridHero: {
    height: 258,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#17181A",
  },
  hybridHeroImage: {
    width: "100%",
    height: "100%",
  },
  hybridHeroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,16,15,0.43)",
  },
  hybridHeroCopy: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
  },
  hybridHeroKicker: {
    color: "#D5A55F",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 7,
  },
  hybridHeroTitle: {
    color: "#FFFDF8",
    fontSize: 31,
    lineHeight: 34,
    fontWeight: "900",
  },
  hybridHeroText: {
    color: "#E8E0D7",
    maxWidth: 255,
    marginTop: 8,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  hybridActionRow: {
    flexDirection: "row",
    gap: 9,
  },
  hybridReadiness: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    paddingVertical: 4,
  },
  hybridReadinessNumber: {
    fontSize: 37,
    lineHeight: 40,
    fontWeight: "900",
  },
  hybridOutfitCard: {
    minHeight: 174,
    padding: 10,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  hybridOutfitVisual: {
    width: "48%",
    flexShrink: 0,
  },
  hybridReadinessHero: {
    minHeight: 210,
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#17181A",
    justifyContent: "center",
  },
  hybridReadinessKicker: {
    color: "#D5A55F",
    fontSize: 10,
    fontWeight: "900",
  },
  hybridReadinessValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 11,
  },
  hybridReadinessValue: {
    color: "#FFFDF8",
    fontSize: 72,
    lineHeight: 76,
    fontWeight: "900",
  },
  hybridReadinessGoal: {
    color: "#D5A55F",
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "900",
  },
  hybridReadinessCopy: {
    color: "#D9D2CA",
    maxWidth: 285,
    marginTop: 8,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  hybridMetricsCard: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 18,
    gap: 14,
  },
  hybridResultHero: {
    height: 258,
    paddingTop: 10,
    paddingHorizontal: 12,
    position: "relative",
    backgroundColor: "#17181A",
  },
  hybridResultHeroTop: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hybridResultKicker: {
    color: "#B98545",
    fontSize: 9,
    fontWeight: "900",
  },
  hybridGoldBadge: {
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D5A55F",
  },
  hybridGoldBadgeText: {
    color: "#17181A",
    fontSize: 11,
    fontWeight: "900",
  },
  hybridResultBody: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 16,
    backgroundColor: "#F2EBE2",
  },
});
