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
    const revisions = new Map();
    return {
      setDraft(caseNumber, draft) {
        const key = Number(caseNumber);
        const revision = (revisions.get(key) || 0) + 1;
        revisions.set(key, revision);
        drafts.set(key, { revision, draft: cloneDraft(draft) });
        return revision;
      },
      getDraft(caseNumber) {
        const record = drafts.get(Number(caseNumber));
        return record ? cloneDraft(record.draft) : undefined;
      },
      getDraftRecord(caseNumber) {
        const record = drafts.get(Number(caseNumber));
        return record
          ? { revision: record.revision, draft: cloneDraft(record.draft) }
          : undefined;
      },
      hasDraft(caseNumber) {
        return drafts.has(Number(caseNumber));
      },
      clearDraft(caseNumber, expectedRevision) {
        const key = Number(caseNumber);
        const record = drafts.get(key);
        if (expectedRevision !== undefined && record?.revision !== expectedRevision) return false;
        return drafts.delete(key);
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
