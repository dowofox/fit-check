import { MIN_SEASONAL_MATERIAL_PERCENTAGE } from "@/utils/materialComposition";

export type OutfitItemMatcher = {
  categories?: string[];
  keywords?: string[];
  tokenKeywords?: string[];
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
  percentageSensitiveKeywords?: string[];
  minimumPercentage?: number;
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
const STREET_OUTDOOR_STYLES = ["고프코어", "스포티", "스트릿", "워크웨어"];
const CASUAL_STYLES = ["캐주얼", "데일리", "편안함", "스트릿"];

// detailCategory별 궁합은 이 테이블에 추가합니다. 엔진 코드는 수정하지 않습니다.
export const OUTFIT_DETAIL_RULES: OutfitDetailRule[] = [
  {
    id: "casual-t-shirt",
    target: {
      categories: ["상의"],
      keywords: ["티셔츠", "t shirt", "t-shirt", "tshirt", "tee"],
    },
    effects: [
      {
        id: "casual-t-shirt-denim",
        condition: {
          type: "companion",
          matcher: {
            categories: ["하의"],
            keywords: ["데님 팬츠", "청바지", "denim pants", "jeans"],
          },
        },
        score: 3,
        reason: "티셔츠와 데님 하의가 자연스러운 캐주얼 흐름을 만들어요.",
      },
    ],
  },
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
            keywords: ["티셔츠", "t shirt", "t-shirt", "tshirt"],
            tokenKeywords: ["셔츠", "shirt"],
          },
        },
        score: 3,
        reason: "니트 가디건을 티셔츠·셔츠 위에 레이어링해 자연스러운 깊이가 생겨요.",
      },
    ],
  },
  {
    id: "shirt-outerwear",
    target: {
      categories: ["아우터"],
      keywords: [
        "셔켓",
        "오버셔츠",
        "오버 셔츠",
        "shirt jacket",
        "shirt-jacket",
        "shacket",
        "overshirt",
      ],
    },
    effects: [
      {
        id: "shirt-outerwear-layering",
        condition: {
          type: "companion",
          matcher: {
            categories: ["상의"],
            keywords: [
              "티셔츠",
              "맨투맨",
              "얇은 니트",
              "t shirt",
              "t-shirt",
              "tee",
              "sweatshirt",
            ],
          },
        },
        score: 3,
        reason: "셔츠형 아우터를 티셔츠 위에 가볍게 레이어링해 자연스러운 깊이가 생겨요.",
      },
      {
        id: "shirt-outerwear-casual-bottom",
        condition: {
          type: "companion",
          matcher: {
            categories: ["하의"],
            keywords: ["치노", "데님 팬츠", "청바지", "카고", "스트레이트"],
            styleTags: CASUAL_STYLES,
          },
        },
        score: 2,
        reason: "셔츠형 아우터의 편안한 구조가 캐주얼 하의와 자연스럽게 이어져요.",
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
  {
    id: "windbreaker",
    target: {
      categories: ["아우터"],
      keywords: ["바람막이", "윈드브레이커", "windbreaker"],
    },
    effects: [
      {
        id: "windbreaker-outdoor-style",
        condition: { type: "styleCount", styleTags: STREET_OUTDOOR_STYLES, minimum: 2 },
        score: 3,
        reason: "바람막이의 기능적인 인상이 고프코어·스포티 분위기와 자연스럽게 이어져요.",
      },
      {
        id: "windbreaker-active-companion",
        condition: {
          type: "companion",
          matcher: {
            categories: ["하의", "신발"],
            keywords: ["조거", "카고", "파라슈트", "러닝화"],
          },
        },
        score: 3,
        reason: "바람막이에 조거·카고 팬츠나 러닝화를 더해 활동적인 균형이 좋아요.",
      },
    ],
  },
  {
    id: "leather-jacket",
    target: {
      categories: ["아우터"],
      keywords: ["레더 자켓", "가죽 자켓", "leather jacket"],
    },
    effects: [
      {
        id: "leather-casual-companion",
        condition: {
          type: "companion",
          matcher: {
            categories: ["하의", "신발"],
            keywords: ["데님", "청바지", "부츠", "워커"],
            colors: ["블랙", "검정"],
          },
        },
        score: 3,
        reason: "레더 자켓의 무게감을 데님·부츠·블랙 계열 아이템이 안정적으로 받쳐줘요.",
      },
      {
        id: "leather-formal-slacks",
        condition: {
          type: "companion",
          matcher: {
            categories: ["하의"],
            keywords: ["포멀 슬랙스", "정장 슬랙스", "수트 팬츠"],
          },
        },
        score: -2,
        warning: "레더 자켓과 정장 성격이 강한 슬랙스는 분위기가 갈릴 수 있어 보수적으로 평가했어요.",
      },
    ],
  },
  {
    id: "fleece",
    target: { categories: ["아우터"], keywords: ["플리스", "후리스", "fleece"] },
    effects: [
      {
        id: "fleece-cold-season",
        condition: { type: "season", seasons: ["가을", "겨울"] },
        score: 3,
        reason: "플리스의 따뜻한 소재감이 가을·겨울 코디에 잘 맞아요.",
      },
      {
        id: "fleece-summer",
        condition: { type: "season", seasons: ["여름"] },
        score: -6,
        warning: "플리스는 여름에 덥고 계절감이 무거워 추천 점수를 낮췄어요.",
      },
    ],
  },
  {
    id: "cargo-pants",
    target: { categories: ["하의"], keywords: ["카고 팬츠", "cargo pants"] },
    effects: [
      {
        id: "cargo-street-style",
        condition: { type: "styleCount", styleTags: STREET_OUTDOOR_STYLES, minimum: 2 },
        score: 3,
        reason: "카고 팬츠의 포켓 디테일이 고프코어·스트릿 방향과 잘 맞아요.",
      },
      {
        id: "cargo-sneakers",
        condition: {
          type: "companion",
          matcher: { categories: ["신발"], keywords: ["스니커즈", "러닝화", "운동화"] },
        },
        score: 2,
      },
    ],
  },
  {
    id: "jogger-pants",
    target: { categories: ["하의"], keywords: ["조거 팬츠", "jogger pants"] },
    effects: [
      {
        id: "jogger-sporty-companion",
        condition: {
          type: "companion",
          matcher: {
            categories: ["상의", "신발"],
            keywords: ["후드", "스웨트", "러닝화", "운동화"],
            styleTags: ["스포티", "편안함"],
          },
        },
        score: 3,
        reason: "조거 팬츠에 후드나 러닝화를 매치해 스포티한 흐름이 자연스러워요.",
      },
    ],
  },
  {
    id: "chino-pants",
    target: { categories: ["하의"], keywords: ["치노 팬츠", "chino pants"] },
    effects: [
      {
        id: "chino-clean-companion",
        condition: {
          type: "companion",
          matcher: {
            categories: ["상의", "신발"],
            keywords: ["니트", "로퍼"],
            tokenKeywords: ["셔츠", "shirt"],
            styleTags: MINIMAL_STYLES,
          },
        },
        score: 3,
        reason: "치노 팬츠의 단정한 캐주얼함이 셔츠·니트·로퍼와 잘 어울려요.",
      },
    ],
  },
  {
    id: "wide-slacks",
    target: { categories: ["하의"], keywords: ["와이드 슬랙스", "wide slacks"] },
    effects: [
      {
        id: "wide-slacks-clean-companion",
        condition: {
          type: "companion",
          matcher: {
            categories: ["상의", "신발"],
            keywords: ["니트", "로퍼", "더비"],
            tokenKeywords: ["셔츠", "shirt"],
            styleTags: MINIMAL_STYLES,
          },
        },
        score: 3,
        reason: "와이드 슬랙스의 여유 있는 실루엣을 니트·셔츠와 단정한 신발이 정리해줘요.",
      },
    ],
  },
  {
    id: "summer-open-shoes",
    target: { categories: ["신발"], keywords: ["샌들", "슬리퍼", "쪼리"] },
    effects: [
      {
        id: "open-shoes-summer",
        condition: { type: "season", seasons: ["여름"] },
        score: 3,
        reason: "샌들·슬리퍼의 가벼운 인상이 여름 코디에 잘 맞아요.",
      },
      {
        id: "open-shoes-winter",
        condition: { type: "season", seasons: ["겨울"] },
        score: -6,
        warning: "샌들·슬리퍼는 겨울 코디의 보온감과 계절감에 맞지 않아요.",
      },
    ],
  },
  {
    id: "formal-shoes",
    target: { categories: ["신발"], keywords: ["로퍼", "더비슈즈", "더비 슈즈"] },
    effects: [
      {
        id: "formal-shoes-clean-companion",
        condition: {
          type: "companion",
          matcher: {
            categories: ["상의", "하의"],
            keywords: ["슬랙스", "니트"],
            tokenKeywords: ["셔츠", "shirt"],
            styleTags: MINIMAL_STYLES,
          },
        },
        score: 3,
        reason: "로퍼·더비슈즈가 슬랙스와 미니멀한 아이템을 단정하게 마무리해줘요.",
      },
    ],
  },
  {
    id: "casual-bags",
    target: { categories: ["액세서리"], keywords: ["백팩", "메신저백", "메신저 백"] },
    effects: [
      {
        id: "casual-bags-style",
        condition: { type: "styleCount", styleTags: [...CASUAL_STYLES, "고프코어"], minimum: 2 },
        score: 2,
        reason: "백팩·메신저백이 캐주얼·스트릿 코디의 실용적인 분위기를 이어줘요.",
      },
    ],
  },
  {
    id: "tote-bag",
    target: { categories: ["액세서리"], keywords: ["토트백", "tote bag"] },
    effects: [
      {
        id: "tote-clean-style",
        condition: { type: "styleCount", styleTags: [...MINIMAL_STYLES, "데일리"], minimum: 2 },
        score: 2,
        reason: "토트백이 미니멀·포멀한 코디를 깔끔하게 마무리해줘요.",
      },
    ],
  },
  {
    id: "beanie",
    target: { categories: ["액세서리"], keywords: ["비니", "beanie"] },
    effects: [
      {
        id: "beanie-winter",
        condition: { type: "season", seasons: ["겨울"] },
        score: 2,
        reason: "비니가 겨울 코디의 보온감과 스트릿 포인트를 자연스럽게 더해줘요.",
      },
      {
        id: "beanie-summer",
        condition: { type: "season", seasons: ["여름"] },
        score: -2,
        warning: "비니는 여름 코디에서 덥고 무거워 보일 수 있어요.",
      },
    ],
  },
  {
    id: "ball-cap",
    target: { categories: ["액세서리"], keywords: ["볼캡", "baseball cap"] },
    effects: [
      {
        id: "ball-cap-casual-style",
        condition: { type: "styleCount", styleTags: ["캐주얼", "스포티", "스트릿"], minimum: 2 },
        score: 2,
        reason: "볼캡이 캐주얼·스포티한 코디에 가벼운 포인트를 더해줘요.",
      },
    ],
  },
];

// 소재 계절 규칙도 데이터로 관리합니다.
export const MATERIAL_SEASON_RULES: MaterialSeasonRule[] = [
  {
    id: "linen",
    materialKeywords: ["린넨", "linen"],
    percentageSensitiveKeywords: ["린넨", "linen"],
    minimumPercentage: MIN_SEASONAL_MATERIAL_PERCENTAGE,
    positiveSeasons: ["봄", "여름"],
    positiveScore: 1,
    negativeSeasons: ["겨울"],
    negativeScore: -3,
    negativeWarning: "린넨 소재가 포함되어 겨울에는 보온감이 부족할 수 있어요.",
  },
  {
    id: "knit-wool",
    materialKeywords: [
      "니트",
      "knit",
      "울",
      "wool",
      "모 100",
      "모100",
      "캐시미어",
      "cashmere",
      "알파카",
      "alpaca",
      "모헤어",
      "mohair",
      "앙고라",
      "angora",
    ],
    percentageSensitiveKeywords: [
      "울",
      "wool",
      "모",
      "캐시미어",
      "cashmere",
      "알파카",
      "alpaca",
      "모헤어",
      "mohair",
      "앙고라",
      "angora",
    ],
    minimumPercentage: MIN_SEASONAL_MATERIAL_PERCENTAGE,
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
  {
    id: "fleece",
    materialKeywords: ["플리스", "후리스", "fleece"],
    positiveSeasons: ["가을", "겨울"],
    positiveScore: 2,
    negativeSeasons: ["여름"],
    negativeScore: -4,
    negativeWarning: "플리스 소재는 여름에 덥고 계절감이 무거울 수 있어요.",
  },
];
