import * as request from 'request-promise';

export namespace bf {
    export interface User {
        id: number;
        username: string;
        name?: any;
        avatar_template: string;
    }

    export interface PrimaryGroup {
        id: number;
        name: string;
        flair_url?: any;
        flair_bg_color?: any;
        flair_color?: any;
    }

    export interface FirstTrackedPost {
        group: string;
        post_number: number;
    }

    export interface Poster {
        extras: string;
        description: string;
        user_id: number;
        primary_group_id?: number;
    }

    export interface Topic {
        id: number;
        title: string;
        fancy_title: string;
        slug: string;
        posts_count: number;
        reply_count: number;
        highest_post_number: number;
        image_url?: any;
        created_at: Date;
        last_posted_at: Date;
        bumped: boolean;
        bumped_at: Date;
        unseen: boolean;
        pinned: boolean;
        unpinned?: any;
        excerpt: string;
        visible: boolean;
        closed: boolean;
        archived: boolean;
        bookmarked?: any;
        liked?: any;
        views: number;
        like_count: number;
        has_summary: boolean;
        archetype: string;
        last_poster_username: string;
        category_id: number;
        pinned_globally: boolean;
        featured_link?: any;
        first_tracked_post: FirstTrackedPost;
        has_accepted_answer: boolean;
        posters: Poster[];

        /** extra prop */
        direct_link?: string;
    }

    export interface TopicList {
        can_create_topic: boolean;
        more_topics_url: string;
        draft?: any;
        draft_key: string;
        draft_sequence?: any;
        per_page: number;
        topics: Topic[];
    }

    export interface LatestContext {
        users: User[];
        primary_groups: PrimaryGroup[];
        topic_list: TopicList;
    }

    // ===
    // ===

    export interface UserCustomFields {
        blizzard_post_count: string;
        profile_url: string;
    }

    export interface Post {
        id: number;
        name?: any;
        username: string;
        avatar_template: string;
        created_at: Date;
        cooked: string;
        post_number: number;
        post_type: number;
        updated_at: Date;
        reply_count: number;
        reply_to_post_number?: any;
        quote_count: number;
        incoming_link_count: number;
        reads: number;
        score: number;
        yours: boolean;
        topic_id: number;
        topic_slug: string;
        display_username?: any;
        primary_group_name?: any;
        primary_group_flair_url?: any;
        primary_group_flair_bg_color?: any;
        primary_group_flair_color?: any;
        version: number;
        can_edit: boolean;
        can_delete: boolean;
        can_recover: boolean;
        can_wiki: boolean;
        read: boolean;
        user_title?: any;
        actions_summary: any[];
        moderator: boolean;
        admin: boolean;
        staff: boolean;
        user_id: number;
        hidden: boolean;
        trust_level: number;
        deleted_at?: any;
        user_deleted: boolean;
        edit_reason?: any;
        can_view_edit_history: boolean;
        wiki: boolean;
        user_custom_fields: UserCustomFields;
        user_post_count: number;
        sift_response?: any;
        can_accept_answer: boolean;
        can_unaccept_answer: boolean;
        accepted_answer: boolean;

        /** extra prop */
        direct_link?: string;
    }

    export interface PostStream {
        posts: Post[];
        stream: number[];
    }

    export interface User {
        id: number;
        username: string;
        name?: any;
        avatar_template: string;
    }

    export interface Poster {
        extras: string;
        description: string;
        user: User;
    }

    export interface SuggestedTopic {
        id: number;
        title: string;
        fancy_title: string;
        slug: string;
        posts_count: number;
        reply_count: number;
        highest_post_number: number;
        image_url?: any;
        created_at: Date;
        last_posted_at: Date;
        bumped: boolean;
        bumped_at: Date;
        unseen: boolean;
        pinned: boolean;
        unpinned?: any;
        visible: boolean;
        closed: boolean;
        archived: boolean;
        bookmarked?: any;
        liked?: any;
        archetype: string;
        like_count: number;
        views: number;
        category_id: number;
        featured_link?: any;
        posters: Poster[];
    }

    export interface CreatedBy {
        id: number;
        username: string;
        name?: any;
        avatar_template: string;
    }

    export interface LastPoster {
        id: number;
        username: string;
        name?: any;
        avatar_template: string;
    }

    export interface Participant {
        id: number;
        username: string;
        name?: any;
        avatar_template: string;
        post_count: number;
        primary_group_name?: any;
        primary_group_flair_url?: any;
        primary_group_flair_color?: any;
        primary_group_flair_bg_color?: any;
    }

    export interface Details {
        created_by: CreatedBy;
        last_poster: LastPoster;
        participants: Participant[];
        notification_level: number;
        can_flag_topic: boolean;
    }

    export interface ActionsSummary {
        id: number;
        count: number;
        hidden: boolean;
        can_act: boolean;
    }

    export interface TopicPostsContext {
        post_stream: PostStream;
        timeline_lookup: number[][];
        suggested_topics: SuggestedTopic[];
        id: number;
        title: string;
        fancy_title: string;
        posts_count: number;
        created_at: Date;
        views: number;
        reply_count: number;
        like_count: number;
        last_posted_at: Date;
        visible: boolean;
        closed: boolean;
        archived: boolean;
        has_summary: boolean;
        archetype: string;
        slug: string;
        category_id: number;
        word_count: number;
        deleted_at?: any;
        user_id: number;
        featured_link?: any;
        pinned_globally: boolean;
        pinned_at?: any;
        pinned_until?: any;
        draft?: any;
        draft_key: string;
        draft_sequence?: any;
        unpinned?: any;
        pinned: boolean;
        details: Details;
        current_post_number: number;
        highest_post_number: number;
        deleted_by?: any;
        actions_summary: ActionsSummary[];
        chunk_size: number;
        bookmarked?: any;
        topic_timer?: any;
        message_bus_last_id: number;
        participant_count: number;
    }
}


export interface FetchLatestOpts {
    region?: 'us' | 'eu';
    since?: Date;
    category: string;
}

export interface BnetForumSubmission {
    kind: 'new_thread' | 'new_reply';
    topic: bf.Topic;
    post: bf.Post;
}

export interface LatestResults {
    next: Date;
    entries: BnetForumSubmission[];
}

export async function fetchLatestInSubforum(opts: FetchLatestOpts) {
    opts = Object.assign<Partial<FetchLatestOpts>, FetchLatestOpts>({
        region: 'us',
        since: new Date(Date.now() - (1000 * 3600 * 24 * 365)),
    }, opts);

    const resp: bf.LatestContext = await request.get(`https://${opts.region}.forums.blizzard.com/en/sc2/c/${opts.category}/l/latest.json?_=${Date.now()}`, {
        json: true,
    });

    const lresult: LatestResults = {
        next: void 0,
        entries: [],
    };

    for (const titem of resp.topic_list.topics.reverse()) {
        if (titem.pinned || titem.pinned_globally) continue;

        titem.created_at = new Date(titem.created_at);
        titem.last_posted_at = new Date(titem.last_posted_at);
        titem.bumped_at = new Date(titem.bumped_at);
        titem.direct_link = `https://${opts.region}.forums.blizzard.com/en/sc2/t/${titem.slug}/${titem.id}`;

        let tpContext: bf.TopicPostsContext;

        if (titem.created_at > opts.since) {
            if (!tpContext) {
                tpContext = await fetchPostsInTopic(titem.direct_link);
            }

            lresult.entries.push({
                kind: 'new_thread',
                topic: titem,
                post: tpContext.post_stream.posts[0],
            });
            lresult.next = titem.created_at;
        }

        if (titem.posts_count > 1 && titem.last_posted_at > opts.since) {
            if (!tpContext) {
                tpContext = await fetchPostsInTopic(titem.direct_link);
            }

            for (const pt of tpContext.post_stream.posts) {
                if (pt.post_number <= 1) continue;

                if (pt.created_at > opts.since) {
                    lresult.entries.push({
                        kind: 'new_reply',
                        topic: titem,
                        post: pt,
                    });
                    lresult.next = pt.created_at;
                }
            }
        }
    }

    if (!lresult.next) {
        lresult.next = opts.since;
    }

    lresult.entries = lresult.entries.sort((a, b) => a.post.created_at.valueOf() - b.post.created_at.valueOf())

    return lresult;
}

export async function fetchPostsInTopic(url: string) {
    const resp: bf.TopicPostsContext = await request.get(url, {
        json: true,
    });

    for (const item of resp.post_stream.posts) {
        item.created_at = new Date(item.created_at);
        item.updated_at = new Date(item.updated_at);
        item.direct_link = `${url}/${item.post_number}`;
    }

    return resp;
}
