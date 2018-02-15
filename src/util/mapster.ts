import * as sugar from 'sugar';
import * as mapster from 'sc2mapster-crawler';
import { CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed, TextChannel } from 'discord.js';

const mBaseURL = 'https://www.sc2mapster.com';

export function handleMapsterException(e: Error, msg: CommandMessage) {
    if (e.message.startsWith('Error: HTTP code: ')) {
        return msg.reply((<Error>e).message.substring('Error: '.length));
    }
    else {
        throw e;
    }
}

export function embedProject(project: mapster.ProjectOverview) {
    const pembed = new RichEmbed({
        title: project.title,
        description: sugar.String.truncate(project.description.simplified, 200),
        author: {
            name: project.owner.title,
            icon_url: project.owner.profileThumbUrl,
            url: `${mBaseURL}/members/${project.owner.name}`,
        },
        color: 0xE37C22,
        url: `${mBaseURL}/projects/${project.name}`,
        timestamp: project.updatedAt,
        footer: {
            text: `Projects / ${project.rootCategory}`,
            icon_url: 'https://media.forgecdn.net/avatars/97/682/636293447593708306.png',
        },
        fields: [
            {
                name: 'Categories',
                value: project.categories.map((item) => {
                    return item.name;
                }).join(' **|** '),
                inline: true,
            },
            {
                name: 'Downloads',
                value: sugar.Number.abbr(project.totalDownloads, 1),
                inline: true,
            },
        ],
    });
    if (project.thumbnail) {
        pembed.thumbnail = {
            url: project.thumbnail,
        };
    }
    if (project.description.embeddedImages.length) {
        pembed.image = {
            url: project.description.embeddedImages[0],
        }
    }
    return pembed;
}

export function embedFile(pfile: mapster.ProjectFile) {
    const pembed = new RichEmbed({
        title: pfile.title,
        description: sugar.String.truncate(pfile.description.simplified, 120),
        author: {
            name: pfile.uploadedBy.title,
            icon_url: pfile.uploadedBy.profileThumbUrl,
            url: `${mBaseURL}/members/${pfile.uploadedBy.name}`,
        },
        color: 0xE37C22,
        url: `${mBaseURL}/projects/${pfile.projectName}/files/${pfile.id}`,
        timestamp: pfile.updatedAt,
        footer: {
            text: `${pfile.filename}`,
            icon_url: 'https://media.forgecdn.net/avatars/97/682/636293447593708306.png',
        },
        fields: [
            // {
            //     name: 'Filename',
            //     value: pfile.filename,
            //     inline: true,
            // },
            {
                name: 'Size',
                value: pfile.size,
                inline: true,
            },
            {
                name: 'Downloads',
                value: sugar.Number.abbr(pfile.downloads, 1),
                inline: true,
            },
        ],
    });
    if (pfile.description.embeddedImages.length) {
        pembed.image = {
            url: pfile.description.embeddedImages[0],
        }
    }
    return pembed;
}

export async function embedRecent(refdate: Date) {
    let plist = await mapster.getLatestProjects('assets', refdate)
    plist = plist.concat(await mapster.getLatestProjects('maps', refdate));
    const embeds: RichEmbed[] = [];
    for (const project of plist.reverse()) {
        if (project.createdAt > refdate) {
            embeds.push(embedProject(project));
        }
        for (const pfile of (await mapster.getLatestProjectFiles(project.name, refdate)).reverse()) {
            embeds.push(embedFile(pfile));
        }
    }
    return embeds;
}
