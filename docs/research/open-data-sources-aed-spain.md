# Fuentes de datos abiertos de DEA/DESA en España

Documento de investigación: fuentes públicas oficiales de datos sobre Desfibriladores Externos Automatizados (DEA/DESA) en España, organizadas por comunidad autónoma.

Fecha de investigación: 2026-03-12

---

## Resumen

España no tiene un registro nacional unificado de DEAs. Cada comunidad autónoma mantiene su propio registro, regulado por normativa autonómica. Algunas CCAA publican sus datos en portales de datos abiertos; otras solo mantienen registros internos sin acceso público.

A continuación se listan las fuentes confirmadas con datos descargables, y las CCAA donde no se han encontrado datos abiertos.

---

## Fuentes confirmadas con datos descargables

### 1. Comunidad de Madrid

- **Portal**: Datos Abiertos Comunidad de Madrid
- **Dataset**: Desfibriladores externos fuera del ámbito sanitario
- **Formato**: CSV
- **URL Portal**: https://datos.comunidad.madrid/catalogo/dataset/desfibriladores_externos_fuera_ambito_sanitario
- **URL Recurso directo**: https://datos.comunidad.madrid/dataset/desfibriladores_externos_fuera_ambito_sanitario/resource/94756e35-3059-451d-81a6-3427d2551de4
- **Catálogo nacional**: https://datos.gob.es/en/catalogo/a13002908-desfibriladores-externos-fuera-del-ambito-sanitario1
- **Normativa**: Decreto 78/2017, de 12 de septiembre
- **Campos esperados**: ubicación, dirección, tipo de espacio, coordenadas
- **Prioridad**: ALTA - CSV directo, fácil de procesar

### 2. Castilla y León

- **Portal**: Datos Abiertos Junta de Castilla y León (OpenDataSoft)
- **Frecuencia de actualización**: Diaria

#### 2a. DESA en espacios físicos

- **URL Explorar**: https://analisis.datosabiertos.jcyl.es/explore/dataset/registro-de-desfibriladores-externos-semiautomaticos-desa-en-espacios-fisicos/
- **URL API (JSON)**: https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/registro-de-desfibriladores-externos-semiautomaticos-desa-en-espacios-fisicos/records?limit=100
- **URL Export CSV**: https://analisis.datosabiertos.jcyl.es/explore/dataset/registro-de-desfibriladores-externos-semiautomaticos-desa-en-espacios-fisicos/export/
- **Formatos**: CSV, JSON, Excel, GeoJSON (via plataforma OpenDataSoft)
- **Campos**: número de serie, empresa, dirección completa (provincia, localidad, calle)
- **Prioridad**: ALTA - API REST con JSON, actualización diaria

#### 2b. DESA en vehículos de transporte no sanitario

- **URL Explorar**: https://analisis.datosabiertos.jcyl.es/explore/dataset/registro-de-desfibriladores-externos-semiautomaticos-desa-en-vehiculos-de-transp/
- **URL API (JSON)**: https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/registro-de-desfibriladores-externos-semiautomaticos-desa-en-vehiculos-de-transp/records?limit=100
- **Campos**: número de serie, empresa, provincia, localidad
- **Prioridad**: MEDIA - son vehículos, no ubicaciones fijas

### 3. Cataluña

- **Portal**: Dades Obertes Generalitat de Catalunya
- **Dataset**: Registro de desfibriladores instalados en Cataluña fuera del ámbito sanitario
- **Catálogo nacional**: https://datos.gob.es/en/catalogo/a09002970-registro-de-desfibriladores-instalados-en-cataluna-fuera-del-ambito-sanitario
- **Portal Generalitat**: https://web.gencat.cat/en/generalitat/dades-indicadors/dades-obertes
- **Formatos disponibles**: CSV, JSON, GeoJSON, KML, SHP, XML, RDF
- **Registro obligatorio**: https://web.gencat.cat/en/tramits/tramits-temes/Inscripcio-en-el-Registre-dels-DEA
- **Prioridad**: ALTA - registro oficial obligatorio, múltiples formatos

### 4. Euskadi / País Vasco

- **Portal**: Open Data Euskadi
- **Dataset**: Desfibriladores Externos Automatizados de Euskadi
- **Catálogo nacional**: https://datos.gob.es/en/catalogo/a16003011-desfibriladores-externos-automatizados-de-euskadi1
- **Portal Euskadi**: https://opendata.euskadi.eus/
- **Descripción**: Registro Vasco de DEAs gestionado por el Departamento de Salud del Gobierno Vasco
- **Prioridad**: ALTA - registro oficial completo de la CAPV

### 5. Castellón (Diputación Provincial)

- **Dataset**: Listado de desfibriladores - Programa "Castellón territorio cardioprotegido"
- **Catálogo nacional**: https://datos.gob.es/en/catalogo/l02000012-listado-de-desfibriladores
- **Descripción**: Listado geolocalizado de DESA instalados en municipios de la provincia de Castellón
- **Prioridad**: MEDIA - ámbito provincial, pero con geolocalización

### 6. Sant Boi de Llobregat (Barcelona)

- **Dataset**: Desfibriladores públicos
- **Catálogo nacional**: https://datos.gob.es/en/catalogo/l01082009-desfibriladores-publicos
- **Prioridad**: BAJA - ámbito municipal

---

## Fuente complementaria: OpenStreetMap

### OpenStreetMap (datos colaborativos mundiales)

- **Tag**: `emergency=defibrillator`
- **Mapa dedicado**: https://openaedmap.org/
- **Consulta Overpass API** (todos los DEA en España):

```
[out:json][timeout:300];
area["name"="España"]["admin_level"="2"]->.searchArea;
(
  node["emergency"="defibrillator"](area.searchArea);
  way["emergency"="defibrillator"](area.searchArea);
);
out body;
>;
out skel qt;
```

- **Endpoint**: `https://overpass-api.de/api/interpreter`
- **Herramienta interactiva**: https://overpass-turbo.eu/
- **Formatos de exportación**: JSON (nativo), GeoJSON, KML, GPX
- **Campos disponibles**: lat, lon, operator, opening_hours, indoor, level, description, phone, website, access, defibrillator:location
- **Licencia**: ODbL (Open Database License)
- **Prioridad**: ALTA - cobertura global, datos geolocalizados, API gratuita, buena complementación con datos oficiales

---

## CCAA sin datos abiertos confirmados

Para las siguientes comunidades autónomas NO se han encontrado datasets públicos de DEAs en portales de datos abiertos. Esto no significa que no existan registros internos (la mayoría tienen registros obligatorios por ley), sino que no los publican como open data:

| Comunidad Autónoma   | Portal datos abiertos      | Registro DEA obligatorio | Normativa        |
| -------------------- | -------------------------- | ------------------------ | ---------------- |
| Andalucía            | datos.juntadeandalucia.es  | Sí                       | Decreto 22/2012  |
| Aragón               | opendata.aragon.es         | Sí                       | Decreto 30/2019  |
| Asturias             | -                          | Sí                       | -                |
| Baleares             | -                          | Sí                       | Decreto 137/2008 |
| Canarias             | datos.canarias.es          | Sí                       | -                |
| Cantabria            | -                          | Sí                       | -                |
| Castilla-La Mancha   | -                          | Sí                       | -                |
| Comunidad Valenciana | dadesobertes.gva.es        | Sí (con geolocalización) | Decreto 159/2017 |
| Extremadura          | -                          | Sí                       | -                |
| Galicia              | abertos.xunta.gal          | Sí                       | -                |
| La Rioja             | -                          | Sí                       | Decreto 8/2019   |
| Murcia               | -                          | Sí                       | -                |
| Navarra              | gobiernoabierto.navarra.es | Sí                       | -                |

**Nota sobre Comunidad Valenciana**: El Decreto 159/2017 obliga a registrar DEAs incluyendo coordenadas de geolocalización. El registro existe en la GVA pero no se ha localizado como dataset público descargable. Podría ser interesante solicitarlo vía petición de datos abiertos.

---

## Estrategia de importación recomendada

### Fase 1 - Fuentes directas (CSV/JSON descargables)

1. **Comunidad de Madrid** - CSV directo
2. **Castilla y León** - API REST JSON (OpenDataSoft)
3. **Cataluña** - Múltiples formatos vía Dades Obertes
4. **Euskadi** - Open Data Euskadi

### Fase 2 - Complementar con OpenStreetMap

5. **OpenStreetMap vía Overpass API** - Cubrir el resto de España y cruzar datos con registros oficiales

### Fase 3 - Fuentes adicionales

6. **Castellón** - Dataset provincial
7. **Solicitar datos abiertos** a CCAA con registros obligatorios pero sin publicación (especialmente Comunidad Valenciana y Andalucía)

### Campos mínimos para importación

| Campo         | Descripción                                 | Obligatorio |
| ------------- | ------------------------------------------- | ----------- |
| latitude      | Latitud GPS                                 | Sí          |
| longitude     | Longitud GPS                                | Sí          |
| address       | Dirección completa                          | Sí          |
| city          | Municipio                                   | Sí          |
| province      | Provincia                                   | No          |
| region        | Comunidad autónoma                          | Sí          |
| location_name | Nombre del lugar/edificio                   | No          |
| location_type | Tipo de espacio (público, privado, etc.)    | No          |
| access        | Accesibilidad (24h, horario limitado, etc.) | No          |
| source        | Fuente de datos original                    | Sí          |
| source_url    | URL de la fuente                            | Sí          |
| source_id     | ID en la fuente original                    | No          |
| last_verified | Fecha de última verificación                | No          |

---

## Referencias normativas

- **Real Decreto 365/2009** - Condiciones y requisitos mínimos para DEA/DESA fuera del ámbito sanitario (ámbito estatal)
- Cada CCAA tiene su propia normativa que complementa el RD estatal

## Documento relacionado

- **[Fuentes de datos abiertos de DEA en Europa](./open-data-sources-aed-europe.md)** - Investigación ampliada con fuentes de toda Europa

## Enlaces útiles

- Portal nacional datos abiertos: https://datos.gob.es
- OpenAEDMap: https://openaedmap.org/
- Overpass Turbo: https://overpass-turbo.eu/
- Legislación por CCAA: https://www.cardioprotegidos.es/legislacion-ccaa
