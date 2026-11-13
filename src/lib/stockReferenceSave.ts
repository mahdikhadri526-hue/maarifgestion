export type StockReferenceRow = { conversion: string; unitRef: string };
export type StockReferencePatch = Partial<StockReferenceRow>;

/** Await lazy database requests and serialize patches to prevent older edits winning. */
export function createStockReferenceSaver(write: (id: string, patch: StockReferencePatch) => PromiseLike<{ error: unknown }>) {
  const queues = new Map<string, Promise<void>>();
  return (id: string, patch: StockReferencePatch): Promise<void> => {
    const previous = queues.get(id) ?? Promise.resolve();
    const request = previous.catch(() => undefined).then(async () => {
      const { error } = await write(id, patch);
      if (error) throw error;
    });
    queues.set(id, request);
    return request;
  };
}