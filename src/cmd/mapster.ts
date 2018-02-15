import { Command, CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed, TextChannel } from 'discord.js';
import * as mapster from 'sc2mapster-crawler';
import { oneLine } from 'common-tags';
import { MapsterBot } from '../bot';
import { embedProject, embedFile, handleMapsterException, embedRecent } from '../util/mapster';

// export type MapsterRecentArgs = {
//     channel: string;
//     timestamp: number;
// };

// export class MapsterRecentCommand extends Command {
//     constructor(client: MapsterBot) {
//         super(client, {
//             name: 'mapster:recent',
//             group: 'admin',
//             memberName: 'mapster:recent',
//             description: '',
//             args: [
//                 {
//                     key: 'channel',
//                     type: 'string',
//                     prompt: 'channel',
//                 },
//                 {
//                     key: 'timestamp',
//                     type: 'integer',
//                     prompt: 'timestamp',
//                 },
//             ],
//         });
//     }

//     public async run(msg: CommandMessage, args: MapsterRecentArgs) {
//         const tmpMsg = <Message>await msg.reply('...');

//         const prevDate = new Date(args.timestamp * 1000);
//         const nextDate = new Date(Date.now());

//         const channel = <TextChannel>this.client.channels.get(args.channel);
//         const embeds = await embedRecent(prevDate);

//         for (const item of embeds) {
//             await channel.send(item);
//         }

//         return tmpMsg.edit(oneLine`
//             done, ${embeds.length}
//             prev: ${prevDate.getTime() / 1000}
//             next: ${Math.floor(nextDate.getTime() / 1000)}
//         `);
//     }

//     public hasPermission(message: CommandMessage): boolean {
//         return this.client.isOwner(message.author);
//     }
// }

export class MapsterProjectCommand extends Command {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'mapster:project',
            group: 'general',
            memberName: 'mapster:project',
            description: 'Displays *RichEmbed* for given **project** from sc2mapster.com',
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
            group: 'general',
            memberName: 'mapster:pfile',
            description: 'Displays *RichEmbed* for given **project file** from sc2mapster.com',
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
