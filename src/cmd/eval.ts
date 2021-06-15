import * as util from 'util';
import { Command, CommandoMessage } from 'discord.js-commando';
import { Message, Util } from 'discord.js';
import { MapsterBot, RootOwnerCommand } from '../bot';
import { stripIndents } from 'common-tags';

const nl = '!!NL!!';
const nlPattern = new RegExp(nl, 'g');

function escapeRegex(str: string) {
	return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

export class EvalCommand extends RootOwnerCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'eval',
            group: 'admin',
            memberName: 'eval',
            description: '',
            args: [
                {
                    key: 'script',
                    prompt: 'What code would you like to evaluate?',
                    type: 'string'
                }
            ]
        });
    }

    async run(msg: CommandoMessage, args: { script: string }) {
        const workingReaction = await msg.react('⏳');
        try {
            if (args.script.startsWith('```') && args.script.endsWith('```')) {
                args.script = args.script.replace(/(^.*?\s)|(\n.*$)/g, '');
            }

            let hrDiff: [number, number];
            let evalResult: any;
            try {
                // helpers
                const client = msg.client;
                const message = msg;
                // helpers
                const hrStart = process.hrtime();
                evalResult = eval(args.script);
                if (util.types.isPromise(evalResult)) {
                    evalResult = await evalResult;
                }
                hrDiff = process.hrtime(hrStart);
            }
            catch (err) {
                return msg.reply(`Error while evaluating: \`${err}\``);
            }

            const result = this.makeResultMessages(evalResult, hrDiff);
            if (Array.isArray(result)) {
                const rmsgs: Message[] = [];
                for (const item of result) {
                    rmsgs.push(await msg.reply(item));
                }
                return rmsgs;
            }
            else {
                return msg.reply(result);
            }
        }
        finally {
            await workingReaction.remove();
        }
    }

    makeResultMessages(result: any, hrDiff: [number, number]) {
        const inspected = util.inspect(result, { depth: 0 })
            .replace(nlPattern, '\n')
            .replace(this.sensitivePattern, '--snip--')
        ;
        const split = inspected.split('\n');
        const last = inspected.length - 1;
        const prependPart = inspected[0] !== '{' && inspected[0] !== '[' && inspected[0] !== "'" ? split[0] : inspected[0];
        const appendPart = inspected[last] !== '}' && inspected[last] !== ']' && inspected[last] !== "'" ?
        split[split.length - 1] :
        inspected[last];
        const prepend = `\`\`\`javascript\n${prependPart}\n`;
        const append = `\n${appendPart}\n\`\`\``;
        return Util.splitMessage(stripIndents`
            *Executed in ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${hrDiff[1] / 1000000}ms.*
            \`\`\`javascript
            ${inspected}
            \`\`\`
            `, { maxLength: 1900, prepend, append }
        );
    }

    get sensitivePattern() {
        return escapeRegex(this.client.token);
    }
};
