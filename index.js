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
let activityList = [
  "🚀 Serving servers",
  "👥 Watching users",
  "🎛️ /custom panel"
];

let index = 0;
const startTime = Date.now();

// ===== ANTI CRASH =====
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ===== CHECK ROLE =====
function hasPermission(member) {
  return member.roles.cache.has(process.env.ROLE_ID);
}

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
      connectVC(channel);
    }
  });
}

// ===== READY =====
client.once("ready", () => {
  console.log(`✅ ${client.user.tag}`);

  const vc = client.channels.cache.get(currentVC);
  if (vc) connectVC(vc);

  setInterval(() => {
    if (!autoRotate && manualActivity) {
      client.user.setActivity(manualActivity);
      return;
    }

    client.user.setActivity(activityList[index % activityList.length]);
    index++;
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
    .addSubcommand(s => s.setName("panel").setDescription("open panel")),

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
})();

// ===== PANEL =====
function panel() {
  const embed = new EmbedBuilder()
    .setTitle("🎛️ CONTROL PANEL")
    .addFields(
      { name: "Auto", value: String(autoRotate), inline: true },
      { name: "Status", value: manualStatus, inline: true },
      { name: "List", value: activityList.join("\n") }
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("auto").setLabel("Toggle Auto").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setlist").setLabel("Set List").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("setstatus").setLabel("Set Status").setStyle(ButtonStyle.Success)
  );

  return { embed, components: [buttons] };
}

// ===== HANDLE =====
client.on("interactionCreate", async (i) => {

  // ===== SLASH =====
  if (i.isChatInputCommand()) {

    if (i.commandName === "custom") {
      if (!hasPermission(i.member))
        return i.reply({ content: "❌ không có quyền", ephemeral: true });

      const { embed, components } = panel();
      return i.reply({ embeds: [embed], components });
    }

    if (i.commandName === "joinvc") {
      let ch = i.options.getString("id")
        ? client.channels.cache.get(i.options.getString("id"))
        : i.member.voice.channel;

      if (!ch) return i.reply("❌ vào VC");
      connectVC(ch);
      return i.reply(`🎧 ${ch.name}`);
    }

    if (i.commandName === "leavevc") {
      const conn = getVoiceConnection(i.guild.id);
      if (conn) conn.destroy();
      return i.reply("👋 done");
    }
  }

  // ===== BUTTON =====
  if (i.isButton()) {

    if (!hasPermission(i.member))
      return i.reply({ content: "❌ không có quyền", ephemeral: true });

    if (i.customId === "auto") {
      autoRotate = !autoRotate;
    }

    if (i.customId === "setlist") {
      const modal = new ModalBuilder()
        .setCustomId("list_modal")
        .setTitle("Set Activity List");

      const input = new TextInputBuilder()
        .setCustomId("list")
        .setLabel("Mỗi dòng 1 activity")
        .setStyle(TextInputStyle.Paragraph);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return i.showModal(modal);
    }

    if (i.customId === "setstatus") {
      manualStatus = "online";
      autoRotate = false;
    }

    const { embed, components } = panel();
    return i.update({ embeds: [embed], components });
  }

  // ===== MODAL =====
  if (i.isModalSubmit()) {

    if (!hasPermission(i.member))
      return i.reply({ content: "❌ không có quyền", ephemeral: true });

    if (i.customId === "list_modal") {
      const text = i.fields.getTextInputValue("list");

      activityList = text.split("\n").filter(x => x.trim() !== "");
      index = 0;
      autoRotate = true;

      return i.reply("✅ updated list");
    }
  }
});

client.login(process.env.TOKEN);