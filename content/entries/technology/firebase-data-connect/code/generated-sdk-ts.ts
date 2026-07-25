import { executeMutation, executeQuery } from 'firebase/data-connect';
import {
  addFavoriteRef,
  listMyFavoritesRef,
  type ListMyFavoritesData,
} from '@dataconnect/generated';

export async function loadMyFavorites(): Promise<ListMyFavoritesData> {
  const result = await executeQuery(listMyFavoritesRef({ limit: 40 }));
  return result.data;
}

export async function saveFavorite(productId: string): Promise<void> {
  await executeMutation(addFavoriteRef({ productId }));
}
