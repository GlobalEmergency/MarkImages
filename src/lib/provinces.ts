/**
 * Spanish provinces with INE codes and metadata.
 * The INE code is the first 2 digits of `city_code` in AedLocation.
 */

export interface Province {
  name: string;
  slug: string;
  ineCode: string;
  community: string;
}

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export const PROVINCES: Province[] = [
  { name: "A Coruña", ineCode: "15", community: "Galicia" },
  { name: "Álava", ineCode: "01", community: "País Vasco" },
  { name: "Albacete", ineCode: "02", community: "Castilla-La Mancha" },
  { name: "Alicante", ineCode: "03", community: "Comunitat Valenciana" },
  { name: "Almería", ineCode: "04", community: "Andalucía" },
  { name: "Asturias", ineCode: "33", community: "Asturias" },
  { name: "Ávila", ineCode: "05", community: "Castilla y León" },
  { name: "Badajoz", ineCode: "06", community: "Extremadura" },
  { name: "Barcelona", ineCode: "08", community: "Cataluña" },
  { name: "Bizkaia", ineCode: "48", community: "País Vasco" },
  { name: "Burgos", ineCode: "09", community: "Castilla y León" },
  { name: "Cáceres", ineCode: "10", community: "Extremadura" },
  { name: "Cádiz", ineCode: "11", community: "Andalucía" },
  { name: "Cantabria", ineCode: "39", community: "Cantabria" },
  { name: "Castellón", ineCode: "12", community: "Comunitat Valenciana" },
  { name: "Ceuta", ineCode: "51", community: "Ceuta" },
  { name: "Ciudad Real", ineCode: "13", community: "Castilla-La Mancha" },
  { name: "Córdoba", ineCode: "14", community: "Andalucía" },
  { name: "Cuenca", ineCode: "16", community: "Castilla-La Mancha" },
  { name: "Gipuzkoa", ineCode: "20", community: "País Vasco" },
  { name: "Girona", ineCode: "17", community: "Cataluña" },
  { name: "Granada", ineCode: "18", community: "Andalucía" },
  { name: "Guadalajara", ineCode: "19", community: "Castilla-La Mancha" },
  { name: "Huelva", ineCode: "21", community: "Andalucía" },
  { name: "Huesca", ineCode: "22", community: "Aragón" },
  { name: "Illes Balears", ineCode: "07", community: "Illes Balears" },
  { name: "Jaén", ineCode: "23", community: "Andalucía" },
  { name: "La Rioja", ineCode: "26", community: "La Rioja" },
  { name: "Las Palmas", ineCode: "35", community: "Canarias" },
  { name: "León", ineCode: "24", community: "Castilla y León" },
  { name: "Lleida", ineCode: "25", community: "Cataluña" },
  { name: "Lugo", ineCode: "27", community: "Galicia" },
  { name: "Madrid", ineCode: "28", community: "Comunidad de Madrid" },
  { name: "Málaga", ineCode: "29", community: "Andalucía" },
  { name: "Melilla", ineCode: "52", community: "Melilla" },
  { name: "Murcia", ineCode: "30", community: "Región de Murcia" },
  { name: "Navarra", ineCode: "31", community: "Navarra" },
  { name: "Ourense", ineCode: "32", community: "Galicia" },
  { name: "Palencia", ineCode: "34", community: "Castilla y León" },
  { name: "Pontevedra", ineCode: "36", community: "Galicia" },
  { name: "Salamanca", ineCode: "37", community: "Castilla y León" },
  { name: "Santa Cruz de Tenerife", ineCode: "38", community: "Canarias" },
  { name: "Segovia", ineCode: "40", community: "Castilla y León" },
  { name: "Sevilla", ineCode: "41", community: "Andalucía" },
  { name: "Soria", ineCode: "42", community: "Castilla y León" },
  { name: "Tarragona", ineCode: "43", community: "Cataluña" },
  { name: "Teruel", ineCode: "44", community: "Aragón" },
  { name: "Toledo", ineCode: "45", community: "Castilla-La Mancha" },
  { name: "Valencia", ineCode: "46", community: "Comunitat Valenciana" },
  { name: "Valladolid", ineCode: "47", community: "Castilla y León" },
  { name: "Zamora", ineCode: "49", community: "Castilla y León" },
  { name: "Zaragoza", ineCode: "50", community: "Aragón" },
].map((p) => ({ ...p, slug: toSlug(p.name) }));

export const PROVINCE_BY_SLUG = new Map(PROVINCES.map((p) => [p.slug, p]));
export const PROVINCE_BY_INE = new Map(PROVINCES.map((p) => [p.ineCode, p]));
