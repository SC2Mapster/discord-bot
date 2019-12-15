import { Task } from '../registry';
import { MessageReaction, User } from 'discord.js';

export class MapsterCommonTask extends Task {
    async load() {
        this.client.on('message', async (msg) => {
            // #showcase
            if (msg.channel.id === '410424727484628993') {
                await msg.react('⬆');
                await msg.react('⬇');
            }
        });

        this.client.on('messageReactionAdd', async (msgReaction) => {
            if (msgReaction.message.channel.type !== 'text') return;
            const srcUser = (await msgReaction.fetchUsers(1)).first();
            if (srcUser.tag !== 'Talv#5917') return;
            if (msgReaction.emoji.name === '❔') {
                await msgReaction.remove(srcUser);
                await msgReaction.message.reply(`Ask your question straight away, then people might answer. Don't ask if you're allowed to ask a question; don't ask if there are any individuals who can guide you. It's redundant step, that only drives you further away from getting your problem solved.`);
            }
        });
    }
}
