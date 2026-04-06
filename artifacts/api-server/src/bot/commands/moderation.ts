import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("mod")
  .setDescription("Moderation commands")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((sub) =>
    sub
      .setName("kick")
      .setDescription("Kick a member from the server")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to kick").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the kick").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("ban")
      .setDescription("Ban a member from the server")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to ban").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the ban").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("timeout")
      .setDescription("Timeout a member")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to timeout").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Timeout duration in minutes")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the timeout").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("unban")
      .setDescription("Unban a user by their ID")
      .addStringOption((opt) =>
        opt.setName("userid").setDescription("The user ID to unban").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("untimeout")
      .setDescription("Remove a timeout from a member")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to remove timeout from").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const sub = interaction.options.getSubcommand();

  if (sub === "kick") {
    const target = interaction.options.getMember("user") as GuildMember | null;
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!target) {
      await interaction.editReply("Could not find that member.");
      return;
    }
    if (!target.kickable) {
      await interaction.editReply("I cannot kick this member. They may have a higher role than me.");
      return;
    }

    await target.kick(reason);
    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setTitle("👢 Member Kicked")
      .addFields(
        { name: "User", value: `${target.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: true },
        { name: "Moderator", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  if (sub === "ban") {
    const target = interaction.options.getMember("user") as GuildMember | null;
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!target) {
      await interaction.editReply("Could not find that member.");
      return;
    }
    if (!target.bannable) {
      await interaction.editReply("I cannot ban this member. They may have a higher role than me.");
      return;
    }

    await target.ban({ reason });
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🔨 Member Banned")
      .addFields(
        { name: "User", value: `${target.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: true },
        { name: "Moderator", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  if (sub === "timeout") {
    const target = interaction.options.getMember("user") as GuildMember | null;
    const duration = interaction.options.getInteger("duration", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!target) {
      await interaction.editReply("Could not find that member.");
      return;
    }
    if (!target.moderatable) {
      await interaction.editReply("I cannot timeout this member. They may have a higher role than me.");
      return;
    }

    const ms = duration * 60 * 1000;
    await target.timeout(ms, reason);

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("⏱️ Member Timed Out")
      .addFields(
        { name: "User", value: `${target.user.tag}`, inline: true },
        { name: "Duration", value: `${duration} minute(s)`, inline: true },
        { name: "Reason", value: reason, inline: false },
        { name: "Moderator", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  if (sub === "unban") {
    const userId = interaction.options.getString("userid", true);
    try {
      await interaction.guild!.members.unban(userId);
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ User Unbanned")
        .addFields(
          { name: "User ID", value: userId, inline: true },
          { name: "Moderator", value: interaction.user.tag, inline: true }
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply("Could not unban that user. The ID may be invalid.");
    }
  }

  if (sub === "untimeout") {
    const target = interaction.options.getMember("user") as GuildMember | null;
    if (!target) {
      await interaction.editReply("Could not find that member.");
      return;
    }
    await target.timeout(null);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("✅ Timeout Removed")
      .addFields(
        { name: "User", value: `${target.user.tag}`, inline: true },
        { name: "Moderator", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
