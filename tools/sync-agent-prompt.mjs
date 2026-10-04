#!/usr/bin/env node
/**
 * 把 ai/agent-prompt.md 注入 index.html 的 AI-PROMPT 标记区间。
 *
 * 用法：
 *   node tools/sync-agent-prompt.mjs                          # 写入 index.html
 *   node tools/sync-agent-prompt.mjs release/v2.0/index.html  # 同时写入其它副本
 *   node tools/sync-agent-prompt.mjs --check                  # 只检查是否已同步（CI 可用）
 *
 * 原理：HTML 里有一对标记
 *   <!-- AI-PROMPT:BEGIN --> ... <!-- AI-PROMPT:END -->
 * 脚本用 ai/agent-prompt.md 的正文重建该区间，并把它固定放在 </body> 之前（旧位置会被自动清理）：
 *   <div id="ai-agent-prompt" class="ai-agent-prompt"> …提示词正文… </div>
 * 这个 div 被 .ai-agent-prompt 样式裁到 1px 且不可选中 —— 用户看不到、选中不了，
 * 但它是真实的文本节点：源码、DOM（textContent）与“整页可见文本提取”都能读到。
 * 之所以不再放在 <head> 的 <script type="text/plain"> 里：那类内容不会进入整页文本提取，
 * 会使“只读页面文本”的 AI 拿不到提示词。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const canonicalPath = fileURLToPath(new URL("ai/agent-prompt.md", root));
const indexPath = fileURLToPath(new URL("index.html", root));
const BEGIN = "<!-- AI-PROMPT:BEGIN -->";
const END = "<!-- AI-PROMPT:END -->";
const checkOnly = process.argv.includes("--check");

const canonical = readFileSync(canonicalPath, "utf8").replace(/\r\n/g, "\n").trim();
if (/[<>]/.test(canonical)) {
  console.error("✗ ai/agent-prompt.md 中含有 < 或 >，放进 HTML 文本节点会破坏结构，请改用全角或删除。");
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
  const raw = readFileSync(targetPath, "utf8");
  // 统一成 LF 处理，最后按目标文件自身换行符写回 —— 编辑器改换行符也不会导致 --check 误报
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const html = raw.replace(/\r\n/g, "\n");

  const block = [
    BEGIN,
    "  <!-- 给 AI 的提示词：对用户视觉隐藏（不占位、不可选中），但保留真实文本节点，",
    "       源码、DOM 与「整页可见文本提取」都能读到；它不会被执行。 -->",
    '  <div id="ai-agent-prompt" class="ai-agent-prompt">' + canonical,
    "  </div>",
    "  " + END,
  ].join("\n");

  // 先移除可能残留在别处的旧区间（例如早期版本放在 <head> 里），再统一插到 </body> 之前
  const marker = new RegExp(
    "[ \\t]*" + BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" +
      END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[ \\t]*\\n?"
  );
  const stripped = html.replace(marker, "");
  if (stripped.includes(BEGIN)) {
    console.error(`✗ ${label} 存在多处标记区间，请先手动清理`);
    failed = true;
    continue;
  }
  const bodyEnd = stripped.lastIndexOf("</body>");
  if (bodyEnd === -1) {
    console.error(`✗ ${label} 中找不到 </body>，无法定位注入位置`);
    failed = true;
    continue;
  }
  const next = stripped.slice(0, bodyEnd) + block + "\n" + stripped.slice(bodyEnd);

  if (next === html) {
    console.log(`✓ ${label} 已同步`);
    continue;
  }
  if (checkOnly) {
    console.error(`✗ ${label} 未同步：请运行 \`node tools/sync-agent-prompt.mjs\``);
    failed = true;
    continue;
  }
  writeFileSync(targetPath, next.replace(/\n/g, eol));
  console.log(`✓ 已把 ai/agent-prompt.md 注入 ${label}`);
}

process.exit(failed ? 1 : 0);
