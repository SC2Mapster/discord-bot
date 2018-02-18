import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import { Message, ReactionEmoji } from 'discord.js';
import { oneLine, stripIndents } from 'common-tags';
import { MapsterCommand, MapsterBot } from '../bot';

function disambiguation(items: any, label: any, property = 'name') {
	const itemList = items.map((item: any) => `"${(property ? item[property] : item).replace(/ /g, '\xa0')}"`).join(',   ');
	return `Multiple ${label} found, please be more specific: ${itemList}`;
}

export type HelpArgs = {
    command?: string;
};

export default class HelpCommand extends MapsterCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'help',
            group: 'general',
            memberName: 'help',
            description: 'Displays a list of available commands, or detailed information for a specified command.',
            details: oneLine`
                The command may be part of a command name or a whole command name.
                If it isn't specified, all available commands will be listed.
            `,
            examples: ['help', 'help prefix'],
            guarded: true,

            args: [
                {
                    key: 'command',
                    prompt: 'Which command would you like to view the help for?',
                    type: 'string',
                    default: ''
                }
            ]
        });
    }

    public async run(msg: CommandMessage, args: HelpArgs): Promise<Message | Message[]> {
        const groups = this.client.registry.groups;
        const commands = this.client.registry.findCommands(args.command, false, msg.message);
        const showAll = args.command && args.command.toLowerCase() === 'all';
        const messages: Message[] = [];

        if (args.command && !showAll) {
            if (commands.length === 1) {
                let help = stripIndents`
                    ${oneLine`
                        __Command **${commands[0].name}**:__ ${commands[0].description}
                        ${commands[0].guildOnly ? ' (Usable only in servers)' : ''}
                    `}

                    **Format:** ${msg.anyUsage(`${commands[0].name}${commands[0].format ? ` ${commands[0].format}` : ''}`)}
                `;
                if(commands[0].aliases.length > 0) help += `\n**Aliases:** ${commands[0].aliases.join(', ')}`;
                help += `\n${oneLine`
                    **Group:** ${commands[0].group.name}
                    (\`${commands[0].groupID}:${commands[0].memberName}\`)
                `}`;
                if(commands[0].details) help += `\n**Details:** ${commands[0].details}`;
                if(commands[0].examples) help += `\n**Examples:**\n${commands[0].examples.join('\n')}`;
                messages.push(<Message>await msg.direct(help));
            } else if (commands.length > 1) {
                messages.push(<Message>await msg.direct(disambiguation(commands, 'commands')));
            } else {
                messages.push(<Message>await msg.direct(`Unable to identify command.`));
            }
        }
        else {
            messages.push(<Message>await msg.direct(stripIndents`
                To run a command in this DM, simply use ${Command.usage('command', null, null)} with no prefix.

                Use ${this.usage('<command>', null, null)} to view detailed information about a specific command.

                **${showAll ? 'All commands' : `Available commands in __${msg.guild || 'this DM'}__`}**

                ${(showAll ? groups : groups.filter(grp => grp.commands.some(cmd => cmd.isUsable(msg.message))))
                    .map(grp => stripIndents`
                        __${grp.name}__
                        ${(showAll ? grp.commands : grp.commands.filter(cmd => cmd.isUsable(msg.message)))
                            .map(cmd => `**${cmd.name}:** ${cmd.description}`).join('\n')
                        }
                    `).join('\n\n')
                }

                *Bot is open source and available on (https://github.com/SC2Mapster/discord-bot)*
            `, { split: true }));
        }

        try {
            if (msg.channel.type !== 'dm') {
                // messages.push(<Message>await msg.reply('Sent you a DM with information.'));
                await msg.react('✔');
                if (msg.deletable) {
                    await msg.delete(4000);
                }
            }
        } catch(err) {
            // messages.push(<Message>await msg.reply('Unable to send you the help DM. You probably have DMs disabled.'));
            throw err;
        }

        return messages;
    }
}
