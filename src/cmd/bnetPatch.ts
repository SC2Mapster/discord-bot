import { CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed } from 'discord.js';
import * as Sugar from 'sugar';
import { getVersionInfo } from '../util/ngdp';
import { MapsterCommand, MapsterBot } from '../bot';
import { PatchNoteEntry, getPatchNotes, getCachedNotes, genPatchNotesMsg } from '../util/bnetPatchNotes';

export class BnetPatchStatusCommand extends MapsterCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'bnet:patch:status',
            memberName: 'bnet:patch:status',
            group: 'general',
            description: 'Retrieves information about current version of SC2.',
            throttling: {
                usages: 5,
                duration: 60,
            },
        });
    }

    public async run(msg: CommandMessage, args: string[]) {
        const s2versions = await getVersionInfo();
        let desc = '';
        for (const [region, info] of s2versions) {
            desc += `${region.toUpperCase()} - ${info.get('VersionsName')}\n`;
        }
        return msg.say('```js\n' + desc.trim() + '\n```');
    }
}

export class BnetPatchListCommand extends MapsterCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'bnet:patch:list',
            memberName: 'bnet:patch:list',
            group: 'general',
            description: 'Patch list',
            argsCount: 1,
            throttling: {
                usages: 4,
                duration: 60,
            },
        });
    }

    public async run(msg: CommandMessage, arg: string) {
        const date = new Sugar.Date(arg.length ? arg : 'now');
        if (!date.isValid()) {
            return msg.reply('invalid date');
        }

        let i = 0;
        const limit = 10;
        const rlines: string[] = [];
        for (const [version, nitem] of await getCachedNotes()) {
            if (nitem.publish > date.getTime().raw) continue;
            if (++i > limit) break;
            rlines.push(`\`${nitem.version.padStart(7, ' ')}\` - ${(new Sugar.Date(nitem.publish)).medium().raw}`);
        }

        if (!rlines.length) {
            return msg.reply('no results');
        }

        return msg.say(`__${limit}__ last patches since __${date.medium().raw}__\n${rlines.join('\n')}`);
    }
}

export class BnetPatchNotesCommand extends MapsterCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'bnet:patch:notes',
            memberName: 'bnet:patch:notes',
            group: 'general',
            description: 'Patch notes',
            argsCount: 1,
            throttling: {
                usages: 4,
                duration: 60,
            },
        });
    }

    public async run(msg: CommandMessage, arg: string) {
        const plist = await getCachedNotes();
        const pnote = arg.length ? plist.get(arg) : Array.from(plist.values())[0];
        if (!pnote) {
            return msg.say('no results');
        }

        const tmp = genPatchNotesMsg(pnote);
        return msg.say(tmp.content, tmp.options)
    }
}
