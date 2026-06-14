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

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID || "1514692669752999986";

if (!TOKEN) {
console.error("Missing TOKEN. Add TOKEN in Railway Variables.");
process.exit(1);
}

const client = new Client({
intents: [GatewayIntentBits.Guilds]
});

const settings = {
logsChannelId: null,
onDutyRoleId: null,
welcomeEnabled: false,
welcomeChannelId: null,
welcomeTitle: "Welcome to Sentinel Enforcement Authority",
welcomeMessage: "Welcome {user} to {server}! You are member #{memberCount}.",
welcomeImage: ""
};

const permissionRoles = {
staff: new Set(),
mod: new Set(),
admin: new Set(),
high: new Set(),
infract: new Set()
};

const autoroles = new Set();
const cases = [];
const activeShifts = new Map();
const completedShifts = [];
let nextCaseNumber = 1;

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
.addStringOption(function (o) { return o.setName("title").setDescription("Embed title").setRequired(true); })
.addStringOption(function (o) { return o.setName("description").setDescription("Embed description").setRequired(true); })
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
.addStringOption(function (o) { return o.setName("footer").setDescription("Footer text").setRequired(false); });
}),

new SlashCommandBuilder()
.setName("welcome")
.setDescription("Manage welcome messages")
.addSubcommand(function (sub) {
return sub
.setName("set")
.setDescription("Set the welcome channel and message")
.addChannelOption(function (o) { return o.setName("channel").setDescription("Welcome channel").setRequired(true); })
.addStringOption(function (o) { return o.setName("title").setDescription("Welcome title").setRequired(false); })
.addStringOption(function (o) { return o.setName("message").setDescription("Use {user}, {server}, {memberCount}").setRequired(false); })
.addStringOption(function (o) { return o.setName("image").setDescription("Image URL").setRequired(false); });
})
.addSubcommand(function (sub) { return sub.setName("off").setDescription("Turn off welcome messages"); })
.addSubcommand(function (sub) { return sub.setName("test").setDescription("Test welcome message"); }),

new SlashCommandBuilder()
.setName("autorole")
.setDescription("Manage auto roles")
.addSubcommand(function (sub) {
return sub.setName("add").setDescription("Add auto role").addRoleOption(function (o) {
return o.setName("role").setDescription("Role").setRequired(true);
});
})
.addSubcommand(function (sub) {
return sub.setName("remove").setDescription("Remove auto role").addRoleOption(function (o) {
return o.setName("role").setDescription("Role").setRequired(true);
});
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
return sub.setName("logs").setDescription("Set logs channel").addChannelOption(function (o) {
return o.setName("channel").setDescription("Logs channel").setRequired(true);
});
})
.addSubcommand(function (sub) {
return sub.setName("onduty").setDescription("Set On-Duty role").addRoleOption(function (o) {
return o.setName("role").setDescription("On-Duty role").setRequired(true);
});
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

function isAdmin(interaction, member) {
if (interaction.memberPermissions && interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return true;
if (member && member.permissions && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
return false;
}

async function getCommandMember(interaction) {
try {
return await interaction.guild.members.fetch(interaction.user.id);
} catch (error) {
return interaction.member;
}
}

async function getTargetMember(interaction, user) {
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
if (permissionRoles.staff.has(role.id)) level = Math.max(level, 1);
if (permissionRoles.mod.has(role.id)) level = Math.max(level, 2);
if (permissionRoles.admin.has(role.id)) level = Math.max(level, 3);
if (permissionRoles.high.has(role.id)) level = Math.max(level, 4);
}
return level;
}

function hasLevel(member, needed, interaction) {
const levels = { staff: 1, mod: 2, admin: 3, high: 4 };
return memberLevel(member, interaction) >= levels[needed];
}

function hasInfract(member, interaction) {
if (isAdmin(interaction, member)) return true;
if (!member || !member.roles || !member.roles.cache) return false;
return member.roles.cache.some(function (role) {
return permissionRoles.infract.has(role.id);
});
}

function canAct(member, targetMember, interaction) {
if (!targetMember) return true;
return memberLevel(member, interaction) > memberLevel(targetMember, null) || memberLevel(member, interaction) >= 4;
}

function createCase(type, userId, officerId, reason, duration, extra) {
const item = {
caseNumber: nextCaseNumber,
type: type,
userId: userId,
officerId: officerId,
reason: reason || "No reason",
duration: duration || null,
createdAt: Date.now(),
arrestLocation: extra && extra.arrestLocation ? extra.arrestLocation : null,
mugshotUrl: extra && extra.mugshotUrl ? extra.mugshotUrl : null
};
nextCaseNumber += 1;
cases.push(item);
return item;
}

function caseEmbed(item) {
const userValue = item.type === "ARREST" ? item.userId : "<@" + item.userId + ">";
const embed = new EmbedBuilder()
.setTitle(item.type + " Case #" + item.caseNumber)
.setColor(0x2b2d31)
.addFields(
{ name: "User", value: userValue, inline: true },
{ name: "Officer", value: "<@" + item.officerId + ">", inline: true },
{ name: "Reason", value: item.reason, inline: false }
)
.setFooter({ text: "Case Number: " + item.caseNumber })
.setTimestamp();

if (item.duration) embed.addFields({ name: "Duration", value: item.duration, inline: true });
if (item.arrestLocation) embed.addFields({ name: "Arrest Location", value: item.arrestLocation, inline: false });
if (item.mugshotUrl) embed.setImage(item.mugshotUrl);
return embed;
}

async function sendLog(embed) {
if (!settings.logsChannelId) return;
const channel = await client.channels.fetch(settings.logsChannelId).catch(function () { return null; });
if (channel) await channel.send({ embeds: [embed] }).catch(function () {});
}

function fillWelcome(text, member) {
return text
.replaceAll("{user}", "<@" + member.id + ">")
.replaceAll("{server}", member.guild.name)
.replaceAll("{memberCount}", String(member.guild.memberCount));
}

async function sendWelcome(member) {
if (!settings.welcomeEnabled || !settings.welcomeChannelId) return;
const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(function () { return null; });
if (!channel || !channel.isTextBased()) return;

const embed = new EmbedBuilder()
.setTitle(fillWelcome(settings.welcomeTitle, member))
.setDescription(fillWelcome(settings.welcomeMessage, member))
.setColor(0x2b2d31)
.setThumbnail(member.user.displayAvatarURL({ size: 256 }))
.setTimestamp();

if (settings.welcomeImage && settings.welcomeImage.startsWith("http")) embed.setImage(settings.welcomeImage);
await channel.send({ content: "<@" + member.id + ">", embeds: [embed] }).catch(function () {});
}

function formatMs(ms) {
const mins = Math.floor(ms / 60000);
const hours = Math.floor(mins / 60);
const minutes = mins % 60;
if (hours > 0) return hours + "h " + minutes + "m";
return minutes + "m";
}

function shiftTime(shift) {
if (!shift) return 0;
let breakMs = shift.breakMs;
if (shift.status === "break") breakMs += Date.now() - shift.breakStart;
return Math.max(0, Date.now() - shift.startedAt - breakMs);
}

function shiftEmbed(user, notice) {
const shift = activeShifts.get(user.id);
const embed = new EmbedBuilder()
.setTitle("Shift Management")
.setColor(0x2b2d31)
.setDescription(notice || "Use the buttons below to manage your shift.")
.setTimestamp();

if (!shift) {
embed.addFields(
{ name: "User", value: "<@" + user.id + ">", inline: true },
{ name: "Status", value: "Off Duty", inline: true },
{ name: "Active Time", value: "0m", inline: true }
);
} else {
embed.addFields(
{ name: "User", value: "<@" + user.id + ">", inline: true },
{ name: "Status", value: shift.status === "break" ? "On Break" : "On Shift", inline: true },
{ name: "Active Time", value: formatMs(shiftTime(shift)), inline: true }
);
}
return embed;
}

function shiftButtons(userId) {
const shift = activeShifts.get(userId);
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

async function setOnDuty(guild, userId, add) {
if (!settings.onDutyRoleId) return;
const member = await guild.members.fetch(userId).catch(function () { return null; });
if (!member) return;
if (add) await member.roles.add(settings.onDutyRoleId).catch(function () {});
else await member.roles.remove(settings.onDutyRoleId).catch(function () {});
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

const shift = activeShifts.get(interaction.user.id);
let notice = "Updated.";

if (action === "start") {
if (shift) notice = "You are already on shift.";
else {
activeShifts.set(interaction.user.id, { startedAt: Date.now(), status: "active", breakStart: 0, breakMs: 0 });
await setOnDuty(interaction.guild, interaction.user.id, true);
notice = "Shift started.";
}
}

if (action === "break") {
if (!shift) notice = "You need to start your shift first.";
else if (shift.status === "break") notice = "You are already on break.";
else {
shift.status = "break";
shift.breakStart = Date.now();
await setOnDuty(interaction.guild, interaction.user.id, false);
notice = "You are now on break.";
}
}

if (action === "resume") {
if (!shift) notice = "You need to start your shift first.";
else if (shift.status !== "break") notice = "You are not on break.";
else {
shift.breakMs += Date.now() - shift.breakStart;
shift.status = "active";
shift.breakStart = 0;
await setOnDuty(interaction.guild, interaction.user.id, true);
notice = "Break ended.";
}
}

if (action === "end") {
if (!shift) notice = "You are not on shift.";
else {
const minutes = Math.max(1, Math.floor(shiftTime(shift) / 60000));
completedShifts.push({ userId: interaction.user.id, minutes: minutes });
activeShifts.delete(interaction.user.id);
await setOnDuty(interaction.guild, interaction.user.id, false);
notice = "Shift ended. Logged " + minutes + " minutes.";
}
}

return interaction.update({
embeds: [shiftEmbed(interaction.user, notice)],
components: shiftButtons(interaction.user.id)
});
}

client.once("clientReady", async function () {
try {
const rest = new REST({ version: "10" }).setToken(TOKEN);
await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
console.log("Logged in as " + client.user.tag);
console.log("Commands deployed to guild " + GUILD_ID + " using this same bot.");
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

if (!interaction.isChatInputCommand()) return;

const command = interaction.commandName;
const member = await getCommandMember(interaction);

if (command === "help") {
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

if (command === "embed") {
  if (!hasLevel(member, "high", interaction)) return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
  const channel = interaction.options.getChannel("channel");
  const title = interaction.options.getString("title");
  const description = interaction.options.getString("description");
  const colorChoice = interaction.options.getString("color") || "black";
  const image = interaction.options.getString("image");
  const thumbnail = interaction.options.getString("thumbnail");
  const footer = interaction.options.getString("footer") || "Sentinel Enforcement Authority";
  const colors = { black: 0x2b2d31, blue: 0x3498db, green: 0x2ecc71, red: 0xe74c3c, gold: 0xf1c40f, purple: 0x9b59b6, white: 0xffffff };
  if (!channel || !channel.isTextBased()) return interaction.reply({ content: "Pick a text channel.", ephemeral: true });
  const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(colors[colorChoice] || 0x2b2d31).setFooter({ text: footer }).setTimestamp();
  if (image && image.startsWith("http")) embed.setImage(image);
  if (thumbnail && thumbnail.startsWith("http")) embed.setThumbnail(thumbnail);
  await channel.send({ embeds: [embed] });
  return interaction.reply({ content: "Embed sent in " + channel.toString() + ".", ephemeral: true });
}

if (command === "welcome") {
  if (!hasLevel(member, "high", interaction)) return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
  const sub = interaction.options.getSubcommand();
  if (sub === "set") {
    const channel = interaction.options.getChannel("channel");
    settings.welcomeEnabled = true;
    settings.welcomeChannelId = channel.id;
    settings.welcomeTitle = interaction.options.getString("title") || settings.welcomeTitle;
    settings.welcomeMessage = interaction.options.getString("message") || settings.welcomeMessage;
    settings.welcomeImage = interaction.options.getString("image") || "";
    return interaction.reply({ content: "Welcome system set to " + channel.toString() + ". Use /welcome test.", ephemeral: true });
  }
  if (sub === "off") {
    settings.welcomeEnabled = false;
    return interaction.reply({ content: "Welcome system turned off.", ephemeral: true });
  }
  if (sub === "test") {
    await sendWelcome(member);
    return interaction.reply({ content: "Sent a test welcome message.", ephemeral: true });
  }
}

if (command === "autorole") {
  if (!hasLevel(member, "high", interaction)) return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const role = interaction.options.getRole("role");
  if (sub === "add") {
    if (autoroles.size >= 5) return interaction.reply({ content: "Max 5 auto roles.", ephemeral: true });
    autoroles.add(role.id);
    return interaction.reply({ content: role.toString() + " saved. Auto join roles need Server Members Intent later.", ephemeral: true });
  }
  if (sub === "remove") {
    autoroles.delete(role.id);
    return interaction.reply({ content: role.toString() + " removed.", ephemeral: true });
  }
  if (sub === "list") {
    const list = Array.from(autoroles).map(function (id) { return "<@&" + id + ">"; }).join("\n");
    return interaction.reply({ content: list || "No auto roles set.", ephemeral: true });
  }
}

if (command === "perm") {
  if (!hasLevel(member, "high", interaction)) return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const permission = interaction.options.getString("permission");
  const role = interaction.options.getRole("role");
  if (sub === "add") {
    permissionRoles[permission].add(role.id);
    return interaction.reply({ content: "Added " + role.toString() + " to " + permission + ".", ephemeral: true });
  }
  if (sub === "remove") {
    permissionRoles[permission].delete(role.id);
    return interaction.reply({ content: "Removed " + role.toString() + " from " + permission + ".", ephemeral: true });
  }
  if (sub === "list") {
    let text = "";
    for (const key of ["staff", "mod", "admin", "high", "infract"]) {
      const roles = Array.from(permissionRoles[key]).map(function (id) { return "<@&" + id + ">"; });
      text += key.toUpperCase() + ": " + (roles.length ? roles.join(", ") : "None") + "\n";
    }
    return interaction.reply({ content: text, ephemeral: true });
  }
}

if (command === "config") {
  if (!hasLevel(member, "high", interaction)) return interaction.reply({ content: "High Command or Discord Admin only.", ephemeral: true });
  const sub = interaction.options.getSubcommand();
  if (sub === "logs") {
    const channel = interaction.options.getChannel("channel");
    settings.logsChannelId = channel.id;
    return interaction.reply({ content: "Logs channel set to " + channel.toString() + ".", ephemeral: true });
  }
  if (sub === "onduty") {
    const role = interaction.options.getRole("role");
    settings.onDutyRoleId = role.id;
    return interaction.reply({ content: "On-Duty role set to " + role.toString() + ".", ephemeral: true });
  }
}

if (command === "shift") {
  if (!hasLevel(member, "staff", interaction)) return interaction.reply({ content: "Staff only.", ephemeral: true });
  return interaction.reply({ embeds: [shiftEmbed(interaction.user, null)], components: shiftButtons(interaction.user.id), ephemeral: true });
}

if (command === "log") {
  if (!hasLevel(member, "staff", interaction)) return interaction.reply({ content: "Staff only.", ephemeral: true });
  const suspect = interaction.options.getString("suspect_username");
  const charges = interaction.options.getString("charges");
  const location = interaction.options.getString("arrest_location");
  const mugshot = interaction.options.getAttachment("mugshot");
  const item = createCase("ARREST", suspect, interaction.user.id, charges, null, { arrestLocation: location, mugshotUrl: mugshot ? mugshot.url : null });
  const embed = caseEmbed(item);
  await sendLog(embed);
  return interaction.reply({ content: "Arrest logged. Case #" + item.caseNumber, embeds: [embed] });
}

if (command === "leaderboard") {
  if (!hasLevel(member, "staff", interaction)) return interaction.reply({ content: "Staff only.", ephemeral: true });
  const totals = new Map();
  completedShifts.forEach(function (s) { totals.set(s.userId, (totals.get(s.userId) || 0) + s.minutes); });
  const sorted = Array.from(totals.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
  if (!sorted.length) return interaction.reply("No shift data yet.");
  const embed = new EmbedBuilder().setTitle("Shift Leaderboard").setColor(0x2b2d31).setDescription(sorted.map(function (x, i) { return "#" + (i + 1) + " <@" + x[0] + "> - " + x[1] + " minutes"; }).join("\n"));
  return interaction.reply({ embeds: [embed] });
}

if (command === "warn" || command === "infract" || command === "kick" || command === "ban" || command === "mute" || command === "unmute") {
  const target = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason";
  const targetMember = await getTargetMember(interaction, target);

  if (command === "warn" && !hasLevel(member, "mod", interaction)) return interaction.reply({ content: "Mods+ only.", ephemeral: true });
  if (command === "kick" && !hasLevel(member, "mod", interaction)) return interaction.reply({ content: "Mods+ only.", ephemeral: true });
  if (command === "mute" && !hasLevel(member, "mod", interaction)) return interaction.reply({ content: "Mods+ only.", ephemeral: true });
  if (command === "unmute" && !hasLevel(member, "mod", interaction)) return interaction.reply({ content: "Mods+ only.", ephemeral: true });
  if (command === "ban" && !hasLevel(member, "admin", interaction)) return interaction.reply({ content: "Admins+ only.", ephemeral: true });
  if (command === "infract" && !hasInfract(member, interaction)) return interaction.reply({ content: "You need the Infract permission role.", ephemeral: true });
  if (!canAct(member, targetMember, interaction)) return interaction.reply({ content: "You cannot moderate this user.", ephemeral: true });

  if (command === "kick") {
    if (!targetMember || !targetMember.kickable) return interaction.reply({ content: "I cannot kick this user. Move my role higher.", ephemeral: true });
    await targetMember.kick(reason);
  }
  if (command === "ban") {
    if (targetMember && !targetMember.bannable) return interaction.reply({ content: "I cannot ban this user. Move my role higher.", ephemeral: true });
    await interaction.guild.members.ban(target.id, { reason: reason });
  }
  if (command === "mute") {
    const minutes = interaction.options.getInteger("minutes") || 10;
    if (!targetMember || !targetMember.moderatable) return interaction.reply({ content: "I cannot mute this user. Move my role higher.", ephemeral: true });
    await targetMember.timeout(minutes * 60 * 1000, reason);
    const item = createCase("MUTE", target.id, interaction.user.id, reason, minutes + " minutes", null);
    const embed = caseEmbed(item);
    await sendLog(embed);
    return interaction.reply({ content: "Muted " + target.tag + " for " + minutes + " minutes. Case #" + item.caseNumber, embeds: [embed] });
  }
  if (command === "unmute") {
    if (!targetMember) return interaction.reply({ content: "User is not in the server.", ephemeral: true });
    await targetMember.timeout(null, reason);
  }

  const type = command.toUpperCase() === "INFRACT" ? "INFRACTION" : command.toUpperCase();
  const item = createCase(type, target.id, interaction.user.id, reason, null, null);
  const embed = caseEmbed(item);
  await sendLog(embed);
  return interaction.reply({ content: type + " created. Case #" + item.caseNumber, embeds: [embed] });
}

if (command === "case") {
  if (!hasLevel(member, "staff", interaction)) return interaction.reply({ content: "Staff only.", ephemeral: true });
  const number = interaction.options.getInteger("number");
  const item = cases.find(function (c) { return c.caseNumber === number; });
  if (!item) return interaction.reply({ content: "Case not found.", ephemeral: true });
  return interaction.reply({ embeds: [caseEmbed(item)] });
}

if (command === "history") {
  if (!hasLevel(member, "staff", interaction)) return interaction.reply({ content: "Staff only.", ephemeral: true });
  const target = interaction.options.getUser("user");
  const rows = cases.filter(function (c) { return c.userId === target.id; }).slice(-10).reverse();
  if (!rows.length) return interaction.reply("No history found for " + target.tag + ".");
  const embed = new EmbedBuilder().setTitle("History for " + target.tag).setColor(0x2b2d31).setDescription(rows.map(function (c) { return "#" + c.caseNumber + " [" + c.type + "] " + c.reason; }).join("\n"));
  return interaction.reply({ embeds: [embed] });
}

} catch (error) {
console.error("Interaction error:", error);
if (!interaction.replied && !interaction.deferred) return interaction.reply({ content: "Error running command. Check Railway logs.", ephemeral: true });
return interaction.followUp({ content: "Error running command. Check Railway logs.", ephemeral: true });
}
});

client.login(TOKEN);
