'use client'

import { useState, useEffect } from 'react'
import { Activity } from 'lucide-react'
import type { DeaRecord } from '@/types'
import { filterRecords, getUniqueTypes } from '@/utils/helpers'
import DeaCard from '@/components/DeaCard'
import DeaModal from '@/components/DeaModal'
import SearchFilters from '@/components/SearchFilters'
import StatsDashboard from '@/components/StatsDashboard'
import HeroHeader from '@/components/HeroHeader'
import LoadingScreen from '@/components/LoadingScreen'
import useDeaRecords from '@/hooks/useDeaRecords'

export default function Home() {
    const {
        records,
        loading,
        error,
        refreshRecords,
        createRecord,
        updateRecord,
        deleteRecord
    } = useDeaRecords()

    const [selectedRecord, setSelectedRecord] = useState<DeaRecord | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('')

    const filteredRecords = filterRecords(records, searchTerm, filterType)
    const uniqueTypes = getUniqueTypes(records)

    const handleView = (record: DeaRecord) => {
        setSelectedRecord(record)
        setModalOpen(true)
    }

    const handleEdit = (record: DeaRecord) => {
        setSelectedRecord(record)
        setModalOpen(true)
    }

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Está seguro de que desea eliminar este registro?')) {
            try {
                await deleteRecord(id)
                refreshRecords()
            } catch (error) {
                console.error('Error al eliminar el registro:', error)
            }
        }
    }

    const handleCloseModal = () => {
        setSelectedRecord(null)
        setModalOpen(false)
    }

    const handleSaveRecord = async (record: DeaRecord) => {
        try {
            if (record.id) {
                await updateRecord(record.id, record)
            } else {
                await createRecord(record)
            }
            refreshRecords()
            handleCloseModal()
        } catch (error) {
            console.error('Error al guardar el registro:', error)
        }
    }

    if (loading) return <LoadingScreen />

    if (error) return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-2">Error de carga</h2>
                <p className="text-gray-700">No pudimos cargar los datos. Por favor, inténtelo de nuevo.</p>
                <button
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    onClick={refreshRecords}
                >
                    Reintentar
                </button>
            </div>
        </div>
    )

    return (
        <main className="min-h-screen w-full max-w-full bg-gradient-to-br from-blue-50 to-indigo-100">
            <HeroHeader />

            <div className="container mx-auto px-4 sm:px-6 py-6">
                <StatsDashboard records={records} />

                <SearchFilters
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    filterType={filterType}
                    setFilterType={setFilterType}
                    uniqueTypes={uniqueTypes}
                />

                <div className="mt-8 pb-16">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
                            {filteredRecords.length} DEAs encontrados
                        </h2>
                        <button
                            onClick={() => {
                                setSelectedRecord(null)
                                setModalOpen(true)
                            }}
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Activity className="w-4 h-4 mr-2" />
                            <span>Añadir nuevo DEA</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {filteredRecords.map(record => (
                            <DeaCard
                                key={record.id}
                                record={record}
                                onEdit={() => handleEdit(record)}
                                onDelete={() => handleDelete(record.id)}
                                onView={() => handleView(record)}
                            />
                        ))}

                        {filteredRecords.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white bg-opacity-70 rounded-xl shadow-md">
                                <p className="text-xl text-gray-600">No se encontraron registros con los criterios especificados.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {modalOpen && (
                <DeaModal
                    record={selectedRecord}
                    onClose={handleCloseModal}
                    onSave={handleSaveRecord}
                />
            )}
        </main>
    )
}
