#!/usr/bin/env node
/**
 * 把 ai/agent-prompt.md 注入 index.html 的 AI-PROMPT 标记区间。
 *
 * 用法：
 *   node tools/sync-agent-prompt.mjs           # 写入 index.html
 *   node tools/sync-agent-prompt.mjs --check   # 只检查是否已同步（CI 可用）
 *
 * 原理：index.html 里有一对标记
 *   <!-- AI-PROMPT:BEGIN --> ... <!-- AI-PROMPT:END -->
 * 每次用 ai/agent-prompt.md 的正文重建该区间内的惰性数据块：
 *   <script type="text/plain" id="ai-agent-prompt"> …提示词正文… </script>
 * 该 script 不会被执行；源码与 DOM 都能读到（element.textContent）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const canonicalPath = fileURLToPath(new URL("ai/agent-prompt.md", root));
const indexPath = fileURLToPath(new URL("index.html", root));
const BEGIN = "<!-- AI-PROMPT:BEGIN -->";
const END = "<!-- AI-PROMPT:END -->";
const checkOnly = process.argv.includes("--check");

const canonical = readFileSync(canonicalPath, "utf8").replace(/\r\n/g, "\n").trimEnd();
if (/<\/script>/i.test(canonical)) {
  console.error("✗ ai/agent-prompt.md 中含有 </script> 字样，会提前终止惰性脚本块，请改写。");
  process.exit(1);
}

// 默认目标 index.html；也可追加额外目标，例如：node tools/sync-agent-prompt.mjs release/v2.0/index.html
const targets = [
  indexPath,
  ...process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith("--"))
    .map((arg) => fileURLToPath(new URL(arg, root))),
];

const rootPath = fileURLToPath(root);
let failed = false;

for (const targetPath of targets) {
  const label = targetPath.slice(rootPath.length);
  const html = readFileSync(targetPath, "utf8");
  // 跟随目标文件自身的换行符写回；校验时把两侧都归一成 LF 比较，
  // 这样编辑器把注入块统一成 CRLF 也不会导致 --check 误报未同步。
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  const blockLines = [
    BEGIN,
    '  <script type="text/plain" id="ai-agent-prompt">',
    canonical,
    "  </script>",
    "  " + END,
  ];
  const block = blockLines.join("\n");
  const blockOut = blockLines.join(eol);

  const marker = new RegExp(
    BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const found = html.match(marker);
  if (!found) {
    console.error(`✗ ${label} 中找不到标记区间 ${BEGIN} … ${END}`);
    failed = true;
    continue;
  }

  if (found[0].replace(/\r\n/g, "\n") === block) {
    console.log(`✓ ${label} 已同步`);
    continue;
  }
  if (checkOnly) {
    console.error(`✗ ${label} 未同步：请运行 \`node tools/sync-agent-prompt.mjs\``);
    failed = true;
    continue;
  }
  writeFileSync(targetPath, html.replace(marker, () => blockOut));
  console.log(`✓ 已把 ai/agent-prompt.md 注入 ${label}`);
}

process.exit(failed ? 1 : 0);
