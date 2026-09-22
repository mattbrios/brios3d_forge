import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sales_channels')
export class SalesChannel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Único após trim() (door 3); o valor gravado já vem trimado pelo DTO.
  @Column({ unique: true })
  name: string;

  @Column({ name: 'tax_rate', type: 'double precision' })
  taxRate: number;

  @Column({ name: 'fee_rate', type: 'double precision' })
  feeRate: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
