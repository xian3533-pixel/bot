import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import {
  getSettings,
  setSportsLeague,
  updateSportsLeagueInterval,
  removeSportsLeague,
} from "../store.js";
import {
  fetchScores,
  startAllLeagues,
  stopAllLeaguesAndSave,
  startLeague,
  stopLeague,
  isLeagueActive,
  isAnyLeagueActive,
  LEAGUES,
} from "../sportsTracker.js";

const LEAGUE_CHOICES = Object.entries(LEAGUES).map(([value, info]) => ({
  name: `${info.emoji} ${info.name}`,
  value,
}));

export const data = new SlashCommandBuilder()
  .setName("sports")
  .setDescription("Sports scores and per-league channel/interval controls")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand((sub) =>
    sub
      .setName("scores")
      .setDescription("Get current scores for a league right now")
      .addStringOption((opt) =>
        opt
          .setName("league")
          .setDescription("Which league to check")
          .setRequired(true)
          .addChoices(...LEAGUE_CHOICES)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("setchannel")
      .setDescription("Assign a channel (and optional interval) for a league's auto-updates")
      .addStringOption((opt) =>
        opt
          .setName("league")
          .setDescription("Which league to configure")
          .setRequired(true)
          .addChoices(...LEAGUE_CHOICES)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to post updates in (defaults to current channel)")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("interval")
          .setDescription("How often to post updates for this league (in minutes, default: 30)")
          .setMinValue(5)
          .setMaxValue(1440)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("setinterval")
      .setDescription("Change the posting interval for a specific league")
      .addStringOption((opt) =>
        opt
          .setName("league")
          .setDescription("Which league to update")
          .setRequired(true)
          .addChoices(...LEAGUE_CHOICES)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("interval")
          .setDescription("New interval in minutes")
          .setMinValue(5)
          .setMaxValue(1440)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("removechannel")
      .setDescription("Remove a league from auto-updates entirely")
      .addStringOption((opt) =>
        opt
          .setName("league")
          .setDescription("Which league to remove")
          .setRequired(true)
          .addChoices(...LEAGUE_CHOICES)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("start")
      .setDescription("Start auto-posting for all leagues that have channels assigned")
  )
  .addSubcommand((sub) =>
    sub.setName("stop").setDescription("Stop all sports auto-updates")
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Show all leagues, their channels, and intervals")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "scores") {
    await interaction.deferReply();
    const leagueKey = interaction.options.getString("league", true);
    const embed = await fetchScores(leagueKey);
    if (!embed) {
      await interaction.editReply("Failed to fetch scores. Please try again later.");
      return;
    }
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const settings = getSettings();

  if (sub === "setchannel") {
    const leagueKey = interaction.options.getString("league", true);
    const targetChannel = interaction.options.getChannel("channel") ?? interaction.channel;
    const interval = interaction.options.getInteger("interval") ?? 30;
    const info = LEAGUES[leagueKey];

    if (!targetChannel) {
      await interaction.editReply("Could not determine the channel.");
      return;
    }

    await setSportsLeague(leagueKey, targetChannel.id, interval);

    // If tracker is running, restart this league's timer with the new settings
    if (isAnyLeagueActive() || settings.sportsActive) {
      startLeague(interaction.client, leagueKey, interval);
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(info?.color ?? 0x5865f2)
          .setTitle("✅ League Configured")
          .addFields(
            { name: "League", value: `${info?.emoji ?? ""} ${info?.name ?? leagueKey}`, inline: true },
            { name: "Channel", value: `<#${targetChannel.id}>`, inline: true },
            { name: "Interval", value: `Every ${interval} minute(s)`, inline: true }
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "setinterval") {
    const leagueKey = interaction.options.getString("league", true);
    const interval = interaction.options.getInteger("interval", true);
    const info = LEAGUES[leagueKey];
    const config = settings.sportsLeagues[leagueKey];

    if (!config) {
      await interaction.editReply(
        `No channel is set for ${info?.name ?? leagueKey} yet. Use \`/sports setchannel\` first.`
      );
      return;
    }

    await updateSportsLeagueInterval(leagueKey, interval);

    // Restart this league's timer with new interval if it's active
    if (isLeagueActive(leagueKey)) {
      startLeague(interaction.client, leagueKey, interval);
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(info?.color ?? 0x5865f2)
          .setTitle("⏱️ Interval Updated")
          .addFields(
            { name: "League", value: `${info?.emoji ?? ""} ${info?.name ?? leagueKey}`, inline: true },
            { name: "New Interval", value: `Every ${interval} minute(s)`, inline: true },
            { name: "Status", value: isLeagueActive(leagueKey) ? "🟢 Restarted with new interval" : "🔴 Not running (use `/sports start`)", inline: false }
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "removechannel") {
    const leagueKey = interaction.options.getString("league", true);
    const info = LEAGUES[leagueKey];
    stopLeague(leagueKey);
    await removeSportsLeague(leagueKey);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🗑️ League Removed")
          .setDescription(`${info?.emoji ?? ""} **${info?.name ?? leagueKey}** removed from auto-updates.`)
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "start") {
    if (Object.keys(settings.sportsLeagues).length === 0) {
      await interaction.editReply(
        "No leagues configured yet. Use `/sports setchannel` to set up at least one league first."
      );
      return;
    }

    await startAllLeagues(interaction.client);

    const lines = Object.entries(settings.sportsLeagues).map(
      ([k, cfg]) =>
        `${LEAGUES[k]?.emoji ?? ""} **${LEAGUES[k]?.name ?? k}** → <#${cfg.channelId}> — every **${cfg.intervalMinutes} min**`
    );

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x009c3b)
          .setTitle("📡 Sports Tracker Started!")
          .setDescription(lines.join("\n"))
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "stop") {
    await stopAllLeaguesAndSave();
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🛑 Sports Tracker Stopped")
          .setDescription("All league auto-updates have been stopped.")
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "status") {
    const allLines = Object.entries(LEAGUES).map(([key, info]) => {
      const cfg = settings.sportsLeagues[key];
      if (!cfg) return `${info.emoji} **${info.name}** — _Not configured_`;
      const active = isLeagueActive(key);
      return `${info.emoji} **${info.name}** — <#${cfg.channelId}> — every **${cfg.intervalMinutes} min** ${active ? "🟢" : "🔴"}`;
    });

    const anyActive = isAnyLeagueActive();

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(anyActive ? 0x57f287 : 0xed4245)
          .setTitle("📊 Sports Tracker Status")
          .addFields({
            name: `Overall: ${anyActive ? "🟢 Running" : "🔴 Stopped"}`,
            value: allLines.join("\n"),
          })
          .setTimestamp(),
      ],
    });
  }
}
