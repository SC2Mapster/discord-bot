import { Task } from '../registry';
import { MessageReaction, User } from 'discord.js';

export class MapsterCommonTask extends Task {
    async load() {
        this.client.on('message', async (msg) => {
            // #showcase
            if (msg.channel.id === '410424727484628993') {
                await msg.react('⭐');
            }
        });
    }
}
