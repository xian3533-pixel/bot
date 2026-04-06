import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { getSettings } from "../store.js";
import { toggleMemeSpam, isMemeSpamActive } from "../memeSpammer.js";

export const data = new SlashCommandBuilder()
  .setName("memespam")
  .setDescription("Control the meme spam feature")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand((sub) =>
    sub
      .setName("start")
      .setDescription("Start posting memes in the meme channel")
      .addIntegerOption((opt) =>
        opt
          .setName("interval")
          .setDescription("How often to post a meme (in minutes, default: 30)")
          .setMinValue(1)
          .setMaxValue(1440)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("stop").setDescription("Stop the meme spam")
  )
  .addSubcommand((sub) =>
    sub
      .setName("interval")
      .setDescription("Change the posting interval")
      .addIntegerOption((opt) =>
        opt
          .setName("minutes")
          .setDescription("How often to post a meme (in minutes)")
          .setMinValue(1)
          .setMaxValue(1440)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Check the current meme spam status")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const settings = getSettings();

  if (sub === "start") {
    if (!settings.channels.meme) {
      await interaction.editReply(
        "No meme channel set! Use `/setchannel feature:Meme Spam Channel` first."
      );
      return;
    }

    const interval = interaction.options.getInteger("interval") ?? settings.memeSpam.intervalMinutes;
    await toggleMemeSpam(interaction.client, true, interval);

    const embed = new EmbedBuilder()
      .setColor(0xeb459e)
      .setTitle("🤣 Meme Spam Started!")
      .setDescription(`Posting memes in <#${settings.channels.meme}> every **${interval} minute(s)**.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  if (sub === "stop") {
    await toggleMemeSpam(interaction.client, false);
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🛑 Meme Spam Stopped")
      .setDescription("No more memes will be posted automatically.")
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  if (sub === "interval") {
    const minutes = interaction.options.getInteger("minutes", true);
    const isActive = isMemeSpamActive();
    await toggleMemeSpam(interaction.client, isActive, minutes);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("⏱️ Interval Updated")
      .setDescription(
        `Meme spam interval set to **${minutes} minute(s)**. ${isActive ? "Restarted with new interval." : "Start it with `/memespam start`."}`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  if (sub === "status") {
    const active = isMemeSpamActive();
    const memeChannel = settings.channels.meme;
    const interval = settings.memeSpam.intervalMinutes;

    const embed = new EmbedBuilder()
      .setColor(active ? 0x57f287 : 0xed4245)
      .setTitle("📊 Meme Spam Status")
      .addFields(
        { name: "Status", value: active ? "🟢 Running" : "🔴 Stopped", inline: true },
        { name: "Channel", value: memeChannel ? `<#${memeChannel}>` : "Not set", inline: true },
        { name: "Interval", value: `${interval} minute(s)`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
