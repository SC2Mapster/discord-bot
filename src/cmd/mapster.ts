import { Command, CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed, TextChannel } from 'discord.js';
// import * as mapster from '../../node_modules/sc2mapster-crawler/src/main';
import * as mapster from 'sc2mapster-crawler';
import * as sugar from 'sugar';
import { MapsterBot } from '../bot';
import { oneLine } from 'common-tags';

const mBaseURL = 'https://www.sc2mapster.com';

function handleMapsterException(e: Error, msg: CommandMessage) {
    if (e.message.startsWith('Error: HTTP code: ')) {
        return msg.reply((<Error>e).message.substring('Error: '.length));
    }
    else {
        throw e;
    }
}

function embedProject(project: mapster.ProjectOverview) {
    const pembed = new RichEmbed({
        title: project.title,
        description: sugar.String.truncate(project.description.simplified, 200),
        author: {
            name: project.owner.title,
            icon_url: project.owner.profileThumbUrl,
            url: `${mBaseURL}/members/${project.owner.name}`,
        },
        color: 0xE37C22,
        url: `${mBaseURL}/projects/${project.name}`,
        timestamp: project.updatedAt,
        footer: {
            text: `${project.rootCategory} / ${sugar.Date.relative(project.updatedAt)}`,
            icon_url: 'https://media.forgecdn.net/avatars/97/682/636293447593708306.png',
        },
        fields: [
            {
                name: 'Categories',
                value: project.categories.map((item) => {
                    return item.name;
                }).join(' **|** '),
                inline: true,
            },
            {
                name: 'Downloads',
                value: sugar.Number.abbr(project.totalDownloads, 1),
                inline: true,
            },
        ],
    });
    if (project.thumbnail) {
        pembed.thumbnail = {
            url: project.thumbnail,
        };
    }
    if (project.description.embeddedImages.length) {
        pembed.image = {
            url: project.description.embeddedImages[0],
        }
    }
    return pembed;
}

function embedFile(pfile: mapster.ProjectFile) {
    const pembed = new RichEmbed({
        title: pfile.title,
        description: sugar.String.truncate(pfile.description.simplified, 100),
        author: {
            name: pfile.uploadedBy.title,
            icon_url: pfile.uploadedBy.profileThumbUrl,
            url: `${mBaseURL}/members/${pfile.uploadedBy.name}`,
        },
        color: 0xE37C22,
        url: `${mBaseURL}/projects/${pfile.projectName}/files/${pfile.id}`,
        timestamp: pfile.updatedAt,
        footer: {
            text: `${sugar.Date.relative(pfile.updatedAt)}`,
            icon_url: 'https://media.forgecdn.net/avatars/97/682/636293447593708306.png',
        },
        fields: [
            {
                name: 'Filename',
                value: pfile.filename,
                inline: true,
            },
            {
                name: 'Size',
                value: pfile.size,
                inline: true,
            },
            {
                name: 'Downloads',
                value: sugar.Number.abbr(pfile.downloads, 1),
                inline: true,
            },
        ],
    });
    if (pfile.description.embeddedImages.length) {
        pembed.image = {
            url: pfile.description.embeddedImages[0],
        }
    }
    return pembed;
}

export type MapsterRecentArgs = {
    channel: string;
    timestamp: number;
};

export class MapsterRecentCommand extends Command {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'mapster:recent',
            group: 'admin',
            memberName: 'mapster:recent',
            description: '',
            args: [
                {
                    key: 'channel',
                    type: 'string',
                    prompt: 'channel',
                },
                {
                    key: 'timestamp',
                    type: 'integer',
                    prompt: 'timestamp',
                },
            ],
        });
    }

    public async run(msg: CommandMessage, args: MapsterRecentArgs) {
        const tmpMsg = <Message>await msg.reply('...');

        const prevDate = new Date(args.timestamp * 1000);
        const nextDate = new Date(Date.now());

        const channel = <TextChannel>this.client.channels.get(args.channel);

        let plist = await mapster.getLatestProjects('assets', prevDate)
        plist = plist.concat(await mapster.getLatestProjects('maps', prevDate));
        const embeds: RichEmbed[] = [];
        for (const project of plist.reverse()) {
            if (project.createdAt > prevDate) {
                embeds.push(embedProject(project));
            }
            for (const pfile of (await mapster.getLatestProjectFiles(project.name, prevDate)).reverse()) {
                embeds.push(embedFile(pfile));
            }
        }

        for (const item of embeds) {
            await channel.send(item);
        }

        return tmpMsg.edit(oneLine`
            done, ${embeds.length}
            prev: ${prevDate.getTime() / 1000}
            next: ${Math.floor(nextDate.getTime() / 1000)}
        `);
    }

    public hasPermission(message: CommandMessage): boolean {
        return this.client.isOwner(message.author);
    }
}

// export type MapsterRecentSettingsArgs = {
//     enabled: boolean;
//     channel: number;
// };

// export class MapsterRecentSettings extends Command {
//     constructor(client: MapsterBot) {
//         super(client, {
//             name: 'mapster:recent:settings',
//             group: 'admin',
//             memberName: 'mapster:recent:settings',
//             description: '',
//         });
//     }

//     public async run(msg: CommandMessage, args: any) {
//         console.log(args);
//         for (const [key, item] of this.client.channels) {
//             console.log(item.id);
//         }
//         return msg.reply('');
//     }
// }


export class MapsterProjectCommand extends Command {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'mapster:project',
            group: 'util',
            memberName: 'mapster:project',
            description: 'Displays *RichEmbed* for given `project` from sc2mapster.com',
            args: [
                {
                    key: 'project',
                    type: 'string',
                    prompt: 'Provide project identifier',
                },
            ],
            argsCount: 1,
        });
    }

    public async run(msg: CommandMessage, args: { project: string }) {
        let mreply: Message;
        const tmpMsg = <Message>await msg.reply('...');

        try {
            const project = await mapster.getProject(args.project);
            mreply = <Message>await msg.embed(embedProject(project));
        }
        catch (e) {
            mreply = <Message>await handleMapsterException(e, msg);
        }
        finally {
            tmpMsg.delete();
        }

        return mreply;
    }
}


export class MapsterProjectFileCommand extends Command {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'mapster:pfile',
            group: 'util',
            memberName: 'mapster:pfile',
            description: 'Displays *RichEmbed* for given `project` from sc2mapster.com',
            args: [
                {
                    key: 'project',
                    type: 'string',
                    prompt: 'Provide project identifier',
                },
                {
                    key: 'file',
                    type: 'string',
                    prompt: 'Provide file id',
                },
            ],
            argsCount: 2,
        });
    }

    public async run(msg: CommandMessage, args: { project: string, file: number }) {
        let mreply: Message;
        const tmpMsg = <Message>await msg.reply('...');

        try {
            const pfile = await mapster.getProjectFile(args.project, args.file);
            mreply = <Message>await msg.embed(embedFile(pfile));
        }
        catch (e) {
            mreply = <Message>await handleMapsterException(e, msg);
        }
        finally {
            tmpMsg.delete();
        }

        return mreply;
    }
}
