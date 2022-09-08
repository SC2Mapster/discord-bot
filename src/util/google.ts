import * as request from 'request-promise-native';
import * as querystring from 'querystring';
import { StatusCodeError } from 'request-promise-native/errors';
import * as cheerio from 'cheerio';
import * as url from 'url';
import * as htmlEntities from 'html-entities';
import puppeteer from 'puppeteer';

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

let mBrowser: puppeteer.Browser;

async function fetchPage(options: SearchOptions) {
    try {
        if (!mBrowser) {
            mBrowser = await puppeteer.launch({
                headless: true,
                args: [
                    `--no-sandbox`,
                    '--disable-setuid-sandbox',
                    `--no-default-browser-check`,
                    `--window-size=1280,800`,
                    `--user-agent=${'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:73.0) Gecko/20100101 Firefox/73.0'}`,
                ],
                ignoreDefaultArgs: [
                    `--enable-automation`,
                ],
                // dumpio: true,
            });
        }
        const bPages = await mBrowser.pages();
        const cpage = bPages.length ? bPages[0] : await mBrowser.newPage();
        const resp = await cpage.goto(`https://${options.host}/search?${querystring.stringify(options.params)}`);
        await cpage.waitForSelector('div[id=search]');
        const result = await resp.text();
        await cpage.close();
        // const result = await session.get({
        //     uri: 'https://' + options.host + '/search',
        //     qs: options.params,
        //     followRedirect: false,
        // });
        return <string>result;
    }
    catch (e) {
        if (e instanceof StatusCodeError) {
            if (e.statusCode == 302) {
                var parsed = url.parse(e.response.headers.location, true);

                if (parsed.pathname !== '/search') {
                    // TODO: captcha
                    // throw new CaptchaError('Captcha');
                    throw e;
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

function sanitize(s: string) {
    s = s.replace(/(^|\s)https?:\/\/([\w+\.]+)/g, '$1');
    return s;
}

function extractResults(body: string) {
    var results: SearchResult[] = [];
    var $ = cheerio.load(body);

    const $list = $('#search .g:not(.mod)');
    $list.each((i) => {
        const $el = $list.eq(i);
        const $elAn = $el.find('div.r >a');

        if (!$elAn.length) return;

        const parsedUrl = url.parse($elAn.attr('href'), true);
        let qurl = parsedUrl.href;

        if (parsedUrl.pathname === '/url') {
            qurl = parsedUrl.query?.q as string ?? '';
        }

        const title = $el.find('div.r >a >h3').text();
        let desc = $el.find('.st')?.html().trim();
        let meta = $el.find('.f')?.html();

        desc = sanitize(desc);
        desc = desc.replace(/\s*<b>[\.]*<\/b>\s*/g, ' ');
        desc = desc.replace(/<\/?(em|b)>/g, '**');
        desc = desc.replace(/\s*<br>\s*/g, ' ');
        desc = ehtml.decode(desc);

        results.push({
            url: qurl,
            title: title,
            desc: desc,
            meta: meta,
        });
    });

    return results;
};
