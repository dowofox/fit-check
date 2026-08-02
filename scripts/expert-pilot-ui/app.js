"use strict";

const AVAILABILITIES = [
  ["", "선택하세요"],
  ["rated", "평가 가능"],
  ["not_enough_information", "정보 부족"],
  ["not_applicable", "해당 없음"],
  ["abstained", "판단 보류"],
];
const RATINGS = [1, 2, 3, 4, 5];
const state = {
  token: "",
  session: null,
  currentCase: 1,
  caseData: null,
  startedAt: Date.now(),
};

const elements = {
  loading: document.querySelector("#loading"),
  error: document.querySelector("#error"),
  workspace: document.querySelector("#workspace"),
  rubricVersion: document.querySelector("#rubric-version"),
  caseProgress: document.querySelector("#case-progress"),
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
  saveStatus: document.querySelector("#save-status"),
  previous: document.querySelector("#previous-button"),
  next: document.querySelector("#next-button"),
  complete: document.querySelector("#complete-button"),
};

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

function fillOverall(existing) {
  elements.overallEnabled.checked = Boolean(existing);
  elements.overallFields.hidden = !existing;
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

async function loadCase(caseNumber) {
  state.caseData = await request(`/api/outfits/${caseNumber}`);
  state.currentCase = caseNumber;
  state.startedAt = Date.now();
  const existing = state.caseData.existingEvaluation;
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
  elements.dimensionList.replaceChildren(
    ...state.caseData.rubric.map((definition) =>
      renderDimension(
        definition,
        existing?.dimensions?.find((entry) => entry.dimension === definition.id)
      )
    )
  );
  fillOverall(existing?.overallCompatibility);
  populateSelect(elements.evaluatorConfidence, [
    ["", "선택하세요"],
    ...RATINGS.map((value) => [value, `${value}`]),
  ]);
  elements.evaluatorConfidence.value = existing?.evaluatorConfidence || "";
  elements.previous.disabled = caseNumber === 1;
  elements.next.disabled = caseNumber === state.caseData.totalCases;
  elements.saveStatus.textContent = existing ? "저장된 평가를 이어서 수정할 수 있습니다." : "";
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  try {
    const evaluatorConfidence = Number(elements.evaluatorConfidence.value);
    if (!evaluatorConfidence) throw new Error("평가 전체 확신도를 선택해주세요.");
    const dimensions = [...document.querySelectorAll(".dimension-card")].map(collectDimension);
    const payload = {
      dimensions,
      overallCompatibility: collectOverall(),
      evaluatorConfidence,
      durationSeconds: Math.max(1, Math.round((Date.now() - state.startedAt) / 1000)),
    };
    elements.saveStatus.textContent = "저장 중입니다.";
    const result = await request(`/api/evaluations/${state.currentCase}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    elements.saveStatus.textContent = result.warnings.length
      ? `저장됨. 경고 ${result.warnings.length}개: ${result.warnings[0].message}`
      : "안전하게 저장했습니다.";
  } catch (error) {
    elements.saveStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function completeSession() {
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
elements.previous.addEventListener("click", () => loadCase(state.currentCase - 1));
elements.next.addEventListener("click", () => loadCase(state.currentCase + 1));
elements.complete.addEventListener("click", completeSession);
elements.overallEnabled.addEventListener("change", () => {
  elements.overallFields.hidden = !elements.overallEnabled.checked;
});
elements.overallAvailability.addEventListener("change", updateOverallRating);

initialize();
