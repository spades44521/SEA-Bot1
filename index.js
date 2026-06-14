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
intents: [
GatewayIntentBits.Guilds
]
});

// ================= DATABASE =================

const db = new sqlite3.Database("./erlc.db");

function run(sql, params = []) {
return new Promise((resolve, reject) => {
db.run(sql, params, function (err) {
if (err) reject(err);
else resolve(this);
});
});
}

function get(sql, params = []) {
return new Promise((resolve, reject) => {
db.get(sql, params, function (err, row) {
if (err) reject(err);
else resolve(row);
});
});
}

function all(sql, params = []) {
return new Promise((resolve, reject) => {
db.all(sql, params, function (err, rows) {
if (err) reject(err);
else resolve(rows);
});
});
}

async function addColumnIfMissing(table, column, definition) {
const columns = await all("PRAGMA table_info(" + table + ")");
const names = columns.map(col => col.name);

if (!names.includes(column)) {
await run("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
}
}

async function setupDatabase() {
await run(`     CREATE TABLE IF NOT EXISTS permission_roles (
      permission TEXT NOT NULL,
      roleId TEXT NOT NULL,
      UNIQUE(permission, roleId)
    )
  `);

await run(`     CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

await run(`     CREATE TABLE IF NOT EXISTS autoroles (
      roleId TEXT PRIMARY KEY
    )
  `);

await run(`     CREATE TABLE IF NOT EXISTS cases (
      caseNumber INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      userId TEXT NOT NULL,
      officerId TEXT NOT NULL,
      reason TEXT NOT NULL,
      duration TEXT,
      createdAt INTEGER,
      arrestLocation TEXT,
      mugshotUrl TEXT
    )
  `);

await addColumnIfMissing("cases", "duration", "TEXT");
await addColumnIfMissing("cases", "createdAt", "INTEGER");
await addColumnIfMissing("cases", "arrestLocation", "TEXT");
await addColumnIfMissing("cases", "mugshotUrl", "TEXT");

await run(`     CREATE TABLE IF NOT EXISTS active_shifts (
      userId TEXT PRIMARY KEY,
      startedAt INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      breakStartedAt INTEGER,
      totalBreakMs INTEGER DEFAULT 0
    )
  `);

await addColumnIfMissing("active_shifts", "status", "TEXT DEFAULT 'active'");
await addColumnIfMissing("active_shifts", "breakStartedAt", "INTEGER");
await addColumnIfMissing("active_shifts", "totalBreakMs", "INTEGER DEFAULT 0");

await run(`     CREATE TABLE IF NOT EXISTS shifts (
      userId TEXT NOT NULL,
      startedAt INTEGER,
      endedAt INTEGER,
      minutes INTEGER NOT NULL
    )
  `);

await addColumnIfMissing("shifts", "startedAt", "INTEGER");
await addColumnIfMissing("shifts", "endedAt", "INTEGER");
}

// ================= COMMANDS =================

const permissionChoices = [
{ name: "staff", value: "staff" },
{ name: "mod", value: "mod" },
{ name: "admin", value: "admin" },
{ name: "high", value: "high" },
{ name: "infract", value: "infract" }
];

const commands = [
new SlashCommandBuilder()
.setName("help")
.setDescription("View bot commands"),

new SlashCommandBuilder()
.setName("embed")
.setDescription("Send professional embeds")
.addSubcommand(sub =>
sub
.setName("send")
.setDescription("Send a custom embed")
.addChannelOption(option =>
option.setName("channel").setDescription("Channel to send the embed in").setRequired(true)
)
.addStringOption(option =>
option.setName("title").setDescription("Embed title").setRequired(true).setMaxLength(256)
)
.addStringOption(option =>
option.setName("description").setDescription("Embed description").setRequired(true).setMaxLength(4000)
)
.addStringOption(option =>
option
.setName("color")
.setDescription("Embed color")
.setRequired(false)
.addChoices(
{ name: "Black", value: "black" },
{ name: "Blue", value: "blue" },
{ name: "Green", value: "green" },
{ name: "Red", value: "red" },
{ name: "Gold", value: "gold" },
{ name: "Purple", value: "purple" },
{ name: "White", value: "white" }
)
)
.addStringOption(option =>
option.setName("image").setDescription("Large image URL").setRequired(false)
)
.addStringOption(option =>
option.setName("thumbnail").setDescription("Small thumbnail image URL").setRequired(false)
)
.addStringOption(option =>
option.setName("footer").setDescription("Footer text").setRequired(false).setMaxLength(2048)
)
),

new SlashCommandBuilder()
.setName("welcome")
.setDescription("Manage the welcome system")
.addSubcommand(sub =>
sub
.setName("set")
.setDescription("Set the welcome channel and message")
.addChannelOption(option =>
option.setName("channel").setDescription("Welcome channel").setRequired(true)
)
.addStringOption(option =>
option.setName("title").setDescription("Welcome embed title").setRequired(false).setMaxLength(256)
)
.addStringOption(option =>
option.setName("message").setDescription("Use {user}, {server}, {memberCount}").setRequired(false).setMaxLength(4000)
)
.addStringOption(option =>
option.setName("image").setDescription("Optional image URL").setRequired(false)
)
)
.addSubcommand(sub =>
sub.setName("off").setDescription("Turn off welcome messages")
)
.addSubcommand(sub =>
sub.setName("test").setDescription("Test the welcome message")
),

new SlashCommandBuilder()
.setName("autorole")
.setDescription("Manage roles given when someone joins")
.addSubcommand(sub =>
sub
.setName("add")
.setDescription("Add an auto-role")
.addRoleOption(option =>
option.setName("role").setDescription("Role to give when someone joins").setRequired(true)
)
)
.addSubcommand(sub =>
sub
.setName("remove")
.setDescription("Remove an auto-role")
.addRoleOption(option =>
option.setName("role").setDescription("Role to remove from auto-roles").setRequired(true)
)
)
.addSubcommand(sub =>
sub.setName("list").setDescription("List all auto-roles")
),

new SlashCommandBuilder()
.setName("perm")
.setDescription("Manage permission roles")
.addSubcommand(sub =>
sub
.setName("add")
.setDescription("Add a role to a permission level")
.addStringOption(option =>
option.setName("permission").setDescription("Permission level").setRequired(true).addChoices(...permissionChoices)
)
.addRoleOption(option =>
option.setName("role").setDescription("Role to add").setRequired(true)
)
)
.addSubcommand(sub =>
sub
.setName("remove")
.setDescription("Remove a role from a permission level")
.addStringOption(option =>
option.setName("permission").setDescription("Permission level").setRequired(true).addChoices(...permissionChoices)
)
.addRoleOption(option =>
option.setName("role").setDescription("Role to remove").setRequired(true)
)
)
.addSubcommand(sub =>
sub.setName("list").setDescription("List permission roles")
),

new SlashCommandBuilder()
.setName("config")
.setDescription("Configure bot settings")
.addSubcommand(sub =>
sub
.setName("logs")
.setDescription("Set the logs channel")
.addChannelOption(option =>
option.setName("channel").setDescription("Channel for case logs").setRequired(true)
)
)
.addSubcommand(sub =>
sub
.setName("onduty")
.setDescription("Set the On-Duty role")
.addRoleOption(option =>
option.setName("role").setDescription("Role to give while on duty").setRequired(true)
)
),

new SlashCommandBuilder()
.setName("shift")
.setDescription("Shift system")
.addSubcommand(sub =>
sub.setName("manage").setDescription("Open the shift management panel")
),

new SlashCommandBuilder()
.setName("log")
.setDescription("Log ERLC actions")
.addSubcommand(sub =>
sub
.setName("arrest")
.setDescription("Log an arrest")
.addStringOption(option =>
option.setName("suspect_username").setDescription("Roblox username or suspect name").setRequired(true)
)
.addStringOption(option =>
option.setName("charges").setDescription("Charges for the arrest").setRequired(true)
)
.addStringOption(option =>
option.setName("arrest_location").setDescription("Where the arrest happened").setRequired(true)
)
.addAttachmentOption(option =>
option.setName("mugshot").setDescription("Upload a mugshot image").setRequired(false)
)
),

new SlashCommandBuilder()
.setName("leaderboard")
.setDescription("View shift leaderboard"),

new SlashCommandBuilder()
.setName("warn")
.setDescription("Warn a user")
.addUserOption(option =>
option.setName("user").setDescription("User to warn").setRequired(true)
)
.addStringOption(option =>
option.setName("reason").setDescription("Reason").setRequired(false)
),

new SlashCommandBuilder()
.setName("infract")
.setDescription("Create an infraction case")
.addUserOption(option =>
option.setName("user").setDescription("User to infract").setRequired(true)
)
.addStringOption(option =>
option.setName("reason").setDescription("Reason").setRequired(false)
),

new SlashCommandBuilder()
.setName("kick")
.setDescription("Kick a user")
.addUserOption(option =>
option.setName("user").setDescription("User to kick").setRequired(true)
)
.addStringOption(option =>
option.setName("reason").setDescription("Reason").setRequired(false)
),

new SlashCommandBuilder()
.setName("ban")
.setDescription("Ban a user")
.addUserOption(option =>
option.setName("user").setDescription("User to ban").setRequired(true)
)
.addStringOption(option =>
option.setName("reason").setDescription("Reason").setRequired(false)
),

new SlashCommandBuilder()
.setName("mute")
.setDescription("Mute/timeout a user")
.addUserOption(option =>
option.setName("user").setDescription("User to mute").setRequired(true)
)
.addIntegerOption(option =>
option.setName("minutes").setDescription("Mute length in minutes").setRequired(false).setMinValue(1).setMaxValue(40320)
)
.addStringOption(option =>
option.setName("reason").setDescription("Reason").setRequired(false)
),

new SlashCommandBuilder()
.setName("unmute")
.setDescription("Remove timeout from a user")
.addUserOption(option =>
option.setName("user").setDescription("User to unmute").setRequired(true)
)
.addStringOption(option =>
option.setName("reason").setDescription("Reason").setRequired(false)
),

new SlashCommandBuilder()
.setName("case")
.setDescription("Look up a case")
.addIntegerOption(option =>
option.setName("number").setDescription("Case number").setRequired(true)
),

new SlashCommandBuilder()
.setName("history")
.setDescription("View user disciplinary history")
.addUserOption(option =>
option.setName("user").setDescription("User to check").setRequired(true)
)
].map(command => command.toJSON());

// ================= PERMISSIONS =================

const LEVELS = {
staff: 1,
mod: 2,
admin: 3,
high: 4
};

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

function isDiscordAdmin(interaction, member) {
return interaction?.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
member?.permissions?.has?.(PermissionFlagsBits.Administrator);
}

function getMemberLevel(member, interaction = null) {
if (isDiscordAdmin(interaction, member)) {
return LEVELS.high;
}

if (!member || !member.roles || !member.roles.cache) {
return 0;
}

let level = 0;

for (const role of member.roles.cache.values()) {
if (permissionCache.high.has(role.id)) level = Math.max(level, LEVELS.high);
if (permissionCache.admin.has(role.id)) level = Math.max(level, LEVELS.admin);
if (permissionCache.mod.has(role.id)) level = Math.max(level, LEVELS.mod);
if (permissionCache.staff.has(role.id)) level = Math.max(level, LEVELS.staff);
}

return level;
}

function hasLevel(member, levelName, interaction = null) {
return getMemberLevel(member, interaction) >= LEVELS[levelName];
}

function hasSpecificPermission(member, permissionName, interaction = null) {
if (isDiscordAdmin(interaction, member)) return true;

if (!member || !member.roles || !member.roles.cache) {
return false;
}

return member.roles.cache.some(role =>
permissionCache[permissionName]?.has(role.id)
);
}

function canActOn(executorMember, targetMember, interaction = null) {
const executorLevel = getMemberLevel(executorMember, interaction);
const targetLevel = getMemberLevel(targetMember);

if (executorLevel >= LEVELS.high) return true;
if (targetLevel === 0) return executorLevel >= LEVELS.staff;

return executorLevel > targetLevel;
}

async function getCommandMember(interaction) {
try {
return await interaction.guild.members.fetch(interaction.user.id);
} catch {
return interaction.member;
}
}

async function getTargetMember(interaction, user) {
try {
return await interaction.guild.members.fetch(user.id);
} catch {
return null;
}
}

// ================= CONFIG =================

async function setConfig(key, value) {
await run(
"INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
[key, value]
);
}

async function getConfig(key) {
const row = await get("SELECT value FROM config WHERE key = ?", [key]);
return row?.value || null;
}

// ================= AUTO ROLES =================

async function getAutoRoles() {
return await all("SELECT roleId FROM autoroles");
}

async function addAutoRole(roleId) {
const existing = await get("SELECT roleId FROM autoroles WHERE roleId = ?", [roleId]);

if (existing) {
return {
ok: true,
message: "That role is already an auto-role."
};
}

const roles = await getAutoRoles();

if (roles.length >= 5) {
return {
ok: false,
message: "You can only have 5 auto-roles max."
};
}

await run("INSERT INTO autoroles (roleId) VALUES (?)", [roleId]);

return {
ok: true,
message: "Auto-role added."
};
}

async function removeAutoRole(roleId) {
await run("DELETE FROM autoroles WHERE roleId = ?", [roleId]);

return {
ok: true,
message: "Auto-role removed."
};
}

// ================= WELCOME =================

function fillWelcomeText(text, member) {
if (!text) return "";

return text
.replaceAll("{user}", "<@" + member.id + ">")
.replaceAll("{server}", member.guild.name)
.replaceAll("{memberCount}", String(member.guild.memberCount));
}

async function sendWelcomeMessage(member) {
const enabled = await getConfig("welcome_enabled");
const channelId = await getConfig("welcome_channel_id");

if (enabled !== "true" || !channelId) return;

const title = await getConfig("welcome_title") || "Welcome to Sentinel Enforcement Authority";
const message = await getConfig("welcome_message") || "Welcome {user} to {server}! You are member #{memberCount}.";
const image = await getConfig("welcome_image");

const channel = await member.guild.channels.fetch(channelId).catch(() => null);
if (!channel || !channel.isTextBased()) return;

const embed = new EmbedBuilder()
.setTitle(fillWelcomeText(title, member))
.setDescription(fillWelcomeText(message, member))
.setColor(0x2b2d31)
.setThumbnail(member.user.displayAvatarURL({ size: 256 }))
.setFooter({ text: member.guild.name })
.setTimestamp();

if (image && image.startsWith("http")) {
embed.setImage(image);
}

await channel.send({
content: "<@" + member.id + ">",
embeds: [embed]
}).catch(() => null);
}

// ================= LOGS =================

async function sendLogEmbed(embed) {
const channelId = await getConfig("logs_channel_id");
if (!channelId) return;

const channel = await client.channels.fetch(channelId).catch(() => null);
if (!channel) return;

await channel.send({ embeds: [embed] }).catch(() => null);
}

// ================= ON DUTY ROLE =================

async function getOnDutyRoleId() {
return await getConfig("onduty_role_id");
}

async function addOnDutyRole(guild, userId) {
const roleId = await getOnDutyRoleId();

if (!roleId) {
return {
ok: false,
message: "On-Duty role is not set. Use /config onduty role: @On-Duty."
};
}

const member = await guild.members.fetch(userId).catch(() => null);
if (!member) {
return {
ok: false,
message: "Could not find member."
};
}

try {
if (!member.roles.cache.has(roleId)) {
await member.roles.add(roleId);
}

```
return {
  ok: true,
  message: "On-Duty role added."
};
```

} catch {
return {
ok: false,
message: "Could not add On-Duty role. Move the bot role above On-Duty and give it Manage Roles."
};
}
}

async function removeOnDutyRole(guild, userId) {
const roleId = await getOnDutyRoleId();

if (!roleId) {
return {
ok: false,
message: "On-Duty role is not set."
};
}

const member = await guild.members.fetch(userId).catch(() => null);
if (!member) {
return {
ok: false,
message: "Could not find member."
};
}

try {
if (member.roles.cache.has(roleId)) {
await member.roles.remove(roleId);
}

```
return {
  ok: true,
  message: "On-Duty role removed."
};
```

} catch {
return {
ok: false,
message: "Could not remove On-Duty role. Move the bot role above On-Duty and give it Manage Roles."
};
}
}

// ================= CASES =================

async function createCase(type, userId, officerId, reason, duration = null) {
const result = await run(
"INSERT INTO cases (type, userId, officerId, reason, duration, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
[type, userId, officerId, reason, duration, Date.now()]
);

return result.lastID;
}

async function createArrestCase(suspectUsername, officerId, charges, arrestLocation, mugshotUrl = null) {
const result = await run(
"INSERT INTO cases (type, userId, officerId, reason, duration, createdAt, arrestLocation, mugshotUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
["ARREST", suspectUsername, officerId, charges, null, Date.now(), arrestLocation, mugshotUrl]
);

return result.lastID;
}

function normalCaseEmbed(caseNumber, type, userId, officerId, reason, duration = null) {
const embed = new EmbedBuilder()
.setTitle(type + " Case #" + caseNumber)
.setColor(0x2b2d31)
.addFields(
{ name: "User", value: "<@" + userId + ">", inline: true },
{ name: "Officer", value: "<@" + officerId + ">", inline: true },
{ name: "Reason", value: reason || "No reason", inline: false }
)
.setFooter({ text: "Case Number: " + caseNumber })
.setTimestamp();

if (duration) {
embed.addFields({ name: "Duration", value: duration, inline: true });
}

return embed;
}

function arrestCaseEmbed(caseNumber, suspectUsername, officerId, charges, arrestLocation, mugshotUrl = null) {
const embed = new EmbedBuilder()
.setTitle("ARREST Case #" + caseNumber)
.setColor(0x2b2d31)
.addFields(
{ name: "Suspect Username", value: suspectUsername, inline: true },
{ name: "Officer", value: "<@" + officerId + ">", inline: true },
{ name: "Charges", value: charges, inline: false },
{ name: "Arrest Location", value: arrestLocation, inline: false }
)
.setFooter({ text: "Case Number: " + caseNumber })
.setTimestamp();

if (mugshotUrl) {
embed.setImage(mugshotUrl);
}

return embed;
}

// ================= SHIFTS =================

function formatTime(ms) {
if (!ms || ms < 0) ms = 0;

const totalMinutes = Math.floor(ms / 60000);
const hours = Math.floor(totalMinutes / 60);
const minutes = totalMinutes % 60;

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

const now = Date.now();
const startedAt = Number(shift.startedAt);
const breakMs = getShiftBreakMs(shift);

return Math.max(0, now - startedAt - breakMs);
}

function buildShiftEmbed(user, shift, notice = null) {
const embed = new EmbedBuilder()
.setTitle("Shift Management")
.setColor(0x2b2d31)
.setDescription(notice || "Use the buttons below to manage your shift.")
.setFooter({ text: "Sentinel Utilitys Shift System" })
.setTimestamp();

if (!shift) {
embed.addFields(
{ name: "User", value: "<@" + user.id + ">", inline: true },
{ name: "Status", value: "🔴 Off Duty", inline: true },
{ name: "Active Time", value: "0m", inline: true },
{ name: "Break Time", value: "0m", inline: true }
);

```
return embed;
```

}

embed.addFields(
{ name: "User", value: "<@" + user.id + ">", inline: true },
{ name: "Status", value: shift.status === "break" ? "🟡 On Break" : "🟢 On Shift", inline: true },
{ name: "Started", value: "<t:" + Math.floor(Number(shift.startedAt) / 1000) + ":R>", inline: true },
{ name: "Active Time", value: formatTime(getShiftActiveMs(shift)), inline: true },
{ name: "Break Time", value: formatTime(getShiftBreakMs(shift)), inline: true }
);

return embed;
}

function buildShiftButtons(userId, shift) {
const hasShift = !!shift;
const onBreak = shift && shift.status === "break";

return [
new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("shift_start_" + userId)
.setLabel("Start")
.setStyle(ButtonStyle.Success)
.setDisabled(hasShift),

```
  new ButtonBuilder()
    .setCustomId("shift_end_" + userId)
    .setLabel("End")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!hasShift),

  new ButtonBuilder()
    .setCustomId("shift_break_" + userId)
    .setLabel("Break")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(!hasShift || onBreak),

  new ButtonBuilder()
    .setCustomId("shift_resume_" + userId)
    .setLabel("Resume")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!hasShift || !onBreak)
)
```

];
}

// ================= STARTUP =================

let initialized = false;

client.once("clientReady", async () => {
if (initialized) return;
initialized = true;

try {
await setupDatabase();
await loadPermissions();

```
const rest = new REST({ version: "10" }).setToken(TOKEN);

await rest.put(
  Routes.applicationGuildCommands(client.user.id, GUILD_ID),
  { body: commands }
);

console.log("✅ Logged in as " + client.user.tag);
console.log("✅ Commands deployed to guild " + GUILD_ID + " using this same bot.");
```

} catch (error) {
console.error("❌ Startup error:", error);
}
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {
try {
console.log("Interaction received:", interaction.commandName || interaction.customId);

```
if (interaction.isButton()) {
  if (!interaction.customId.startsWith("shift_")) return;

  const parts = interaction.customId.split("_");
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: "❌ This shift panel is not yours.",
      ephemeral: true
    });
  }

  const member = await getCommandMember(interaction);

  if (!hasLevel(member, "staff", interaction)) {
    return interaction.reply({
      content: "❌ Staff only.",
      ephemeral: true
    });
  }

  const shift = await getActiveShift(interaction.user.id);
  let notice = null;

  if (action === "start") {
    if (shift) {
      notice = "❌ You are already on shift.";
    } else {
      await run(
        "INSERT INTO active_shifts (userId, startedAt, status, breakStartedAt, totalBreakMs) VALUES (?, ?, ?, ?, ?)",
        [interaction.user.id, Date.now(), "active", null, 0]
      );

      const roleResult = await addOnDutyRole(interaction.guild, interaction.user.id);
      notice = roleResult.ok
        ? "🟢 Shift started. On-Duty role added."
        : "🟢 Shift started. ⚠️ " + roleResult.message;
    }
  }

  if (action === "break") {
    if (!shift) {
      notice = "❌ You need to start your shift first.";
    } else if (shift.status === "break") {
      notice = "❌ You are already on break.";
    } else {
      await run(
        "UPDATE active_shifts SET status = ?, breakStartedAt = ? WHERE userId = ?",
        ["break", Date.now(), interaction.user.id]
      );

      const roleResult = await removeOnDutyRole(interaction.guild, interaction.user.id);
      notice = roleResult.ok
        ? "🟡 You are now on break. On-Duty role removed."
        : "🟡 You are now on break. ⚠️ " + roleResult.message;
    }
  }

  if (action === "resume") {
    if (!shift) {
      notice = "❌ You need to start your shift first.";
    } else if (shift.status !== "break") {
      notice = "❌ You are not on break.";
    } else {
      const currentBreakMs = Date.now() - Number(shift.breakStartedAt);
      const newTotalBreakMs = Number(shift.totalBreakMs || 0) + currentBreakMs;

      await run(
        "UPDATE active_shifts SET status = ?, breakStartedAt = ?, totalBreakMs = ? WHERE userId = ?",
        ["active", null, newTotalBreakMs, interaction.user.id]
      );

      const roleResult = await addOnDutyRole(interaction.guild, interaction.user.id);
      notice = roleResult.ok
        ? "🟢 Break ended. On-Duty role added."
        : "🟢 Break ended. ⚠️ " + roleResult.message;
    }
  }

  if (action === "end") {
    if (!shift) {
      notice = "❌ You are not on shift.";
    } else {
      let totalBreakMs = Number(shift.totalBreakMs || 0);

      if (shift.status === "break" && shift.breakStartedAt) {
        totalBreakMs += Date.now() - Number(shift.breakStartedAt);
      }

      const endedAt = Date.now();
      const activeMs = Math.max(0, endedAt - Number(shift.startedAt) - totalBreakMs);
      const minutes = Math.max(1, Math.floor(activeMs / 60000));

      await run(
        "INSERT INTO shifts (userId, startedAt, endedAt, minutes) VALUES (?, ?, ?, ?)",
        [interaction.user.id, Number(shift.startedAt), endedAt, minutes]
      );

      await run("DELETE FROM active_shifts WHERE userId = ?", [interaction.user.id]);

      const roleResult = await removeOnDutyRole(interaction.guild, interaction.user.id);
      notice = roleResult.ok
        ? "🔴 Shift ended. Logged **" + minutes + " minutes**. On-Duty role removed."
        : "🔴 Shift ended. Logged **" + minutes + " minutes**. ⚠️ " + roleResult.message;
    }
  }

  const updatedShift = await getActiveShift(interaction.user.id);

  return interaction.update({
    embeds: [buildShiftEmbed(interaction.user, updatedShift, notice)],
    components: buildShiftButtons(interaction.user.id, updatedShift)
  });
}

if (!interaction.isChatInputCommand()) return;

const command = interaction.commandName;
const member = await getCommandMember(interaction);

if (command === "help") {
  const embed = new EmbedBuilder()
    .setTitle("ERLC Staff Bot Commands")
    .setColor(0x2b2d31)
    .setDescription([
      "/shift manage - Open shift panel",
      "/embed send - Send a custom embed",
      "/welcome set/off/test - Manage welcome messages",
      "/autorole add/remove/list - Manage join auto-roles",
      "/log arrest - Log an arrest",
      "/leaderboard - Shift leaderboard",
      "/warn - Issue warning case",
      "/infract - Issue infraction case",
      "/kick - Kick user",
      "/ban - Ban user",
      "/mute - Timeout user",
      "/unmute - Remove timeout",
      "/case - Look up case",
      "/history - View user history",
      "/perm add/remove/list - Manage permission roles",
      "/config logs - Set logs channel",
      "/config onduty - Set On-Duty role"
    ].join("\n"));

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

if (command === "embed") {
  if (!hasLevel(member, "high", interaction)) {
    return interaction.reply({
      content: "❌ High Command or Discord Admin only.",
      ephemeral: true
    });
  }

  const channel = interaction.options.getChannel("channel");
  const title = interaction.options.getString("title");
  const description = interaction.options.getString("description");
  const colorChoice = interaction.options.getString("color") || "black";
  const image = interaction.options.getString("image");
  const thumbnail = interaction.options.getString("thumbnail");
  const footer = interaction.options.getString("footer");

  if (!channel || !channel.isTextBased()) {
    return interaction.reply({
      content: "❌ Pick a text channel.",
      ephemeral: true
    });
  }

  const colors = {
    black: 0x2b2d31,
    blue: 0x3498db,
    green: 0x2ecc71,
    red: 0xe74c3c,
    gold: 0xf1c40f,
    purple: 0x9b59b6,
    white: 0xffffff
  };

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(colors[colorChoice] || 0x2b2d31)
    .setFooter({ text: footer || "Sentinel Enforcement Authority" })
    .setTimestamp();

  if (image && image.startsWith("http")) embed.setImage(image);
  if (thumbnail && thumbnail.startsWith("http")) embed.setThumbnail(thumbnail);

  await channel.send({ embeds: [embed] });

  return interaction.reply({
    content: "✅ Embed sent in " + channel.toString() + ".",
    ephemeral: true
  });
}

if (command === "welcome") {
  if (!hasLevel(member, "high", interaction)) {
    return interaction.reply({
      content: "❌ High Command or Discord Admin only.",
      ephemeral: true
    });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "set") {
    const channel = interaction.options.getChannel("channel");
    const title = interaction.options.getString("title") || "Welcome to Sentinel Enforcement Authority";
    const message = interaction.options.getString("message") || "Welcome {user} to {server}! You are member #{memberCount}.";
    const image = interaction.options.getString("image") || "";

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content: "❌ Pick a text channel.",
        ephemeral: true
      });
    }

    await setConfig("welcome_enabled", "true");
    await setConfig("welcome_channel_id", channel.id);
    await setConfig("welcome_title", title);
    await setConfig("welcome_message", message);
    await setConfig("welcome_image", image);

    return interaction.reply({
      content: "✅ Welcome system set to " + channel.toString() + ". Use /welcome test.",
      ephemeral: true
    });
  }

  if (sub === "off") {
    await setConfig("welcome_enabled", "false");

    return interaction.reply({
      content: "✅ Welcome system turned off.",
      ephemeral: true
    });
  }

  if (sub === "test") {
    await sendWelcomeMessage(member);

    return interaction.reply({
      content: "✅ Sent a test welcome message.",
      ephemeral: true
    });
  }
}

if (command === "autorole") {
  if (!hasLevel(member, "high", interaction)) {
    return interaction.reply({
      content: "❌ High Command or Discord Admin only.",
      ephemeral: true
    });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const role = interaction.options.getRole("role");

    if (role.managed) {
      return interaction.reply({
        content: "❌ You cannot use bot/integration managed roles.",
        ephemeral: true
      });
    }

    const result = await addAutoRole(role.id);

    if (!result.ok) {
      return interaction.reply({
        content: "❌ " + result.message,
        ephemeral: true
      });
    }

    return interaction.reply({
      content: "✅ " + role.toString() + " saved as an auto-role. Automatic join roles need Server Members Intent later.",
      ephemeral: true
    });
  }

  if (sub === "remove") {
    const role = interaction.options.getRole("role");

    await removeAutoRole(role.id);

    return interaction.reply({
      content: "✅ " + role.toString() + " removed from auto-roles.",
      ephemeral: true
    });
  }

  if (sub === "list") {
    const roles = await getAutoRoles();

    if (!roles.length) {
      return interaction.reply({
        content: "No auto-roles set.",
        ephemeral: true
      });
    }

    return interaction.reply({
      content: "**Auto-Roles:**\n" + roles.map(r => "<@&" + r.roleId + ">").join("\n"),
      ephemeral: true
    });
  }
}

if (command === "perm") {
  if (!hasLevel(member, "high", interaction)) {
    return interaction.reply({
      content: "❌ High Command or Discord Admin only.",
      ephemeral: true
    });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const permission = interaction.options.getString("permission");
    const role = interaction.options.getRole("role");

    await run(
      "INSERT OR IGNORE INTO permission_roles (permission, roleId) VALUES (?, ?)",
      [permission, role.id]
    );

    await loadPermissions();

    return interaction.reply({
      content: "✅ Added " + role.toString() + " to **" + permission + "** permissions.",
      ephemeral: true
    });
  }

  if (sub === "remove") {
    const permission = interaction.options.getString("permission");
    const role = interaction.options.getRole("role");

    await run(
      "DELETE FROM permission_roles WHERE permission = ? AND roleId = ?",
      [permission, role.id]
    );

    await loadPermissions();

    return interaction.reply({
      content: "✅ Removed " + role.toString() + " from **" + permission + "** permissions.",
      ephemeral: true
    });
  }

  if (sub === "list") {
    const rows = await all("SELECT permission, roleId FROM permission_roles ORDER BY permission");

    if (!rows.length) {
      return interaction.reply({
        content: "No permission roles set yet.",
        ephemeral: true
      });
    }

    let text = "";

    for (const permission of ["staff", "mod", "admin", "high", "infract"]) {
      const roles = rows
        .filter(r => r.permission === permission)
        .map(r => "<@&" + r.roleId + ">");

      text += "**" + permission.toUpperCase() + "**: " + (roles.length ? roles.join(", ") : "None") + "\n";
    }

    return interaction.reply({
      content: text,
      ephemeral: true
    });
  }
}

if (command === "config") {
  if (!hasLevel(member, "high", interaction)) {
    return interaction.reply({
      content: "❌ High Command or Discord Admin only.",
      ephemeral: true
    });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "logs") {
    const channel = interaction.options.getChannel("channel");

    await setConfig("logs_channel_id", channel.id);

    return interaction.reply({
      content: "✅ Logs channel set to " + channel.toString() + ".",
      ephemeral: true
    });
  }

  if (sub === "onduty") {
    const role = interaction.options.getRole("role");

    await setConfig("onduty_role_id", role.id);

    return interaction.reply({
      content: "✅ On-Duty role set to " + role.toString() + ".",
      ephemeral: true
    });
  }
}

if (command === "shift") {
  if (!hasLevel(member, "staff", interaction)) {
    return interaction.reply({
      content: "❌ Staff only.",
      ephemeral: true
    });
  }

  const shift = await getActiveShift(interaction.user.id);

  return interaction.reply({
    embeds: [buildShiftEmbed(interaction.user, shift)],
    components: buildShiftButtons(interaction.user.id, shift),
    ephemeral: true
  });
}

if (command === "log") {
  const sub = interaction.options.getSubcommand();

  if (sub === "arrest") {
    if (!hasLevel(member, "staff", interaction)) {
      return interaction.reply({
        content: "❌ Staff only.",
        ephemeral: true
      });
    }

    const suspectUsername = interaction.options.getString("suspect_username");
    const charges = interaction.options.getString("charges");
    const arrestLocation = interaction.options.getString("arrest_location");
    const mugshot = interaction.options.getAttachment("mugshot");
    const mugshotUrl = mugshot ? mugshot.url : null;

    const caseNumber = await createArrestCase(
      suspectUsername,
      interaction.user.id,
      charges,
      arrestLocation,
      mugshotUrl
    );

    const embed = arrestCaseEmbed(
      caseNumber,
      suspectUsername,
      interaction.user.id,
      charges,
      arrestLocation,
      mugshotUrl
    );

    await sendLogEmbed(embed);

    return interaction.reply({
      content: "✅ Arrest logged. Case #" + caseNumber,
      embeds: [embed]
    });
  }
}

if (command === "leaderboard") {
  if (!hasLevel(member, "staff", interaction)) {
    return interaction.reply({
      content: "❌ Staff only.",
      ephemeral: true
    });
  }

  const rows = await all(
    "SELECT userId, SUM(minutes) as total FROM shifts GROUP BY userId ORDER BY total DESC LIMIT 10"
  );

  if (!rows.length) {
    return interaction.reply("No shift data yet.");
  }

  const embed = new EmbedBuilder()
    .setTitle("Shift Leaderboard")
    .setColor(0x2b2d31)
    .setDescription(
      rows.map((r, i) => "**#" + (i + 1) + "** <@" + r.userId + "> — **" + r.total + " minutes**").join("\n")
    );

  return interaction.reply({
    embeds: [embed]
  });
}

if (command === "warn") {
  if (!hasLevel(member, "mod", interaction)) {
    return interaction.reply({
      content: "❌ Mods+ only.",
      ephemeral: true
    });
  }

  const target = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason";
  const targetMember = await getTargetMember(interaction, target);

  if (targetMember && !canActOn(member, targetMember, interaction)) {
    return interaction.reply({
      content: "❌ You cannot warn this officer.",
      ephemeral: true
    });
  }

  const caseNumber = await createCase("WARN", target.id, interaction.user.id, reason);
  const embed = normalCaseEmbed(caseNumber, "WARN", target.id, interaction.user.id, reason);

  await sendLogEmbed(embed);

  return interaction.reply({
    content: "✅ Warning created. Case #" + caseNumber,
    embeds: [embed]
  });
}

if (command === "infract") {
  if (!hasSpecificPermission(member, "infract", interaction)) {
    return interaction.reply({
      content: "❌ You need the Infract permission role.",
      ephemeral: true
    });
  }

  const target = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason";

  const caseNumber = await createCase("INFRACTION", target.id, interaction.user.id, reason);
  const embed = normalCaseEmbed(caseNumber, "INFRACTION", target.id, interaction.user.id, reason);

  await sendLogEmbed(embed);

  return interaction.reply({
    content: "✅ Infraction created. Case #" + caseNumber,
    embeds: [embed]
  });
}

if (command === "kick") {
  if (!hasLevel(member, "mod", interaction)) {
    return interaction.reply({
      content: "❌ Mods+ only.",
      ephemeral: true
    });
  }

  const target = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason";
  const targetMember = await getTargetMember(interaction, target);

  if (!targetMember) {
    return interaction.reply({
      content: "❌ User is not in the server.",
      ephemeral: true
    });
  }

  if (!canActOn(member, targetMember, interaction)) {
    return interaction.reply({
      content: "❌ You cannot kick this user.",
      ephemeral: true
    });
  }

  if (!targetMember.kickable) {
    return interaction.reply({
      content: "❌ I cannot kick this user. Move my role higher.",
      ephemeral: true
    });
  }

  await targetMember.kick(reason);

  const caseNumber = await createCase("KICK", target.id, interaction.user.id, reason);
  const embed = normalCaseEmbed(caseNumber, "KICK", target.id, interaction.user.id, reason);

  await sendLogEmbed(embed);

  return interaction.reply({
    content: "✅ Kicked " + target.tag + ". Case #" + caseNumber,
    embeds: [embed]
  });
}

if (command === "ban") {
  if (!hasLevel(member, "admin", interaction)) {
    return interaction.reply({
      content: "❌ Admins+ only.",
      ephemeral: true
    });
  }

  const target = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason";
  const targetMember = await getTargetMember(interaction, target);

  if (targetMember && !canActOn(member, targetMember, interaction)) {
    return interaction.reply({
      content: "❌ You cannot ban this user.",
      ephemeral: true
    });
  }

  if (targetMember && !targetMember.bannable) {
    return interaction.reply({
      content: "❌ I cannot ban this user. Move my role higher.",
      ephemeral: true
    });
  }

  await interaction.guild.members.ban(target.id, { reason });

  const caseNumber = await createCase("BAN", target.id, interaction.user.id, reason);
  const embed = normalCaseEmbed(caseNumber, "BAN", target.id, interaction.user.id, reason);

  await sendLogEmbed(embed);

  return interaction.reply({
    content: "✅ Banned " + target.tag + ". Case #" + caseNumber,
    embeds: [embed]
  });
}

if (command === "mute") {
  if (!hasLevel(member, "mod", interaction)) {
    return interaction.reply({
      content: "❌ Mods+ only.",
      ephemeral: true
    });
  }

  const target = interaction.options.getUser("user");
  const minutes = interaction.options.getInteger("minutes") || 10;
  const reason = interaction.options.getString("reason") || "No reason";
  const targetMember = await getTargetMember(interaction, target);

  if (!targetMember) {
    return interaction.reply({
      content: "❌ User is not in the server.",
      ephemeral: true
    });
  }

  if (!canActOn(member, targetMember, interaction)) {
    return interaction.reply({
      content: "❌ You cannot mute this user.",
      ephemeral: true
    });
  }

  if (!targetMember.moderatable) {
    return interaction.reply({
      content: "❌ I cannot mute this user. Move my role higher.",
      ephemeral: true
    });
  }

  await targetMember.timeout(minutes * 60 * 1000, reason);

  const caseNumber = await createCase(
    "MUTE",
    target.id,
    interaction.user.id,
    reason,
    minutes + " minutes"
  );

  const embed = normalCaseEmbed(
    caseNumber,
    "MUTE",
    target.id,
    interaction.user.id,
    reason,
    minutes + " minutes"
  );

  await sendLogEmbed(embed);

  return interaction.reply({
    content: "✅ Muted " + target.tag + " for " + minutes + " minutes. Case #" + caseNumber,
    embeds: [embed]
  });
}

if (command === "unmute") {
  if (!hasLevel(member, "mod", interaction)) {
    return interaction.reply({
      content: "❌ Mods+ only.",
      ephemeral: true
    });
  }

  const target = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason";
  const targetMember = await getTargetMember(interaction, target);

  if (!targetMember) {
    return interaction.reply({
      content: "❌ User is not in the server.",
      ephemeral: true
    });
  }

  if (!canActOn(member, targetMember, interaction)) {
    return interaction.reply({
      content: "❌ You cannot unmute this user.",
      ephemeral: true
    });
  }

  await targetMember.timeout(null, reason);

  const caseNumber = await createCase("UNMUTE", target.id, interaction.user.id, reason);
  const embed = normalCaseEmbed(caseNumber, "UNMUTE", target.id, interaction.user.id, reason);

  await sendLogEmbed(embed);

  return interaction.reply({
    content: "✅ Unmuted " + target.tag + ". Case #" + caseNumber,
    embeds: [embed]
  });
}

if (command === "case") {
  if (!hasLevel(member, "staff", interaction)) {
    return interaction.reply({
      content: "❌ Staff only.",
      ephemeral: true
    });
  }

  const number = interaction.options.getInteger("number");
  const row = await get("SELECT * FROM cases WHERE caseNumber = ?", [number]);

  if (!row) {
    return interaction.reply({
      content: "❌ Case not found.",
      ephemeral: true
    });
  }

  const time = row.createdAt || Date.now();

  const embed = new EmbedBuilder()
    .setTitle("Case #" + row.caseNumber)
    .setColor(0x2b2d31)
    .addFields(
      { name: "Type", value: row.type, inline: true },
      { name: "User", value: row.type === "ARREST" ? row.userId : "<@" + row.userId + ">", inline: true },
      { name: "Officer", value: "<@" + row.officerId + ">", inline: true },
      { name: "Reason", value: row.reason, inline: false },
      { name: "Time", value: "<t:" + Math.floor(time / 1000) + ":F>", inline: false }
    )
    .setFooter({ text: "Case Number: " + row.caseNumber });

  if (row.duration) {
    embed.addFields({ name: "Duration", value: row.duration, inline: true });
  }

  if (row.arrestLocation) {
    embed.addFields({ name: "Arrest Location", value: row.arrestLocation, inline: false });
  }

  if (row.mugshotUrl) {
    embed.setImage(row.mugshotUrl);
  }

  return interaction.reply({
    embeds: [embed]
  });
}

if (command === "history") {
  if (!hasLevel(member, "staff", interaction)) {
    return interaction.reply({
      content: "❌ Staff only.",
      ephemeral: true
    });
  }

  const target = interaction.options.getUser("user");

  const rows = await all(
    "SELECT * FROM cases WHERE userId = ? ORDER BY caseNumber DESC LIMIT 10",
    [target.id]
  );

  if (!rows.length) {
    return interaction.reply("No history found for " + target.tag + ".");
  }

  const embed = new EmbedBuilder()
    .setTitle("History for " + target.tag)
    .setColor(0x2b2d31)
    .setDescription(
      rows.map(r => "**#" + r.caseNumber + "** [" + r.type + "] " + r.reason).join("\n")
    );

  return interaction.reply({
    embeds: [embed]
  });
}
```

} catch (error) {
console.error("❌ Interaction error:", error);

```
if (!interaction.replied && !interaction.deferred) {
  return interaction.reply({
    content: "❌ Error running command. Check Railway logs.",
    ephemeral: true
  });
}

return interaction.followUp({
  content: "❌ Error running command. Check Railway logs.",
  ephemeral: true
});
```

}
});

client.login(TOKEN);
