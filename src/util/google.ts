import * as request from 'request-promise';
import * as cheerio from 'cheerio';
import * as url from 'url';
import * as htmlEntities from 'html-entities';
import { StatusCodeError } from 'request-promise/errors';

const ehtml = new htmlEntities.Html5Entities();

export type SearchOptions = {
    host?: string;
    query?: number;
    params?: {
        q?: string;
        start?: number;
        hl?: string;
        lr?: string;
    },
};

const session = request.defaults({
    jar: true,
});

let defaultOptions: SearchOptions = {
    host: 'www.google.pl',
    params: {
        start: 0,
        hl: 'en',
        lr: 'lang_en',
    }
};

export async function search(query: string) {
    const options = Object.assign({}, defaultOptions);
    // let solver = options.solver;
    let results: SearchResult[] = [];

    options.params.q = query;

    try {
        const body = await fetchPage(options);
        results = results.concat(extractResults(body));
    }
    catch (e) {
        throw e;
        // TODO: captcha solving
    }

    return results;
}

class CaptchaError extends Error {
    constructor(m: string) {
        super(m);
    }
}

async function fetchPage(options: SearchOptions) {
    try {
        const result = await session.get({
            uri: 'https://' + options.host + '/search',
            qs: options.params,
            followRedirect: false,
        });
        return <string>result;
    }
    catch (e) {
        if (e instanceof StatusCodeError) {
            if (e.statusCode == 302) {
                var parsed = url.parse(e.options.headers.location, true);

                if (parsed.pathname !== '/search') {
                    // TODO: captcha
                    throw new CaptchaError('Captcha');
                }
            }
        }
        throw e;
    }
}

export type SearchResult = {
    title: string;
    url: string;
    desc: string;
    meta?: string;
};

function extractResults(body: string) {
    var results: SearchResult[] = [];
    var $ = cheerio.load(body);

    const $list = $('#search .g:not(.mod)');
    $list.each((i) => {
        const $el = $list.eq(i);
        const $elAn = $el.find('h3 a');

        if (!$elAn.length) return;

        const parsedUrl = url.parse($elAn.attr('href'), true);

        if (parsedUrl.pathname !== '/url') {
            return;
        }

        let desc = $el.find('.st').html().trim();
        let meta: string;
        const m = /^([0-9]{1,2},? \w+ [0-9]{4})\s*/i.exec(desc)
        if (m) {
            meta = m[1];
            desc = desc.substr(m[0].length);
            // desc = desc.replace(/^<span class="f">[^\<]*<\/span>/, '');
        }
        desc = desc.replace(/\s*<b>[\.]*<\/b>\s*/g, ' ');
        desc = desc.replace(/<\/?(em|b)>/g, '**');
        desc = desc.replace(/\s*<br>\s*/g, ' ');
        desc = ehtml.decode(desc);

        results.push({
            url: <string>parsedUrl.query.q,
            title: $elAn.text(),
            desc: desc.trim(),
            meta: meta,
        });
    });

    return results;
};
