declare module 'turndown' {
    interface TurndownOptions {
        rules?: any;
        headingStyle?: 'setext' | 'atx';
        hr?: string;
        bulletListMarker?: '-' | '+' | '*';
        codeBlockStyle?: 'indented' | 'fenced';
        fence?: '```' | '~~~';
        emDelimiter?: '_' | '*';
        strongDelimiter?: '**' | '__';
        linkStyle?: 'inlined' | 'referenced';
        linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
        br?: string;
    }

    class TurndownService {
        constructor(options?: TurndownOptions);
        turndown(input: string, options?: TurndownOptions): string;
    }
    export = TurndownService;
}
