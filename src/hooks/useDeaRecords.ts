'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DeaRecord } from '@/types'

/**
 * API client for DEA records
 */
const deaApiClient = {
  /**
   * Fetch all DEA records
   */
  fetchAll: async (): Promise<DeaRecord[]> => {
    const response = await fetch('/api/dea')
    if (!response.ok) {
      throw new Error(`Error en la carga: ${response.status}`)
    }
    return await response.json()
  },

  /**
   * Create a new DEA record
   */
  create: async (recordData: Omit<DeaRecord, 'id'>): Promise<DeaRecord> => {
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
  },

  /**
   * Update an existing DEA record
   */
  update: async (id: number, recordData: Partial<DeaRecord>): Promise<DeaRecord> => {
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
  },

  /**
   * Delete a DEA record
   */
  delete: async (id: number): Promise<{ success: boolean; deletedRecord: DeaRecord }> => {
    const response = await fetch(`/api/dea/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Error al eliminar el registro ${id}`)
    }

    return await response.json()
  }
}

/**
 * Hook for managing DEA records with optimized performance
 */
export default function useDeaRecords() {
  const [records, setRecords] = useState<DeaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Refresh all records from the API
   */
  const refreshRecords = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await deaApiClient.fetchAll()
      setRecords(data)
    } catch (err) {
      console.error('Error al cargar los registros:', err)
      setError(err instanceof Error ? err : new Error('Error desconocido al cargar registros'))
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Create a new record
   */
  const createRecord = useCallback(async (recordData: Omit<DeaRecord, 'id'>) => {
    return await deaApiClient.create(recordData)
  }, [])

  /**
   * Update an existing record
   */
  const updateRecord = useCallback(async (id: number, recordData: Partial<DeaRecord>) => {
    return await deaApiClient.update(id, recordData)
  }, [])

  /**
   * Delete a record
   */
  const deleteRecord = useCallback(async (id: number) => {
    return await deaApiClient.delete(id)
  }, [])

  // Load records on initial mount
  useEffect(() => {
    refreshRecords()
  }, [refreshRecords])

  // Memoize the return value to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    records,
    loading,
    error,
    refreshRecords,
    createRecord,
    updateRecord,
    deleteRecord
  }), [records, loading, error, refreshRecords, createRecord, updateRecord, deleteRecord])

  return returnValue
}
