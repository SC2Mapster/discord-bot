import 'mocha';
import { fetchLatestForum } from '../../src/util/mapster';

describe('MapsterForum', () => {
    it('wtf', async () => {
        const r = await fetchLatestForum({
            refdate: new Date(1576485918000),
        });
        console.log(r);
    });
});
