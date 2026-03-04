"use client";

import {
  MapPin,
  ClipboardCheck,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, use } from "react";

import { useOrganization } from "@/contexts/OrganizationContext";

interface OrgStats {
  total_deas: number;
  verified_deas: number;
  pending_verifications: number;
  members_count: number;
  verifications_this_month: number;
  deas_by_status: {
    active: number;
    inactive: number;
    pending: number;
  };
}

export default function OrgDashboard({ params }: { params: Promise<{ orgId: string }> }) {
  const { selectedOrganization, canManageMembers } = useOrganization();
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [loading, setLoading] = useState(true);
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/organizations/${orgId}/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Error fetching organization stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">¡Hola! 👋</h1>
        <p className="text-gray-600">Panel de control de {selectedOrganization?.name}</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {/* Total DEAs */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.total_deas || 0}</p>
          <p className="text-sm text-gray-600 mt-1">DEAs totales</p>
        </div>

        {/* Verified DEAs */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-gray-900">
            {stats?.verified_deas || 0}
          </p>
          <p className="text-sm text-gray-600 mt-1">Verificados</p>
        </div>

        {/* Pending Verifications */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-gray-900">
            {stats?.pending_verifications || 0}
          </p>
          <p className="text-sm text-gray-600 mt-1">Pendientes</p>
        </div>

        {/* Team Members */}
        {canManageMembers && (
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">
              {stats?.members_count || 0}
            </p>
            <p className="text-sm text-gray-600 mt-1">Miembros</p>
          </div>
        )}
      </div>

      {/* Activity Card */}
      {stats && stats.verifications_this_month > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-1">Este mes</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.verifications_this_month} verificaciones
              </p>
              <p className="text-sm text-gray-600 mt-1">¡Excelente trabajo del equipo! 🎉</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Acciones rápidas</h2>

        {/* Verify DEAs */}
        {stats && stats.pending_verifications > 0 && (
          <Link
            href={`/org/${orgId}/verify`}
            className="block bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all active:scale-98"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Verificar DEAs</p>
                  <p className="text-sm text-gray-600">
                    {stats.pending_verifications} pendientes de verificación
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>
        )}

        {/* View all DEAs */}
        <Link
          href={`/org/${orgId}/deas`}
          className="block bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all active:scale-98"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Ver todos los DEAs</p>
                <p className="text-sm text-gray-600">
                  Gestiona los {stats?.total_deas || 0} DEAs de tu organización
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>

        {/* Manage team */}
        {canManageMembers && (
          <Link
            href={`/org/${orgId}/members`}
            className="block bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all active:scale-98"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Gestionar equipo</p>
                  <p className="text-sm text-gray-600">
                    Administra los miembros de tu organización
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>
        )}
      </div>

      {/* Status Overview */}
      {stats && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Estado de los DEAs</h3>
          <div className="space-y-3">
            {/* Active */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-700">Activos</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {stats.deas_by_status?.active || 0}
              </span>
            </div>

            {/* Inactive */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-sm text-gray-700">Inactivos</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {stats.deas_by_status?.inactive || 0}
              </span>
            </div>

            {/* Pending */}
            {stats.deas_by_status?.pending > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm text-gray-700">Pendientes</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {stats.deas_by_status.pending}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
