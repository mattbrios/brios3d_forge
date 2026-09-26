import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity.js';

export const MODEL_PLATFORMS = ['printables', 'makerworld', 'thingiverse'] as const;
export type ModelPlatform = (typeof MODEL_PLATFORMS)[number];

@Entity('products')
// Door 3: um produto por modelo. O índice é o mecanismo do 409, inclusive sob duas criações
// simultâneas do mesmo modelo.
@Index('products_model_identity_unique', ['modelPlatform', 'modelExternalId'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Door 3: URL canônica montada a partir da plataforma e do id, nunca a colada pelo usuário.
  @Column({ name: 'model_url', type: 'text' })
  modelUrl: string;

  @Column({
    name: 'model_platform',
    type: 'enum',
    enum: MODEL_PLATFORMS,
    enumName: 'product_model_platform',
  })
  modelPlatform: ModelPlatform;

  @Column({ name: 'model_external_id', type: 'text' })
  modelExternalId: string;

  @Column({ name: 'model_title', type: 'text', nullable: true })
  modelTitle: string | null;

  @Column({ name: 'model_image_url', type: 'text', nullable: true })
  modelImageUrl: string | null;

  @Column({ name: 'model_designer', type: 'text', nullable: true })
  modelDesigner: string | null;

  @Column({ name: 'model_license', type: 'text', nullable: true })
  modelLicense: string | null;

  // Door 5: tri-estado sem DEFAULT. `null` é "não informado", nunca "permitido".
  @Column({ name: 'commercial_use_allowed', type: 'boolean', nullable: true })
  commercialUseAllowed: boolean | null;

  // Door 5: criada agora e sempre `null` nesta fase; a Fase 14 preenche.
  @Column({ name: 'model_metadata_fetched_at', type: 'timestamptz', nullable: true })
  modelMetadataFetchedAt: Date | null;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: Relation<ProductVariant[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
