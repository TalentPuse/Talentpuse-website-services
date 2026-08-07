---
description: Nâng cấp CopilotKit v1 lên v2 — load skill `copilotkit-upgrade`.
agent: build
---

Load skill `copilotkit-upgrade` (dùng skill tool — skill nằm ở `.claude/skills/copilotkit-upgrade/`) và migrate:

$ARGUMENTS

Dùng deprecation-map + breaking-changes trong skill, thay import/hook v1 → v2, chuyển GraphQL runtime sang AG-UI.
