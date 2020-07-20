import { CommandMessage } from 'discord.js-commando';
import { MapsterBot, AdminCommand, ModCommand, MapsterCommand, logger } from '../bot';
import { Message, RichEmbed, GuildMember, TextChannel, User, Channel, DiscordAPIError } from 'discord.js';
import { parseMdPayload } from '../util/richmd';
import { sleep, urlOfMessage } from '../util/helpers';
import { imgurAlbumDirectLink } from '../util/imgurExtra';

interface DraftMessage {
    userMsg: Message;
    botMsg: Message;
}

interface DrafPreparationRequest {
    channel: TextChannel;
    user: User;
    reqDate: Date;
}

async function fixIUrl(s: string) {
    s = s.replace(/^<?(.*)>?$/, '$1');
    s = s.replace(/^(https?:\/\/)(imgur.com\/)(\w+)$/i, '$1i.$2$3.jpg');
    const match = s.match(/^(https?:\/\/)(imgur.com\/a\/)(\w+)$/i)
    if (match) {
        s = await imgurAlbumDirectLink(s);
    }
    return s;
}

async function createNewsEmbed(input: string, author: GuildMember) {
    const mData = parseMdPayload(input);

    const embed = new RichEmbed({
        author: {
            name: `${author.displayName}`,
            icon_url: author.user.displayAvatarURL,
        },
        footer: {},
    });
    let content = '';

    if (mData.fields.length) {
        embed.title = mData.fields[0].title;
        embed.description = mData.fields[0]?.content ?? ' ';

        mData.fields = mData.fields.slice(1);
        for (const field of mData.fields) {
            embed.addField(field.title, field?.content ?? ' ');
        }
    }

    if (mData.meta['image']) embed.setImage(await fixIUrl(mData.meta['image']));
    if (mData.meta['icon']) embed.setThumbnail(await fixIUrl(mData.meta['icon']));
    if (mData.meta['url']) embed.setURL(mData.meta['url']);
    if (mData.meta['footer_text']) embed.footer.text = mData.meta['footer_text'];
    if (mData.meta['footer_icon']) embed.footer.icon_url = await fixIUrl(mData.meta['footer_icon']);
    if (mData.meta['color']) embed.setColor(parseInt(mData.meta['color'], 16));

    if (mData.meta['discord']) {
        content += `${mData.meta['discord']}`;
    }

    return {
        mData,
        content,
        embed,
    };
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

    protected async setupChannelListenerForUser(channel: TextChannel, user: User) {
        await channel.send(this.client.settings.get('mn.template-msg', 'Provide content for your post.'));
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
            if (!firstMsg.author.bot || !firstMsg.embeds.length) return;

            // if not ticket
            if (textChan.parent.name !== 'Tickets') return;

            const botsRole = textChan.guild.roles.get('373924172847382539');
            if (botsRole) {
                await textChan.overwritePermissions(botsRole, {
                    MANAGE_CHANNELS: true,
                    MANAGE_ROLES_OR_PERMISSIONS: true,
                });
            }

            // if not news ticket
            const nameMatches = textChan.name.match(/^(\d+)-news-?(.*)$/u);
            if (!nameMatches) return;

            const mentionedUserId = firstMsg.embeds[0].description.match(/^Welcome <@(\d+)>/)[1];
            const mentionedUser = (await textChan.guild.fetchMember(mentionedUserId)).user;
            await firstMsg.delete();

            await textChan.overwritePermissions(mentionedUser, {
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
            await this.setupChannelListenerForUser(textChan, mentionedUser);

            await textChan.setName(`${nameMatches[1]}-news-${nameMatches[2] ?? ''}-${mentionedUser.username}`);

            return;
        }

        logger.error('mapnews onChannelCreate timeout');
    }

    protected async onMessage(msg: Message) {
        const prepReq = this.prepRequests.get(msg.author.id);
        if (!prepReq || prepReq.channel.id !== msg.channel.id) return;
        this.prepRequests.delete(msg.author.id);

        let botMsg: Message;
        try {
            const minfo = await createNewsEmbed(msg.content, msg.member);
            botMsg = await msg.channel.send(minfo.content, minfo.embed) as Message;
        }
        catch (e) {
            let err = e as Error;
            logger.error(`${err.name}: ${err.message}`, err);
            if (err instanceof DiscordAPIError) {
                botMsg = await msg.channel.send(`${err.name}: ${err.message}`) as Message;
            }
            else {
                botMsg = await msg.channel.send(`Internal error: ${err.name}`) as Message;
            }
        }
        // await botMsg.pin();

        const targetChannel = <TextChannel>this.client.user.client.channels.get(this.client.settings.get('mn.channel', null));
        if (targetChannel) {
            await msg.channel.send(`|| Notice for moderators: \`!mn.post ${msg.id} #${targetChannel.name}\` ||`);
        }

        this.draftMessages.set(msg.id, {
            userMsg: msg,
            botMsg: botMsg,
        });
    }

    protected async onMessageUpdate(oldMsg: Message, newMsg: Message) {
        const draftMsg = this.draftMessages.get(oldMsg.id);
        if (!draftMsg) return;
        try {
            const minfo = await createNewsEmbed(newMsg.content, newMsg.member);
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

    public async run(msg: CommandMessage) {
        this.setupChannelListenerForUser(msg.channel as TextChannel, msg.author);
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
        const author = args.author ? args.author : args.sourceMessage.member;
        const targetChannel = args.targetChannel ? args.targetChannel : this.client.getChannel(msg.channel.id);
        const targetMessage = args.targetMessage ? await targetChannel.fetchMessage(args.targetMessage) : void 0;

        const minfo = await createNewsEmbed(args.sourceMessage.content, author);
        let finalMessage: Message;
        if (targetMessage) {
            finalMessage = await targetMessage.edit(`<@${author.id}> ` + minfo.content, minfo.embed);
        }
        else {
            finalMessage = await targetChannel.send(`<@${author.id}> ` + minfo.content, minfo.embed) as Message;
            await finalMessage.react('⭐');
        }

        return msg.reply(`Done. ${urlOfMessage(finalMessage)}`);
    }
}
