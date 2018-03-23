declare module 'imgur' {
    export type JsonResult = {
        data: {
            link: string,
        },
    };

    function uploadUrl(url: string): Promise<JsonResult>;
}
