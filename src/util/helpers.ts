const sanitize = require('sanitize-html');
import { Message } from 'discord.js';

export function buildMap<T>(obj: T) {
    return Object.keys(obj).reduce((map, key) => map.set(key, (<any>obj)[key]), new Map<string, T>());
}

export function* oentries<T>(obj: T) {
    for (const key in obj) {
        yield obj[key];
    }
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function urlOfMessage(msg: Message) {
    return `https://discordapp.com/channels/${msg.guild.id}/${msg.channel.id}/${msg.id}`;
}

export function sanitizeForeignHtml(s: string) {
    s = sanitize(s, {
        allowedTags: [ 'b', 'i', 'em', 'strong', 'li', 'code', 'a' ],
        // TODO: img[src], iframe[yt]
        allowedAttributes: {
            'a': [ 'href' ]
        },
        // allowedIframeHostnames: ['www.youtube.com']
    });
    s = s.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, (org, name, link) => {
        return `[${link}](${name})`;
    });
    s = s.replace(/<\/?(em|b|strong)>/g, '**');
    s = s.replace(/<\/?(i)>/g, '*');
    s = s.replace(/<\/?(code)>/g, '`');
    s = s.replace(/<\/(li)>/g, '\n');
    s = s.replace(/<(li)>/g, ' ► ');
    s = s.replace(/&gt;/g, '>');
    s = s.replace(/&lt;/g, '<');
    return s.trim();
}
