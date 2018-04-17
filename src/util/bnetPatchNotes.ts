import * as request from 'request-promise';
import * as Sugar from 'sugar';
import TurndownService = require('turndown');
import { RichEmbed, Util, MessageOptions } from 'discord.js';
import * as github from '../github';

const turndownService = new TurndownService({
    headingStyle: 'atx',
});

export type PatchNoteEntry = {
    program: string | 'SC2';
    locale: string | 'en_US';
    type: string | 'RETAIL';
    patchVersion: string;
    status: string | 'LIVE';
    detail: string;
    buildNumber: number;
    publish: number;
    created: number;
    develop: boolean;
    slug: string;
    version: string;
};

export type PatchNoteResult = {
    patchNotes: PatchNoteEntry[];
    pagination: {
        totalEntries: number;
        totalPages: number;
        pageSize: number;
        page: number;
    };
};

const oauthBase = 'https://cache-us.battle.net/system/cms/oauth';

export async function getPatchNotes(program: string = 's2', pageSize: number = 20) {
    const uri = `${oauthBase}/api/patchnote/list?program=${program}&region=US&locale=enUS&type=&page=1&pageSize=${pageSize}&orderBy=buildNumber&buildNumberMin=0&buildNumberMax=`;
    const s = await request.get(uri);
    return <PatchNoteResult>JSON.parse(s);
}

let cachedNotes = new Map<string, PatchNoteEntry>();
let cachedNotesTime = new Sugar.Date(Date.now());
export async function getCachedNotes() {
    if (cachedNotesTime.isBefore(Date.now()).raw) {
        cachedNotes.clear();
        for (const nitem of (await getPatchNotes('s2', 200)).patchNotes) {
            cachedNotes.set(nitem.patchVersion, nitem);
        }
        cachedNotesTime = new Sugar.Date(Date.now()).addHours(1);
    }
    return cachedNotes;
}

// export async function publishNotesGist(pnote: PatchNoteEntry) {
//     const content = turndownService.turndown(pnote.detail);
//     const r = await github.client.gists.create({
//         public: false,
//         description: `StarCraft ${pnote.patchVersion} Patch Notes`,
//         files: {
//             'notes.md': {
//                 content: content,
//             },
//         },
//     });
//     return <string>r.data.html_url;
// }

// export function genPatchNotesMsg(pnote: PatchNoteEntry, url: string) {
//     const content = turndownService.turndown(pnote.detail);
//     const embed = new RichEmbed({
//         color: 0x0e86ca,
//         title: `StarCraft ${pnote.patchVersion} Patch Notes`,
//         url: url,
//         description: content.length > 1500 ? null : content,
//         footer: {
//             icon_url: 'https://i.imgur.com/MDgIR4B.png',
//             text: `**${pnote.patchVersion}** — B${pnote.buildNumber}`
//         },
//         timestamp: new Date(pnote.publish),
//     });
//     return embed;
// }

export function genPatchNotesMsg(pnote: PatchNoteEntry) {
    return {
        content: `StarCraft **${pnote.patchVersion}** Patch Notes — \`${pnote.buildNumber}\`\n`,
        options: <MessageOptions>{
            file: {
                name: `s2-notes-${pnote.slug}.html`,
                attachment: new Buffer(`<link rel="stylesheet" href="https://bootswatch.com/4/solar/bootstrap.min.css"/>\n<div class="container">${pnote.detail}</div>`),
            }
        },
    };
}

