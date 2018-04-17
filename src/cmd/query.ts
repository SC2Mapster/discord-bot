import { Command, CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed, TextChannel } from 'discord.js';
import * as util from 'util';
import * as mapster from 'sc2mapster-crawler';
import { stripIndents } from 'common-tags';
import { MapsterBot, MapsterCommand } from '../bot';
import { embedProject, embedFile, embedForumThread, prepareEmbedFile } from '../util/mapster';
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

                *Limit* (optional) results <count> to given number [1-10]:
                -  \`limit:<count>\` or \`l:<count>\`
                -  NOT YET IMPLEMENTED

                *Index* (optional) modifier to pick result at <index> from the ones that were listed.
                -  \`index:<index>\` or \`i:<index>\`
                -  NOT YET IMPLEMENTED
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

    public async run(msg: CommandMessage, args: string) {
        msg.channel.startTyping();
        let rmsg: Message | Message[];
        const results = await q.query(args);
        this.client.log.debug('res', results);
        if (results.length === 0) {
            rmsg = await msg.reply('No results found :(');
        }
        else if (results.length === 1) {
            switch (results[0].kind) {
                case q.ResultItemKind.MapsterProject:
                {
                    const project = await mapster.getProject((<q.ResultProjectItem>results[0]).projectName);
                    rmsg = await msg.embed(embedProject(project));
                    break;
                }
                case q.ResultItemKind.MapsterProjectFile:
                {
                    const pfile = await mapster.getProjectFile(
                        (<q.ResultProjectFileItem>results[0]).projectName,
                        (<q.ResultProjectFileItem>results[0]).fileId
                    );
                    rmsg = await msg.embed(await prepareEmbedFile(pfile));
                    break;
                }
                case q.ResultItemKind.MapsterWiki:
                {
                    rmsg = await msg.embed(embedWiki(<q.ResultWikiItem>results[0]));
                    break;
                }
                case q.ResultItemKind.MapsterForum:
                {
                    const fthread = await mapster.getForumThread(results[0].url)
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
            rmsg = await msg.reply(`r: ${results.length}`);
        }
        msg.channel.stopTyping(true);
        return rmsg;
    }
}
