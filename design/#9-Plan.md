# Issue #9 Architecture Plan: Receipt OCR & AI Validation

**Issue**: MVP: Manual upload → OCR → Draft expense → User review → Local save  
**Created**: 2026-02-02  
**Status**: Architecture Planning Phase

## 1. Executive Summary

This document outlines the architectural decisions for implementing receipt OCR and AI validation for the Builder Assistant app. The core challenge is to design a cost-effective, privacy-preserving solution that works reliably across iOS and Android platforms.

## 2. Requirements Analysis

### Functional Requirements
- Manual photo upload (camera or gallery)
- OCR extraction of: amounts, vendor names, dates
- AI validation to structure and validate extracted data
- Draft expense creation with confidence scores
- User review/edit/accept workflow
- Encrypted local storage (SQLite)

### Non-Functional Requirements
- **Cost**: Minimize or eliminate cloud costs (MVP constraint)
- **Privacy**: User data should remain on-device when possible
- **Performance**: Acceptable processing time (<5 seconds ideal)
- **Accuracy**: Sufficient for draft creation (human review step provides safety)
- **Cross-platform**: Work on both iOS and Android

## 3. Key Architecture Decisions

### Decision 1: Where to Run OCR?

#### Option A: On-Device OCR (RECOMMENDED ✅)
**Technology**: Google ML Kit Text Recognition v2


**Implementation**:
```javascript
// React Native ML Kit
@react-native-ml-kit/text-recognition
```

**Technical Details**:
- Uses on-device neural network models
- Supports Latin, Chinese, Japanese, Korean scripts
- Returns bounding boxes and confidence scores
- No device GPU required (CPU optimized)



**DECISION**: Start with **Option A (On-Device ML Kit)** for MVP
- Aligns with cost constraints
- Privacy-first approach
- Sufficient accuracy for human-reviewed drafts
- Can add cloud fallback in future iterations

---

### Decision 2: Where to Run AI Validation?

#### Option A: On-Device Lightweight Model (RECOMMENDED ✅)
**Technology**: TensorFlow Lite or Rule-Based Parser

**Implementation Strategies**:

##### Strategy 2: TensorFlow Lite Model (Future Enhancement)
```javascript
// @tensorflow/tfjs-react-native
// Custom trained model for receipt field classification
```

**Model Options**:
- Train custom model on receipt dataset
- Fine-tune existing NER (Named Entity Recognition) model
- Use pre-trained models: MobileBERT, DistilBERT (quantized)


**DECISION**: Start with **Strategy 2 (TensorFlow Lite Model)** for MVP
- Zero cost
- Immediate implementation
- Sufficient for human-reviewed workflow
- Easy to enhance with TF Lite later
- Add cloud AI as optional premium feature in future

---

## 4. Recommended Architecture (MVP)

```
┌─────────────────────────────────────────────────────┐
│                  Mobile App (React Native)           │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐         ┌─────────────────────┐  │
│  │ Camera/Gallery│────────▶│  Image Capture      │  │
│  │  Component   │         │  Component          │  │
│  └──────────────┘         └─────────────────────┘  │
│                                    │                │
│                                    ▼                │
│                           ┌─────────────────────┐  │
│                           │  ML Kit OCR         │  │
│                           │  (On-Device)        │  │
│                           │  @react-native-ml-  │  │
│                           │  kit/text-recog     │  │
│                           └─────────────────────┘  │
│                                    │                │
│                                    ▼                │
│                           ┌─────────────────────┐  │
│                           │  TensorFlow Lite    │  │
│                           │  Model (On-Device)  │  │
│                           │  - Field extraction │  │
│                           │  - Amount / Date /  │  │
│                           │    Vendor NER       │  │
│                           │  - Confidence score │  │
│                           └─────────────────────┘  │
│                                    │                │
│                                    ▼                │
│                           ┌─────────────────────┐  │
│                           │  Draft Expense      │  │
│                           │  Creator            │  │
│                           └─────────────────────┘  │
│                                    │                │
│                                    ▼                │
│                           ┌─────────────────────┐  │
│                           │  Review UI          │  │
│                           │  (User Edit/Accept) │  │
│                           └─────────────────────┘  │
│                                    │                │
│                                    ▼                │
│                           ┌─────────────────────┐  │
│                           │  Encrypted SQLite   │  │
│                           │  @op-engineering/   │  │
│                           │  react-native-quick │  │
│                           │  -sqlite            │  │
│                           └─────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘

ALL PROCESSING ON-DEVICE - NO CLOUD COSTS
```

---

## 5. Technology Stack

### OCR Layer
**Library**: `@react-native-ml-kit/text-recognition`
- **Version**: Latest stable
- **License**: Apache 2.0
- **Bundle Size**: ~8MB (iOS), ~5MB (Android)
- **Documentation**: https://github.com/a7medev/react-native-ml-kit

**Alternative** (if ML Kit has issues):
- `react-native-vision-camera` + `vision-camera-ocr` plugin

### AI Validation Layer (MVP)

**Approach**: TensorFlow Lite model running on-device

**Implementation**:
- Use a lightweight NER / field-classification model (MobileBERT, DistilBERT or a small transformer) converted to TensorFlow Lite and quantized for mobile.
- Prototype with `@tensorflow/tfjs-react-native` or native TF Lite bindings for production inference.
- Model responsibilities: classify OCR tokens, extract amounts/dates/vendors, output structured fields and confidence scores.
- Training: fine-tune on receipt datasets (SROIE, internal samples) for NER/sequence classification; convert and quantize to TFLite.
- Inference: run on-device; typical latency <200ms on modern devices. Provide rule-based fallback for very low-confidence cases.


### Storage Layer
**Library**: `@op-engineering/react-native-quick-sqlite`
- Built-in encryption support
- High performance
- React Native optimized

**Schema**:
```sql
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  propertyId TEXT,
  sourceType TEXT,
  sourceUri TEXT,
  rawText TEXT,
  vendor TEXT,
  amount REAL,
  currency TEXT,
  date TEXT,
  category TEXT,
  trade TEXT,
  confidence REAL,
  validatedByAI INTEGER,
  createdAt TEXT,
  updatedAt TEXT
);
```

---



## 8. Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low OCR accuracy on blurry photos | High | Add image quality check, suggest retake |
| Parser fails on uncommon receipt formats | Medium | Human review step, collect edge cases |
| ML Kit library compatibility issues | High | Have fallback to vision-camera-ocr |
| App size increase | Low | Use dynamic feature modules |
| Privacy concerns with future cloud | Medium | Make cloud features opt-in, transparent |

---


## 11. Open Questions

1. **Image Quality**: Should we enforce minimum image quality before OCR?
2. **Vendor Database**: Build initial vendor-to-category mapping database?
3. **Multi-language**: Support receipts in languages other than English?
4. **Receipt Templates**: Pre-define templates for common vendor formats?
5. **Cloud Strategy**: When/how to introduce optional cloud features?

---

## 12. References & Resources

### Libraries
- ML Kit: https://developers.google.com/ml-kit/vision/text-recognition
- React Native ML Kit: https://github.com/a7medev/react-native-ml-kit
- Quick SQLite: https://github.com/margelo/react-native-quick-sqlite

### Documentation
- Receipt OCR Best Practices: https://cloud.google.com/vision/docs/ocr
- TensorFlow Lite: https://www.tensorflow.org/lite
- Privacy Guidelines: GDPR/CCPA compliance for on-device processing

### Sample Datasets (for testing)
- SROIE (Scanned Receipts OCR and IE): https://rrc.cvc.uab.es/?ch=13
- Cordts Receipt Dataset: Public receipt images for testing



**Document Status**: Draft for Review  
**Last Updated**: 2026-02-02  
**Next Review**: After technical spike completion
