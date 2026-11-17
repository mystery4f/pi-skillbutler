# pi-skillbutler 切片工单

每个工单是一刀能从零演示的竖切片：从当前代码出发，结束时用户能看到结果，并关掉一个待定问题。只写行为，不写文件路径。

顺序即依赖顺序：先 T1，后面的都建在它上面。

## T1 扫描与列表

用户能在 pi 里看到两个托管根下的全部 skill，以及每个 skill 的托管状态。

- 在 `~/.agents/skills/<新名>` 放一个最简 skill，重启后列表里出现它。
- 删掉该目录，重启后列表里没有它。
- 同一个名字同时存在于两个根时，列表给出重名提示。

## T2 偏好的写入、覆盖与解释

用户能按名字设置、取消、查看偏好，并知道最终值的来源。

- `set` 写入后，`show` 显示该值并标明来自用户级还是项目级。
- 用户级与项目级给同一字段不同值时，`show` 显示项目级的值。
- `unset` 后回到默认；`unset` 一个不存在的偏好不报错。
- `why` 对任意一个 skill 逐字段说明最终值与来源层级。
- 偏好文件被写成非法 YAML 时，插件不崩，报出文件名与出错字段。

## T3 可见性与排序生效

被隐藏的 skill 不再出现在模型可见的清单里，权重变化改变出现顺序。

- 设 `hidden` 后，同一会话的下一轮请求里该 skill 消失；取消后恢复。
- 给两个 skill 设不同 `weight`，清单顺序随权重改变。
- 没有任何偏好文件时，清单与原生逐字相同。

## T4 总览

偏好生效时，模型能看到一条概括当前偏好的紧凑文本。

- 偏好为空时，这条文本不出现。
- 有 `hidden`、`weight`、`language` 时，文本里能读到这三类信息。
- 文本长度不随偏好条数线性膨胀，超过上限时只保留影响面最大的部分。

## T5 `$name` 路径注入

用户写 `$name` 后，本轮上下文里出现该 skill 的位置，但不出现正文。

- 写 `$foo` 后，模型上下文里能找到该 skill 的 `SKILL.md` 路径，找不到它对 `SKILL.md` 正文内容的引用。
- 同一分支里第二次点名同一个 skill，只出现"已点名"的回报，不重复出现路径。
- 调用一个正文里写了 `$name` 的 prompt 模板，效果与亲手写 `$name` 相同：路径出现，正文不出现。
- 围栏代码块里的 `$name` 不被替换，行内代码里的被替换。
- 同一个 skill 在正文里出现多次，只有第一次被替换成路径，其余保持原字面量。
- 点名一个被 `hidden` 的 skill，同样生效。
- 点名一个不存在的名字，给出可用名字提示，不报错崩溃。

## T6 `$` 补全与译文

用户键入 `$` 时看到全部可见 skill，未托管的被标注，有译文的显示中文。

- 键入 `$` 后弹出全部可见 skill，包括被 `hidden` 的与未托管的。
- 未托管项带可辨认的标注。
- 译文表里有 `skill:<name>` 键的显示中文，无键的显示原文；译文文件不存在时全部原文且不报错。
- 继续输入字符后列表按前缀收窄。

## T7 使用统计与状态查询

用户能看到每个 skill 被点名多少次、最近一次是什么时候。

- 点名若干次后，状态查询返回计数与最近时间。
- 重启 pi 后数据仍在。
- 从未被点名的 skill 出现在"长期未用"一侧。

## 关闭记录

| 工单 | 交付提交 | 覆盖它的测试 |
|---|---|---|
| T1 扫描与列表 | `0494f90` | `test/unit/inventory.test.ts` |
| T2 偏好写入、覆盖与解释 | `0494f90` | `test/unit/preference-writer.test.ts`、`test/unit/command-report.test.ts` |
| T3 可见性与排序生效 | `d91f542` | `test/unit/overlay.test.ts`、`test/integration/session.test.ts` |
| T4 总览 | `d91f542` | `test/unit/overlay.test.ts` |
| T5 `$name` 路径注入 | `d91f542`、`20919c5` | `test/unit/invocation-matcher.test.ts`、`test/unit/invocation-inject.test.ts`、`test/integration/session.test.ts` |
| T6 `$` 补全与译文 | `d91f542` | `test/unit/completion-provider.test.ts`、`test/unit/completion-entries.test.ts` |
| T7 使用统计与状态查询 | `20919c5` | `test/unit/stats-store.test.ts`、`test/integration/session.test.ts` |

## 已知 P2

- 偏好写入是 last-write-wins，没有文件锁：两个会话同时 `set` 会丢一次写入。解锁条件：出现真实的并发写入投诉。
- 使用日志无界增长，没有 reset 命令。解锁条件：日志体量影响到读取时间。
- 单语句控制流统一带大括号，与仓库偏好（不带）不一致；Biome 不强制，暂不批量改写。
- `$` 弹窗最多 50 项：一个根下可见 skill 超过 50 个时，尾部只能靠继续输入收窄。
- `skillbutler_status` 读不到使用日志（权限错误）时如实报工具失败，不降级成「零次」，因为静默的零会误导判断。
