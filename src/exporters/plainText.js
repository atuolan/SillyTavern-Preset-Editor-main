function normalizeFormat(format) {
  if (format === "plain") return format;
  throw new Error(`Unknown format: ${format} (expected plain)`);
}

function normalizePromptMode(promptMode) {
  if (promptMode === "all" || promptMode === "enabled") return promptMode;
  throw new Error(`Unknown promptMode: ${promptMode} (expected all|enabled)`);
}

export function exportProfileText(doc, options) {
  const format = normalizeFormat(options?.format ?? "plain");
  const promptMode = normalizePromptMode(options?.promptMode ?? "enabled");
  const characterId = Number(options?.characterId);
  const includeEmpty = Boolean(options?.includeEmpty);

  const profile = doc.profiles.find((p) => Number(p.characterId) === characterId);
  if (!profile) throw new Error(`Profile not found: ${options?.characterId}`);

  const warnings = [];
  const parts = [];

  const stats = {
    blocksTotal: profile.order.length,
    blocksEnabled: 0,
    blocksEmitted: 0,
    blocksMissing: 0
  };

  for (const entry of profile.order) {
    const enabled = promptMode === "all" ? true : Boolean(entry.enabled);
    if (enabled) stats.blocksEnabled += 1;
    if (!enabled) continue;

    const block = doc.blocks[entry.blockId];
    if (!block) {
      stats.blocksMissing += 1;
      warnings.push(`Missing block definition for identifier: ${entry.blockId}`);
      continue;
    }

    const text = typeof block.text === "string" ? block.text : "";
    const isEmpty = text.length === 0;
    if (isEmpty && !includeEmpty) {
      continue;
    }

    parts.push(text);
    parts.push("");

    stats.blocksEmitted += 1;
  }

  const text = parts.join("\n").replace(/\n{3,}$/g, "\n");
  return { text, warnings, stats };
}
