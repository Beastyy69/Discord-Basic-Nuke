# Discord-Basic-Nuke
A small, non-destructive Discord bot demo built with Node.js and discord.js that shows how to implement common admin features (prune, archive, warn, safe snapshot) while enforcing permission checks and keeping operations reversible and safe. Intended for education and responsible server administration.
Discord Admin Utility (Safe Demo)
=================================

IMPORTANT — READ FIRST
----------------------
This repository is for educational and moderation purposes ONLY. It intentionally avoids destructive commands (mass-bans, mass-deletes, role wipes, etc.). Using a bot to damage or take over servers violates Discord's Terms of Service and may result in account bans or legal consequences.

If you found code in your project that appears destructive, do NOT run it. Replace it with safe alternatives.

What this repo contains
-----------------------
- index.js                — main bot entry (you said you already have this file)
- README.txt              — this file
- .env.example            — template for environment variables
- .gitignore              — recommended ignores
- LICENSE                 — suggested license (MIT)
- archives/               — runtime folder for saved JSON snapshots (created on demand)
- moderation.log          — runtime log file (ignored by .gitignore)

Features (safe)
---------------
- d!ping       — bot health / latency check
- d!prune N    — delete up to N recent messages (1–50). Requires Manage Messages.
- d!archive N  — save the last N messages from a channel to a local JSON file (no deletion)
- d!warn @user <reason> — send a DM warning and log it (requires Kick Members)
- d!nuke       — OWNER-ONLY safe snapshot: collects channels/roles metadata into a JSON file and DMs it to the configured owner IDs. Does NOT delete or ban.

Prerequisites
-------------
- Node.js (recommended v18+)
- npm
- A Discord application & bot token (create at https://discord.com/developers)

Installation
------------
1. Clone the repo:
   git clone https://github.com/<your-username>/<your-repo>.git
   cd <your-repo>

2. Install dependencies:
   npm install

3. Copy `.env.example` -> `.env` and fill in values:
   - BOT_TOKEN: your bot token
   - OWNER_IDS: comma-separated Discord ID(s) for bot owner(s)
   - PREFIX: command prefix (default `d!`)
   - MOD_LOG_CHANNEL_ID: (optional) channel ID for moderation logs
   Example `.env`:
     BOT_TOKEN=your-bot-token-here
     OWNER_IDS=123456789012345678,987654321098765432
     PREFIX=d!
     MOD_LOG_CHANNEL_ID=123456789012345678
     NODE_ENV=development

4. Ensure `.env` is in `.gitignore` (do NOT commit secrets).

5. Run the bot:
   node index.js

(For production use a process manager like pm2 or run inside a container.)

Usage & Commands
----------------
- d!help
  Displays a help message listing available safe commands.

- d!ping
  Replies with latency.

- d!prune <number>
  Bulk deletes recent messages (1–50). Requires the user to have Manage Messages permission. The bot also logs the action and the count.

- d!archive [count]
  Saves the last `count` (default 50, max 100) messages from the current channel into `archives/` as a JSON file. No messages are deleted.

- d!warn @user <reason>
  Sends a DM to the mentioned user informing them of the warning and logs the warning to `moderation.log`.

- d!nuke
  Owner-only command. Creates a safe snapshot of the server (channels and roles metadata) and DMs the snapshot file to the owner IDs. This is deliberately non-destructive.

Safety & Best Practices
-----------------------
- NEVER commit `.env` or your bot token to version control.
- Test new code in a private test server, not on a live community server.
- Limit powerful commands behind permission checks and owner-only gates.
- If the bot token leaks, regenerate it immediately from the Developer Portal.
- Respect Discord API rate limits to avoid being rate-limited or banned.

File notes
----------
- `.env.example` — template environment file (replace values and save as `.env`).
- `.gitignore` — should include: node_modules/, .env, *.log, archives/
- `archives/` — the bot writes JSON archives here. The folder should be ignored in git if it contains sensitive runtime data.

Extending the bot
-----------------
- Add persistent storage (eg. MongoDB) for warnings/infractions.
- Implement a command handler to separate commands into files.
- Add moderation logging to a designated channel (set MOD_LOG_CHANNEL_ID).
- Add role-based permission checks or configurable role whitelists.

Contributing
------------
Contributions are welcome if they follow the safety-first approach. Open issues or PRs for enhancements. Do not add or restore destructive commands.

License
-------
This project can be released under the MIT license. See `LICENSE` for full text.

Support / Contact
-----------------
If you want help customizing the bot or converting an existing `index.js` to the safe version, paste your non-destructive `index.js` here and I can review and improve it. I will not recreate or help with destructive commands.

