import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column, ManyToOne, Index } from 'typeorm';
import { Message } from './Message';

@Entity()
export class MessageAttachment {
    @PrimaryColumn('bigint')
    id: string;

    @ManyToOne(type => Message, msg => msg.attachments, {
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
    })
    @Index()
    @JoinColumn()
    message: Message;

    @Column('varchar')
    filename: string;

    @Column('int')
    filesize: number;

    @Column('int', { nullable: true })
    width?: number;

    @Column('int', { nullable: true })
    height?: number;

    @Column('varchar')
    url: string;

    @Column('varchar')
    proxyUrl: string;
}
