"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  slug: string;
  verification_status: string;
  status: string;
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

type Conversation = {
  id: string;
  store_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_type: "customer" | "store";
  message: string;
  is_read: boolean;
  created_at: string;
};

const CART_PREFIX = "minishop-cart-";

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
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerDistrict, setCustomerDistrict] = useState("");

  const [showMessages, setShowMessages] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);

  useEffect(() => {
    loadStore();
  }, []);

  useEffect(() => {
    if (!store) return;

    const savedCart = localStorage.getItem(`${CART_PREFIX}${store.id}`);

    if (!savedCart) {
      setCart([]);
      return;
    }

    try {
      const parsed = JSON.parse(savedCart);

      if (Array.isArray(parsed)) {
        setCart(parsed);
      }
    } catch {
      setCart([]);
    }
  }, [store]);

  useEffect(() => {
    if (!store) return;

    localStorage.setItem(
      `${CART_PREFIX}${store.id}`,
      JSON.stringify(cart)
    );
  }, [cart, store]);

  useEffect(() => {
    if (!showMessages || !conversation) return;

    loadChatMessages(conversation.id);

    const interval = setInterval(() => {
      loadChatMessages(conversation.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [showMessages, conversation]);

  async function loadStore() {
    try {
      setLoading(true);
      setError("");

      const slug = decodeURIComponent(
        window.location.pathname.split("/")[1] || ""
      );

      if (!slug) {
        setError("Mağaza bulunamadı.");
        return;
      }

      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select(
          "id,name,slug,verification_status,status"
        )
        .eq("slug", slug)
        .maybeSingle();

      if (storeError) {
        throw storeError;
      }

      if (!storeData) {
        setStore(null);
        return;
      }

      setStore(storeData);

      if (
        storeData.verification_status !== "approved" ||
        storeData.status !== "active"
      ) {
        setProducts([]);
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(
          "id,store_id,name,description,price,stock,image_url,is_active"
        )
        .eq("store_id", storeData.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (productError) {
        throw productError;
      }

      setProducts(productData || []);

      await loadUnreadMessageCount(storeData.id);
    } catch (err) {
      console.error(err);
      setError("Mağaza yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function loadUnreadMessageCount(storeId: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: conversationData } = await supabase
        .from("conversations")
        .select("id")
        .eq("store_id", storeId)
        .eq("customer_id", user.id)
        .maybeSingle();

      if (!conversationData) {
        setMessageUnreadCount(0);
        return;
      }

      const { count } = await supabase
        .from("messages")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("conversation_id", conversationData.id)
        .eq("sender_type", "store")
        .eq("is_read", false);

      setMessageUnreadCount(count || 0);
    } catch (err) {
      console.error(err);
    }
  }

  async function openMessages() {
    if (!store) return;

    try {
      setLoadingMessages(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Mesaj göndermek için giriş yapmalısınız.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      let { data: existingConversation, error: conversationError } =
        await supabase
          .from("conversations")
          .select(
            "id,store_id,customer_id,customer_name,customer_phone"
          )
          .eq("store_id", store.id)
          .eq("customer_id", user.id)
          .maybeSingle();

      if (conversationError) {
        throw conversationError;
      }

      if (!existingConversation) {
        const { data: newConversation, error: createError } =
          await supabase
            .from("conversations")
            .insert({
              store_id: store.id,
              customer_id: user.id,
              customer_name:
                profile?.full_name || user.email || "Müşteri",
              customer_phone: null,
            })
            .select(
              "id,store_id,customer_id,customer_name,customer_phone"
            )
            .single();

        if (createError) {
          throw createError;
        }

        existingConversation = newConversation;
      }

      setConversation(existingConversation);
      setShowMessages(true);

      await loadChatMessages(existingConversation.id);
    } catch (err) {
      console.error(err);
      setError("Mesajlaşma açılırken bir hata oluştu.");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function loadChatMessages(conversationId: string) {
    try {
      const { data, error: messagesError } = await supabase
        .from("messages")
        .select(
          "id,conversation_id,sender_id,sender_type,message,is_read,created_at"
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (messagesError) {
        throw messagesError;
      }

      setChatMessages(data || []);

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "store")
        .eq("is_read", false);

      setMessageUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  }

  async function sendChatMessage() {
    const text = chatInput.trim();

    if (!text || !conversation) return;

    try {
      setSendingMessage(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Mesaj göndermek için giriş yapmalısınız.");
        return;
      }

      const { error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          sender_type: "customer",
          message: text,
          is_read: false,
        });

      if (insertError) {
        throw insertError;
      }

      await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);

      setChatInput("");

      await loadChatMessages(conversation.id);
    } catch (err) {
      console.error(err);
      setError("Mesaj gönderilemedi.");
    } finally {
      setSendingMessage(false);
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
        if (existing.quantity >= product.stock) {
          setError("Stok adedinden fazlasını ekleyemezsiniz.");
          return currentCart;
        }

        return currentCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
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

    setMessage("Ürün sepete eklendi.");
  }

  function increaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== productId) return item;

        if (item.quantity >= item.stock) {
          setError("Stok adedine ulaştınız.");
          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        };
      })
    );
  }

  function decreaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.id !== productId) return item;

          return {
            ...item,
            quantity: item.quantity - 1,
          };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    );
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) => {
      const name = product.name.toLowerCase();
      const description = product.description?.toLowerCase() || "";

      return (
        name.includes(query) ||
        description.includes(query)
      );
    });
  }, [products, search]);

  const cartCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  function formatPrice(value: number) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(value);
  }

  function openCheckout() {
    if (cart.length === 0) {
      setError("Sepetiniz boş.");
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

    if (!store) return;

    if (!customerName.trim()) {
      setError("Ad soyad alanını doldurun.");
      return;
    }

    if (!customerPhone.trim()) {
      setError("Telefon numarasını girin.");
      return;
    }

    if (!customerAddress.trim()) {
      setError("Adres alanını doldurun.");
      return;
    }

    if (!customerCity.trim()) {
      setError("İl bilgisini girin.");
      return;
    }

    if (!customerDistrict.trim()) {
      setError("İlçe bilgisini girin.");
      return;
    }

    if (cart.length === 0) {
      setError("Sepetiniz boş.");
      return;
    }

    try {
      setCreatingOrder(true);

      const items = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));

      const { data, error: orderError } = await supabase.rpc(
        "create_order_with_stock",
        {
          p_store_id: store.id,
          p_customer_name: customerName.trim(),
          p_customer_phone: customerPhone.trim(),
          p_customer_address: customerAddress.trim(),
          p_customer_city: customerCity.trim(),
          p_customer_district: customerDistrict.trim(),
          p_items: items,
        }
      );

      if (orderError) {
        throw orderError;
      }

      setCompletedOrderId(data);
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);

      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerCity("");
      setCustomerDistrict("");

      await loadStore();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Sipariş oluşturulurken bir hata oluştu."
      );
    } finally {
      setCreatingOrder(false);
    }
  }

  function continueShopping() {
    setCompletedOrderId(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function formatMessageTime(date: string) {
    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />

          <div className="mt-6 h-72 animate-pulse rounded-3xl bg-slate-200" />

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-2xl bg-slate-200"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!store) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-10 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-black text-white">
            M
          </div>

          <h1 className="mt-6 text-2xl font-bold text-slate-900">
            Mağaza bulunamadı
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Aradığınız mağaza mevcut değil veya bağlantı yanlış.
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </main>
    );
  }

  if (
    store.verification_status !== "approved" ||
    store.status !== "active"
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-10 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-black text-white">
            M
          </div>

          <h1 className="mt-6 text-2xl font-bold text-slate-900">
            Mağaza şu anda satışa kapalı
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Bu mağaza henüz doğrulanmamış veya geçici olarak satışa
            kapatılmış olabilir.
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </main>
    );
  }

  if (completedOrderId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-xl rounded-3xl bg-white p-10 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-600">
            ✓
          </div>

          <h1 className="mt-6 text-3xl font-black text-slate-900">
            Siparişiniz oluşturuldu
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Siparişiniz başarıyla oluşturuldu. Sipariş numaranız:
          </p>

          <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-4 font-mono text-sm text-slate-700">
            {completedOrderId}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/customer"
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Siparişlerime Git
            </Link>

            <button
              onClick={continueShopping}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Alışverişe Devam Et
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-black text-white">
              M
            </div>

            <div>
              <div className="text-sm font-black text-slate-900">
                MiniShop
              </div>

              <div className="max-w-[180px] truncate text-xs text-slate-500">
                {store.name}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={openMessages}
              className="relative hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:block"
            >
              Mesajlaşma

              {messageUnreadCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {messageUnreadCount > 9
                    ? "9+"
                    : messageUnreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowCart(true)}
              className="relative rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sepet

              {cartCount > 0 && (
                <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-900">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
              Güvenli MiniShop mağazası
            </div>

            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              {store.name}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
              Mağazanın ürünlerini keşfedin, ürün detaylarını inceleyin
              ve alışverişinizi güvenli şekilde tamamlayın.
            </p>

            <div className="mt-8 flex max-w-2xl items-center rounded-2xl border border-white/10 bg-white/5 p-2">
              <svg
                className="ml-3 h-5 w-5 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
                />
              </svg>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Bu mağazada ürün ara..."
                className="w-full bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Mağaza ürünleri
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-900">
              Ürünleri keşfet
            </h2>
          </div>

          <div className="text-sm text-slate-500">
            {filteredProducts.length} ürün
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              🔎
            </div>

            <h3 className="mt-5 text-lg font-bold text-slate-900">
              Ürün bulunamadı
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Arama kriterlerinizi değiştirerek tekrar deneyin.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <Link
                  href={`/${store.slug}/product/${product.id}`}
                  className="block"
                >
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-5xl font-black text-slate-300">
                        M
                      </div>
                    )}

                    {product.stock <= 0 && (
                      <div className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                        Tükendi
                      </div>
                    )}

                    {product.stock > 0 &&
                      product.stock <= 5 && (
                        <div className="absolute left-3 top-3 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
                          Son {product.stock} adet
                        </div>
                      )}
                  </div>
                </Link>

                <div className="p-5">
                  <Link
                    href={`/${store.slug}/product/${product.id}`}
                  >
                    <h3 className="line-clamp-2 min-h-12 font-bold text-slate-900 transition group-hover:text-slate-700">
                      {product.name}
                    </h3>
                  </Link>

                  {product.description && (
                    <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                      {product.description}
                    </p>
                  )}

                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-slate-900">
                        {formatPrice(Number(product.price))}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {product.stock > 0
                          ? `${product.stock} adet stokta`
                          : "Stokta yok"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`/${store.slug}/product/${product.id}`}
                      className="rounded-xl border border-slate-200 px-3 py-3 text-center text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      İncele
                    </Link>

                    <button
                      onClick={() => addToCart(product)}
                      disabled={product.stock <= 0}
                      className="rounded-xl bg-slate-900 px-3 py-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Sepete Ekle
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showCheckout && (
        <section
          id="checkout"
          className="border-t border-slate-200 bg-white"
        >
          <div className="mx-auto max-w-7xl px-4 py-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Sipariş
                </p>

                <h2 className="mt-2 text-3xl font-black text-slate-900">
                  Teslimat bilgileri
                </h2>

                <p className="mt-3 text-sm text-slate-500">
                  Siparişinizi oluşturmak için teslimat bilgilerinizi
                  doldurun.
                </p>

                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Ad Soyad
                    </label>

                    <input
                      value={customerName}
                      onChange={(event) =>
                        setCustomerName(event.target.value)
                      }
                      placeholder="Adınız ve soyadınız"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Telefon
                    </label>

                    <input
                      value={customerPhone}
                      onChange={(event) =>
                        setCustomerPhone(event.target.value)
                      }
                      placeholder="05XX XXX XX XX"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Adres
                    </label>

                    <textarea
                      value={customerAddress}
                      onChange={(event) =>
                        setCustomerAddress(event.target.value)
                      }
                      rows={4}
                      placeholder="Mahalle, sokak, bina, daire..."
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      İl
                    </label>

                    <input
                      value={customerCity}
                      onChange={(event) =>
                        setCustomerCity(event.target.value)
                      }
                      placeholder="İstanbul"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      İlçe
                    </label>

                    <input
                      value={customerDistrict}
                      onChange={(event) =>
                        setCustomerDistrict(event.target.value)
                      }
                      placeholder="İlçe"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </div>
              </div>

              <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-black text-slate-900">
                  Sipariş özeti
                </h3>

                <div className="mt-5 space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          {item.name}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {item.quantity} adet
                        </div>
                      </div>

                      <div className="font-bold text-slate-900">
                        {formatPrice(
                          Number(item.price) * item.quantity
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="my-6 border-t border-slate-200" />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Toplam
                  </span>

                  <span className="text-2xl font-black text-slate-900">
                    {formatPrice(total)}
                  </span>
                </div>

                <button
                  onClick={createOrder}
                  disabled={creatingOrder}
                  className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {creatingOrder
                    ? "Sipariş oluşturuluyor..."
                    : "Siparişi Oluştur"}
                </button>

                <button
                  onClick={() => setShowCheckout(false)}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Geri Dön
                </button>
              </aside>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center">
          <div>
            © {new Date().getFullYear()} MiniShop
          </div>

          <div className="flex gap-5">
            <Link
              href="/"
              className="transition hover:text-slate-900"
            >
              Ana Sayfa
            </Link>

            <Link
              href="/customer"
              className="transition hover:text-slate-900"
            >
              Hesabım
            </Link>
          </div>
        </div>
      </footer>

      {showCart && (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Sepeti kapat"
            onClick={() => setShowCart(false)}
            className="absolute inset-0 bg-black/50"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Sepetim
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {cartCount} ürün
                </p>
              </div>

              <button
                onClick={() => setShowCart(false)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                    🛒
                  </div>

                  <h3 className="mt-5 font-bold text-slate-900">
                    Sepetiniz boş
                  </h3>

                  <p className="mt-2 max-w-xs text-sm text-slate-500">
                    Beğendiğiniz ürünleri sepete ekleyerek alışverişe
                    başlayabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex gap-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-black text-slate-300">
                              M
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-sm font-bold text-slate-900">
                            {item.name}
                          </div>

                          <div className="mt-1 text-sm font-black text-slate-900">
                            {formatPrice(Number(item.price))}
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center rounded-xl border border-slate-200">
                              <button
                                onClick={() =>
                                  decreaseQuantity(item.id)
                                }
                                className="px-3 py-2 text-sm font-bold"
                              >
                                −
                              </button>

                              <span className="min-w-8 text-center text-sm font-bold">
                                {item.quantity}
                              </span>

                              <button
                                onClick={() =>
                                  increaseQuantity(item.id)
                                }
                                className="px-3 py-2 text-sm font-bold"
                              >
                                +
                              </button>
                            </div>

                            <button
                              onClick={() =>
                                removeFromCart(item.id)
                              }
                              className="text-xs font-semibold text-red-500 hover:text-red-700"
                            >
                              Kaldır
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-200 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Toplam
                  </span>

                  <span className="text-2xl font-black text-slate-900">
                    {formatPrice(total)}
                  </span>
                </div>

                <button
                  onClick={openCheckout}
                  className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Siparişi Tamamla
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {showMessages && (
        <div className="fixed inset-0 z-[60]">
          <button
            aria-label="Mesajları kapat"
            onClick={() => setShowMessages(false)}
            className="absolute inset-0 bg-black/50"
          />

          <div className="absolute bottom-0 right-0 flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:bottom-5 sm:right-5 sm:h-[650px] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-5 py-4">
              <div>
                <div className="text-sm font-black text-white">
                  Mağazaya Mesaj
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  {store.name}
                </div>
              </div>

              <button
                onClick={() => setShowMessages(false)}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Mesajlar yükleniyor...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                    💬
                  </div>

                  <h3 className="mt-4 font-bold text-slate-900">
                    Henüz mesaj yok
                  </h3>

                  <p className="mt-2 max-w-xs text-sm text-slate-500">
                    Mağazaya ürün veya sipariş hakkında soru
                    gönderebilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((chatMessage) => {
                    const isCustomer =
                      chatMessage.sender_type === "customer";

                    return (
                      <div
                        key={chatMessage.id}
                        className={`flex ${
                          isCustomer
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            isCustomer
                              ? "rounded-br-md bg-slate-900 text-white"
                              : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-5">
                            {chatMessage.message}
                          </p>

                          <div
                            className={`mt-2 text-[10px] ${
                              isCustomer
                                ? "text-slate-400"
                                : "text-slate-400"
                            }`}
                          >
                            {formatMessageTime(
                              chatMessage.created_at
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={chatInput}
                  onChange={(event) =>
                    setChatInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  rows={2}
                  placeholder="Mesajınızı yazın..."
                  className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />

                <button
                  onClick={sendChatMessage}
                  disabled={
                    sendingMessage || !chatInput.trim()
                  }
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {sendingMessage ? "..." : "Gönder"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={openMessages}
        className="fixed bottom-5 left-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-xl text-white shadow-xl transition hover:scale-105 sm:hidden"
        aria-label="Mesajlaşma"
      >
        💬

        {messageUnreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {messageUnreadCount > 9
              ? "9+"
              : messageUnreadCount}
          </span>
        )}
      </button>
    </main>
  );
}