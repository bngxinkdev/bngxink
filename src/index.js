require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const {
  joinVoiceChannel,
  getVoiceConnection
} = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let startTime = Date.now();
let voiceConfig = {};
let panelRole = null;

// ===== PRESENCE SYSTEM =====
let presenceList = [
  "🚀 bngxink bot online",
  "🎧 24/7 voice",
  "⚡ /panel để điều khiển",
];

let presenceIndex = 0;
let autoPresence = true;
let currentStatus = 'online';

// ===== AUTO ROTATE PRESENCE =====
setInterval(() => {
  if (!autoPresence) return;

  if (presenceList.length === 0) return;

  client.user.setPresence({
    activities: [{
      name: presenceList[presenceIndex],
      type: ActivityType.Playing
    }],
    status: currentStatus
  });

  presenceIndex++;
  if (presenceIndex >= presenceList.length) presenceIndex = 0;

}, 15000);

// ===== AUTO RECONNECT VC =====
async function connectVC(guild) {
  const config = voiceConfig[guild.id];
  if (!config) return;

  try {
    joinVoiceChannel({
      channelId: config.channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true
    });
  } catch (e) {
    console.log("VC reconnect error:", e.message);
  }
}

// ===== READY =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('Control bot'),

    new SlashCommandBuilder()
      .setName('joinvc')
      .setDescription('Join voice')
      .addChannelOption(o =>
        o.setName('channel')
          .setDescription('Voice channel')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('leavevc')
      .setDescription('Leave voice'),

    new SlashCommandBuilder()
      .setName('permission')
      .setDescription('Set role dùng panel')
      .addRoleOption(o =>
        o.setName('role')
          .setDescription('Role')
          .setRequired(true)
      )
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ Slash commands loaded");
});

// ===== INTERACTION =====
client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  // ===== SLASH =====
  if (i.isChatInputCommand()) {

    if (i.commandName === 'permission') {
      panelRole = i.options.getRole('role');
      return i.reply({ content: `✅ Role set: ${panelRole.name}`, ephemeral: true });
    }

    if (i.commandName === 'joinvc') {
      const vc = i.options.getChannel('channel') || i.member.voice.channel;
      if (!vc) return i.reply({ content: '❌ Vào voice trước', ephemeral: true });

      voiceConfig[i.guild.id] = {
        channelId: vc.id
      };

      connectVC(i.guild);

      return i.reply("✅ Joined VC");
    }

    if (i.commandName === 'leavevc') {
      const conn = getVoiceConnection(i.guild.id);
      if (conn) conn.destroy();
      delete voiceConfig[i.guild.id];
      return i.reply("👋 Left VC");
    }

    if (i.commandName === 'panel') {

      if (panelRole && !i.member.roles.cache.has(panelRole.id)) {
        return i.reply({ content: '❌ Không có quyền', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎛 CONTROL PANEL")
        .setDescription("Điều khiển bot tại đây")
        .addFields(
          { name: "Status", value: currentStatus, inline: true },
          { name: "Auto Presence", value: autoPresence ? "ON" : "OFF", inline: true }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('status_online').setLabel('Online').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('status_idle').setLabel('Idle').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('status_dnd').setLabel('DND').setStyle(ButtonStyle.Danger),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('toggle_presence').setLabel('Toggle Auto Presence').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('add_presence').setLabel('Add Presence').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('clear_presence').setLabel('Clear List').setStyle(ButtonStyle.Danger),
      );

      return i.reply({ embeds: [embed], components: [row, row2] });
    }
  }

  // ===== BUTTON =====
  if (i.isButton()) {

    if (panelRole && !i.member.roles.cache.has(panelRole.id)) {
      return i.reply({ content: '❌ Không có quyền', ephemeral: true });
    }

    if (i.customId.startsWith('status_')) {
      currentStatus = i.customId.replace('status_', '');
      return i.reply({ content: `✅ Status: ${currentStatus}`, ephemeral: true });
    }

    if (i.customId === 'toggle_presence') {
      autoPresence = !autoPresence;
      return i.reply({ content: `⚡ Auto Presence: ${autoPresence}`, ephemeral: true });
    }

    if (i.customId === 'add_presence') {
      presenceList.push(`✨ Custom ${Date.now()}`);
      return i.reply({ content: '➕ Added presence', ephemeral: true });
    }

    if (i.customId === 'clear_presence') {
      presenceList = [];
      return i.reply({ content: '🗑 Cleared list', ephemeral: true });
    }
  }
});

// ===== AUTO RECONNECT LOOP =====
setInterval(() => {
  for (const guildId in voiceConfig) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    const conn = getVoiceConnection(guildId);
    if (!conn) {
      connectVC(guild);
    }
  }
}, 20000);

// ===== ANTI CRASH =====
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(process.env.TOKEN);