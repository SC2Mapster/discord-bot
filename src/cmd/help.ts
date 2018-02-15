import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import { Message } from 'discord.js';
import { oneLine, stripIndents } from 'common-tags';

function disambiguation(items: any, label: any, property = 'name') {
	const itemList = items.map((item: any) => `"${(property ? item[property] : item).replace(/ /g, '\xa0')}"`).join(',   ');
	return `Multiple ${label} found, please be more specific: ${itemList}`;
}

export type HelpArgs = {
    command?: string;
};

export default class HelpCommand extends Command {
    constructor(client: CommandoClient) {
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
        if(args.command && !showAll) {
            if(commands.length === 1) {
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

                const messages: Message[] = [];
                try {
                    messages.push(<Message>await msg.direct(help));
                    if(msg.channel.type !== 'dm') messages.push(<Message>await msg.reply('Sent you a DM with information.'));
                } catch(err) {
                    messages.push(<Message>await msg.reply('Unable to send you the help DM. You probably have DMs disabled.'));
                }
                return messages;
            } else if(commands.length > 1) {
                return msg.reply(disambiguation(commands, 'commands'));
            } else {
                return msg.reply(
                    `Unable to identify command. Use ${msg.usage(
                        null, msg.channel.type === 'dm' ? null : undefined, msg.channel.type === 'dm' ? null : undefined
                    )} to view the list of all commands.`
                );
            }
        } else {
            const messages: Message[] = [];
            try {
                messages.push(<Message>await msg.direct(stripIndents`
                    ${oneLine`
                        To run a command in ${msg.guild || 'any server'},
                        use ${Command.usage('command', msg.guild ? this.client.commandPrefix : null, this.client.user)}.
                        For example, ${Command.usage('prefix', msg.guild ? this.client.commandPrefix : null, this.client.user)}.
                    `}
                    To run a command in this DM, simply use ${Command.usage('command', null, null)} with no prefix.

                    Use ${this.usage('<command>', null, null)} to view detailed information about a specific command.
                    Use ${this.usage('all', null, null)} to view a list of *all* commands, not just available ones.

                    __**${showAll ? 'All commands' : `Available commands in ${msg.guild || 'this DM'}`}**__

                    ${(showAll ? groups : groups.filter(grp => grp.commands.some(cmd => cmd.isUsable(msg.message))))
                        .map(grp => stripIndents`
                            __${grp.name}__
                            ${(showAll ? grp.commands : grp.commands.filter(cmd => cmd.isUsable(msg.message)))
                                .map(cmd => `**${cmd.name}:** ${cmd.description}`).join('\n')
                            }
                        `).join('\n\n')
                    }

                    <https://github.com/SC2Mapster/discord-bot>
                `, { split: true }));
                if(msg.channel.type !== 'dm') messages.push(<Message>await msg.reply('Sent you a DM with information.'));
            } catch(err) {
                messages.push(<Message>await msg.reply('Unable to send you the help DM. You probably have DMs disabled.'));
            }
            return messages;
        }
    }
}
