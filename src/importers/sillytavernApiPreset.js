import { normalizeProjectDoc } from "../projectDoc.js";

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function detectSillyTavernApiPreset(data) {
  if (!isPlainObject(data)) return false;
  if (!Array.isArray(data.prompts)) return false;
  const first = data.prompts[0];
  if (!isPlainObject(first)) return false;
  if (typeof first.identifier !== "string") return false;

  // 標準 SillyTavern API 預設會包含 prompt_order；部分匯出的 prompt-only
  // JSON 只有 prompts 陣列，仍可用 prompts 內的 enabled / injection_order 建立預設順序。
  if (data.prompt_order == null) return true;
  return Array.isArray(data.prompt_order);
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
  if (Array.isArray(data.prompt_order)) {
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
  }

  if (profiles.length === 0) {
    const sortedPrompts = data.prompts
      .filter((prompt) => isPlainObject(prompt) && typeof prompt.identifier === "string")
      .map((prompt, index) => ({ prompt, index }))
      .sort((a, b) => {
        const aOrder = Number(a.prompt.injection_order);
        const bOrder = Number(b.prompt.injection_order);
        const aHasOrder = Number.isFinite(aOrder);
        const bHasOrder = Number.isFinite(bOrder);
        if (aHasOrder && bHasOrder && aOrder !== bOrder) return aOrder - bOrder;
        if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
        return a.index - b.index;
      });

    profiles.push({
      characterId: 100000,
      label: "prompt-only",
      order: sortedPrompts.map(({ prompt }) => ({
        blockId: prompt.identifier,
        enabled: typeof prompt.enabled === "boolean" ? prompt.enabled : true
      }))
    });
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
