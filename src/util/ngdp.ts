import * as request from 'request-promise';

// https://wowdev.wiki/CASC
// Next Generation Download Protocol

export type NGDPRegion = 'us' | 'eu' | 'cn' | 'kr' | 'tw';

// CDNS
// Name!STRING:0|Path!STRING:0|Hosts!STRING:0|ConfigPath!STRING:0|Servers!STRING:0
// us|tpr/sc2|blzddist1-a.akamaihd.net level3.blizzard.com|tpr/configs/data|

export type NGDPCDNKey = 'Name'
    | 'Path'
    | 'Hosts'
    | 'ConfigPath'
    | 'Servers'
;

// Versions
// Region!STRING:0|BuildConfig!HEX:16|CDNConfig!HEX:16|KeyRing!HEX:16|BuildId!DEC:4|VersionsName!String:0|ProductConfig!HEX:16
// us|a5ba0ab03a9e4921bc1765ca313b29c7|ec7595e48f5a1b8a7f04cee7f93eab08|3b938eed7536396b1d7a000ca9b2cd39|61545|4.1.4.61545|

export type NGDPVersionKey = 'Region'
    | 'BuildConfig'
    | 'CDNConfig'
    | 'KeyRing'
    | 'BuildId'
    | 'VersionsName'
    | 'ProductConfig'
;

export function parseNGDPTable<T extends string>(data: string) {
    let headNames: string[] = null;
    let result = <ReadonlyMap<T, string>[]>[];
    for (const line of data.split('\n')) {
        let matches: RegExpMatchArray;
        if (!headNames) {
            headNames = [];
            const rgx = /(?:^|\|)([^!]+)!([^|]+)/g;
            while (matches = rgx.exec(line)) {
                headNames.push(matches[1]);
            }
        }
        else {
            const rgx = /(?:^|\|)([^|]+)/g;
            let i = 0;
            const entry = new Map<T, string>();
            while (matches = rgx.exec(line)) {
                entry.set(<T>headNames[i++], matches[1]);
            }
            if (i > 0) {
                result.push(entry);
            }
        }
    }
    return result;
}

export type NGDPResource = 'cdns'
    | 'versions'
    | 'bgdl'
    | 'blobs'
    | 'blob/game'
    | 'blob/install'
;

export async function getResource(res: NGDPResource): Promise<string> {
    return await request.get(`http://us.patch.battle.net:1119/s2/${res}`);
}

export async function getVersionInfo() {
    return parseNGDPTable<NGDPVersionKey>(await getResource('versions'));
}
