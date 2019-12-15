import sanitize = require('sanitize-html');
import * as sugar from 'sugar';
import * as schedule from 'node-schedule';
import { RichEmbed, Message, TextChannel } from 'discord.js';
import { MapsterBot, logger } from '../bot';
import { Task } from '../registry';
import { fetchLatestInSubforum, BnetForumSubmission } from '../util/bnetForum';
import { fetchLatestForum, MapsterForumSubmission } from '../util/mapster';
import { MapsterConnection } from 'sc2mapster-crawler';

export class ForumFeedTask extends Task {
    job: schedule.Job;
    mconn: MapsterConnection;

    constructor(bot: MapsterBot) {
        super(bot, {});
    }

    async load() {
        if (!this.mconn) {
            this.mconn = new MapsterConnection();
            await this.mconn.setup();
        }

        this.job = schedule.scheduleJob(this.constructor.name, '*/5 * * * *', this.update.bind(this));
    }

    async unload() {
        if (this.mconn) {
            await this.mconn.close();
            this.mconn = void 0;
        }
    }

    protected async update(fireDate: Date) {
        logger.info('ForumFeedTask::update');

        const targetChannel = <TextChannel>this.client.user.client.channels.get(this.client.settings.get('fm-feed.channel', null));
        if (!targetChannel) {
            logger.warning(`Channel not configured`);
            return;
        }

        await this.handleMapster(targetChannel);
        await this.handleBnet(targetChannel);
    }

    protected async handleBnet(targetChannel: TextChannel) {
        const prevSyncTime = new Date(Number(this.client.settings.get('fm-feed.bnet.last-time', Date.now() - (1000 * 3600 * 24 * 7))));
        let nextSyncTime = prevSyncTime;

        const bncats = {
            'map-showcase': 'Map Showcase',
            'editor-discussion': 'Editor Discussion',
        };
        for (const catKey in bncats) {
            const catName = (<any>bncats)[catKey];
            const ctRes = await fetchLatestInSubforum({
                since: prevSyncTime,
                category: catKey,
            });
            logger.debug(`category: ${catKey} ; ${ctRes.entries.length}`);

            for (const entry of ctRes.entries) {
                await targetChannel.send(prepareBnetEmbed(entry, catName));
            }

            if (ctRes.next > nextSyncTime) {
                nextSyncTime = ctRes.next;
                logger.debug(`nextSyncTime: ${nextSyncTime.toUTCString()}`)
                this.client.settings.set('fm-feed.bnet.last-time', nextSyncTime.getTime());
            }
        }
    }

    protected async handleMapster(targetChannel: TextChannel) {
        const prevSyncTime = new Date(Number(this.client.settings.get('fm-feed.mapster.last-time', Date.now() - (1000 * 3600 * 24 * 7))));
        let nextSyncTime = prevSyncTime;

        const res = await fetchLatestForum({
            refdate: prevSyncTime,
            conn: this.mconn,
        });

        if (res.entries.length) {
            for (const entry of res.entries) {
                await targetChannel.send(prepareMapsterEmbed(entry));
            }

            if (res.next > nextSyncTime) {
                nextSyncTime = res.next;
                logger.debug(`nextSyncTime: ${nextSyncTime.toUTCString()}`)
                this.client.settings.set('fm-feed.mapster.last-time', nextSyncTime.getTime());
            }
        }
    }
}

function sClean(s: string) {
    s = sanitize(s, {
        allowedTags: [ 'b', 'i', 'em', 'strong', 'li', 'code', 'a' ],
        // TODO: img[src], iframe[yt]
        allowedAttributes: {
            'a': [ 'href' ]
        },
        // allowedIframeHostnames: ['www.youtube.com']
    });
    s = s.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, (org, name, link) => {
        return `[${link}](${name})`;
    });
    s = s.replace(/<\/?(em|b|strong)>/g, '**');
    s = s.replace(/<\/?(i)>/g, '*');
    s = s.replace(/<\/?(code)>/g, '`');
    s = s.replace(/<\/(li)>/g, '\n');
    s = s.replace(/<(li)>/g, ' ► ');
    s = s.replace(/&gt;/g, '>');
    s = s.replace(/&lt;/g, '<');
    return s;
}

function prepareBnetEmbed(entry: BnetForumSubmission, categoryName: string) {
    const pembed = new RichEmbed({
        title: `${entry.topic.title} #${entry.post.post_number}`,
        description: sClean(sugar.String.truncate(entry.post.cooked, 500)),
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
    return pembed;
}

function prepareMapsterEmbed(entry: MapsterForumSubmission) {
    const pembed = new RichEmbed({
        title: `${entry.post.thread.title} #${entry.post.postNumber}`,
        description: sClean(sugar.String.truncate(entry.post.content.html, 500)),
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
        pembed.image = {
            url: entry.post.content.embeddedImages[0],
        }
    }
    return pembed;
}
