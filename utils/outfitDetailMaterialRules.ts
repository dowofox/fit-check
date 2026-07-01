export type OutfitItemMatcher = {
  categories?: string[];
  keywords?: string[];
  styleTags?: string[];
  colors?: string[];
};

export type OutfitRuleCondition =
  | { type: "companion"; matcher: OutfitItemMatcher }
  | { type: "season"; seasons: string[] }
  | { type: "styleCount"; styleTags: string[]; minimum: number }
  | { type: "always" };

export type OutfitRuleEffect = {
  id: string;
  condition: OutfitRuleCondition;
  score: number;
  reason?: string;
  warning?: string;
};

export type OutfitDetailRule = {
  id: string;
  target: OutfitItemMatcher;
  effects: OutfitRuleEffect[];
};

export type MaterialSeasonRule = {
  id: string;
  materialKeywords: string[];
  positiveSeasons?: string[];
  positiveScore?: number;
  positiveReason?: string;
  negativeSeasons?: string[];
  negativeScore?: number;
  negativeWarning?: string;
  styleTags?: string[];
  styleScore?: number;
};

const MINIMAL_STYLES = ["미니멀", "포멀", "댄디", "모던", "깔끔함", "클래식"];
const RUGGED_STYLES = ["캐주얼", "워크웨어", "아메카지", "스트릿"];

// detailCategory별 궁합은 이 테이블에 추가합니다. 엔진 코드는 수정하지 않습니다.
export const OUTFIT_DETAIL_RULES: OutfitDetailRule[] = [
  {
    id: "denim-shirt",
    target: { categories: ["상의"], keywords: ["데님 셔츠", "denim shirt"] },
    effects: [
      {
        id: "double-denim",
        condition: {
          type: "companion",
          matcher: {
            categories: ["하의", "아우터"],
            keywords: ["데님", "denim", "청바지", "jeans"],
          },
        },
        score: -7,
        warning: "데님 셔츠와 데님 하의·아우터가 겹쳐 청청 느낌이 강해 점수를 낮췄어요.",
      },
      {
        id: "denim-shirt-minimal-bottom",
        condition: {
          type: "companion",
          matcher: {
            categories: ["하의"],
            keywords: ["슬랙스", "치노", "화이트 팬츠", "아이보리 팬츠", "크림 팬츠"],
            styleTags: MINIMAL_STYLES,
          },
        },
        score: 4,
        reason: "데님 셔츠의 캐주얼한 질감을 슬랙스·치노 계열 하의가 깔끔하게 정리해줘요.",
      },
      {
        id: "denim-shirt-rugged-overload",
        condition: { type: "styleCount", styleTags: RUGGED_STYLES, minimum: 3 },
        score: -2,
        warning: "데님 셔츠에 캐주얼·워크웨어 요소가 많이 겹쳐 전체 인상이 무거울 수 있어요.",
      },
    ],
  },
  {
    id: "linen-shirt",
    target: { categories: ["상의"], keywords: ["린넨 셔츠", "linen shirt"] },
    effects: [
      {
        id: "linen-shirt-warm-season",
        condition: { type: "season", seasons: ["봄", "여름"] },
        score: 3,
        reason: "린넨 셔츠의 가벼운 소재감이 봄·여름 코디에 자연스럽게 맞아요.",
      },
      {
        id: "linen-shirt-winter",
        condition: { type: "season", seasons: ["겨울"] },
        score: -5,
        warning: "린넨 셔츠는 겨울 코디에서 소재감이 가볍고 계절감이 어색할 수 있어요.",
      },
      {
        id: "linen-shirt-light-bottom",
        condition: {
          type: "companion",
          matcher: {
            categories: ["하의"],
            colors: ["화이트", "아이보리", "베이지", "크림", "라이트그레이", "연청"],
          },
        },
        score: 2,
        reason: "린넨 셔츠와 밝은 하의가 만나 시원하고 정돈된 인상을 만들어요.",
      },
      {
        id: "linen-shirt-clean-shoes",
        condition: {
          type: "companion",
          matcher: {
            categories: ["신발"],
            keywords: ["샌들", "로퍼", "더비", "화이트 스니커즈"],
            styleTags: MINIMAL_STYLES,
          },
        },
        score: 1,
        reason: "린넨 셔츠에 샌들·로퍼처럼 깔끔한 신발이 가벼운 분위기를 이어줘요.",
      },
      {
        id: "linen-shirt-heavy-outer",
        condition: {
          type: "companion",
          matcher: {
            categories: ["아우터"],
            keywords: ["패딩", "코트", "플리스", "무스탕", "헤비", "두꺼운"],
          },
        },
        score: -4,
        warning: "가벼운 린넨 셔츠와 두꺼운 아우터의 소재감 차이가 커서 조합이 어색할 수 있어요.",
      },
    ],
  },
  {
    id: "short-sleeve-knit",
    target: {
      categories: ["상의"],
      keywords: ["반팔 니트", "반소매 니트", "short sleeve knit"],
    },
    effects: [
      {
        id: "short-knit-base",
        condition: { type: "always" },
        score: 2,
        reason: "반팔 니트라 일반 티셔츠보다 미니멀하고 단정한 느낌을 줘요.",
      },
      {
        id: "short-knit-bottom",
        condition: {
          type: "companion",
          matcher: {
            categories: ["하의"],
            keywords: ["슬랙스", "와이드", "세미와이드", "스트레이트"],
            styleTags: MINIMAL_STYLES,
          },
        },
        score: 3,
        reason: "반팔 니트의 단정한 질감이 슬랙스·와이드 팬츠와 잘 맞아요.",
      },
      {
        id: "short-knit-shoes",
        condition: {
          type: "companion",
          matcher: { categories: ["신발"], keywords: ["로퍼", "더비"] },
        },
        score: 1,
      },
    ],
  },
  {
    id: "knit-cardigan",
    target: { categories: ["아우터"], keywords: ["니트 가디건", "knit cardigan"] },
    effects: [
      {
        id: "knit-cardigan-base",
        condition: { type: "always" },
        score: 1,
      },
      {
        id: "knit-cardigan-layering",
        condition: {
          type: "companion",
          matcher: {
            categories: ["상의"],
            keywords: ["티셔츠", "셔츠", "t shirt", "tshirt", "shirt"],
          },
        },
        score: 3,
        reason: "니트 가디건을 티셔츠·셔츠 위에 레이어링해 자연스러운 깊이가 생겨요.",
      },
    ],
  },
  {
    id: "denim-pants",
    target: {
      categories: ["하의"],
      keywords: ["데님 팬츠", "청바지", "denim pants", "jeans"],
    },
    effects: [
      {
        id: "double-denim",
        condition: {
          type: "companion",
          matcher: {
            categories: ["상의", "아우터"],
            keywords: ["데님", "denim"],
          },
        },
        score: -7,
        warning: "데님 셔츠·자켓과 데님 팬츠가 겹쳐 청청 느낌이 강해 점수를 낮췄어요.",
      },
    ],
  },
];

// 소재 계절 규칙도 데이터로 관리합니다.
export const MATERIAL_SEASON_RULES: MaterialSeasonRule[] = [
  {
    id: "linen",
    materialKeywords: ["린넨", "linen"],
    positiveSeasons: ["봄", "여름"],
    positiveScore: 1,
    negativeSeasons: ["겨울"],
    negativeScore: -3,
    negativeWarning: "린넨 소재가 포함되어 겨울에는 보온감이 부족할 수 있어요.",
  },
  {
    id: "knit-wool",
    materialKeywords: ["니트", "knit", "울", "wool", "모 100", "모100"],
    positiveSeasons: ["가을", "겨울"],
    positiveScore: 2,
    positiveReason: "니트·울 소재의 온도감이 가을·겨울 코디에 잘 맞아요.",
    negativeSeasons: ["여름"],
    negativeScore: -4,
    negativeWarning: "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요.",
  },
  {
    id: "denim",
    materialKeywords: ["데님", "denim", "청바지", "jeans"],
    styleTags: RUGGED_STYLES,
    styleScore: 1,
  },
];
