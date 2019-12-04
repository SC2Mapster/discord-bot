import * as sugar from 'sugar';
import * as mapster from 'sc2mapster-crawler';
import { CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed, TextChannel } from 'discord.js';
import * as imgur from 'imgur';
import * as stringSimilarity from 'string-similarity';
import { logger } from '../bot';

const mBaseURL = 'https://www.sc2mapster.com';

let mconn: mapster.MapsterConnection;
process.on('beforeExit', async (code) => {
    if (!mconn) {
        await mconn.close();
        mconn = void 0;
    }
});

export async function getActiveConnection() {
    if (!mconn) {
        mconn = new mapster.MapsterConnection();
        await mconn.setup();
    }
    return mconn;
}

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
        logger.info(`reuploading to imgur`, url)
        try {
            const imgImage = await imgur.uploadUrl(url);
            logger.info(`imgur: ${imgImage.data.link}`)
            return imgImage.data.link;
        }
        catch (e) {
            logger.warn('failed to reupload img', url)
            return;
        }
    }
    return url;
}

function findMatchingFileImage(label: string, images: mapster.ProjectImageItem[]) {
    if (!images.length) return;

    const imMap = new Map<string, mapster.ProjectImageItem>();
    images.forEach((value => {
        imMap.set(value.label, value);
    }));

    const match = stringSimilarity.findBestMatch(label, Array.from(imMap.keys()));

    if (match.bestMatch.rating < 0.6) return null;

    return imMap.get(match.bestMatch.target);
}

async function getLatestProjects(conn: mapster.MapsterConnection, rootCategory: mapster.ProjectSection, since: Date) {
    const results: mapster.ProjectOverview[] = [];

    for await (const item of conn.getProjectsList(rootCategory, (pageInfo, results) => false)) {
        if (item.updatedAt <= since) continue;
        results.push(await conn.getProjectOverview(item.name));
    }

    return results;
}

async function getLatestProjectFiles(conn: mapster.MapsterConnection, projectName: string, since: Date) {
    const results: mapster.ProjectFile[] = [];

    for await (const item of conn.getProjectFilesList(projectName, (pageInfo, results) => false)) {
        if (item.updatedAt <= since) continue;
        results.push(await conn.getProjectFile(projectName, item.id));
    }

    return results;
}

function filterBrokenImages(urls: string[]) {
    return urls.filter(item => !item.startsWith('http://www.sc2mapster.com/media/images'));
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

export async function prepareEmbedFile(pfile: mapster.ProjectFile, pimages: mapster.ProjectImageItem[]) {
    let frontImage = null;
    pfile.description.embeddedImages = filterBrokenImages(pfile.description.embeddedImages);
    if (pfile.description.embeddedImages.length <= 0) {
        const result = findMatchingFileImage(pfile.title, pimages);
        if (result) {
            frontImage = result.imageUrl;
        }
    }
    if (pfile.description.embeddedImages.length) {
        for (const item of Array.from(pfile.description.embeddedImages)) {
            const result = await fixCurseCDNUrlImage(item);
            if (result) {
                frontImage = result;
                break;
            }
            else {
                pfile.description.embeddedImages = pfile.description.embeddedImages.filter(v => v !== item);
            }
        }
    }
    return embedFile(pfile, frontImage);
}

export async function prepareEmbedProject(project: mapster.ProjectOverview) {
    project.description.embeddedImages = filterBrokenImages(project.description.embeddedImages);
    if (project.description.embeddedImages.length) {
        project.description.embeddedImages[0] = await fixCurseCDNUrlImage(project.description.embeddedImages[0]);
    }
    return embedProject(project);
}

export async function embedRecent(refdate: Date) {
    const conn = await getActiveConnection();
    let plist = await getLatestProjects(conn, 'assets', refdate)
    plist = plist.concat(await getLatestProjects(conn, 'maps', refdate));

    const embeds: RichEmbed[] = [];
    let nextRefDate: Date = null;
    for (const project of plist.reverse()) {
        if (project.createdAt > refdate) {
            embeds.push(await prepareEmbedProject(project));
            if (nextRefDate === null || project.createdAt > nextRefDate) {
                nextRefDate = new Date(project.createdAt);
            }
        }
        const pimg = await conn.getProjectImages(project.base.name)
        for (const pfile of (await getLatestProjectFiles(conn, project.base.name, refdate)).reverse()) {
            embeds.push(await prepareEmbedFile(pfile, pimg.images));
            if (nextRefDate === null || pfile.updatedAt > nextRefDate) {
                nextRefDate = new Date(pfile.updatedAt);
            }
        }
    }
    return {
        nextRefDate: nextRefDate,
        embeds: embeds
    };
}

export function embedForumThread(fthread: mapster.ForumThread) {
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
