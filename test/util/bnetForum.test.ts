import { assert } from 'chai';
import { fetchLatestInSubforum } from '../../src/util/bnetForum';

describe('BnetForum', () => {
    it('latest', async () => {
        const r = await fetchLatestInSubforum({
            since: new Date(Date.now() - (1000 * 3600 * 24 * 10)),
            category: 'editor-discussion',
        });

        for (const item of r.entries) {
            console.log(item.kind, item.post.topic_slug, item.post.id, item.post.created_at, item.post.username);

        }
    });
});
