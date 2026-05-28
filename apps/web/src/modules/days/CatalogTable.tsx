import type { SeedState } from '@back-stock/api/days';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/shadcn/table';
import { formatCurrency, formatNumber } from '@/modules/core/lib/format';

interface CatalogTableProps {
  seedState: SeedState;
}

export function CatalogTable({ seedState }: CatalogTableProps) {
  return (
    <Table data-testid="catalog-table">
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead className="text-right">On hand</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Unit cost</TableHead>
          <TableHead className="text-right">Margin</TableHead>
          <TableHead className="text-right">Shelf life</TableHead>
          <TableHead className="text-right">Case</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {seedState.skus.map((sku) => {
          const margin = sku.price > 0 ? (sku.price - sku.unit_cost) / sku.price : 0;
          return (
            <TableRow key={sku.id} data-testid={`catalog-row-${sku.id}`}>
              <TableCell className="text-foreground font-mono">{sku.id}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatNumber(sku.on_hand)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCurrency(sku.price)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                {formatCurrency(sku.unit_cost)}
              </TableCell>
              <TableCell className="text-right font-mono text-[var(--good)] tabular-nums">
                {(margin * 100).toFixed(0)}%
              </TableCell>
              <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                {formatNumber(sku.shelf_life_hours)}h
              </TableCell>
              <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                {formatNumber(sku.case_size)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
