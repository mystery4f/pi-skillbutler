# GLOSSARY

pi-skillbutler 的领域词汇。一个概念一个词；`避免` 行列出不要再用的说法。

## 托管根

pi-skillbutler 亲自扫描的 skill 目录，固定两个：`~/.agents/skills`、`~/.pi/agent/skills`。

_避免_: skillRoots、来源目录、多根。

## 托管 skill

位于某个托管根下、被 pi-skillbutler 扫描到的 skill。只有托管 skill 能带偏好。

_避免_: 本地 skill、自有 skill。

## 未托管 skill

pi 仍会广播、但不由 pi-skillbutler 扫描的 skill（package 自带、项目 `.agents/skills`、`settings.skills` 额外路径）。偏好不作用于它们。

_避免_: 外部 skill、第三方 skill。

## 偏好

某个托管 skill 上一条可配置的用法约定，存成稀疏条目，只写与默认不同的字段。

_避免_: 配置、设置、profile、rule。

## 偏好层

在每轮模型请求前改写系统提示里 skill 清单的那一层：过滤、排序、改写描述。

_避免_: 注入层、拦截器、中间件。

## 总览

偏好层额外附加的一条紧凑文本，概括当前生效的偏好（限长），不逐条展开。

_避免_: 指引块、guidance、system 补丁。

## 路径注入

用户在普通提示里写 `$name`，只把该 skill 的 `SKILL.md` 路径送进本轮上下文，由模型自行按需读取。

_避免_: 注入 body、加载全文、autoload、invoke。

## 去重

同一分支上下文里已出现过某 skill 的路径时，再次选中只回报"已点名"，不重复送入。

_避免_: 缓存命中、loaded 检查。


## 使用统计

按 skill 记录的选中次数与最近一次选中时间，用于发现长期没被用到的 skill。记录落在 `~/.pi/agent/skillbutler-stats.jsonl`，一行一次使用，次数在读取时汇总（ADR-0008）。

_避免_: 埋点、遥测、analytics。

## 补全译文

`$name` 补全列表里显示的中文描述，取自 `~/.pi/agent/i18n.json` 的 `commands["skill:<name>"]`，只给人看，不进模型上下文。

_避免_: 菜单翻译、i18n 描述、翻译缓存。
