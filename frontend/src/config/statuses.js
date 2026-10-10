// One source of truth for how every status looks and reads across the app.
export const STATUS_STYLES = {
  // organisations and people
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  INVITED: { label: 'Invited', tone: 'warning' },
  DISABLED: { label: 'Disabled', tone: 'muted' },
  // orders
  NEW: { label: 'New', tone: 'neutral' },
  IN_PRODUCTION: { label: 'In production', tone: 'info' },
  QUALITY_CHECK: { label: 'Quality check', tone: 'purple' },
  READY_TO_DISPATCH: { label: 'Ready to ship', tone: 'success' },
  PARTIALLY_DISPATCHED: { label: 'Part shipped', tone: 'teal' },
  DISPATCHED: { label: 'Delivered', tone: 'success-strong' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
  // machines
  RUNNING: { label: 'Running', tone: 'success' },
  IDLE: { label: 'Idle', tone: 'warning' },
  BREAKDOWN: { label: 'Breakdown', tone: 'danger' },
  MAINTENANCE: { label: 'Maintenance', tone: 'purple' },
  // jobs
  PLANNED: { label: 'Planned', tone: 'neutral' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  ON_HOLD: { label: 'On hold', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  // rolls
  PENDING_QC: { label: 'Awaiting QC', tone: 'warning' },
  PASSED: { label: 'Passed', tone: 'success' },
  REWORK: { label: 'Rework', tone: 'orange' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  // invoices & payroll
  UNPAID: { label: 'Unpaid', tone: 'danger' },
  PARTIALLY_PAID: { label: 'Part paid', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  // attendance
  PRESENT: { label: 'Present', tone: 'success' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  HALF_DAY: { label: 'Half day', tone: 'warning' },
  LEAVE: { label: 'Leave', tone: 'info' },
  // priority
  LOW: { label: 'Low', tone: 'muted' },
  NORMAL: { label: 'Normal', tone: 'neutral' },
  HIGH: { label: 'High', tone: 'orange' },
  URGENT: { label: 'Urgent', tone: 'danger' },
};

export const ORDER_STAGES = ['NEW', 'IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_DISPATCH', 'DISPATCHED'];

export const DEFECT_LABELS = {
  HOLE: 'Hole',
  COLOUR_MISMATCH: 'Colour mismatch',
  UNEVEN_WEAVING: 'Uneven weaving',
  STAIN: 'Stain / oil mark',
  BROKEN_YARN: 'Broken yarn / end',
  WIDTH_VARIATION: 'Width variation',
  OTHER: 'Other',
};

export const STAGE_LABELS = { SPINNING: 'Spinning', WEAVING: 'Weaving', DYEING: 'Dyeing' };
