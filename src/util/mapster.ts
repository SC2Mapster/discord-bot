import * as sugar from 'sugar';
import * as mapster from 'sc2mapster-crawler';
import { CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed, TextChannel } from 'discord.js';
import { ForumThread } from 'sc2mapster-crawler/lib/scrapper/project';
import * as imgur from 'imgur';

const mBaseURL = 'https://www.sc2mapster.com';

export function handleMapsterException(e: Error, msg: CommandMessage) {
    if (e.message.startsWith('Error: HTTP code: ')) {
        return msg.reply((<Error>e).message.substring('Error: '.length));
    }
    else {
        throw e;
    }
}

async function fixCurseCDNUrlImage(url: string) {
    if (/^https:\/\/media\.forgecdn\.net\/attachments\/.+/.test(url)) {
        const imgImage = await imgur.uploadUrl(url);
        return imgImage.data.link;
    }
    return url;
}

export function embedProject(project: mapster.ProjectOverview) {
    const pembed = new RichEmbed({
        title: project.base.title,
        description: sugar.String.truncate(project.description.simplified, 200),
        author: {
            name: project.owner.title,
            icon_url: project.owner.profileThumbUrl,
            url: `${mBaseURL}/members/${project.owner.name}`,
        },
        color: 0xE37C22,
        url: `${mBaseURL}/projects/${project.base.name}`,
        timestamp: project.updatedAt,
        footer: {
            text: `Projects / ${project.base.rootCategory}`,
            icon_url: 'https://media.forgecdn.net/avatars/97/682/636293447593708306.png',
        },
        fields: [
            {
                name: 'Categories',
                value: project.categories.map((item) => {
                    return item.name;
                }).join(' **—** '),
                // inline: true,
            },
            // {
            //     name: 'Downloads',
            //     value: sugar.Number.abbr(project.totalDownloads, 1),
            //     inline: true,
            // },
        ],
    });
    if (project.base.thumbnail) {
        pembed.thumbnail = {
            url: project.base.thumbnail,
        };
    }
    if (project.description.embeddedImages.length) {
        pembed.image = {
            url: project.description.embeddedImages[0],
        }
    }
    return pembed;
}

export function embedFile(pfile: mapster.ProjectFile, frontImage?: string) {
    const pembed = new RichEmbed({
        title: pfile.title,
        description: sugar.String.truncate(pfile.description.simplified, 160),
        author: {
            name: pfile.uploadedBy.title,
            icon_url: pfile.uploadedBy.profileThumbUrl,
            url: `${mBaseURL}/members/${pfile.uploadedBy.name}`,
        },
        color: 0xE37C22,
        url: `${mBaseURL}/projects/${pfile.base.name}/files/${pfile.id}`,
        timestamp: pfile.updatedAt,
        footer: {
            text: `${pfile.base.rootCategory} / ${pfile.base.title}`,
            icon_url: 'https://media.forgecdn.net/avatars/97/682/636293447593708306.png',
        },
        fields: [
            // {
            //     name: 'Filename',
            //     value: pfile.filename,
            //     inline: true,
            // },
            // {
            //     name: 'Size',
            //     value: pfile.size,
            //     inline: true,
            // },
            // {
            //     name: 'Downloads',
            //     value: sugar.Number.abbr(pfile.downloads, 1),
            //     inline: true,
            // },
        ],
    });
    if (pfile.base.thumbnail) {
        pembed.thumbnail = {
            url: pfile.base.thumbnail,
        };
    }
    if (frontImage) {
        pembed.image = {
            url: frontImage,
        }
    }
    else if (pfile.description.embeddedImages.length) {
        pembed.image = {
            url: pfile.description.embeddedImages[0],
        }
    }
    return pembed;
}

export async function prepareEmbedFile(pfile: mapster.ProjectFile) {
    let frontImage = null;
    if (pfile.description.embeddedImages.length <= 0) {
        const imPage = await mapster.getProjectImages(pfile.base.name)
        const result = mapster.findMatchingFileImage(pfile.title, imPage.images);
        if (result) {
            frontImage = result.imageUrl;
        }
    }
    if (pfile.description.embeddedImages.length) {
        pfile.description.embeddedImages[0] = await fixCurseCDNUrlImage(pfile.description.embeddedImages[0]);
    }
    return embedFile(pfile, frontImage);
}

export async function prepareEmbedProject(project: mapster.ProjectOverview) {
    if (project.description.embeddedImages.length) {
        project.description.embeddedImages[0] = await fixCurseCDNUrlImage(project.description.embeddedImages[0]);
    }
    return embedProject(project);
}

export async function embedRecent(refdate: Date) {
    let plist = await mapster.getLatestProjects('assets', refdate)
    plist = plist.concat(await mapster.getLatestProjects('maps', refdate));
    const embeds: RichEmbed[] = [];
    for (const project of plist.reverse()) {
        if (project.createdAt > refdate) {
            embeds.push(await prepareEmbedProject(project));
        }
        for (const pfile of (await mapster.getLatestProjectFiles(project.base.name, refdate)).reverse()) {
            embeds.push(await prepareEmbedFile(pfile));
        }
    }
    return embeds;
}

export function embedForumThread(fthread: ForumThread) {
    const embed = new RichEmbed({
        title: fthread.title,
        description: sugar.String.truncate(fthread.posts[0].content.simplified, 120),
        author: {
            name: fthread.posts[0].author.title,
            icon_url: fthread.posts[0].author.profileThumbUrl,
            url: `${mBaseURL}/members/${fthread.posts[0].author.name}`,
        },
        color: 0xE37C22,
        url: fthread.url,
        timestamp: fthread.posts[0].date,
        footer: {
            text: `SC2Mapster Forum / ${fthread.categoryBreadcrumb.join(' / ')}`,
            icon_url: 'https://media.forgecdn.net/avatars/97/682/636293447593708306.png',
        },
    });
    if (fthread.posts[0].content.embeddedImages.length) {
        embed.image = {
            url: fthread.posts[0].content.embeddedImages[0],
        }
    }
    return embed;
}
