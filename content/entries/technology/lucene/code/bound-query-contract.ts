type SearchRequest =
  | { kind: 'exactSku'; value: string }
  | { kind: 'priceRange'; minimumCents: number; maximumCents: number }
  | { kind: 'humanText'; value: string };

type QueryPlan = {
  API: string;
  field: string;
  guardrails: string[];
};

function buildQueryPlan(request: SearchRequest): QueryPlan {
  switch (request.kind) {
    case 'exactSku': {
      const value = request.value.trim();
      if (!/^[A-Z0-9-]{3,32}$/.test(value)) {
        throw new Error('SKU must use the indexed identifier format.');
      }
      return {
        API: `new TermQuery(new Term("sku", "${value}"))`,
        field: 'sku (StringField)',
        guardrails: ['Normalize at the application boundary', 'Use FILTER when score is irrelevant'],
      };
    }

    case 'priceRange': {
      if (!Number.isSafeInteger(request.minimumCents)
        || !Number.isSafeInteger(request.maximumCents)
        || request.minimumCents > request.maximumCents) {
        throw new Error('Price bounds must be ordered safe integers.');
      }
      return {
        API: `IntField.newRangeQuery("price_cents", ${request.minimumCents}, ${request.maximumCents})`,
        field: 'price_cents (IntField)',
        guardrails: ['Keep one currency and unit contract', 'Validate inclusive bounds'],
      };
    }

    case 'humanText': {
      const value = request.value.trim();
      if (value.length === 0 || value.length > 256) {
        throw new Error('Search text must contain 1-256 characters.');
      }
      return {
        API: 'queryBuilder.createBooleanQuery("body", userText)',
        field: 'body (TextField)',
        guardrails: ['Reuse the field analyzer', 'Bound input and clause growth'],
      };
    }
  }
}

const plans = [
  buildQueryPlan({ kind: 'exactSku', value: 'BOOK-042-QA' }),
  buildQueryPlan({ kind: 'priceRange', minimumCents: 1000, maximumCents: 2500 }),
  buildQueryPlan({ kind: 'humanText', value: 'distributed systems' }),
];

if (plans.some((plan) => plan.guardrails.length < 2)) {
  throw new Error('Every query boundary needs explicit guardrails.');
}

console.log(JSON.stringify(plans, null, 2));
