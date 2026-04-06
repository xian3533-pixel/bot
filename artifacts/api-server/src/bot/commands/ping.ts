import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check if the bot is online and responsive");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sent = await interaction.deferReply({ fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(interaction.client.ws.ping);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("🏓 Pong!")
    .addFields(
      { name: "Bot Latency", value: `${latency}ms`, inline: true },
      { name: "API Latency", value: `${apiLatency}ms`, inline: true },
      { name: "Status", value: "🟢 Online & Running", inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
