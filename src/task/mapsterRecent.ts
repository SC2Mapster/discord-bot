import * as schedule from 'node-schedule';
import { RichEmbed, Message, TextChannel } from 'discord.js';
import { MapsterBot, logger } from '../bot';
import { Task } from '../registry';
import { embedRecent } from '../util/mapster';

export class MapsterRecentTask extends Task {
    job: schedule.Job;

    constructor(bot: MapsterBot) {
        super(bot, {});
    }

    load() {
        // this.job = schedule.scheduleJob(this.constructor.name, '0 */2 * * *', this.update.bind(this));
        this.job = schedule.scheduleJob(this.constructor.name, '0 * * * *', this.update.bind(this));
    }

    private async update(fireDate: Date) {
        logger.info('MapsterRecentTask::update');
        const channel = <TextChannel>this.client.user.client.channels.get(this.client.settings.get('mapster:recent:channel', null));
        const prev = new Date(Number(this.client.settings.get('mapster:recent:prevtime', Date.now())));

        logger.debug(`prev: ${prev.toUTCString()}, now: ${(new Date(Date.now())).toUTCString()}`);
        logger.debug(`channel: ${channel.name}`);

        const result = await embedRecent(prev);
        logger.debug(`embeds: ${result.embeds.length}`);

        for (const item of result.embeds) {
            const emsg = <Message>await channel.send(item);
            await emsg.react('⬆');
            await emsg.react('⬇');
        }

        if (result.nextRefDate) {
            logger.debug(`nextrefdate: ${result.nextRefDate.toUTCString()}`)
            this.client.settings.set('mapster:recent:prevtime', result.nextRefDate.getTime());
        }
    }
}
