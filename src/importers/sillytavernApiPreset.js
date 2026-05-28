import { normalizeProjectDoc } from "../projectDoc.js";

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function detectSillyTavernApiPreset(data) {
  if (!isPlainObject(data)) return false;
  if (!Array.isArray(data.prompts)) return false;
  if (!Array.isArray(data.prompt_order)) return false;
  const first = data.prompts[0];
  if (!isPlainObject(first)) return false;
  return typeof first.identifier === "string";
}

export function importSillyTavernApiPreset({ data, sourcePath, title }) {
  const blocks = {};
  for (const prompt of data.prompts) {
    if (!isPlainObject(prompt)) continue;
    const id = typeof prompt.identifier === "string" ? prompt.identifier : null;
    if (!id) continue;
    const blockTitle = typeof prompt.name === "string" && prompt.name.trim() ? prompt.name : id;
    const role = typeof prompt.role === "string" ? prompt.role : undefined;
    const text = typeof prompt.content === "string" ? prompt.content : "";
    const marker = Boolean(prompt.marker);

    const { identifier, name, content, ...meta } = prompt;
    blocks[id] = {
      id,
      title: blockTitle,
      role,
      text,
      marker,
      meta
    };
  }

  const profiles = [];
  for (const po of data.prompt_order) {
    if (!isPlainObject(po)) continue;
    if (!Array.isArray(po.order)) continue;
    const characterId = Number(po.character_id);
    const label = `character_id=${Number.isFinite(characterId) ? characterId : String(po.character_id)}`;
    const order = [];
    for (const item of po.order) {
      if (!isPlainObject(item)) continue;
      if (typeof item.identifier !== "string") continue;
      order.push({
        blockId: item.identifier,
        enabled: Boolean(item.enabled)
      });
    }
    profiles.push({ characterId, label, order });
  }

  const regexScriptsRaw = data?.extensions?.regex_scripts;
  const regexScripts = Array.isArray(regexScriptsRaw) ? regexScriptsRaw.filter((x) => isPlainObject(x)) : [];

  const { prompts, prompt_order, extensions, ...topLevelRest } = data;

  return normalizeProjectDoc({
    kind: "prompt-doc",
    version: 2,
    title: title || "Untitled",
    source: {
      format: "sillytavern_api_preset",
      path: sourcePath
    },
    blocks,
    profiles,
    regexScripts,
    apiSettings: topLevelRest,
    uiState: {
      selectedRegexIds: []
    }
  });
}
