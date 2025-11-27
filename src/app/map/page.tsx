'use client'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Search, Filter, MapPin, Clock, Users } from 'lucide-react'
import type { Aed } from '@/types/aed'
import { useAeds } from '@/hooks/useAeds'
import Link from 'next/link'

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-200 animate-pulse" />
})

export default function MapPage() {
  const [search, setSearch] = useState('')
  const [show24h, setShow24h] = useState(false)
  const [showPublicAccess, setShowPublicAccess] = useState(false)
  const [selectedAed, setSelectedAed] = useState<Aed | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)

  const { aeds, loading, error } = useAeds({
    page: 1,
    limit: 1000, // Get all for map
    search: search || undefined
  })

  // Get user's location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude])
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }, [])

  // Filter AEDs
  const filteredAeds = useMemo(() => {
    return aeds.filter((aed) => {
      // 24h filter
      if (show24h && !aed.schedule?.has_24h_surveillance) {
        return false
      }

      // Public access filter (all are public by default)
      if (showPublicAccess) {
        return true
      }

      return true
    })
  }, [aeds, show24h, showPublicAccess])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <MapPin className="w-12 h-12 animate-pulse mx-auto text-blue-500 mb-4" />
          <p className="text-white">Cargando mapa...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Error de carga</h2>
          <p className="text-gray-300">No pudimos cargar los datos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-4 py-4 shadow-lg z-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold mb-3">deamap.es</h1>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar en Madrid..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>

            <button
              onClick={() => setShow24h(!show24h)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                show24h
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Clock className="w-4 h-4" />
              Disponibles 24h
            </button>

            <button
              onClick={() => setShowPublicAccess(!showPublicAccess)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                showPublicAccess
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Users className="w-4 h-4" />
              Acceso público
            </button>
          </div>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          aeds={filteredAeds}
          onAedClick={setSelectedAed}
        />

        {/* Floating button */}
        <button className="absolute bottom-6 right-4 bg-blue-500 text-white rounded-full p-4 shadow-lg hover:bg-blue-600 transition-colors z-[1000]">
          <MapPin className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom sheet for selected AED */}
      {selectedAed && (
        <div className="absolute bottom-16 left-0 right-0 bg-gray-800 text-white rounded-t-3xl shadow-2xl z-[1000] animate-slide-up">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">
                  {selectedAed.name}
                </h2>
                <p className="text-gray-300 text-sm flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {selectedAed.location.street_type} {selectedAed.location.street_name}, {selectedAed.location.street_number}, {selectedAed.location.postal_code} Madrid
                </p>
              </div>
              <button
                onClick={() => setSelectedAed(null)}
                className="text-gray-400 hover:text-white p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex gap-4 mb-4 text-sm">
              {selectedAed.schedule?.has_24h_surveillance && (
                <div className="flex items-center gap-1 text-green-400">
                  <Clock className="w-4 h-4" />
                  <span>Disponible 24h</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-blue-400">
                <Users className="w-4 h-4" />
                <span>Acceso público</span>
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              <strong>Instrucciones:</strong> {selectedAed.location.access_description || 'Preguntar en recepción.'}
            </p>

            <Link
              href={`/dea/${selectedAed.id}`}
              className="block w-full bg-red-500 text-white text-center py-3 rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              <MapPin className="inline w-5 h-5 mr-2" />
              Cómo llegar
            </Link>
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-around items-center h-16">
            <Link href="/map" className="flex flex-col items-center justify-center flex-1 h-full text-red-500">
              <MapPin className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Mapa</span>
            </Link>
            <Link href="/" className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-gray-200">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-xs font-medium">Lista</span>
            </Link>
            <button className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-gray-200">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs font-medium">Añadir</span>
            </button>
            <button className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-gray-200">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-medium">Ajustes</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  )
}
