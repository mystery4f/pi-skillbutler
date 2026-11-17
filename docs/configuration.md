# Configuration

One file per level, keyed by skill name, holding only the settings you want to change.

- User level: `~/.pi/agent/skill-pro.yml` (`$PI_CODING_AGENT_DIR/skill-pro.yml` when that is set).
- Project level: `.pi/skill-pro.yml` in the working directory, which overrides the user level one key at a time.

Both files are read when the extension loads, so an edited file applies after `/reload` or a new session.

## Keys

The file takes one top-level key, `skills`, mapping a skill name to its settings.

| Key | Type | Default | Failure mode |
|---|---|---|---|
| `skills` | map | empty | any other top-level key fails the load with `unknown setting "<key>"` |
| `skills.<name>.hidden` | boolean | `false` | `must be true or false, got <value>` |
| `skills.<name>.weight` | number | `0` | `must be a number, got <value>`; higher sorts earlier, negative sorts later |
| `skills.<name>.language` | string | unset | `must be a non-empty string such as en or zh` |
| `skills.<name>.style` | string | unset | `must be a non-empty string` |

Unknown per-skill keys fail the load and name the allowed four. A skill name that matches nothing in the two managed roots is reported by `/skill-pro why` rather than refused, because the skill may simply not be installed on this machine yet.

## Syntax

Two-space indentation, `key: value` maps, full-line `#` comments. Scalars are `true`, `false`, `null`, integers, decimals, quoted strings, or bare strings. Tabs, odd indentation, duplicate keys and a value that also opens a block are refused with the file and line.

```yaml
# ~/.pi/agent/skill-pro.yml
skills:
  grill-with-docs:
    weight: 2
    style: "Ask, never lecture."
  wiki-retro:
    hidden: true
```

```yaml
# E:/work/demo/.pi/skill-pro.yml — only the key this project changes
skills:
  grill-with-docs:
    language: zh
```
