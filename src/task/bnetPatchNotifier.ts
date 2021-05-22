import * as schedule from 'node-schedule';
import { stripIndents } from 'common-tags';
import { Message, MessageEmbedOptions } from 'discord.js';
import * as Sugar from 'sugar';
import { MapsterBot, logger } from '../bot';
import { Task } from '../registry';
import { getVersionInfo } from '../util/ngdp';
import { getPatchNotes, PatchNoteEntry, genPatchNotesMsg, PatchNoteReleaseType } from '../util/bnetPatchNotes';

export type S2PatchReleaseInfo = {
    build: number;
    version: string;
    releaseDate: Date,
    buildConfig?: string;
    patchNotesMessage: string;
    patchLiveMessage: string;
};

export type S2PatchState = {
    current: S2PatchReleaseInfo;
};

export class BnetPatchNotifierTask extends Task {
    state: S2PatchState;
    job: schedule.Job;
    notificationsChannelId: string;

    constructor(bot: MapsterBot) {
        super(bot, {});
    }

    async load() {
        this.job = schedule.scheduleJob(this.constructor.name, `*/${this.client.settings.get('bnetPatchNotifier.pollInterval', 5)} * * * *`, this.tick.bind(this));
    }

    private async persistState() {
        await this.client.settings.set('bnetPatchNotifier.state', this.state);
    }

    private async tick(fireDate: Date) {
        this.client.log.debug('[BnetPatchNotifierTask] requesting patch logs..');

        this.state = this.client.settings.get('bnetPatchNotifier.state');
        if (!this.state) {
            logger.error(`not configured: 'bnetPatchNotifier.state'`);
            return;
        }

        this.notificationsChannelId = this.client.settings.get('bnetPatchNotifier.notificationsChannel');
        if (!this.notificationsChannelId) {
            logger.error(`not configured: 'bnetPatchNotifier.notificationsChannel'`);
            return;
        }

        await this.retrieveNGDPVersion('s2');
        await this.retrieveNotes('RETAIL');
        await this.retrieveNGDPVersion('s2t');
        await this.retrieveNotes('PTR');
    }

    private getNotificationChannel() {
        return this.client.getChannel(this.notificationsChannelId);
    }

    private async retrieveNGDPVersion(game: 's2' | 's2t') {
        // this.client.log.debug('Querying NGDP..');
        const result = await getVersionInfo(game);
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
        this.state.current.buildConfig = result.get('us').get('BuildConfig');
        if (Number(result.get('us').get('BuildId')) >= this.state.current.build && !this.state.current.patchLiveMessage) {
            this.client.log.info('Patch live.. preparing notifaction..', result.get('us'));
            const msg = <Message>await this.getNotificationChannel().send({
                embed: genNotificationMsg(this.state.current, game === 's2' ? 'RETAIL' : 'PTR'),
            });
            this.state.current.patchLiveMessage = msg.id;
            await this.persistState();
        }
    }

    private async retrieveNotes(serverType: PatchNoteReleaseType) {
        // this.client.log.debug('Polling for patch notes..');
        const rnot = await getPatchNotes('s2', 1, serverType);
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
            const msg = <Message>await this.getNotificationChannel().send(notesMsg.content, notesMsg.options);
            this.state.current.patchNotesMessage = msg.id;
            // await msg.pin();
            await this.persistState();
        }
    }
}

function genNotificationMsg(upcoming: S2PatchReleaseInfo, footerText: string) {
    return <MessageEmbedOptions>{
        title: `StarCraft II — New version has been deployed!`,
        description: stripIndents`
            ➤  __${upcoming.version}.${upcoming.build.toString()}__
            ➤  [Build config](http://level3.blizzard.com/tpr/sc2/config/${upcoming.buildConfig.substr(0, 2)}/${upcoming.buildConfig.substr(2, 2)}/${upcoming.buildConfig})
        `,
        footer: {
            icon_url: 'https://i.imgur.com/MDgIR4B.png',
            text: footerText,
        },
        timestamp: upcoming.releaseDate,
    };
}
