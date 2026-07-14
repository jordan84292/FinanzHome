import { describe, expect, it } from 'vitest';
import { createCategory, listCategories, listUnits } from '@/lib/db/procedures/products';
import { uniqueSuffix } from '../../helpers/db';

describe('product catalog procedures', () => {
  it('lists the seeded categories', async () => {
    const categories = await listCategories();
    expect(categories.map((c) => c.name)).toContain('Despensa');
  });

  it('lists the seeded units', async () => {
    const units = await listUnits();
    expect(units.map((u) => u.code)).toContain('kg');
  });

  it('creates a new category', async () => {
    const name = `Categoria ${uniqueSuffix()}`;
    const created = await createCategory(name);
    expect(created.name).toBe(name);

    const categories = await listCategories();
    expect(categories.map((c) => c.id)).toContain(created.id);
  });
});
