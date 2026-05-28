import { detectSillyTavernApiPreset, importSillyTavernApiPreset } from "/src/importers/sillytavernApiPreset.js";
import { normalizeProjectDoc, createEmptyProjectDoc } from "/src/projectDoc.js";
import { exportProfileText } from "/src/exporters/plainText.js";
import { exportRegexScripts, makeRegexScriptFileName } from "/src/exporters/regexScripts.js";
import { exportSillyTavernPresetJson } from "/src/exporters/sillytavernPreset.js";

const APP_VERSION = "v0.2.3";

const els = {
  appVersion: document.getElementById("appVersion"),
  tabPromptsBtn: document.getElementById("tabPromptsBtn"),
  tabRegexBtn: document.getElementById("tabRegexBtn"),
  tabApiBtn: document.getElementById("tabApiBtn"),
  promptsView: document.getElementById("promptsView"),
  regexView: document.getElementById("regexView"),
  apiView: document.getElementById("apiView"),

  fileInput: document.getElementById("fileInput"),
  newProjectBtn: document.getElementById("newProjectBtn"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  docsBtn: document.getElementById("docsBtn"),
  fileBadge: document.getElementById("fileBadge"),

  promptProfileSelect: document.getElementById("promptProfileSelect"),
  promptFilterInput: document.getElementById("promptFilterInput"),
  addProfileBtn: document.getElementById("addProfileBtn"),
  editProfileIdBtn: document.getElementById("editProfileIdBtn"),
  delProfileBtn: document.getElementById("delProfileBtn"),
  addPromptBtn: document.getElementById("addPromptBtn"),
  dupPromptBtn: document.getElementById("dupPromptBtn"),
  delPromptBtn: document.getElementById("delPromptBtn"),
  promptList: document.getElementById("promptList"),
  promptEditorHint: document.getElementById("promptEditorHint"),
  promptEditor: document.getElementById("promptEditor"),

  exportFormatSelect: document.getElementById("exportFormatSelect"),
  promptModeSelect: document.getElementById("promptModeSelect"),
  includeEmptyCheck: document.getElementById("includeEmptyCheck"),
  jsonOptions: document.getElementById("jsonOptions"),
  includeRegexInJsonCheck: document.getElementById("includeRegexInJsonCheck"),
  includeApiInJsonCheck: document.getElementById("includeApiInJsonCheck"),
  jsonInfo: document.getElementById("jsonInfo"),
  copyExportBtn: document.getElementById("copyExportBtn"),
  downloadExportBtn: document.getElementById("downloadExportBtn"),
  exportOutput: document.getElementById("exportOutput"),

  regexFilterInput: document.getElementById("regexFilterInput"),
  addRegexBtn: document.getElementById("addRegexBtn"),
  dupRegexBtn: document.getElementById("dupRegexBtn"),
  delRegexBtn: document.getElementById("delRegexBtn"),
  selectAllRegexBtn: document.getElementById("selectAllRegexBtn"),
  clearRegexSelectBtn: document.getElementById("clearRegexSelectBtn"),
  regexList: document.getElementById("regexList"),
  regexEditorHint: document.getElementById("regexEditorHint"),
  regexEditor: document.getElementById("regexEditor"),
  exportRegexBtn: document.getElementById("exportRegexBtn"),
  regexExportInfo: document.getElementById("regexExportInfo"),

  apiFilterInput: document.getElementById("apiFilterInput"),
  addApiSettingBtn: document.getElementById("addApiSettingBtn"),
  apiList: document.getElementById("apiList")
};

const state = {
  activeTab: "prompts",
  fileName: null,
  doc: null,

  selectedProfileId: null,
  selectedPromptId: null,
  promptFilter: "",

  selectedRegexId: null,
  selectedRegexIds: new Set(),
  regexFilter: "",

  apiFilter: "",

  exportFormat: "txt",
  txtPromptMode: "enabled",
  jsonPromptMode: "all",
  includeEmpty: false,
  includeRegexInJson: false,
  includeApiInJson: false
};

const PROMPT_ROLE_LABELS = {
  system: "系统",
  user: "用户",
  assistant: "助手",
  tool: "工具"
};

const API_TYPE_LABELS = {
  string: "文本",
  number: "数值",
  boolean: "开关",
  json: "JSON"
};

const API_SETTING_LABELS = {
  temperature: "采样温度",
  top_p: "核采样概率",
  top_k: "Top-K 候选数",
  top_a: "Top-A 采样",
  min_p: "最小概率阈值",
  repetition_penalty: "重复惩罚",
  frequency_penalty: "频率惩罚",
  presence_penalty: "存在惩罚",
  reasoning_effort: "推理强度",
  verbosity: "输出详略等级",
  seed: "随机种子",
  n: "生成候选数量",
  function_calling: "函数调用模式",
  stream_openai: "流式输出",
  show_thoughts: "显示思考过程",
  tool_reasoning_mode: "工具推理模式",
  max_context_unlocked: "解锁最大上下文",
  openai_max_context: "最大上下文长度",
  openai_max_tokens: "最大输出长度",
  send_if_empty: "输入为空时发送",
  names_behavior: "名称处理策略",
  use_sysprompt: "启用系统提示词",
  squash_system_messages: "合并系统消息",
  personality_format: "人设格式模板",
  scenario_format: "场景格式模板",
  wi_format: "世界书条目格式",
  new_chat_prompt: "新建聊天提示词",
  new_group_chat_prompt: "新建群聊提示词",
  new_example_chat_prompt: "示例对话提示词",
  continue_nudge_prompt: "继续生成引导词",
  continue_prefill: "继续生成前缀",
  continue_postfix: "继续生成后缀",
  group_nudge_prompt: "群聊引导词",
  assistant_prefill: "助手预填内容",
  assistant_impersonation: "助手代入提示词",
  impersonation_prompt: "代入提示词",
  bias_preset_selected: "偏置预设",
  media_inlining: "媒体内联",
  inline_image_quality: "内联图片质量",
  request_images: "请求图片生成",
  request_image_aspect_ratio: "图片宽高比",
  request_image_resolution: "图片分辨率",
  enable_web_search: "启用网络搜索",
  extensions: "扩展配置"
};

const REGEX_SWITCH_LABELS = {
  disabled: "禁用",
  markdownOnly: "仅 Markdown 文本",
  promptOnly: "仅提示词",
  runOnEdit: "编辑时执行"
};

function labelWithKey(label, key) {
  return `${label}（${key}）`;
}

function formatPromptRole(role) {
  if (!role) return "未设置";
  const zhLabel = PROMPT_ROLE_LABELS[role];
  return zhLabel || role;
}

function formatApiType(type) {
  const zhLabel = API_TYPE_LABELS[type];
  return zhLabel || type;
}

function formatApiKey(key) {
  const zhLabel = API_SETTING_LABELS[key];
  return zhLabel ? labelWithKey(zhLabel, key) : key;
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function detectProjectDoc(data) {
  return isPlainObject(data) && data.kind === "prompt-doc";
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeUniqueId(existingIds, prefix) {
  const taken = new Set(existingIds);
  let index = 1;
  while (true) {
    const candidate = `${prefix}_${Date.now().toString(36)}_${index}`;
    if (!taken.has(candidate)) return candidate;
    index += 1;
  }
}

function ensureDocLoaded() {
  return Boolean(state.doc);
}

function getBaseFileName() {
  const raw = state.fileName || "预设";
  return raw.replace(/\.json$/i, "");
}

function getActiveProfile() {
  if (!state.doc) return null;
  if (state.selectedProfileId == null) return state.doc.profiles[0] || null;
  const profile = state.doc.profiles.find((p) => Number(p.characterId) === Number(state.selectedProfileId));
  return profile || state.doc.profiles[0] || null;
}

function makeProfileLabel(characterId) {
  return `character_id=${characterId}`;
}

function isProfileIdTaken(characterId, excludedCharacterId = null) {
  if (!state.doc) return false;
  return state.doc.profiles.some(
    (profile) => Number(profile.characterId) === Number(characterId) && Number(profile.characterId) !== Number(excludedCharacterId)
  );
}

function getNextProfileId(excludedCharacterId = null) {
  if (!state.doc) return 100000;
  const used = new Set(
    state.doc.profiles
      .map((profile) => Number(profile.characterId))
      .filter((id) => Number.isInteger(id) && id >= 0 && id !== Number(excludedCharacterId))
  );
  let candidate = 100000;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

function parseProfileIdInput(rawValue, excludedCharacterId = null) {
  const text = (rawValue || "").trim();
  if (!text) {
    return { ok: true, characterId: getNextProfileId(excludedCharacterId), autoAssigned: true };
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, message: "配置组ID必须是非负整数。" };
  }
  if (isProfileIdTaken(value, excludedCharacterId)) {
    return { ok: false, message: `配置组ID已存在：${value}` };
  }
  return { ok: true, characterId: value, autoAssigned: false };
}

function getPromptModeForCurrentFormat() {
  return state.exportFormat === "json" ? state.jsonPromptMode : state.txtPromptMode;
}

function setPromptModeForCurrentFormat(mode) {
  if (state.exportFormat === "json") {
    state.jsonPromptMode = mode;
  } else {
    state.txtPromptMode = mode;
  }
}

function getVisiblePromptEntries(profile) {
  const query = state.promptFilter.trim().toLowerCase();
  const out = [];
  for (let index = 0; index < profile.order.length; index += 1) {
    const entry = profile.order[index];
    const block = state.doc.blocks[entry.blockId];
    const title = block?.title || entry.blockId;
    if (query) {
      const hay = `${title} ${entry.blockId} ${(block?.role || "").trim()}`.toLowerCase();
      if (!hay.includes(query)) continue;
    }
    out.push({ entry, block, index });
  }
  return out;
}

function getVisibleRegexItems() {
  const query = state.regexFilter.trim().toLowerCase();
  const scripts = Array.isArray(state.doc?.regexScripts) ? state.doc.regexScripts : [];
  const out = [];
  for (let index = 0; index < scripts.length; index += 1) {
    const script = scripts[index];
    const name = `${script.scriptName || ""} ${script.id || ""} ${script.findRegex || ""}`.toLowerCase();
    if (query && !name.includes(query)) continue;
    out.push({ script, index });
  }
  return out;
}

function getSelectedPromptEntry(profile) {
  if (!profile || !state.selectedPromptId) return null;
  const index = profile.order.findIndex((entry) => entry.blockId === state.selectedPromptId);
  if (index < 0) return null;
  return { entry: profile.order[index], index };
}

function getSelectedRegex() {
  if (!state.doc || !state.selectedRegexId) return null;
  const index = state.doc.regexScripts.findIndex((script) => script.id === state.selectedRegexId);
  if (index < 0) return null;
  return { script: state.doc.regexScripts[index], index };
}

function resetFilters() {
  state.promptFilter = "";
  state.regexFilter = "";
  state.apiFilter = "";
}

function setLoadedDoc(doc, fileName) {
  state.doc = normalizeProjectDoc(doc);
  state.fileName = fileName;
  state.selectedProfileId = state.doc.profiles[0]?.characterId ?? null;
  state.selectedPromptId = state.doc.profiles[0]?.order?.[0]?.blockId ?? null;
  state.selectedRegexId = state.doc.regexScripts[0]?.id ?? null;
  state.selectedRegexIds = new Set(
    Array.isArray(state.doc?.uiState?.selectedRegexIds)
      ? state.doc.uiState.selectedRegexIds.filter((id) => state.doc.regexScripts.some((script) => script.id === id))
      : []
  );
  resetFilters();
  state.exportFormat = "txt";
  state.txtPromptMode = "enabled";
  state.jsonPromptMode = "all";
  state.includeEmpty = false;
  state.includeRegexInJson = false;
  state.includeApiInJson = false;
}

function setTab(tabName) {
  state.activeTab = tabName;
  els.tabPromptsBtn.classList.toggle("tab--active", tabName === "prompts");
  els.tabRegexBtn.classList.toggle("tab--active", tabName === "regex");
  els.tabApiBtn.classList.toggle("tab--active", tabName === "api");
  els.promptsView.classList.toggle("view--active", tabName === "prompts");
  els.regexView.classList.toggle("view--active", tabName === "regex");
  els.apiView.classList.toggle("view--active", tabName === "api");
}

function enableMainControls(enabled) {
  const ok = Boolean(enabled);
  els.saveProjectBtn.disabled = !ok;

  els.promptProfileSelect.disabled = !ok;
  els.promptFilterInput.disabled = !ok;
  els.addProfileBtn.disabled = !ok;
  els.editProfileIdBtn.disabled = !ok;
  els.delProfileBtn.disabled = !ok;
  els.addPromptBtn.disabled = !ok;
  els.dupPromptBtn.disabled = !ok;
  els.delPromptBtn.disabled = !ok;

  els.exportFormatSelect.disabled = !ok;
  els.promptModeSelect.disabled = !ok;
  els.includeEmptyCheck.disabled = !ok;
  els.includeRegexInJsonCheck.disabled = !ok;
  els.includeApiInJsonCheck.disabled = !ok;
  els.copyExportBtn.disabled = !ok;
  els.downloadExportBtn.disabled = !ok;

  els.regexFilterInput.disabled = !ok;
  els.addRegexBtn.disabled = !ok;
  els.dupRegexBtn.disabled = !ok;
  els.delRegexBtn.disabled = !ok;
  els.selectAllRegexBtn.disabled = !ok;
  els.clearRegexSelectBtn.disabled = !ok;
  els.exportRegexBtn.disabled = !ok;

  els.apiFilterInput.disabled = !ok;
  els.addApiSettingBtn.disabled = !ok;
}

function renderPromptProfileSelect() {
  const profile = getActiveProfile();
  const select = els.promptProfileSelect;
  select.innerHTML = "";
  if (!state.doc) return;
  for (const p of state.doc.profiles) {
    const option = document.createElement("option");
    option.value = String(p.characterId);
    const enabledCount = p.order.filter((entry) => entry.enabled).length;
    option.textContent = `${p.characterId}（启用 ${enabledCount}/${p.order.length}）`;
    select.appendChild(option);
  }
  if (profile) {
    select.value = String(profile.characterId);
  }
}

function addProfile() {
  if (!state.doc) return;
  const activeProfile = getActiveProfile();
  const rawValue = window.prompt("请输入新的配置组ID（character_id）。留空将自动分配。", "");
  if (rawValue == null) return;

  const parsed = parseProfileIdInput(rawValue);
  if (!parsed.ok) {
    alert(parsed.message);
    return;
  }

  const newProfile = {
    characterId: parsed.characterId,
    label: makeProfileLabel(parsed.characterId),
    order: Array.isArray(activeProfile?.order) ? cloneDeep(activeProfile.order) : []
  };
  const activeIndex = state.doc.profiles.findIndex((profile) => Number(profile.characterId) === Number(activeProfile?.characterId));
  const insertIndex = activeIndex >= 0 ? activeIndex + 1 : state.doc.profiles.length;
  state.doc.profiles.splice(insertIndex, 0, newProfile);
  state.selectedProfileId = newProfile.characterId;
  state.selectedPromptId = newProfile.order[0]?.blockId ?? null;
  renderPromptsSection();

  if (parsed.autoAssigned) {
    alert(`已自动分配配置组ID：${newProfile.characterId}`);
  }
}

function editActiveProfileId() {
  if (!state.doc) return;
  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  const rawValue = window.prompt(
    `当前配置组ID：${activeProfile.characterId}\n请输入新的配置组ID（留空自动分配）。`,
    String(activeProfile.characterId)
  );
  if (rawValue == null) return;

  const parsed = parseProfileIdInput(rawValue, activeProfile.characterId);
  if (!parsed.ok) {
    alert(parsed.message);
    return;
  }

  activeProfile.characterId = parsed.characterId;
  activeProfile.label = makeProfileLabel(parsed.characterId);
  state.selectedProfileId = parsed.characterId;
  renderPromptsSection();

  if (parsed.autoAssigned) {
    alert(`已自动分配新的配置组ID：${parsed.characterId}`);
  }
}

function deleteActiveProfile() {
  if (!state.doc) return;
  if (state.doc.profiles.length <= 1) {
    alert("至少需要保留一个配置组，无法删除最后一个。");
    return;
  }

  const activeProfile = getActiveProfile();
  if (!activeProfile) return;
  const activeIndex = state.doc.profiles.findIndex(
    (profile) => Number(profile.characterId) === Number(activeProfile.characterId)
  );
  if (activeIndex < 0) return;

  const total = activeProfile.order.length;
  const enabled = activeProfile.order.filter((entry) => entry.enabled).length;
  const firstConfirm = window.confirm(
    `即将删除配置组 ${activeProfile.characterId}（启用 ${enabled}/${total}）。\n该配置组包含完整提示词顺序信息，删除后不可恢复。\n是否继续？`
  );
  if (!firstConfirm) return;

  const secondConfirm = window.confirm(`请再次确认：删除配置组 ${activeProfile.characterId}。`);
  if (!secondConfirm) return;

  state.doc.profiles.splice(activeIndex, 1);
  const fallbackIndex = Math.min(activeIndex, state.doc.profiles.length - 1);
  const fallbackProfile = state.doc.profiles[fallbackIndex] || state.doc.profiles[0] || null;
  state.selectedProfileId = fallbackProfile?.characterId ?? null;
  state.selectedPromptId = fallbackProfile?.order?.[0]?.blockId ?? null;
  renderPromptsSection();
}

function ensurePromptSelection(profile) {
  if (!profile) {
    state.selectedPromptId = null;
    return;
  }
  const exists = profile.order.some((entry) => entry.blockId === state.selectedPromptId);
  if (!exists) {
    state.selectedPromptId = profile.order[0]?.blockId ?? null;
  }
}

function renderPromptList() {
  if (!state.doc) {
    els.promptList.innerHTML = `<div class="empty">导入预设或新建工程后显示提示词列表。</div>`;
    return;
  }
  const profile = getActiveProfile();
  if (!profile) {
    els.promptList.innerHTML = `<div class="empty">未找到配置档。</div>`;
    return;
  }
  ensurePromptSelection(profile);
  const visibleEntries = getVisiblePromptEntries(profile);
  if (visibleEntries.length === 0) {
    els.promptList.innerHTML = `<div class="empty">没有匹配结果。</div>`;
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const { entry, block, index } of visibleEntries) {
    const row = document.createElement("div");
    row.className = "row row--prompt";
    if (entry.blockId === state.selectedPromptId) row.classList.add("row--active");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = Boolean(entry.enabled);
    check.addEventListener("click", (event) => event.stopPropagation());
    check.addEventListener("change", () => {
      entry.enabled = check.checked;
      renderPromptList();
      renderPromptEditor();
      renderExportPanel();
    });

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "row__title";
    title.textContent = block?.title || `${entry.blockId}（缺失定义）`;
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "row__meta";
    const idPill = document.createElement("span");
    idPill.className = "pill";
    idPill.textContent = entry.blockId;
    meta.appendChild(idPill);
    if (block?.role) {
      const rolePill = document.createElement("span");
      rolePill.className = "pill pill--brand";
      rolePill.textContent = formatPromptRole(block.role);
      meta.appendChild(rolePill);
    }
    if (block?.marker) {
      const markerPill = document.createElement("span");
      markerPill.className = "pill";
      markerPill.textContent = "标记块（marker）";
      meta.appendChild(markerPill);
    }
    body.appendChild(meta);

    const moveWrap = document.createElement("div");
    moveWrap.style.display = "grid";
    moveWrap.style.gap = "4px";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "btn btn--small btn--secondary";
    upBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (index === 0) return;
      const tmp = profile.order[index - 1];
      profile.order[index - 1] = profile.order[index];
      profile.order[index] = tmp;
      renderPromptList();
      renderExportPanel();
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "btn btn--small btn--secondary";
    downBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    downBtn.disabled = index === profile.order.length - 1;
    downBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (index === profile.order.length - 1) return;
      const tmp = profile.order[index + 1];
      profile.order[index + 1] = profile.order[index];
      profile.order[index] = tmp;
      renderPromptList();
      renderExportPanel();
    });

    moveWrap.appendChild(upBtn);
    moveWrap.appendChild(downBtn);

    row.appendChild(check);
    row.appendChild(body);
    row.appendChild(moveWrap);

    row.addEventListener("click", () => {
      state.selectedPromptId = entry.blockId;
      renderPromptEditor();
      renderPromptList();
    });

    fragment.appendChild(row);
  }
  els.promptList.innerHTML = "";
  els.promptList.appendChild(fragment);
}

function renamePromptId(oldId, newIdRaw) {
  const newId = (newIdRaw || "").trim();
  if (!newId) return "ID 不能为空。";
  if (newId === oldId) return null;
  if (state.doc.blocks[newId]) return `ID 已存在：${newId}`;

  const block = state.doc.blocks[oldId];
  if (!block) return `未找到原提示词：${oldId}`;

  delete state.doc.blocks[oldId];
  block.id = newId;
  state.doc.blocks[newId] = block;

  for (const profile of state.doc.profiles) {
    for (const item of profile.order) {
      if (item.blockId === oldId) item.blockId = newId;
    }
  }

  if (state.selectedPromptId === oldId) state.selectedPromptId = newId;
  return null;
}

function buildDefaultPrompt(existingIds) {
  const id = makeUniqueId(existingIds, "prompt");
  return {
    id,
    title: "新提示词",
    role: "system",
    text: "",
    marker: false,
    meta: {
      system_prompt: true,
      injection_position: 0,
      injection_depth: 4,
      injection_order: 100,
      forbid_overrides: false
    }
  };
}

function addPrompt() {
  if (!state.doc) return;
  const profile = getActiveProfile();
  if (!profile) return;
  const prompt = buildDefaultPrompt(Object.keys(state.doc.blocks));
  state.doc.blocks[prompt.id] = prompt;

  const selected = getSelectedPromptEntry(profile);
  const insertIndex = selected ? selected.index + 1 : profile.order.length;
  profile.order.splice(insertIndex, 0, {
    blockId: prompt.id,
    enabled: true
  });
  state.selectedPromptId = prompt.id;
  renderPromptsSection();
}

function duplicatePrompt() {
  if (!state.doc) return;
  const profile = getActiveProfile();
  if (!profile) return;
  const selected = getSelectedPromptEntry(profile);
  if (!selected) return;
  const source = state.doc.blocks[selected.entry.blockId];
  if (!source) return;

  const duplicated = cloneDeep(source);
  duplicated.id = makeUniqueId(Object.keys(state.doc.blocks), "prompt");
  duplicated.title = `${source.title}（副本）`;
  state.doc.blocks[duplicated.id] = duplicated;

  profile.order.splice(selected.index + 1, 0, {
    blockId: duplicated.id,
    enabled: selected.entry.enabled
  });
  state.selectedPromptId = duplicated.id;
  renderPromptsSection();
}

function isPromptReferenced(promptId) {
  if (!state.doc) return false;
  for (const profile of state.doc.profiles) {
    if (profile.order.some((item) => item.blockId === promptId)) return true;
  }
  return false;
}

function deleteSelectedPrompt() {
  if (!state.doc) return;
  const profile = getActiveProfile();
  if (!profile) return;
  const selected = getSelectedPromptEntry(profile);
  if (!selected) return;

  const removed = profile.order.splice(selected.index, 1)[0];
  if (!removed) return;
  if (!isPromptReferenced(removed.blockId)) {
    delete state.doc.blocks[removed.blockId];
  }

  state.selectedPromptId = profile.order[Math.max(0, selected.index - 1)]?.blockId ?? null;
  renderPromptsSection();
}

function renderPromptEditor() {
  if (!state.doc) {
    els.promptEditor.innerHTML = `<div class="empty">选择左侧项后可编辑提示词。</div>`;
    els.promptEditorHint.textContent = "选择左侧项后编辑";
    return;
  }
  const profile = getActiveProfile();
  const selected = getSelectedPromptEntry(profile);
  if (!profile || !selected) {
    els.promptEditor.innerHTML = `<div class="empty">当前配置档中没有可编辑提示词。</div>`;
    els.promptEditorHint.textContent = "当前配置档为空";
    return;
  }
  const block = state.doc.blocks[selected.entry.blockId];
  if (!block) {
    els.promptEditor.innerHTML = `<div class="empty">该提示词在块定义（blocks）中缺失。</div>`;
    els.promptEditorHint.textContent = "缺失定义";
    return;
  }

  els.promptEditorHint.textContent = `正在编辑：${block.title}（${block.id}）`;

  const wrapper = document.createElement("div");
  wrapper.className = "form";

  const row1 = document.createElement("div");
  row1.className = "form__row";
  const idField = document.createElement("div");
  idField.className = "field";
  idField.innerHTML = `<label class="field__label">ID</label>`;
  const idInput = document.createElement("input");
  idInput.type = "text";
  idInput.value = block.id;
  idInput.addEventListener("blur", () => {
    const err = renamePromptId(block.id, idInput.value);
    if (err) {
      alert(err);
      idInput.value = block.id;
      return;
    }
    renderPromptsSection();
  });
  idField.appendChild(idInput);

  const titleField = document.createElement("div");
  titleField.className = "field";
  titleField.innerHTML = `<label class="field__label">标题</label>`;
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = block.title;
  titleInput.addEventListener("input", () => {
    block.title = titleInput.value || block.id;
    renderPromptList();
    renderExportPanel();
  });
  titleField.appendChild(titleInput);

  row1.appendChild(idField);
  row1.appendChild(titleField);

  const row2 = document.createElement("div");
  row2.className = "form__row";

  const roleField = document.createElement("div");
  roleField.className = "field";
  roleField.innerHTML = `<label class="field__label">角色（Role）</label>`;
  const roleSelect = document.createElement("select");
  const roleOptions = ["", "system", "user", "assistant", "tool"];
  for (const role of roleOptions) {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = role ? formatPromptRole(role) : "未设置（none）";
    roleSelect.appendChild(option);
  }
  roleSelect.value = block.role || "";
  roleSelect.addEventListener("change", () => {
    block.role = roleSelect.value || undefined;
    renderPromptList();
    renderExportPanel();
  });
  roleField.appendChild(roleSelect);

  const statusField = document.createElement("div");
  statusField.className = "field";
  statusField.innerHTML = `<label class="field__label">状态</label>`;
  const statusWrap = document.createElement("div");
  statusWrap.style.display = "flex";
  statusWrap.style.gap = "14px";
  const markerCheck = document.createElement("label");
  markerCheck.className = "check";
  markerCheck.innerHTML = `<input type="checkbox" ${block.marker ? "checked" : ""} />标记块（marker）`;
  markerCheck.querySelector("input").addEventListener("change", (event) => {
    block.marker = event.target.checked;
    renderPromptList();
    renderExportPanel();
  });
  const enabledCheck = document.createElement("label");
  enabledCheck.className = "check";
  enabledCheck.innerHTML = `<input type="checkbox" ${selected.entry.enabled ? "checked" : ""} />启用`;
  enabledCheck.querySelector("input").addEventListener("change", (event) => {
    selected.entry.enabled = event.target.checked;
    renderPromptList();
    renderExportPanel();
  });
  statusWrap.appendChild(markerCheck);
  statusWrap.appendChild(enabledCheck);
  statusField.appendChild(statusWrap);

  row2.appendChild(roleField);
  row2.appendChild(statusField);

  const contentField = document.createElement("div");
  contentField.className = "field";
  contentField.innerHTML = `<label class="field__label">内容</label>`;
  const contentArea = document.createElement("textarea");
  contentArea.className = "textarea";
  contentArea.value = block.text || "";
  contentArea.addEventListener("input", () => {
    block.text = contentArea.value;
    renderPromptList();
    renderExportPanel();
  });
  contentField.appendChild(contentArea);

  wrapper.appendChild(row1);
  wrapper.appendChild(row2);
  wrapper.appendChild(contentField);
  els.promptEditor.innerHTML = "";
  els.promptEditor.appendChild(wrapper);
}

function buildDefaultRegex(existingIds) {
  const id = makeUniqueId(existingIds, "regex");
  return {
    id,
    scriptName: "新正则脚本",
    findRegex: "/pattern/g",
    replaceString: "",
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null
  };
}

function addRegex() {
  if (!state.doc) return;
  const regex = buildDefaultRegex(state.doc.regexScripts.map((script) => script.id));
  state.doc.regexScripts.push(regex);
  state.selectedRegexId = regex.id;
  renderRegexSection();
}

function duplicateRegex() {
  if (!state.doc) return;
  const selected = getSelectedRegex();
  if (!selected) return;
  const copied = cloneDeep(selected.script);
  copied.id = makeUniqueId(state.doc.regexScripts.map((script) => script.id), "regex");
  copied.scriptName = `${copied.scriptName || "正则脚本"}（副本）`;
  state.doc.regexScripts.splice(selected.index + 1, 0, copied);
  state.selectedRegexId = copied.id;
  renderRegexSection();
}

function deleteRegex() {
  if (!state.doc) return;
  const selected = getSelectedRegex();
  if (!selected) return;
  const removed = state.doc.regexScripts.splice(selected.index, 1)[0];
  if (!removed) return;
  state.selectedRegexIds.delete(removed.id);
  state.selectedRegexId = state.doc.regexScripts[Math.max(0, selected.index - 1)]?.id ?? null;
  if (state.selectedRegexIds.size === 0) state.includeRegexInJson = false;
  renderRegexSection();
  renderExportPanel();
}

function renameRegexId(oldId, newIdRaw) {
  const newId = (newIdRaw || "").trim();
  if (!newId) return "ID 不能为空。";
  if (newId === oldId) return null;
  if (state.doc.regexScripts.some((script) => script.id === newId)) return `ID 已存在：${newId}`;
  const selected = getSelectedRegex();
  if (!selected) return "未找到选中的正则。";
  selected.script.id = newId;
  if (state.selectedRegexId === oldId) state.selectedRegexId = newId;
  if (state.selectedRegexIds.has(oldId)) {
    state.selectedRegexIds.delete(oldId);
    state.selectedRegexIds.add(newId);
  }
  return null;
}

function ensureRegexSelection() {
  if (!state.doc) {
    state.selectedRegexId = null;
    return;
  }
  const exists = state.doc.regexScripts.some((script) => script.id === state.selectedRegexId);
  if (!exists) {
    state.selectedRegexId = state.doc.regexScripts[0]?.id ?? null;
  }
}

function renderRegexList() {
  if (!state.doc) {
    els.regexList.innerHTML = `<div class="empty">导入预设或新建工程后显示正则列表。</div>`;
    return;
  }
  ensureRegexSelection();
  const visible = getVisibleRegexItems();
  if (visible.length === 0) {
    els.regexList.innerHTML = `<div class="empty">没有匹配结果。</div>`;
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const { script } of visible) {
    const row = document.createElement("div");
    row.className = "row row--regex";
    if (script.id === state.selectedRegexId) row.classList.add("row--active");

    const exportCheck = document.createElement("input");
    exportCheck.type = "checkbox";
    exportCheck.checked = state.selectedRegexIds.has(script.id);
    exportCheck.addEventListener("click", (event) => event.stopPropagation());
    exportCheck.addEventListener("change", () => {
      if (exportCheck.checked) {
        state.selectedRegexIds.add(script.id);
      } else {
        state.selectedRegexIds.delete(script.id);
      }
      if (state.selectedRegexIds.size === 0) state.includeRegexInJson = false;
      renderRegexExportInfo();
      renderExportPanel();
    });

    const status = document.createElement("span");
    status.className = `statusBadge ${script.disabled ? "statusBadge--off" : "statusBadge--on"}`;
    status.textContent = script.disabled ? "停" : "启";

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "row__title";
    title.textContent = script.scriptName || script.id || "未命名脚本";
    const meta = document.createElement("div");
    meta.className = "row__meta";
    const idPill = document.createElement("span");
    idPill.className = "pill";
    idPill.textContent = script.id || "";
    meta.appendChild(idPill);
    if (script.findRegex) {
      const regPill = document.createElement("span");
      regPill.className = "pill";
      regPill.textContent = String(script.findRegex).slice(0, 48);
      meta.appendChild(regPill);
    }
    body.appendChild(title);
    body.appendChild(meta);

    row.appendChild(exportCheck);
    row.appendChild(status);
    row.appendChild(body);

    row.addEventListener("click", () => {
      state.selectedRegexId = script.id;
      renderRegexEditor();
      renderRegexList();
    });
    fragment.appendChild(row);
  }
  els.regexList.innerHTML = "";
  els.regexList.appendChild(fragment);
}

function renderRegexEditor() {
  if (!state.doc) {
    els.regexEditor.innerHTML = `<div class="empty">选择左侧项后可编辑正则。</div>`;
    els.regexEditorHint.textContent = "选择左侧项后编辑";
    return;
  }
  const selected = getSelectedRegex();
  if (!selected) {
    els.regexEditor.innerHTML = `<div class="empty">当前没有可编辑正则。</div>`;
    els.regexEditorHint.textContent = "正则列表为空";
    return;
  }
  const script = selected.script;
  els.regexEditorHint.textContent = `正在编辑：${script.scriptName || script.id}`;

  const wrapper = document.createElement("div");
  wrapper.className = "form";

  const row1 = document.createElement("div");
  row1.className = "form__row";
  const idField = document.createElement("div");
  idField.className = "field";
  idField.innerHTML = `<label class="field__label">ID</label>`;
  const idInput = document.createElement("input");
  idInput.type = "text";
  idInput.value = script.id || "";
  idInput.addEventListener("blur", () => {
    const err = renameRegexId(script.id, idInput.value);
    if (err) {
      alert(err);
      idInput.value = script.id || "";
      return;
    }
    renderRegexSection();
    renderExportPanel();
  });
  idField.appendChild(idInput);

  const nameField = document.createElement("div");
  nameField.className = "field";
  nameField.innerHTML = `<label class="field__label">脚本名</label>`;
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = script.scriptName || "";
  nameInput.addEventListener("input", () => {
    script.scriptName = nameInput.value;
    renderRegexList();
  });
  nameField.appendChild(nameInput);

  row1.appendChild(idField);
  row1.appendChild(nameField);

  const row2 = document.createElement("div");
  row2.className = "form__row";

  const findField = document.createElement("div");
  findField.className = "field";
  findField.innerHTML = `<label class="field__label">匹配表达式（findRegex）</label>`;
  const findInput = document.createElement("input");
  findInput.type = "text";
  findInput.value = script.findRegex || "";
  findInput.addEventListener("input", () => {
    script.findRegex = findInput.value;
    renderRegexList();
  });
  findField.appendChild(findInput);

  const replaceField = document.createElement("div");
  replaceField.className = "field";
  replaceField.innerHTML = `<label class="field__label">替换文本（replaceString）</label>`;
  const replaceInput = document.createElement("input");
  replaceInput.type = "text";
  replaceInput.value = script.replaceString || "";
  replaceInput.addEventListener("input", () => {
    script.replaceString = replaceInput.value;
  });
  replaceField.appendChild(replaceInput);

  row2.appendChild(findField);
  row2.appendChild(replaceField);

  const row3 = document.createElement("div");
  row3.className = "form__row";
  const trimField = document.createElement("div");
  trimField.className = "field";
  trimField.innerHTML = `<label class="field__label">裁剪字符串列表（trimStrings，逗号分隔）</label>`;
  const trimInput = document.createElement("input");
  trimInput.type = "text";
  trimInput.value = Array.isArray(script.trimStrings) ? script.trimStrings.join(", ") : "";
  trimInput.addEventListener("input", () => {
    script.trimStrings = trimInput.value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  });
  trimField.appendChild(trimInput);

  const placementField = document.createElement("div");
  placementField.className = "field";
  placementField.innerHTML = `<label class="field__label">执行位置（placement，逗号分隔）</label>`;
  const placementInput = document.createElement("input");
  placementInput.type = "text";
  placementInput.value = Array.isArray(script.placement) ? script.placement.join(", ") : "";
  placementInput.addEventListener("input", () => {
    script.placement = placementInput.value
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x));
  });
  placementField.appendChild(placementInput);

  row3.appendChild(trimField);
  row3.appendChild(placementField);

  const row4 = document.createElement("div");
  row4.className = "form__row";
  const subField = document.createElement("div");
  subField.className = "field";
  subField.innerHTML = `<label class="field__label">替代正则（substituteRegex）</label>`;
  const subInput = document.createElement("input");
  subInput.type = "number";
  subInput.value = String(script.substituteRegex ?? 0);
  subInput.addEventListener("input", () => {
    const value = Number(subInput.value);
    script.substituteRegex = Number.isFinite(value) ? value : 0;
  });
  subField.appendChild(subInput);

  const depthField = document.createElement("div");
  depthField.className = "field";
  depthField.innerHTML = `<label class="field__label">最小/最大层数（minDepth / maxDepth，留空为 null）</label>`;
  const depthWrap = document.createElement("div");
  depthWrap.style.display = "grid";
  depthWrap.style.gridTemplateColumns = "1fr 1fr";
  depthWrap.style.gap = "8px";
  const minInput = document.createElement("input");
  minInput.type = "number";
  minInput.placeholder = "最小层数（minDepth）";
  minInput.value = script.minDepth == null ? "" : String(script.minDepth);
  const maxInput = document.createElement("input");
  maxInput.type = "number";
  maxInput.placeholder = "最大层数（maxDepth）";
  maxInput.value = script.maxDepth == null ? "" : String(script.maxDepth);
  function syncDepth() {
    const minValue = minInput.value.trim() === "" ? null : Number(minInput.value);
    const maxValue = maxInput.value.trim() === "" ? null : Number(maxInput.value);
    script.minDepth = minValue == null || Number.isFinite(minValue) ? minValue : null;
    script.maxDepth = maxValue == null || Number.isFinite(maxValue) ? maxValue : null;
  }
  minInput.addEventListener("input", syncDepth);
  maxInput.addEventListener("input", syncDepth);
  depthWrap.appendChild(minInput);
  depthWrap.appendChild(maxInput);
  depthField.appendChild(depthWrap);

  row4.appendChild(subField);
  row4.appendChild(depthField);

  const row5 = document.createElement("div");
  row5.className = "form__row form__row--single";
  const checks = document.createElement("div");
  checks.className = "field";
  checks.innerHTML = `<label class="field__label">开关</label>`;
  const checkWrap = document.createElement("div");
  checkWrap.style.display = "flex";
  checkWrap.style.flexWrap = "wrap";
  checkWrap.style.gap = "12px";
  const checkDefs = [
    ["disabled", REGEX_SWITCH_LABELS.disabled],
    ["markdownOnly", REGEX_SWITCH_LABELS.markdownOnly],
    ["promptOnly", REGEX_SWITCH_LABELS.promptOnly],
    ["runOnEdit", REGEX_SWITCH_LABELS.runOnEdit]
  ];
  for (const [key, label] of checkDefs) {
    const labelNode = document.createElement("label");
    labelNode.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(script[key]);
    input.addEventListener("change", () => {
      script[key] = input.checked;
      renderRegexList();
      renderRegexExportInfo();
    });
    labelNode.appendChild(input);
    labelNode.appendChild(document.createTextNode(label));
    checkWrap.appendChild(labelNode);
  }
  checks.appendChild(checkWrap);
  row5.appendChild(checks);

  wrapper.appendChild(row1);
  wrapper.appendChild(row2);
  wrapper.appendChild(row3);
  wrapper.appendChild(row4);
  wrapper.appendChild(row5);

  els.regexEditor.innerHTML = "";
  els.regexEditor.appendChild(wrapper);

  // 讓最後一個開關區塊不要過度擠壓，但保持表單結構
  wrapper.style.flex = "1";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.minHeight = "0";
}

function detectApiType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "json";
}

function parseValueByType(type, rawValue) {
  if (type === "boolean") return Boolean(rawValue);
  if (type === "number") {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return 0;
    return value;
  }
  if (type === "string") return String(rawValue ?? "");
  if (typeof rawValue === "string") {
    return JSON.parse(rawValue);
  }
  return rawValue;
}

function renderApiSettings() {
  if (!state.doc) {
    els.apiList.innerHTML = `<div class="empty">导入预设或新建工程后显示 API 配置。</div>`;
    return;
  }
  const apiSettings = state.doc.apiSettings || {};
  const filter = state.apiFilter.trim().toLowerCase();
  const keys = Object.keys(apiSettings).filter((key) => key.toLowerCase().includes(filter));
  keys.sort((a, b) => a.localeCompare(b));

  if (keys.length === 0) {
    els.apiList.innerHTML = `<div class="empty">没有匹配的配置项。</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const key of keys) {
    const value = apiSettings[key];
    const type = detectApiType(value);

    const row = document.createElement("div");
    row.className = "apiRow";

    const keyNode = document.createElement("div");
    keyNode.className = "apiKey";
    keyNode.textContent = formatApiKey(key);

    const typeSelect = document.createElement("select");
    typeSelect.className = "apiType";
    for (const optionType of ["string", "number", "boolean", "json"]) {
      const option = document.createElement("option");
      option.value = optionType;
      option.textContent = formatApiType(optionType);
      typeSelect.appendChild(option);
    }
    typeSelect.value = type;
    typeSelect.addEventListener("change", () => {
      if (typeSelect.value === "string") apiSettings[key] = "";
      if (typeSelect.value === "number") apiSettings[key] = 0;
      if (typeSelect.value === "boolean") apiSettings[key] = false;
      if (typeSelect.value === "json") apiSettings[key] = {};
      renderApiSettings();
      renderExportPanel();
    });

    const valueWrap = document.createElement("div");
    valueWrap.className = "apiValue";
    if (type === "boolean") {
      const boolInput = document.createElement("input");
      boolInput.type = "checkbox";
      boolInput.checked = Boolean(value);
      boolInput.addEventListener("change", () => {
        apiSettings[key] = boolInput.checked;
        renderExportPanel();
      });
      valueWrap.appendChild(boolInput);
    } else if (type === "json") {
      const jsonInput = document.createElement("textarea");
      jsonInput.style.minHeight = "74px";
      jsonInput.style.resize = "vertical";
      jsonInput.value = JSON.stringify(value, null, 2);
      jsonInput.addEventListener("blur", () => {
        try {
          apiSettings[key] = parseValueByType("json", jsonInput.value);
          jsonInput.style.borderColor = "";
          renderExportPanel();
        } catch {
          jsonInput.style.borderColor = "var(--danger)";
          alert(`JSON 解析失败：${formatApiKey(key)}`);
          jsonInput.value = JSON.stringify(apiSettings[key], null, 2);
        }
      });
      valueWrap.appendChild(jsonInput);
    } else {
      const input = document.createElement("input");
      input.type = type === "number" ? "number" : "text";
      input.value = String(value ?? "");
      input.addEventListener("input", () => {
        apiSettings[key] = parseValueByType(type, input.value);
        renderExportPanel();
      });
      valueWrap.appendChild(input);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn--small btn--danger";
    removeBtn.textContent = "删除";
    removeBtn.addEventListener("click", () => {
      delete apiSettings[key];
      renderApiSettings();
      renderExportPanel();
    });

    row.appendChild(keyNode);
    row.appendChild(typeSelect);
    row.appendChild(valueWrap);
    row.appendChild(removeBtn);
    fragment.appendChild(row);
  }

  els.apiList.innerHTML = "";
  els.apiList.appendChild(fragment);
}

function renderRegexExportInfo() {
  const selectedCount = state.selectedRegexIds.size;
  els.regexExportInfo.textContent = `已选中 ${selectedCount} 条`;
  els.exportRegexBtn.disabled = !state.doc || selectedCount === 0;
}

function renderExportPanel() {
  if (!state.doc) {
    els.exportOutput.value = "";
    els.jsonOptions.hidden = true;
    els.jsonInfo.textContent = "";
    return;
  }
  const profile = getActiveProfile();
  if (!profile) {
    els.exportOutput.value = "";
    return;
  }

  const promptMode = getPromptModeForCurrentFormat();
  els.exportFormatSelect.value = state.exportFormat;
  els.promptModeSelect.value = promptMode;
  els.includeEmptyCheck.checked = state.includeEmpty;
  els.jsonOptions.hidden = state.exportFormat !== "json";
  els.includeEmptyCheck.disabled = state.exportFormat !== "txt";

  if (state.exportFormat === "json") {
    if (state.selectedRegexIds.size === 0) {
      state.includeRegexInJson = false;
      els.includeRegexInJsonCheck.disabled = true;
    } else {
      els.includeRegexInJsonCheck.disabled = false;
    }
    els.includeRegexInJsonCheck.checked = state.includeRegexInJson;
    els.includeApiInJsonCheck.checked = state.includeApiInJson;
    els.jsonInfo.textContent =
      `JSON 导出默认不携带正则与 API 配置。` +
      ` 当前正则选择：${state.selectedRegexIds.size} 条。`;
  }

  try {
    if (state.exportFormat === "json") {
      const exportedJson = exportSillyTavernPresetJson(state.doc, {
        characterId: profile.characterId,
        promptMode: state.jsonPromptMode,
        includeRegex: state.includeRegexInJson,
        includeApiSettings: state.includeApiInJson,
        selectedRegexIds: Array.from(state.selectedRegexIds)
      });
      els.exportOutput.value = JSON.stringify(exportedJson, null, 2);
    } else {
      const exportedText = exportProfileText(state.doc, {
        characterId: profile.characterId,
        format: "plain",
        promptMode: state.txtPromptMode,
        includeEmpty: state.includeEmpty
      });
      els.exportOutput.value = exportedText.text;
    }
  } catch (err) {
    els.exportOutput.value = `导出失败: ${String(err?.message || err)}`;
  }
}

function renderPromptsSection() {
  renderPromptProfileSelect();
  renderPromptList();
  renderPromptEditor();
  renderExportPanel();
}

function renderRegexSection() {
  renderRegexList();
  renderRegexEditor();
  renderRegexExportInfo();
}

function renderAll() {
  const loaded = ensureDocLoaded();
  enableMainControls(loaded);
  if (!loaded) {
    els.fileBadge.textContent = "未加载";
    els.promptList.innerHTML = `<div class="empty">导入预设或新建工程后显示提示词列表。</div>`;
    els.promptEditor.innerHTML = `<div class="empty">选择左侧项后可编辑提示词。</div>`;
    els.exportOutput.value = "";
    els.regexList.innerHTML = `<div class="empty">导入预设或新建工程后显示正则列表。</div>`;
    els.regexEditor.innerHTML = `<div class="empty">选择左侧项后可编辑正则。</div>`;
    els.apiList.innerHTML = `<div class="empty">导入预设或新建工程后显示 API 配置。</div>`;
    els.regexExportInfo.textContent = "已选中 0 条";
    return;
  }
  els.fileBadge.textContent = state.fileName || "未命名工程";
  renderPromptsSection();
  renderRegexSection();
  renderApiSettings();
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function exportSelectedRegexFiles() {
  if (!state.doc) return;
  const selectedIds = Array.from(state.selectedRegexIds);
  if (selectedIds.length === 0) return;

  const scripts = exportRegexScripts(state.doc, {
    includeDisabled: true,
    selectedIds
  });

  for (let i = 0; i < scripts.length; i += 1) {
    const fileName = makeRegexScriptFileName(scripts[i], i);
    downloadFile(fileName, JSON.stringify(scripts[i], null, 2), "application/json;charset=utf-8");
  }
}

function saveProjectFile() {
  if (!state.doc) return;
  state.doc.uiState = state.doc.uiState || {};
  state.doc.uiState.selectedRegexIds = Array.from(state.selectedRegexIds);
  const payload = JSON.stringify(state.doc, null, 2);
  downloadFile(`${getBaseFileName()}.project.json`, payload, "application/json;charset=utf-8");
}

async function loadInputFile(file) {
  const rawText = await file.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`JSON 解析失败：${String(err?.message || err)}`);
  }

  if (detectSillyTavernApiPreset(data)) {
    setLoadedDoc(
      importSillyTavernApiPreset({
        data,
        sourcePath: file.name,
        title: file.name
      }),
      file.name
    );
    return;
  }

  if (detectProjectDoc(data)) {
    setLoadedDoc(normalizeProjectDoc(data), file.name);
    return;
  }

  throw new Error("不支持的格式：仅支持 SillyTavern（酒馆）API 预设 JSON 或本工具工程 JSON。");
}

function createNewProject() {
  setLoadedDoc(createEmptyProjectDoc("未命名工程"), "未命名工程.project.json");
}

els.tabPromptsBtn.addEventListener("click", () => setTab("prompts"));
els.tabRegexBtn.addEventListener("click", () => setTab("regex"));
els.tabApiBtn.addEventListener("click", () => setTab("api"));

els.docsBtn.addEventListener("click", () => {
  window.open("/web/docs.html", "_blank", "noopener");
});

els.fileInput.addEventListener("change", async () => {
  const file = els.fileInput.files?.[0];
  if (!file) return;
  try {
    await loadInputFile(file);
    renderAll();
  } catch (err) {
    alert(String(err?.message || err));
  } finally {
    els.fileInput.value = "";
  }
});

els.newProjectBtn.addEventListener("click", () => {
  createNewProject();
  renderAll();
});

els.saveProjectBtn.addEventListener("click", saveProjectFile);

els.promptProfileSelect.addEventListener("change", () => {
  state.selectedProfileId = Number(els.promptProfileSelect.value);
  state.selectedPromptId = null;
  renderPromptsSection();
});

els.addProfileBtn.addEventListener("click", addProfile);
els.editProfileIdBtn.addEventListener("click", editActiveProfileId);
els.delProfileBtn.addEventListener("click", deleteActiveProfile);

els.promptFilterInput.addEventListener("input", () => {
  state.promptFilter = els.promptFilterInput.value;
  renderPromptList();
});

els.addPromptBtn.addEventListener("click", addPrompt);
els.dupPromptBtn.addEventListener("click", duplicatePrompt);
els.delPromptBtn.addEventListener("click", deleteSelectedPrompt);

els.exportFormatSelect.addEventListener("change", () => {
  state.exportFormat = els.exportFormatSelect.value;
  renderExportPanel();
});

els.promptModeSelect.addEventListener("change", () => {
  setPromptModeForCurrentFormat(els.promptModeSelect.value);
  renderExportPanel();
});

els.includeEmptyCheck.addEventListener("change", () => {
  state.includeEmpty = els.includeEmptyCheck.checked;
  renderExportPanel();
});

els.includeRegexInJsonCheck.addEventListener("change", () => {
  state.includeRegexInJson = els.includeRegexInJsonCheck.checked;
  renderExportPanel();
});

els.includeApiInJsonCheck.addEventListener("change", () => {
  state.includeApiInJson = els.includeApiInJsonCheck.checked;
  renderExportPanel();
});

els.copyExportBtn.addEventListener("click", async () => {
  const ok = await copyText(els.exportOutput.value || "");
  els.copyExportBtn.textContent = ok ? "已复制" : "复制失败";
  setTimeout(() => {
    els.copyExportBtn.textContent = "复制";
  }, 900);
});

els.downloadExportBtn.addEventListener("click", () => {
  const profile = getActiveProfile();
  const profileId = profile?.characterId ?? "未指定";
  if (state.exportFormat === "json") {
    downloadFile(
      `${getBaseFileName()}-配置档${profileId}.json`,
      els.exportOutput.value || "{}",
      "application/json;charset=utf-8"
    );
  } else {
    downloadFile(`${getBaseFileName()}-配置档${profileId}.txt`, els.exportOutput.value || "", "text/plain;charset=utf-8");
  }
});

els.regexFilterInput.addEventListener("input", () => {
  state.regexFilter = els.regexFilterInput.value;
  renderRegexList();
});

els.addRegexBtn.addEventListener("click", addRegex);
els.dupRegexBtn.addEventListener("click", duplicateRegex);
els.delRegexBtn.addEventListener("click", deleteRegex);

els.selectAllRegexBtn.addEventListener("click", () => {
  if (!state.doc) return;
  state.selectedRegexIds = new Set(state.doc.regexScripts.map((script) => script.id).filter((id) => typeof id === "string"));
  renderRegexSection();
  renderExportPanel();
});

els.clearRegexSelectBtn.addEventListener("click", () => {
  state.selectedRegexIds.clear();
  state.includeRegexInJson = false;
  renderRegexSection();
  renderExportPanel();
});

els.exportRegexBtn.addEventListener("click", exportSelectedRegexFiles);

els.apiFilterInput.addEventListener("input", () => {
  state.apiFilter = els.apiFilterInput.value;
  renderApiSettings();
});

els.addApiSettingBtn.addEventListener("click", () => {
  if (!state.doc) return;
  const key = (window.prompt("请输入配置键（例如：temperature，表示采样温度）") || "").trim();
  if (!key) return;
  if (Object.prototype.hasOwnProperty.call(state.doc.apiSettings, key)) {
    alert(`配置已存在：${key}`);
    return;
  }
  state.doc.apiSettings[key] = "";
  renderApiSettings();
  renderExportPanel();
});

if (els.appVersion) {
  els.appVersion.textContent = APP_VERSION;
}

setTab("prompts");
renderAll();
