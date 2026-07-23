# NAES UI/UX Design Preview

이 문서는 운영 화면을 바꾸기 전에 네 가지 디자인 방향과 선택형 하이브리드를 같은 데이터로
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
- `/design-preview/editorial-noir`
- `/design-preview/guided-flow`
- `/design-preview/visual-journal`
- `/design-preview/quiet-system`

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

## E. Editorial Noir

사용자가 선택한 A와 D의 조합안이다. Warm Editorial을 약 70%의 기본
레이어로 사용하고, Dark Fashion의 검정 면과 골드 포인트를 약 30%의
강조 레이어로 제한한다. 홈 히어로, 추천 준비도, 추천 결과처럼 감정적
몰입이 필요한 구간은 룩북처럼 선명하게 만들고, 옷장·상세·프로필처럼
오래 읽고 관리하는 화면은 따뜻한 종이색 배경과 흰 카드로 유지한다.

- Palette: warm beige `#F2EBE2`, paper `#FFFDF8`, noir `#17181A`,
  gold `#D5A55F`
- Radius: 카드 20, 이미지 12, 강조 영역 14, 버튼 10
- Spacing: A의 여백을 유지하되 관리 화면은 조금 더 조밀하게 구성
- Type: 에디토리얼 제목 + 작은 edition label + 읽기 쉬운 본문
- Icon: 검정/브라운 Feather line icon, 강조 면에서는 ivory
- Shadow: 3.5% 이하, 대부분 border와 surface 차이로 구분
- Image: 홈과 결과는 큰 이미지, 옷장과 상세는 정돈된 상품 이미지
- Button: noir primary, warm paper secondary, gold는 상태 badge에만 사용
- Input/filter: 따뜻한 흰색 field와 낮은 베이지 chip

핵심 원칙은 “화면 전체를 어둡게 만들지 않는다”다. 검정은 선택과 결과를
강조할 때만 사용하고, 긴 설명이나 반복 관리 영역에는 사용하지 않는다.

## Comparison

| 기준 | A Warm Editorial | B Clean Minimal | C Soft Utility | D Dark Fashion | E Editorial Noir |
| --- | --- | --- | --- | --- | --- |
| 전체 분위기 | 편집숍, 따뜻함 | 정돈, 효율 | 친절한 대시보드 | 룩북, 강한 개성 | 따뜻한 룩북 |
| 가독성 | 높음 | 가장 높음 | 높음 | 중간 | 높음 |
| 옷장 관리 | 중간 | 가장 좋음 | 좋음 | 중간 | 좋음 |
| 추천 몰입도 | 매우 좋음 | 좋음 | 좋음 | 가장 좋음 | 가장 좋음 |
| 초보 친화성 | 중간 | 높음 | 가장 높음 | 낮음 | 중간 |
| 구현 난이도 | 중간 | 낮음 | 중간 | 높음 | 중상 |
| 기존 컴포넌트 재사용 | 높음 | 높음 | 중간 | 낮음 | 높음 |
| 접근성 | 높음 | 가장 높음 | 높음 | 추가 검증 필요 | 높음 |
| 100벌 이상 | 2열 밀도 한계 | 3열과 필터에 유리 | 상태 안내에 유리 | 긴 탐색 피로 | 2열 관리에 적합 |
| 장기 피로도 | 낮음 | 가장 낮음 | 낮음 | 상대적으로 높음 | 낮음 |
| 작은 Android | 여백 축소 필요 | 가장 안정적 | 카드 줄바꿈 확인 | 큰 타이포 축소 필요 | 360px 검증 완료 |
| 주요 위험 | 명도 차 부족 | 개성 부족 | 카드 과다 | 대비와 긴 글 | 검정 강조 면 과다 |

E Editorial Noir는 A와 D를 결합한 1차 하이브리드다. 비교 결과 색과
표현은 달라졌지만 기존 카드 중심 구조에서 충분히 벗어나지 못해 최종
후보로 확정하지 않았다.

## Second Round: Structure First

두 번째 비교는 색상보다 정보 구조를 먼저 바꾼 세 가지 방향이다. 모두
첫 화면에서 `오늘 코디 찾기`와 `새 상품 핏 보기`를 가장 먼저 노출하고,
AI 점수나 내부 분석값은 보여주지 않는다.

### F. Guided Flow

처음 쓰는 사용자가 다음 행동을 잃지 않도록 단계와 완료 상태를 명확하게
보여준다. 홈은 두 가지 핵심 행동, 추천까지 3단계, 오늘의 미리보기 순으로
구성한다. 추천 준비 화면은 체크리스트가 아니라 세로 진행 흐름으로 읽힌다.

- 강점: 가장 쉬운 첫 사용, 명확한 다음 행동, 친절한 빈 상태
- 위험: 안내 요소를 늘리면 온보딩 앱처럼 보일 수 있음
- 적합 화면: 홈, 추천 준비, 옷 추가

### G. Visual Journal

큰 룩 이미지와 짧은 문장을 먼저 보여주고 정보는 저널의 페이지처럼
이어진다. 홈의 두 선택지를 이미지 아래에 바로 배치해 사진 중심이지만
행동이 숨지 않게 했다. 추천 결과는 이미지와 이유를 별도 영역으로 나눈다.

- 강점: 가장 패션 브랜드다운 인상, 높은 추천 몰입도
- 위험: 옷이 많을 때 관리 화면의 밀도 조절 필요
- 적합 화면: 홈, 추천 결과, 저장 코디

### H. Quiet System

카드 대신 선, 번호, 행 구조로 두 가지 핵심 행동과 옷장 상태를 보여준다.
초보자도 메뉴 이름을 해석하지 않고 문장형 행동을 선택할 수 있고, 옷이
많아져도 목록 밀도를 유지하기 쉽다.

- 강점: 가장 빠른 탐색, 작은 화면 안정성, 장기 사용 피로가 낮음
- 위험: 이미지 비중이 줄면 일반 관리 앱처럼 보일 수 있음
- 적합 화면: 옷장, 프로필, 상품 정보

| 기준 | F Guided Flow | G Visual Journal | H Quiet System |
| --- | --- | --- | --- |
| 첫 사용 이해도 | 가장 높음 | 높음 | 높음 |
| 패션 브랜드 인상 | 중상 | 가장 높음 | 중간 |
| 행동 발견 속도 | 가장 빠름 | 빠름 | 가장 빠름 |
| 옷장 확장성 | 좋음 | 중간 | 가장 좋음 |
| 추천 몰입도 | 높음 | 가장 높음 | 중상 |
| 장기 사용 피로 | 낮음 | 중간 | 가장 낮음 |
| 주요 구조 | 단계형 | 이미지 저널형 | 번호·목록형 |

세 안의 8개 화면은 390px에서 시각 검토했고, 360px에서 페이지 가로
넘침이 없음을 확인했다. 옷장 카테고리 필터는 의도적으로 가로 스크롤한다.

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

선택 방향은 **F. Guided Flow**다. 처음 사용하는 사람도 메뉴를 해석하지
않고 `오늘 코디 찾기`와 `새 상품 핏 보기`부터 선택할 수 있는 구조를
운영 화면의 기준으로 사용한다.

진행 상태:

1. F의 색상, radius 토큰을 `utils/theme.ts`로 승격했다.
2. 홈을 두 가지 핵심 행동, 추천까지 3단계, 오늘의 미리보기 순으로
   재구성했다.
3. 코디 허브를 실제 옷장 준비도와 다음 행동이 보이는 단계형 화면으로
   전환했다.
4. `BottomNav`는 기능과 경로를 유지하며 F의 낮은 대비와 활성 상태를
   적용했다.
5. 추천 엔진, 저장 데이터, 날씨 추천, 로딩/오류/재시도 흐름은 변경하지
   않았다.

다음 전환은 옷장, 추천 결과, 옷 추가, 상세, 프로필 순으로 한 화면씩
진행한다. 각 단계에서 기존 기능의 회귀 테스트와 360px 작은 화면 검증을
통과한 뒤 다음 화면으로 이동한다.
