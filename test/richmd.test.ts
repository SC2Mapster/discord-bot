import 'mocha';
import { assert } from 'chai';
import { parseMdPayload } from '../src/util/richmd';

describe('richmd', () => {
    it('t1', async () => {
        let r = parseMdPayload(`
📥📥
>>> THIS SECTION WON'T BE DISPLAYED DIRECTLY
>>> THINK OF IT AS A SET OF EXTRA
>>> REPLACE THE VALUES ON THE RIGHT SIDE APPROPRIATELY
>>> LEAVE IT BLANK OR REMOVE SPECIFIC ROW TO DISABLE
IMAGE = https://i.imgur.com/WJ9pDRC.jpg
ICON = https://i.imgur.com/rETvesg.jpg
DISCORD = https://discord.gg/fpY4exB
URL=
📤📤

# Star Party 2.0!

Star Party is back on track with a big update. It has 3 new minigames, a new board, old minigames revamp and more. All old bugs are fixed. For those who doesn't know what is Star Party, in short, it's a Mario Party game in SC2 with its own twists. It is super fun, you laugh, you cry, you smile, you pass a nice moment.

Star Party won the Rock The Cabinet contest back in 2014. You can [watch the winners announcement by Blizzard](https://www.youtube.com/watch?v=4GxLuyuWEN4).

NB: The map is uploaded under a different name than the original. It used to be "Star Party [RTC]". It is now named **Star Party 2.0**. It has been uploaded to all regions as well.

## Arcade links

NA: \`battlenet:://starcraft/map/1/312195\`
EU: \`battlenet:://starcraft/map/2/220102\`
KR: \`battlenet:://starcraft/map/3/134654\`
        `.trim());
        console.log(r);

        r = parseMdPayload(`
\`\`\`
\`\`\`
color: ff0000
\`\`\`

# blah

a

\`\`\`
        `.trim());
        console.log(r);

        r = parseMdPayload(`test`.trim());
        console.log(r);
    });
});
