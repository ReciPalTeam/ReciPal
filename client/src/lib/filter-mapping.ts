export const FILTER_TO_FATSECRET: Record<string, string> = {
  'Breakfast': 'breakfast',
  'Lunch': 'lunch',
  'Dinner': 'dinner',
  'Dessert': 'dessert',
  'Snacks': 'snacks',
  'Snackitizers': 'snacks',

  'American': 'american food',
  'Italian': 'italian',
  'Mexican': 'mexican',
  'Asian': 'asian',
  'Mediterranean': 'mediterranean',
  'Indian': 'indian',
  'Middle Eastern': 'middle eastern',
  'Caribbean': 'caribbean',
  'Southern / Comfort Food': 'comfort food',
  'BBQ / Grill': 'bbq grilled',
  'Healthy / Light': 'healthy light',
  'Breakfast / Brunch': 'breakfast brunch',
  'Desserts / Baking': 'dessert baking',
};

export function getFilterQuery(mealTypes: string[], cuisines: string[]): string {
  const queries: string[] = [];
  
  for (const mealType of mealTypes) {
    const mapped = FILTER_TO_FATSECRET[mealType];
    if (mapped) queries.push(mapped);
  }
  
  for (const cuisine of cuisines) {
    const mapped = FILTER_TO_FATSECRET[cuisine];
    if (mapped) queries.push(mapped);
  }
  
  if (queries.length === 0) return '';
  
  if (queries.length === 1) return queries[0];
  
  return queries.slice(0, 2).join(' ');
}
