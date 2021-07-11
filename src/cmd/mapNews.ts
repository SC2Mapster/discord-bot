import * as schedule from 'node-schedule';
import { CommandoMessage } from 'discord.js-commando';
import { MapsterBot, AdminCommand, ModCommand, MapsterCommand, logger } from '../bot';
import { Message, MessageEmbed, GuildMember, TextChannel, User, Channel, DiscordAPIError, PartialMessage } from 'discord.js';
import { sleep } from '../util/helpers';
import { buildComplexMessage, urlOfMessage } from '../common';

interface DraftMessage {
    userMsg: Message;
    botMsg: Message;
}

interface DrafPreparationRequest {
    channel: TextChannel;
    user: User;
    reqDate: Date;
}

export class MapNewsPostPreview extends MapsterCommand {
    protected prepRequests = new Map<string, DrafPreparationRequest>();
    protected draftMessages = new Map<string, DraftMessage>();

    constructor(client: MapsterBot) {
        super(client, {
            name: 'mn.draft',
            group: 'general',
            memberName: 'mn.draft',
            description: '',
            guildOnly: true,
            argsPromptLimit: 0,
            argsCount: 0,
            args: [
                {
                    key: 'usersMessage',
                    type: 'message',
                    prompt: '',
                    default: 0,
                },
                {
                    key: 'botsMessage',
                    type: 'message',
                    prompt: '',
                    default: 0,
                },
            ],
        });

        this.client.on('channelCreate', this.onChannelCreate.bind(this));
        this.client.on('messageUpdate', this.onMessageUpdate.bind(this));
        this.client.on('message', this.onMessage.bind(this));

        schedule.scheduleJob(`${this.constructor.name}_reminder`, '0 * * * *', this.reminder.bind(this));
    }

    protected async setupChannelListenerForUser(channel: TextChannel, user: User) {
        this.prepRequests.set(user.id, {
            channel: channel,
            user: user,
            reqDate: new Date(),
        });
    }

    protected async reminder() {
        for (const chan of this.client.channels.cache.values()) {
            if (!(chan instanceof TextChannel)) continue;
            if (!chan.parent || chan.parent.name !== 'Tickets') continue;
            if (!chan.name.match(/^(\d+)-?(.*)-news$/u)) continue;

            let lastMsg: Message;

            // fetch last message
            // lastMessageID prop on a channel might get deleted, so we fetch something around it and work from there
            const aroundMsg = (await chan.messages.fetch({ around: chan.lastMessageID, limit: 1 })).first();
            if (aroundMsg.id === chan.lastMessageID) {
                lastMsg = aroundMsg;
            }
            else {
                const afterMsgs = (await chan.messages.fetch({ after: aroundMsg.id, limit: 100 })).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                lastMsg = afterMsgs.size > 0 ? afterMsgs.last() : aroundMsg
            }

            if (!lastMsg) {
                logger.warn(`wtf, couldn't obtain lastMsg - empty channel??`);
                continue;
            }

            // check timestamp of most recent msg - 5d
            const diff = Date.now() - lastMsg.createdTimestamp;
            if (diff / (1000 * 3600 * 24) < 5) continue;

            // fetch first msg
            const beforeMsgs = (await chan.messages.fetch({ before: aroundMsg.id, limit: 100 })).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            const firstMsg = beforeMsgs.first();
            if (firstMsg.author.id !== this.client.user.id) continue;
            const ticketer = firstMsg.mentions.users.first();

            // send reminder
            await chan.send({
                content: `<@${ticketer.id}> Detected lack of activity. If conditions won't change, this ticket will be automatically closed after 72h.`,
            });
        }
    }

    protected async onChannelCreate(channel: Channel) {
        if (channel.type !== 'text') return;
        const textChan = channel as TextChannel;

        // if not ticket
        if (textChan.parent.name !== 'Tickets') return;

        // if not news ticket
        const nameMatches = textChan.name.match(/^(\d+)-news-?(.*)$/u);
        if (!nameMatches) return;

        for (let i = 0; i < 100; i++) {
            await sleep(100);
            const firstMsg = textChan.lastMessage;
            if (!firstMsg) continue;
            if (!firstMsg.author.bot) return;

            const fullContent = [firstMsg.content].concat(firstMsg.embeds.map(x => x.description)).join('\n\n');

            const mentionedUserId = fullContent.match(/<@(\d+)>/m)[1];
            const mentionedUser = (await textChan.guild.members.fetch(mentionedUserId)).user;
            await firstMsg.delete();

            await textChan.updateOverwrite(mentionedUser, {
                EMBED_LINKS: false,
            });

            const defaultTpl = [
                `Before we get started, here are some generic commands specific to this channel.\n\n`,
                `Command to close the ticket:\n`,
                '`!ticket close`, or `!ticket close reason for closing here`\n\n',
                'Command to add another user to the ticket:\n',
                '`!ticket adduser @user`\n\n',
                'Command to start a new draft for the post:\n',
                '`!mn.draft`'
            ].join('');
            const lmsg = await textChan.send(`<@${mentionedUser.id}>,\n\n${this.client.settings.get('mn.welcome-msg', defaultTpl)}`) as Message;
            await lmsg.pin();
            await textChan.send(this.client.settings.get('mn.template-msg', 'Provide content for your post.'));
            await this.setupChannelListenerForUser(textChan, mentionedUser);

            await textChan.setName(`${nameMatches[1]}-${mentionedUser.username}-news`);

            return;
        }

        logger.error('mapnews onChannelCreate timeout');
    }

    protected async onMessage(msg: Message) {
        const prepReq = this.prepRequests.get(msg.author.id);
        if (!prepReq || prepReq.channel.id !== msg.channel.id) return;
        if (new Date(msg.createdTimestamp).getTime() < prepReq.reqDate.getTime()) return;

        this.prepRequests.delete(msg.author.id);

        let botMsg: Message;
        try {
            const minfo = await buildComplexMessage(msg.content, msg.member);
            botMsg = await msg.channel.send(minfo.content, minfo.embed) as Message;
        }
        catch (e) {
            let err = e as Error;
            logger.error(`${err.name}: ${err.message}`, err);
            botMsg = await msg.channel.send(`${err.name}: ${err.message}`) as Message;
        }
        // await botMsg.pin();

        const targetChannel = (await this.client.user.client.channels.fetch(this.client.settings.get('mn.channel', null)));
        if (!(targetChannel instanceof TextChannel)) throw new Error('mn.channel not text');
        if (targetChannel) {
            await msg.channel.send(`||\`!mn.post ${msg.id} #${targetChannel.name}\`||`);
        }

        this.draftMessages.set(msg.id, {
            userMsg: msg,
            botMsg: botMsg,
        });
    }

    protected async onMessageUpdate(oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) {
        const draftMsg = this.draftMessages.get(newMsg.id);
        if (!draftMsg) return;
        try {
            const minfo = await buildComplexMessage(newMsg.content, newMsg.member);
            draftMsg.botMsg = await draftMsg.botMsg.edit(minfo.content, minfo.embed);
        }
        catch (e) {
            let err = e as Error;
            logger.error(`${err.name}: ${err.message}`, err);
            if (err instanceof DiscordAPIError) {
                draftMsg.botMsg = await draftMsg.botMsg.edit(`${err.name}: ${err.message}`);
            }
            else {
                draftMsg.botMsg = await draftMsg.botMsg.edit(`Internal error: ${err.name}`);
            }
        }
    }

    public async run(msg: CommandoMessage, args: { usersMessage: Message, botsMessage: Message }) {
        if (args.usersMessage && args.botsMessage) {
            if (msg.member.permissions.has('MANAGE_MESSAGES') && args.botsMessage.editable) {
                this.draftMessages.set(args.usersMessage.id, {
                    userMsg: args.usersMessage,
                    botMsg: args.botsMessage,
                });
                await this.onMessageUpdate(args.usersMessage, args.usersMessage);
            }
        }
        else {
            await this.setupChannelListenerForUser(msg.channel as TextChannel, msg.author);
        }
        await msg.react('✔');
        return [] as Message[];
    }
}

interface MapNewsPostArgs {
    sourceMessage: Message;
    targetChannel?: TextChannel;
    targetMessage?: string;
    author?: GuildMember;
}

export class MapNewsPostCommand extends ModCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'mn.post',
            group: 'mod',
            memberName: 'mn.post',
            description: 'Post the news-message on specified channel.',
            guildOnly: true,
            args: [
                {
                    key: 'sourceMessage',
                    type: 'message',
                    prompt: 'Provide source message ID',
                },
                {
                    key: 'targetChannel',
                    type: 'channel',
                    prompt: 'Provide target channel',
                    default: '',
                },
                {
                    key: 'targetMessage',
                    type: 'string',
                    prompt: 'Provide target message ID',
                    default: '',
                },
                {
                    key: 'author',
                    type: 'member',
                    prompt: 'Provide author',
                    default: '',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: MapNewsPostArgs) {
        const author = args.author ? args.author : args.sourceMessage.member;
        const targetChannel = args.targetChannel ? args.targetChannel : this.client.getChannel(msg.channel.id);
        const targetMessage = args.targetMessage ? await targetChannel.messages.fetch(args.targetMessage) : void 0;

        const minfo = await buildComplexMessage(args.sourceMessage.content, author);
        let finalMessage: Message;
        if (targetMessage) {
            finalMessage = await targetMessage.edit(`<@${author.id}> ` + minfo.content, minfo.embed);
            return msg.reply(`Done. ${urlOfMessage(finalMessage)}`);
        }
        else {
            finalMessage = await targetChannel.send(`<@${author.id}> ` + minfo.content, minfo.embed) as Message;
            await finalMessage.react('⭐');
            await msg.channel.send(
                `<@${author.id}> Your post has been approved. You may now close the ticket by using command \`/tickets close\`.`,
            );
        }

        return [] as Message[];
    }
}
