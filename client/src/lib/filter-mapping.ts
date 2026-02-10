export const FILTER_TO_FATSECRET: Record<string, string> = {
  'Breakfast': 'breakfast',
  'Lunch': 'lunch',
  'Dinner': 'dinner',
  'Dessert': 'dessert',
  'Snacks': 'snacks',
  'Snackitizers': 'snacks',

  'American': 'american food',
  'Southern / Comfort Food': 'comfort food southern',
  'Soul Food': 'soul food',
  'Barbecue (BBQ)': 'bbq barbecue grilled',
  'Cajun': 'cajun food',
  'Creole': 'creole food',
  'Tex-Mex': 'tex mex food',
  'Diner / Classic American': 'classic american diner',
  'Hawaiian': 'hawaiian food',

  'Mexican': 'mexican food',
  'Italian': 'italian food',

  'Latin American': 'latin american food',
  'Brazilian': 'brazilian food',
  'Puerto Rican': 'puerto rican food',
  'Peruvian': 'peruvian food',
  'Cuban': 'cuban food',
  'Colombian': 'colombian food',
  'Venezuelan': 'venezuelan food',
  'Chilean': 'chilean food',
  'Ecuadorian': 'ecuadorian food',
  'Bolivian': 'bolivian food',
  'Uruguayan': 'uruguayan food',

  'Asian': 'asian food',
  'Chinese': 'chinese food',
  'Japanese': 'japanese food',
  'Korean': 'korean food',
  'Thai': 'thai food',
  'Vietnamese': 'vietnamese food',
  'Filipino': 'filipino food',
  'Indonesian': 'indonesian food',
  'Malaysian': 'malaysian food',
  'Pan-Asian': 'pan asian food',
  'Asian Fusion': 'asian fusion food',

  'French': 'french food',
  'Mediterranean': 'mediterranean food',
  'Indian': 'indian food',
  'Middle Eastern': 'middle eastern food',

  'Caribbean': 'caribbean food',
  'Jamaican': 'jamaican food',
  'Dominican': 'dominican food',
  'Haitian': 'haitian food',
  'Trinidadian': 'trinidadian food',
  'Barbadian': 'barbadian food',
  'Caribbean Fusion': 'caribbean fusion food',

  'African': 'african food',
  'Ethiopian': 'ethiopian food',
  'Moroccan': 'moroccan food',
  'Nigerian': 'nigerian food',
  'Senegalese': 'senegalese food',
  'Egyptian': 'egyptian food',
  'African Fusion': 'african fusion food',
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
