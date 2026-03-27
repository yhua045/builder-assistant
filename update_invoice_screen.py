import re

with open('src/pages/invoices/InvoiceScreen.tsx', 'r') as f:
    content = f.read()

part1 = content.split("// Render inline form when view === 'form'")[0]

part2_raw = content.split("// ── Render: Error state ──────────────────────────────────────────────────")[1]
part2 = "// ── Render: Error state ──────────────────────────────────────────────────\n" + part2_raw

new_form = """// Render inline form when view === 'form' or as default
  if (view === 'form' || view === 'upload') {
    const isProcessing =
      processingStep === 'copying' ||
      processingStep === 'ocr' ||
      processingStep === 'normalizing';

    const processingLabel: Partial<Record<ProcessingStep, string>> = {
      copying: 'Copying file to app storage…',
      ocr: 'Extracting text from invoice…',
      normalizing: 'Analysing invoice fields…',
    };

    return (
      <View className="flex-1 bg-background pt-8" testID="invoice-screen">
        <View className="px-4 pb-2 mb-4">
          <Text className="text-2xl font-bold text-foreground">Add Invoice</Text>

          {/* Upload PDF Button */}
          <Pressable
            className="bg-primary rounded-lg p-4 mt-4 flex-row items-center justify-center"
            onPress={handleUploadPdf}
            disabled={isProcessing}
            testID="upload-pdf-button"
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" testID="upload-progress-indicator" />
            ) : (
              <>
                <Paperclip color="#fff" size={24} strokeWidth={2} />
                <Text className="text-white font-semibold text-lg ml-3">Upload Invoice PDF</Text>
              </>
            )}
          </Pressable>

          {isProcessing && processingLabel[processingStep] && (
            <Text
              className="text-sm text-muted-foreground text-center mt-2"
              testID="processing-status-text"
            >
              {processingLabel[processingStep]}
            </Text>
          )}
        </View>

        <View className="flex-1 border-t border-border pt-4">
          <Text className="text-muted-foreground text-center mb-4">Or enter manually</Text>
          <InvoiceForm
            mode="create"
            initialValues={formInitialValues}
            onCreate={handleFormSave}
            onCancel={handleFormCancel}
            isLoading={invoicesLoading}
            pdfFile={formPdfFile}
            embedded
          />
        </View>
      </View>
    );
  }

"""

new_content = part1 + new_form + part2

# Now remove everything past // ── Render: OCR/Normalizing in-progress or idle ────────────────────────── (which used to be the default return)
new_content_final = new_content.split("// ── Render: OCR/Normalizing in-progress or idle ──────────────────────────")[0]

new_content_final += "};\n"

with open('src/pages/invoices/InvoiceScreen.tsx', 'w') as f:
    f.write(new_content_final)
