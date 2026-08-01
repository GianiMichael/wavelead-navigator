/**
 * Default Google Places keyword for each industry vertical.
 *
 * Industry drives Step 3 title-tier matching; business type is the literal
 * Places query. Selecting an industry pre-fills a sensible search term the
 * user can still edit freely.
 */
export const DEFAULT_BUSINESS_TYPE: Record<string, string> = {
  manufacturing: "manufacturing plant",
  healthcare: "hospital",
  grocery: "grocery store",
  hospitality: "hotel",
  restaurants: "restaurant",
  education: "school district office",
  car_wash: "car wash",
  cold_storage: "cold storage warehouse",
  multi_site_retail: "retail chain store",
  data_center: "data center",
  default: "commercial facility",
};

export function defaultBusinessType(industryKey: string): string {
  return DEFAULT_BUSINESS_TYPE[industryKey] ?? DEFAULT_BUSINESS_TYPE.default!;
}
