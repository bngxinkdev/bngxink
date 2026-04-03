require("dotenv").config();
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");
const { read, write } = require("./utils");

console.log("🚀 Bot starting...");

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let startTime = Date.now();
let vcConnection = null;

// ================== READY ==================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  startPresenceLoop();
  autoReconnectVC();
});

// ================== PRESENCE ==================
function startPresenceLoop() {
  let config = read("config.json");

  if (!config.autoPresence) return;

  const list = read("presence.json");
  let i = 0;

  setInterval(() => {
    const p = list[i % list.length];
    client.user.setActivity(p.text, {
      type: ActivityType[p.type.toUpperCase()]
    });
    i++;
  }, 10000);
}

// ================== VC ==================
function joinVC(guildId, channelId) {
  vcConnection = joinVoiceChannel({
    channelId,
    guildId,
    adapterCreator: client.guilds.cache.get(guildId).voiceAdapterCreator
  });

  let data = read("voice.json");
  data.guildId = guildId;
  data.channelId = channelId;
  write("voice.json", data);
}

function autoReconnectVC() {
  const data = read("voice.json");
  if (!data.channelId) return;

  setTimeout(() => {
    try {
      joinVC(data.guildId, data.channelId);
      console.log("🔁 Reconnected VC");
    } catch {}
  }, 5000);
}

// ================== PERMISSION ==================
function checkRole(member) {
  const config = read("config.json");
  if (!config.role) return true;
  return member.roles.cache.has(config.role);
}

// ================== COMMAND ==================
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  if (i.isChatInputCommand()) {

    if (i.commandName === "permission") {
      const role = i.options.getRole("role");

      let config = read("config.json");
      config.role = role.id;
      write("config.json", config);

      return i.reply({ content: "✅ role set", ephemeral: true });
    }

    if (i.commandName === "joinvc") {
      const vc = i.member.voice.channel;
      if (!vc) return i.reply({ content: "❌ vào VC đi", ephemeral: true });

      joinVC(i.guild.id, vc.id);
      return i.reply("✅ joined");
    }

    if (i.commandName === "leavevc") {
      vcConnection?.destroy();
      return i.reply("👋 left");
    }

    if (i.commandName === "custom") {

      if (!checkRole(i.member)) {
        return i.reply({ content: "❌ no perm", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle("⚙️ Control Panel")
        .setDescription("choose action")
        .addFields(
          { name: "Uptime", value: `${Math.floor((Date.now() - startTime) / 1000)}s` }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("status").setLabel("Toggle Status").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("presence").setLabel("Toggle Presence").setStyle(ButtonStyle.Secondary)
      );

      return i.reply({ embeds: [embed], components: [row] });
    }
  }

  // ================== BUTTON ==================
  if (i.isButton()) {
    let config = read("config.json");

    if (i.customId === "status") {
      config.status = config.status === "online" ? "dnd" : "online";
      client.user.setStatus(config.status);
      write("config.json", config);

      return i.reply({ content: `status: ${config.status}`, ephemeral: true });
    }

    if (i.customId === "presence") {
      config.autoPresence = !config.autoPresence;
      write("config.json", config);

      return i.reply({ content: `autoPresence: ${config.autoPresence}`, ephemeral: true });
    }
  }
});

// ================== LOGIN ==================
console.log("🔑 Logging into Discord...");
client.login(process.env.TOKEN);