'use client'

import { useState, useEffect } from 'react'
import type { DeaRecord } from '@/types'

export default function useDeaRecords() {
  const [records, setRecords] = useState<DeaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refreshRecords = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dea')
      if (!response.ok) {
        throw new Error(`Error en la carga: ${response.status}`)
      }
      const data = await response.json()
      setRecords(data)
    } catch (err) {
      console.error('Error al cargar los registros:', err)
      setError(err instanceof Error ? err : new Error('Error desconocido al cargar registros'))
    } finally {
      setLoading(false)
    }
  }

  const createRecord = async (recordData: Omit<DeaRecord, 'id'>) => {
    const response = await fetch('/api/dea', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recordData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Error al crear el registro')
    }

    return await response.json()
  }

  const updateRecord = async (id: number, recordData: Partial<DeaRecord>) => {
    const response = await fetch(`/api/dea/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recordData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Error al actualizar el registro ${id}`)
    }

    return await response.json()
  }

  const deleteRecord = async (id: number) => {
    const response = await fetch(`/api/dea/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Error al eliminar el registro ${id}`)
    }

    return await response.json()
  }

  useEffect(() => {
    refreshRecords()
  }, [])

  return {
    records,
    loading,
    error,
    refreshRecords,
    createRecord,
    updateRecord,
    deleteRecord
  }
}
