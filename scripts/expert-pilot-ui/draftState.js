(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PilotDraftState = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function cleanScalar(value) {
    return typeof value === "number" || typeof value === "string" ? value : "";
  }

  function cleanList(value) {
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  }

  function cloneDraft(draft) {
    const overall = draft?.overall || {};
    return {
      dimensions: Array.isArray(draft?.dimensions)
        ? draft.dimensions.map((entry) => ({
            dimension: String(entry?.dimension || ""),
            availability: String(entry?.availability || ""),
            rating: cleanScalar(entry?.rating),
            confidence: cleanScalar(entry?.confidence),
            supportingEvidenceCodes: cleanList(entry?.supportingEvidenceCodes),
            conflictingEvidenceCodes: cleanList(entry?.conflictingEvidenceCodes),
            notes: String(entry?.notes || ""),
          }))
        : [],
      overall: {
        enabled: Boolean(overall.enabled),
        availability: String(overall.availability || ""),
        rating: cleanScalar(overall.rating),
        confidence: cleanScalar(overall.confidence),
        notes: String(overall.notes || ""),
      },
      evaluatorConfidence: cleanScalar(draft?.evaluatorConfidence),
      elapsedMilliseconds: Number.isFinite(draft?.elapsedMilliseconds)
        ? Math.max(0, draft.elapsedMilliseconds)
        : 0,
    };
  }

  function createDraftStore() {
    const drafts = new Map();
    return {
      setDraft(caseNumber, draft) {
        drafts.set(Number(caseNumber), cloneDraft(draft));
      },
      getDraft(caseNumber) {
        const draft = drafts.get(Number(caseNumber));
        return draft ? cloneDraft(draft) : undefined;
      },
      hasDraft(caseNumber) {
        return drafts.has(Number(caseNumber));
      },
      clearDraft(caseNumber) {
        drafts.delete(Number(caseNumber));
      },
      getDirtyCaseNumbers() {
        return [...drafts.keys()].sort((left, right) => left - right);
      },
      hasAnyDraft() {
        return drafts.size > 0;
      },
    };
  }

  function draftsEqual(left, right) {
    return JSON.stringify(left && cloneDraft(left)) === JSON.stringify(right && cloneDraft(right));
  }

  return { createDraftStore, draftsEqual };
});
