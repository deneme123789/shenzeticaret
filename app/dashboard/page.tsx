"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
};

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  customer_district: string;
  total_amount: number;
  status: string;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  price: number;
  quantity: number;
};

type Tab =
  | "overview"
  | "orders"
  | "products"
  | "store";

export default function DashboardPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [activeTab, setActiveTab] =
    useState<Tab>("overview");

  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] =
    useState(false);
  const [addingProduct, setAddingProduct] =
    useState(false);
  const [savingProduct, setSavingProduct] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(false);

  const [newOrderCount, setNewOrderCount] =
    useState(0);

  const [productSearch, setProductSearch] =
    useState("");

  const [productFilter, setProductFilter] =
    useState<"all" | "active" | "inactive">("all");

  const [orderFilter, setOrderFilter] =
    useState("all");

  const [editingProductId, setEditingProductId] =
    useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] =
    useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");

  const previousOrderIdsRef = useRef<string[]>([]);
  const firstOrderLoadRef = useRef(true);
  const audioContextRef =
    useRef<AudioContext | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!store) return;

    const interval = setInterval(() => {
      loadOrders(store.id, true);
    }, 10000);

    return () => clearInterval(interval);
  }, [store, notificationsEnabled]);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: storeData, error: storeError } =
        await supabase
          .from("stores")
          .select(
            "id,name,slug,verification_status,status"
          )
          .eq("owner_id", user.id)
          .single();

      if (storeError || !storeData) {
        setError("Mağaza bilgileri alınamadı.");
        setLoading(false);
        return;
      }

      setStore(storeData);

      if (
        storeData.verification_status !== "approved" ||
        storeData.status !== "active"
      ) {
        setMessage(
          "Mağazan satış için henüz aktif değil. Admin onayından sonra satış yapabilirsin."
        );
      }

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select(
            "id,name,description,price,stock,image_url,is_active"
          )
          .eq("store_id", storeData.id)
          .order("created_at", {
            ascending: false,
          });

      if (productError) {
        setError(productError.message);
      } else {
        setProducts(productData || []);
      }

      await loadOrders(storeData.id, false);
    } catch (err) {
      console.error(err);
      setError("Panel yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders(
    storeId: string,
    checkForNewOrders = false
  ) {
    try {
      setLoadingOrders(true);

      const { data: orderData, error: orderError } =
        await supabase
          .from("orders")
          .select(
            "id,customer_name,customer_phone,customer_address,customer_city,customer_district,total_amount,status,created_at"
          )
          .eq("store_id", storeId)
          .order("created_at", {
            ascending: false,
          });

      if (orderError) {
        console.error(orderError);

        if (!checkForNewOrders) {
          setError(
            "Siparişler alınamadı: " +
              orderError.message
          );
        }

        return;
      }

      const loadedOrders = orderData || [];

      if (checkForNewOrders) {
        const currentIds = loadedOrders.map(
          (order) => order.id
        );

        if (firstOrderLoadRef.current) {
          previousOrderIdsRef.current = currentIds;
          firstOrderLoadRef.current = false;
        } else {
          const newOrders = loadedOrders.filter(
            (order) =>
              !previousOrderIdsRef.current.includes(
                order.id
              )
          );

          if (newOrders.length > 0) {
            setNewOrderCount(
              (count) => count + newOrders.length
            );

            if (notificationsEnabled) {
              playNotificationSound();

              newOrders.forEach((order) => {
                showBrowserNotification(order);
              });
            }

            setMessage(
              `Yeni sipariş geldi! ${newOrders.length} yeni sipariş var.`
            );
          }

          previousOrderIdsRef.current = currentIds;
        }
      } else {
        previousOrderIdsRef.current =
          loadedOrders.map((order) => order.id);

        firstOrderLoadRef.current = false;
      }

      setOrders(loadedOrders);

      if (loadedOrders.length === 0) {
        setOrderItems([]);
        return;
      }

      const orderIds = loadedOrders.map(
        (order) => order.id
      );

      const {
        data: itemsData,
        error: itemsError,
      } = await supabase
        .from("order_items")
        .select(
          "id,order_id,product_name,price,quantity"
        )
        .in("order_id", orderIds);

      if (itemsError) {
        console.error(itemsError);

        if (!checkForNewOrders) {
          setError(
            "Sipariş ürünleri alınamadı: " +
              itemsError.message
          );
        }
      } else {
        setOrderItems(itemsData || []);
      }
    } finally {
      setLoadingOrders(false);
    }
  }

  function playNotificationSound() {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current =
          new AudioContext();
      }

      const context = audioContextRef.current;

      if (context.state === "suspended") {
        context.resume();
      }

      const now = context.currentTime;

      const oscillator =
        context.createOscillator();

      const gainNode = context.createGain();

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(
        880,
        now
      );

      oscillator.frequency.setValueAtTime(
        1174,
        now + 0.12
      );

      oscillator.frequency.setValueAtTime(
        880,
        now + 0.24
      );

      gainNode.gain.setValueAtTime(
        0.0001,
        now
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.3,
        now + 0.02
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.5
      );

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.5);
    } catch (err) {
      console.log(
        "Bildirim sesi çalınamadı:",
        err
      );
    }
  }

  async function enableNotifications() {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current =
          new AudioContext();
      }

      await audioContextRef.current.resume();

      setNotificationsEnabled(true);

      playNotificationSound();

      if ("Notification" in window) {
        if (
          Notification.permission ===
          "default"
        ) {
          await Notification.requestPermission();
        }
      }

      setMessage(
        "Sipariş bildirimleri başarıyla açıldı."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Bildirimler etkinleştirilemedi. Tarayıcı izinlerini kontrol et."
      );
    }
  }

  function showBrowserNotification(
    order: Order
  ) {
    if (
      notificationsEnabled &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("Yeni Sipariş Geldi", {
        body:
          order.customer_name +
          " tarafından " +
          formatPrice(
            Number(order.total_amount)
          ) +
          " tutarında sipariş geldi.",
      });
    }
  }

  async function updateOrderStatus(
    orderId: string,
    newStatus: string
  ) {
    setError("");
    setMessage("");

    const { error: updateError } =
      await supabase
        .from("orders")
        .update({
          status: newStatus,
        })
        .eq("id", orderId);

    if (updateError) {
      setError(
        "Sipariş durumu güncellenemedi: " +
          updateError.message
      );
      return;
    }

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: newStatus,
            }
          : order
      )
    );

    setMessage(
      "Sipariş durumu başarıyla güncellendi."
    );
  }

  async function addProduct(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!store) return;

    if (
      store.verification_status !== "approved" ||
      store.status !== "active"
    ) {
      setError(
        "Mağazan henüz satış için onaylanmadı."
      );
      return;
    }

    setAddingProduct(true);
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = String(
      formData.get("name") || ""
    ).trim();

    const description = String(
      formData.get("description") || ""
    ).trim();

    const price = Number(
      formData.get("price")
    );

    const stock = Number(
      formData.get("stock")
    );

    const imageFile = formData.get("image");

    if (!name || price < 0 || stock < 0) {
      setError(
        "Ürün bilgilerini doğru şekilde doldurun."
      );
      setAddingProduct(false);
      return;
    }

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      if (!imageFile.type.startsWith("image/")) {
        setError(
          "Sadece resim dosyası yükleyebilirsiniz."
        );
        setAddingProduct(false);
        return;
      }

      if (imageFile.size > 5 * 1024 * 1024) {
        setError(
          "Fotoğraf boyutu en fazla 5 MB olabilir."
        );
        setAddingProduct(false);
        return;
      }
    }

    let imageUrl: string | null = null;

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      const extension =
        imageFile.name
          .split(".")
          .pop()
          ?.toLowerCase() || "jpg";

      const fileName =
        store.id +
        "/" +
        crypto.randomUUID() +
        "." +
        extension;

      const { error: uploadError } =
        await supabase.storage
          .from("product-images")
          .upload(
            fileName,
            imageFile,
            {
              cacheControl: "3600",
              upsert: false,
            }
          );

      if (uploadError) {
        setError(
          "Fotoğraf yüklenemedi: " +
            uploadError.message
        );
        setAddingProduct(false);
        return;
      }

      const { data } =
        supabase.storage
          .from("product-images")
          .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }

    const { error: insertError } =
      await supabase
        .from("products")
        .insert({
          store_id: store.id,
          name,
          description,
          price,
          stock,
          image_url: imageUrl,
          is_active: true,
        });

    if (insertError) {
      setError(
        "Ürün eklenemedi: " +
          insertError.message
      );
      setAddingProduct(false);
      return;
    }

    form.reset();

    setMessage(
      "Ürün başarıyla mağazana eklendi."
    );

    await loadDashboard();

    setActiveTab("products");

    setAddingProduct(false);
  }

  function startEditing(product: Product) {
    setEditingProductId(product.id);
    setEditName(product.name);
    setEditDescription(
      product.description || ""
    );
    setEditPrice(String(product.price));
    setEditStock(String(product.stock));

    setError("");
    setMessage("");
  }

  function cancelEditing() {
    setEditingProductId(null);
    setEditName("");
    setEditDescription("");
    setEditPrice("");
    setEditStock("");
  }

  async function saveProduct(
    productId: string
  ) {
    const name = editName.trim();
    const description =
      editDescription.trim();

    const price = Number(editPrice);
    const stock = Number(editStock);

    if (!name) {
      setError("Ürün adı boş bırakılamaz.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Geçerli bir fiyat girin.");
      return;
    }

    if (
      !Number.isFinite(stock) ||
      stock < 0 ||
      !Number.isInteger(stock)
    ) {
      setError(
        "Stok 0 veya daha büyük tam sayı olmalıdır."
      );
      return;
    }

    setSavingProduct(true);
    setError("");
    setMessage("");

    const { data, error: updateError } =
      await supabase
        .from("products")
        .update({
          name,
          description,
          price,
          stock,
        })
        .eq("id", productId)
        .select(
          "id,name,description,price,stock,image_url,is_active"
        )
        .single();

    if (updateError) {
      setError(
        "Ürün güncellenemedi: " +
          updateError.message
      );
      setSavingProduct(false);
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? data
          : product
      )
    );

    cancelEditing();

    setMessage(
      "Ürün başarıyla güncellendi."
    );

    setSavingProduct(false);
  }

  async function deactivateProduct(
    productId: string
  ) {
    const confirmed = window.confirm(
      "Bu ürünü mağazadan kaldırmak istediğine emin misin?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error: updateError } =
      await supabase
        .from("products")
        .update({
          is_active: false,
        })
        .eq("id", productId);

    if (updateError) {
      setError(
        "Ürün kaldırılamadı: " +
          updateError.message
      );
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              is_active: false,
            }
          : product
      )
    );

    setMessage(
      "Ürün mağazadan kaldırıldı."
    );
  }

  async function reactivateProduct(
    productId: string
  ) {
    setError("");
    setMessage("");

    const { error: updateError } =
      await supabase
        .from("products")
        .update({
          is_active: true,
        })
        .eq("id", productId);

    if (updateError) {
      setError(
        "Ürün yayınlanamadı: " +
          updateError.message
      );
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              is_active: true,
            }
          : product
      )
    );

    setMessage(
      "Ürün tekrar mağazada yayınlandı."
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function formatPrice(value: number) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(value);
  }

  function getStatusText(status: string) {
    const statuses: Record<string, string> = {
      pending: "Yeni",
      confirmed: "Onaylandı",
      preparing: "Hazırlanıyor",
      shipped: "Kargoda",
      delivered: "Teslim edildi",
      cancelled: "İptal edildi",
    };

    return statuses[status] || status;
  }

  function getStatusClass(status: string) {
    if (status === "pending") {
      return "bg-blue-50 text-blue-700";
    }

    if (status === "confirmed") {
      return "bg-indigo-50 text-indigo-700";
    }

    if (status === "preparing") {
      return "bg-amber-50 text-amber-700";
    }

    if (status === "shipped") {
      return "bg-purple-50 text-purple-700";
    }

    if (status === "delivered") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (status === "cancelled") {
      return "bg-red-50 text-red-700";
    }

    return "bg-slate-100 text-slate-600";
  }

  const totalSales = useMemo(() => {
    return orders
      .filter(
        (order) => order.status !== "cancelled"
      )
      .reduce(
        (total, order) =>
          total + Number(order.total_amount),
        0
      );
  }, [orders]);

  const pendingOrders = orders.filter(
    (order) => order.status === "pending"
  ).length;

  const preparingOrders = orders.filter(
    (order) =>
      order.status === "preparing"
  ).length;

  const shippedOrders = orders.filter(
    (order) => order.status === "shipped"
  ).length;

  const activeProducts = products.filter(
    (product) => product.is_active
  ).length;

  const lowStockProducts = products.filter(
    (product) =>
      product.is_active &&
      product.stock > 0 &&
      product.stock <= 5
  );

  const outOfStockProducts = products.filter(
    (product) =>
      product.is_active &&
      product.stock <= 0
  );

  const filteredProducts = products.filter(
    (product) => {
      const matchesSearch =
        product.name
          .toLowerCase()
          .includes(
            productSearch
              .trim()
              .toLowerCase()
          );

      const matchesFilter =
        productFilter === "all" ||
        (productFilter === "active" &&
          product.is_active) ||
        (productFilter === "inactive" &&
          !product.is_active);

      return matchesSearch && matchesFilter;
    }
  );

  const filteredOrders = orders.filter(
    (order) => {
      if (orderFilter === "all") return true;

      return order.status === orderFilter;
    }
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="flex min-h-screen">
          <aside className="hidden w-64 border-r border-slate-200 bg-slate-950 lg:block">
            <div className="p-6">
              <div className="h-10 w-36 animate-pulse rounded-xl bg-white/10" />
            </div>

            <div className="space-y-3 px-4">
              {Array.from({
                length: 7,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-11 animate-pulse rounded-xl bg-white/5"
                />
              ))}
            </div>
          </aside>

          <div className="flex-1 p-6 lg:p-10">
            <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-200" />

            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({
                length: 4,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-2xl bg-white"
                />
              ))}
            </div>

            <div className="mt-8 h-80 animate-pulse rounded-3xl bg-white" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950 lg:flex">
          <div className="border-b border-white/10 p-6">
            <a
              href="/"
              className="flex items-center gap-3"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-black text-slate-950">
                M
              </div>

              <div>
                <div className="text-lg font-black text-white">
                  MiniShop
                </div>

                <div className="text-xs text-slate-500">
                  Satıcı Paneli
                </div>
              </div>
            </a>
          </div>

          <div className="flex-1 px-4 py-6">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
              Yönetim
            </p>

            <nav className="space-y-1">
              <SidebarButton
                active={
                  activeTab === "overview"
                }
                onClick={() =>
                  setActiveTab("overview")
                }
                icon="▦"
                text="Genel Bakış"
              />

              <SidebarButton
                active={
                  activeTab === "orders"
                }
                onClick={() =>
                  setActiveTab("orders")
                }
                icon="□"
                text="Siparişler"
                badge={
                  newOrderCount > 0
                    ? newOrderCount
                    : pendingOrders
                }
              />

              <SidebarButton
                active={
                  activeTab === "products"
                }
                onClick={() =>
                  setActiveTab("products")
                }
                icon="◇"
                text="Ürünler"
              />

              <SidebarButton
                active={
                  activeTab === "store"
                }
                onClick={() =>
                  setActiveTab("store")
                }
                icon="⌂"
                text="Mağazam"
              />
            </nav>

            <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
              Sistem
            </p>

            <nav className="space-y-1">
              <SidebarButton
                active={false}
                onClick={enableNotifications}
                icon="!"
                text={
                  notificationsEnabled
                    ? "Bildirimler Açık"
                    : "Bildirimleri Aç"
                }
              />

              <SidebarButton
                active={false}
                onClick={logout}
                icon="↪"
                text="Çıkış Yap"
              />
            </nav>
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-950">
                  {store?.name
                    ?.charAt(0)
                    .toUpperCase() || "M"}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">
                    {store?.name}
                  </div>

                  <div className="truncate text-xs text-slate-500">
                    @{store?.slug}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="min-w-0 flex-1">
          {/* TOP BAR */}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white lg:hidden">
                  M
                </div>

                <div>
                  <div className="text-sm font-black text-slate-900">
                    Satıcı Merkezi
                  </div>

                  <div className="hidden text-xs text-slate-400 sm:block">
                    {store?.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {newOrderCount > 0 && (
                  <button
                    onClick={() => {
                      setNewOrderCount(0);
                      setActiveTab("orders");
                    }}
                    className="relative rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                  >
                    {newOrderCount} yeni sipariş
                  </button>
                )}

                <a
                  href={
                    store
                      ? `/${store.slug}`
                      : "/"
                  }
                  target="_blank"
                  className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:block"
                >
                  Mağazayı Gör
                </a>

                <button
                  onClick={logout}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                >
                  Çıkış
                </button>
              </div>
            </div>
          </header>

          {/* MOBILE NAV */}
          <div className="border-b border-slate-200 bg-white lg:hidden">
            <div className="flex gap-1 overflow-x-auto px-4 py-2">
              <MobileNavButton
                active={
                  activeTab === "overview"
                }
                onClick={() =>
                  setActiveTab("overview")
                }
                text="Genel"
              />

              <MobileNavButton
                active={
                  activeTab === "orders"
                }
                onClick={() =>
                  setActiveTab("orders")
                }
                text="Siparişler"
              />

              <MobileNavButton
                active={
                  activeTab === "products"
                }
                onClick={() =>
                  setActiveTab("products")
                }
                text="Ürünler"
              />

              <MobileNavButton
                active={
                  activeTab === "store"
                }
                onClick={() =>
                  setActiveTab("store")
                }
                text="Mağazam"
              />
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            {/* ALERTS */}
            {message && (
              <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
                <span>{message}</span>

                <button
                  onClick={() => setMessage("")}
                  className="font-bold"
                >
                  ×
                </button>
              </div>
            )}

            {error && (
              <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                <span>{error}</span>

                <button
                  onClick={() => setError("")}
                  className="font-bold"
                >
                  ×
                </button>
              </div>
            )}

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <>
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      Genel Bakış
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                      Hoş geldin,{" "}
                      {store?.name}
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Mağazanı, siparişlerini ve
                      ürünlerini tek merkezden
                      yönet.
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setActiveTab("products")
                    }
                    className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    + Yeni Ürün
                  </button>
                </div>

                {/* STORE STATUS */}
                {store && (
                  <div className="mt-7 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                          store.verification_status ===
                            "approved" &&
                          store.status === "active"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {store.verification_status ===
                            "approved" &&
                        store.status === "active"
                          ? "✓"
                          : "!"}
                      </div>

                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          Mağaza durumu
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {store.verification_status ===
                            "approved" &&
                          store.status === "active"
                            ? "Mağazan satışa açık."
                            : "Mağazan henüz satış için aktif değil."}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${
                        store.verification_status ===
                            "approved" &&
                        store.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {store.verification_status ===
                          "approved" &&
                      store.status === "active"
                        ? "Aktif"
                        : "Onay Bekliyor"}
                    </span>
                  </div>
                )}

                {/* STAT CARDS */}
                <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title="Toplam Satış"
                    value={formatPrice(
                      totalSales
                    )}
                    description="İptal edilmeyen siparişler"
                    icon="₺"
                  />

                  <StatCard
                    title="Siparişler"
                    value={String(
                      orders.length
                    )}
                    description={
                      pendingOrders > 0
                        ? `${pendingOrders} yeni sipariş bekliyor`
                        : "Bekleyen sipariş yok"
                    }
                    icon="□"
                    alert={
                      pendingOrders > 0
                    }
                  />

                  <StatCard
                    title="Aktif Ürün"
                    value={String(
                      activeProducts
                    )}
                    description={`${products.length} toplam ürün`}
                    icon="◇"
                  />

                  <StatCard
                    title="Kargoda"
                    value={String(
                      shippedOrders
                    )}
                    description="Kargoya verilmiş siparişler"
                    icon="→"
                  />
                </div>

                {/* QUICK ACTIONS */}
                <div className="mt-8 grid gap-5 lg:grid-cols-3">
                  <button
                    onClick={() =>
                      setActiveTab("orders")
                    }
                    className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-lg text-white">
                        □
                      </div>

                      <span className="text-slate-300 transition group-hover:text-slate-900">
                        →
                      </span>
                    </div>

                    <h3 className="mt-5 font-black text-slate-900">
                      Siparişleri Yönet
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Yeni ve mevcut siparişlerin
                      durumlarını yönet.
                    </p>
                  </button>

                  <button
                    onClick={() =>
                      setActiveTab("products")
                    }
                    className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-lg text-white">
                        ◇
                      </div>

                      <span className="text-slate-300 transition group-hover:text-slate-900">
                        →
                      </span>
                    </div>

                    <h3 className="mt-5 font-black text-slate-900">
                      Ürünlerini Yönet
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Fiyat, stok ve ürün
                      bilgilerini düzenle.
                    </p>
                  </button>

                  <button
                    onClick={() =>
                      setActiveTab("store")
                    }
                    className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-lg text-white">
                        ⌂
                      </div>

                      <span className="text-slate-300 transition group-hover:text-slate-900">
                        →
                      </span>
                    </div>

                    <h3 className="mt-5 font-black text-slate-900">
                      Mağazan
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Mağaza bilgilerini ve satış
                      durumunu görüntüle.
                    </p>
                  </button>
                </div>

                {/* STOCK ALERT */}
                {(lowStockProducts.length >
                  0 ||
                  outOfStockProducts.length >
                    0) && (
                  <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          Stok Yönetimi
                        </p>

                        <h2 className="mt-2 text-xl font-black text-slate-900">
                          Stok uyarıları
                        </h2>
                      </div>

                      <button
                        onClick={() =>
                          setActiveTab("products")
                        }
                        className="text-sm font-bold text-slate-900 hover:underline"
                      >
                        Ürünlere Git →
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {outOfStockProducts.length >
                        0 && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                          <div className="text-sm font-black text-red-700">
                            {outOfStockProducts.length} ürün
                            tükendi
                          </div>

                          <p className="mt-1 text-xs text-red-600">
                            Bu ürünler şu anda
                            müşterilere
                            satılamaz.
                          </p>
                        </div>
                      )}

                      {lowStockProducts.length >
                        0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="text-sm font-black text-amber-700">
                            {lowStockProducts.length} ürün
                            kritik stokta
                          </div>

                          <p className="mt-1 text-xs text-amber-600">
                            5 veya daha az stok
                            kaldı.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* RECENT ORDERS */}
                <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        Son Hareketler
                      </p>

                      <h2 className="mt-2 text-xl font-black text-slate-900">
                        Son siparişler
                      </h2>
                    </div>

                    <button
                      onClick={() =>
                        setActiveTab("orders")
                      }
                      className="text-sm font-bold text-slate-900 hover:underline"
                    >
                      Tüm siparişler →
                    </button>
                  </div>

                  {orders.length === 0 ? (
                    <EmptyState
                      icon="□"
                      title="Henüz sipariş yok"
                      text="Müşteriler sipariş verdikçe burada görünecek."
                    />
                  ) : (
                    <div className="mt-6 divide-y divide-slate-100">
                      {orders
                        .slice(0, 5)
                        .map((order) => (
                          <div
                            key={order.id}
                            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-700">
                                {order.customer_name
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-slate-900">
                                  {
                                    order.customer_name
                                  }
                                </div>

                                <div className="mt-1 text-xs text-slate-400">
                                  #
                                  {order.id.slice(
                                    0,
                                    8
                                  )}{" "}
                                  ·{" "}
                                  {new Date(
                                    order.created_at
                                  ).toLocaleDateString(
                                    "tr-TR"
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                              <span
                                className={`rounded-full px-3 py-1.5 text-xs font-bold ${getStatusClass(
                                  order.status
                                )}`}
                              >
                                {getStatusText(
                                  order.status
                                )}
                              </span>

                              <span className="text-sm font-black text-slate-900">
                                {formatPrice(
                                  Number(
                                    order.total_amount
                                  )
                                )}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ORDERS */}
            {activeTab === "orders" && (
              <>
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      Satış Yönetimi
                    </p>

                    <h1 className="mt-2 text-3xl font-black text-slate-950">
                      Siparişler
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                      Müşterilerinden gelen
                      siparişleri yönet.
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      store &&
                      loadOrders(
                        store.id,
                        false
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Yenile
                  </button>
                </div>

                <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniStat
                    title="Toplam"
                    value={orders.length}
                  />

                  <MiniStat
                    title="Yeni"
                    value={pendingOrders}
                  />

                  <MiniStat
                    title="Hazırlanıyor"
                    value={preparingOrders}
                  />

                  <MiniStat
                    title="Kargoda"
                    value={shippedOrders}
                  />
                </div>

                <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">
                        Sipariş listesi
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        {filteredOrders.length} sipariş
                        gösteriliyor
                      </p>
                    </div>

                    <select
                      value={orderFilter}
                      onChange={(event) =>
                        setOrderFilter(
                          event.target.value
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-slate-900"
                    >
                      <option value="all">
                        Tüm siparişler
                      </option>

                      <option value="pending">
                        Yeni
                      </option>

                      <option value="confirmed">
                        Onaylandı
                      </option>

                      <option value="preparing">
                        Hazırlanıyor
                      </option>

                      <option value="shipped">
                        Kargoda
                      </option>

                      <option value="delivered">
                        Teslim edildi
                      </option>

                      <option value="cancelled">
                        İptal edildi
                      </option>
                    </select>
                  </div>

                  {loadingOrders ? (
                    <div className="py-16 text-center text-sm text-slate-500">
                      Siparişler yükleniyor...
                    </div>
                  ) : filteredOrders.length ===
                    0 ? (
                    <EmptyState
                      icon="□"
                      title="Sipariş bulunamadı"
                      text="Seçtiğin filtreye uygun sipariş bulunmuyor."
                    />
                  ) : (
                    <div className="mt-6 space-y-4">
                      {filteredOrders.map(
                        (order) => {
                          const items =
                            orderItems.filter(
                              (item) =>
                                item.order_id ===
                                order.id
                            );

                          return (
                            <div
                              key={order.id}
                              className="overflow-hidden rounded-2xl border border-slate-200"
                            >
                              <div className="flex flex-col justify-between gap-4 bg-slate-50 p-5 md:flex-row md:items-center">
                                <div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <span className="font-mono text-xs font-bold text-slate-500">
                                      #
                                      {order.id.slice(
                                        0,
                                        8
                                      )}
                                    </span>

                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                                        order.status
                                      )}`}
                                    >
                                      {getStatusText(
                                        order.status
                                      )}
                                    </span>
                                  </div>

                                  <div className="mt-2 text-xs text-slate-400">
                                    {new Date(
                                      order.created_at
                                    ).toLocaleString(
                                      "tr-TR"
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <div className="text-xs text-slate-400">
                                      Toplam
                                    </div>

                                    <div className="mt-1 text-xl font-black text-slate-950">
                                      {formatPrice(
                                        Number(
                                          order.total_amount
                                        )
                                      )}
                                    </div>
                                  </div>

                                  <select
                                    value={
                                      order.status
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateOrderStatus(
                                        order.id,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-slate-900"
                                  >
                                    <option value="pending">
                                      Yeni
                                    </option>

                                    <option value="confirmed">
                                      Onaylandı
                                    </option>

                                    <option value="preparing">
                                      Hazırlanıyor
                                    </option>

                                    <option value="shipped">
                                      Kargoda
                                    </option>

                                    <option value="delivered">
                                      Teslim edildi
                                    </option>

                                    <option value="cancelled">
                                      İptal edildi
                                    </option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid gap-5 p-5 lg:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 p-5">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black shadow-sm">
                                      {order.customer_name
                                        .charAt(
                                          0
                                        )
                                        .toUpperCase()}
                                    </div>

                                    <div>
                                      <div className="text-sm font-black text-slate-900">
                                        Müşteri
                                      </div>

                                      <div className="text-xs text-slate-500">
                                        {
                                          order.customer_name
                                        }
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-5 space-y-3 text-sm">
                                    <div>
                                      <span className="font-bold">
                                        Telefon:
                                      </span>{" "}
                                      {
                                        order.customer_phone
                                      }
                                    </div>

                                    <div>
                                      <span className="font-bold">
                                        Adres:
                                      </span>{" "}
                                      {
                                        order.customer_address
                                      }
                                    </div>

                                    <div>
                                      <span className="font-bold">
                                        Bölge:
                                      </span>{" "}
                                      {
                                        order.customer_district
                                      }
                                      ,{" "}
                                      {
                                        order.customer_city
                                      }
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-2xl bg-slate-50 p-5">
                                  <div className="text-sm font-black text-slate-900">
                                    Sipariş içeriği
                                  </div>

                                  <div className="mt-4 space-y-3">
                                    {items.length ===
                                    0 ? (
                                      <p className="text-xs text-slate-500">
                                        Ürün bilgisi
                                        bulunamadı.
                                      </p>
                                    ) : (
                                      items.map(
                                        (
                                          item
                                        ) => (
                                          <div
                                            key={
                                              item.id
                                            }
                                            className="flex justify-between gap-4 border-b border-slate-200 pb-3 last:border-0 last:pb-0"
                                          >
                                            <div>
                                              <div className="text-sm font-semibold text-slate-800">
                                                {
                                                  item.product_name
                                                }
                                              </div>

                                              <div className="mt-1 text-xs text-slate-500">
                                                {
                                                  item.quantity
                                                }{" "}
                                                adet ×{" "}
                                                {formatPrice(
                                                  Number(
                                                    item.price
                                                  )
                                                )}
                                              </div>
                                            </div>

                                            <div className="text-sm font-bold text-slate-900">
                                              {formatPrice(
                                                Number(
                                                  item.price
                                                ) *
                                                  item.quantity
                                              )}
                                            </div>
                                          </div>
                                        )
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* PRODUCTS */}
            {activeTab === "products" && (
              <>
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      Katalog Yönetimi
                    </p>

                    <h1 className="mt-2 text-3xl font-black text-slate-950">
                      Ürünler
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                      Ürünlerini, fiyatlarını ve
                      stoklarını yönet.
                    </p>
                  </div>
                </div>

                {/* ADD PRODUCT */}
                <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Yeni ürün
                    </p>

                    <h2 className="mt-2 text-xl font-black text-slate-900">
                      Ürün ekle
                    </h2>
                  </div>

                  <form
                    onSubmit={addProduct}
                    className="mt-6 grid gap-5"
                  >
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">
                        Ürün adı
                      </label>

                      <input
                        name="name"
                        required
                        placeholder="Örn: Siyah Oversize Tişört"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">
                        Açıklama
                      </label>

                      <textarea
                        name="description"
                        rows={4}
                        placeholder="Ürün hakkında bilgi..."
                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                      />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">
                          Fiyat
                        </label>

                        <div className="relative">
                          <input
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            placeholder="499.90"
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-14 text-sm outline-none focus:border-slate-900"
                          />

                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            TL
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">
                          Stok
                        </label>

                        <input
                          name="stock"
                          type="number"
                          min="0"
                          step="1"
                          required
                          placeholder="10"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">
                        Ürün fotoğrafı
                      </label>

                      <input
                        name="image"
                        type="file"
                        accept="image/*"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      />

                      <p className="mt-2 text-xs text-slate-400">
                        JPG, PNG veya WEBP · Maksimum
                        5 MB
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={addingProduct}
                      className="rounded-xl bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {addingProduct
                        ? "Ürün yükleniyor..."
                        : "Ürünü Mağazaya Ekle"}
                    </button>
                  </form>
                </div>

                {/* PRODUCT LIST */}
                <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        Katalog
                      </p>

                      <h2 className="mt-2 text-xl font-black text-slate-900">
                        Ürünlerin
                      </h2>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={productSearch}
                        onChange={(event) =>
                          setProductSearch(
                            event.target.value
                          )
                        }
                        placeholder="Ürün ara..."
                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900"
                      />

                      <select
                        value={productFilter}
                        onChange={(event) =>
                          setProductFilter(
                            event.target
                              .value as
                              | "all"
                              | "active"
                              | "inactive"
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-slate-900"
                      >
                        <option value="all">
                          Tümü
                        </option>

                        <option value="active">
                          Aktif
                        </option>

                        <option value="inactive">
                          Pasif
                        </option>
                      </select>
                    </div>
                  </div>

                  {filteredProducts.length ===
                  0 ? (
                    <EmptyState
                      icon="◇"
                      title="Ürün bulunamadı"
                      text="Arama veya filtre kriterlerini değiştirmeyi deneyin."
                    />
                  ) : (
                    <div className="mt-6 grid gap-4 xl:grid-cols-2">
                      {filteredProducts.map(
                        (product) => {
                          const editing =
                            editingProductId ===
                            product.id;

                          return (
                            <div
                              key={product.id}
                              className={`overflow-hidden rounded-2xl border ${
                                product.is_active
                                  ? "border-slate-200 bg-white"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              {editing ? (
                                <div className="p-5">
                                  <div className="mb-5 flex items-center justify-between">
                                    <span className="text-sm font-black">
                                      Ürünü Düzenle
                                    </span>

                                    <button
                                      onClick={
                                        cancelEditing
                                      }
                                      className="text-xs font-bold text-slate-400 hover:text-slate-900"
                                    >
                                      Kapat
                                    </button>
                                  </div>

                                  <div className="space-y-4">
                                    <input
                                      value={
                                        editName
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setEditName(
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      placeholder="Ürün adı"
                                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900"
                                    />

                                    <textarea
                                      value={
                                        editDescription
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setEditDescription(
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      rows={3}
                                      placeholder="Açıklama"
                                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900"
                                    />

                                    <div className="grid gap-4 sm:grid-cols-2">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                          editPrice
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          setEditPrice(
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        placeholder="Fiyat"
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900"
                                      />

                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={
                                          editStock
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          setEditStock(
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        placeholder="Stok"
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900"
                                      />
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row">
                                      <button
                                        onClick={() =>
                                          saveProduct(
                                            product.id
                                          )
                                        }
                                        disabled={
                                          savingProduct
                                        }
                                        className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
                                      >
                                        {savingProduct
                                          ? "Kaydediliyor..."
                                          : "Değişiklikleri Kaydet"}
                                      </button>

                                      <button
                                        onClick={
                                          cancelEditing
                                        }
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                      >
                                        İptal
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-5">
                                  <div className="flex gap-4">
                                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                                      {product.image_url ? (
                                        <img
                                          src={
                                            product.image_url
                                          }
                                          alt={
                                            product.name
                                          }
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-2xl font-black text-slate-300">
                                          M
                                        </div>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="line-clamp-2 text-sm font-black text-slate-900">
                                          {
                                            product.name
                                          }
                                        </h3>

                                        <span
                                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                            product.is_active
                                              ? "bg-emerald-50 text-emerald-700"
                                              : "bg-slate-200 text-slate-500"
                                          }`}
                                        >
                                          {product.is_active
                                            ? "Aktif"
                                            : "Pasif"}
                                        </span>
                                      </div>

                                      {product.description && (
                                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                                          {
                                            product.description
                                          }
                                        </p>
                                      )}

                                      <div className="mt-3 flex flex-wrap items-center gap-4">
                                        <span className="text-base font-black text-slate-950">
                                          {formatPrice(
                                            Number(
                                              product.price
                                            )
                                          )}
                                        </span>

                                        <span
                                          className={`text-xs font-bold ${
                                            product.stock <=
                                            0
                                              ? "text-red-600"
                                              : product.stock <=
                                                  5
                                                ? "text-amber-600"
                                                : "text-slate-500"
                                          }`}
                                        >
                                          Stok:{" "}
                                          {
                                            product.stock
                                          }
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                                    <button
                                      onClick={() =>
                                        startEditing(
                                          product
                                        )
                                      }
                                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                                    >
                                      Düzenle
                                    </button>

                                    {product.is_active ? (
                                      <button
                                        onClick={() =>
                                          deactivateProduct(
                                            product.id
                                          )
                                        }
                                        className="rounded-xl border border-red-200 px-4 py-3 text-xs font-bold text-red-600 transition hover:bg-red-50"
                                      >
                                        Mağazadan Kaldır
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          reactivateProduct(
                                            product.id
                                          )
                                        }
                                        className="rounded-xl border border-emerald-200 px-4 py-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
                                      >
                                        Tekrar Yayınla
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* STORE */}
            {activeTab === "store" &&
              store && (
                <>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      Mağaza Yönetimi
                    </p>

                    <h1 className="mt-2 text-3xl font-black text-slate-950">
                      Mağazam
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                      Mağazanla ilgili temel bilgileri
                      görüntüle.
                    </p>
                  </div>

                  <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]">
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                      <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-2xl font-black text-white">
                          {store.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <h2 className="text-xl font-black text-slate-950">
                            {store.name}
                          </h2>

                          <p className="mt-1 text-sm text-slate-500">
                            @{store.slug}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <InfoBox
                          title="Mağaza adı"
                          value={store.name}
                        />

                        <InfoBox
                          title="Mağaza kullanıcı adı"
                          value={`@${store.slug}`}
                        />

                        <InfoBox
                          title="Doğrulama"
                          value={
                            store.verification_status ===
                            "approved"
                              ? "Onaylandı"
                              : store.verification_status ===
                                  "pending"
                                ? "Onay bekliyor"
                                : "Reddedildi"
                          }
                        />

                        <InfoBox
                          title="Satış durumu"
                          value={
                            store.status ===
                            "active"
                              ? "Aktif"
                              : store.status ===
                                  "suspended"
                                ? "Askıya alınmış"
                                : "Engellenmiş"
                          }
                        />
                      </div>

                      <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                        <div className="text-sm font-black text-slate-900">
                          Mağaza bağlantın
                        </div>

                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                          <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                            /{store.slug}
                          </div>

                          <a
                            href={`/${store.slug}`}
                            target="_blank"
                            className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
                          >
                            Mağazayı Aç
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                        !
                      </div>

                      <h3 className="mt-5 text-lg font-black text-slate-900">
                        Mağaza durumu
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {store.verification_status ===
                            "approved" &&
                        store.status === "active"
                          ? "Mağazan şu anda aktif ve müşteriler ürünlerini görebilir."
                          : "Mağazan admin doğrulaması tamamlanana kadar satışa kapalıdır."}
                      </p>

                      <div className="mt-6">
                        <span
                          className={`inline-flex rounded-full px-4 py-2 text-xs font-bold ${
                            store.verification_status ===
                                "approved" &&
                            store.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {store.verification_status ===
                              "approved" &&
                          store.status === "active"
                            ? "Satışa Açık"
                            : "Onay Bekliyor"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------------- COMPONENTS ---------------- */

function SidebarButton({
  active,
  onClick,
  icon,
  text,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  text: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
        active
          ? "bg-white text-slate-950"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${
          active
            ? "bg-slate-950 text-white"
            : "bg-white/5 text-slate-400"
        }`}
      >
        {icon}
      </span>

      <span className="flex-1">
        {text}
      </span>

      {badge !== undefined &&
        badge > 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
              active
                ? "bg-red-100 text-red-700"
                : "bg-red-500 text-white"
            }`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
    </button>
  );
}

function MobileNavButton({
  active,
  onClick,
  text,
}: {
  active: boolean;
  onClick: () => void;
  text: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold ${
        active
          ? "bg-slate-950 text-white"
          : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {text}
    </button>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  alert,
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-700">
          {icon}
        </div>

        {alert && (
          <span className="h-2 w-2 rounded-full bg-red-500" />
        )}
      </div>

      <div className="mt-5">
        <p className="text-xs font-bold text-slate-400">
          {title}
        </p>

        <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">
          {value}
        </p>

        <p className="mt-2 line-clamp-1 text-xs text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function MiniStat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold text-slate-400">
        {title}
      </div>

      <div className="mt-2 text-2xl font-black text-slate-950">
        {value}
      </div>
    </div>
  );
}

function InfoBox({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <p className="text-xs font-bold text-slate-400">
        {title}
      </p>

      <p className="mt-2 break-all text-sm font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl font-black text-slate-400">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-black text-slate-900">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
        {text}
      </p>
    </div>
  );
}