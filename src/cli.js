#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { detectSillyTavernApiPreset, importSillyTavernApiPreset } from "./importers/sillytavernApiPreset.js";
import { exportProfileText } from "./exporters/plainText.js";
import { exportRegexScripts, makeRegexScriptFileName } from "./exporters/regexScripts.js";
import { exportSillyTavernPresetJson } from "./exporters/sillytavernPreset.js";
import { normalizeProjectDoc } from "./projectDoc.js";

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node src/cli.js <input.json> [--profile <character_id>] [--list-profiles]",
      "                         [--format txt|json] [--out <file>] [--prompt-mode all|enabled] [--include-empty]",
      "                         [--include-api-settings] [--include-regex] [--regex-ids <id1,id2,...>]",
      "                         [--export-regex-dir <dir>] [--regex-only-enabled]",
      "",
      "Examples:",
      '  node src/cli.js "./preset.json" --list-profiles',
      '  node src/cli.js "./preset.json" --format txt --out out.txt',
      '  node src/cli.js "./preset.json" --format json --prompt-mode all --out preset.json',
      '  node src/cli.js "./preset.json" --export-regex-dir ./regex_out'
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {
    input: null,
    profile: null,
    listProfiles: false,
    format: "txt",
    out: null,
    promptMode: null,
    includeEmpty: false,
    includeApiSettings: false,
    includeRegex: false,
    regexIds: [],
    exportRegexDir: null,
    regexOnlyEnabled: false
  };

  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      args.help = true;
      continue;
    }
    if (a === "--list-profiles") {
      args.listProfiles = true;
      continue;
    }
    if (a === "--profile") {
      const v = argv[i + 1];
      if (!v) throw new Error("--profile requires a value");
      args.profile = v;
      i += 1;
      continue;
    }
    if (a === "--format") {
      const v = argv[i + 1];
      if (!v) throw new Error("--format requires a value");
      args.format = v;
      i += 1;
      continue;
    }
    if (a === "--out") {
      const v = argv[i + 1];
      if (!v) throw new Error("--out requires a value");
      args.out = v;
      i += 1;
      continue;
    }
    if (a === "--prompt-mode") {
      const v = argv[i + 1];
      if (!v) throw new Error("--prompt-mode requires a value");
      args.promptMode = v;
      i += 1;
      continue;
    }
    if (a === "--include-empty") {
      args.includeEmpty = true;
      continue;
    }
    if (a === "--include-api-settings") {
      args.includeApiSettings = true;
      continue;
    }
    if (a === "--include-regex") {
      args.includeRegex = true;
      continue;
    }
    if (a === "--regex-ids") {
      const v = argv[i + 1];
      if (!v) throw new Error("--regex-ids requires a value");
      args.regexIds = v
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (a === "--export-regex-dir") {
      const v = argv[i + 1];
      if (!v) throw new Error("--export-regex-dir requires a value");
      args.exportRegexDir = v;
      i += 1;
      continue;
    }
    if (a === "--regex-only-enabled") {
      args.regexOnlyEnabled = true;
      continue;
    }
    if (a.startsWith("-")) throw new Error(`Unknown flag: ${a}`);
    positional.push(a);
  }

  if (positional.length > 0) args.input = positional[0];
  return args;
}

function detectProjectDoc(data) {
  return data != null && typeof data === "object" && data.kind === "prompt-doc";
}

function selectRegexIds(doc, regexIds) {
  if (regexIds.length > 0) return regexIds;
  return Array.isArray(doc?.regexScripts)
    ? doc.regexScripts.map((script) => script?.id).filter((id) => typeof id === "string")
    : [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    printUsage();
    process.exit(args.help ? 0 : 2);
  }

  const text = await readFile(args.input, "utf8");
  let rawData;
  try {
    rawData = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON: ${String(err?.message ?? err)}`);
  }

  let doc;
  if (detectSillyTavernApiPreset(rawData)) {
    doc = importSillyTavernApiPreset({
      data: rawData,
      sourcePath: args.input,
      title: basename(args.input)
    });
  } else if (detectProjectDoc(rawData)) {
    doc = normalizeProjectDoc(rawData);
  } else {
    throw new Error("Unsupported file format: expected SillyTavern API preset or prompt-doc project JSON.");
  }

  if (args.listProfiles) {
    for (const profile of doc.profiles) {
      const enabled = profile.order.filter((entry) => entry.enabled).length;
      console.log(`${profile.characterId}\t${profile.label}\t(enabled ${enabled}/${profile.order.length})`);
    }
    return;
  }

  const selectedProfile =
    args.profile == null
      ? doc.profiles[0]
      : doc.profiles.find((profile) => String(profile.characterId) === String(args.profile));

  if (!selectedProfile) {
    const available = doc.profiles.map((profile) => profile.characterId).join(", ");
    throw new Error(`Profile not found: ${args.profile}. Available: ${available || "(none)"}`);
  }

  const regexSelectedIds = selectRegexIds(doc, args.regexIds);

  if (args.exportRegexDir) {
    const scripts = exportRegexScripts(doc, {
      includeDisabled: !args.regexOnlyEnabled,
      selectedIds: regexSelectedIds
    });
    await mkdir(args.exportRegexDir, { recursive: true });
    for (let i = 0; i < scripts.length; i += 1) {
      const fileName = makeRegexScriptFileName(scripts[i], i);
      await writeFile(join(args.exportRegexDir, fileName), JSON.stringify(scripts[i], null, 2), "utf8");
    }
    console.error(`Exported regex scripts: ${scripts.length} -> ${args.exportRegexDir}/`);
  }

  if (!args.out) return;

  if (args.format === "json") {
    const promptMode = args.promptMode || "all";
    const preset = exportSillyTavernPresetJson(doc, {
      characterId: selectedProfile.characterId,
      promptMode,
      includeRegex: args.includeRegex,
      includeApiSettings: args.includeApiSettings,
      selectedRegexIds: regexSelectedIds
    });
    await writeFile(args.out, JSON.stringify(preset, null, 2), "utf8");
    console.error(
      `Exported JSON preset -> ${args.out} (promptMode=${promptMode} includeRegex=${args.includeRegex} includeApiSettings=${args.includeApiSettings})`
    );
    return;
  }

  if (args.format !== "txt") {
    throw new Error(`Unknown --format value: ${args.format} (expected txt|json)`);
  }

  const promptMode = args.promptMode || "enabled";
  const exported = exportProfileText(doc, {
    characterId: selectedProfile.characterId,
    format: "plain",
    promptMode,
    includeEmpty: args.includeEmpty
  });
  await writeFile(args.out, exported.text, "utf8");
  console.error(
    `Exported TXT -> ${args.out} (promptMode=${promptMode} emitted=${exported.stats.blocksEmitted} missing=${exported.stats.blocksMissing})`
  );
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
