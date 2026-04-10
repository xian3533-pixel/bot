import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Post the support ticket panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel to post the ticket panel in (defaults to current channel)")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const channelOption = interaction.options.getChannel("channel");
  let targetChannel: TextChannel;

  if (channelOption) {
    const ch = await interaction.guild?.channels.fetch(channelOption.id).catch(() => null);
    if (!ch || !ch.isTextBased()) {
      await interaction.editReply("❌ That channel is not a valid text channel.");
      return;
    }
    targetChannel = ch as TextChannel;
  } else {
    targetChannel = interaction.channel as TextChannel;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("ticket_create")
    .setPlaceholder("Select a ticket type to open...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Support Ticket")
        .setDescription("Get help with a general issue")
        .setValue("support")
        .setEmoji("🎫"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Staff Etiquette Report")
        .setDescription("Report staff behavior or conduct")
        .setValue("etiquette")
        .setEmoji("📋"),
      new StringSelectMenuOptionBuilder()
        .setLabel("General Questions")
        .setDescription("Ask a general question")
        .setValue("general")
        .setEmoji("❓")
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎫 Support Center")
    .setDescription(
      [
        "Need help? Open a ticket by selecting an option from the dropdown below.",
        "",
        "🎫 **Support Ticket** — General help and issues",
        "📋 **Staff Etiquette Report** — Report staff conduct",
        "❓ **General Questions** — Ask anything",
      ].join("\n")
    )
    .setFooter({ text: "Select a category to create a private ticket" });

  await targetChannel.send({ embeds: [embed], components: [row] });
  await interaction.editReply(`✅ Ticket panel posted in <#${targetChannel.id}>.`);
}
