import * as fs from 'fs';
import * as request from 'request-promise-native';
import * as Sugar from 'sugar';
import TurndownService = require('turndown');
import { Util, MessageOptions } from 'discord.js';
import * as github from '../github';
import puppeteer from 'puppeteer';

const turndownService = new TurndownService({
    headingStyle: 'atx',
});

export type PatchNoteReleaseType = 'RETAIL' | 'PTR';

export type PatchNoteEntry = {
    program: string | 'SC2';
    locale: string | 'en_US';
    type: PatchNoteReleaseType;
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

export async function getPatchNotes(program: string = 's2', pageSize: number = 20, type: PatchNoteReleaseType = 'RETAIL') {
    const uri = `${oauthBase}/api/patchnote/list?program=${program}&region=US&locale=enUS&type=${type}&page=1&pageSize=${pageSize}&orderBy=buildNumber&buildNumberMin=0&buildNumberMax=`;
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

export async function genPatchNotesMsg(pnote: PatchNoteEntry) {
    const buff = Buffer.from(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="https://bootswatch.com/4/superhero/bootstrap.min.css"/><style type="text/css">body { background: #1d222c; color: #abacae; } ul { list-style-type: disc !important; } .hd { padding: 1rem; padding-bottom: 0; } .hd img { margin: 0.5rem 1rem; } .hd h1 { color: #fff; font-size: 1.6rem; margin: 0; } .content h2 { font-size: 1.4rem; color: #ddd; } .content h3 { font-size: 1.3rem; } .content h4 { font-size: 1.2rem; } .content h5 { font-size: 1.5rem; } </style></head><body><div class="container"><div class="hd"><img src="data:image/png;base64,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" alt="" class="float-left"><h1>PATCH ${pnote.patchVersion}</h1><p><span class="text-muted">${(new Sugar.Date(pnote.publish)).medium()}</span></p><hr></div><div class="content">${pnote.detail}</div></div></body></html>`);
    const fname = `/tmp/s2notes-${pnote.slug}.html`;
    fs.writeFileSync(fname, buff);

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            `--no-sandbox`,
            '--disable-setuid-sandbox',
            `--no-default-browser-check`,
            `--window-size=1280,800`,
            `--user-agent=${'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:73.0) Gecko/20100101 Firefox/73.0'}`,
        ],
    });
    const bpage = await browser.newPage();
    await bpage.goto(`file://${fname}`);
    const screenBuff = await bpage.screenshot({
        fullPage: true,
        encoding: 'binary',
        type: 'png',
    });
    await browser.close();

    return {
        content: `StarCraft II — Patch notes released — **${pnote.patchVersion}.${pnote.buildNumber}** \`${pnote.type}\`\n`,
        options: <MessageOptions>{
            files: [
                {
                    name: `s2-notes-${pnote.slug}.html`,
                    attachment: buff,
                },
                {
                    name: `s2-notes-${pnote.slug}.png`,
                    attachment: screenBuff,
                },
            ]
        },
    };
}

