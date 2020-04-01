import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import * as sqlite from 'sqlite';
import { CommandoClient, CommandoClientOptions, CommandDispatcher, FriendlyError, SQLiteProvider, Command, CommandMessage, CommandInfo } from 'discord.js-commando';
import { User, TextChannel, Message, MessageOptions, Guild } from 'discord.js';
import * as orm from 'typeorm';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { oentries } from './util/helpers';
import { BnetPatchNotifierTask } from './task/bnetPatchNotifier';
import 'reflect-metadata';
import { ArchiveManager } from './task/archive';
import { MapsterRecentTask } from './task/mapsterRecent';
import { NotablePinTask } from './task/notablepin';
import { MapsterCommonTask } from './task/mcommon';
import { PasteTask } from './task/paste';
import { ForumFeedTask } from './task/forumFeed';

if (!fs.existsSync('logs')) fs.mkdirSync('logs');
export const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({
            alias: 'time',
            format: 'HH:mm:ss.SSS',
        }),
        winston.format.prettyPrint({ colorize: false, depth: 2 }),
        winston.format.printf(info => {
            const out = [
                `${info.time} ${info.level.substr(0, 3).toUpperCase()} ${info.message}`
            ];

            const splat: any[] = info[<any>Symbol.for('splat')];
            if (Array.isArray(splat)) {
                const dump = splat.length === 1 ? splat.pop() : splat;
                out.push(util.inspect(dump, {
                    colors: false,
                    depth: 3,
                    compact: true,
                    maxArrayLength: 500,
                    breakLength: 140,
                }));
            }

            return out.join('\n');
        }),
    ),
    transports: [
        new winston.transports.Console({
            level: process.env.ENV !== 'dev' ? 'error' : 'debug',
            handleExceptions: true,
        }),
        new DailyRotateFile({
            filename: '%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            dirname: 'logs',
            json: false,
        }),
    ],
});

export type MapsterOptions = CommandoClientOptions & {
    token?: string;
};

export class MapsterBot extends CommandoClient {
    log: winston.Logger;
    db: orm.Connection;

    constructor(options?: MapsterOptions) {
        options.disableEveryone = true;
        options.unknownCommandResponse = false;
        options.commandEditableDuration = 300;
        super(options);

        this.log = logger;

        this.on('error', (e) => logger.error(e.message, e));
        this.on('warn', (s) => logger.warn(s));
        this.on('debug', (s) => logger.debug(s));
        this.on('ready', async () => {
            logger.info(`Logged in as ${this.user.tag} (${this.user.id})`);
            await this.user.setActivity('!help', {
                type: 'LISTENING',
            });
        });
        this.on('disconnect', () => logger.warn('Disconnected!'));
        this.on('reconnecting', () => logger.warn('Reconnecting...'));
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
            if (r && !r.message.cleanContent.endsWith('$')) {
                const cmd = r.command;
                if (cmd instanceof MapsterCommand && cmd.minfo.deleteOnUserCommandDelete) {
                    const responses: Message[] = (<any>r.responses)[msg.id]
                    for (const rlist of oentries(r.responses)) {
                        for (const mresp of <any>rlist) {
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

        this.registry.registerDefaultTypes();
        this.registry.registerGroups([
            ['admin', 'Admin'],
            ['mod', 'Mod'],
            ['general', 'General'],
        ]);
        if (process.env.ENV !== 'dev') {
        }
        this.registry.registerCommandsIn({
            dirname: path.join(__dirname, 'cmd'),
            filter: /.+\.js$/,
        });

        this.setProvider(new Promise(async (resolve, reject) => {
            this.db = await orm.createConnection();
            await resolve(new SQLiteProvider(await sqlite.open('settings.db')));
        })).then(() => {
            this.initialized();
        });
    }

    protected async initialized() {
        const availableTasks: typeof MapsterCommonTask[] = [
            NotablePinTask,
            MapsterCommonTask,
            PasteTask,
        ];

        if (process.env.ENV !== 'dev') {
            availableTasks.push(MapsterRecentTask);
            availableTasks.push(ForumFeedTask);
            availableTasks.push(BnetPatchNotifierTask);
            availableTasks.push(ArchiveManager);
        }

        const loadedTasks = availableTasks.map(v => new v(this));
        await Promise.all(loadedTasks.map(v => v.load()));
        logger.info('All tasks loaded!');
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
    }
}

export type MapsterCommandInfo = {
    deleteOnUserCommandDelete?: boolean;
};

export abstract class MapsterCommand extends Command {
    public readonly client: MapsterBot;
    public readonly minfo: MapsterCommandInfo;

    constructor(client: MapsterBot, info: (CommandInfo & MapsterCommandInfo) = null) {
        super(client, info);
        this.minfo = Object.assign(<MapsterCommandInfo>{
            deleteOnUserCommandDelete: false,
        }, info)
    }
}

export abstract class AdminCommand extends MapsterCommand {
    public hasPermission(userMsg: CommandMessage) {
        const adminIds = (<string>this.client.settings.get('admin.users-list', '')).split(',');
        return this.client.isOwner(userMsg.author) || adminIds.indexOf(userMsg.author.id) !== -1 || userMsg.member.permissions.has('MANAGE_GUILD');
    }
}
export abstract class ModCommand extends AdminCommand {
    public hasPermission(userMsg: CommandMessage) {
        return super.hasPermission(userMsg) || userMsg.member.permissions.has('MANAGE_CHANNELS');
    }
}
