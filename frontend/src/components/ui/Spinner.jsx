import { Loader2 } from 'lucide-react';

export const Spinner = ({ size = 20 }) => <Loader2 className="spin muted" size={size} />;

export function FullPageSpinner() {
  return (
    <div className="full-page-center">
      <Spinner size={32} />
    </div>
  );
}

export function SkeletonRows({ rows = 6 }) {
  return (
    <div className="skeleton-rows">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" />
      ))}
    </div>
  );
}
