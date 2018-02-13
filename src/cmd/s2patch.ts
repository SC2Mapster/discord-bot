import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed } from 'discord.js';
import { getVersionInfo } from '../util/ngdp';

export type S2PatchArgs = {
    region: string;
};

export default class S2PatchCommand extends Command {
    constructor(client: CommandoClient) {
        super(client, {
            name: 's2patch',
            group: 'util',
            memberName: 's2patch',
            description: 'Retrieves information about current version of SC2 for given region.',
            args: [
                {
                    key: 'region',
                    prompt: 'Provide region',
                    type: 'string',
                    default: 'us',
                }
            ],
            throttling: {
                usages: 5,
                duration: 60,
            },
            argsCount: 1,
        });
    }

    public async run(msg: CommandMessage, args: S2PatchArgs) {
        const s2versions = await getVersionInfo();
        for (const cv of s2versions) {
            if (cv.get('Region') !== args.region) continue;
            const rembed = new RichEmbed({
                // description: `Current version in **${cv.get('Region')}**`,
            });
            for (const [key, value] of cv.entries()) {
                rembed.addField(key, value, key !== 'Region');
            }
            return msg.replyEmbed(rembed);
        }
        return msg.reply('Invalid region provided');
    }
}