import { Command, CommandoMessage } from 'discord.js-commando';
import { Message, MessageEmbedOptions, TextChannel, MessageOptions as DiscordMessageOptions, GuildEmoji, MessageEmbed, GuildMember, Role } from 'discord.js';
import { MapsterBot, AdminCommand, RootOwnerCommand } from '../bot';
import * as schedule from 'node-schedule';
import { buildComplexMessage, urlOfMessage } from '../common';
import { MdPayload } from '../util/richmd';
import * as request from 'request-promise-native';

export class AdminConfigGetCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.cfg.get',
            group: 'admin',
            memberName: 'a.cfg.get',
            description: 'Config get',
            args: [
                {
                    key: 'key',
                    type: 'string',
                    prompt: 'key',
                    default: '',
                }
            ],
        });
    }

    public async run(msg: CommandoMessage, args: { key: string }) {
        const settingsContainer = <Map<string,Object>>(<any>this.client.provider).settings;
        const globalSettings = settingsContainer.has('global') ? settingsContainer.get('global') : {};

        if (args.key.length == 0) {
            const values: string[] = [];
            for (const cfgKey of Object.keys(globalSettings)) {
                values.push(cfgKey);
            }
            return msg.reply({
                embed: {
                    title: `- ${values.length}`,
                    description: values.map(v => `\`${v}\``).join('\n'),
                },
            });
            // return msg.code('md', JSON.stringify(globalSettings, null, 4));
        }
        else {
            let orgVal: string | object  = this.client.settings.get(args.key, 'null');

            let val: string;
            if (typeof orgVal === 'string') {
                val = orgVal.replace(/```/gm, '``\\`')
            }
            else {
                val = JSON.stringify(orgVal, null, 4);
            }
            return msg.reply({
                embed: {
                    title: args.key,
                    // description: discord.Util.escapeMarkdown(`${val}`),
                    description: '```\n' + val + '\n```',
                    fields: [{
                        name: 'Type',
                        value: typeof orgVal,
                    }],
                },
            });
        }
    }
}

export class AdminConfigSetCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.cfg.set',
            group: 'admin',
            memberName: 'a.cfg.set',
            description: 'Config set',
            args: [
                {
                    key: 'key',
                    type: 'string',
                    prompt: 'key',
                },
                {
                    key: 'value',
                    type: 'string',
                    prompt: 'value',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: { key: string, value: string }) {
        const settingsContainer = <Map<string,Object>>(<any>this.client.provider).settings;
        const globalSettings = settingsContainer.has('global') ? settingsContainer.get('global') : {};

        const prevValue = this.client.settings.get(args.key, 'null');

        if (args.value === 'null') {
            await this.client.settings.remove(args.key);
        }
        else {
            let parsedValue: string | number | undefined = void 0;
            try {
                parsedValue = JSON.parse(args.value);
            }
            catch (err) {
                parsedValue = args.value;
            }
            if (typeof parsedValue === 'number') {
                parsedValue = args.value;
            }
            else if (typeof parsedValue === 'undefined') {
                return msg.reply(`Failed to parse value.`)
            }
            await this.client.settings.set(args.key, parsedValue);
        }

        return msg.reply(`Config for \`${args.key}\` updated.`)
    }
}

export class AdminSchedulerCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.scheduler',
            group: 'admin',
            memberName: 'a.scheduler',
            description: 'Job scheduler',
            args: [
                {
                    key: 'action',
                    type: 'string',
                    prompt: 'action',
                    default: 'status',
                    label: 'status|reload',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: { action: string }) {
        let response = '';
        if (args.action === 'reload') {
            this.client.reloadJobScheduler();
            response += '*reloaded*\n';
        }
        let i = 1;
        for (const key in schedule.scheduledJobs) {
            if (!schedule.scheduledJobs.hasOwnProperty(key)) continue;
            const job = schedule.scheduledJobs[key];
            response += `[${i}] ${job.name}\n — ${(<any>job.nextInvocation())._date.format()}\n`;
            ++i;
        }
        if (!response) {
            return msg.say('none');
        }
        return msg.reply({
            code: 'js',
            content: response.trim()
        });
    }
}


export class AdminSchedulerInvokeCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.scheduler.invoke',
            group: 'admin',
            memberName: 'a.scheduler.invoke',
            description: 'Job scheduler [invoke]',
            args: [
                {
                    key: 'task',
                    type: 'string',
                    prompt: 'task',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: { task: string }) {
        const job = schedule.scheduledJobs[args.task];
        if (job) {
            (<any>job).invoke(new Date());
            return msg.say('Invoked..');
        }
        else {
            return msg.say('Task not found');
        }
    }
}

interface AdminMessageSendArgs {
    sourceMessage: Message;
    targetChannel: TextChannel;
}

export class AdminMessageSendComplex extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.msg.sendc',
            group: 'admin',
            memberName: 'a.msg.sendc',
            description: 'Send complex message. (Or optionally edit).',
            args: [
                {
                    key: 'sourceMessage',
                    type: 'message',
                    prompt: 'Provide source message ID (must be in the same channel the command is issued in)',
                },
                {
                    key: 'targetChannel',
                    type: 'text-channel',
                    prompt: 'Provide target channel',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: AdminMessageSendArgs) {
        const workingReaction = await msg.react('⏳');

        try {
            const msgDescs: {
                mData: MdPayload;
                content: string;
                embed: MessageEmbed;
            }[] = [];
            if (args.sourceMessage.attachments.size > 0) {
                for (const attachment of args.sourceMessage.attachments.values()) {
                    if (!attachment.name.match(/\.(md|txt)$/)) continue;
                    if (typeof attachment.attachment !== 'string') continue;
                    const allContent = await request.get(attachment.attachment) as string;
                    for (const singleContent of allContent.split(/\n===\n\s*/)) {
                        msgDescs.push(await buildComplexMessage(singleContent));
                    }
                    break;
                }
            }
            if (!msgDescs) {
                msgDescs.push(await buildComplexMessage(args.sourceMessage.content));
            }

            const finalMessages: Message[] = [];

            for (const currMsgDesc of msgDescs) {
                const fMsgOpts: DiscordMessageOptions = {
                    content: currMsgDesc.content,
                    embed: currMsgDesc.embed,
                    split: false,
                };
                const targetMessage = currMsgDesc.mData.meta['message_id'] ? await args.targetChannel.messages.fetch(currMsgDesc.mData.meta['message_id']) : void 0;
                if (targetMessage) {
                    finalMessages.push(await targetMessage.edit(fMsgOpts));
                }
                else {
                    finalMessages.push(await args.targetChannel.send(fMsgOpts) as Message);
                }
            }
            return [] as Message[];
            // return msg.reply(`Done. ${urlOfMessage(finalMessages)}`);
        }
        finally {
            await workingReaction.remove();
        }
    }
}

interface AdminMessageReactionArgs {
    targetChannel: TextChannel;
    targetMessageId: string;
    emoji: string | GuildEmoji;
}

export class AdminMessageReaction extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.msg.react',
            group: 'admin',
            memberName: 'a.msg.react',
            description: 'Add or remove bots reaction from specified message',
            args: [
                {
                    key: 'targetChannel',
                    type: 'text-channel',
                    prompt: 'Provide target channel',
                },
                {
                    key: 'targetMessageId',
                    type: 'string',
                    prompt: 'Provide target message ID',
                },
                {
                    key: 'emoji',
                    type: 'default-emoji|custom-emoji',
                    prompt: 'Provide emoji for the reaction',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: AdminMessageReactionArgs) {
        const targetMessage = await args.targetChannel.messages.fetch(args.targetMessageId)
        const existingReaction = targetMessage.reactions.cache.array()
            .filter(x => x.me)
            .find(x => (
                (typeof args.emoji === 'string' && x.emoji.name === args.emoji) ||
                (typeof args.emoji !== 'string' && x.emoji.id === args.emoji.id)
            ))
        ;
        if (existingReaction) {
            await existingReaction.users.remove(this.client.user);
            return msg.reply(`Removed reaction`);
        }
        else {
            await targetMessage.react(args.emoji);
            return msg.reply(`Added reaction`);
        }
    }
}

interface AdminRoleGiveTakeArgs {
    member: GuildMember;
    role: Role;
    give: boolean;
}

export class AdminRoleGiveTake extends RootOwnerCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.role',
            group: 'admin',
            memberName: 'a.role',
            description: '',
            args: [
                {
                    key: 'member',
                    type: 'member',
                    prompt: 'Provide member',
                },
                {
                    key: 'role',
                    type: 'role',
                    prompt: 'Provide role',
                },
                {
                    key: 'give',
                    type: 'boolean',
                    prompt: 'Choose: Give = `yes` | Take away = `no`',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: AdminRoleGiveTakeArgs) {
        if (!(msg.channel instanceof TextChannel)) return;
        if (args.give) {
            await args.member.roles.add(args.role);
        }
        else {
            await args.member.roles.remove(args.role);
        }
        return msg.reply('done');
    }
}

