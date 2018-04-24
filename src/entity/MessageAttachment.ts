import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column } from 'typeorm';
import { Message } from './Message';

@Entity()
export class MessageAttachment {
    @PrimaryColumn('bigint')
    id: string;

    @OneToOne(type => Message, msg => msg.attachments)
    @JoinColumn()
    message: Message;

    @Column()
    filename: string;

    @Column()
    filesize: number;

    @Column({ nullable: true })
    width?: number;

    @Column({ nullable: true })
    height?: number;

    @Column()
    url: string;

    @Column()
    proxyUrl: string;
}
