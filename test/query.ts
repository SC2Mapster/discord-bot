import { assert } from 'chai';
import * as google from '../src/util/google';
import * as query from '../src/util/query';

describe('Query', () => {
    it('Google', async () => {
        let results = await google.search('site:sc2mapster.com inurl:projects nanakey modern warfare');
        assert.isAtLeast(results.length, 1);
        assert.isTrue(results[0].title.indexOf('ModernWarAsset') !== -1);
        assert.equal(results[0].url, 'https://www.sc2mapster.com/projects/nanakeys-modernwarasset');

        results = await google.search('site:sc2mapster.gamepedia.com assets.txt');
        assert.isAtLeast(results.length, 1);
        assert.isTrue(results[0].title.indexOf('UI/Referencing') !== -1);
        assert.equal(results[0].url, 'https://sc2mapster.gamepedia.com/UI/Referencing');
        assert.isNotNull(results[0].meta);
    });

    it('Parse', () => {
        const qp = query.parseQuery('s:f limit:1 i:2 nanakey modern warfare');
        assert.equal(qp.src, query.SourceKind.MapsterForum);
        assert.equal(qp.limit, 1);
        assert.equal(qp.resultIndex, 2);
        assert.equal(qp.phrase, 'nanakey modern warfare');
    });

    it('Mapster', async () => {
        const results = await query.query('nanakey modern warfare');
    });
});
