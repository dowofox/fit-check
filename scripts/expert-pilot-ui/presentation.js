(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PilotPresentation = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function indexBy(items, key, label) {
    if (!Array.isArray(items)) throw new Error(`${label} must be an array.`);
    const index = new Map();
    items.forEach((item) => {
      const value = item?.[key];
      if (typeof value !== "string" || !value) throw new Error(`${label} contains an invalid value.`);
      if (index.has(value)) throw new Error(`${label} contains duplicate ${value}.`);
      index.set(value, item);
    });
    return index;
  }

  function orderExact(items, order, key, label) {
    if (!Array.isArray(order)) throw new Error(`${label} display order must be an array.`);
    const index = indexBy(items, key, label);
    if (new Set(order).size !== order.length) {
      throw new Error(`${label} display order contains duplicates.`);
    }
    if (index.size !== order.length || order.some((value) => !index.has(value))) {
      throw new Error(`${label} does not match the presentation contract.`);
    }
    return order.map((value) => index.get(value));
  }

  function orderRubricDefinitions(definitions, displayOrder) {
    return orderExact(definitions, displayOrder, "id", "Rubric definitions");
  }

  function orderEvidenceDefinitions(definitions, displayOrder, allowedCodes) {
    const ordered = orderExact(definitions, displayOrder, "code", "Evidence definitions");
    const allowed = new Set(allowedCodes);
    if (allowed.size !== allowedCodes.length || allowedCodes.some((code) => !displayOrder.includes(code))) {
      throw new Error("Allowed evidence does not match the presentation contract.");
    }
    return ordered.filter((definition) => allowed.has(definition.code));
  }

  function getAvailabilityEntries(evaluationContract, presentationContract) {
    const values = evaluationContract?.availabilityValues;
    const labels = presentationContract?.labels?.availability;
    if (!Array.isArray(values) || !labels || typeof labels !== "object") {
      throw new Error("Availability presentation contract is invalid.");
    }
    const labelKeys = Object.keys(labels);
    if (
      new Set(values).size !== values.length ||
      labelKeys.length !== values.length ||
      values.some((value) => typeof labels[value] !== "string" || !labels[value].trim()) ||
      labelKeys.some((value) => !values.includes(value))
    ) {
      throw new Error("Availability presentation contract does not match the evaluation contract.");
    }
    const emptySelection = presentationContract.labels.emptySelection;
    if (typeof emptySelection !== "string" || !emptySelection.trim()) {
      throw new Error("Empty selection label is required.");
    }
    return [["", emptySelection], ...values.map((value) => [value, labels[value]])];
  }

  return {
    getAvailabilityEntries,
    orderEvidenceDefinitions,
    orderRubricDefinitions,
  };
});
