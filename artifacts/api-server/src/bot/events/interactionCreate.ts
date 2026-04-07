import { Interaction, ChatInputCommandInteraction } from "discord.js";
import { logger } from "../../lib/logger.js";
import * as ping from "../commands/ping.js";
import * as moderation from "../commands/moderation.js";
import * as setchannel from "../commands/setchannel.js";
import * as announce from "../commands/announce.js";
import * as setrules from "../commands/setrules.js";
import * as memespam from "../commands/memespam.js";
import * as sports from "../commands/sports.js";

const commands: Record<
  string,
  { execute: (interaction: ChatInputCommandInteraction) => Promise<void> }
> = {
  ping,
  mod: moderation,
  setchannel,
  announce,
  setrules,
  memespam,
  sports,
};

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = commands[interaction.commandName];
  if (!command) {
    logger.warn({ commandName: interaction.commandName }, "Unknown command");
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error({ err, commandName: interaction.commandName }, "Error executing command");
    const msg = { content: "An error occurred while running this command.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => null);
    } else {
      await interaction.reply(msg).catch(() => null);
    }
  }
}
