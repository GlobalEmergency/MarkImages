import { NextRequest, NextResponse } from 'next/server'
import { DeaRepository } from '@/repositories/deaRepository'

const deaRepository = new DeaRepository();

export async function GET() {
	try {
		const records = await deaRepository.findAll()
		return NextResponse.json(records)
	} catch (error) {
		console.error('Error fetching DEA records:', error);
		return NextResponse.json({ error: 'Error al obtener registros' }, { status: 500 })
	}
}

export async function POST(request: NextRequest) {
	try {
		const data = await request.json()
		const record = await deaRepository.create(data)
		return NextResponse.json(record, { status: 201 })
	} catch (error) {
		console.error('Error creating DEA record:', error);
		return NextResponse.json({ error: 'Error al crear registro' }, { status: 500 })
	}
}
