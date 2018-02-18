declare module 'string-similarity' {
    export type MatchItem = {
        target: string;
        rating: number;
    };

    export type MatchResult = {
        ratings: MatchItem[];
        bestMatch: MatchItem;
    };

    function findBestMatch(mainString: string, targetStrings: string[]): MatchResult;
}
