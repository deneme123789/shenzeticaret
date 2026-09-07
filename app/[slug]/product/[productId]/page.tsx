"use client";

import { FormEvent, useEffect, useState } from "react";
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

type Review = {
  id: string;
  product_id: string;
  store_id: string;
  customer_id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
};

const CART_PREFIX = "minishop-cart-";

export default function ProductDetailPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");

  const [hasPurchased, setHasPurchased] = useState(false);
  const [reviewableOrderId, setReviewableOrderId] = useState<string | null>(
    null
  );

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const parts = window.location.pathname.split("/");

      const slug = decodeURIComponent(parts[1] || "");
      const productId = parts[3] || "";

      if (!slug || !productId) {
        setError("Ürün bulunamadı.");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        setCurrentUserId(userData.user.id);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (profileData?.full_name) {
          setCustomerName(profileData.full_name);
        }
      }

      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select("id,name,slug,verification_status,status")
        .eq("slug", slug)
        .maybeSingle();

      if (storeError) {
        throw storeError;
      }

      if (!storeData) {
        setError("Mağaza bulunamadı.");
        return;
      }

      setStore(storeData);

      if (
        storeData.verification_status !== "approved" ||
        storeData.status !== "active"
      ) {
        setError("Bu mağaza şu anda satışa açık değil.");
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(
          "id,store_id,name,description,price,stock,image_url,is_active"
        )
        .eq("id", productId)
        .eq("store_id", storeData.id)
        .eq("is_active", true)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!productData) {
        setError("Ürün bulunamadı veya artık satışta değil.");
        return;
      }

      setProduct(productData);

      await loadReviews(productData.id);

      if (userData.user) {
        await checkPurchase(
          userData.user.id,
          productData.id
        );
      }
    } catch (err) {
      console.error(err);
      setError("Ürün yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReviews(productId: string) {
    try {
      setReviewLoading(true);

      const { data, error } = await supabase
        .from("product_reviews")
        .select(
          "id,product_id,store_id,customer_id,order_id,rating,comment,created_at,updated_at"
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const reviewRows = (data || []) as Review[];

      if (reviewRows.length === 0) {
        setReviews([]);
        setAverageRating(0);
        return;
      }

      const customerIds = [
        ...new Set(reviewRows.map((review) => review.customer_id)),
      ];

      let customerMap: Record<string, string> = {};

      if (customerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", customerIds);

        if (profilesData) {
          customerMap = Object.fromEntries(
            profilesData.map((profile) => [
              profile.id,
              profile.full_name || "Müşteri",
            ])
          );
        }
      }

      const formattedReviews = reviewRows.map((review) => ({
        ...review,
        customer_name:
          customerMap[review.customer_id] || "Müşteri",
      }));

      const total = formattedReviews.reduce(
        (sum, review) => sum + Number(review.rating),
        0
      );

      setReviews(formattedReviews);
      setAverageRating(total / formattedReviews.length);
    } catch (err) {
      console.error("Yorumlar yüklenemedi:", err);
    } finally {
      setReviewLoading(false);
    }
  }

  async function checkPurchase(
    userId: string,
    productId: string
  ) {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
            id,
            order_items!inner (
              product_id
            )
          `
        )
        .eq("customer_id", userId)
        .eq("order_items.product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Satın alma kontrolü:", error);
        return;
      }

      if (data && data.length > 0) {
        const order = data[0] as {
          id: string;
        };

        setHasPurchased(true);
        setReviewableOrderId(order.id);

        const { data: existingReview } = await supabase
          .from("product_reviews")
          .select(
            "id,rating,comment"
          )
          .eq("customer_id", userId)
          .eq("product_id", productId)
          .eq("order_id", order.id)
          .maybeSingle();

        if (existingReview) {
          setEditingReviewId(existingReview.id);
          setReviewRating(existingReview.rating);
          setReviewComment(existingReview.comment || "");
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  function formatPrice(value: number) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(value);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  }

  function increaseQuantity() {
    if (!product) return;

    setQuantity((current) =>
      Math.min(current + 1, product.stock)
    );
  }

  function decreaseQuantity() {
    setQuantity((current) => Math.max(current - 1, 1));
  }

  function addToCart() {
    if (!store || !product) return;

    setAddingToCart(true);
    setError("");
    setMessage("");

    try {
      if (!product.is_active) {
        setError("Bu ürün artık satışta değil.");
        return;
      }

      if (product.stock <= 0) {
        setError("Bu ürün stokta yok.");
        return;
      }

      if (quantity > product.stock) {
        setError("Seçtiğiniz adet stoktan fazla.");
        return;
      }

      const storageKey = `${CART_PREFIX}${store.id}`;

      const savedCart = localStorage.getItem(storageKey);

      let cart: CartItem[] = [];

      if (savedCart) {
        try {
          const parsed = JSON.parse(savedCart);

          if (Array.isArray(parsed)) {
            cart = parsed;
          }
        } catch {
          cart = [];
        }
      }

      const existingIndex = cart.findIndex(
        (item) => item.id === product.id
      );

      if (existingIndex >= 0) {
        const existingItem = cart[existingIndex];

        const newQuantity =
          existingItem.quantity + quantity;

        if (newQuantity > product.stock) {
          setError(
            `Sepetteki toplam adet stok miktarını geçemez. Mevcut stok: ${product.stock}`
          );
          return;
        }

        cart[existingIndex] = {
          ...existingItem,
          ...product,
          quantity: newQuantity,
        };
      } else {
        cart.push({
          ...product,
          quantity,
        });
      }

      localStorage.setItem(
        storageKey,
        JSON.stringify(cart)
      );

      setMessage(
        `${quantity} adet ürün sepetinize eklendi.`
      );
    } catch (err) {
      console.error(err);
      setError("Ürün sepete eklenirken bir hata oluştu.");
    } finally {
      setAddingToCart(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product || !store) return;

    setReviewSubmitting(true);
    setError("");
    setMessage("");

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setError(
          "Yorum yapmak için hesabınıza giriş yapmalısınız."
        );
        return;
      }

      if (!hasPurchased || !reviewableOrderId) {
        setError(
          "Bu ürünü satın almadan yorum yapamazsınız."
        );
        return;
      }

      if (reviewRating < 1 || reviewRating > 5) {
        setError("Lütfen 1 ile 5 arasında puan verin.");
        return;
      }

      if (!reviewComment.trim()) {
        setError("Lütfen yorumunuzu yazın.");
        return;
      }

      if (reviewComment.trim().length < 5) {
        setError(
          "Yorumunuz en az 5 karakter olmalıdır."
        );
        return;
      }

      if (editingReviewId) {
        const { error: updateError } = await supabase
          .from("product_reviews")
          .update({
            rating: reviewRating,
            comment: reviewComment.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingReviewId)
          .eq("customer_id", userData.user.id);

        if (updateError) {
          throw updateError;
        }

        setMessage("Yorumunuz güncellendi.");
      } else {
        const { error: insertError } = await supabase
          .from("product_reviews")
          .insert({
            product_id: product.id,
            store_id: store.id,
            customer_id: userData.user.id,
            order_id: reviewableOrderId,
            rating: reviewRating,
            comment: reviewComment.trim(),
          });

        if (insertError) {
          if (
            insertError.code === "23505"
          ) {
            setError(
              "Bu siparişte bu ürün için zaten yorum yapmışsınız."
            );
            return;
          }

          throw insertError;
        }

        setMessage("Yorumunuz başarıyla yayınlandı.");
      }

      await loadReviews(product.id);

      setEditingReviewId(null);
      setReviewRating(5);
      setReviewComment("");
    } catch (err) {
      console.error(err);
      setError(
        "Yorum gönderilirken bir hata oluştu."
      );
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function deleteReview(reviewId: string) {
    if (!currentUserId || !product) return;

    const confirmed = window.confirm(
      "Bu yorumu silmek istediğinize emin misiniz?"
    );

    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase
        .from("product_reviews")
        .delete()
        .eq("id", reviewId)
        .eq("customer_id", currentUserId);

      if (deleteError) {
        throw deleteError;
      }

      if (editingReviewId === reviewId) {
        setEditingReviewId(null);
        setReviewRating(5);
        setReviewComment("");
      }

      await loadReviews(product.id);

      setMessage("Yorumunuz silindi.");
    } catch (err) {
      console.error(err);
      setError("Yorum silinirken bir hata oluştu.");
    }
  }

  function startEditingReview(review: Review) {
    setEditingReviewId(review.id);
    setReviewRating(review.rating);
    setReviewComment(review.comment || "");

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  }

  function renderStars(rating: number, large = false) {
    return (
      <div
        className={`flex items-center ${
          large ? "gap-1 text-2xl" : "gap-0.5 text-base"
        }`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={
              star <= Math.round(rating)
                ? "text-amber-400"
                : "text-slate-300"
            }
          >
            ★
          </span>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
            <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-200" />
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="aspect-square animate-pulse rounded-3xl bg-slate-200" />

            <div>
              <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
              <div className="mt-5 h-12 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="mt-5 h-8 w-40 animate-pulse rounded bg-slate-200" />
              <div className="mt-8 h-32 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error && !product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-10 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-black text-white">
            M
          </div>

          <h1 className="mt-6 text-2xl font-black text-slate-900">
            Ürün bulunamadı
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {error}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {store ? (
              <Link
                href={`/${store.slug}`}
                className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Mağazaya Dön
              </Link>
            ) : (
              <Link
                href="/"
                className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Ana Sayfaya Dön
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (!product || !store) {
    return null;
  }

  const totalPrice =
    Number(product.price) * quantity;

  const outOfStock = product.stock <= 0;

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

          <Link
            href={`/${store.slug}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Mağazaya Dön
          </Link>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/"
              className="text-slate-400 transition hover:text-slate-900"
            >
              Ana Sayfa
            </Link>

            <span className="text-slate-300">/</span>

            <Link
              href={`/${store.slug}`}
              className="font-semibold text-slate-500 transition hover:text-slate-900"
            >
              {store.name}
            </Link>

            <span className="text-slate-300">/</span>

            <span className="font-semibold text-slate-900">
              {product.name}
            </span>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-100">
                  <span className="text-8xl font-black text-slate-300">
                    M
                  </span>
                </div>
              )}

              {outOfStock && (
                <div className="absolute left-5 top-5 rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white shadow-lg">
                  TÜKENDİ
                </div>
              )}

              {!outOfStock &&
                product.stock <= 5 && (
                  <div className="absolute left-5 top-5 rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-white shadow-lg">
                    Son {product.stock} adet
                  </div>
                )}
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">
              {store.name}
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {product.name}
            </h1>

            {reviews.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {renderStars(averageRating)}

                <span className="text-sm font-black text-slate-900">
                  {averageRating.toFixed(1)}
                </span>

                <span className="text-sm text-slate-500">
                  ({reviews.length} yorum)
                </span>
              </div>
            )}

            <div className="mt-6 text-3xl font-black text-slate-950">
              {formatPrice(Number(product.price))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {outOfStock ? (
                <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
                  Stokta yok
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  Stokta
                </span>
              )}

              {!outOfStock && (
                <span className="text-sm text-slate-500">
                  {product.stock} adet mevcut
                </span>
              )}
            </div>

            <div className="my-8 h-px bg-slate-200" />

            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Ürün açıklaması
              </h2>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {product.description?.trim()
                  ? product.description
                  : "Bu ürün için henüz açıklama eklenmemiş."}
              </p>
            </div>

            {!outOfStock && (
              <>
                <div className="my-8 h-px bg-slate-200" />

                <div>
                  <label className="text-sm font-bold text-slate-900">
                    Adet
                  </label>

                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <button
                        onClick={decreaseQuantity}
                        disabled={quantity <= 1}
                        className="flex h-12 w-12 items-center justify-center text-lg font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        −
                      </button>

                      <div className="flex h-12 min-w-14 items-center justify-center border-x border-slate-200 px-4 text-sm font-black text-slate-900">
                        {quantity}
                      </div>

                      <button
                        onClick={increaseQuantity}
                        disabled={
                          quantity >= product.stock
                        }
                        className="flex h-12 w-12 items-center justify-center text-lg font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-sm text-slate-500">
                      Toplam:{" "}
                      <span className="font-black text-slate-900">
                        {formatPrice(totalPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {message && (
                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={addToCart}
                    disabled={addingToCart}
                    className="rounded-xl bg-slate-900 px-5 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {addingToCart
                      ? "Ekleniyor..."
                      : "Sepete Ekle"}
                  </button>

                  <Link
                    href={`/${store.slug}`}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Alışverişe Devam Et
                  </Link>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm">
                      ✓
                    </div>

                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        MiniShop güvencesi
                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Sipariş ve mağaza işlemleri MiniShop
                        altyapısı üzerinden takip edilir.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {outOfStock && (
              <>
                {message && (
                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <Link
                  href={`/${store.slug}`}
                  className="mt-8 block rounded-xl bg-slate-900 px-5 py-4 text-center text-sm font-black text-white transition hover:bg-slate-800"
                >
                  Diğer Ürünlere Bak
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* YORUMLAR */}
      {/* ========================================================= */}

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            {/* ÖZET */}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="text-sm font-black uppercase tracking-wider text-slate-500">
                Müşteri değerlendirmeleri
              </div>

              <div className="mt-5 flex items-end gap-3">
                <div className="text-5xl font-black text-slate-950">
                  {averageRating > 0
                    ? averageRating.toFixed(1)
                    : "—"}
                </div>

                {averageRating > 0 && (
                  <div className="pb-2">
                    {renderStars(averageRating)}
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {reviews.length > 0
                  ? `${reviews.length} müşteri değerlendirmesi`
                  : "Henüz değerlendirme yapılmamış."}
              </p>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold text-slate-500">
                  Değerlendirme sistemi
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Yorumlar yalnızca ürünü satın alan müşteriler
                  tarafından oluşturulabilir.
                </p>
              </div>
            </div>

            {/* YORUM LİSTESİ */}

            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">
                    Ürün yorumları
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Bu ürünü satın alan müşterilerin deneyimleri.
                  </p>
                </div>
              </div>

              {reviewLoading ? (
                <div className="mt-6 space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="animate-pulse rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="h-4 w-32 rounded bg-slate-200" />
                      <div className="mt-4 h-4 w-24 rounded bg-slate-200" />
                      <div className="mt-4 h-12 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                    ★
                  </div>

                  <h3 className="mt-4 text-lg font-black text-slate-900">
                    Henüz yorum yok
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Bu ürün hakkında ilk değerlendirmeyi yapan siz
                    olabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
                              {(review.customer_name || "M")
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <div className="text-sm font-black text-slate-900">
                                {review.customer_name}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-400">
                                {formatDate(review.created_at)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          {renderStars(review.rating)}
                        </div>
                      </div>

                      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {review.comment}
                      </p>

                      {currentUserId === review.customer_id && (
                        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() =>
                              startEditingReview(review)
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            Düzenle
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteReview(review.id)
                            }
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                          >
                            Sil
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* YORUM FORMU */}

          <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="max-w-2xl">
              <h2 className="text-xl font-black text-slate-950">
                {editingReviewId
                  ? "Yorumunu düzenle"
                  : "Ürünü değerlendirin"}
              </h2>

              {!currentUserId ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm text-slate-600">
                    Yorum yapmak için hesabınıza giriş yapmanız
                    gerekiyor.
                  </p>

                  <Link
                    href="/login"
                    className="mt-4 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                  >
                    Giriş Yap
                  </Link>
                </div>
              ) : !hasPurchased ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="text-sm font-black text-amber-800">
                    Satın alma doğrulaması gerekiyor
                  </div>

                  <p className="mt-2 text-sm leading-6 text-amber-700">
                    Bu ürün için yalnızca ürünü satın almış
                    müşteriler değerlendirme yapabilir.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={submitReview}
                  className="mt-6"
                >
                  <div>
                    <label className="text-sm font-black text-slate-900">
                      Puanınız
                    </label>

                    <div className="mt-3 flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setReviewRating(star)
                          }
                          className={`text-3xl transition hover:scale-110 ${
                            star <= reviewRating
                              ? "text-amber-400"
                              : "text-slate-300"
                          }`}
                          aria-label={`${star} yıldız`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <label
                      htmlFor="review-comment"
                      className="text-sm font-black text-slate-900"
                    >
                      Yorumunuz
                    </label>

                    <textarea
                      id="review-comment"
                      value={reviewComment}
                      onChange={(event) =>
                        setReviewComment(event.target.value)
                      }
                      placeholder="Ürün deneyiminizi paylaşın..."
                      rows={5}
                      maxLength={1000}
                      className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />

                    <div className="mt-2 text-right text-xs text-slate-400">
                      {reviewComment.length}/1000
                    </div>
                  </div>

                  {message && (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={reviewSubmitting}
                      className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {reviewSubmitting
                        ? "Kaydediliyor..."
                        : editingReviewId
                        ? "Yorumu Güncelle"
                        : "Yorumu Yayınla"}
                    </button>

                    {editingReviewId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReviewId(null);
                          setReviewRating(5);
                          setReviewComment("");
                          setError("");
                          setMessage("");
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        İptal
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-lg">🛡️</div>

              <h3 className="mt-3 text-sm font-black text-slate-900">
                Güvenli alışveriş
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Mağazalar MiniShop altyapısında doğrulama
                süreçlerinden geçirilir.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-lg">📦</div>

              <h3 className="mt-3 text-sm font-black text-slate-900">
                Sipariş takibi
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Oluşturduğunuz siparişleri hesabınız üzerinden
                takip edebilirsiniz.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-lg">💬</div>

              <h3 className="mt-3 text-sm font-black text-slate-900">
                Mağazayla iletişim
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Ürün hakkında soru sormak için mağazayla
                mesajlaşabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
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

            <Link
              href={`/${store.slug}`}
              className="transition hover:text-slate-900"
            >
              Mağaza
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}