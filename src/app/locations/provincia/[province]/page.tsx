import { notFound, permanentRedirect } from "next/navigation";

import { communityForIneCode, communityPath } from "@/lib/geography";
import { PROVINCE_BY_SLUG } from "@/lib/provinces";

/**
 * Legacy redirect: /locations/provincia/[province] → /locations/spain/[community]
 * Maps province slug to its community and issues a 308 permanent redirect.
 */

interface Props {
  params: Promise<{ province: string }>;
}

export default async function LegacyProvinceRedirect({ params }: Props) {
  const { province: slug } = await params;
  const province = PROVINCE_BY_SLUG.get(slug);

  if (!province) notFound();

  const community = communityForIneCode(province.ineCode);
  if (!community) notFound();

  permanentRedirect(communityPath("spain", community));
}
