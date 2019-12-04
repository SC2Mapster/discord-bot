import { Command, CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed, TextChannel, GuildResolvable } from 'discord.js';
import * as discord from 'discord.js';
import * as util from 'util';
import * as mapster from 'sc2mapster-crawler';
import { stripIndents } from 'common-tags';
import { MapsterBot, MapsterCommand } from '../bot';
import { embedProject, embedFile, embedForumThread, prepareEmbedFile, getActiveConnection } from '../util/mapster';
import * as q from '../util/query';

function embedWiki(wres: q.ResultWikiItem) {
    const wembed = new RichEmbed({
        title: wres.title.replace(' - SC2Mapster Wiki', '').replace('/', ' / '),
        description: wres.description,
        url: wres.url,
        color: 0xE37C22,
        footer: {
            text: `SC2Mapster Wiki`,
            icon_url: 'https://media.forgecdn.net/avatars/97/682/636293447593708306.png',
        },
    });
    if (wres.meta) {
        const m = /^(\w+ [0-9]{1,2}, [0-9]{4})\s*\-?$/i.exec(wres.meta)
        if (m) {
            wembed.timestamp = new Date(m[1]);
        }
        else {
            wembed.footer.text += ' • ' + wres.meta;
        }
    }
    return wembed;
}

function numberToEmoji(num: number) {
    switch (num) {
        case 0: return ':zero:';
        case 1: return ':one:';
        case 2: return ':two:';
        case 3: return ':three:';
        case 4: return ':four:';
        case 5: return ':five:';
        case 6: return ':six:';
        case 7: return ':seven:';
        case 8: return ':eight:';
        case 9: return ':nine:';
        case 10: return ':ten:';
        default: return '??';
    }
}

export class QueryCommand extends MapsterCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'query',
            group: 'general',
            memberName: 'query',
            aliases: ['q'],
            description: 'Performs search query over SC2Mapster and displays the result/results.',
            argsType: 'single',
            throttling: {
                usages: 4,
                duration: 60,
            },
            details: stripIndents`
                ---
                *Source* (optional) modifier can limit query to specific area.
                -  \`src:<resource>\` or \`s:<resource>\`
                -  Where \`<resource>\` should be set to one of the constants below:
                -    \`project\` or \`p\` - Projects (Maps/Assets) published on SC2Mapster
                -    \`pfile\` or \`pf\` - Files of the Projects published on SC2Mapster
                -    \`forum\` or \`f\` - Threads & posts published on SC2mapster
                -    \`wiki\` or \`w\` - Wiki pages published on SC2Mapster.gamepedia

                *Limit* (optional) results <count> to given number [1-10] defaults to 5:
                -  \`limit:<count>\` or \`l:<count>\`

                *Index* (optional) modifier to pick result at <index> from the ones that were listed.
                -  \`index:<index>\` or \`i:<index>\`
                ---
            `,
            examples: [
                stripIndents`\`!q src:wiki assets.txt\``,
                stripIndents`\`!q src:pfile insane briefing\``,
                stripIndents`\`!q src:project delphinium modern war\``,
                stripIndents`\`!q pirate kinetics demo\``,
            ],
            deleteOnUserCommandDelete: true,
        });
    }

    isEnabledIn(guild: GuildResolvable) {
        return false;
    }

    public async run(msg: CommandMessage, args: string) {
        msg.channel.startTyping();

        let eraseCmdMessage = false;
        if (args.endsWith('$')) {
            args = args.substring(0, args.length - 1).trimRight();
            if (msg.deletable) {
                eraseCmdMessage = true;
                await msg.delete();
            }
        }

        let rmsg: Message | Message[];
        const conn = await getActiveConnection();
        const results = await q.query(args);
        this.client.log.debug('res', results);
        if (results.length === 0) {
            rmsg = await msg.reply('No results found :(');
        }
        else if (results.length === 1) {
            switch (results[0].kind) {
                case q.ResultItemKind.MapsterProject:
                {
                    const project = await conn.getProjectOverview((<q.ResultProjectItem>results[0]).projectName);
                    rmsg = await msg.embed(embedProject(project));
                    break;
                }
                case q.ResultItemKind.MapsterProjectFile:
                {
                    const pfile = await conn.getProjectFile(
                        (<q.ResultProjectFileItem>results[0]).projectName,
                        (<q.ResultProjectFileItem>results[0]).fileId
                    );
                    rmsg = await msg.embed(await prepareEmbedFile(pfile, (await conn.getProjectImages(pfile.base.name)).images));
                    break;
                }
                case q.ResultItemKind.MapsterWiki:
                {
                    rmsg = await msg.embed(embedWiki(<q.ResultWikiItem>results[0]));
                    break;
                }
                case q.ResultItemKind.MapsterForum:
                {
                    const fthread = await conn.getForumThread(results[0].url)
                    const embed = embedForumThread(fthread);
                    embed.description = results[0].description;
                    rmsg = await msg.embed(embed);
                    break;
                }
                default:
                {
                    throw new Error('unkown result');
                    break;
                }
            }
        }
        else {
            const contentResults: string[] = [];
            for (const [key, item] of results.entries()) {
                // ${numberToEmoji(key + 1)}
                let title = item.title;
                title = title.replace(/\s*(- SC2Mapster Wiki)\s*[\.]*$/, '');
                title = title.replace(/\s*(- SC2Mapster)\s*[\.]*$/, '');
                title = title.replace(/\s*(- SC2 Mapster Forums)\s*[\.]*$/, '');
                let tmp = '. `[' + ['𝟭','𝟮','𝟯','𝟰','𝟱','𝟲','𝟳','𝟴','𝟵'][key] +  ']`';

                // tmp += ' /';
                let ssym = '';
                switch (item.kind) {
                    case q.ResultItemKind.MapsterForum:       ssym += 'f'; break;
                    case q.ResultItemKind.MapsterWiki:        ssym += 'w'; break;
                    case q.ResultItemKind.MapsterProject:     ssym += 'p'; break;
                    case q.ResultItemKind.MapsterProjectFile: ssym += 'a'; break;
                }
                // tmp += '/`';

                // ►
                tmp += ` - [${ssym}: ${title}](${discord.Util.escapeMarkdown(item.url)})`;
                tmp += `\n${item.description}`;
                // if (item.meta) {
                //     tmp += `\n\` — ${item.meta}\``;
                // }
                contentResults.push(tmp);
            }

            let fullResponse = '';
            for (const item of contentResults) {
                if ((fullResponse.length + item.length) >= 2048) break;
                fullResponse += item + '\n';
            }

            rmsg = await msg.say(eraseCmdMessage ? `\`${discord.Util.escapeMarkdown(args)}\`` : '', {
                embed: {
                    description: fullResponse.trim(),
                },
            });
        }
        msg.channel.stopTyping(true);
        return rmsg;
    }
}
