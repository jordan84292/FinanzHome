import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import {
  createCategory,
  createProduct,
  deactivateProduct,
  listCategories,
  listProducts,
  listUnits,
  updateCurrentQuantity,
} from '@/lib/db/procedures/products';
import { uniqueSuffix } from '../../helpers/db';

async function createMember(suffix: string): Promise<{ householdId: number; memberId: number }> {
  const user = await registerUser({
    email: `product_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
    creatorPaymentDay: 5,
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id };
}

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

describe('product procedures', () => {
  it('creates a product and lists it scoped to its household', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const product = await createProduct({
      householdId,
      name: `Arroz ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 0,
      defaultPrice: 1500,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    expect(product.name).toBe(`Arroz ${suffix}`);
    expect(product.category_name).toBe(category.name);

    const products = await listProducts(householdId);
    expect(products.map((p) => p.id)).toContain(product.id);
  });

  it('updates current quantity independently of the other fields', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const product = await createProduct({
      householdId,
      name: `Leche ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 4,
      currentQuantity: 1,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    const updated = await updateCurrentQuantity(product.id, householdId, 3);
    expect(updated.current_quantity).toBe(3);
    expect(updated.optimal_quantity).toBe(4);
  });

  it('rejects a negative current quantity', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const product = await createProduct({
      householdId,
      name: `Yogur ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 1,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    // Assert on the specific SIGNALed message, not just "some error was thrown" -
    // this is what proves the SP's own negative-quantity guard fired (SQLSTATE 45000),
    // rather than some unrelated error (e.g. a coercion/validation failure upstream).
    await expect(updateCurrentQuantity(product.id, householdId, -1)).rejects.toThrow(
      /Current quantity cannot be negative/,
    );
  });

  it('rejects updating current quantity for a product owned by a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createMember(suffixA);
    const { householdId: householdIdB } = await createMember(suffixB);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const product = await createProduct({
      householdId: householdIdA,
      name: `Cafe ${suffixA}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 1,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberIdA,
    });

    // Household B must not be able to mutate a product that belongs to household A,
    // even though it knows (or guessed) the product's numeric id (IDOR check).
    await expect(updateCurrentQuantity(product.id, householdIdB, 3)).rejects.toThrow(
      /not found/i,
    );
  });

  it('deactivates a product so it no longer appears in the list', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const product = await createProduct({
      householdId,
      name: `Jabón ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 1,
      currentQuantity: 1,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    await deactivateProduct(product.id, householdId);

    const products = await listProducts(householdId);
    expect(products.map((p) => p.id)).not.toContain(product.id);
  });
});
