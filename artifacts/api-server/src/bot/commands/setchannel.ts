import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { setChannel } from "../store.js";

const FEATURES = ["media", "meme", "announcements", "rules"] as const;
type Feature = typeof FEATURES[number];

const FEATURE_LABELS: Record<Feature, string> = {
  media: "📷 Media Channel",
  meme: "😂 Meme Spam Channel",
  announcements: "📢 Announcements Channel",
  rules: "📋 Rules Channel",
};

export const data = new SlashCommandBuilder()
  .setName("setchannel")
  .setDescription("Set a channel for a specific feature")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((opt) =>
    opt
      .setName("feature")
      .setDescription("Which feature to set the channel for")
      .setRequired(true)
      .addChoices(
        { name: "Media (auto-delete non-media messages)", value: "media" },
        { name: "Meme Spam (bot posts memes here)", value: "meme" },
        { name: "Announcements", value: "announcements" },
        { name: "Rules", value: "rules" }
      )
  )
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("The channel to set (defaults to current channel)")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const feature = interaction.options.getString("feature", true) as Feature;
  const targetChannel = interaction.options.getChannel("channel") ?? interaction.channel;

  if (!targetChannel) {
    await interaction.editReply("Could not determine the channel.");
    return;
  }

  await setChannel(feature, targetChannel.id);

  const label = FEATURE_LABELS[feature] ?? feature;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("✅ Channel Set")
    .setDescription(`${label} has been set to <#${targetChannel.id}>`)
    .addFields({ name: "Feature", value: label, inline: true })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
