import { Entity, PrimaryGeneratedColumn, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class User {
    @PrimaryColumn('bigint')
    id: string;

    @Column('varchar')
    username: string;

    @Column('varchar')
    discriminator: string;

    @Column('varchar')
    tag: string;

    @Column('varchar', {
        nullable: true,
    })
    avatarURL: string;
}
