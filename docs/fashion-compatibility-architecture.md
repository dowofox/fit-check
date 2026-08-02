# Fashion Compatibility Architecture

## Phase 5B.0: Local absolute evaluation pilot runner

Phase 5B.0은 Phase 5A의 익명 snapshot과 draft rubric을 실제 로컬 절대평가 세션으로 연결한다.

```text
validated expert dataset + separate local asset manifest
  -> deterministic localhost session
  -> one-outfit / 13-dimension absolute evaluation
  -> context and observation rating lock
  -> existing dataset validator
  -> atomic, resumable expert-dataset-v1 output
```

- 서버는 Node 표준 모듈만 사용하고 `127.0.0.1`에만 bind한다.
- 이미지 경로는 별도 manifest에서 검증하며 dataset, API payload, output에 로컬 경로를 넣지 않는다.
- Evaluation ID와 노출 순서는 dataset/evaluator/rubric/seed로 결정적이다.
- 저장할 때마다 전체 dataset validator를 실행하고 성공한 output만 원자적으로 교체한다.
- 저장 전 입력은 Case별 브라우저 메모리 초안으로만 보존한다. Case 이동 시 복원하고, 저장 성공 시 해당 초안만 제거하며, 초안이 있으면 페이지 종료 경고와 전체 완료 차단을 적용한다.
- 저장 요청은 단일 in-flight 트랜잭션으로 잠그고 Case 번호와 초안 revision을 고정한다. 응답은 같은 트랜잭션과 revision에만 반영하므로 다른 Case 상태나 새 입력을 지우지 않는다.
- 메모리 초안은 허용된 폼 값과 누적 편집 시간만 복사한다. dataset schema, output, 서버 API, asset manifest에는 초안이나 로컬 식별자를 기록하지 않는다.
- 기존 absolute/pairwise 레코드는 보존하지만 UI는 절대평가만 제공한다.
- Pairwise UI, professional score, 운영 추천·앱 UI·저장소 연결, 외부 전송은 구현하지 않는다.

운영 절차와 보안·재개 정책은 [Fashion Expert Pilot Runbook](./fashion-expert-pilot-runbook.md)을 따른다. Rollback은 pilot session 모듈, 로컬 CLI/UI, fixture manifest, test, 문서와 npm script만 제거하면 되며 운영 추천에는 영향이 없다.

## Phase 5A.2: Minimum observation input validation

Phase 5A.2는 offline expert contract를 `expert-rubric-draft-v0.3`으로 올리고, context와 별도로 dimension별 최소 observation input을 검증한다.

```text
sanitized snapshot + input availability
  -> v0.3 context requirements
  -> v0.3 observation requirement registry
  -> absolute / pairwise A+B / overall validation
  -> origin-aware evidence validation
  -> agreement and pilot diagnostics
```

- 모든 13개 dimension의 observation policy는 rubric registry에 선언된다.
- Image 없이도 color/shape derived features 또는 material context가 명시적으로 허용된 dimension만 rated가 가능하다.
- Pairwise dimension은 양쪽 snapshot을 독립적으로 검사하고 전체 선호에는 양쪽 image를 요구한다.
- Empty evidence는 observation 검증을 우회하지 못하며 별도 warning으로 집계한다.
- Dataset envelope는 `expert-dataset-v1`을 유지한다. `v0.2` 입력은 migration 없이 unsupported rubric error로 거부한다.
- Material weight difference는 방향성이 없는 human observation으로 기록한다.
- 이 모듈은 production recommendation, ranking, UI, storage, cache, backup과 연결되지 않는다. Professional score도 생성하지 않는다.

Rollback은 Phase 5A.2의 expert contract, fixture, test, 문서만 되돌리면 된다. 운영 추천 parity에는 변경이 없다.

## Phase 5A.1: Expert pilot readiness hardening

Phase 5A.1은 운영 추천과 계속 분리된 채 파일럿 입력 정합성을 강화한다.

```text
sanitized snapshot + input availability
  -> draft-v0.3 dimension-specific anchors
  -> required/recommended context validation
  -> origin-aware evidence validation
  -> canonical context fingerprint + rubric pair identity
  -> same-context-only agreement and diagnostics
```

- Shape feature export는 shape version만 기록한다. 개인 핏 payload가 없는 현재 schema에서는 `personalFitFeatureVersion`을 거부한다.
- Canonical serialization은 object key 삽입 순서와 A/B 순서에 무관한 pair evaluation key를 만든다.
- Evidence registry는 derived color/shape, human-observed material, context interpretation을 분리한다.
- Snapshot은 실제 값 대신 입력 이용 가능 여부만 기록하며 URI, 사용자 치수, 선호 원문을 export하지 않는다.
- Rubric과 material evidence는 모두 `draft`이며 professional score를 생성하지 않는다.
- Dataset envelope는 `expert-dataset-v1`을 유지한다. 현재 pilot context와 input availability 계약은 rubric `draft-v0.3`으로 구분하며 이전 rubric 데이터를 자동 해석하거나 migration하지 않는다.

Rollback은 Phase 5A.1 expert 모듈·fixture·문서 변경을 되돌리면 된다. 운영 추천, storage, cache, backup migration은 없다.

## Phase 5A: Expert rubric and offline evaluation foundation

Phase 5A는 기존 추천과 분리된 `utils/fashionCompatibility/expert/` 오프라인 경로를 추가한다.

```text
explicit offline request
  -> anonymized color/shape feature snapshot
  -> draft rubric absolute or pairwise labels
  -> local validation and privacy scan
  -> agreement and dataset report
```

- `types.ts`: draft rubric, context, snapshot, absolute/pairwise 평가와 dataset 계약
- `rubricRegistry.ts`: 13개 필수 dimension, 1~5 anchor, 허용 evidence code의 단일 registry
- `evaluationValidation.ts`: reference·중복·availability·privacy·split leakage 검증
- `agreementMetrics.ts`: median 집계, exact/adjacent agreement, rating difference, pairwise agreement
- `evaluationDataset.ts`: 원문 notes를 복사하지 않는 JSON/Markdown 품질 보고서
- `benchmarkCases.ts`: 명시적 opt-in에서 `color-features-v1`, `shape-features-v1`을 익명 snapshot으로 변환
- `expertShadowEvaluator.ts`: legacy-only 기본값과 score 없는 feature/label 비교 확장점

Rubric은 `expert-rubric-draft-v0.3`이며 모든 dimension이 `draft`, `reviewedBy: []`, `sourceReferences: []`다. confidence를 rating과 분리하고, `not_enough_information`을 중립 3점과 구분한다. 합성 fixture는 `synthetic_test`로만 표시한다.

이 경로는 `outfitRecommend.ts`, 홈, UI, cache, storage, backup에서 import하지 않는다. `professionalScore`와 `scoreDifference`를 계산하지 않으며 기존 점수·순위·문구를 변경하지 않는다. rollback은 expert 폴더, 세 CLI/test, fixture와 Phase 5A 문서만 제거하면 되고 data migration은 없다. 수집 계약은 [Fashion Expert Rubric](./fashion-expert-rubric.md), 운영 절차는 [Fashion Expert Evaluation Guide](./fashion-expert-evaluation-guide.md)를 따른다.

## Phase 4A: Professional shape foundation

Phase 4A는 `utils/fashionCompatibility/shape/` 아래에 운영 점수와 분리된 shape 분석 경로를 추가한다.

```text
ClosetItem (read only)
  -> shape-profile-v1
  -> shape-features-v1
  -> optional disabled-by-default shadow

UserProfile + reference clothing (read only)
  -> personal-fit-features-v1
```

- `measurementSemantics.ts`: 상품 단면, 신체 둘레, 선형 길이의 호환 가능 연산만 허용한다.
- `shapeProfiles.ts`: 선택 사이즈 실측, 사진 인상, style, text source를 구분한 immutable profile을 만든다.
- `shapeFeatures.ts`: 상하 volume·length, visual weight, structure·drape, 아우터 layering을 관찰한다.
- `personalFitFeatures.ts`: 사용자 ease와 기준 옷 차이를 objective outfit feature와 분리한다.
- `shapeShadowEvaluator.ts`: 명시적 opt-in에서만 feature를 계산하며 professional score는 만들지 않는다.

기본 shadow 경로는 item과 profile을 읽지 않는다. 운영 `outfitRecommend.ts`, 추천 cache, UI, `ClosetItem`/`UserProfile` schema와 backup 형식에는 연결하지 않았다. rollback은 Phase 4A 모듈, `test:fashion-shape`, 관련 문서만 제거하면 되며 data migration은 없다. 자세한 계약은 [Fashion Shape Foundation](./fashion-shape-foundation.md)을 따른다.

## 목표

현재 운영 추천을 유지하면서 호환성, 개인 적합성, 환경 적합성을 분리하고 각 판단의 근거·confidence·버전을 추적할 수 있는 구조로 이동한다.

설계 원칙:

1. 전문가 근거가 없는 규칙을 전문가 규칙처럼 이름 붙이지 않는다.
2. AI는 구조화된 속성과 설명 후보를 만들고, 최종 점수와 hard block은 검증된 규칙이 결정한다.
3. 사용자 수정은 보호한다.
4. 새 점수는 shadow mode에서 검증되기 전 운영 순서를 바꾸지 않는다.
5. 색상·shape profile은 기존 `ClosetItem`을 깨지 않는 버전 객체로 추가한다.
6. 호환성 품질과 개인 취향을 하나의 숫자에 숨기지 않는다.

## Phase 2 구현 구조

```text
outfitRecommend.ts
  ├─ 후보·계절 준비
  ├─ assessOutfitTemperatureSuitability()   # 기존 환경 모듈
  ├─ evaluateLegacyFashionCompatibility()   # legacy adapter
  │    ├─ legacyShapeRules.ts
  │    ├─ legacyColorRules.ts
  │    ├─ legacyStyleRules.ts
  │    └─ legacyMaterialRules.ts
  ├─ 회전율·피드백·상황 정렬
  └─ hard block·cap·다양화·결과 변환
```

- `types.ts`: metadata, evidence, legacy result, 비활성 shadow comparison 타입
- `ruleRegistry.ts`: 안정적인 `legacy.*` ID와 O(1) `Map` 조회
- `legacyEvaluator.ts`: 기존 호출 순서와 합산 순서를 보존하는 단일 adapter
- `legacyColorRules.ts`: 문자열 기반 색상 그룹, match/avoid color, 포인트 색
- `legacyShapeRules.ts`: 실측·사진 인상·텍스트 fallback, 실루엣, 실착 균형, 포인트
- `legacyMaterialRules.ts`: 기존 detail/material table 적용 결과의 evidence 변환
- `legacyStyleRules.ts`: style tag 그룹, 반복, 충돌

상황은 `outfitSituation.ts`, 개인화는 feedback·rotation 경로, 환경은 `outfitTemperatureSuitability.ts`에 남긴다. 이 계산을 compatibility 폴더에 복제하지 않는다.

### Legacy adapter와 evidence flow

1. 기존 분기가 동일한 점수·이유·경고를 계산한다.
2. 적용된 분기는 registry의 안정적인 ID로 최소 evidence를 추가한다.
3. evidence confidence는 registry 근거 상태이고, source diagnostics는 입력 데이터 신뢰도를 별도로 기록한다.
4. evaluator는 기존 breakdown과 detail/material adjustment를 그대로 반환한다.
5. `outfitRecommend.ts`가 기존 weather, rotation, warning penalty, cap을 같은 순서로 적용한다.

Evidence는 점수 입력이 아니며 recommendation 결과, UI, cache, 백업, `ClosetItem`에 저장하지 않는다. 상품명·이미지 URI·개인 치수 원문도 넣지 않는다.

### 입력 source

- `measurement`: 선택 사이즈의 공식 상품 실측
- `impression`: 사진 기반 `garmentProfile`
- `fallback`: fit, detailCategory, description 문자열 추정
- 소재는 `user_confirmed`, `official_product`, `image_analysis`, `legacy_default`를 구분

기존 source weight 계산은 그대로 유지한다. registry confidence `0.35`와 input source weight는 서로 다른 값이며 어느 쪽도 새 운영 점수를 만들지 않는다.

### Shadow 확장점

`CompatibilityComparison`과 `createLegacyOnlyComparison()`만 제공한다. 기본 mode는 `legacy-only`이며 전문 점수가 없을 때 0점이나 차이를 만들지 않는다. shadow 실행, 원격 전송, UI 노출, 순위 변경은 구현하지 않았다.

### 성능 정책

- registry 조회는 미리 만든 `Map`을 사용한다.
- evidence는 적용된 분기만 생성하고 전체 `ClosetItem`이나 이미지 데이터를 복사하지 않는다.
- detail/material은 기존 계산의 optional trace callback을 사용해 두 번째 평가를 하지 않는다.
- registry 배열 순서는 점수와 추천 순서에 관여하지 않는다.

### Rollback

Phase 2는 `outfitRecommend.ts`의 adapter 호출과 `utils/fashionCompatibility/` 모듈로 격리돼 있다. 문제가 생기면 Phase 2 커밋을 되돌려 기존 인라인 함수로 복구할 수 있고, 저장 schema·cache key·백업 형식 migration은 필요하지 않다. 15개 golden parity fixture와 Phase 1 characterization test가 rollback 전후 운영 결과를 확인한다.

## Phase 3A 구현 구조

```text
utils/fashionCompatibility/color/
  types.ts                 # profile/feature/shadow versioned contracts
  colorMath.ts             # sRGB D65 -> XYZ -> Lab -> LCh, Delta E
  namedColorCatalog.ts     # static alias Map and low-confidence representatives
  colorProfiles.ts         # read-only ClosetItem adapter
  colorFeatures.ts         # measurable outfit color relations
  colorShadowEvaluator.ts  # explicit opt-in development/test comparison
```

흐름은 `ClosetItem -> color-profile-v1 -> color-features-v1 -> optional shadow`다. 현재 저장 데이터에는 측정 RGB와 색 면적이 없으므로 사용자·공식·AI·legacy 색상명의 의미상 우선순위를 보존하되 모두 named-color fallback으로 표시한다. `utils/color.ts`의 legacy 정규화와 `legacyColorRules.ts`는 변경하지 않는다.

Shadow 기본값은 비활성이다. `outfitRecommend.ts`에서 새 모듈을 호출하지 않으므로 운영 점수·순위·cache key·UI·저장·Android bundle 실행 경로는 바뀌지 않는다. 명시적으로 `{ enabled: true }`를 전달한 테스트 또는 개발 함수만 profile과 pairwise feature를 계산한다. Phase 3A에는 professional score가 없으며 0점이나 score difference를 만들지 않는다.

Rollback은 `utils/fashionCompatibility/color/`, `test:fashion-color`, 이 문서 변경만 제거하면 끝난다. 저장 schema migration과 데이터 복구는 없다. 자세한 수학·source·privacy 제약은 [Fashion Color Foundation](./fashion-color-foundation.md)을 따른다.

## 목표 평가 구조

```ts
type ScoreResult = {
  score: number;
  maxScore: number;
  confidence: number;
  positiveEvidence: OutfitScoreEvidence[];
  negativeEvidence: OutfitScoreEvidence[];
  sourceTypes: string[];
  usedFallback: boolean;
};

type OutfitEvaluation = {
  compatibility: {
    color: ScoreResult;
    silhouette: ScoreResult;
    proportion: ScoreResult;
    material: ScoreResult;
    style: ScoreResult;
    occasion: ScoreResult;
  };
  personalSuitability: {
    body: ScoreResult;
    fitPreference: ScoreResult;
    stylePreference: ScoreResult;
    learnedPreference: ScoreResult;
  };
  environmentSuitability: {
    temperature: ScoreResult;
    rain: ScoreResult;
    wind: ScoreResult;
    season: ScoreResult;
  };
  overall: number;
  confidence: number;
  evidence: OutfitScoreEvidence[];
};
```

`overall`은 처음부터 새 공식으로 정하지 않는다. 전문가 검증과 shadow 결과를 확보한 뒤 결정한다.

## 판단 근거

```ts
type OutfitScoreEvidence = {
  id: string;
  dimension: string;
  direction: "positive" | "negative" | "neutral";
  magnitude: number;
  confidence: number;
  ruleId?: string;
  itemIds: string[];
  sourceType: string;
  messageKey: string;
  diagnostics?: Record<string, string | number | boolean>;
};
```

- 사용자 UI 문구는 `messageKey`로 생성한다.
- 진단 데이터와 사용자 설명을 분리한다.
- 경고 문구 변경이 감점 강도를 바꾸지 않게 한다.
- 이미지 URI, 상품명, 개인 치수 원문은 shadow 로그에 남기지 않는다.

## 전문가 지식 베이스

```ts
type FashionKnowledgeRule = {
  id: string;
  dimension:
    | "color"
    | "silhouette"
    | "proportion"
    | "fit"
    | "material"
    | "style"
    | "occasion";
  conditions: FashionRuleCondition[];
  exceptions: FashionRuleCondition[];
  effect: {
    scoreAdjustment: number;
    confidence: number;
    hardBlock?: boolean;
    scoreCap?: number;
  };
  applicableStyles: string[];
  applicableSituations: string[];
  rationale: string;
  sourceType:
    | "color_science"
    | "fashion_research"
    | "stylist_consensus"
    | "expert_dataset"
    | "user_learning"
    | "temporary_heuristic";
  sourceReferences: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  version: string;
  enabled: boolean;
};
```

필수 운영 규칙:

- 근거가 없는 현재 규칙은 `temporary_heuristic`이다.
- `sourceReferences`가 비어 있으면 UI나 코드에서 “전문가 검증”으로 표현하지 않는다.
- 모든 규칙은 안정적인 ID, 적용 style·situation, 예외, 버전을 가진다.
- hard block은 안전·환경 기준처럼 명시적인 정책에만 허용한다.
- 지식 베이스는 설명 문자열이 아니라 구조화된 evidence를 반환한다.
- 규칙 추가는 코드 조건문 추가가 아니라 review 가능한 rule record 추가로 한다.

## 색상 엔진

### 목표 profile

```ts
type GarmentColorProfile = {
  dominantColors: Array<{
    colorSpace: "LAB";
    l: number;
    a: number;
    b: number;
    proportion: number;
    confidence: number;
  }>;
  averageLightness: number;
  averageChroma: number;
  temperature: "warm" | "cool" | "neutral";
  contrastLevel: number;
  patternComplexity: number;
  colorCount: number;
  extractionSource:
    | "image"
    | "official_product"
    | "user"
    | "legacy_name";
  confidence: number;
  version: string;
};
```

### 계산 후보

- 의류 segmentation 후 면적 비율이 큰 1~5색 추출
- sRGB를 정규화한 뒤 CIELAB로 변환
- 색차는 CIEDE2000을 후보로 사용하되 구현 검증용 표준 test data를 포함
- 명도 대비, chroma 대비, hue 관계를 분리
- 작은 로고색과 지배색을 같은 비중으로 보지 않음
- 무채색 조합, 유사색, 보색, 온도 대비는 별도 feature로 제공
- 패턴 색상은 단색과 분리

### 신뢰도와 예외

- 배경, 피부, 모델, 소품을 segmentation에서 제외
- 조명, white balance, JPEG 압축, 그림자에 따라 confidence를 낮춤
- 사용자 수정 색상은 보존하되 이미지 profile과 별도 source로 기록
- legacy 이름만 있으면 단일 대표 LAB를 확정하지 않고 낮은 confidence의 이름 feature만 사용

이 단계에서는 이미지 색 추출 시스템을 구현하지 않는다. CIELAB 표준은 색 표현 근거이지 “어떤 두 색이 멋지다”는 호환성 근거가 아니다.

## shape·비율 엔진

### 목표 profile

```ts
type GarmentShapeProfile = {
  silhouetteClass: string;
  volume: number;
  visualWeight: number;
  structure: number;
  drape: number;
  stiffness: number;
  lengthRatio?: number;
  widthRatio?: number;
  shoulderEase?: number;
  chestEase?: number;
  waistEase?: number;
  hipEase?: number;
  riseType?: "low" | "mid" | "high";
  legShape?: "skinny" | "slim" | "straight" | "wide" | "balloon";
  hemWidthRatio?: number;
  tuckable?: boolean;
  layeringRole?: "base" | "mid" | "outer";
  source:
    | "product_measurement"
    | "image_analysis"
    | "official_product"
    | "user"
    | "text_inference";
  confidence: number;
  version: string;
};
```

### 파생 feature

- 상의 길이 ÷ 사용자 키 또는 기준 옷 길이
- 하의 총장과 인심·밑위·선호 총장 관계
- 상·하의 폭과 ease
- 밑위, thigh, hem으로 leg shape 추정
- 시각적 무게 중심과 상·하 면적 비율
- 아우터 포함 시 전체 layering depth
- tuck 가능성과 실제 tuck 상태는 분리
- footwear visual weight와 hem 관계

### 판단 분해

“크롭+와이드=좋음”을 하나의 규칙으로 두지 않는다.

1. 상·하의 길이비가 의도와 맞는가
2. volume 차이가 연결 또는 의도된 대비를 만드는가
3. 시각적 무게 중심이 과도하게 한쪽에 몰리는가
4. 소재 structure와 drape가 silhouette 의도를 지지하는가
5. style·occasion에서 허용되는 대비인가
6. 개인 체형 적합성과 별개로 outfit 자체가 조화로운가

각 항목은 긍정, 중립, 부정과 confidence를 반환한다.

## 소재 엔진

- 공식 혼용률을 최우선으로 사용하되 겉감·안감·충전재 section을 유지한다.
- 소재 호환성은 온도, 표면 질감, 광택, structure, drape로 분해한다.
- 상품명 키워드는 낮은 confidence fallback이다.
- “울=겨울” 같은 단일 규칙보다 비율, 조직, 두께, layering role을 함께 본다.
- detailCategory rule과 material rule의 중복 effect를 rule group 또는 exclusive policy로 제어한다.

## AI 역할

### 허용

1. 이미지에서 color/shape/material 후보를 구조화된 schema로 추출
2. 공식 상품 정보에서 속성 보강
3. 계산된 evidence를 자연어로 설명
4. confidence가 낮은 항목과 필요한 추가 정보 표시
5. 규칙으로 처리하기 어려운 예외 후보를 shadow 진단에 제안

### 금지

- 근거 없이 최종 0~100점 생성
- 실행마다 다른 점수 생성
- 외부 출처를 확인하지 않고 전문가 합의라고 주장
- 사용자 수정 덮어쓰기
- 온도 hard block 우회
- 저장된 추천 순서를 임의로 변경

AI JSON은 schema validation 후 사용하고 실패하면 현재 규칙으로 fallback한다.

## 개인 적합성

호환성 점수와 별도로 다음을 평가한다.

- 신체 치수와 상품 실측 비교
- intendedFit
- 기준 옷 실측
- style·color 선호
- 코디 like/less
- 저장·착용·교체 이력

사용자 피드백은 처음에는 정렬 보정으로만 유지한다. 충분한 evidence가 쌓이기 전 전문가 compatibility를 덮어쓰지 않는다.

## confidence

권장 기본 source 순서는 절대 전역 규칙이 아니라 필드별로 적용한다.

일반 원칙:

1. 사용자 직접 확인
2. 공식 상품 실측·공식 정보
3. 검증된 이미지 추출
4. 상품명·설명 inference
5. legacy 기본값

예외:

- 색상은 정확한 이미지 segmentation이 상품명보다 낫지만 조명 confidence가 낮을 수 있다.
- 소재는 공식 혼용률이 이미지 추정보다 우선한다.
- 실제 핏은 상품 실측과 신체 치수가 사진 인상보다 우선한다.
- 사용자가 잘못 입력할 가능성도 있으므로 source와 confidence를 둘 다 보존한다.

```ts
type ProfileField<T> = {
  value: T;
  source: string;
  confidence: number;
  version: string;
  updatedAt: string;
};
```

모든 기존 필드를 즉시 이 구조로 migration하지 않는다. 새 profile에만 적용하고 legacy adapter에서 기존 값을 읽는다.

## 전문가 평가 데이터

```ts
type ExpertOutfitEvaluation = {
  outfitId: string;
  colorHarmony: number;
  silhouetteBalance: number;
  proportionBalance: number;
  materialCompatibility: number;
  styleCoherence: number;
  occasionSuitability: number;
  overallCompatibility: number;
  successfulAttributes: string[];
  problematicAttributes: string[];
  styleIntent: string;
  occasion: string;
  evaluatorId: string;
  evaluatorConfidence: number;
  createdAt: string;
  rubricVersion: string;
};
```

수집 원칙:

- 최소 3명의 독립 평가자를 권장하고 disagreement를 삭제하지 않는다.
- ordinal rubric과 예시 anchor를 version 관리한다.
- Krippendorff’s alpha처럼 다수 평가자 agreement를 확인한다.
- 학습, 검증, 테스트 item을 분리한다. 같은 상품 이미지가 split을 넘지 않게 한다.
- 시대·문화권·성별 표현·체형 편향을 metadata와 분석에 포함한다.
- 룩북·인플루언서 데이터는 상업적 선별 편향이 있으므로 전문가 정답과 동일시하지 않는다.
- 전체점수뿐 아니라 실패 dimension과 이유를 수집한다.

검증 지표 후보:

- 전문가 pairwise preference accuracy
- compatibility AUC
- top-k precision
- NDCG
- incompatible-item diagnosis accuracy
- 사용자 선택률·교체율
- 실제 착용 기록 기반 유지율
- calibration error: confidence와 실제 정확도의 일치

## learned compatibility 확장

```ts
type LearnedCompatibilityResult = {
  score: number;
  confidence: number;
  modelVersion: string;
  embeddingVersion: string;
  supportedItemTypes: string[];
};
```

초기에는 다음 형태만 허용한다.

```text
finalScore =
  expertKnowledgeScore
  + learnedCompatibilityAdjustment
  + personalPreferenceAdjustment
```

각 비율은 이번 단계에서 정하지 않는다. 모델은:

- item type을 구분해야 한다.
- unseen item split에서 평가해야 한다.
- 지원하지 않는 카테고리에는 adjustment 0과 낮은 confidence를 반환해야 한다.
- rule evidence를 지우지 않고 보조해야 한다.
- 모델 버전과 embedding 버전을 함께 기록해야 한다.

## shadow scoring

```ts
type CompatibilityComparison = {
  legacyScore: number;
  professionalScore: number;
  scoreDifference: number;
  legacyRank: number;
  professionalRank: number;
  disagreementReasons: string[];
  professionalConfidence: number;
};
```

제약:

- 사용자에게 새 점수를 표시하지 않는다.
- 추천 순서와 저장 결과를 바꾸지 않는다.
- 개발 환경 또는 명시적으로 동의한 익명 진단에서만 비교한다.
- 개인 치수, 이미지 URI, 상품명, 브랜드 원문을 로그에 남기지 않는다.
- score difference뿐 아니라 dimension별 disagreement와 confidence를 남긴다.
- legacy와 새 엔진이 모두 같은 temperature hard block을 사용한다.

승격 조건 예:

- characterization test와 기존 회귀 test 모두 통과
- 전문가 blind set의 pairwise accuracy가 legacy보다 유의미하게 높음
- 중요한 hard block 회귀 0건
- 낮은 confidence에서 보수적으로 fallback
- 주요 카테고리별 calibration 확인
- rollback switch 검증

## 단계별 migration

### Phase 1: 감사와 특성화

- 변경: 현재 문서와 18개 characterization test
- 데이터 migration: 없음
- 테스트: 기존 전체 test와 audit test
- 출시 위험: 없음
- rollback: 문서·테스트 commit revert
- 완료 조건: 운영 결과 불변, 모든 규칙의 출처 상태 확인

### Phase 2: legacy rule metadata

- 변경 후보: `utils/fashionCompatibility/legacyRules.ts`, adapter
- 데이터 migration: 없음
- 테스트: 기존 결과 snapshot 동일
- 위험: rule order와 중복 effect 변화
- rollback: adapter off
- 완료 조건: 모든 active rule에 ID, sourceType, version, exception 필드 존재

### Phase 3A: color profile foundation

- 변경: versioned `GarmentColorProfile`, 표준 색채 계산, named fallback, 측정 feature, 비활성 shadow
- 데이터 migration: 없음. 기존 항목은 실행 중 `legacy_color_name` fallback
- 테스트: sRGB/Lab, CIEDE2000 reference pair, profile/feature/shadow, legacy golden parity
- 위험: 대표 named RGB를 실제 의류 측정으로 오인
- rollback: color 모듈과 테스트 호출 제거. 운영 경로는 원래부터 비활성
- 완료 조건: profile·feature 계산 검증, 운영 추천 결과 완전 동일

### Phase 3B: measured palette and expert rubric

- 변경 후보: 배경 제외 이미지 palette, 면적·패턴 feature, 전문가 평가 rubric
- 데이터 migration: 검증 전 결정하지 않음
- 테스트: 조명·배경·패턴 fixture, 전문가 blind set, calibration
- 위험: 이미지 오염과 측정값을 조화 점수로 오해
- rollback: shadow flag off
- 완료 조건: 색 면적 품질과 전문가 기준이 별도로 검증됨

### Phase 4: shape profile 개선

- 변경 후보: versioned `GarmentShapeProfile`, ISO 18890 매핑 adapter
- 데이터 migration: 기존 garmentProfile은 impression adapter로 읽음
- 테스트: 상품 실측 fixture, 기준 옷, FREE/복합 사이즈 회귀
- 위험: 카테고리별 measurement 의미 혼동
- rollback: 기존 resolved profile 사용
- 완료 조건: 전문가가 dimension 정의와 threshold 검토

### Phase 5: 전문가 지식 V1

- 변경: knowledge base evaluator
- 데이터 migration: 없음
- 테스트: 전문가 fixture와 rule exception
- 위험: 규칙 수 증가와 충돌
- rollback: shadow flag off
- 완료 조건: rule coverage, conflict resolution, evidence audit 통과

### Phase 6: 전문가 평가 데이터

- 변경: annotation schema와 내부 도구
- 데이터 migration: 없음
- 테스트: rubric version, anonymization, split leakage
- 위험: 평가자 편향·저작권·개인정보
- rollback: 데이터 수집 중단·삭제 정책 실행
- 완료 조건: agreement와 대표성 기준 충족

### Phase 7: learned compatibility

- 변경: model adapter와 versioned result
- 데이터 migration: 없음
- 테스트: pairwise, top-k, NDCG, calibration, unseen-item split
- 위험: dataset bias, 설명 불일치
- rollback: adjustment 0
- 완료 조건: shadow에서 전문가 엔진 대비 안전한 개선

### Phase 8: 개인화

- 변경: preference adjustment와 privacy controls
- 데이터 migration: 명시적 동의와 보존 정책 필요
- 테스트: cold start, sparse feedback, delete/export
- 위험: 취향을 품질로 오인, filter bubble
- rollback: 개인화 adjustment 0
- 완료 조건: 사용자 지표 개선과 안전 기준 동시 충족

## 테스트 전략

- characterization: legacy 결과 고정
- unit: rule condition, exception, confidence, clamp
- contract: AI JSON schema와 fallback
- fixture: color/shape/material profile
- differential: legacy vs shadow
- expert benchmark: blind pairwise와 diagnosis
- property: 같은 입력은 같은 결과, item 순서 불변
- integration: 홈과 추천 화면 동일 context
- safety: temperature hard block과 저장 제외
- Android export: bundle 경계와 module import 검증

## 롤백 원칙

- 새 evaluator는 기존 엔진 옆에 adapter로 붙인다.
- 점수·정렬·노출 변경은 feature flag 단위로 분리한다.
- 저장 형식 migration 전에 read-old/write-new 기간을 둔다.
- 새 profile이 없거나 confidence가 낮으면 legacy로 fallback한다.
- temperature hard block, 저장 코디 제외, 사용자 수정 우선순위는 공통 모듈을 재사용한다.

## 근거 자료

- [CIE 015:2018 Colorimetry](https://www.cie.co.at/publications/colorimetry-4th-edition)
- [ISO/CIE 11664-4:2019 CIELAB](https://www.cie.co.at/publications/colorimetry-part-4-cie-1976-lab-colour-space-1)
- [ISO/CIE 11664-6:2022 CIEDE2000](https://www.cie.co.at/publications/colorimetry-part-6-ciede2000-colour-difference-formula-1)
- [CIEDE2000 implementation notes and test data](https://onlinelibrary.wiley.com/doi/10.1002/col.20070)
- [ISO 8559-1:2017](https://www.iso.org/standard/61686.html)
- [ISO 8559-2:2025](https://www.iso.org/standard/85590.html)
- [ISO 18890:2018](https://www.iso.org/standard/63693.html)
- [Learning Type-Aware Embeddings for Fashion Compatibility](https://arxiv.org/abs/1803.09196)
- [Outfit Compatibility Prediction and Diagnosis with Multi-Layered Comparison Network](https://arxiv.org/abs/1907.11496)
- [Fashion Recommendation and Compatibility Prediction Using Relational Network](https://arxiv.org/abs/2005.06584)
- [Learning Color Compatibility in Fashion Outfits](https://arxiv.org/abs/2007.02388)
- [Krippendorff’s alpha for multi-rater agreement](https://journal.r-project.org/articles/RJ-2021-046/)

이 자료들은 구조와 검증 방법의 근거다. 현재 NAES 가감점 숫자의 근거로 소급 적용하지 않는다.
