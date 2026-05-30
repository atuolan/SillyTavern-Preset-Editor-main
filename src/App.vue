<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { detectSillyTavernApiPreset, importSillyTavernApiPreset } from './importers/sillytavernApiPreset.js';
import { normalizeProjectDoc, createEmptyProjectDoc } from './projectDoc.js';
import { exportProfileText } from './exporters/plainText.js';
import { exportRegexScripts, makeRegexScriptFileName } from './exporters/regexScripts.js';
import { exportSillyTavernPresetJson } from './exporters/sillytavernPreset.js';

const APP_VERSION = "v0.2.3";

// 常量定義
const PROMPT_ROLE_LABELS = {
  system: "系統",
  user: "用戶",
  assistant: "助手",
  tool: "工具"
};

const API_TYPE_LABELS = {
  string: "文本",
  number: "數值",
  boolean: "開關",
  json: "JSON"
};

const API_SETTING_LABELS = {
  temperature: "採樣溫度",
  top_p: "核採樣概率",
  top_k: "Top-K 候選數",
  top_a: "Top-A 採樣",
 min_p: "最小概率閾值",
  repetition_penalty: "重複懲罰",
  frequency_penalty: "頻率懲罰",
  presence_penalty: "存在懲罰",
  reasoning_effort: "推理強度",
  verbosity: "輸出詳略等級",
  seed: "隨機種子",
  n: "生成候選數量",
  function_calling: "函數調用模式",
  stream_openai: "流式輸出",
  show_thoughts: "顯示思考過程",
  tool_reasoning_mode: "工具推理模式",
  max_context_unlocked: "解鎖最大上下文",
  openai_max_context: "最大上下文長度",
  openai_max_tokens: "最大輸出長度",
  send_if_empty: "輸入為空時發送",
  names_behavior: "名稱處理策略",
  use_sysprompt: "啟用系統提示詞",
  squash_system_messages: "合併系統消息",
  personality_format: "人設格式模板",
  scenario_format: "場景格式模板",
  wi_format: "世界書條目格式",
  new_chat_prompt: "新建聊天提示詞",
  new_group_chat_prompt: "新建群聊提示詞",
  new_example_chat_prompt: "示例對話提示詞",
  continue_nudge_prompt: "繼續生成引導詞",
  continue_prefill: "繼續生成前綴",
  continue_postfix: "繼續生成後綴",
  group_nudge_prompt: "群聊引導詞",
  assistant_prefill: "助手預填內容",
  assistant_impersonation: "助手代入提示詞",
  impersonation_prompt: "代入提示詞",
  bias_preset_selected: "偏置預設",
  media_inlining: "媒體內聯",
  inline_image_quality: "內聯圖片質量",
  request_images: "請求圖片生成",
  request_image_aspect_ratio: "圖片寬高比",
  request_image_resolution: "圖片分辨率",
  enable_web_search: "啟用網絡搜索",
  extensions: "擴展配置"
};

const REGEX_SWITCH_LABELS = {
  disabled: "禁用",
  markdownOnly: "僅 Markdown 文本",
  promptOnly: "僅提示詞",
  runOnEdit: "編輯時執行"
};

// 響應式狀態
const activeTab = ref('prompts'); // 'prompts' | 'regex' | 'api'
const mobileSubTab = ref('edit'); // 'edit' | 'preview' (用於提示詞分頁的手機版)
const mobileRegexSubTab = ref('list'); // 'list' | 'edit' (用於正則分頁的手機版)
const mobilePromptDrawerOpen = ref(false);
const mobileMenuOpen = ref(false);
const promptSearchCursor = ref(0);

const isDark = ref(false);
const editorScrollTop = ref(0);
const modalInputRef = ref(null);
const expandEditorOpen = ref(false);
const modalState = ref({
  show: false,
  type: 'alert',
  title: '',
  message: '',
  placeholder: '',
  inputValue: '',
  resolve: null,
  reject: null
});

function customAlert(message, title = "系統提示") {
  return new Promise((resolve) => {
    modalState.value = {
      show: true,
      type: 'alert',
      title,
      message,
      placeholder: '',
      inputValue: '',
      resolve: () => {
        modalState.value.show = false;
        resolve();
      },
      reject: () => {
        modalState.value.show = false;
        resolve();
      }
    };
  });
}

function customConfirm(message, title = "確認執行") {
  return new Promise((resolve) => {
    modalState.value = {
      show: true,
      type: 'confirm',
      title,
      message,
      placeholder: '',
      inputValue: '',
      resolve: () => {
        modalState.value.show = false;
        resolve(true);
      },
      reject: () => {
        modalState.value.show = false;
        resolve(false);
      }
    };
  });
}

function customPrompt(message, defaultValue = "", placeholder = "", title = "需要輸入") {
  return new Promise((resolve) => {
    modalState.value = {
      show: true,
      type: 'prompt',
      title,
      message,
      placeholder,
      inputValue: defaultValue,
      resolve: () => {
        modalState.value.show = false;
        resolve(modalState.value.inputValue);
      },
      reject: () => {
        modalState.value.show = false;
        resolve(null);
      }
    };
  });
}

const alert = (msg) => customAlert(msg);
const confirm = (msg) => customConfirm(msg);
const prompt = (msg, def = "") => customPrompt(msg, def);

function toggleTheme() {
  isDark.value = !isDark.value;
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
  if (isDark.value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function handleEditorScroll(event) {
  editorScrollTop.value = event.target.scrollTop;
}
const promptDragIndex = ref(null);
const promptTouchDrag = ref(null);
const promptEdgeTouchStart = ref(null);

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    windowWidth.value = window.innerWidth;
  });
}
const isMobile = computed(() => windowWidth.value < 1024);

const fileName = ref(null);
const doc = ref(null);
const currentLocalProjectId = ref(null);
const localProjects = ref([]);
const isLocalProjectBusy = ref(false);
const autoSaveStatus = ref("idle"); // idle | pending | saving | saved | error
const autoSaveTimer = ref(null);
const suppressAutoSave = ref(false);

const selectedProfileId = ref(null);
const selectedPromptId = ref(null);
const promptFilter = ref("");

const selectedRegexId = ref(null);
const selectedRegexIds = ref(new Set());
const regexFilter = ref("");

const apiFilter = ref("");

const exportFormat = ref("txt");
const txtPromptMode = ref("enabled");
const jsonPromptMode = ref("all");
const includeEmpty = ref(false);
const includeRegexInJson = ref(false);
const includeApiInJson = ref(false);

const fileInputRef = ref(null);
const regexFileInputRef = ref(null);
const copySuccess = ref(false);

const LOCAL_PROJECT_DB_NAME = "sillytavern-preset-editor";
const LOCAL_PROJECT_DB_VERSION = 1;
const LOCAL_PROJECT_STORE = "projects";
const AUTO_SAVE_DELAY_MS = 800;

// 計算屬性
const isDocLoaded = computed(() => !!doc.value);

const activeProfile = computed(() => {
  if (!doc.value) return null;
  if (selectedProfileId.value == null) return doc.value.profiles[0] || null;
  const profile = doc.value.profiles.find(p => Number(p.characterId) === Number(selectedProfileId.value));
  return profile || doc.value.profiles[0] || null;
});

const hasPromptFilter = computed(() => promptFilter.value.trim().length > 0);

const visiblePromptEntries = computed(() => {
  if (!activeProfile.value || !doc.value) return [];
  const query = promptFilter.value.trim().toLowerCase();
  const out = [];
  for (let index = 0; index < activeProfile.value.order.length; index += 1) {
    const entry = activeProfile.value.order[index];
    const block = doc.value.blocks[entry.blockId];
    const title = block?.title || entry.blockId;
    if (query) {
      const hay = makePromptSearchText(entry, block, title).toLowerCase();
      if (!hay.includes(query)) continue;
    }
    out.push({ entry, block, index });
  }
  return out;
});

const promptSearchSummary = computed(() => {
  const total = visiblePromptEntries.value.length;
  if (!total) return "0/0";
  const selectedIndex = visiblePromptEntries.value.findIndex(item => item.entry.blockId === selectedPromptId.value);
  const cursor = selectedIndex >= 0 ? selectedIndex : Math.min(promptSearchCursor.value, total - 1);
  return `${cursor + 1}/${total}`;
});

const canDragSortPrompts = computed(() => !hasPromptFilter.value && !!activeProfile.value);

const selectedPromptEntry = computed(() => {
  if (!activeProfile.value || !selectedPromptId.value) return null;
  const index = activeProfile.value.order.findIndex(entry => entry.blockId === selectedPromptId.value);
  if (index < 0) return null;
  return { entry: activeProfile.value.order[index], index };
});

const selectedPromptBlock = computed(() => {
  if (!doc.value || !selectedPromptId.value) return null;
  return doc.value.blocks[selectedPromptId.value] || null;
});

const visibleRegexItems = computed(() => {
  if (!doc.value) return [];
  const query = regexFilter.value.trim().toLowerCase();
  const scripts = Array.isArray(doc.value.regexScripts) ? doc.value.regexScripts : [];
  const out = [];
  for (let index = 0; index < scripts.length; index += 1) {
    const script = scripts[index];
    const name = `${script.scriptName || ""} ${script.id || ""} ${script.findRegex || ""}`.toLowerCase();
    if (query && !name.includes(query)) continue;
    out.push({ script, index });
  }
  return out;
});

const selectedRegexItem = computed(() => {
  if (!doc.value || !selectedRegexId.value) return null;
  const index = doc.value.regexScripts.findIndex(script => script.id === selectedRegexId.value);
  if (index < 0) return null;
  return { script: doc.value.regexScripts[index], index };
});

const apiSettingsList = computed(() => {
  if (!doc.value) return [];
  const apiSettings = doc.value.apiSettings || {};
  const filter = apiFilter.value.trim().toLowerCase();
  const keys = Object.keys(apiSettings).filter(key => key.toLowerCase().includes(filter));
  keys.sort((a, b) => a.localeCompare(b));
  return keys.map(key => ({
    key,
    value: apiSettings[key],
    type: detectApiType(apiSettings[key])
  }));
});

const promptModeForCurrentFormat = computed({
  get() {
    return exportFormat.value === "json" ? jsonPromptMode.value : txtPromptMode.value;
  },
  set(val) {
    if (exportFormat.value === "json") {
      jsonPromptMode.value = val;
    } else {
      txtPromptMode.value = val;
    }
  }
});

const exportOutput = computed(() => {
  if (!doc.value || !activeProfile.value) return "";
  try {
    if (exportFormat.value === "json") {
      const exportedJson = exportSillyTavernPresetJson(doc.value, {
        characterId: activeProfile.value.characterId,
        promptMode: jsonPromptMode.value,
        includeRegex: includeRegexInJson.value,
        includeApiSettings: includeApiInJson.value,
        selectedRegexIds: Array.from(selectedRegexIds.value)
      });
      return JSON.stringify(exportedJson, null, 2);
    } else {
      const exportedText = exportProfileText(doc.value, {
        characterId: activeProfile.value.characterId,
        format: "plain",
        promptMode: txtPromptMode.value,
        includeEmpty: includeEmpty.value
      });
      return exportedText.text;
    }
  } catch (err) {
    return `導出失敗: ${String(err?.message || err)}`;
  }
});

const previewBlocks = computed(() => {
  if (!doc.value || !activeProfile.value || exportFormat.value === 'json') return [];
  
  const blocks = [];
  for (const entry of activeProfile.value.order) {
    const enabled = txtPromptMode.value === "all" ? true : Boolean(entry.enabled);
    if (!enabled) continue;

    const block = doc.value.blocks[entry.blockId];
    if (!block) continue;

    const text = typeof block.text === "string" ? block.text : "";
    const isEmpty = text.length === 0;
    if (isEmpty && !includeEmpty.value) continue;

    blocks.push({
      blockId: entry.blockId,
      text: text
    });
  }
  return blocks;
});

// 輔助函數
function labelWithKey(label, key) {
  return `${label}（${key}）`;
}

function formatPromptRole(role) {
  if (!role) return "未設置";
  return PROMPT_ROLE_LABELS[role] || role;
}

function formatApiType(type) {
  return API_TYPE_LABELS[type] || type;
}

function formatApiKey(key) {
  const zhLabel = API_SETTING_LABELS[key];
  return zhLabel ? labelWithKey(zhLabel, key) : key;
}

function stringifySearchValue(value, seen = new Set()) {
  if (value == null) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (typeof value !== "object") return "";
  if (seen.has(value)) return "";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(item => stringifySearchValue(item, seen)).filter(Boolean).join(" ");
  }
  return Object.entries(value)
    .map(([key, val]) => `${key} ${stringifySearchValue(val, seen)}`)
    .filter(Boolean)
    .join(" ");
}

function makePromptSearchText(entry, block, title = "") {
  const meta = block?.meta && typeof block.meta === "object" ? block.meta : {};
  const tagKeys = ["tag", "tags", "label", "labels", "category", "categories", "group", "groups"];
  const tagText = tagKeys.map(key => stringifySearchValue(meta[key])).filter(Boolean).join(" ");
  return [
    title,
    entry?.blockId,
    block?.id,
    block?.role,
    block?.marker ? "marker 標記塊" : "",
    block?.text,
    tagText,
    stringifySearchValue(meta)
  ].filter(Boolean).join(" ");
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

function getBaseFileName() {
  const raw = fileName.value || "預設";
  return raw.replace(/\.json$/i, "");
}

function makeProfileLabel(characterId) {
  return `character_id=${characterId}`;
}

function isProfileIdTaken(characterId, excludedCharacterId = null) {
  if (!doc.value) return false;
  return doc.value.profiles.some(
    profile => Number(profile.characterId) === Number(characterId) && Number(profile.characterId) !== Number(excludedCharacterId)
  );
}

function getNextProfileId(excludedCharacterId = null) {
  if (!doc.value) return 100000;
  const used = new Set(
    doc.value.profiles
      .map(profile => Number(profile.characterId))
      .filter(id => Number.isInteger(id) && id >= 0 && id !== Number(excludedCharacterId))
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
    return { ok: false, message: "配置組ID必須是非負整數。" };
  }
  if (isProfileIdTaken(value, excludedCharacterId)) {
    return { ok: false, message: `配置組ID已存在：${value}` };
  }
  return { ok: true, characterId: value, autoAssigned: false };
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
    return Number.isFinite(value) ? value : 0;
  }
  if (type === "string") return String(rawValue ?? "");
  if (typeof rawValue === "string") {
    return JSON.parse(rawValue);
  }
  return rawValue;
}

function openLocalProjectDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("目前瀏覽器不支持 IndexedDB。"));
      return;
    }
    const request = indexedDB.open(LOCAL_PROJECT_DB_NAME, LOCAL_PROJECT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_PROJECT_STORE)) {
        const store = db.createObjectStore(LOCAL_PROJECT_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 開啟失敗。"));
  });
}

async function withLocalProjectStore(mode, callback) {
  const db = await openLocalProjectDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_PROJECT_STORE, mode);
      const store = tx.objectStore(LOCAL_PROJECT_STORE);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error("IndexedDB 操作失敗。"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB 操作已中止。"));
      result = callback(store);
    });
  } finally {
    db.close();
  }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 請求失敗。"));
  });
}

function makeLocalProjectId() {
  return `project_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getCurrentDocForStorage() {
  const storedDoc = normalizeProjectDoc(doc.value);
  storedDoc.uiState = storedDoc.uiState || {};
  storedDoc.uiState.selectedRegexIds = Array.from(selectedRegexIds.value);
  return storedDoc;
}

async function refreshLocalProjects() {
  const projects = await withLocalProjectStore("readonly", store => requestToPromise(store.getAll()));
  localProjects.value = projects
    .map(project => ({
      id: project.id,
      title: project.title || "未命名工程",
      fileName: project.fileName || `${project.title || "未命名工程"}.project.json`,
      updatedAt: project.updatedAt || 0
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function getAutoSaveStatusLabel() {
  if (autoSaveStatus.value === "pending") return "等待自動保存";
  if (autoSaveStatus.value === "saving") return "自動保存中";
  if (autoSaveStatus.value === "saved") return "已自動保存";
  if (autoSaveStatus.value === "error") return "自動保存失敗";
  return "自動保存已啟用";
}

async function autoSaveProjectToLocalLibrary() {
  if (!doc.value || isLocalProjectBusy.value || suppressAutoSave.value) return;
  autoSaveStatus.value = "saving";
  try {
    const storedDoc = getCurrentDocForStorage();
    const now = Date.now();
    const id = currentLocalProjectId.value || makeLocalProjectId();
    const title = storedDoc.title || "未命名工程";
    const nextFileName = fileName.value || `${title}.project.json`;
    await withLocalProjectStore("readwrite", store => {
      store.put({
        id,
        title,
        fileName: nextFileName,
        doc: storedDoc,
        createdAt: now,
        updatedAt: now
      });
    });
    currentLocalProjectId.value = id;
    fileName.value = nextFileName;
    await refreshLocalProjects();
    autoSaveStatus.value = "saved";
  } catch (err) {
    console.error("自動保存到本機工程庫失敗", err);
    autoSaveStatus.value = "error";
  }
}

function scheduleAutoSave() {
  if (!doc.value || suppressAutoSave.value) return;
  autoSaveStatus.value = "pending";
  if (autoSaveTimer.value) window.clearTimeout(autoSaveTimer.value);
  autoSaveTimer.value = window.setTimeout(() => {
    autoSaveTimer.value = null;
    autoSaveProjectToLocalLibrary();
  }, AUTO_SAVE_DELAY_MS);
}

// 核心操作方法
function setLoadedDoc(newDoc, name) {
  suppressAutoSave.value = true;
  if (autoSaveTimer.value) {
    window.clearTimeout(autoSaveTimer.value);
    autoSaveTimer.value = null;
  }
  autoSaveStatus.value = "idle";
  doc.value = normalizeProjectDoc(newDoc);
  fileName.value = name;
  selectedProfileId.value = doc.value.profiles[0]?.characterId ?? null;
  selectedPromptId.value = doc.value.profiles[0]?.order?.[0]?.blockId ?? null;
  selectedRegexId.value = doc.value.regexScripts[0]?.id ?? null;
  selectedRegexIds.value = new Set(
    Array.isArray(doc.value?.uiState?.selectedRegexIds)
      ? doc.value.uiState.selectedRegexIds.filter(id => doc.value.regexScripts.some(script => script.id === id))
      : []
  );
  promptFilter.value = "";
  regexFilter.value = "";
  apiFilter.value = "";
  exportFormat.value = "txt";
  txtPromptMode.value = "enabled";
  jsonPromptMode.value = "all";
  includeEmpty.value = false;
  includeRegexInJson.value = false;
  includeApiInJson.value = false;
  expandEditorOpen.value = false;
  
  // 重置手機版子分頁
  mobileSubTab.value = 'edit';
  mobilePromptDrawerOpen.value = false;
  promptSearchCursor.value = 0;
  mobileRegexSubTab.value = 'list';
  nextTick(() => {
    suppressAutoSave.value = false;
  });
}

function createNewProject() {
  currentLocalProjectId.value = null;
  setLoadedDoc(createEmptyProjectDoc("未命名工程"), "未命名工程.project.json");
}

async function loadInputFile(file) {
  const rawText = await file.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`JSON 解析失敗：${String(err?.message || err)}`);
  }

  if (detectSillyTavernApiPreset(data)) {
    currentLocalProjectId.value = null;
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

  if (data && data.kind === "prompt-doc") {
    currentLocalProjectId.value = null;
    setLoadedDoc(normalizeProjectDoc(data), file.name);
    return;
  }

  throw new Error("不支持的格式：僅支持 SillyTavern（酒館）API 預設 JSON 或本工具工程 JSON。");
}

function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  loadInputFile(file)
    .catch(err => alert(String(err?.message || err)))
    .finally(() => {
      if (fileInputRef.value) fileInputRef.value.value = "";
    });
}

function triggerFileInput() {
  if (fileInputRef.value) fileInputRef.value.click();
}

function saveProjectFile() {
  if (!doc.value) return;
  doc.value.uiState = doc.value.uiState || {};
  doc.value.uiState.selectedRegexIds = Array.from(selectedRegexIds.value);
  const payload = JSON.stringify(doc.value, null, 2);
  downloadFile(`${getBaseFileName()}.project.json`, payload, "application/json;charset=utf-8");
}

async function saveProjectToLocalLibrary() {
  if (!doc.value || isLocalProjectBusy.value) return;
  isLocalProjectBusy.value = true;
  try {
    const storedDoc = getCurrentDocForStorage();
    const now = Date.now();
    const id = currentLocalProjectId.value || makeLocalProjectId();
    const title = storedDoc.title || "未命名工程";
    const nextFileName = fileName.value || `${title}.project.json`;
    await withLocalProjectStore("readwrite", store => {
      store.put({
        id,
        title,
        fileName: nextFileName,
        doc: storedDoc,
        createdAt: now,
        updatedAt: now
      });
    });
    currentLocalProjectId.value = id;
    fileName.value = nextFileName;
    await refreshLocalProjects();
  } catch (err) {
    alert(`保存到本機工程庫失敗：${String(err?.message || err)}`);
  } finally {
    isLocalProjectBusy.value = false;
  }
}

async function renameCurrentProject() {
  if (!doc.value || isLocalProjectBusy.value) return;
  const currentTitle = doc.value.title || "未命名工程";
  const nextTitle = (await prompt("請輸入工程名稱", currentTitle) || "").trim();
  if (!nextTitle || nextTitle === currentTitle) return;
  doc.value.title = nextTitle;
  fileName.value = `${nextTitle}.project.json`;
  if (!currentLocalProjectId.value) return;
  isLocalProjectBusy.value = true;
  try {
    const project = await withLocalProjectStore("readonly", store => requestToPromise(store.get(currentLocalProjectId.value)));
    if (!project) {
      await refreshLocalProjects();
      return;
    }
    await withLocalProjectStore("readwrite", store => {
      store.put({
        ...project,
        title: nextTitle,
        fileName: fileName.value,
        doc: getCurrentDocForStorage(),
        updatedAt: Date.now()
      });
    });
    await refreshLocalProjects();
  } catch (err) {
    alert(`重命名本機工程失敗：${String(err?.message || err)}`);
  } finally {
    isLocalProjectBusy.value = false;
  }
}

async function loadLocalProject(projectId) {
  if (!projectId || isLocalProjectBusy.value) return;
  isLocalProjectBusy.value = true;
  try {
    const project = await withLocalProjectStore("readonly", store => requestToPromise(store.get(projectId)));
    if (!project) {
      alert("找不到本機工程。");
      await refreshLocalProjects();
      return;
    }
    currentLocalProjectId.value = project.id;
    setLoadedDoc(project.doc, project.fileName || `${project.title || "未命名工程"}.project.json`);
  } catch (err) {
    alert(`載入本機工程失敗：${String(err?.message || err)}`);
  } finally {
    isLocalProjectBusy.value = false;
  }
}

async function handleLocalProjectSelect(event) {
  const projectId = event.target.value;
  if (!projectId) {
    currentLocalProjectId.value = null;
    return;
  }
  await loadLocalProject(projectId);
}

async function deleteCurrentLocalProject() {
  if (!currentLocalProjectId.value || isLocalProjectBusy.value) return;
  const selected = localProjects.value.find(project => project.id === currentLocalProjectId.value);
  const label = selected?.title || doc.value?.title || "目前工程";
  if (!(await confirm(`確定要從本機工程庫刪除「${label}」嗎？目前畫面內容會保留，但工程庫紀錄會被移除。`))) return;
  isLocalProjectBusy.value = true;
  try {
    const deletedId = currentLocalProjectId.value;
    await withLocalProjectStore("readwrite", store => {
      store.delete(deletedId);
    });
    currentLocalProjectId.value = null;
    await refreshLocalProjects();
  } catch (err) {
    alert(`刪除本機工程失敗：${String(err?.message || err)}`);
  } finally {
    isLocalProjectBusy.value = false;
  }
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

async function copyExportText() {
  try {
    await navigator.clipboard.writeText(exportOutput.value || "");
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 1500);
  } catch {
    alert("複製失敗，請手動複製。");
  }
}

function downloadExportFile() {
  const profileId = activeProfile.value?.characterId ?? "未指定";
  if (exportFormat.value === "json") {
    downloadFile(
      `${getBaseFileName()}-配置檔${profileId}.json`,
      exportOutput.value || "{}",
      "application/json;charset=utf-8"
    );
  } else {
    downloadFile(`${getBaseFileName()}-配置檔${profileId}.txt`, exportOutput.value || "", "text/plain;charset=utf-8");
  }
}

// 配置組操作
async function addProfile() {
  if (!doc.value) return;
  const rawValue = await prompt("請輸入新的配置組ID（character_id）。留空將自動分配。", "");
  if (rawValue == null) return;

  const parsed = parseProfileIdInput(rawValue);
  if (!parsed.ok) {
    await alert(parsed.message);
    return;
  }

  const newProfile = {
    characterId: parsed.characterId,
    label: makeProfileLabel(parsed.characterId),
    order: Array.isArray(activeProfile.value?.order) ? cloneDeep(activeProfile.value.order) : []
  };
  const activeIndex = doc.value.profiles.findIndex(profile => Number(profile.characterId) === Number(activeProfile.value?.characterId));
  const insertIndex = activeIndex >= 0 ? activeIndex + 1 : doc.value.profiles.length;
  doc.value.profiles.splice(insertIndex, 0, newProfile);
  selectedProfileId.value = newProfile.characterId;
  selectedPromptId.value = newProfile.order[0]?.blockId ?? null;

  if (parsed.autoAssigned) {
    await alert(`已自動分配配置組ID：${newProfile.characterId}`);
  }
}

async function editActiveProfileId() {
  if (!doc.value || !activeProfile.value) return;

  const rawValue = await prompt(
    `當前配置組ID：${activeProfile.value.characterId}\n請輸入新的配置組ID（留空自動分配）。`,
    String(activeProfile.value.characterId)
  );
  if (rawValue == null) return;

  const parsed = parseProfileIdInput(rawValue, activeProfile.value.characterId);
  if (!parsed.ok) {
    await alert(parsed.message);
    return;
  }

  activeProfile.value.characterId = parsed.characterId;
  activeProfile.value.label = makeProfileLabel(parsed.characterId);
  selectedProfileId.value = parsed.characterId;

  if (parsed.autoAssigned) {
    await alert(`已自動分配新的配置組ID：${parsed.characterId}`);
  }
}

async function deleteActiveProfile() {
  if (!doc.value || !activeProfile.value) return;
  if (doc.value.profiles.length <= 1) {
    await alert("至少需要保留一個配置組，無法刪除最後一個。");
    return;
  }

  const total = activeProfile.value.order.length;
  const enabled = activeProfile.value.order.filter(entry => entry.enabled).length;
  const firstConfirm = await confirm(
    `即將刪除配置組 ${activeProfile.value.characterId}（啟用 ${enabled}/${total}）。\n該配置組包含完整提示詞順序信息，刪除後不可恢復。\n是否繼續？`
  );
  if (!firstConfirm) return;

  const secondConfirm = await confirm(`請再次確認：刪除配置組 ${activeProfile.value.characterId}。`);
  if (!secondConfirm) return;

  const activeIndex = doc.value.profiles.findIndex(
    profile => Number(profile.characterId) === Number(activeProfile.value.characterId)
  );
  if (activeIndex < 0) return;

  doc.value.profiles.splice(activeIndex, 1);
  const fallbackIndex = Math.min(activeIndex, doc.value.profiles.length - 1);
  const fallbackProfile = doc.value.profiles[fallbackIndex] || doc.value.profiles[0] || null;
  selectedProfileId.value = fallbackProfile?.characterId ?? null;
  selectedPromptId.value = fallbackProfile?.order?.[0]?.blockId ?? null;
}

// 提示詞操作
function openPromptDrawer() {
  if (windowWidth.value < 1024) {
    mobilePromptDrawerOpen.value = true;
  }
}

function closePromptDrawer() {
  mobilePromptDrawerOpen.value = false;
}

function selectPrompt(blockId, options = {}) {
  if (!blockId) return;
  selectedPromptId.value = blockId;
  const visibleIndex = visiblePromptEntries.value.findIndex(item => item.entry.blockId === blockId);
  if (visibleIndex >= 0) promptSearchCursor.value = visibleIndex;
  // 在手機版上，點擊列表項後自動切換到編輯子分頁
  if (windowWidth.value < 1024) {
    mobileSubTab.value = 'edit';
    if (!options.keepDrawerOpen) closePromptDrawer();
  }
}

function jumpPromptSearch(direction) {
  const entries = visiblePromptEntries.value;
  if (!entries.length) return;
  const selectedIndex = entries.findIndex(item => item.entry.blockId === selectedPromptId.value);
  const baseIndex = selectedIndex >= 0 ? selectedIndex : Math.min(promptSearchCursor.value, entries.length - 1);
  const nextIndex = (baseIndex + direction + entries.length) % entries.length;
  promptSearchCursor.value = nextIndex;
  selectPrompt(entries[nextIndex].entry.blockId, { keepDrawerOpen: mobilePromptDrawerOpen.value });
}

function canReorderPrompts(showAlert = true) {
  if (!activeProfile.value) return false;
  if (hasPromptFilter.value) {
    if (showAlert) alert("搜尋/過濾中暫停排序，請清空搜尋後再移動條目，避免改到隱藏項目的真實順序。");
    return false;
  }
  return true;
}

function isPromptReferenced(promptId) {
  if (!doc.value) return false;
  for (const profile of doc.value.profiles) {
    if (profile.order.some(item => item.blockId === promptId)) return true;
  }
  return false;
}

function renamePromptId(oldId, newIdRaw) {
  const newId = (newIdRaw || "").trim();
  if (!newId) return "ID 不能為空。";
  if (newId === oldId) return null;
  if (doc.value.blocks[newId]) return `ID 已存在：${newId}`;

  const block = doc.value.blocks[oldId];
  if (!block) return `未找到原提示詞：${oldId}`;

  delete doc.value.blocks[oldId];
  block.id = newId;
  doc.value.blocks[newId] = block;

  for (const profile of doc.value.profiles) {
    for (const item of profile.order) {
      if (item.blockId === oldId) item.blockId = newId;
    }
  }

  if (selectedPromptId.value === oldId) selectedPromptId.value = newId;
  return null;
}

function handlePromptIdBlur(event) {
  const block = selectedPromptBlock.value;
  if (!block) return;
  const err = renamePromptId(block.id, event.target.value);
  if (err) {
    alert(err);
    event.target.value = block.id;
  }
}

function buildDefaultPrompt(existingIds) {
  const id = makeUniqueId(existingIds, "prompt");
  return {
    id,
    title: "新提示詞",
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
  if (!doc.value || !activeProfile.value) return;
  const prompt = buildDefaultPrompt(Object.keys(doc.value.blocks));
  doc.value.blocks[prompt.id] = prompt;

  const selected = selectedPromptEntry.value;
  const insertIndex = selected ? selected.index + 1 : activeProfile.value.order.length;
  activeProfile.value.order.splice(insertIndex, 0, {
    blockId: prompt.id,
    enabled: true
  });
  selectedPromptId.value = prompt.id;
  
  if (windowWidth.value < 1024) {
    mobileSubTab.value = 'edit';
  }
}

function duplicatePrompt() {
  if (!doc.value || !activeProfile.value) return;
  const selected = selectedPromptEntry.value;
  if (!selected) return;
  const source = doc.value.blocks[selected.entry.blockId];
  if (!source) return;

  const duplicated = cloneDeep(source);
  duplicated.id = makeUniqueId(Object.keys(doc.value.blocks), "prompt");
  duplicated.title = `${source.title}（副本）`;
  doc.value.blocks[duplicated.id] = duplicated;

  activeProfile.value.order.splice(selected.index + 1, 0, {
    blockId: duplicated.id,
    enabled: selected.entry.enabled
  });
  selectedPromptId.value = duplicated.id;
  
  if (windowWidth.value < 1024) {
    mobileSubTab.value = 'edit';
  }
}

function deleteSelectedPrompt() {
  if (!doc.value || !activeProfile.value) return;
  const selected = selectedPromptEntry.value;
  if (!selected) return;

  const removed = activeProfile.value.order.splice(selected.index, 1)[0];
  if (!removed) return;
  if (!isPromptReferenced(removed.blockId)) {
    delete doc.value.blocks[removed.blockId];
  }

  selectedPromptId.value = activeProfile.value.order[Math.max(0, selected.index - 1)]?.blockId ?? null;
}

function movePrompt(index, direction) {
  if (!canReorderPrompts()) return;
  const targetIndex = index + direction;
  movePromptTo(index, targetIndex);
}

function movePromptTo(index, targetIndex) {
  if (!canReorderPrompts(false)) return;
  const order = activeProfile.value.order;
  if (index < 0 || index >= order.length) return;
  const finalIndex = Math.max(0, Math.min(targetIndex, order.length - 1));
  if (finalIndex === index) return;
  const [moved] = order.splice(index, 1);
  order.splice(finalIndex, 0, moved);
}

async function movePromptToPosition(index) {
  if (!canReorderPrompts()) return;
  const total = activeProfile.value.order.length;
  const raw = await prompt(`移動到第幾個位置？請輸入 1-${total}`, String(index + 1));
  if (raw == null) return;
  const position = Number(raw.trim());
  if (!Number.isInteger(position) || position < 1 || position > total) {
    await alert(`位置必須是 1-${total} 的整數。`);
    return;
  }
  movePromptTo(index, position - 1);
}

function handlePromptDragStart(index, event) {
  if (!canReorderPrompts()) return;
  promptDragIndex.value = index;
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }
}

function handlePromptDrop(targetIndex, event) {
  event?.preventDefault?.();
  const sourceIndex = promptDragIndex.value;
  promptDragIndex.value = null;
  if (sourceIndex == null) return;
  movePromptTo(sourceIndex, targetIndex);
}

function handlePromptDragEnd() {
  promptDragIndex.value = null;
}

function handlePromptTouchDragStart(index, event) {
  if (!canReorderPrompts()) return;
  if (event.target.closest('button') || event.target.closest('input')) return;
  const touch = event.touches?.[0];
  if (!touch) return;
  const state = {
    index,
    currentIndex: index,
    startX: touch.clientX,
    startY: touch.clientY,
    activated: false,
    timer: null
  };
  state.timer = window.setTimeout(() => {
    state.activated = true;
    promptDragIndex.value = index;
    if (navigator?.vibrate) navigator.vibrate(20);
  }, 260);
  promptTouchDrag.value = state;
}

function handlePromptTouchDragMove(event) {
  const state = promptTouchDrag.value;
  const touch = event.touches?.[0];
  if (!state || !touch) return;
  const distance = Math.hypot(touch.clientX - state.startX, touch.clientY - state.startY);
  if (!state.activated && distance > 10) {
    clearTimeout(state.timer);
    promptTouchDrag.value = null;
    return;
  }
  if (!state.activated) return;
  event.preventDefault();
  const element = document.elementFromPoint(touch.clientX, touch.clientY);
  const row = element?.closest?.("[data-prompt-index]");
  const nextIndex = Number(row?.dataset?.promptIndex);
  if (Number.isInteger(nextIndex)) state.currentIndex = nextIndex;
}

function handlePromptTouchDragEnd() {
  const state = promptTouchDrag.value;
  if (!state) return;
  clearTimeout(state.timer);
  if (state.activated) movePromptTo(state.index, state.currentIndex);
  promptTouchDrag.value = null;
  promptDragIndex.value = null;
}

function handlePromptEdgeTouchStart(event) {
  if (!isMobile.value || activeTab.value !== 'prompts' || mobilePromptDrawerOpen.value) return;
  const touch = event.touches?.[0];
  if (!touch || touch.clientX > 80) return;
  promptEdgeTouchStart.value = { x: touch.clientX, y: touch.clientY };
}

function handlePromptEdgeTouchMove(event) {
  const start = promptEdgeTouchStart.value;
  if (!start) return;
  const touch = event.touches?.[0];
  if (!touch) return;
  const dx = touch.clientX - start.x;
  const dy = Math.abs(touch.clientY - start.y);
  if (dx > 72 && dy < 70) {
    openPromptDrawer();
    promptEdgeTouchStart.value = null;
  }
}

function handlePromptEdgeTouchEnd() {
  promptEdgeTouchStart.value = null;
}

// 正則操作
function selectRegex(scriptId) {
  selectedRegexId.value = scriptId;
  if (windowWidth.value < 1024) {
    mobileRegexSubTab.value = 'edit';
  }
}

function toggleRegexExport(scriptId) {
  if (selectedRegexIds.value.has(scriptId)) {
    selectedRegexIds.value.delete(scriptId);
  } else {
    selectedRegexIds.value.add(scriptId);
  }
  if (selectedRegexIds.value.size === 0) {
    includeRegexInJson.value = false;
  }
}

function selectAllRegex() {
  if (!doc.value) return;
  selectedRegexIds.value = new Set(doc.value.regexScripts.map(script => script.id).filter(id => typeof id === "string"));
}

function clearRegexSelect() {
  selectedRegexIds.value.clear();
  includeRegexInJson.value = false;
}

function renameRegexId(oldId, newIdRaw) {
  const newId = (newIdRaw || "").trim();
  if (!newId) return "ID 不能為空。";
  if (newId === oldId) return null;
  if (doc.value.regexScripts.some(script => script.id === newId)) return `ID 已存在：${newId}`;
  const selected = selectedRegexItem.value;
  if (!selected) return "未找到選中的正則。";
  selected.script.id = newId;
  if (selectedRegexId.value === oldId) selectedRegexId.value = newId;
  if (selectedRegexIds.value.has(oldId)) {
    selectedRegexIds.value.delete(oldId);
    selectedRegexIds.value.add(newId);
  }
  return null;
}

function handleRegexIdBlur(event) {
  const item = selectedRegexItem.value;
  if (!item) return;
  const err = renameRegexId(item.script.id, event.target.value);
  if (err) {
    alert(err);
    event.target.value = item.script.id;
  }
}

function buildDefaultRegex(existingIds) {
  const id = makeUniqueId(existingIds, "regex");
  return {
    id,
    scriptName: "新正則腳本",
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

function normalizeImportedRegexScript(input, existingIds, index = 0) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("正則 JSON 必須是物件。");
  }
  if (typeof input.findRegex !== "string" || !input.findRegex.trim()) {
    throw new Error("正則 JSON 缺少 findRegex。");
  }
  const existing = new Set(existingIds);
  const rawId = typeof input.id === "string" && input.id.trim() ? input.id.trim() : "";
  const id = rawId && !existing.has(rawId) ? rawId : makeUniqueId(existingIds, `regex_import_${index + 1}`);
  existingIds.push(id);
  return {
    id,
    scriptName: typeof input.scriptName === "string" && input.scriptName.trim() ? input.scriptName : "導入的正則腳本",
    findRegex: input.findRegex,
    replaceString: typeof input.replaceString === "string" ? input.replaceString : "",
    trimStrings: Array.isArray(input.trimStrings) ? input.trimStrings.filter(item => typeof item === "string") : [],
    placement: Array.isArray(input.placement) ? input.placement.map(item => Number(item)).filter(item => Number.isFinite(item)) : [2],
    disabled: Boolean(input.disabled),
    markdownOnly: Boolean(input.markdownOnly),
    promptOnly: Boolean(input.promptOnly),
    runOnEdit: Boolean(input.runOnEdit),
    substituteRegex: Number.isFinite(Number(input.substituteRegex)) ? Number(input.substituteRegex) : 0,
    minDepth: input.minDepth == null || input.minDepth === "" ? null : Number(input.minDepth),
    maxDepth: input.maxDepth == null || input.maxDepth === "" ? null : Number(input.maxDepth)
  };
}

function addRegex() {
  if (!doc.value) return;
  const regex = buildDefaultRegex(doc.value.regexScripts.map(script => script.id));
  doc.value.regexScripts.push(regex);
  selectedRegexId.value = regex.id;
  if (windowWidth.value < 1024) {
    mobileRegexSubTab.value = 'edit';
  }
}

async function importRegexFile(file) {
  if (!doc.value) return;
  const rawText = await file.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`正則 JSON 解析失敗：${String(err?.message || err)}`);
  }
  const inputs = Array.isArray(data) ? data : [data];
  if (inputs.length === 0) throw new Error("正則 JSON 沒有可導入的內容。");
  const existingIds = doc.value.regexScripts.map(script => script.id).filter(id => typeof id === "string");
  const imported = inputs.map((item, index) => normalizeImportedRegexScript(item, existingIds, index));
  doc.value.regexScripts.push(...imported);
  selectedRegexId.value = imported[0].id;
  if (windowWidth.value < 1024) {
    mobileRegexSubTab.value = 'edit';
  }
}

function handleRegexFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  importRegexFile(file)
    .catch(err => alert(String(err?.message || err)))
    .finally(() => {
      if (regexFileInputRef.value) regexFileInputRef.value.value = "";
    });
}

function triggerRegexFileInput() {
  if (regexFileInputRef.value) regexFileInputRef.value.click();
}

function duplicateRegex() {
  if (!doc.value) return;
  const selected = selectedRegexItem.value;
  if (!selected) return;
  const copied = cloneDeep(selected.script);
  copied.id = makeUniqueId(doc.value.regexScripts.map(script => script.id), "regex");
  copied.scriptName = `${copied.scriptName || "正則腳本"}（副本）`;
  doc.value.regexScripts.splice(selected.index + 1, 0, copied);
  selectedRegexId.value = copied.id;
  if (windowWidth.value < 1024) {
    mobileRegexSubTab.value = 'edit';
  }
}

function deleteRegex() {
  if (!doc.value) return;
  const selected = selectedRegexItem.value;
  if (!selected) return;
  const removed = doc.value.regexScripts.splice(selected.index, 1)[0];
  if (!removed) return;
  selectedRegexIds.value.delete(removed.id);
  selectedRegexId.value = doc.value.regexScripts[Math.max(0, selected.index - 1)]?.id ?? null;
  if (selectedRegexIds.value.size === 0) {
    includeRegexInJson.value = false;
  }
}

function exportSelectedRegexFiles() {
  if (!doc.value) return;
  const selectedIds = Array.from(selectedRegexIds.value);
  if (selectedIds.length === 0) return;

  const scripts = exportRegexScripts(doc.value, {
    includeDisabled: true,
    selectedIds
  });

  for (let i = 0; i < scripts.length; i += 1) {
    const fileName = makeRegexScriptFileName(scripts[i], i);
    downloadFile(fileName, JSON.stringify(scripts[i], null, 2), "application/json;charset=utf-8");
  }
}

// API 配置操作
async function addApiSetting() {
  if (!doc.value) return;
  const key = (await prompt("請輸入配置鍵（例如：temperature，表示採樣溫度）") || "").trim();
  if (!key) return;
  if (Object.prototype.hasOwnProperty.call(doc.value.apiSettings, key)) {
    await alert(`配置已存在：${key}`);
    return;
  }
  doc.value.apiSettings[key] = "";
}

function removeApiSetting(key) {
  if (!doc.value) return;
  delete doc.value.apiSettings[key];
}

function changeApiType(key, newType) {
  if (!doc.value) return;
  if (newType === "string") doc.value.apiSettings[key] = "";
  if (newType === "number") doc.value.apiSettings[key] = 0;
  if (newType === "boolean") doc.value.apiSettings[key] = false;
  if (newType === "json") doc.value.apiSettings[key] = {};
}

function handleApiJsonBlur(key, event) {
  if (!doc.value) return;
  try {
    doc.value.apiSettings[key] = parseValueByType("json", event.target.value);
    event.target.style.borderColor = "";
  } catch {
    event.target.style.borderColor = "rgb(239, 68, 68)";
    alert(`JSON 解析失敗：${formatApiKey(key)}`);
    event.target.value = JSON.stringify(doc.value.apiSettings[key], null, 2);
  }
}

function openDocs() {
  window.open("/web/docs.html", "_blank", "noopener");
}

// 監聽器：當導出格式改變時，自動調整 promptMode
watch(exportFormat, (newFormat) => {
  if (newFormat === 'json') {
    if (selectedRegexIds.value.size === 0) {
      includeRegexInJson.value = false;
    }
  }
});

watch(doc, () => {
  scheduleAutoSave();
}, { deep: true });

watch(selectedRegexIds, () => {
  scheduleAutoSave();
}, { deep: true });

watch(() => modalState.value.show, (newVal) => {
  if (newVal && modalState.value.type === 'prompt') {
    nextTick(() => {
      modalInputRef.value?.focus();
    });
  }
});

onMounted(async () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true;
    document.documentElement.classList.add('dark');
  } else {
    isDark.value = false;
    document.documentElement.classList.remove('dark');
  }

  createNewProject();
  try {
    await refreshLocalProjects();
  } catch (err) {
    alert(`讀取本機工程庫失敗：${String(err?.message || err)}`);
  }
});
</script>

<template>
  <div class="flex flex-col h-[100dvh] w-screen overflow-hidden bg-bg text-text font-sans antialiased relative">
    <!-- Ambient Neon Glowing Background -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40 dark:opacity-30">
      <div class="absolute top-[10%] left-[20%] w-[45vw] h-[45vw] rounded-full bg-brand/10 blur-[100px] animate-float-1"></div>
      <div class="absolute bottom-[10%] right-[20%] w-[35vw] h-[35vw] rounded-full bg-brand/5 blur-[80px] animate-float-2"></div>
    </div>

    <!-- 頂部導航欄 -->
    <header class="glass-panel backdrop-blur-md sticky top-0 z-30 flex flex-col lg:flex-row items-center justify-between px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] bg-bg-soft/40 border-b border-line/30 shadow-sm shrink-0 gap-3 lg:gap-0">
      <!-- Logo + Title -->
      <div class="flex items-center gap-2">
        <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white font-bold text-base shadow-sm shadow-brand/20">
          酒
        </div>
        <div>
          <h1 class="text-sm font-bold tracking-wide text-brand flex items-center gap-1.5 leading-none">
            酒館預設編輯器
            <span class="text-[9px] font-normal px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">{{ APP_VERSION }}</span>
          </h1>
          <p class="text-[9px] text-muted font-medium mt-0.5 leading-none lg:block hidden">SillyTavern Preset Editor</p>
          <!-- Show short filename on mobile under title -->
          <p class="text-[9px] text-muted font-medium mt-0.5 leading-none lg:hidden truncate max-w-[140px]" :title="fileName || '未加載'">
            {{ fileName || '未加載' }}
          </p>
        </div>
      </div>

      <!-- Desktop Header Actions (Hidden on mobile) -->
      <div class="hidden lg:flex flex-row items-center justify-end gap-2 z-10">
        <span class="min-h-9 flex flex-col justify-center text-xs px-3 py-1.5 rounded-lg bg-line/20 border border-line/30 text-muted font-medium truncate max-w-[190px]" :title="fileName || '未加載'">
          <span class="truncate">{{ fileName || '未加載' }}</span>
          <span class="text-[10px] font-semibold" :class="autoSaveStatus === 'error' ? 'text-red-500' : autoSaveStatus === 'saving' || autoSaveStatus === 'pending' ? 'text-brand' : 'text-muted'">
            {{ getAutoSaveStatusLabel() }}
          </span>
        </span>

        <select
          :value="currentLocalProjectId || ''"
          :disabled="isLocalProjectBusy || localProjects.length === 0"
          @change="handleLocalProjectSelect"
          class="min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg bg-inputBg border border-line/50 hover:bg-bg transition-all shadow-sm w-[180px]"
          title="切換本機工程庫中的工程"
        >
          <option value="">本機工程庫</option>
          <option v-for="project in localProjects" :key="project.id" :value="project.id">
            {{ project.title }}
          </option>
        </select>
        
        <input type="file" ref="fileInputRef" accept=".json" class="hidden" @change="handleFileChange" />
        
        <button @click="triggerFileInput" class="min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg glass-card hover:text-brand hover:border-brand/40 transition-all shadow-sm flex items-center justify-center gap-1">
          <svg class="w-3.5 h-3.5"><use href="#icon-folder-open" /></svg> 導入
        </button>
        <button @click="createNewProject" class="min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg glass-card hover:text-brand hover:border-brand/40 transition-all shadow-sm flex items-center justify-center gap-1">
          <svg class="w-3.5 h-3.5"><use href="#icon-sparkles" /></svg> 新建
        </button>
        <button @click="renameCurrentProject" :disabled="!isDocLoaded || isLocalProjectBusy" class="min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg glass-card hover:text-brand hover:border-brand/40 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm flex items-center justify-center gap-1">
          改名
        </button>
        <button @click="saveProjectFile" :disabled="!isDocLoaded" class="min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm flex items-center justify-center gap-1">
          <svg class="w-3.5 h-3.5"><use href="#icon-floppy-disk" /></svg> 下載工程
        </button>
        <button @click="saveProjectToLocalLibrary" :disabled="!isDocLoaded || isLocalProjectBusy" class="min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm flex items-center justify-center gap-1">
          <svg class="w-3.5 h-3.5"><use href="#icon-floppy-disk" /></svg> 保存本機
        </button>
        <button @click="deleteCurrentLocalProject" :disabled="!currentLocalProjectId || isLocalProjectBusy" class="min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg glass-card hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/40 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm flex items-center justify-center gap-1">
          刪除本機
        </button>

        <div class="flex gap-1">
          <button @click="toggleTheme" class="min-h-9 min-w-9 p-1.5 text-xs rounded-lg glass-card hover:text-brand hover:border-brand/40 transition-all shadow-sm flex items-center justify-center text-muted" :title="isDark ? '切換為舒適淺色主題' : '切換為午夜深色主題'">
            <svg v-if="isDark" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
            </svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
          </button>
          <button @click="openDocs" class="min-h-9 min-w-9 p-1.5 text-xs rounded-lg glass-card hover:text-brand hover:border-brand/40 transition-all shadow-sm flex items-center justify-center" title="查看文檔">
            <svg class="w-3.5 h-3.5"><use href="#icon-question-circle" /></svg>
          </button>
        </div>
      </div>

      <!-- Mobile Header Actions & Menu Button (Visible on mobile) -->
      <div class="lg:hidden flex items-center justify-end w-full lg:w-auto gap-1.5 z-20">
        <!-- Theme Toggle -->
        <button @click="toggleTheme" class="w-8 h-8 rounded-lg glass-card hover:text-brand transition-all flex items-center justify-center text-muted">
          <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
          </svg>
        </button>

        <!-- Docs -->
        <button @click="openDocs" class="w-8 h-8 rounded-lg glass-card hover:text-brand transition-all flex items-center justify-center text-muted">
          <svg class="w-4 h-4"><use href="#icon-question-circle" /></svg>
        </button>

        <!-- Hamburger Menu Button -->
        <button 
          @click="mobileMenuOpen = !mobileMenuOpen" 
          class="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center transition-all hover:bg-brand/90 focus:outline-none"
        >
          <svg v-if="!mobileMenuOpen" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Mobile Dropdown Actions Menu -->
      <Transition name="fade">
        <div v-if="mobileMenuOpen" class="fixed inset-0 z-40 bg-black/20 lg:hidden" @click="mobileMenuOpen = false"></div>
      </Transition>
      <Transition name="fade">
        <div 
          v-if="mobileMenuOpen" 
          class="lg:hidden absolute top-full left-0 right-0 z-50 glass-panel shadow-2xl flex flex-col p-4 gap-3.5 animate-[scale-up_0.15s_ease-out]"
        >
          <!-- Project Status & Selection -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs font-semibold text-muted">
              <span>當前檔案</span>
              <span :class="autoSaveStatus === 'error' ? 'text-red-500' : 'text-brand'">{{ getAutoSaveStatusLabel() }}</span>
            </div>
            <select
              :value="currentLocalProjectId || ''"
              :disabled="isLocalProjectBusy || localProjects.length === 0"
              @change="handleLocalProjectSelect"
              class="min-h-10 px-3 py-2 text-xs font-semibold rounded-lg bg-inputBg border border-line/50 hover:bg-bg transition-all w-full"
            >
              <option value="">本機工程庫 (無選擇)</option>
              <option v-for="project in localProjects" :key="project.id" :value="project.id">
                {{ project.title }}
              </option>
            </select>
          </div>

          <!-- Buttons Group 1: File Actions -->
          <div class="grid grid-cols-3 gap-2">
            <button @click="triggerFileInput(); mobileMenuOpen = false" class="min-h-10 px-3 py-2 text-xs font-semibold rounded-lg glass-card flex items-center justify-center gap-1.5">
              <svg class="w-3.5 h-3.5"><use href="#icon-folder-open" /></svg> 導入
            </button>
            <button @click="createNewProject(); mobileMenuOpen = false" class="min-h-10 px-3 py-2 text-xs font-semibold rounded-lg glass-card flex items-center justify-center gap-1.5">
              <svg class="w-3.5 h-3.5"><use href="#icon-sparkles" /></svg> 新建
            </button>
            <button @click="renameCurrentProject(); mobileMenuOpen = false" :disabled="!isDocLoaded || isLocalProjectBusy" class="min-h-10 px-3 py-2 text-xs font-semibold rounded-lg glass-card flex items-center justify-center gap-1.5 disabled:opacity-40">
              改名
            </button>
          </div>

          <!-- Buttons Group 2: Save & Backup Actions -->
          <div class="grid grid-cols-2 gap-2">
            <button @click="saveProjectFile(); mobileMenuOpen = false" :disabled="!isDocLoaded" class="min-h-10 px-3 py-2 text-xs font-semibold rounded-lg bg-brand text-white flex items-center justify-center gap-1.5 disabled:opacity-40">
              <svg class="w-3.5 h-3.5"><use href="#icon-floppy-disk" /></svg> 下載工程
            </button>
            <button @click="saveProjectToLocalLibrary(); mobileMenuOpen = false" :disabled="!isDocLoaded || isLocalProjectBusy" class="min-h-10 px-3 py-2 text-xs font-semibold rounded-lg bg-brand text-white flex items-center justify-center gap-1.5 disabled:opacity-40">
              <svg class="w-3.5 h-3.5"><use href="#icon-floppy-disk" /></svg> 保存本機
            </button>
          </div>

          <button @click="deleteCurrentLocalProject(); mobileMenuOpen = false" :disabled="!currentLocalProjectId || isLocalProjectBusy" class="min-h-10 px-3 py-2 text-xs font-semibold rounded-lg border border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10 flex items-center justify-center gap-1.5 disabled:opacity-40">
            <svg class="w-3.5 h-3.5"><use href="#icon-trash" /></svg> 刪除此本機備份
          </button>
        </div>
      </Transition>
    </header>

    <!-- 主分頁切換標籤 -->
    <nav class="flex border-b border-line/20 bg-white/10 dark:bg-black/10 backdrop-blur-sm shrink-0 px-4 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] z-10 relative overflow-x-auto">
      <button 
        @click="activeTab = 'prompts'" 
        :class="['px-5 py-3.5 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2', activeTab === 'prompts' ? 'border-brand text-brand bg-brand/5 shadow-[inset_0_-2px_0_0_var(--brand)]' : 'border-transparent text-muted hover:text-text hover:bg-white/20 dark:hover:bg-white/5']"
      >
        <svg class="w-4 h-4"><use href="#icon-speech-bubble" /></svg> 提示詞預設
      </button>
      <button
        @click="activeTab = 'regex'"
        :class="['px-5 py-3.5 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2', activeTab === 'regex' ? 'border-brand text-brand bg-brand/5 shadow-[inset_0_-2px_0_0_var(--brand)]' : 'border-transparent text-muted hover:text-text hover:bg-white/20 dark:hover:bg-white/5']"
      >
        <svg class="w-4 h-4"><use href="#icon-magnifying-glass" /></svg> 正則過濾
      </button>
      <button
        @click="activeTab = 'api'"
        :class="['px-5 py-3.5 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2', activeTab === 'api' ? 'border-brand text-brand bg-brand/5 shadow-[inset_0_-2px_0_0_var(--brand)]' : 'border-transparent text-muted hover:text-text hover:bg-white/20 dark:hover:bg-white/5']"
      >
        <svg class="w-4 h-4"><use href="#icon-gear" /></svg> API 採樣配置
      </button>
    </nav>

    <!-- 主內容區域 -->
    <main class="flex-1 min-height-0 overflow-hidden relative z-10 p-1.5 lg:p-3 pb-[calc(0.375rem+env(safe-area-inset-bottom))] lg:pb-[calc(0.75rem+env(safe-area-inset-bottom))] pl-[calc(0.375rem+env(safe-area-inset-left))] lg:pl-[calc(0.75rem+env(safe-area-inset-left))] pr-[calc(0.375rem+env(safe-area-inset-right))] lg:pr-[calc(0.75rem+env(safe-area-inset-right))]">
      
      <!-- 1. 提示詞預設分頁 -->
      <section
        v-show="activeTab === 'prompts'"
        class="h-full flex flex-col gap-1.5 lg:gap-3"
        @touchstart.passive="handlePromptEdgeTouchStart"
        @touchmove="handlePromptEdgeTouchMove"
        @touchend="handlePromptEdgeTouchEnd"
        @touchcancel="handlePromptEdgeTouchEnd"
      >
        <!-- 手機版子分頁切換欄：保留編輯/預覽，大列表改由左側抽屜開啟 -->
        <div class="lg:hidden flex border border-line/30 rounded-xl bg-bg-soft/70 backdrop-blur-sm shrink-0 overflow-hidden">
          <button
            @click="openPromptDrawer"
            class="flex-1 py-3 text-xs font-bold border-r border-line/30 text-muted hover:text-brand transition-all flex items-center justify-center gap-1.5"
          >
            <svg class="w-3.5 h-3.5"><use href="#icon-clipboard" /></svg> 列表 ({{ visiblePromptEntries.length }})
          </button>
          <button
            @click="mobileSubTab = 'edit'"
            :class="['flex-1 py-3 text-xs font-bold border-r border-line/30 transition-all flex items-center justify-center gap-1.5', mobileSubTab === 'edit' ? 'text-brand bg-white/50 dark:bg-black/30' : 'text-muted']"
          >
            <svg class="w-3.5 h-3.5"><use href="#icon-pencil" /></svg> 編輯
          </button>
          <button
            @click="mobileSubTab = 'preview'"
            :class="['flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5', mobileSubTab === 'preview' ? 'text-brand bg-white/50 dark:bg-black/30' : 'text-muted']"
          >
            <svg class="w-3.5 h-3.5"><use href="#icon-eye" /></svg> 預覽
          </button>
        </div>

        <!-- 提示詞佈局容器 -->
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 h-full min-h-0 gap-1.5 lg:gap-3 overflow-hidden">
          
          <!-- 1.1 提示詞列表面板 (lg:col-span-3) -->
          <Teleport to="body" :disabled="!isMobile">
            <div
              v-if="isMobile && mobilePromptDrawerOpen"
              class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              @click="closePromptDrawer"
            ></div>
            <aside
              v-show="mobilePromptDrawerOpen || !isMobile"
              :class="[
                'glass-panel rounded-2xl shadow-sm flex flex-col h-full min-h-0 overflow-hidden',
                isMobile ? 'fixed inset-y-0 left-0 z-50 w-80 max-w-[86vw] shadow-2xl transition-transform duration-200 border-r border-line/20' : 'lg:col-span-3',
                isMobile && !mobilePromptDrawerOpen ? '-translate-x-full' : 'translate-x-0'
              ]"
            >
            <!-- 配置組選擇與管理 -->
            <div class="p-3 border-b border-line/20 bg-bg-soft/40 shrink-0 space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-muted">當前配置組 (character_id)</label>
                <div class="flex gap-1.5">
                  <button @click="addProfile" class="p-1 text-xs rounded-md border border-line/50 bg-inputBg hover:border-brand hover:text-brand transition-all" title="新增配置組"><svg class="w-3 h-3"><use href="#icon-plus-circle" /></svg></button>
                  <button @click="editActiveProfileId" class="p-1 text-xs rounded-md border border-line/50 bg-inputBg hover:border-brand hover:text-brand transition-all" title="修改配置組ID"><svg class="w-3 h-3"><use href="#icon-pencil" /></svg></button>
                  <button @click="deleteActiveProfile" class="p-1 text-xs rounded-md border border-line/50 bg-inputBg hover:border-red-500 hover:text-red-500 transition-all text-red-500/80" title="刪除配置組"><svg class="w-3 h-3"><use href="#icon-trash" /></svg></button>
                </div>
              </div>
              <select 
                v-model="selectedProfileId" 
                @change="selectedPromptId = activeProfile?.order?.[0]?.blockId ?? null"
                class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-line/60 bg-inputBg focus:outline-none focus:border-brand font-medium shadow-sm"
              >
                <option v-for="p in doc?.profiles || []" :key="p.characterId" :value="p.characterId">
                  {{ p.characterId }} (啟用 {{ p.order.filter(e => e.enabled).length }}/{{ p.order.length }})
                </option>
              </select>
            </div>

            <!-- 搜索與新增提示詞 -->
            <div class="p-3 border-b border-line/20 shrink-0 space-y-2">
              <div class="flex items-center justify-between lg:hidden">
                <span class="text-xs font-bold text-brand">提示詞列表</span>
                <button @click="closePromptDrawer" class="min-h-9 px-3 text-xs font-semibold rounded-lg border border-line/50 bg-inputBg hover:border-brand transition-all">
                  關閉
                </button>
              </div>
              <div class="relative">
                <input
                  v-model="promptFilter"
                  type="text"
                  placeholder="搜索標題/ID/角色/內文/tag..."
                  class="w-full min-h-10 pl-8 pr-3 py-2 text-xs rounded-lg border border-line/60 bg-inputBg focus:outline-none focus:border-brand"
                />
                <svg class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/60"><use href="#icon-magnifying-glass" /></svg>
              </div>
              <div v-if="hasPromptFilter" class="flex items-center gap-1.5 rounded-lg border border-line/30 bg-bg-soft/40 p-1.5">
                <button
                  @click="jumpPromptSearch(-1)"
                  :disabled="visiblePromptEntries.length === 0"
                  class="min-h-9 px-2.5 text-xs font-semibold rounded border border-line/50 bg-inputBg hover:border-brand disabled:opacity-50 transition-all"
                >
                  上一筆
                </button>
                <button
                  @click="jumpPromptSearch(1)"
                  :disabled="visiblePromptEntries.length === 0"
                  class="min-h-9 px-2.5 text-xs font-semibold rounded border border-line/50 bg-inputBg hover:border-brand disabled:opacity-50 transition-all"
                >
                  下一筆
                </button>
                <span class="ml-auto text-[11px] font-bold text-muted">{{ promptSearchSummary }}</span>
              </div>
              <div v-if="hasPromptFilter" class="text-[10px] text-muted leading-tight">
                搜尋中暫停排序，請清空搜尋後再排序以避免影響其他項目。
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                <button @click="addPrompt" class="min-h-10 py-1 text-xs font-semibold rounded-lg border border-line/50 bg-inputBg hover:border-brand hover:text-brand transition-all flex items-center justify-center gap-1 shadow-sm">
                  <svg class="w-3.5 h-3.5"><use href="#icon-plus-circle" /></svg> 新增
                </button>
                <button @click="duplicatePrompt" :disabled="!selectedPromptId" class="min-h-10 py-1 text-xs font-semibold rounded-lg border border-line/50 bg-inputBg hover:border-brand hover:text-brand disabled:opacity-50 transition-all flex items-center justify-center gap-1 shadow-sm">
                  <svg class="w-3.5 h-3.5"><use href="#icon-users" /></svg> 複製
                </button>
                <button @click="deleteSelectedPrompt" :disabled="!selectedPromptId" class="min-h-10 py-1 text-xs font-semibold rounded-lg border border-line/50 bg-inputBg hover:border-red-500 hover:text-red-500 disabled:opacity-50 transition-all flex items-center justify-center gap-1 shadow-sm">
                  <svg class="w-3.5 h-3.5"><use href="#icon-trash" /></svg> 刪除
                </button>
              </div>
            </div>

            <!-- 提示詞滾動列表 -->
            <div class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              <div v-if="visiblePromptEntries.length === 0" class="text-center py-8 text-xs text-muted">
                沒有匹配的提示詞
              </div>
              <div
                v-for="{ entry, block, index } in visiblePromptEntries"
                :key="entry.blockId"
                :data-prompt-index="index"
                :draggable="canDragSortPrompts"
                @click="selectPrompt(entry.blockId)"
                @dragstart="handlePromptDragStart(index, $event)"
                @dragover.prevent
                @drop="handlePromptDrop(index, $event)"
                @dragend="handlePromptDragEnd"
                @contextmenu.prevent
                @touchstart.passive="handlePromptTouchDragStart(index, $event)"
                @touchmove="handlePromptTouchDragMove"
                @touchend="handlePromptTouchDragEnd"
                @touchcancel="handlePromptTouchDragEnd"
                :class="['group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden select-none', promptDragIndex === index ? 'border-brand bg-brand/10 shadow-md scale-[0.98]' : entry.blockId === selectedPromptId ? 'border-brand bg-brand/5 shadow-sm ring-1 ring-brand/20' : 'border-transparent hover:bg-line/20']"
              >
                <!-- Selected Indicator Line -->
                <div v-if="entry.blockId === selectedPromptId" class="absolute left-0 top-0 bottom-0 w-1 bg-brand"></div>

                <!-- 啟用開關 -->
                <input
                  type="checkbox"
                  v-model="entry.enabled"
                  @click.stopPropagation
                  class="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer shrink-0 z-10"
                />
                
                <!-- 標題與元數據 -->
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-bold truncate text-text" :class="entry.enabled ? '' : 'text-muted line-through opacity-60'">
                    {{ block?.title || `${entry.blockId} (缺失定義)` }}
                  </div>
                  <div class="flex flex-wrap gap-1 mt-1.5">
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-line/30 text-muted font-mono leading-none">{{ entry.blockId }}</span>
                    <span v-if="block?.role" :class="['text-[9px] px-1.5 py-0.5 rounded font-medium leading-none', block.role === 'system' ? 'bg-brand/10 text-brand' : block.role === 'user' ? 'bg-blue-500/10 text-blue-500' : block.role === 'assistant' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-purple-500/10 text-purple-500']">
                      {{ formatPromptRole(block.role) }}
                    </span>
                    <span v-if="block?.marker" class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium leading-none">
                      標記塊
                    </span>
                  </div>
                </div>

                <!-- 排序操作 -->
                <div class="grid grid-cols-2 gap-1 shrink-0">
                  <button
                    @click.stopPropagation="movePromptTo(index, 0)"
                    :disabled="index === 0 || hasPromptFilter"
                    class="min-h-7 px-1 text-[10px] rounded border border-line/60 bg-inputBg hover:border-brand disabled:opacity-30"
                    title="移到頂部"
                  >頂</button>
                  <button
                    @click.stopPropagation="movePrompt(index, -1)"
                    :disabled="index === 0 || hasPromptFilter"
                    class="min-h-7 px-1 text-[10px] rounded border border-line/60 bg-inputBg hover:border-brand disabled:opacity-30 flex items-center justify-center"
                    title="上移"
                  >
                    <svg class="w-3 h-3"><use href="#icon-chevron-up" /></svg>
                  </button>
                  <button
                    @click.stopPropagation="movePromptToPosition(index)"
                    :disabled="hasPromptFilter"
                    class="min-h-7 px-1 text-[10px] rounded border border-line/60 bg-inputBg hover:border-brand disabled:opacity-30"
                    title="移到指定序號"
                  >序</button>
                  <button
                    @click.stopPropagation="movePrompt(index, 1)"
                    :disabled="index === activeProfile.order.length - 1 || hasPromptFilter"
                    class="min-h-7 px-1 text-[10px] rounded border border-line/60 bg-inputBg hover:border-brand disabled:opacity-30 flex items-center justify-center"
                    title="下移"
                  >
                    <svg class="w-3 h-3"><use href="#icon-chevron-down" /></svg>
                  </button>
                  <button
                    @click.stopPropagation="movePromptTo(index, activeProfile.order.length - 1)"
                    :disabled="index === activeProfile.order.length - 1 || hasPromptFilter"
                    class="col-span-2 min-h-7 px-1 text-[9px] rounded border border-line/60 bg-inputBg hover:border-brand disabled:opacity-30 leading-none"
                    title="移到底部"
                  >底</button>
                </div>
              </div>
            </div>
          </aside>
        </Teleport>

          <!-- 1.2 提示詞編輯器面板 (lg:col-span-5) -->
          <section 
            v-show="mobileSubTab !== 'preview' || !isMobile"
            class="lg:col-span-5 glass-panel rounded-2xl shadow-sm flex flex-col h-full min-h-0 overflow-hidden"
          >
            <div class="p-3 border-b border-line/20 bg-bg-soft/40 shrink-0 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <button @click="openPromptDrawer" class="lg:hidden min-h-9 px-3 text-xs font-semibold rounded-lg border border-line/50 bg-inputBg hover:border-brand transition-all flex items-center gap-1 shadow-sm">
                  <svg class="w-3.5 h-3.5"><use href="#icon-clipboard" /></svg> 列表
                </button>
                <h2 class="text-xs font-bold text-brand flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5"><use href="#icon-pencil" /></svg> 提示詞編輯器
                </h2>
              </div>
              <span v-if="selectedPromptBlock" class="text-[10px] font-mono text-muted bg-line/20 px-2 py-0.5 rounded">
                ID: {{ selectedPromptBlock.id }}
              </span>
            </div>

            <!-- 編輯器主體 -->
            <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div v-if="!selectedPromptBlock" class="h-full flex flex-col items-center justify-center text-center text-muted py-12">
                <svg class="w-10 h-10 mb-2 text-muted/30"><use href="#icon-memo" /></svg>
                <p class="text-xs">請在左側選擇或新增一個提示詞進行編輯</p>
              </div>
              
              <div v-else class="space-y-4">
                <!-- ID & 標題 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">提示詞 ID</label>
                    <input 
                      type="text" 
                      :value="selectedPromptBlock.id" 
                      @blur="handlePromptIdBlur"
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand font-mono shadow-sm"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">標題</label>
                    <input 
                      type="text" 
                      v-model="selectedPromptBlock.title" 
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand shadow-sm"
                    />
                  </div>
                </div>

                <!-- 角色 & 狀態 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">角色 (Role)</label>
                    <select 
                      v-model="selectedPromptBlock.role" 
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line bg-inputBg focus:outline-none focus:border-brand shadow-sm"
                    >
                      <option value="">未設置 (none)</option>
                      <option value="system">系統 (system)</option>
                      <option value="user">用戶 (user)</option>
                      <option value="assistant">助手 (assistant)</option>
                      <option value="tool">工具 (tool)</option>
                    </select>
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">狀態與屬性</label>
                    <div class="flex items-center gap-4 h-9 px-1">
                      <label class="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                        <input type="checkbox" v-model="selectedPromptBlock.marker" class="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer" />
                        標記塊 (marker)
                      </label>
                      <label v-if="selectedPromptEntry" class="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                        <input type="checkbox" v-model="selectedPromptEntry.entry.enabled" class="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer" />
                        啟用此項
                      </label>
                    </div>
                  </div>
                </div>

                <!-- 內容編輯區 (IDE Look-alike with line numbers) -->
                <div class="space-y-1 flex flex-col h-[calc(100vh-380px)] lg:h-[calc(100vh-320px)] min-h-[200px]">
                  <div class="flex items-center justify-between shrink-0">
                    <label class="text-xs font-bold text-muted">提示詞內容 (Text)</label>
                    <button @click="expandEditorOpen = true" class="px-2 py-1 text-[10px] rounded border border-line/60 bg-inputBg hover:border-brand hover:text-brand transition-all flex items-center gap-1 shadow-sm" title="全螢幕編輯">
                      <svg class="w-3 h-3"><use href="#icon-expand" /></svg>
                      <span class="hidden sm:inline">全螢幕編輯</span>
                    </button>
                  </div>
                  <div class="relative flex flex-1 rounded-xl border border-line/50 overflow-hidden bg-inputBg focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 focus-within:shadow-[0_0_12px_rgba(176,86,45,0.08)]">
                    <!-- Line numbers panel -->
                    <div class="w-10 bg-bg-soft/40 dark:bg-black/20 border-r border-line/30 flex flex-col items-end pr-2.5 py-3 select-none text-[10px] font-mono text-muted/40 leading-relaxed overflow-hidden">
                      <div :style="{ transform: `translateY(${-editorScrollTop}px)` }" class="transition-transform duration-75">
                        <div v-for="n in Math.max(1, selectedPromptBlock.text.split('\n').length)" :key="n" class="h-5 flex items-center justify-end">{{ n }}</div>
                      </div>
                    </div>
                    <!-- Editor Textarea -->
                    <textarea 
                      v-model="selectedPromptBlock.text" 
                      placeholder="請輸入提示詞內容..."
                      @scroll="handleEditorScroll"
                      style="line-height: 20px;"
                      class="flex-1 w-full p-3 text-xs bg-transparent border-0 focus:ring-0 focus:outline-none font-mono resize-none leading-relaxed custom-scrollbar h-full"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 1.3 導出預覽面板 (lg:col-span-4) -->
          <section 
            v-show="mobileSubTab === 'preview' || !isMobile" 
            class="lg:col-span-4 glass-panel rounded-2xl shadow-sm flex flex-col h-full min-h-0 overflow-hidden"
          >
            <div class="p-3 border-b border-line/20 bg-bg-soft/40 shrink-0 flex items-center justify-between">
              <h2 class="text-xs font-bold text-brand flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5"><use href="#icon-eye" /></svg> 導出預覽
              </h2>
              <div class="flex gap-1.5">
                <button @click="copyExportText" class="px-2.5 py-1 text-xs font-semibold rounded bg-inputBg border border-line/60 hover:text-brand hover:border-brand/40 transition-all shadow-sm flex items-center gap-1">
                  <svg v-if="copySuccess" class="w-3.5 h-3.5 text-emerald-500"><use href="#icon-checkmark-circle" /></svg>
                  <svg v-else class="w-3.5 h-3.5"><use href="#icon-clipboard" /></svg>
                  {{ copySuccess ? '已複製' : '複製' }}
                </button>
                <button @click="downloadExportFile" class="px-2.5 py-1 text-xs font-semibold rounded bg-brand text-white hover:bg-brand/90 transition-all shadow-sm flex items-center gap-1">
                  <svg class="w-3.5 h-3.5"><use href="#icon-download" /></svg> 下載
                </button>
              </div>
            </div>

            <!-- 導出配置選項 -->
            <div class="p-3 border-b border-line/20 shrink-0 space-y-2.5 bg-bg-soft/20">
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-muted">導出格式</label>
                  <select v-model="exportFormat" class="w-full px-2 py-1 text-xs rounded border border-line/60 bg-inputBg focus:outline-none focus:border-brand">
                    <option value="txt">純文本 (TXT)</option>
                    <option value="json">酒館預設 (JSON)</option>
                  </select>
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-muted">提示詞過濾</label>
                  <select v-model="promptModeForCurrentFormat" class="w-full px-2 py-1 text-xs rounded border border-line/60 bg-inputBg focus:outline-none focus:border-brand">
                    <option v-if="exportFormat === 'txt'" value="enabled">僅啟用的提示詞</option>
                    <option v-if="exportFormat === 'txt'" value="all">所有提示詞</option>
                    <option v-if="exportFormat === 'json'" value="all">保留所有 (酒館標準)</option>
                    <option v-if="exportFormat === 'json'" value="enabled">僅導出啟用項</option>
                  </select>
                </div>
              </div>

              <!-- 附加開關 -->
              <div class="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                <label v-if="exportFormat === 'txt'" class="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input type="checkbox" v-model="includeEmpty" class="w-3.5 h-3.5 rounded border-line text-brand focus:ring-brand cursor-pointer" />
                  包含空提示詞
                </label>
                <template v-if="exportFormat === 'json'">
                  <label class="flex items-center gap-1.5 text-xs font-medium cursor-pointer" :class="{'opacity-40 pointer-events-none': selectedRegexIds.size === 0}">
                    <input type="checkbox" v-model="includeRegexInJson" :disabled="selectedRegexIds.size === 0" class="w-3.5 h-3.5 rounded border-line text-brand focus:ring-brand cursor-pointer" />
                    攜帶選中正則 ({{ selectedRegexIds.size }}條)
                  </label>
                  <label class="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input type="checkbox" v-model="includeApiInJson" class="w-3.5 h-3.5 rounded border-line text-brand focus:ring-brand cursor-pointer" />
                    攜帶 API 採樣配置
                  </label>
                </template>
              </div>
            </div>

            <!-- 預覽文本框 -->
            <div class="flex-1 p-3 min-h-0 bg-bg-soft/10 relative overflow-hidden">
              <textarea 
                v-if="exportFormat === 'json'"
                readonly 
                :value="exportOutput" 
                placeholder="導出預覽區域..."
                class="w-full h-full p-3 text-xs rounded-lg border border-line/60 bg-bg-soft/40 font-mono resize-none focus:outline-none leading-relaxed custom-scrollbar dark:bg-black/20"
              ></textarea>
              
              <!-- TXT 可點擊預覽區 -->
              <div 
                v-else 
                class="w-full h-full p-2 text-xs rounded-lg border border-line/60 bg-bg-soft/40 font-mono overflow-y-auto leading-relaxed custom-scrollbar dark:bg-black/20 space-y-1"
              >
                <div v-if="previewBlocks.length === 0" class="text-muted p-2">導出結果為空...</div>
                <div 
                  v-for="(block, idx) in previewBlocks" 
                  :key="idx" 
                  @click="selectPrompt(block.blockId)"
                  class="cursor-pointer hover:bg-brand/10 transition-colors p-2 rounded relative group"
                  :class="block.blockId === selectedPromptId ? 'bg-brand/10 ring-1 ring-brand/40 text-brand' : 'text-text hover:text-brand'"
                  title="點擊跳轉至此提示詞"
                >
                  <div class="whitespace-pre-wrap break-words" :class="{ 'opacity-50 italic': !block.text }">{{ block.text || '(空提示詞)' }}</div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </section>

      <!-- 2. 正則過濾分頁 -->
      <section v-show="activeTab === 'regex'" class="h-full flex flex-col gap-1.5 lg:gap-3">
        <!-- 手機版子分頁切換欄 (僅在 lg 以下顯示) -->
        <div class="lg:hidden flex border border-line/30 rounded-xl bg-bg-soft/70 backdrop-blur-sm shrink-0 overflow-hidden">
          <button 
            @click="mobileRegexSubTab = 'list'" 
            :class="['flex-1 py-3 text-xs font-bold border-r border-line/30 transition-all flex items-center justify-center gap-1.5', mobileRegexSubTab === 'list' ? 'text-brand bg-white/50 dark:bg-black/30' : 'text-muted']"
          >
            <svg class="w-3.5 h-3.5"><use href="#icon-clipboard" /></svg> 正則列表 ({{ visibleRegexItems.length }})
          </button>
          <button
            @click="mobileRegexSubTab = 'edit'"
            :class="['flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5', mobileRegexSubTab === 'edit' ? 'text-brand bg-white/50 dark:bg-black/30' : 'text-muted']"
          >
            <svg class="w-3.5 h-3.5"><use href="#icon-pencil" /></svg> 編輯正則 {{ selectedRegexItem ? `(${selectedRegexItem.script.scriptName || '未命名'})` : '' }}
          </button>
        </div>

        <!-- 正則佈局容器 -->
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 h-full min-h-0 gap-1.5 lg:gap-3 overflow-hidden">
          
          <!-- 2.1 正則列表面板 (lg:col-span-4) -->
          <aside 
            v-show="mobileRegexSubTab === 'list' || !isMobile" 
            class="lg:col-span-4 glass-panel rounded-2xl shadow-sm flex flex-col h-full min-h-0 overflow-hidden border border-line/20"
          >
            <!-- 搜索與操作 -->
            <div class="p-3 border-b border-line/20 bg-bg-soft/40 shrink-0 space-y-2">
              <div class="relative">
                <input 
                  v-model="regexFilter" 
                  type="text" 
                  placeholder="搜索正則名稱/ID/表達式..."
                  class="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-line/60 bg-inputBg focus:outline-none focus:border-brand"
                />
                <svg class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/60"><use href="#icon-magnifying-glass" /></svg>
              </div>
              <input type="file" ref="regexFileInputRef" accept=".json" class="hidden" @change="handleRegexFileChange" />
              <div class="grid grid-cols-4 gap-1.5">
                <button @click="addRegex" class="py-1.5 text-xs font-semibold rounded-lg border border-line/50 bg-inputBg hover:border-brand hover:text-brand transition-all flex items-center justify-center gap-0.5 shadow-sm">
                  <svg class="w-3 h-3"><use href="#icon-plus-circle" /></svg> 新增
                </button>
                <button @click="triggerRegexFileInput" class="py-1.5 text-xs font-semibold rounded-lg border border-line/50 bg-inputBg hover:border-brand hover:text-brand transition-all flex items-center justify-center gap-0.5 shadow-sm">
                  <svg class="w-3 h-3"><use href="#icon-folder-open" /></svg> 導入
                </button>
                <button @click="duplicateRegex" :disabled="!selectedRegexId" class="py-1.5 text-xs font-semibold rounded-lg border border-line/50 bg-inputBg hover:border-brand hover:text-brand disabled:opacity-50 transition-all flex items-center justify-center gap-0.5 shadow-sm">
                  <svg class="w-3 h-3"><use href="#icon-users" /></svg> 複製
                </button>
                <button @click="deleteRegex" :disabled="!selectedRegexId" class="py-1.5 text-xs font-semibold rounded-lg border border-line/50 bg-inputBg hover:border-red-500 hover:text-red-500 disabled:opacity-50 transition-all flex items-center justify-center gap-0.5 shadow-sm">
                  <svg class="w-3 h-3"><use href="#icon-trash" /></svg> 刪除
                </button>
              </div>
              <div class="flex gap-1.5 pt-1">
                <button @click="selectAllRegex" class="flex-1 py-1 text-[10px] font-medium rounded-lg border border-line/50 bg-inputBg hover:border-brand transition-all shadow-sm">
                  全選導出
                </button>
                <button @click="clearRegexSelect" class="flex-1 py-1 text-[10px] font-medium rounded-lg border border-line/50 bg-inputBg hover:border-brand transition-all shadow-sm">
                  取消全選
                </button>
                <button @click="exportSelectedRegexFiles" :disabled="selectedRegexIds.size === 0" class="flex-1 py-1 text-[10px] font-bold rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-50 hover:shadow-lg hover:shadow-brand/20 transition-all flex items-center justify-center gap-0.5 shadow-sm">
                  <svg class="w-3 h-3"><use href="#icon-package" /></svg> 獨立導出
                </button>
              </div>
            </div>

            <!-- 正則滾動列表 -->
            <div class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              <div v-if="visibleRegexItems.length === 0" class="text-center py-8 text-xs text-muted">
                沒有匹配的正則過濾器
              </div>
              <div 
                v-for="{ script } in visibleRegexItems" 
                :key="script.id"
                @click="selectRegex(script.id)"
                :class="['flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden', script.id === selectedRegexId ? 'border-brand bg-brand/5 shadow-sm ring-1 ring-brand/20' : 'border-line/40 hover:border-brand/40 hover:bg-brand/5']"
              >
                <!-- Selected Indicator Line -->
                <div v-if="script.id === selectedRegexId" class="absolute left-0 top-0 bottom-0 w-1 bg-brand"></div>

                <!-- 導出勾選框 -->
                <input 
                  type="checkbox" 
                  :checked="selectedRegexIds.has(script.id)" 
                  @change="toggleRegexExport(script.id)"
                  @click.stopPropagation 
                  class="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer z-10"
                  title="勾選以在 JSON 導出時攜帶此正則"
                />

                <!-- 啟用/停用狀態徽章 -->
                <span 
                  :class="['text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 leading-none', script.disabled ? 'bg-line/40 text-muted' : 'bg-emerald-500/10 text-emerald-500']"
                >
                  {{ script.disabled ? '停用' : '啟用' }}
                </span>
                
                <!-- 標題與表達式 -->
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-bold truncate text-text" :class="script.disabled ? 'opacity-60' : ''">
                    {{ script.scriptName || '未命名正則' }}
                  </div>
                  <div class="flex items-center gap-1.5 mt-1.5">
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-line/30 text-muted font-mono leading-none truncate max-w-[80px]">{{ script.id }}</span>
                    <span class="text-[10px] text-muted font-mono truncate flex-1 leading-none">{{ script.findRegex }}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <!-- 2.2 正則編輯器面板 (lg:col-span-8) -->
          <section 
            v-show="mobileRegexSubTab === 'edit' || !isMobile" 
            class="lg:col-span-8 glass-panel rounded-2xl shadow-sm flex flex-col h-full min-h-0 overflow-hidden border border-line/20"
          >
            <div class="p-3 border-b border-line/20 bg-bg-soft/40 shrink-0 flex items-center justify-between">
              <h2 class="text-xs font-bold text-brand flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5"><use href="#icon-pencil" /></svg> 正則編輯器
              </h2>
              <span v-if="selectedRegexItem" class="text-[10px] font-mono text-muted bg-line/20 px-2 py-0.5 rounded">
                ID: {{ selectedRegexItem.script.id }}
              </span>
            </div>

            <!-- 編輯器主體 -->
            <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div v-if="!selectedRegexItem" class="h-full flex flex-col items-center justify-center text-center text-muted py-12">
                <svg class="w-10 h-10 mb-2 text-muted/30"><use href="#icon-magnifying-glass" /></svg>
                <p class="text-xs">請在左側選擇或新增一個正則過濾器進行編輯</p>
              </div>
              
              <div v-else class="space-y-4 max-w-3xl">
                <!-- ID & 腳本名 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">正則 ID</label>
                    <input 
                      type="text" 
                      :value="selectedRegexItem.script.id" 
                      @blur="handleRegexIdBlur"
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand font-mono shadow-sm"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">腳本名稱</label>
                    <input 
                      type="text" 
                      v-model="selectedRegexItem.script.scriptName" 
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand shadow-sm"
                    />
                  </div>
                </div>

                <!-- 匹配表達式 & 替換文本 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">匹配表達式 (findRegex)</label>
                    <input 
                      type="text" 
                      v-model="selectedRegexItem.script.findRegex" 
                      placeholder="/pattern/g"
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand font-mono shadow-sm"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">替換文本 (replaceString)</label>
                    <input 
                      type="text" 
                      v-model="selectedRegexItem.script.replaceString" 
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand font-mono shadow-sm"
                    />
                  </div>
                </div>

                <!-- 裁剪字符串 & 執行位置 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">裁剪字符串列表 (trimStrings，逗號分隔)</label>
                    <input 
                      type="text" 
                      :value="Array.isArray(selectedRegexItem.script.trimStrings) ? selectedRegexItem.script.trimStrings.join(', ') : ''" 
                      @input="selectedRegexItem.script.trimStrings = $event.target.value.split(',').map(x => x.trim()).filter(Boolean)"
                      placeholder="例如: \n, \r"
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand font-mono shadow-sm"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">執行位置 (placement，逗號分隔)</label>
                    <input 
                      type="text" 
                      :value="Array.isArray(selectedRegexItem.script.placement) ? selectedRegexItem.script.placement.join(', ') : ''" 
                      @input="selectedRegexItem.script.placement = $event.target.value.split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x))"
                      placeholder="例如: 2 (酒館標準)"
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand font-mono shadow-sm"
                    />
                  </div>
                </div>

                <!-- 替代正則 & 最小/最大層數 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">替代正則 (substituteRegex)</label>
                    <input 
                      type="number" 
                      v-model.number="selectedRegexItem.script.substituteRegex" 
                      class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand shadow-sm"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-muted">最小/最大層數 (minDepth / maxDepth)</label>
                    <div class="grid grid-cols-2 gap-2">
                      <input 
                        type="number" 
                        v-model.number="selectedRegexItem.script.minDepth" 
                        placeholder="最小層數"
                        class="px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand shadow-sm"
                      />
                      <input 
                        type="number" 
                        v-model.number="selectedRegexItem.script.maxDepth" 
                        placeholder="最大層數"
                        class="px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <!-- 開關選項 -->
                <div class="space-y-2 pt-2">
                  <label class="text-xs font-bold text-muted block">開關選項</label>
                  <div class="flex flex-wrap gap-x-6 gap-y-3 p-4 rounded-xl border border-line/45 bg-bg-soft/20 backdrop-blur-sm">
                    <label class="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input type="checkbox" v-model="selectedRegexItem.script.disabled" class="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer" />
                      {{ REGEX_SWITCH_LABELS.disabled }}
                    </label>
                    <label class="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input type="checkbox" v-model="selectedRegexItem.script.markdownOnly" class="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer" />
                      {{ REGEX_SWITCH_LABELS.markdownOnly }}
                    </label>
                    <label class="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input type="checkbox" v-model="selectedRegexItem.script.promptOnly" class="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer" />
                      {{ REGEX_SWITCH_LABELS.promptOnly }}
                    </label>
                    <label class="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input type="checkbox" v-model="selectedRegexItem.script.runOnEdit" class="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer" />
                      {{ REGEX_SWITCH_LABELS.runOnEdit }}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </section>

      <!-- 3. API 採樣配置分頁 -->
      <section v-show="activeTab === 'api'" class="h-full flex flex-col glass-panel rounded-2xl shadow-sm overflow-hidden border border-line/20">
        <div class="p-3 border-b border-line/20 bg-bg-soft/40 shrink-0 flex items-center justify-between">
          <div class="flex items-center gap-3 flex-1 max-w-md">
            <h2 class="text-xs font-bold text-brand shrink-0 flex items-center gap-1.5"><svg class="w-3.5 h-3.5"><use href="#icon-gear" /></svg> API 採樣配置</h2>
            <input 
              v-model="apiFilter" 
              type="text" 
              placeholder="過濾配置項名稱..."
              class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-line/60 bg-inputBg focus:outline-none focus:border-brand"
            />
          </div>
          <button @click="addApiSetting" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm flex items-center gap-1">
            <svg class="w-3.5 h-3.5"><use href="#icon-plus-circle" /></svg> 新增配置項
          </button>
        </div>

        <!-- API 配置滾動列表 -->
        <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div v-if="apiSettingsList.length === 0" class="text-center py-12 text-xs text-muted">
            沒有匹配的 API 配置項
          </div>
          
          <div v-else class="max-w-4xl space-y-3">
            <div 
              v-for="item in apiSettingsList" 
              :key="item.key"
              class="flex flex-col md:flex-row md:items-center gap-3 p-3.5 rounded-xl border border-line/50 bg-bg-soft/20 backdrop-blur-sm hover:bg-bg-soft/40 transition-all duration-200"
            >
              <!-- 鍵名與中文標籤 -->
              <div class="md:w-1/3 min-w-0">
                <div class="text-xs font-bold text-text truncate">
                  {{ formatApiKey(item.key) }}
                </div>
                <div class="text-[10px] text-muted font-mono mt-0.5 truncate">
                  {{ item.key }}
                </div>
              </div>

              <!-- 類型選擇 -->
              <select 
                :value="item.type" 
                @change="changeApiType(item.key, $event.target.value)"
                class="w-24 px-2 py-1 text-xs rounded border border-line/60 bg-inputBg focus:outline-none focus:border-brand shrink-0 shadow-sm"
              >
                <option value="string">文本</option>
                <option value="number">數值</option>
                <option value="boolean">開關</option>
                <option value="json">JSON</option>
              </select>

              <!-- 值編輯器 -->
              <div class="flex-1 min-w-0">
                <!-- 1. 開關類型 -->
                <div v-if="item.type === 'boolean'" class="flex items-center h-8">
                  <input 
                    type="checkbox" 
                    v-model="doc.apiSettings[item.key]" 
                    class="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer"
                  />
                </div>
                
                <!-- 2. JSON 類型 -->
                <textarea 
                  v-else-if="item.type === 'json'" 
                  :value="JSON.stringify(item.value, null, 2)"
                  @blur="handleApiJsonBlur(item.key, $event)"
                  rows="2"
                  class="w-full p-2 text-xs rounded border border-line/60 bg-inputBg font-mono focus:outline-none focus:border-brand resize-y custom-scrollbar shadow-sm"
                ></textarea>
                
                <!-- 3. 數值或文本類型 -->
                <input 
                  v-else 
                  :type="item.type === 'number' ? 'number' : 'text'" 
                  v-model="doc.apiSettings[item.key]"
                  @input="doc.apiSettings[item.key] = parseValueByType(item.type, $event.target.value)"
                  class="w-full px-3 py-1.5 text-xs rounded border border-line/60 bg-inputBg focus:outline-none focus:border-brand font-mono shadow-sm"
                />
              </div>

              <!-- 刪除按鈕 -->
              <button 
                @click="removeApiSetting(item.key)" 
                class="px-2.5 py-1.5 text-xs font-semibold rounded border border-line/50 bg-inputBg hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/40 transition-all shrink-0 shadow-sm"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      </section>

    </main>

    <!-- 全螢幕提示詞編輯彈窗 -->
    <Transition name="fade">
      <div v-if="expandEditorOpen" class="fixed inset-0 z-[60] flex flex-col bg-bg/95 backdrop-blur-md pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <!-- Header -->
        <div class="flex items-center justify-between p-3 border-b border-line/20 bg-bg-soft/60 shrink-0 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold">
              <svg class="w-4 h-4"><use href="#icon-expand" /></svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-text">全螢幕編輯</h3>
              <p class="text-[10px] text-muted font-mono" v-if="selectedPromptBlock">ID: {{ selectedPromptBlock.id }}</p>
            </div>
          </div>
          <button @click="expandEditorOpen = false" class="min-h-9 px-4 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand/90 transition-all shadow-sm flex items-center gap-1.5 hover:shadow-lg hover:shadow-brand/20">
            <svg class="w-3.5 h-3.5"><use href="#icon-checkmark-circle" /></svg> 完成
          </button>
        </div>
        
        <!-- Editor -->
        <div class="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
          <div class="relative flex flex-1 rounded-2xl border border-line/50 overflow-hidden bg-inputBg focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 shadow-inner">
            <textarea 
              v-if="selectedPromptBlock"
              v-model="selectedPromptBlock.text" 
              placeholder="請輸入提示詞內容..."
              class="w-full h-full p-4 lg:p-6 text-sm bg-transparent border-0 focus:ring-0 focus:outline-none font-mono resize-none leading-relaxed custom-scrollbar"
            ></textarea>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 究極質感自定義模態彈窗 (Alert / Confirm / Prompt) -->
    <Transition name="fade">
      <div v-if="modalState.show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]">
        <div class="glass-panel w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-line/45 transform transition-all scale-100 p-6 flex flex-col gap-4 animate-[scale-up_0.2s_ease-out]">
          
          <!-- Modal Header -->
          <div class="flex items-center gap-3 border-b border-line/20 pb-3">
            <div class="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold dark:bg-brand/20">
              <svg v-if="modalState.type === 'alert'" class="w-5 h-5"><use href="#icon-question-circle" /></svg>
              <svg v-else-if="modalState.type === 'confirm'" class="w-5 h-5"><use href="#icon-trash" /></svg>
              <svg v-else class="w-5 h-5"><use href="#icon-pencil" /></svg>
            </div>
            <h3 class="text-sm font-bold text-text">{{ modalState.title }}</h3>
          </div>

          <!-- Modal Body -->
          <div class="py-1 text-xs leading-relaxed text-text/80 break-words whitespace-pre-wrap">
            {{ modalState.message }}
          </div>

          <!-- Prompt Input Field -->
          <div v-if="modalState.type === 'prompt'" class="mt-1">
            <input
              type="text"
              v-model="modalState.inputValue"
              :placeholder="modalState.placeholder"
              class="w-full px-3 py-2 text-xs rounded-lg border border-line focus:outline-none focus:border-brand font-sans bg-inputBg"
              @keyup.enter="modalState.resolve"
              ref="modalInputRef"
            />
          </div>

          <!-- Modal Actions -->
          <div class="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-line/20">
            <button
              v-if="modalState.type !== 'alert'"
              @click="modalState.reject"
              class="min-h-9 px-4 py-1.5 text-xs font-semibold rounded-lg glass-card hover:text-brand hover:border-brand/40 transition-all shadow-sm bg-inputBg"
            >
              取消
            </button>
            <button
              @click="modalState.resolve"
              class="min-h-9 px-4 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand/90 transition-all shadow-sm hover:shadow-lg hover:shadow-brand/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              確認
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- SVG 圖標精靈 -->
    <svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
      <!-- icon: folder-open -->
      <symbol id="icon-folder-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1H2V6z"/>
        <path d="M22 10H2l1.5 8a2 2 0 0 0 2 1.5h13a2 2 0 0 0 2-1.5L22 10z"/>
      </symbol>
      <!-- icon: sparkles -->
      <symbol id="icon-sparkles" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>
        <path d="M18 5l.4 1.6L20 7l-1.6.4L18 9l-.4-1.6L16 7l1.6-.4L18 5z"/>
      </symbol>
      <!-- icon: floppy-disk -->
      <symbol id="icon-floppy-disk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-5-5H5z"/>
        <path d="M15 2v5H7V2"/>
        <path d="M7 17h10v5H7z"/>
        <path d="M12 17v3"/>
      </symbol>
      <!-- icon: question-circle -->
      <symbol id="icon-question-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </symbol>
      <!-- icon: speech-bubble -->
      <symbol id="icon-speech-bubble" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
      </symbol>
      <!-- icon: magnifying-glass -->
      <symbol id="icon-magnifying-glass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </symbol>
      <!-- icon: gear -->
      <symbol id="icon-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </symbol>
      <!-- icon: clipboard -->
      <symbol id="icon-clipboard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="8" y="2" width="8" height="4" rx="1"/>
      </symbol>
      <!-- icon: pencil -->
      <symbol id="icon-pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        <path d="M15 5l4 4"/>
      </symbol>
      <!-- icon: eye -->
      <symbol id="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </symbol>
      <!-- icon: trash -->
      <symbol id="icon-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/>
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <line x1="10" y1="11" x2="10" y2="17"/>
        <line x1="14" y1="11" x2="14" y2="17"/>
      </symbol>
      <!-- icon: plus-circle -->
      <symbol id="icon-plus-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </symbol>
      <!-- icon: users -->
      <symbol id="icon-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </symbol>
      <!-- icon: memo -->
      <symbol id="icon-memo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
        <path d="M14 2v6h6"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="12" y2="17"/>
      </symbol>
      <!-- icon: checkmark-circle -->
      <symbol id="icon-checkmark-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="m9 12 2 2 4-4"/>
      </symbol>
      <!-- icon: download -->
      <symbol id="icon-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </symbol>
      <!-- icon: package -->
      <symbol id="icon-package" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </symbol>
      <!-- icon: chevron-up -->
      <symbol id="icon-chevron-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"/>
      </symbol>
      <!-- icon: chevron-down -->
      <symbol id="icon-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </symbol>
      <!-- icon: expand -->
      <symbol id="icon-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
      </symbol>
    </svg>

  </div>
</template>
<style>
/* 自定義滾動條樣式 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--brand);
}

/* Modal Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease-out;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes scale-up {
  from {
    transform: scale(0.96);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
