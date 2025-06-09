import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const record = await prisma.deaRecord.findUnique({
			where: { id: parseInt(params.id) }
		})
		if (!record) {
			return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
		}
		return NextResponse.json(record)
	} catch (_error) {
		console.log(_error);
		return NextResponse.json({ error: 'Error al obtener registro' }, { status: 500 })
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const data = await request.json()
		const record = await prisma.deaRecord.update({
			where: { id: parseInt(params.id) },
			data
		})
		return NextResponse.json(record)
	} catch (_error) {
		console.log(_error);
		return NextResponse.json({ error: 'Error al actualizar registro' }, { status: 500 })
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		await prisma.deaRecord.delete({
			where: { id: parseInt(params.id) }
		})
		return NextResponse.json({ message: 'Registro eliminado' })
	} catch (_error) {
		console.log(_error);
		return NextResponse.json({ error: 'Error al eliminar registro' }, { status: 500 })
	}
}
