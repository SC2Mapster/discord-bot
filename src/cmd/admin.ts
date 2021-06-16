import { Command, CommandoMessage } from 'discord.js-commando';
import { Message, MessageEmbedOptions, TextChannel, MessageOptions as DiscordMessageOptions, GuildEmoji, MessageEmbed, GuildMember, Role, DMChannel, NewsChannel, GuildChannel } from 'discord.js';
import { MapsterBot, AdminCommand, RootOwnerCommand } from '../bot';
import * as schedule from 'node-schedule';
import { buildComplexMessage, urlOfMessage } from '../common';
import { MdPayload, MdFrontmatter, parseFrontmatter } from '../util/richmd';
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
    targetChannel: DMChannel | TextChannel | NewsChannel;
    sourceMessage: Message | string;
}

export class AdminMessageSendComplex extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.msg.sendc',
            group: 'admin',
            memberName: 'a.msg.sendc',
            description: 'Send complex message. (Or optionally edit).',
            argsPromptLimit: 0,
            args: [
                {
                    key: 'targetChannel',
                    type: 'text-channel',
                    prompt: 'Provide target channel',
                },
                {
                    key: 'sourceMessage',
                    type: 'message',
                    prompt: 'Provide source message ID (must be in the same channel the command is issued in)',
                    default: '',
                },
            ],
        });

        this.client.on('message', async (msg) => {
            if (msg.attachments.size <= 0) return;
            if (!this.hasPermission(msg as CommandoMessage)) return;

            for (const attachment of msg.attachments.values()) {
                const m = attachment.name.match(/^(?:botmsg(?:-[^\.\-]+)?\.([\w\d\-]+)).md$/)
                if (!m) continue;
                let targetChannel: DMChannel | TextChannel | NewsChannel;
                if (m[1].match(/^\d{16,}$/)) {
                    const tmp = this.client.channels.cache.get(m[1]);
                    if (!tmp.isText()) continue;
                    targetChannel = tmp;
                }
                else {
                    if (!(msg.channel instanceof GuildChannel)) return;
                    targetChannel = msg.channel.guild.channels.cache.find(x => {
                        if (!x.isText()) return false;
                        return x.name === m[1];
                    }) as typeof targetChannel;
                }

                if (!targetChannel) {
                    msg.reply(`target channel \`${m[1]}\` not found`);
                }
                else {
                    await this.run(msg as CommandoMessage, { targetChannel: targetChannel, sourceMessage: '' }, true);
                }
            }
        });
    }

    public async run(msg: CommandoMessage, args: AdminMessageSendArgs, fromPattern: boolean) {
        const workingReaction = msg.react('⏳');

        try {
            let frontmatter: MdFrontmatter;
            const msgDescs: {
                mData: MdPayload;
                content: string;
                embed: MessageEmbed;
            }[] = [];
            for (const attachment of (typeof args.sourceMessage !== 'string' ? args.sourceMessage : msg).attachments.values()) {
                if (!attachment.name.match(/\.(md|txt)$/)) continue;
                if (typeof attachment.attachment !== 'string') continue;
                const allContent = await request.get(attachment.attachment) as string;
                const tmp = parseFrontmatter(allContent);
                frontmatter = tmp.meta;
                if (tmp.meta['multiple']) {
                    for (const singleContent of tmp.content.split(/\n===\n\s*/)) {
                        msgDescs.push(await buildComplexMessage(singleContent, void 0, true));
                    }
                }
                else {
                    msgDescs.push(await buildComplexMessage(tmp.content, void 0, true));
                }
                break;
            }
            if (!msgDescs.length) {
                if (typeof args.sourceMessage !== 'string') {
                    msgDescs.push(await buildComplexMessage(args.sourceMessage.content, void 0, true));
                }
                else {
                    return msg.reply('invalid args');
                }
            }

            const strictOrder = Boolean(Number(frontmatter['strict_order']));
            if (strictOrder) {
                const existingMessages = (await args.targetChannel.messages.fetch({ after: args.targetChannel.id, limit: msgDescs.length + 1 }))
                    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
                    .array()
                ;
                if (existingMessages.length > msgDescs.length) {
                    return msg.reply(`there's more messages posted in the channel than provided in the payload - cannot proceed due to strict ordering`);
                }
                for (const [i, currMsgDesc] of msgDescs.entries()) {
                    if (currMsgDesc.mData.meta['message_id']) {
                        return msg.reply('encountered explicit `message_id` - not expected when strict ordering is enabled');
                    }
                    if (existingMessages.length <= i) continue;
                    const currMsg = existingMessages[i];
                    if (!currMsg.editable) {
                        return msg.reply(`message ${urlOfMessage(currMsg)} is not editable`);
                    }
                    currMsgDesc.mData.meta['message_id'] = currMsg.id;
                }
            }

            const finalMessages: Promise<Message>[] = [];
            let hasEdits = false;
            let hasPublishes = false;
            for (const currMsgDesc of msgDescs) {
                if (currMsgDesc.mData.meta['message_id']) {
                    if (hasPublishes) {
                        return msg.reply('order of messages impossible to maintain without deleting/overwriting exing ones');
                    }
                    hasEdits = true;
                }
                else {
                    hasPublishes = true;
                }
            }

            for (const currMsgDesc of msgDescs) {
                const fMsgOpts: DiscordMessageOptions = {
                    content: currMsgDesc.content,
                    embed: currMsgDesc.embed,
                    split: false,
                };
                if (currMsgDesc.mData.meta['message_id']) {
                    let targetMessage = args.targetChannel.messages.cache.get(currMsgDesc.mData.meta['message_id']);
                    if (targetMessage) {
                        if (
                            (targetMessage.content === fMsgOpts.content) &&
                            (
                                (
                                    currMsgDesc.embed &&
                                    targetMessage.embeds.length === 1 &&
                                    JSON.stringify(targetMessage.embeds[0].toJSON()) === JSON.stringify(currMsgDesc.embed.toJSON())
                                ) ||
                                (!currMsgDesc.embed && targetMessage.embeds.length === 0)
                            )
                        ) {
                            finalMessages.push((async () => targetMessage)());
                            continue;
                        }
                    }
                    else {
                        targetMessage = (new Message(this.client, {
                            id: String(currMsgDesc.mData.meta['message_id']),
                        }, args.targetChannel));
                    }
                    finalMessages.push(targetMessage.edit(fMsgOpts));
                }
                else {
                    const tmp = (await args.targetChannel.send(fMsgOpts)) as Message;
                    finalMessages.push((async () => tmp)());
                }
            }

            for (const [i, cMsg] of (await Promise.all(finalMessages)).entries()) {
                if (typeof msgDescs[i].mData.meta['reactions'] === 'undefined') continue;
                // await Promise.all(cMsg.reactions.cache.filter(x => !x.me).map(x => x.remove()));

                const wantedReactions = new Set(
                    msgDescs[i].mData.meta['reactions'].split(' ').filter(x => x.length).map(x => {
                        if (x.startsWith('%')) {
                            return unescape(x);
                        }
                        return x;
                    })
                );
                const myReactions = cMsg.reactions.cache.array().filter(x => x.me);
                for (const currMyReaction of myReactions) {
                    if (!wantedReactions.has(currMyReaction.emoji.name) && !wantedReactions.has(currMyReaction.emoji.id)) {
                        await currMyReaction.users.remove(this.client.user.id);
                    }
                    else {
                        wantedReactions.delete(currMyReaction.emoji.name);
                        wantedReactions.delete(currMyReaction.emoji.id);
                    }
                }
                if (wantedReactions.size > 0) {
                    await Promise.all(Array.from(wantedReactions).map(x => cMsg.react(x)))
                }
            }

            await msg.react('✅');
            return [] as Message[];
        }
        finally {
            await (await workingReaction).remove();
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

