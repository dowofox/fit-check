import { ClosetItem, UserProfile } from "@/utils/storage";

const OVERSIZED_GOOD_ITEMS = [
  "후드티",
  "맨투맨",
  "니트",
  "티셔츠",
  "반팔 티셔츠",
  "긴팔 티셔츠",
  "가디건",
  "점퍼",
  "코트",
  "와이드팬츠",
  "카고팬츠",
];

const OVERSIZED_CAUTION_ITEMS = [
  "셔츠",
  "블레이저",
  "슬랙스",
  "데님팬츠",
];

const OVERSIZED_BAD_ITEMS = [
  "정장 셔츠",
  "슬림 셔츠",
  "슬림핏 팬츠",
  "테일러드 자켓",
  "로퍼",
  "더비슈즈",
];

const LETTER_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const TOP_LETTER_SIZE_VALUE: Record<string, number> = {
  XS: 85,
  S: 90,
  M: 95,
  L: 100,
  XL: 105,
  XXL: 110,
  XXXL: 115,
};

function normalizeSize(size?: string) {
  const upperSize = String(size || "").trim().toUpperCase();

  if (upperSize === "2XL") return "XXL";
  if (upperSize === "3XL") return "XXXL";

  return upperSize;
}

function getProfileSize(item: ClosetItem, profile?: UserProfile | null) {
  if (!profile) return "";

  if (item.category === "하의") return profile.bottomSize || "";
  if (item.category === "신발") return profile.shoeSize || "";

  return profile.topSize || "";
}

function isTopSizeCategory(category?: string) {
  return category === "상의" || category === "아우터";
}

function getTopSizeValue(size?: string) {
  const normalizedSize = normalizeSize(size);
  const numericSize = Number(normalizedSize);

  if (Number.isFinite(numericSize)) return numericSize;

  return TOP_LETTER_SIZE_VALUE[normalizedSize] ?? null;
}

function compareSize(profileSize?: string, itemSize?: string, category?: string) {
  const normalizedProfileSize = normalizeSize(profileSize);
  const normalizedItemSize = normalizeSize(itemSize);

  if (isTopSizeCategory(category)) {
    const profileTopSize = getTopSizeValue(normalizedProfileSize);
    const itemTopSize = getTopSizeValue(normalizedItemSize);

    if (profileTopSize !== null && itemTopSize !== null) {
      return Math.sign(itemTopSize - profileTopSize);
    }
  }

  const profileNumber = Number(normalizedProfileSize);
  const itemNumber = Number(normalizedItemSize);

  if (Number.isFinite(profileNumber) && Number.isFinite(itemNumber)) {
    return Math.sign(itemNumber - profileNumber);
  }

  const profileIndex = LETTER_SIZE_ORDER.indexOf(normalizedProfileSize);
  const itemIndex = LETTER_SIZE_ORDER.indexOf(normalizedItemSize);

  if (profileIndex < 0 || itemIndex < 0) return null;

  return Math.sign(itemIndex - profileIndex);
}

function getItemName(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category || "이 옷";
}

function getOversizedSuitability(item: ClosetItem) {
  const itemName = getItemName(item);

  if (OVERSIZED_BAD_ITEMS.some((name) => itemName.includes(name))) return "bad";
  if (OVERSIZED_CAUTION_ITEMS.some((name) => itemName.includes(name))) return "caution";
  if (OVERSIZED_GOOD_ITEMS.some((name) => itemName.includes(name))) return "good";

  return "caution";
}

export function getFitSuitability(item: ClosetItem, profile?: UserProfile | null) {
  const intendedFit = item.intendedFit || "상관없음";
  const profileSize = getProfileSize(item, profile);
  const itemSize = item.size || "";
  const itemName = getItemName(item);
  const sizeDiff = compareSize(profileSize, itemSize, item.category);

  if (!profileSize || !itemSize || itemSize === "사이즈 미입력") {
    return {
      status: "사이즈 정보가 더 필요해요",
      description: "프로필 사이즈와 옷 사이즈를 모두 입력하면 착용 의도까지 반영해서 판단할 수 있어요.",
    };
  }

  if (sizeDiff === null) {
    return {
      status: "사이즈를 직접 확인해보세요",
      description: `프로필 사이즈는 ${profileSize}이고 이 옷은 ${itemSize}예요. 서로 다른 사이즈 표기라 정확한 비교가 어려워요.`,
    };
  }

  if (sizeDiff < 0) {
    return {
      status: "작을 수 있어요",
      description: `프로필 ${item.category} 사이즈는 ${profileSize}이고 이 옷은 ${itemSize}예요. 의도한 핏이 ${intendedFit}이라면 이 옷은 맞지 않을 수 있어요.`,
    };
  }

  if (sizeDiff === 0) {
    return {
      status: "기본 사이즈가 잘 맞아요",
      description: `프로필 ${item.category} 사이즈와 이 옷 사이즈가 모두 ${profileSize}예요. 의도한 착용감은 ${intendedFit}으로 저장되어 있어요.`,
    };
  }

  if (intendedFit === "오버핏") {
    const oversizedSuitability = getOversizedSuitability(item);

    if (oversizedSuitability === "good") {
      return {
        status: "오버핏으로 입기 좋아요",
        description: `프로필 ${item.category} 사이즈는 ${profileSize}이고 이 옷은 ${itemSize}예요. ${itemName}는 오버핏으로 입어도 자연스러운 아이템이에요.`,
      };
    }

    if (oversizedSuitability === "bad") {
      return {
        status: "크게 입으면 어색할 수 있어요",
        description: `프로필 ${item.category} 사이즈는 ${profileSize}이고 이 옷은 ${itemSize}예요. ${itemName}는 크게 입으면 핏이 무너질 수 있어요.`,
      };
    }

    return {
      status: "크게 입으면 어색할 수 있어요",
      description: `프로필 ${item.category} 사이즈는 ${profileSize}이고 이 옷은 ${itemSize}예요. ${itemName}는 종류에 따라 크게 입으면 핏이 무너질 수 있어요.`,
    };
  }

  return {
    status: "여유 있는 사이즈예요",
    description: `프로필 ${item.category} 사이즈는 ${profileSize}이고 이 옷은 ${itemSize}예요. 크게 입는 의도가 아니라면 실제 착용감을 한 번 더 확인해보세요.`,
  };
}
