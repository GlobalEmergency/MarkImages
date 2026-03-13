# Fuentes de datos abiertos de DEA en Europa

Documento de investigación: fuentes públicas de datos sobre Desfibriladores Externos Automatizados (DEA/AED) en Europa, organizadas por país y por iniciativas paneuropeas.

Fecha de investigación: 2026-03-12

---

## Resumen

No existe un registro europeo unificado de DEAs. Cada país (y en algunos casos, cada región) gestiona sus propios registros. La situación varía enormemente:

- **Países con datos abiertos descargables**: Francia (mejor ejemplo), Suiza, Eslovenia, Austria (Viena), Italia (Emilia-Romaña), Bélgica (Bruselas), España (varias CCAA)
- **Países con registros avanzados pero no abiertos**: Reino Unido, Países Bajos, Dinamarca, Suecia
- **Fuente paneuropea abierta**: OpenStreetMap (vía Overpass API) es la única fuente verdaderamente abierta con cobertura continental

El estándar de datos más completo es el **schema-dae** francés, publicado en GitHub y datos.gouv.fr.

---

## 1. Iniciativas paneuropeas e internacionales

### 1.1 OpenStreetMap (`emergency=defibrillator`)

- **Alcance**: Mundial, con fuerte cobertura europea
- **Tag**: `emergency=defibrillator`
- **Mapa dedicado**: https://openaedmap.org/
- **Taginfo global**: https://taginfo.openstreetmap.org/tags/emergency=defibrillator
- **Overpass API endpoint**: `https://overpass-api.de/api/interpreter`
- **Overpass Turbo (visual)**: https://overpass-turbo.eu/
- **Formatos**: JSON, GeoJSON, KML, GPX (vía Overpass)
- **Geolocalización**: Sí (lat/lon en cada nodo)
- **Registros estimados**: 100.000+ a nivel mundial
- **Licencia**: ODbL (Open Database License)
- **Tags disponibles**: `defibrillator:location`, `opening_hours`, `indoor`, `access`, `operator`, `phone`, `description`, `ref:GB:the_circuit`
- **Prioridad**: ALTA - única fuente paneuropea abierta y consistente

**Consulta Overpass genérica por país** (cambiar código ISO):

```
[out:json][timeout:300];
area["ISO3166-1"="ES"]->.searchArea;
(
  node["emergency"="defibrillator"](area.searchArea);
  way["emergency"="defibrillator"](area.searchArea);
);
out center;
```

### 1.2 OpenAEDMap

- **Organización**: Comunidad OpenStreetMap Polonia
- **URL**: https://openaedmap.org/
- **GitHub**: https://github.com/openstreetmap-polska/openaedmap-frontend
- **Funcionalidad**: Visualización mundial de DEAs sobre OSM, permite añadir nuevos DEAs directamente
- **Apps**: iOS y Android
- **Licencia**: ODbL (datos OSM)
- **Prioridad**: ALTA - principal herramienta de visualización mundial de DEAs

### 1.3 MapComplete - Tema Desfibriladores

- **URL**: https://mapcomplete.org/aed
- **Funcionalidad**: Mapa interactivo OSM para buscar y añadir desfibriladores
- **Multiidioma**: Sí
- **Licencia**: ODbL

### 1.4 EENA - Iniciativa AED Mapping

- **Organización**: European Emergency Number Association
- **URL**: https://eena.org/our-work/eena-special-focus/aed-mapping/
- **Documento**: https://eena.org/knowledge-hub/documents/aed-mapping-emergency-response-2023-update/
- **Tipo**: Iniciativa de política y coordinación (no dataset directo)
- **Contenido**: Esquema de datos recomendado para registros de DEAs (en apéndice del documento). Aboga por un registro paneuropeo unificado
- **Prioridad**: MEDIA - referencia para esquema de datos, no fuente directa

### 1.5 DEFIBMAP.org / Staying Alive

- **URL**: https://www.defibmap.org/en/
- **Mapa**: https://www.defibmap.org/en/map/index/
- **Organización**: AEDMAP (vinculado a la app Staying Alive)
- **Registros**: ~120.000 DEAs
- **Geolocalización**: Sí
- **Enfoque**: Principalmente Francia, expandiéndose a Europa
- **Licencia**: Datos contribuidos se comparten en data.gouv.fr (para Francia)
- **Prioridad**: MEDIA - cobertura parcial, no totalmente abierto

### 1.6 European Restart a Heart / World Restart a Heart

- **Organización**: European Resuscitation Council (ERC) + ILCOR
- **URL**: https://www.erc.edu/
- **Tipo**: Iniciativa de concienciación y formación en RCP
- **Datos**: NO mantiene registro de ubicaciones de DEAs
- **Relevancia**: Contexto de políticas públicas, no fuente de datos

### 1.7 EuReCa (European Registry of Cardiac Arrest)

- **Tipo**: Registro de resultados de parada cardíaca (no ubicaciones de DEAs)
- **Relevancia**: Complementario para análisis de incidencia de OHCA por país

---

## 2. Fuentes por país

### FRANCIA

- **Portal**: Géo'DAE - Base Nationale des Défibrillateurs
- **URL dataset**: https://www.data.gouv.fr/datasets/geodae-base-nationale-des-defibrillateurs
- **URL alternativa**: https://www.data.gouv.fr/datasets/geodae-base-publique/
- **Portal de declaración**: https://geodae.atlasante.fr/apropos
- **Esquema oficial**: https://schema.data.gouv.fr/atlasante/schema-dae/
- **GitHub del esquema**: https://github.com/Alkante/schema-dae
- **Formatos**: CSV, XLSX
- **Geolocalización**: Sí (lat/lon)
- **Licencia**: Licence Ouverte / Open Licence v2.0
- **Base legal**: Loi du 28 juin 2018; Arrêté du 29 octobre 2019
- **Prioridad**: **MUY ALTA** - Mejor ejemplo nacional de Europa. Declaración legalmente obligatoria. Esquema bien documentado en GitHub

### REINO UNIDO

- **Sistema**: The Circuit (British Heart Foundation)
- **URL datos**: https://www.bhf.org.uk/defibdata
- **Mapa público**: https://www.defibfinder.uk
- **Registro**: https://www.thecircuit.uk
- **Formato**: CSV descargable
- **Geolocalización**: Sí (precisión UPRN vía Ordnance Survey)
- **Registros**: 100.000+ registrados
- **Licencia**: Custom BHF (NO compatible con ODbL/OSM). Permite añadir UUID como `ref:GB:the_circuit=*` en OSM
- **Comparación OSM**: https://osm.mathmos.net/defib/
- **Sincronización**: Cada 60 segundos con despacho de ambulancias
- **Prioridad**: **ALTA** - dataset descargable, pero licencia restrictiva

### ALEMANIA

- **Sistema 1**: Definetz e.V. - Defikataster
- **URL**: http://definetz.online/defikataster-1
- **Formato**: Web service normalizado para despachadores, municipios y desarrolladores
- **Geolocalización**: Sí
- **Licencia**: No abierta; datos compartidos con socios autorizados (Leitstellen, Kommunen, App-Entwickler)
- **Sistema 2**: Björn Steiger Stiftung
- **URL**: https://www.steiger-stiftung.de/was-wir-tun/herzsicher/standorte-aed/
- **Cobertura**: Parcial (DEAs instalados por la fundación)
- **Taginfo OSM**: https://taginfo.geofabrik.de/europe:germany/tags/emergency=defibrillator
- **Prioridad**: MEDIA - No hay datos abiertos gubernamentales. Mejor fuente abierta: OSM

### ITALIA

- **Mejor fuente**: Registro Regionale Unico dei Defibrillatori - Emilia-Romaña
- **URL**: https://www.dati.emilia-romagna.it/dataset/registro-regionale-unico-dei-defibrillatori-dae
- **También en**: https://www.dati.gov.it/ (portal nacional)
- **Bolonia**: https://opendata.comune.bologna.it/explore/dataset/progetto-dae/
- **Formatos**: CSV, GeoJSON, GPX, JSONL, KML
- **Geolocalización**: Sí
- **Licencia**: CC BY 4.0
- **Lazio (ARES 118)**: https://www.ares118.it/dae.html (requiere autenticación SPID/CIE, no es open data)
- **Lecce**: http://dati.comune.lecce.it/dataset/defibrillatori-dae
- **Apps crowdsourced**: Cardiomapp (www.cardiomapp.it), DAE Dove (www.daedove.it)
- **Prioridad**: ALTA (Emilia-Romaña) - Sin dataset nacional unificado. Mejor dato abierto: Emilia-Romaña (CC BY 4.0)

### PAÍSES BAJOS

- **Sistema**: HartslagNu
- **URL**: https://hartslagnu.nl/
- **Mapa de cobertura**: https://hartslagnu-dekking-kaart.stanglobal.com/
- **Formato**: NO es open data. API interna (`/GetAllAeds`) solo para socios autorizados
- **Registros**: 170.000+ voluntarios registrados; número de DEAs no público
- **Geolocalización**: Sí (interno)
- **Licencia**: Propietaria; acceso investigador bajo solicitud
- **GitHub**: https://github.com/openaed (organización OpenAED)
- **Prioridad**: BAJA para importación directa (datos no abiertos). Usar OSM

### BÉLGICA

- **Mejor fuente**: City of Brussels Open Data
- **URL**: https://opendata.brussels.be/explore/dataset/defibrillateurs-installes-par-la-ville-de-bruxelles/
- **Formato**: CSV, JSON, GeoJSON (plataforma Opendatasoft)
- **Geolocalización**: Sí (calidad variable reportada)
- **Licencia**: Open data (licencia regional de Bruselas)
- **Cobertura**: Solo DEAs instalados por la ciudad de Bruselas
- **Prioridad**: MEDIA - cobertura municipal, completar con OSM

### DINAMARCA

- **Sistema**: TrygFonden Hjertestarter / Danish AED Network
- **URL**: https://hjertestarter.dk/english
- **Apps**: TrygFonden Hjertestarter, TrygFonden Hjerteløber (HeartRunner)
- **Registros**: 20.000+ DEAs registrados; 120.000+ HeartRunners
- **Geolocalización**: Sí
- **Open data**: NO descargable públicamente
- **Dataset académico**: https://www.sciencedirect.com/science/article/pii/S2352340919303117 (datos de registro 2007-2016)
- **Licencia**: Propietaria (registro); dataset académico con licencia investigadora
- **Nota**: Primer país europeo con sistema nacional de citizen responders (2020). ~20 DEAs por 10.000 habitantes
- **Prioridad**: BAJA para importación directa (datos no abiertos). Referencia para benchmarking

### SUECIA

- **Sistema**: SAEDREG (Hjärtstartarregistret)
- **URL**: https://www.hjartstartarregistret.se/
- **Gestor**: Swedish CPR Council (HLR-rådet)
- **Registros**: ~15.849 DEAs (dato de 2016, probablemente más ahora)
- **Geolocalización**: Sí (dirección + coordenadas)
- **Open data**: NO descargable. Mapa visible en web. Acceso investigador vía Registerforskning.se
- **Licencia**: Propietaria; acceso bajo solicitud
- **Nota**: Registro voluntario desde 2009. Verificación automática cada 6 meses por email
- **Prioridad**: BAJA para importación directa. Usar OSM

### NORUEGA

- **Sistema**: Participa en EENA AED mapping y tiene sistemas de citizen responders (Heartrunner, originalmente sueco)
- **Open data**: No se ha encontrado portal nacional de datos abiertos para DEAs
- **Prioridad**: BAJA - Usar OSM

### FINLANDIA

- **Sistema**: Participa en iniciativas ERC/EENA. Referenciado en estudio ENSURE (Helsinki University Hospital)
- **Open data**: No se ha encontrado portal nacional de datos abiertos para DEAs
- **Prioridad**: BAJA - Usar OSM

### AUSTRIA

- **Mejor fuente**: Defibrillatoren Standorte Wien (Ciudad de Viena)
- **URL**: https://www.data.gv.at/katalog/en/dataset/stadt-wien_defibrillatorenstandortewien
- **App**: https://www.data.gv.at/katalog/application/defis-in-wien
- **Dataset ampliado**: https://www.data.gv.at/katalog/dataset/defibrillatoren
- **Formato**: Open data vía data.gv.at (CSV/JSON)
- **Geolocalización**: Sí
- **Registros**: 190 DEAs de acceso libre (municipales Viena) + 60 columnas Gewista City Light con desfibrilador
- **Licencia**: CC BY (Austrian Open Government Data)
- **Prioridad**: MEDIA - Viena bien estructurado; otras regiones pueden tener datasets separados en data.gv.at

### SUIZA

- **Sistema**: Defikarte.ch
- **URL web**: https://www.defikarte.ch
- **GitHub datos**: https://github.com/OpenBracketsCH/defi_data
- **GitHub web**: https://github.com/OpenBracketsCH/defikarte.ch
- **GitHub app**: https://github.com/OpenBracketsCH/defikarte.ch-app
- **Formato**: GeoJSON (auto-generado cada hora desde OSM vía Overpass), CSV
- **Geolocalización**: Sí
- **Registros**: 2.400+ (creciendo)
- **Licencia**: ODbL (derivado de OSM)
- **Cobertura**: Suiza y Liechtenstein
- **Prioridad**: **ALTA** - **Excelente modelo de referencia técnica.** Pipeline totalmente open source: GitHub Actions consulta Overpass API diariamente, almacena GeoJSON + CSV. Modelo replicable para otros países

### PORTUGAL

- **Sistema**: PNDAE (Programa Nacional de Desfibrilhação Automática Externa) vía INEM
- **URL**: https://www.inem.pt/2017/05/31/programa-nacional-de-dae/
- **Open data**: NO encontrado en dados.gov.pt
- **Registros**: 2.120 programas DAE licenciados (dato de 2019)
- **Nota**: ~1 DAE por 10.000 habitantes (muy bajo comparado con Dinamarca: 20/10.000)
- **Prioridad**: BAJA - Usar OSM

### ESLOVENIA

- **Portal**: Ministry of Public Administration API (vía Apitalks)
- **URL**: https://api.store/slovenia-api/ministry-of-public-administration-api/defibrillator-locations-aed-api
- **Formato**: REST API (JSON)
- **Geolocalización**: Sí
- **Licencia**: Datos abiertos gubernamentales
- **Prioridad**: **ALTA** - Uno de los pocos países europeos con API dedicada para DEAs

### REPÚBLICA CHECA

- **Sistema**: Záchranká EMS app
- **URL**: https://www.zachrankaapp.cz/en/aed
- **Funcionalidad**: App y portal web con todos los DEAs de acceso público. El despacho 155 puede dirigir llamadas al DEA más cercano
- **Open data**: NO descargable como open data
- **Nota**: No se requiere formación para usar un DEA (legislación)
- **Prioridad**: BAJA - Usar OSM

### IRLANDA

- **Sistema**: National AED Network (National Ambulance Service)
- **URL**: https://www.nationalambulanceservice.ie/aed/
- **Registros**: ~1.800 conocidos por NAS (de un estimado de 9.000-10.000 desplegados)
- **Open data**: NO descargable
- **Esfuerzo OSM**: https://www.openstreetmap.ie/missions/aed-defibrillator-mapping/
- **Irlanda del Norte**: ~2.313 DEAs conocidos por NI Ambulance Service
- **Nota**: Sin legislación que obligue al registro de DEAs
- **Prioridad**: BAJA - Usar OSM (misión activa de mapeo OSM Ireland)

### POLONIA

- **Open data gubernamental**: No existe registro nacional oficial ni requisito legal de notificación
- **Estudio**: https://pmc.ncbi.nlm.nih.gov/articles/PMC9331639/ (1.165 ubicaciones documentadas)
- **Nota**: OpenAEDMap se originó en la comunidad OSM polaca, haciendo crecer los datos de DEAs en Polonia de cientos a miles
- **Prioridad**: BAJA - Usar OSM/OpenAEDMap

### ESPAÑA

Documentado en detalle en [open-data-sources-aed-spain.md](./open-data-sources-aed-spain.md).

**Resumen**: Sin dataset nacional unificado. Datos fragmentados por CCAA y municipio:

- **Con datos abiertos**: Comunidad de Madrid (CSV), Castilla y León (API REST), Cataluña (multi-formato), Euskadi, Castellón, Sant Boi
- **Portal nacional**: https://datos.gob.es (categoría salud)
- **13 CCAA** con registros obligatorios pero sin datos abiertos publicados

---

## 3. Estándares de datos

### 3.1 Schema-DAE francés (mejor estándar disponible)

- **URL**: https://schema.data.gouv.fr/atlasante/schema-dae/
- **GitHub**: https://github.com/Alkante/schema-dae
- **Descripción**: Esquema CSV más completo y mejor documentado de Europa para datos de DEAs. Define campos para ubicación, accesibilidad, características técnicas
- **Publicado por**: DGS (Direction Générale de la Santé)
- **Relevancia**: Podría servir como modelo para los mappings de importación de DeaMap

### 3.2 Estructura recomendada EENA

- **Documento**: https://eena.org/knowledge-hub/documents/aed-mapping-emergency-response-2023-update/
- **Contenido**: Apéndice con esquema de datos recomendado para registros de DEAs

### 3.3 Estándar Hinterzarten (Resuscitation Journal)

- **URL**: https://www.resuscitationjournal.com/article/S0300-9572(23)00823-7/fulltext
- **Descripción**: Estándar de reporting consensuado para sistemas de first responders, alertas por smartphone y redes de DEAs
- **Autores**: 40 investigadores de 13 países
- **Elementos**: Define elementos de datos core y suplementarios

### 3.4 Situación actual

**No existe un estándar oficial de la UE** para intercambio de datos de DEAs. El European Health Data Space (EHDS) y la iniciativa EURIDICE cubren interoperabilidad de datos de salud pero no abordan específicamente registros de DEAs.

---

## 4. Tabla resumen de accesibilidad por país

| País                       | Fuente                    | Descarga abierta |        API        | Geoloc. | Licencia          |  Prioridad   |
| -------------------------- | ------------------------- | :--------------: | :---------------: | :-----: | ----------------- | :----------: |
| **Francia**                | Géo'DAE                   |        SI        |        SI         |   SI    | Open Licence v2.0 |   MUY ALTA   |
| **Suiza**                  | Defikarte.ch/OSM          |        SI        |    SI (GitHub)    |   SI    | ODbL              |     ALTA     |
| **Eslovenia**              | Gov API                   |        SI        |        SI         |   SI    | Gov open data     |     ALTA     |
| **Reino Unido**            | The Circuit/BHF           |        SI        |        No         |   SI    | Custom BHF        |     ALTA     |
| **Italia (Emilia-Romaña)** | Registro regional         |        SI        |        SI         |   SI    | CC BY 4.0         |     ALTA     |
| **Austria (Viena)**        | data.gv.at                |        SI        |     Probable      |   SI    | CC BY             |    MEDIA     |
| **Bélgica (Bruselas)**     | opendata.brussels         |        SI        |        SI         |   SI    | Open data         |    MEDIA     |
| **España (CCAA)**          | datos.gob.es + regionales |        SI        |      Parcial      |   SI    | Open data         |     ALTA     |
| **Dinamarca**              | Hjertestarter.dk          |        No        |        No         |   SI    | Propietaria       |     BAJA     |
| **Suecia**                 | SAEDREG                   |        No        |        No         |   SI    | Propietaria       |     BAJA     |
| **Países Bajos**           | HartslagNu                |        No        |   No (interno)    |   SI    | Propietaria       |     BAJA     |
| **Alemania**               | Definetz Defikataster     |     Parcial      |      Parcial      |   SI    | Restringida       |     BAJA     |
| **Irlanda**                | NAS AED Network           |        No        |        No         |   SI    | N/A               |     BAJA     |
| **Portugal**               | INEM PNDAE                |        No        |        No         |   SI    | N/A               |     BAJA     |
| **Rep. Checa**             | Záchranká                 |        No        |        No         |   SI    | N/A               |     BAJA     |
| **Polonia**                | -                         |        No        |        No         |    -    | N/A               |     BAJA     |
| **Noruega**                | -                         |        No        |        No         |    -    | N/A               |     BAJA     |
| **Finlandia**              | -                         |        No        |        No         |    -    | N/A               |     BAJA     |
| **Toda Europa**            | **OpenStreetMap**         |      **SI**      | **SI (Overpass)** | **SI**  | **ODbL**          | **MUY ALTA** |

---

## 5. Estrategia de importación recomendada (Europa)

### Fase 1 - Fuentes nacionales con datos abiertos directos

1. **España** - CCAA con datos abiertos (ver documento específico)
2. **Francia** - Géo'DAE (CSV, mejor esquema de referencia)
3. **Italia** - Emilia-Romaña (CC BY 4.0, multi-formato)
4. **Suiza** - Defikarte.ch (GeoJSON/CSV vía GitHub)
5. **Eslovenia** - API REST gubernamental
6. **Austria (Viena)** - data.gv.at

### Fase 2 - OpenStreetMap para cobertura continental

7. **OSM vía Overpass API** - Consultas por país/región para cubrir toda Europa
   - Pipeline de referencia: Defikarte.ch (GitHub Actions + Overpass -> GeoJSON -> CSV)
   - Deduplicación contra fuentes oficiales ya importadas

### Fase 3 - Fuentes con licencia restrictiva

8. **Reino Unido** - The Circuit (evaluar compatibilidad de licencia BHF)
9. **Bélgica** - Brussels open data (cobertura municipal)

### Fase 4 - Solicitudes de datos y acuerdos

10. **Países Bajos** - Solicitar acceso a HartslagNu
11. **Dinamarca** - Solicitar acceso a Hjertestarter
12. **Alemania** - Contactar Definetz e.V. para acceso al Defikataster

### Campos mínimos para importación (Europa)

| Campo         | Descripción                                 | Obligatorio |
| ------------- | ------------------------------------------- | ----------- |
| latitude      | Latitud GPS                                 | Sí          |
| longitude     | Longitud GPS                                | Sí          |
| address       | Dirección completa                          | Sí          |
| city          | Municipio                                   | Sí          |
| postal_code   | Código postal                               | No          |
| province      | Provincia/estado/departamento               | No          |
| region        | Comunidad autónoma / región                 | No          |
| country       | País (código ISO 3166-1 alpha-2)            | Sí          |
| location_name | Nombre del lugar/edificio                   | No          |
| location_type | Tipo de espacio (público, privado, etc.)    | No          |
| access        | Accesibilidad (24h, horario limitado, etc.) | No          |
| indoor        | Interior/exterior                           | No          |
| opening_hours | Horario de acceso (formato OSM)             | No          |
| operator      | Entidad gestora                             | No          |
| source        | Fuente de datos original                    | Sí          |
| source_url    | URL de la fuente                            | Sí          |
| source_id     | ID en la fuente original                    | No          |
| last_verified | Fecha de última verificación                | No          |

**Nota**: Respecto al documento de España, se añaden `country`, `postal_code`, `indoor`, `opening_hours` y `operator` como campos relevantes a nivel europeo.

---

## 6. Referencias

### Estudios e informes

- **ENSURE Study** (heterogeneidad legislativa europea): https://www.mdpi.com/2077-0383/10/21/5018
- **Hinterzarten Reporting Standard**: https://www.resuscitationjournal.com/article/S0300-9572(23)00823-7/fulltext
- **ERC Guidelines 2025**: https://www.resuscitationjournal.com/article/S0300-9572(25)00333-8/fulltext
- **Danish AED registration data 2007-2016**: https://www.sciencedirect.com/science/article/pii/S2352340919303117
- **Poland AED network study**: https://pmc.ncbi.nlm.nih.gov/articles/PMC9331639/
- **Sweden SAEDREG publication**: https://pubmed.ncbi.nlm.nih.gov/30017862/

### Herramientas y APIs

- OpenAEDMap: https://openaedmap.org/
- Overpass Turbo: https://overpass-turbo.eu/
- OSM Taginfo: https://taginfo.openstreetmap.org/tags/emergency=defibrillator
- UK OSM Defibrillator Comparison: https://osm.mathmos.net/defib/

### Esquemas de datos

- French Schema-DAE: https://github.com/Alkante/schema-dae
- EENA AED Mapping: https://eena.org/our-work/eena-special-focus/aed-mapping/

### Portales de datos por país

- Francia: https://www.data.gouv.fr/datasets/geodae-base-nationale-des-defibrillateurs
- Italia (Emilia-Romaña): https://www.dati.emilia-romagna.it/dataset/registro-regionale-unico-dei-defibrillatori-dae
- Austria (Viena): https://www.data.gv.at/katalog/en/dataset/stadt-wien_defibrillatorenstandortewien
- Suiza: https://github.com/OpenBracketsCH/defi_data
- Eslovenia: https://api.store/slovenia-api/ministry-of-public-administration-api/defibrillator-locations-aed-api
- Bélgica (Bruselas): https://opendata.brussels.be/explore/dataset/defibrillateurs-installes-par-la-ville-de-bruxelles/
- Reino Unido: https://www.bhf.org.uk/defibdata
- España: https://datos.gob.es (ver documento específico)
