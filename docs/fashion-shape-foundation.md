# Fashion Shape Foundation

## 목적

Phase 4A는 기존 추천 점수를 바꾸지 않고, 의류 shape와 착장 비율을 측정 가능한 feature로 표현하는 기반만 만든다. 이 단계의 결과는 좋음/나쁨 판정이나 사용자 UI가 아니라 개발·검증용 런타임 객체다.

운영 원칙:

- `ClosetItem`과 `UserProfile` 저장 schema를 변경하지 않는다.
- 기존 `getResolvedLegacyGarmentProfile()`과 legacy 점수 경로를 그대로 둔다.
- 현재 선택한 상품 사이즈와 일치하는 실측 행만 사용한다.
- 값이 없거나 단위·의미가 불명확하면 추정 기본값 대신 `undefined`와 diagnostic을 남긴다.
- 객관적 착장 구조와 사용자 개인 핏을 분리한다.
- 전문 shape 점수는 만들지 않는다.

## 현재 데이터 source

| Source | 현재 값 | Phase 4A 사용 방식 |
| --- | --- | --- |
| 공식/수동 상품 실측 | `confirmedProduct.productSizeGuide` | 선택 사이즈 행만 `ShapeMeasurementValue`로 변환 |
| 사진 인상 | `garmentProfile` | silhouette, volume, visualWeight, structure, drape, pointLevel의 보조 관찰값 |
| 스타일 분석 | `styleProfile.fit`, `silhouette`, `lengthType` | 사진 인상이 없을 때 낮은 confidence fallback |
| 텍스트 | category, detailCategory, fit, description, productName | 마지막 fallback. 원문은 profile에 보관하지 않음 |
| 사용자 신체 치수 | `UserProfile`의 둘레·길이 | `PersonalFitFeatures`에서만 사용 |
| 기준 옷 | `referenceClothing` ID와 해당 `ClosetItem` | 같은 measurement semantics끼리만 차이 계산 |

`productSizeGuide`에는 자동 추출 실측과 사용자가 직접 입력한 실측이 같은 구조로 저장된다. 현재 schema에는 행 단위 provenance가 없으므로 기본 adapter는 confirmed product 실측을 `official_product`로 취급하되 confidence를 1로 두지 않는다. 명시적 호출자는 `measurementSource` context로 `user_confirmed` 또는 `reference_clothing`을 지정할 수 있다.

## 측정 의미 계약

현재 서버 정규화와 상세 입력 UI를 함께 확인한 결과:

| Product field | Semantics | 비고 |
| --- | --- | --- |
| `chest`, `waist`, `hip`, `thigh`, `hem` | `flat_width` | 상품 단면 길이 |
| `totalLength`, `shoulder`, `sleeve`, `rise`, `footLength` | `linear_length` | 직선 길이 |
| `chestCircumference`, `waistCircumference`, `hipCircumference`, `thighCircumference` | `circumference` | 사용자 신체 둘레 |
| `height`, `shoulderWidth`, `armLength`, `inseam`, `preferredPantsTotalLength` | `linear_length` | 사용자 선형 길이 |

안전 규칙:

- `flat_width`와 `circumference`는 일반 차이 함수에서 비교하지 않는다.
- 품 여유는 명시적인 `flat_width * 2 - body circumference` 함수에서만 계산한다.
- 단위가 `cm`로 선언되지 않은 상품 실측은 professional profile에 넣지 않는다.
- `rise`는 선형 길이지만 앞밑위·일반 밑위의 원본 의미가 저장되지 않으므로 `rise-subtype-unspecified` diagnostic을 남긴다.
- 총장과 인심은 서로 다른 측정이므로 임의 변환하지 않는다.
- 숫자 뒤에 임의 문자가 붙은 사용자 입력은 조용히 실패하며, parser가 단위를 추정하지 않는다.

[ISO 18890:2018](https://www.iso.org/standard/63693.html)은 의류 측정 지점과 방법의 공통 정의를 제공하고, [ISO 8559-1:2017](https://www.iso.org/standard/61686.html)은 인체 측정 정의를 제공한다. [ISO 8559-2:2025](https://www.iso.org/standard/85590.html)은 신체 치수에 기반한 의류 사이즈 표기를 다룬다. 이 표준들은 의류 실측과 신체 치수를 구분해야 한다는 설계 근거이며, 현재 NAES 필드가 ISO 항목과 완전히 매핑되거나 인증되었다는 뜻은 아니다.

## GarmentShapeProfile v1

`buildGarmentShapeProfile(item, context)`는 저장하지 않는 immutable profile을 만든다.

- `measurements`: 선택 사이즈 실측과 field별 semantics/source/confidence
- `silhouetteClass`, `lengthClass`: 사용자 확인 label, 사진 인상, style profile, text 순으로 해석
- `volume`, `visualWeight`, `structure`, `drape`, `pointLevel`: 사진 기반 값이 실제로 있을 때만 사용
- `derived`: 호환 가능한 실제 측정값이 있을 때만 생성하는 비율
- `diagnostics`: 누락 field, 모호한 의미, source 충돌

우선순위는 field별로 적용한다. 공식 실측이 있다는 사실은 치수 source를 강하게 만들지만, 그 자체가 오버핏·슬림핏을 확정하지 않는다. 반대로 사진 인상은 시각적 volume을 표현할 수 있지만 실제 사용자 착용 여유를 증명하지 않는다.

현재 `fit` 수정에 대한 field provenance가 저장되지 않으므로 기본 builder는 이를 user-confirmed label로 주장하지 않는다. 사용자 확인 source는 명시적인 `confirmedFitLabel` context가 있을 때만 사용한다.

## OutfitShapeFeatures v1

`buildOutfitShapeFeatures()`는 한 요청에서 item별 profile을 한 번만 만들고 다음 관찰값을 계산한다.

- 상·하의 volume 차이
- 상·하의 length class 관계
- 상체·하체 visual weight와 중심
- structure와 drape 차이
- 아우터 dominance와 layering depth
- 카테고리별 사용 가능한 실측 비율
- profile confidence와 fallback 여부

`observedRelations`는 진단 label이다. 예를 들어 `short-top-long-bottom`, `upper-heavy`, `outer-dominant`는 관찰 사실일 뿐 긍정·부정 점수가 아니다. 신발 visual weight는 실제 profile 값이 있을 때만 하체 계산에 포함하며 category 이름만 보고 추정하지 않는다.

## PersonalFitFeatures v1

개인 핏 feature는 객관적 착장 구조와 별도 객체다.

- chest/waist/hip은 명시적인 단면-둘레 변환을 통해 ease를 계산한다.
- shoulder와 긴팔 sleeve는 같은 `linear_length`끼리만 비교한다.
- 반팔·민소매처럼 전체 팔 길이와 직접 비교할 수 없는 경우 sleeve 차이를 만들지 않는다.
- 바지 총장은 `preferredPantsTotalLength`와만 직접 비교한다.
- 상품 inseam field가 없으므로 `inseamDifferenceCm`을 억지로 만들지 않는다.
- 기준 옷은 같은 category, 다른 item, 선택 사이즈 실측, 같은 semantics 조건을 모두 통과해야 한다.

결과에는 사용자 원본 치수, 전체 `UserProfile`, 상품명, URL, 이미지 URI를 넣지 않는다. field 이름, 계산된 차이, diagnostic code만 남긴다.

## Legacy와의 분리

기존 `legacyShapeRules.ts`에는 검증되지 않은 절대 cm threshold와 `bodyType` 문자열 기반 personal suitability 규칙이 있다. Phase 4A는 이를 삭제·변경하지 않는다.

- legacy profile: 운영 점수와 기존 문구에 계속 사용
- `shape-profile-v1`: opt-in shadow 분석에만 사용
- objective shape: 착장 item 사이의 구조 관계
- personal fit: 사용자 치수 및 기준 옷과의 관계

이 분리는 legacy parity를 지키면서 향후 전문가 rubric을 검증하기 위한 것이다.

## Shadow 동작

`evaluateShapeShadowComparison(..., { enabled: false })`가 기본값이다.

비활성 상태:

- item과 user profile을 읽지 않는다.
- profile과 personal fit을 계산하지 않는다.
- 로그, cache, storage, UI 연결이 없다.
- legacy snapshot만 반환한다.

명시적으로 활성화한 개발/test 호출만 profile과 feature를 계산한다. Phase 4A에는 `professional.score`와 `scoreDifference`가 런타임 결과에 존재하지 않으며 추천 점수·순위에 영향을 주지 않는다.

## Confidence

confidence는 정답 확률이 아니다. 사용 가능한 field 비율, source 신뢰 수준, measurement semantics 확실성을 단순하고 설명 가능하게 결합한 입력 품질 지표다.

- 공식/기준 옷 실측은 높은 source reliability를 갖지만 1.0으로 확정하지 않는다.
- 사진 인상은 중간, style profile과 text fallback은 더 낮다.
- outfit confidence는 item profile 평균과 측정 coverage를 별도로 제공한다.
- personal fit confidence는 실제 비교 가능한 field 수만 반영한다.

## 성능과 개인정보

- shadow가 꺼져 있으면 추가 계산은 0이다.
- 활성 요청에서도 item별 profile을 한 번만 만들고 outfit/personal feature에 재사용한다.
- 전체 `ClosetItem`이나 `UserProfile`을 복사하지 않는다.
- 원본 개인 치수와 로컬 URI를 결과·로그·원격 전송에 넣지 않는다.
- profile은 런타임 immutable 객체이며 migration이나 cache key 변경이 없다.

## 전문 shape 점수 도입 조건

다음 조건이 충족되기 전에는 professional score를 만들지 않는다.

1. 상품 실측 field와 측정 방법의 의미가 공급처별로 검증될 것
2. tuck, rise subtype, 아우터 가시성, 신발 visual weight 등 핵심 누락값의 정책이 정해질 것
3. objective outfit structure와 personal body suitability가 분리된 전문가 rubric이 있을 것
4. style·상황별 허용 비율이 blind expert set에서 검증될 것
5. 전문가 간 agreement와 confidence calibration이 측정될 것
6. legacy 대비 shadow parity, rollback, 개인정보 정책이 검증될 것

