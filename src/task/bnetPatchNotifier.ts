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
            },
        });

        // could probably only poll servers on tuesday - usual patch day; but who knows...
        this.job = schedule.scheduleJob(this.constructor.name, <schedule.RecurrenceRule>{second: 0}, this.tick.bind(this));
        this.job.invoke();
    }

    async persistState() {
        await this.client.settings.set(this.constructor.name + '_state', this.state);
    }

    async tick(fireDate: Date) {
        this.client.log.debug('Polling NGDP..');
        const result = await getVersionInfo();
        this.client.log.debug('NGDP result', result.get('us'));

        if (Number(result.get('us').get('BuildId')) > this.state.current.build) {
            this.client.log.info('New patch detected.. preparing notifaction..', result.get('us'));
            const previous = Object.assign({}, this.state.current);

            // if (this.state.current.patchNotesMessage) {
            //     const msg = await this.client.getChannel(this.settings.notificationsChannel).fetchMessage(this.state.current.patchNotesMessage);
            //     if (msg && msg.pinned) {
            //         msg.unpin();
            //     }
            // }
            this.state.current = {
                build: Number(result.get('us').get('BuildId')),
                version: result.get('us').get('VersionsName').replace(/\.[0-9]+$/, ''),
                releaseDate: new Date(Date.now()),
                patchNotesMessage: null,
            };
            await this.client.getChannel(this.settings.notificationsChannel).send(...genNotificationMsg(previous, this.state.current));
            await this.persistState();
        }

        if (this.state.current.patchNotesMessage === null) {
            this.client.log.debug('Polling for patch notes..');
            const r = await getPatchNotes('s2', 1);
            if (r.patchNotes.length && r.patchNotes[0].buildNumber >= this.state.current.build) {
                this.client.log.info('Retrievied patch notes..', r.patchNotes[0]);
                const notesMsg = genPatchNotesMsg(r.patchNotes[0]);
                const msg = <Message>await this.client.getChannel(this.settings.notificationsChannel).send(notesMsg.content, notesMsg.options);
                // if (msg.pinnable) {
                //     await msg.pin();
                // }
                this.state.current.patchNotesMessage = msg.id;
                await this.persistState();
            }
        }
    }
}

function genNotificationMsg(current: S2PatchReleaseInfo, upcoming: S2PatchReleaseInfo) {
    const embed = new RichEmbed({
        color: 0x0e86ca,
        description: stripIndents`
            \`\`\`js
            |     UPCOMING      |      CURRENT      |
            |———————————————————|———————————————————|
            | Version:${upcoming.version.padStart(7)}   |   Version:${current.version.padStart(7)} |
            |   Build:${upcoming.build.toString().padStart(7)}   |     Build:${current.build.toString().padStart(7)} |
            \`\`\`
        `,
        footer: {
            icon_url: 'https://i.imgur.com/MDgIR4B.png',
            text: `Previous release: ${(new Sugar.Date(current.releaseDate)).relative().raw.toString()}`
        }
    });
    return [' — SC2 — **PATCH INBOUD**', {embed: embed}];
}
