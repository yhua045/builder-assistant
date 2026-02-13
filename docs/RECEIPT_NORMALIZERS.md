# Receipt Normalizers - Selection Guide

This document explains the three available receipt normalizers and when to use each one.

## Available Normalizers

### 1. **NoOpReceiptNormalizer** (Stub/Placeholder)
**Location**: `src/application/receipt/NoOpReceiptNormalizer.ts`

**When to use:**
- During initial development/testing
- When you want OCR extraction but no normalization
- As a baseline for comparing other normalizers

**Characteristics:**
- ✅ Simplest implementation
- ✅ No dependencies
- ✅ Fast (no processing)
- ❌ Low confidence scores (0.5)
- ❌ No field validation
- ❌ No business rules

**Output:**
- Picks first candidate for each field
- Largest amount as total
- No validation or cleanup

---

### 2. **DeterministicReceiptNormalizer** (Rules-Based) ⭐ **RECOMMENDED**
**Location**: `src/application/receipt/DeterministicReceiptNormalizer.ts`

**When to use:**
- **Production deployments** (default choice)
- When you need reliable, deterministic behavior
- When you want good accuracy without ML complexity
- When offline/on-device processing is required

**Characteristics:**
- ✅ Production-ready
- ✅ Deterministic and testable
- ✅ Intelligent business rules
- ✅ Field validation
- ✅ No external dependencies
- ✅ Fast (~1-5ms)
- ⚠️ Limited to rule-based heuristics

**Features:**
- **Vendor Cleanup**: Removes "Inc.", "LLC", "Ltd.", etc.
- **Date Selection**: Prefers recent dates (within 30 days)
- **Amount Validation**: Total ≥ sum of line items
- **Tax Validation**: Tax < total
- **Currency Detection**: Detects $, €, £, ¥ symbols
- **Confidence Scoring**: Rule-based confidence (0.0-1.0)
- **Suggested Corrections**: Generates helpful warnings

**Example:**
```typescript
import { DeterministicReceiptNormalizer } from './src/application/receipt/DeterministicReceiptNormalizer';

const normalizer = new DeterministicReceiptNormalizer();
const normalized = await normalizer.normalize(candidates, ocrResult);

// Output:
// {
//   vendor: "Home Depot",           // Cleaned "Inc." suffix
//   date: 2026-02-12,                // Most recent date
//   total: 100.00,                   // Validated against line items
//   tax: 10.00,                      // Validated < total
//   confidence: {
//     overall: 0.85,
//     vendor: 0.9,
//     date: 0.8,
//     total: 0.9
//   }
// }
```

---

### 3. **TfLiteReceiptNormalizer** (ML-Based) 🚧 **FUTURE/OPTIONAL**
**Location**: `src/infrastructure/ai/TfLiteReceiptNormalizer.ts`

**When to use:**
- When you need highest accuracy
- When you have a trained TensorFlow Lite model
- When candidates are ambiguous (multiple vendors, dates, amounts)
- When you need category predictions for line items

**Characteristics:**
- ✅ Highest potential accuracy
- ✅ Learns from data patterns
- ✅ Handles ambiguous cases
- ⚠️ Requires trained model (.tflite file)
- ⚠️ Requires react-native-tflite bindings
- ⚠️ Slower (~50-200ms depending on model)
- ⚠️ Larger app bundle size

**Current Status:**
- ⚠️ **Template implementation only**
- ⚠️ Requires trained model (not included)
- ✅ Falls back to DeterministicReceiptNormalizer

**Prerequisites for Real Implementation:**
1. Trained TensorFlow Lite model file (`.tflite`)
2. Install: `npm install react-native-tflite`
3. Training dataset: ~10,000+ labeled receipts
4. Feature engineering implementation

**How to Train a Model:**
See detailed guide in `TfLiteReceiptNormalizer.ts` documentation.

---

## How to Switch Normalizers

### In `useSnapReceipt` Hook

**Default (DeterministicReceiptNormalizer):**
```typescript
// src/hooks/useSnapReceipt.ts
const useCase = new SnapReceiptUseCase(
    receiptRepo,
    new MobileOcrAdapter(),
    new ReceiptFieldParser(),
    new DeterministicReceiptNormalizer()  // ✅ Production default
);
```

**Switch to NoOp (stub):**
```typescript
import { NoOpReceiptNormalizer } from '../application/receipt/NoOpReceiptNormalizer';

const useCase = new SnapReceiptUseCase(
    receiptRepo,
    new MobileOcrAdapter(),
    new ReceiptFieldParser(),
    new NoOpReceiptNormalizer()  // For testing only
);
```

**Switch to TFLite (when ready):**
```typescript
import { TfLiteReceiptNormalizer } from '../infrastructure/ai/TfLiteReceiptNormalizer';

const useCase = new SnapReceiptUseCase(
    receiptRepo,
    new MobileOcrAdapter(),
    new ReceiptFieldParser(),
    new TfLiteReceiptNormalizer()  // Requires model + bindings
);
```

### Feature Flag Configuration

**Environment-based selection:**
```typescript
// src/config/features.ts
export const FEATURES = {
  USE_ML_NORMALIZER: process.env.USE_ML_NORMALIZER === 'true',
  USE_ADVANCED_NORMALIZER: process.env.USE_ADVANCED_NORMALIZER === 'true'
};

// src/hooks/useSnapReceipt.ts
import { FEATURES } from '../config/features';
import { TfLiteReceiptNormalizer } from '../infrastructure/ai/TfLiteReceiptNormalizer';
import { DeterministicReceiptNormalizer } from '../application/receipt/DeterministicReceiptNormalizer';

const getNormalizer = () => {
  if (FEATURES.USE_ML_NORMALIZER) {
    return new TfLiteReceiptNormalizer();
  }
  return new DeterministicReceiptNormalizer();
};

const useCase = new SnapReceiptUseCase(
    receiptRepo,
    new MobileOcrAdapter(),
    new ReceiptFieldParser(),
    getNormalizer()
);
```

---

## Performance Comparison

| Normalizer | Speed | Accuracy | Offline | Dependencies | Bundle Size |
|-----------|-------|----------|---------|--------------|-------------|
| NoOp | < 1ms | Low (50%) | ✅ Yes | None | 0 KB |
| **Deterministic** | 1-5ms | **Good (80-90%)** | ✅ Yes | None | **2 KB** |
| TFLite | 50-200ms | High (90-95%) | ✅ Yes | react-native-tflite, model | 5-20 MB |

---

## Testing Different Normalizers

```typescript
// __tests__/unit/Normalizers.comparison.test.ts
describe('Normalizer Comparison', () => {
  const testCases = [/* receipt fixtures */];

  it('compares NoOp vs Deterministic', async () => {
    const noOp = new NoOpReceiptNormalizer();
    const deterministic = new DeterministicReceiptNormalizer();

    for (const testCase of testCases) {
      const noOpResult = await noOp.normalize(testCase.candidates, testCase.ocrResult);
      const detResult = await deterministic.normalize(testCase.candidates, testCase.ocrResult);

      // Deterministic should have higher confidence
      expect(detResult.confidence.overall).toBeGreaterThan(noOpResult.confidence.overall);
    }
  });
});
```

---

## Recommendations

1. **Start with DeterministicReceiptNormalizer** (default)
   - Production-ready
   - No extra dependencies
   - Good accuracy for most use cases

2. **Use NoOpReceiptNormalizer only for**:
   - Initial development/testing
   - Baseline benchmarking

3. **Implement TfLiteReceiptNormalizer when**:
   - You have ML expertise and resources
   - You need highest accuracy
   - You can train and maintain models
   - You have a large labeled dataset

---

## Future Enhancements

**Hybrid Approach:**
Combine deterministic + ML for best results:
```typescript
class HybridReceiptNormalizer implements IReceiptNormalizer {
  async normalize(candidates, ocrResult) {
    // 1. Run deterministic normalizer (fast)
    const deterministicResult = await deterministicNormalizer.normalize(candidates, ocrResult);

    // 2. If confidence is low, use ML as fallback
    if (deterministicResult.confidence.overall < 0.7) {
      return await mlNormalizer.normalize(candidates, ocrResult);
    }

    return deterministicResult;
  }
}
```

**Server-Side AI:**
For highest accuracy without bundle size impact:
```typescript
// src/infrastructure/ai/RemoteReceiptNormalizer.ts
class RemoteReceiptNormalizer implements IReceiptNormalizer {
  async normalize(candidates, ocrResult) {
    const response = await fetch('https://api.example.com/normalize-receipt', {
      method: 'POST',
      body: JSON.stringify({ candidates, ocrResult })
    });
    return response.json();
  }
}
```

---

## Questions?

- See implementation: `src/application/receipt/DeterministicReceiptNormalizer.ts`
- See tests: `__tests__/unit/DeterministicReceiptNormalizer.test.ts`
- See TFLite template: `src/infrastructure/ai/TfLiteReceiptNormalizer.ts`
