import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column } from 'typeorm';

@Entity()
export class Channel {
    @PrimaryColumn('bigint')
    id: string;

    @Column('varchar')
    name: string;

    @Column('int')
    position: number;

    @Column('text', { nullable: true })
    topic?: string;
}
