import {
  MATERIAL_SEASON_RULES,
  OUTFIT_DETAIL_RULES,
  type OutfitItemMatcher,
  type OutfitRuleCondition,
} from "@/utils/outfitDetailMaterialRules";
import { getResolvedItemMaterial } from "@/utils/productClassification";
import type { ClosetItem } from "@/utils/storage";

export type DetailMaterialAdjustment = {
  score: number;
  reasons: string[];
  warnings: string[];
};

function getItemText(item: ClosetItem) {
  return [
    item.category,
    item.subCategory,
    item.detailCategory,
    getResolvedItemMaterial(item),
    item.fit,
    ...(item.styleTags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword.toLowerCase()));
}

function matchesItem(item: ClosetItem, matcher: OutfitItemMatcher) {
  const categoryMatches =
    !matcher.categories?.length || matcher.categories.includes(item.category);
  const keywordMatches =
    !matcher.keywords?.length || includesAny(getItemText(item), matcher.keywords);
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
    matcher.keywords?.length ? keywordMatches : undefined,
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
  return getResolvedItemMaterial(item).toLowerCase();
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
    const matchingItems = items.filter((item) =>
      includesAny(`${getItemText(item)} ${getMaterialText(item)}`, rule.materialKeywords)
    );
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
