import { MapsterBot } from './bot';
import * as dotenv from 'dotenv';

dotenv.config();

const bot = new MapsterBot({
    owner: process.env.BOT_OWNER.split(','),
});
bot.login(process.env.BOT_TOKEN);
