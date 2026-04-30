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
  { name: "A CoruÃ±a", ineCode: "15", community: "Galicia" },
  { name: "Ãlava", ineCode: "01", community: "PaÃ­s Vasco" },
  { name: "Albacete", ineCode: "02", community: "Castilla-La Mancha" },
  { name: "Alicante", ineCode: "03", community: "Comunitat Valenciana" },
  { name: "AlmerÃ­a", ineCode: "04", community: "AndalucÃ­a" },
  { name: "Asturias", ineCode: "33", community: "Asturias" },
  { name: "Ãvila", ineCode: "05", community: "Castilla y LeÃ³n" },
  { name: "Badajoz", ineCode: "06", community: "Extremadura" },
  { name: "Barcelona", ineCode: "08", community: "CataluÃ±a" },
  { name: "Bizkaia", ineCode: "48", community: "PaÃ­s Vasco" },
  { name: "Burgos", ineCode: "09", community: "Castilla y LeÃ³n" },
  { name: "CÃ¡ceres", ineCode: "10", community: "Extremadura" },
  { name: "CÃ¡diz", ineCode: "11", community: "AndalucÃ­a" },
  { name: "Cantabria", ineCode: "39", community: "Cantabria" },
  { name: "CastellÃ³n", ineCode: "12", community: "Comunitat Valenciana" },
  { name: "Ceuta", ineCode: "51", community: "Ceuta" },
  { name: "Ciudad Real", ineCode: "13", community: "Castilla-La Mancha" },
  { name: "CÃ³rdoba", ineCode: "14", community: "AndalucÃ­a" },
  { name: "Cuenca", ineCode: "16", community: "Castilla-La Mancha" },
  { name: "Gipuzkoa", ineCode: "20", community: "PaÃ­s Vasco" },
  { name: "Girona", ineCode: "17", community: "CataluÃ±a" },
  { name: "Granada", ineCode: "18", community: "AndalucÃ­a" },
  { name: "Guadalajara", ineCode: "19", community: "Castilla-La Mancha" },
  { name: "Huelva", ineCode: "21", community: "AndalucÃ­a" },
  { name: "Huesca", ineCode: "22", community: "AragÃ³n" },
  { name: "Illes Balears", ineCode: "07", community: "Illes Balears" },
  { name: "JaÃ©n", ineCode: "23", community: "AndalucÃ­a" },
  { name: "La Rioja", ineCode: "26", community: "La Rioja" },
  { name: "Las Palmas", ineCode: "35", community: "Canarias" },
  { name: "LeÃ³n", ineCode: "24", community: "Castilla y LeÃ³n" },
  { name: "Lleida", ineCode: "25", community: "CataluÃ±a" },
  { name: "Lugo", ineCode: "27", community: "Galicia" },
  { name: "Madrid", ineCode: "28", community: "Comunidad de Madrid" },
  { name: "MÃ¡laga", ineCode: "29", community: "AndalucÃ­a" },
  { name: "Melilla", ineCode: "52", community: "Melilla" },
  { name: "Murcia", ineCode: "30", community: "RegiÃ³n de Murcia" },
  { name: "Navarra", ineCode: "31", community: "Navarra" },
  { name: "Ourense", ineCode: "32", community: "Galicia" },
  { name: "Palencia", ineCode: "34", community: "Castilla y LeÃ³n" },
  { name: "Pontevedra", ineCode: "36", community: "Galicia" },
  { name: "Salamanca", ineCode: "37", community: "Castilla y LeÃ³n" },
  { name: "Santa Cruz de Tenerife", ineCode: "38", community: "Canarias" },
  { name: "Segovia", ineCode: "40", community: "Castilla y LeÃ³n" },
  { name: "Sevilla", ineCode: "41", community: "AndalucÃ­a" },
  { name: "Soria", ineCode: "42", community: "Castilla y LeÃ³n" },
  { name: "Tarragona", ineCode: "43", community: "CataluÃ±a" },
  { name: "Teruel", ineCode: "44", community: "AragÃ³n" },
  { name: "Toledo", ineCode: "45", community: "Castilla-La Mancha" },
  { name: "Valencia", ineCode: "46", community: "Comunitat Valenciana" },
  { name: "Valladolid", ineCode: "47", community: "Castilla y LeÃ³n" },
  { name: "Zamora", ineCode: "49", community: "Castilla y LeÃ³n" },
  { name: "Zaragoza", ineCode: "50", community: "AragÃ³n" },
].map((p) => ({ ...p, slug: toSlug(p.name) }));

export const PROVINCE_BY_SLUG = new Map(PROVINCES.map((p) => [p.slug, p]));
export const PROVINCE_BY_INE = new Map(PROVINCES.map((p) => [p.ineCode, p]));
