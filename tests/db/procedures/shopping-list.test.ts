import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { createProduct, listCategories, listUnits } from '@/lib/db/procedures/products';
import {
  addShoppingListItem,
  deleteShoppingListItem,
  generateOrGetShoppingList,
  getShoppingList,
  getShoppingListItems,
  updateShoppingListItem,
} from '@/lib/db/procedures/shopping-list';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

async function createMember(suffix: string): Promise<{ householdId: number; memberId: number }> {
  const user = await registerUser({
    email: `shop_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id };
}

describe('shopping list generate/get/items-get procedures', () => {
  it('generates a list containing only products with a real deficit', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const shortProduct = await createProduct({
      householdId,
      name: `Arroz ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 5,
      currentQuantity: 2,
      defaultPrice: 1500,
      defaultPriceCurrencyId: CRC_ID,
      createdByMemberId: memberId,
    });
    await createProduct({
      householdId,
      name: `Sal ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 1,
      currentQuantity: 1,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    const list = await generateOrGetShoppingList(householdId, memberId);
    expect(list.status).toBe('open');

    const items = await getShoppingListItems(list.id, householdId, CRC_ID);
    expect(items).toHaveLength(1);
    expect(items[0].product_id).toBe(shortProduct.id);
    expect(items[0].quantity_needed).toBe(3);
  });

  it('is idempotent: a second call while a list is open returns the same list, not a new one', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    await createProduct({
      householdId,
      name: `Cafe ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    const first = await generateOrGetShoppingList(householdId, memberId);
    const second = await generateOrGetShoppingList(householdId, memberId);
    expect(second.id).toBe(first.id);
  });

  it('rejects fetching a list that belongs to a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createMember(suffixA);
    const { householdId: householdIdB } = await createMember(suffixB);

    const list = await generateOrGetShoppingList(householdIdA, memberIdA);

    await expect(getShoppingList(list.id, householdIdB, CRC_ID)).rejects.toThrow(/not found/i);
    await expect(getShoppingListItems(list.id, householdIdB, CRC_ID)).rejects.toThrow(/not found/i);
  });
});

describe('shopping list item edit procedures', () => {
  it('adds an extra item not derived from any deficit', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    const product = await createProduct({
      householdId,
      name: `Chocolate ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 0,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);

    const item = await addShoppingListItem({
      shoppingListId: list.id,
      householdId,
      productId: product.id,
      quantityNeeded: 2,
      unitPrice: 2500,
      unitPriceCurrencyId: CRC_ID,
      isExtra: true,
    });

    expect(item.is_extra).toBe(1);
    const items = await getShoppingListItems(list.id, householdId, CRC_ID);
    expect(items.map((i) => i.id)).toContain(item.id);
  });

  it('updates an item quantity and price', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    const product = await createProduct({
      householdId,
      name: `Pan ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);
    const [item] = await getShoppingListItems(list.id, householdId, CRC_ID);

    const updated = await updateShoppingListItem({
      itemId: item.id,
      householdId,
      quantityNeeded: 5,
      unitPrice: 1200,
      unitPriceCurrencyId: CRC_ID,
    });

    expect(updated.quantity_needed).toBe(5);
    expect(updated.unit_price).toBe(1200);
  });

  it('deletes an item', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    const product = await createProduct({
      householdId,
      name: `Huevos ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 1,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);
    const [item] = await getShoppingListItems(list.id, householdId, CRC_ID);

    await deleteShoppingListItem(item.id, householdId);

    const items = await getShoppingListItems(list.id, householdId, CRC_ID);
    expect(items.map((i) => i.id)).not.toContain(item.id);
  });

  it('rejects updating an item that belongs to a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createMember(suffixA);
    const { householdId: householdIdB } = await createMember(suffixB);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    const product = await createProduct({
      householdId: householdIdA,
      name: `Manzanas ${suffixA}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 3,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberIdA,
    });
    const list = await generateOrGetShoppingList(householdIdA, memberIdA);
    const [item] = await getShoppingListItems(list.id, householdIdA, CRC_ID);

    await expect(
      updateShoppingListItem({
        itemId: item.id,
        householdId: householdIdB,
        quantityNeeded: 99,
        unitPrice: null,
        unitPriceCurrencyId: null,
      }),
    ).rejects.toThrow(/not found/i);
  });
});
