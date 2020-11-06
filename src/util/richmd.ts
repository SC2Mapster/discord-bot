interface MdNamedEntry {
    title: string;
    content?: string;
}

interface MdPayload {
    fields: MdNamedEntry[];
    meta: {[name: string]: string};
}

const reFrontmatterBlock = /^(?:---|```|📥📥)\n((?:(?!-).+\n)*)(?:---|```|📤📤)/;
const reFrontmatterBlockNoOpening = /^((?:(?!-).+\n)*)(?:---|```|📤📤)/;
const reFrontmatterValue = /^([\w\d]+)\s*=\s*(.+)$/;
const reEntryHead = /(?:^|\n+)(#+) ([^\n]+)(?:\n|$)/;
const reEntryContent = /^\n?((?!#)[^]+?)(?:\n#+ |$)/;

export function parseMdPayload(input: string, strict = true) {
    const mContent: MdPayload = {
        fields: [],
        meta: {},
    };
    let buff = input.replace(/^```(?:[\w]+\n)?((?:.*\n*)+)(?=```$)```$/, '$1').trimLeft();

    let fmatches = buff.match(reFrontmatterBlock);
    if (!fmatches && !strict) {
        fmatches = buff.match(reFrontmatterBlockNoOpening);
    }

    if (fmatches) {
        for (const fline of fmatches[1].split('\n')) {
            const fbm = fline.match(reFrontmatterValue);
            if (!fbm) continue;
            mContent.meta[fbm[1].toLowerCase()] = fbm[2];
        }
        if (!strict && Object.keys(mContent.meta).length === 0) {
            // do nothing
        }
        else {
            buff = buff.substr(fmatches[0].length).trimLeft();
        }
    }

    let matches: RegExpMatchArray;

    matches = buff.match(reEntryContent);
    if (matches) {
        mContent.fields.push({
            title: '',
            content: matches[1].trimRight(),
        });
        buff = buff.substr(matches[1].length);
    }

    while (matches = buff.match(reEntryHead)) {
        const entry: MdNamedEntry = {
            title: matches[2],
        };
        mContent.fields.push(entry);
        buff = buff.substr(matches[0].length);

        matches = buff.match(reEntryContent);
        if (!matches) continue;
        entry.content = matches[1].trimRight();

        buff = buff.substr(matches[1].length);
    }

    return mContent;
}
