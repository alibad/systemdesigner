type Capability = 'fullText' | 'phrase' | 'exact' | 'range' | 'sort' | 'retrieve';

type FieldContract = {
  field: string;
  required: Capability[];
};

type LuceneFieldRecipe = {
  name: string;
  APIs: string[];
  capabilities: Capability[];
};

function validateFieldContract(contract: FieldContract, recipe: LuceneFieldRecipe) {
  const missing = contract.required.filter(
    (capability) => !recipe.capabilities.includes(capability),
  );

  return {
    field: contract.field,
    recipe: recipe.name,
    accepted: missing.length === 0,
    missing,
    APIs: recipe.APIs,
  };
}

const sortableTitle: FieldContract = {
  field: 'title',
  required: ['fullText', 'phrase', 'sort', 'retrieve'],
};

const textOnly: LuceneFieldRecipe = {
  name: 'TextField, stored',
  APIs: ['new TextField("title", value, Field.Store.YES)'],
  capabilities: ['fullText', 'phrase', 'retrieve'],
};

const textAndSortKey: LuceneFieldRecipe = {
  name: 'TextField plus SortedDocValuesField',
  APIs: [
    'new TextField("title", value, Field.Store.YES)',
    'new SortedDocValuesField("title_sort", normalizedValue)',
  ],
  capabilities: ['fullText', 'phrase', 'sort', 'retrieve'],
};

const rejected = validateFieldContract(sortableTitle, textOnly);
const accepted = validateFieldContract(sortableTitle, textAndSortKey);

if (rejected.accepted || !rejected.missing.includes('sort')) {
  throw new Error('The validator must reject a title with no sort path.');
}

if (!accepted.accepted) {
  throw new Error(`Expected a complete field contract, missing: ${accepted.missing.join(', ')}`);
}

console.log(JSON.stringify({ rejected, accepted }, null, 2));
