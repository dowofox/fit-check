# Fashion Expert Evaluation Guide

> **Draft procedure. Expert review required. Not validated. Not a production scoring policy.**

## 평가 목적과 대상

평가 목적은 NAES의 색상·shape 관찰 feature와 사람의 판단을 연결할 오프라인 benchmark를 만드는 것이다. 평가는 익명 item category와 허가된 평가 이미지, 명시된 context를 대상으로 한다. 운영 추천 점수, 사용자 프로필 원문, 상품명·브랜드·URL을 평가 파일에 넣지 않는다.

코드는 평가자의 실제 자격을 검증하지 않는다. 자격을 확인하지 못한 사람을 `stylist`로 기록하지 말고 `unknown` 또는 승인된 pilot group을 사용한다. repository의 합성 fixture는 schema와 metric 테스트 전용이며 전문가 평가가 아니다.

## 평가 전 준비

1. 평가자에게 dimension 정의와 1~5 anchor를 설명한다.
2. 실제 수집과 분리된 calibration round를 진행하고 애매한 사례의 용어만 맞춘다.
3. 본 평가 전 rubric version, target culture, target audience를 고정한다.
4. 평가 순서와 A/B 좌우 순서를 무작위화하고, 같은 코디를 같은 평가자에게 중복 노출하지 않는다.
5. 평가자는 토론 전에 독립적으로 기록한다. 토론 후에도 원래 disagreement를 삭제하거나 덮어쓰지 않는다.

## Context 확인

- `styleIntent`는 제공된 선언값을 사용한다. 이미지에서 임의 추정하지 않는다.
- `occasion`도 제공된 값을 사용한다.
- tuck, 아우터 착용, 여밈이 보이지 않거나 기록되지 않았으면 `unknown`이다.
- 개인 적합도는 코디 완성도 및 평가자 개인 취향과 분리한다.
- 환경 적합도는 제공된 계절·기온·강수·바람 문맥이 없으면 `not_enough_information`을 사용한다.
- 평가 전에 rubric의 `contextRequirements`를 확인한다. `required` context가 없으면 점수를 만들지 말고 `not_enough_information`을 사용한다.
- `bodyFitContext`가 `available`이 아니면 body-fit 적합도를 평가하지 않는다. 실제 치수나 선호 원문을 dataset에 복사하지 않는다.

## Observation input 확인

평가자는 rating 전에 실제로 본 입력을 확인한다. Image가 없을 때 `color_harmony`는 color features, `silhouette_balance`와 `proportion_coherence`는 shape features, `material_compatibility`는 material context가 있으면 평가할 수 있다. 다른 dimension은 rubric registry의 observation requirement를 그대로 따른다.

- Observation input이 없으면 evidence 배열을 비워 rating을 우회하지 말고 `not_enough_information`을 선택한다.
- Derived feature를 사용할 수 없는 경우 해당 `color.*` 또는 `shape.*` evidence code도 사용하지 않는다.
- Body fit, fit preference, exposure preference는 각각의 context availability를 먼저 확인한다.
- Pairwise dimension은 A와 B를 독립적으로 확인한다. 한쪽만 입력이 부족해도 comparable preference를 기록하지 않는다.
- Pairwise 전체 선호 `a`, `b`, `tie`는 두 코디 image가 모두 있을 때만 사용한다.
- `material.layering_weight_difference_observed`는 차이가 보였다는 중립 관찰이다. 지지 또는 충돌 방향은 배열 위치로 표현한다.

Rated dimension에 structured evidence가 없으면 warning이 기록된다. 초기 파일럿에서 evidence code가 어려운 지점을 찾기 위한 진단이며 점수나 전문가 자격을 자동 판정하지 않는다.

## Dimension 평가

각 dimension의 상세 정의는 [Fashion Expert Rubric](./fashion-expert-rubric.md)을 따른다. 평가 가능한 중립 상태는 3점이다. 다음은 점수를 만들지 않는다.

- 정보 부족: `not_enough_information`
- 해당 없음: `not_applicable`
- 판단 유보: `abstained`

confidence는 rating과 별개의 1~5 기록이다. 낮은 confidence를 높은 rating의 축소값으로 해석하거나 집계 가중치로 바로 사용하지 않는다.

## Evidence와 notes

관찰 feature를 확인한 뒤 선언된 의도를 지지하면 supporting, 충돌하면 conflicting 배열에 넣는다. 같은 feature도 context에 따라 방향이 달라질 수 있다. notes는 구조화 코드로 표현할 수 없는 짧은 설명에만 사용하며 개인정보, 링크, 로컬 경로, HTML을 넣지 않는다.

- `color.*`, `shape.*`는 제공된 derived feature를 읽은 경우에만 사용한다.
- `material.*`은 이미지 또는 허가된 상품 context에서 직접 관찰한 중립 특성이다. `similar`, `mixed`, `weight_contrast`만으로 supporting/conflicting 방향을 고정하지 않는다.
- `supports_declared_intent` 등 context interpretation은 관찰과 별개로 평가자가 정한 방향이다.

## Pairwise 평가

- 두 코디가 같은 context인지 먼저 확인한다.
- A, B, tie, not comparable 중 하나를 선택한다.
- `tie`는 비교 가능하지만 선호가 같은 경우다.
- `not_comparable`은 context나 정보 때문에 유효 비교를 할 수 없는 경우다.
- dimension별 선호는 전체 선호와 달라도 보존한다.
- A/B 순서를 뒤집은 비교는 stable pair key로 같은 pair임을 식별한다.
- Agreement는 `same_context`로 선언되고 실제 snapshot context와 rubric version이 같은 평가끼리만 계산한다. `different_context`와 `unknown` preference는 보존하되 agreement에서는 제외한다.

Pairwise 판단은 ranking 학습의 한 입력 형태지만 Phase 5A는 Bradley-Terry 같은 모델이나 professional score를 만들지 않는다. Pairwise preference를 특징과 함께 학습하는 방법의 한 예는 [Saha & Rajkumar (2024)](https://proceedings.mlr.press/v244/saha24a.html)이며, 이 논문의 가정을 현재 데이터에 그대로 적용하지 않는다.

## 수집과 품질 관리

- 평가 시간 `durationSeconds`를 기록한다. 5초 미만 또는 2시간 초과는 검토 warning이다.
- evaluator ID는 실명 대신 pseudonymous ID를 사용한다.
- 동일 evaluator + outfit + rubric 중복 absolute 평가를 금지한다.
- 동일 evaluator + stable pair + rubric 중복 pairwise 평가를 금지한다.
- rating median, unavailable 비율, confidence, exact/adjacent agreement, mean absolute difference, disagreement span을 함께 본다.
- 한 명의 평가는 consensus로 부르지 않는다.
- disagreement가 큰 outfit을 삭제하지 않고 재검토 목록으로 남긴다.

[Artstein & Poesio (2008)](https://aclanthology.org/J08-4004/)가 설명하듯 agreement 계수는 데이터 유형과 결측 정책에 대한 가정을 가진다. weighted kappa, alpha, ICC 등은 공식 정의·reference test·ordinal weight·결측 정책을 갖추기 전 구현하지 않는다.

## Blind evaluation과 bias

- 가능한 경우 추천 엔진 이름, 기존 점수, 브랜드, 상품명을 숨긴다.
- A/B 위치와 노출 순서를 균형 있게 무작위화한다.
- 평가자별 평균 rating 차이는 bias 진단값이지 사람을 제외하는 자동 기준이 아니다.
- 문화권, 스타일 교육 배경, 유행 시점에 따른 차이를 dataset metadata와 분석 계획에 기록한다.
- 독립 평가 후의 합의 토론은 별도 revision record로 다루고 원본을 보존한다.

## Split과 leakage

같은 `outfitId`, 핵심 item 조합, source look 또는 촬영 세트가 train과 test에 함께 들어가지 않게 그룹 단위로 분리한다. 현재 schema는 `outfitGroupId`와 `compositionGroupKey`, deterministic seed와 algorithm version을 저장할 수 있다. [Datasheets for Datasets](https://arxiv.org/abs/1803.09010)은 수집 목적·구성·사용 제한을 문서화할 필요를 제안하며, [DataSAIL](https://www.nature.com/articles/s41467-025-58606-8)은 관련 표본의 무작위 분리가 성능 평가를 부풀릴 수 있음을 다룬다. Phase 5A는 그룹의 split 중복을 error로 처리하지만 실제 전문가 데이터를 자동 분할하지 않는다.

## 개인정보와 이미지 권한

평가 dataset에는 이미지 URI, 상품 URL, 상품명, 브랜드, 사용자 이름, 이메일, 전화번호, 로컬 경로, 신체 치수 원문을 넣지 않는다. item ID는 외부에 salt를 저장하지 않는 로컬 one-way anonymizer로 바꾼다. 데이터는 CLI에서 로컬로만 읽고 쓰며 네트워크 전송 기능은 없다.

이미지는 권한이 확인된 자료만 별도 통제 저장소에서 사용한다. repository fixture에는 사용자 이미지가 없다. 보존 기간, 접근 권한, 동의 철회, 원본 이미지와 익명 평가의 폐기 절차는 pilot 전에 책임자가 문서화해야 한다. 코드가 이미지 사용 권한이나 전문가 자격을 자동 보장하지 않는다.

## 사용 범위

Phase 5A 결과는 rubric과 수집 절차를 검증하기 위한 오프라인 자료다. 운영 추천, UI, cache, telemetry에 연결하지 않으며 전문가 검증 완료나 사용자 품질 향상을 주장하는 근거로 쓰지 않는다.
