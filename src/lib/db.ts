import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined
}

function createPrismaClient() {
	const connectionString = process.env.DATABASE_URL

	// Durante el build de Next.js, puede no haber DATABASE_URL
	// En ese caso, crear un cliente básico que no se usará realmente
	if (!connectionString) {
		console.warn('DATABASE_URL not set, creating client without adapter')
		return new PrismaClient({
			log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
		})
	}

	// En runtime con DATABASE_URL, usar adapter dinámicamente
	try {
		// Importación dinámica para evitar errores en build
		const { Pool } = require('pg')
		const { PrismaPg } = require('@prisma/adapter-pg')

		const pool = new Pool({ connectionString })
		const adapter = new PrismaPg(pool)

		return new PrismaClient({
			adapter,
			log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
		})
	} catch (error) {
		console.warn('Failed to create adapter, using standard client:', error)
		return new PrismaClient({
			log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
		})
	}
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma
}
