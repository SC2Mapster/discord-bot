import * as request from 'request-promise-native';
import { Task } from '../registry';
import { FileOptions, Message, PartialMessage } from 'discord.js';
import { logger } from '../bot';

interface PasteEntry {
    originalMsg: Message;
    mirrorMsg: Message;
    files: FileOptions[];
}

export class PasteTask extends Task {
    protected entries = new Map<string, PasteEntry>();
    protected pclTimeoutMs = 1000 * 60 * 3600;
    protected nclTimer: NodeJS.Timeout;

    async load() {
        this.client.on('message', this.onMessage.bind(this));
        this.client.on('messageUpdate', this.onMessageUpdate.bind(this));
        this.client.on('messageDelete', this.onMessageDelete.bind(this));

        this.periodicClean();
    }

    protected async mirrorMessage(msg: Message) {
        const hasteRE = /(?:^|\s+|<)(https?:\/\/(?:hastebin\.com|hasteb\.in|pastie\.io))\/([\w]+)(\.[\.\w]+)?\s*/gm;
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
                    attachment: Buffer.from(text),
                });
            }

            const mirrorMsg = await msg.channel.send(`mirror`, opts);
            this.entries.set(msg.id, {
                originalMsg: msg,
                mirrorMsg: mirrorMsg,
                files: opts.files,
            });
        }
    }

    async onMessage(msg: Message) {
        if (msg.author.bot) return;
        if (msg.type !== 'DEFAULT') return;
        if (msg.channel.type !== 'text') return;

        await this.mirrorMessage(msg);
    }

    async onMessageUpdate(oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) {
        const currEntry = this.entries.get(oldMsg.id);
        if (!currEntry || currEntry.originalMsg.id !== oldMsg.id) return;

        if (newMsg.channel.lastMessage !== currEntry.mirrorMsg) return;

        if (currEntry.mirrorMsg.deletable) {
            await currEntry.mirrorMsg.delete();
        }
        await this.mirrorMessage(await newMsg.fetch());
    }

    async onMessageDelete(msgDeleted: Message | PartialMessage) {
        const currEntry = this.entries.get(msgDeleted.id);
        if (!currEntry || currEntry.originalMsg.id !== msgDeleted.id) return;
        this.entries.delete(msgDeleted.id);
        await currEntry.mirrorMsg.delete();
    }

    async periodicClean() {
        for (const [k, v] of this.entries) {
            if (v.originalMsg.createdTimestamp <= (Date.now() - this.pclTimeoutMs)) {
                this.entries.delete(k);
            }
        }

        if (this.nclTimer) {
            clearTimeout(this.nclTimer);
            this.nclTimer = void 0;
            // TODO: test if should quit
        }
        this.nclTimer = setTimeout(this.periodicClean.bind(this), this.pclTimeoutMs / 6);
    }
}
