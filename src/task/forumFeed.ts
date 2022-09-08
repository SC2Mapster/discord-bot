import * as sugar from 'sugar';
import * as schedule from 'node-schedule';
import { MessageEmbed, Message, TextChannel } from 'discord.js';
import { MapsterBot, logger } from '../bot';
import { Task } from '../registry';
import { fetchLatestInSubforum, BnetForumSubmission } from '../util/bnetForum';
import { fetchLatestForum, MapsterForumSubmission, createNewConnection } from '../util/mapster';
import { MapsterConnection } from 'sc2mapster-crawler';
import { sanitizeForeignHtml } from '../util/helpers';

export class ForumFeedTask extends Task {
    jobs: schedule.Job[] = [];
    mconn: MapsterConnection;
    targetChannel: TextChannel;

    constructor(bot: MapsterBot) {
        super(bot, {});
    }

    async load() {
        if (!this.mconn) {
            this.mconn = await createNewConnection();
        }

        this.targetChannel = <TextChannel>this.client.user.client.channels.cache.get(this.client.settings.get('fm-feed.channel', null));
        if (!this.targetChannel) {
            logger.warning(`Channel not configured`);
            return;
        }

        this.jobs.push(schedule.scheduleJob(`${this.constructor.name}_${this.handleBnet.name}`, '*/5 * * * *', this.handleBnet.bind(this)));
        this.jobs.push(schedule.scheduleJob(`${this.constructor.name}_${this.handleMapster.name}`, '40 * * * *', this.handleMapster.bind(this)));
    }

    async unload() {
        if (this.mconn) {
            await this.mconn.close();
            this.mconn = void 0;
        }
    }

    protected async handleBnet(fireDate: Date) {
        logger.info('ForumFeedTask::bnet');

        const prevSyncTime = new Date(Number(this.client.settings.get('fm-feed.bnet.last-time', Date.now() - (1000 * 3600 * 24 * 7))));
        let nextSyncTime = prevSyncTime;

        const bncats = {
            'map-showcase': 'Map Showcase',
            'editor-discussion': 'Editor Discussion',
            'ptr-bug-report': 'PTR Bug Report',
            'ptr-feedback': 'PTR Feedback',
        };
        for (const catKey in bncats) {
            const catName = (<any>bncats)[catKey];
            const ctRes = await fetchLatestInSubforum({
                since: prevSyncTime,
                category: catKey,
            });
            logger.debug(`category: ${catKey} ; ${ctRes.entries.length}`);

            for (const entry of ctRes.entries) {
                await this.targetChannel.send(prepareBnetEmbed(entry, catName));
            }

            if (ctRes.next > nextSyncTime) {
                nextSyncTime = ctRes.next;
                logger.debug(`nextSyncTime: ${nextSyncTime.toUTCString()}`)
                await this.client.settings.set('fm-feed.bnet.last-time', nextSyncTime.getTime());
            }
        }
    }

    protected async handleMapster(fireDate: Date) {
        logger.info('ForumFeedTask::mapster');

        const prevSyncTime = new Date(Number(this.client.settings.get('fm-feed.mapster.last-time', Date.now() - (1000 * 3600 * 24 * 7))));
        let nextSyncTime = prevSyncTime;

        const res = await fetchLatestForum({
            refdate: prevSyncTime,
            conn: this.mconn,
        });

        logger.debug(`handleMapster: ${res.entries.length} ; date = ${res.next?.toUTCString()}`);


        if (res.entries.length) {
            for (const entry of res.entries) {
                await this.targetChannel.send(prepareMapsterEmbed(entry));
            }

            if (res.next > nextSyncTime) {
                nextSyncTime = res.next;
                logger.debug(`nextSyncTime: ${nextSyncTime.toUTCString()}`)
                await this.client.settings.set('fm-feed.mapster.last-time', nextSyncTime.getTime());
            }
        }
    }
}

function prepareBnetEmbed(entry: BnetForumSubmission, categoryName: string) {
    const pembed = new MessageEmbed({
        title: `${entry.topic.title} #${entry.post.post_number}`,
        description: sanitizeForeignHtml(sugar.String.truncate(entry.post.cooked, 1000)),
        author: {
            name: entry.post.username.replace(/-[0-9]+$/, ''),
            icon_url: entry.post.avatar_template,
            url: `https://us.forums.blizzard.com/en/sc2/u/${entry.post.username}`,
        },
        color: 0x132758,
        url: entry.post.direct_link,
        timestamp: entry.post.created_at,
        footer: {
            text: `SC2 Forums / ${categoryName}`,
            icon_url: 'https://i.imgur.com/PZKEWs8.png',
        },
    });
    // embed.author.icon_url: Scheme "/en/sc2/plugins/discourse-blizzard-plugin/images/avatars/sc2/default.png" is not supported. Scheme must be one of ('http', 'https').
    if (!pembed.author.iconURL.match(/^https?:\/\//)) {
        delete pembed.author.iconURL;
    }
    return pembed;
}

function prepareMapsterEmbed(entry: MapsterForumSubmission) {
    const pembed = new MessageEmbed({
        title: `${entry.post.thread.title} #${entry.post.postNumber}`,
        description: sanitizeForeignHtml(sugar.String.truncate(entry.post.content.html, 1000)),
        author: {
            name: entry.post.author.title,
            icon_url: entry.post.author.profileThumbUrl,
            url: `https://www.sc2mapster.com/members/${entry.post.author.name}`,
        },
        color: 0xE37C22,
        url: entry.post.directLink,
        timestamp: entry.post.date,
        footer: {
            text: `SC2Mapster Forum / ${entry.post.thread.categoryBreadcrumb.join(' / ')}`,
            icon_url: 'https://media.forgecdn.net/avatars/97/682/636293447593708306.png',
        },
    });
    if (entry.post.content.embeddedImages.length) {
        pembed.thumbnail = {
            url: entry.post.content.embeddedImages[0],
        }
    }
    return pembed;
}
