require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType
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

// ===== GLOBAL =====
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

// ===== JOIN VC =====
function connectVC(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return null;

  currentVC = channel.id;

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true
  });

  // 🔥 AUTO RECONNECT
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000)
      ]);
    } catch {
      console.log("🔁 Reconnecting VC...");
      connectVC(channel);
    }
  });

  return connection;
}

// ===== READY =====
client.once("ready", () => {
  console.log(`✅ ${client.user.tag}`);

  // auto join lại khi restart
  const vc = client.channels.cache.get(currentVC);
  if (vc) connectVC(vc);

  // ===== ACTIVITY =====
  const acts = [
    () => `🚀 ${client.guilds.cache.size} servers`,
    () => `👥 ${client.users.cache.size} users`,
    () => `🔥 /joinvc để gọi`,
    () => `⏱️ ${format(Date.now() - startTime)}`
  ];

  let i = 0;

  setInterval(() => {
    if (!autoRotate && manualActivity) {
      client.user.setActivity(manualActivity);
      return;
    }

    client.user.setActivity(acts[i % acts.length](), { type: 0 });
    i++;
  }, 5000);

  // ===== STATUS =====
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

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("ping bot"),

  new SlashCommandBuilder().setName("uptime").setDescription("uptime"),

  new SlashCommandBuilder()
    .setName("joinvc")
    .setDescription("join voice")
    .addStringOption(o =>
      o.setName("id").setDescription("voice id").setRequired(false)
    ),

  new SlashCommandBuilder().setName("leavevc").setDescription("leave"),

  new SlashCommandBuilder()
    .setName("setactivity")
    .setDescription("manual activity")
    .addStringOption(o =>
      o.setName("text").setRequired(true).setDescription("text")
    ),

  new SlashCommandBuilder()
    .setName("setstatus")
    .setDescription("manual status")
    .addStringOption(o =>
      o.setName("type")
        .setRequired(true)
        .setDescription("online idle dnd")
    ),

  new SlashCommandBuilder()
    .setName("autotoggle")
    .setDescription("toggle auto")
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
  console.log("✅ Commands loaded");
})();

// ===== HANDLE =====
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  // ping
  if (i.commandName === "ping")
    return i.reply(`🏓 ${client.ws.ping}ms`);

  // uptime
  if (i.commandName === "uptime")
    return i.reply(`⏱️ ${format(Date.now() - startTime)}`);

  // joinvc
  if (i.commandName === "joinvc") {
    let ch;
    const id = i.options.getString("id");

    if (id) ch = client.channels.cache.get(id);
    else ch = i.member.voice.channel;

    if (!ch)
      return i.reply("❌ vào VC hoặc nhập ID");

    if (ch.type !== ChannelType.GuildVoice)
      return i.reply("❌ không phải VC");

    connectVC(ch);
    return i.reply(`🎧 joined ${ch.name}`);
  }

  // leave
  if (i.commandName === "leavevc") {
    const conn = getVoiceConnection(i.guild.id);
    if (conn) {
      conn.destroy();
      return i.reply("👋 left VC");
    }
    return i.reply("❌ chưa join");
  }

  // activity
  if (i.commandName === "setactivity") {
    manualActivity = i.options.getString("text");
    autoRotate = false;
    return i.reply(`✅ ${manualActivity}`);
  }

  // status
  if (i.commandName === "setstatus") {
    manualStatus = i.options.getString("type");
    autoRotate = false;
    return i.reply(`✅ ${manualStatus}`);
  }

  // auto
  if (i.commandName === "autotoggle") {
    autoRotate = !autoRotate;
    return i.reply(`🔁 auto: ${autoRotate}`);
  }
});

client.login(process.env.TOKEN);