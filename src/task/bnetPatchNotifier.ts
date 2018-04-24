import * as schedule from 'node-schedule';
import { stripIndents } from 'common-tags';
import { RichEmbed, Message } from 'discord.js';
import * as Sugar from 'sugar';
import { MapsterBot } from '../bot';
import { Task } from '../registry';
import { getVersionInfo } from '../util/ngdp';
import { getPatchNotes, PatchNoteEntry, genPatchNotesMsg } from '../util/bnetPatchNotes';

export type S2PatchSettings = {
    pollInterval: number;
    notificationsChannel: string;
};

export type S2PatchReleaseInfo = {
    build: number;
    version: string;
    releaseDate: Date,
    patchNotesMessage: string;
    patchLiveMessage: string;
};

export type S2PatchState = {
    current: S2PatchReleaseInfo;
};

export class BnetPatchNotifierTask extends Task {
    settings: S2PatchSettings;
    state: S2PatchState;
    job: schedule.Job;

    constructor(bot: MapsterBot) {
        super(bot, {});
    }

    load() {
        this.settings = this.client.settings.get(this.constructor.name + '_settings', <S2PatchSettings>{
            pollInterval: 5,
            notificationsChannel: '271701880885870594',
        });
        this.state = this.client.settings.get(this.constructor.name + '_state', <S2PatchState>{
            current: {
                build: 63785,
                version: '4.2.3',
                releaseDate: new Date(1523386026539),
                patchNotesMessage: '',
                patchLiveMessage: '',
            },
        });

        // could probably only poll servers on tuesday - usual patch day; but who knows...
        this.job = schedule.scheduleJob(this.constructor.name, '*/2 * * * *', this.tick.bind(this));
        this.job.invoke();
    }

    private async persistState() {
        await this.client.settings.set(this.constructor.name + '_state', this.state);
    }

    private async tick(fireDate: Date) {
        this.client.log.debug('Polling NGDP..');
        const result = await getVersionInfo();
        this.client.log.debug('NGDP result', result.get('us'));

        if (Number(result.get('us').get('BuildId')) > this.state.current.build) {
            this.client.log.info('Detected new patch on NGDP..', result.get('us'));
            // const previous = Object.assign({}, this.state.current);
            this.state.current = {
                build: Number(result.get('us').get('BuildId')),
                version: result.get('us').get('VersionsName').replace(/\.[0-9]+$/, ''),
                releaseDate: new Date(Date.now()),
                patchNotesMessage: null,
                patchLiveMessage: null,
            };
            await this.persistState();
        }
        if (Number(result.get('us').get('BuildId')) >= this.state.current.build && !this.state.current.patchLiveMessage) {
            this.client.log.info('Patch live.. preparing notifaction..', result.get('us'));
            const msg = <Message>await this.client.getChannel(this.settings.notificationsChannel).send(...genNotificationMsg(this.state.current));
            this.state.current.patchLiveMessage = msg.id;
            await this.persistState();
        }

        //
        this.client.log.debug('Polling for patch notes..');
        const rnot = await getPatchNotes('s2', 1);
        this.client.log.info('Retrievied patch notes..', rnot.patchNotes[0]);
        if (rnot.patchNotes[0].buildNumber > this.state.current.build) {
            this.client.log.info('New version of patchnnotes..');
            this.state.current = {
                build: rnot.patchNotes[0].buildNumber,
                version: rnot.patchNotes[0].version,
                releaseDate: new Date(rnot.patchNotes[0].publish),
                patchNotesMessage: null,
                patchLiveMessage: null,
            };
            await this.persistState();
        }
        if (this.state.current.patchNotesMessage === null && rnot.patchNotes[0].buildNumber >= this.state.current.build) {
            this.client.log.info('patchnotes released');
            const notesMsg = await genPatchNotesMsg(rnot.patchNotes[0]);
            const msg = <Message>await this.client.getChannel(this.settings.notificationsChannel).send(notesMsg.content, notesMsg.options);
            this.state.current.patchNotesMessage = msg.id;
            await this.persistState();
        }
    }
}

function genNotificationMsg(upcoming: S2PatchReleaseInfo) {
    const embed = new RichEmbed({
        color: 0x0e86ca,
        description: stripIndents`
            \`\`\`js
            |       LIVE        |
            |———————————————————|
            | Version:${upcoming.version.padStart(7)}   |
            |   Build:${upcoming.build.toString().padStart(7)}   |
            \`\`\`
        `,
        footer: {
            icon_url: 'https://i.imgur.com/MDgIR4B.png',
            // text: `Previous release: ${(new Sugar.Date(current.releaseDate)).relative().raw.toString()}`
        }
    });
    return [' — SC2 — New version has been deployed', {embed: embed}];
}
