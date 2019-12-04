import * as url from 'url';
import * as google from './google';
import * as request from 'request-promise';
import * as cheerio from 'cheerio';
import * as stringSimilarity from 'string-similarity';

export enum SourceKind {
    Any,
    MapsterProject,
    MapsterProjectFile,
    MapsterForum,
    Wiki,
};

export type QueryParams = {
    phrase: string;
    src: SourceKind;
    limit?: number;
    resultIndex?: number;
};

function clamp(num: number, min: number, max: number) {
    return num <= min ? min : num >= max ? max : num;
}

function parseOp(qp: QueryParams, key: string, value: string) {
    switch (key) {
        case 'src':
        case 's':
        {
            if (value === 'p' || value === 'project') return qp.src = SourceKind.MapsterProject;
            else if (value === 'pf' || value === 'pfile') return qp.src = SourceKind.MapsterProjectFile;
            else if (value === 'f' || value === 'forum') return qp.src = SourceKind.MapsterForum;
            else if (value === 'w' || value === 'wiki') return qp.src = SourceKind.Wiki;
            else break;
        }

        case 'limit':
        case 'l':
        {
            return qp.limit = clamp(Number(value), 1, 6);
        }

        case 'index':
        case 'i':
        {
            return qp.resultIndex = Number(value);
        }
    }
}

export function parseQuery(query: string) {
    const qp: QueryParams = {
        src: SourceKind.Any,
        phrase: query,
        limit: 10,
    };

    const opsRE = /(\w+):(\w+)/g;
    let m: RegExpExecArray;
    while (m = opsRE.exec(query)) {
        parseOp(qp, m[1], m[2]);
        qp.phrase = qp.phrase.replace(m[0], '');
    }

    qp.phrase = qp.phrase.trim();

    return qp;
}

export enum ResultItemKind {
    Unknown,
    MapsterProject,
    MapsterProjectFile,
    MapsterForum,
    MapsterWiki,
};

export interface ResultItem {
    kind: ResultItemKind,
    title: string;
    description: string;
    meta?: string;
    url: string;
};

export interface ResultProjectItem extends ResultItem {
    kind: ResultItemKind.MapsterProject;
    projectName: string;
};

export interface ResultProjectFileItem extends ResultItem {
    kind: ResultItemKind.MapsterProjectFile;
    projectName: string;
    fileId: number;
};

export interface ResultForumItem extends ResultItem {
    kind: ResultItemKind.MapsterWiki;
    categoryPath: string;
    threadId: number;
    titlePath: string;
};

export interface ResultWikiItem extends ResultItem {
    kind: ResultItemKind.MapsterWiki;
};

export async function executeQuery(params: QueryParams) {
    let res: ResultItem[] = [];
    let qstring: string[] = [];

    switch (params.src) {
        case SourceKind.Any: qstring.push('sc2mapster'); break;
        case SourceKind.MapsterProject: qstring.push('site:sc2mapster.com inurl:projects -inurl:files'); break;
        case SourceKind.MapsterProjectFile: qstring.push('site:sc2mapster.com inurl:projects inurl:files'); break;
        case SourceKind.MapsterForum: qstring.push('site:sc2mapster.com inurl:forums'); break;
        case SourceKind.Wiki: qstring.push('site:sc2mapster.gamepedia.com'); break;
    }
    qstring.push(params.phrase);
    // intitle:"SC2Mapster Wiki"
    const gresults = await google.search(qstring.join(' '));
    for (const item of gresults) {
        let resItem: ResultItem = {
            kind: ResultItemKind.Unknown,
            title: item.title,
            description: item.desc,
            meta: item.meta,
            url: item.url,
        };
        const urlInfo = url.parse(item.url);

        if (urlInfo.host === 'www.sc2mapster.com') {
            let m: RegExpExecArray;

            if (m = /^\/projects\/([\w-]+)$/i.exec(urlInfo.pathname)) {
                resItem.kind = ResultItemKind.MapsterProject;
                (<ResultProjectItem>resItem).projectName = m[1];
            }
            else if (m = /^\/projects\/([\w-]+)\/files\/([0-9]+)$/i.exec(urlInfo.pathname)) {
                resItem.kind = ResultItemKind.MapsterProjectFile;
                (<ResultProjectFileItem>resItem).projectName = m[1];
                (<ResultProjectFileItem>resItem).fileId = Number(m[2]);
            }
            // project file listing
            else if (m = /^\/projects\/([\w-]+)\/files(\?.+)?$/i.exec(urlInfo.pathname)) {
                const fileMap = new Map<string, number>();

                const response = await request.get(item.url, {followRedirect: true});
                const $ = cheerio.load(response);
                $('.project-file-name-container >a').each((index, item) => {
                    const $el = $(item);
                    const m = $el.attr('href').match(/\/files\/([0-9]+)$/);
                    fileMap.set($el.html().trim(), Number(m[1]));
                });

                const siMatch = stringSimilarity.findBestMatch(params.phrase, Array.from(fileMap.keys()));
                if (siMatch.bestMatch.rating < 0.3) continue;

                resItem.kind = ResultItemKind.MapsterProjectFile;
                (<ResultProjectFileItem>resItem).projectName = m[1];
                (<ResultProjectFileItem>resItem).fileId = fileMap.get(siMatch.bestMatch.target);
                resItem.title = resItem.title.replace(/^Files/, siMatch.bestMatch.target);
                resItem.description = '';

                urlInfo.pathname = `/projects/${(<ResultProjectFileItem>resItem).projectName}/files/${(<ResultProjectFileItem>resItem).fileId}`;
                urlInfo.query = '';
                urlInfo.search = '';
                resItem.url = url.format(urlInfo);
            }
            else if (m = /^\/forums\/([\D\/]+)(\d+)\-([\w\-]+)$/i.exec(urlInfo.pathname)) {
            // else if (m = /^\/forums\/((?:\/?[\w\-]+)+)\/(\d+)\-([\w\-]+)/ig.exec(urlInfo.pathname)) {
                resItem.kind = ResultItemKind.MapsterForum;
                (<ResultForumItem>resItem).categoryPath = m[1];
                (<ResultForumItem>resItem).threadId = Number(m[2]);
                (<ResultForumItem>resItem).titlePath = m[3];
            }
            else continue;
        }
        else if (urlInfo.host === 'sc2mapster.gamepedia.com') {
            resItem.kind = ResultItemKind.MapsterWiki;
        }
        else {
            continue;
        }

        res.push(resItem);

        if (params.limit && res.length >= params.limit) break;
    }

    if (params.resultIndex && params.resultIndex > 0 && params.resultIndex <= res.length) {
        res = res.slice(params.resultIndex - 1, params.resultIndex);
    }

    return res;
}

export async function query(query: string) {
    return await executeQuery(parseQuery(query));
}
