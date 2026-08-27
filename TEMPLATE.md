# Create from templates

Templates live at the repo root (`_template_*.md`). Copy one, rename it, fill the placeholders, then delete leftover comments and unused optional sections. Agent, skill, and reference templates also contain Example blocks — delete those before shipping.

When a skill is ready for use, add a row to the right agent's Skill index, and under What’s in the repo in [README.md](README.md) if needed.

### Agent

1. Copy [`_template_agent.md`](_template_agent.md) → `agents/<name>-agent.md`
2. Fill `name`, `description`, the opening sentence, and Principles
3. Include either **Skills** (code domains) or **Tools** (trackers / MCP) — not both
4. Fill Workflows for how that agent works
5. Delete unused optional sections, author comments, and the Example — ship only filled content

### Skill

1. Copy [`_template_skill.md`](_template_skill.md) → `skills/<name>/SKILL.md`
2. Fill frontmatter (`This skill should be used when … to ensure …`, not `Use when`), intro, Domain (almost always), When to activate, and Core Concepts
3. Add a mode `###` when the skill both writes and reviews (Write vs review, or Write vs audit / Place vs blueprint / Design vs review). Add `### Match the repo` when greenfield defaults differ from brownfield
4. Optional Workflow, then optional Output Format, then Practice areas last. Delete unused optional sections, author comments, and the Example — ship only filled content
5. If you add files under `references/`, list them in Practice areas (`Area` = searchable words)

### Reference

1. Copy [`_template_reference.md`](_template_reference.md) → `skills/<name>/references/<topic>.md`
2. Duplicate the `##` block for each section; fill placeholders; pick the code-block language from the snippet
3. Delete the author comments and the Example block — ship only filled content
4. Link it from the skill's Practice areas table
