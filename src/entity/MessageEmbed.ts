import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { Message } from './Message';

export class MessageEmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

export class MessageEmbedAuthor {
    @Column('varchar', { nullable: true })
    name?: string;

    @Column('varchar', { nullable: true })
    url?: string;

    @Column('varchar', { nullable: true })
    iconUrl?: string;

    // @Column({ nullable: true })
    // proxyIconUrl?: string;
}

export class MessageEmbedFooter {
    @Column('text', {
        nullable: true,
    })
    text?: string;

    @Column('varchar', { nullable: true })
    iconUrl?: string;

    @Column('varchar', { nullable: true })
    proxyIconUrl?: string;
}

export class MessageEmbedImage {
    @Column('varchar', { nullable: true })
    url?: string;

    @Column('varchar', { nullable: true })
    proxyUrl?: string;

    @Column('int', { nullable: true })
    width?: number;

    @Column('int', { nullable: true })
    height?: number;
}

export class MessageEmbedVideo {
    @Column('varchar', { nullable: true })
    url?: string;

    @Column('int', { nullable: true })
    width?: number;

    @Column('int', { nullable: true })
    height?: number;
}

export class MessageEmbedProvider {
    @Column('varchar', { nullable: true })
    name?: string;

    @Column('varchar', { nullable: true })
    url?: string;
}

@Entity()
export class MessageEmbed {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(type => Message, msg => msg.embeds, {
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
    })
    @Index()
    @JoinColumn()
    message: Message;

    @Column('varchar', { nullable: true })
    title?: string;

    @Column('varchar')
    type?: string;

    @Column('text', { nullable: true })
    description?: string;

    @Column('varchar', { nullable: true })
    url?: string;

    @Column('int', { nullable: true })
    color?: number;

    @Column('longtext', { nullable: true })
    // fields?: MessageEmbedField[];
    fields?: string;

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
