import { Command, CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed, TextChannel } from 'discord.js';
import { MapsterBot, AdminCommand } from '../bot';
import * as schedule from 'node-schedule';

export class AdminSettingsCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'admin:settings',
            group: 'admin',
            memberName: 'admin:settings',
            description: 'Settings manager',
            args: [
                {
                    key: 'key',
                    type: 'string',
                    prompt: 'key',
                    default: '',
                },
                {
                    key: 'value',
                    type: 'string',
                    prompt: 'value',
                    default: '',
                },
            ],
        });
    }

    public async run(msg: CommandMessage, args: { key: string, value: string }) {
        let response = '';

        const settingsContainer = <Map<string,Object>>(<any>this.client.provider).settings;
        const globalSettings = settingsContainer.has('global') ? settingsContainer.get('global') : {};

        if (args.key.length == 0) {
            for (const key in globalSettings) {
                if (!globalSettings.hasOwnProperty(key)) continue;
                response += `\`${key}\` = \`${(<any>globalSettings)[key]}\`\n`;
            }
        }
        else {
            response = `\`${args.key}\` = \`${this.client.settings.get(args.key)}\``;
            if (args.value.length > 0) {
                if (args.value === 'null') {
                    this.client.settings.remove(args.key);
                }
                else {
                    this.client.settings.set(args.key, args.value);
                }
                response += ` -> changed to \`${args.value}\``;
            }
        }

        if (!response.length) response = 'empty';
        return msg.reply(response);
    }
}

export class AdminSchedulerCommand extends AdminCommand {
    constructor(client: MapsterBot) {
        super(client, {
            name: 'admin:scheduler',
            group: 'admin',
            memberName: 'admin:scheduler',
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

    public async run(msg: CommandMessage, args: { action: string }) {
        let response = '';
        if (args.action === 'reload') {
            this.client.reloadJobScheduler();
            response += '*reloaded*\n';
        }
        for (const key in schedule.scheduledJobs) {
            if (!schedule.scheduledJobs.hasOwnProperty(key)) continue;
            const job = schedule.scheduledJobs[key];
            response += `**${job.name}** - ${(<any>job.nextInvocation())._date.format()}\n`;
        }
        if (!response) response = 'none';
        return msg.reply(response.trim());
    }
}
