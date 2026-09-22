import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const USER_ROLES = ['admin', 'production', 'sales'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Sempre em minúsculas e sem espaços nas pontas (normalizeEmail).
  @Column({ unique: true })
  email: string;

  @Column({ type: 'enum', enum: USER_ROLES, enumName: 'users_role_enum' })
  role: UserRole;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
