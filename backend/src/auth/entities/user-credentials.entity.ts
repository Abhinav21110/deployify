import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_credentials')
export class UserCredentials {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  provider: string;

  @Column({ nullable: true })
  name: string;

  @Column('json')
  encryptedCredentials: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastValidated: Date;

  @Column({ default: false })
  isValid: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}