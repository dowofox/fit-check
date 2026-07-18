import {
  MATERIAL_SEASON_RULES,
  OUTFIT_DETAIL_RULES,
  type OutfitItemMatcher,
  type MaterialSeasonRule,
  type OutfitRuleCondition,
} from "@/utils/outfitDetailMaterialRules";
import {
  isRecommendationMaterialSection,
  parseMaterialSummaryItems,
} from "@/utils/materialComposition";
import { getRecommendationMaterialText } from "@/utils/productClassification";
import type { ClosetItem } from "@/utils/storage";

export type DetailMaterialAdjustment = {
  score: number;
  reasons: string[];
  warnings: string[];
};

const itemTextCache = new WeakMap<ClosetItem, string>();
const itemDescriptorTextCache = new WeakMap<ClosetItem, string>();
const materialTextCache = new WeakMap<ClosetItem, string>();

function getItemText(item: ClosetItem) {
  const cachedText = itemTextCache.get(item);
  if (cachedText !== undefined) return cachedText;

  const text = [
    item.category,
    item.subCategory,
    item.detailCategory,
    getRecommendationMaterialText(item),
    item.fit,
    ...(item.styleTags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  itemTextCache.set(item, text);
  return text;
}

function getItemDescriptorText(item: ClosetItem) {
  const cachedText = itemDescriptorTextCache.get(item);
  if (cachedText !== undefined) return cachedText;

  const text = [
    item.category,
    item.subCategory,
    item.detailCategory,
    item.fit,
    ...(item.styleTags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  itemDescriptorTextCache.set(item, text);
  return text;
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword.toLowerCase()));
}

function isTokenCharacter(value?: string) {
  return Boolean(value && /[0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ_-]/i.test(value));
}

function includesToken(value: string, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return false;

  let startIndex = value.indexOf(normalizedKeyword);
  while (startIndex >= 0) {
    const endIndex = startIndex + normalizedKeyword.length;
    if (
      !isTokenCharacter(value[startIndex - 1]) &&
      !isTokenCharacter(value[endIndex])
    ) {
      return true;
    }
    startIndex = value.indexOf(normalizedKeyword, startIndex + 1);
  }

  return false;
}

function includesAnyToken(value: string, keywords: string[]) {
  return keywords.some((keyword) => includesToken(value, keyword));
}

function matchesItem(item: ClosetItem, matcher: OutfitItemMatcher) {
  const categoryMatches =
    !matcher.categories?.length || matcher.categories.includes(item.category);
  const itemText = getItemText(item);
  const hasKeywordMatcher = Boolean(
    matcher.keywords?.length || matcher.tokenKeywords?.length
  );
  const keywordMatches =
    (matcher.keywords?.length && includesAny(itemText, matcher.keywords)) ||
    (matcher.tokenKeywords?.length &&
      includesAnyToken(itemText, matcher.tokenKeywords));
  const styleMatches =
    !matcher.styleTags?.length ||
    (item.styleTags || []).some((style) =>
      matcher.styleTags?.some((targetStyle) => style.includes(targetStyle))
    );
  const colorMatches =
    !matcher.colors?.length ||
    matcher.colors.some((color) => String(item.color || "").includes(color));

  // keywords/styleTags/colors 중 여러 조건이 있으면 하나 이상의 특징 조건이 맞으면 허용합니다.
  const featureGroups = [
    hasKeywordMatcher ? Boolean(keywordMatches) : undefined,
    matcher.styleTags?.length ? styleMatches : undefined,
    matcher.colors?.length ? colorMatches : undefined,
  ].filter((value): value is boolean => value !== undefined);

  return categoryMatches && (featureGroups.length === 0 || featureGroups.some(Boolean));
}

function conditionMatches(
  condition: OutfitRuleCondition,
  targetItem: ClosetItem,
  items: ClosetItem[],
  currentSeason: string
) {
  if (condition.type === "always") return true;
  if (condition.type === "season") return condition.seasons.includes(currentSeason);
  if (condition.type === "companion") {
    return items.some(
      (item) => item.id !== targetItem.id && matchesItem(item, condition.matcher)
    );
  }

  const styleCount = items.filter((item) =>
    (item.styleTags || []).some((style) =>
      condition.styleTags.some((targetStyle) => style.includes(targetStyle))
    )
  ).length;
  return styleCount >= condition.minimum;
}

function getMaterialText(item: ClosetItem) {
  const cachedText = materialTextCache.get(item);
  if (cachedText !== undefined) return cachedText;

  const text = getRecommendationMaterialText(item).toLowerCase();
  materialTextCache.set(item, text);
  return text;
}

function getMaterialPercentageEntries(
  item: ClosetItem,
  keywords: string[]
) {
  const usesUserMaterial = item.userEditedClassificationFields?.includes("material");
  const officialItems = usesUserMaterial
    ? []
    : (item.confirmedProduct?.materialComposition?.items || []).filter((material) =>
        isRecommendationMaterialSection(material.section)
      );
  if (officialItems.length > 0) {
    return {
      hasPercentageData: officialItems.some(
        (material) => typeof material.percentage === "number"
      ),
      percentages: officialItems
        .filter((material) =>
          keywords.some((keyword) =>
            includesToken(material.name.toLowerCase(), keyword.toLowerCase())
          )
        )
        .map((material) => material.percentage)
        .filter((percentage): percentage is number => typeof percentage === "number"),
    };
  }

  const parsedEntries = parseMaterialSummaryItems(getMaterialText(item));

  return {
    hasPercentageData: parsedEntries.some(
      (material) => typeof material.percentage === "number"
    ),
    percentages: parsedEntries
      .filter((material) =>
        keywords.some((keyword) =>
          includesToken(material.name.toLowerCase(), keyword.toLowerCase())
        )
      )
      .map((material) => material.percentage)
      .filter((percentage): percentage is number => typeof percentage === "number"),
  };
}

function matchesMaterialSeasonRule(item: ClosetItem, rule: MaterialSeasonRule) {
  const materialText = getMaterialText(item);
  const descriptorText = getItemDescriptorText(item);
  const percentageKeywords = rule.percentageSensitiveKeywords || [];
  const minimumPercentage = rule.minimumPercentage;

  if (!percentageKeywords.length || minimumPercentage == null) {
    return includesAny(`${descriptorText} ${materialText}`, rule.materialKeywords);
  }

  const constructionKeywords = rule.materialKeywords.filter(
    (keyword) => !percentageKeywords.includes(keyword)
  );
  if (includesAny(`${descriptorText} ${materialText}`, constructionKeywords)) {
    return true;
  }
  if (!includesAny(`${descriptorText} ${materialText}`, percentageKeywords)) {
    return false;
  }

  const percentageEvidence = getMaterialPercentageEntries(item, percentageKeywords);
  return (
    !percentageEvidence.hasPercentageData ||
    percentageEvidence.percentages.some(
      (percentage) => percentage >= minimumPercentage
    )
  );
}

function pushUnique(values: string[], value?: string) {
  if (value && !values.includes(value)) values.push(value);
}

export function getDetailMaterialAdjustment(
  items: ClosetItem[],
  currentSeason: string
): DetailMaterialAdjustment {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const appliedEffectIds = new Set<string>();
  let score = 0;

  OUTFIT_DETAIL_RULES.forEach((rule) => {
    const targetItems = items.filter((item) => matchesItem(item, rule.target));

    targetItems.forEach((targetItem) => {
      rule.effects.forEach((effect) => {
        if (
          appliedEffectIds.has(effect.id) ||
          !conditionMatches(effect.condition, targetItem, items, currentSeason)
        ) {
          return;
        }

        appliedEffectIds.add(effect.id);
        score += effect.score;
        pushUnique(reasons, effect.reason);
        pushUnique(warnings, effect.warning);
      });
    });
  });

  MATERIAL_SEASON_RULES.forEach((rule) => {
    const matchingItems = items.filter((item) => matchesMaterialSeasonRule(item, rule));
    if (matchingItems.length === 0) return;

    if (rule.positiveSeasons?.includes(currentSeason)) {
      score += rule.positiveScore || 0;
      pushUnique(reasons, rule.positiveReason);
    }
    if (rule.negativeSeasons?.includes(currentSeason)) {
      score += rule.negativeScore || 0;
      pushUnique(warnings, rule.negativeWarning);
    }
    if (
      rule.styleTags?.length &&
      matchingItems.some((item) =>
        (item.styleTags || []).some((style) =>
          rule.styleTags?.some((targetStyle) => style.includes(targetStyle))
        )
      )
    ) {
      score += rule.styleScore || 0;
    }
  });

  return {
    score: Math.max(-12, Math.min(8, score)),
    reasons: reasons.slice(0, 3),
    warnings: warnings.slice(0, 3),
  };
}
