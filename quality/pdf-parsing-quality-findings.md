# PDF Parsing Quality Findings

## Summary

This review verifies the current implementation against the architecture notes in [architecture/pdf-text-parsing-for-chunking.md](../architecture/pdf-text-parsing-for-chunking.md) and [architecture/pdf-text-parsing-for-chuning-v2.md](../architecture/pdf-text-parsing-for-chuning-v2.md).

The current code is only partially aligned with the approved design. The main issues are:

- a shared-layer duplicate PDF parser remains in place,
- the service registration still wires the shared parser instead of the feature-local parser,
- and a TypeScript contract mismatch blocks clean verification and compile safety.

## Verified findings

### 1) Shared-layer duplicate parser remains present

The architecture explicitly states that the PDF parser should be feature-local to the knowledge-embedding area instead of living in the shared layer.

Current evidence:

- Shared-layer parser exists at [src/shared/infrastructure/parsers/PdfTextParser.ts](../src/shared/infrastructure/parsers/PdfTextParser.ts)
- Feature-local parser exists at [src/features/knowledge-embedding/infrastructure/parsers/PdfTextParser.ts](../src/features/knowledge-embedding/infrastructure/parsers/PdfTextParser.ts)

This is a direct mismatch with the design requirement: the feature should not have a duplicate implementation in the shared layer.

### 2) Service registration mismatch

The architectural design requires the parser registry and the parser service to be wired to the feature-local parser implementation.

Current evidence:

- Shared registration in [src/shared/infrastructure/di/registerServices.ts](../src/shared/infrastructure/di/registerServices.ts) uses the shared parser:
  - `new ParserRegistry([new PdfTextParser()], ...)`
  - where `PdfTextParser` resolves from the shared infrastructure path
- The intended feature-local context is represented by the knowledge-embedding service and parser module in [src/features/knowledge-embedding/application/services/DocumentParserService.ts](../src/features/knowledge-embedding/application/services/DocumentParserService.ts) and [src/features/knowledge-embedding/infrastructure/parsers/PdfTextParser.ts](../src/features/knowledge-embedding/infrastructure/parsers/PdfTextParser.ts)

This creates a runtime mismatch between the approved architectural layering and the actual dependency injection wiring.

### 3) TypeScript contract break blocks clean verification

The current compile pass fails because the `ParseDocumentUseCase` constructor contract does not match how it is used in tests and DI.

Evidence:

- The class in [src/features/knowledge-embedding/application/usecases/ParseDocumentUseCase.ts](../src/features/knowledge-embedding/application/usecases/ParseDocumentUseCase.ts) is defined with a single constructor dependency: `constructor(private readonly parserRegistry: ParserRegistry) {}`
- The tests in [__tests__/unit/extractedDocumentTextPipeline.test.ts](__tests__/unit/extractedDocumentTextPipeline.test.ts) instantiate it with two arguments:
  - `new ParseDocumentUseCase(parserRegistry as never, repository).execute(...)`
- The DI registration in [src/shared/infrastructure/di/registerServices.ts](../src/shared/infrastructure/di/registerServices.ts) also calls it with two arguments:
  - `new ParseDocumentUseCase(c.resolve('ParserRegistry' as any), c.resolve('ExtractedDocumentTextRepository' as any))`

This is the current TypeScript break that blocked a clean project-level verification.

## Verification status

### Unit test evidence

Command executed:

```bash
cd /Users/boqi/OwnerBuilder && npm test -- --runTestsByPath src/features/knowledge-embedding/tests/unit/DocumentParserService.red.test.ts --watch=false
```

Result:

- 1 test suite passed
- 4 tests passed
- 0 failed

This confirms the isolated parser-service behavior is passing, but it does not prove the full repository is compile-clean because the broader contract mismatch remains unresolved.

### Typecheck evidence

Command executed:

```bash
cd /Users/boqi/OwnerBuilder && npx tsc --noEmit
```

Result:

- failed with 3 TypeScript errors
- the failures are in [__tests__/unit/extractedDocumentTextPipeline.test.ts](__tests__/unit/extractedDocumentTextPipeline.test.ts) and [src/shared/infrastructure/di/registerServices.ts](../src/shared/infrastructure/di/registerServices.ts)

## Conclusion

The current implementation is not yet fully compliant with the approved architecture.

It contains the three specific issues called out in the review:

1. a duplicate shared-layer parser,
2. a registration mismatch between the shared and feature-local parser boundaries,
3. and a TypeScript contract mismatch preventing clean verification.

Until these issues are corrected, the PDF parsing work remains only partially aligned with the documented design and should not be considered fully approved.
