import { getManager, EntityManager } from 'typeorm';
import * as Sugar from 'sugar';
import * as ds from 'discord.js';
import { MapsterBot, logger } from "../bot";
import { Message } from '../entity/Message';
import { User } from '../entity/User';
import { Task } from '../registry';
import { Channel } from '../entity/Channel';
import { MessageAttachment } from '../entity/MessageAttachment';
import { MessageEmbed, MessageEmbedField } from '../entity/MessageEmbed';

export class ArchiveStore {
    em: EntityManager = getManager();

    public async updateChannel(dchan: ds.TextChannel) {
        let chan = await this.em.findOneById(Channel, dchan.id);
        if (chan) return chan;

        chan = new Channel();
        chan.id = dchan.id;
        chan.name = dchan.name;
        chan.position = dchan.position;
        chan.topic = dchan.topic;
        return await this.em.save(chan);
    }

    public async updateUser(duser: ds.User) {
        let user = await this.em.findOneById(User, duser.id);
        if (user) return user;

        user = new User();
        user.id = duser.id;
        user.username = duser.username;
        user.discriminator = duser.discriminator;
        user.tag = duser.tag;
        user.avatarURL = duser.avatarURL;

        return await this.em.save(user);
    }

    public async updateAttachment(dattachment: ds.MessageAttachment, msg?: Message) {
        let attachment = await this.em.findOneById(MessageAttachment, dattachment.id);
        if (attachment) return attachment;

        attachment = new MessageAttachment();
        attachment.id = dattachment.id;
        attachment.filename = dattachment.filename;
        attachment.filesize = dattachment.filesize;
        attachment.width = dattachment.width;
        attachment.height = dattachment.height;
        attachment.url = dattachment.url;
        attachment.proxyUrl = dattachment.proxyURL;
        if (msg) {
            attachment.message = msg;
        }

        return await this.em.save(attachment);
    }

    public async updateMessage(dmessage: ds.Message) {
        let msg = await this.em.findOneById(Message, dmessage.id);
        if (!msg) {
            msg = new Message();
            msg.id = dmessage.id;
            msg.author = await this.updateUser(dmessage.author);
            msg.channel = await this.em.findOneById(Channel, dmessage.channel.id);
            msg.createdAt = dmessage.createdAt;
        }

        msg.content = dmessage.content;
        msg.editedAt = dmessage.editedAt;
        msg.pinned = dmessage.pinned;
        msg.type = dmessage.type;

        await this.em.save(msg)
        if (msg.embeds) await this.em.remove(msg.embeds);

        for (const dembed of dmessage.embeds) {
            const embed = new MessageEmbed();
            embed.message = msg;

            embed.title = dembed.title;
            embed.type = dembed.type;
            embed.description = dembed.description;
            embed.url = dembed.url;
            embed.color = dembed.color;

            if (dembed.fields.length) {
                const mfields: MessageEmbedField[] = [];
                for (const item of dembed.fields) {
                    mfields.push({
                        name: item.name,
                        value: item.value,
                        inline: item.inline,
                    });
                }
                embed.fields = JSON.stringify(mfields);
            }
            else {
                embed.fields = null;
            }

            if (dembed.footer) {
                embed.footer = {
                    text: dembed.footer.text || null,
                    iconUrl: dembed.footer.iconURL || null,
                    proxyIconUrl: dembed.footer.proxyIconURL || null,
                }
            }
            if (dembed.image) {
                embed.image = {
                    url: dembed.image.url,
                    proxyUrl: dembed.image.proxyURL,
                    width: dembed.image.width,
                    height: dembed.image.height,
                };
            }
            if (dembed.thumbnail) {
                embed.thumbnail = {
                    url: dembed.thumbnail.url,
                    proxyUrl: dembed.thumbnail.proxyURL,
                    width: dembed.thumbnail.width,
                    height: dembed.thumbnail.height,
                };
            }
            if (dembed.video) {
                embed.video = {
                    url: dembed.video.url,
                    width: dembed.video.width,
                    height: dembed.video.height,
                };
            }
            if (dembed.provider) {
                embed.provider = {
                    name: dembed.provider.name,
                    url: dembed.provider.url,
                };
            }
            if (dembed.author) {
                embed.author = {
                    name: dembed.author.name,
                    url: dembed.author.url,
                    iconUrl: dembed.author.iconURL,
                };
            }

            await this.em.save(embed);
        }

        for (const [key, attachment] of dmessage.attachments) {
            await this.updateAttachment(attachment, msg);
        }

        return msg;
    }

    public async softDeleteMessage(dmessage: ds.Message) {
        let msg = await this.em.findOneById(Message, dmessage.id);
        if (!msg) {
            return;
        }
        msg.deletedAt = new Date(Date.now());
        await this.em.save(msg)
    }
}

export class ArchiveManager extends Task {
    readonly store = new ArchiveStore();

    constructor(bot: MapsterBot) {
        super(bot, {});
    }

    public load() {
        this.client.on('guildMemberAdd', async (dmember) => {
            await this.store.updateUser(dmember.user);
        });
        this.client.on('channelCreate', async (dchan) => {
            if (dchan.type !== 'text') return;
            await this.store.updateChannel(<ds.TextChannel>dchan);
        });
        this.client.on('message', async (dmessage) => {
            if (dmessage.channel.type === 'dm') return;
            await this.store.updateMessage(dmessage);
        });
        this.client.on('messageUpdate', async (old, dmessage) => {
            if (dmessage.channel.type === 'dm') return;
            await this.store.updateMessage(dmessage);
        });
        this.client.on('messageDelete', async (dmessage) => {
            if (dmessage.channel.type === 'dm') return;
            await this.store.softDeleteMessage(dmessage);
        });
        this.client.on('messageDeleteBulk', async (dmessages) => {
            for (const dmessage of dmessages.values()) {
                if (dmessage.channel.type === 'dm') return;
                await this.store.softDeleteMessage(dmessage);
            }
        });

        this.processChannels();
    }

    private async processChannels() {
        for (const currentGuild of this.client.guilds.values()) {
            for (const dchan of currentGuild.channels.values()) {
                if (dchan.type !== 'text') continue;
                await this.store.updateChannel(<ds.TextChannel>dchan);
            }

            for (const dchan of currentGuild.channels.values()) {
                if (dchan.type !== 'text') continue;
                await this.syncChannel(<ds.TextChannel>this.client.channels.get(dchan.id), {
                    newerThan: new Sugar.Date(Date.now()).addDays(-2).raw,
                });
            }
        }
    }

    private async syncChannel(dchan: ds.TextChannel, options: { newerThan: Date } = { newerThan: null }) {
        // function syncChunk(dmessages: ds.Collection<ds.Snowflake, ds.Message>) {
        // }
        let queryOptions = <ds.ChannelLogsQueryOptions>{
            around: dchan.lastMessageID,
            limit: 1,
        };
        logger.info(`sync channel BEGIN [#${dchan.name}]`);
        while(true) {
            const dmessages = (await dchan.fetchMessages(queryOptions)).filter(dmsg => {
                return options.newerThan === null || options.newerThan < dmsg.createdAt;
            });
            if (dmessages.size === 0) break;
            for (const dmsg of dmessages.values()) {
                logger.debug(`[#${dchan.name}] Message ${dmsg.createdAt}`);
                await this.store.updateMessage(dmsg);
            }
            queryOptions = <ds.ChannelLogsQueryOptions>{
                before: dmessages.last().id,
                limit: 100,
            };
        }
        logger.info('sync channel END');
    }
}
