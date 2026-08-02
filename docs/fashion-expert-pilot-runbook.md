# Fashion Expert Absolute Evaluation Pilot Runbook

> **Local research tool. Draft rubric. Not a production score.**

이 도구는 `expert-rubric-draft-v0.3`의 13개 dimension을 한 코디씩 절대평가하고 기존 `expert-dataset-v1` JSON에 평가를 추가한다. 운영 추천, 앱 UI, 사용자 저장소와 연결되지 않으며 pairwise 평가나 professional score를 만들지 않는다.

## 준비물

1. `fashion:expert:validate`를 통과하는 expert dataset JSON
2. 이미지가 있는 snapshot만 로컬 파일에 연결한 asset manifest
3. 실명이나 이메일이 아닌 pseudonymous evaluator ID

평가 이미지 경로는 dataset에 넣지 않는다. 별도 asset manifest만 로컬 경로를 가지며 output에는 경로, 이미지 base64, 상품명, 브랜드, URL을 기록하지 않는다.

```json
{
  "schemaVersion": "expert-pilot-assets-v1",
  "outfits": {
    "outfit-001": {
      "images": ["C:/approved-pilot-assets/outfit-001.png"]
    }
  }
}
```

- 허용 형식: JPEG, PNG, WebP
- 파일당 최대 크기: 15MB
- 확장자와 실제 image signature가 일치해야 한다.
- symlink, 중복 경로, 등록되지 않은 outfit, dataset과 불일치하는 image availability는 거부한다.
- 상대 경로는 repository 내부에서만 허용한다. 외부 자산은 절대 경로를 사용한다.

Repository의 `scripts/fixtures/fashion-expert-pilot-assets.json`은 synthetic dataset과 design-preview 이미지를 연결하는 개발용 예시다. 실제 전문가 파일럿 데이터로 사용하지 않는다.

## 실행

평가를 시작하기 전에 dataset snapshot과 실제 이미지 바이트를 하나의 배치로 고정한다. 잠금 파일에는 로컬 경로와 파일명이 들어가지 않는다.

```powershell
npm run fashion:expert:pilot:freeze -- `
  --dataset scripts/fixtures/fashion-expert-synthetic-valid.json `
  --assets scripts/fixtures/fashion-expert-pilot-assets.json `
  --batch-id synthetic-pilot-v1 `
  --output scripts/fixtures/fashion-expert-pilot-batch-lock.json
```

Snapshot은 `outfitId` 순서로 canonicalize하므로 JSON key 순서, 공백, snapshot 배열 순서는 digest에 영향을 주지 않는다. Snapshot context·feature·input availability 또는 이미지 바이트·개수·표시 순서가 바뀌면 배치 fingerprint가 바뀐다. 평가는 snapshot digest에 포함하지 않는다.

```powershell
npm run fashion:expert:pilot -- `
  --dataset scripts/fixtures/fashion-expert-synthetic-valid.json `
  --assets scripts/fixtures/fashion-expert-pilot-assets.json `
  --batch-lock scripts/fixtures/fashion-expert-pilot-batch-lock.json `
  --evaluator-id pilot-reviewer-01 `
  --evaluator-group pilot `
  --output fashion-expert-pilot-output/reviewer-01.expert-pilot-output.json
```

선택 인자:

- `--evaluator-group`: `stylist`, `fashion_student`, `trained_reviewer`, `pilot`, `unknown`
- `--seed`: 같은 평가자의 코디 순서를 재현하는 문자열. 기본값 `pilot-v1`
- `--port`: 기본값 `4317`

터미널에 표시된 `http://127.0.0.1:<port>`를 연다. 서버는 외부 interface에 bind하지 않으며 CORS를 허용하지 않는다.

## 평가 흐름

1. 왼쪽에서 허가된 이미지와 익명 context를 확인한다.
2. 각 dimension의 가용성, 1~5 평점, confidence, evidence를 기록한다.
3. 필수 context 또는 observation이 없으면 `평가 가능` 선택이 잠긴다. 중립 3점 대신 `정보 부족`, `해당 없음`, `판단 보류` 중 적합한 상태를 선택한다.
4. 같은 evidence code를 지지와 충돌에 동시에 선택할 수 없다.
5. `현재 Case 저장`은 기존 dataset validator를 통과한 경우에만 output을 교체한다.
6. 전체 호환성은 선택 항목이다. Image가 없으면 rated로 기록할 수 없다.
7. 모든 Case 저장 후 `전체 완료 확인`으로 최종 검증한다.

입력을 바꾸면 현재 Case는 `저장되지 않은 변경`으로 표시된다. 이전·다음 Case로 이동해도 브라우저 메모리에 Case별 초안이 남고, 돌아오면 저장된 평가보다 초안을 우선 복원한다. 초안은 명시적 저장에 성공한 Case만 제거되며 저장 실패 시 유지된다. `현재 Case 변경 버리기`는 해당 Case 초안만 제거한다.

저장 요청 중에는 현재 Case의 입력, 이전·다음 이동, 변경 버리기, 전체 완료가 잠긴다. 성공 응답은 요청을 시작한 Case의 동일한 초안 revision에만 적용되며 실패하면 입력과 누적 평가 시간을 유지한다. 저장 요청만 진행 중이고 초안이 없는 경우에도 탭 종료 보호가 유지된다.

- 초안이 하나라도 있으면 새로고침·탭 종료 전에 브라우저 표준 경고가 표시되고 `전체 완료 확인`이 차단된다.
- 초안은 현재 브라우저 메모리에만 있다. 새로고침, 탭 종료, 브라우저 종료 또는 서버 재시작 뒤에는 복원되지 않는다.
- `localStorage`, `sessionStorage`, IndexedDB, 쿠키, 서버 파일을 초안 저장에 사용하지 않는다.
- 초안은 input dataset과 output JSON에 기록되지 않으며 이미지 경로, asset ID, session token, 원본 outfit ID를 포함하지 않는다.

UI에는 pairwise 비교, 총점 계산, professional score가 없다. 평가는 registry의 dimension, anchor, evidence code를 동적으로 읽으므로 별도 화면 상수를 만들지 않는다.

## 저장과 재개

- Output은 임시 파일에 write·fsync한 뒤 rename하는 방식으로 원자적으로 저장한다.
- Output 옆의 `<output>.pilot-provenance.json`에는 batch fingerprint, evaluator ID, seed, Case 순서 digest만 저장한다. 경로, asset ID, 이미지 바이트는 저장하지 않는다.
- 동일한 dataset, evaluator ID, seed, output 경로로 다시 실행하면 완료된 Case를 불러오고 첫 미완료 Case부터 재개한다.
- Evaluation ID와 Case 순서는 dataset ID, evaluator ID, rubric version, seed를 기준으로 결정적이다.
- 같은 evaluator + outfit + rubric 평가는 새 레코드를 추가하지 않고 교체한다.
- 기존 output이 손상됐거나 provenance sidecar가 없거나 batch, evaluator, seed, Case 순서가 다르면 시작 전에 중단한다.
- Input dataset은 수정하지 않는다.

Output과 로컬 manifest 기본 패턴은 `.gitignore`에 포함된다. 실제 파일럿 자료를 repository에 커밋하지 않는다.

## 실패 대응

- **시작 전 validator 실패**: dataset을 기존 `fashion:expert:validate`로 먼저 수정한다.
- **이미지 거부**: 파일 크기, 확장자, 실제 MIME, symlink 여부, snapshot의 `imageAvailable`을 확인한다.
- **저장 거부**: 화면의 필수 13개 dimension, confidence, rating 가용성 조건을 확인한다.
- **Case에 저장되지 않은 변경 표시**: 해당 Case를 다시 열어 저장하거나 `현재 Case 변경 버리기`로 메모리 초안을 제거한다.
- **완료 거부**: 저장되지 않은 Case가 남아 있다. `/api/session`의 완료 상태를 기준으로 첫 미완료 Case가 자동 선택된다.
- **Output 손상**: 손상 파일을 별도로 보존한 뒤 마지막 정상 백업에서 재개한다. Input dataset을 output으로 사용하지 않는다.

## 개발 검증

```powershell
npm run test:fashion-expert-pilot
npm run test:fashion-expert
npm run lint
npx tsc --noEmit
```

Pilot test는 Case별 초안 격리·불변 복사·privacy, 인자 거부, asset 경계, MIME spoofing, 결정적 순서·ID, 평가 잠금, localhost 보안 헤더, 원자 저장, 재개, 중복 방지, 전체 완료, input 불변과 output privacy를 확인한다.
