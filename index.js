const {
Client,
GatewayIntentBits,
EmbedBuilder,
PermissionFlagsBits,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
REST,
Routes,
SlashCommandBuilder
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID || "1514692669752999986";

if (!TOKEN) {
console.error("Missing TOKEN. Add TOKEN in Railway Variables.");
process.exit(1);
}

const client = new Client({
intents: [GatewayIntentBits.Guilds]
});

const db = new sqlite3.Database("./erlc.db");

function run(sql, params) {
return new Promise(function (resolve, reject) {
db.run(sql, params || [], function (err) {
if (err) reject(err);
else resolve(this);
});
});
}

function get(sql, params) {
return new Promise(function (resolve, reject) {
db.get(sql, params || [], function (err, row) {
if (err) reject(err);
else resolve(row);
});
});
}

function all(sql, params) {
return new Promise(function (resolve, reject) {
db.all(sql, params || [], function (err, rows) {
if (err) reject(err);
else resolve(rows || []);
});
});
}

async function addColumnIfMissing(table, column, definition) {
const columns = await all("PRAGMA table_info(" + table + ")");
const names = columns.map(function (col) {
return col.name;
});

if (!names.includes(column)) {
await run("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
}
}

async function setupDatabase() {
await run("CREATE TABLE IF NOT EXISTS permission_roles (permission TEXT NOT NULL, roleId TEXT NOT NULL, UNIQUE(permission, roleId))");
await run("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)");
await run("CREATE TABLE IF NOT EXISTS autoroles (roleId TEXT PRIMARY KEY)");
await run("CREATE TABLE IF NOT EXISTS cases (caseNumber INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, userId TEXT NOT NULL, officerId TEXT NOT NULL, reason TEXT NOT NULL, duration TEXT, createdAt INTEGER, arrestLocation TEXT, mugshotUrl TEXT)");

await addColumnIfMissing("cases", "duration", "TEXT");
await addColumnIfMissing("cases", "createdAt", "INTEGER");
await addColumnIfMissing("cases", "arrestLocation", "TEXT");
await addColumnIfMissing("cases", "mugshotUrl", "TEXT");

await run("CREATE TABLE IF NOT EXISTS active_shifts (userId TEXT PRIMARY KEY, startedAt INTEGER NOT NULL, status TEXT DEFAULT 'active', breakStartedAt INTEGER, totalBreakMs INTEGER DEFAULT 0)");

await addColumnIfMissing("active_shifts", "status", "TEXT DEFAULT 'active'");
await addColumnIfMissing("active_shifts", "breakStartedAt", "INTEGER");
await addColumnIfMissing("active_shifts", "totalBreakMs", "INTEGER DEFAULT 0");

await run("CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT NOT NULL, startedAt INTEGER, endedAt INTEGER, minutes INTEGER NOT NULL)");

await addColumnIfMissing("shifts", "startedAt", "INTEGER");
await addColumnIfMissing("shifts", "endedAt", "INTEGER");
}

const permissionChoices = [
{ name: "staff", value: "staff" },
{ name: "mod", value: "mod" },
{ name: "admin", value: "admin" },
{ name: "high", value: "high" },
{ name: "infract", value: "infract" }
];

const commands = [
new SlashCommandBuilder().setName("help").setDescription("View bot commands"),

new SlashCommandBuilder()
.setName("embed")
.setDescription("Send professional embeds")
.addSubcommand(function (sub) {
return sub
.setName("send")
.setDescription("Send a custom embed")
.addChannelOption(function (o) { return o.setName("channel").setDescription("Channel to send in").setRequired(true); })
.addStringOption(function (o) { return o.setName("title").setDescription("Embed title").setRequired(true).setMaxLength(256); })
.addStringOption(function (o) { return o.setName("description").setDescription("Embed description").setRequired(true).setMaxLength(4000); })
.addStringOption(function (o) {
return o.setName("color").setDescription("Embed color").setRequired(false).addChoices(
{ name: "Black", value: "black" },
{ name: "Blue", value: "blue" },
{ name: "Green", value: "green" },
{ name: "Red", value: "red" },
{ name: "Gold", value: "gold" },
{ name: "Purple", value: "purple" },
{ name: "White", value: "white" }
);
})
.addStringOption(function (o) { return o.setName("image").setDescription("Large image URL").setRequired(false); })
.addStringOption(function (o) { return o.setName("thumbnail").setDescription("Thumbnail URL").setRequired(false); })
.addStringOption(function (o) { return o.setName("footer").setDescription("Footer text").setRequired(false).setMaxLength(2048); });
}),

new SlashCommandBuilder()
.setName("welcome")
.setDescription("Manage welcome messages")
.addSubcommand(function (sub) {
return sub
.setName("set")
.setDescription("Set the welcome channel and message")
.addChannelOption(function (o) { return o.setName("channel").setDescription("Welcome channel").setRequired(true); })
.addStringOption(function (o) { return o.setName("title").setDescription("Welcome title").setRequired(false).setMaxLength(256); })
.addStringOption(function (o) { return o.setName("message").setDescription("Use {user}, {server}, {memberCount}").setRequired(false).setMaxLength(4000); })
.addStringOption(function (o) { return o.setName("image").setDescription("Image URL").setRequired(false); });
})
.addSubcommand(function (sub) { return sub.setName("off").setDescription("Turn off welcome messages"); })
.addSubcommand(function (sub) { return sub.setName("test").setDescription("Test welcome message"); }),

new SlashCommandBuilder()
.setName("autorole")
.setDescription("Manage auto roles")
.addSubcommand(function (sub) {
return sub.setName("add").setDescription("Add auto role").addRoleOption(function (o) { return o.setName("role").setDescription("Role").setRequired(true); });
})
.addSubcommand(function (sub) {
return sub.setName("remove").setDescription("Remove auto role").addRoleOption(function (o) { return o.setName("role").setDescription("Role").setRequired(true); });
})
.addSubcommand(function (sub) { return sub.setName("list").setDescription("List auto roles"); }),

new SlashCommandBuilder()
.setName("perm")
.setDescription("Manage permission roles")
.addSubcommand(function (sub) {
return sub
.setName("add")
.setDescription("Add permission role")
.addStringOption(function (o) { return o.setName("permission").setDescription("Permission").setRequired(true).addChoices.apply(o, permissionChoices); })
.addRoleOption(function (o) { return o.setName("role").setDescription("Role").setRequired(true); });
})
.addSubcommand(function (sub) {
return sub
.setName("remove")
.setDescription("Remove permission role")
.addStringOption(function (o) { return o.setName("permission").setDescription("Permission").setRequired(true).addChoices.apply(o, permissionChoices); })
.addRoleOption(function (o) { return o.setName("role").setDescription("Role").setRequired(true); });
})
.addSubcommand(function (sub) { return sub.setName("list").setDescription("List permission roles"); }),

new SlashCommandBuilder()
.setName("config")
.setDescription("Configure bot")
.addSubcommand(function (sub) {
return sub.setName("logs").setDescription("Set logs channel").addChannelOption(function (o) { return o.setName("channel").setDescription("Logs channel").setRequired(true); });
})
.addSubcommand(function (sub) {
return sub.setName("onduty").setDescription("Set On-Duty role").addRoleOption(function (o) { return o.setName("role").setDescription("On-Duty role").setRequired(true); });
}),

new SlashCommandBuilder()
.setName("shift")
.setDescription("Shift system")
.addSubcommand(function (sub) { return sub.setName("manage").setDescription("Open shift panel"); }),

new SlashCommandBuilder()
.setName("log")
.setDescription("Log ERLC actions")
.addSubcommand(function (sub) {
return sub
.setName("arrest")
.setDescription("Log an arrest")
.addStringOption(function (o) { return o.setName("suspect_username").setDescription("Roblox username").setRequired(true); })
.addStringOption(function (o) { return o.setName("charges").setDescription("Charges").setRequired(true); })
.addStringOption(function (o) { return o.setName("arrest_location").setDescription("Location").setRequired(true); })
.addAttachmentOption(function (o) { return o.setName("mugshot").setDescription("Mugshot image").setRequired(false); });
}),

new SlashCommandBuilder().setName("leaderboard").setDescription("View shift leaderboard"),

new SlashCommandBuilder().setName("warn").setDescription("Warn a user")
.addUserOption(function (o) { return o.setName("user").setDescription("User").setRequired(true); })
.addStringOption(function (o) { return o.setName("reason").setDescription("Reason").setRequired(false); }),

new SlashCommandBuilder().setName("infract").setDescription("Create an infraction")
.addUserOption(function (o) { return o.setName("user").setDescription("User").setRequired(true); })
.addStringOption(function (o) { return o.setName("reason").setDescription("Reason").setRequired(false); }),

new SlashCommandBuilder().setName("kick").setDescription("Kick a user")
.addUserOption(function (o) { return o.setName("user").setDescription("User").setRequired(true); })
.addStringOption(function (o) { return o.setName("reason").setDescription("Reason").setRequired(false); }),

new SlashCommandBuilder().setName("ban").setDescription("Ban a user")
.addUserOption(function (o) { return o.setName("user").setDescription("User").setRequired(true); })
.addStringOption(function (o) { return o.setName("reason").setDescription("Reason").setRequired(false); }),

new SlashCommandBuilder().setName("mute").setDescription("Timeout a user")
.addUserOption(function (o) { return o.setName("user").setDescription("User").setRequired(true); })
.addIntegerOption(function (o) { return o.setName("minutes").setDescription("Minutes").setRequired(false).setMinValue(1).setMaxValue(40320); })
.addStringOption(function (o) { return o.setName("reason").setDescription("Reason").setRequired(false); }),

new SlashCommandBuilder().setName("unmute").setDescription("Remove timeout")
.addUserOption(function (o) { return o.setName("user").setDescription("User").setRequired(true); })
.addStringOption(function (o) { return o.setName("reason").setDescription("Reason").setRequired(false); }),

new SlashCommandBuilder().setName("case").setDescription("Look up case")
.addIntegerOption(function (o) { return o.setName("number").setDescription("Case number").setRequired(true); }),

new SlashCommandBuilder().setName("history").setDescription("View user history")
.addUserOption(function (o) { return o.setName("user").setDescription("User").setRequired(true); })
].map(function (command) {
return command.toJSON();
});

const permissionCache = {
staff: new Set(),
mod: new Set(),
admin: new Set(),
high: new Set(),
infract: new Set()
};

async function loadPermissions() {
permissionCache.staff.clear();
permissionCache.mod.clear();
permissionCache.admin.clear();
permissionCache.high.clear();
permissionCache.infract.clear();

const rows = await all("SELECT permission, roleId FROM permission_roles");

for (const row of rows) {
if (permissionCache[row.permission]) {
permissionCache[row.permission].add(row.roleId);
}
}
}

function isAdmin(interaction, member) {
if (interaction && interaction.memberPermissions && interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return true;
if (member && member.permissions && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
return false;
}

async function getCommandMember(interaction) {
if (interaction.member && interaction.member.roles && interaction.member.roles.cache) return interaction.member;

try {
return await interaction.guild.members.fetch(interaction.user.id);
} catch (error) {
return interaction.member;
}
}

async function getTargetMember(interaction) {
const member = interaction.options.getMember("user");
if (member) return member;

const user = interaction.options.getUser("user");
if (!user) return null;

try {
return await interaction.guild.members.fetch(user.id);
} catch (error) {
return null;
}
}

function memberLevel(member, interaction) {
if (isAdmin(interaction, member)) return 4;
if (!member || !member.roles || !member.roles.cache) return 0;

let level = 0;

for (const role of member.roles.cache.values()) {
if (permissionCache.staff.has(role.id)) level = Math.max(level, 1);
if (permissionCache.mod.has(role.id)) level = Math.max(level, 2);
if (permissionCache.admin.has(role.id)) level = Math.max(level, 3);
if (permissionCache.high.has(role.id)) level = Math.max(level, 4);
}

return level;
}

function hasLevel(member, needed, interaction) {
const levels = { staff: 1, mod: 2, admin: 3, high: 4 };
return memberLevel(member, interaction) >= levels[needed];
}

function hasInfract(member, interaction) {
if (isAdmin(interaction, member)) return true;
if (hasLevel(member, "high", interaction)) return true;
if (!member || !member.roles || !member.roles.cache) return false;

return member.roles.cache.some(function (role) {
return permissionCache.infract.has(role.id);
});
}

function canAct(member, targetMember, interaction) {
if (!targetMember) return true;
if (memberLevel(member, interaction) >= 4) return true;
return memberLevel(member, interaction) > memberLevel(targetMember, null);
}

async function setConfig(key, value) {
await run("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}

async function getConfig(key) {
const row = await get("SELECT value FROM config WHERE key = ?", [key]);
if (!row) return null;
return row.value;
}

async function getAutoRoles() {
return await all("SELECT roleId FROM autoroles");
}

async function addAutoRole(roleId) {
const existing = await get("SELECT roleId FROM autoroles WHERE roleId = ?", [roleId]);

if (existing) {
return { ok: true, message: "That role is already an auto-role." };
}

const roles = await getAutoRoles();

if (roles.length >= 5) {
return { ok: false, message: "Max 5 auto roles." };
}

await run("INSERT INTO autoroles (roleId) VALUES (?)", [roleId]);
return { ok: true, message: "Auto-role saved." };
}

async function removeAutoRole(roleId) {
await run("DELETE FROM autoroles WHERE roleId = ?", [roleId]);
return { ok: true, message: "Auto-role removed." };
}

async function createCase(type, userId, officerId, reason, duration, extra) {
const now = Date.now();
const arrestLocation = extra && extra.arrestLocation ? extra.arrestLocation : null;
const mugshotUrl = extra && extra.mugshotUrl ? extra.mugshotUrl : null;

const result = await run(
"INSERT INTO cases (type, userId, officerId, reason, duration, createdAt, arrestLocation, mugshotUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
[type, userId, officerId, reason || "No reason", duration || null, now, arrestLocation, mugshotUrl]
);

return {
caseNumber: result.lastID,
type: type,
userId: userId,
officerId: officerId,
reason: reason || "No reason",
duration: duration || null,
createdAt: now,
arrestLocation: arrestLocation,
mugshotUrl: mugshotUrl
};
}

function caseEmbed(item) {
const userValue = item.type === "ARREST" ? item.userId : "<@" + item.userId + ">";

const embed = new EmbedBuilder()
.setTitle(item.type + " Case #" + item.caseNumber)
.setColor(0x2b2d31)
.addFields(
{ name: "User", value: userValue, inline: true },
{ name: "Officer", value: "<@" + item.officerId + ">", inline: true },
{ name: "Reason", value: item.reason || "No reason", inline: false }
)
.setFooter({ text: "Case Number: " + item.caseNumber })
.setTimestamp();

if (item.duration) embed.addFields({ name: "Duration", value: item.duration, inline: true });
if (item.arrestLocation) embed.addFields({ name: "Arrest Location", value: item.arrestLocation, inline: false });
if (item.mugshotUrl) embed.setImage(item.mugshotUrl);

return embed;
}

async function sendLog(embed) {
const channelId = await getConfig("logs_channel_id");
if (!channelId) return;

const channel = await client.channels.fetch(channelId).catch(function () {
return null;
});

if (!channel) return;

await channel.send({ embeds: [embed] }).catch(function () {});
}

function fillWelcome(text, member) {
return text
.replaceAll("{user}", "<@" + member.id + ">")
.replaceAll("{server}", member.guild.name)
.replaceAll("{memberCount}", String(member.guild.memberCount));
}

async function sendWelcome(member) {
const enabled = await getConfig("welcome_enabled");
const channelId = await getConfig("welcome_channel_id");

if (enabled !== "true" || !channelId) return;

const title = await getConfig("welcome_title") || "Welcome to Sentinel Enforcement Authority";
const message = await getConfig("welcome_message") || "Welcome {user} to {server}! You are member #{memberCount}.";
const image = await getConfig("welcome_image");

const channel = await member.guild.channels.fetch(channelId).catch(function () {
return null;
});

if (!channel || !channel.isTextBased()) return;

const embed = new EmbedBuilder()
.setTitle(fillWelcome(title, member))
.setDescription(fillWelcome(message, member))
.setColor(0x2b2d31)
.setThumbnail(member.user.displayAvatarURL({ size: 256 }))
.setTimestamp();

if (image && image.startsWith("http")) embed.setImage(image);

await channel.send({ content: "<@" + member.id + ">", embeds: [embed] }).catch(function () {});
}

function formatMs(ms) {
const mins = Math.floor(ms / 60000);
const hours = Math.floor(mins / 60);
const minutes = mins % 60;

if (hours > 0) return hours + "h " + minutes + "m";
return minutes + "m";
}

async function getActiveShift(userId) {
return await get("SELECT * FROM active_shifts WHERE userId = ?", [userId]);
}

function getShiftBreakMs(shift) {
if (!shift) return 0;

let totalBreakMs = Number(shift.totalBreakMs || 0);

if (shift.status === "break" && shift.breakStartedAt) {
totalBreakMs += Date.now() - Number(shift.breakStartedAt);
}

return totalBreakMs;
}

function getShiftActiveMs(shift) {
if (!shift) return 0;
return Math.max(0, Date.now() - Number(shift.startedAt) - getShiftBreakMs(shift));
}

function shiftEmbed(user, shift, notice) {
const embed = new EmbedBuilder()
.setTitle("Shift Management")
.setColor(0x2b2d31)
.setDescription(notice || "Use the buttons below to manage your shift.")
.setTimestamp();

if (!shift) {
embed.addFields(
{ name: "User", value: "<@" + user.id + ">", inline: true },
{ name: "Status", value: "Off Duty", inline: true },
{ name: "Active Time", value: "0m", inline: true },
{ name: "Break Time", value: "0m", inline: true }
);
} else {
embed.addFields(
{ name: "User", value: "<@" + user.id + ">", inline: true },
{ name: "Status", value: shift.status === "break" ? "On Break" : "On Shift", inline: true },
{ name: "Started", value: "<t:" + Math.floor(Number(shift.startedAt) / 1000) + ":R>", inline: true },
{ name: "Active Time", value: formatMs(getShiftActiveMs(shift)), inline: true },
{ name: "Break Time", value: formatMs(getShiftBreakMs(shift)), inline: true }
);
}

return embed;
}

function shiftButtons(userId, shift) {
const hasShift = !!shift;
const onBreak = shift && shift.status === "break";

return [
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("shift_start_" + userId).setLabel("Start").setStyle(ButtonStyle.Success).setDisabled(hasShift),
new ButtonBuilder().setCustomId("shift_end_" + userId).setLabel("End").setStyle(ButtonStyle.Danger).setDisabled(!hasShift),
new ButtonBuilder().setCustomId("shift_break_" + userId).setLabel("Break").setStyle(ButtonStyle.Secondary).setDisabled(!hasShift || onBreak),
new ButtonBuilder().setCustomId("shift_resume_" + userId).setLabel("Resume").setStyle(ButtonStyle.Primary).setDisabled(!hasShift || !onBreak)
)
];
}

async function getOnDutyRoleId() {
return await getConfig("onduty_role_id");
}

async function setOnDuty(guild, userId, add) {
const roleId = await getOnDutyRoleId();
if (!roleId) return;

const member = await guild.members.fetch(userId).catch(function () {
return null;
});

if (!member) return;

if (add) {
await member.roles.add(roleId).catch(function () {});
} else {
await member.roles.remove(roleId).catch(function () {});
}
}

async function handleShiftButton(interaction) {
const parts = interaction.customId.split("_");
const action = parts[1];
const ownerId = parts[2];

if (interaction.user.id !== ownerId) {
return interaction.reply({ content: "This shift panel is not yours.", ephemeral: true });
}

const member = await getCommandMember(interaction);

if (!hasLevel(member, "staff", interaction)) {
return interaction.reply({ content: "Staff only.", ephemeral: true });
}

const shift = await getActiveShift(interaction.user.id);
let notice = "Updated.";

if (action === "start") {
if (shift) {
notice = "You are already on shift.";
} else {
await run("INSERT INTO active_shifts (userId, startedAt, status, breakStartedAt, totalBreakMs) VALUES (?, ?, ?, ?, ?)", [interaction.user.id, Date.now(), "active", null, 0]);
await setOnDuty(interaction.guild, interaction.user.id, true);
notice = "Shift started.";
}
}

if (action === "break") {
if (!shift) {
notice = "You need to start your shift first.";
} else if (shift.status === "break") {
notice = "You are already on break.";
} else {
await run("UPDATE active_shifts SET status = ?, breakStartedAt = ? WHERE userId = ?", ["break", Date.now(), interaction.user.id]);
await setOnDuty(interaction.guild, interaction.user.id, false);
notice = "You are now on break.";
}
}

if (action === "resume") {
if (!shift) {
notice = "You need to start your shift first.";
} else if (shift.status !== "break") {
notice = "You are not on break.";
} else {
const currentBreakMs = Date.now() - Number(shift.breakStartedAt);
const newTotalBreakMs = Number(shift.totalBreakMs || 0) + currentBreakMs;

```
  await run("UPDATE active_shifts SET status = ?, breakStartedAt = ?, totalBreakMs = ? WHERE userId = ?", ["active", null, newTotalBreakMs, interaction.user.id]);
  await setOnDuty(interaction.guild, interaction.user.id, true);
  notice = "Break ended.";
}
```

}

if (action === "end") {
if (!shift) {
notice = "You are not on shift.";
} else {
let totalBreakMs = Number(shift.totalBreakMs || 0);

```
  if (shift.status === "break" && shift.breakStartedAt) {
    totalBreakMs += Date.now() - Number(shift.breakStartedAt);
  }

  const endedAt = Date.now();
  const activeMs = Math.max(0, endedAt - Number(shift.startedAt) - totalBreakMs);
  const minutes = Math.max(1, Math.floor(activeMs / 60000));

  await run("INSERT INTO shifts (userId, startedAt, endedAt, minutes) VALUES (?, ?, ?, ?)", [interaction.user.id, Number(shift.startedAt), endedAt, minutes]);
  await run("DELETE FROM active_shifts WHERE userId = ?", [interaction.user.id]);
  await setOnDuty(interaction.guild, interaction.user.id, false);
  notice = "Shift ended. Logged " + minutes + " minutes.";
}
```

}

const updatedShift = await getActiveShift(interaction.user.id);

return interaction.update({
embeds: [shiftEmbed(interaction.user, updatedShift, notice)],
components: shiftButtons(interaction.user.id, updatedShift)
});
}

async function handleHelp(interaction) {
const embed = new EmbedBuilder()
.setTitle("SEA Bot Commands")
.setColor(0x2b2d31)
.setDescription([
"/help - Show commands",
"/shift manage - Open shift panel",
"/embed send - Send a custom embed",
"/welcome set/off/test - Manage welcome messages",
"/autorole add/remove/list - Manage auto roles",
"/log arrest - Log an arrest",
"/leaderboard - Shift leaderboard",
"/warn - Warn a user",
"/infract - Create infraction",
"/kick - Kick user",
"/ban - Ban user",
"/mute - Timeout user",
"/unmute - Remove timeout",
"/case - Look up a case",
"/history - View user history",
"/perm add/remove/list - Manage permission roles",
"/config logs/onduty - Configure bot"
].join("\n"));

return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleEmbed(interaction, member) {
if (!hasLevel(member, "high", interaction)) {
return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
}

const channel = interaction.options.getChannel("channel");
const title = interaction.options.getString("title");
const description = interaction.options.getString("description");
const colorChoice = interaction.options.getString("color") || "black";
const image = interaction.options.getString("image");
const thumbnail = interaction.options.getString("thumbnail");
const footer = interaction.options.getString("footer") || "Sentinel Enforcement Authority";
const colors = { black: 0x2b2d31, blue: 0x3498db, green: 0x2ecc71, red: 0xe74c3c, gold: 0xf1c40f, purple: 0x9b59b6, white: 0xffffff };

if (!channel || !channel.isTextBased()) {
return interaction.reply({ content: "Pick a text channel.", ephemeral: true });
}

const embed = new EmbedBuilder()
.setTitle(title)
.setDescription(description)
.setColor(colors[colorChoice] || 0x2b2d31)
.setFooter({ text: footer })
.setTimestamp();

if (image && image.startsWith("http")) embed.setImage(image);
if (thumbnail && thumbnail.startsWith("http")) embed.setThumbnail(thumbnail);

await channel.send({ embeds: [embed] });
return interaction.reply({ content: "Embed sent in " + channel.toString() + ".", ephemeral: true });
}

async function handleWelcome(interaction, member) {
if (!hasLevel(member, "high", interaction)) {
return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
}

const sub = interaction.options.getSubcommand();

if (sub === "set") {
const channel = interaction.options.getChannel("channel");
await setConfig("welcome_enabled", "true");
await setConfig("welcome_channel_id", channel.id);
await setConfig("welcome_title", interaction.options.getString("title") || "Welcome to Sentinel Enforcement Authority");
await setConfig("welcome_message", interaction.options.getString("message") || "Welcome {user} to {server}! You are member #{memberCount}.");
await setConfig("welcome_image", interaction.options.getString("image") || "");
return interaction.reply({ content: "Welcome system set to " + channel.toString() + ". Use /welcome test.", ephemeral: true });
}

if (sub === "off") {
await setConfig("welcome_enabled", "false");
return interaction.reply({ content: "Welcome system turned off.", ephemeral: true });
}

if (sub === "test") {
await sendWelcome(member);
return interaction.reply({ content: "Sent a test welcome message.", ephemeral: true });
}
}

async function handleAutorole(interaction, member) {
if (!hasLevel(member, "high", interaction)) {
return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
}

const sub = interaction.options.getSubcommand();

if (sub === "add") {
const role = interaction.options.getRole("role");
const result = await addAutoRole(role.id);
return interaction.reply({ content: result.message + " Automatic join roles need Server Members Intent later.", ephemeral: true });
}

if (sub === "remove") {
const role = interaction.options.getRole("role");
await removeAutoRole(role.id);
return interaction.reply({ content: role.toString() + " removed.", ephemeral: true });
}

if (sub === "list") {
const rows = await getAutoRoles();
const list = rows.map(function (row) {
return "<@&" + row.roleId + ">";
}).join("\n");

```
return interaction.reply({ content: list || "No auto roles set.", ephemeral: true });
```

}
}

async function handlePerm(interaction, member) {
if (!hasLevel(member, "high", interaction)) {
return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
}

const sub = interaction.options.getSubcommand();

if (sub === "add") {
const permission = interaction.options.getString("permission");
const role = interaction.options.getRole("role");

```
await run("INSERT OR IGNORE INTO permission_roles (permission, roleId) VALUES (?, ?)", [permission, role.id]);
await loadPermissions();

return interaction.reply({ content: "Added " + role.toString() + " to " + permission + ".", ephemeral: true });
```

}

if (sub === "remove") {
const permission = interaction.options.getString("permission");
const role = interaction.options.getRole("role");

```
await run("DELETE FROM permission_roles WHERE permission = ? AND roleId = ?", [permission, role.id]);
await loadPermissions();

return interaction.reply({ content: "Removed " + role.toString() + " from " + permission + ".", ephemeral: true });
```

}

if (sub === "list") {
const rows = await all("SELECT permission, roleId FROM permission_roles ORDER BY permission");
let text = "";

```
for (const key of ["staff", "mod", "admin", "high", "infract"]) {
  const roles = rows.filter(function (row) {
    return row.permission === key;
  }).map(function (row) {
    return "<@&" + row.roleId + ">";
  });

  text += key.toUpperCase() + ": " + (roles.length ? roles.join(", ") : "None") + "\n";
}

return interaction.reply({ content: text, ephemeral: true });
```

}
}

async function handleConfig(interaction, member) {
if (!hasLevel(member, "high", interaction)) {
return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
}

const sub = interaction.options.getSubcommand();

if (sub === "logs") {
const channel = interaction.options.getChannel("channel");
await setConfig("logs_channel_id", channel.id);
return interaction.reply({ content: "Logs channel set to " + channel.toString() + ".", ephemeral: true });
}

if (sub === "onduty") {
const role = interaction.options.getRole("role");
await setConfig("onduty_role_id", role.id);
return interaction.reply({ content: "On-Duty role set to " + role.toString() + ".", ephemeral: true });
}
}

async function handleShift(interaction, member) {
if (!hasLevel(member, "staff", interaction)) {
return interaction.reply({ content: "Staff only.", ephemeral: true });
}

const shift = await getActiveShift(interaction.user.id);

return interaction.reply({
embeds: [shiftEmbed(interaction.user, shift, null)],
components: shiftButtons(interaction.user.id, shift),
ephemeral: true
});
}

async function handleLog(interaction, member) {
if (!hasLevel(member, "staff", interaction)) {
return interaction.reply({ content: "Staff only.", ephemeral: true });
}

const suspect = interaction.options.getString("suspect_username");
const charges = interaction.options.getString("charges");
const location = interaction.options.getString("arrest_location");
const mugshot = interaction.options.getAttachment("mugshot");

const item = await createCase("ARREST", suspect, interaction.user.id, charges, null, {
arrestLocation: location,
mugshotUrl: mugshot ? mugshot.url : null
});

const embed = caseEmbed(item);
await sendLog(embed);
return interaction.reply({ content: "Arrest logged. Case #" + item.caseNumber, embeds: [embed] });
}

async function handleLeaderboard(interaction, member) {
if (!hasLevel(member, "staff", interaction)) {
return interaction.reply({ content: "Staff only.", ephemeral: true });
}

const rows = await all("SELECT userId, SUM(minutes) as total FROM shifts GROUP BY userId ORDER BY total DESC LIMIT 10");

if (!rows.length) return interaction.reply("No shift data yet.");

const embed = new EmbedBuilder()
.setTitle("Shift Leaderboard")
.setColor(0x2b2d31)
.setDescription(rows.map(function (row, index) {
return "#" + (index + 1) + " <@" + row.userId + "> - " + row.total + " minutes";
}).join("\n"));

return interaction.reply({ embeds: [embed] });
}

async function handleModeration(interaction, member, command) {
const target = interaction.options.getUser("user");
const targetMember = await getTargetMember(interaction);
const reason = interaction.options.getString("reason") || "No reason";

if (command === "warn" && !hasLevel(member, "mod", interaction)) return interaction.reply({ content: "Mods+ only.", ephemeral: true });
if (command === "kick" && !hasLevel(member, "mod", interaction)) return interaction.reply({ content: "Mods+ only.", ephemeral: true });
if (command === "mute" && !hasLevel(member, "mod", interaction)) return interaction.reply({ content: "Mods+ only.", ephemeral: true });
if (command === "unmute" && !hasLevel(member, "mod", interaction)) return interaction.reply({ content: "Mods+ only.", ephemeral: true });
if (command === "ban" && !hasLevel(member, "admin", interaction)) return interaction.reply({ content: "Admins+ only.", ephemeral: true });
if (command === "infract" && !hasInfract(member, interaction)) return interaction.reply({ content: "You need the Infract permission role.", ephemeral: true });
if (!canAct(member, targetMember, interaction)) return interaction.reply({ content: "You cannot moderate this user.", ephemeral: true });

if (command === "kick") {
if (!targetMember) return interaction.reply({ content: "User is not in the server.", ephemeral: true });
if (!targetMember.kickable) return interaction.reply({ content: "I cannot kick this user. Move my role higher.", ephemeral: true });
await targetMember.kick(reason);
}

if (command === "ban") {
if (targetMember && !targetMember.bannable) return interaction.reply({ content: "I cannot ban this user. Move my role higher.", ephemeral: true });
await interaction.guild.members.ban(target.id, { reason: reason });
}

if (command === "mute") {
const minutes = interaction.options.getInteger("minutes") || 10;
if (!targetMember) return interaction.reply({ content: "User is not in the server.", ephemeral: true });
if (!targetMember.moderatable) return interaction.reply({ content: "I cannot mute this user. Move my role higher and give me Moderate Members.", ephemeral: true });
await targetMember.timeout(minutes * 60 * 1000, reason);

```
const item = await createCase("MUTE", target.id, interaction.user.id, reason, minutes + " minutes", null);
const embed = caseEmbed(item);
await sendLog(embed);
return interaction.reply({ content: "Muted " + target.tag + " for " + minutes + " minutes. Case #" + item.caseNumber, embeds: [embed] });
```

}

if (command === "unmute") {
if (!targetMember) return interaction.reply({ content: "User is not in the server.", ephemeral: true });
if (!targetMember.moderatable) return interaction.reply({ content: "I cannot unmute this user. Move my role higher and give me Moderate Members.", ephemeral: true });
await targetMember.timeout(null, reason);
}

const type = command === "infract" ? "INFRACTION" : command.toUpperCase();
const item = await createCase(type, target.id, interaction.user.id, reason, null, null);
const embed = caseEmbed(item);
await sendLog(embed);
return interaction.reply({ content: type + " created. Case #" + item.caseNumber, embeds: [embed] });
}

async function handleCase(interaction, member) {
if (!hasLevel(member, "staff", interaction)) {
return interaction.reply({ content: "Staff only.", ephemeral: true });
}

const number = interaction.options.getInteger("number");
const item = await get("SELECT * FROM cases WHERE caseNumber = ?", [number]);

if (!item) return interaction.reply({ content: "Case not found.", ephemeral: true });

return interaction.reply({ embeds: [caseEmbed(item)] });
}

async function handleHistory(interaction, member) {
if (!hasLevel(member, "staff", interaction)) {
return interaction.reply({ content: "Staff only.", ephemeral: true });
}

const target = interaction.options.getUser("user");
const rows = await all("SELECT * FROM cases WHERE userId = ? ORDER BY caseNumber DESC LIMIT 10", [target.id]);

if (!rows.length) return interaction.reply("No history found for " + target.tag + ".");

const embed = new EmbedBuilder()
.setTitle("History for " + target.tag)
.setColor(0x2b2d31)
.setDescription(rows.map(function (row) {
return "#" + row.caseNumber + " [" + row.type + "] " + row.reason;
}).join("\n"));

return interaction.reply({ embeds: [embed] });
}

client.once("clientReady", async function () {
try {
await setupDatabase();
await loadPermissions();

```
const rest = new REST({ version: "10" }).setToken(TOKEN);

await rest.put(
  Routes.applicationGuildCommands(client.user.id, GUILD_ID),
  { body: commands }
);

console.log("Logged in as " + client.user.tag);
console.log("Commands deployed to guild " + GUILD_ID + " using this same bot.");
```

} catch (error) {
console.error("Startup error:", error);
}
});

client.on("interactionCreate", async function (interaction) {
try {
if (interaction.isButton()) {
if (interaction.customId.startsWith("shift_")) return await handleShiftButton(interaction);
return;
}

```
if (!interaction.isChatInputCommand()) return;

const command = interaction.commandName;
const member = await getCommandMember(interaction);

if (command === "help") return await handleHelp(interaction);
if (command === "embed") return await handleEmbed(interaction, member);
if (command === "welcome") return await handleWelcome(interaction, member);
if (command === "autorole") return await handleAutorole(interaction, member);
if (command === "perm") return await handlePerm(interaction, member);
if (command === "config") return await handleConfig(interaction, member);
if (command === "shift") return await handleShift(interaction, member);
if (command === "log") return await handleLog(interaction, member);
if (command === "leaderboard") return await handleLeaderboard(interaction, member);
if (command === "warn" || command === "infract" || command === "kick" || command === "ban" || command === "mute" || command === "unmute") return await handleModeration(interaction, member, command);
if (command === "case") return await handleCase(interaction, member);
if (command === "history") return await handleHistory(interaction, member);
```

} catch (error) {
console.error("Interaction error:", error);

```
if (!interaction.replied && !interaction.deferred) {
  return interaction.reply({ content: "Error running command. Check Railway logs.", ephemeral: true });
}

return interaction.followUp({ content: "Error running command. Check Railway logs.", ephemeral: true });
```

}
});

client.login(TOKEN);
