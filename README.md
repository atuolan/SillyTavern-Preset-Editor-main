# 酒馆预设编辑器（SillyTavern Preset Editor）

`v0.2.3`

一个面向 SillyTavern API 预设的可视化编辑器。  
支持导入预设后进行提示词、正则、API 配置的分离管理，并按需导出为 `TXT`、`JSON` 或独立正则脚本文件。

## 核心能力

- 配置组（`character_id`）管理：新增、改 ID、删除（双重确认）
- 提示词管理：增删改、复制、启用开关、顺序调整
- 正则管理：增删改、多选导出（一个脚本一个 JSON 文件）
- API 配置管理：可视化编辑，导出时可选携带
- 工程文件管理：支持导入/导出工程 JSON，便于二次编辑

## 导出规则（重点）

- 默认导出：`TXT`（纯提示词）
- `JSON` 导出默认不携带正则、不携带 API 配置
- 仅在勾选时，`JSON` 才会携带：
  - 已选中的正则脚本
  - API 配置
- 正则独立导出始终为：**每脚本一个文件**

## 快速开始

### 环境要求

- Node.js `>= 20`

### 启动 Web 界面

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5173/
```

文档页：

```text
http://127.0.0.1:5173/web/docs.html
```

## 使用流程（Web）

1. 导入 SillyTavern 预设 JSON 或已有工程 JSON
2. 选择/管理配置组（`character_id`）
3. 在提示词页完成编辑与开关配置
4. 在正则页编辑并勾选需导出脚本
5. 在 API 配置页按需修改参数
6. 选择导出格式并下载/复制

## CLI 用法

### 列出配置组

```bash
npm run convert -- "./preset.json" --list-profiles
```

### 导出 TXT（默认建议）

```bash
npm run convert -- "./preset.json" --format txt --out ./out.txt
```

### 导出 JSON（酒馆风格）

```bash
npm run convert -- "./preset.json" --format json --prompt-mode all --out ./preset_out.json
```

### 导出 JSON（携带正则 + API 配置）

```bash
npm run convert -- "./preset.json" \
  --format json \
  --prompt-mode all \
  --include-regex \
  --regex-ids "id1,id2" \
  --include-api-settings \
  --out ./preset_out.json
```

### 独立导出正则脚本

```bash
npm run convert -- "./preset.json" --export-regex-dir ./regex_out
```

## 项目结构

```text
src/
  cli.js                       # CLI 入口
  projectDoc.js                # 工程模型与归一化
  importers/sillytavernApiPreset.js
  exporters/plainText.js
  exporters/sillytavernPreset.js
  exporters/regexScripts.js
  server.js                    # 本地静态服务
web/
  index.html                   # 主界面
  app.js                       # 前端逻辑
  styles.css                   # 样式
  docs.html                    # 使用文档页
```

## 当前范围

- 已支持：SillyTavern API preset、本工具工程 JSON
- 规划中：更多目标软件格式的导出适配
