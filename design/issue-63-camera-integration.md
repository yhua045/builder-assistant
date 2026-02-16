# Issue #63 — Camera Integration for Snap Receipt

## User Story

As a user tapping the "Snap Receipt" button, I want to open my device camera to capture a receipt photo, which is then automatically processed via OCR and populated into the receipt form, so I can quickly review and save receipt details without manual data entry.

## Context

- **Related**: Issue #48 (Snap Receipt base), Issue #54 (OCR pipeline)
- **Current State**: 
  - ✅ `SnapReceiptScreen` exists with text input placeholder for image URI
  - ✅ `useSnapReceipt` hook processes images via OCR
  - ✅ `ReceiptForm` displays parsed data with confidence indicators
  - ✅ OCR pipeline fully implemented
  - ❌ No camera capture capability
  - ❌ No permission handling

## Acceptance Criteria

1. **Camera Launch**
   - [ ] Tapping "Snap Receipt" opens device camera (iOS & Android)
   - [ ] Requests camera permissions if not granted
   - [ ] Shows user-friendly message if permissions denied

2. **Photo Capture**
   - [ ] User can capture photo or cancel
   - [ ] Captured photo has stable file URI/path
   - [ ] Cancel returns to previous screen without processing

3. **OCR Processing**
   - [ ] Captured URI is passed to `useSnapReceipt(fileUri)`
   - [ ] Loading indicator shown during processing
   - [ ] Errors show user-friendly message with retry option

4. **Form Population**
   - [ ] Parsed data populates `ReceiptForm` fields
   - [ ] User can review/edit before saving
   - [ ] Confidence indicators guide user attention

5. **Edge Cases**
   - [ ] iOS: Handles temporary file paths correctly
   - [ ] Android: Handles runtime permissions
   - [ ] Large images handled gracefully
   - [ ] File cleanup after processing

## Technical Design

### 1. Camera Library Selection

**Chosen**: `react-native-image-picker` v7+

**Rationale**:
- Lightweight (no native camera view overhead)
- Supports both camera and gallery
- Built-in permission handling
- Well-maintained with React Native 0.81 support
- Simple API for our use case

**Alternative Considered**: 
- `react-native-vision-camera`: More powerful but overkill for simple capture
- `expo-image-picker`: Would require Expo (not applicable)

### 2. Architecture

```
UI Layer (SnapReceiptScreen)
    ↓
Infrastructure (CameraAdapter)
    ↓ (file URI)
Application (useSnapReceipt → OCR pipeline)
    ↓ (NormalizedReceipt)
UI Layer (ReceiptForm)
```

#### New Files

**`src/infrastructure/camera/ICameraAdapter.ts`** (interface)
```typescript
export interface CameraOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
}

export interface CameraResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  cancelled: boolean;
}

export interface ICameraAdapter {
  /**
   * Launch device camera to capture photo
   * @returns CameraResult with file URI or cancelled flag
   * @throws Error if permissions denied or camera unavailable
   */
  capturePhoto(options?: CameraOptions): Promise<CameraResult>;
  
  /**
   * Check if camera permissions are granted
   */
  hasPermissions(): Promise<boolean>;
  
  /**
   * Request camera permissions
   */
  requestPermissions(): Promise<boolean>;
}
```

**`src/infrastructure/camera/MobileCameraAdapter.ts`** (implementation)
- Wraps `react-native-image-picker`
- Implements `ICameraAdapter`
- Handles permissions gracefully
- Returns file URI suitable for OCR processing

**`src/infrastructure/camera/__mocks__/MockCameraAdapter.ts`** (for tests)
- Returns mock file URIs
- Simulates success/cancel/error scenarios

#### Modified Files

**`src/pages/receipts/SnapReceiptScreen.tsx`**
- Remove text input placeholder
- Add camera button (prominent)
- Add "or enter manually" fallback
- Integrate `MobileCameraAdapter`
- Handle camera errors gracefully

**`package.json`**
- Add `react-native-image-picker`: `^7.2.0`

**Platform Configuration**
- `ios/BuilderAssistantApp/Info.plist`: Add camera usage description
- `android/app/src/main/AndroidManifest.xml`: Camera permission already included

### 3. User Flow

```
User taps "Snap Receipt"
    ↓
SnapReceiptScreen opens
    ↓
User taps camera button
    ↓
Permission check
    ├─ Granted → Launch camera
    └─ Denied → Show message + settings link
    ↓
[Camera native UI]
    ├─ Cancel → Return to screen
    └─ Capture → Return with URI
    ↓
Show loading: "Extracting receipt details..."
    ↓
useSnapReceipt.processReceipt(uri)
    ↓
ReceiptForm populated with parsed data
    ↓
User reviews/edits → Save
```

### 4. Error Handling

| Scenario | User Message | Action |
|----------|-------------|--------|
| Permissions denied | "Camera access required to scan receipts" | Link to settings |
| Camera unavailable | "Camera not available on this device" | Show manual entry |
| OCR fails | "Could not read receipt. Please enter manually" | Populate empty form |
| Large image | Loading timeout | Suggest retry or manual entry |
| Invalid file path | "Could not access photo" | Retry button |

### 5. Implementation Strategy (TDD)

#### Phase 1: Interface & Tests (Week 1, Day 1-2)
1. Create `ICameraAdapter` interface
2. Write unit tests for `SnapReceiptScreen` with mock camera
3. Write integration test: camera → OCR → form flow
4. Tests should fail initially ✅

#### Phase 2: Implementation (Week 1, Day 3-4)
1. Install `react-native-image-picker`
2. Configure iOS/Android permissions
3. Implement `MobileCameraAdapter`
4. Update `SnapReceiptScreen` to use camera
5. Tests should pass ✅

#### Phase 3: Manual QA (Week 1, Day 5)
1. Test on iOS simulator + physical device
2. Test on Android emulator + physical device
3. Test permission flows (grant/deny/ask-again)
4. Test with various receipt types (clear/blurry/low-light)
5. Test cancel/retry flows

### 6. Testing Approach

#### Unit Tests

**`__tests__/unit/MobileCameraAdapter.test.ts`**
- Mock `react-native-image-picker`
- Test capture success
- Test user cancellation
- Test permission denied
- Test error scenarios

**`__tests__/unit/SnapReceiptScreen.camera.test.tsx`**
- Mock `ICameraAdapter`
- Test camera button triggers capture
- Test loading states
- Test error messages
- Test form population after OCR

#### Integration Tests

**`__tests__/integration/SnapReceiptCamera.integration.test.tsx`**
- Mock camera adapter returns fixture URI
- Mock OCR returns sample parsed data
- Verify full flow: button → camera → OCR → form
- Verify cancel flow
- Verify error recovery

#### Manual QA Checklist

**iOS**:
- [ ] Camera opens correctly
- [ ] Permission prompt shows with usage description
- [ ] Capture returns valid file URI
- [ ] OCR can read file from temp directory
- [ ] File cleanup works
- [ ] Cancel flow works

**Android**:
- [ ] Runtime permission prompt works
- [ ] Camera opens correctly
- [ ] Large images handled (memory)
- [ ] File URI accessible to OCR
- [ ] Permission denial handled gracefully

### 7. Dependencies

```json
{
  "react-native-image-picker": "^7.2.0"
}
```

**Platform Requirements**:
- iOS: Info.plist camera usage string
- Android: CAMERA permission in manifest (likely already present)

### 8. File Structure

```
src/
├─ infrastructure/
│  └─ camera/
│     ├─ ICameraAdapter.ts          (NEW)
│     ├─ MobileCameraAdapter.ts     (NEW)
│     └─ MockCameraAdapter.ts    (NEW)
├─ pages/
│  └─ receipts/
│     └─ SnapReceiptScreen.tsx      (MODIFIED)
├─ hooks/
│  └─ useSnapReceipt.ts             (NO CHANGE)
└─ components/
   └─ receipts/
      └─ ReceiptForm.tsx             (NO CHANGE)

__tests__/
├─ unit/
│  ├─ MobileCameraAdapter.test.ts   (NEW)
│  └─ SnapReceiptScreen.camera.test.tsx (NEW)
└─ integration/
   └─ SnapReceiptCamera.integration.test.tsx (NEW)

ios/
└─ BuilderAssistantApp/
   └─ Info.plist                     (MODIFIED)
```

### 9. iOS Configuration

**Info.plist additions**:
```xml
<key>NSCameraUsageDescription</key>
<string>Builder Assistant needs camera access to scan receipts and documents</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Builder Assistant needs photo access to import receipt images</string>
```

### 10. Non-Functional Requirements

**Performance**:
- Camera launch: < 500ms
- Photo capture → OCR start: < 200ms
- OCR processing: < 5s (per existing OCR pipeline)

**UX**:
- Clear loading indicators
- Graceful permission handling
- Retry options on failure
- Manual entry always available as fallback

**Security**:
- Temporary files cleaned up after processing
- No persistent storage without explicit save
- Respect user privacy (no cloud upload)

## Out of Scope

- Photo editing (crop/rotate/filters)
- Multiple photo capture
- Gallery selection (can be added later with minimal changes)
- QR code scanning
- Server-side OCR
- Custom camera UI

## Migration Path

This is a new feature, no migration needed. Existing manual entry flow remains unchanged and available as fallback.

## Success Metrics

- [ ] Unit tests: 90%+ coverage for camera adapter
- [ ] Integration tests: Full flow covered
- [ ] Manual QA: All checklist items pass on iOS & Android
- [ ] Performance: Targets met
- [ ] Code review: Approved by 1+ reviewer

## Open Questions

1. Should we support gallery selection in addition to camera? 
   - **Decision**: Not in this issue, but `react-native-image-picker` supports it trivially
2. What image size/quality for OCR performance?
   - **Decision**: Max 1920x1080, quality 0.8 (balance speed vs accuracy)
3. File cleanup: when?
   - **Decision**: After OCR processing completes (success or failure)
4. Retry limits for OCR failures?
   - **Decision**: Unlimited retries, user decides when to give up

## References

- [react-native-image-picker docs](https://github.com/react-native-image-picker/react-native-image-picker)
- Issue #48: Snap Receipt base implementation
- Issue #54: OCR pipeline
- CLAUDE.md: TDD workflow
