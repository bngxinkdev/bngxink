require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// ===== STATE =====
let autoRotate = true;
let manualActivity = null;
let manualStatus = "online";
let currentVC = process.env.VOICE_CHANNEL_ID;
const startTime = Date.now();

// ===== ANTI CRASH =====
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ===== UPTIME =====
function format(ms) {
  let s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

// ===== VOICE =====
function connectVC(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  currentVC = channel.id;

  const conn = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator
  });

  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(conn, VoiceConnectionStatus.Signalling, 5000),
        entersState(conn, VoiceConnectionStatus.Connecting, 5000)
      ]);
    } catch {
      console.log("🔁 reconnect...");
      connectVC(channel);
    }
  });
}

// ===== READY =====
client.once("ready", () => {
  console.log(`✅ ${client.user.tag}`);

  const vc = client.channels.cache.get(currentVC);
  if (vc) connectVC(vc);

  const acts = [
    () => `🚀 ${client.guilds.cache.size} servers`,
    () => `👥 ${client.users.cache.size} users`,
    () => `🎛️ /custom panel`,
    () => `⏱️ ${format(Date.now() - startTime)}`
  ];

  let i = 0;

  setInterval(() => {
    if (!autoRotate && manualActivity) {
      client.user.setActivity(manualActivity);
      return;
    }
    client.user.setActivity(acts[i % acts.length]());
    i++;
  }, 5000);

  setInterval(() => {
    if (!autoRotate) {
      client.user.setStatus(manualStatus);
      return;
    }
    const h = new Date().getHours();
    if (h < 6) client.user.setStatus("dnd");
    else if (h < 18) client.user.setStatus("online");
    else client.user.setStatus("idle");
  }, 10000);
});

// ===== COMMAND =====
const commands = [
  new SlashCommandBuilder()
    .setName("custom")
    .setDescription("panel")
    .addSubcommand(s =>
      s.setName("panel").setDescription("open panel")
    ),

  new SlashCommandBuilder()
    .setName("joinvc")
    .setDescription("join vc")
    .addStringOption(o =>
      o.setName("id").setRequired(false).setDescription("vc id")
    ),

  new SlashCommandBuilder()
    .setName("leavevc")
    .setDescription("leave vc")
];

// ===== REGISTER =====
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );
  console.log("✅ commands");
})();

// ===== PANEL UI =====
function createPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🎛️ BOT CONTROL PANEL")
    .setDescription("Điều khiển bot tại đây")
    .addFields(
      { name: "Auto", value: String(autoRotate), inline: true },
      { name: "Status", value: manualStatus, inline: true },
      { name: "Uptime", value: format(Date.now() - startTime) }
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("auto").setLabel("Toggle Auto").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("online").setLabel("Online").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("idle").setLabel("Idle").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("dnd").setLabel("DND").setStyle(ButtonStyle.Danger)
  );

  const select = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("activity_select")
      .setPlaceholder("Chọn activity")
      .addOptions([
        { label: "Serving", value: "serving" },
        { label: "Users", value: "users" },
        { label: "Uptime", value: "uptime" },
        { label: "Custom", value: "custom" }
      ])
  );

  return { embed, components: [buttons, select] };
}

// ===== HANDLE =====
client.on("interactionCreate", async (i) => {
  if (i.isChatInputCommand()) {

    // panel
    if (i.commandName === "custom") {
      const { embed, components } = createPanel();
      return i.reply({ embeds: [embed], components });
    }

    // joinvc
    if (i.commandName === "joinvc") {
      let ch = i.options.getString("id")
        ? client.channels.cache.get(i.options.getString("id"))
        : i.member.voice.channel;

      if (!ch) return i.reply("❌ vào VC");

      connectVC(ch);
      return i.reply(`🎧 ${ch.name}`);
    }

    // leave
    if (i.commandName === "leavevc") {
      const conn = getVoiceConnection(i.guild.id);
      if (conn) conn.destroy();
      return i.reply("👋 done");
    }
  }

  // ===== BUTTON =====
  if (i.isButton()) {
    if (i.customId === "auto") {
      autoRotate = !autoRotate;
    }

    if (["online", "idle", "dnd"].includes(i.customId)) {
      manualStatus = i.customId;
      autoRotate = false;
    }

    const { embed, components } = createPanel();
    return i.update({ embeds: [embed], components });
  }

  // ===== SELECT =====
  if (i.isStringSelectMenu()) {
    const val = i.values[0];

    if (val === "serving") manualActivity = "🚀 Serving servers";
    if (val === "users") manualActivity = "👥 Watching users";
    if (val === "uptime") manualActivity = `⏱️ ${format(Date.now() - startTime)}`;

    if (val === "custom") {
      const modal = new ModalBuilder()
        .setCustomId("custom_modal")
        .setTitle("Custom Activity");

      const input = new TextInputBuilder()
        .setCustomId("text")
        .setLabel("Nhập activity")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return i.showModal(modal);
    }

    autoRotate = false;

    const { embed, components } = createPanel();
    return i.update({ embeds: [embed], components });
  }

  // ===== MODAL =====
  if (i.isModalSubmit()) {
    if (i.customId === "custom_modal") {
      manualActivity = i.fields.getTextInputValue("text");
      autoRotate = false;

      return i.reply(`✅ ${manualActivity}`);
    }
  }
});

client.login(process.env.TOKEN);