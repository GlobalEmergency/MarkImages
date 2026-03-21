"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const EXAMPLE_DEA_ID = "bf1c7e85-d8d4-48da-896c-b975bf79648d";

/**
 * Redirects to a known published DEA with verified photos.
 *
 * Used as a "see an example" link from the submission form so users
 * understand what good photos look like.
 */
export default function ExampleVerifiedDeaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dea/${EXAMPLE_DEA_ID}`);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
        <p className="text-sm text-gray-500">Cargando ejemplo...</p>
      </div>
    </div>
  );
}
