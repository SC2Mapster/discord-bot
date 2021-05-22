import * as discord from 'discord.js';
import { Command, CommandoMessage } from 'discord.js-commando';
import { Message, MessageEmbedOptions, TextChannel } from 'discord.js';
import { MapsterBot, AdminCommand } from '../bot';
import * as schedule from 'node-schedule';

export class AdminConfigGetCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.cfg.get',
            group: 'admin',
            memberName: 'a.cfg.get',
            description: 'Config get',
            args: [
                {
                    key: 'key',
                    type: 'string',
                    prompt: 'key',
                    default: '',
                }
            ],
        });
    }

    public async run(msg: CommandoMessage, args: { key: string }) {
        const settingsContainer = <Map<string,Object>>(<any>this.client.provider).settings;
        const globalSettings = settingsContainer.has('global') ? settingsContainer.get('global') : {};

        if (args.key.length == 0) {
            const values: string[] = [];
            for (const cfgKey of Object.keys(globalSettings)) {
                values.push(cfgKey);
            }
            return msg.reply({
                embed: {
                    title: `- ${values.length}`,
                    description: values.map(v => `\`${v}\``).join('\n'),
                },
            });
            // return msg.code('md', JSON.stringify(globalSettings, null, 4));
        }
        else {
            let orgVal: string | object  = this.client.settings.get(args.key, 'null');

            let val: string;
            if (typeof orgVal === 'string') {
                val = orgVal.replace(/```/gm, '``\\`')
            }
            else {
                val = JSON.stringify(orgVal, null, 4);
            }
            return msg.reply({
                embed: {
                    title: args.key,
                    // description: discord.Util.escapeMarkdown(`${val}`),
                    description: '```\n' + val + '\n```',
                    fields: [{
                        name: 'Type',
                        value: typeof orgVal,
                    }],
                },
            });
        }
    }
}

export class AdminConfigSetCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.cfg.set',
            group: 'admin',
            memberName: 'a.cfg.set',
            description: 'Config set',
            args: [
                {
                    key: 'key',
                    type: 'string',
                    prompt: 'key',
                },
                {
                    key: 'value',
                    type: 'string',
                    prompt: 'value',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: { key: string, value: string }) {
        const settingsContainer = <Map<string,Object>>(<any>this.client.provider).settings;
        const globalSettings = settingsContainer.has('global') ? settingsContainer.get('global') : {};

        const prevValue = this.client.settings.get(args.key, 'null');

        if (args.value === 'null') {
            await this.client.settings.remove(args.key);
        }
        else {
            let parsedValue = JSON.parse(args.value);
            if (typeof parsedValue === 'number') {
                parsedValue = args.value;
            }
            else if (typeof parsedValue === 'undefined') {
                return msg.reply(`Failed to parse value.`)
            }
            await this.client.settings.set(args.key, parsedValue);
        }

        return msg.reply(`Config for \`${args.key}\` updated.`)
    }
}

export class AdminSchedulerCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.scheduler',
            group: 'admin',
            memberName: 'a.scheduler',
            description: 'Job scheduler',
            args: [
                {
                    key: 'action',
                    type: 'string',
                    prompt: 'action',
                    default: 'status',
                    label: 'status|reload',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: { action: string }) {
        let response = '';
        if (args.action === 'reload') {
            this.client.reloadJobScheduler();
            response += '*reloaded*\n';
        }
        let i = 1;
        for (const key in schedule.scheduledJobs) {
            if (!schedule.scheduledJobs.hasOwnProperty(key)) continue;
            const job = schedule.scheduledJobs[key];
            response += `[${i}] ${job.name}\n — ${(<any>job.nextInvocation())._date.format()}\n`;
            ++i;
        }
        if (!response) {
            return msg.say('none');
        }
        return msg.reply({
            code: 'js',
            content: response.trim()
        });
    }
}


export class AdminSchedulerInvokeCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'a.scheduler.invoke',
            group: 'admin',
            memberName: 'a.scheduler.invoke',
            description: 'Job scheduler [invoke]',
            args: [
                {
                    key: 'task',
                    type: 'string',
                    prompt: 'task',
                },
            ],
        });
    }

    public async run(msg: CommandoMessage, args: { task: string }) {
        const job = schedule.scheduledJobs[args.task];
        if (job) {
            (<any>job).invoke(new Date());
            return msg.say('Invoked..');
        }
        else {
            return msg.say('Task not found');
        }
    }
}
