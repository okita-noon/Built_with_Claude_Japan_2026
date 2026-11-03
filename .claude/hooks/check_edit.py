#!/usr/bin/env python3
"""PostToolUse フック：編集されたファイルに応じて検査する。

- evals/ 以下 → 評価データの整合チェック
- prompts/ や画面の文言（content/, src/copy/）→ 士業法ガードの禁止表現と母の画面の禁止語
問題があれば終了コード2で理由を stderr に出し、Claude に修正させる。
"""
import json
import subprocess
import sys
from pathlib import Path

BANNED = ["承認されます", "必ず引き取", "引き取ってもらえます", "遺言として残せ", "境界は確定", "相続税はおよそ"]
MOTHER_BANNED = ["相続", "処分", "国に返す", "申請", "期限"]


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    path = (data.get("tool_input") or {}).get("file_path") or ""
    root = Path(data.get("cwd") or ".")
    p = path.replace("\\", "/")

    if "/evals/" in p:
        r = subprocess.run([sys.executable, str(root / "evals" / "score.py"), "validate"],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print("評価データの整合チェックに失敗:\n" + r.stderr, file=sys.stderr)
            return 2

    if any(s in p for s in ("/prompts/", "/content/", "/src/copy/")):
        try:
            text = Path(path).read_text(encoding="utf-8")
        except Exception:
            return 0
        hits = [w for w in BANNED if w in text]
        if "mother" in p or "haha" in p:
            hits += [w for w in MOTHER_BANNED if w in text]
        if hits:
            print(f"{path} に禁止表現: {', '.join(sorted(set(hits)))}。"
                  ".claude/skills/shigyo-guard/SKILL.md と fude-card/SKILL.md に沿って言い換えてください。",
                  file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
