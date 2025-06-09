import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
	try {
		const records = await prisma.deaRecord.findMany({
			orderBy: { createdAt: 'desc' }
		})
		return NextResponse.json(records)
	} catch (_error) {
		return NextResponse.json({ error: 'Error al obtener registros' }, { status: 500 })
	}
}

export async function POST(request: NextRequest) {
	try {
		const data = await request.json()
		const record = await prisma.deaRecord.create({ data })
		return NextResponse.json(record, { status: 201 })
	} catch (error) {
		return NextResponse.json({ error: 'Error al crear registro' }, { status: 500 })
	}
}
