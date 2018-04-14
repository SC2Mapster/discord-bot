import * as path from 'path';
import * as util from 'util';
import * as winston from 'winston';
import * as fs from 'fs';
import * as sugar from 'sugar';
import * as sqlite from 'sqlite';
import { CommandoClient, CommandoClientOptions, CommandDispatcher, FriendlyError, SQLiteProvider, Command, CommandMessage, CommandInfo } from 'discord.js-commando';
import * as schedule from 'node-schedule';
import { User, TextChannel, Message } from 'discord.js';
import * as orm from 'typeorm';
import { embedRecent } from './util/mapster';
import { oentries } from './util/helpers';
import { BnetPatchNotifierTask } from './task/bnetPatchNotifier';
import 'reflect-metadata';
import { ArchiveManager } from './archive';
require('winston-daily-rotate-file');

if (!fs.existsSync('logs')) fs.mkdirSync('logs');
export const logger = new (winston.Logger)({
    level: 'debug',

    transports: [
        new (winston.transports.Console)({
            colorize: true,
            prettyPrint: true,
            level: 'debug',
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
    log: winston.LoggerInstance;
    db: orm.Connection;

    constructor(options?: MapsterOptions) {
        options.disableEveryone = true;
        options.unknownCommandResponse = false;
        options.commandEditableDuration = 60;
        super(options);

        this.log = logger;

        this.on('error', logger.error);
        this.on('warn', logger.warn);
        this.on('debug', logger.debug);
        this.on('ready', () => {
            logger.info(`Logged in as ${this.user.tag} (${this.user.id})`);
            this.user.setActivity('!help', {
                type: 'LISTENING',
            });
        });
        this.on('disconnect', () => logger.warn('Disconnected!'));
        this.on('reconnect', () => logger.warn('Reconnecting...'));
        this.on('commandRun', (cmd, p, msg) => {
            logger.info(`Command run ${cmd.memberName}, Author '${msg.author.username}', msg: ${msg.content}`);
        });
        this.on('commandError', (cmd, err) => {
            if (err instanceof FriendlyError) {
                return;
            }
            logger.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
        });
        this.on('messageDelete', async (msg) => {
            const r = (<Map<string, CommandMessage>>(<any>this.dispatcher)._results).get(msg.id);
            if (r) {
                const cmd = r.command;
                if (cmd instanceof MapsterCommand && cmd.minfo.deleteOnUserCommandDelete) {
                    const responses: Message[] = (<any>r.responses)[msg.id]
                    for (const rlist of oentries(r.responses)) {
                        for (const mresp of rlist) {
                            await mresp.delete();
                        }
                    }
                }
            }
            logger.info(`Message deleted; '${msg.channel.toString()}', '${msg.author.username}', msg: ${msg.content}`);
        });
        this.on('messageUpdate', (oldMessage, newMessage) => {
            logger.info('Message update');
            this.logDeletedMessage(newMessage);
        });
        this.on('messageDelete', (msg) => {
            logger.info('Message deleted');
            this.logDeletedMessage(msg);
        });
        this.on('messageDeleteBulk', (messages) => {
            logger.info('Message bulk delete');
            messages.forEach((msg) => this.logDeletedMessage(msg));
        });
        this.on('message', async (msg) => {
            // #showcase
            if (msg.channel.id === '410424727484628993') {
                await msg.react('⬆');
                await msg.react('⬇');
            }
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
            // TODO:
            // this.db = await orm.createConnection();
            await resolve(new SQLiteProvider(await sqlite.open('settings.db')));
        })).then(() => {
            this.initialized();
            this.reloadJobScheduler();
        });
    }

    protected initialized() {
        this.reloadJobScheduler();
        (new BnetPatchNotifierTask(this)).load();
        // (new ArchiveManager(this)).watch();
    }

    protected logDeletedMessage(msg: Message) {
        logger.info('', {
            author: {
                id: msg.author.id,
                username: msg.author.username,
            },
            createdTimestamp: msg.createdTimestamp,
            editedTimestamp: msg.editedTimestamp,
            content: msg.content,
            attachments: msg.attachments.map((attachment) => {
                return {
                    id: attachment.id,
                    filename: attachment.filename,
                    filesize: attachment.filesize,
                    proxyURL: attachment.proxyURL,
                    url: attachment.url,
                };
            }),
            embeds: msg.embeds.map((embed) => {
                return {
                    color: embed.color,
                    description: embed.description,
                    // fields: embed.fields,
                    // footer: embed.footer,
                    // image: embed.image,
                    // thumbnail: embed.thumbnail,
                    title: embed.title,
                    type: embed.type,
                    // video: embed.video,
                    url: embed.url,
                };
            }),
        });
    }

    public getChannel(id: string) {
        return <TextChannel>this.user.client.channels.get(id);
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
                const emsg = <Message>await channel.send(item);
                await emsg.react('⬆');
                await emsg.react('⬇');
            }

            this.settings.set('mapster:recent:prevtime', Date.now());
        });
    }
}

export type MapsterCommandInfo = {
    deleteOnUserCommandDelete?: boolean;
};

export abstract class MapsterCommand extends Command {
    public readonly client: MapsterBot;
    public readonly minfo: MapsterCommandInfo;

    constructor(client: MapsterBot, info: CommandInfo & MapsterCommandInfo) {
        super(client, info);
        this.minfo = Object.assign(<MapsterCommandInfo>{
            deleteOnUserCommandDelete: false,
        }, info)
    }
}

export abstract class AdminCommand extends MapsterCommand {
    public hasPermission(userMsg: CommandMessage) {
        const adminIds = (<string>this.client.settings.get('role:admin', '')).split(',');
        return this.client.isOwner(userMsg.author) || adminIds.indexOf(userMsg.author.id) !== -1;
    }
}
