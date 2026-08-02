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

평가를 시작하기 전에 dataset snapshot, 실제 이미지 바이트, 현재 annotation protocol을 하나의 배치로 고정한다. 잠금 파일에는 로컬 경로와 파일명, 전체 rubric 문구가 들어가지 않는다.

```powershell
npm run fashion:expert:pilot:freeze -- `
  --dataset scripts/fixtures/fashion-expert-synthetic-valid.json `
  --assets scripts/fixtures/fashion-expert-pilot-assets.json `
  --batch-id synthetic-pilot-v1 `
  --output scripts/fixtures/fashion-expert-pilot-batch-lock.json
```

Freeze the evaluator assignment before collecting responses. Reuse the same assignment file for every evaluator and for the final merge.

```powershell
npm run fashion:expert:pilot:assign -- `
  --batch-lock scripts/fixtures/fashion-expert-pilot-batch-lock.json `
  --evaluator pilot-reviewer-01 `
  --evaluator pilot-reviewer-02 `
  --seed synthetic-pilot-v1 `
  --output fashion-expert-pilot-output/assignment.json
```

Snapshot은 `outfitId` 순서로 canonicalize하므로 JSON key 순서, 공백, snapshot 배열 순서는 digest에 영향을 주지 않는다. Snapshot context·feature·input availability 또는 이미지 바이트·개수·표시 순서가 바뀌면 배치 fingerprint가 바뀐다. 평가는 snapshot digest에 포함하지 않는다.

Annotation protocol digest는 실제 rubric/evidence registry와 evaluator presentation contract에서 생성한다. 13개 dimension의 label·description·anchor·context/observation requirement·허용 evidence, evidence의 label·description·origin·polarity, rating/availability 계약과 overall image 정책을 포함한다. Dimension과 evidence의 표시 순서, availability·빈 선택·근거 그룹 문구도 순서가 의미 있는 presentation contract로 보존한다. `reviewedBy`와 `sourceReferences`는 평가 화면이나 입력 가능 여부에 영향을 주지 않는 검토 metadata라 제외한다. 기존 `expert-pilot-batch-lock-v1`과 `v2`는 자동 이관하지 않고 명시적으로 거부하므로 변경 의도를 확인하고 새 batch ID로 `freeze`하여 v3 lock을 만들어야 한다.

`retired` evidence는 정의 이력에는 남지만 새 파일럿의 표시 순서와 선택 가능 목록에서는 제외한다. 그 외 `draft`, `expert_review`, `validated` evidence는 presentation contract에 정확히 한 번 포함되어야 한다.

```powershell
npm run fashion:expert:pilot -- `
  --dataset scripts/fixtures/fashion-expert-synthetic-valid.json `
  --assets scripts/fixtures/fashion-expert-pilot-assets.json `
  --batch-lock scripts/fixtures/fashion-expert-pilot-batch-lock.json `
  --assignment fashion-expert-pilot-output/assignment.json `
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

UI에는 pairwise 비교, 총점 계산, professional score가 없다. 평가는 registry의 dimension·anchor·evidence 정의와 protocol에 잠긴 presentation contract를 동적으로 읽으며, 선택지 순서와 문구를 별도 화면 상수로 복제하지 않는다.

## 저장과 재개

- Output은 임시 파일에 write·fsync한 뒤 rename하는 방식으로 원자적으로 저장한다.
- Output 옆의 `<output>.pilot-provenance.json`에는 batch fingerprint, evaluator ID, seed, Case 순서 digest와 생성·수정·완료 시각만 저장한다. 경로, asset ID, 이미지 바이트는 저장하지 않는다.
- 동일한 dataset, evaluator ID, seed, output 경로로 다시 실행하면 완료된 Case를 불러오고 첫 미완료 Case부터 재개한다.
- Evaluation ID와 Case 순서는 dataset ID, evaluator ID, rubric version, seed를 기준으로 결정적이다.
- 같은 evaluator + outfit + rubric 평가는 새 레코드를 추가하지 않고 교체한다.
- 기존 output이 손상됐거나 provenance sidecar가 없거나 batch, evaluator, seed, Case 순서가 다르면 시작 전에 중단한다.
- `completedAt`은 모든 Case를 저장한 뒤 완료 API가 성공할 때만 기록한다. 완료 후 평가를 다시 저장하면 표식을 지우고 재완료해야 하며, v2 sidecar는 병합하지 않는다.
- Input dataset은 수정하지 않는다.

Output과 로컬 manifest 기본 패턴은 `.gitignore`에 포함된다. 실제 파일럿 자료를 repository에 커밋하지 않는다.

## 실패 대응

- **시작 전 validator 실패**: dataset을 기존 `fashion:expert:validate`로 먼저 수정한다.
- **Annotation protocol 불일치**: 같은 dataset과 이미지라도 freeze 이후 rubric, anchor, requirement 또는 evidence 정의가 바뀌었다. 기존 lock을 덮어쓰지 말고 변경 의도를 검토한 뒤 새 batch ID로 다시 freeze한다.
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

## 여러 평가자 결과 병합

평가자는 같은 output 파일을 공유하지 않는다. 각자 별도 output과 인접한 `.pilot-provenance.json` sidecar를 만들고, 완료된 파일만 frozen source dataset 및 v3 batch lock과 함께 병합한다.

```powershell
npm run fashion:expert:pilot:merge -- `
  --dataset scripts/fixtures/fashion-expert-synthetic-valid.json `
  --batch-lock scripts/fixtures/fashion-expert-pilot-batch-lock.json `
  --assignment fashion-expert-pilot-output/assignment.json `
  --input reviewer-a.json `
  --input reviewer-b.json `
  --output merged-expert-pilot.json
```

병합은 다음을 거부한다.

- batch, snapshot, annotation/presentation protocol 또는 dataset identity가 다른 output
- provenance sidecar가 없거나 손상된 output
- 같은 evaluator ID의 중복 input
- 모든 snapshot 평가를 마치지 않은 partial output
- 다른 평가자의 기록, pairwise 평가, snapshot, metadata notes 또는 split policy를 바꾼 output

입력 순서와 무관하게 absolute evaluation은 evaluator ID, outfit ID, evaluation ID 순으로 정렬된다. 최종 metadata count만 실제 평가 데이터로 다시 계산하며 source와 기존 평가를 보존한다. 병합 결과는 `expert_validated`로 자동 승격하지 않는다.

신규 평가는 evaluator output provenance의 `createdAt` 이후에 생성되어야 하고, `updatedAt`은 그 파일에 든 absolute/pairwise 평가의 `createdAt`과 같거나 이후여야 한다. Source에 이미 있던 평가는 세션 시작 전 시각을 유지할 수 있다. 병합 시각은 모든 output `updatedAt`과 평가 `createdAt` 이후여야 하며, 순서가 어긋난 병합은 output을 쓰기 전에 거부한다.

`<output>.pilot-merge-provenance.json`에는 batch identity, snapshot/protocol digest, 평가자별 input dataset/provenance digest와 merged dataset digest만 기록한다. 경로, token, 이미지, notes, 평가 내용은 저장하지 않는다. source dataset, batch lock, 각 평가자의 output/sidecar 원본과 merge provenance는 분석 재현이 끝날 때까지 함께 보관하고, 폐기는 파일럿 데이터 보존 정책에 따른다.

병합 후 기존 검증과 agreement report를 실행한다.

```powershell
npm run fashion:expert:validate -- merged-expert-pilot.json
npm run fashion:expert:report -- merged-expert-pilot.json
```

## Calibration readiness gate

병합 결과를 calibration review에 전달하기 전 frozen batch, assignment, merge provenance와 평가 coverage를 함께 검증한다.

```powershell
npm run fashion:expert:pilot:readiness -- `
  --dataset merged-expert-pilot.json `
  --source-dataset scripts/fixtures/fashion-expert-synthetic-valid.json `
  --batch-lock scripts/fixtures/fashion-expert-pilot-batch-lock.json `
  --assignment fashion-expert-pilot-output/assignment.json `
  --merge-provenance merged-expert-pilot.json.pilot-merge-provenance.json `
  --input reviewer-a.json `
  --input reviewer-b.json `
  --output calibration-readiness.json
```

`ready_for_calibration_review`는 입력 정합성과 배정 coverage가 완전하다는 뜻이다. Agreement, unavailable rate, confidence와 high-disagreement outfit은 진단으로만 기록하며 근거 없는 품질 임계값을 적용하지 않는다. 이 결과는 `expert_validated` 또는 production 적용 승인이 아니다.

## Calibration review packet

동결된 네 입력을 다시 검증해 원본 평가 notes 없이 사람이 검토할 진단 패킷을 만든다. 외부 readiness JSON은 받지 않으며, JSON과 Markdown은 같은 입력에 대해 결정적이다. Dimension은 coverage가 낮은 순서로 정렬한다.

```powershell
npm run fashion:expert:pilot:review-packet -- `
  --dataset merged-expert-pilot.json `
  --source-dataset scripts/fixtures/fashion-expert-synthetic-valid.json `
  --batch-lock scripts/fixtures/fashion-expert-pilot-batch-lock.json `
  --assignment fashion-expert-pilot-output/assignment.json `
  --merge-provenance merged-expert-pilot.json.pilot-merge-provenance.json `
  --input reviewer-a.json `
  --input reviewer-b.json `
  --format markdown `
  --output calibration-review-packet.md
```

준비 상태가 차단되었거나 구조 검사 중 하나라도 실패한 입력에서는 패킷을 만들지 않는다. 패킷은 high-disagreement outfit과 dimension 진단을 검토 순서로 정리할 뿐 calibration 결정, `expert_validated`, production 적용을 대신하지 않는다.

## Calibration decision record

사람의 검토가 끝나면 자유 서술 대신 허용된 결정, 근거 코드와 dimension action을 JSON으로 작성한다. 모든 dimension과 패킷의 high-disagreement outfit을 빠짐없이 포함해야 한다.

아래 JSON은 구조를 보여주는 축약 예시다. 실제 입력의 `dimensionActions`에는 검토 패킷의 모든 dimension을 넣는다.

```json
{
  "schemaVersion": "expert-pilot-calibration-decision-input-v1",
  "reviewerId": "calibration-lead-01",
  "decidedAt": "2026-08-02T02:00:00.000Z",
  "decision": "proceed_to_next_pilot",
  "rationaleCodes": ["coverage_reviewed", "agreement_reviewed", "unavailable_rate_reviewed"],
  "dimensionActions": [
    { "dimension": "color_harmony", "action": "retain" }
  ],
  "reviewedHighDisagreementOutfitIds": []
}
```

`dimensionActions`에는 실제 rubric의 모든 dimension을 넣는다. 결정은 `proceed_to_next_pilot`, `revise_protocol`, `collect_more_evaluations`, action은 `retain`, `clarify`, `retest` 중 하나다.

`proceed_to_next_pilot`에는 교정·추가 수집 근거를 넣지 않는다. `revise_protocol`은 `protocol_clarification_needed`, `collect_more_evaluations`는 `additional_evaluations_needed`를 반드시 포함하며 서로의 근거를 함께 쓰지 않는다.

`revise_protocol`의 dimension action은 `retain`과 `clarify`, `collect_more_evaluations`는 `retain`과 `retest`만 사용한다. 하나의 결정에 `clarify`와 `retest`를 함께 넣지 않는다.

`decidedAt`은 검증된 merge provenance의 `createdAt`과 같거나 그 이후여야 한다.

```powershell
npm run fashion:expert:pilot:decision-record -- `
  --dataset merged-expert-pilot.json `
  --source-dataset scripts/fixtures/fashion-expert-synthetic-valid.json `
  --batch-lock scripts/fixtures/fashion-expert-pilot-batch-lock.json `
  --assignment fashion-expert-pilot-output/assignment.json `
  --merge-provenance merged-expert-pilot.json.pilot-merge-provenance.json `
  --input reviewer-a.json `
  --input reviewer-b.json `
  --decision calibration-decision.json `
  --output calibration-decision-record.json
```

CLI는 검증된 원본들로 review packet을 다시 생성하고 그 digest에 결정을 묶는다. Record source에는 검증된 merge provenance digest와 병합 시각도 남겨 결정의 시간 기준을 재현한다. 이 record는 calibration 후속 조치만 기록하며 `expert_validated`나 production 승인을 만들지 않는다.
