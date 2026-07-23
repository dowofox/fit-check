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
  DESIGN_PREVIEW_READY,
  type DesignPreviewItem,
  type DesignPreviewScreenId,
  type DesignPreviewTokens,
} from "@/components/design-preview/designPreviewData";

type NavigateToScreen = (screen: DesignPreviewScreenId) => void;

type AlternativePreviewProps = {
  theme: DesignPreviewTokens;
  screen: DesignPreviewScreenId;
  onNavigate: NavigateToScreen;
};

type PreviewVariant = "guided" | "journal" | "system";

function getVariant(theme: DesignPreviewTokens): PreviewVariant {
  if (theme.code === "G") return "journal";
  if (theme.code === "H") return "system";
  return "guided";
}

function PreviewIcon({
  theme,
  name,
  inverse = false,
}: {
  theme: DesignPreviewTokens;
  name: keyof typeof Feather.glyphMap;
  inverse?: boolean;
}) {
  return (
    <View
      style={[
        styles.iconBox,
        {
          borderRadius: theme.radius,
          backgroundColor: inverse ? "rgba(255,255,255,0.14)" : theme.surfaceAlt,
        },
      ]}
    >
      <Feather
        name={name}
        size={18}
        color={inverse ? theme.accentText : theme.accent}
      />
    </View>
  );
}

function ActionButton({
  theme,
  label,
  icon,
  secondary = false,
  onPress,
}: {
  theme: DesignPreviewTokens;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  secondary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[
        styles.actionButton,
        {
          borderRadius: theme.radius,
          borderColor: secondary ? theme.border : theme.accent,
          backgroundColor: secondary ? theme.surface : theme.accent,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.actionButtonText,
          { color: secondary ? theme.text : theme.accentText },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Feather
        name={icon}
        size={16}
        color={secondary ? theme.text : theme.accentText}
      />
    </Pressable>
  );
}

function AlternativeHeader({
  theme,
  variant,
  eyebrow,
  title,
  subtitle,
}: {
  theme: DesignPreviewTokens;
  variant: PreviewVariant;
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  if (variant === "journal") {
    return (
      <View style={styles.journalHeader}>
        <View style={styles.headerTop}>
          <Text style={[styles.journalLogo, { color: theme.text }]}>NAES</Text>
          <Text style={[styles.journalIssue, { color: theme.accent }]}>
            JOURNAL / 01
          </Text>
        </View>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>
        ) : null}
        <Text style={[styles.journalTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
    );
  }

  if (variant === "system") {
    return (
      <View style={styles.systemHeader}>
        <View style={styles.headerTop}>
          <Text style={[styles.systemLogo, { color: theme.text }]}>NAES</Text>
          <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
        </View>
        <Text style={[styles.systemTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.guidedHeader}>
      <View style={styles.headerTop}>
        <View style={styles.guidedBrandRow}>
          <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
            <Text style={styles.brandMarkText}>N</Text>
          </View>
          <Text style={[styles.guidedLogo, { color: theme.text }]}>NAES</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: theme.surfaceAlt }]}>
          <Feather name="user" size={16} color={theme.accent} />
        </View>
      </View>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>
      ) : null}
      <Text style={[styles.guidedTitle, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function AlternativeBottomNav({
  theme,
  variant,
  active,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  variant: PreviewVariant;
  active: "home" | "closet" | "outfit" | "profile" | "add";
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
        {
          backgroundColor:
            variant === "journal" ? "#F7F1E7" : theme.surface,
          borderTopColor: theme.border,
        },
      ]}
    >
      {items.map((item) => {
        const selected = item.id === active;
        const isAdd = item.id === "add";
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            style={styles.navItem}
            onPress={() => onNavigate(item.target)}
          >
            <View
              style={[
                styles.navIcon,
                isAdd && {
                  backgroundColor: theme.accent,
                  borderRadius: variant === "system" ? 8 : 999,
                },
                selected &&
                  !isAdd &&
                  variant === "guided" && {
                    backgroundColor: theme.surfaceAlt,
                    borderRadius: 999,
                  },
              ]}
            >
              <Feather
                name={item.icon}
                size={isAdd ? 20 : 17}
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

function AlternativeShell({
  theme,
  active,
  children,
  onNavigate,
  edge = false,
}: {
  theme: DesignPreviewTokens;
  active: "home" | "closet" | "outfit" | "profile" | "add";
  children: ReactNode;
  onNavigate: NavigateToScreen;
  edge?: boolean;
}) {
  const variant = getVariant(theme);
  return (
    <View style={[styles.shell, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={[styles.content, edge && styles.edgeContent]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <AlternativeBottomNav
        theme={theme}
        variant={variant}
        active={active}
        onNavigate={onNavigate}
      />
    </View>
  );
}

function ProductImage({
  item,
  theme,
  style,
}: {
  item: DesignPreviewItem;
  theme: DesignPreviewTokens;
  style?: object;
}) {
  return (
    <Image
      source={item.image}
      resizeMode="cover"
      style={[
        styles.productImage,
        { borderRadius: theme.imageRadius, backgroundColor: theme.surfaceAlt },
        style,
      ]}
    />
  );
}

function OutfitGrid({
  theme,
  compact = false,
}: {
  theme: DesignPreviewTokens;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.outfitGrid,
        {
          height: compact ? 150 : 250,
          borderRadius: theme.imageRadius,
          backgroundColor: theme.surfaceAlt,
        },
      ]}
    >
      {DESIGN_PREVIEW_OUTFIT_ITEMS.map((item, index) => (
        <ProductImage
          key={item.id}
          item={item}
          theme={theme}
          style={[
            styles.outfitItem,
            {
              width: "46%",
              height: "44%",
              left: index % 2 === 0 ? "3%" : "51%",
              top: index < 2 ? "4%" : "52%",
            },
          ]}
        />
      ))}
    </View>
  );
}

function ClosetTiles({
  theme,
  columns = 2,
  list = false,
}: {
  theme: DesignPreviewTokens;
  columns?: 2 | 3;
  list?: boolean;
}) {
  if (list) {
    return (
      <View style={[styles.systemList, { borderTopColor: theme.border }]}>
        {DESIGN_PREVIEW_ITEMS.slice(0, 5).map((item, index) => (
          <View
            key={item.id}
            style={[styles.systemListRow, { borderBottomColor: theme.border }]}
          >
            <Text style={[styles.indexText, { color: theme.muted }]}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <ProductImage
              item={item}
              theme={theme}
              style={styles.systemListImage}
            />
            <View style={styles.flexOne}>
              <Text
                style={[styles.listTitle, { color: theme.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[styles.caption, { color: theme.muted }]}>
                {item.meta}
              </Text>
            </View>
            <Feather name="chevron-right" size={17} color={theme.muted} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.tileGrid}>
      {DESIGN_PREVIEW_ITEMS.slice(0, 6).map((item) => (
        <View
          key={item.id}
          style={{ width: columns === 3 ? "31%" : "48%" }}
        >
          <ProductImage
            item={item}
            theme={theme}
            style={{ aspectRatio: columns === 3 ? 0.82 : 0.9 }}
          />
          <Text
            style={[styles.tileName, { color: theme.text }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[styles.caption, { color: theme.muted }]}
            numberOfLines={1}
          >
            {item.category}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SearchAndFilters({
  theme,
  compact = false,
}: {
  theme: DesignPreviewTokens;
  compact?: boolean;
}) {
  return (
    <>
      <View
        style={[
          styles.search,
          {
            minHeight: compact ? 42 : 48,
            borderRadius: theme.radius,
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <Feather name="search" size={16} color={theme.muted} />
        <Text style={[styles.searchText, { color: theme.muted }]}>
          이름, 색상, 종류로 찾기
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
            <View
              key={label}
              style={[
                styles.filter,
                {
                  backgroundColor: index === 0 ? theme.accent : theme.surface,
                  borderColor: index === 0 ? theme.accent : theme.border,
                  borderRadius: compact ? 6 : 999,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: index === 0 ? theme.accentText : theme.muted },
                ]}
              >
                {label}
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </>
  );
}

function GuidedHome({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  return (
    <AlternativeShell theme={theme} active="home" onNavigate={onNavigate}>
      <AlternativeHeader
        theme={theme}
        variant="guided"
        eyebrow="THURSDAY · SEOUL 24°"
        title={"오늘 무엇을\n도와드릴까요?"}
        subtitle="복잡한 메뉴 대신 하고 싶은 일부터 골라보세요."
      />
      <View style={styles.guidedActions}>
        <Pressable
          style={[styles.guidedPrimary, { backgroundColor: theme.accent }]}
          onPress={() => onNavigate("readiness")}
        >
          <PreviewIcon theme={theme} name="sun" inverse />
          <View style={styles.flexOne}>
            <Text style={styles.guidedActionKicker}>오늘 바로 입기</Text>
            <Text style={styles.guidedActionTitle}>내 옷으로 코디 찾기</Text>
            <Text style={styles.guidedActionText}>
              날씨와 옷장을 보고 가장 자연스러운 조합을 골라요.
            </Text>
          </View>
          <Feather name="arrow-right" size={20} color={theme.accentText} />
        </Pressable>
        <Pressable
          style={[
            styles.guidedSecondary,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => onNavigate("add")}
        >
          <PreviewIcon theme={theme} name="shopping-bag" />
          <View style={styles.flexOne}>
            <Text style={[styles.guidedSecondaryTitle, { color: theme.text }]}>
              새 옷이 나에게 맞을지 보기
            </Text>
            <Text style={[styles.caption, { color: theme.muted }]}>
              상품 링크 하나로 실측 기반 핏을 확인해요.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.muted} />
        </Pressable>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        추천까지 3단계
      </Text>
      <View style={styles.stepRow}>
        {[
          ["1", "옷 등록", true],
          ["2", "준비 확인", true],
          ["3", "코디 받기", false],
        ].map(([number, label, complete]) => (
          <View key={String(number)} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: complete ? theme.accent : theme.surfaceAlt,
                },
              ]}
            >
              {complete ? (
                <Feather name="check" size={14} color={theme.accentText} />
              ) : (
                <Text style={[styles.stepNumber, { color: theme.muted }]}>
                  {number}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, { color: theme.muted }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      <View
        style={[
          styles.guidedLookRow,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ProductImage
          item={DESIGN_PREVIEW_ITEMS[1]}
          theme={theme}
          style={styles.guidedLookImage}
        />
        <View style={styles.flexOne}>
          <Text style={[styles.eyebrow, { color: theme.success }]}>
            오늘의 미리보기
          </Text>
          <Text style={[styles.listTitle, { color: theme.text }]}>
            아이보리 니트와 차콜 슬랙스
          </Text>
          <Text style={[styles.caption, { color: theme.muted }]}>
            지금 날씨에 가볍고 단정해요.
          </Text>
        </View>
      </View>
    </AlternativeShell>
  );
}

function JournalHome({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  return (
    <AlternativeShell
      theme={theme}
      active="home"
      onNavigate={onNavigate}
      edge
    >
      <View style={styles.journalHero}>
        <Image
          source={require("@/assets/images/hero-fashion-wide.png")}
          resizeMode="cover"
          style={styles.heroImage}
        />
        <View style={styles.journalOverlay} />
        <View style={styles.journalHeroTop}>
          <Text style={styles.journalHeroLogo}>NAES</Text>
          <Text style={styles.journalHeroDate}>THU / 24°</Text>
        </View>
        <View style={styles.journalHeroCopy}>
          <Text style={styles.journalHeroKicker}>TODAY&apos;S NOTE</Text>
          <Text style={styles.journalHeroTitle}>오늘의 옷은{"\n"}어떤 기분인가요?</Text>
          <Text style={styles.journalHeroText}>
            사진을 넘기듯 고르고, 필요한 정보만 확인하세요.
          </Text>
        </View>
      </View>
      <View style={styles.journalBody}>
        <View style={styles.journalChoiceRow}>
          <Pressable
            style={[styles.journalChoice, { backgroundColor: theme.accent }]}
            onPress={() => onNavigate("ready")}
          >
            <Text style={styles.journalChoiceNumber}>01</Text>
            <Text style={styles.journalChoiceTitle}>오늘 입을 룩</Text>
            <Feather name="arrow-up-right" size={17} color={theme.accentText} />
          </Pressable>
          <Pressable
            style={[
              styles.journalChoice,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => onNavigate("add")}
          >
            <Text style={[styles.journalChoiceNumber, { color: theme.accent }]}>
              02
            </Text>
            <Text style={[styles.journalChoiceTitle, { color: theme.text }]}>
              새 옷의 핏
            </Text>
            <Feather name="arrow-up-right" size={17} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.journalRule} />
        <View style={styles.journalSectionHead}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.accent }]}>
              THE EDIT
            </Text>
            <Text style={[styles.journalSectionTitle, { color: theme.text }]}>
              차분한 목요일의 조합
            </Text>
          </View>
          <Text style={[styles.journalPage, { color: theme.muted }]}>01/04</Text>
        </View>
        <View style={styles.journalLook}>
          <OutfitGrid theme={theme} compact />
          <View style={styles.journalLookCopy}>
            <Text style={[styles.listTitle, { color: theme.text }]}>
              단정하지만 힘을 뺀 룩
            </Text>
            <Text style={[styles.caption, { color: theme.muted }]}>
              아이보리와 차콜이 편안한 대비를 만들어요.
            </Text>
          </View>
        </View>
      </View>
    </AlternativeShell>
  );
}

function SystemHome({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  return (
    <AlternativeShell theme={theme} active="home" onNavigate={onNavigate}>
      <AlternativeHeader
        theme={theme}
        variant="system"
        title="무엇을 할까요?"
        subtitle="자주 쓰는 두 가지 기능만 먼저 보여드려요."
      />
      <View style={[styles.commandList, { borderTopColor: theme.text }]}>
        {[
          {
            number: "01",
            title: "오늘 코디 찾기",
            text: "내 옷장과 오늘 날씨로 추천",
            icon: "sun" as const,
            target: "ready" as const,
          },
          {
            number: "02",
            title: "새 상품 핏 보기",
            text: "상품 링크와 내 실측으로 확인",
            icon: "shopping-bag" as const,
            target: "add" as const,
          },
        ].map((action) => (
          <Pressable
            key={action.number}
            style={[styles.commandRow, { borderBottomColor: theme.border }]}
            onPress={() => onNavigate(action.target)}
          >
            <Text style={[styles.commandNumber, { color: theme.accent }]}>
              {action.number}
            </Text>
            <View style={styles.flexOne}>
              <Text style={[styles.commandTitle, { color: theme.text }]}>
                {action.title}
              </Text>
              <Text style={[styles.caption, { color: theme.muted }]}>
                {action.text}
              </Text>
            </View>
            <Feather name="arrow-up-right" size={19} color={theme.text} />
          </Pressable>
        ))}
      </View>
      <View style={styles.systemStatusHead}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          옷장 준비 상태
        </Text>
        <Text style={[styles.caption, { color: theme.success }]}>준비됨</Text>
      </View>
      <View style={[styles.systemProgress, { backgroundColor: theme.surfaceAlt }]}>
        <View
          style={[
            styles.systemProgressFill,
            { width: "76%", backgroundColor: theme.accent },
          ]}
        />
      </View>
      <View style={styles.systemCounts}>
        {[
          ["상의", "4"],
          ["하의", "4"],
          ["신발", "2"],
          ["조합", "12"],
        ].map(([label, value]) => (
          <View key={label} style={styles.systemCount}>
            <Text style={[styles.systemCountValue, { color: theme.text }]}>
              {value}
            </Text>
            <Text style={[styles.caption, { color: theme.muted }]}>{label}</Text>
          </View>
        ))}
      </View>
      <View
        style={[
          styles.systemToday,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ProductImage
          item={DESIGN_PREVIEW_ITEMS[3]}
          theme={theme}
          style={styles.systemTodayImage}
        />
        <View style={styles.flexOne}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>
            TODAY / 01
          </Text>
          <Text style={[styles.listTitle, { color: theme.text }]}>
            선이 깔끔한 데일리 룩
          </Text>
          <Text style={[styles.caption, { color: theme.muted }]}>
            지금 바로 확인할 수 있어요.
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={theme.muted} />
      </View>
    </AlternativeShell>
  );
}

function AlternativeHome(props: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const variant = getVariant(props.theme);
  if (variant === "journal") return <JournalHome {...props} />;
  if (variant === "system") return <SystemHome {...props} />;
  return <GuidedHome {...props} />;
}

function AlternativeCloset({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const variant = getVariant(theme);
  return (
    <AlternativeShell theme={theme} active="closet" onNavigate={onNavigate}>
      <AlternativeHeader
        theme={theme}
        variant={variant}
        eyebrow={variant === "journal" ? "MY ARCHIVE" : undefined}
        title={
          variant === "guided"
            ? "내 옷을 한눈에"
            : variant === "journal"
              ? "Wardrobe Archive"
              : "옷장"
        }
        subtitle={
          variant === "guided"
            ? "찾고 싶은 옷을 검색하거나 종류를 골라보세요."
            : "총 18벌 · 최근 추가 순"
        }
      />
      <SearchAndFilters theme={theme} compact={variant === "system"} />
      {variant === "guided" ? (
        <View
          style={[
            styles.closetGuide,
            { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
          ]}
        >
          <Feather name="check-circle" size={18} color={theme.success} />
          <View style={styles.flexOne}>
            <Text style={[styles.listTitle, { color: theme.text }]}>
              추천에 필요한 기본 옷이 준비됐어요
            </Text>
            <Text style={[styles.caption, { color: theme.muted }]}>
              상의와 하의를 더 추가하면 추천이 다양해져요.
            </Text>
          </View>
        </View>
      ) : null}
      <ClosetTiles
        theme={theme}
        columns={variant === "journal" ? 2 : 3}
        list={variant === "system"}
      />
    </AlternativeShell>
  );
}

function GuidedReadiness({
  theme,
  ready,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  ready: boolean;
  onNavigate: NavigateToScreen;
}) {
  const data = ready ? DESIGN_PREVIEW_READY : DESIGN_PREVIEW_READINESS;
  return (
    <AlternativeShell theme={theme} active="outfit" onNavigate={onNavigate}>
      <AlternativeHeader
        theme={theme}
        variant="guided"
        eyebrow={ready ? "READY" : "STEP 2 OF 3"}
        title={ready ? "추천 준비가 끝났어요" : "조금만 더 채우면 돼요"}
        subtitle={
          ready
            ? "지금 옷장으로 서로 다른 코디를 만들 수 있어요."
            : "추천을 억지로 만들지 않고, 필요한 옷만 알려드릴게요."
        }
      />
      <View style={styles.verticalSteps}>
        {[
          ["상의", data.tops, 3],
          ["하의", data.bottoms, 3],
          ["신발", data.shoes, 2],
          ["서로 다른 조합", data.coreCombinations, 6],
        ].map(([label, current, required], index) => {
          const complete = Number(current) >= Number(required);
          return (
            <View key={String(label)} style={styles.verticalStep}>
              <View style={styles.verticalStepTrack}>
                <View
                  style={[
                    styles.verticalStepDot,
                    {
                      backgroundColor: complete ? theme.success : theme.surface,
                      borderColor: complete ? theme.success : theme.border,
                    },
                  ]}
                >
                  {complete ? (
                    <Feather name="check" size={13} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.stepNumber, { color: theme.muted }]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                {index < 3 ? (
                  <View
                    style={[
                      styles.verticalStepLine,
                      { backgroundColor: theme.border },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.verticalStepCopy}>
                <Text style={[styles.listTitle, { color: theme.text }]}>
                  {label}
                </Text>
                <Text style={[styles.caption, { color: theme.muted }]}>
                  {current}개 준비 · {required}개 {index < 2 ? "필요" : "권장"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <View
        style={[
          styles.nextAction,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <PreviewIcon theme={theme} name={ready ? "star" : "plus"} />
        <View style={styles.flexOne}>
          <Text style={[styles.listTitle, { color: theme.text }]}>
            {ready ? "이제 오늘의 코디를 볼 수 있어요" : "상의 2벌이 가장 먼저 필요해요"}
          </Text>
          <Text style={[styles.caption, { color: theme.muted }]}>
            {ready
              ? "날씨와 취향을 반영해 추천할게요."
              : "다른 색상의 기본 상의부터 추가해보세요."}
          </Text>
        </View>
      </View>
      <ActionButton
        theme={theme}
        label={ready ? "오늘의 코디 보기" : "필요한 옷 추가하기"}
        icon={ready ? "arrow-right" : "plus"}
        onPress={() => onNavigate(ready ? "result" : "add")}
      />
    </AlternativeShell>
  );
}

function JournalReadiness({
  theme,
  ready,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  ready: boolean;
  onNavigate: NavigateToScreen;
}) {
  const data = ready ? DESIGN_PREVIEW_READY : DESIGN_PREVIEW_READINESS;
  return (
    <AlternativeShell theme={theme} active="outfit" onNavigate={onNavigate} edge>
      <View style={styles.journalReadinessHero}>
        <Image
          source={require("@/assets/design-preview/catalog-sheet.png")}
          resizeMode="cover"
          style={styles.heroImage}
        />
        <View style={styles.journalReadinessOverlay} />
        <View style={styles.journalReadinessCopy}>
          <Text style={styles.journalHeroKicker}>
            {ready ? "WARDROBE / READY" : "WARDROBE / IN PROGRESS"}
          </Text>
          <Text style={styles.journalReadinessNumber}>
            {data.coreCombinations}
          </Text>
          <Text style={styles.journalReadinessLabel}>서로 다른 핵심 조합</Text>
        </View>
      </View>
      <View style={styles.journalBody}>
        <AlternativeHeader
          theme={theme}
          variant="journal"
          title={ready ? "오늘의 선택지가 충분해요" : "아직은 비슷한 룩이 반복돼요"}
          subtitle={
            ready
              ? "기분에 따라 고를 수 있는 조합을 준비했어요."
              : "상의와 하의를 조금 더 모은 뒤 자신 있게 추천할게요."
          }
        />
        <View style={[styles.journalStatTable, { borderTopColor: theme.text }]}>
          {[
            ["TOPS", data.tops, 3],
            ["BOTTOMS", data.bottoms, 3],
            ["SHOES", data.shoes, 2],
          ].map(([label, current, needed]) => (
            <View
              key={String(label)}
              style={[styles.journalStatRow, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.eyebrow, { color: theme.muted }]}>
                {label}
              </Text>
              <Text style={[styles.journalStatValue, { color: theme.text }]}>
                {current}
              </Text>
              <Text style={[styles.caption, { color: theme.muted }]}>
                / {needed}
              </Text>
            </View>
          ))}
        </View>
        <ActionButton
          theme={theme}
          label={ready ? "추천 룩 펼쳐보기" : "옷장 채우기"}
          icon="arrow-up-right"
          onPress={() => onNavigate(ready ? "result" : "add")}
        />
      </View>
    </AlternativeShell>
  );
}

function SystemReadiness({
  theme,
  ready,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  ready: boolean;
  onNavigate: NavigateToScreen;
}) {
  const data = ready ? DESIGN_PREVIEW_READY : DESIGN_PREVIEW_READINESS;
  return (
    <AlternativeShell theme={theme} active="outfit" onNavigate={onNavigate}>
      <AlternativeHeader
        theme={theme}
        variant="system"
        title={ready ? "추천 가능" : "추천 준비 확인"}
        subtitle="좋지 않은 조합을 억지로 보여주지 않기 위한 기준입니다."
      />
      <View style={[styles.checkTable, { borderTopColor: theme.text }]}>
        {[
          ["상의", data.tops, 3, true],
          ["하의", data.bottoms, 3, true],
          ["신발", data.shoes, 2, false],
          ["핵심 조합", data.coreCombinations, 6, true],
        ].map(([label, current, required, must]) => {
          const complete = Number(current) >= Number(required);
          return (
            <View
              key={String(label)}
              style={[styles.checkRow, { borderBottomColor: theme.border }]}
            >
              <Feather
                name={complete ? "check-circle" : "circle"}
                size={18}
                color={complete ? theme.success : theme.warning}
              />
              <Text style={[styles.checkLabel, { color: theme.text }]}>
                {label}
              </Text>
              <Text style={[styles.checkValue, { color: theme.text }]}>
                {current} / {required}
              </Text>
              <Text style={[styles.checkMeta, { color: theme.muted }]}>
                {must ? "필수" : "권장"}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.systemNotice, { backgroundColor: theme.surfaceAlt }]}>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>
          NEXT ACTION
        </Text>
        <Text style={[styles.systemNoticeTitle, { color: theme.text }]}>
          {ready ? "오늘의 코디를 확인하세요" : "상의 2벌을 먼저 추가하세요"}
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          {ready
            ? "현재 계절에 맞는 조합만 보여드릴게요."
            : "기본색과 포인트색 상의를 하나씩 추가하면 좋아요."}
        </Text>
      </View>
      <ActionButton
        theme={theme}
        label={ready ? "코디 보기" : "옷 추가"}
        icon={ready ? "arrow-right" : "plus"}
        onPress={() => onNavigate(ready ? "result" : "add")}
      />
    </AlternativeShell>
  );
}

function AlternativeReadiness({
  theme,
  ready,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  ready: boolean;
  onNavigate: NavigateToScreen;
}) {
  const variant = getVariant(theme);
  if (variant === "journal") {
    return (
      <JournalReadiness theme={theme} ready={ready} onNavigate={onNavigate} />
    );
  }
  if (variant === "system") {
    return (
      <SystemReadiness theme={theme} ready={ready} onNavigate={onNavigate} />
    );
  }
  return <GuidedReadiness theme={theme} ready={ready} onNavigate={onNavigate} />;
}

function ResultReasons({
  theme,
  variant,
}: {
  theme: DesignPreviewTokens;
  variant: PreviewVariant;
}) {
  return (
    <View
      style={[
        styles.reasonBlock,
        {
          backgroundColor:
            variant === "system" ? "transparent" : theme.surface,
          borderColor: theme.border,
          borderRadius: theme.cardRadius,
        },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        이 조합이 좋은 이유
      </Text>
      {[
        "반팔 니트와 와이드 슬랙스의 비율이 자연스러워요.",
        "아이보리와 차콜이라 여러 상황에 편하게 입을 수 있어요.",
      ].map((reason) => (
        <View key={reason} style={styles.reasonRow}>
          <Feather name="check" size={15} color={theme.success} />
          <Text style={[styles.reasonText, { color: theme.muted }]}>
            {reason}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AlternativeResult({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const variant = getVariant(theme);

  if (variant === "journal") {
    return (
      <AlternativeShell
        theme={theme}
        active="outfit"
        onNavigate={onNavigate}
        edge
      >
        <View style={styles.journalResultVisual}>
          <OutfitGrid theme={theme} />
          <View style={[styles.journalResultLabel, { backgroundColor: theme.accent }]}>
            <Text style={styles.journalResultLabelText}>LOOK 01</Text>
          </View>
        </View>
        <View style={styles.journalBody}>
          <AlternativeHeader
            theme={theme}
            variant="journal"
            eyebrow="THURSDAY EDIT"
            title="단정함과 편안함 사이"
            subtitle="오늘 기온과 내 옷장을 기준으로 고른 한 벌이에요."
          />
          <View style={styles.journalTags}>
            {["미니멀", "데일리", "가벼움"].map((tag) => (
              <Text key={tag} style={[styles.journalTag, { color: theme.muted }]}>
                #{tag}
              </Text>
            ))}
          </View>
          <ResultReasons theme={theme} variant={variant} />
          <ActionButton
            theme={theme}
            label="이 코디 저장하기"
            icon="bookmark"
            onPress={() => onNavigate("home")}
          />
        </View>
      </AlternativeShell>
    );
  }

  if (variant === "system") {
    return (
      <AlternativeShell theme={theme} active="outfit" onNavigate={onNavigate}>
        <AlternativeHeader
          theme={theme}
          variant="system"
          title="오늘의 코디"
          subtitle="날씨와 옷장 상태를 확인했습니다."
        />
        <OutfitGrid theme={theme} />
        <View style={styles.systemResultTitle}>
          <View style={styles.flexOne}>
            <Text style={[styles.eyebrow, { color: theme.accent }]}>
              RECOMMENDED
            </Text>
            <Text style={[styles.systemTitle, { color: theme.text }]}>
              아이보리와 차콜
            </Text>
          </View>
          <Feather name="bookmark" size={20} color={theme.text} />
        </View>
        <ResultReasons theme={theme} variant={variant} />
        <View style={styles.feedbackRow}>
          <ActionButton
            theme={theme}
            label="마음에 들어요"
            icon="thumbs-up"
            secondary
            onPress={() => onNavigate("home")}
          />
          <ActionButton
            theme={theme}
            label="다른 코디"
            icon="refresh-cw"
            onPress={() => onNavigate("result")}
          />
        </View>
      </AlternativeShell>
    );
  }

  return (
    <AlternativeShell theme={theme} active="outfit" onNavigate={onNavigate}>
      <AlternativeHeader
        theme={theme}
        variant="guided"
        eyebrow="오늘의 추천"
        title="이 조합부터 입어보세요"
        subtitle="점수 대신 실제로 도움이 되는 이유만 보여드릴게요."
      />
      <View
        style={[
          styles.guidedResultCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <OutfitGrid theme={theme} />
        <Text style={[styles.guidedResultTitle, { color: theme.text }]}>
          아이보리 니트 + 차콜 슬랙스
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          가볍고 단정한 오늘의 데일리 룩
        </Text>
      </View>
      <ResultReasons theme={theme} variant={variant} />
      <View style={[styles.tipLine, { backgroundColor: theme.surfaceAlt }]}>
        <Feather name="cloud" size={16} color={theme.accent} />
        <Text style={[styles.tipLineText, { color: theme.text }]}>
          저녁에는 트렌치코트를 함께 준비하세요.
        </Text>
      </View>
      <ActionButton
        theme={theme}
        label="이 코디 저장하기"
        icon="bookmark"
        onPress={() => onNavigate("home")}
      />
    </AlternativeShell>
  );
}

function AlternativeAdd({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const variant = getVariant(theme);
  const methods = [
    {
      number: "01",
      icon: "link" as const,
      title: "상품 링크로 추가",
      text: "상품 정보와 실측을 가져와 가장 정확하게 등록해요.",
      recommended: true,
    },
    {
      number: "02",
      icon: "image" as const,
      title: "사진으로 빠르게 추가",
      text: "이미 가지고 있는 옷을 사진으로 등록해요.",
      recommended: false,
    },
    {
      number: "03",
      icon: "edit-3" as const,
      title: "직접 입력",
      text: "링크나 사진 없이 필요한 정보만 적어요.",
      recommended: false,
    },
  ];

  return (
    <AlternativeShell theme={theme} active="add" onNavigate={onNavigate}>
      <AlternativeHeader
        theme={theme}
        variant={variant}
        eyebrow={variant === "journal" ? "ADD TO ARCHIVE" : undefined}
        title={
          variant === "guided"
            ? "어떻게 추가할까요?"
            : variant === "journal"
              ? "새 옷의 기록"
              : "옷 추가"
        }
        subtitle="상품 링크가 있으면 더 정확한 핏 안내를 받을 수 있어요."
      />
      <View
        style={[
          variant === "system" ? styles.methodSystemList : styles.methodCards,
          variant === "system" && { borderTopColor: theme.text },
        ]}
      >
        {methods.map((method) => (
          <Pressable
            key={method.number}
            style={[
              variant === "system" ? styles.methodSystemRow : styles.methodCard,
              variant === "system"
                ? { borderBottomColor: theme.border }
                : {
                    backgroundColor:
                      method.recommended && variant === "guided"
                        ? theme.accent
                        : theme.surface,
                    borderColor:
                      method.recommended && variant === "guided"
                        ? theme.accent
                        : theme.border,
                    borderRadius: theme.cardRadius,
                  },
            ]}
            onPress={() => onNavigate("detail")}
          >
            <Text
              style={[
                styles.methodNumber,
                {
                  color:
                    method.recommended && variant === "guided"
                      ? "#B9D3C8"
                      : theme.accent,
                },
              ]}
            >
              {method.number}
            </Text>
            <PreviewIcon
              theme={theme}
              name={method.icon}
              inverse={method.recommended && variant === "guided"}
            />
            <View style={styles.flexOne}>
              <View style={styles.methodTitleRow}>
                <Text
                  style={[
                    styles.methodTitle,
                    {
                      color:
                        method.recommended && variant === "guided"
                          ? theme.accentText
                          : theme.text,
                    },
                  ]}
                >
                  {method.title}
                </Text>
                {method.recommended ? (
                  <Text
                    style={[
                      styles.recommendedLabel,
                      {
                        color:
                          method.recommended && variant === "guided"
                            ? theme.accentText
                            : theme.accent,
                      },
                    ]}
                  >
                    추천
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.methodText,
                  {
                    color:
                      method.recommended && variant === "guided"
                        ? "#D8E8E1"
                        : theme.muted,
                  },
                ]}
              >
                {method.text}
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={
                method.recommended && variant === "guided"
                  ? theme.accentText
                  : theme.muted
              }
            />
          </Pressable>
        ))}
      </View>
      <View style={[styles.privacyNote, { backgroundColor: theme.surfaceAlt }]}>
        <Feather name="shield" size={16} color={theme.accent} />
        <Text style={[styles.caption, { color: theme.muted }]}>
          등록한 정보는 내 옷장과 추천을 위해서만 사용돼요.
        </Text>
      </View>
    </AlternativeShell>
  );
}

function AlternativeDetail({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const variant = getVariant(theme);
  return (
    <AlternativeShell theme={theme} active="closet" onNavigate={onNavigate}>
      <AlternativeHeader
        theme={theme}
        variant={variant}
        eyebrow={variant === "journal" ? "ITEM / 018" : undefined}
        title="아이보리 반팔 니트"
        subtitle="상품 링크 등록 · 공식 정보 확인 완료"
      />
      <ProductImage
        item={DESIGN_PREVIEW_ITEMS[1]}
        theme={theme}
        style={styles.detailImage}
      />
      <View
        style={[
          styles.detailSummary,
          {
            backgroundColor:
              variant === "system" ? "transparent" : theme.surface,
            borderColor: theme.border,
            borderRadius: theme.cardRadius,
          },
        ]}
      >
        {[
          ["종류", "반팔 니트"],
          ["색상", "아이보리"],
          ["계절", "봄 · 여름"],
          ["소재", "면 70% · 나일론 30%"],
        ].map(([label, value]) => (
          <View
            key={label}
            style={[styles.detailRow, { borderBottomColor: theme.border }]}
          >
            <Text style={[styles.caption, { color: theme.muted }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              {value}
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.fitSummary, { backgroundColor: theme.surfaceAlt }]}>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>
          내 사이즈 기준
        </Text>
        <Text style={[styles.fitTitle, { color: theme.text }]}>L 추천</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          어깨는 자연스럽고 가슴 품은 여유 있게 맞을 가능성이 높아요.
        </Text>
      </View>
      <ActionButton
        theme={theme}
        label="이 옷으로 코디 보기"
        icon="star"
        onPress={() => onNavigate("result")}
      />
    </AlternativeShell>
  );
}

function AlternativeProfile({
  theme,
  onNavigate,
}: {
  theme: DesignPreviewTokens;
  onNavigate: NavigateToScreen;
}) {
  const variant = getVariant(theme);
  return (
    <AlternativeShell theme={theme} active="profile" onNavigate={onNavigate}>
      <AlternativeHeader
        theme={theme}
        variant={variant}
        title={variant === "journal" ? "My Fitting Notes" : "내 정보"}
        subtitle="핏 추천에 필요한 정보만 간단히 관리해요."
      />
      <View
        style={[
          styles.profileHero,
          { backgroundColor: theme.accent, borderRadius: theme.cardRadius },
        ]}
      >
        <View style={styles.profileHeroTop}>
          <PreviewIcon theme={theme} name="user" inverse />
          <Text style={styles.profileComplete}>기본 정보 입력 완료</Text>
        </View>
        <Text style={styles.profileName}>도현님의 핏 기준</Text>
        <Text style={styles.profileHeroText}>
          키 178cm · 상의 L · 하의 32 · 편안한 핏 선호
        </Text>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>빠른 설정</Text>
      <View
        style={[
          styles.profileList,
          {
            borderTopColor: variant === "system" ? theme.text : theme.border,
          },
        ]}
      >
        {[
          ["신체 치수", "7개 입력", "activity"],
          ["기준 옷", "상의 · 하의 설정", "bookmark"],
          ["추천 조절", "기본", "sliders"],
          ["데이터 백업", "최근 백업 없음", "download-cloud"],
        ].map(([label, value, icon]) => (
          <Pressable
            key={label}
            style={[styles.profileRow, { borderBottomColor: theme.border }]}
          >
            <Feather
              name={icon as keyof typeof Feather.glyphMap}
              size={17}
              color={theme.accent}
            />
            <Text style={[styles.profileLabel, { color: theme.text }]}>
              {label}
            </Text>
            <Text
              style={[styles.profileValue, { color: theme.muted }]}
              numberOfLines={1}
            >
              {value}
            </Text>
            <Feather name="chevron-right" size={17} color={theme.muted} />
          </Pressable>
        ))}
      </View>
      <ActionButton
        theme={theme}
        label="프로필 수정"
        icon="edit-3"
        secondary
        onPress={() => onNavigate("profile")}
      />
    </AlternativeShell>
  );
}

export function AlternativePreviewApp({
  theme,
  screen,
  onNavigate,
}: AlternativePreviewProps) {
  switch (screen) {
    case "closet":
      return <AlternativeCloset theme={theme} onNavigate={onNavigate} />;
    case "readiness":
      return (
        <AlternativeReadiness
          theme={theme}
          ready={false}
          onNavigate={onNavigate}
        />
      );
    case "ready":
      return (
        <AlternativeReadiness theme={theme} ready onNavigate={onNavigate} />
      );
    case "result":
      return <AlternativeResult theme={theme} onNavigate={onNavigate} />;
    case "add":
      return <AlternativeAdd theme={theme} onNavigate={onNavigate} />;
    case "detail":
      return <AlternativeDetail theme={theme} onNavigate={onNavigate} />;
    case "profile":
      return <AlternativeProfile theme={theme} onNavigate={onNavigate} />;
    default:
      return <AlternativeHome theme={theme} onNavigate={onNavigate} />;
  }
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  shell: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 28,
    gap: 18,
  },
  edgeContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 0,
  },
  bottomNav: {
    height: 74,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: "row",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  navIcon: {
    width: 36,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  iconBox: {
    width: 42,
    height: 42,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  actionButtonText: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
  },
  headerTop: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  guidedHeader: {
    gap: 7,
  },
  guidedBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  guidedLogo: {
    fontSize: 14,
    fontWeight: "900",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
  },
  guidedTitle: {
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 19,
    fontWeight: "600",
  },
  journalHeader: {
    gap: 8,
  },
  journalLogo: {
    fontSize: 18,
    fontWeight: "900",
  },
  journalIssue: {
    fontSize: 9,
    fontWeight: "900",
  },
  journalTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
  },
  systemHeader: {
    gap: 7,
  },
  systemLogo: {
    fontSize: 14,
    fontWeight: "900",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  systemTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
  },
  productImage: {
    width: "100%",
    overflow: "hidden",
  },
  outfitGrid: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  outfitItem: {
    position: "absolute",
  },
  caption: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
  },
  listTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  guidedActions: {
    gap: 10,
  },
  guidedPrimary: {
    minHeight: 120,
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  guidedActionKicker: {
    color: "#B9D3C8",
    marginBottom: 4,
    fontSize: 10,
    fontWeight: "900",
  },
  guidedActionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  guidedActionText: {
    color: "#D8E8E1",
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  guidedSecondary: {
    minHeight: 88,
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  guidedSecondaryTitle: {
    marginBottom: 3,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: "900",
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  guidedLookRow: {
    minHeight: 88,
    padding: 10,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  guidedLookImage: {
    width: 68,
    height: 68,
  },
  journalHero: {
    height: 368,
    position: "relative",
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  journalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(25,18,15,0.38)",
  },
  journalHeroTop: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  journalHeroLogo: {
    color: "#FFF9F0",
    fontSize: 18,
    fontWeight: "900",
  },
  journalHeroDate: {
    color: "#FFF9F0",
    fontSize: 10,
    fontWeight: "800",
  },
  journalHeroCopy: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
  },
  journalHeroKicker: {
    color: "#F2C7A1",
    fontSize: 10,
    fontWeight: "900",
  },
  journalHeroTitle: {
    color: "#FFF9F0",
    marginTop: 7,
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
  },
  journalHeroText: {
    color: "#F4E9DE",
    maxWidth: 280,
    marginTop: 8,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  journalBody: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 18,
  },
  journalChoiceRow: {
    flexDirection: "row",
    gap: 9,
  },
  journalChoice: {
    minHeight: 92,
    padding: 13,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 8,
    flex: 1,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  journalChoiceNumber: {
    color: "#F2C7A1",
    fontSize: 9,
    fontWeight: "900",
  },
  journalChoiceTitle: {
    color: "#FFF9F0",
    fontSize: 14,
    fontWeight: "900",
  },
  journalRule: {
    height: 1,
    backgroundColor: "#2B2521",
  },
  journalSectionHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  journalSectionTitle: {
    marginTop: 4,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
  },
  journalPage: {
    fontSize: 10,
    fontWeight: "800",
  },
  journalLook: {
    gap: 10,
  },
  journalLookCopy: {
    gap: 3,
  },
  commandList: {
    borderTopWidth: 2,
  },
  commandRow: {
    minHeight: 92,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  commandNumber: {
    width: 29,
    fontSize: 10,
    fontWeight: "900",
  },
  commandTitle: {
    marginBottom: 4,
    fontSize: 18,
    fontWeight: "800",
  },
  systemStatusHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  systemProgress: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  systemProgressFill: {
    height: "100%",
  },
  systemCounts: {
    flexDirection: "row",
  },
  systemCount: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  systemCountValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  systemToday: {
    minHeight: 88,
    padding: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  systemTodayImage: {
    width: 70,
    height: 70,
  },
  search: {
    paddingHorizontal: 13,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
  },
  filterRow: {
    gap: 7,
    paddingRight: 18,
  },
  filter: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: {
    fontSize: 11,
    fontWeight: "800",
  },
  closetGuide: {
    minHeight: 72,
    padding: 13,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
  },
  tileName: {
    marginTop: 7,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },
  systemList: {
    borderTopWidth: 2,
  },
  systemListRow: {
    minHeight: 86,
    paddingVertical: 9,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  indexText: {
    width: 21,
    fontSize: 9,
    fontWeight: "800",
  },
  systemListImage: {
    width: 66,
    height: 66,
  },
  verticalSteps: {
    gap: 0,
  },
  verticalStep: {
    minHeight: 72,
    flexDirection: "row",
    gap: 13,
  },
  verticalStepTrack: {
    width: 34,
    alignItems: "center",
  },
  verticalStepDot: {
    width: 31,
    height: 31,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  verticalStepLine: {
    width: 1,
    flex: 1,
  },
  verticalStepCopy: {
    flex: 1,
    paddingTop: 4,
    minWidth: 0,
  },
  nextAction: {
    minHeight: 86,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  journalReadinessHero: {
    height: 302,
    position: "relative",
    overflow: "hidden",
  },
  journalReadinessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(22,16,14,0.54)",
  },
  journalReadinessCopy: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 22,
  },
  journalReadinessNumber: {
    color: "#FFF9F0",
    marginTop: 5,
    fontSize: 72,
    lineHeight: 76,
    fontWeight: "900",
  },
  journalReadinessLabel: {
    color: "#F0E5DB",
    fontSize: 12,
    fontWeight: "700",
  },
  journalStatTable: {
    borderTopWidth: 2,
  },
  journalStatRow: {
    minHeight: 54,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  journalStatValue: {
    marginLeft: "auto",
    fontSize: 24,
    fontWeight: "900",
  },
  checkTable: {
    borderTopWidth: 2,
  },
  checkRow: {
    minHeight: 58,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  checkValue: {
    fontSize: 13,
    fontWeight: "900",
  },
  checkMeta: {
    width: 30,
    textAlign: "right",
    fontSize: 9,
    fontWeight: "700",
  },
  systemNotice: {
    padding: 17,
    gap: 6,
  },
  systemNoticeTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  reasonBlock: {
    padding: 15,
    borderWidth: 1,
    gap: 11,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  reasonText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 18,
    fontWeight: "600",
  },
  guidedResultCard: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 18,
    gap: 8,
  },
  guidedResultTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  tipLine: {
    minHeight: 54,
    paddingHorizontal: 13,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  tipLineText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
  },
  journalResultVisual: {
    height: 318,
    padding: 12,
    position: "relative",
    backgroundColor: "#251D1B",
  },
  journalResultLabel: {
    position: "absolute",
    left: 22,
    top: 22,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  journalResultLabelText: {
    color: "#FFF9F0",
    fontSize: 9,
    fontWeight: "900",
  },
  journalTags: {
    flexDirection: "row",
    gap: 13,
  },
  journalTag: {
    fontSize: 11,
    fontWeight: "700",
  },
  systemResultTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feedbackRow: {
    flexDirection: "row",
    gap: 9,
  },
  methodCards: {
    gap: 10,
  },
  methodCard: {
    minHeight: 104,
    padding: 13,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  methodSystemList: {
    borderTopWidth: 2,
  },
  methodSystemRow: {
    minHeight: 106,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  methodNumber: {
    width: 22,
    fontSize: 9,
    fontWeight: "900",
  },
  methodTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  methodTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  recommendedLabel: {
    fontSize: 9,
    fontWeight: "900",
  },
  methodText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  privacyNote: {
    minHeight: 54,
    paddingHorizontal: 13,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  detailImage: {
    aspectRatio: 0.96,
  },
  detailSummary: {
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  detailRow: {
    minHeight: 51,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  detailValue: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
  },
  fitSummary: {
    padding: 17,
    gap: 5,
  },
  fitTitle: {
    fontSize: 30,
    fontWeight: "900",
  },
  profileHero: {
    minHeight: 146,
    padding: 17,
    justifyContent: "space-between",
  },
  profileHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileComplete: {
    color: "#D8E8E1",
    fontSize: 10,
    fontWeight: "800",
  },
  profileName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  profileHeroText: {
    color: "#D8E8E1",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  profileList: {
    borderTopWidth: 1,
  },
  profileRow: {
    minHeight: 60,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  profileValue: {
    maxWidth: "42%",
    fontSize: 11,
    fontWeight: "600",
  },
});
