import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column } from 'typeorm';
import { User } from './User';

@Entity()
export class Message {
    @PrimaryColumn('bigint')
    id: string;

    @Column('bigint')
    channelId: string;

    @Column({
        nullable: true,
    })
    type: string;

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

    @Column('tinytext')
    content: string;
}
