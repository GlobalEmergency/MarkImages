"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirects to a published DEA that has verified photos.
 *
 * Used as a "see an example" link from the submission form so users
 * understand what good photos look like.
 */
export default function ExampleVerifiedDeaPage() {
  const router = useRouter();

  useEffect(() => {
    async function findExample() {
      try {
        // Fetch published DEAs, sorted by most recently updated, with images
        const res = await fetch("/api/aeds?limit=20&status=PUBLISHED");
        if (!res.ok) throw new Error("fetch failed");

        const data = await res.json();
        const aeds = data.data || [];

        // Find first DEA with at least 2 verified photos
        const withPhotos = aeds.find(
          (aed: { images?: { is_verified?: boolean }[] }) =>
            aed.images &&
            aed.images.filter((img: { is_verified?: boolean }) => img.is_verified !== false)
              .length >= 2
        );

        if (withPhotos) {
          router.replace(`/dea/${withPhotos.id}`);
        } else {
          // Fallback: redirect to first published DEA with any images
          const withAnyPhoto = aeds.find(
            (aed: { images?: unknown[] }) => aed.images && aed.images.length > 0
          );
          if (withAnyPhoto) {
            router.replace(`/dea/${withAnyPhoto.id}`);
          } else {
            // No DEA with photos found — go to map
            router.replace("/");
          }
        }
      } catch {
        router.replace("/");
      }
    }

    findExample();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
        <p className="text-sm text-gray-500">Buscando un ejemplo...</p>
      </div>
    </div>
  );
}
