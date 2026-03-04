"use client";

import {
  Home,
  Menu,
  X,
  LogIn,
  UserPlus,
  LogOut,
  User,
  PlusCircle,
  ClipboardCheck,
  Settings,
  Building2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAnalytics } from "@/hooks/useAnalytics";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const { hasOrganizations, selectedOrganization } = useOrganization();
  const {
    trackNavClick,
    trackLogoClick,
    trackMobileMenuToggle,
    trackAuthClick,
    trackExternalLink,
  } = useAnalytics();

  const isHomePage = pathname === "/";

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  const handleLogout = async () => {
    trackAuthClick("logout");
    await logout();
    setMobileMenuOpen(false);
  };

  const handleMobileMenuToggle = () => {
    const newState = !mobileMenuOpen;
    trackMobileMenuToggle(newState);
    setMobileMenuOpen(newState);
  };

  const handleNavLinkClick = (label: string, href: string) => {
    trackNavClick(label, href);
  };

  const handleExternalLinkClick = (url: string, linkText: string) => {
    trackExternalLink(url, linkText, "navigation");
  };

  // Navigation links with permission-based visibility
  const allNavLinks = [
    { href: "/", label: "DEAs", icon: Home, visible: true },
    { href: "/dea/new-simple", label: "Agregar DEA", icon: PlusCircle, visible: true },
    {
      href: selectedOrganization ? `/org/${selectedOrganization.id}` : "/org",
      label: "Mi Organización",
      icon: Building2,
      visible: hasOrganizations,
    },
    {
      href: "/verify",
      label: "Verificar",
      icon: ClipboardCheck,
      visible: user?.permissions?.canVerify || false,
    },
    {
      href: "/admin",
      label: "Admin",
      icon: Settings,
      visible: user?.permissions?.canAccessAdmin || false,
    },
  ];

  const navLinks = allNavLinks.filter((link) => link.visible);

  return (
    <nav
      className={`sticky top-0 z-[1001] transition-all duration-300 ${
        isHomePage ? "bg-white/80 backdrop-blur-md shadow-sm" : "bg-white shadow-sm border-b"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group" onClick={trackLogoClick}>
            <div className="relative h-8 w-8 sm:h-10 sm:w-10 transition-all duration-300 group-hover:scale-110">
              <Image
                src="/favicon.svg"
                alt="DeaMap Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                deamap.es
              </span>
              <a
                href="https://www.globalemergency.online/proyectos/deamap"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] sm:text-[10px] text-gray-500 hover:text-gray-700 transition-colors -mt-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExternalLinkClick(
                    "https://www.globalemergency.online/proyectos/deamap",
                    "Global Emergency (logo)"
                  );
                }}
              >
                by Global Emergency
              </a>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => handleNavLinkClick(link.label, link.href)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md"
                      : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* User section */}
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-600 flex items-center space-x-1 px-2">
                      <User className="w-3.5 h-3.5" />
                      <span className="max-w-[100px] truncate">{user.name}</span>
                    </span>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg font-medium text-sm text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 transition-all duration-200"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Salir</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => trackAuthClick("login")}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg font-medium text-sm text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 transition-all duration-200"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Entrar</span>
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => trackAuthClick("register")}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg font-medium text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Registrarse</span>
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={handleMobileMenuToggle}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100/80 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200/50">
            <div className="flex flex-col space-y-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => {
                      handleNavLinkClick(link.label, link.href);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md"
                        : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              {/* Mobile User section */}
              {!loading && (
                <>
                  {user ? (
                    <>
                      <div className="px-4 py-3 bg-gray-50/80 rounded-lg">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <User className="w-5 h-5" />
                          <span>{user.name}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{user.email}</div>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 transition-all duration-200"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={() => {
                          trackAuthClick("login");
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 transition-all duration-200"
                      >
                        <LogIn className="w-5 h-5" />
                        <span>Iniciar Sesión</span>
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => {
                          trackAuthClick("register");
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md transition-all duration-200"
                      >
                        <UserPlus className="w-5 h-5" />
                        <span>Registrarse</span>
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
