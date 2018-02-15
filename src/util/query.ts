import * as url from 'url';
import * as google from './google';

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
            return qp.limit = Number(value);
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
        limit: 1,
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
    const res: ResultItem[] = [];
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

    return res;
}

export async function query(query: string) {
    return await executeQuery(parseQuery(query));
}
