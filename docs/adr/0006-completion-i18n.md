# ADR-0006 — `$name` 补全描述从 pi-i18n 的译文表取中文

## 背景

用户报告：`/skill:xxx` 在补全菜单里已显示中文，`$grill-with-docs` 仍显示英文原文。

原因在 `@wuyaos/pi-i18n` v0.1.0 的 `extensions/index.ts`：它包装 autocomplete provider 之后先判定 `isSlashCommandPrefix(result.prefix)`（必须以 `/` 开头且不含空格），不满足就直接 `return result`，所以 `$` 场景从不查表。译文表在 `~/.pi/agent/i18n.json`，形如 `{ "version": 1, "commands": { "skill:foo": "…" } }`，键是命令名。本机实测该文件 55 KB、347 个键，其中 `skill:<name>` 124 条。

用户明确：这条描述只在人按 `$` 看菜单时出现，模型看不到它。

## 决定

- `$name` 补全项的 description 按 `commands["skill:<name>"]` 查表：命中用译文，未命中用 skill 的原文描述。
- 只读文件，不 import `@wuyaos/pi-i18n`，也不要求它被安装。文件不存在、JSON 解析失败、缺键，一律回落原文，不报错、不阻塞补全。
- 按 mtime 缓存，文件变化才重读。
- 译文只影响人看的补全弹窗。模型侧系统提示里的描述不查表，保持 skill 原文。

## 被否决的选项

- **在偏好里手写 `description-zh`**：把已有的 124 条译文重抄一遍，以后新增 skill 要维护两处。
- **两者合并（手写优先、回落译表）**：多一条优先级规则，换来的是同一句话的第二个来源，v1 不需要。
- **给 pi-i18n 提 issue 让它按 `item.value` 查表**：用户明确不推上游。即便合并也要等版本发布，本地兜底仍然必需。
- **自己翻译**：补全是热路径，不能每按一次 `$` 调一次模型。

## 后果

- 依赖另一个包的私有文件格式。`version` 字段留作断点：遇到不认识的 version 就整体回落原文。
- 键名 `skill:<name>` 与命令名同源。上游若改键名，这里静默回退英文，不会崩。
- 只有中文一种译文来源。出现第二语言时要先解决"按哪个语言选"，见 scope 的暂缓表。
