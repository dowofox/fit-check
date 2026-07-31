# Fashion Color Foundation

## 목적

Phase 3A는 의류 색을 버전 가능한 측정 프로필로 표현하고, 코디 안의 색 관계를 재현 가능한 수치로 계산한다. 기존 문자열 기반 규칙의 점수·순위·이유·경고는 변경하지 않는다. 새 결과는 전문가 색상 점수가 아니라 Phase 3B에서 검증할 입력이다.

## 현재 데이터와 한계

현재 `ClosetItem`의 주 색상은 `color?: string`이다. 의미상 출처는 다음 필드로 구분한다.

1. `userEditedClassificationFields`에 `color`가 있는 사용자 확인값
2. `confirmedProduct.productColor`의 공식 상품 색상명
3. `confidence.color`, `photoAnalysisVersion`, `lastAnalyzedAt`이 있는 AI 분석 색상명
4. 기존 `color` 문자열
5. `styleProfile.mainColor/subColors` 보조값

어떤 출처도 현재 RGB 또는 이미지 면적을 제공하지 않는다. 따라서 이름을 대표 sRGB로 바꾸는 모든 결과는 fallback이며 측정 confidence가 낮다. 특히 데님, 카키, 베이지, 아이보리, 워싱 블루, 멜란지, 빈티지 블랙, 크림, 브라운은 실제 범위가 넓다. 사용자 확인값은 의미상 우선하지만 실제 Lab 정확도가 높다는 뜻은 아니다.

## 구조

```text
ClosetItem (read only)
  -> source precedence + alias resolution
  -> GarmentColorProfile color-profile-v1
  -> OutfitColorFeatures color-features-v1
  -> optional ColorShadowComparison
```

프로필은 실행 중에만 만들며 저장 schema, 백업, migration, cache key에 포함하지 않는다. swatch와 진단 배열을 포함해 생성 후 변경할 수 없게 동결한다. 상품명, 이미지 URI, 상품 URL, 사용자 정보는 넣지 않는다.

`GarmentColorProfile`은 swatch별 sRGB/Lab/LCh, 비율, source, confidence를 가진다. 현재 비율 데이터가 없으므로 해석 가능한 색상명 사이에 같은 비율을 가정하고 `assumedEqualProportions`를 기록한다. 해석하지 못한 문자열은 버리지 않고 `unresolvedLabels`에 남긴다. 최대 swatch 수는 5개다.

## 색채 계산

구현 흐름은 다음과 같다.

1. 0~255 sRGB 입력 범위와 유한값 검증
2. IEC 61966-2-1 transfer function으로 gamma decoding
3. D65 기준 linear sRGB를 XYZ로 변환
4. 같은 D65 reference white를 사용해 XYZ를 CIELAB로 변환
5. Lab를 LCh로 변환
6. Delta E 1976 및 CIEDE2000 계산

sRGB transfer function, D65 white point, 변환 행렬은 [W3C sRGB](https://www.w3.org/Graphics/Color/sRGB)와 [CSS Color 4 sample conversion code](https://www.w3.org/TR/css-color-4/)를 따른다. 이 프로필은 sRGB D65 측정 파이프라인이므로 XYZ를 D50으로 chromatic adaptation하지 않고 D65 Lab를 명시적으로 사용한다.

CIEDE2000은 기본 parametric factor `kL=kC=kH=1`로 [ISO/CIE 11664-6](https://www.cie.co.at/publications/colorimetry-part-6-ciede2000-colour-difference-formula-0)을 구현한다. 검증은 [Sharma, Wu, Dalal 구현 노트와 reference pairs](https://www.ece.rochester.edu/~gsharma/ciede2000/ciede2000noteCRNA.pdf)를 사용한다. 계산 중 반올림하지 않으며 무채색 hue는 `undefined`, hue 차이는 0/360 경계를 순환해 처리한다.

## Named Color Catalog

카탈로그는 한 번만 생성되는 정적 `Map`이다. 한국어·영어 alias를 canonical label과 대표 sRGB에 연결한다. 대표값은 실제 의류 사진을 측정한 값이 아니므로 confidence는 0.18~0.35로 제한한다. 공식 상품 또는 사용자 입력 색상명도 대표값을 사용한 순간 `usedFallback: true`다.

기존 `utils/color.ts`의 legacy 정규화는 변경하지 않는다. Phase 3A resolver는 별도 경로이므로 운영 추천 결과에 영향을 주지 않는다.

## 측정 Feature

`OutfitColorFeatures`는 다음을 계산한다.

- swatch 수, 평균·범위 lightness/chroma
- 각 의류의 dominant swatch 사이 CIEDE2000, 명도·chroma·hue 차이
- 최소·최대·평균 Delta E
- 서로 구분되는 dominant color 수
- 높은 chroma의 accent candidate 수
- achromatic/warm/cool 면적 비율
- `achromatic`, `low-contrast`, `high-lightness-contrast`, `similar-hue`, `opposing-hue`, `mixed-temperature` 관측 라벨

현재 dominant color 구분은 Delta E 2000 `3` 초과, achromatic은 chroma `8` 미만, accent candidate는 chroma `45` 이상을 진단용 기준으로 사용한다. 관계 라벨은 측정값 요약일 뿐 좋은 코디 또는 나쁜 코디 판정이 아니다.

CIELAB는 색을 표현하는 체계이고 Delta E는 지각적 색차의 상대 크기를 추정한다. 둘 다 패션 조화의 정답 함수가 아니다. 톤온톤, 보색, 명도 대비가 어떤 의도와 상황에서 적합한지는 별도의 전문가 rubric과 검증 데이터가 필요하다.

## Shadow 동작

`evaluateColorShadowComparison()`의 기본값은 비활성이다. 비활성 호출은 color profile이나 feature를 만들지 않고 기존 legacy snapshot만 반환한다. `{ enabled: true }`인 개발·테스트 호출만 feature를 계산한다.

Phase 3A에는 professional score와 `scoreDifference`가 없다. 없는 점수를 0으로 처리하지 않는다. 운영 추천 모듈, UI, 캐시, 저장소, telemetry, 원격 로그에는 연결하지 않는다.

## 개인정보와 성능

- profile은 item당 한 번 생성하고 Lab/LCh를 swatch에 저장한다.
- 카탈로그 lookup은 정적 `Map`을 재사용한다.
- item ID는 메모리의 pairwise 연결과 테스트에만 사용한다.
- 이미지 URI, 로컬 경로, 상품 URL·상품명, 사용자 이름·치수는 결과에 포함하지 않는다.
- shadow는 기본 비활성이므로 운영 추천 경로의 pairwise 연산은 0회다.

## Phase 3B 전제 조건

전문 색상 점수 또는 운영 반영 전 다음이 필요하다.

1. 배경을 제외하고 검증된 의류 이미지 palette와 면적 추출
2. 조명·화이트밸런스·카메라 차이를 다루는 품질 기준
3. 패턴, 로고, 작은 포인트색의 면적 규칙
4. style intent와 occasion이 포함된 전문가 rubric
5. 문화권·성별 표현·유행 편향을 포함한 blind 평가 데이터
6. 낮은 confidence fallback과 rollback switch 검증
7. legacy 대비 pairwise accuracy, calibration, hard-block 회귀 평가

이 조건을 충족하기 전에는 feature threshold를 운영 가감점으로 해석하지 않는다.
