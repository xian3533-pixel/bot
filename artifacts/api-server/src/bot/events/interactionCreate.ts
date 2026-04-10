import { Interaction, ChatInputCommandInteraction } from "discord.js";
import { logger } from "../../lib/logger.js";
import * as ping from "../commands/ping.js";
import * as moderation from "../commands/moderation.js";
import * as setchannel from "../commands/setchannel.js";
import * as announce from "../commands/announce.js";
import * as setrules from "../commands/setrules.js";
import * as memespam from "../commands/memespam.js";
import * as sports from "../commands/sports.js";
import * as giveaway from "../commands/giveaway.js";
import * as ticket from "../commands/ticket.js";
import { handleTicketCreate, handleTicketClose } from "../ticketHandler.js";

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
  giveaway,
  ticket,
};

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // Slash commands
  if (interaction.isChatInputCommand()) {
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
    return;
  }

  // Select menu interactions
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_create") {
      await handleTicketCreate(interaction).catch((err: unknown) => {
        logger.error({ err }, "Error handling ticket create");
      });
    }
    return;
  }

  // Button interactions
  if (interaction.isButton()) {
    if (interaction.customId === "ticket_close") {
      await handleTicketClose(interaction).catch((err: unknown) => {
        logger.error({ err }, "Error handling ticket close");
      });
    }
    return;
  }
}
