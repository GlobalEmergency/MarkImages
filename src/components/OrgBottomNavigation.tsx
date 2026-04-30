"use client";

import { LayoutDashboard, MapPin, ClipboardCheck, Users, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useOrganization } from "@/contexts/OrganizationContext";

export default function OrgBottomNavigation() {
  const pathname = usePathname();
  const { selectedOrganization, canManageMembers } = useOrganization();

  // Solo mostrar en rutas de organización
  if (!pathname.startsWith("/org")) {
    return null;
  }

  // Si no hay organización seleccionada, no mostrar
  if (!selectedOrganization) {
    return null;
  }

  const orgId = selectedOrganization.id;

  const isActive = (path: string) => {
    if (path === `/org/${orgId}`) {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  // Enlaces base (todos los usuarios de organización)
  const baseLinks = [
    {
      href: `/org/${orgId}`,
      label: "Inicio",
      icon: LayoutDashboard,
    },
    {
      href: `/org/${orgId}/deas`,
      label: "DEAs",
      icon: MapPin,
    },
    {
      href: `/org/${orgId}/verify`,
      label: "Verificar",
      icon: ClipboardCheck,
    },
  ];

  // Enlaces adicionales según permisos
  const adminLinks = [
    ...(canManageMembers
      ? [
          {
            href: `/org/${orgId}/members`,
            label: "Equipo",
            icon: Users,
          },
        ]
      : []),
    ...(canManageMembers
      ? [
          {
            href: `/org/${orgId}/settings`,
            label: "Ajustes",
            icon: Settings,
          },
        ]
      : []),
  ];

  const allLinks = [...baseLinks, ...adminLinks];

  // Limitar a 5 items máximo para mejor UX móvil
  const navLinks = allLinks.slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom md:hidden">
      <div className="flex justify-around items-center h-16 px-2">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center flex-1 h-full px-2 py-1 transition-all duration-200 ${
                active ? "text-blue-600" : "text-gray-500 hover:text-gray-900 active:scale-95"
              }`}
            >
              <Icon
                className={`w-6 h-6 mb-1 transition-all ${active ? "stroke-[2.5]" : "stroke-2"}`}
              />
              <span className={`text-[10px] font-medium ${active ? "font-semibold" : ""}`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
