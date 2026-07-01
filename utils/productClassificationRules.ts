export type ProductClassificationRule = {
  id: string;
  group: "상의" | "아우터" | "하의" | "신발" | "가방" | "모자" | "액세서리";
  label: string;
  keywords: string[];
  attributes: {
    category: string;
    subCategory: string;
    detailCategory: string;
    material?: string;
    styleTags?: string[];
  };
};

// 구체적인 상품명이 먼저 오도록 정렬합니다. 새 분류는 이 테이블에만 추가합니다.
export const PRODUCT_CLASSIFICATION_RULES: ProductClassificationRule[] = [
  {
    id: "knit-cardigan",
    group: "아우터",
    label: "니트 가디건",
    keywords: ["니트 가디건", "knit cardigan"],
    attributes: {
      category: "아우터",
      subCategory: "가디건",
      detailCategory: "니트 가디건",
      material: "니트",
      styleTags: ["미니멀", "깔끔함"],
    },
  },
  {
    id: "denim-jacket",
    group: "아우터",
    label: "데님 자켓",
    keywords: ["데님 자켓", "데님 재킷", "denim jacket"],
    attributes: {
      category: "아우터",
      subCategory: "자켓",
      detailCategory: "데님 자켓",
      material: "데님",
      styleTags: ["캐주얼", "데일리"],
    },
  },
  {
    id: "blazer",
    group: "아우터",
    label: "블레이저",
    keywords: ["블레이저", "blazer"],
    attributes: {
      category: "아우터",
      subCategory: "자켓",
      detailCategory: "블레이저",
      styleTags: ["미니멀", "포멀"],
    },
  },
  {
    id: "coat",
    group: "아우터",
    label: "코트",
    keywords: ["코트", "coat"],
    attributes: {
      category: "아우터",
      subCategory: "코트",
      detailCategory: "코트",
      styleTags: ["클래식", "깔끔함"],
    },
  },
  {
    id: "denim-shirt",
    group: "상의",
    label: "데님 셔츠",
    keywords: ["데님 셔츠", "denim shirt"],
    attributes: {
      category: "상의",
      subCategory: "셔츠",
      detailCategory: "데님 셔츠",
      material: "데님",
      styleTags: ["캐주얼", "데일리"],
    },
  },
  {
    id: "linen-shirt",
    group: "상의",
    label: "린넨 셔츠",
    keywords: ["린넨 셔츠", "linen shirt"],
    attributes: {
      category: "상의",
      subCategory: "셔츠",
      detailCategory: "린넨 셔츠",
      material: "린넨",
      styleTags: ["미니멀", "데일리"],
    },
  },
  {
    id: "flannel-shirt",
    group: "상의",
    label: "플란넬 셔츠",
    keywords: ["플란넬 셔츠", "flannel shirt"],
    attributes: {
      category: "상의",
      subCategory: "셔츠",
      detailCategory: "플란넬 셔츠",
      material: "플란넬",
      styleTags: ["캐주얼", "아메카지"],
    },
  },
  {
    id: "oxford-shirt",
    group: "상의",
    label: "옥스포드 셔츠",
    keywords: ["옥스포드 셔츠", "oxford shirt"],
    attributes: {
      category: "상의",
      subCategory: "셔츠",
      detailCategory: "옥스포드 셔츠",
      styleTags: ["미니멀", "깔끔함"],
    },
  },
  {
    id: "short-sleeve-knit",
    group: "상의",
    label: "반팔 니트",
    keywords: [
      "반팔 니트",
      "반소매 니트",
      "short sleeve knit",
      "short sleeved knit",
      "half sleeve knit",
    ],
    attributes: {
      category: "상의",
      subCategory: "니트",
      detailCategory: "반팔 니트",
      material: "니트",
      styleTags: ["미니멀", "깔끔함"],
    },
  },
  {
    id: "denim-pants",
    group: "하의",
    label: "데님 팬츠",
    keywords: ["데님 팬츠", "denim pants", "denim jeans", "청바지", "jeans"],
    attributes: {
      category: "하의",
      subCategory: "팬츠",
      detailCategory: "데님 팬츠",
      material: "데님",
      styleTags: ["캐주얼", "데일리"],
    },
  },
  {
    id: "linen-pants",
    group: "하의",
    label: "린넨 팬츠",
    keywords: ["린넨 팬츠", "linen pants", "linen trousers"],
    attributes: {
      category: "하의",
      subCategory: "팬츠",
      detailCategory: "린넨 팬츠",
      material: "린넨",
      styleTags: ["미니멀", "데일리"],
    },
  },
  {
    id: "slacks",
    group: "하의",
    label: "슬랙스",
    keywords: ["슬랙스", "slacks", "tailored trousers"],
    attributes: {
      category: "하의",
      subCategory: "팬츠",
      detailCategory: "슬랙스",
      styleTags: ["미니멀", "포멀"],
    },
  },
  {
    id: "sneakers",
    group: "신발",
    label: "스니커즈",
    keywords: ["스니커즈", "운동화", "sneakers", "sneaker"],
    attributes: {
      category: "신발",
      subCategory: "스니커즈",
      detailCategory: "스니커즈",
      styleTags: ["캐주얼", "데일리"],
    },
  },
  {
    id: "loafers",
    group: "신발",
    label: "로퍼",
    keywords: ["로퍼", "loafer", "loafers"],
    attributes: {
      category: "신발",
      subCategory: "구두",
      detailCategory: "로퍼",
      styleTags: ["미니멀", "포멀"],
    },
  },
  {
    id: "boots",
    group: "신발",
    label: "부츠",
    keywords: ["부츠", "워커", "boots", "boot"],
    attributes: {
      category: "신발",
      subCategory: "부츠",
      detailCategory: "부츠",
      styleTags: ["클래식", "캐주얼"],
    },
  },
  {
    id: "sandals",
    group: "신발",
    label: "샌들",
    keywords: ["샌들", "sandal", "sandals"],
    attributes: {
      category: "신발",
      subCategory: "샌들",
      detailCategory: "샌들",
      styleTags: ["캐주얼", "편안함"],
    },
  },
  {
    id: "crossbody-bag",
    group: "가방",
    label: "크로스백",
    keywords: ["크로스백", "crossbody bag", "cross bag"],
    attributes: {
      category: "액세서리",
      subCategory: "가방",
      detailCategory: "크로스백",
      styleTags: ["캐주얼", "데일리"],
    },
  },
  {
    id: "tote-bag",
    group: "가방",
    label: "토트백",
    keywords: ["토트백", "tote bag"],
    attributes: {
      category: "액세서리",
      subCategory: "가방",
      detailCategory: "토트백",
      styleTags: ["미니멀", "데일리"],
    },
  },
  {
    id: "backpack",
    group: "가방",
    label: "백팩",
    keywords: ["백팩", "backpack", "rucksack"],
    attributes: {
      category: "액세서리",
      subCategory: "가방",
      detailCategory: "백팩",
      styleTags: ["캐주얼", "스포티"],
    },
  },
  {
    id: "ball-cap",
    group: "모자",
    label: "볼캡",
    keywords: ["볼캡", "baseball cap", "ball cap"],
    attributes: {
      category: "액세서리",
      subCategory: "모자",
      detailCategory: "볼캡",
      styleTags: ["캐주얼", "스트릿"],
    },
  },
  {
    id: "beanie",
    group: "모자",
    label: "비니",
    keywords: ["비니", "beanie"],
    attributes: {
      category: "액세서리",
      subCategory: "모자",
      detailCategory: "비니",
      styleTags: ["캐주얼", "스트릿"],
    },
  },
  {
    id: "belt",
    group: "액세서리",
    label: "벨트",
    keywords: ["벨트", "belt"],
    attributes: {
      category: "액세서리",
      subCategory: "벨트",
      detailCategory: "벨트",
      styleTags: ["미니멀", "클래식"],
    },
  },
  {
    id: "scarf",
    group: "액세서리",
    label: "스카프",
    keywords: ["스카프", "머플러", "scarf", "muffler"],
    attributes: {
      category: "액세서리",
      subCategory: "스카프",
      detailCategory: "스카프",
      styleTags: ["클래식", "미니멀"],
    },
  },
];
