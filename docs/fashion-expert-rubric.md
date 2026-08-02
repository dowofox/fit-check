# Fashion Expert Rubric

> **Status: draft / expert review required / not validated / not production scoring policy**

## 목적

Phase 5A rubric은 전문가가 같은 context의 코디를 독립적으로 평가할 때 사용할 데이터 계약이다. Codex나 현재 추천 엔진이 정답을 생성하는 규칙이 아니며, 어떤 feature도 그 자체로 긍정·부정 점수가 아니다. 구현 버전은 `expert-rubric-draft-v0.3`다.

## 평가 차원

| 영역 | Dimension | 평가 대상 |
| --- | --- | --- |
| 코디 호환성 | `color_harmony` | 선언된 의도 안에서의 색 관계 |
| 코디 호환성 | `silhouette_balance` | 부피와 시각적 무게 분포 |
| 코디 호환성 | `proportion_coherence` | 길이와 비율의 전체 연결 |
| 코디 호환성 | `material_compatibility` | 보이는 소재 특성의 관계 |
| 코디 호환성 | `style_coherence` | 선언된 style intent와의 일관성 |
| 코디 호환성 | `occasion_suitability` | 선언된 occasion에 대한 적합성 |
| 개인 적합도 | `body_fit_suitability` | 충분한 신체·의류 정보가 있을 때의 핏 적합성 |
| 개인 적합도 | `fit_preference_suitability` | 별도로 선언된 핏 선호와의 적합성 |
| 개인 적합도 | `exposure_preference_suitability` | 별도로 선언된 노출 선호와의 적합성 |
| 환경 적합도 | `temperature_suitability` | 기록된 기온 context 적합성 |
| 환경 적합도 | `rain_suitability` | 기록된 비 context 적합성 |
| 환경 적합도 | `wind_suitability` | 기록된 바람 context 적합성 |
| 환경 적합도 | `season_suitability` | 기록된 계절 context 적합성 |

환경 차원은 평가 데이터에 기록할 수 있지만 현재 운영 온도·계절 hard block을 대체하지 않는다. 개인 적합도는 코디 자체의 호환성과 분리한다.

## 차원별 1~5 draft anchor

숫자는 순서가 있는 범주이며 동일 간격의 연속값으로 확정하지 않는다. 집계는 median을 우선하고 mean은 보조 통계로만 제공한다.

아래 문구는 파일럿용 초안이며 전문가 검토 전이다. 각 셀은 해당 context에서의 관찰을 뜻하며 특정 조합을 보편적 정답으로 선언하지 않는다.

| Dimension | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| color | 반복 충돌 | 중요한 색 관계 불일치 | 중립적·수용 가능 | 대부분 명확히 연결 | 주·보조·포인트 색이 의도적으로 연결 |
| silhouette | 여러 지점의 부피·무게 충돌 | 눈에 띄는 불균형 | 강한 불균형 없는 사용 가능 상태 | 의도에 대체로 균형 | 부피·무게가 의도를 명확히 지지 |
| proportion | 길이·분할이 반복 방해 | 핵심 비율 하나가 약화 | 사용 가능한 중립 비율 | 대부분 의도에 부합 | 길이·분할·착용 상태가 의도적 |
| material | 표면·구조·드레이프·무게가 반복 충돌 | 중요한 소재 불일치 | 명확한 충돌·연결 없음 | 소재 특성이 대체로 연결 | 소재 특성이 context를 의도적으로 강화 |
| style | 여러 요소가 의도와 충돌 | 주요 요소 하나가 이탈 | 방향이 강하지 않은 사용 가능 상태 | 대부분 일관 | 모든 선택이 의도적으로 연결 |
| occasion | 여러 요소가 상황에 부적합 | 주요 상황 요구 하나를 놓침 | 상황에 사용 가능 | 대부분 상황에 적합 | 상황을 의도적으로 충족 |
| body fit | 이용 가능한 context에서 주요 충돌 다수 | 중요한 적합성 불일치 | 중립적·사용 가능 | 대체로 적합 | 핏 균형을 강하게 지지 |
| fit preference | 선호와 반복 충돌 | 중요한 선호 불일치 | 선호 대비 중립 | 대부분 선호에 부합 | 선호를 일관되게 표현 |
| exposure preference | 선호와 명확히 충돌 | 주목할 노출 불일치 | 선호 대비 중립 | 대부분 선호에 부합 | 선호를 일관되게 지지 |
| temperature | 기록 기온에 반복 부적합 | 주요 보온·통기 불일치 | 기온에 사용 가능 | 대부분 기온에 적합 | 레이어·소재가 기온을 명확히 지지 |
| rain | 강수 context와 여러 충돌 | 주요 강수 적합성 문제 | 강수 대비 중립 | 대부분 강수에 적합 | 강수를 의도적으로 고려 |
| wind | 바람 context와 여러 충돌 | 주요 바람 적합성 문제 | 바람 대비 중립 | 대부분 바람에 적합 | 바람을 의도적으로 고려 |
| season | 계절과 여러 충돌 | 주요 계절 불일치 | 계절에 사용 가능 | 대부분 계절에 적합 | 계절을 의도적으로 표현·지지 |

`3`은 정보 부족이 아니다. 판단할 정보가 없으면 `not_enough_information`, 적용 대상이 아니면 `not_applicable`, 평가자가 판단을 유보하면 `abstained`를 사용한다. 모든 응답에는 1~5 confidence가 별도로 필요하다.

## Context

각 snapshot은 `styleIntent`, `occasion`, 선택적인 계절·기온 문맥과 다음 styling state를 기록한다. 또한 민감한 원문 없이 `bodyFitContext`, `fitPreferenceContext`, `exposurePreferenceContext`의 이용 가능 여부와 rain/wind context를 기록한다.

- 상의 넣어 입기: tucked / untucked / partial / not applicable / unknown
- 아우터 착용: yes / no / unknown
- 여밈: open / closed / mixed / unknown

확인하지 못한 값은 추정하지 않고 `unknown`으로 둔다. `required` context가 없으면 rated 평가는 error이며 `recommended` context가 없으면 warning이다. 정보 부족을 3점으로 대체하지 않는다. 서로 다른 context의 pairwise 평가는 agreement에서 제외하며 원래 preference를 덮어쓰지 않는다.

## Context와 observation input

Context requirement는 어떤 상황을 기준으로 평가하는지 정의하고, observation requirement는 실제 코디를 판단할 입력이 있는지 정의한다. 둘은 독립적으로 검증한다. required context와 required observation이 모두 없으면 각각 별도 error가 기록된다. evidence 배열이 비어 있어도 observation 검증은 생략되지 않는다.

| Dimension | 최소 observation input |
| --- | --- |
| `color_harmony` | image 또는 color features |
| `silhouette_balance` | image 또는 shape features |
| `proportion_coherence` | image 또는 shape features |
| `material_compatibility` | image 또는 material context |
| `style_coherence` | image |
| `occasion_suitability` | image |
| `body_fit_suitability` | body-fit context와 함께 image 또는 shape features |
| `fit_preference_suitability` | fit-preference context와 함께 image 또는 shape features |
| `exposure_preference_suitability` | exposure-preference context와 image |
| `temperature_suitability` | image |
| `rain_suitability` | image |
| `wind_suitability` | image |
| `season_suitability` | image |

`overall_compatibility`를 rated로 기록하려면 image가 필요하다. Pairwise dimension은 A와 B가 각각 해당 dimension의 observation requirement를 충족해야 한다. Pairwise 전체 선호가 `a`, `b`, `tie`이면 A와 B 모두 image가 필요하고, `not_comparable`은 이 요건에서 제외한다.

입력이 부족하면 rating 3을 만들지 말고 `not_enough_information`을 사용한다. Rated dimension의 supporting/conflicting evidence가 모두 비어 있으면 파일럿 진단용 `rated_without_structured_evidence` warning을 남기지만, warning 자체가 rating의 유효성을 자동으로 부정하지는 않는다.

## Evidence code

색상과 shape feature는 관찰 코드다. 예를 들어 `shape.short_top_long_bottom`이나 `color.opposing_hue`는 좋음 또는 나쁨을 뜻하지 않는다. 평가자는 같은 관찰을 선언된 의도에 따라 `supportingEvidenceCodes` 또는 `conflictingEvidenceCodes`에 넣는다.

방향 코드는 다음과 같다.

- `supports_declared_intent`
- `conflicts_with_declared_intent`
- `neutral_for_declared_intent`
- `insufficient_context`

허용 코드는 `rubricRegistry.ts`에서 dimension별로 관리하며 등록되지 않은 코드는 validation error다. 자유 메모만으로 evidence를 대신하도록 강제하지 않지만, notes는 1,000자 이하의 평문이어야 하고 HTML·실행 문자열은 금지한다.

Evidence metadata는 `derived_color_feature`, `derived_shape_feature`, `human_observed_material`, `context_interpretation` origin을 구분한다. Derived code는 대응 feature payload가 있을 때만 사용할 수 있다. Material code는 이미지 또는 허가된 상품 context에서 사람이 관찰한 표면·구조·드레이프·무게의 중립 기록이며 `similar`나 `mixed` 자체가 좋음·나쁨을 뜻하지 않는다.

Material draft code는 `material.similar_surface`, `material.mixed_surface`, `material.similar_structure`, `material.mixed_structure`, `material.similar_drape`, `material.mixed_drape`, `material.weight_contrast`, `material.layering_weight_difference_observed`, `material.seasonal_context_present`, `material.input_confidence_low`, `material.not_visually_assessable`이다. Weight difference code는 중립 관찰이며 supporting/conflicting 배열이 해석 방향을 결정한다.

Snapshot의 `inputAvailability`는 이미지, color/shape feature, material context, body-fit context의 이용 가능 여부만 기록한다. 이미지 URI, 사용자 치수, 선호 원문은 저장하지 않으며 availability는 권한이나 정확성을 보장하지 않는다.

## Version과 검토

- 모든 초기 dimension은 `draft`, `reviewedBy: []`, `sourceReferences: []`다.
- 문구나 anchor가 바뀌면 rubric version을 올리고 기존 평가의 version을 유지한다.
- 실제 전문가 검토자, 검토일, 적용 문화권과 대상 audience를 별도로 확인하기 전 `validated`로 바꾸지 않는다.
- 현재 consensus 임계값은 데이터 진단용 임시값이며 운영 점수 승격 기준이 아니다.

## 연구 근거와 한계

- [Artstein & Poesio (2008)](https://aclanthology.org/J08-4004/)는 annotation agreement 지표의 가정과 해석이 task에 따라 달라짐을 정리한다. Phase 5A가 단순 exact/adjacent/difference 지표만 제공하고 고급 계수를 임의 구현하지 않는 이유다.
- [Vasileva et al. (2018)](https://arxiv.org/abs/1803.09196)은 fashion compatibility가 item type을 구분해야 함을 보여주지만, 사용자 생성 outfit 데이터가 이 rubric의 보편적 미학 정답임을 뜻하지 않는다.
- [Wang et al. (2019)](https://arxiv.org/abs/1907.11496)은 전체 호환성뿐 아니라 불일치 요인 진단을 다룬다. Phase 5A도 overall 하나로 차원을 숨기지 않는다.

이 자료들은 rubric 숫자나 개별 스타일 규칙을 검증한 출처가 아니다. 문화·유행·평가자 배경에 따른 차이는 실제 pilot에서 별도로 검증해야 한다.
