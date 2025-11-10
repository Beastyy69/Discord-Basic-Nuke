// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  PermissionsBitField,
  AttachmentBuilder
} = require('discord.js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_IDS = (process.env.OWNER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const PREFIX = process.env.PREFIX || 'd!';
const MOD_LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || null;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN missing in .env — add it then restart.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // required for some moderation features (optional)
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  // ensure archives folder exists
  const ardir = path.join(__dirname, 'archives');
  if (!fs.existsSync(ardir)) fs.mkdirSync(ardir, { recursive: true });
});

// helper
function isOwner(id) {
  return OWNER_IDS.includes(String(id));
}

// safe logging helper
function logModerationLine(line) {
  fs.appendFileSync(path.join(__dirname, 'moderation.log'), line + '\n');
  // optionally post to server mod log channel if configured
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // d!ping
  if (cmd === 'ping') {
    const sent = await message.channel.send('Pinging...');
    sent.edit(`Pong! Latency: ${sent.createdTimestamp - message.createdTimestamp}ms`);
    return;
  }

  // d!help
  if (cmd === 'help') {
    return message.channel.send(`**Available commands (safe demo):**
\`${PREFIX}ping\` - latency check
\`${PREFIX}prune <1-50>\` - bulk delete recent messages (requires ManageMessages)
\`${PREFIX}archive [count]\` - archive last N messages from the channel to a local file
\`${PREFIX}warn @user <reason>\` - DM a user a warning and log it
\`${PREFIX}nuke\` - owner-only **safe** archive snapshot (does NOT delete or ban)
`);
  }

  // d!prune <n> - safe controlled bulk delete
  if (cmd === 'prune') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('You need the Manage Messages permission to use this.');
    }
    const n = Math.min(50, Math.max(1, parseInt(args[0]) || 0));
    if (!n) return message.reply(`Usage: ${PREFIX}prune <1-50>`);
    try {
      const deleted = await message.channel.bulkDelete(n + 1, true); // include command msg
      const count = Math.max(0, deleted.size - 1);
      message.channel.send(`Safely deleted ${count} messages.`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
      logModerationLine(`[${new Date().toISOString()}] prune by ${message.author.tag} in #${message.channel.name} — ${count} messages`);
    } catch (err) {
      console.error(err);
      message.reply('Could not prune messages. Note: messages older than 14 days cannot be bulk deleted.');
    }
    return;
  }

  // d!archive [count]
  if (cmd === 'archive') {
    const limit = Math.min(100, Math.max(1, parseInt(args[0]) || 50));
    try {
      const fetched = await message.channel.messages.fetch({ limit });
      const dump = fetched.map(m => ({
        id: m.id,
        authorId: m.author.id,
        authorTag: m.author.tag,
        content: m.content,
        createdAt: m.createdAt,
        attachments: m.attachments.map(a => a.url)
      }));
      const filename = `archive_${message.guild?.id || 'dm'}_${message.channel.id}_${Date.now()}.json`;
      const filepath = path.join(__dirname, 'archives', filename);
      fs.writeFileSync(filepath, JSON.stringify(dump, null, 2));
      await message.reply(`Archived ${dump.length} messages to \`archives/${filename}\`.`);
      logModerationLine(`[${new Date().toISOString()}] archive by ${message.author.tag} in #${message.channel.name} — ${dump.length} messages -> ${filename}`);
    } catch (err) {
      console.error(err);
      message.reply('Failed to archive messages.');
    }
    return;
  }

  // d!warn @user reason
  if (cmd === 'warn') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('You need the Kick Members permission to warn users.');
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply(`Usage: ${PREFIX}warn @user <reason>`);
    const reason = args.slice(1).join(' ') || args.slice(0).join(' ') || 'No reason provided';
    try {
      await user.send(`You have been warned in **${message.guild?.name || 'a server'}** for: ${reason}`);
      message.channel.send(`${user.tag} has been warned (DM sent).`);
      logModerationLine(`[${new Date().toISOString()}] warn by ${message.author.tag} -> ${user.tag} | ${reason}`);
    } catch (err) {
      console.error(err);
      message.reply('Could not DM the user (they may have DMs disabled). Warning logged anyway.');
      logModerationLine(`[${new Date().toISOString()}] warn (DM failed) by ${message.author.tag} -> ${user.tag} | ${reason}`);
    }
    return;
  }

  // d!nuke - OWNER ONLY but SAFE: create an archive snapshot and DM it to owners
  if (cmd === 'nuke') {
    if (!isOwner(message.author.id)) {
      return message.reply('Only the configured bot owner(s) can run this command.');
    }

    // Safe behaviour: collect a snapshot (channels, roles, counts) but DO NOT delete or ban
    try {
      const guild = message.guild;
      if (!guild) return message.reply('This command must be run in a server (guild).');

      const channels = guild.channels.cache.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId || null,
        nsfw: c.nsfw || false
      }));

      const roles = guild.roles.cache.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color || null,
        hoist: r.hoist,
        position: r.position,
        permissions: r.permissions.bitfield
      }));

      const summary = {
        guildId: guild.id,
        guildName: guild.name,
        ownerId: guild.ownerId,
        timestamp: new Date().toISOString(),
        channelCount: channels.length,
        roleCount: roles.length,
        channels,
        roles
      };

      const filename = `nuke_snapshot_${guild.id}_${Date.now()}.json`;
      const filepath = path.join(__dirname, 'archives', filename);
      fs.writeFileSync(filepath, JSON.stringify(summary, null, 2), { encoding: 'utf8' });

      // DM owners with the archive attached
      const attachment = new AttachmentBuilder(filepath);
      const ownerSends = OWNER_IDS.map(async ownerId => {
        try {
          const owner = await client.users.fetch(ownerId);
          await owner.send({ content: `Safe snapshot for server **${guild.name}** (${guild.id}) — requested by ${message.author.tag}`, files: [attachment] });
          return `[OK] DM to ${owner.tag}`;
        } catch (err) {
          console.error('DM failed to owner', ownerId, err);
          return `[FAIL] DM to ${ownerId}`;
        }
      });

      const results = await Promise.all(ownerSends);
      await message.reply(`Safe snapshot created and sent to owners. File: \`archives/${filename}\``);
      logModerationLine(`[${new Date().toISOString()}] safe-nuke snapshot by ${message.author.tag} in ${guild.name} -> ${filename} | owner DM results: ${results.join('; ')}`);

    } catch (err) {
      console.error(err);
      message.reply('Failed to create safe snapshot.');
    }
    return;
  }

  // unknown command handler
  message.reply(`Unknown command. Use \`${PREFIX}help\` to see available commands.`);
});

client.login(BOT_TOKEN);
