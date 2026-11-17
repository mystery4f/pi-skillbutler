# ADR-0001 — 接盘范围：只接托管根、选中注入与 `$` 补全

## 背景

pi-context-broker v0.1.0 提供 18 项能力（多根扫描、远程来源、发现目录、Router、`$name` 注入、关键词规则、Prompt 记录、去重、快照、导出、诊断命令、补全、View、日志隐私、草稿接受、内置 skill）。用户决定 broker 最终移除，pi-skillbutler 承接其中一部分。

## 决定

- 接手扫描，但只扫固定两个根：`~/.agents/skills`、`~/.pi/agent/skills`。
- 接手 `$name` 路径注入：普通提示内联点名，只送出该 skill 的 `SKILL.md` 路径（原"整篇 body"方案已由 ADR-0005 取代）。
- 接手 `$` 触发补全，实现为编辑器补全提供者（`ctx.ui.addAutocompleteProvider`，`triggerCharacters: ["$"]`）。
- 其余一律不接：远程来源、发现目录、Router、关键词规则、Prompt 记录、快照与导出、View、草稿接受、broker 内置 skill。

## 被否决的选项

- **全接（重建 broker）**：三万余行代码换来的是来源管理与一致性协议，而来源已收敛为两个本地目录，没有一致性可保。
- **接关键词规则（F6）**：等于引入第二套配置语法和第二个匹配引擎，且每次命中都要占常驻 token，与体量预算自相矛盾。
- **接发现目录/Router（F3/F4）**：目录的价值在于把散装来源汇总成表；来源只剩两根时无表可汇总。
- **接多根扫描（F1 的完整形态）**：pi 原生 `settings.skills` 已支持路径、`!pattern` 排除与 `+/-path` 精确增删，重复实现只会产生两套"有哪些 skill"。

## 后果

- 偏好只对托管 skill 生效；package 自带与项目级 skill 仍由 pi 广播，但不受偏好管理。
- 想用别的目录，走 pi 原生 `settings.skills`，而不是改本插件配置。
- `$` 补全要能看到未托管 skill，否则用户找不到刚装进 package 的 skill；补全结果需标注"未托管、不可偏好"。
