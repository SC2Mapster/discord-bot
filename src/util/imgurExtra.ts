import * as request from 'request-promise-native';
import { StatusCodeError } from 'request-promise-native/errors';
import * as cheerio from 'cheerio';

export async function imgurAlbumDirectLink(albumURL: string) {
    const result = await request.get({
        uri: albumURL,
        followRedirect: true,
    }) as string;
    const $ = cheerio.load(result);
    return $('head link[rel="image_src"]').attr('href') ?? albumURL;
}
