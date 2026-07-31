# Fashion Compatibility Research Questions

## Phase 4A 이후 shape 검증 질문

1. 공급처별 `chest`, `waist`, `hip`, `thigh`, `hem`은 언제 단면이고 언제 둘레인가?
2. 상품 총장과 하의 rise subtype을 ISO 18890 측정 지점에 어떻게 검증해 매핑할 것인가?
3. 상의 기장과 하의 밑위·총장 관계에서 tuck 여부를 모르면 어떤 feature를 보류해야 하는가?
4. 신발 visual weight를 이미지 또는 구조화 상품 정보로 재현 가능하게 평가하는 기준은 무엇인가?
5. structure와 drape의 관찰자 간 agreement가 충분한 rubric은 무엇인가?
6. 아우터 포함 착장에서 실제로 보이는 안쪽 상의와 layer coverage를 어떻게 기록할 것인가?
7. 사용자 키 대비 상의 기장과 선호 바지 총장 대비 하의 기장을 어떤 별도 feature로 유지할 것인가?
8. 체형 적합성과 착장 자체의 shape 조화를 전문가 평가에서 어떻게 분리할 것인가?
9. style intent별 volume·length 관계 허용 범위를 어떤 blind set으로 검증할 것인가?
10. professional shape score를 만들기 위한 최소 전문가 수, anchor, agreement 기준은 무엇인가?
11. 자동 추출 실측과 사용자 직접 입력 실측의 provenance를 migration 없이 어떻게 보존할 것인가?
12. `rise`가 앞밑위인지 전체 밑위인지 알 수 없을 때 어떤 계산을 차단해야 하는가?

## 목적

현재 코드만으로 답할 수 없는 질문을 명시해, 근거 없는 숫자를 더 추가하지 않기 위한 목록이다. 우선순위는 운영 위험, 제품 핵심 가치, 데이터 취득 가능성 순이다.

## P0: 전문가에게 먼저 확인할 질문

### 평가 기준

1. “좋은 코디”를 color, silhouette, proportion, material, style, occasion으로 나누는 rubric이 실제 스타일링 업무에 충분한가?
2. 각 dimension을 5점 또는 7점 척도로 평가할 때 anchor 예시는 무엇인가?
3. overall compatibility는 dimension의 가중합인가, 최저 dimension의 cap을 받는가?
4. 명백한 실패와 단순 취향 차이를 어떻게 구분하는가?
5. hard block으로 볼 수 있는 패션 규칙이 존재하는가, 아니면 온도·안전만 hard block이어야 하는가?
6. 같은 코디를 상황과 스타일 의도 없이 평가할 수 있는가?
7. 전문가 간 불일치를 최종 label, 분포, 다중 정답 중 어떤 형태로 보존해야 하는가?

### 실루엣·비율

1. cropped+wide, oversized+wide, loose+slim은 어떤 조건에서 긍정·중립·부정인가?
2. tuck 여부와 밑위가 상·하의 길이비 판단에 얼마나 중요한가?
3. 상의 길이와 하의 밑위·총장 중 비율 판단의 핵심 측정치는 무엇인가?
4. visual weight를 전문가가 일관되게 평가할 수 있는 관찰 항목은 무엇인가?
5. structure와 drape를 사진 또는 상품 실측만으로 판단할 때 최소 근거는 무엇인가?
6. 아우터 포함 시 안쪽 상의와 하의 비율을 어떻게 재평가하는가?
7. 신발의 volume과 팬츠 hem 관계를 어떤 taxonomy로 기록해야 하는가?
8. 체형 적합성과 코디 자체의 조화를 평가자가 명확히 분리할 수 있는가?

### 색상

1. 색상 조화 평가에 필요한 최소 정보는 대표색, 면적, 명도, 채도, hue 중 무엇인가?
2. 톤온톤과 “색이 너무 비슷함”을 구분하는 정량 조건을 정의할 수 있는가?
3. 무채색 조합이 항상 안정적이라는 현재 가정의 예외는 무엇인가?
4. 포인트 색의 허용 개수보다 면적 비율이 더 중요한가?
5. 패턴, 로고, 신발색은 전체 색 면적에서 어떻게 가중해야 하는가?
6. 상황·문화권·시즌에 따라 색 조화 기준을 분리해야 하는가?

Phase 3A 이후 추가 검토:

7. 어떤 명도 대비가 미니멀·스트릿·포멀 등 각 style intent에서 선호되는가?
8. 무채색 코디를 안정적이라고 평가할 때 소재 광택·질감·실루엣을 어떻게 함께 평가하는가?
9. 비슷한 hue의 톤온톤과 단순히 구분이 어려운 저대비를 어떤 rubric으로 나누는가?
10. 포인트 색상은 개수보다 실제 면적을 우선해야 하는가? 상황별 허용 면적은 어떻게 검증하는가?
11. 패턴 안의 주색·보조색·작은 로고색은 palette와 pairwise 관계에 어떤 비율로 포함하는가?
12. 문화권·성별 표현·유행 시점에 따른 색 평가 편향을 benchmark에서 어떻게 분리하는가?
13. 전문가 평가 rubric의 anchor와 최소 평가자 agreement는 무엇이어야 하는가?
14. 관측 가능한 색상 조화와 개인 색상 선호를 별도 label로 어떻게 수집하는가?

### 소재·상황

1. 표면 질감, 광택, 두께, drape 중 소재 궁합에 가장 중요한 feature는 무엇인가?
2. 데님+데님, stiff+stiff, leather+formal 조합의 긍정적 예외는 무엇인가?
3. 데이트·깔끔한·데일리·편안한 상황 taxonomy가 충분한가?
4. 상황 적합성과 스타일 취향을 평가에서 어떻게 분리하는가?

## P0: 표준·논문 조사가 필요한 질문

1. CIELAB/CIEDE2000을 의류 사진의 조명 변화에 적용할 때 필요한 color calibration은 무엇인가?
2. 의류 segmentation과 dominant palette 추출에 공개적으로 재현 가능한 최신 benchmark가 있는가?
3. 패턴 내부 색과 단색 면적을 함께 표현하는 검증된 feature는 무엇인가?
4. ISO 18890 실측 지점을 NAES의 현재 `ProductSizeMeasurement`와 어떻게 정확히 매핑할 것인가?
5. garment ease, body measurement, finished garment measurement를 함께 쓰는 검증된 fit model은 무엇인가?
6. outfit compatibility 논문의 Polyvore 계열 데이터가 한국 사용자와 현재 NAES 카테고리에 얼마나 전이 가능한가?
7. type-aware, pairwise, outfit-level model 중 작은 개인 옷장에 적합한 구조는 무엇인가?
8. 전문가 diagnosis와 사용자 설명의 faithful explanation을 어떻게 검증하는가?
9. 학습 데이터의 item leakage를 막는 split 방식과 최소 benchmark는 무엇인가?
10. 모델 confidence calibration에 적합한 지표와 방법은 무엇인가?

## P1: 현재 코드만으로 답할 수 없는 질문

1. chest 62cm를 oversized volume 8로 보는 기준이 카테고리와 사이즈에 무관하게 유효한가?
2. 상의 총장 58/75cm, 하의 총장 90/105cm threshold의 근거는 무엇인가?
3. visualWeight 차이 2 또는 6이 실제 전문가 판단과 일치하는가?
4. 포인트 아이템 2개부터 감점하는 것이 style intent와 무관하게 유효한가?
5. dark-dark를 답답하다고 보는 규칙이 원단 광택과 명도 차이를 무시해도 되는가?
6. matchColors +2, avoidColors -4의 비대칭이 적절한가?
7. detail/material 보정 -12~+8과 warning penalty가 중복되지 않는가?
8. 실측 source 0개 최대 82, 1개 최대 88이 실제 정확도와 calibration되는가?
9. 이유 3개 미만 최대 78이 코디 품질이 아니라 설명 생성량을 평가하는 문제는 없는가?
10. 프로필 UI의 bodyType과 추천 조건의 “상체 발달/하체 발달” taxonomy 중 무엇이 제품 정책인가?
11. style tag가 없을 때 `데일리`를 주입하는 것이 중립 fallback인가?
12. temperature score 25와 fashion compatibility 75의 상대 비율이 제품 목적에 맞는가?

## P1: 실제 사용자 데이터가 필요한 질문

1. 홈 추천을 본 사용자가 어떤 코디를 선택·저장·교체하는가?
2. `like`와 `less`가 미적 호환성, 개인 취향, 날씨, 반복 노출 중 무엇을 뜻하는가?
3. 추천한 코디를 실제로 입었는지, 일부 아이템만 바꿨는지 알 수 있는가?
4. 사용자가 자주 바꾸는 카테고리는 상의, 하의, 신발, 아우터 중 무엇인가?
5. 추천을 거절한 이유를 최소한의 선택지로 수집할 수 있는가?
6. 작은 옷장에서 “추천 없음”과 낮은 품질 추천 중 무엇이 신뢰를 높이는가?
7. 사용자별로 silhouette, color, occasion 선호가 얼마나 안정적인가?
8. cold start에서 기준 옷과 프로필 치수 중 어느 정보가 더 큰 개선을 만드는가?
9. 실제 착용 이력과 저장 이력의 의미 차이는 무엇인가?
10. 개인화가 다양성을 줄이거나 같은 옷 반복을 만드는 시점은 언제인가?

수집 시 필요한 보호:

- 명시적 동의
- 목적 제한
- 삭제·내보내기
- 이미지 URI와 개인 치수의 비식별화
- shadow 로그의 짧은 보존 기간
- 학습용과 제품 진단용 데이터 분리

## P1: 전문가 평가 데이터 설계 질문

1. 최소 평가자 수와 필요한 outfit 수는 얼마인가?
2. category·style·occasion별 최소 표본을 어떻게 정할 것인가?
3. 같은 아이템이 train/test에 동시에 나타나는 leakage를 어떻게 막을 것인가?
4. 평가자 confidence를 label aggregation에 어떻게 반영할 것인가?
5. disagreement가 큰 outfit을 제외할지 어려운 사례로 별도 보존할지 결정해야 한다.
6. 문화권, 시즌, 성별 표현, 체형, 연령의 대표성을 어떻게 확보할 것인가?
7. 브랜드 룩북과 사용자 코디의 상업적·선택 편향을 어떻게 측정할 것인가?
8. 전문가 평가자의 style school 차이를 metadata로 남길 것인가?
9. positive outfit만 있는 데이터에서 realistic negative를 어떻게 만들 것인가?
10. 모델이 색·style shortcut만 학습하지 않았는지 어떤 counterfactual set으로 확인할 것인가?

## P2: 구현 전 결정할 질문

1. 새 knowledge base는 TypeScript 정적 table, JSON, 서버 관리 중 무엇이 review와 rollback에 가장 안전한가?
2. rule version을 추천 cache key에 포함해야 하는 시점은 언제인가?
3. color/shape profile을 로컬 저장할지 서버에서 필요할 때 계산할지 결정해야 한다.
4. profile 추출 실패와 낮은 confidence를 UI에 어느 정도 노출할 것인가?
5. shadow 결과를 로컬 진단으로만 볼지 익명 telemetry를 허용할지 결정해야 한다.
6. learned model을 on-device, server, batch 중 어디에서 실행할 것인가?
7. unsupported category와 새 taxonomy는 어떤 fallback을 사용할 것인가?
8. 전문가 rule과 learned model이 충돌할 때 어느 쪽이 score cap을 결정하는가?
9. rule metadata confidence와 입력 source confidence를 어떤 calibration 절차로 검증하고 결합할 것인가?
10. detailCategory와 소재가 같은 신호를 중복 적용한 evidence를 언제 하나의 exclusive rule group으로 합칠 것인가?
11. 상황·개인화·환경 evidence를 수집할 때 item ID를 로컬 진단에만 둘지 익명화할지 어떤 보존 정책을 적용할 것인가?

## 권장 조사 순서

1. 전문가 rubric과 실패/취향 경계
2. 실측·shape feature 정의
3. color profile과 이미지 품질 요구사항
4. 현재 heuristic에 대한 blind expert benchmark
5. shadow knowledge engine
6. 사용자 선택·교체 데이터
7. learned compatibility

## 근거 관리 규칙

- 공식 표준, peer-reviewed 논문, 검증 가능한 학회 논문을 우선한다.
- 블로그, 검색 요약, 마케팅 문구, 단일 인플루언서 취향은 score 근거로 쓰지 않는다.
- 논문이 존재하는지와 NAES 사용자에게 적용 가능한지는 별도 질문이다.
- citation은 rule ID와 연결하고, 문서의 제목·버전·URL을 기록한다.
- 출처가 없으면 `temporary_heuristic`으로 남긴다.
- 전문가 합의는 평가자 수, rubric version, agreement와 함께 기록한다.
- 연구 결과를 새 점수 숫자로 옮기기 전에 shadow comparison과 rollback 계획을 만든다.

## 현재 참고 가능한 자료

- [ISO 8559-1:2017: anthropometric definitions](https://www.iso.org/standard/61686.html)
- [ISO 8559-2:2025: clothing size designation](https://www.iso.org/standard/85590.html)
- [ISO 18890:2018: garment measurement](https://www.iso.org/standard/63693.html)
- [CIE 015:2018 Colorimetry](https://www.cie.co.at/publications/colorimetry-4th-edition)
- [ISO/CIE 11664-4:2019: CIELAB](https://www.cie.co.at/publications/colorimetry-part-4-cie-1976-lab-colour-space-1)
- [ISO/CIE 11664-6:2022: CIEDE2000](https://www.cie.co.at/publications/colorimetry-part-6-ciede2000-colour-difference-formula-1)
- [CIEDE2000 implementation test data](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/)
- [Learning Type-Aware Embeddings for Fashion Compatibility](https://arxiv.org/abs/1803.09196)
- [Outfit Compatibility Prediction and Diagnosis](https://arxiv.org/abs/1907.11496)
- [Fashion Recommendation and Compatibility Prediction Using Relational Network](https://arxiv.org/abs/2005.06584)
- [Learning Color Compatibility in Fashion Outfits](https://arxiv.org/abs/2007.02388)
- [Krippendorff’s alpha](https://journal.r-project.org/articles/RJ-2021-046/)

이 목록은 조사 시작점이다. 개별 NAES 점수 숫자를 검증한 자료 목록이 아니다.
