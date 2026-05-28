function normalizePromptMode(promptMode) {
  if (promptMode === "all" || promptMode === "enabled") return promptMode;
  throw new Error(`Unknown promptMode: ${promptMode} (expected all|enabled)`);
}

function blockToPrompt(block) {
  const prompt = {
    ...block.meta,
    identifier: block.id,
    name: block.title,
    content: typeof block.text === "string" ? block.text : ""
  };

  if (block.role) prompt.role = block.role;
  if (block.marker) prompt.marker = true;
  if (typeof prompt.system_prompt !== "boolean") prompt.system_prompt = true;

  return prompt;
}

export function exportSillyTavernPresetJson(doc, options) {
  const characterId = Number(options?.characterId);
  const promptMode = normalizePromptMode(options?.promptMode ?? "all");
  const includeRegex = Boolean(options?.includeRegex);
  const includeApiSettings = Boolean(options?.includeApiSettings);
  const selectedRegexIds = Array.isArray(options?.selectedRegexIds) ? options.selectedRegexIds : [];

  const profile = doc.profiles.find((p) => Number(p.characterId) === characterId);
  if (!profile) throw new Error(`Profile not found: ${options?.characterId}`);

  const order = [];
  const seenPromptIds = new Set();
  const prompts = [];

  for (const item of profile.order) {
    const isIncluded = promptMode === "all" ? true : Boolean(item.enabled);
    if (!isIncluded) continue;

    order.push({
      identifier: item.blockId,
      enabled: Boolean(item.enabled)
    });

    if (seenPromptIds.has(item.blockId)) continue;
    seenPromptIds.add(item.blockId);

    const block = doc.blocks[item.blockId];
    if (!block) continue;
    prompts.push(blockToPrompt(block));
  }

  const preset = {
    prompts,
    prompt_order: [
      {
        character_id: profile.characterId,
        order
      }
    ]
  };

  if (includeApiSettings) {
    Object.assign(preset, doc.apiSettings || {});
  }

  if (includeRegex) {
    const selectedSet = new Set(selectedRegexIds);
    const regexScripts = Array.isArray(doc.regexScripts)
      ? doc.regexScripts.filter((script) => typeof script?.id === "string" && selectedSet.has(script.id))
      : [];
    if (regexScripts.length > 0) {
      preset.extensions = {
        regex_scripts: regexScripts
      };
    }
  }

  return preset;
}
