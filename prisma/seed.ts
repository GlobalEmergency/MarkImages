import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const sampleData = [
	{
		horaInicio: new Date('2025-06-06T10:29:00.999Z'),
		horaFinalizacion: new Date('2025-06-06T10:29:53.000Z'),
		correoElectronico: 'escobarcma.ext@madrid.es',
		nombre: 'Maria Del Carmen escobar cano',
		numeroProvisionalDea: 4588,
		tipoEstablecimiento: 'Centro educativo',
		titularidadLocal: 'Privada',
		usoLocal: 'Público',
		titularidad: 'Colegio Nuestra Señora de Fátima',
		propuestaDenominacion: 'Centro educativo',
		tipoVia: 'Calle',
		nombreVia: 'Manuel Muñoz',
		numeroVia: '30',
		complementoDireccion: 'Acceso por C/Hijas de Jesús',
		codigoPostal: 28026,
		distrito: '12. Usera',
		latitud: 40.334922,
		longitud: -3.701048,
		horarioApertura: 'NO 24 horas al día',
		aperturaLunesViernes: 9,
		cierreLunesViernes: 5,
		aperturaSabados: 0,
		cierreSabados: 0,
		aperturaDomingos: 0,
		cierreDomingos: 0,
		vigilante24h: 'No',
		foto1: 'https://madrid-my.sharepoint.com/.../IMG_20250606_121834.jpg',
		foto2: 'https://madrid-my.sharepoint.com/.../IMG_20250606_121511.jpg',
		descripcionAcceso: 'Entrando al patio por la calle Hijas de Jesús, a la izquierda en el departamento de Tecnología',
		comentarioLibre: 'Las coordenadas son del acceso por la calle Manuel Muñoz número 30'
	},
	{
		horaInicio: new Date('2025-06-06T10:42:13.000Z'),
		horaFinalizacion: new Date('2025-06-06T10:47:34.999Z'),
		correoElectronico: 'escobarcma.ext@madrid.es',
		nombre: 'Maria Del Carmen escobar cano',
		numeroProvisionalDea: 3291,
		tipoEstablecimiento: 'Centro educativo',
		titularidadLocal: 'Privada',
		usoLocal: 'Público',
		titularidad: 'Colegio Mater Purissima',
		propuestaDenominacion: 'Centro educativo',
		tipoVia: 'Calle',
		nombreVia: 'Madre Cándida María de Jesús',
		numeroVia: '4',
		codigoPostal: 28026,
		distrito: '12. Usera',
		latitud: 40.38463,
		longitud: -3.701529,
		horarioApertura: 'NO 24 horas al día',
		aperturaLunesViernes: 8,
		cierreLunesViernes: 6,
		aperturaSabados: 0,
		cierreSabados: 0,
		aperturaDomingos: 0,
		cierreDomingos: 0,
		vigilante24h: 'No',
		descripcionAcceso: 'Pasando hall de entrada, a la derecha y luego a la izquierda, en una sala de profesores'
	}
]

async function main() {
	console.log('🌱 Sembrando datos de ejemplo...')

	for (const data of sampleData) {
		await prisma.deaRecord.create({ data })
	}

	console.log('✅ Datos sembrados exitosamente')
}

main()
	.then(async () => {
		await prisma.$disconnect()
	})
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
