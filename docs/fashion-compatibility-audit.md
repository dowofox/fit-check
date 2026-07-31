# Fashion Compatibility Audit

## 문서 상태

- 기준 커밋: `5a4be5325e983b334579a2b20b236cbc1d7541b5`
- 감사 범위: 코디 후보 생성부터 최종 노출까지의 색상, 실루엣, 핏, 소재, 스타일, 상황, 개인화 규칙
- 이번 단계의 원칙: 운영 점수, 정렬, hard block, 캐시, 저장 형식을 변경하지 않는다.
- 해석 주의: 아래 숫자는 현재 구현을 기록한 값이지 패션 전문가의 합의나 외부 연구로 검증된 기준이 아니다.
- Phase 2 구현: 기존 규칙은 `utils/fashionCompatibility/`로 이동했고 모든 metadata는 `ruleRegistry.ts`에서 조회할 수 있다. 점수와 사용자 문구는 Phase 1 특성화 및 parity test로 고정했다.

## 현재 실행 경로

1. `recommendationInput.ts`가 저장 데이터를 추천용 경량 `ClosetItem`으로 정규화한다.
2. `outfitRecommend.ts`가 보관 중인 옷, 계절, 날씨 hard block을 적용한다.
3. 상의 × 하의 × 선택 신발 × 선택 아우터 후보를 만든다.
4. `outfitTemperatureSuitability.ts`가 온도 적합도와 hard block을 계산한다.
5. `buildRecommendation()`이 `evaluateLegacyFashionCompatibility()`를 호출해 실루엣, 실착 균형, 포인트, 색상, 스타일, 세부 분류·소재 점수를 받는다.
6. `outfitDetailMaterial.ts`는 기존 가감점을 유지하면서 적용된 effect만 trace callback으로 알린다.
7. 사이즈와 날씨 경고를 감점하고 점수 상한을 적용한다.
8. 액세서리는 핵심 점수 계산 후 최대 한 개를 붙인다. 액세서리 자체는 총점을 바꾸지 않는다.
9. 사용자 피드백과 상황 점수는 품질 점수를 바꾸지 않고 정렬에만 사용한다.
10. 70점 미만, 저장 코디, 중복 core outfit을 제거하고 다양화한 뒤 최대 5개를 노출한다.

영향 경로는 홈 Today Pick과 `app/outfit-recommend.tsx`가 공유하는 추천 컨텍스트를 포함한다. 저장 코디 신발 제안은 같은 파일의 별도 신발 점수를 사용한다.

## 현재 총점 계산

| 항목 | 최대 | 구현 |
|---|---:|---|
| 실루엣 | 25 | `evaluateLegacySilhouette()` |
| 실착 균형 | 20 | `evaluateLegacyWearFit()` |
| 포인트 균형 | 10 | `evaluateLegacyPointBalance()` |
| 색상 보조 | 10 | `evaluateLegacyColorSupport()` |
| 스타일 보조 | 5 | `evaluateLegacyStyleSupport()` |
| 날씨·온도 | 25 | `assessOutfitTemperatureSuitability()` |
| 회전율 | 5 | `getRotationBreakdownScore()` |
| 명목 합계 | 100 | 위 breakdown 합 |
| 세부 분류·소재 | -12~+8 | breakdown 밖에서 추가 |
| 경고 감점 | 경고당 -3/-6 | breakdown 밖에서 차감 |

따라서 breakdown은 명목상 100점 체계지만, 원점수는 세부 분류·소재 보정으로 100을 넘거나 0 아래로 갈 수 있다. 이후 `applyScoreCaps()`와 0~100 clamp가 적용된다.

### 점수 상한

- 경고 1개 이상: 최대 88
- 경고 2개 이상: 최대 82
- 중요 경고 포함: 최대 78
- 추천 이유 3개 미만: 최대 78
- 실루엣 16 미만: 최대 75
- 실착 균형 13 미만: 최대 78
- 포인트 균형 6 미만: 최대 82
- 날씨 10 미만: 최대 69
- 날씨 15 미만: 최대 79
- 상·하의 실측 source 0개: 최대 82
- 상·하의 실측 source 1개: 최대 88
- 두 아이템 모두 실측이고 모든 우수 조건을 만족하지 않으면 최대 89

노출 최저점은 70점이며 `getGrade()`의 B등급 시작점과 같다.

## 규칙 감사 표기

```ts
type CurrentFashionRuleAudit = {
  id: string;
  file: string;
  functionName: string;
  lineRange: string;
  dimension:
    | "color"
    | "silhouette"
    | "proportion"
    | "fit"
    | "material"
    | "style"
    | "occasion"
    | "body"
    | "other";
  conditionSummary: string;
  scoreEffect: number | string;
  explanationShownToUser?: string;
  inputFields: string[];
  affectedScore: string;
  affectedRoutes: string[];
  evidenceLevel:
    | "explicit_external_source"
    | "documented_internal_policy"
    | "ai_generated_attribute"
    | "developer_heuristic"
    | "unknown";
  sourceReferences: string[];
  confidence: "high" | "medium" | "low" | "unknown";
  knownExceptions: string[];
  risks: string[];
};
```

아래 표의 각 행은 이 record의 축약 표현이다. `위치`는 `file:functionName`이며 현재 기준 line range는 색상 741~858, 레거시 fit 893~960, shape resolve 1092~1249, 운영 silhouette 1255~1337, wear-fit 1339~1395, point 1398~1449, cap 1541~1575, rotation 1613~1673, build 1675~1810, accessory 1960~2078이다. 별도 표기가 없으면:

- `affectedRoutes`: 홈 Today Pick, `app/outfit-recommend.tsx`
- `sourceReferences`: 빈 배열
- `confidence`: low
- `affectedScore`: 해당 표의 dimension breakdown 또는 breakdown 밖 `detailMaterialAdjustment`
- `knownExceptions`와 `risks`: 표의 마지막 열

- `explicit_external_source`: 현재 코드에 식별 가능한 외부 표준·논문이 연결된 규칙
- `documented_internal_policy`: 제품 정책으로 문서화됐지만 외부 검증은 하지 않은 규칙
- `ai_generated_attribute`: AI가 만든 속성을 입력으로 쓰는 규칙
- `developer_heuristic`: 숫자와 조건이 코드에 직접 들어간 규칙
- `unknown`: 출처와 설계 의도를 코드에서 확인할 수 없는 규칙

Phase 2부터 각 운영 규칙에는 안정적인 `legacy.*` ID, `legacy-v1` 버전, 활성 상태가 있다. 외부 출처를 직접 연결한 규칙은 없으므로 모든 registry record는 `temporary_heuristic`, 빈 `sourceReferences`, 보수적 confidence `0.35`로 등록한다. 이 confidence는 운영 점수에 사용하지 않으며 패션 정확도 확률을 뜻하지 않는다.

## Phase 2 모듈 및 추적 상태

| 영역 | 실제 모듈 | ID 접두사 | registry | evidence |
|---|---|---|---|---|
| 색상 | `fashionCompatibility/legacyColorRules.ts` | `legacy.color.*` | 등록 | 적용 분기별 생성 |
| 스타일 태그 | `fashionCompatibility/legacyStyleRules.ts` | `legacy.style.*` | 등록 | 적용 분기별 생성 |
| 실루엣·비율 | `fashionCompatibility/legacyShapeRules.ts` | `legacy.shape.*` | 등록 | 적용 분기와 source별 생성 |
| 실착 균형·체형 | `fashionCompatibility/legacyShapeRules.ts` | `legacy.fit.*` | 등록 | 적용 분기와 source별 생성 |
| 포인트 균형 | `fashionCompatibility/legacyShapeRules.ts` | `legacy.style.point-*` | 등록 | 선택 분기와 source별 생성 |
| 상세 품목·소재 | `fashionCompatibility/legacyMaterialRules.ts` | `legacy.material.*` | 등록 | 기존 effect callback으로 생성 |
| 상황 | `outfitSituation.ts` | `legacy.occasion.*` | 등록 | 기존 정렬 경계 유지, 아직 evaluator evidence 미연결 |
| 개인화·회전율 | `outfitRecommend.ts`, `outfitFeedback.ts` | `legacy.personal.*` | 등록 | 기존 정렬 경계 유지, 아직 evaluator evidence 미연결 |
| 환경 | `outfitTemperatureSuitability.ts` | `legacy.environment.*` | 등록 | 공통 모듈 유지, 패션 evaluator에서 복제하지 않음 |

`OutfitScoreEvidence`는 기존 점수 적용을 관찰하는 내부 기록이다. 점수를 결정하거나 사용자 UI, 추천 cache, 저장 schema에 들어가지 않는다. item ID 외 상품명·이미지 URI·신체 치수 원문은 담지 않으며 현재 원격 전송 경로도 없다.

## 색상 규칙

| ID | 위치 | 조건 | 현재 효과 | 입력 | 근거 | 알려진 예외·위험 |
|---|---|---|---:|---|---|---|
| `legacy.color.black-denim` | `fashionCompatibility/legacyColorRules.ts` | 블랙 상의 + 데님 하의 | raw 25 | 색상명, 하의 이름 | temporary heuristic | 블랙 면적, 데님 명도, 워싱 미반영 |
| `color.basic-different` | 동일 | 서로 다른 BASIC_COLORS | raw 23 | 색상명 | developer heuristic | 실제 색차·면적 미반영 |
| `color.same-non-monochrome` | 동일 | 같은 색, 블랙·화이트 제외 | raw 10 + 경고 | 색상명 | developer heuristic | 톤온톤과 셋업을 오판 가능 |
| `color.dark-dark` | 동일 | 상·하의 모두 DARK_COLORS | raw 13 + 경고 | 색상명 | developer heuristic | 명도 차이와 소재 광택 미반영 |
| `color.light-light` | 동일 | 상·하의 모두 LIGHT_COLORS | raw 20 | 색상명 | developer heuristic | 저대비가 항상 조화롭다는 근거 없음 |
| `color.basic-only` | 동일 | 포인트 색 0개 | raw 24 | 색상명 | developer heuristic | 무채색 내부 충돌과 면적 미반영 |
| `color.single-accent` | 동일 | 포인트 색 1개 | raw 20 | 색상명 | developer heuristic | 포인트 면적과 채도 미반영 |
| `color.four-or-more` | 동일 | 서로 다른 색 4개 이상 | raw 6 + 경고 | 색상명 개수 | developer heuristic | 작은 로고색도 동일 가중 |
| `color.multiple-accents` | 동일 | 포인트 색 2개 이상 | raw 10 + 경고 | 색상명 개수 | developer heuristic | 보색·유사색 구분 없음 |
| `legacy.color.match-colors` | `legacyColorRules.ts:getColorScore` | 다른 아이템 색이 `matchColors` 문자열과 부분 일치 | +2/건, 최대 +4 | AI styleProfile | temporary heuristic | matchColors 자체의 근거·confidence 미사용 |
| `color.avoid-profile` | 동일 | 다른 아이템 색이 `avoidColors`와 부분 일치 | -4/건, 최대 -8 | AI styleProfile | ai generated attribute | 사용자 수정과 AI 추정을 구분하지 않음 |
| `color.one-strong` | 동일 | STRONG_COLORS 1개 | +1 | 색상명 | developer heuristic | 채도·면적 미반영 |
| `color.multiple-strong` | 동일 | STRONG_COLORS 2개 이상 | -5 + 경고 | 색상명 | developer heuristic | 실제 조화 관계 미반영 |
| `legacy.color.*` support scale | `legacyColorRules.ts:evaluateLegacyColorSupport` | raw color 0~25 | `round(raw×0.4)`, 최대 10 | 위 규칙 | temporary heuristic | 반올림으로 작은 차이 소실 |

현재 색상은 이름 문자열만 사용한다. LAB, 명도, 채도, 색상 면적, 패턴 내부 색, 조명, 배경 분리는 없다. `colorValuesMatch()`는 양방향 부분 문자열 비교이므로 색상 taxonomy가 안정적이지 않으면 오탐 가능하다.

## 실루엣·비율·핏 규칙

### 실제 운영 경로

| ID | 위치 | 조건 | 현재 효과 | 근거 | 알려진 예외·위험 |
|---|---|---|---:|---|---|
| `legacy.shape.cropped-wide` | `legacyShapeRules.ts:evaluateLegacySilhouette` | 짧은 상의 + wide 하의 | raw 35 | temporary heuristic | tuck 여부, 밑위, 신체 비율 미반영 |
| `shape.semi-wide` | 동일 | semiOversized 상의 + wide 하의 | raw 34 | developer heuristic | 실제 ease가 아닌 라벨일 수 있음 |
| `shape.oversized-wide` | 동일 | oversized 상의 + wide 하의 | raw 31 | developer heuristic | 전신 볼륨 과다 예외와 중복 |
| `shape.regular-wide` | 동일 | slim/regular 상의 + wide 하의 | raw 32 | developer heuristic | 스타일 의도 미반영 |
| `shape.loose-slim` | 동일 | 여유 상의 + slim 하의 | raw 19 + 경고 | developer heuristic | 의도된 Y2K·스트리트 대비 예외 |
| `shape.long-long` | 동일 | 상·하의 lengthBalance 모두 long | raw 18 + 경고 | developer heuristic | 키, tuck, 아우터 layering 예외 |
| `shape.regular-regular` | 동일 | regular 상의 + regular/slim 하의 | raw 29 | developer heuristic | 무난함을 조화로 간주 |
| `shape.dual-volume` | 동일 | 상·하 volume ≥7, 상의가 short 아님 | -8 + 경고 | developer heuristic | volume 측정 기준의 절대 threshold 문제 |
| `shape.visual-weight-near` | 동일 | visualWeight 차 ≤2 | +2 | developer heuristic | 두 아이템 모두 과중한 경우 |
| `shape.visual-weight-far` | 동일 | visualWeight 차 ≥6 | -5 + 경고 | developer heuristic | 의도된 대비 예외 |
| `shape.impression-cropped` | 동일 | AI 상의 cropped + 하의 wide | +1 | ai generated attribute | 이미 resolved silhouette에 반영돼 중복 가능 |
| `shape.source-blend` | `blendScoreBySource` | measurement/impression/fallback | weight 1/0.5/0.25 | documented internal policy | numeric confidence는 미사용 |
| `legacy.fit.volume-balance` | `legacyShapeRules.ts:evaluateLegacyWearFit` | volume 차 ≤3 | +3 | temporary heuristic | 둘 다 과대인 경우와 분리 불완전 |
| `fit.volume-far` | 동일 | volume 차 ≥6 | -4 + 경고 | developer heuristic | 스타일 의도 예외 |
| `fit.short-long` | 동일 | 짧은 상의 + 긴 하의 | +3 | developer heuristic | 상·하의 실제 비율 미사용 |
| `fit.long-long` | 동일 | 긴 상의 + 긴 하의 | -4 | developer heuristic | silhouette 규칙과 중복 |
| `fit.stiff-stiff` | 동일 | structure 둘 다 stiff | -2 + 경고 | developer heuristic | 테일러드 셋업 예외 |
| `fit.high-drape` | 동일 | 어느 하나 drape high | +1 | developer heuristic | 두 소재 간 관계 미평가 |
| `body.upper-volume` | 동일 | 상체 발달/역삼각 + 상의 실측 + volume≥7 | -2 + 경고 | developer heuristic | 현재 프로필 UI 값과 불일치 가능 |
| `body.lower-volume` | 동일 | 하체 발달/삼각 + 하의 실측 + volume≥8 | -2 + 경고 | developer heuristic | 현재 프로필 UI 값과 불일치 가능 |
| `fit.measurement-weight` | 동일 | 실측 source 개수 0/1/2 | weight 0.25/0.625/1 | documented internal policy | 실측 행 존재만으로 source가 measurement가 될 수 있음 |

### shape profile 해석 규칙

| ID | 위치 | 조건 | 결과 | 위험 |
|---|---|---|---|---|
| `shape.measure-top-volume` | `getMeasuredVolume` | 가슴단면 ≤50 / 57 / 62cm | volume 2 / 6 / 8, 그 외 4 | 카테고리·성별·사이즈별 기준 없음 |
| `shape.measure-bottom-volume` | 동일 | 허벅지 ≥35 또는 밑단 ≥26 | volume 8 | 바지 종류와 사이즈별 기준 없음 |
| `shape.measure-bottom-slim` | 동일 | 허벅지 ≤28 및 밑단 ≤19 | volume 2 | 동일 |
| `shape.measure-top-length` | `getMeasuredLengthBalance` | 총장 ≤58 / ≥75cm | short / long | 키와 카테고리 세분화 없음 |
| `shape.measure-bottom-length` | 동일 | 총장 ≤90 / ≥105cm | short / long | 인심·밑위 미반영 |
| `legacy.shape.source-weight` | `legacyShapeRules.ts:getResolvedLegacyGarmentProfile` | silhouette 라벨과 source fallback | 2~8 기본값과 source weight | 라벨 taxonomy 의존 |
| `shape.default-weight` | 동일 | stiff/패딩/코트/울/두꺼운 | visualWeight 7 | 색 면적과 실제 중량 미반영 |
| `shape.default-point` | 동일 | 그래픽·패턴·강한 색 | point 6, 일반 2 | 포인트 크기·위치 제한적 |
| `shape.impression-blend` | 동일 | AI volume/point | base 75% + AI 25% | confidence 미사용 |

### 운영 점수에 쓰이지 않던 레거시 정리

Phase 1에서 확인한 `getCategoryScore()`, `getStyleScore()`, `getBaseFitScore()` / `getFitScore()`, `getVersatilityScore()`는 호출부가 없는 코드였다. Phase 2에서 운영 결과와 무관함을 기존 테스트로 확인한 뒤 삭제해, 실제 평가 규칙으로 오해하거나 향후 중복 적용할 위험을 줄였다.

## 포인트·스타일 규칙

| ID | 위치 | 조건 | 효과 | 근거·위험 |
|---|---|---|---:|---|
| `legacy.style.point-low` | `legacyShapeRules.ts:evaluateLegacyPointBalance` | 강한 포인트 0, 평균 이하 | raw 13 | temporary heuristic |
| `point.single` | 동일 | 강한 포인트 1 | raw 15 | developer heuristic |
| `point.double` | 동일 | 강한 포인트 2 | raw 8 + 경고 | developer heuristic |
| `point.multiple` | 동일 | 강한 포인트 3+ | raw 3 + 경고 | developer heuristic |
| `point.support-scale` | 동일 | source blend 후 0~15 | 0~10으로 축소 | source confidence 미사용 |
| `legacy.style.tag-conflict` | `legacyStyleRules.ts:getBaseStyleScore` | 지정 conflict pair 포함 | raw 5 + 경고 | temporary heuristic, 문화·시대·의도 예외 큼 |
| `style.same-three` | 동일 | 같은 tag 3회 이상 | raw 24 | AI tag 반복이 과대 가점 |
| `style.same-two` | 동일 | 같은 tag 2회 | raw 18 | 동일 |
| `style.same-group` | 동일 | 같은 style group | raw 14 | 그룹 taxonomy 출처 없음 |
| `style.weak-link` | 동일 | tag는 있으나 연결 약함 | raw 4 + 경고 | 미지 스타일을 부정적으로 처리 |
| `legacy.style.*` support scale | `legacyStyleRules.ts:evaluateLegacyStyleSupport` | raw 0~24 | `round(raw/5)`, 최대 5 | 스타일은 총점의 보조 5점 |

Style group과 conflict pair는 코드 상수다. 각 그룹의 버전, 적용 상황, 예외, 전문가 검토 기록이 없다.

## 세부 분류·소재 규칙

`OUTFIT_DETAIL_RULES`와 `MATERIAL_SEASON_RULES`는 기존 테이블을 유지한다. Phase 2 registry가 각 effect를 `legacy.material.*` ID와 `legacy-v1` metadata로 감싸고, optional trace callback이 적용 evidence를 만든다. 효과 ID 중복은 기존처럼 `Set`으로 한 번만 적용하고 최종 합은 -12~+8로 clamp한다.

| 규칙 | 효과 |
|---|---:|
| 티셔츠 + 데님 하의 | +3 |
| 데님 셔츠/팬츠의 청청 조합 | -7 |
| 데님 셔츠 + 미니멀 하의 | +4 |
| 데님 셔츠 + 거친 스타일 요소 3개 이상 | -2 |
| 린넨 셔츠, 봄·여름 | +3 |
| 린넨 셔츠, 겨울 | -5 |
| 린넨 셔츠 + 밝은 하의 | +2 |
| 린넨 셔츠 + 깔끔한 신발 | +1 |
| 린넨 셔츠 + 두꺼운 아우터 | -4 |
| 반팔 니트 기본 | +2 |
| 반팔 니트 + 슬랙스·와이드 하의 | +3 |
| 반팔 니트 + 로퍼·더비 | +1 |
| 니트 가디건 기본 | +1 |
| 니트 가디건 + 티셔츠·셔츠 layering | +3 |
| 셔켓·오버셔츠 + 가벼운 상의 | +3 |
| 셔켓·오버셔츠 + 캐주얼 하의 | +2 |
| 바람막이 + 고프코어·스포티 요소 | +3 |
| 바람막이 + 조거·카고·러닝화 | +3 |
| 레더 자켓 + 데님·부츠·블랙 | +3 |
| 레더 자켓 + 강한 정장 슬랙스 | -2 |
| 플리스, 가을·겨울 / 여름 | +3 / -6 |
| 카고 + 고프코어·스트릿 | +3 |
| 카고 + 스니커즈·러닝화 | +2 |
| 조거 + 후드·러닝화·스포티 | +3 |
| 치노 + 셔츠·니트·로퍼·미니멀 | +3 |
| 와이드 슬랙스 + 니트·셔츠·포멀 신발 | +3 |
| 샌들·슬리퍼, 여름 / 겨울 | +3 / -6 |
| 로퍼·더비 + 슬랙스·미니멀 | +3 |
| 백팩·메신저백 + 캐주얼·고프코어 | +2 |
| 토트백 + 미니멀·포멀·데일리 | +2 |
| 비니, 겨울 / 여름 | +2 / -2 |
| 볼캡 + 캐주얼·스포티·스트릿 | +2 |
| 린넨 비율 충분, 봄·여름 / 겨울 | +1 / -3 |
| 니트·울 비율 충분, 가을·겨울 / 여름 | +2 / -4 |
| 데님 + 거친 style tag | +1 |
| 플리스, 가을·겨울 / 여름 | +2 / -4 |

플리스와 린넨은 detail rule과 material rule이 동시에 적용될 수 있다. 이는 의도된 합산일 수 있으나 현재 근거와 최대 효과가 문서화되지 않아 중복 계산 위험으로 분류한다.

## 상황 규칙

`getOutfitSituationScore()`는 2점에서 시작해 키워드 존재 여부를 더하고 빼며 0~10으로 clamp한다. 6점 미만은 제외된다. 6점 초과분은 정렬에서 점당 +2로만 반영되며 품질 `score`와 `grade`는 바뀌지 않는다.

- 데이트: 미니멀·댄디·포멀 +3, 니트·셔츠 +2, 포멀 신발 +2, 슬랙스·치노 +1, 스포티 -3, 테크웨어·고프코어 -2
- 깔끔한: 미니멀·모던·클래식 +3, 셔츠·니트 +2, 슬랙스·치노 +2, 포멀 신발 +1, 그래픽·카모·네온 -3, 트레이닝 -2
- 데일리: 캐주얼·데일리 +3, 데님·티셔츠 +2, 스니커즈 +2, 베이직 +1, 이브닝·턱시도 -2, 강한 그래픽 -2
- 편안한: 편안함·캐주얼 +3, 와이드·조거·후드 +3, 운동화 +2, 포멀 -2, 로퍼·더비·하이힐 -2
- 데이트·깔끔한은 강한 포인트 2개 -1, 3개 이상 -3, 색 4개 이상 -2
- 데일리는 강한 포인트만 같은 방식으로 감점

`selectRecommendations()`와 `applyOutfitSituationRanking()`에 유사한 정렬 로직이 중복돼 향후 한쪽만 바뀔 위험이 있다.

## 소재·계절·환경

온도는 `outfitTemperatureSuitability.ts`의 별도 모듈이 hard block과 0~25 점수를 담당한다. 이번 감사에서 로직은 변경하지 않았다. 계절과 날씨는 후보 생성 전 filter와 조합 평가 양쪽에서 확인된다.

| ID | 위치 | 조건 | 효과 | 근거 상태 |
|---|---|---|---:|---|
| `temperature.apparent` | `getEffectiveOutfitTemperature`, 179~202 | 체감온도 존재 | 실제 기온보다 우선 | documented internal policy |
| `temperature.wind` | 동일 | 풍속 ≥20, 기온 ≤15 | 유효 온도 -2℃ | developer heuristic |
| `temperature.rain` | 동일 | 강수확률 ≥60, 기온 ≤15 | 유효 온도 -1℃ | developer heuristic |
| `temperature.range` | `getTemperatureRangePenalty`, 149~176 | AI 적정 범위 밖 3/6/9℃ | -1/-3/-5/-7 | ai generated attribute |
| `temperature.user-soften` | 동일 | 사용자 계절 수정 | range penalty 절반 수준 | documented internal policy |
| `temperature.warmth` | `getItemWarmthProfile`, 204~303 | category와 키워드 | warmth 0~10 | developer heuristic |
| `temperature.hot-padding` | 동일 | ≥28℃ 패딩 | hard conflict | documented internal policy |
| `temperature.hot-heavy` | 동일 | ≥30℃ 매우 따뜻한 옷 | hard conflict | documented internal policy |
| `temperature.target` | `getTargetWarmth`, 305~315 | 기온 구간 | 목표 보온도 4.5~20 | developer heuristic |
| `temperature.comfort` | `getComfortScore`, 317~324 | 목표와 실제 보온도 차 | 25/22/17/12/8/4 | developer heuristic |
| `temperature.hot-outfit` | `assessOutfitTemperatureSuitability`, 373~443 | ≥30℃, 총 보온도 ≥12 | hard block | documented internal policy |
| `temperature.cold-no-outer` | 동일 | ≤5℃, 아우터 없음, 상의 보온≤2.5 | hard block | documented internal policy |
| `temperature.freezing` | 동일 | ≤0℃, 총 보온도 <10 | hard block | documented internal policy |
| `temperature.cold-wet` | 동일 | ≤5℃, 비·눈, 아우터 없음 | hard block | documented internal policy |
| `temperature.wet-penalty` | 동일 | ≤15℃, 비·눈, 아우터 없음 | -4 | developer heuristic |

온도 정책은 버전 상수 `OUTFIT_TEMPERATURE_POLICY_VERSION=1`을 가진다는 점이 fashion 규칙보다 낫다. 다만 각 threshold의 외부 근거 reference는 코드에 연결돼 있지 않다. 이번 설계는 이 모듈을 공통 환경 평가로 유지하며 fashion compatibility 교체가 hard block을 우회하지 못하게 한다.

현재 소재·계절 신뢰 우선순위는 대체로 다음과 같다.

1. 사용자가 수정한 계절·소재
2. 공식 상품 혼용률과 상품 정보
3. 사진 AI 분석
4. 상품명·상세 분류 텍스트
5. 불확실 fallback

다만 이 우선순위가 공통 `ScoreResult` confidence로 표현되지는 않는다. 필드별 helper가 개별적으로 처리한다.

## 개인화·회전율·피드백

- `recommendationPreference=prefer`: 아이템당 rotation raw +5
- `less`: 아이템당 raw -10
- 3일 이내 저장 포함: -10, 7일 이내 -5, 30일 이상 미포함 +5
- wearCount ≤1: +5, ≥5: -5
- 평균 후 선호 가감, -20~20 clamp, breakdown 0~5로 변환
- 정확한 코디 `like`: 정렬 +6, `less`: -12
- 아이템 피드백은 2건 이상이고 like/less 차이가 2 이상일 때만 아이템당 +1 또는 -2, 전체 -6~+3

피드백은 품질 score가 아니라 정렬에만 영향을 준다. 이는 호환성 품질과 개인 취향을 분리한다는 점에서 유지할 가치가 있다.

## 필드 사용 현황

| 필드 | 생성·저장 | UI | 품질 점수 | 이유·검색·정렬만 | 현재 상태 |
|---|---|---|---|---|---|
| `matchColors` | AI | 상세 | 예 | 이유 | active |
| `avoidColors` | AI | 상세 | 예 | 경고 | active |
| `recommendedPairings` | AI | 상세 | 아니오 | 쇼핑 검색 | compatibility 미사용 |
| `avoidPairings` | AI | 상세 | 아니오 | 상세 표시 | compatibility 미사용 |
| `styleProfile.mood` | AI | 상세 | 상황 점수만 | 상황 검색 | base style 미사용 |
| `styleProfile.formality` | AI | 상세 | 상황 점수만 | 상황 검색 | active 보조 |
| `styleProfile.silhouette` | AI | 상세 | fallback shape | 상황 검색 | active |
| `garmentProfile` | AI | 상세 | 예, source weight 0.5 | 이유 | active 보조 |
| 상품 실측 | 공식/수동 | 상세 | 예, source weight 1과 score cap | size warning | active |
| 공식 소재 비율 | 공식 링크 | 상세 | 예 | 계절·이유 | active |
| `confidence.*` | AI | 검증 UI | 아니오 | 아니오 | scoring 미사용 |
| `analysisQuality` | AI | 검증 UI | 아니오 | 아니오 | scoring 미사용 |
| `bodyType` | 사용자 | 프로필 | 제한적 | fit 경고 | 일부 UI 값과 조건 불일치 |
| 신체 치수 | 사용자 | 프로필 | size warning을 통해 간접 | 사이즈 추천 | active 간접 |
| 기준 옷 | 사용자 | 프로필·상세 | sizeMatch 경유 간접 | 사이즈 추천 | active 간접 |
| `recommendationPreference` | 사용자 | 상세 | rotation | 정렬 | active |
| 코디 피드백 | 사용자 | 추천 UI | 아니오 | 정렬 | active |

## AI의 현재 역할

`server/index.js`는 `temperature: 0`과 JSON object 응답으로 다음 속성을 생성한다.

- category, detailCategory, color, styleTags, seasons
- styleProfile: mood, formality, match/avoid colors, pairings
- garmentProfile: silhouette, volume, visualWeight, pointLevel, structure, drape
- material, pattern, graphic

AI는 최종 0~100 코디 점수를 직접 만들지 않는다. 다만 AI 속성이 개발자 휴리스틱의 입력이므로 간접 영향은 크다. numeric `confidence`는 저장되지만 호환성 점수에는 사용하지 않는다.

## 중복·모순·위험

1. long-long과 volume 차이는 silhouette와 wearFit에서 동시에 반영된다.
2. 린넨·플리스는 detail과 material 규칙에서 동시에 가감될 수 있다.
3. AI garmentProfile source는 고정 0.5이며 필드별 AI confidence를 사용하지 않는다.
4. 실측 행이 있다는 사실과 실제로 필요한 실측 필드가 있다는 사실이 source 판정에서 완전히 분리되지 않는다.
5. color/style 이름 기반 그룹은 면적·명도·채도·조명·패턴을 표현하지 못한다.
6. style tag가 없는 아이템은 경량 입력에서 `데일리`로 보완돼 정보 부족이 중립이 아니라 특정 스타일 신호가 된다.
7. `bodyType` 감점 키워드가 현재 프로필 UI의 `마름/보통/근육형/통통`과 맞지 않아 사실상 비활성일 수 있다.
8. situation 정렬이 두 모듈에 중복돼 유지보수 시 결과 불일치 위험이 있다.
9. 경고 문구의 한국어 단어가 중요 감점 여부를 결정한다. 문구 수정이 점수를 바꿀 수 있다.

## 현재 데이터로 가능한 평가

- 색상명 기반 기본색·강한색·동일색 규칙
- AI가 추정한 silhouette, volume, visualWeight, pointLevel의 보수적 보조 사용
- 선택 사이즈의 실제 상품 실측을 이용한 제한적 shape source 강화
- 공식 소재 비율 기반 계절성
- 스타일 tag와 상황 키워드 기반 필터·정렬
- 사용자 신체 치수에 대한 상품 사이즈 warning
- 피드백과 저장 이력 기반 개인화 정렬

## 추가 데이터가 필요한 평가

- 실제 LAB 팔레트, 색 면적, 명도·채도 대비
- 배경·피부·모델·소품을 제외한 의류 segmentation
- 실제 상·하의 길이비, 허리선, 밑위, 밑단 위치
- tuck 여부와 layering visibility
- 소재 표면 질감, 광택, 투명도, 실제 drape
- 그래픽·패턴 면적과 위치
- 신발의 시각적 무게 중심과 팬츠 hem 관계
- 전문가가 합의한 상황·스타일별 호환성
- 사용자 선택, 교체, 실제 착용 결과

새 속성은 `ClosetItem` 최상위에 바로 늘리기보다 버전이 있는 color/shape profile 객체로 묶는 편이 안전하다.

## 외부 근거가 말해주는 범위

- [ISO 8559-1:2017](https://www.iso.org/standard/61686.html)은 의류 개발에 쓰는 인체 측정 정의를 제공한다. 현재 임의 chest·length threshold의 직접 근거는 아니다.
- [ISO 8559-2:2025](https://www.iso.org/standard/85590.html)은 의류 사이즈 표기를 신체 치수에 기반하도록 다룬다.
- [ISO 18890:2018](https://www.iso.org/standard/63693.html)은 의류 실측 지점과 측정 방법을 정의한다.
- [ISO/CIE 11664-4:2019](https://www.cie.co.at/publications/colorimetry-part-4-cie-1976-lab-colour-space-1)은 CIELAB 좌표와 색차 계산 기반을 제공한다.
- [ISO/CIE 11664-6:2022](https://www.cie.co.at/publications/colorimetry-part-6-ciede2000-colour-difference-formula-1)은 CIEDE2000 색차를 다룬다.
- [Outfit Compatibility Prediction and Diagnosis with Multi-Layered Comparison Network](https://arxiv.org/abs/1907.11496)은 색·texture 같은 저수준 요소와 style 같은 고수준 요소를 분리해 outfit compatibility와 진단을 함께 다룬다.
- [Learning Type-Aware Embeddings for Fashion Compatibility](https://arxiv.org/abs/1803.09196)은 item type별 similarity와 cross-type compatibility를 분리하고 unseen-item split을 사용한다.
- [Learning Color Compatibility in Fashion Outfits](https://arxiv.org/abs/2007.02388)은 색상만으로도 compatibility 신호가 있음을 보이지만, NAES의 특정 색 조합 숫자를 정당화하지는 않는다.

따라서 표준과 논문은 측정·표현·평가 구조의 근거로만 사용한다. “크롭+와이드=35” 같은 현재 숫자에는 외부 근거가 없다.

## 이번 감사의 코드 증거

`scripts/test-outfit-recommend.cjs`의 “감사 특성화” 하위 18개 테스트가 다음을 고정한다.

- cropped-wide 82점, silhouette 23
- semi-oversized-wide 82점, silhouette 22
- oversized-slim과 dual-high-volume은 70점 노출 기준 미달
- long-long 73점, silhouette 19
- 블랙+데님 colorSupport 10
- 서로 다른 기본색 9, dark-dark 5, 단일 포인트 8
- 강한 색 2개는 노출 기준 미달
- matchColors 10, avoidColors 8
- recommendedPairings와 avoidPairings는 현재 점수에 영향 없음
- 실측 source가 사진 impression보다 강하게 반영됨
- 사용자 수정 소재가 공식 소재보다 우선
- 체형 보정은 silhouette가 아니라 wearFit과 경고에 반영
- 추천 weather breakdown이 공통 온도 평가 결과와 동일

이 테스트는 현재 규칙을 “좋은 규칙”으로 승인하지 않는다. 향후 shadow scoring 전환 시 legacy 비교 기준으로만 사용한다.
