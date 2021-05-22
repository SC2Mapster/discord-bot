import * as dotenv from 'dotenv';
dotenv.config();
import { MapsterBot } from './bot';

const bot = new MapsterBot();
bot.login(process.env.BOT_TOKEN);

(<any>global).bot = bot;

export default bot;
