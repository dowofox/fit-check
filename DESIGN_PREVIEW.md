# NAES UI/UX Design Preview

이 문서는 운영 화면을 바꾸기 전에 네 가지 디자인 방향을 같은 데이터로
비교하기 위한 시안 설명서다. 프리뷰는 고정 mock data만 사용하며
`AsyncStorage`, 저장 코디, 프로필, 실제 추천 결과를 읽거나 쓰지 않는다.

## 현재 UI 조사

확인 범위:

- 앱 루트와 탭 화면
- 홈, 옷장, 코디 허브, 코디 추천, 저장 코디와 기록
- 옷 추가, 옷 상세, 프로필
- `BottomNav`, 공통 테마, 로딩/오류/빈 상태
- 전역 옷장 분석 진행 배너

주요 사용성 문제:

1. 화면별 제목 크기와 상단 여백이 달라 이동할 때 리듬이 흔들린다.
2. 옷 상세와 옷 추가 화면은 분석 정보와 행동이 한 화면에 많이 노출되어
   사용자가 다음 행동을 찾기 어렵다.
3. 여러 카드가 같은 시각적 무게를 가져 주 행동과 보조 행동의 구분이 약하다.
4. 추천 결과는 정보가 충분하지만 이유, 주의점, 대안, 저장 행동이 한꺼번에
   보이면 옷 이미지보다 정보가 먼저 들어온다.
5. 옷장은 아이템 수가 늘어날수록 필터, 검색, 정렬, 다중 선택의 관계를
   더 명확히 보여줄 필요가 있다.
6. 로딩, 오류, 재시도, 분석 진행 상태는 기능적으로 잘 분리되어 있다.
   새 디자인에서도 이 복구 흐름은 유지해야 한다.
7. 화면마다 같은 행동이 카드, pill, 큰 버튼 등으로 다르게 표현되는 구간이
   있어 버튼 계층을 공통 규칙으로 정리할 필요가 있다.

## Preview Routes

- `/design-preview`
- `/design-preview/warm-editorial`
- `/design-preview/clean-minimal`
- `/design-preview/soft-utility`
- `/design-preview/dark-fashion`

쿼리:

- `screen=home|closet|readiness|ready|result|add|detail|profile`
- `standalone=1`: 비교 패널 없이 모바일 화면만 표시

각 시안의 화면 안 버튼은 프리뷰 화면 사이만 이동한다. 실제 라우트, API,
저장소에는 연결되지 않는다.

## A. Warm Editorial

패션 매거진과 편집숍의 여백, 큰 상품 이미지, 크림과 브라운을 사용한다.
홈은 추천 룩을 화보처럼 먼저 보여주고, 옷장은 여유 있는 2열 그리드를
사용한다. 준비 부족 상태는 장식이 아닌 큰 숫자와 짧은 문장으로 읽힌다.

- Palette: cream `#F3EDE5`, paper `#FFFDF9`, brown `#79563D`,
  charcoal `#251D17`
- Radius: 카드 22, 이미지 16, 버튼 10
- Spacing: 넓은 섹션 간격, 카드 수 최소화
- Type: 큰 에디토리얼 제목 + 작은 캡션
- Icon: 얇은 Feather line icon
- Shadow: 4% 이하의 매우 약한 그림자
- Image: 큰 4:5 또는 넓은 룩 이미지
- Button: 짙은 브라운 primary, paper secondary
- Input/filter: 밑줄 또는 낮은 테두리, 둥근 chip

장점은 패션 앱다운 인상과 이미지 몰입도다. 단점은 옷이 100벌 이상일 때
Clean Minimal보다 탐색 밀도가 낮다는 점이다.

## B. Clean Minimal

흰색, 옅은 회색, 검정 텍스트와 블루 한 가지 강조색을 사용한다. 카드보다
선과 정렬을 우선하며, 옷장은 3열 고밀도 그리드로 구성한다. 상세 화면도
레이블과 값의 구조가 가장 분명하다.

- Palette: gray `#F5F6F7`, white `#FFFFFF`, blue `#1F5FCC`,
  black `#111419`
- Radius: 카드 10, 이미지 6, 버튼 6
- Spacing: 조밀하지만 44px 터치 영역 유지
- Type: 중간 크기 제목, 높은 본문 대비
- Icon: 1.5px 느낌의 Feather icon
- Shadow: 사용하지 않고 border로 구분
- Image: 정사각 고밀도 thumbnail
- Button: blue filled, outline secondary
- Input/filter: 사각형에 가까운 field, segmented filter

장점은 많은 옷의 관리와 긴 정보의 가독성이다. 단점은 이미지와 고유한
타이포그래피가 약해지면 일반 관리 앱처럼 보일 위험이 있다.

## C. Soft Utility

세이지와 흰색을 기반으로 준비도, 분석 진행률, 다음 행동을 대시보드처럼
보여준다. 처음 사용하는 사용자가 “왜 아직 추천하지 않는지”와 “무엇을
추가해야 하는지”를 가장 빨리 이해할 수 있는 안이다.

- Palette: sage `#EDF3EF`, white `#FFFFFF`, green `#39745A`,
  ink `#17231B`
- Radius: 카드 22, 이미지 18, 버튼 16
- Spacing: 상태 단위의 중간 간격
- Type: 친절한 짧은 제목 + 명확한 수치
- Icon: Feather icon을 상태 원 안에 사용
- Shadow: 3.5% 이하, border와 함께 사용
- Image: 2열 thumbnail과 상태 카드 병행
- Button: green filled, muted sage secondary
- Input/filter: 큰 field, 상태가 보이는 rounded chip

장점은 온보딩과 상태 전달이다. 단점은 둥근 카드와 색상을 늘리면 어린
느낌이 날 수 있으므로 생산 적용 시 카드 수를 제한해야 한다.

## D. Dark Fashion

검정과 차콜 위에 큰 이미지, 대문자 타이포그래피, 골드 한 가지 강조색을
사용한다. 추천 결과는 룩북처럼 이미지가 먼저 보이며, 홈도 화보형이다.
관리 화면은 명확한 카드 경계와 충분한 대비를 유지한다.

- Palette: black `#0B0C0E`, charcoal `#17191C`, gold `#D1A05C`,
  ivory `#F4F0E9`
- Radius: 카드 14, 이미지 8, 버튼 8
- Spacing: 이미지에는 넓게, 관리 목록에는 조밀하게
- Type: 강한 display title + 고대비 body
- Icon: ivory/gold Feather icon
- Shadow: 사용하지 않고 surface 단계로 구분
- Image: full-bleed 또는 큰 세로형
- Button: gold primary, charcoal secondary
- Input/filter: 어두운 surface, 선명한 focus border

장점은 추천 결과의 몰입도와 개성이다. 단점은 긴 설명과 장시간 옷장
관리에서 피로도가 가장 높고, 접근성 검증 범위도 가장 크다.

## Comparison

| 기준 | A Warm Editorial | B Clean Minimal | C Soft Utility | D Dark Fashion |
| --- | --- | --- | --- | --- |
| 전체 분위기 | 편집숍, 따뜻함 | 정돈, 효율 | 친절한 대시보드 | 룩북, 강한 개성 |
| 가독성 | 높음 | 가장 높음 | 높음 | 중간 |
| 옷장 관리 | 중간 | 가장 좋음 | 좋음 | 중간 |
| 추천 몰입도 | 매우 좋음 | 좋음 | 좋음 | 가장 좋음 |
| 초보 친화성 | 중간 | 높음 | 가장 높음 | 낮음 |
| 구현 난이도 | 중간 | 낮음 | 중간 | 높음 |
| 기존 컴포넌트 재사용 | 높음 | 높음 | 중간 | 낮음 |
| 접근성 | 높음 | 가장 높음 | 높음 | 추가 검증 필요 |
| 100벌 이상 | 2열 밀도 한계 | 3열과 필터에 유리 | 상태 안내에 유리 | 긴 탐색 피로 |
| 장기 피로도 | 낮음 | 가장 낮음 | 낮음 | 상대적으로 높음 |
| 작은 Android | 여백 축소 필요 | 가장 안정적 | 카드 줄바꿈 확인 | 큰 타이포 축소 필요 |
| 주요 위험 | 명도 차 부족 | 개성 부족 | 카드 과다 | 대비와 긴 글 |

추천 순위는 C, A, B, D다. C는 등록 직후부터 추천 준비까지의 핵심
제품 흐름을 가장 명확하게 설명하고, A는 NAES의 패션 정체성을 가장
자연스럽게 이어간다. 최종 선택은 사용자 비교 후 결정한다.

## Recommendation Readiness

준비도는 추천 점수 및 다양화와 별도의 순수 함수로 관리한다.

기본 기준:

- 추천 가능한 상의 3벌
- 추천 가능한 하의 3벌
- 상의 x 하의 핵심 조합 6개
- 신발 2켤레 권장
- 아우터 1벌 권장

계산에서 제외:

- `isClosetItemAvailableForRecommendation()`이 제외하는 옷
- 보관된 옷
- 분류, 색상, 계절 등 검토가 끝나지 않은 옷
- 현재 계절 또는 명확한 기온 조건에 맞지 않는 옷

`getOutfitRecommendationReadiness(items, currentSeason, weather)`는 전체
준비도와 현재 조건 준비도를 함께 반환한다. 신발과 아우터 부족은 진행
상태로 표시하지만 추천을 차단하지 않는다.

예상 동작:

1. 상의 1, 하의 2, 핵심 조합 2: `not_enough_tops`
2. 상의 3, 하의 2: `not_enough_bottoms`
3. 상의와 하의 수는 충족하지만 유효 핵심 조합이 6 미만:
   `not_enough_core_combinations`
4. 전체는 충족하지만 현재 계절 후보가 부족:
   `not_enough_season_items`
5. 상의 3, 하의 3, 핵심 조합 9: `ready`

구현 단계:

1. 디자인 선택 후 홈과 코디 진입부에 동일 helper를 연결한다.
2. 준비 부족이면 추천 후보 생성을 실행하지 않고 준비 화면으로 이동한다.
3. 준비 완료이면 기존 추천 엔진을 그대로 실행한다.
4. 추천 엔진의 70점 노출 기준, 저장 코디 제외, 상황 적합도는 그대로 둔다.

## Duplicate Recommendation Review

현재 추천 엔진은 다음 책임을 이미 나누어 처리한다.

- 전체 item id key로 저장 코디 제외
- 상의, 하의, 신발 core key로 대표 추천 중복 제거
- 같은 core key를 alternative에 넣지 않음
- 상의, 하의, 신발이 결과 5개에서 과도하게 반복되지 않도록 사용 횟수 제한
- alternative도 품질 기준을 통과한 서로 다른 전체 조합과 core 조합만 허용

준비도 helper는 이 로직을 변경하지 않는다. 옷이 적을 때 추천 실행 자체를
막는 책임과, 옷이 충분할 때 좋은 추천을 다양화하는 책임을 분리한다.

## Production Migration After Selection

1. 선택된 시안의 토큰만 `utils/theme.ts`로 승격한다.
2. 공통 header, button, card, chip, empty state부터 교체한다.
3. 홈과 추천 준비 흐름을 먼저 적용한다.
4. 옷장, 추천 결과, 옷 추가, 상세, 프로필 순으로 한 화면씩 전환한다.
5. 각 화면에서 기존 loading/error/retry/storage 동작을 회귀 테스트한다.
6. 모든 화면 전환이 끝난 뒤 preview route 제거 여부를 결정한다.

이번 단계에서는 운영 테마, 운영 화면, `BottomNav`, 저장 데이터와 추천
실행 흐름을 변경하지 않는다.
