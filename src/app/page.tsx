// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, Plus, Heart, MapPin, Users, Building } from 'lucide-react'
import DeaCard from '@/components/DeaCard'

interface DeaRecord {
  id: number
  horaInicio: string
  horaFinalizacion: string
  correoElectronico: string
  nombre: string
  numeroProvisionalDea: number
  tipoEstablecimiento: string
  titularidadLocal: string
  usoLocal: string
  titularidad: string
  propuestaDenominacion: string
  tipoVia: string
  nombreVia: string
  numeroVia?: string
  complementoDireccion?: string
  codigoPostal: number
  distrito: string
  latitud: number
  longitud: number
  horarioApertura: string
  aperturaLunesViernes: number
  cierreLunesViernes: number
  aperturaSabados: number
  cierreSabados: number
  aperturaDomingos: number
  cierreDomingos: number
  vigilante24h: string
  foto1?: string
  foto2?: string
  descripcionAcceso?: string
  comentarioLibre?: string
  createdAt: string
  updatedAt: string
}

// Modal para ver detalles
function DeaModal({ record, isOpen, onClose }: { record: DeaRecord | null, isOpen: boolean, onClose: () => void }) {
  if (!isOpen || !record) return null

  return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Detalles del DEA</h2>
              <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DEA #</label>
                  <div className="text-lg font-semibold text-red-600">#{record.numeroProvisionalDea}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Establecimiento</label>
                  <div className="text-gray-900">{record.titularidad}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <div className="text-gray-900">{record.tipoEstablecimiento}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <div className="text-gray-900">
                    {record.tipoVia} {record.nombreVia} {record.numeroVia}<br/>
                    {record.codigoPostal} - {record.distrito}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coordenadas</label>
                  <div className="text-gray-900">
                    Lat: {record.latitud}, Lng: {record.longitud}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario (L-V)</label>
                  <div className="text-gray-900">
                    {record.aperturaLunesViernes}:00h - {record.cierreLunesViernes}:00h
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vigilante 24h</label>
                  <div className={`inline-block px-2 py-1 rounded text-sm ${record.vigilante24h === 'Sí' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {record.vigilante24h}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inspector</label>
                  <div className="text-gray-900">{record.nombre}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de registro</label>
                  <div className="text-gray-900">
                    {new Date(record.createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>

            {record.descripcionAcceso && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descripción de Acceso</label>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{record.descripcionAcceso}</p>
                  </div>
                </div>
            )}

            {record.comentarioLibre && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Comentarios</label>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{record.comentarioLibre}</p>
                  </div>
                </div>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                  onClick={onClose}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
  )
}

export default function Home() {
  const [records, setRecords] = useState<DeaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<DeaRecord | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')

  // Cargar datos de la API
  useEffect(() => {
    fetchRecords()
  }, [])

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/dea')
      if (response.ok) {
        const data = await response.json()
        setRecords(data)
      }
    } catch (error) {
      console.error('Error al cargar registros:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.titularidad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.distrito.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.nombreVia.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === '' || record.tipoEstablecimiento === filterType
    return matchesSearch && matchesFilter
  })

  const uniqueTypes = [...new Set(records.map(r => r.tipoEstablecimiento))]

  const handleView = (record: DeaRecord) => {
    setSelectedRecord(record)
    setModalOpen(true)
  }

  const handleEdit = (record: DeaRecord) => {
    // Aquí implementarías la lógica de edición
    console.log('Editar registro:', record.id)
  }

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este registro?')) {
      try {
        const response = await fetch(`/api/dea/${id}`, {
          method: 'DELETE'
        })
        if (response.ok) {
          setRecords(records.filter(r => r.id !== id))
        }
      } catch (error) {
        console.error('Error al eliminar registro:', error)
      }
    }
  }

  if (loading) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="text-center">
            <Heart className="w-12 h-12 text-red-500 animate-pulse mx-auto mb-4" />
            <p className="text-gray-600">Cargando registros DEA...</p>
          </div>
        </div>
    )
  }

  return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Heart className="w-10 h-10 text-red-600" />
              <h1 className="text-4xl font-bold text-gray-900">
                <span className="text-red-600">DEA</span> Madrid
              </h1>
            </div>
            <p className="text-xl text-gray-600">Sistema de Gestión de Desfibriladores</p>
            <div className="w-24 h-1 bg-red-600 mx-auto mt-4"></div>
          </header>

          {/* Filtros */}
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                  type="text"
                  placeholder="Buscar por establecimiento, distrito o vía..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div className="lg:w-64 relative">
              <Filter className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none"
              >
                <option value="">Todos los tipos</option>
                {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-2">
                    <Heart className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-red-600">{records.length}</div>
                  <div className="text-gray-600">Total DEAs</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-2">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {records.filter(r => r.vigilante24h === 'Sí').length}
                  </div>
                  <div className="text-gray-600">Con Vigilante 24h</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-2">
                    <Building className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {uniqueTypes.length}
                  </div>
                  <div className="text-gray-600">Tipos de Establecimientos</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-2">
                    <MapPin className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {[...new Set(records.map(r => r.distrito))].length}
                  </div>
                  <div className="text-gray-600">Distritos</div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid de tarjetas */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredRecords.map(record => (
                <DeaCard
                    key={record.id}
                    record={record}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            ))}
          </div>

          {/* Estado vacío */}
          {filteredRecords.length === 0 && !loading && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">No se encontraron resultados</h3>
                <p className="text-gray-600">Prueba ajustando los filtros de búsqueda</p>
              </div>
          )}

          {/* Modal */}
          <DeaModal
              record={selectedRecord}
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
          />
        </div>
      </div>
  )
}
