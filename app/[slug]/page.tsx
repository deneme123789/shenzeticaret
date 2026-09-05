"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  slug: string;
  verification_status: "pending" | "approved" | "rejected";
  status: "active" | "suspended" | "blocked";
};

type Product = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
};

type CartItem = Product & {
  quantity: number;
};

export default function StorePage() {
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const [completedOrderId, setCompletedOrderId] = useState<string | null>(
    null
  );

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerDistrict, setCustomerDistrict] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  useEffect(() => {
    loadStore();
  }, []);

  async function loadStore() {
    try {
      setLoading(true);
      setError("");

      const slug = window.location.pathname.split("/")[1];

      if (!slug) {
        setError("Mağaza bulunamadı.");
        return;
      }

      const { data: storeData, error: storeError } = await supabase
  .from("stores")
  .select(
    "id, name, slug, verification_status, status"
  )
  .eq("slug", slug)
  .single();

      if (storeError || !storeData) {
        console.log("Store error:", storeError);
        setError("Mağaza bulunamadı.");
        return;
      }

      setStore(storeData);

      if (
  storeData.verification_status !== "approved" ||
  storeData.status !== "active"
) {
  setLoading(false);
  return;
}

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(
          "id, store_id, name, description, price, stock, image_url, is_active"
        )
        .eq("store_id", storeData.id)
        .eq("is_active", true)
        .order("created_at", {
          ascending: false,
        });

      if (productError) {
        console.log("Product error:", productError);
        setError("Ürünler yüklenemedi.");
        return;
      }

      setProducts(productData || []);
    } catch (err) {
      console.log("General error:", err);
      setError("Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  function addToCart(product: Product) {
    setError("");
    setMessage("");

    if (!product.is_active) {
      setError("Bu ürün artık satışta değil.");
      return;
    }

    if (product.stock <= 0) {
      setError("Bu ürün stokta yok.");
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + 1,
                  product.stock
                ),
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          ...product,
          quantity: 1,
        },
      ];
    });

    setMessage(`${product.name} sepete eklendi!`);
    setShowCart(true);
  }

  function increaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity: Math.min(
                item.quantity + 1,
                item.stock
              ),
            }
          : item
      )
    );
  }

  function decreaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    );
  }

  const filteredProducts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      return products;
    }

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(searchText) ||
        product.description?.toLowerCase().includes(searchText)
      );
    });
  }, [products, search]);

  const cartCount = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const total = useMemo(() => {
    return cart.reduce(
      (totalAmount, item) =>
        totalAmount + Number(item.price) * item.quantity,
      0
    );
  }, [cart]);

  function formatPrice(price: number) {
    return Number(price).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function openCheckout() {
    setError("");
    setMessage("");

    if (cart.length === 0) {
      setError("Önce sepetinize ürün ekleyin.");
      setShowCart(true);
      return;
    }

    setShowCart(false);
    setShowCheckout(true);

    setTimeout(() => {
      document
        .getElementById("checkout")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  }

  async function createOrder() {
    setError("");
    setMessage("");

    if (!store) {
      setError("Mağaza bilgisi bulunamadı.");
      return;
    }

    if (cart.length === 0) {
      setError("Sepetiniz boş.");
      return;
    }

    if (!customerName.trim()) {
      setError("Ad soyad alanını doldurun.");
      return;
    }

    if (!customerPhone.trim()) {
      setError("Telefon alanını doldurun.");
      return;
    }

    if (!customerCity.trim()) {
      setError("Şehir alanını doldurun.");
      return;
    }

    if (!customerDistrict.trim()) {
      setError("İlçe alanını doldurun.");
      return;
    }

    if (!customerAddress.trim()) {
      setError("Adres alanını doldurun.");
      return;
    }

    try {
      setCreatingOrder(true);

      const orderItems = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));

      const { data: orderId, error: orderError } =
        await supabase.rpc("create_order_with_stock", {
          p_store_id: store.id,
          p_customer_name: customerName.trim(),
          p_customer_phone: customerPhone.trim(),
          p_customer_address: customerAddress.trim(),
          p_customer_city: customerCity.trim(),
          p_customer_district: customerDistrict.trim(),
          p_items: orderItems,
        });

      if (orderError) {
        console.log("Order error:", orderError);

        const errorMessage = orderError.message.toLowerCase();

        if (errorMessage.includes("yetersiz stok")) {
          setError(
            "Bazı ürünlerin stoğu yeterli değil. Sepetinizi kontrol edin."
          );
        } else if (
          errorMessage.includes("ürün bulunamadı")
        ) {
          setError(
            "Sepetinizdeki ürünlerden biri artık mevcut değil."
          );
        } else if (
          errorMessage.includes("artık satışta değil")
        ) {
          setError(
            "Sepetinizdeki ürünlerden biri artık satışta değil."
          );
        } else {
          setError(
            "Sipariş oluşturulamadı. Lütfen tekrar deneyin."
          );
        }

        await loadStore();
        return;
      }

      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerCity("");
      setCustomerDistrict("");
      setCustomerAddress("");

      await loadStore();

      setCompletedOrderId(orderId);
      setShowCheckout(false);
      setShowCart(false);
      setMessage("");
    } catch (err) {
      console.log("Create order error:", err);

      setError(
        "Sipariş oluşturulurken bir hata oluştu. Lütfen tekrar deneyin."
      );
    } finally {
      setCreatingOrder(false);
    }
  }

  function continueShopping() {
    setCompletedOrderId(null);
    setShowCheckout(false);
    setShowCart(false);
    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="animate-pulse">
            <div className="h-10 w-64 rounded-xl bg-gray-200" />
            <div className="mt-4 h-5 w-80 rounded bg-gray-200" />

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="overflow-hidden rounded-3xl bg-white"
                >
                  <div className="h-64 bg-gray-200" />
                  <div className="space-y-3 p-6">
                    <div className="h-5 rounded bg-gray-200" />
                    <div className="h-4 w-2/3 rounded bg-gray-200" />
                    <div className="h-11 rounded-xl bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (
  store &&
  (
    store.verification_status !== "approved" ||
    store.status !== "active"
  )
) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl sm:p-12">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-yellow-100 text-5xl">
          🏪
        </div>

        <p className="mt-7 text-sm font-bold uppercase tracking-wider text-purple-600">
          MiniShop
        </p>

        <h1 className="mt-3 text-3xl font-extrabold text-gray-900">
          Mağaza şu anda satışa açık değil
        </h1>

        <p className="mt-4 leading-7 text-gray-600">
          <strong>{store.name}</strong> mağazası şu anda ürün satışı
          gerçekleştiremiyor.
        </p>

        <div className="mt-7 rounded-2xl bg-gray-50 p-5 text-left">
          <p className="text-sm font-bold text-gray-900">
            Mağaza durumu
          </p>

          <p className="mt-2 text-sm text-gray-600">
            Bu mağaza henüz MiniShop tarafından onaylanmamış,
            askıya alınmış veya satışa kapatılmış olabilir.
          </p>
        </div>

        <a
          href="/"
          className="mt-7 inline-block w-full rounded-xl bg-purple-600 px-6 py-4 font-bold text-white transition hover:bg-purple-700"
        >
          MiniShop Ana Sayfasına Dön
        </a>
      </div>
    </main>
  );
}
  if (!store) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="text-5xl">🏪</div>

          <h1 className="mt-5 text-2xl font-extrabold">
            Mağaza bulunamadı
          </h1>

          <p className="mt-3 text-gray-600">
            Aradığınız mağaza mevcut değil veya kaldırılmış olabilir.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700"
          >
            Ana Sayfaya Dön
          </a>
        </div>
      </main>
    );
  }

  if (completedOrderId) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 px-4 py-12">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl sm:p-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
              ✓
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-wider text-purple-600">
              Sipariş Başarılı
            </p>

            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              Siparişiniz alındı! 🎉
            </h1>

            <p className="mt-4 leading-7 text-gray-600">
              Siparişiniz başarıyla oluşturuldu. Mağaza sahibi
              siparişinizi hazırlamaya başlayabilir.
            </p>

            <div className="mt-8 rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">
                Sipariş Numaranız
              </p>

              <p className="mt-2 break-all text-lg font-extrabold text-gray-900">
                {completedOrderId}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={continueShopping}
                className="flex-1 rounded-xl bg-purple-600 px-5 py-4 font-bold text-white transition hover:bg-purple-700"
              >
                Alışverişe Devam Et
              </button>

              <a
                href="/"
                className="flex-1 rounded-xl border border-gray-300 px-5 py-4 font-bold text-gray-800 transition hover:bg-gray-50"
              >
                MiniShop Ana Sayfa
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold sm:text-2xl">
              {store.name}
            </h1>

            <p className="truncate text-xs text-gray-500 sm:text-sm">
              MiniShop mağazası
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="relative flex shrink-0 items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-purple-700"
          >
            <span>🛒</span>

            <span className="hidden sm:inline">
              Sepet
            </span>

            {cartCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1 text-xs font-extrabold text-purple-600">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-gradient-to-br from-purple-600 via-purple-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
              🛍️ Online Mağaza
            </div>

            <h2 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
              {store.name}
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-7 text-purple-100 sm:text-lg">
              Ürünlerimizi keşfedin, beğendiğiniz ürünleri sepetinize
              ekleyin ve kolayca sipariş oluşturun.
            </p>
          </div>

          {/* SEARCH */}
          <div className="mt-8 max-w-2xl">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                🔎
              </span>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ürün ara..."
                className="w-full rounded-2xl border-0 bg-white px-12 py-4 text-gray-900 shadow-lg outline-none ring-0 placeholder:text-gray-400 focus:ring-4 focus:ring-white/20"
              />
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        {/* MESSAGES */}
        {message && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
            <span className="text-xl">✓</span>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <span className="text-xl">!</span>
            <span>{error}</span>
          </div>
        )}

        {/* PRODUCTS HEADER */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-purple-600">
              Ürünler
            </p>

            <h2 className="mt-2 text-3xl font-extrabold">
              Mağaza ürünleri
            </h2>
          </div>

          <p className="text-sm text-gray-500">
            {filteredProducts.length} ürün
          </p>
        </div>

        {/* PRODUCTS */}
        {filteredProducts.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="text-5xl">🔎</div>

            <h3 className="mt-5 text-xl font-bold">
              Ürün bulunamadı
            </h3>

            <p className="mt-2 text-gray-500">
              Aramanı değiştirerek tekrar deneyebilirsin.
            </p>

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-5 rounded-xl bg-purple-600 px-5 py-3 font-bold text-white"
              >
                Aramayı Temizle
              </button>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl"
              >
                {/* IMAGE */}
                <div className="relative overflow-hidden bg-gray-100">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-64 w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-7xl">
                      🛍️
                    </div>
                  )}

                  {/* STOCK */}
                  {product.stock > 0 && product.stock <= 5 && (
                    <div className="absolute left-3 top-3 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow">
                      Son {product.stock} adet
                    </div>
                  )}

                  {product.stock <= 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <span className="rounded-full bg-white px-4 py-2 font-bold text-gray-900">
                        Stokta Yok
                      </span>
                    </div>
                  )}
                </div>

                {/* INFO */}
                <div className="p-5">
                  <h3 className="line-clamp-2 text-lg font-bold">
                    {product.name}
                  </h3>

                  {product.description && (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
                      {product.description}
                    </p>
                  )}

                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">
                        Fiyat
                      </p>

                      <p className="mt-1 text-xl font-extrabold text-purple-600">
                        {formatPrice(product.price)} TL
                      </p>
                    </div>

                    <span className="text-xs font-medium text-gray-500">
                      {product.stock > 0
                        ? `${product.stock} stok`
                        : "Tükendi"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-3.5 font-bold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    {product.stock > 0
                      ? "🛒 Sepete Ekle"
                      : "Stokta Yok"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* CHECKOUT */}
        {showCheckout && (
          <section
            id="checkout"
            className="mt-16 scroll-mt-28"
          >
            <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
              {/* FORM */}
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-purple-600">
                    Sipariş
                  </p>

                  <h2 className="mt-2 text-3xl font-extrabold">
                    Teslimat bilgileri
                  </h2>

                  <p className="mt-2 text-gray-500">
                    Siparişiniz için gerekli bilgileri doldurun.
                  </p>
                </div>

                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-bold">
                      Ad Soyad
                    </label>

                    <input
                      value={customerName}
                      onChange={(e) =>
                        setCustomerName(e.target.value)
                      }
                      placeholder="Örn. Ahmet Yılmaz"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3.5 outline-none transition focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-bold">
                      Telefon
                    </label>

                    <input
                      value={customerPhone}
                      onChange={(e) =>
                        setCustomerPhone(e.target.value)
                      }
                      type="tel"
                      placeholder="05XX XXX XX XX"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3.5 outline-none transition focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Şehir
                    </label>

                    <input
                      value={customerCity}
                      onChange={(e) =>
                        setCustomerCity(e.target.value)
                      }
                      placeholder="İstanbul"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3.5 outline-none transition focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      İlçe
                    </label>

                    <input
                      value={customerDistrict}
                      onChange={(e) =>
                        setCustomerDistrict(e.target.value)
                      }
                      placeholder="Esenyurt"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3.5 outline-none transition focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-bold">
                      Açık Adres
                    </label>

                    <textarea
                      value={customerAddress}
                      onChange={(e) =>
                        setCustomerAddress(e.target.value)
                      }
                      placeholder="Mahalle, sokak, bina no, daire no..."
                      rows={5}
                      className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3.5 outline-none transition focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    ❌ {error}
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCheckout(false);
                      setShowCart(true);
                    }}
                    className="rounded-xl border border-gray-300 px-5 py-4 font-bold text-gray-800 hover:bg-gray-50"
                  >
                    ← Sepete Dön
                  </button>

                  <button
                    type="button"
                    onClick={createOrder}
                    disabled={creatingOrder}
                    className="flex-1 rounded-xl bg-purple-600 px-5 py-4 font-bold text-white shadow-lg transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingOrder
                      ? "Sipariş oluşturuluyor..."
                      : "Siparişi Oluştur →"}
                  </button>
                </div>
              </div>

              {/* SUMMARY */}
              <div className="h-fit rounded-3xl border border-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
                <h3 className="text-xl font-extrabold">
                  Sipariş Özeti
                </h3>

                <div className="mt-5 space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-2xl">
                            🛍️
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">
                          {item.name}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {item.quantity} ×{" "}
                          {formatPrice(item.price)} TL
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t border-gray-200 pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      Ürünler
                    </span>

                    <span className="font-semibold">
                      {formatPrice(total)} TL
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-extrabold">
                      Toplam
                    </span>

                    <span className="text-2xl font-extrabold text-purple-600">
                      {formatPrice(total)} TL
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* CART OVERLAY */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Sepeti kapat"
            onClick={() => setShowCart(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            {/* CART HEADER */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-5">
              <div>
                <h2 className="text-2xl font-extrabold">
                  Sepetim
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {cartCount} ürün
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCart(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-xl hover:bg-gray-200"
              >
                ×
              </button>
            </div>

            {/* CART CONTENT */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="text-6xl">🛒</div>

                  <h3 className="mt-5 text-xl font-extrabold">
                    Sepetin boş
                  </h3>

                  <p className="mt-2 text-gray-500">
                    Beğendiğin ürünleri sepete eklemeye başla.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowCart(false)}
                    className="mt-6 rounded-xl bg-purple-600 px-6 py-3 font-bold text-white"
                  >
                    Ürünlere Bak
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-gray-200 p-4"
                    >
                      <div className="flex gap-3">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-3xl">
                              🛍️
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-bold">
                            {item.name}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-purple-600">
                            {formatPrice(item.price)} TL
                          </p>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center rounded-xl border border-gray-200">
                              <button
                                type="button"
                                onClick={() =>
                                  decreaseQuantity(item.id)
                                }
                                className="px-3 py-2 font-bold hover:bg-gray-50"
                              >
                                −
                              </button>

                              <span className="min-w-8 text-center text-sm font-bold">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  increaseQuantity(item.id)
                                }
                                disabled={
                                  item.quantity >= item.stock
                                }
                                className="px-3 py-2 font-bold hover:bg-gray-50 disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeFromCart(item.id)
                              }
                              className="text-sm font-semibold text-red-500 hover:text-red-700"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CART FOOTER */}
            {cart.length > 0 && (
              <div className="border-t border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-gray-500">
                    Toplam
                  </span>

                  <span className="text-2xl font-extrabold text-purple-600">
                    {formatPrice(total)} TL
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openCheckout}
                  className="w-full rounded-xl bg-purple-600 py-4 font-bold text-white shadow-lg transition hover:bg-purple-700"
                >
                  Siparişi Tamamla →
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-center sm:px-6 sm:text-left md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-extrabold">
              {store.name}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              MiniShop altyapısıyla oluşturuldu.
            </p>
          </div>

          <a
            href="/"
            className="text-sm font-semibold text-purple-600 hover:text-purple-800"
          >
            MiniShop
          </a>
        </div>
      </footer>
    </main>
  );
}

