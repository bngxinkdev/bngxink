const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

const commands = [
  new SlashCommandBuilder().setName("custom").setDescription("panel"),
  new SlashCommandBuilder().setName("joinvc").setDescription("join vc"),
  new SlashCommandBuilder().setName("leavevc").setDescription("leave vc"),
  new SlashCommandBuilder()
    .setName("permission")
    .setDescription("set role")
    .addRoleOption(o => o.setName("role").setRequired(true))
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log("✅ commands deployed");
})();