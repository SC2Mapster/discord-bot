import { Command, CommandMessage } from 'discord.js-commando';
import { Message, RichEmbed, TextChannel } from 'discord.js';
import { MapsterBot } from '../bot';
import * as schedule from 'node-schedule';

// export type MapsterRecentSettingsArgs = {
//     enabled: boolean;
//     channel: number;
// };

abstract class AdminCommand extends Command {
    public readonly client: MapsterBot;

    public hasPermission(userMsg: CommandMessage) {
        const adminIds = (<string>this.client.settings.get('role:admin', '')).split(',');
        return this.client.isOwner(userMsg.author) || adminIds.indexOf(userMsg.author.id) !== -1;
    }
}

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
