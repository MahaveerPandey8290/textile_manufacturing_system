import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, ErrorState } from './EmptyState';
import { SkeletonRows } from './Spinner';

/**
 * columns: [{ key, header, render?: (row) => node, align?: 'right', width? }]
 * Keeps the table responsive by scrolling horizontally on small screens.
 */
export function DataTable({ columns, rows, isLoading, error, onRetry, onRowClick, emptyTitle = 'Nothing here yet', emptyDescription, rowKey = 'id', rowClassName }) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading && !rows) return <SkeletonRows />;
  if (!rows?.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width, textAlign: column.align }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[rowKey]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${onRowClick ? 'is-clickable' : ''} ${rowClassName?.(row) ?? ''}`}
            >
              {columns.map((column) => (
                <td key={column.key} style={{ textAlign: column.align }}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, totalCount, onPageChange }) {
  if (!totalCount) return null;
  return (
    <div className="pagination">
      <span className="muted">
        {totalCount} record{totalCount === 1 ? '' : 's'}
      </span>
      <div className="pagination__controls">
        <button className="icon-button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button className="icon-button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
