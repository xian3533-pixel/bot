import {
  StringSelectMenuInteraction,
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from "discord.js";
import { logger } from "../lib/logger.js";

const TICKET_TYPES: Record<string, { label: string; emoji: string; color: number; description: string }> = {
  support: {
    label: "Support Ticket",
    emoji: "🎫",
    color: 0x5865f2,
    description: "Please describe your issue in detail and a staff member will assist you shortly.",
  },
  etiquette: {
    label: "Staff Etiquette Report",
    emoji: "📋",
    color: 0xed4245,
    description: "Please describe the staff member's behavior and any relevant details. Your report will be handled confidentially.",
  },
  general: {
    label: "General Questions",
    emoji: "❓",
    color: 0x57f287,
    description: "Feel free to ask your question and a staff member will get back to you.",
  },
};

export async function handleTicketCreate(interaction: StringSelectMenuInteraction): Promise<void> {
  const type = interaction.values[0];
  const ticketType = TICKET_TYPES[type];

  if (!ticketType) {
    await interaction.reply({ content: "❌ Unknown ticket type.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;
  const user = interaction.user;
  const safeName = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || user.id;
  const channelName = `${type}-${safeName}`;

  // Prevent duplicate open tickets of the same type
  const existing = guild.channels.cache.find(
    (ch) => ch.name === channelName && ch.isTextBased()
  );

  if (existing) {
    await interaction.editReply(
      `You already have an open ticket of this type: <#${existing.id}>`
    );
    return;
  }

  try {
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: guild.members.me!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });

    const closeButton = new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("🔒 Close Ticket")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

    const welcomeEmbed = new EmbedBuilder()
      .setColor(ticketType.color)
      .setTitle(`${ticketType.emoji} ${ticketType.label}`)
      .setDescription(
        [
          `Welcome ${user}!`,
          "",
          ticketType.description,
          "",
          "Click **Close Ticket** below when your issue has been resolved.",
        ].join("\n")
      )
      .setFooter({ text: `Ticket opened by ${user.tag}` })
      .setTimestamp();

    await ticketChannel.send({
      content: `<@${user.id}>`,
      embeds: [welcomeEmbed],
      components: [row],
    });

    await interaction.editReply(
      `✅ Your ticket has been created: <#${ticketChannel.id}>`
    );
  } catch (err) {
    logger.error({ err }, "Failed to create ticket channel");
    await interaction.editReply(
      "❌ Failed to create your ticket. Make sure the bot has the **Manage Channels** permission."
    );
  }
}

export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.channel as TextChannel | null;
  if (!channel) {
    await interaction.editReply("❌ Could not find this channel.");
    return;
  }

  const closedEmbed = new EmbedBuilder()
    .setColor(0xed4245)
    .setDescription(`🔒 Ticket closed by ${interaction.user}. This channel will be deleted in 5 seconds.`)
    .setTimestamp();

  await channel.send({ embeds: [closedEmbed] }).catch(() => null);
  await interaction.editReply("🔒 Closing ticket...");

  setTimeout(async () => {
    await channel.delete("Ticket closed").catch((err: unknown) => {
      logger.error({ err }, "Failed to delete ticket channel");
    });
  }, 5000);
}
