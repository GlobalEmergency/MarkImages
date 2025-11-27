import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Sembrando datos de ejemplo para el nuevo esquema...')

  // 1. Crear distritos de ejemplo
  console.log('📍 Creando distritos...')
  const distrito12 = await prisma.district.upsert({
    where: { district_code: 12 },
    update: {},
    create: {
      district_code: 12,
      text_code: '12',
      name: 'Usera',
      normalized_name: 'usera',
      shape_length: 0,
      shape_area: 0,
    },
  })

  const distrito1 = await prisma.district.upsert({
    where: { district_code: 1 },
    update: {},
    create: {
      district_code: 1,
      text_code: '01',
      name: 'Centro',
      normalized_name: 'centro',
      shape_length: 0,
      shape_area: 0,
    },
  })

  console.log(`✅ Distritos creados: ${distrito12.name}, ${distrito1.name}`)

  // 2. Crear responsables de ejemplo
  console.log('👤 Creando responsables...')

  // Buscar o crear responsible1
  let responsible1 = await prisma.aedResponsible.findFirst({
    where: { email: 'escobarcma.ext@madrid.es' },
  })

  if (!responsible1) {
    responsible1 = await prisma.aedResponsible.create({
      data: {
        name: 'Maria Del Carmen Escobar Cano',
        email: 'escobarcma.ext@madrid.es',
        phone: '+34 600 123 456',
        ownership: 'Público',
        local_ownership: 'Privada',
        local_use: 'Público',
        organization: 'Colegio Nuestra Señora de Fátima',
        position: 'Coordinadora de Salud',
      },
    })
  }

  // Buscar o crear responsible2
  let responsible2 = await prisma.aedResponsible.findFirst({
    where: { email: 'admin@materpurissima.edu' },
  })

  if (!responsible2) {
    responsible2 = await prisma.aedResponsible.create({
      data: {
        name: 'Director Administrativo',
        email: 'admin@materpurissima.edu',
        phone: '+34 600 654 321',
        ownership: 'Público',
        local_ownership: 'Privada',
        local_use: 'Público',
        organization: 'Colegio Mater Purissima',
        position: 'Director',
      },
    })
  }

  console.log(`✅ Responsables creados: ${responsible1.name}, ${responsible2.name}`)

  // 3. Crear schedules de ejemplo
  console.log('⏰ Creando horarios...')
  const schedule1 = await prisma.aedSchedule.create({
    data: {
      description: 'Horario escolar de lunes a viernes',
      has_24h_surveillance: false,
      has_restricted_access: false,
      weekday_opening: '09:00',
      weekday_closing: '17:00',
      saturday_opening: null,
      saturday_closing: null,
      sunday_opening: null,
      sunday_closing: null,
      closed_on_holidays: true,
      closed_in_august: true,
      observations: 'Disponible durante horario escolar',
    },
  })

  const schedule2 = await prisma.aedSchedule.create({
    data: {
      description: 'Horario escolar extendido',
      has_24h_surveillance: false,
      has_restricted_access: false,
      weekday_opening: '08:00',
      weekday_closing: '18:00',
      saturday_opening: null,
      saturday_closing: null,
      sunday_opening: null,
      sunday_closing: null,
      closed_on_holidays: true,
      closed_in_august: true,
      observations: 'Horario ampliado de lunes a viernes',
    },
  })

  console.log('✅ Horarios creados')

  // 4. Crear ubicaciones
  console.log('📍 Creando ubicaciones...')
  const location1 = await prisma.aedLocation.create({
    data: {
      street_type: 'Calle',
      street_name: 'Manuel Muñoz',
      street_number: '30',
      additional_info: 'Acceso por C/Hijas de Jesús',
      postal_code: '28026',
      latitude: 40.334922,
      longitude: -3.701048,
      coordinates_precision: 'high',
      district_id: distrito12.id,
      access_description: 'Entrando al patio por la calle Hijas de Jesús, a la izquierda en el departamento de Tecnología',
      visible_references: 'Edificio educativo con acceso desde patio principal',
      location_observations: 'Las coordenadas son del acceso por la calle Manuel Muñoz número 30',
    },
  })

  const location2 = await prisma.aedLocation.create({
    data: {
      street_type: 'Calle',
      street_name: 'Madre Cándida María de Jesús',
      street_number: '4',
      additional_info: null,
      postal_code: '28026',
      latitude: 40.38463,
      longitude: -3.701529,
      coordinates_precision: 'high',
      district_id: distrito12.id,
      access_description: 'Pasando hall de entrada, a la derecha y luego a la izquierda, en una sala de profesores',
      visible_references: 'Colegio con entrada principal visible desde la calle',
    },
  })

  console.log('✅ Ubicaciones creadas')

  // 5. Crear AEDs
  console.log('🏥 Creando AEDs...')
  const aed1 = await prisma.aed.create({
    data: {
      code: '12-001',
      provisional_number: 4588,
      name: 'Colegio Nuestra Señora de Fátima',
      establishment_type: 'Centro educativo',
      latitude: location1.latitude,
      longitude: location1.longitude,
      coordinates_precision: 'high',
      source_origin: 'WEB_FORM',
      status: 'PUBLISHED',
      published_at: new Date(),
      location_id: location1.id,
      responsible_id: responsible1.id,
      schedule_id: schedule1.id,
      origin_observations: 'DEA instalado en centro educativo privado con uso público',
    },
  })

  const aed2 = await prisma.aed.create({
    data: {
      code: '12-002',
      provisional_number: 3291,
      name: 'Colegio Mater Purissima',
      establishment_type: 'Centro educativo',
      latitude: location2.latitude,
      longitude: location2.longitude,
      coordinates_precision: 'high',
      source_origin: 'WEB_FORM',
      status: 'PUBLISHED',
      published_at: new Date(),
      location_id: location2.id,
      responsible_id: responsible2.id,
      schedule_id: schedule2.id,
      origin_observations: 'DEA ubicado en sala de profesores',
    },
  })

  console.log(`✅ AEDs creados: ${aed1.code}, ${aed2.code}`)

  // 6. Crear código history
  console.log('📜 Creando historial de códigos...')
  await prisma.aedCodeHistory.create({
    data: {
      aed_id: aed1.id,
      code: aed1.code,
      district: 12,
      sequential: 1,
      is_active: true,
      change_reason: 'Código inicial asignado',
    },
  })

  await prisma.aedCodeHistory.create({
    data: {
      aed_id: aed2.id,
      code: aed2.code,
      district: 12,
      sequential: 2,
      is_active: true,
      change_reason: 'Código inicial asignado',
    },
  })

  console.log('✅ Historial de códigos creado')

  // 7. Crear cambios de estado
  console.log('📊 Creando historial de cambios de estado...')
  await prisma.aedStatusChange.create({
    data: {
      aed_id: aed1.id,
      previous_status: null,
      new_status: 'DRAFT',
      reason: 'Creación inicial',
      notes: 'AED registrado por primera vez en el sistema',
    },
  })

  await prisma.aedStatusChange.create({
    data: {
      aed_id: aed1.id,
      previous_status: 'DRAFT',
      new_status: 'PUBLISHED',
      reason: 'Verificación completada',
      notes: 'AED verificado y publicado en el mapa público',
    },
  })

  await prisma.aedStatusChange.create({
    data: {
      aed_id: aed2.id,
      previous_status: null,
      new_status: 'DRAFT',
      reason: 'Creación inicial',
      notes: 'AED registrado por primera vez en el sistema',
    },
  })

  await prisma.aedStatusChange.create({
    data: {
      aed_id: aed2.id,
      previous_status: 'DRAFT',
      new_status: 'PUBLISHED',
      reason: 'Verificación completada',
      notes: 'AED verificado y publicado en el mapa público',
    },
  })

  console.log('✅ Historial de cambios de estado creado')

  console.log('\n✅ Todos los datos de ejemplo han sido sembrados exitosamente')
  console.log('\n📊 Resumen:')
  console.log(`   - Distritos: 2`)
  console.log(`   - Responsables: 2`)
  console.log(`   - Horarios: 2`)
  console.log(`   - Ubicaciones: 2`)
  console.log(`   - AEDs: 2`)
  console.log(`   - Códigos históricos: 2`)
  console.log(`   - Cambios de estado: 4`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error durante el seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
