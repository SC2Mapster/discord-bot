import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Message } from './Message';

export class MessageEmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

export class MessageEmbedAuthor {
    @Column({ nullable: true })
    name?: string;

    @Column({ nullable: true })
    url?: string;

    @Column({ nullable: true })
    iconUrl?: string;

    // @Column({ nullable: true })
    // proxyIconUrl?: string;
}

export class MessageEmbedFooter {
    @Column('text', {
        nullable: true,
    })
    text?: string;

    @Column({ nullable: true })
    iconUrl?: string;

    @Column({ nullable: true })
    proxyIconUrl?: string;
}

export class MessageEmbedImage {
    @Column({ nullable: true })
    url?: string;

    @Column({ nullable: true })
    proxyUrl?: string;

    @Column({ nullable: true })
    width?: number;

    @Column({ nullable: true })
    height?: number;
}

export class MessageEmbedVideo {
    @Column({ nullable: true })
    url?: string;

    @Column({ nullable: true })
    width?: number;

    @Column({ nullable: true })
    height?: number;
}

export class MessageEmbedProvider {
    @Column({ nullable: true })
    name?: string;

    @Column({ nullable: true })
    url?: string;
}

@Entity()
export class MessageEmbed {
    @PrimaryGeneratedColumn()
    id: string;

    @OneToOne(type => Message, msg => msg.embeds)
    @JoinColumn()
    message: Message;

    @Column()
    title?: string;

    @Column()
    type?: string;

    @Column('text')
    description?: string;

    @Column()
    url?: string;

    @Column()
    color?: number;

    @Column('simple-json', { nullable: true })
    fields?: MessageEmbedField[];

    @Column(type => MessageEmbedFooter)
    footer?: MessageEmbedFooter;

    @Column(type => MessageEmbedImage)
    image?: MessageEmbedImage;

    @Column(type => MessageEmbedImage)
    thumbnail?: MessageEmbedImage;

    @Column(type => MessageEmbedVideo)
    video?: MessageEmbedVideo;

    @Column(type => MessageEmbedProvider)
    provider?: MessageEmbedProvider;

    @Column(type => MessageEmbedAuthor)
    author?: MessageEmbedAuthor;
}
