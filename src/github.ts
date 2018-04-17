import octokit = require('@octokit/rest');
import * as dotenv from 'dotenv';

dotenv.config();

export const client = new octokit();
client.authenticate({
    type: 'token',
    token: process.env.GITHUB_TOKEN,
});
