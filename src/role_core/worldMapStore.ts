import { ref, type Ref } from "vue";
import type { WorldLocation } from "./types/worldLocation";
import { formatWorldLocationDash } from "./types/worldLocation";

export type LocationTree = Record<string, Record<string, Record<string, string[]>>>;
export type LocationNpcMap = Record<string, string[]>;

export interface WorldMapSerialData {
  locationTree: LocationTree;
  locationNpcMap: LocationNpcMap;
}

export function useWorldMapStore() {
  const locationTree = ref<LocationTree>({});
  const locationNpcMap = ref<LocationNpcMap>({});

  function addLocation(loc: WorldLocation, npcNames: string[]): void {
    const { region, country, area, detail } = loc;
    if (!region) return;

    const tree = locationTree.value;
    if (!tree[region]) tree[region] = {};
    if (country) {
      if (!tree[region][country]) tree[region][country] = {};
      if (area) {
        if (!tree[region][country][area]) tree[region][country][area] = [];
        if (detail && !tree[region][country][area].includes(detail)) {
          tree[region][country][area].push(detail);
        }
      }
    }

    const key = formatWorldLocationDash(loc);
    if (key) {
      locationNpcMap.value[key] = [...npcNames];
    }
  }

  function getRegions(): string[] {
    return Object.keys(locationTree.value);
  }

  function getCountries(region: string): string[] {
    return Object.keys(locationTree.value[region] ?? {});
  }

  function getAreas(region: string, country: string): string[] {
    return Object.keys(locationTree.value[region]?.[country] ?? {});
  }

  function getDetails(region: string, country: string, area: string): string[] {
    return locationTree.value[region]?.[country]?.[area] ?? [];
  }

  function getNpcNamesAt(loc: WorldLocation): string[] {
    const key = formatWorldLocationDash(loc);
    return locationNpcMap.value[key] ?? [];
  }

  function serializeWorldMap(): WorldMapSerialData {
    return {
      locationTree: JSON.parse(JSON.stringify(locationTree.value)),
      locationNpcMap: JSON.parse(JSON.stringify(locationNpcMap.value)),
    };
  }

  function restoreWorldMap(data: WorldMapSerialData | null | undefined): void {
    locationTree.value = data?.locationTree ? JSON.parse(JSON.stringify(data.locationTree)) : {};
    locationNpcMap.value = data?.locationNpcMap ? JSON.parse(JSON.stringify(data.locationNpcMap)) : {};
  }

  function clearWorldMap(): void {
    locationTree.value = {};
    locationNpcMap.value = {};
  }

  return {
    locationTree,
    locationNpcMap,
    addLocation,
    getRegions,
    getCountries,
    getAreas,
    getDetails,
    getNpcNamesAt,
    serializeWorldMap,
    restoreWorldMap,
    clearWorldMap,
  };
}

export const worldMapStore = useWorldMapStore();
