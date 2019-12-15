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
