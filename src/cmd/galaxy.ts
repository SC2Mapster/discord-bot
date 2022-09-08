import { Command, CommandoMessage } from 'discord.js-commando';
import { Message, MessageEmbed } from 'discord.js';
import { MapsterBot, MapsterCommand } from '../bot';
import * as path from 'path';
import * as gt from 'plaxtony/lib/src/compiler/types';
import { getSourceFileOfNode } from 'plaxtony/lib/src/compiler/utils';
import { getLineAndCharacterOfPosition } from 'plaxtony/lib/src/service/utils';
import { Printer } from 'plaxtony/lib/src/compiler/printer';
import { Store, S2WorkspaceWatcher, createTextDocumentFromFs } from 'plaxtony/lib/src/service/store';
import { resolveArchiveDirectory, SC2Workspace, SC2Archive, openArchiveWorkspace } from 'plaxtony/lib/src/sc2mod/archive';
import * as trig from 'plaxtony/lib/src/sc2mod/trigger';
import * as stringSimilarity from 'string-similarity';

function slugify(str: string) {
    str = str.replace(/[_\\:<>]/g, '-');
    str = str.replace('AI', 'Ai');
    str = str.replace('UI', 'Ui');
    str = str.replace(/[A-Z]+/g, (m) => '-' + m.toLowerCase());
    str = str.replace(/(^[\-]+)|([\-]+$)/g, '');
    str = str.replace(/[\/]+/g, '');
    str = str.replace(/\s*\-+\s*/g, '-');
    return str;
}

// TODO: use pre-generated database, instead of indexing data on runtime...

async function prepareStore(directory: string, modSources: string[]) {
    const store = new Store();
    const rootArchive = new SC2Archive(path.basename(directory), directory);
    const workspace = await openArchiveWorkspace(rootArchive, modSources);

    await store.updateS2Workspace(workspace);
    await store.rebuildS2Metadata();

    for (const modArchive of workspace.allArchives) {
        for (const extSrc of await modArchive.findFiles('**/*.galaxy')) {
            store.updateDocument(createTextDocumentFromFs(path.join(modArchive.directory, extSrc)));
        }
    }

    return store;
}

export default class GalaxyCommand extends MapsterCommand {
    private store: Store;
    private symbols = new Map<string, gt.Symbol>();
    private guiSymbols = new Map<string, gt.Symbol>();
    private printer = new Printer();

    constructor(client: MapsterBot) {
        super(client, {
            name: 'galaxy',
            group: 'general',
            memberName: 'galaxy',
            aliases: ['g'],
            description: 'Galaxy API',
            throttling: {
                usages: 10,
                duration: 60,
            },
        });

        setTimeout(async () => await this.loadup(), 1000 * 60 * 10);
    }

    protected async loadup() {
        if (!this.store) {
            const s2data = path.join('sc2-gamedata');
            this.store = await prepareStore(path.join(s2data, 'mods', 'core.sc2mod'), [s2data]);
            for (const sourceFile of this.store.documents.values()) {
                for (const sym of sourceFile.symbol.members.values()) {
                    this.symbols.set(sym.escapedName, sym);
                    const trigEl = this.store.s2metadata.findElementByName(sym.escapedName);
                    if (trigEl) {
                        if (trigEl instanceof trig.FunctionDef) {
                            this.guiSymbols.set(this.store.s2workspace.locComponent.triggers.elementName('Name', trigEl), sym);
                        }
                        else if (trigEl instanceof trig.PresetValue) {
                            const presetGroup = this.store.s2metadata.findPresetDef(trigEl);
                            if (presetGroup) {
                                this.guiSymbols.set([
                                    this.store.s2workspace.locComponent.triggers.elementName('Name', presetGroup),
                                    this.store.s2workspace.locComponent.triggers.elementName('Name', trigEl),
                                ].join(' '), sym);
                            }
                        }
                    }
                }
            }
            this.client.log.info(`symbols: ${this.symbols.size}`);
            this.client.log.info(`guiSymbols: ${this.guiSymbols.size}`);
        }
        return this.store;
    }

    protected embedSymbol(sym: gt.Symbol) {
        const node = sym.declarations[0];
        const sourceFile = getSourceFileOfNode(node);
        const line = getLineAndCharacterOfPosition(sourceFile, node.pos).line + 1;

        const fileName = sourceFile.fileName.match(/([^\/]+)$/g)[0];
        const filePath = sourceFile.fileName.match(/\/mods\/(.+)$/g)[0];
        const metaDesc = this.store.s2metadata.getSymbolDoc(sym.escapedName, false);
        const trigEl = this.store.s2metadata.findElementByName(sym.escapedName);

        const pembed = new MessageEmbed({
            title: sym.escapedName,
            description: '',
            color: 0x25a200,
            url: 'https://mapster.talv.space/galaxy/reference/',
            // thumbnail: {
            //     url: 'https://i.imgur.com/0TkG7Gu.png',
            // },
            footer: {
                // icon_url: 'https://i.imgur.com/qMyixeP.png',
                // icon_url: 'https://i.imgur.com/na2BkAd.png',
            },
            fields: [],
        });

        if (metaDesc) {
            const matches = metaDesc.match(/^\*\*([^*]+)\*\*\s*/);
            pembed.title = matches[1];
            pembed.description = metaDesc.substr(matches[0].length).replace(/ \*([\w\s]+)\* /gi, ' __$1__ ').trim();
        }

        let decl = node;
        if (decl.kind === gt.SyntaxKind.FunctionDeclaration && (<gt.FunctionDeclaration>decl).body) {
            decl = Object.assign({}, decl, {body: null});
        }

        const rawcode = this.printer.printNode(decl).replace(/(^native |;\s*$)/g, '');
        if (rawcode) {
            // pembed.description += '\n```c\n' + rawcode + '```';
            pembed.fields.push({
                name: 'Declaration',
                value: '```c\n' + rawcode + '```',
                inline: false,
            });
            // pembed.description += '\n\n`' + rawcode + '`';
        }

        if (trigEl) {
            let footerTags: string[] = [
                trigEl.flags & trig.ElementFlag.Native ? 'Native' : '',
                trigEl.flags & trig.ElementFlag.Deprecated ? 'Deprecated' : '',
                trigEl.flags & trig.ElementFlag.Internal ? 'Internal' : '',
                trigEl.flags & trig.ElementFlag.Operator ? 'Operator' : '',
            ];

            if (trigEl instanceof trig.FunctionDef) {
                footerTags = footerTags.concat([
                    trigEl.flags & trig.ElementFlag.Event ? 'Event' : '',
                    trigEl.flags & trig.ElementFlag.FuncAction ? 'Action' : '',
                    trigEl.flags & trig.ElementFlag.FuncCall ? 'Function' : '',
                ]);
                pembed.url += slugify(sym.escapedName);
                pembed.footer.text = this.store.s2workspace.locComponent.triggers.elementName('Grammar', trigEl);
            }
            else if (trigEl instanceof trig.PresetValue) {
                const presetGroup = this.store.s2metadata.findPresetDef(trigEl);
                if (presetGroup) {
                    footerTags = footerTags.concat([
                        presetGroup.flags & trig.ElementFlag.PresetCustom ? 'PresetCustom' : '',
                        presetGroup.flags & trig.ElementFlag.PresetGenConstVar ? 'PresetGenConstVar' : '',
                    ]);
                    pembed.title = `Preset — ${this.store.s2workspace.locComponent.triggers.elementName('Name', presetGroup)}`;
                    pembed.description = `${this.store.s2workspace.locComponent.triggers.elementName('Name', trigEl)}`;
                    pembed.footer.text = `.. and ${presetGroup.values.length} other options.`;
                }
            }

            if (pembed.fields.length) {
                pembed.fields[0].name = `[ ${footerTags.filter(v => v.trim().length).join(' — ')} ]`;
            }

            if (pembed.footer.text) {
                pembed.footer.iconURL = 'https://i.imgur.com/na2BkAd.png';
            }
        }

        if (pembed.url) {
            pembed.title = `:link: ${pembed.title}`;
        }

        return pembed;
    }

    public async run(msg: CommandoMessage, arg: string) {
        await this.loadup();
        let sym = this.store.resolveGlobalSymbol(arg);

        if (!sym) {
            arg = arg.trim().replace(/(?!^)[A-Z]+/g, (m) => ' ' + m);
            const match = stringSimilarity.findBestMatch(
                arg,
                Array.from(this.symbols.keys()).concat(Array.from(this.guiSymbols.keys()))
            );
            this.client.log.info('match', match.bestMatch);
            if (match.bestMatch.rating >= 0.35) {
                sym = this.symbols.get(match.bestMatch.target) ?? this.guiSymbols.get(match.bestMatch.target);
            }
        }

        return sym ? await msg.embed(this.embedSymbol(sym)) : await msg.reply('No results');
    }
}
