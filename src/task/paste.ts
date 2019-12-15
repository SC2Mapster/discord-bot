import * as request from 'request-promise';
import { Task } from '../registry';
import { FileOptions } from 'discord.js';
import { logger } from '../bot';

export class PasteTask extends Task {
    async load() {
        this.client.on('message', async (msg) => {
            if (msg.author.bot) return;
            if (msg.type !== 'DEFAULT') return;
            if (msg.channel.type !== 'text') return;

            const hasteRE = /(?:^|\s+)(https?:\/\/(?:hastebin\.com|hasteb\.in|pastie\.io))\/([\w]+)(\.[\.\w]+)?\s*/gm;
            let m: RegExpMatchArray;
            const files = new Map<string, string>();

            while (m = hasteRE.exec(msg.cleanContent)) {
                const uri = `${m[1]}/raw/${m[2]}`;
                try {
                    const text = await request.get(uri);
                    files.set(m[2] + (m[3] ? m[3] : ''), text);
                }
                catch (e) {
                    logger.error(e);
                }
            }

            if (files.size) {
                const opts = {
                    files: <FileOptions[]>[],
                };
                for (const [name, text] of files) {
                    opts.files.push({
                        name: name,
                        attachment: new Buffer(text),
                    });
                }
                await msg.channel.send(`mirror`, opts);
            }
        });
    }
}
