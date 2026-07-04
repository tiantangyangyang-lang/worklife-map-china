#!/usr/bin/env bash
set -euo pipefail

cd ~/projects/worklife-map-china
mkdir -p logs prompts .agent

MODEL_CODER="${MODEL_CODER:-gpt-oss:120b-cloud}"
MAX_ROUNDS="${MAX_ROUNDS:-12}"

cat > prompts/autopilot-task.md <<'PROMPT'
你现在是 WorkLife Map China 项目的自动落地 Agent。

你的目标不是写计划，而是直接修改代码、运行测试、修复 bug，直到项目通过 scripts/verify-project.sh。

必须遵守：
1. 不要只写文档，要真的改代码。
2. 不要创建假的完成标记。
3. 不要以 .agent-done 作为完成依据。
4. 完成依据只有：bash scripts/verify-project.sh 通过。
5. 不要删除用户已有文件。
6. 不要绕验证码、登录、反爬、风控。
7. mock/sample 数据必须明确标记。
8. 每轮修改后更新 AGENT_LOG.md 和 PROJECT_STATUS.md。

当前重点：
1. 修复 Minecraft Edition 字段：
   - coord_system 必须统一为 WGS84
   - 必须使用 intensity_level
   - 不要使用 risk_level
2. 确保 /api/minecraft/export?city=深圳&limit=50 返回 200 JSON，不是 404。
3. 确保 minecraft-edition 脚本能生成：
   - dist/markers.json
   - dist/marker-commands.mcfunction
   - dist/citizens-commands.txt
4. 确保 npm run build 通过。
5. 确保 scripts/verify-project.sh 通过。

执行流程：
- 先阅读项目文件。
- 找出失败原因。
- 修改代码。
- 运行 bash scripts/verify-project.sh。
- 如果失败，继续修复。
- 如果通过，创建 .agent/READY_FOR_REVIEW.md，写清楚完成内容和测试结果。

现在开始，不要等待用户确认。
PROMPT

for i in $(seq 1 "$MAX_ROUNDS")
do
  LOG="logs/autopilot-round-$i-$(date +%F-%H%M%S).log"

  echo "=============================="
  echo "AUTO PILOT ROUND $i"
  echo "MODEL: $MODEL_CODER"
  echo "LOG: $LOG"
  echo "=============================="

  codex -a never exec --oss --local-provider=ollama -m "$MODEL_CODER" --dangerously-bypass-approvals-and-sandbox "$(cat prompts/autopilot-task.md)" 2>&1 | tee "$LOG"

  echo "===== Running external verifier =====" | tee -a "$LOG"
  if bash scripts/verify-project.sh 2>&1 | tee -a "$LOG"; then
    echo "===== PROJECT VERIFIED =====" | tee -a "$LOG"
    mkdir -p .agent
    echo "Verified at $(date)" > .agent/READY_FOR_REVIEW.md
    git status --short >> .agent/READY_FOR_REVIEW.md || true
    break
  else
    echo "===== VERIFY FAILED, NEXT ROUND WILL FIX =====" | tee -a "$LOG"
  fi
done
