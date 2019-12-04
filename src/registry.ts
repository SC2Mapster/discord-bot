import { MapsterBot } from "./bot";

export type TaskInfo = {
};

export type TaskSettings = {
};

export abstract class Task {
    readonly client: MapsterBot;
    readonly info: TaskInfo;

    constructor(bot: MapsterBot, info: TaskInfo = {}) {
        this.client = bot;
        this.info = info;
    }

    abstract load(): void;
}
