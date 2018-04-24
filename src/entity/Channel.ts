import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column } from 'typeorm';

@Entity()
export class Channel {
    @PrimaryColumn('bigint')
    id: string;

    @Column()
    name: string;

    @Column()
    position: number;

    @Column({ nullable: true })
    topic?: string;
}
