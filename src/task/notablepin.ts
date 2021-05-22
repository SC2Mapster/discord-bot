import { Task } from '../registry';
import { MessageReaction, User, PartialUser } from 'discord.js';

export class NotablePinTask extends Task {
    protected async isMemberEligible(msgReaction: MessageReaction, author: User | PartialUser) {
        if (msgReaction.message.channel.type !== 'text') return false;
        if (msgReaction.emoji.name !== 'pinmessage') return false;

        const member = await msgReaction.message.guild.members.fetch(author.id);
        if (!member.permissionsIn(msgReaction.message.channel).has('SEND_MESSAGES')) return false;

        const isNotable = Array.from(member.roles.cache.values()).find(v => v.name === 'Notable Members');
        return isNotable;
    }

    async load() {
        this.client.on('messageReactionAdd', async (msgReaction, author) => {
            if (!(await this.isMemberEligible(msgReaction, author))) return;
            if (!msgReaction.message.pinned && msgReaction.message.pinnable) {
                await msgReaction.message.pin();
                await msgReaction.message.channel.send({
                    content: `Message ${msgReaction.message.id} has been pinned!`,
                    reply: author.id
                })
            }
        })

        this.client.on('messageReactionRemove', async (msgReaction, author) => {
            if (!(await this.isMemberEligible(msgReaction, author))) return;
            if (msgReaction.count > 0) return;
            if (msgReaction.message.pinned && msgReaction.message.pinnable) {
                await msgReaction.message.unpin();
                await msgReaction.message.channel.send({
                    content: `Message ${msgReaction.message.id} has been unpinned!`,
                    reply: author.id
                })
            }
        })
    }
}
