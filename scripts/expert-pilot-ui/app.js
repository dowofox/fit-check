"use strict";

const AVAILABILITIES = [
  ["", "선택하세요"],
  ["rated", "평가 가능"],
  ["not_enough_information", "정보 부족"],
  ["not_applicable", "해당 없음"],
  ["abstained", "판단 보류"],
];
const RATINGS = [1, 2, 3, 4, 5];
const draftStore = window.PilotDraftState.createDraftStore();
const state = {
  token: "",
  session: null,
  currentCase: 1,
  caseData: null,
  baseDurationSeconds: 0,
  elapsedMilliseconds: 0,
  editStartedAt: null,
  rendering: false,
  activeSave: null,
  saveSequence: 0,
  disabledBeforeSave: null,
  savedEvaluations: new Map(),
};

const elements = {
  loading: document.querySelector("#loading"),
  error: document.querySelector("#error"),
  workspace: document.querySelector("#workspace"),
  rubricVersion: document.querySelector("#rubric-version"),
  caseProgress: document.querySelector("#case-progress"),
  caseState: document.querySelector("#case-state"),
  images: document.querySelector("#images"),
  contextList: document.querySelector("#context-list"),
  availabilityList: document.querySelector("#availability-list"),
  form: document.querySelector("#evaluation-form"),
  dimensionList: document.querySelector("#dimension-list"),
  overallEnabled: document.querySelector("#overall-enabled"),
  overallFields: document.querySelector("#overall-fields"),
  overallAvailability: document.querySelector("#overall-availability"),
  overallRating: document.querySelector("#overall-rating"),
  overallConfidence: document.querySelector("#overall-confidence"),
  overallNotes: document.querySelector("#overall-notes"),
  evaluatorConfidence: document.querySelector("#evaluator-confidence"),
  draftStatus: document.querySelector("#draft-status"),
  saveStatus: document.querySelector("#save-status"),
  previous: document.querySelector("#previous-button"),
  next: document.querySelector("#next-button"),
  discard: document.querySelector("#discard-button"),
  complete: document.querySelector("#complete-button"),
  save: document.querySelector("#save-button"),
};

function beforeUnload(event) {
  event.preventDefault();
  event.returnValue = "";
}

function syncUnloadProtection() {
  const method = draftStore.hasAnyDraft() || state.activeSave
    ? "addEventListener"
    : "removeEventListener";
  window[method]("beforeunload", beforeUnload);
}

function setSaving(saving) {
  if (saving) {
    state.disabledBeforeSave = new Map(
      [...elements.form.elements].map((control) => [control, control.disabled])
    );
    state.disabledBeforeSave.forEach((_, control) => {
      control.disabled = true;
    });
    elements.save.textContent = "저장 중";
    elements.form.setAttribute("aria-busy", "true");
  } else {
    state.disabledBeforeSave?.forEach((disabled, control) => {
      control.disabled = disabled;
    });
    state.disabledBeforeSave = null;
    elements.save.textContent = "현재 Case 저장";
    elements.form.removeAttribute("aria-busy");
  }
  syncUnloadProtection();
}

function syncDraftStatus() {
  const dirtyCases = draftStore.getDirtyCaseNumbers();
  const currentDirty = draftStore.hasDraft(state.currentCase);
  const saved = state.savedEvaluations.has(state.currentCase);
  elements.caseState.textContent = currentDirty
    ? "저장되지 않은 변경"
    : saved
      ? "저장됨"
      : "아직 평가하지 않음";
  elements.caseState.dataset.state = currentDirty ? "dirty" : saved ? "saved" : "empty";
  elements.draftStatus.textContent = dirtyCases.length
    ? `저장되지 않은 변경사항이 있는 Case: ${dirtyCases.join(", ")}`
    : "";
  elements.discard.hidden = !currentDirty;
  syncUnloadProtection();
}

function option(value, label, disabled = false) {
  const entry = document.createElement("option");
  entry.value = String(value);
  entry.textContent = label;
  entry.disabled = disabled;
  return entry;
}

function populateSelect(select, entries) {
  select.replaceChildren(...entries.map(([value, label, disabled]) => option(value, label, disabled)));
}

function renderKeyValues(container, values) {
  container.replaceChildren();
  Object.entries(values).forEach(([key, value]) => {
    const term = document.createElement("dt");
    term.textContent = key;
    const detail = document.createElement("dd");
    detail.textContent = typeof value === "object" ? JSON.stringify(value) : String(value ?? "-");
    container.append(term, detail);
  });
}

function setError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
  elements.loading.hidden = true;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(state.token ? { "X-Pilot-Token": state.token } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `요청 실패 (${response.status})`);
  return payload;
}

function buildSelect(entries, value, name) {
  const select = document.createElement("select");
  select.name = name;
  populateSelect(select, entries);
  select.value = value === undefined ? "" : String(value);
  return select;
}

function labelWithControl(labelText, control) {
  const label = document.createElement("label");
  label.append(document.createTextNode(labelText), control);
  return label;
}

function updateRatingVisibility(card) {
  const availability = card.querySelector('[data-field="availability"]');
  const rating = card.querySelector('[data-field="rating"]');
  const rated = availability.value === "rated";
  rating.disabled = !rated;
  if (!rated) rating.value = "";
  const supporting = card.querySelectorAll('[data-evidence="supporting"]:checked').length;
  const conflicting = card.querySelectorAll('[data-evidence="conflicting"]:checked').length;
  const warning = card.querySelector(".evidence-warning");
  warning.hidden = !(rated && supporting + conflicting === 0);
}

function evidenceGroup(kind, codes, selected, dimension) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "evidence-group";
  const legend = document.createElement("legend");
  legend.textContent = kind === "supporting" ? "지지 근거" : "충돌 근거";
  fieldset.append(legend);
  codes.forEach((code) => {
    const label = document.createElement("label");
    label.className = "evidence-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = code;
    input.checked = selected.includes(code);
    input.dataset.evidence = kind;
    input.dataset.dimension = dimension;
    input.addEventListener("change", () => {
      if (input.checked) {
        const otherKind = kind === "supporting" ? "conflicting" : "supporting";
        const opposite = [...fieldset.parentElement.querySelectorAll(
          `[data-evidence="${otherKind}"]`
        )].find((entry) => entry.value === code);
        if (opposite) opposite.checked = false;
      }
      updateRatingVisibility(fieldset.closest(".dimension-card"));
    });
    const labelText = state.caseData.evidence.find((entry) => entry.code === code)?.label || code;
    label.append(input, document.createTextNode(labelText));
    fieldset.append(label);
  });
  return fieldset;
}

function renderDimension(definition, existing) {
  const card = document.createElement("section");
  card.className = "dimension-card";
  card.dataset.dimension = definition.id;

  const heading = document.createElement("div");
  heading.className = "dimension-heading";
  const title = document.createElement("div");
  const name = document.createElement("h2");
  name.textContent = definition.label;
  const description = document.createElement("p");
  description.textContent = definition.description;
  title.append(name, description);
  heading.append(title);
  card.append(heading);

  const requirement = document.createElement("p");
  requirement.className = `requirement-note${definition.state.canRate ? "" : " locked"}`;
  const missing = [
    ...definition.state.missingRequiredContext.map((entry) => `context: ${entry}`),
    ...definition.state.missingRequiredObservation.map((entry) => `observation: ${entry}`),
  ];
  requirement.textContent = definition.state.canRate
    ? "필수 context와 observation 입력을 충족했습니다."
    : `평가 불가: ${missing.join(", ")}`;
  card.append(requirement);

  const fields = document.createElement("div");
  fields.className = "field-row";
  const availabilityEntries = AVAILABILITIES.map(([value, label]) => [
    value,
    label,
    value === "rated" && !definition.state.canRate,
  ]);
  const availability = buildSelect(
    availabilityEntries,
    existing?.availability,
    `${definition.id}-availability`
  );
  availability.dataset.field = "availability";
  const rating = buildSelect(
    [["", "선택하세요"], ...RATINGS.map((value) => [value, `${value}점`])],
    existing?.rating,
    `${definition.id}-rating`
  );
  rating.dataset.field = "rating";
  const confidence = buildSelect(
    [["", "선택하세요"], ...RATINGS.map((value) => [value, `${value}`])],
    existing?.confidence,
    `${definition.id}-confidence`
  );
  confidence.dataset.field = "confidence";
  fields.append(
    labelWithControl("가용성", availability),
    labelWithControl("평점", rating),
    labelWithControl("확신도", confidence)
  );
  card.append(fields);

  const anchors = document.createElement("div");
  anchors.className = "anchors";
  Object.entries(definition.anchors).forEach(([score, text]) => {
    const line = document.createElement("div");
    line.textContent = `${score}: ${text}`;
    anchors.append(line);
  });
  card.append(anchors);

  const evidence = document.createElement("div");
  evidence.className = "evidence-columns";
  evidence.append(
    evidenceGroup(
      "supporting",
      definition.allowedEvidenceCodes,
      existing?.supportingEvidenceCodes || [],
      definition.id
    ),
    evidenceGroup(
      "conflicting",
      definition.allowedEvidenceCodes,
      existing?.conflictingEvidenceCodes || [],
      definition.id
    )
  );
  card.append(evidence);

  const evidenceWarning = document.createElement("p");
  evidenceWarning.className = "evidence-warning";
  evidenceWarning.textContent = "파일럿 분석을 위해 관찰 근거 코드를 하나 이상 선택하는 것을 권장합니다.";
  evidenceWarning.hidden = true;
  card.append(evidenceWarning);

  const notes = document.createElement("textarea");
  notes.dataset.field = "notes";
  notes.maxLength = 1000;
  notes.rows = 2;
  notes.value = existing?.notes || "";
  card.append(labelWithControl("선택 메모", notes));
  availability.addEventListener("change", () => updateRatingVisibility(card));
  updateRatingVisibility(card);
  return card;
}

function fillOverall(existing, enabled = Boolean(existing)) {
  elements.overallEnabled.checked = enabled;
  elements.overallFields.hidden = !enabled;
  populateSelect(elements.overallAvailability, AVAILABILITIES);
  populateSelect(elements.overallRating, [["", "선택하세요"], ...RATINGS.map((v) => [v, `${v}점`])]);
  populateSelect(elements.overallConfidence, [["", "선택하세요"], ...RATINGS.map((v) => [v, `${v}`])]);
  elements.overallAvailability.value = existing?.availability || "";
  elements.overallRating.value = existing?.rating || "";
  elements.overallConfidence.value = existing?.confidence || "";
  elements.overallNotes.value = existing?.notes || "";
  const imageAvailable = state.caseData.inputAvailability.imageAvailable;
  [...elements.overallAvailability.options].forEach((entry) => {
    if (entry.value === "rated") entry.disabled = !imageAvailable;
  });
  updateOverallRating();
}

function updateOverallRating() {
  const rated = elements.overallAvailability.value === "rated";
  elements.overallRating.disabled = !rated;
  if (!rated) elements.overallRating.value = "";
}

function getElapsedMilliseconds() {
  const active = state.editStartedAt === null ? 0 : Date.now() - state.editStartedAt;
  const elapsed = state.elapsedMilliseconds + active;
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
}

function collectDimensionDraft(card) {
  return {
    dimension: card.dataset.dimension,
    availability: card.querySelector('[data-field="availability"]').value,
    rating: card.querySelector('[data-field="rating"]').value,
    confidence: card.querySelector('[data-field="confidence"]').value,
    supportingEvidenceCodes: [
      ...card.querySelectorAll('[data-evidence="supporting"]:checked'),
    ].map((entry) => entry.value),
    conflictingEvidenceCodes: [
      ...card.querySelectorAll('[data-evidence="conflicting"]:checked'),
    ].map((entry) => entry.value),
    notes: card.querySelector('[data-field="notes"]').value,
  };
}

function collectCurrentDraft() {
  return {
    dimensions: [...document.querySelectorAll(".dimension-card")].map(collectDimensionDraft),
    overall: {
      enabled: elements.overallEnabled.checked,
      availability: elements.overallAvailability.value,
      rating: elements.overallRating.value,
      confidence: elements.overallConfidence.value,
      notes: elements.overallNotes.value,
    },
    evaluatorConfidence: elements.evaluatorConfidence.value,
    elapsedMilliseconds: getElapsedMilliseconds(),
  };
}

function preserveCurrentDraft() {
  if (!state.caseData || !draftStore.hasDraft(state.currentCase)) return;
  const draft = collectCurrentDraft();
  draftStore.setDraft(state.currentCase, draft);
  state.elapsedMilliseconds = draft.elapsedMilliseconds;
  state.editStartedAt = null;
}

function markCurrentCaseDirty() {
  if (state.rendering || !state.caseData) return;
  if (state.editStartedAt === null) state.editStartedAt = Date.now();
  draftStore.setDraft(state.currentCase, collectCurrentDraft());
  syncDraftStatus();
}

function renderCurrentCase() {
  const draft = draftStore.getDraft(state.currentCase);
  const existing = state.savedEvaluations.get(state.currentCase);
  const dimensions = draft?.dimensions || existing?.dimensions;
  state.rendering = true;
  state.baseDurationSeconds = Number(existing?.durationSeconds) || 0;
  state.elapsedMilliseconds = draft?.elapsedMilliseconds || 0;
  state.editStartedAt = null;
  elements.dimensionList.replaceChildren(
    ...state.caseData.rubric.map((definition) =>
      renderDimension(
        definition,
        dimensions?.find((entry) => entry.dimension === definition.id)
      )
    )
  );
  fillOverall(
    draft?.overall || existing?.overallCompatibility,
    draft ? draft.overall.enabled : Boolean(existing?.overallCompatibility)
  );
  populateSelect(elements.evaluatorConfidence, [
    ["", "선택하세요"],
    ...RATINGS.map((value) => [value, `${value}`]),
  ]);
  elements.evaluatorConfidence.value = draft?.evaluatorConfidence || existing?.evaluatorConfidence || "";
  elements.saveStatus.textContent = draft
    ? "저장되지 않은 입력을 복원했습니다."
    : existing
      ? "저장된 평가를 이어서 수정할 수 있습니다."
      : "";
  state.rendering = false;
  syncDraftStatus();
}

async function loadCase(caseNumber) {
  const caseData = await request(`/api/outfits/${caseNumber}`);
  if (caseData.existingEvaluation) state.savedEvaluations.set(caseNumber, caseData.existingEvaluation);
  else state.savedEvaluations.delete(caseNumber);
  state.caseData = caseData;
  state.currentCase = caseNumber;
  elements.caseProgress.textContent = `Case ${caseNumber} / ${state.caseData.totalCases}`;
  elements.rubricVersion.textContent = state.caseData.rubricVersion;
  elements.images.replaceChildren(
    ...state.caseData.images.map((source, index) => {
      const image = document.createElement("img");
      image.src = source;
      image.alt = `평가 이미지 ${index + 1}`;
      return image;
    })
  );
  renderKeyValues(elements.contextList, {
    "Style intent": state.caseData.context.styleIntent,
    Occasion: state.caseData.context.occasion,
    Season: state.caseData.context.season,
    Temperature: state.caseData.context.temperatureContext,
    Weather: state.caseData.context.weatherContext,
    "Styling state": state.caseData.context.stylingState,
  });
  renderKeyValues(elements.availabilityList, {
    Image: state.caseData.inputAvailability.imageAvailable,
    "Color features": state.caseData.featureAvailability.color,
    "Shape features": state.caseData.featureAvailability.shape,
    "Material context": state.caseData.inputAvailability.materialContextAvailable,
    "Body fit context": state.caseData.inputAvailability.bodyFitContextAvailable,
  });
  renderCurrentCase();
  elements.previous.disabled = caseNumber === 1;
  elements.next.disabled = caseNumber === state.caseData.totalCases;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function navigateToCase(caseNumber) {
  if (state.activeSave) return;
  preserveCurrentDraft();
  try {
    await loadCase(caseNumber);
  } catch (error) {
    elements.saveStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

function collectDimension(card) {
  const availability = card.querySelector('[data-field="availability"]').value;
  const ratingValue = card.querySelector('[data-field="rating"]').value;
  const confidenceValue = card.querySelector('[data-field="confidence"]').value;
  if (!availability) throw new Error(`${card.querySelector("h2").textContent}: 가용성을 선택해주세요.`);
  if (!confidenceValue) throw new Error(`${card.querySelector("h2").textContent}: 확신도를 선택해주세요.`);
  if (availability === "rated" && !ratingValue) {
    throw new Error(`${card.querySelector("h2").textContent}: 평점을 선택해주세요.`);
  }
  return {
    dimension: card.dataset.dimension,
    availability,
    ...(availability === "rated" ? { rating: Number(ratingValue) } : {}),
    confidence: Number(confidenceValue),
    supportingEvidenceCodes: [
      ...card.querySelectorAll('[data-evidence="supporting"]:checked'),
    ].map((entry) => entry.value),
    conflictingEvidenceCodes: [
      ...card.querySelectorAll('[data-evidence="conflicting"]:checked'),
    ].map((entry) => entry.value),
    ...(card.querySelector('[data-field="notes"]').value.trim()
      ? { notes: card.querySelector('[data-field="notes"]').value.trim() }
      : {}),
  };
}

function collectOverall() {
  if (!elements.overallEnabled.checked) return undefined;
  const availability = elements.overallAvailability.value;
  const rating = elements.overallRating.value;
  const confidence = elements.overallConfidence.value;
  if (!availability || !confidence || (availability === "rated" && !rating)) {
    throw new Error("전체 호환성의 가용성, 평점, 확신도를 확인해주세요.");
  }
  return {
    dimension: "overall_compatibility",
    availability,
    ...(availability === "rated" ? { rating: Number(rating) } : {}),
    confidence: Number(confidence),
    supportingEvidenceCodes: [],
    conflictingEvidenceCodes: [],
    ...(elements.overallNotes.value.trim() ? { notes: elements.overallNotes.value.trim() } : {}),
  };
}

async function saveCurrent(event) {
  event.preventDefault();
  if (state.activeSave) return;
  let transaction;
  try {
    const evaluatorConfidence = Number(elements.evaluatorConfidence.value);
    if (!evaluatorConfidence) throw new Error("평가 전체 확신도를 선택해주세요.");
    const dimensions = [...document.querySelectorAll(".dimension-card")].map(collectDimension);
    const payload = {
      dimensions,
      overallCompatibility: collectOverall(),
      evaluatorConfidence,
      durationSeconds: Math.max(
        1,
        Math.round(state.baseDurationSeconds + getElapsedMilliseconds() / 1000)
      ),
    };
    const caseNumber = state.currentCase;
    const caseData = state.caseData;
    const submittedRecord = draftStore.getDraftRecord(caseNumber);
    transaction = {
      id: `${Date.now()}-${state.saveSequence += 1}`,
      caseNumber,
      caseData,
      revision: submittedRecord?.revision,
      durationSeconds: payload.durationSeconds,
    };
    state.activeSave = transaction;
    setSaving(true);
    elements.saveStatus.textContent = "저장 중입니다.";
    const result = await request(`/api/evaluations/${caseNumber}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (state.activeSave?.id !== transaction.id) return;

    state.savedEvaluations.set(caseNumber, payload);
    const latestRecord = draftStore.getDraftRecord(caseNumber);
    const revisionUnchanged = latestRecord?.revision === transaction.revision;
    if ((!latestRecord && transaction.revision === undefined) || revisionUnchanged) {
      if (transaction.revision !== undefined) {
        draftStore.clearDraft(caseNumber, transaction.revision);
      }
      if (state.currentCase === caseNumber && state.caseData === caseData) {
        state.baseDurationSeconds = transaction.durationSeconds;
        state.elapsedMilliseconds = 0;
        state.editStartedAt = null;
      }
    }
    if (state.currentCase === caseNumber && state.caseData === caseData) {
      elements.saveStatus.textContent = result.warnings.length
        ? `저장됨. 경고 ${result.warnings.length}개: ${result.warnings[0].message}`
        : "안전하게 저장했습니다.";
    }
  } catch (error) {
    if (!transaction || (state.activeSave?.id === transaction.id && state.currentCase === transaction.caseNumber)) {
      elements.saveStatus.textContent = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (transaction && state.activeSave?.id === transaction.id) {
      state.activeSave = null;
      setSaving(false);
      syncDraftStatus();
    }
  }
}

async function completeSession() {
  if (state.activeSave) return;
  const dirtyCases = draftStore.getDirtyCaseNumbers();
  if (dirtyCases.length) {
    elements.saveStatus.textContent =
      `저장되지 않은 변경사항이 있는 Case: ${dirtyCases.join(", ")}. ` +
      "먼저 각 Case를 저장하거나 변경사항을 버려주세요.";
    return;
  }
  try {
    const result = await request("/api/complete", {
      method: "POST",
      body: "{}",
    });
    elements.saveStatus.textContent = `전체 평가 완료. validator 경고 ${result.warnings}개.`;
  } catch (error) {
    elements.saveStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

function discardCurrentDraft() {
  if (state.activeSave) return;
  if (!draftStore.hasDraft(state.currentCase)) return;
  if (!window.confirm("현재 Case의 저장되지 않은 변경사항을 버릴까요?")) return;
  draftStore.clearDraft(state.currentCase);
  state.elapsedMilliseconds = 0;
  state.editStartedAt = null;
  renderCurrentCase();
  elements.saveStatus.textContent = state.savedEvaluations.has(state.currentCase)
    ? "저장된 평가로 되돌렸습니다."
    : "저장되지 않은 변경사항을 버렸습니다.";
}

async function initialize() {
  try {
    const payload = await request("/api/session");
    state.token = payload.token;
    state.session = payload.session;
    elements.loading.hidden = true;
    elements.workspace.hidden = false;
    const firstIncomplete = Array.from(
      { length: payload.session.totalCases },
      (_, index) => index + 1
    ).find((caseNumber) => !payload.session.completedCaseNumbers.includes(caseNumber));
    await loadCase(firstIncomplete || 1);
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  }
}

elements.form.addEventListener("submit", saveCurrent);
elements.form.addEventListener("input", markCurrentCaseDirty);
elements.form.addEventListener("change", markCurrentCaseDirty);
elements.previous.addEventListener("click", () => navigateToCase(state.currentCase - 1));
elements.next.addEventListener("click", () => navigateToCase(state.currentCase + 1));
elements.discard.addEventListener("click", discardCurrentDraft);
elements.complete.addEventListener("click", completeSession);
elements.overallEnabled.addEventListener("change", () => {
  elements.overallFields.hidden = !elements.overallEnabled.checked;
});
elements.overallAvailability.addEventListener("change", updateOverallRating);

initialize();
