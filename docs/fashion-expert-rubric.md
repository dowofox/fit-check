# Fashion Expert Rubric

> **Status: draft / expert review required / not validated / not production scoring policy**

## 목적

Phase 5A rubric은 전문가가 같은 context의 코디를 독립적으로 평가할 때 사용할 데이터 계약이다. Codex나 현재 추천 엔진이 정답을 생성하는 규칙이 아니며, 어떤 feature도 그 자체로 긍정·부정 점수가 아니다. 구현 버전은 `expert-rubric-draft-v0.1`이다.

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

## 1~5 ordinal 척도

숫자는 순서가 있는 범주이며 동일 간격의 연속값으로 확정하지 않는다. 집계는 median을 우선하고 mean은 보조 통계로만 제공한다.

1. 선언된 style intent 또는 occasion 기준에서 명확한 충돌이 여러 개 존재한다.
2. 일부 연결은 있지만 중요한 불일치가 존재한다.
3. 큰 충돌이나 강한 장점이 없는 중립적이고 수용 가능한 상태다.
4. 대부분의 요소가 선언된 의도 안에서 일관된다.
5. 여러 요소가 의도적으로 연결되고 높은 완성도를 보인다.

`3`은 정보 부족이 아니다. 판단할 정보가 없으면 `not_enough_information`, 적용 대상이 아니면 `not_applicable`, 평가자가 판단을 유보하면 `abstained`를 사용한다. 모든 응답에는 1~5 confidence가 별도로 필요하다.

## Context

각 snapshot은 `styleIntent`, `occasion`, 선택적인 계절·기온 문맥과 다음 styling state를 기록한다.

- 상의 넣어 입기: tucked / untucked / partial / not applicable / unknown
- 아우터 착용: yes / no / unknown
- 여밈: open / closed / mixed / unknown

확인하지 못한 값은 추정하지 않고 `unknown`으로 둔다. 서로 다른 context의 pairwise 비교는 경고 대상이며 `not_comparable`을 `tie`로 바꾸지 않는다.

## Evidence code

색상과 shape feature는 관찰 코드다. 예를 들어 `shape.short_top_long_bottom`이나 `color.opposing_hue`는 좋음 또는 나쁨을 뜻하지 않는다. 평가자는 같은 관찰을 선언된 의도에 따라 `supportingEvidenceCodes` 또는 `conflictingEvidenceCodes`에 넣는다.

방향 코드는 다음과 같다.

- `supports_declared_intent`
- `conflicts_with_declared_intent`
- `neutral_for_declared_intent`
- `insufficient_context`

허용 코드는 `rubricRegistry.ts`에서 dimension별로 관리하며 등록되지 않은 코드는 validation error다. 자유 메모만으로 evidence를 대신하도록 강제하지 않지만, notes는 1,000자 이하의 평문이어야 하고 HTML·실행 문자열은 금지한다.

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
