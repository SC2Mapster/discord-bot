import { Command, CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed } from 'discord.js';
import { MapsterBot } from '../bot';
import * as path from 'path';
import * as gt from '../../node_modules/plaxtony/lib/compiler/types';
import { getSourceFileOfNode } from '../../node_modules/plaxtony/lib/compiler/utils';
import { getLineAndCharacterOfPosition } from '../../node_modules/plaxtony/lib/service/utils';
import { Printer } from '../../node_modules/plaxtony/lib/compiler/printer';
import { Store, S2WorkspaceWatcher } from '../../node_modules/plaxtony/lib/service/store';
import { resolveArchiveDirectory, SC2Workspace, SC2Archive } from '../../node_modules/plaxtony/lib/sc2mod/archive';

// TODO: use pre-generated database, instead of indexing data on runtime...

async function prepareStore(directory: string, modSources: string[]) {
    const store = new Store();
    const ws = new S2WorkspaceWatcher(directory, modSources);
    const workspaces: SC2Workspace[] = [];
    ws.onDidOpen((ev) => {
        store.updateDocument(ev.document);
    });
    ws.onDidOpenS2Archive((ev) => {
        workspaces.push(ev.workspace);
    });
    await ws.watch();
    for (const ws of workspaces) {
        await store.updateS2Workspace(ws, 'enUS');
    }
    return store;
}

export default class GalaxyCommand extends Command {
    private store: Store;
    private printer = new Printer();

    constructor(client: MapsterBot) {
        super(client, {
            name: 'galaxy',
            group: 'general',
            memberName: 'galaxy',
            description: 'Galaxy API',
            args: [
                {
                    key: 'keyword',
                    type: 'string',
                    prompt: 'Provide symbol name',
                },
            ],
            argsCount: 1,
        });
    }

    protected async loadup() {
        if (!this.store) {
            this.store = await prepareStore(path.join('sc2-data-trigger', 'mods', 'core.sc2mod'), [path.join('sc2-data-trigger')]);
        }
        return this.store;
    }

    protected embedSymbol(sym: gt.Symbol) {
        const node = sym.declarations[0];
        const sourceFile = getSourceFileOfNode(node);
        const line = getLineAndCharacterOfPosition(sourceFile, node.pos).line + 1;

        const fileName = sourceFile.fileName.match(/([^\/]+)$/g)[0];
        const filePath = sourceFile.fileName.match(/\/mods\/(.+)$/g)[0];
        const metaDesc = this.store.s2metadata.getSymbolDoc(sym.escapedName);

        const pembed = new RichEmbed({
            title: sym.escapedName,
            description: '',
            color: 0x31D900,
            url: 'https://github.com/Talv/sc2-data-trigger/tree/master' + filePath + '#L' + line,
            footer: {
                text: fileName + '#' + line,
            },
        });

        if (metaDesc) {
            const matches = metaDesc.match(/^\*\*([^*]+)\*\*\s*/);
            pembed.title = matches[1];
            pembed.description = metaDesc.substr(matches[0].length);
        }

        pembed.description += '\n```c\n' + this.printer.printNode(node) + '\n```';

        if (node.kind === gt.SyntaxKind.FunctionDeclaration) {
            const argDocs = this.store.s2metadata.getFunctionArgumentsDoc(sym.escapedName);
            if (argDocs) {
                pembed.description += '\n' + argDocs.join('\n');
            }
        }

        return pembed;
    }

    public async run(msg: CommandMessage, args: string[]) {
        await this.loadup();
        const sym = this.store.resolveGlobalSymbol((<any>args).keyword);

        if (!sym) {
            return msg.reply('No results');
        }

        return msg.embed(this.embedSymbol(sym));
    }
}
