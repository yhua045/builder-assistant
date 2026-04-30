/**
 * IImageReader — application-layer port for reading image bytes.
 *
 * Implementations must NOT throw for valid image URIs; they should throw a
 * descriptive Error for file-not-found or permission errors.
 */
export interface IImageReader {
  /**
   * Read the image at `imageUri` and return its bytes as a Base64 string.
   * The returned string must NOT include a data-URI prefix (no "data:...;base64,").
   */
  readAsBase64(imageUri: string): Promise<string>;

  /**
   * Infer a MIME type from the URI extension.
   * Returns `'image/jpeg'` when the extension is unrecognised.
   */
  getMimeType(imageUri: string): string;
}
