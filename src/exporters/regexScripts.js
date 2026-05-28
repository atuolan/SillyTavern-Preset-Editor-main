function sanitizeFileName(name) {
  return String(name)
    .trim()
    .replace(/[\\/:"*?<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

export function exportRegexScripts(doc, options) {
  const includeDisabled = options?.includeDisabled ?? true;
  const selectedIds = Array.isArray(options?.selectedIds) ? options.selectedIds : null;
  const scripts = Array.isArray(doc?.regexScripts) ? doc.regexScripts : [];
  let filtered = includeDisabled ? scripts : scripts.filter((s) => !s?.disabled);

  if (selectedIds != null) {
    const selectedSet = new Set(selectedIds);
    filtered = filtered.filter((s) => typeof s?.id === "string" && selectedSet.has(s.id));
  }

  // Return a JSON-friendly array with stable key ordering (keep original objects as-is).
  return filtered.map((s) => ({
    id: s.id ?? undefined,
    scriptName: s.scriptName ?? undefined,
    findRegex: s.findRegex ?? undefined,
    replaceString: s.replaceString ?? "",
    trimStrings: Array.isArray(s.trimStrings) ? s.trimStrings : [],
    placement: Array.isArray(s.placement) ? s.placement : [],
    disabled: Boolean(s.disabled),
    markdownOnly: Boolean(s.markdownOnly),
    promptOnly: Boolean(s.promptOnly),
    runOnEdit: Boolean(s.runOnEdit),
    substituteRegex: s.substituteRegex ?? 0,
    minDepth: s.minDepth ?? null,
    maxDepth: s.maxDepth ?? null
  }));
}

export function makeRegexScriptFileName(script, index) {
  const base = sanitizeFileName(script?.scriptName || script?.id || `regex-${index + 1}`);
  return `${base || `regex-${index + 1}`}.json`;
}
