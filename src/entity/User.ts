import { Entity, PrimaryGeneratedColumn, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class User {
    @PrimaryColumn('bigint')
    id: string;

    @Column()
    username: string;

    @Column()
    discriminator: string;

    @Column()
    tag: string;

    @Column({
        nullable: true,
    })
    avatarURL: string;
}
