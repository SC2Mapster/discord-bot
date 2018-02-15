import * as path from 'path';
import * as util from 'util';
import * as winston from 'winston';
import * as fs from 'fs';
import * as sugar from 'sugar';
import * as sqlite from 'sqlite';
import { CommandoClient, CommandoClientOptions, FriendlyError, SQLiteProvider } from 'discord.js-commando';
import * as schedule from 'node-schedule';
import { User, TextChannel } from 'discord.js';
import { embedRecent } from './util/mapster';
require('winston-daily-rotate-file');

if (!fs.existsSync('logs')) fs.mkdirSync('logs');
const logger = new (winston.Logger)({
    level: 'debug',

    transports: [
        new (winston.transports.Console)({
            colorize: true,
            prettyPrint: true,
            timestamp: function() {
                return sugar.Date.format(new Date(Date.now()), '{HH}:{mm}:{ss}.{SSS}');
            },
        }),
        new (winston.transports.DailyRotateFile)({
            filename: '.log',
            prepend: true,
            datePattern: 'yyyy-MM-dd',
            dirname: 'logs',
            level: 'info',
            logstash: false,
            json: false,
            stringify: true,
        }),
    ],
});

export type MapsterOptions = CommandoClientOptions & {
    token?: string;
};

export class MapsterBot extends CommandoClient {
    constructor(options?: MapsterOptions) {
        options.disableEveryone = true,
        options.unknownCommandResponse = false,
        super(options);

        this.on('error', logger.error);
        this.on('warn', logger.warn);
        this.on('debug', logger.debug);
        this.on('ready', () => {
            winston.info(`Logged in as ${this.user.tag} (${this.user.id})`);
            // this.user.setActivity('github.com SC2Mapster/discord-bot', {
            //     type: 'LISTENING',
            // });
        })
        this.on('disconnect', () => logger.warn('Disconnected!'))
        this.on('reconnect', () => logger.warn('Reconnecting...'))
        this.on('commandRun', (cmd, p, msg) => {
            logger.debug(`Command run ${cmd.memberName}`);
            logger.debug(`Author '${msg.author.username}', msg: ${msg.content}`);
        });
        this.on('commandError', (cmd, err) => {
            if (err instanceof FriendlyError) {
                return;
            }
            logger.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
        });

        this.registry.registerDefaultTypes();
        this.registry.registerGroups([
            ['admin', 'Admin'],
            ['general', 'General'],
        ]);
        this.registry.registerCommandsIn({
            dirname: path.join(__dirname, 'cmd'),
            filter: /.+\.(?:ts|js)$/,
        });

        this.setProvider(new Promise(async (resolve, reject) => {
            await resolve(new SQLiteProvider(await sqlite.open('settings.db')));
        })).then(() => {
            this.reloadJobScheduler();
        });
    }

    public reloadJobScheduler() {
        schedule.cancelJob('mapster:recent');
        const cronValue = this.settings.get('mapster:recent:cron', null);
        if (!cronValue) return;
        const j = schedule.scheduleJob('mapster:recent', cronValue, async () => {
            const channel = <TextChannel>this.user.client.channels.get(this.settings.get('mapster:recent:channel', null));
            const prev = new Date(Number(this.settings.get('mapster:recent:prevtime', Date.now())));

            logger.debug(`prev: ${prev.toUTCString()}, now: ${(new Date(Date.now())).toUTCString()}`);
            logger.debug(`channel: ${channel.name}`);

            const embeds = await embedRecent(prev);
            logger.debug(`embeds: ${embeds.length}`);

            for (const item of embeds) {
                await channel.send(item);
            }

            this.settings.set('mapster:recent:prevtime', Date.now());
        });
    }
}
