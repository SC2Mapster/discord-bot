import { Message, MessageEmbed, GuildMember, TextChannel, User, Channel, DiscordAPIError, PartialMessage } from 'discord.js';
import { CommandoMessage } from 'discord.js-commando';
import { MapsterBot, AdminCommand, ModCommand, MapsterCommand, logger } from './bot';
import { imgurAlbumDirectLink } from './util/imgurExtra';
import { parseMdPayload } from './util/richmd';

export function urlOfMessage(msg: Message) {
    return `https://discordapp.com/channels/${msg.guild.id}/${msg.channel.id}/${msg.id}`;
}

export async function fixIUrl(s: string) {
    s = s.replace(/^<?(.*)>?$/, '$1');
    s = s.replace(/^(https?:\/\/)(imgur.com\/)(\w+)$/i, '$1i.$2$3.jpg');
    const match = s.match(/^(https?:\/\/)(imgur.com\/a\/)(\w+)$/i)
    if (match) {
        s = await imgurAlbumDirectLink(s);
    }
    return s;
}

export async function buildComplexMessage(input: string, author?: GuildMember) {
    const mData = parseMdPayload(input, false);

    const embed = new MessageEmbed({
        footer: {},
    });
    let content = '';

    if (author) {
        embed.setAuthor(author.displayName, author.user.defaultAvatarURL);
    }
    else if (mData.meta && mData.meta['author_name']) {
        embed.setAuthor(mData.meta['author_name']);
        if (mData.meta['author_icon']) embed.author.iconURL = await fixIUrl(mData.meta['author_icon']);
        if (mData.meta['author_url']) embed.author.url = mData.meta['author_url'];
    }

    if (mData.fields.length) {
        embed.title = mData.fields[0].title;
        embed.description = mData.fields[0]?.content ?? ' ';

        mData.fields = mData.fields.slice(1);
        for (const field of mData.fields) {
            embed.addField(field.title, field?.content ?? ' ');
        }
    }

    if (mData.meta['image']) embed.setImage(await fixIUrl(mData.meta['image']));
    if (mData.meta['icon']) embed.setThumbnail(await fixIUrl(mData.meta['icon']));
    if (mData.meta['url']) embed.setURL(mData.meta['url']);
    if (mData.meta['footer_text']) embed.footer.text = mData.meta['footer_text'];
    if (mData.meta['footer_icon']) embed.footer.iconURL = await fixIUrl(mData.meta['footer_icon']);
    if (mData.meta['color']) embed.setColor(parseInt(mData.meta['color'], 16));

    if (mData.meta['discord']) {
        content += `${mData.meta['discord']}`;
    }

    return {
        mData,
        content,
        embed,
    };
}
