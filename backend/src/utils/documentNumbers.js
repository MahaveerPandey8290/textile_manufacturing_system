// Human-friendly document numbers like ORD-2026-00042, backed by PostgreSQL sequences
// (created in the initial migration) so numbers never collide under concurrent requests.
const SEQUENCE_BY_KIND = Object.freeze({
  order: { prefix: 'ORD', sequence: 'document_number_ord_seq' },
  yarnReceipt: { prefix: 'GRN', sequence: 'document_number_grn_seq' },
  productionJob: { prefix: 'JOB', sequence: 'document_number_job_seq' },
  fabricRoll: { prefix: 'RL', sequence: 'document_number_rl_seq' },
  dispatch: { prefix: 'DSP', sequence: 'document_number_dsp_seq' },
  invoice: { prefix: 'INV', sequence: 'document_number_inv_seq' },
});

export async function nextDocumentNumber(client, kind) {
  const documentKind = SEQUENCE_BY_KIND[kind];
  if (!documentKind) throw new Error(`Unknown document kind: ${kind}`);
  const { rows } = await client.query('SELECT nextval($1::regclass) AS next_value', [documentKind.sequence]);
  const year = new Date().getFullYear();
  return `${documentKind.prefix}-${year}-${String(rows[0].next_value).padStart(5, '0')}`;
}
