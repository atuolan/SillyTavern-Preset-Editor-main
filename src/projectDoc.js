function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeLabel(characterId) {
  return `character_id=${characterId}`;
}

function normalizeBlocks(blocks) {
  const out = {};
  if (!isPlainObject(blocks)) return out;
  for (const [id, block] of Object.entries(blocks)) {
    if (!isPlainObject(block)) continue;
    const blockId = typeof block.id === "string" && block.id ? block.id : id;
    out[blockId] = {
      id: blockId,
      title: typeof block.title === "string" && block.title.trim() ? block.title : blockId,
      role: typeof block.role === "string" ? block.role : undefined,
      text: typeof block.text === "string" ? block.text : "",
      marker: Boolean(block.marker),
      meta: isPlainObject(block.meta) ? cloneDeep(block.meta) : {}
    };
  }
  return out;
}

function normalizeProfiles(profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return [
      {
        characterId: 100000,
        label: makeLabel(100000),
        order: []
      }
    ];
  }
  const out = [];
  for (const profile of profiles) {
    if (!isPlainObject(profile)) continue;
    const rawCharacterId = Number(profile.characterId);
    const characterId = Number.isFinite(rawCharacterId) ? rawCharacterId : 100000 + out.length;
    const order = [];
    if (Array.isArray(profile.order)) {
      for (const item of profile.order) {
        if (!isPlainObject(item)) continue;
        if (typeof item.blockId !== "string") continue;
        order.push({
          blockId: item.blockId,
          enabled: Boolean(item.enabled)
        });
      }
    }
    out.push({
      characterId,
      label: typeof profile.label === "string" && profile.label.trim() ? profile.label : makeLabel(characterId),
      order
    });
  }
  if (out.length === 0) {
    return [
      {
        characterId: 100000,
        label: makeLabel(100000),
        order: []
      }
    ];
  }
  return out;
}

function normalizeRegexScripts(regexScripts) {
  if (!Array.isArray(regexScripts)) return [];
  const out = [];
  for (const script of regexScripts) {
    if (!isPlainObject(script)) continue;
    out.push(cloneDeep(script));
  }
  return out;
}

function normalizeApiSettings(apiSettings) {
  if (!isPlainObject(apiSettings)) return {};
  return cloneDeep(apiSettings);
}

export function createEmptyProjectDoc(title = "Untitled Project") {
  const characterId = 100000;
  return {
    kind: "prompt-doc",
    version: 2,
    title,
    source: {
      format: "project",
      path: null
    },
    blocks: {},
    profiles: [
      {
        characterId,
        label: makeLabel(characterId),
        order: []
      }
    ],
    regexScripts: [],
    apiSettings: {},
    uiState: {
      selectedRegexIds: []
    }
  };
}

export function normalizeProjectDoc(inputDoc) {
  if (!isPlainObject(inputDoc)) return createEmptyProjectDoc();

  // v2 format
  if (inputDoc.kind === "prompt-doc" && Number(inputDoc.version) >= 2) {
    return {
      kind: "prompt-doc",
      version: 2,
      title: typeof inputDoc.title === "string" && inputDoc.title.trim() ? inputDoc.title : "Untitled Project",
      source: isPlainObject(inputDoc.source)
        ? {
            format: typeof inputDoc.source.format === "string" ? inputDoc.source.format : "project",
            path: typeof inputDoc.source.path === "string" ? inputDoc.source.path : null
          }
        : { format: "project", path: null },
      blocks: normalizeBlocks(inputDoc.blocks),
      profiles: normalizeProfiles(inputDoc.profiles),
      regexScripts: normalizeRegexScripts(inputDoc.regexScripts),
      apiSettings: normalizeApiSettings(inputDoc.apiSettings),
      uiState: {
        selectedRegexIds: Array.isArray(inputDoc?.uiState?.selectedRegexIds)
          ? inputDoc.uiState.selectedRegexIds.filter((id) => typeof id === "string")
          : []
      }
    };
  }

  // Backward compatibility with v1 format from previous iterations.
  const v1TopLevel = isPlainObject(inputDoc?.extensions?.topLevel) ? inputDoc.extensions.topLevel : {};
  const v1RegexScripts = Array.isArray(inputDoc?.artifacts?.regexScripts) ? inputDoc.artifacts.regexScripts : [];

  const { extensions, prompts, prompt_order, ...apiSettings } = v1TopLevel;

  return {
    kind: "prompt-doc",
    version: 2,
    title: typeof inputDoc.title === "string" && inputDoc.title.trim() ? inputDoc.title : "Untitled Project",
    source: isPlainObject(inputDoc.source)
      ? {
          format: typeof inputDoc.source.format === "string" ? inputDoc.source.format : "project",
          path: typeof inputDoc.source.path === "string" ? inputDoc.source.path : null
        }
      : { format: "project", path: null },
    blocks: normalizeBlocks(inputDoc.blocks),
    profiles: normalizeProfiles(inputDoc.profiles),
    regexScripts: normalizeRegexScripts(v1RegexScripts),
    apiSettings: normalizeApiSettings(apiSettings),
    uiState: {
      selectedRegexIds: []
    }
  };
}

