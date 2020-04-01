import * as dotenv from 'dotenv';
dotenv.config();
import { MapsterBot } from './bot';

const bot = new MapsterBot({
    owner: process.env.BOT_OWNER.split(','),
});
bot.login(process.env.BOT_TOKEN);

(<any>global).bot = bot;

export default bot;
