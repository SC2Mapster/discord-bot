import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne, Index } from 'typeorm';
import { User } from './User';
import { Channel } from './Channel';
import { MessageEmbed } from './MessageEmbed';
import { MessageAttachment } from './MessageAttachment';

export type MessageType =
    'DEFAULT' |
    'RECIPIENT_ADD' |
    'RECIPIENT_REMOVE' |
    'CALL' |
    'CHANNEL_NAME_CHANGE' |
    'CHANNEL_ICON_CHANGE' |
    'PINS_ADD' |
    'GUILD_MEMBER_JOIN'
;

@Entity()
export class Message {
    @PrimaryColumn('bigint')
    id: string;

    @ManyToOne(type => Channel, {
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
    })
    @Index()
    @JoinColumn()
    channel: Channel;

    @Column('varchar', {
        nullable: true,
    })
    type: MessageType | string;

    @ManyToOne(type => User, {
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
        nullable: true,
    })
    @Index()
    @JoinColumn()
    author: User;

    @Column('datetime')
    createdAt: Date;

    @Column('datetime', {
        nullable: true,
    })
    editedAt: Date;

    @Column('datetime', {
        nullable: true,
    })
    deletedAt: Date;

    @Column('tinyint')
    pinned: boolean;

    @Column('text')
    content: string;

    @OneToMany(type => MessageEmbed, embed => embed.message, {
        cascade: true,
        eager: true,
    })
    embeds: MessageEmbed[];

    @OneToMany(type => MessageAttachment, attachment => attachment.message, {
        cascade: true,
        eager: true,
    })
    attachments: MessageAttachment[];
}
