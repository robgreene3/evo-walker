#!/usr/bin/env bash
# PreToolUse hook (Bash): deterministic guard for the approval-gated git actions.
# Exit 2 = block and show the reason to the agent. Prefix-pattern allow/deny rules cannot
# express "contains", so this inspects the whole command string.
cmd=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.command||"")}catch(e){}})')
block() { echo "guard-git: blocked — $1 (approval-gated by AGENTS.md; ask Shane)" >&2; exit 2; }
if echo "$cmd" | grep -Eq '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push'; then
  echo "$cmd" | grep -Eq ':main([[:space:]]|$)|[[:space:]]main([[:space:]]|$)|refs/heads/main' && block "push targeting main"
  echo "$cmd" | grep -Eq '(^|[[:space:]])(--force|-f|--force-with-lease[^[:space:]]*|--mirror|--delete|-d)([[:space:]]|$)' && block "force/delete push"
  echo "$cmd" | grep -Eq '[[:space:]]\+[^[:space:]]*:' && block "forced refspec"
fi
echo "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+(reset[[:space:]]+--hard|clean[[:space:]]|branch[[:space:]]+(-D|-d|--delete)|checkout[[:space:]]+--[[:space:]]|restore[[:space:]])' && block "destructive git command"
echo "$cmd" | grep -Eq '(^|[;&|[:space:]])(sudo|rm[[:space:]]+-[a-zA-Z]*[rf])' && block "sudo / recursive-or-forced rm"
exit 0
