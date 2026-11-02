/**
 * Bangladesh Districts and Thanas (Upazilas) - cascading dropdown data.
 * Source: bd-district-and-thana-json (GitHub)
 */

import bdData from './bd-districts-thanas.json';

export interface BDThana {
  english_name: string;
  bangla_name: string;
}

export interface BDDistrict {
  districtEn: string;
  districtBn: string;
  thana: BDThana[];
}

const typed = bdData as { districts: BDDistrict[] };

export const BD_DISTRICTS: BDDistrict[] = typed.districts ?? [];

/** District names for dropdown (English). */
export function getDistrictNames(): string[] {
  return BD_DISTRICTS.map((d) => d.districtEn);
}

/** Thana names (English) for a selected district. */
export function getThanaNamesForDistrict(districtEn: string): string[] {
  const district = BD_DISTRICTS.find(
    (d) => d.districtEn.toLowerCase() === districtEn.toLowerCase()
  );
  return district?.thana?.map((t) => t.english_name) ?? [];
}
