import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
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

    @OneToOne(type => Channel)
    @JoinColumn()
    channel: Channel;

    @Column({
        nullable: true,
    })
    type: MessageType | string;

    @OneToOne(type => User, {
        nullable: true,
    })
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

    @Column()
    pinned: boolean;

    @Column('text')
    content: string;

    @OneToMany(type => MessageEmbed, embed => embed.message, {
        cascadeInsert: true,
        cascadeUpdate: true,
        eager: true,
    })
    embeds: MessageEmbed[];

    @OneToMany(type => MessageAttachment, attachment => attachment.message, {
        cascadeInsert: true,
        cascadeUpdate: true,
        eager: true,
    })
    attachments: MessageAttachment[];
}
