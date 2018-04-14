import { getManager, EntityManager } from 'typeorm';
import * as ds from 'discord.js';
import { MapsterBot, logger } from "./bot";
import { Message } from './entity/Message';
import { User } from './entity/User';

export class ArchiveStore {
    em: EntityManager = getManager();

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

    public async updateMessage(dmessage: ds.Message) {
        logger.info(`updateMessage: ${dmessage.id}`);

        let msg = await this.em.findOneById(Message, dmessage.id);
        if (!msg) {
            msg = new Message();
            msg.id = dmessage.id;
            msg.author = await this.updateUser(dmessage.author);
            msg.channelId = dmessage.channel.id;
            msg.createdAt = dmessage.createdAt;
        }

        msg.content = dmessage.content;
        return await this.em.save(msg);
    }
}

export class ArchiveManager {
    readonly bot: MapsterBot;
    readonly store = new ArchiveStore();

    constructor(bot: MapsterBot) {
        this.bot = bot;

        this.bot.on('message', (dmessage) => {
            if (['413099660388073481'].indexOf(dmessage.channel.id) === -1) return;
            this.store.updateMessage(dmessage);
        });
        this.bot.on('messageUpdate', (old, dmessage) => {
            if (['413099660388073481'].indexOf(dmessage.channel.id) === -1) return;
            this.store.updateMessage(dmessage);
        });
    }

    public watch() {
        this.syncChannel(<ds.TextChannel>this.bot.channels.get('413099660388073481'));
    }

    private async syncChannel(dchan: ds.TextChannel) {
        // function syncChunk(dmessages: ds.Collection<ds.Snowflake, ds.Message>) {
        // }
        let queryOptions = <ds.ChannelLogsQueryOptions>{
            around: dchan.lastMessageID,
            limit: 1,
        };
        logger.info('sync channel BEGIN');
        do {
            const dmessages = await dchan.fetchMessages(queryOptions)
            if (dmessages.size === 0) break;
            for (const dmsg of dmessages.values()) {
                await this.store.updateMessage(dmsg);
            }
            queryOptions = <ds.ChannelLogsQueryOptions>{
                before: dmessages.last().id,
                limit: 100,
            };
        } while(true);
        logger.info('sync channel END');
    }
}
