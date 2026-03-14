'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '@/hooks/useCart';

// FILE 060 (Cart.tsx) not yet generated. Assumed props interface:
// type CartProps = {
//   storeSlug: string;
//   deliveryCharge: number;
//   freeDeliveryThreshold: number | null;
//   outOfStockIds?: string[];
//   variant?: 'panel' | 'page';
// }
// When generating FILE 060, ensure Cart accepts exactly these props.
import Cart from '@/components/store/Cart';

type FreshProduct = {
  id: string;
  trackStock: boolean;
  stockQuantity: number;
};

export default function CartPage() {
  const params = useParams();
  const storeSlug = params.storeSlug as string;

  const { items } = useCart();
  const productIds = items.map((i) => i.productId);

  const { data: productQueryResult } = useQuery<{
    data: FreshProduct[];
    deliveryCharge: number;
    freeDeliveryThreshold: number | null;
  }>({
    queryKey: ['cart-products', storeSlug, productIds.join(',')],
    queryFn: async () => {
      const url = productIds.length > 0
        ? `/api/products/public/${storeSlug}?ids=${productIds.join(',')}`
        : `/api/products/public/${storeSlug}?pageSize=1`;
      const res = await fetch(url);
      if (!res.ok) return { data: [], deliveryCharge: 0, freeDeliveryThreshold: null };
      const json = await res.json();
      return {
        data: json.data ?? [],
        deliveryCharge: json.deliveryCharge ?? 0,
        freeDeliveryThreshold: json.freeDeliveryThreshold ?? null,
      };
    },
    staleTime: 30_000,
  });

  const outOfStockIds = (productQueryResult?.data ?? [])
    .filter((p) => p.trackStock && p.stockQuantity === 0)
    .map((p) => p.id);

  return (
    <div className="min-h-screen bg-[var(--color-store-bg)]">
      <Cart
        storeSlug={storeSlug}
        deliveryCharge={productQueryResult?.deliveryCharge ?? 0}
        freeDeliveryThreshold={productQueryResult?.freeDeliveryThreshold ?? null}
        outOfStockIds={outOfStockIds}
        variant="page"
      />
    </div>
  );
}