import { CommandMessage } from 'discord.js-commando';
import { MapsterBot, AdminCommand, ModCommand, MapsterCommand } from '../bot';
import { Message, RichEmbed, GuildMember, TextChannel, User, Channel } from 'discord.js';
import { parseMdPayload } from '../util/richmd';
import { sleep } from '../util/helpers';

interface DraftMessage {
    userMsg: Message;
    botMsg: Message;
}

interface DrafPreparationRequest {
    channel: TextChannel;
    user: User;
    reqDate: Date;
}

function fixIUrl(s: string) {
    s = s.replace(/^<?(.*)>?$/, '$1');
    s = s.replace(/^(https?:\/\/)(imgur.com\/)(\w+)$/i, '$1i.$2$3.jpg');
    return s;
}

function createNewsEmbed(content: string, author: User) {
    const mData = parseMdPayload(content);

    const embed = new RichEmbed({
        author: {
            name: `${author.tag}`,
            icon_url: author.displayAvatarURL,
        },
        footer: {},
    });

    if (mData.fields.length) {
        embed.title = mData.fields[0].title;
        embed.description = mData.fields[0].content;

        mData.fields = mData.fields.slice(1);
        for (const field of mData.fields) {
            embed.addField(field.title, field.content || '');
        }
    }

    if (mData.meta['image']) embed.setImage(fixIUrl(mData.meta['image']));
    if (mData.meta['icon']) embed.setThumbnail(fixIUrl(mData.meta['icon']));
    if (mData.meta['url']) embed.setURL(mData.meta['url']);
    if (mData.meta['footer_text']) embed.footer.text = mData.meta['footer_text'];
    if (mData.meta['footer_icon']) embed.footer.icon_url = fixIUrl(mData.meta['footer_icon']);
    if (mData.meta['color']) embed.setColor(parseInt(mData.meta['color'], 16));

    return embed;
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
        });

        this.client.on('channelCreate', this.onChannelCreate.bind(this));
        this.client.on('messageUpdate', this.onMessageUpdate.bind(this));
        this.client.on('message', this.onMessage.bind(this));
    }

    protected async setupChannelForUser(channel: TextChannel, user: User) {
        await channel.sendMessage(`<@${user.id}>,\n\n${this.client.settings.get('mn.welcome-msg', 'Provide content for your post.')}`);
        this.prepRequests.set(user.id, {
            channel: channel,
            user: user,
            reqDate: new Date(),
        });
    }

    protected async onChannelCreate(channel: Channel) {
        if (channel.type !== 'text') return;
        const textChan = channel as TextChannel;

        for (let i = 0; i < 100; i++) {
            await sleep(100);
            const firstMsg = textChan.lastMessage;
            if (!firstMsg) continue;
            if (!firstMsg.author.bot || !firstMsg.embeds.length) break;

            // if not ticket
            if (textChan.parent.name !== 'Tickets') break;
            const botsRole = textChan.guild.roles.get('373924172847382539');
            await textChan.overwritePermissions(botsRole, {
                MANAGE_CHANNELS: true,
                MANAGE_ROLES_OR_PERMISSIONS: true,
            });

            // if not news ticket
            if (!textChan.name.match(/^\d+-news(\-)?(.+)?$/)) break;

            const everyoneRole = textChan.guild.roles.get('271701880885870594');
            await textChan.overwritePermissions(everyoneRole, {
                SEND_MESSAGES: false,
                READ_MESSAGES: false,
                ATTACH_FILES: false,
            });

            const mentionedUserId = firstMsg.embeds[0].description.match(/^Welcome <@(\d+)>/)[1];
            const mentionedUser = (await textChan.guild.fetchMember(mentionedUserId)).user;
            await firstMsg.delete();
            await this.setupChannelForUser(textChan, mentionedUser);
            break;
        }
    }

    protected async onMessage(msg: Message) {
        const prepReq = this.prepRequests.get(msg.author.id);
        if (!prepReq || prepReq.channel.id !== msg.channel.id) return;
        this.prepRequests.delete(msg.author.id);

        const botMsg = await msg.channel.send(createNewsEmbed(msg.content, msg.author)) as Message;
        this.draftMessages.set(msg.id, {
            userMsg: msg,
            botMsg: botMsg,
        });
    }

    protected async onMessageUpdate(oldMsg: Message, newMsg: Message) {
        const draftMsg = this.draftMessages.get(oldMsg.id);
        if (!draftMsg) return;
        draftMsg.botMsg = await draftMsg.botMsg.edit(createNewsEmbed(newMsg.content, newMsg.author));
    }

    public async run(msg: CommandMessage) {
        this.setupChannelForUser(msg.channel as TextChannel, msg.author);
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

    public async run(msg: CommandMessage, args: MapNewsPostArgs) {
        const author = args.author ? args.author.user : args.sourceMessage.author;
        const targetChannel = args.targetChannel ? args.targetChannel : this.client.getChannel(msg.channel.id);
        const targetMessage = args.targetMessage ? await targetChannel.fetchMessage(args.targetMessage) : void 0;

        const embed = createNewsEmbed(args.sourceMessage.content, author);
        let finalMessage: Message;
        if (targetMessage) {
            finalMessage = await targetMessage.edit(`<@${author.id}>`, embed);
        }
        else {
            finalMessage = await targetChannel.send(`<@${author.id}>`, embed) as Message;
        }

        return msg.reply(`Done. MsgID: ${finalMessage.id}`);
    }
}
