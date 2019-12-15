import * as schedule from 'node-schedule';
import { stripIndents } from 'common-tags';
import { RichEmbed, Message } from 'discord.js';
import * as Sugar from 'sugar';
import { MapsterBot, logger } from '../bot';
import { Task } from '../registry';
import { getVersionInfo } from '../util/ngdp';
import { getPatchNotes, PatchNoteEntry, genPatchNotesMsg } from '../util/bnetPatchNotes';

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
    state: S2PatchState;
    job: schedule.Job;

    constructor(bot: MapsterBot) {
        super(bot, {});
    }

    async load() {
        this.state = this.client.settings.get(this.constructor.name + '_state', <S2PatchState>{
            current: {
                build: 76811,
                version: '4.10.4',
                releaseDate: new Date(1523386026539),
                patchNotesMessage: '',
                patchLiveMessage: '',
            },
        });

        this.job = schedule.scheduleJob(this.constructor.name, `*/${this.client.settings.get('bnetPatchNotifier.pollInterval', 5)} * * * *`, this.tick.bind(this));
    }

    private async persistState() {
        await this.client.settings.set(this.constructor.name + '_state', this.state);
    }

    private async tick(fireDate: Date) {
        this.client.log.debug('[BnetPatchNotifierTask] requesting patch logs..');
        // this.client.log.debug('Polling NGDP..');
        const result = await getVersionInfo();
        // this.client.log.debug('NGDP result', result.get('us'));
        const notificationsChannelId: string = this.client.settings.get('bnetPatchNotifier.notificationsChannel', void 0);
        if (!notificationsChannelId) {
            logger.error(`not configured: 'bnetPatchNotifier.notificationsChannel'`);
            return;
        }

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
            const msg = <Message>await this.client.getChannel(notificationsChannelId).send(genNotificationMsg(this.state.current));
            this.state.current.patchLiveMessage = msg.id;
            await this.persistState();
        }

        //
        // this.client.log.debug('Polling for patch notes..');
        const rnot = await getPatchNotes('s2', 1);
        this.client.log.debug('Retrievied patch notes..', rnot.patchNotes[0].buildNumber);
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
            const msg = <Message>await this.client.getChannel(notificationsChannelId).send(notesMsg.content, notesMsg.options);
            this.state.current.patchNotesMessage = msg.id;
            // await msg.pin();
            await this.persistState();
        }
    }
}

function genNotificationMsg(upcoming: S2PatchReleaseInfo) {
    return `StarCraft II — New version has been deployed: **${upcoming.version}** — \`${upcoming.build.toString()}\``;
}
