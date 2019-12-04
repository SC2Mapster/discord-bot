import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column } from 'typeorm';
import { Message } from './Message';

@Entity()
export class MessageAttachment {
    @PrimaryColumn('bigint')
    id: string;

    @OneToOne(type => Message, msg => msg.attachments)
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
