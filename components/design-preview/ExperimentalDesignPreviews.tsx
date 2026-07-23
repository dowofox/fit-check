import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  DESIGN_PREVIEW_ITEMS,
  DESIGN_PREVIEW_OUTFIT_ITEMS,
  DESIGN_PREVIEW_READINESS,
  type DesignPreviewItem,
  type DesignPreviewScreenId,
  type DesignPreviewTokens,
} from "@/components/design-preview/designPreviewData";

type NavigateToScreen = (screen: DesignPreviewScreenId) => void;

type ExperimentalPreviewProps = {
  theme: DesignPreviewTokens;
  screen: DesignPreviewScreenId;
  onNavigate: NavigateToScreen;
};

type ExperimentalVariant = "dual" | "stage" | "brief" | "concierge";

function getVariant(theme: DesignPreviewTokens): ExperimentalVariant {
  if (theme.code === "J") return "stage";
  if (theme.code === "K") return "brief";
  if (theme.code === "L") return "concierge";
  return "dual";
}

function ProductImage({
  item,
  theme,
  style,
  contain = false,
}: {
  item: DesignPreviewItem;
  theme: DesignPreviewTokens;
  style?: object;
  contain?: boolean;
}) {
  return (
    <Image
      source={item.image}
      resizeMode={contain ? "contain" : "cover"}
      style={[
        styles.productImage,
        { backgroundColor: theme.surfaceAlt, borderRadius: theme.imageRadius },
        style,
      ]}
    />
  );
}

function ExperimentalBottomNav({
  theme,
  active,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  active: "home" | "closet" | "outfit" | "add" | "profile";
  onNavigate: NavigateToScreen;
}) {
  const items: {
    id: "home" | "closet" | "outfit" | "add" | "profile";
    label: string;
    icon: keyof typeof Feather.glyphMap;
    target: DesignPreviewScreenId;
  }[] = [
    { id: "home", label: "홈", icon: "home", target: "home" },
    { id: "closet", label: "옷장", icon: "grid", target: "closet" },
    { id: "add", label: "추가", icon: "plus", target: "add" },
    { id: "outfit", label: "코디", icon: "star", target: "readiness" },
    { id: "profile", label: "마이", icon: "user", target: "profile" },
  ];

  return (
    <View
      style={[
        styles.bottomNav,
        { backgroundColor: theme.surface, borderTopColor: theme.border },
      ]}
    >
      {items.map((item) => {
        const selected = item.id === active;
        const isAdd = item.id === "add";
        return (
          <Pressable
            key={item.id}
            style={styles.navItem}
            onPress={() => onNavigate(item.target)}
          >
            <View
              style={[
                styles.navIcon,
                isAdd && {
                  backgroundColor: theme.accent,
                  borderRadius: theme.code === "I" ? 4 : 999,
                },
              ]}
            >
              <Feather
                name={item.icon}
                size={isAdd ? 19 : 16}
                color={
                  isAdd
                    ? theme.accentText
                    : selected
                      ? theme.accent
                      : theme.muted
                }
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                { color: selected ? theme.accent : theme.muted },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ExperimentalShell({
  theme,
  active,
  onNavigate,
  children,
  edge = false,
}: {
  theme: DesignPreviewTokens;
  active: "home" | "closet" | "outfit" | "add" | "profile";
  onNavigate: NavigateToScreen;
  children: ReactNode;
  edge?: boolean;
}) {
  return (
    <View style={[styles.shell, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={[
          styles.content,
          edge ? styles.edgeContent : undefined,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <ExperimentalBottomNav
        theme={theme}
        active={active}
        onNavigate={onNavigate}
      />
    </View>
  );
}

function DualCanvasHome({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  return (
    <ExperimentalShell theme={theme} active="home" onNavigate={onNavigate} edge>
      <View style={styles.dualHeader}>
        <Text style={[styles.dualLogo, { color: theme.text }]}>NAES</Text>
        <Text style={[styles.microLabel, { color: theme.muted }]}>
          THU · SEOUL 24°
        </Text>
      </View>

      <Pressable
        style={styles.dualTopPanel}
        onPress={() => onNavigate("result")}
      >
        <Image
          source={require("@/assets/images/hero-fashion-wide.png")}
          resizeMode="cover"
          style={styles.fillImage}
        />
        <View style={styles.dualShade} />
        <View style={styles.dualPanelCopy}>
          <Text style={styles.dualNumber}>01</Text>
          <Text style={styles.dualKicker}>TODAY&apos;S OUTFIT</Text>
          <Text style={styles.dualTitle}>오늘 입을 옷을{"\n"}바로 골라볼게요</Text>
          <View style={styles.dualArrow}>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </View>
        </View>
      </Pressable>

      <Pressable
        style={[
          styles.dualBottomPanel,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
        onPress={() => onNavigate("add")}
      >
        <View style={styles.dualSecondCopy}>
          <Text style={[styles.dualNumber, { color: theme.accent }]}>02</Text>
          <Text style={[styles.dualKicker, { color: theme.accent }]}>
            CHECK THE FIT
          </Text>
          <Text style={[styles.dualSecondTitle, { color: theme.text }]}>
            사고 싶은 옷이{"\n"}나에게 맞을까요?
          </Text>
          <Text style={[styles.smallBody, { color: theme.muted }]}>
            상품 링크로 실측과 내 체형을 비교해요.
          </Text>
        </View>
        <View style={styles.dualProductStack}>
          <ProductImage
            item={DESIGN_PREVIEW_ITEMS[0]}
            theme={theme}
            style={styles.dualProductBack}
            contain
          />
          <ProductImage
            item={DESIGN_PREVIEW_ITEMS[3]}
            theme={theme}
            style={styles.dualProductFront}
            contain
          />
        </View>
      </Pressable>
    </ExperimentalShell>
  );
}

function WardrobeStageHome({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  return (
    <ExperimentalShell theme={theme} active="home" onNavigate={onNavigate}>
      <View style={styles.stageHeader}>
        <View>
          <Text style={[styles.microLabel, { color: theme.accent }]}>
            MY WARDROBE · 18
          </Text>
          <Text style={[styles.stageLogo, { color: theme.text }]}>NAES</Text>
        </View>
        <View style={[styles.stageAvatar, { borderColor: theme.border }]}>
          <Feather name="user" size={16} color={theme.text} />
        </View>
      </View>

      <View>
        <Text style={[styles.stageTitle, { color: theme.text }]}>
          옷부터 보고,{"\n"}할 일을 고르세요
        </Text>
        <Text style={[styles.stageSubtitle, { color: theme.muted }]}>
          오늘 입을 수 있는 옷을 먼저 펼쳐두었어요.
        </Text>
      </View>

      <View
        style={[
          styles.wardrobeStage,
          { backgroundColor: theme.surfaceAlt },
        ]}
      >
        <View style={[styles.stageRail, { backgroundColor: theme.border }]} />
        <ProductImage
          item={DESIGN_PREVIEW_ITEMS[1]}
          theme={theme}
          style={[styles.stageItem, styles.stageItemOne]}
          contain
        />
        <ProductImage
          item={DESIGN_PREVIEW_ITEMS[3]}
          theme={theme}
          style={[styles.stageItem, styles.stageItemTwo]}
          contain
        />
        <ProductImage
          item={DESIGN_PREVIEW_ITEMS[5]}
          theme={theme}
          style={[styles.stageItem, styles.stageItemThree]}
          contain
        />
        <View style={[styles.stageCaption, { backgroundColor: theme.surface }]}>
          <Text style={[styles.microLabel, { color: theme.accent }]}>
            READY FOR TODAY
          </Text>
          <Text style={[styles.stageCaptionTitle, { color: theme.text }]}>
            12가지 조합 가능
          </Text>
        </View>
      </View>

      <View style={styles.stageCommands}>
        <Pressable
          style={[styles.stageCommand, { backgroundColor: theme.accent }]}
          onPress={() => onNavigate("result")}
        >
          <Feather name="sun" size={18} color={theme.accentText} />
          <View style={styles.flexOne}>
            <Text style={[styles.commandTitle, { color: theme.accentText }]}>
              오늘 코디 찾기
            </Text>
            <Text style={styles.commandInverseText}>내 옷으로 바로 조합</Text>
          </View>
          <Feather name="arrow-up-right" size={17} color={theme.accentText} />
        </Pressable>
        <Pressable
          style={[
            styles.stageCommand,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => onNavigate("add")}
        >
          <Feather name="link" size={18} color={theme.accent} />
          <View style={styles.flexOne}>
            <Text style={[styles.commandTitle, { color: theme.text }]}>
              새 상품 핏 보기
            </Text>
            <Text style={[styles.smallBody, { color: theme.muted }]}>
              링크로 실측 비교
            </Text>
          </View>
          <Feather name="arrow-up-right" size={17} color={theme.text} />
        </Pressable>
      </View>
    </ExperimentalShell>
  );
}

function DailyBriefHome({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  return (
    <ExperimentalShell theme={theme} active="home" onNavigate={onNavigate}>
      <View style={styles.briefTop}>
        <Text style={[styles.briefLogo, { color: theme.text }]}>NAES</Text>
        <View style={styles.briefWeather}>
          <Feather name="sun" size={14} color={theme.text} />
          <Text style={[styles.briefWeatherText, { color: theme.text }]}>
            24° · 맑음
          </Text>
        </View>
      </View>

      <View style={styles.briefHeading}>
        <Text style={[styles.microLabel, { color: theme.muted }]}>
          THURSDAY, JUNE 14
        </Text>
        <Text style={[styles.briefTitle, { color: theme.text }]}>
          오늘은 이렇게 입어보세요
        </Text>
      </View>

      <Pressable
        style={[
          styles.briefFeature,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
        onPress={() => onNavigate("result")}
      >
        <View
          style={[
            styles.briefOutfit,
            { backgroundColor: theme.surfaceAlt },
          ]}
        >
          {DESIGN_PREVIEW_OUTFIT_ITEMS.slice(0, 3).map((item, index) => (
            <ProductImage
              key={item.id}
              item={item}
              theme={theme}
              style={[
                styles.briefOutfitItem,
                {
                  left: index === 0 ? "4%" : index === 1 ? "35%" : "68%",
                  top: index === 2 ? "45%" : "8%",
                  width: index === 2 ? "29%" : "31%",
                  height: index === 2 ? "48%" : "76%",
                },
              ]}
              contain
            />
          ))}
          <View style={styles.briefPagination}>
            <View style={[styles.pageDot, { backgroundColor: theme.accent }]} />
            <View style={[styles.pageDot, { backgroundColor: theme.border }]} />
            <View style={[styles.pageDot, { backgroundColor: theme.border }]} />
          </View>
        </View>
        <View style={styles.briefCopy}>
          <View style={styles.briefLabelRow}>
            <Text style={[styles.microLabel, { color: theme.success }]}>
              TODAY&apos;S PICK
            </Text>
            <Feather name="bookmark" size={15} color={theme.muted} />
          </View>
          <Text style={[styles.briefLookTitle, { color: theme.text }]}>
            아이보리 니트와 차콜 슬랙스
          </Text>
          <Text style={[styles.smallBody, { color: theme.muted }]}>
            큰 일교차에도 단정하고 편안한 조합이에요.
          </Text>
          <View style={styles.briefOpenRow}>
            <Text style={[styles.briefOpenText, { color: theme.text }]}>
              코디 자세히 보기
            </Text>
            <Feather name="arrow-right" size={16} color={theme.text} />
          </View>
        </View>
      </Pressable>

      <View style={styles.briefActions}>
        <Pressable
          style={[styles.briefAction, { borderColor: theme.border }]}
          onPress={() => onNavigate("readiness")}
        >
          <Feather name="shuffle" size={17} color={theme.text} />
          <Text style={[styles.briefActionText, { color: theme.text }]}>
            다른 코디
          </Text>
        </Pressable>
        <Pressable
          style={[styles.briefAction, { borderColor: theme.border }]}
          onPress={() => onNavigate("add")}
        >
          <Feather name="shopping-bag" size={17} color={theme.text} />
          <Text style={[styles.briefActionText, { color: theme.text }]}>
            새 옷 핏 보기
          </Text>
        </Pressable>
      </View>
    </ExperimentalShell>
  );
}

function StyleConciergeHome({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const choices: {
    number: string;
    title: string;
    text: string;
    icon: keyof typeof Feather.glyphMap;
    target: DesignPreviewScreenId;
  }[] = [
    {
      number: "01",
      title: "오늘 입을 옷을 골라줘",
      text: "날씨와 내 옷장으로 추천",
      icon: "sun",
      target: "result",
    },
    {
      number: "02",
      title: "사고 싶은 옷의 핏을 봐줘",
      text: "상품 링크로 실측 비교",
      icon: "shopping-bag",
      target: "add",
    },
    {
      number: "03",
      title: "내 옷장을 둘러볼래",
      text: "검색하고 정리하기",
      icon: "grid",
      target: "closet",
    },
  ];

  return (
    <ExperimentalShell theme={theme} active="home" onNavigate={onNavigate}>
      <View style={styles.conciergeTop}>
        <View>
          <Text style={[styles.conciergeLogo, { color: theme.text }]}>NAES</Text>
          <Text style={[styles.microLabel, { color: theme.muted }]}>
            YOUR STYLE CONCIERGE
          </Text>
        </View>
        <View
          style={[
            styles.conciergeMonogram,
            { backgroundColor: theme.accent },
          ]}
        >
          <Text style={styles.conciergeMonogramText}>N</Text>
        </View>
      </View>

      <View style={styles.conciergeIntro}>
        <Text style={[styles.conciergeGreeting, { color: theme.muted }]}>
          안녕하세요, 도현님.
        </Text>
        <Text style={[styles.conciergeTitle, { color: theme.text }]}>
          오늘은 무엇을{"\n"}도와드릴까요?
        </Text>
      </View>

      <View
        style={[
          styles.conciergeChoices,
          { borderTopColor: theme.text },
        ]}
      >
        {choices.map((choice) => (
          <Pressable
            key={choice.number}
            style={[
              styles.conciergeChoice,
              { borderBottomColor: theme.border },
            ]}
            onPress={() => onNavigate(choice.target)}
          >
            <Text style={[styles.conciergeNumber, { color: theme.accent }]}>
              {choice.number}
            </Text>
            <View
              style={[
                styles.conciergeChoiceIcon,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <Feather name={choice.icon} size={17} color={theme.accent} />
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.conciergeChoiceTitle, { color: theme.text }]}>
                {choice.title}
              </Text>
              <Text style={[styles.smallBody, { color: theme.muted }]}>
                {choice.text}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.muted} />
          </Pressable>
        ))}
      </View>

      <View
        style={[
          styles.conciergeNote,
          { backgroundColor: theme.surfaceAlt },
        ]}
      >
        <Text style={[styles.microLabel, { color: theme.accent }]}>
          TODAY&apos;S NOTE
        </Text>
        <Text style={[styles.conciergeNoteText, { color: theme.text }]}>
          오늘은 24도예요. 가벼운 상의와 긴 하의가 자연스러워요.
        </Text>
      </View>
    </ExperimentalShell>
  );
}

function ExperimentalHome({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const variant = getVariant(theme);
  if (variant === "stage") {
    return <WardrobeStageHome theme={theme} onNavigate={onNavigate} />;
  }
  if (variant === "brief") {
    return <DailyBriefHome theme={theme} onNavigate={onNavigate} />;
  }
  if (variant === "concierge") {
    return <StyleConciergeHome theme={theme} onNavigate={onNavigate} />;
  }
  return <DualCanvasHome theme={theme} onNavigate={onNavigate} />;
}

const SCREEN_COPY: Record<
  DesignPreviewScreenId,
  { eyebrow: string; title: string; subtitle: string }
> = {
  home: {
    eyebrow: "HOME",
    title: "오늘 무엇을 도와드릴까요?",
    subtitle: "",
  },
  closet: {
    eyebrow: "MY WARDROBE",
    title: "내 옷장",
    subtitle: "18벌의 옷을 종류와 색상으로 빠르게 찾아보세요.",
  },
  readiness: {
    eyebrow: "BEFORE RECOMMENDATION",
    title: "조금만 더 채우면 좋아요",
    subtitle: "억지로 추천하지 않고, 지금 필요한 옷만 알려드릴게요.",
  },
  ready: {
    eyebrow: "READY",
    title: "오늘의 코디를 볼 수 있어요",
    subtitle: "현재 옷장으로 서로 다른 12가지 조합을 만들 수 있어요.",
  },
  result: {
    eyebrow: "TODAY'S LOOK",
    title: "단정하지만 편안한 조합",
    subtitle: "지금 날씨와 내 옷장에서 가장 자연스러운 옷을 골랐어요.",
  },
  add: {
    eyebrow: "ADD AN ITEM",
    title: "새 옷을 어떻게 추가할까요?",
    subtitle: "상품 링크가 가장 정확하고, 사진 등록이 가장 빨라요.",
  },
  detail: {
    eyebrow: "ITEM DETAIL",
    title: "아이보리 반팔 니트",
    subtitle: "내 체형과 옷장에 필요한 정보만 정리했어요.",
  },
  profile: {
    eyebrow: "MY PROFILE",
    title: "내 기준",
    subtitle: "추천에 사용하는 신체 정보와 기준 옷을 관리해요.",
  },
};

function InnerHeader({
  theme,
  screen,
}: {
  theme: DesignPreviewTokens;
  screen: DesignPreviewScreenId;
}) {
  const copy = SCREEN_COPY[screen];
  return (
    <View style={styles.innerHeader}>
      <View style={styles.innerTop}>
        <Text style={[styles.innerLogo, { color: theme.text }]}>NAES</Text>
        <Feather name="more-horizontal" size={18} color={theme.muted} />
      </View>
      <Text style={[styles.microLabel, { color: theme.accent }]}>
        {copy.eyebrow}
      </Text>
      <Text style={[styles.innerTitle, { color: theme.text }]}>
        {copy.title}
      </Text>
      <Text style={[styles.innerSubtitle, { color: theme.muted }]}>
        {copy.subtitle}
      </Text>
    </View>
  );
}

function OutfitComposition({ theme }: { theme: DesignPreviewTokens }) {
  return (
    <View
      style={[
        styles.outfitComposition,
        { backgroundColor: theme.surfaceAlt },
      ]}
    >
      {DESIGN_PREVIEW_OUTFIT_ITEMS.map((item, index) => (
        <ProductImage
          key={item.id}
          item={item}
          theme={theme}
          contain
          style={[
            styles.compositionItem,
            {
              left: index % 2 === 0 ? "4%" : "51%",
              top: index < 2 ? "4%" : "52%",
            },
          ]}
        />
      ))}
    </View>
  );
}

function ExperimentalInnerScreen({
  theme,
  screen,
  onNavigate,
}: ExperimentalPreviewProps) {
  const active =
    screen === "closet"
      ? "closet"
      : screen === "add"
        ? "add"
        : screen === "profile"
          ? "profile"
          : "outfit";

  return (
    <ExperimentalShell
      theme={theme}
      active={active}
      onNavigate={onNavigate}
    >
      <InnerHeader theme={theme} screen={screen} />

      {screen === "closet" ? (
        <>
          <View
            style={[
              styles.innerSearch,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Feather name="search" size={16} color={theme.muted} />
            <Text style={[styles.searchText, { color: theme.muted }]}>
              이름, 종류, 색상으로 찾기
            </Text>
            <Feather name="sliders" size={16} color={theme.text} />
          </View>
          <View style={styles.innerGrid}>
            {DESIGN_PREVIEW_ITEMS.slice(0, 6).map((item) => (
              <View key={item.id} style={styles.innerGridItem}>
                <ProductImage
                  item={item}
                  theme={theme}
                  style={styles.innerGridImage}
                />
                <Text
                  style={[styles.innerItemTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={[styles.microLabel, { color: theme.muted }]}>
                  {item.category}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : screen === "result" ? (
        <>
          <OutfitComposition theme={theme} />
          <View style={styles.innerResultCopy}>
            <Text style={[styles.innerSectionTitle, { color: theme.text }]}>
              이 조합이 자연스러운 이유
            </Text>
            <Text style={[styles.innerSubtitle, { color: theme.muted }]}>
              아이보리와 차콜이 안정적인 대비를 만들고, 슬랙스의 선이 니트의
              부드러운 인상을 정리해줘요.
            </Text>
          </View>
          <Pressable
            style={[styles.innerPrimary, { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.innerPrimaryText, { color: theme.accentText }]}>
              이 코디 저장하기
            </Text>
            <Feather name="bookmark" size={17} color={theme.accentText} />
          </Pressable>
        </>
      ) : screen === "readiness" || screen === "ready" ? (
        <>
          <View style={[styles.readinessList, { borderTopColor: theme.text }]}>
            {[
              ["상의", screen === "ready" ? 4 : DESIGN_PREVIEW_READINESS.tops, 3],
              ["하의", screen === "ready" ? 4 : DESIGN_PREVIEW_READINESS.bottoms, 3],
              ["신발", screen === "ready" ? 2 : DESIGN_PREVIEW_READINESS.shoes, 2],
              [
                "서로 다른 조합",
                screen === "ready"
                  ? 12
                  : DESIGN_PREVIEW_READINESS.coreCombinations,
                6,
              ],
            ].map(([label, current, required]) => {
              const complete = Number(current) >= Number(required);
              return (
                <View
                  key={String(label)}
                  style={[
                    styles.readinessRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text style={[styles.readinessLabel, { color: theme.text }]}>
                    {label}
                  </Text>
                  <Text
                    style={[
                      styles.readinessValue,
                      { color: complete ? theme.success : theme.warning },
                    ]}
                  >
                    {current} / {required}
                  </Text>
                </View>
              );
            })}
          </View>
          <Pressable
            style={[styles.innerPrimary, { backgroundColor: theme.accent }]}
            onPress={() =>
              onNavigate(screen === "ready" ? "result" : "add")
            }
          >
            <Text style={[styles.innerPrimaryText, { color: theme.accentText }]}>
              {screen === "ready" ? "오늘 코디 보기" : "필요한 옷 추가하기"}
            </Text>
            <Feather name="arrow-right" size={17} color={theme.accentText} />
          </Pressable>
        </>
      ) : screen === "add" ? (
        <View style={styles.addOptions}>
          {[
            ["link", "상품 링크로 추가", "공식 정보와 실측을 가져와요"],
            ["camera", "사진으로 빠르게 추가", "종류와 색상을 확인해요"],
            ["edit-3", "직접 입력", "필요한 정보만 직접 적어요"],
          ].map(([icon, title, text], index) => (
            <Pressable
              key={title}
              style={[
                styles.addOption,
                {
                  backgroundColor: index === 0 ? theme.accent : theme.surface,
                  borderColor: index === 0 ? theme.accent : theme.border,
                },
              ]}
            >
              <Feather
                name={icon as keyof typeof Feather.glyphMap}
                size={19}
                color={index === 0 ? theme.accentText : theme.accent}
              />
              <View style={styles.flexOne}>
                <Text
                  style={[
                    styles.addOptionTitle,
                    { color: index === 0 ? theme.accentText : theme.text },
                  ]}
                >
                  {title}
                </Text>
                <Text
                  style={[
                    styles.smallBody,
                    {
                      color:
                        index === 0 ? "rgba(255,255,255,0.75)" : theme.muted,
                    },
                  ]}
                >
                  {text}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={index === 0 ? theme.accentText : theme.muted}
              />
            </Pressable>
          ))}
        </View>
      ) : screen === "detail" ? (
        <>
          <View style={styles.detailLead}>
            <ProductImage
              item={DESIGN_PREVIEW_ITEMS[1]}
              theme={theme}
              style={styles.detailImage}
              contain
            />
            <View style={styles.flexOne}>
              <Text style={[styles.microLabel, { color: theme.accent }]}>
                MY ITEM
              </Text>
              <Text style={[styles.innerSectionTitle, { color: theme.text }]}>
                미니멀 · 봄/여름
              </Text>
              <Text style={[styles.smallBody, { color: theme.muted }]}>
                현재 선택 사이즈 L
              </Text>
            </View>
          </View>
          <View style={[styles.detailRows, { borderTopColor: theme.text }]}>
            {[
              ["내 체형 기준", "세미 오버핏"],
              ["추천 기온", "18–26°"],
              ["어울리는 옷", "차콜 슬랙스"],
              ["기준 옷", "설정 안 됨"],
            ].map(([label, value]) => (
              <View
                key={label}
                style={[
                  styles.detailRow,
                  { borderBottomColor: theme.border },
                ]}
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
        </>
      ) : (
        <View style={[styles.profileList, { borderTopColor: theme.text }]}>
          {[
            ["신체 치수", "7개 입력", "activity"],
            ["기준 옷", "상의 · 하의", "bookmark"],
            ["추천 조절", "기본", "sliders"],
            ["데이터 백업", "백업 없음", "download-cloud"],
          ].map(([label, value, icon]) => (
            <View
              key={label}
              style={[
                styles.profileRow,
                { borderBottomColor: theme.border },
              ]}
            >
              <Feather
                name={icon as keyof typeof Feather.glyphMap}
                size={17}
                color={theme.accent}
              />
              <Text style={[styles.profileLabel, { color: theme.text }]}>
                {label}
              </Text>
              <Text style={[styles.profileValue, { color: theme.muted }]}>
                {value}
              </Text>
              <Feather name="chevron-right" size={17} color={theme.muted} />
            </View>
          ))}
        </View>
      )}
    </ExperimentalShell>
  );
}

export function ExperimentalPreviewApp(props: ExperimentalPreviewProps) {
  if (props.screen === "home") {
    return <ExperimentalHome {...props} />;
  }
  return <ExperimentalInnerScreen {...props} />;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 28,
    gap: 18,
  },
  edgeContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 0,
  },
  productImage: {
    overflow: "hidden",
  },
  fillImage: {
    width: "100%",
    height: "100%",
  },
  bottomNav: {
    height: 72,
    paddingTop: 7,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    flexDirection: "row",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  navIcon: {
    width: 36,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 9,
    fontWeight: "700",
  },
  microLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "900",
  },
  smallBody: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  dualHeader: {
    height: 68,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dualLogo: {
    fontSize: 17,
    fontWeight: "900",
  },
  dualTopPanel: {
    height: 330,
    position: "relative",
    overflow: "hidden",
  },
  dualShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14,14,12,0.42)",
  },
  dualPanelCopy: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 22,
  },
  dualNumber: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  dualKicker: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 14,
  },
  dualTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    marginTop: 7,
  },
  dualArrow: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  dualBottomPanel: {
    minHeight: 245,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderBottomWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  dualSecondCopy: {
    flex: 1,
    minWidth: 0,
    zIndex: 2,
  },
  dualSecondTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    marginTop: 7,
    marginBottom: 8,
  },
  dualProductStack: {
    width: 150,
    position: "relative",
  },
  dualProductBack: {
    position: "absolute",
    width: 105,
    height: 130,
    right: -10,
    top: 8,
    transform: [{ rotate: "5deg" }],
  },
  dualProductFront: {
    position: "absolute",
    width: 105,
    height: 134,
    right: 45,
    top: 45,
    transform: [{ rotate: "-4deg" }],
  },
  stageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stageLogo: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  stageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stageTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
  },
  stageSubtitle: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 7,
  },
  wardrobeStage: {
    height: 330,
    borderRadius: 22,
    position: "relative",
    overflow: "hidden",
  },
  stageRail: {
    position: "absolute",
    height: 1,
    left: 24,
    right: 24,
    top: 62,
  },
  stageItem: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  stageItemOne: {
    width: 136,
    height: 206,
    left: 12,
    top: 34,
  },
  stageItemTwo: {
    width: 135,
    height: 220,
    right: 24,
    top: 42,
  },
  stageItemThree: {
    width: 98,
    height: 92,
    right: 15,
    bottom: 17,
  },
  stageCaption: {
    position: "absolute",
    left: 16,
    bottom: 16,
    width: 138,
    minHeight: 62,
    padding: 11,
    borderRadius: 14,
  },
  stageCaptionTitle: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },
  stageCommands: {
    gap: 9,
  },
  stageCommand: {
    minHeight: 70,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  commandTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  commandInverseText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  briefTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  briefLogo: {
    fontSize: 17,
    fontWeight: "900",
  },
  briefWeather: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  briefWeatherText: {
    fontSize: 11,
    fontWeight: "800",
  },
  briefHeading: {
    marginTop: 3,
  },
  briefTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    marginTop: 5,
  },
  briefFeature: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  briefOutfit: {
    height: 286,
    position: "relative",
  },
  briefOutfitItem: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  briefPagination: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 11,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  pageDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  briefCopy: {
    padding: 15,
  },
  briefLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  briefLookTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    marginTop: 7,
    marginBottom: 5,
  },
  briefOpenRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E3E1DC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  briefOpenText: {
    fontSize: 12,
    fontWeight: "800",
  },
  briefActions: {
    flexDirection: "row",
    gap: 8,
  },
  briefAction: {
    flex: 1,
    minHeight: 52,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  briefActionText: {
    fontSize: 11,
    fontWeight: "800",
  },
  conciergeTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  conciergeLogo: {
    fontSize: 17,
    fontWeight: "900",
  },
  conciergeMonogram: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  conciergeMonogramText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  conciergeIntro: {
    marginTop: 14,
    marginBottom: 10,
  },
  conciergeGreeting: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 7,
  },
  conciergeTitle: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "900",
  },
  conciergeChoices: {
    borderTopWidth: 1,
  },
  conciergeChoice: {
    minHeight: 92,
    paddingVertical: 13,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  conciergeNumber: {
    width: 24,
    fontSize: 10,
    fontWeight: "900",
  },
  conciergeChoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  conciergeChoiceTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    marginBottom: 3,
  },
  conciergeNote: {
    minHeight: 90,
    padding: 15,
    borderRadius: 16,
    justifyContent: "center",
  },
  conciergeNoteText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 5,
  },
  innerHeader: {
    gap: 6,
  },
  innerTop: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  innerLogo: {
    fontSize: 16,
    fontWeight: "900",
  },
  innerTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  innerSubtitle: {
    fontSize: 11,
    lineHeight: 18,
    fontWeight: "600",
  },
  innerSearch: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
  },
  innerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  innerGridItem: {
    width: "48%",
  },
  innerGridImage: {
    width: "100%",
    aspectRatio: 0.92,
  },
  innerItemTitle: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 7,
    marginBottom: 2,
  },
  outfitComposition: {
    height: 300,
    borderRadius: 18,
    position: "relative",
  },
  compositionItem: {
    position: "absolute",
    width: "45%",
    height: "44%",
    backgroundColor: "transparent",
  },
  innerResultCopy: {
    gap: 6,
  },
  innerSectionTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
  },
  innerPrimary: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  innerPrimaryText: {
    fontSize: 13,
    fontWeight: "900",
  },
  readinessList: {
    borderTopWidth: 1,
  },
  readinessRow: {
    minHeight: 64,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readinessLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  readinessValue: {
    fontSize: 12,
    fontWeight: "900",
  },
  addOptions: {
    gap: 9,
  },
  addOption: {
    minHeight: 84,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addOptionTitle: {
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 3,
  },
  detailLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  detailImage: {
    width: 132,
    height: 156,
  },
  detailRows: {
    borderTopWidth: 1,
  },
  detailRow: {
    minHeight: 54,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailLabel: {
    width: 92,
    fontSize: 11,
    fontWeight: "600",
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
  },
  profileList: {
    borderTopWidth: 1,
  },
  profileRow: {
    minHeight: 68,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  profileValue: {
    fontSize: 10,
    fontWeight: "600",
  },
});
