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

type Conversation = {
id: string;
store_id: string;
customer_id: string | null;
customer_name: string;
customer_phone: string | null;
created_at: string;
updated_at: string;
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

// ============================================
// MESAJLAŞMA
// ============================================

const [showMessages, setShowMessages] = useState(false);
const [conversation, setConversation] =
useState<Conversation | null>(null);
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
const [chatInput, setChatInput] = useState("");
const [loadingMessages, setLoadingMessages] = useState(false);
const [sendingMessage, setSendingMessage] = useState(false);
const [messageUnreadCount, setMessageUnreadCount] = useState(0);

useEffect(() => {
loadStore();
}, []);

useEffect(() => {
if (!showMessages || !conversation) {
return;
}


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
    return;
  }

  const { data: productData, error: productError } =
    await supabase
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

  await loadUnreadMessageCount(storeData.id);
} catch (err) {
  console.log("General error:", err);
  setError("Bir hata oluştu.");
} finally {
  setLoading(false);
}


}

// ============================================
// MESAJLAŞMA
// ============================================

async function loadUnreadMessageCount(storeId: string) {
try {
const {
data: { user },
} = await supabase.auth.getUser();


  if (!user) {
    setMessageUnreadCount(0);
    return;
  }

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
  console.log("Unread message error:", err);
}


}

async function openMessages() {
setError("");
setMessage("");


if (!store) {
  return;
}

try {
  setLoadingMessages(true);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    setError(
      "Mağazaya mesaj göndermek için önce giriş yapmalısınız."
    );
    return;
  }

  const { data: existingConversation, error: conversationError } =
    await supabase
      .from("conversations")
      .select(
        "id, store_id, customer_id, customer_name, customer_phone, created_at, updated_at"
      )
      .eq("store_id", store.id)
      .eq("customer_id", user.id)
      .maybeSingle();

  if (conversationError) {
    console.log(
      "Conversation search error:",
      conversationError
    );
    setError("Mesajlaşma ekranı açılamadı.");
    return;
  }

  let currentConversation = existingConversation;

  if (!currentConversation) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const name =
      profileData?.full_name ||
      user.user_metadata?.full_name ||
      "Müşteri";

    const { data: newConversation, error: createError } =
      await supabase
        .from("conversations")
        .insert({
          store_id: store.id,
          customer_id: user.id,
          customer_name: name,
          customer_phone: null,
        })
        .select(
          "id, store_id, customer_id, customer_name, customer_phone, created_at, updated_at"
        )
        .single();

    if (createError || !newConversation) {
      console.log(
        "Conversation create error:",
        createError
      );
      setError("Mesajlaşma başlatılamadı.");
      return;
    }

    currentConversation = newConversation;
  }

  setConversation(currentConversation);
  setShowMessages(true);

  await loadChatMessages(currentConversation.id);
} catch (err) {
  console.log("Open messages error:", err);
  setError(
    "Mesajlaşma ekranı açılırken bir hata oluştu."
  );
} finally {
  setLoadingMessages(false);
}


}

async function loadChatMessages(conversationId: string) {
try {
const { data, error: messagesError } = await supabase
.from("messages")
.select(
"id, conversation_id, sender_id, sender_type, message, is_read, created_at"
)
.eq("conversation_id", conversationId)
.order("created_at", {
ascending: true,
});


  if (messagesError) {
    console.log(
      "Messages loading error:",
      messagesError
    );
    return;
  }

  setChatMessages(data || []);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && data && data.length > 0) {
    const unreadStoreMessages = data.filter(
      (item) =>
        item.sender_type === "store" &&
        item.is_read === false
    );

    if (unreadStoreMessages.length > 0) {
      await supabase
        .from("messages")
        .update({
          is_read: true,
        })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "store")
        .eq("is_read", false);

      setMessageUnreadCount(0);
    }
  }
} catch (err) {
  console.log("Load chat error:", err);
}


}

async function sendChatMessage() {
const text = chatInput.trim();


if (!text) {
  return;
}

if (!conversation) {
  setError("Mesajlaşma bulunamadı.");
  return;
}

try {
  setSendingMessage(true);
  setError("");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    setError(
      "Mesaj göndermek için giriş yapmalısınız."
    );
    return;
  }

  const { error: sendError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      sender_type: "customer",
      message: text,
      is_read: false,
    });

  if (sendError) {
    console.log(
      "Send message error:",
      sendError
    );
    setError("Mesaj gönderilemedi.");
    return;
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
  console.log("Send chat error:", err);
  setError(
    "Mesaj gönderilirken bir hata oluştu."
  );
} finally {
  setSendingMessage(false);
}


}

function closeMessages() {
setShowMessages(false);
setConversation(null);
setChatMessages([]);
setChatInput("");
setError("");
}

function formatMessageTime(date: string) {
return new Date(date).toLocaleTimeString("tr-TR", {
hour: "2-digit",
minute: "2-digit",
});
}

// ============================================
// SEPET
// ============================================

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

setMessage(`${product.name} sepete eklendi.`);
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
currentCart.filter(
(item) => item.id !== productId
)
);
}

const filteredProducts = useMemo(() => {
const searchText = search.trim().toLowerCase();


if (!searchText) {
  return products;
}

return products.filter((product) => {
  return (
    product.name
      .toLowerCase()
      .includes(searchText) ||
    product.description
      ?.toLowerCase()
      .includes(searchText)
  );
});

}, [products, search]);

const cartCount = useMemo(() => {
return cart.reduce(
(total, item) => total + item.quantity,
0
);
}, [cart]);

const total = useMemo(() => {
return cart.reduce(
(totalAmount, item) =>
totalAmount +
Number(item.price) * item.quantity,
0
);
}, [cart]);

function formatPrice(price: number) {
return Number(price).toLocaleString("tr-TR", {
minimumFractionDigits: 2,
maximumFractionDigits: 2,
});
}

// ============================================
// CHECKOUT
// ============================================

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
  setError("Açık adres alanını doldurun.");
  return;
}

try {
  setCreatingOrder(true);

  const orderItems = cart.map((item) => ({
    product_id: item.id,
    quantity: item.quantity,
  }));

  const { data: orderId, error: orderError } =
    await supabase.rpc(
      "create_order_with_stock",
      {
        p_store_id: store.id,
        p_customer_name:
          customerName.trim(),
        p_customer_phone:
          customerPhone.trim(),
        p_customer_address:
          customerAddress.trim(),
        p_customer_city:
          customerCity.trim(),
        p_customer_district:
          customerDistrict.trim(),
        p_items: orderItems,
      }
    );

  if (orderError) {
    console.log(
      "Order error:",
      orderError
    );

    const errorMessage =
      orderError.message.toLowerCase();

    if (
      errorMessage.includes("yetersiz stok")
    ) {
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
  console.log(
    "Create order error:",
    err
  );

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

// ============================================
// LOADING
// ============================================

if (loading) {
return ( <main className="min-h-screen bg-slate-50"> <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6"> <div className="animate-pulse"> <div className="h-10 w-64 rounded-xl bg-slate-200" /> <div className="mt-4 h-5 w-80 rounded bg-slate-200" />


        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
            >
              <div className="h-64 bg-slate-200" />

              <div className="space-y-3 p-6">
                <div className="h-5 rounded bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-11 rounded-xl bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </main>
);


}

// ============================================
// MAĞAZA KAPALI
// ============================================

if (
store &&
(
store.verification_status !== "approved" ||
store.status !== "active"
)
) {
return ( <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6"> <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl sm:p-12"> <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-5xl">
🏪 </div>


      <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
        MiniShop
      </p>

      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
        Mağaza şu anda satışa açık değil
      </h1>

      <p className="mt-4 leading-7 text-slate-600">
        <strong>{store.name}</strong> mağazası
        şu anda ürün satışı gerçekleştiremiyor.
      </p>

      <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left">
        <p className="text-sm font-bold text-slate-900">
          Mağaza durumu
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Bu mağaza henüz MiniShop tarafından
          onaylanmamış, askıya alınmış veya
          satışa kapatılmış olabilir.
        </p>
      </div>

      <a
        href="/"
        className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-6 py-4 font-bold text-white transition hover:bg-slate-800"
      >
        MiniShop Ana Sayfasına Dön
      </a>
    </div>
  </main>
);


}

// ============================================
// STORE YOK
// ============================================

if (!store) {
return ( <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6"> <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"> <div className="text-5xl">
🏪 </div>


      <h1 className="mt-5 text-2xl font-extrabold text-slate-950">
        Mağaza bulunamadı
      </h1>

      <p className="mt-3 leading-6 text-slate-600">
        Aradığınız mağaza mevcut değil
        veya kaldırılmış olabilir.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <a
        href="/"
        className="mt-6 inline-flex rounded-xl bg-slate-950 px-6 py-3 font-bold text-white transition hover:bg-slate-800"
      >
        Ana Sayfaya Dön
      </a>
    </div>
  </main>
);


}

// ============================================
// SİPARİŞ TAMAMLANDI
// ============================================

if (completedOrderId) {
return ( <main className="min-h-screen bg-slate-50 px-4 py-12"> <div className="mx-auto max-w-xl"> <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl sm:p-12"> <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">
✓ </div>


        <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Sipariş Başarılı
        </p>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
          Siparişiniz alındı! 🎉
        </h1>

        <p className="mt-4 leading-7 text-slate-600">
          Siparişiniz başarıyla oluşturuldu.
          Mağaza sahibi siparişinizi hazırlamaya
          başlayabilir.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">
            Sipariş Numaranız
          </p>

          <p className="mt-2 break-all text-lg font-extrabold text-slate-950">
            {completedOrderId}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={continueShopping}
            className="flex-1 rounded-xl bg-slate-950 px-5 py-4 font-bold text-white transition hover:bg-slate-800"
          >
            Alışverişe Devam Et
          </button>

          <a
            href="/"
            className="flex-1 rounded-xl border border-slate-300 px-5 py-4 font-bold text-slate-800 transition hover:bg-slate-50"
          >
            MiniShop Ana Sayfa
          </a>
        </div>
      </div>
    </div>
  </main>
);


}

// ============================================
// ANA SAYFA
// ============================================

return ( <main className="min-h-screen bg-slate-50 text-slate-900">


  {/* HEADER */}
  <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">

      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-lg font-black text-white">
            M
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
              {store.name}
            </h1>

            <p className="truncate text-xs text-slate-500 sm:text-sm">
              MiniShop mağazası
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">

        {/* MESAJ */}
        <button
          type="button"
          onClick={openMessages}
          disabled={loadingMessages}
          className="relative flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 font-bold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <span className="text-lg">
            💬
          </span>

          <span className="hidden sm:inline">
            Mesaj
          </span>

          {messageUnreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
              {messageUnreadCount > 9
                ? "9+"
                : messageUnreadCount}
            </span>
          )}
        </button>

        {/* SEPET */}
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="relative flex shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-slate-800"
        >
          <span>🛒</span>

          <span className="hidden sm:inline">
            Sepet
          </span>

          {cartCount > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1 text-xs font-extrabold text-slate-950">
              {cartCount}
            </span>
          )}
        </button>

      </div>
    </div>
  </header>

  {/* HERO */}
  <section className="bg-slate-950 text-white">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">

      <div className="max-w-4xl">

        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200">
          ✓ Güvenli MiniShop mağazası
        </div>

        <h2 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {store.name}
        </h2>

        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          Mağazanın ürünlerini keşfedin,
          beğendiğiniz ürünleri sepetinize
          ekleyin ve kolayca sipariş oluşturun.
        </p>
      </div>

      {/* SEARCH */}
      <div className="mt-8 max-w-2xl">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            🔎
          </span>

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Ürün ara..."
            className="w-full rounded-2xl border border-white/10 bg-white px-12 py-4 text-slate-900 shadow-xl outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/10"
          />
        </div>
      </div>

    </div>
  </section>

  {/* MAIN */}
  <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">

    {/* SUCCESS MESSAGE */}
    {message && (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
          ✓
        </span>

        <span>{message}</span>
      </div>
    )}

    {/* ERROR */}
    {error && (
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100">
          !
        </span>

        <span>{error}</span>
      </div>
    )}

    {/* PRODUCTS HEADER */}
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">

      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Ürünler
        </p>

        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
          Mağaza ürünleri
        </h2>
      </div>

      <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
        {filteredProducts.length} ürün
      </div>

    </div>

    {/* PRODUCTS */}
    {filteredProducts.length === 0 ? (
      <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">

        <div className="text-5xl">
          🔎
        </div>

        <h3 className="mt-5 text-xl font-bold text-slate-950">
          Ürün bulunamadı
        </h3>

        <p className="mt-2 text-slate-500">
          Aramanı değiştirerek tekrar deneyebilirsin.
        </p>

        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="mt-5 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
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
            className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl"
          >

            {/* IMAGE */}
            <div className="relative overflow-hidden bg-slate-100">

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

              {product.stock > 0 &&
                product.stock <= 5 && (
                  <div className="absolute left-3 top-3 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow">
                    Son {product.stock} adet
                  </div>
                )}

              {product.stock <= 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
                  <span className="rounded-full bg-white px-4 py-2 font-bold text-slate-950 shadow">
                    Stokta Yok
                  </span>
                </div>
              )}

            </div>

            {/* INFO */}
            <div className="p-5">

              <h3 className="line-clamp-2 text-lg font-bold text-slate-950">
                {product.name}
              </h3>

              {product.description && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                  {product.description}
                </p>
              )}

              <div className="mt-5 flex items-end justify-between gap-3">

                <div>
                  <p className="text-xs text-slate-400">
                    Fiyat
                  </p>

                  <p className="mt-1 text-xl font-extrabold text-slate-950">
                    {formatPrice(product.price)} TL
                  </p>
                </div>

                <span className="text-xs font-medium text-slate-500">
                  {product.stock > 0
                    ? `${product.stock} stok`
                    : "Tükendi"}
                </span>

              </div>

              <button
                type="button"
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                Sipariş
              </p>

              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
                Teslimat bilgileri
              </h2>

              <p className="mt-2 text-slate-500">
                Siparişiniz için gerekli bilgileri doldurun.
              </p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  Ad Soyad
                </label>

                <input
                  value={customerName}
                  onChange={(e) =>
                    setCustomerName(e.target.value)
                  }
                  placeholder="Örn. Ahmet Yılmaz"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  Telefon
                </label>

                <input
                  value={customerPhone}
                  onChange={(e) =>
                    setCustomerPhone(e.target.value)
                  }
                  type="tel"
                  placeholder="05XX XXX XX XX"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  Şehir
                </label>

                <input
                  value={customerCity}
                  onChange={(e) =>
                    setCustomerCity(e.target.value)
                  }
                  placeholder="İstanbul"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  İlçe
                </label>

                <input
                  value={customerDistrict}
                  onChange={(e) =>
                    setCustomerDistrict(e.target.value)
                  }
                  placeholder="Esenyurt"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  Açık Adres
                </label>

                <textarea
                  value={customerAddress}
                  onChange={(e) =>
                    setCustomerAddress(e.target.value)
                  }
                  placeholder="Mahalle, sokak, bina no, daire no..."
                  rows={5}
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
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
                className="rounded-xl border border-slate-300 px-5 py-4 font-bold text-slate-800 transition hover:bg-slate-50"
              >
                ← Sepete Dön
              </button>

              <button
                type="button"
                onClick={createOrder}
                disabled={creatingOrder}
                className="flex-1 rounded-xl bg-slate-950 px-5 py-4 font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingOrder
                  ? "Sipariş oluşturuluyor..."
                  : "Siparişi Oluştur →"}
              </button>

            </div>

          </div>

          {/* SUMMARY */}
          <div className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">

            <h3 className="text-xl font-extrabold text-slate-950">
              Sipariş Özeti
            </h3>

            <div className="mt-5 space-y-4">

              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3"
                >

                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">

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

                    <p className="truncate font-bold text-slate-900">
                      {item.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.quantity} ×{" "}
                      {formatPrice(item.price)} TL
                    </p>

                  </div>

                </div>
              ))}

            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">

              <div className="flex items-center justify-between">
                <span className="text-slate-500">
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

                <span className="text-2xl font-extrabold text-slate-950">
                  {formatPrice(total)} TL
                </span>

              </div>

            </div>

          </div>

        </div>

      </section>
    )}

  </div>

  {/* ============================================
      CART
  ============================================ */}

  {showCart && (
    <div className="fixed inset-0 z-50">

      <button
        type="button"
        aria-label="Sepeti kapat"
        onClick={() => setShowCart(false)}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">

          <div>
            <h2 className="text-2xl font-extrabold text-slate-950">
              Sepetim
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {cartCount} ürün
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCart(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-700 transition hover:bg-slate-200"
          >
            ×
          </button>

        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">

          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">

              <div className="text-6xl">
                🛒
              </div>

              <h3 className="mt-5 text-xl font-extrabold text-slate-950">
                Sepetin boş
              </h3>

              <p className="mt-2 text-slate-500">
                Beğendiğin ürünleri sepete eklemeye başla.
              </p>

              <button
                type="button"
                onClick={() => setShowCart(false)}
                className="mt-6 rounded-xl bg-slate-950 px-6 py-3 font-bold text-white transition hover:bg-slate-800"
              >
                Ürünlere Bak
              </button>

            </div>
          ) : (
            <div className="space-y-4">

              {cart.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >

                  <div className="flex gap-3">

                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">

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

                      <p className="font-bold text-slate-950">
                        {item.name}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {formatPrice(item.price)} TL
                      </p>

                      <div className="mt-3 flex items-center justify-between">

                        <div className="flex items-center rounded-xl border border-slate-200">

                          <button
                            type="button"
                            onClick={() =>
                              decreaseQuantity(item.id)
                            }
                            className="px-3 py-2 font-bold transition hover:bg-slate-50"
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
                            className="px-3 py-2 font-bold transition hover:bg-slate-50 disabled:opacity-30"
                          >
                            +
                          </button>

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(item.id)
                          }
                          className="text-sm font-semibold text-red-500 transition hover:text-red-700"
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

        {cart.length > 0 && (
          <div className="border-t border-slate-200 bg-white p-5">

            <div className="mb-4 flex items-center justify-between">

              <span className="text-slate-500">
                Toplam
              </span>

              <span className="text-2xl font-extrabold text-slate-950">
                {formatPrice(total)} TL
              </span>

            </div>

            <button
              type="button"
              onClick={openCheckout}
              className="w-full rounded-xl bg-slate-950 py-4 font-bold text-white shadow-lg transition hover:bg-slate-800"
            >
              Siparişi Tamamla →
            </button>

          </div>
        )}

      </aside>
    </div>
  )}

  {/* ============================================
      MESAJLAŞMA
  ============================================ */}

  {showMessages && (
    <div className="fixed inset-0 z-[60]">

      <button
        type="button"
        aria-label="Mesajları kapat"
        onClick={closeMessages}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      <div className="absolute bottom-0 right-0 flex h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:bottom-4 sm:right-4 sm:h-[700px] sm:rounded-3xl">

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">

          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-lg text-white">
              M
            </div>

            <div className="min-w-0">

              <h2 className="truncate font-extrabold text-slate-950">
                {store.name}
              </h2>

              <p className="text-xs text-slate-500">
                Mağaza mesajları
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={closeMessages}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-700 transition hover:bg-slate-200"
          >
            ×
          </button>

        </div>

        {/* CHAT */}
        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5">

          {loadingMessages ? (
            <div className="flex h-full items-center justify-center">

              <div className="text-center">

                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

                <p className="mt-3 text-sm text-slate-500">
                  Mesajlar yükleniyor...
                </p>

              </div>

            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">

              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-4xl">
                💬
              </div>

              <h3 className="mt-5 text-xl font-extrabold text-slate-950">
                Henüz mesaj yok
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Mağaza hakkında soru sormak veya
                ürünlerle ilgili bilgi almak için
                ilk mesajını gönderebilirsin.
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
                          ? "rounded-br-md bg-slate-950 text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
                      }`}
                    >

                      <p className="whitespace-pre-wrap break-words text-sm leading-6">
                        {chatMessage.message}
                      </p>

                      <div
                        className={`mt-1 text-right text-[10px] ${
                          isCustomer
                            ? "text-slate-400"
                            : "text-slate-400"
                        }`}
                      >
                        {formatMessageTime(
                          chatMessage.created_at
                        )}

                        {isCustomer && "  ✓"}
                      </div>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </div>

        {/* INPUT */}
        <div className="border-t border-slate-200 bg-white p-4">

          {error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-end gap-2">

            <textarea
              value={chatInput}
              onChange={(e) =>
                setChatInput(e.target.value)
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              placeholder="Mesajınızı yazın..."
              rows={2}
              maxLength={2000}
              className="min-h-[52px] flex-1 resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
            />

            <button
              type="button"
              onClick={sendChatMessage}
              disabled={
                sendingMessage ||
                !chatInput.trim()
              }
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xl text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingMessage
                ? "..."
                : "➤"}
            </button>

          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            Enter ile gönder • Shift + Enter ile alt satır
          </p>

        </div>

      </div>
    </div>
  )}

  {/* FOOTER */}
  <footer className="border-t border-slate-200 bg-white">

    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 sm:text-left md:flex-row md:items-center md:justify-between">

      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
            M
          </div>

          <p className="font-extrabold text-slate-950">
            {store.name}
          </p>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          MiniShop altyapısıyla oluşturuldu.
        </p>
      </div>

      <a
        href="/"
        className="text-sm font-bold text-slate-700 transition hover:text-slate-950"
      >
        MiniShop
      </a>

    </div>

  </footer>

</main>


);
}
