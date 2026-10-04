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

const block = [
  BEGIN,
  '  <script type="text/plain" id="ai-agent-prompt">',
  canonical,
  "  </script>",
  "  " + END,
].join("\n");

const html = readFileSync(indexPath, "utf8");
const marker = new RegExp(
  BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
);
if (!marker.test(html)) {
  console.error(`✗ 在 index.html 中找不到标记区间 ${BEGIN} … ${END}`);
  process.exit(1);
}

const next = html.replace(marker, block);
if (checkOnly) {
  if (next === html) {
    console.log("✓ 已同步（index.html 的 AI 提示词块与 ai/agent-prompt.md 一致）");
    process.exit(0);
  }
  console.error("✗ 未同步：请运行 `node tools/sync-agent-prompt.mjs`");
  process.exit(1);
}
if (next === html) {
  console.log("✓ 无需改动，已是最新。");
  process.exit(0);
}
writeFileSync(indexPath, next);
console.log("✓ 已把 ai/agent-prompt.md 注入 index.html（AI 提示词块已更新）。");
