# ADR-0007 — `$name` 的匹配面：全文、行内代码算数、围栏块除外、只替换首次

## 背景

用户要求 pi-skillbutler 支持 `C:\Users\Administrator\.pi\agent\prompts\retro-full.md` 里的 `$name`：那是一个 prompt 模板，正文写着"先 `$retro`，后 `$wiki-retro`"。

两条事实决定了做法：

- pi 的 `before_agent_start` 在「input handling and expansion」之后触发（`docs/extensions.md:615-617`），`event.prompt` 里已经是模板展开后的正文。所以扫 `event.prompt` 一条规则就能同时覆盖手写 `$name` 与模板正文，不需要为模板单开通道。
- broker 的做法是把围栏代码块与行内代码整段遮成空格（`src/invocation-text.ts`），只留散文参与匹配。它的 `$name` 正则本身是句中匹配（`src/index.ts:102` 的 `DOLLAR_SKILL_PATTERN`），所以"不生效"不是因为它只认行首，而是因为正文里的 `$retro` 全在反引号里。

## 决定

- 匹配 `event.prompt` 全文，围栏代码块（``` / ~~~）遮成空白不参与，行内代码参与。
- 同一 skill 在正文里命中多次时，只替换第一次，其余保留原字面量。
- `\$name` 视为转义，不匹配。
- 未命中任何 skill 的名字原样保留，并按 T5 给一次可用名字提示。

## 被否决的选项

- **照抄 broker，行内代码也屏蔽**：retro-full.md 一行都不会命中，等于不满足需求。用户已把第 5 行的两个 `$name` 移出反引号，但依赖"用户改模板"不是规则。
- **多次出现全部替换**：模板第 18、22、24 行是路径对照表与元注解，全替换会把它们改写成重复的注入句。
- **只匹配行首或整段开头**：`先 $retro，后 $wiki-retro` 这类句中写法直接失效。

## 后果

- 想在模板里保留 `$name` 字面量，只能包进围栏代码块或写成 `\$name`——行内代码不再是保护手段。
- 第 18、22、24 行那种"再说一次路径"的写法靠"只替换首次"保持可读，不靠反引号。
- 匹配面与 broker 不同，用户在两个插件之间切换时会感到行为差异；broker 退役后差异消失。
