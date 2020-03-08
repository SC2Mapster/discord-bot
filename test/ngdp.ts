import 'mocha';
import { assert } from 'chai';
import { getVersionInfo } from '../src/util/ngdp';

describe('NGDP', () => {
    it('patch info', async () => {
        const nvers = await getVersionInfo();
        assert.isAtLeast(nvers.size, 1);
    });
});
