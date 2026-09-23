import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Printer } from '../../printers/entities/printer.entity.js';
import { StockItem } from './stock-item.entity.js';

// Door 2: compatibilidade peça×impressora como tabela de junção com chave composta, e não um
// jsonb de ids, porque a Fase 22 precisa da pergunta inversa ("quais peças servem nesta
// impressora") com FK e índice.
@Entity('stock_item_printers')
export class StockItemPrinter {
  @PrimaryColumn({ name: 'stock_item_id', type: 'uuid' })
  stockItemId: string;

  @ManyToOne(() => StockItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItem;

  @PrimaryColumn({ name: 'printer_id', type: 'uuid' })
  printerId: string;

  @ManyToOne(() => Printer)
  @JoinColumn({ name: 'printer_id' })
  printer: Printer;
}
