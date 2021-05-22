import * as schedule from 'node-schedule';
import { Message, TextChannel } from 'discord.js';
import { MapsterBot, logger } from '../bot';
import { Task } from '../registry';
import { embedRecent, createNewConnection } from '../util/mapster';
import { MapsterConnection } from 'sc2mapster-crawler';

export class MapsterRecentTask extends Task {
    jobs: schedule.Job[] = [];
    mconn: MapsterConnection;

    constructor(bot: MapsterBot) {
        super(bot, {});
    }

    async load() {
        if (!this.mconn) {
            this.mconn = await createNewConnection();
        }

        this.jobs.push(schedule.scheduleJob(this.constructor.name, '15 * * * *', this.update.bind(this)));
    }

    async unload() {
        if (this.mconn) {
            await this.mconn.close();
            this.mconn = void 0;
        }
    }

    private async update(fireDate: Date) {
        logger.info('MapsterRecentTask::update');
        const targetChannel = <TextChannel>this.client.channels.cache.get(this.client.settings.get('mapster:recent:channel', null));
        if (!targetChannel) {
            logger.warning(`Channel not configured`);
            return;
        }

        const prev = new Date(Number(this.client.settings.get('mapster:recent:prevtime', Date.now())));

        logger.debug(`prev: ${prev.toUTCString()}, now: ${(new Date(Date.now())).toUTCString()}`);
        logger.debug(`channel: ${targetChannel.name}`);

        const result = await embedRecent({
            refdate: prev,
            conn: this.mconn,
        });
        logger.debug(`embeds: ${result.embeds.length}`);

        for (const item of result.embeds) {
            const emsg = <Message>await targetChannel.send(item);
            await emsg.react('⭐');
        }

        if (result.nextRefDate) {
            logger.debug(`nextrefdate: ${result.nextRefDate.toUTCString()}`)
            await this.client.settings.set('mapster:recent:prevtime', result.nextRefDate.getTime());
        }
    }
}
