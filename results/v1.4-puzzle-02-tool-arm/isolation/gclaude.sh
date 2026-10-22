#!/bin/sh
# Runs the Claude CLI as the unprivileged generator user.
# Writes the claude.ai login into the generator's HOME from the host's current OAuth token, then drops privileges.
set -e
G=/srv/gh
mkdir -p "$G/.claude"
python3 -c 'import json,sys; t=open("/home/claude/.claude/remote/.oauth_token").read().strip(); json.dump({"claudeAiOauth":{"accessToken":t,"refreshToken":None,"expiresAt":4102444800000,"scopes":["user:inference"]}}, open(sys.argv[1],"w"))' "$G/.claude/.credentials.json"
chown -R 1500:1500 "$G"; chmod 700 "$G" "$G/.claude"; chmod 600 "$G/.claude/.credentials.json"
exec setpriv --reuid=1500 --regid=1500 --clear-groups /opt/claude-code/bin/claude "$@"
