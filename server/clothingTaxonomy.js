const fs = require("fs");
const path = require("path");

const TAXONOMY_SOURCE_PATH = path.join(
  __dirname,
  "..",
  "utils",
  "productClassificationRules.ts",
);

let cachedDetailCategories;

function normalizeTaxonomyValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\-_/]+/g, "")
    .trim();
}

function getCanonicalDetailCategories() {
  if (cachedDetailCategories) return cachedDetailCategories;

  try {
    const source = fs.readFileSync(TAXONOMY_SOURCE_PATH, "utf8");
    cachedDetailCategories = [
      ...new Set(
        [...source.matchAll(/detailCategory:\s*"([^"]+)"/g)]
          .map((match) => match[1]?.trim())
          .filter(Boolean),
      ),
    ];
  } catch (error) {
    console.error("[clothing-taxonomy] failed to read canonical taxonomy", error);
    cachedDetailCategories = [];
  }

  return cachedDetailCategories;
}

function getPhotoClassificationTaxonomyInstruction() {
  const detailCategories = getCanonicalDetailCategories();
  if (detailCategories.length === 0) return "";

  return `
- detailCategory는 아래 표준 품목 중 사진에서 구조를 명확히 확인할 수 있는 가장 구체적인 값을 사용하세요.
- 확실하지 않으면 같은 category의 일반 subCategory를 사용하고 구체 품목을 추측하지 마세요.
- 핏, 소재, 패턴, 길이와 품목 종류를 혼동하지 마세요.
- 원피스·드레스·점프수트처럼 상하의가 일체형인 옷은 상의나 하의로 축소하지 말고 category를 "기타", subCategory와 detailCategory를 "분류 확인 필요"로 반환하세요.
표준 detailCategory: ${detailCategories.join(", ")}`;
}

function normalizePhotoDetailCategory(value) {
  const normalizedValue = normalizeTaxonomyValue(value);
  if (!normalizedValue) return value;

  return (
    getCanonicalDetailCategories().find(
      (detailCategory) =>
        normalizeTaxonomyValue(detailCategory) === normalizedValue,
    ) || value
  );
}

module.exports = {
  getCanonicalDetailCategories,
  getPhotoClassificationTaxonomyInstruction,
  normalizePhotoDetailCategory,
};
